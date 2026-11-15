// The sync engine for one account session: checks the protocol is still
// served, uploads the queue in dependency order, then applies the account's
// feed after its durable cursor. All local writes go through the account
// store's one writer (SyncStore).
//
// - An entry's operation is fixed in the store before it is first sent, so a
//   lost response, a kill or a duplicate always resends the identical request
//   and the server answers from its durable receipt.
// - A disposition and the queue acknowledgement commit together; until then
//   the entry stays pending. Upload never touches payouts, charges or any
//   other local effect: it only acknowledges.
// - A result too large for one request is sent as a manifest of chunks
//   (protocol.ts). The manifest goes first; when the server reports chunks it
//   hasn't staged (never sent, or expired), those are staged and the identical
//   manifest is sent again. So a retry after a lost answer gets its receipt
//   without resending a chunk, and the payload stays in the queue until then.
// - Feed pages apply with their cursor atomically, and never past a change
//   this build can't read.
// - Runs coalesce: a request while a run is going makes one more run.
// - Failures (spec 2, *Retries*): nothing is ever deleted and nothing loops.
//   A run that gets no usable answer backs off, jittered and exponential from
//   about 1 s to 5 min, and never sooner than the server's retry-after.
//   Automatic triggers wait for the backoff; a deliberate one doesn't (but
//   still honors retry-after). A record that fails by itself backs off on its
//   own while the others go on, and after RECORD_FAILURE_LIMIT failures it is
//   flagged: left alone, with everything that depends on it, until a
//   deliberate retry. A refused receipt goes to review. A protocol the server
//   no longer serves stops sync (never play) until an update.
//
// - A revisioned item's acknowledgement records nothing as accepted: whether
//   its upload became a revision or a proposal, the item's state arrives with
//   the feed entry its receipt names, in the same run.
// - Resolving a conflict needs the network: it is sent at once, never queued.
// - The reconnect order (spec 2 Amendment 1 C5): authenticate, then reconcile
//   compatibility, access, allowance ownership and pending privacy (sharing)
//   withdrawals, and only then send grants or contributions. A run checks the
//   protocol, uploads every entry except grants and contributions (sharing
//   withdrawals, allowance reconciliations, results), applies the feed through
//   to the account's head, and only then sends the types registered
//   `afterReconciliation`. A call the server denies (authentication, access),
//   refuses as incompatible or doesn't answer ends the run first.
// - A barrier holds while any affected upload of its type is unacknowledged,
//   wherever it sits in the queue, and the server checks each named
//   dependency has its receipt under the synchronization head (`after`):
//   until then it answers "waiting", which is no failure of the record.
// - An uncertain answer (lost, waiting, unreadable) acknowledges nothing: the
//   entry stays pending, with every entry it holds back, until a receipt arrives.
// - Per-device records carry their originating-device position; a purge
//   removes its result when its feed entry applies; a purged result's own
//   entries carry nothing and the cursor steps over them.
// - Bootstrap (spec 2, *Bootstrap*): an installation with no baseline gets
//   one before it reads the feed. It asks for a snapshot (every summary and
//   lifetime total at one watermark), pages its rows into local staging, then
//   installs the baseline and moves the cursor to the watermark together, so
//   the feed continues after it. Progress is durable: a restart, or a run that
//   lost the network, carries on from the last staged page. A snapshot that
//   expired (24 hours) is replaced with a new one; the upload queue and local
//   records are never touched. Snapshot pages, like feed pages, are bounded by
//   row count and by bytes (PAGE_BYTES).
// - History (spec 2, *History*): a snapshot holds summaries; once they are
//   installed, the newest 90 days' detail follows, then (when asked for)
//   Download all history's, and a record opened by itself (`detail`) fetches
//   its own, each by the accepted revision held here. A detail replaces its
//   summary only. Downloads stop, evicting nothing, when the device is short
//   of storage; a budget alert throttles Download all history only.
// - Operational metrics (#108): a run that ends unfinished reports its error
//   code, a record failing, flagged or refused reports which, and after a run
//   the oldest pending record's wait (since this account session first saw
//   it). Only codes and durations: never a record's type, item or payload.

import { canonicalJson } from '@tableside/engine';

import type { MetricsSender } from '../metrics';

import { backoffDelay } from './backoff';
import {
  type BootstrapPage,
  type BootstrapSnapshot,
  type ChunkAnswer,
  DETAIL_REQUESTS,
  type DetailAnswer,
  type DetailPage,
  type DetailRequest,
  type FeedEntry,
  type FeedPage,
  PAGE_BYTES,
  PROTOCOL_VERSION,
  type PreparedOperation,
  type ProtocolStatus,
  type StagedChunk,
  SyncCallError,
  type UploadAnswer,
  chunksOf,
  prepareOperation,
} from './protocol';
import { type RecordType, type RevisionedUpload, isBarrierFor } from './registry';
import type { AcceptedRecord, BootstrapProgress, BootstrapStaging, HistoryProgress, Origin, QueuedUpload, RecordRef, SummaryOnly, SyncStore } from './store';

/** The backend's operations. A call with no usable answer throws a SyncCallError; any other rejection counts as unreachable. */
export interface SyncBackend {
  /** What the server says about this build's protocol version. */
  protocol(version: number): Promise<ProtocolStatus>;
  upload(request: string): Promise<UploadAnswer>;
  /** Stages one chunk of a result, privately, for the operation whose manifest names it. */
  stageChunk(chunk: StagedChunk): Promise<ChunkAnswer>;
  feed(after: number, pageSize: number): Promise<FeedPage>;
  /** Makes a bootstrap snapshot of the account for this installation, replacing its earlier one. */
  bootstrap(installation: string): Promise<BootstrapSnapshot>;
  /** A page of a snapshot's rows after ordinal `after`. */
  bootstrapPage(snapshot: string, after: number, pageSize: number): Promise<BootstrapPage>;
  /** Records' detail, by the accepted revision held here; `bulk` for Download all history, which a budget alert throttles. */
  details(requests: readonly DetailRequest[], bulk: boolean): Promise<DetailPage>;
}

/**
 * How a run ended, when not cleanly.
 * offline: the backend couldn't be reached, or was too busy to answer.
 * sign-in-required: the session wasn't accepted, even renewed. Records are kept until the player signs in again.
 * incompatible: the server no longer serves this protocol: an update is required.
 * unsendable: a record failed by itself (it couldn't be sent, or the server refused the request); the others went on.
 * unreadable-change: the feed holds a change this build can't apply; the cursor stays before it.
 * storage: a local write failed (a full disk, an I/O error); nothing was half applied.
 */
export type SyncErrorCode = 'offline' | 'sign-in-required' | 'incompatible' | 'unsendable' | 'unreadable-change' | 'storage';

/**
 * waiting: will upload by itself. paused: waits for a flagged record it depends on.
 * flagged: failed repeatedly; waits for a deliberate retry. review: the server refused it.
 */
export type UploadState = 'waiting' | 'paused' | 'flagged' | 'review';

/** A record not (yet) in the account. */
export interface UploadStatus {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  readonly state: UploadState;
}

/** A protocol retirement the player hears about: dated ahead, or in effect now. `reason` explains an urgent one. */
export type UpdateNotice =
  | { readonly state: 'retiring'; readonly retiresAt: number; readonly reason: string | null }
  | { readonly state: 'required'; readonly reason: string | null };

/**
 * The first download on a new device: complete, or how far summaries and
 * totals and the newest 90 days of detail have come, as fractions from 0 to 1.
 * `stopped` says it stopped because the device is short of storage: it
 * resumes on a deliberate retry.
 */
export type HistoryStatus =
  | { readonly state: 'complete' }
  | { readonly state: 'incomplete'; readonly summaries: number; readonly detail: number; readonly stopped: 'storage' | null };

/**
 * Download all history (spec 2, *History*): not asked for; downloading, with
 * how far it has come (0 to 1); stopped there, because the device is short of
 * storage (it resumes when asked again) or a budget alert holds bulk
 * downloads back (it resumes by itself); or complete, with every record's
 * detail on this installation.
 */
export type HistoryDownload =
  | { readonly state: 'not-requested' }
  | { readonly state: 'downloading'; readonly progress: number }
  | { readonly state: 'stopped'; readonly progress: number; readonly reason: 'storage' | 'throttled' }
  | { readonly state: 'complete' };

export interface EngineStatus {
  readonly error: SyncErrorCode | null;
  /** When a run last finished with every call answered and nothing failing. */
  readonly lastSyncedAt: number | null;
  /** Records not in the account: pending ones in queue order, then refused ones. */
  readonly uploads: readonly UploadStatus[];
  readonly update: UpdateNotice | null;
  readonly history: HistoryStatus;
  readonly download: HistoryDownload;
}

/**
 * Opening a record's detail.
 * detail: the record whole, kept on this installation from now on.
 * gone: the account doesn't hold it (purged), and now neither does this installation.
 * offline: no answer arrived; the summary stays.
 * storage: the device is too short of storage to keep it; the summary stays.
 * unavailable: its type keeps no detail apart, or this build can't read the detail.
 */
export type DetailResult =
  | { readonly status: 'detail'; readonly record: AcceptedRecord }
  | { readonly status: 'gone' | 'offline' | 'storage' | 'unavailable' };

export interface SyncEngineOptions {
  readonly store: SyncStore;
  readonly backend: SyncBackend;
  readonly registry: ReadonlyMap<string, RecordType>;
  readonly installationId: string;
  /** A fresh random operation ID: 32 lowercase hex digits. */
  newOperationId(): string;
  /** Milliseconds since the epoch. */
  readonly clock: () => number;
  /** Uniform in [0, 1): the backoff's jitter. */
  readonly random: () => number;
  /** Where the engine's operational metrics go, under the account gate. */
  readonly metrics?: MetricsSender;
  /** The device's free storage in bytes, or null when it can't tell. Downloads stop before they would leave less than STORAGE_RESERVE_BYTES. */
  readonly storage?: () => number | null;
}

/**
 * automatic: a save, a live hint, the 60 s cadence or a retry falling due; it waits out a backoff.
 * deliberate: the session opening, foregrounding, reconnecting, or the player asking; it doesn't.
 */
export type ReconcileTrigger = 'automatic' | 'deliberate';

export const FEED_PAGE_SIZE = 50;
export const BOOTSTRAP_PAGE_SIZE = 100;
/** How many times one record may fail by itself before it is flagged. */
export const RECORD_FAILURE_LIMIT = 5;
/** The detail a new device fetches after its summaries: records from the newest 90 days. */
export const RECENT_DETAIL_MS = 90 * 86_400_000;
/** Free storage a download never uses, so saving play, sync and the database's own growth keep room. */
export const STORAGE_RESERVE_BYTES = 64 * 1024 * 1024;
/** Detail pages one run fetches before it hands over to another run, so uploads and the feed never wait long behind a download. */
export const DETAIL_PAGES_PER_RUN = 8;

/** A conflict's resolution: the generation and every proposal reviewed, and the value it resolves to (null: deleted). */
export interface Resolution {
  readonly generation: number;
  readonly reviewed: readonly string[];
  readonly value: unknown;
}

/**
 * resolved: one new revision was accepted.
 * conflict-changed: a proposal arrived (or the conflict otherwise changed) since the review; the item now shows it.
 * no-conflict: no conflict is open on the item.
 * offline: the backend couldn't be reached, or no answer arrived. The account may have accepted it: resolving
 *   again with the same review in this account session repeats the identical request, so it is never applied twice.
 * incompatible: the server no longer speaks this protocol (an update is required).
 * invalid: the resolution isn't one of the type's.
 */
export type ResolutionOutcome = 'resolved' | 'conflict-changed' | 'no-conflict' | 'offline' | 'incompatible' | 'invalid';

export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerun: ReconcileTrigger | null = null;
  private stopped = false;
  private lastError: SyncErrorCode | null = null;
  private lastSyncedAt: number | null = null;
  private update: UpdateNotice | null = null;
  private uploads: readonly UploadStatus[] = [];
  private history: HistoryStatus = { state: 'complete' };
  private download: HistoryDownload = { state: 'not-requested' };
  /** Downloads stopped because the device is short of storage, until a deliberate trigger. */
  private storageStopped = false;
  /** No bulk download before this: a budget alert throttles it. */
  private throttledUntil: number | null = null;
  /** When this account session first tried to bootstrap: its duration's start. */
  private bootstrapStartedAt: number | null = null;
  /** Consecutive runs that got no usable answer. */
  private failures = 0;
  /** No automatic run before this: the backoff. */
  private backoffUntil: number | null = null;
  /** No run at all before this: the server's retry-after. */
  private retryAfterUntil: number | null = null;
  /** When each record failing by itself may be tried again. */
  private readonly recordRetries = new Map<string, number>();
  private refreshing: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  /** Resolutions sent with no answer yet, by what they resolve: a retry repeats the same operation. */
  private readonly unansweredResolutions = new Map<string, PreparedOperation>();
  /** When this account session first saw each pending entry: the queue's age. */
  private readonly firstSeen = new Map<string, number>();

  constructor(private readonly options: SyncEngineOptions) {
    this.unsubscribe = options.store.onUploadQueued(() => void this.refresh());
    void this.refresh();
  }

  get status(): EngineStatus {
    return {
      error: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
      uploads: this.uploads,
      update: this.update,
      history: this.history,
      download: this.download,
    };
  }

  /**
   * When an automatic run is next due (the backoff ending, or a failing
   * record's turn), or null. Never before the backoff or retry-after ends, so
   * an automatic run at this time always runs.
   */
  get retryAt(): number | null {
    const floors = [this.backoffUntil, this.retryAfterUntil].filter((time): time is number => time !== null);
    const times = [...this.recordRetries.values(), ...floors];
    return times.length > 0 ? Math.max(Math.min(...times), ...floors) : null;
  }

  /** Called whenever the status or the retry time changes. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Uploads, then applies the feed. Coalesced: resolves when a run that began
   * after this call has finished. An automatic trigger during a backoff runs nothing.
   */
  reconcile(trigger: ReconcileTrigger = 'deliberate'): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      if (this.rerun !== 'deliberate') this.rerun = trigger;
      return this.running;
    }
    if (!this.admits(trigger)) return Promise.resolve();
    this.running = (async () => {
      try {
        await this.runOnce();
        while (this.rerun && !this.stopped) {
          const next = this.rerun;
          this.rerun = null;
          if (this.admits(next)) await this.runOnce();
        }
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** The player retries one failing or flagged record: it is tried now, and so is everything waiting for it. */
  async retryRecord(id: string): Promise<void> {
    if (this.stopped) return;
    await this.options.store.clearUploadFailures(id);
    this.recordRetries.delete(id);
    await this.refresh();
    await this.reconcile('deliberate');
  }

  /** Resolves once no run or status refresh is going. */
  async idle(): Promise<void> {
    while (this.running) await this.running;
    await this.refreshing;
  }

  /**
   * Resolves an open conflict on a revisioned item. Online only: it is sent at
   * once under a new operation, then the feed brings the item's state (resolved,
   * or changed by a proposal that arrived meanwhile).
   */
  async resolve(recordType: string, item: string, resolution: Resolution): Promise<ResolutionOutcome> {
    const type = this.options.registry.get(recordType);
    const payload: RevisionedUpload<unknown> = {
      item,
      action: 'resolve',
      generation: resolution.generation,
      reviewed: [...resolution.reviewed].sort(),
      value: resolution.value,
    };
    if (this.stopped || type?.kind !== 'revisioned-item' || !type.isPayload(payload)) return 'invalid';
    const key = canonicalJson({ recordType, payload });
    const operation = this.unansweredResolutions.get(key) ?? this.envelope(type, payload);
    this.unansweredResolutions.set(key, operation);
    let answer: UploadAnswer;
    try {
      answer = await this.options.backend.upload(operation.request);
    } catch (caught) {
      return caught instanceof SyncCallError && caught.kind === 'incompatible' ? 'incompatible' : 'offline';
    }
    this.unansweredResolutions.delete(key);
    if (answer.status !== 'accepted' && answer.status !== 'rejected') return answer.status === 'incompatible' ? 'incompatible' : 'invalid';
    if (answer.operation !== operation.operationId || answer.requestHash !== operation.requestHash) return 'offline';
    await this.reconcile();
    if (answer.status === 'accepted') return 'resolved';
    return answer.code === 'conflict-changed' || answer.code === 'no-conflict' ? answer.code : 'invalid';
  }

  /**
   * Download all history: asked for durably, so it carries on after a restart
   * until every record's detail is here, a few pages per run. Asking again
   * resumes a download stopped for storage. Resolves when this run has finished.
   */
  async downloadAllHistory(): Promise<void> {
    if (this.stopped) return;
    await this.options.store.recordHistoryProgress({ downloadRequested: true });
    await this.refresh();
    await this.reconcile('deliberate');
  }

  /**
   * Opens a record's detail (spec 2, *History*): what this installation holds
   * when it is whole; otherwise it is fetched by the accepted revision held
   * here and kept. When the account holds another revision (or none), the
   * feed is applied first and the revision it brings is asked for.
   */
  async detail(recordType: string, item: string): Promise<DetailResult> {
    const { store, backend, registry } = this.options;
    if (this.stopped || !registry.get(recordType)?.detail) return { status: 'unavailable' };
    try {
      let gone: number | null = null;
      for (let attempt = 1; ; attempt++) {
        const held = await store.readAcceptedRecord(recordType, item);
        if (!held) return { status: 'gone' };
        if (held.summaryAt === undefined) return { status: 'detail', record: held };
        // The account has no detail for the revision still held here, even after its feed.
        if (gone === held.sequence) return { status: 'unavailable' };
        // Its revision changed under it again and again: try again later.
        if (attempt > 3) return { status: 'offline' };
        if (!this.hasRoom(PAGE_BYTES)) return { status: 'storage' };
        const page = await this.call(() => backend.details([{ recordType, item, sequence: held.sequence }], false));
        if (this.stopped) return { status: 'offline' };
        const answer = page.status === 'details' ? page.answers.find((one) => one.recordType === recordType && one.item === item) : undefined;
        if (answer?.status === 'detail' && answer.sequence === held.sequence) {
          const outcome = await this.applyDetails([held], [answer]);
          if (outcome.storage) return { status: 'storage' };
          if (outcome.applied === 0) return { status: 'unavailable' };
          continue;
        }
        if (!answer) return { status: 'offline' };
        // The account holds another revision, or none: its state first.
        if (answer.status === 'gone') gone = held.sequence;
        await this.reconcile('deliberate');
      }
    } catch {
      // No answer, or the account session ended meanwhile.
      return { status: 'offline' };
    }
  }

  /** Ends the account session's sync: later answers are dropped and nothing more runs. */
  stop(): void {
    this.stopped = true;
    this.unsubscribe();
    this.listeners.clear();
  }

  /**
   * Whether a trigger starts a run now. Nothing runs before a server's
   * retry-after. An automatic trigger waits out the backoff; a deliberate one
   * ends it, and the failing records' own backoffs, and runs.
   */
  private admits(trigger: ReconcileTrigger): boolean {
    const now = this.options.clock();
    if (this.retryAfterUntil !== null && now < this.retryAfterUntil) return false;
    if (trigger === 'automatic') return this.backoffUntil === null || now >= this.backoffUntil;
    this.failures = 0;
    this.backoffUntil = null;
    this.recordRetries.clear();
    // A new chance for downloads stopped short of storage: they check the room again.
    this.storageStopped = false;
    return true;
  }

  private async runOnce(): Promise<void> {
    let error: SyncErrorCode | null;
    let retryAfter: number | null = null;
    try {
      // The queue is read first: a store that refuses (the account session ended) stops the run before anything is sent.
      const queue = await this.options.store.readUploadQueue();
      error = (await this.checkProtocol()) ?? (await this.reconcileInOrder(queue));
    } catch (caught) {
      // A local transaction that failed rolled back: the queue and cursor are as
      // they were, so the next run retries. After the session ended (the store
      // refuses a stale session), the dropped work is not an error.
      if (this.stopped) return;
      if (!(caught instanceof SyncCallError)) error = 'storage';
      else if (caught.kind === 'auth') error = 'sign-in-required';
      else if (caught.kind === 'incompatible') error = this.required(null);
      else error = 'offline';
      if (caught instanceof SyncCallError) retryAfter = caught.retryAfter;
    }
    if (this.stopped) return;
    const now = this.options.clock();
    this.lastError = error;
    if (error === null || error === 'unsendable' || error === 'unreadable-change') {
      // Every call was answered.
      this.failures = 0;
      this.backoffUntil = null;
      if (error === null) {
        this.lastSyncedAt = now;
        await this.options.store.recordSynced(now).catch(() => undefined);
      }
    } else {
      this.failures += 1;
      this.backoffUntil = now + backoffDelay(this.failures, this.options.random);
    }
    this.retryAfterUntil = retryAfter !== null ? now + retryAfter : null;
    await this.refresh();
    if (this.stopped) return;
    if (error !== null) this.options.metrics?.record('sync_run_failed', 1, { error });
    if (this.firstSeen.size > 0) this.options.metrics?.record('sync_queue_age', this.options.clock() - Math.min(...this.firstSeen.values()), {});
  }

  /** A backend call: any rejection that isn't a SyncCallError means no answer arrived. */
  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (caught) {
      throw caught instanceof SyncCallError ? caught : new SyncCallError('unreachable');
    }
  }

  private required(reason: string | null): SyncErrorCode {
    this.update = { state: 'required', reason };
    return 'incompatible';
  }

  private async checkProtocol(): Promise<SyncErrorCode | null> {
    const answer = await this.call(() => this.options.backend.protocol(PROTOCOL_VERSION));
    switch (answer.status) {
      case 'supported':
        this.update = null;
        return null;
      case 'retiring':
        this.update = { state: 'retiring', retiresAt: Date.parse(answer.retiresAt), reason: answer.reason };
        return null;
      case 'retired':
        return this.required(answer.reason);
    }
  }

  /**
   * After the protocol check: account state first (every upload but grants
   * and contributions, then the feed through to the head), and only then
   * grants and contributions. A record failing by itself doesn't hold back
   * the later steps; a call with no answer ends the run (it throws).
   */
  private async reconcileInOrder(queue: readonly QueuedUpload[]): Promise<SyncErrorCode | null> {
    const attempted = new Set<string>();
    const accountState = await this.upload(queue, { afterReconciliation: false, attempted });
    if (accountState.error === 'incompatible' || this.stopped) return accountState.error;
    const feedError = await this.pull();
    if (feedError || this.stopped) return accountState.error ?? feedError;
    const grants = await this.upload(await this.options.store.readUploadQueue(), { afterReconciliation: true, attempted });
    if (grants.error === 'incompatible' || this.stopped) return grants.error;
    const lastFeedError = grants.acknowledged > 0 ? await this.pull() : null;
    if (!this.stopped) await this.fetchDetails();
    return accountState.error ?? grants.error ?? lastFeedError;
  }

  /** Whether downloading `bytes` more leaves the storage reserve free. A device that can't tell is taken at its word. */
  private hasRoom(bytes: number): boolean {
    const free = this.options.storage?.() ?? null;
    return free === null || free >= bytes + STORAGE_RESERVE_BYTES;
  }

  /**
   * History detail, after the summaries are installed (spec 2, *History*):
   * first the newest 90 days', which a budget alert never holds back; then,
   * when Download all history was asked for, everything else, newest first
   * (a bulk download, which a budget alert throttles first). A few pages per
   * run: when more remain, another run follows. A detail whose revision
   * changed (or went) has the feed applied first, and is asked for again on
   * a later run by the revision it brings. Short of storage, it stops there,
   * evicting nothing, until a deliberate trigger. A call with no answer ends
   * the run (it throws).
   */
  private async fetchDetails(): Promise<void> {
    const { store, backend, clock, registry } = this.options;
    if (this.storageStopped || ![...registry.values()].some((type) => type.detail)) return;
    if (!(await store.readBootstrap()).installed) return;
    const since = clock() - RECENT_DETAIL_MS;
    const progress = await store.readHistoryProgress();
    if (progress.recent === null) await store.recordHistoryProgress({ recent: await store.countSummaries(since) });
    if (progress.download && progress.download.total === null) await store.recordHistoryProgress({ downloadTotal: await store.countSummaries() });
    // Asked for this run already, and changed or unreadable: not again until a later run.
    const skip = new Set<string>();
    let pages = 0;
    for (const bulk of [false, true]) {
      if (bulk && (!progress.download || (this.throttledUntil !== null && clock() < this.throttledUntil))) break;
      for (;;) {
        const wanted = (await store.readSummaries({ ...(bulk ? {} : { since }), limit: DETAIL_REQUESTS + skip.size }))
          .filter((summary) => !skip.has(refKey(summary)))
          .slice(0, DETAIL_REQUESTS);
        if (wanted.length === 0 || this.stopped) break;
        if (pages === DETAIL_PAGES_PER_RUN) {
          this.rerun ??= 'automatic';
          return;
        }
        if (!this.hasRoom(PAGE_BYTES)) {
          this.storageStopped = true;
          return;
        }
        const requests = wanted.map(({ recordType, item, sequence }) => ({ recordType, item, sequence }));
        const page = await this.call(() => backend.details(requests, bulk));
        pages += 1;
        if (this.stopped) return;
        if (page.status === 'throttled') {
          this.throttledUntil = clock() + page.retryAfter * 1000;
          break;
        }
        if (bulk) this.throttledUntil = null;
        // Nothing answered (never so from this server): nothing asked again this run.
        if (page.answers.length === 0) for (const summary of wanted) skip.add(refKey(summary));
        const outcome = await this.applyDetails(wanted, page.answers);
        if (this.stopped) return;
        if (outcome.storage) {
          this.storageStopped = true;
          return;
        }
        for (const answer of outcome.skipped) skip.add(refKey(answer));
        if (outcome.reconcile) {
          // The account holds another revision of some: its state first.
          const feedError = await this.pull();
          if (feedError || this.stopped) return;
        }
        await this.refresh();
      }
    }
  }

  /**
   * Applies the answers to detail requests for `asked` summaries: each whole
   * record at the sequence asked for replaces its summary, in one transaction.
   * Answers that changed or went need the feed first (`reconcile`); those and
   * unreadable ones are `skipped`. A write that fails, or too little room for
   * the page, applies nothing: `storage`.
   */
  private async applyDetails(
    asked: readonly (SummaryOnly | AcceptedRecord)[],
    answers: readonly DetailAnswer[],
  ): Promise<{ readonly applied: number; readonly skipped: readonly RecordRef[]; readonly reconcile: boolean; readonly storage: boolean }> {
    const records: AcceptedRecord[] = [];
    const skipped: RecordRef[] = [];
    let reconcile = false;
    let bytes = 0;
    for (const answer of answers) {
      const summary = asked.find((one) => one.recordType === answer.recordType && one.item === answer.item);
      if (!summary) continue;
      if (answer.status === 'detail' && answer.sequence === summary.sequence) {
        const read = this.acceptedFrom(answer);
        if (read && read.record.summaryAt === undefined) {
          records.push(read.record);
          bytes += JSON.stringify(answer.change).length;
          continue;
        }
      } else {
        reconcile = true;
      }
      skipped.push(summary);
    }
    if (records.length === 0) return { applied: 0, skipped, reconcile, storage: false };
    if (!this.hasRoom(bytes)) return { applied: 0, skipped, reconcile, storage: true };
    try {
      return { applied: await this.options.store.applyDetails(records), skipped, reconcile, storage: false };
    } catch (failure) {
      // The account session ended: nothing to report. Any other failed write is the device's storage.
      if (this.stopped) throw failure;
      return { applied: 0, skipped, reconcile, storage: true };
    }
  }

  /**
   * One pass over the queue, skipping entries `attempted` already this run.
   * The `afterReconciliation` pass sends grants and contributions, and
   * anything still waiting from the earlier pass; the earlier pass sends
   * everything else.
   */
  private async upload(
    queue: readonly QueuedUpload[],
    { afterReconciliation, attempted }: { readonly afterReconciliation: boolean; readonly attempted: Set<string> },
  ): Promise<{ readonly error: SyncErrorCode | null; readonly acknowledged: number }> {
    const { store, registry } = this.options;
    const pending = new Set(queue.map((entry) => entry.id));
    // A barrier holds while any upload of its type that affects the entry is unacknowledged, wherever it sits in the queue.
    const held = (type: RecordType, entry: QueuedUpload) => queue.some((other) => pending.has(other.id) && isBarrierFor(type, other, entry.payload));
    const now = this.options.clock();
    // Retry times only for entries still pending.
    if (!afterReconciliation) for (const id of this.recordRetries.keys()) if (!pending.has(id)) this.recordRetries.delete(id);
    let error: SyncErrorCode | null = null;
    let unanswered = false;
    let acknowledged = 0;
    for (const entry of queue) {
      if (this.stopped) return { error: null, acknowledged };
      if (attempted.has(entry.id)) continue;
      if (!afterReconciliation && registry.get(entry.recordType)?.afterReconciliation) continue;
      // Flagged, or waiting out its own backoff: it stays pending, and so does everything depending on it.
      if (entry.flagged) continue;
      const retry = this.recordRetries.get(entry.id);
      if (retry !== undefined) {
        if (retry > now) continue;
        // Its turn: whatever happens next, no timer waits for it any more.
        this.recordRetries.delete(entry.id);
      }
      const type = registry.get(entry.recordType);
      // Its prerequisites are still unacknowledged: it waits, and a later pass may send it.
      if (type && (entry.dependencies.some((id) => pending.has(id)) || held(type, entry))) continue;
      attempted.add(entry.id);
      // No client writes server-authored state.
      if (!type || type.kind === 'server-authored-state' || !type.isPayload(entry.payload)) {
        error = await this.recordFailed(entry);
        continue;
      }
      let operation: PreparedOperation;
      let chunks: StagedChunk[] | null;
      try {
        operation = entry.operation ?? (await store.prepareUpload(entry.id, this.envelope(type, entry.payload, entry)));
        chunks = asUnsendable(() => chunksOf(operation, entry.payload));
      } catch (failure) {
        // Too large to name, or no longer matching its manifest: the record fails by itself.
        if (!(failure instanceof UnsendableError)) throw failure;
        error = await this.recordFailed(entry);
        continue;
      }
      let answer: UploadAnswer | 'unanswered' | null;
      try {
        answer = await this.send(operation, chunks);
      } catch (caught) {
        // The server answered this request with an error: the record fails by itself. Anything else ends the run.
        if (!(caught instanceof SyncCallError) || caught.kind !== 'refused') throw caught;
        answer = null;
      }
      if (this.stopped) return { error: null, acknowledged };
      // Its chunks couldn't be staged (staging full, or expired meanwhile): not the record's fault; it waits for the next run.
      if (answer === 'unanswered') {
        unanswered = true;
        continue;
      }
      const outcome = answer ? await this.settleUpload(entry, type, operation, answer) : 'failed';
      if (outcome === 'incompatible') return { error: this.required(null), acknowledged };
      if (outcome === 'failed') {
        error = await this.recordFailed(entry);
        continue;
      }
      // A barrier it names has no receipt on the server yet: sent again on a later run.
      if (outcome === 'waiting') continue;
      pending.delete(entry.id);
      acknowledged += 1;
    }
    // A call left without a usable answer backs the run off, like any other.
    return { error: unanswered ? 'offline' : error, acknowledged };
  }

  /** One record failed by itself: it waits its own backoff, and is flagged on its RECORD_FAILURE_LIMIT-th failure. */
  private async recordFailed(entry: QueuedUpload): Promise<SyncErrorCode> {
    const { failures, flagged } = await this.options.store.recordUploadFailure(entry.id, RECORD_FAILURE_LIMIT);
    this.options.metrics?.record('sync_upload_failed', 1, { outcome: flagged ? 'flagged' : 'failed' });
    if (flagged) this.recordRetries.delete(entry.id);
    else this.recordRetries.set(entry.id, this.options.clock() + backoffDelay(failures, this.options.random));
    return 'unsendable';
  }

  /**
   * Sends an operation. A manifest whose chunks the server lacks gets them
   * staged, then is sent once more. When the staging is full, or the chunks are
   * still lacking (they expired meanwhile), it waits for the next run, as if no
   * usable answer had arrived.
   */
  private async send(operation: PreparedOperation, chunks: readonly StagedChunk[] | null): Promise<UploadAnswer | 'unanswered'> {
    const { backend } = this.options;
    const answer = await this.call(() => backend.upload(operation.request));
    if (answer.status !== 'chunks-missing') return answer;
    const missing = answer.missing.map((index) => chunks?.[index]);
    if (missing.some((chunk) => chunk === undefined)) return { status: 'malformed' };
    for (const chunk of missing as StagedChunk[]) {
      if (this.stopped) return 'unanswered';
      const staged = await this.call(() => backend.stageChunk(chunk));
      if (staged.status === 'staging-full') return 'unanswered';
      if (staged.status !== 'staged') return { status: staged.status };
    }
    const resent = await this.call(() => backend.upload(operation.request));
    return resent.status === 'chunks-missing' ? 'unanswered' : resent;
  }

  /** The operation a payload is sent as; a queue entry's barriers and position go with it. */
  private envelope(type: RecordType, payload: unknown, entry?: QueuedUpload): PreparedOperation {
    return asUnsendable(() => prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: this.options.newOperationId(),
      installation: this.options.installationId,
      recordType: type.name,
      payloadVersion: type.payloadVersion,
      item: type.identity.of(payload),
      payload,
      ...(entry?.after ? { after: entry.after } : {}),
      ...(entry?.position !== undefined ? { position: entry.position } : {}),
    }));
  }

  /** Applies the server's answer to an upload: a receipt is acknowledged; anything else leaves it pending. */
  private async settleUpload(
    entry: QueuedUpload,
    type: RecordType,
    operation: PreparedOperation,
    answer: UploadAnswer,
  ): Promise<'acknowledged' | 'waiting' | 'incompatible' | 'failed'> {
    switch (answer.status) {
      case 'accepted':
      case 'rejected': {
        // A receipt for another request.
        if (answer.operation !== operation.operationId || answer.requestHash !== operation.requestHash) return 'failed';
        const origin: Origin | null = entry.position !== undefined ? { installation: this.options.installationId, position: entry.position } : null;
        const accepted: AcceptedRecord | null =
          answer.status === 'accepted' && type.kind !== 'revisioned-item'
            ? {
                recordType: type.name,
                item: type.identity.of(entry.payload),
                sequence: answer.sequence,
                payload: entry.payload,
                ...(origin ? { origin } : {}),
              }
            : null;
        await this.options.store.acknowledgeUpload(entry.id, answer, accepted);
        if (answer.status === 'rejected') this.options.metrics?.record('sync_upload_failed', 1, { outcome: 'refused' });
        return 'acknowledged';
      }
      case 'waiting':
        return 'waiting';
      case 'incompatible':
        return 'incompatible';
      case 'operation-reused':
      case 'malformed':
      case 'chunks-missing':
        return 'failed';
    }
  }

  private async pull(): Promise<SyncErrorCode | null> {
    const bootstrapError = await this.bootstrap();
    if (bootstrapError || this.stopped) return bootstrapError;
    const { store, backend } = this.options;
    let cursor = await store.readFeedCursor();
    for (;;) {
      const page = await this.call(() => backend.feed(cursor, FEED_PAGE_SIZE));
      if (this.stopped) return null;
      const records: AcceptedRecord[] = [];
      const redacted: number[] = [];
      const purged: RecordRef[] = [];
      let unreadable = false;
      for (const [index, entry] of page.entries.entries()) {
        if (entry.sequence !== cursor + index + 1) {
          unreadable = true;
          break;
        }
        // A purged result's entry: nothing to apply.
        if (entry.change === null) {
          redacted.push(entry.sequence);
          continue;
        }
        const read = this.acceptedFrom(entry);
        if (!read) {
          unreadable = true;
          break;
        }
        records.push(read.record);
        if (read.purges) purged.push(read.purges);
      }
      const applied = records.length + redacted.length;
      if (applied > 0) {
        // Another run moved the cursor meanwhile: start again from where it is.
        if (!(await store.applyFeedPage(cursor, records, { redacted, purged }))) {
          cursor = await store.readFeedCursor();
          continue;
        }
        cursor += applied;
      }
      if (unreadable) return 'unreadable-change';
      if (!page.more) return null;
    }
  }

  /** What a feed entry or snapshot row makes accepted, and the result it purges; null when this build can't read it. */
  private acceptedFrom(entry: FeedEntry): { readonly record: AcceptedRecord; readonly purges: RecordRef | null } | null {
    const type = this.options.registry.get(entry.recordType);
    const payload = type?.fromChange(entry.change) ?? null;
    const origin = type?.ordering === 'per-device' ? originOf(entry.change) : null;
    if (!type || payload === null || (type.ordering === 'per-device' && !origin)) return null;
    // A snapshot's summary, whose detail comes later.
    const summaryAt = type.detail && !type.detail.complete(payload) ? type.detail.at(payload) : null;
    if (summaryAt !== null && !Number.isSafeInteger(summaryAt)) return null;
    return {
      record: {
        recordType: entry.recordType,
        item: entry.item,
        sequence: entry.sequence,
        payload,
        ...(origin ? { origin } : {}),
        ...(summaryAt !== null ? { summaryAt } : {}),
      },
      purges: type.purges?.(payload) ?? null,
    };
  }

  /**
   * Installs a baseline when this installation has none: asks for a snapshot
   * (or carries on staging the one it has), stages its pages, then installs
   * it. A row this build can't read stops it there, staged so far, as the feed
   * stops before a change it can't read. A call with no answer ends the run
   * (it throws). Reports its duration, from the account session's first
   * attempt, when it installs, and when a run ends without installing.
   */
  private async bootstrap(): Promise<SyncErrorCode | null> {
    const progress = await this.options.store.readBootstrap();
    if (progress.installed) return null;
    const startedAt = (this.bootstrapStartedAt ??= this.options.clock());
    const report = (outcome: 'complete' | 'failed') => this.options.metrics?.record('bootstrap_duration', this.options.clock() - startedAt, { outcome });
    let outcome: 'installed' | 'unreadable' | 'none';
    try {
      outcome = await this.stageBootstrap(progress.staging);
    } catch (caught) {
      if (!this.stopped) report('failed');
      throw caught;
    }
    if (outcome === 'none') return null;
    report(outcome === 'installed' ? 'complete' : 'failed');
    return outcome === 'installed' ? null : 'unreadable-change';
  }

  /**
   * Stages a snapshot's pages from where `staging` left off (a new snapshot
   * when there is none, or it expired) and installs it: installed; stopped at
   * a row this build can't read; or none, when the session ended or another
   * run installed it.
   */
  private async stageBootstrap(from: BootstrapStaging | null): Promise<'installed' | 'unreadable' | 'none'> {
    const { store, backend, installationId } = this.options;
    let staging = from;
    // A snapshot that expires as soon as it was made backs the run off instead of asking again at once.
    let fresh = false;
    for (;;) {
      if (!staging) {
        const snapshot = await this.call(() => backend.bootstrap(installationId));
        if (this.stopped) return 'none';
        await store.beginBootstrap(snapshot);
        staging = { ...snapshot, staged: 0, after: 0 };
        fresh = true;
        await this.refresh();
      }
      const current = staging;
      const page = await this.call(() => backend.bootstrapPage(current.snapshot, current.after, BOOTSTRAP_PAGE_SIZE));
      if (this.stopped) return 'none';
      if (page.status === 'expired') {
        if (fresh) throw new SyncCallError('busy');
        staging = null;
        continue;
      }
      fresh = false;
      const records: AcceptedRecord[] = [];
      let through = current.after;
      let unreadable = false;
      for (const row of page.rows) {
        const read = this.acceptedFrom(row);
        if (!read) {
          unreadable = true;
          break;
        }
        records.push(read.record);
        through = row.ordinal;
      }
      const last = !unreadable && !page.more;
      const applied =
        (through === current.after || (await store.stageBootstrapPage(current.snapshot, current.after, records, through))) &&
        (!last || (await store.installBootstrap(current.snapshot)));
      if (!applied) {
        // Another run moved the staging meanwhile: carry on from where it is.
        const now = await store.readBootstrap();
        if (now.installed) return 'none';
        staging = now.staging;
        continue;
      }
      staging = { ...current, staged: current.staged + records.length, after: through };
      await this.refresh();
      if (unreadable) return 'unreadable';
      if (last) return 'installed';
    }
  }

  /** Reads the records' states from the store again, then tells listeners. Refreshes run one at a time. */
  private refresh(): Promise<void> {
    this.refreshing = this.refreshing.then(async () => {
      if (this.stopped) return;
      try {
        const { store, clock } = this.options;
        const now = clock();
        const [queue, rejected, lastSynced, bootstrap, progress, recent, all] = await Promise.all([
          store.readUploadQueue(),
          store.readRejectedUploads(),
          store.readLastSynced(),
          store.readBootstrap(),
          store.readHistoryProgress(),
          store.countSummaries(now - RECENT_DETAIL_MS),
          store.countSummaries(),
        ]);
        if (this.stopped) return;
        const stopped = this.storageStopped ? 'storage' : this.throttledUntil !== null && now < this.throttledUntil ? 'throttled' : null;
        this.history = historyOf(bootstrap, progress, recent, stopped === 'storage' ? 'storage' : null);
        this.download = downloadOf(bootstrap.installed, progress, all, stopped);
        if (lastSynced !== null && (this.lastSyncedAt === null || lastSynced > this.lastSyncedAt)) this.lastSyncedAt = lastSynced;
        const pending = new Set(queue.map((entry) => entry.id));
        for (const id of this.firstSeen.keys()) if (!pending.has(id)) this.firstSeen.delete(id);
        for (const id of pending) if (!this.firstSeen.has(id)) this.firstSeen.set(id, now);
        this.uploads = [...uploadStates(queue), ...rejected.map(({ id, recordType, payload }) => ({ id, recordType, payload, state: 'review' as const }))];
      } catch {
        // The store refused (a stale session, a failed read): the last status stands.
      }
      for (const listener of this.listeners) listener();
    });
    return this.refreshing;
  }
}

/** Each pending entry's state: flagged; paused behind a flagged entry it depends on, directly or not; or waiting. */
function uploadStates(queue: readonly QueuedUpload[]): UploadStatus[] {
  const byId = new Map(queue.map((entry) => [entry.id, entry]));
  const paused = new Map<string, boolean>();
  const isPaused = (entry: QueuedUpload, visiting: Set<string>): boolean => {
    const known = paused.get(entry.id);
    if (known !== undefined) return known;
    if (visiting.has(entry.id)) return false;
    visiting.add(entry.id);
    const result = entry.dependencies.some((id) => {
      const dependency = byId.get(id);
      return dependency !== undefined && (dependency.flagged || isPaused(dependency, visiting));
    });
    paused.set(entry.id, result);
    return result;
  };
  return queue.map((entry) => ({
    id: entry.id,
    recordType: entry.recordType,
    payload: entry.payload,
    state: entry.flagged ? 'flagged' : isPaused(entry, new Set()) ? 'paused' : 'waiting',
  }));
}

/** (of − left) / of, from 0 to 1: how far something has come. */
const done = (left: number, of: number): number => (of > 0 ? Math.min(1, Math.max(0, (of - left) / of)) : left > 0 ? 0 : 1);

/**
 * The first download's progress: the bootstrap's summaries, then the newest
 * 90 days' detail (`recent` summaries of them still waiting). Complete once
 * both are here.
 */
function historyOf(bootstrap: BootstrapProgress, progress: HistoryProgress, recent: number, stopped: 'storage' | null): HistoryStatus {
  if (!bootstrap.installed) {
    const { staging } = bootstrap;
    return { state: 'incomplete', summaries: staging && staging.rows > 0 ? Math.min(1, staging.staged / staging.rows) : 0, detail: 0, stopped };
  }
  if (recent === 0) return { state: 'complete' };
  return { state: 'incomplete', summaries: 1, detail: done(recent, Math.max(progress.recent ?? recent, recent)), stopped };
}

/** Download all history's progress: summaries still waiting for detail (`left`), of those waiting when it began. */
function downloadOf(installed: boolean, progress: HistoryProgress, left: number, stopped: 'storage' | 'throttled' | null): HistoryDownload {
  if (!progress.download) return { state: 'not-requested' };
  if (installed && left === 0) return { state: 'complete' };
  const reached = installed ? done(left, Math.max(progress.download.total ?? left, left)) : 0;
  return stopped ? { state: 'stopped', progress: reached, reason: stopped } : { state: 'downloading', progress: reached };
}

const refKey = (ref: RecordRef): string => `${ref.recordType}\n${ref.item}`;

/** An entry that can't be sent as it is: its result is too large to name, or no longer matches its manifest. */
class UnsendableError extends Error {}

/** Runs `prepare`, reporting any failure as an entry that can't be sent. */
function asUnsendable<T>(prepare: () => T): T {
  try {
    return prepare();
  } catch (failure) {
    throw new UnsendableError(failure instanceof Error ? failure.message : String(failure));
  }
}

/** The platform's part of a per-device type's change: its originating installation and position. */
function originOf(change: unknown): Origin | null {
  const origin = typeof change === 'object' && change !== null ? (change as { origin?: unknown }).origin : undefined;
  if (typeof origin !== 'object' || origin === null) return null;
  const { installation, position } = origin as { installation?: unknown; position?: unknown };
  return typeof installation === 'string' && typeof position === 'number' && Number.isSafeInteger(position) && position >= 1
    ? { installation, position }
    : null;
}

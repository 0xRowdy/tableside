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
//   row count (#97 bounds them by bytes).
// - Command scopes and stale devices (#98; spec 2, *Compaction and stale
//   devices*). Every operation is a command in this installation's scope: a
//   generation the server issued it and a position there, fixed when the
//   entry is prepared. After a clean run the engine reports the positions
//   settled here (acknowledged or abandoned, and named by nothing pending),
//   and the server drops their receipts. When the server can no longer
//   interpret a command (its scope retired while the device was away, or its
//   position was settled or taken) it answers stale-scope and records
//   nothing. The engine then refreshes the account (the feed through the head,
//   resetting from a new snapshot when the feed was pruned behind it),
//   reconciles every prepared entry against it, and takes a new generation
//   before uploading anything else: an entry the account shows accepted (a
//   result it purged since; a revisioned edit it holds) is acknowledged; one
//   whose outcome the server decides by its identity (any other immutable
//   result; a purge), or that the account shows was never accepted (a
//   revisioned edit whose base is still current; one first sent and refused
//   as stale in this run) is prepared again as a new
//   operation, which the server still deduplicates by its identity; any other
//   is unconfirmed: it is never sent by itself, keeps every barrier it is,
//   and waits for the player to send it anew or set it aside.
//   Nothing is deleted, and play never waits on any of it.
// - A feed reset (the entries after the cursor were pruned behind the
//   account's reset boundary) takes a new snapshot as bootstrap does, keeping
//   the queue and the local records, except the results it names purged.
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
  type Command,
  type FeedEntry,
  type FeedPage,
  PROTOCOL_VERSION,
  type PreparedOperation,
  type ProtocolStatus,
  type ScopeAnswer,
  type StagedChunk,
  SyncCallError,
  type UploadAnswer,
  chunksOf,
  prepareOperation,
} from './protocol';
import { type RecordType, type RevisionedState, type RevisionedUpload, isBarrierFor } from './registry';
import type { AcceptedRecord, BootstrapProgress, BootstrapStaging, Origin, QueuedUpload, ReconcileOutcome, RecordRef, SyncStore } from './store';

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
  /**
   * The installation's command scope: with no generation, a new one (replacing
   * any earlier); with its generation, the positions settled through.
   */
  scope(installation: string, generation: number | null, settled: number | null): Promise<ScopeAnswer>;
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
 * unconfirmed: its command scope went stale and the account doesn't show what
 *   became of it; never sent by itself, it waits for the player's decision (`decideReview`).
 */
export type UploadState = 'waiting' | 'paused' | 'flagged' | 'review' | 'unconfirmed';

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
 * totals and the last 90 days of detail have come, as fractions from 0 to 1.
 * The detail is #97's; until then a device is complete once its summaries are installed.
 */
export type HistoryStatus =
  | { readonly state: 'complete' }
  | { readonly state: 'incomplete'; readonly summaries: number; readonly detail: number };

export interface EngineStatus {
  readonly error: SyncErrorCode | null;
  /** When a run last finished with every call answered and nothing failing. */
  readonly lastSyncedAt: number | null;
  /** Records not in the account: pending ones in queue order, then refused ones. */
  readonly uploads: readonly UploadStatus[];
  readonly update: UpdateNotice | null;
  readonly history: HistoryStatus;
}

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

/**
 * The player's decision on a record in review whose command scope went stale:
 * send it anew, as a new operation (the server still deduplicates it by its
 * identity), or set it aside, kept with the refused records and never sent.
 */
export type ReviewDecision = 'send-as-new' | 'set-aside';

export class SyncEngine {
  private running: Promise<void> | null = null;
  private rerun: ReconcileTrigger | null = null;
  private stopped = false;
  private lastError: SyncErrorCode | null = null;
  private lastSyncedAt: number | null = null;
  private update: UpdateNotice | null = null;
  private uploads: readonly UploadStatus[] = [];
  private history: HistoryStatus = { state: 'complete' };
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
  /** Resolutions sent with no answer yet, by what they resolve: a retry repeats the same operation, at the same command position. */
  private readonly unansweredResolutions = new Map<string, { readonly operation: PreparedOperation; readonly command: Command }>();
  /** Resolutions being given a command position: until each is in unansweredResolutions, nothing is reported settled. */
  private allocating = 0;
  /** The settled position last reported in this account session's generation. */
  private reportedSettled: { readonly generation: number; readonly settled: number } | null = null;
  /** The server said the scope is stale outside an upload: the next run recovers before it uploads. */
  private scopeStale = false;
  /** One generation request at a time. */
  private scoping: Promise<number> | null = null;
  /** Entries first sent in this run and answered stale-scope: the server recorded nothing for them, ever. */
  private readonly neverRecorded = new Set<string>();
  /** When this account session first saw each pending entry: the queue's age. */
  private readonly firstSeen = new Map<string, number>();

  constructor(private readonly options: SyncEngineOptions) {
    this.unsubscribe = options.store.onUploadQueued(() => void this.refresh());
    void this.refresh();
  }

  get status(): EngineStatus {
    return { error: this.lastError, lastSyncedAt: this.lastSyncedAt, uploads: this.uploads, update: this.update, history: this.history };
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
    let sent = this.unansweredResolutions.get(key);
    if (!sent) {
      this.allocating += 1;
      try {
        const generation = await this.generation();
        const command = await this.options.store.allocateCommand();
        if (command.generation !== generation) return 'offline';
        sent = { operation: this.envelope(type, payload, undefined, command), command };
        this.unansweredResolutions.set(key, sent);
      } catch (caught) {
        return caught instanceof SyncCallError && caught.kind === 'incompatible' ? 'incompatible' : 'offline';
      } finally {
        this.allocating -= 1;
      }
    }
    const { operation } = sent;
    let answer: UploadAnswer;
    try {
      answer = await this.options.backend.upload(operation.request);
    } catch (caught) {
      return caught instanceof SyncCallError && caught.kind === 'incompatible' ? 'incompatible' : 'offline';
    }
    this.unansweredResolutions.delete(key);
    if (answer.status === 'stale-scope') {
      // Nothing was recorded: the next run refreshes and takes a new generation, and resolving again sends it anew.
      this.scopeStale = true;
      void this.reconcile();
      return 'offline';
    }
    if (answer.status !== 'accepted' && answer.status !== 'rejected') return answer.status === 'incompatible' ? 'incompatible' : 'invalid';
    if (answer.operation !== operation.operationId || answer.requestHash !== operation.requestHash) return 'offline';
    await this.reconcile();
    if (answer.status === 'accepted') return 'resolved';
    return answer.code === 'conflict-changed' || answer.code === 'no-conflict' ? answer.code : 'invalid';
  }

  /**
   * The player's decision on a record in review whose command scope went
   * stale. Any other record is left as it is.
   */
  async decideReview(id: string, decision: ReviewDecision): Promise<void> {
    if (this.stopped) return;
    const { store } = this.options;
    const entry = (await store.readUploadQueue()).find((candidate) => candidate.id === id);
    if (!entry?.unconfirmed) return;
    await store.reconcileUpload(id, decision === 'send-as-new' ? { kind: 'unsent' } : { kind: 'set-aside' });
    await this.refresh();
    if (decision === 'send-as-new') await this.reconcile('deliberate');
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
        await this.reportSettled().catch(() => undefined);
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
    if (this.scopeStale || (await this.preparedUnderStaleGeneration(queue))) return this.recoverScope();
    const attempted = new Set<string>();
    const accountState = await this.upload(queue, { afterReconciliation: false, attempted });
    if (accountState.error === 'stale-scope') return this.recoverScope();
    if (accountState.error === 'incompatible' || this.stopped) return accountState.error;
    const feedError = await this.pull();
    if (feedError || this.stopped) return accountState.error ?? feedError;
    const grants = await this.upload(await this.options.store.readUploadQueue(), { afterReconciliation: true, attempted });
    if (grants.error === 'stale-scope') return this.recoverScope();
    if (grants.error === 'incompatible' || this.stopped) return grants.error;
    const lastFeedError = grants.acknowledged > 0 ? await this.pull() : null;
    return accountState.error ?? grants.error ?? lastFeedError;
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
  ): Promise<{ readonly error: SyncErrorCode | 'stale-scope' | null; readonly acknowledged: number }> {
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
      // Flagged, unconfirmed, or waiting out its own backoff: it stays pending, and so does everything depending on it.
      if (entry.flagged || entry.unconfirmed) continue;
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
      const firstSend = !entry.operation;
      if (firstSend) await this.generation();
      try {
        operation = entry.operation ?? (await store.prepareUpload(entry.id, (command) => this.envelope(type, entry.payload, entry, command)));
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
      // The server can no longer interpret this installation's commands: nothing more is sent until it has reconciled.
      if (outcome === 'stale-scope') {
        // Never sent before, and refused unrecorded: it is the same as never sent.
        if (firstSend) this.neverRecorded.add(entry.id);
        return { error: 'stale-scope', acknowledged };
      }
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

  /** The operation a payload is sent as, as `command`; a queue entry's barriers and position go with it. */
  private envelope(type: RecordType, payload: unknown, entry: QueuedUpload | undefined, command: Command): PreparedOperation {
    return asUnsendable(() => prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: this.options.newOperationId(),
      installation: this.options.installationId,
      command,
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
  ): Promise<'acknowledged' | 'waiting' | 'incompatible' | 'stale-scope' | 'failed'> {
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
      case 'stale-scope':
        return 'stale-scope';
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
      if (page.status === 'reset') {
        // The entries after the cursor were pruned: a new snapshot, keeping the queue and the local records.
        const snapshot = await this.call(() => backend.bootstrap(this.options.installationId));
        if (this.stopped) return null;
        await store.beginBootstrap(snapshot);
        await this.refresh();
        const resetError = await this.bootstrap();
        if (resetError || this.stopped) return resetError;
        cursor = await store.readFeedCursor();
        continue;
      }
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
    return {
      record: { recordType: entry.recordType, item: entry.item, sequence: entry.sequence, payload, ...(origin ? { origin } : {}) },
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
      const purged: RecordRef[] = [];
      let through = current.after;
      let unreadable = false;
      for (const row of page.rows) {
        // A result purged from the account: removed here, and never accepted again.
        if (row.change === null) {
          purged.push({ recordType: row.recordType, item: row.item });
          through = row.ordinal;
          continue;
        }
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
        (through === current.after || (await store.stageBootstrapPage(current.snapshot, current.after, records, through, purged))) &&
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

  /** The generation this installation sends commands under: the store's, or a new one from the server when it holds none. */
  private generation(): Promise<number> {
    this.scoping ??= (async () => {
      try {
        const { generation } = await this.options.store.readCommandScope();
        return generation ?? (await this.renewScope());
      } finally {
        this.scoping = null;
      }
    })();
    return this.scoping;
  }

  /** Asks the server for a new generation, replacing any earlier one, and adopts it. */
  private async renewScope(): Promise<number> {
    const answer = await this.call(() => this.options.backend.scope(this.options.installationId, null, null));
    if (answer.status !== 'scope') throw new SyncCallError('refused');
    await this.options.store.adoptCommandScope(answer.generation);
    this.reportedSettled = null;
    return answer.generation;
  }

  /** Whether a pending entry was prepared under a generation the store no longer holds (a recovery cut short). */
  private async preparedUnderStaleGeneration(queue: readonly QueuedUpload[]): Promise<boolean> {
    if (!queue.some((entry) => entry.command && !entry.unconfirmed)) return false;
    const { generation } = await this.options.store.readCommandScope();
    return queue.some((entry) => entry.command && !entry.unconfirmed && entry.command.generation !== generation);
  }

  /**
   * After a clean run: tells the server the positions settled here, when more
   * are than it was last told, so it drops their receipts. A resolution still
   * unanswered, or being given its position, holds the marker below it.
   */
  private async reportSettled(): Promise<void> {
    if (this.allocating > 0) return;
    const scope = await this.options.store.readCommandScope();
    if (scope.generation === null) return;
    const unanswered = [...this.unansweredResolutions.values()].filter((sent) => sent.command.generation === scope.generation);
    const settled = Math.min(scope.settled, ...unanswered.map((sent) => sent.command.position - 1));
    const reported = this.reportedSettled;
    if (reported && reported.generation === scope.generation && settled <= reported.settled) return;
    if (settled <= 0) return;
    const answer = await this.call(() => this.options.backend.scope(this.options.installationId, scope.generation, settled));
    if (answer.status === 'scope') this.reportedSettled = { generation: answer.generation, settled: answer.settled };
    else if (answer.status === 'stale-scope') {
      this.scopeStale = true;
      this.rerun ??= 'automatic';
    }
  }

  /**
   * The server can no longer interpret this installation's commands. Refresh
   * first (the feed through the account's head, resetting when it was
   * pruned), then reconcile every prepared entry against what the account
   * shows, and only then take a new generation. A run that can't refresh
   * leaves everything as it was for the next one.
   */
  private async recoverScope(): Promise<SyncErrorCode | null> {
    const { store, registry } = this.options;
    const refreshError = await this.pull();
    if (refreshError || this.stopped) return refreshError;
    const queue = await store.readUploadQueue();
    const accepted = new Map<string, Promise<ReadonlyMap<string, AcceptedRecord>>>();
    const acceptedOf = (recordType: string) => {
      let read = accepted.get(recordType);
      if (!read) {
        read = store.readAcceptedRecords(recordType).then((records) => new Map(records.map((record) => [record.item, record])));
        accepted.set(recordType, read);
      }
      return read;
    };
    for (const entry of queue) {
      if (this.stopped) return null;
      if (!entry.operation || entry.unconfirmed) continue;
      const type = registry.get(entry.recordType);
      const outcome: ReconcileOutcome = this.neverRecorded.has(entry.id)
        ? { kind: 'unsent' }
        : type
          ? await this.outcomeOf(type, entry, entry.operation, acceptedOf)
          : { kind: 'unconfirmed' };
      await store.reconcileUpload(entry.id, outcome);
      if (outcome.kind === 'unconfirmed') this.options.metrics?.record('sync_upload_failed', 1, { outcome: 'unconfirmed' });
    }
    if (this.stopped) return null;
    this.neverRecorded.clear();
    await this.renewScope();
    this.scopeStale = false;
    // Upload what is now sendable under the new generation.
    this.rerun = 'deliberate';
    return null;
  }

  /** What the refreshed account shows became of a prepared entry. */
  private async outcomeOf(
    type: RecordType,
    entry: QueuedUpload,
    operation: PreparedOperation,
    acceptedOf: (recordType: string) => Promise<ReadonlyMap<string, AcceptedRecord>>,
  ): Promise<ReconcileOutcome> {
    const { store, registry } = this.options;
    if (!type.isPayload(entry.payload)) return { kind: 'unconfirmed' };
    switch (type.kind) {
      case 'immutable-result': {
        // The server accepts a result once by its identity, refusing other content under it, and only a purge
        // removes one, leaving its identity behind. So one the account purged was accepted; any other is sent
        // anew, and the server answers with that one acceptance, a refusal, or a first acceptance.
        const item = type.identity.of(entry.payload);
        return (await store.readPurgedItems(type.name)).includes(item) ? { kind: 'accepted', sequence: null } : { kind: 'unsent' };
      }
      case 'revisioned-item': {
        const upload = entry.payload as RevisionedUpload<unknown>;
        const held = (await acceptedOf(type.name)).get(upload.item);
        const state = (held?.payload ?? null) as RevisionedState<unknown> | null;
        if (upload.action === 'resolve') return { kind: 'unconfirmed' };
        if (state && held) {
          if (state.conflict?.proposals.some((proposal) => proposal.id === operation.operationId)) return { kind: 'accepted', sequence: held.sequence };
          if (upload.action === 'delete' ? state.deleted : !state.deleted && canonicalJson(state.value) === canonicalJson(upload.value)) {
            return { kind: 'accepted', sequence: held.sequence };
          }
        }
        // Its base is still the accepted revision (or a new item still unknown): it was never accepted.
        if (typeof upload.base === 'number' && (state ? state.revision === upload.base : upload.base === 0)) return { kind: 'unsent' };
        return { kind: 'unconfirmed' };
      }
      case 'account-state-operation': {
        // A purge is accepted once by its target, whatever the operation.
        const target = type.purges?.(entry.payload) ?? null;
        if (target && registry.has(target.recordType)) {
          return (await store.readPurgedItems(target.recordType)).includes(target.item) ? { kind: 'accepted', sequence: null } : { kind: 'unsent' };
        }
        return { kind: 'unconfirmed' };
      }
      case 'server-authored-state':
        return { kind: 'unconfirmed' };
    }
  }

  /** Reads the records' states from the store again, then tells listeners. Refreshes run one at a time. */
  private refresh(): Promise<void> {
    this.refreshing = this.refreshing.then(async () => {
      if (this.stopped) return;
      try {
        const { store } = this.options;
        const [queue, rejected, lastSynced, bootstrap] = await Promise.all([
          store.readUploadQueue(),
          store.readRejectedUploads(),
          store.readLastSynced(),
          store.readBootstrap(),
        ]);
        if (this.stopped) return;
        this.history = historyOf(bootstrap);
        if (lastSynced !== null && (this.lastSyncedAt === null || lastSynced > this.lastSyncedAt)) this.lastSyncedAt = lastSynced;
        const now = this.options.clock();
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
    state: entry.unconfirmed ? 'unconfirmed' : entry.flagged ? 'flagged' : isPaused(entry, new Set()) ? 'paused' : 'waiting',
  }));
}

/** The first download's progress, from the bootstrap's. */
function historyOf(progress: BootstrapProgress): HistoryStatus {
  if (progress.installed) return { state: 'complete' };
  const { staging } = progress;
  return { state: 'incomplete', summaries: staging && staging.rows > 0 ? Math.min(1, staging.staged / staging.rows) : 0, detail: 0 };
}

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

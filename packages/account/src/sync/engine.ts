// Spec 2 Retries, Bootstrap, History, Compaction and stale devices
// Spec 2 Amendment 1 C5; #98; #108

import { canonicalJson } from '@tableside/engine';

import type { MetricsSender } from '../metrics';

import { backoffDelay } from './backoff';
import {
  type BootstrapPage,
  type BootstrapSnapshot,
  type ChunkAnswer,
  type Command,
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
  type ScopeAnswer,
  type StagedChunk,
  SyncCallError,
  type UploadAnswer,
  chunksOf,
  prepareOperation,
  utf8Length,
} from './protocol';
import { type RecordType, type RevisionedUpload, isBarrierFor } from './registry';
import type {
  AcceptedRecord,
  BootstrapProgress,
  BootstrapStaging,
  HistoryProgress,
  Origin,
  QueuedUpload,
  ReconcileOutcome,
  RecordRef,
  SummaryOnly,
  SyncStore,
} from './store';

export interface SyncBackend {
  protocol(version: number): Promise<ProtocolStatus>;
  upload(request: string): Promise<UploadAnswer>;
  stageChunk(chunk: StagedChunk): Promise<ChunkAnswer>;
  feed(after: number, pageSize: number): Promise<FeedPage>;
  bootstrap(installation: string): Promise<BootstrapSnapshot>;
  bootstrapPage(snapshot: string, after: number, pageSize: number): Promise<BootstrapPage>;
  details(requests: readonly DetailRequest[], bulk: boolean): Promise<DetailPage>;
  scope(installation: string, generation: number | null, settled: number | null): Promise<ScopeAnswer>;
}

export type SyncErrorCode = 'offline' | 'sign-in-required' | 'incompatible' | 'unsendable' | 'unreadable-change' | 'storage';

export type UploadState = 'waiting' | 'paused' | 'flagged' | 'review' | 'unconfirmed';

export interface UploadStatus {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  readonly state: UploadState;
}

export type UpdateNotice =
  | { readonly state: 'retiring'; readonly retiresAt: number; readonly reason: string | null }
  | { readonly state: 'required'; readonly reason: string | null };

export type HistoryStatus =
  | { readonly state: 'complete' }
  | { readonly state: 'incomplete'; readonly summaries: number; readonly detail: number; readonly stopped: 'storage' | null };

// Spec 2 History
export type HistoryDownload =
  | { readonly state: 'not-requested' }
  | { readonly state: 'downloading'; readonly progress: number }
  | { readonly state: 'stopped'; readonly progress: number; readonly reason: 'storage' | 'throttled' }
  | { readonly state: 'complete' };

export interface EngineStatus {
  readonly error: SyncErrorCode | null;
  readonly lastSyncedAt: number | null;
  readonly uploads: readonly UploadStatus[];
  readonly update: UpdateNotice | null;
  readonly history: HistoryStatus;
  readonly download: HistoryDownload;
}

export type DetailResult =
  | { readonly status: 'detail'; readonly record: AcceptedRecord }
  | { readonly status: 'gone' | 'offline' | 'storage' | 'unavailable' };

export interface SyncEngineOptions {
  readonly store: SyncStore;
  readonly backend: SyncBackend;
  readonly registry: ReadonlyMap<string, RecordType>;
  readonly installationId: string;
  newOperationId(): string;
  readonly clock: () => number;
  readonly random: () => number;
  readonly metrics?: MetricsSender;
  readonly storage?: () => number | null;
}

export type ReconcileTrigger = 'automatic' | 'deliberate';

export const FEED_PAGE_SIZE = 50;
export const BOOTSTRAP_PAGE_SIZE = 100;
export const RECORD_FAILURE_LIMIT = 5;
export const RECENT_DETAIL_MS = 90 * 86_400_000;
export const STORAGE_RESERVE_BYTES = 64 * 1024 * 1024;
export const DETAIL_PAGES_PER_RUN = 8;

export interface Resolution {
  readonly generation: number;
  readonly reviewed: readonly string[];
  readonly value: unknown;
}

export type ResolutionOutcome = 'resolved' | 'conflict-changed' | 'no-conflict' | 'offline' | 'incompatible' | 'invalid';

export type UnconfirmedDecision = 'send-again' | 'set-aside';

export type SubmitOutcome =
  | { readonly status: 'accepted' }
  | { readonly status: 'rejected'; readonly code: string }
  | { readonly status: 'waiting' | 'offline' | 'incompatible' | 'invalid' };

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
  private storageStopped = false;
  private throttledUntil: number | null = null;
  private bootstrapStartedAt: number | null = null;
  private runs = 0;
  private readonly runWaiters: { readonly run: number; readonly resolve: () => void }[] = [];
  private failures = 0;
  private backoffUntil: number | null = null;
  private retryAfterUntil: number | null = null;
  private readonly recordRetries = new Map<string, number>();
  private refreshing: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  private readonly unanswered = new Map<string, { readonly operation: PreparedOperation; readonly command: Command }>();
  private allocating = 0;
  private reportedSettled: { readonly generation: number; readonly settled: number } | null = null;
  private scopeStale = false;
  private scoping: Promise<number> | null = null;
  private readonly neverRecorded = new Set<string>();
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

  get retryAt(): number | null {
    const floors = [this.backoffUntil, this.retryAfterUntil].filter((time): time is number => time !== null);
    const times = [...this.recordRetries.values(), ...floors];
    return times.length > 0 ? Math.max(Math.min(...times), ...floors) : null;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reconcile(trigger: ReconcileTrigger = 'deliberate'): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      if (this.rerun !== 'deliberate') this.rerun = trigger;
      return this.afterRun(this.runs + 1);
    }
    if (!this.admits(trigger)) return Promise.resolve();
    const finished = this.afterRun(this.runs + 1);
    this.running = (async () => {
      try {
        await this.countedRun();
        while (this.rerun && !this.stopped) {
          const next = this.rerun;
          this.rerun = null;
          if (this.admits(next)) await this.countedRun();
        }
      } finally {
        this.running = null;
        this.settleRuns(Number.POSITIVE_INFINITY);
      }
    })();
    return finished;
  }

  private afterRun(run: number): Promise<void> {
    return new Promise((resolve) => this.runWaiters.push({ run, resolve }));
  }

  private settleRuns(through: number): void {
    for (const waiter of this.runWaiters.splice(0)) {
      if (waiter.run <= through) waiter.resolve();
      else this.runWaiters.push(waiter);
    }
  }

  private async countedRun(): Promise<void> {
    const run = ++this.runs;
    try {
      await this.runOnce();
    } finally {
      this.settleRuns(run);
    }
  }

  async retryRecord(id: string): Promise<void> {
    if (this.stopped) return;
    await this.options.store.clearUploadFailures(id);
    this.recordRetries.delete(id);
    await this.refresh();
    await this.reconcile('deliberate');
  }

  async idle(): Promise<void> {
    while (this.running) await this.running;
    await this.refreshing;
  }

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
    const outcome = await this.sendAtOnce(type, payload);
    if (outcome.status === 'accepted') return 'resolved';
    if (outcome.status === 'rejected') return outcome.code === 'conflict-changed' || outcome.code === 'no-conflict' ? outcome.code : 'invalid';
    return outcome.status === 'waiting' ? 'invalid' : outcome.status;
  }

  async submit(recordType: string, payload: unknown): Promise<SubmitOutcome> {
    const type = this.options.registry.get(recordType);
    if (this.stopped || !type || type.kind === 'server-authored-state' || !type.isPayload(payload) || !type.onlineOnly?.(payload)) {
      return { status: 'invalid' };
    }
    const queue = await this.options.store.readUploadQueue();
    if (queue.some((entry) => isBarrierFor(type, entry, payload))) return { status: 'waiting' };
    return this.sendAtOnce(type, payload);
  }

  private async sendAtOnce(type: RecordType, payload: unknown): Promise<SubmitOutcome> {
    const key = canonicalJson({ recordType: type.name, payload });
    let sent = this.unanswered.get(key);
    if (!sent) {
      this.allocating += 1;
      try {
        const generation = await this.generation();
        const command = await this.options.store.allocateCommand();
        if (command.generation !== generation) return { status: 'offline' };
        sent = { operation: this.envelope(type, payload, undefined, command), command };
        this.unanswered.set(key, sent);
      } catch (caught) {
        return { status: caught instanceof SyncCallError && caught.kind === 'incompatible' ? 'incompatible' : 'offline' };
      } finally {
        this.allocating -= 1;
      }
    }
    const { operation } = sent;
    let answer: UploadAnswer | 'unanswered';
    try {
      // #93
      answer = await this.send(operation, asUnsendable(() => chunksOf(operation, payload)));
    } catch (caught) {
      if (caught instanceof UnsendableError) {
        this.unanswered.delete(key);
        return { status: 'invalid' };
      }
      return { status: caught instanceof SyncCallError && caught.kind === 'incompatible' ? 'incompatible' : 'offline' };
    }
    if (answer === 'unanswered') return { status: 'offline' };
    this.unanswered.delete(key);
    if (answer.status === 'stale-scope') {
      this.scopeStale = true;
      void this.reconcile();
      return { status: 'offline' };
    }
    if (answer.status !== 'accepted' && answer.status !== 'rejected') return { status: answer.status === 'incompatible' ? 'incompatible' : 'invalid' };
    if (answer.operation !== operation.operationId || answer.requestHash !== operation.requestHash) return { status: 'offline' };
    await this.reconcile();
    return answer.status === 'accepted' ? { status: 'accepted' } : { status: 'rejected', code: answer.code };
  }

  async downloadAllHistory(): Promise<void> {
    if (this.stopped) return;
    await this.options.store.recordHistoryProgress({ downloadRequested: true });
    await this.refresh();
    await this.reconcile('deliberate');
  }

  // Spec 2 History
  async detail(recordType: string, item: string): Promise<DetailResult> {
    const { store, backend, registry } = this.options;
    if (this.stopped || !registry.get(recordType)?.detail) return { status: 'unavailable' };
    try {
      let gone: number | null = null;
      for (let attempt = 1; ; attempt++) {
        const held = await store.readAcceptedRecord(recordType, item);
        if (!held) return { status: 'gone' };
        if (held.summaryAt === undefined) return { status: 'detail', record: held };
        if (gone === held.sequence) return { status: 'unavailable' };
        if (attempt > 3) return { status: 'offline' };
        if (!this.hasRoom(PAGE_BYTES)) return { status: 'storage' };
        const page = await this.call(() => backend.details([{ recordType, item, sequence: held.sequence }], false));
        if (this.stopped) return { status: 'offline' };
        const answer = page.status === 'details' ? page.answers.find((one) => one.recordType === recordType && one.item === item) : undefined;
        if (answer?.status === 'detail' && answer.sequence === held.sequence) {
          const outcome = await this.applyDetails([held], [answer]);
          if (outcome.storage) return { status: 'storage' };
          if (outcome.applied === 0 && outcome.skipped.length > 0) return { status: 'unavailable' };
          continue;
        }
        if (!answer) return { status: 'offline' };
        if (answer.status === 'gone') gone = held.sequence;
        await this.reconcile('deliberate');
      }
    } catch {
      return { status: 'offline' };
    }
  }

  async decideUnconfirmed(id: string, decision: UnconfirmedDecision): Promise<void> {
    if (this.stopped) return;
    const { store } = this.options;
    const entry = (await store.readUploadQueue()).find((candidate) => candidate.id === id);
    if (!entry?.unconfirmed) return;
    await store.reconcileUpload(id, decision === 'send-again' ? { kind: 'unsent' } : { kind: 'set-aside' });
    await this.refresh();
    if (decision === 'send-again') await this.reconcile('deliberate');
  }

  stop(): void {
    this.stopped = true;
    this.unsubscribe();
    this.listeners.clear();
  }

  private admits(trigger: ReconcileTrigger): boolean {
    const now = this.options.clock();
    if (this.retryAfterUntil !== null && now < this.retryAfterUntil) return false;
    if (trigger === 'automatic') return this.backoffUntil === null || now >= this.backoffUntil;
    this.failures = 0;
    this.backoffUntil = null;
    this.recordRetries.clear();
    this.storageStopped = false;
    return true;
  }

  private async runOnce(): Promise<void> {
    let error: SyncErrorCode | null;
    let retryAfter: number | null = null;
    try {
      const queue = await this.options.store.readUploadQueue();
      error = (await this.checkProtocol()) ?? (await this.reconcileInOrder(queue));
    } catch (caught) {
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
    if (!this.stopped) {
      try {
        await this.fetchDetails();
      } catch (caught) {
        if (!(caught instanceof SyncCallError)) throw caught;
      }
    }
    return accountState.error ?? grants.error ?? lastFeedError;
  }

  private hasRoom(bytes: number): boolean {
    const free = this.options.storage?.() ?? null;
    return free === null || free >= bytes + STORAGE_RESERVE_BYTES;
  }

  // Spec 2 History
  private async fetchDetails(): Promise<void> {
    const { store, backend, clock, registry } = this.options;
    if (this.storageStopped || ![...registry.values()].some((type) => type.detail)) return;
    if (!(await store.readBootstrap()).installed) return;
    const since = clock() - RECENT_DETAIL_MS;
    const progress = await store.readHistoryProgress();
    if (progress.recent === null) await store.recordHistoryProgress({ recent: await store.countSummaries(since) });
    if (progress.download && progress.download.total === null) await store.recordHistoryProgress({ downloadTotal: await store.countSummaries() });
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
        if (page.answers.length === 0) for (const summary of wanted) skip.add(refKey(summary));
        const outcome = await this.applyDetails(wanted, page.answers);
        if (this.stopped) return;
        if (outcome.storage) {
          this.storageStopped = true;
          return;
        }
        for (const answer of outcome.skipped) skip.add(refKey(answer));
        if (outcome.reconcile) {
          const feedError = await this.pull();
          if (feedError || this.stopped) return;
        }
        await this.refresh();
      }
    }
  }

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
          bytes += utf8Length(JSON.stringify(answer.change));
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
      if (this.stopped || !isAccountStoreDiskFull(failure)) throw failure;
      return { applied: 0, skipped, reconcile, storage: true };
    }
  }

  private async upload(
    queue: readonly QueuedUpload[],
    { afterReconciliation, attempted }: { readonly afterReconciliation: boolean; readonly attempted: Set<string> },
  ): Promise<{ readonly error: SyncErrorCode | 'stale-scope' | null; readonly acknowledged: number }> {
    const { store, registry } = this.options;
    const pending = new Set(queue.map((entry) => entry.id));
    const held = (type: RecordType, entry: QueuedUpload) => queue.some((other) => pending.has(other.id) && isBarrierFor(type, other, entry.payload));
    const now = this.options.clock();
    if (!afterReconciliation) for (const id of this.recordRetries.keys()) if (!pending.has(id)) this.recordRetries.delete(id);
    let error: SyncErrorCode | null = null;
    let unanswered = false;
    let acknowledged = 0;
    for (const entry of queue) {
      if (this.stopped) return { error: null, acknowledged };
      if (attempted.has(entry.id)) continue;
      if (!afterReconciliation && registry.get(entry.recordType)?.afterReconciliation) continue;
      if (entry.flagged || entry.unconfirmed) continue;
      const retry = this.recordRetries.get(entry.id);
      if (retry !== undefined) {
        if (retry > now) continue;
        this.recordRetries.delete(entry.id);
      }
      const type = registry.get(entry.recordType);
      if (type && (entry.dependencies.some((id) => pending.has(id)) || held(type, entry))) continue;
      attempted.add(entry.id);
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
        if (!(failure instanceof UnsendableError)) throw failure;
        error = await this.recordFailed(entry);
        continue;
      }
      let answer: UploadAnswer | 'unanswered' | null;
      try {
        answer = await this.send(operation, chunks);
      } catch (caught) {
        if (!(caught instanceof SyncCallError) || caught.kind !== 'refused') throw caught;
        answer = null;
      }
      if (this.stopped) return { error: null, acknowledged };
      if (answer === 'unanswered') {
        unanswered = true;
        continue;
      }
      const outcome = answer ? await this.settleUpload(entry, type, operation, answer) : 'failed';
      if (outcome === 'incompatible') return { error: this.required(null), acknowledged };
      if (outcome === 'stale-scope') {
        if (firstSend) this.neverRecorded.add(entry.id);
        return { error: 'stale-scope', acknowledged };
      }
      if (outcome === 'failed') {
        error = await this.recordFailed(entry);
        continue;
      }
      if (outcome === 'waiting') continue;
      pending.delete(entry.id);
      acknowledged += 1;
    }
    return { error: unanswered ? 'offline' : error, acknowledged };
  }

  private async recordFailed(entry: QueuedUpload): Promise<SyncErrorCode> {
    const { failures, flagged } = await this.options.store.recordUploadFailure(entry.id, RECORD_FAILURE_LIMIT);
    this.options.metrics?.record('sync_upload_failed', 1, { outcome: flagged ? 'flagged' : 'failed' });
    if (flagged) this.recordRetries.delete(entry.id);
    else this.recordRetries.set(entry.id, this.options.clock() + backoffDelay(failures, this.options.random));
    return 'unsendable';
  }

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

  private async settleUpload(
    entry: QueuedUpload,
    type: RecordType,
    operation: PreparedOperation,
    answer: UploadAnswer,
  ): Promise<'acknowledged' | 'waiting' | 'incompatible' | 'stale-scope' | 'failed'> {
    switch (answer.status) {
      case 'accepted':
      case 'rejected': {
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

  private acceptedFrom(entry: FeedEntry): { readonly record: AcceptedRecord; readonly purges: RecordRef | null } | null {
    const type = this.options.registry.get(entry.recordType);
    const payload = type?.fromChange(entry.change) ?? null;
    const origin = type?.ordering === 'per-device' ? originOf(entry.change) : null;
    if (!type || payload === null || (type.ordering === 'per-device' && !origin)) return null;
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

  private async stageBootstrap(from: BootstrapStaging | null): Promise<'installed' | 'unreadable' | 'none'> {
    const { store, backend, installationId } = this.options;
    let staging = from;
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

  private async renewScope(): Promise<number> {
    const answer = await this.call(() => this.options.backend.scope(this.options.installationId, null, null));
    if (answer.status !== 'scope') throw new SyncCallError('refused');
    await this.options.store.adoptCommandScope(answer.generation);
    this.reportedSettled = null;
    return answer.generation;
  }

  private async preparedUnderStaleGeneration(queue: readonly QueuedUpload[]): Promise<boolean> {
    if (!queue.some((entry) => entry.command && !entry.unconfirmed)) return false;
    const { generation } = await this.options.store.readCommandScope();
    return queue.some((entry) => entry.command && !entry.unconfirmed && entry.command.generation !== generation);
  }

  private async reportSettled(): Promise<void> {
    if (this.allocating > 0) return;
    const scope = await this.options.store.readCommandScope();
    if (scope.generation === null) return;
    const unanswered = [...this.unanswered.values()].filter((sent) => sent.command.generation === scope.generation);
    const settled = Math.min(scope.settled, ...unanswered.map((sent) => sent.command.position - 1));
    const reported = this.reportedSettled;
    if (reported && reported.generation === scope.generation && settled <= reported.settled) return;
    const answer = await this.call(() => this.options.backend.scope(this.options.installationId, scope.generation, settled));
    if (answer.status === 'scope') this.reportedSettled = { generation: answer.generation, settled: answer.settled };
    else if (answer.status === 'stale-scope') {
      this.scopeStale = true;
      this.rerun ??= 'automatic';
    }
  }

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
    this.rerun = 'deliberate';
    return null;
  }

  private async outcomeOf(
    type: RecordType,
    entry: QueuedUpload,
    operation: PreparedOperation,
    acceptedOf: (recordType: string) => Promise<ReadonlyMap<string, AcceptedRecord>>,
  ): Promise<ReconcileOutcome> {
    const { store, registry } = this.options;
    if (!type.isPayload(entry.payload)) return { kind: 'unconfirmed' };
    if (type.reconcile) {
      const held = (await acceptedOf(type.name)).get(type.identity.of(entry.payload));
      return type.reconcile({ payload: entry.payload, operation: operation.operationId, held: held ? { sequence: held.sequence, accepted: held.payload } : null });
    }
    const target = type.kind === 'immutable-result' ? { recordType: type.name, item: type.identity.of(entry.payload) } : (type.purges?.(entry.payload) ?? null);
    if (!target || !registry.has(target.recordType)) return { kind: 'unconfirmed' };
    return (await store.readPurgedItems(target.recordType)).includes(target.item) ? { kind: 'accepted', sequence: null } : { kind: 'unsent' };
  }

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
        const throttled = this.throttledUntil !== null && now < this.throttledUntil;
        this.history = historyOf(bootstrap, progress, recent, this.storageStopped ? 'storage' : null);
        this.download = downloadOf(bootstrap.installed, progress, all, this.storageStopped ? 'storage' : throttled ? 'throttled' : null);
        if (lastSynced !== null && (this.lastSyncedAt === null || lastSynced > this.lastSyncedAt)) this.lastSyncedAt = lastSynced;
        const pending = new Set(queue.map((entry) => entry.id));
        for (const id of this.firstSeen.keys()) if (!pending.has(id)) this.firstSeen.delete(id);
        for (const id of pending) if (!this.firstSeen.has(id)) this.firstSeen.set(id, now);
        this.uploads = [...uploadStates(queue), ...rejected.map(({ id, recordType, payload }) => ({ id, recordType, payload, state: 'review' as const }))];
      } catch {
      }
      for (const listener of this.listeners) listener();
    });
    return this.refreshing;
  }
}

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

const fractionDone = (left: number, of: number): number => (of > 0 ? Math.min(1, Math.max(0, (of - left) / of)) : left > 0 ? 0 : 1);

function historyOf(bootstrap: BootstrapProgress, progress: HistoryProgress, recent: number, stopped: 'storage' | null): HistoryStatus {
  if (!bootstrap.installed) {
    const { staging } = bootstrap;
    return { state: 'incomplete', summaries: staging && staging.rows > 0 ? Math.min(1, staging.staged / staging.rows) : 0, detail: 0, stopped };
  }
  if (recent === 0) return { state: 'complete' };
  return { state: 'incomplete', summaries: 1, detail: fractionDone(recent, Math.max(progress.recent ?? recent, recent)), stopped };
}

function downloadOf(installed: boolean, progress: HistoryProgress, left: number, stopped: 'storage' | 'throttled' | null): HistoryDownload {
  if (!progress.download) return { state: 'not-requested' };
  if (installed && left === 0) return { state: 'complete' };
  const reached = installed ? fractionDone(left, Math.max(progress.download.total ?? left, left)) : 0;
  return stopped ? { state: 'stopped', progress: reached, reason: stopped } : { state: 'downloading', progress: reached };
}

const refKey = (ref: RecordRef): string => `${ref.recordType}\n${ref.item}`;

const isAccountStoreDiskFull = (failure: unknown): boolean => typeof failure === 'object' && failure !== null && (failure as { kind?: unknown }).kind === 'full';

class UnsendableError extends Error {}

function asUnsendable<T>(prepare: () => T): T {
  try {
    return prepare();
  } catch (failure) {
    throw new UnsendableError(failure instanceof Error ? failure.message : String(failure));
  }
}

function originOf(change: unknown): Origin | null {
  const origin = typeof change === 'object' && change !== null ? (change as { origin?: unknown }).origin : undefined;
  if (typeof origin !== 'object' || origin === null) return null;
  const { installation, position } = origin as { installation?: unknown; position?: unknown };
  return typeof installation === 'string' && typeof position === 'number' && Number.isSafeInteger(position) && position >= 1
    ? { installation, position }
    : null;
}

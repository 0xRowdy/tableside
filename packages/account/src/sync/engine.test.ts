// The sync engine's failure rules over a scripted backend and an in-memory
// store (spec 2, *Retries* and *Protocol versions*): backoff, retry-after,
// flagged records and their dependents, review, renewal and required updates.
// Seam 2 covers the same rules against the local stack.

import { describe, expect, it } from 'vitest';

import { type MetricEvent, createMetricsSender } from '../metrics';
import { type SyncBackend, SyncEngine } from './engine';
import {
  type BootstrapPage,
  type BootstrapSnapshot,
  type ChunkAnswer,
  type DetailPage,
  type DetailRequest,
  type FeedEntry,
  type FeedPage,
  type ProtocolStatus,
  SyncCallError,
  type UploadAnswer,
} from './protocol';
import type { RecordType } from './registry';
import type { AcceptedRecord, BootstrapProgress, HistoryProgress, LocalRevisionedItem, NewUpload, QueuedUpload, RejectedUpload, SummaryOnly, SyncStore } from './store';
import type { Disposition, PreparedOperation } from './protocol';

interface Entry {
  id: string;
  recordType: string;
  payload: unknown;
  dependencies: string[];
  operation: PreparedOperation | null;
  status: 'pending' | 'accepted' | 'rejected';
  disposition: Disposition | null;
  failures: number;
  flagged: boolean;
}

/** The sync store port in memory: what the SQLite store does, without durability. */
class MemoryStore implements SyncStore {
  readonly entries: Entry[] = [];
  readonly accepted: AcceptedRecord[] = [];
  cursor = 0;
  syncedAt: number | null = null;
  /** Established by default: these tests are about an installation that has its baseline. */
  bootstrap: BootstrapProgress = { installed: true };
  private readonly listeners = new Set<() => void>();

  queue(id: string, payload: unknown, dependencies: string[] = []): void {
    this.entries.push({ id, recordType: 'note', payload, dependencies, operation: null, status: 'pending', disposition: null, failures: 0, flagged: false });
    for (const listener of this.listeners) listener();
  }
  async readUploadQueue(): Promise<readonly QueuedUpload[]> {
    return this.entries
      .filter((entry) => entry.status === 'pending')
      .map(({ id, recordType, payload, dependencies, operation, failures, flagged }) => ({ id, recordType, payload, dependencies, operation, failures, flagged }));
  }
  async queueUpload({ id, recordType, payload, dependencies }: NewUpload): Promise<QueuedUpload> {
    this.entries.push({ id, recordType, payload, dependencies: [...dependencies], operation: null, status: 'pending', disposition: null, failures: 0, flagged: false });
    for (const listener of this.listeners) listener();
    return { id, recordType, payload, dependencies, operation: null, failures: 0, flagged: false };
  }
  async readRejectedUploads(): Promise<readonly RejectedUpload[]> {
    return this.entries
      .filter((entry) => entry.status === 'rejected')
      .map(({ id, recordType, payload, disposition }) => ({ id, recordType, payload, code: disposition!.status === 'rejected' ? disposition!.code : '' }));
  }
  async prepareUpload(id: string, operation: PreparedOperation): Promise<PreparedOperation> {
    const entry = this.find(id);
    return (entry.operation ??= operation);
  }
  async acknowledgeUpload(id: string, disposition: Disposition, accepted: AcceptedRecord | null): Promise<void> {
    const entry = this.find(id);
    entry.status = disposition.status;
    entry.disposition = disposition;
    if (accepted) this.accepted.push(accepted);
  }
  async recordUploadFailure(id: string, flagAt: number): Promise<{ failures: number; flagged: boolean }> {
    const entry = this.find(id);
    entry.failures += 1;
    if (entry.failures >= flagAt) entry.flagged = true;
    return { failures: entry.failures, flagged: entry.flagged };
  }
  async clearUploadFailures(id: string): Promise<void> {
    const entry = this.find(id);
    entry.failures = 0;
    entry.flagged = false;
  }
  async readFeedCursor(): Promise<number> {
    return this.cursor;
  }
  async applyFeedPage(from: number, records: readonly AcceptedRecord[]): Promise<boolean> {
    if (from !== this.cursor) return false;
    this.accepted.push(...records);
    this.cursor = from + records.length;
    return true;
  }
  async readAcceptedRecords(recordType: string): Promise<readonly AcceptedRecord[]> {
    return this.accepted.filter((record) => record.recordType === recordType);
  }
  async readLastSynced(): Promise<number | null> {
    return this.syncedAt;
  }
  async recordSynced(at: number): Promise<void> {
    this.syncedAt = at;
  }
  async readBootstrap(): Promise<BootstrapProgress> {
    return this.bootstrap;
  }
  async beginBootstrap(snapshot: BootstrapSnapshot): Promise<void> {
    this.bootstrap = { installed: false, staging: { ...snapshot, staged: 0, after: 0 } };
  }
  async stageBootstrapPage(snapshot: string, after: number, records: readonly AcceptedRecord[], through: number): Promise<boolean> {
    const { bootstrap } = this;
    if (bootstrap.installed || bootstrap.staging?.snapshot !== snapshot || bootstrap.staging.after !== after) return false;
    this.accepted.push(...records);
    this.bootstrap = { installed: false, staging: { ...bootstrap.staging, staged: bootstrap.staging.staged + records.length, after: through } };
    return true;
  }
  async installBootstrap(snapshot: string): Promise<boolean> {
    const { bootstrap } = this;
    if (bootstrap.installed || bootstrap.staging?.snapshot !== snapshot) return false;
    this.cursor = bootstrap.staging.watermark;
    this.bootstrap = { installed: true };
    return true;
  }
  history: HistoryProgress = { recent: null, download: null };
  /** Fails every detail write, as a full disk does. */
  failWrites = false;
  /** The latest record held for each item. */
  private held(): AcceptedRecord[] {
    const latest = new Map<string, AcceptedRecord>();
    for (const record of this.accepted) latest.set(`${record.recordType}/${record.item}`, record);
    return [...latest.values()];
  }
  async readAcceptedRecord(recordType: string, item: string): Promise<AcceptedRecord | null> {
    return this.held().find((record) => record.recordType === recordType && record.item === item) ?? null;
  }
  async readSummaries({ since, limit }: { since?: number; limit: number }): Promise<readonly SummaryOnly[]> {
    return this.held()
      .filter((record) => record.summaryAt !== undefined && record.summaryAt >= (since ?? -Infinity))
      .sort((a, b) => b.summaryAt! - a.summaryAt! || a.item.localeCompare(b.item))
      .slice(0, limit)
      .map(({ recordType, item, sequence, summaryAt }) => ({ recordType, item, sequence, at: summaryAt! }));
  }
  async countSummaries(since?: number): Promise<number> {
    return (await this.readSummaries({ ...(since !== undefined ? { since } : {}), limit: Infinity })).length;
  }
  async applyDetails(records: readonly AcceptedRecord[]): Promise<number> {
    // The account store's failure for a full disk.
    if (this.failWrites) throw Object.assign(new Error('database or disk is full'), { kind: 'full' });
    let applied = 0;
    for (const record of records) {
      const held = await this.readAcceptedRecord(record.recordType, record.item);
      if (held?.summaryAt === undefined || held.sequence !== record.sequence) continue;
      this.accepted.push(record);
      applied += 1;
    }
    return applied;
  }
  async readHistoryProgress(): Promise<HistoryProgress> {
    return this.history;
  }
  async recordHistoryProgress(progress: { recent?: number; downloadRequested?: true; downloadTotal?: number }): Promise<void> {
    const { recent, download } = this.history;
    this.history = {
      recent: recent ?? progress.recent ?? null,
      download: download ? { total: download.total ?? progress.downloadTotal ?? null } : progress.downloadRequested ? { total: null } : null,
    };
  }
  async writeRevisionedItem(): Promise<void> {
    throw new Error('no revisioned items in these tests');
  }
  async readRevisionedItems(): Promise<readonly LocalRevisionedItem[]> {
    return [];
  }
  onUploadQueued(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private find(id: string): Entry {
    const entry = this.entries.find((candidate) => candidate.id === id);
    if (!entry) throw new Error(`no entry ${id}`);
    return entry;
  }
}

/** A test-only immutable record type: `{ id: string }` notes. */
const note: RecordType<{ id: string }> = {
  name: 'note',
  kind: 'immutable-result',
  payloadVersion: 1,
  identity: { scheme: 'note-id', of: (payload) => payload.id },
  isPayload: (value): value is { id: string } => typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string',
  barriers: [],
  acceptance: 'private.accept_note_v1',
  snapshot: null,
  fromChange: () => null,
  contribution: null,
  export: { csv: null, json: (payload) => payload },
  deletion: { serverTables: [] },
};

type Answer = UploadAnswer | SyncCallError;

/** A backend the test scripts: each upload's answer by the item it names, the protocol's status, and the calls made. */
class ScriptedBackend implements SyncBackend {
  protocolStatus: ProtocolStatus | SyncCallError = { status: 'supported' };
  /** Every call, in order, as "protocol", "upload <item>" or "feed". */
  readonly calls: string[] = [];
  private readonly answers = new Map<string, Answer>();
  everything: SyncCallError | null = null;
  private sequence = 0;

  answer(item: string, answer: Answer): void {
    this.answers.set(item, answer);
  }
  async protocol(): Promise<ProtocolStatus> {
    this.calls.push('protocol');
    if (this.everything) throw this.everything;
    if (this.protocolStatus instanceof SyncCallError) throw this.protocolStatus;
    return this.protocolStatus;
  }
  async upload(request: string): Promise<UploadAnswer> {
    const { item, operation } = JSON.parse(request) as { item: string; operation: string };
    this.calls.push(`upload ${item}`);
    if (this.everything) throw this.everything;
    const scripted = this.answers.get(item);
    if (scripted instanceof SyncCallError) throw scripted;
    if (scripted && scripted.status !== 'accepted' && scripted.status !== 'rejected') return scripted;
    const { sha256Hex } = await import('@tableside/engine');
    const requestHash = sha256Hex(request);
    if (scripted?.status === 'rejected') return { status: 'rejected', operation, requestHash, code: scripted.code };
    return { status: 'accepted', operation, requestHash, sequence: ++this.sequence };
  }
  async stageChunk(): Promise<ChunkAnswer> {
    this.calls.push('stage');
    return { status: 'staged' };
  }
  /** The account's feed entries, which a feed call answers after its cursor. */
  readonly feedEntries: FeedEntry[] = [];
  async feed(after: number): Promise<FeedPage> {
    this.calls.push('feed');
    if (this.everything) throw this.everything;
    return { entries: this.feedEntries.filter((entry) => entry.sequence > after), more: false };
  }
  /** What each snapshot page answers, in turn; an empty, complete page when none is scripted. */
  readonly bootstrapPages: BootstrapPage[] = [];
  private snapshots = 0;
  async bootstrap(): Promise<BootstrapSnapshot> {
    this.calls.push('bootstrap');
    if (this.everything) throw this.everything;
    return { snapshot: `snapshot-${++this.snapshots}`, watermark: 0, rows: 0, totals: [] };
  }
  async bootstrapPage(): Promise<BootstrapPage> {
    this.calls.push('bootstrap page');
    if (this.everything) throw this.everything;
    return this.bootstrapPages.shift() ?? { status: 'page', rows: [], more: false };
  }
  /** The account's records with detail, by item: what a details call answers from. */
  readonly withDetail = new Map<string, { sequence: number; change: unknown }>();
  /** A budget alert holds bulk downloads back for this many seconds; null: none. */
  throttle: number | null = null;
  /** Every request each details call named, with whether it was bulk. */
  readonly detailCalls: { bulk: boolean; items: string[] }[] = [];
  async details(requests: readonly DetailRequest[], bulk: boolean): Promise<DetailPage> {
    this.calls.push(bulk ? 'details bulk' : 'details');
    if (this.everything) throw this.everything;
    if (bulk && this.throttle !== null) return { status: 'throttled', retryAfter: this.throttle };
    this.detailCalls.push({ bulk, items: requests.map((request) => request.item) });
    return {
      status: 'details',
      answers: requests.map(({ recordType, item, sequence }) => {
        const held = this.withDetail.get(item);
        if (!held) return { recordType, item, status: 'gone' };
        if (held.sequence !== sequence) return { recordType, item, status: 'changed', sequence: held.sequence };
        return { recordType, item, status: 'detail', sequence, change: held.change };
      }),
    };
  }
  uploadsOf(item: string): number {
    return this.calls.filter((call) => call === `upload ${item}`).length;
  }
}

/** A test-only result with a detail: `{ id, at, detail }`, held as a summary (no detail) after a snapshot. */
interface Session {
  id: string;
  at: number;
  detail?: string;
}
const session: RecordType<Session> = {
  ...(note as unknown as RecordType<Session>),
  name: 'session',
  isPayload: (value): value is Session => typeof value === 'object' && value !== null && typeof (value as Session).id === 'string',
  fromChange: (change) => (change as { record?: Session } | null)?.record ?? null,
  detail: { server: 'private.detail_sessions', complete: (record) => record.detail !== undefined, at: (record) => record.at },
};

function engine(options: { random?: number; storage?: () => number | null; types?: readonly RecordType[] } = {}) {
  const store = new MemoryStore();
  const backend = new ScriptedBackend();
  const clock = { now: 1_000_000 };
  let next = 0;
  const events: MetricEvent[] = [];
  const metrics = createMetricsSender({ gate: () => ({ state: 'active', accountId: 'account-1', eligibility: '18+' }), sink: { send: (event) => void events.push(event) } });
  const sync = new SyncEngine({
    metrics,
    store,
    backend,
    registry: new Map([note as RecordType, session as RecordType, ...(options.types ?? [])].map((type) => [type.name, type])),
    ...(options.storage ? { storage: options.storage } : {}),
    installationId: 'installation-1',
    newOperationId: () => (next++).toString(16).padStart(32, '0'),
    clock: () => clock.now,
    random: () => options.random ?? 0.5,
  });
  /** Moves the clock to the engine's next automatic retry and runs it, as the session's timer does. */
  const retryWhenDue = async () => {
    const due = sync.retryAt;
    if (due === null) throw new Error('no retry is due');
    const waited = due - clock.now;
    clock.now = due;
    await sync.reconcile('automatic');
    return waited;
  };
  return { store, backend, clock, sync, retryWhenDue, events };
}

describe('when the server can’t be reached', () => {
  it('retries with jittered exponential backoff from about 1 s up to 5 min, keeping the record', async () => {
    const { store, backend, sync, retryWhenDue } = engine({ random: 0.999 });
    backend.everything = new SyncCallError('unreachable');
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(sync.status.error).toBe('offline');

    const waits: number[] = [];
    for (let attempt = 0; attempt < 12; attempt++) waits.push(Math.round((await retryWhenDue()) / 1000));
    expect(waits).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 256, 300, 300, 300]);
    expect(await store.readUploadQueue()).toHaveLength(1);
  });

  it('jitters each wait between half and all of its step', async () => {
    const low = engine({ random: 0 });
    low.backend.everything = new SyncCallError('unreachable');
    low.store.queue('n1', { id: 'n1' });
    await low.sync.reconcile();
    expect([await low.retryWhenDue(), await low.retryWhenDue(), await low.retryWhenDue()]).toEqual([500, 1_000, 2_000]);
  });

  it('sends nothing for automatic triggers while backing off, and a deliberate retry goes at once', async () => {
    const { store, backend, sync, clock } = engine();
    backend.everything = new SyncCallError('unreachable');
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    const calls = backend.calls.length;

    // A save, a live hint and the 60 s cadence all arrive before the retry is due.
    store.queue('n2', { id: 'n2' });
    await sync.reconcile('automatic');
    expect(backend.calls).toHaveLength(calls);

    backend.everything = null;
    clock.now += 10;
    await sync.reconcile();
    expect(await store.readUploadQueue()).toEqual([]);
    expect(sync.status.error).toBeNull();
    expect(sync.retryAt).toBeNull();
  });

  it('honors the server’s retry-after, even for a deliberate retry', async () => {
    const { store, backend, sync, clock } = engine();
    backend.everything = new SyncCallError('busy', 120_000);
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(sync.retryAt).toBe(clock.now + 120_000);

    backend.everything = null;
    const calls = backend.calls.length;
    clock.now += 60_000;
    await sync.reconcile();
    expect(backend.calls).toHaveLength(calls);

    clock.now += 60_000;
    await sync.reconcile('automatic');
    expect(await store.readUploadQueue()).toEqual([]);
  });

  it('records when it last synced completely', async () => {
    const { store, sync, clock } = engine();
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(sync.status.lastSyncedAt).toBe(clock.now);
    expect(await store.readLastSynced()).toBe(clock.now);
  });
});

describe('a record that fails by itself', () => {
  it('is isolated: the records saved with it upload', async () => {
    const { store, backend, sync } = engine();
    backend.answer('bad', new SyncCallError('refused'));
    store.queue('a', { id: 'a' });
    store.queue('bad', { id: 'bad' });
    store.queue('b', { id: 'b' });
    await sync.reconcile();

    expect((await store.readUploadQueue()).map((entry) => entry.id)).toEqual(['bad']);
    expect(store.accepted.map((record) => record.item)).toEqual(['a', 'b']);
    expect(sync.status.error).toBe('unsendable');
    expect(sync.status.uploads).toEqual([expect.objectContaining({ id: 'bad', state: 'waiting' })]);
  });

  it('backs off by itself, is flagged after five failures, and is then left alone while others keep syncing', async () => {
    const { store, backend, sync, retryWhenDue, clock } = engine();
    backend.answer('bad', { status: 'malformed' });
    store.queue('bad', { id: 'bad' });
    await sync.reconcile();
    // Its own backoff: a save meanwhile uploads, and the failing record waits for its turn.
    store.queue('a', { id: 'a' });
    await sync.reconcile('automatic');
    expect(backend.uploadsOf('bad')).toBe(1);
    expect(backend.uploadsOf('a')).toBe(1);

    for (let attempt = 2; attempt <= 5; attempt++) await retryWhenDue();
    expect(backend.uploadsOf('bad')).toBe(5);
    expect(sync.status.uploads).toEqual([expect.objectContaining({ id: 'bad', state: 'flagged' })]);
    expect(sync.retryAt).toBeNull();

    clock.now += 3_600_000;
    store.queue('b', { id: 'b' });
    await sync.reconcile();
    expect(backend.uploadsOf('bad')).toBe(5);
    expect(store.accepted.map((record) => record.item)).toEqual(['a', 'b']);
    // Never deleted.
    expect((await store.readUploadQueue()).map((entry) => entry.id)).toEqual(['bad']);
  });

  it('a record’s turn inside a backoff waits for the backoff, and the retry then runs', async () => {
    const { store, backend, sync, clock, retryWhenDue } = engine();
    backend.answer('bad', new SyncCallError('refused'));
    store.queue('bad', { id: 'bad' });
    await sync.reconcile();
    // The server goes down before the record's turn, so the account backs off past it.
    backend.everything = new SyncCallError('unreachable');
    clock.now += 100;
    store.queue('a', { id: 'a' });
    await sync.reconcile('automatic');
    backend.everything = null;

    const calls = backend.calls.length;
    await retryWhenDue();
    expect(backend.calls.length).toBeGreaterThan(calls);
    expect(store.accepted.map((record) => record.item)).toEqual(['a']);
  });

  it('pauses the records that depend on it while it is flagged, and a deliberate retry of it tries again', async () => {
    const { store, backend, sync, retryWhenDue } = engine();
    backend.answer('bad', new SyncCallError('refused'));
    store.queue('bad', { id: 'bad' });
    store.queue('after-bad', { id: 'after-bad' }, ['bad']);
    store.queue('later', { id: 'later' }, ['after-bad']);
    store.queue('free', { id: 'free' });
    await sync.reconcile();
    for (let attempt = 2; attempt <= 5; attempt++) await retryWhenDue();

    expect(sync.status.uploads.map(({ id, state }) => ({ id, state }))).toEqual([
      { id: 'bad', state: 'flagged' },
      { id: 'after-bad', state: 'paused' },
      { id: 'later', state: 'paused' },
    ]);
    expect(backend.uploadsOf('after-bad')).toBe(0);
    expect(store.accepted.map((record) => record.item)).toEqual(['free']);

    backend.answer('bad', { status: 'accepted', operation: '', requestHash: '', sequence: 0 });
    await sync.retryRecord('bad');
    expect(await store.readUploadQueue()).toEqual([]);
    expect(store.accepted.map((record) => record.item)).toEqual(['free', 'bad', 'after-bad', 'later']);
  });

  it('a payload this build can’t send counts as failing, without being sent', async () => {
    const { store, backend, sync } = engine();
    store.queue('broken', { notAnId: 1 });
    await sync.reconcile();
    expect(backend.calls.filter((call) => call.startsWith('upload'))).toEqual([]);
    expect((await store.readUploadQueue())[0]).toMatchObject({ id: 'broken', failures: 1 });
  });
});

describe('a record the server refuses', () => {
  it('goes to review, keeping it, and is not sent again', async () => {
    const { store, backend, sync } = engine();
    backend.answer('n1', { status: 'rejected', operation: '', requestHash: '', code: 'identity-reused' });
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    await sync.reconcile();

    expect(backend.uploadsOf('n1')).toBe(1);
    expect(sync.status.uploads).toEqual([expect.objectContaining({ id: 'n1', state: 'review' })]);
  });
});

describe('when the session isn’t accepted', () => {
  it('asks to sign in again and keeps every record', async () => {
    const { store, backend, sync } = engine();
    backend.everything = new SyncCallError('auth');
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(sync.status.error).toBe('sign-in-required');
    expect(await store.readUploadQueue()).toHaveLength(1);
    expect(sync.retryAt).not.toBeNull();
  });
});

describe('protocol versions', () => {
  it('shows a retirement’s date while the protocol still syncs', async () => {
    const { store, backend, sync } = engine();
    backend.protocolStatus = { status: 'retiring', retiresAt: '2026-12-18T00:00:00Z', reason: null };
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(sync.status.update).toEqual({ state: 'retiring', retiresAt: Date.parse('2026-12-18T00:00:00Z'), reason: null });
    expect(await store.readUploadQueue()).toEqual([]);
  });

  it('a retired protocol stops sync before anything is sent, keeping every record', async () => {
    const { store, backend, sync } = engine();
    backend.protocolStatus = { status: 'retired', reason: 'A security fix needs this update.' };
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(backend.calls).toEqual(['protocol']);
    expect(sync.status.error).toBe('incompatible');
    expect(sync.status.update).toEqual({ state: 'required', reason: 'A security fix needs this update.' });
    expect(await store.readUploadQueue()).toHaveLength(1);
  });

  it('an operation the server no longer serves stops sync as a required update', async () => {
    const { store, backend, sync } = engine();
    backend.answer('n1', new SyncCallError('incompatible'));
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    expect(sync.status.update).toEqual({ state: 'required', reason: null });
    expect(await store.readUploadQueue()).toHaveLength(1);
  });

  it('syncs again once the protocol is served again (an update installed)', async () => {
    const { store, backend, sync } = engine();
    backend.protocolStatus = { status: 'retired', reason: null };
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    backend.protocolStatus = { status: 'supported' };
    await sync.reconcile();
    expect(sync.status.update).toBeNull();
    expect(await store.readUploadQueue()).toEqual([]);
  });
});

describe('status', () => {
  it('lists waiting records as they are saved, and tells listeners', async () => {
    const { store, backend, sync } = engine();
    backend.everything = new SyncCallError('unreachable');
    let told = 0;
    sync.onChange(() => told++);
    store.queue('n1', { id: 'n1' });
    await sync.idle();
    expect(sync.status.uploads).toEqual([{ id: 'n1', recordType: 'note', payload: { id: 'n1' }, state: 'waiting' }]);
    expect(told).toBeGreaterThan(0);
  });
});

/** A test-only switch: turning it off is queued; turning it on is online only and waits for any pending "off". */
type Switch = { id: string; on: boolean };
const switchType: RecordType<Switch> = {
  ...(note as unknown as RecordType<Switch>),
  name: 'switch',
  kind: 'account-state-operation',
  isPayload: (value): value is Switch => typeof value === 'object' && value !== null && typeof (value as { on?: unknown }).on === 'boolean',
  barriers: ['switch'],
  affectedBy: (_barrier, payload) => payload.on,
  onlineOnly: (payload) => payload.on,
};

describe('a change sent at once', () => {
  it('is sent without being queued, and the feed is read after it', async () => {
    const { store, backend, sync } = engine({ types: [switchType as RecordType] });
    expect(await sync.submit('switch', { id: 'on-1', on: true })).toEqual({ status: 'accepted' });
    expect(store.entries).toEqual([]);
    expect(backend.calls).toEqual(['upload on-1', 'protocol', 'feed']);
  });

  it('reports the server’s refusal with its code', async () => {
    const { backend, sync } = engine({ types: [switchType as RecordType] });
    backend.answer('on-1', { status: 'rejected', operation: '', requestHash: '', code: 'stale' });
    expect(await sync.submit('switch', { id: 'on-1', on: true })).toEqual({ status: 'rejected', code: 'stale' });
  });

  it('waits, unsent, while a barrier it is held by is still pending', async () => {
    const { store, backend, sync } = engine({ types: [switchType as RecordType] });
    await store.queueUpload({ id: 'switch/off', recordType: 'switch', item: 'off-1', payload: { id: 'off-1', on: false }, dependencies: [], positioned: false, purges: null });
    backend.answer('off-1', new SyncCallError('unreachable'));
    await sync.idle();
    expect(await sync.submit('switch', { id: 'on-1', on: true })).toEqual({ status: 'waiting' });
    expect(backend.uploadsOf('on-1')).toBe(0);
  });

  it('is offline when no answer arrives', async () => {
    const { backend, sync } = engine({ types: [switchType as RecordType] });
    backend.answer('on-1', new SyncCallError('unreachable'));
    expect(await sync.submit('switch', { id: 'on-1', on: true })).toEqual({ status: 'offline' });
  });

  it('refuses a payload that isn’t one of its type’s online-only changes', async () => {
    const { backend, sync } = engine({ types: [switchType as RecordType] });
    expect(await sync.submit('switch', { id: 'off-1', on: false })).toEqual({ status: 'invalid' });
    expect(await sync.submit('note', { id: 'n1' })).toEqual({ status: 'invalid' });
    expect(backend.calls).toEqual([]);
  });
});

describe('bootstrap', () => {
  const unbootstrapped = () => {
    const made = engine();
    made.store.bootstrap = { installed: false, staging: null };
    return made;
  };

  it('replaces a staged snapshot that expired with a new one, keeping the queue', async () => {
    const { store, backend, sync } = unbootstrapped();
    store.bootstrap = { installed: false, staging: { snapshot: 'old', watermark: 0, rows: 3, totals: [], staged: 1, after: 1 } };
    backend.bootstrapPages.push({ status: 'expired' });
    backend.everything = new SyncCallError('unreachable');
    store.queue('n1', { id: 'n1' });
    await sync.reconcile();
    backend.everything = null;
    await sync.reconcile();
    expect(backend.calls.filter((call) => call.startsWith('bootstrap'))).toEqual(['bootstrap page', 'bootstrap', 'bootstrap page']);
    expect(store.bootstrap).toEqual({ installed: true });
    expect(sync.status.history).toEqual({ state: 'complete' });
    expect(store.entries.map((entry) => entry.status)).toEqual(['accepted']);
  });

  it('backs off, without asking again at once, when a new snapshot is already gone', async () => {
    const { backend, sync } = unbootstrapped();
    backend.bootstrapPages.push({ status: 'expired' });
    await sync.reconcile();
    expect(backend.calls.filter((call) => call.startsWith('bootstrap'))).toEqual(['bootstrap', 'bootstrap page']);
    expect(sync.status.error).toBe('offline');
    expect(sync.retryAt).not.toBeNull();
    expect(sync.status.history).toEqual({ state: 'incomplete', summaries: 0, detail: 0, stopped: null });
  });

  it('reports its duration from the first attempt: failed for a run that ends without installing, complete once installed', async () => {
    const { backend, sync, clock, events } = unbootstrapped();
    backend.bootstrapPages.push({ status: 'page', rows: [], more: true });
    backend.everything = null;
    // The first page arrives, then the network goes before the next.
    const page = backend.bootstrapPage.bind(backend);
    let pages = 0;
    backend.bootstrapPage = async (...args) => {
      if (++pages === 2) {
        clock.now += 3_000;
        throw new SyncCallError('unreachable');
      }
      return page(...args);
    };
    await sync.reconcile();
    clock.now += 60_000;
    await sync.reconcile();
    expect(events.filter((event) => event.name === 'bootstrap_duration')).toEqual([
      { name: 'bootstrap_duration', value: 3_000, properties: { outcome: 'failed' } },
      { name: 'bootstrap_duration', value: 63_000, properties: { outcome: 'complete' } },
    ]);
    expect(JSON.stringify(events)).not.toContain('snapshot-1');
  });
});

describe('history detail', () => {
  const DAY = 86_400_000;
  /**
   * An installed baseline of session summaries, `ages` days old each (by the
   * engine's clock), whose detail the account holds at the same sequence.
   */
  const withSummaries = (made: ReturnType<typeof engine>, ages: readonly number[]) => {
    ages.forEach((age, index) => {
      const id = `s-${index + 1}`;
      const at = made.clock.now - age * DAY;
      made.store.accepted.push({ recordType: 'session', item: id, sequence: index + 1, payload: { id, at }, summaryAt: at });
      made.backend.withDetail.set(id, { sequence: index + 1, change: { record: { id, at, detail: `detail of ${id}` } } });
    });
    return made;
  };
  const summariesOn = async (store: MemoryStore) => (await store.readSummaries({ limit: Infinity })).map((summary) => summary.item);

  it('fetches the newest 90 days’ detail after the summaries, never in bulk, and leaves older detail for when it is opened', async () => {
    const { store, backend, sync } = withSummaries(engine(), [1, 30, 89, 91, 400]);
    await sync.reconcile();
    expect(backend.detailCalls).toEqual([{ bulk: false, items: ['s-1', 's-2', 's-3'] }]);
    expect(await summariesOn(store)).toEqual(['s-4', 's-5']);
    expect((await store.readAcceptedRecord('session', 's-1'))?.payload).toEqual({ id: 's-1', at: expect.any(Number), detail: 'detail of s-1' });
    expect(sync.status.history).toEqual({ state: 'complete' });
    expect(sync.status.download).toEqual({ state: 'not-requested' });
  });

  it('shows the first download incomplete, with how far the 90 days’ detail came, until it is all here', async () => {
    const { backend, sync } = withSummaries(engine(), [1, 2, 3, 4]);
    let pages = 0;
    const details = backend.details.bind(backend);
    backend.details = async (requests, bulk) => {
      if (++pages === 1) return details(requests.slice(0, 1), bulk);
      throw new SyncCallError('unreachable');
    };
    await sync.reconcile();
    expect(sync.status.history).toEqual({ state: 'incomplete', summaries: 1, detail: 0.25, stopped: null });
    backend.details = details;
    await sync.reconcile();
    expect(sync.status.history).toEqual({ state: 'complete' });
  });

  it('stops short of storage with the reason, removing nothing, and carries on when asked again with room', async () => {
    let free = 10 * 1024 * 1024;
    const { store, backend, sync } = withSummaries(engine({ storage: () => free }), [1, 2]);
    store.queue('n1', { id: 'n1' });
    backend.everything = new SyncCallError('unreachable');
    await sync.reconcile();
    backend.everything = null;
    await sync.reconcile();
    expect(backend.detailCalls).toEqual([]);
    expect(await summariesOn(store)).toEqual(['s-1', 's-2']);
    expect(sync.status.history).toEqual({ state: 'incomplete', summaries: 1, detail: 0, stopped: 'storage' });
    // The upload still went: only downloads stop.
    expect(store.entries.map((entry) => entry.status)).toEqual(['accepted']);
    // Automatic runs leave it stopped; a deliberate one checks the room again.
    await sync.reconcile('automatic');
    expect(backend.detailCalls).toEqual([]);
    free = 1024 * 1024 * 1024;
    await sync.reconcile();
    expect(sync.status.history).toEqual({ state: 'complete' });
  });

  it('stops for storage when writing the detail fails, keeping the summary and the queue', async () => {
    const { store, sync } = withSummaries(engine(), [1]);
    store.failWrites = true;
    await sync.reconcile();
    expect(sync.status.error).toBeNull();
    expect(sync.status.history).toEqual({ state: 'incomplete', summaries: 1, detail: 0, stopped: 'storage' });
    expect(await summariesOn(store)).toEqual(['s-1']);
  });

  it('downloads all history when asked: durably, a few pages per run, newest first, resuming after a lost answer', async () => {
    const ages = Array.from({ length: 1_500 }, (_, index) => 100 + index);
    const { store, backend, sync } = withSummaries(engine(), ages);
    await sync.reconcile();
    expect(await store.countSummaries()).toBe(1_500);

    // The answer to the third page is lost: the run ends there, and backs off.
    let pages = 0;
    const details = backend.details.bind(backend);
    backend.details = async (requests, bulk) => {
      if (++pages === 3) throw new SyncCallError('unreachable');
      return details(requests, bulk);
    };
    await sync.downloadAllHistory();
    expect(store.history.download).toEqual({ total: 1_500 });
    expect(sync.status.download).toEqual({ state: 'downloading', progress: 200 / 1_500 });
    // Optional work: the run itself didn't fail, and nothing backs off.
    expect(sync.status.error).toBeNull();
    expect(sync.retryAt).toBeNull();
    expect(backend.detailCalls[0]?.items.slice(0, 2)).toEqual(['s-1', 's-2']);

    // The next run (the app reopened, say) carries on from where it stopped,
    // eight pages at a time, handing over to another run in between: the
    // caller waits for its own run only.
    await sync.reconcile();
    expect(sync.status.download).toEqual({ state: 'downloading', progress: 1_000 / 1_500 });
    await sync.idle();
    expect(sync.status.download).toEqual({ state: 'complete' });
    expect(await store.countSummaries()).toBe(0);
    const asked = backend.detailCalls.flatMap((call) => call.items);
    expect(new Set(asked).size).toBe(asked.length);
    expect(backend.calls.filter((call) => call === 'protocol').length).toBeGreaterThanOrEqual(4);
    expect(backend.detailCalls.every((call) => call.bulk && call.items.length <= 100)).toBe(true);
  });

  it('a budget alert throttles Download all history only: recent detail still arrives, nothing is removed, and it resumes after the wait', async () => {
    const { store, backend, sync, clock } = withSummaries(engine(), [1, 200, 300]);
    backend.throttle = 600;
    await sync.downloadAllHistory();
    expect(backend.detailCalls).toEqual([{ bulk: false, items: ['s-1'] }]);
    // The recent one counts: its detail is here.
    expect(sync.status.download).toEqual({ state: 'stopped', progress: 1 / 3, reason: 'throttled' });
    expect(await summariesOn(store)).toEqual(['s-2', 's-3']);
    // Not asked again during the wait.
    await sync.reconcile();
    expect(backend.calls.filter((call) => call === 'details bulk')).toHaveLength(1);
    backend.throttle = null;
    clock.now += 600_000;
    await sync.reconcile();
    expect(sync.status.download).toEqual({ state: 'complete' });
  });

  it('opens an older record’s detail by the revision held here, keeping it; offline, the summary stays', async () => {
    const { store, backend, sync } = withSummaries(engine(), [400]);
    await sync.reconcile();
    backend.everything = new SyncCallError('unreachable');
    expect(await sync.detail('session', 's-1')).toEqual({ status: 'offline' });
    expect(await summariesOn(store)).toEqual(['s-1']);
    backend.everything = null;
    const opened = await sync.detail('session', 's-1');
    expect(opened).toMatchObject({ status: 'detail', record: { item: 's-1', sequence: 1, payload: { detail: 'detail of s-1' } } });
    expect(opened.status === 'detail' && opened.record.summaryAt).toBeFalsy();
    // Kept: opening again asks nothing.
    const calls = backend.detailCalls.length;
    expect((await sync.detail('session', 's-1')).status).toBe('detail');
    expect(backend.detailCalls).toHaveLength(calls);
    expect(await sync.detail('note', 'n1')).toEqual({ status: 'unavailable' });
  });

  it('opening a record whose revision changed applies the feed first, then shows the revision it brought', async () => {
    const { store, backend, sync } = withSummaries(engine(), [400]);
    store.cursor = 1;
    const at = (await store.readAcceptedRecord('session', 's-1'))!.summaryAt!;
    const revised = { record: { id: 's-1', at, detail: 'revised' } };
    backend.withDetail.set('s-1', { sequence: 2, change: revised });
    backend.feedEntries.push({ sequence: 2, recordType: 'session', item: 's-1', change: revised });
    const opened = await sync.detail('session', 's-1');
    expect(opened).toMatchObject({ status: 'detail', record: { sequence: 2, payload: { detail: 'revised' } } });
    // Asked by the revision held, told it changed, and the feed brought the new one: not asked again.
    expect(backend.detailCalls).toEqual([{ bulk: false, items: ['s-1'] }]);
    expect(backend.calls.indexOf('feed')).toBeGreaterThan(backend.calls.indexOf('details'));
  });

  it('a record the account no longer holds detail for is left as it is, never deleted by the engine', async () => {
    const { store, backend, sync } = withSummaries(engine(), [400]);
    backend.withDetail.clear();
    expect(await sync.detail('session', 's-1')).toEqual({ status: 'unavailable' });
    expect(await summariesOn(store)).toEqual(['s-1']);
  });
});

describe('operational metrics (#108)', () => {
  const named = (events: readonly MetricEvent[], name: string) => events.filter((event) => event.name === name);

  it('a run that ends without finishing reports its error code, and how long the oldest pending record has waited', async () => {
    const { store, backend, sync, clock, events } = engine();
    backend.everything = new SyncCallError('unreachable');
    store.queue('n1', { id: 'n1' });
    await sync.idle();
    clock.now += 42_000;
    await sync.reconcile();
    expect(named(events, 'sync_run_failed')).toEqual([{ name: 'sync_run_failed', value: 1, properties: { error: 'offline' } }]);
    expect(named(events, 'sync_queue_age')).toEqual([{ name: 'sync_queue_age', value: 42_000, properties: {} }]);

    backend.everything = null;
    clock.now += 1_000;
    await sync.reconcile();
    // Nothing failed and nothing is left waiting.
    expect(named(events, 'sync_run_failed')).toHaveLength(1);
    expect(named(events, 'sync_queue_age')).toHaveLength(1);
  });

  it('a record failing by itself reports each failure, then its flagging; a refused receipt reports that', async () => {
    const { store, backend, sync, retryWhenDue, events } = engine();
    backend.answer('bad', { status: 'malformed' });
    backend.answer('refused', { status: 'rejected', operation: '', requestHash: '', code: 'invalid-payload' });
    store.queue('bad', { id: 'bad' });
    store.queue('refused', { id: 'refused' });
    await sync.reconcile();
    for (let attempt = 2; attempt <= 5; attempt++) await retryWhenDue();
    expect(named(events, 'sync_upload_failed').map((event) => event.properties.outcome)).toEqual(['failed', 'refused', 'failed', 'failed', 'failed', 'flagged']);
    expect(named(events, 'sync_run_failed').map((event) => event.properties.error)).toEqual(Array(5).fill('unsendable'));
  });

  it("carries nothing of a record: no payload, record type, item, refusal code or time", async () => {
    const { store, backend, sync, clock, events } = engine();
    const secret = { id: 'casino-session-at-bellagio', casino: 'Bellagio', net: '-250.00', email: 'player@example.com' };
    backend.answer(secret.id, { status: 'rejected', operation: '', requestHash: '', code: 'over-limit-player@example.com' });
    store.queue(secret.id, secret);
    await sync.reconcile();
    backend.everything = new SyncCallError('unreachable');
    store.queue('other', { id: 'other' });
    await sync.idle();
    clock.now += 5_000;
    await sync.reconcile();
    expect(events.length).toBeGreaterThan(0);
    const sent = JSON.stringify(events);
    for (const text of [secret.id, 'casino', 'Bellagio', '250', 'player@example.com', 'over-limit', 'note', String(clock.now)]) expect(sent).not.toContain(text);
  });
});

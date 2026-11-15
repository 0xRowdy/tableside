// The sync engine's failure rules over a scripted backend and an in-memory
// store (spec 2, *Retries* and *Protocol versions*): backoff, retry-after,
// flagged records and their dependents, review, renewal and required updates.
// Seam 2 covers the same rules against the local stack.

import { canonicalJson, sha256Hex } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { type MetricEvent, createMetricsSender } from '../metrics';
import { type SyncBackend, SyncEngine } from './engine';
import {
  type BootstrapPage,
  type BootstrapSnapshot,
  type ChunkAnswer,
  type Command,
  type FeedPage,
  type ProtocolStatus,
  type ScopeAnswer,
  SyncCallError,
  type UploadAnswer,
} from './protocol';
import { type RecordType, revisionedItemType } from './registry';
import type { AcceptedRecord, BootstrapProgress, CommandScope, LocalRevisionedItem, NewUpload, QueuedUpload, ReconcileOutcome, RejectedUpload, SyncStore } from './store';
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
  command?: Command;
  unconfirmed?: true;
}

/** The sync store port in memory: what the SQLite store does, without durability. */
class MemoryStore implements SyncStore {
  readonly entries: Entry[] = [];
  readonly accepted: AcceptedRecord[] = [];
  cursor = 0;
  syncedAt: number | null = null;
  /** Established by default: these tests are about an installation that has its baseline. */
  bootstrap: BootstrapProgress = { installed: true };
  /** A generation adopted by default, likewise. */
  generation: number | null = 1;
  last = 0;
  readonly purged: { recordType: string; item: string }[] = [];
  private readonly listeners = new Set<() => void>();

  queue(id: string, payload: unknown, dependencies: string[] = []): void {
    this.entries.push({ id, recordType: 'note', payload, dependencies, operation: null, status: 'pending', disposition: null, failures: 0, flagged: false });
    for (const listener of this.listeners) listener();
  }
  async readUploadQueue(): Promise<readonly QueuedUpload[]> {
    return this.entries
      .filter((entry) => entry.status === 'pending')
      .map(({ id, recordType, payload, dependencies, operation, failures, flagged, command, unconfirmed }) => ({
        id,
        recordType,
        payload,
        dependencies,
        operation,
        failures,
        flagged,
        ...(command ? { command } : {}),
        ...(unconfirmed ? { unconfirmed } : {}),
      }));
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
  async prepareUpload(id: string, prepare: (command: Command) => PreparedOperation): Promise<PreparedOperation> {
    const entry = this.find(id);
    if (entry.operation) return entry.operation;
    const command = await this.allocateCommand();
    entry.operation = prepare(command);
    entry.command = command;
    return entry.operation;
  }
  async readCommandScope(): Promise<CommandScope> {
    const { generation, last } = this;
    if (generation === null) return { generation, last, settled: 0 };
    const pending = this.entries.filter((entry) => entry.status === 'pending' && (!entry.command || entry.command.generation === generation));
    const named = new Set(pending.flatMap((entry) => entry.dependencies));
    const live = [
      ...pending.flatMap((entry) => (entry.command ? [entry.command.position] : [])),
      ...this.entries.filter((entry) => named.has(entry.id) && entry.command?.generation === generation).map((entry) => entry.command!.position),
    ];
    return { generation, last, settled: live.length > 0 ? Math.min(...live) - 1 : last };
  }
  async adoptCommandScope(generation: number): Promise<void> {
    if (generation !== this.generation) this.last = 0;
    this.generation = generation;
  }
  async allocateCommand(): Promise<Command> {
    if (this.generation === null) throw new Error('no generation');
    return { generation: this.generation, position: ++this.last };
  }
  async reconcileUpload(id: string, outcome: ReconcileOutcome): Promise<void> {
    const entry = this.find(id);
    if (entry.status !== 'pending') return;
    if (outcome.kind === 'accepted') entry.status = 'accepted';
    else if (outcome.kind === 'set-aside') {
      entry.status = 'rejected';
      entry.disposition = { status: 'rejected', operation: entry.operation!.operationId, requestHash: entry.operation!.requestHash, code: 'set-aside' };
      delete entry.unconfirmed;
    } else if (outcome.kind === 'unconfirmed') entry.unconfirmed = true;
    else {
      entry.operation = null;
      delete entry.command;
      delete entry.unconfirmed;
      entry.failures = 0;
      entry.flagged = false;
    }
  }
  async readPurgedItems(recordType: string): Promise<readonly string[]> {
    return this.purged.filter((ref) => ref.recordType === recordType).map((ref) => ref.item);
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
  async stageBootstrapPage(
    snapshot: string,
    after: number,
    records: readonly AcceptedRecord[],
    through: number,
    purged: readonly { recordType: string; item: string }[] = [],
  ): Promise<boolean> {
    const { bootstrap } = this;
    if (bootstrap.installed || bootstrap.staging?.snapshot !== snapshot || bootstrap.staging.after !== after) return false;
    this.accepted.push(...records);
    this.purged.push(...purged);
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
    const { item, operation, command } = JSON.parse(request) as { item: string; operation: string; command: Command };
    this.calls.push(`upload ${item}`);
    if (this.everything) throw this.everything;
    if (command.generation !== this.serving) return { status: 'stale-scope', reason: 'retired' };
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
  /** What each feed page answers, in turn; an empty, complete page when none is scripted. */
  readonly feedPages: FeedPage[] = [];
  async feed(): Promise<FeedPage> {
    this.calls.push('feed');
    if (this.everything) throw this.everything;
    return this.feedPages.shift() ?? { entries: [], more: false };
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
  uploadsOf(item: string): number {
    return this.calls.filter((call) => call === `upload ${item}`).length;
  }
  /** The scope calls, apart from `calls`, as "new" or "settled <n>", and the generation the server serves. */
  readonly scopeCalls: string[] = [];
  serving = 1;
  async scope(_installation: string, generation: number | null, settled: number | null): Promise<ScopeAnswer> {
    if (this.everything) throw this.everything;
    if (generation === null) {
      this.scopeCalls.push('new');
      return { status: 'scope', generation: ++this.serving, settled: 0 };
    }
    this.scopeCalls.push(`settled ${settled}`);
    return generation === this.serving ? { status: 'scope', generation, settled: settled ?? 0 } : { status: 'stale-scope' };
  }
}

/** A test-only revisioned item of plain text values. */
const memo = revisionedItemType<string>({
  name: 'memo',
  payloadVersion: 1,
  identityScheme: 'memo-id',
  acceptance: 'private.accept_memo_v1',
  isValue: (value): value is string => typeof value === 'string',
  contribution: null,
  export: { csv: null, json: (state) => state },
  deletion: { serverTables: [] },
});

/** A test-only account-state operation: what a stale scope leaves unconfirmed. */
const toggle: RecordType<{ id: string }> = { ...note, name: 'toggle', kind: 'account-state-operation', acceptance: 'private.accept_toggle_v1' };

function engine(options: { random?: number } = {}) {
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
    registry: new Map([
      [note.name, note as RecordType],
      [toggle.name, toggle as RecordType],
      [memo.name, memo as unknown as RecordType],
    ]),
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
    expect(sync.status.history).toEqual({ state: 'incomplete', summaries: 0, detail: 0 });
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

describe('a stale command scope (#98)', () => {
  /** Two notes and a toggle sent under generation 1 with no answer, then the server retires it. */
  async function retired() {
    const setup = engine();
    const { store, backend } = setup;
    for (const [id, recordType] of [['n1', 'note'], ['n2', 'note'], ['t1', 'toggle']] as const) {
      await store.queueUpload({ id, recordType, item: id, payload: { id }, dependencies: [], positioned: false, purges: null });
      await store.prepareUpload(id, (command) => {
        const request = canonicalJson({ protocol: 1, operation: id.padStart(32, '0'), installation: 'installation-1', command, recordType, payloadVersion: 1, item: id, payload: { id } });
        return { operationId: id.padStart(32, '0'), request, requestHash: sha256Hex(request) };
      });
    }
    backend.serving = 2;
    return setup;
  }

  it('refreshes, reconciles each prepared record, and only then takes a new generation and uploads again', async () => {
    const { store, backend, sync } = await retired();
    const before = backend.calls.length;
    await sync.reconcile();
    // The refused upload, the refresh, then the resent notes under the new generation (the server deduplicates them by identity).
    expect(backend.calls.slice(before)).toEqual(['protocol', 'upload n1', 'feed', 'protocol', 'upload n1', 'upload n2', 'feed']);
    expect(backend.uploadsOf('t1')).toBe(0);
    expect(backend.scopeCalls).toContain('new');
    expect(store.generation).toBe(3);
    expect(store.accepted.map((record) => record.item)).toEqual(['n1', 'n2']);
    // The toggle's outcome isn't in the account's state: it waits for the player, never sent again by itself.
    expect(sync.status.uploads).toEqual([expect.objectContaining({ id: 't1', state: 'unconfirmed' })]);
    await sync.reconcile();
    expect(backend.uploadsOf('t1')).toBe(0);
  });

  it('sends an unconfirmed record anew only when the player decides so, and sets it aside otherwise', async () => {
    const { store, backend, sync } = await retired();
    await sync.reconcile();
    await sync.decideUnconfirmed('t1', 'send-again');
    expect(backend.uploadsOf('t1')).toBe(1);
    expect(await store.readUploadQueue()).toEqual([]);

    const other = await retired();
    await other.sync.reconcile();
    await other.sync.decideUnconfirmed('t1', 'set-aside');
    expect(other.backend.uploadsOf('t1')).toBe(0);
    expect(other.sync.status.uploads).toEqual([expect.objectContaining({ id: 't1', state: 'review' })]);
    expect(await other.store.readRejectedUploads()).toEqual([expect.objectContaining({ id: 't1', code: 'set-aside' })]);
    // A record the server refused isn't the player's to resend.
    await other.sync.decideUnconfirmed('t1', 'send-again');
    expect(other.backend.uploadsOf('t1')).toBe(0);
  });

  it('reports the positions settled after a clean run, once each', async () => {
    const { store, backend, sync } = engine();
    store.queue('n1', { id: 'n1' });
    store.queue('n2', { id: 'n2' });
    await sync.reconcile();
    expect(backend.scopeCalls).toEqual(['settled 2']);
    await sync.reconcile();
    expect(backend.scopeCalls).toEqual(['settled 2']);
  });

  it('recovers when the settled report finds the scope stale, though nothing was waiting', async () => {
    const { store, backend, sync } = engine();
    store.queue('n1', { id: 'n1' });
    backend.serving = 5;
    backend.answer('n1', { status: 'accepted', operation: '', requestHash: '', sequence: 0 });
    store.entries[0]!.status = 'accepted';
    store.last = 1;
    await sync.reconcile();
    await sync.idle();
    // The stale report, the new generation, and the new generation's first report (nothing settled under it yet).
    expect(backend.scopeCalls).toEqual(['settled 1', 'new', 'settled 0']);
    expect(store.generation).toBe(6);
  });
});

describe('a feed reset (#98)', () => {
  it('takes a new snapshot and installs it, keeping the queue, then reads the feed after it', async () => {
    const { store, backend, sync } = engine();
    store.cursor = 4;
    backend.answer('n1', new SyncCallError('refused'));
    store.queue('n1', { id: 'n1' });
    backend.feedPages.push({ status: 'reset', through: 30 });
    await sync.reconcile();
    expect(backend.calls).toEqual(['protocol', 'upload n1', 'feed', 'bootstrap', 'bootstrap page', 'feed']);
    expect(store.bootstrap).toEqual({ installed: true });
    expect((await store.readUploadQueue()).map((entry) => entry.id)).toEqual(['n1']);
  });
});

describe('a stale scope’s revisioned edits (#98)', () => {
  it('acknowledges an edit the account holds, sends anew one whose base is still current, and leaves any other for review', async () => {
    const { store, backend, sync } = engine();
    const state = (revision: number, value: string, proposals: string[] = []) => ({
      revision,
      deleted: false,
      value,
      conflict: proposals.length > 0 ? { generation: 1, proposals: proposals.map((id) => ({ id, kind: 'edit', installation: 'other', value: 'theirs' })) } : null,
    });
    const edits = [
      // Accepted as a proposal: the account shows its operation among them.
      { item: 'proposed', base: 1, value: 'mine', held: (operation: string) => state(2, 'theirs', [operation]) },
      // Accepted as the next revision: the account holds its value.
      { item: 'accepted', base: 1, value: 'mine', held: () => state(2, 'mine') },
      // Never received: the account's revision is still its base.
      { item: 'unreceived', base: 3, value: 'mine', held: () => state(3, 'old') },
      // Moved on since, by others or by it: no way to tell.
      { item: 'ambiguous', base: 1, value: 'mine', held: () => state(4, 'theirs') },
    ];
    for (const edit of edits) {
      const payload = { item: edit.item, action: 'save', base: edit.base, value: edit.value };
      await store.queueUpload({ id: edit.item, recordType: 'memo', item: edit.item, payload, dependencies: [], positioned: false, purges: null });
      const prepared = await store.prepareUpload(edit.item, (command) => {
        const request = canonicalJson({ protocol: 1, operation: edit.item.padStart(32, '0'), installation: 'installation-1', command, recordType: 'memo', payloadVersion: 1, item: edit.item, payload });
        return { operationId: edit.item.padStart(32, '0'), request, requestHash: sha256Hex(request) };
      });
      store.accepted.push({ recordType: 'memo', item: edit.item, sequence: 10, payload: edit.held(prepared.operationId) });
    }
    backend.serving = 2;
    await sync.reconcile();
    expect(store.entries.map((entry) => [entry.id, entry.status, entry.unconfirmed ?? false])).toEqual([
      ['proposed', 'accepted', false],
      ['accepted', 'accepted', false],
      ['unreceived', 'accepted', false],
      ['ambiguous', 'pending', true],
    ]);
    expect(backend.uploadsOf('unreceived')).toBe(1);
    expect(backend.uploadsOf('ambiguous')).toBe(0);
  });
});

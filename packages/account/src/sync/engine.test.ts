// The sync engine's failure rules over a scripted backend and an in-memory
// store (spec 2, *Retries* and *Protocol versions*): backoff, retry-after,
// flagged records and their dependents, review, renewal and required updates.
// Seam 2 covers the same rules against the local stack.

import { describe, expect, it } from 'vitest';

import { type SyncBackend, SyncEngine } from './engine';
import { type ChunkAnswer, type FeedPage, type ProtocolStatus, SyncCallError, type UploadAnswer } from './protocol';
import type { RecordType } from './registry';
import type { AcceptedRecord, LocalRevisionedItem, QueuedUpload, RejectedUpload, SyncStore } from './store';
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
  async feed(): Promise<FeedPage> {
    this.calls.push('feed');
    if (this.everything) throw this.everything;
    return { entries: [], more: false };
  }
  uploadsOf(item: string): number {
    return this.calls.filter((call) => call === `upload ${item}`).length;
  }
}

function engine(options: { random?: number } = {}) {
  const store = new MemoryStore();
  const backend = new ScriptedBackend();
  const clock = { now: 1_000_000 };
  let next = 0;
  const sync = new SyncEngine({
    store,
    backend,
    registry: new Map([[note.name, note as RecordType]]),
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
  return { store, backend, clock, sync, retryWhenDue };
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

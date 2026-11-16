// The SQLCipher account store's upload queue and feed (#91), at seam 1: the
// sync engine's store port on the same database and writer as spec 1's port.
// Faults are injected at the driver: a failed write rolls its transaction
// back, as a kill before the commit would.

import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteActivityStore, StoreError, StoreIntegrityError, type AcceptedRecord, type StoreIdentity } from '@/account/sqlite-store';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { completedRecord, newActivity, transition } from '@/practice/testing/store-contract';

import Database from 'better-sqlite3-multiple-ciphers';

const KEY = 'cd'.repeat(32);
const IDENTITY: StoreIdentity = { environment: 'test', accountId: 'local', installationId: 'test-device' };
/** SHA-256("abc"), FIPS 180-2 appendix B.1. */
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const OPERATION = { operationId: '0123456789abcdef0123456789abcdef', request: 'abc', requestHash: ABC_SHA256 };

const directories: string[] = [];
const opened: SqliteActivityStore[] = [];
afterAll(async () => {
  await Promise.all(opened.map((store) => store.close().catch(() => undefined)));
  directories.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

/** A device's database file, with a disk that can be made to fail writes. */
function newDisk() {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-queue-'));
  directories.push(directory);
  const disk = { path: join(directory, 'account.db'), failing: false };
  const open = async () => {
    const store = await SqliteActivityStore.open(
      await nodeSqlCipherDriver({ fault: () => (disk.failing ? 'io' : undefined) }).open(disk.path, KEY),
      IDENTITY,
    );
    opened.push(store);
    // As the sync engine does before it prepares anything: the server's generation for this installation.
    await store.adoptCommandScope(1);
    return store;
  };
  return { disk, open };
}

async function completed(store: SqliteActivityStore, activityId: string) {
  await store.createActivity(newActivity(activityId));
  await store.commitTransition(transition(activityId, 0));
  return store.complete(completedRecord(activityId));
}

const accepted = (item: string, sequence: number): AcceptedRecord => ({
  recordType: 'completed-practice-session',
  item,
  sequence,
  payload: { item, sequence },
});

describe('the upload queue', () => {
  it('queues a completion once, with no dependencies and no operation yet, and announces it after the commit', async () => {
    const store = await newDisk().open();
    let announced = 0;
    store.onUploadQueued(() => announced++);

    const record = await completed(store, 'a1');
    await store.complete(record);

    expect(announced).toBe(1);
    expect(await store.readUploadQueue()).toEqual([
      { id: 'completed/a1', recordType: 'completed-practice-session', payload: record, dependencies: [], operation: null, failures: 0, flagged: false },
    ]);
  });

  it('fixes the operation before it is first sent: a later preparation, even after a restart, gets the first one back', async () => {
    const { open } = newDisk();
    const store = await open();
    await completed(store, 'a1');

    expect(await store.prepareUpload('completed/a1', () => OPERATION)).toEqual(OPERATION);
    await store.close();
    const restarted = await open();
    const other = { operationId: 'f'.repeat(32), request: 'abc', requestHash: ABC_SHA256 };
    expect(await restarted.prepareUpload('completed/a1', () => other)).toEqual(OPERATION);
    expect((await restarted.readUploadQueue())[0]?.operation).toEqual(OPERATION);
  });

  it('refuses an operation whose hash is not its request\'s', async () => {
    const store = await newDisk().open();
    await completed(store, 'a1');
    await expect(store.prepareUpload('completed/a1', () => ({ ...OPERATION, requestHash: '0'.repeat(64) }))).rejects.toThrow(StoreError);
    expect((await store.readUploadQueue())[0]?.operation).toBeNull();
  });

  it('checks the stored request on read: a changed request is reported, never resent', async () => {
    const { disk, open } = newDisk();
    const store = await open();
    await completed(store, 'a1');
    await store.prepareUpload('completed/a1', () => OPERATION);
    await store.close();

    const db = new Database(disk.path);
    db.pragma(`cipher = 'sqlcipher'`);
    db.pragma('legacy = 4');
    db.pragma(`key = "x'${KEY}'"`);
    db.prepare("UPDATE outgoing SET request = 'abd'").run();
    db.close();

    await expect((await open()).readUploadQueue()).rejects.toThrow(StoreIntegrityError);
  });

  it('applies an acceptance and acknowledges it together, leaving the activity, its transitions and its effects untouched', async () => {
    const store = await newDisk().open();
    const record = await completed(store, 'a1');
    const before = { activity: await store.load('a1'), transitions: await store.readTransitions('a1'), effects: await store.readEffects('a1') };
    await store.prepareUpload('completed/a1', () => OPERATION);

    const disposition = { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 7 } as const;
    await store.acknowledgeUpload('completed/a1', disposition, { recordType: 'completed-practice-session', item: 'a1', sequence: 7, payload: record });
    // A repeated answer (a duplicated response) changes nothing more.
    await store.acknowledgeUpload('completed/a1', disposition, { recordType: 'completed-practice-session', item: 'a1', sequence: 7, payload: record });

    expect(await store.readUploadQueue()).toEqual([]);
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([
      { recordType: 'completed-practice-session', item: 'a1', sequence: 7, payload: record },
    ]);
    expect({ activity: await store.load('a1'), transitions: await store.readTransitions('a1'), effects: await store.readEffects('a1') }).toEqual(before);
    expect(await store.readOutgoing()).toHaveLength(1);
  });

  it('keeps the entry pending, with nothing applied, when the acknowledgement fails to commit', async () => {
    const { disk, open } = newDisk();
    const store = await open();
    const record = await completed(store, 'a1');
    await store.prepareUpload('completed/a1', () => OPERATION);

    disk.failing = true;
    await expect(
      store.acknowledgeUpload(
        'completed/a1',
        { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 1 },
        { recordType: 'completed-practice-session', item: 'a1', sequence: 1, payload: record },
      ),
    ).rejects.toThrow();
    disk.failing = false;

    expect((await store.readUploadQueue()).map((entry) => entry.operation)).toEqual([OPERATION]);
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);
  });

  it('keeps a rejection with its entry instead of deleting the record', async () => {
    const store = await newDisk().open();
    await completed(store, 'a1');
    await store.prepareUpload('completed/a1', () => OPERATION);
    await store.acknowledgeUpload('completed/a1', { status: 'rejected', operation: OPERATION.operationId, requestHash: ABC_SHA256, code: 'invalid-payload' }, null);

    expect(await store.readUploadQueue()).toEqual([]);
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);
    expect(await store.readOutgoing()).toHaveLength(1);
  });

  it('accepts a disposition only for the operation the entry was sent as', async () => {
    const store = await newDisk().open();
    await completed(store, 'a1');
    const disposition = { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 1 } as const;
    await expect(store.acknowledgeUpload('completed/a1', disposition, null)).rejects.toThrow(StoreError);

    await store.prepareUpload('completed/a1', () => OPERATION);
    await expect(store.acknowledgeUpload('completed/a1', { ...disposition, operation: 'e'.repeat(32) }, null)).rejects.toThrow(StoreError);
    expect(await store.readUploadQueue()).toHaveLength(1);
  });
});

describe('failing and refused uploads (#92)', () => {
  it('counts an entry\'s failures and flags it when the count reaches the limit, durably, keeping it pending', async () => {
    const { open } = newDisk();
    const store = await open();
    await completed(store, 'a1');
    expect(await store.recordUploadFailure('completed/a1', 2)).toEqual({ failures: 1, flagged: false });
    expect(await store.recordUploadFailure('completed/a1', 2)).toEqual({ failures: 2, flagged: true });
    await store.close();

    const restarted = await open();
    expect(await restarted.readUploadQueue()).toMatchObject([{ id: 'completed/a1', failures: 2, flagged: true }]);
  });

  it('forgets the failures and the flag on a deliberate retry', async () => {
    const store = await newDisk().open();
    await completed(store, 'a1');
    await store.recordUploadFailure('completed/a1', 1);
    await store.clearUploadFailures('completed/a1');
    expect(await store.readUploadQueue()).toMatchObject([{ id: 'completed/a1', failures: 0, flagged: false }]);
  });

  it('counts nothing when the write fails', async () => {
    const { disk, open } = newDisk();
    const store = await open();
    await completed(store, 'a1');
    disk.failing = true;
    await expect(store.recordUploadFailure('completed/a1', 1)).rejects.toThrow();
    disk.failing = false;
    expect(await store.readUploadQueue()).toMatchObject([{ failures: 0, flagged: false }]);
  });

  it('lists refused entries for review, with their code', async () => {
    const store = await newDisk().open();
    const record = await completed(store, 'a1');
    await completed(store, 'a2');
    await store.prepareUpload('completed/a1', () => OPERATION);
    await store.acknowledgeUpload('completed/a1', { status: 'rejected', operation: OPERATION.operationId, requestHash: ABC_SHA256, code: 'identity-reused' }, null);

    expect(await store.readRejectedUploads()).toEqual([
      { id: 'completed/a1', recordType: 'completed-practice-session', payload: record, code: 'identity-reused' },
    ]);
  });

  it('remembers when it last synced', async () => {
    const { open } = newDisk();
    const store = await open();
    expect(await store.readLastSynced()).toBeNull();
    await store.recordSynced(1_763_000_000_000);
    await store.close();
    expect(await (await open()).readLastSynced()).toBe(1_763_000_000_000);
  });
});

describe('the feed cursor', () => {
  it('starts before the first entry and applies a page with its cursor', async () => {
    const store = await newDisk().open();
    expect(await store.readFeedCursor()).toBe(0);

    expect(await store.applyFeedPage(0, [accepted('a1', 1), accepted('a2', 2)])).toBe(true);
    expect(await store.readFeedCursor()).toBe(2);
    expect((await store.readAcceptedRecords('completed-practice-session')).map((record) => record.item)).toEqual(['a1', 'a2']);
  });

  it('applies nothing for a page fetched from a cursor that has since moved', async () => {
    const store = await newDisk().open();
    await store.applyFeedPage(0, [accepted('a1', 1)]);

    expect(await store.applyFeedPage(0, [accepted('a1', 1), accepted('a2', 2)])).toBe(false);
    expect(await store.readFeedCursor()).toBe(1);
    expect(await store.readAcceptedRecords('completed-practice-session')).toHaveLength(1);
  });

  it('never advances over a gap', async () => {
    const store = await newDisk().open();
    await expect(store.applyFeedPage(0, [accepted('a1', 1), accepted('a3', 3)])).rejects.toThrow(StoreError);
    expect(await store.readFeedCursor()).toBe(0);
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);
  });

  it('keeps the cursor and every record as they were when the page fails to commit, and applies it once on the retry', async () => {
    const { disk, open } = newDisk();
    const store = await open();
    disk.failing = true;
    await expect(store.applyFeedPage(0, [accepted('a1', 1), accepted('a2', 2)])).rejects.toThrow();
    disk.failing = false;
    expect(await store.readFeedCursor()).toBe(0);
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);

    await store.close();
    const restarted = await open();
    expect(await restarted.applyFeedPage(0, [accepted('a1', 1), accepted('a2', 2)])).toBe(true);
    expect(await restarted.readAcceptedRecords('completed-practice-session')).toHaveLength(2);
  });
});

describe('entries other than completions (#95)', () => {
  const OTHER = { operationId: '1'.repeat(32), request: 'abc', requestHash: ABC_SHA256 };
  const operation = (id: string, fields: Partial<{ dependencies: string[]; positioned: boolean; purges: { recordType: string; item: string } | null }> = {}) => ({
    id,
    recordType: fields.positioned ? 'challenge-attempt' : 'sharing-withdrawal',
    item: id,
    payload: { id },
    dependencies: fields.dependencies ?? [],
    positioned: fields.positioned ?? false,
    purges: fields.purges ?? null,
  });

  it('queues an account-state operation with no activity, announced after the commit, outside spec 1\'s outgoing records', async () => {
    const store = await newDisk().open();
    let announced = 0;
    store.onUploadQueued(() => announced++);

    expect(await store.queueUpload(operation('op-1'))).toEqual({
      id: 'op-1',
      recordType: 'sharing-withdrawal',
      payload: { id: 'op-1' },
      dependencies: [],
      operation: null,
      failures: 0,
      flagged: false,
    });
    expect(announced).toBe(1);
    expect(await store.readUploadQueue()).toEqual([{ id: 'op-1', recordType: 'sharing-withdrawal', payload: { id: 'op-1' }, dependencies: [], operation: null, failures: 0, flagged: false }]);
    expect(await store.readOutgoing()).toEqual([]);
  });

  it('gives a per-device type\'s entries consecutive positions, per type, that survive a restart and are never reused', async () => {
    const { open } = newDisk();
    const store = await open();
    expect((await store.queueUpload(operation('a-1', { positioned: true }))).position).toBe(1);
    expect((await store.queueUpload(operation('w-1'))).position).toBeUndefined();
    expect((await store.queueUpload(operation('a-2', { positioned: true }))).position).toBe(2);

    // Acknowledged entries leave the queue; their positions stay taken.
    await store.prepareUpload('a-2', () => OPERATION);
    await store.acknowledgeUpload('a-2', { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 1 }, null);
    await store.close();
    const restarted = await open();
    expect((await restarted.queueUpload(operation('a-3', { positioned: true }))).position).toBe(3);
    expect((await restarted.readUploadQueue()).map(({ id, position }) => [id, position])).toEqual([
      ['a-1', 1],
      ['w-1', undefined],
      ['a-3', 3],
    ]);
  });

  it('names the operations its dependencies were sent as, once they have one', async () => {
    const store = await newDisk().open();
    await store.queueUpload(operation('w-1'));
    await store.queueUpload(operation('c-1', { dependencies: ['w-1'] }));
    expect((await store.readUploadQueue())[1]?.after).toBeUndefined();

    await store.prepareUpload('w-1', () => OTHER);
    expect((await store.readUploadQueue())[1]?.after).toEqual([OTHER.operationId]);
    await store.acknowledgeUpload('w-1', { status: 'accepted', operation: OTHER.operationId, requestHash: ABC_SHA256, sequence: 1 }, null);
    expect(await store.readUploadQueue()).toEqual([
      { id: 'c-1', recordType: 'sharing-withdrawal', payload: { id: 'c-1' }, dependencies: ['w-1'], operation: null, failures: 0, flagged: false, after: [OTHER.operationId] },
    ]);
  });

  it('stores and returns a per-device record\'s origin', async () => {
    const store = await newDisk().open();
    const record = { recordType: 'challenge-attempt', item: 'a1', sequence: 1, payload: {}, origin: { installation: 'phone', position: 4 } };
    await store.applyFeedPage(0, [record]);
    expect(await store.readAcceptedRecords('challenge-attempt')).toEqual([record]);
  });

  it('removes a result when its purge is queued, and never accepts it again from an acknowledgement or the feed', async () => {
    const store = await newDisk().open();
    await store.applyFeedPage(0, [accepted('a1', 1), accepted('a2', 2)]);
    await store.queueUpload(operation('p-1', { purges: { recordType: 'completed-practice-session', item: 'a1' } }));
    expect((await store.readAcceptedRecords('completed-practice-session')).map((record) => record.item)).toEqual(['a2']);

    await store.applyFeedPage(2, [accepted('a1', 3)]);
    const record = await completed(store, 'a1');
    await store.prepareUpload('completed/a1', () => OPERATION);
    await store.acknowledgeUpload(
      'completed/a1',
      { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 1 },
      { recordType: 'completed-practice-session', item: 'a1', sequence: 1, payload: record },
    );
    expect((await store.readAcceptedRecords('completed-practice-session')).map((record) => record.item)).toEqual(['a2']);
  });

  it('applies a page\'s purges and steps the cursor over redacted entries, never over a gap', async () => {
    const store = await newDisk().open();
    await store.applyFeedPage(0, [accepted('a1', 1)]);
    const purge = { recordType: 'result-purge', item: 'a1', sequence: 4, payload: {} };

    await expect(store.applyFeedPage(1, [purge], { redacted: [2], purged: [{ recordType: 'completed-practice-session', item: 'a1' }] })).rejects.toThrow(StoreError);
    expect(await store.readFeedCursor()).toBe(1);
    expect(await store.readAcceptedRecords('completed-practice-session')).toHaveLength(1);

    expect(await store.applyFeedPage(1, [purge], { redacted: [2, 3], purged: [{ recordType: 'completed-practice-session', item: 'a1' }] })).toBe(true);
    expect(await store.readFeedCursor()).toBe(4);
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);
    expect(await store.readAcceptedRecords('result-purge')).toEqual([purge]);
  });
});

describe('command scopes (#98)', () => {
  const entry = (id: string, dependencies: string[] = []) => ({
    id,
    recordType: 'sharing-withdrawal',
    item: id,
    payload: { id },
    dependencies,
    positioned: false,
    purges: null,
  });
  /** An operation for the command it is given: what the engine's envelope does. */
  const asCommand = (digit: string) => (command: { generation: number; position: number }) => {
    const request = `${digit}:${command.generation}:${command.position}`;
    return { operationId: digit.repeat(32), request, requestHash: createHash('sha256').update(request).digest('hex') };
  };
  const accept = (store: SqliteActivityStore, id: string, digit: string, request: string, sequence: number) =>
    store.acknowledgeUpload(id, { status: 'accepted', operation: digit.repeat(32), requestHash: createHash('sha256').update(request).digest('hex'), sequence }, null);
  const commands = async (store: SqliteActivityStore) => (await store.readUploadQueue()).map(({ id, command }) => [id, command]);

  it('gives each entry the next position under the adopted generation when it is prepared, durably; none before a generation', async () => {
    const { open } = newDisk();
    const store = await open();
    await store.queueUpload(entry('w-1'));
    await store.queueUpload(entry('w-2'));
    await store.queueUpload(entry('w-3'));
    // Queued, not prepared: no position yet, so an entry replaced or removed before sending leaves no gap.
    expect(await commands(store)).toEqual([
      ['w-1', undefined],
      ['w-2', undefined],
      ['w-3', undefined],
    ]);
    await store.prepareUpload('w-2', asCommand('2'));
    await store.prepareUpload('w-1', asCommand('1'));
    // A preparation that fails uses no position.
    await expect(store.prepareUpload('w-3', () => { throw new Error('too large'); })).rejects.toThrow('too large');
    await store.close();
    const restarted = await open();
    await restarted.prepareUpload('w-3', asCommand('3'));
    expect(await commands(restarted)).toEqual([
      ['w-1', { generation: 1, position: 2 }],
      ['w-2', { generation: 1, position: 1 }],
      ['w-3', { generation: 1, position: 3 }],
    ]);
    expect(await restarted.allocateCommand()).toEqual({ generation: 1, position: 4 });

    const fresh = await (newDiskWithoutScope()).open();
    await fresh.queueUpload(entry('w-1'));
    await expect(fresh.prepareUpload('w-1', asCommand('1'))).rejects.toThrow('no command generation');
    expect(await fresh.readCommandScope()).toEqual({ generation: null, last: 0, settled: 0 });
  });

  it('starts positions again from 1 under a new generation, and keeps them under the same one', async () => {
    const store = await newDisk().open();
    await store.allocateCommand();
    await store.allocateCommand();
    await store.adoptCommandScope(1);
    expect(await store.allocateCommand()).toEqual({ generation: 1, position: 3 });
    await store.adoptCommandScope(2);
    expect(await store.allocateCommand()).toEqual({ generation: 2, position: 1 });
  });

  it('settles every position below the lowest still live: a pending prepared entry, or an acknowledged dependency a pending entry names', async () => {
    const store = await newDisk().open();
    expect(await store.readCommandScope()).toEqual({ generation: 1, last: 0, settled: 0 });
    for (const id of ['w-1', 'w-2', 'w-3']) await store.queueUpload(entry(id));
    await store.queueUpload(entry('c-1', ['w-3']));
    for (const [id, digit] of [['w-1', '1'], ['w-2', '2'], ['w-3', '3']] as const) await store.prepareUpload(id, asCommand(digit));
    // Positions 1 and 3 acknowledged, 2 still waiting: the gap holds the marker at 1.
    await accept(store, 'w-1', '1', '1:1:1', 1);
    await accept(store, 'w-3', '3', '3:1:3', 2);
    expect(await store.readCommandScope()).toEqual({ generation: 1, last: 3, settled: 1 });
    // 2 acknowledged: 3 is still named by c-1, which hasn't been sent.
    await accept(store, 'w-2', '2', '2:1:2', 3);
    expect(await store.readCommandScope()).toEqual({ generation: 1, last: 3, settled: 2 });
    await store.prepareUpload('c-1', asCommand('4'));
    expect(await store.readCommandScope()).toEqual({ generation: 1, last: 4, settled: 2 });
    await accept(store, 'c-1', '4', '4:1:4', 4);
    // A position given but never sent (a resolution whose answer never came) is settled once nothing pending is below it.
    await store.allocateCommand();
    expect(await store.readCommandScope()).toEqual({ generation: 1, last: 5, settled: 5 });
  });

  it('names only the current generation’s operations as barriers', async () => {
    const store = await newDisk().open();
    await store.queueUpload(entry('w-1'));
    await store.queueUpload(entry('c-1', ['w-1']));
    await store.prepareUpload('w-1', asCommand('1'));
    await accept(store, 'w-1', '1', '1:1:1', 1);
    expect((await store.readUploadQueue())[0]?.after).toEqual(['1'.repeat(32)]);
    // The server refuses every earlier generation's command, and has dropped its receipts.
    await store.adoptCommandScope(2);
    expect((await store.readUploadQueue())[0]?.after).toBeUndefined();
  });

  it('reconciles an entry whose scope went stale: acknowledged, prepared anew, or unconfirmed until the player decides', async () => {
    const store = await newDisk().open();
    let announced = 0;
    store.onUploadQueued(() => announced++);
    for (const id of ['shown', 'unsent', 'unknown']) {
      await store.queueUpload(entry(id));
      await store.prepareUpload(id, asCommand(String(['shown', 'unsent', 'unknown'].indexOf(id) + 1)));
    }
    announced = 0;
    await store.reconcileUpload('shown', { kind: 'accepted', sequence: 9 });
    await store.reconcileUpload('unsent', { kind: 'unsent' });
    await store.reconcileUpload('unknown', { kind: 'unconfirmed' });
    expect(announced).toBe(1);
    expect(await store.readUploadQueue()).toEqual([
      { id: 'unsent', recordType: 'sharing-withdrawal', payload: { id: 'unsent' }, dependencies: [], operation: null, failures: 0, flagged: false },
      {
        id: 'unknown',
        recordType: 'sharing-withdrawal',
        payload: { id: 'unknown' },
        dependencies: [],
        operation: expect.objectContaining({ operationId: '3'.repeat(32) }),
        failures: 0,
        flagged: false,
        command: { generation: 1, position: 3 },
        unconfirmed: true,
      },
    ]);
    // The entry sent anew is a new operation, at a new position.
    await store.adoptCommandScope(2);
    expect(await store.prepareUpload('unsent', asCommand('5'))).toMatchObject({ operationId: '5'.repeat(32), request: '5:2:1' });
    // Setting aside keeps it, with the refused ones; only an unconfirmed entry can be.
    await expect(store.reconcileUpload('unsent', { kind: 'set-aside' })).rejects.toThrow(StoreError);
    await store.reconcileUpload('unknown', { kind: 'set-aside' });
    expect(await store.readRejectedUploads()).toEqual([{ id: 'unknown', recordType: 'sharing-withdrawal', payload: { id: 'unknown' }, code: 'set-aside' }]);
    expect((await store.readUploadQueue()).map(({ id }) => id)).toEqual(['unsent']);
  });
});

/** A device's database with no command generation adopted yet: a new database, before the engine asks for one. */
function newDiskWithoutScope() {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-queue-'));
  directories.push(directory);
  return {
    open: async () => {
      const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(join(directory, 'account.db'), KEY), IDENTITY);
      opened.push(store);
      return store;
    },
  };
}

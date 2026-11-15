// The SQLCipher account store's upload queue and feed (#91), at seam 1: the
// sync engine's store port on the same database and writer as spec 1's port.
// Faults are injected at the driver: a failed write rolls its transaction
// back, as a kill before the commit would.

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

    expect(await store.prepareUpload('completed/a1', OPERATION)).toEqual(OPERATION);
    await store.close();
    const restarted = await open();
    const other = { operationId: 'f'.repeat(32), request: 'abc', requestHash: ABC_SHA256 };
    expect(await restarted.prepareUpload('completed/a1', other)).toEqual(OPERATION);
    expect((await restarted.readUploadQueue())[0]?.operation).toEqual(OPERATION);
  });

  it('refuses an operation whose hash is not its request\'s', async () => {
    const store = await newDisk().open();
    await completed(store, 'a1');
    await expect(store.prepareUpload('completed/a1', { ...OPERATION, requestHash: '0'.repeat(64) })).rejects.toThrow(StoreError);
    expect((await store.readUploadQueue())[0]?.operation).toBeNull();
  });

  it('checks the stored request on read: a changed request is reported, never resent', async () => {
    const { disk, open } = newDisk();
    const store = await open();
    await completed(store, 'a1');
    await store.prepareUpload('completed/a1', OPERATION);
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
    await store.prepareUpload('completed/a1', OPERATION);

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
    await store.prepareUpload('completed/a1', OPERATION);

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
    await store.prepareUpload('completed/a1', OPERATION);
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

    await store.prepareUpload('completed/a1', OPERATION);
    await expect(store.acknowledgeUpload('completed/a1', { ...disposition, operation: 'e'.repeat(32) }, null)).rejects.toThrow(StoreError);
    expect(await store.readUploadQueue()).toHaveLength(1);
  });
});

describe('failing and refused uploads (#92)', () => {
  it('counts an entry\'s failures and flags it, durably, keeping it pending', async () => {
    const { open } = newDisk();
    const store = await open();
    await completed(store, 'a1');
    expect(await store.recordUploadFailure('completed/a1', false)).toBe(1);
    expect(await store.recordUploadFailure('completed/a1', true)).toBe(2);
    await store.close();

    const restarted = await open();
    expect(await restarted.readUploadQueue()).toMatchObject([{ id: 'completed/a1', failures: 2, flagged: true }]);
  });

  it('forgets the failures and the flag on a deliberate retry', async () => {
    const store = await newDisk().open();
    await completed(store, 'a1');
    await store.recordUploadFailure('completed/a1', true);
    await store.clearUploadFailures('completed/a1');
    expect(await store.readUploadQueue()).toMatchObject([{ id: 'completed/a1', failures: 0, flagged: false }]);
  });

  it('counts nothing when the write fails', async () => {
    const { disk, open } = newDisk();
    const store = await open();
    await completed(store, 'a1');
    disk.failing = true;
    await expect(store.recordUploadFailure('completed/a1', true)).rejects.toThrow();
    disk.failing = false;
    expect(await store.readUploadQueue()).toMatchObject([{ failures: 0, flagged: false }]);
  });

  it('lists refused entries for review, with their code', async () => {
    const store = await newDisk().open();
    const record = await completed(store, 'a1');
    await completed(store, 'a2');
    await store.prepareUpload('completed/a1', OPERATION);
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

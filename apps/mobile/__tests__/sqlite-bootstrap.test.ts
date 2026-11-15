// The SQLCipher account store's bootstrap staging (#96), at seam 1: a
// snapshot's pages are staged durably, and installing makes them the
// baseline and moves the feed cursor to the watermark in one transaction,
// keeping the upload queue, later records and purged identities.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type AcceptedRecord, type BootstrapSnapshot, SqliteActivityStore, type StoreIdentity } from '@/account/sqlite-store';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';

const KEY = 'ab'.repeat(32);
const IDENTITY: StoreIdentity = { environment: 'test', accountId: 'local', installationId: 'test-device' };
const TYPE = 'test-result';
/** SHA-256("abc"), FIPS 180-2 appendix B.1. */
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

const directories: string[] = [];
const opened: SqliteActivityStore[] = [];
afterAll(async () => {
  await Promise.all(opened.map((store) => store.close().catch(() => undefined)));
  directories.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

async function openStore(path: string) {
  const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(path, KEY), IDENTITY);
  opened.push(store);
  return store;
}

async function newStore() {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-bootstrap-'));
  directories.push(directory);
  const path = join(directory, 'account.db');
  return { store: await openStore(path), path };
}

const SNAPSHOT: BootstrapSnapshot = {
  snapshot: 'snapshot-1',
  watermark: 12,
  rows: 3,
  totals: [{ total: 'practice', game: 'test', currency: 'simulated', records: 3, net: '6' }],
};
const record = (item: string, sequence: number, amount = '2'): AcceptedRecord => ({
  recordType: TYPE,
  item,
  sequence,
  payload: { version: 1, resultId: item, amount },
});
const upload = (id: string, payload: unknown, purges: { recordType: string; item: string } | null = null) => ({
  id,
  recordType: purges ? 'test-result-purge' : TYPE,
  item: id,
  payload,
  dependencies: [],
  positioned: false,
  purges,
});
const items = async (store: SqliteActivityStore) => (await store.readAcceptedRecords(TYPE)).map(({ item, sequence }) => [item, sequence]);

describe('bootstrap staging', () => {
  it('starts with no baseline, stages pages with their progress, and installs them with the cursor in one step', async () => {
    const { store } = await newStore();
    expect(await store.readBootstrap()).toEqual({ installed: false, staging: null });

    await store.beginBootstrap(SNAPSHOT);
    expect(await store.stageBootstrapPage('snapshot-1', 0, [record('r-1', 3), record('r-2', 7)], 2)).toBe(true);
    expect(await store.readBootstrap()).toEqual({ installed: false, staging: { ...SNAPSHOT, staged: 2, after: 2 } });
    // Staged is not accepted: nothing shows, and the feed hasn't moved.
    expect(await items(store)).toEqual([]);
    expect(await store.readFeedCursor()).toBe(0);

    expect(await store.stageBootstrapPage('snapshot-1', 2, [record('r-3', 12)], 4)).toBe(true);
    expect(await store.installBootstrap('snapshot-1')).toBe(true);
    expect(await items(store)).toEqual([
      ['r-1', 3],
      ['r-2', 7],
      ['r-3', 12],
    ]);
    expect(await store.readFeedCursor()).toBe(12);
    expect(await store.readBootstrap()).toEqual({ installed: true });
  });

  it('refuses a page for another snapshot or from another place, staging nothing', async () => {
    const { store } = await newStore();
    await store.beginBootstrap(SNAPSHOT);
    expect(await store.stageBootstrapPage('snapshot-0', 0, [record('r-1', 3)], 1)).toBe(false);
    expect(await store.stageBootstrapPage('snapshot-1', 5, [record('r-1', 3)], 6)).toBe(false);
    expect(await store.installBootstrap('snapshot-0')).toBe(false);
    expect(await store.readBootstrap()).toEqual({ installed: false, staging: { ...SNAPSHOT, staged: 0, after: 0 } });
  });

  it('keeps its progress across closing and reopening the database', async () => {
    const { store, path } = await newStore();
    await store.beginBootstrap(SNAPSHOT);
    await store.stageBootstrapPage('snapshot-1', 0, [record('r-1', 3)], 1);
    await store.close();
    const reopened = await openStore(path);
    expect(await reopened.readBootstrap()).toEqual({ installed: false, staging: { ...SNAPSHOT, staged: 1, after: 1 } });
    await reopened.stageBootstrapPage('snapshot-1', 1, [record('r-2', 7)], 3);
    expect(await reopened.installBootstrap('snapshot-1')).toBe(true);
    expect(await items(reopened)).toEqual([
      ['r-1', 3],
      ['r-2', 7],
    ]);
  });

  it('a new snapshot discards what was staged, never the upload queue', async () => {
    const { store } = await newStore();
    await store.queueUpload(upload('mine', { version: 1, resultId: 'mine', amount: '1' }));
    await store.beginBootstrap(SNAPSHOT);
    await store.stageBootstrapPage('snapshot-1', 0, [record('r-old', 3)], 1);

    await store.beginBootstrap({ ...SNAPSHOT, snapshot: 'snapshot-2', watermark: 20 });
    expect(await store.readBootstrap()).toEqual({ installed: false, staging: { ...SNAPSHOT, snapshot: 'snapshot-2', watermark: 20, staged: 0, after: 0 } });
    expect(await store.installBootstrap('snapshot-2')).toBe(true);
    expect(await items(store)).toEqual([]);
    expect((await store.readUploadQueue()).map((entry) => entry.id)).toEqual(['mine']);
    expect(await store.readFeedCursor()).toBe(20);
  });

  it('keeps a record accepted here at a later sequence, and never accepts a purged result again', async () => {
    const { store } = await newStore();
    await store.queueUpload(upload('purge', { version: 1, target: 'r-purged' }, { recordType: TYPE, item: 'r-purged' }));
    await store.queueUpload(upload('r-later', { version: 1, resultId: 'r-later', amount: '9' }));
    const operation = { operationId: 'b'.repeat(32), request: 'abc', requestHash: ABC_SHA256 };
    await store.prepareUpload('r-later', operation);
    await store.acknowledgeUpload('r-later', { status: 'accepted', operation: operation.operationId, requestHash: ABC_SHA256, sequence: 15 }, record('r-later', 15, '9'));

    await store.beginBootstrap(SNAPSHOT);
    await store.stageBootstrapPage('snapshot-1', 0, [record('r-purged', 2), record('r-later', 15, '1'), record('r-1', 3)], 3);
    expect(await store.installBootstrap('snapshot-1')).toBe(true);
    expect((await store.readAcceptedRecords(TYPE)).map(({ item, payload }) => [item, (payload as { amount: string }).amount])).toEqual([
      ['r-1', '2'],
      ['r-later', '9'],
    ]);
  });

  it('installs once: a second install, or a new snapshot after it, is refused', async () => {
    const { store } = await newStore();
    await store.beginBootstrap(SNAPSHOT);
    expect(await store.installBootstrap('snapshot-1')).toBe(true);
    expect(await store.installBootstrap('snapshot-1')).toBe(false);
    await expect(store.beginBootstrap(SNAPSHOT)).rejects.toThrow('already installed');
  });
});

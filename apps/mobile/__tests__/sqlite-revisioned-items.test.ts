// The SQLCipher account store's revisioned items (#94), at seam 1: local saves
// and deletions queue their uploads in the same transaction, name the base
// they were made from, and show as local changes until the account's accepted
// state reflects them.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SqliteActivityStore, type StoreIdentity } from '@/account/sqlite-store';
import { nodeSqlCipherDriver } from '@/account/testing/node-sqlcipher';
import { completedRecord, newActivity, transition } from '@/practice/testing/store-contract';

const KEY = 'ef'.repeat(32);
const IDENTITY: StoreIdentity = { environment: 'test', accountId: 'local', installationId: 'test-device' };
const TYPE = 'test-revisioned-item';
/** SHA-256("abc"), FIPS 180-2 appendix B.1. */
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const OPERATION = { operationId: 'a'.repeat(32), request: 'abc', requestHash: ABC_SHA256 };

const directories: string[] = [];
const opened: SqliteActivityStore[] = [];
afterAll(async () => {
  await Promise.all(opened.map((store) => store.close().catch(() => undefined)));
  directories.forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

async function newStore() {
  const directory = mkdtempSync(join(tmpdir(), 'tableside-revisioned-'));
  directories.push(directory);
  const store = await SqliteActivityStore.open(await nodeSqlCipherDriver().open(join(directory, 'account.db'), KEY), IDENTITY);
  opened.push(store);
  await store.adoptCommandScope(1);
  return store;
}

const value = (net: string) => ({ game: 'blackjack', currency: 'USD', net });
const state = (revision: number, net: string | null) => ({
  revision,
  deleted: net === null,
  value: net === null ? null : value(net),
  conflict: null,
});

/** The account accepted the item at `sequence` (as a feed page brings it). */
async function acceptedAt(store: SqliteActivityStore, item: string, sequence: number, payload: unknown) {
  const cursor = await store.readFeedCursor();
  // Earlier sequences belong to other items here.
  const filler = Array.from({ length: sequence - cursor - 1 }, (_, index) => ({
    recordType: TYPE,
    item: `other-${cursor + index + 1}`,
    sequence: cursor + index + 1,
    payload: state(1, '0'),
  }));
  expect(await store.applyFeedPage(cursor, [...filler, { recordType: TYPE, item, sequence, payload }])).toBe(true);
}

const uploads = async (store: SqliteActivityStore) =>
  (await store.readUploadQueue()).map(({ id, payload, dependencies }) => ({ id, payload, dependencies }));
const item = async (store: SqliteActivityStore, id: string) => (await store.readRevisionedItems(TYPE)).find((entry) => entry.item === id);

describe('a revisioned item saved on this installation', () => {
  it('is queued as a new item (base 0) and shows as a local change that never reached the account', async () => {
    const store = await newStore();
    let announced = 0;
    store.onUploadQueued(() => announced++);

    await store.writeRevisionedItem(TYPE, 'item-1', value('25'));

    expect(announced).toBe(1);
    expect(await uploads(store)).toEqual([
      { id: expect.any(String), payload: { item: 'item-1', action: 'save', base: 0, value: value('25') }, dependencies: [] },
    ]);
    expect(await store.readRevisionedItems(TYPE)).toEqual([{ item: 'item-1', accepted: null, change: { value: value('25') }, onAccount: false }]);
  });

  it('replaces its upload while that is unsent, and is removed entirely when deleted before it was ever sent', async () => {
    const store = await newStore();
    await store.writeRevisionedItem(TYPE, 'item-1', value('25'));
    await store.writeRevisionedItem(TYPE, 'item-1', value('40'));
    expect((await uploads(store)).map((upload) => upload.payload)).toEqual([{ item: 'item-1', action: 'save', base: 0, value: value('40') }]);

    await store.writeRevisionedItem(TYPE, 'item-1', null);
    expect(await uploads(store)).toEqual([]);
    expect(await store.readRevisionedItems(TYPE)).toEqual([]);
  });

  it('names the accepted revision it was edited or deleted from', async () => {
    const store = await newStore();
    await acceptedAt(store, 'item-1', 3, state(2, '10'));

    await store.writeRevisionedItem(TYPE, 'item-1', value('15'));
    expect((await uploads(store)).map((upload) => upload.payload)).toEqual([{ item: 'item-1', action: 'save', base: 2, value: value('15') }]);
    expect(await item(store, 'item-1')).toEqual({ item: 'item-1', accepted: state(2, '10'), change: { value: value('15') }, onAccount: true });

    await store.writeRevisionedItem(TYPE, 'item-1', null);
    expect((await uploads(store)).map((upload) => upload.payload)).toEqual([{ item: 'item-1', action: 'delete', base: 2, value: null }]);
    expect((await item(store, 'item-1'))?.change).toEqual({ value: null });
  });

  it('follows its own sent upload, by operation, when edited before that upload is reflected', async () => {
    const store = await newStore();
    await store.writeRevisionedItem(TYPE, 'item-1', value('25'));
    const [first] = await store.readUploadQueue();
    await store.prepareUpload(first!.id, () => OPERATION);

    // Sent, no receipt yet: the next edit waits for it and follows whatever revision it made.
    await store.writeRevisionedItem(TYPE, 'item-1', value('30'));
    const [, second] = await uploads(store);
    expect(second).toEqual({
      id: expect.any(String),
      payload: { item: 'item-1', action: 'save', base: { operation: OPERATION.operationId }, value: value('30') },
      dependencies: [first!.id],
    });

    // Acknowledged, but the feed hasn't brought the item yet: still the local change, still following the operation.
    await store.acknowledgeUpload(first!.id, { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 1 }, null);
    expect(await item(store, 'item-1')).toEqual({ item: 'item-1', accepted: null, change: { value: value('30') }, onAccount: true });
  });

  it('shows the accepted state once it reflects the acknowledged upload, which then leaves the queue', async () => {
    const store = await newStore();
    await store.writeRevisionedItem(TYPE, 'item-1', value('25'));
    const [first] = await store.readUploadQueue();
    await store.prepareUpload(first!.id, () => OPERATION);
    await store.acknowledgeUpload(first!.id, { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 1 }, null);

    await acceptedAt(store, 'item-1', 1, state(1, '25'));
    expect(await store.readRevisionedItems(TYPE)).toEqual([{ item: 'item-1', accepted: state(1, '25'), change: null, onAccount: true }]);

    // The next edit is made from the accepted revision again.
    await store.writeRevisionedItem(TYPE, 'item-1', value('5'));
    expect((await uploads(store)).map((upload) => upload.payload)).toEqual([{ item: 'item-1', action: 'save', base: 1, value: value('5') }]);
  });

  it('leaves the queue at once when its receipt names a sequence the accepted state already reflects', async () => {
    const store = await newStore();
    await acceptedAt(store, 'item-1', 3, state(2, '10'));
    // A stale save of the value the account already holds: the server answers "already accepted" at 3.
    await store.writeRevisionedItem(TYPE, 'item-1', value('10'));
    const [upload] = await store.readUploadQueue();
    await store.prepareUpload(upload!.id, () => OPERATION);
    await store.acknowledgeUpload(upload!.id, { status: 'accepted', operation: OPERATION.operationId, requestHash: ABC_SHA256, sequence: 3 }, null);

    expect(await item(store, 'item-1')).toEqual({ item: 'item-1', accepted: state(2, '10'), change: null, onAccount: true });
    await store.writeRevisionedItem(TYPE, 'item-1', value('12'));
    expect((await uploads(store)).map((entry) => entry.payload)).toEqual([{ item: 'item-1', action: 'save', base: 2, value: value('12') }]);
  });

  it('never moves an item back to an earlier accepted state', async () => {
    const store = await newStore();
    await acceptedAt(store, 'item-1', 2, state(2, '20'));
    // A page that repeats an older state for the item (a resolution rewrote earlier entries) leaves the later one.
    expect(await store.applyFeedPage(2, [{ recordType: TYPE, item: 'item-1', sequence: 3, payload: state(3, '30') }])).toBe(true);
    expect((await item(store, 'item-1'))?.accepted).toEqual(state(3, '30'));
  });

  it('does nothing when deleting an item that is already deleted', async () => {
    const store = await newStore();
    await acceptedAt(store, 'item-1', 1, state(2, null));
    await store.writeRevisionedItem(TYPE, 'item-1', null);
    expect(await uploads(store)).toEqual([]);
  });

  it('is not one of spec 1’s outgoing synchronization records, which stay one per completion', async () => {
    const store = await newStore();
    await store.createActivity(newActivity('a1'));
    await store.commitTransition(transition('a1', 0));
    const record = await store.complete(completedRecord('a1'));
    await store.writeRevisionedItem(TYPE, 'item-1', value('25'));

    expect(await store.readOutgoing()).toEqual([{ id: 'completed/a1', kind: 'completed-practice-session', record }]);
    expect((await store.readUploadQueue()).map((upload) => upload.recordType)).toEqual(['completed-practice-session', TYPE]);
  });
});

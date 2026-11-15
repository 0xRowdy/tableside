// Seam 2: new-device bootstrap (#96; spec 2, *Bootstrap*, Amendments 1 A6,
// 2 §4, 4 §1 and §3, 7 §3). A device signing in to an account with history
// gets every summary and lifetime total from one snapshot at one watermark,
// staged locally page by page, then installs the baseline and the cursor
// together before any later feed entry. Proven with seam 2's test-only types
// (src/testing/record-types.ts) standing in for specs 3, 4 and 6. Faults are
// injected at the network, the app process and the server's state.

import { afterEach, describe, expect, it } from 'vitest';

import type { TotalsRow } from '../src';
import {
  type SimulatedDevice,
  type TestRevisionedValue,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  signInByEmail,
  testResult,
  testRevisionedItem,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** Queues a record on a device and expects it queued. */
async function queue(d: SimulatedDevice, recordType: string, payload: unknown) {
  const result = await d.account.sync.queue(recordType, payload);
  if (result.status !== 'queued') throw new Error(`${recordType} was refused: ${result.reason}`);
  return result;
}

const result = (id: string, amount: string) => ({ version: 1, resultId: id, amount, detail: `detail of ${id}: private-${id}-marker` });
const casinoValue = (net: string, game = 'blackjack'): TestRevisionedValue => ({ game, currency: 'USD', net });

/** A phone with an account that has history: two results with detail, a practice session, two revisioned items (one deleted). */
async function accountWithHistory() {
  const email = uniqueEmail('bootstrap');
  const phone = device('phone');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  await queue(phone, testResult.name, result('r-1', '7'));
  await queue(phone, testResult.name, result('r-2', '-5/2'));
  const practice = await phone.playPracticeSession();
  await phone.account.records.save(testRevisionedItem.name, 'casino-1', casinoValue('40'));
  await phone.account.records.save(testRevisionedItem.name, 'casino-2', casinoValue('12', 'craps'));
  await phone.account.sync.reconcile();
  await phone.account.records.delete(testRevisionedItem.name, 'casino-2');
  await phone.account.sync.reconcile();
  return { email, phone, practice };
}

/** The account's totals as the server keeps them. */
async function serverTotals(d: SimulatedDevice): Promise<{ sequence: number; totals: TotalsRow[] }> {
  const { data, error } = await stack.rawClient(accessToken(d)).rpc('account_totals_v1');
  if (error) throw new Error(error.message);
  return data as { sequence: number; totals: TotalsRow[] };
}

/** Every feed request a device sent, by the cursor it asked after. */
const feedRequests = (d: SimulatedDevice) =>
  d.proxy.sent.filter(({ url }) => url.includes('sync_feed_v1')).map(({ body }) => (JSON.parse(body ?? '{}') as { after: number }).after);

describe('a new device', () => {
  it('gets every summary and lifetime total from one snapshot at one watermark, and no detail', async () => {
    const { email, phone, practice } = await accountWithHistory();
    const { sequence: head, totals } = await serverTotals(phone);

    const tablet = device('tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();

    const store = tablet.vault.store();
    // Summaries only: the results without their detail, the practice session without its outcomes.
    expect((await store.readAcceptedRecords(testResult.name)).map((record) => record.payload)).toEqual([
      { version: 1, resultId: 'r-1', amount: '7' },
      { version: 1, resultId: 'r-2', amount: '-5/2' },
    ]);
    const [session] = await store.readAcceptedRecords('completed-practice-session');
    expect(session?.payload).toMatchObject({ activityId: practice.activityId, netResult: practice.netResult });
    expect(session?.payload).not.toHaveProperty('outcomes');
    // Each revisioned item's current accepted revision, the tombstone included.
    expect((await tablet.account.records.revisionedItems(testRevisionedItem.name)).map(({ item, accepted }) => ({ item, accepted }))).toEqual([
      { item: 'casino-1', accepted: { revision: 1, deleted: false, value: casinoValue('40'), conflict: null } },
      { item: 'casino-2', accepted: { revision: 2, deleted: true, value: null, conflict: null } },
    ]);
    // The lifetime totals match the server's at the watermark.
    expect((await tablet.account.records.totals()).account).toEqual(totals);
    // The feed starts at the watermark: nothing at or before it was fetched again.
    expect(feedRequests(tablet)).toEqual([head]);
    expect(await store.readFeedCursor()).toBe(head);
    expect(tablet.account.sync.status.history).toEqual({ state: 'complete' });
  });
});

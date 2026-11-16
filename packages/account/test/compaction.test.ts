// Seam 2: compaction and stale devices (#98; spec 2, *Compaction and stale
// devices*; #43's acceptance matrix, except its backup-restore rows, which
// Amendment 1 A4 makes design constraints; Amendments 1 A5 and C6, 4 §1).
// Old receipts and feed detail are pruned behind a progress marker and a
// reset boundary, and a device away for months refreshes and reconciles its
// unsynced work without losing, duplicating or resurrecting anything. Proven
// with seam 2's test-only types standing in for specs 4, 5 and 6. Time
// passing is the server's clock moved back on the account's rows (privileged
// SQL); faults are injected at the network, never inside the Account service.

import { afterEach, describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '../src';
import { type Command, prepareOperation } from '../src/sync/protocol';
import {
  type SimulatedDevice,
  type TestRevisionedValue,
  accessToken,
  createAccountByEmail,
  createDevice,
  directCommands,
  localStack,
  signInByEmail,
  testAllowanceReconciliation,
  testAllowanceTransfer,
  testContribution,
  testResult,
  testResultPurge,
  testRevisionedItem,
  testSharingEnable,
  testSharingWithdrawal,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
const { sql } = stack;

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** A phone that created an account and a tablet signed in to it. */
async function twoDevices() {
  const phone = device('phone');
  const tablet = device('tablet');
  const email = uniqueEmail('compaction');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);
  return { phone, tablet, email, accountId: accountOf(phone) };
}

function accountOf(d: SimulatedDevice): string {
  const gate = d.account.gate;
  if (gate.state !== 'active') throw new Error(`${d.name} is not signed in`);
  return gate.accountId;
}

const installationOf = (d: SimulatedDevice) => d.vault.store().identity.installationId;

/** Queues a record on a device and expects it queued. */
async function queue(d: SimulatedDevice, recordType: string, payload: unknown) {
  const result = await d.account.sync.queue(recordType, payload);
  if (result.status !== 'queued') throw new Error(`${recordType} was refused: ${result.reason}`);
  return result;
}

/** Syncs a device and waits for every run it started. */
async function synced(d: SimulatedDevice) {
  await d.account.sync.reconcile();
  await d.account.sync.idle();
}

/** The device sends its next upload; it reaches the account, but the answer is lost. */
async function answerLost(d: SimulatedDevice, send: () => Promise<unknown>) {
  d.proxy.dropNextResponse('sync_upload_v1');
  await send();
  await d.account.sync.idle();
  expect(d.account.sync.status.error).toBe('offline');
}

/**
 * Time passes for the account on the server: its feed entries committed, and
 * the installations named were last heard from, `days` earlier.
 */
async function away(accountId: string, days: number, installations: readonly string[] = []) {
  await sql`update private.sync_feed set committed_at = committed_at - make_interval(days => ${days}) where account_id = ${accountId}`;
  for (const installation of installations) {
    await sql`update private.command_scopes set seen_at = seen_at - make_interval(days => ${days})
      where account_id = ${accountId} and installation_id = ${installation}`;
  }
}

/** The compaction job, for one account. */
async function compact(accountId: string): Promise<boolean> {
  const [row] = await sql<{ compacted: boolean }[]>`select private.compact_account(${accountId}) as compacted`;
  return row!.compacted;
}

/** Months away: past the scope retention (180 days) and the feed retention (60 days). */
const MONTHS = 200;

const result = (id: string, amount = '1') => ({ version: 1, resultId: id, amount, detail: `detail of ${id}` });
const casino = (net: string): TestRevisionedValue => ({ game: 'blackjack', currency: 'USD', net });
const withdrawal = (id: string, scope = 'practice') => ({ version: 1, sharingWithdrawalId: id, scope });
const enable = (id: string, scope = 'practice') => ({ version: 1, sharingEnableId: id, scope });
const contribution = (id: string, scope = 'practice') => ({ version: 1, contributionId: id, scope });

const itemsOn = async (d: SimulatedDevice, recordType: string) => (await d.vault.store().readAcceptedRecords(recordType)).map((record) => record.item).sort();
const serverResults = async (accountId: string) =>
  (await sql<{ result_id: string }[]>`select result_id from private.test_results where account_id = ${accountId} order by result_id`).map((row) => row.result_id);
const receiptItems = async (accountId: string, installation: string) =>
  (await sql<{ item_id: string }[]>`select item_id from private.sync_receipts where account_id = ${accountId} and installation_id = ${installation} order by position`).map(
    (row) => row.item_id,
  );
const uploadsOf = (d: SimulatedDevice, item: string) =>
  d.proxy.sent.filter(({ url, body }) => url.includes('sync_upload_v1') && body !== null && (JSON.parse((JSON.parse(body) as { request: string }).request) as { item: string }).item === item)
    .length;
const statesOf = (d: SimulatedDevice) => d.account.sync.status.uploads.map(({ recordType, state }) => [recordType, state]);

describe('the progress marker', () => {
  it('covers only a contiguous range: receipts above it stay, gaps and all, and a settled or taken position is never a new command', async () => {
    const { phone, accountId } = await twoDevices();
    const raw = stack.rawClient(accessToken(phone));
    // The phone's own installation: the only one its session may upload as.
    const gap = installationOf(phone);
    const { generation } = await directCommands(raw, gap);
    const request = (operation: string, position: number, id = operation) =>
      prepareOperation({
        protocol: PROTOCOL_VERSION,
        operation: operation.repeat(32),
        installation: gap,
        command: { generation, position },
        recordType: testAllowanceReconciliation.name,
        payloadVersion: 1,
        item: `rec-${id}`,
        payload: { version: 1, reconciliationId: `rec-${id}`, grant: 'g' },
      }).request;
    const upload = async (text: string) => (await raw.rpc('sync_upload_v1', { request: text })).data as Record<string, unknown>;
    const settle = async (settled: number, at = generation) => (await raw.rpc('sync_scope_v1', { installation: gap, generation: at, settled })).data;
    const reconciled = async () =>
      (await sql<{ reconciliation_id: string }[]>`select reconciliation_id from private.test_reconciliations where account_id = ${accountId} order by 1`).map(
        (row) => row.reconciliation_id,
      );

    const [one, two, four] = [request('1', 1), request('2', 2), request('4', 4)];
    for (const text of [one, two, four]) expect(await upload(text)).toMatchObject({ status: 'accepted' });
    // Position 3 is still on its way: the installation has settled through 2 only.
    expect(await settle(2)).toEqual({ status: 'scope', generation, settled: 2 });
    expect(await compact(accountId)).toBe(true);
    expect(await receiptItems(accountId, gap)).toEqual(['rec-4']);

    // The receipt above the marker still answers its retry.
    expect(await upload(four)).toMatchObject({ status: 'accepted', operation: '4'.repeat(32) });
    // A settled command whose receipt is gone is refused, never taken for a new one: retried, or under another operation.
    expect(await upload(one)).toEqual({ status: 'stale-scope', reason: 'settled', operation: '1'.repeat(32) });
    expect(await upload(request('5', 1))).toMatchObject({ status: 'stale-scope', reason: 'settled' });
    // Nor is a position another command holds.
    expect(await upload(request('6', 4))).toMatchObject({ status: 'stale-scope', reason: 'reused' });
    // The gap fills in its own place, and the marker never falls.
    expect(await upload(request('3', 3))).toMatchObject({ status: 'accepted' });
    expect(await settle(1)).toEqual({ status: 'scope', generation, settled: 2 });
    expect(await reconciled()).toEqual(['rec-1', 'rec-2', 'rec-3', 'rec-4']);

    // A new generation for the installation: every earlier one's commands are refused, receipt or not.
    expect((await directCommands(raw, gap)).generation).toBe(generation + 1);
    expect(await upload(four)).toMatchObject({ status: 'stale-scope', reason: 'replaced' });
    expect(await settle(9)).toEqual({ status: 'stale-scope' });
    expect(await receiptItems(accountId, gap)).toEqual([]);
    expect(await reconciled()).toEqual(['rec-1', 'rec-2', 'rec-3', 'rec-4']);

    // Unheard from for months, the new one retires: its commands are refused too, and its receipts go.
    const next = { generation: generation + 1, position: 1 };
    const five = prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: '7'.repeat(32),
      installation: gap,
      command: next,
      recordType: testAllowanceReconciliation.name,
      payloadVersion: 1,
      item: 'rec-7',
      payload: { version: 1, reconciliationId: 'rec-7', grant: 'g' },
    }).request;
    expect(await upload(five)).toMatchObject({ status: 'accepted' });
    await away(accountId, MONTHS, [gap]);
    expect(await compact(accountId)).toBe(true);
    expect(await upload(five)).toMatchObject({ status: 'stale-scope', reason: 'retired' });
    expect(await receiptItems(accountId, gap)).toEqual([]);
  });

  it('rejects a generation never issued, or another account’s, a command with no scope at all, and another installation’s scope', async () => {
    const { phone } = await twoDevices();
    const raw = stack.rawClient(accessToken(phone));
    const other = device('other');
    expect(await createAccountByEmail(other, uniqueEmail('other'))).toEqual({ status: 'signed-in' });
    const theirs = await directCommands(stack.rawClient(accessToken(other)), installationOf(other));
    const request = (command: Command | null) => {
      const text = prepareOperation({
        protocol: PROTOCOL_VERSION,
        operation: 'a'.repeat(32),
        installation: installationOf(phone),
        command: command ?? { generation: 1, position: 1 },
        recordType: testAllowanceReconciliation.name,
        payloadVersion: 1,
        item: 'rec-1',
        payload: { version: 1, reconciliationId: 'rec-1', grant: 'g' },
      }).request;
      return command ? text : text.replace('"command":{"generation":1,"position":1},', '');
    };
    // The other account's generation names nothing in this one, where the phone has none yet.
    expect((await raw.rpc('sync_upload_v1', { request: request(theirs.next()) })).data).toMatchObject({ status: 'stale-scope', reason: 'replaced' });
    expect((await raw.rpc('sync_upload_v1', { request: request({ generation: 7, position: 1 }) })).data).toMatchObject({ status: 'stale-scope' });
    expect((await raw.rpc('sync_upload_v1', { request: request(null) })).data).toEqual({ status: 'malformed' });
    // A session asks only for its own installation's scope: never to renew another device's.
    const tablet = (await sql<{ installation_id: string }[]>`
      select installation_id from private.account_sessions where account_id = ${accountOf(phone)} and installation_id <> ${installationOf(phone)} limit 1`)[0]!;
    expect((await raw.rpc('sync_scope_v1', { installation: tablet.installation_id })).error).not.toBeNull();
  });

  it('is reported by a device after a clean run, and only those receipts go: one whose answer was lost stays and answers the retry', async () => {
    const { phone, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-1'));
    await synced(phone);
    await answerLost(phone, () => queue(phone, testResult.name, result('r-2')));
    expect(await compact(accountId)).toBe(true);
    expect(await receiptItems(accountId, installationOf(phone))).toEqual(['r-2']);

    await synced(phone);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(await serverResults(accountId)).toEqual(['r-1', 'r-2']);
    expect(await compact(accountId)).toBe(true);
    expect(await receiptItems(accountId, installationOf(phone))).toEqual([]);
  });

  it('leaves an account whose head is busy for the next run', async () => {
    const { accountId } = await twoDevices();
    await sql.begin(async (tx) => {
      await tx`select 1 from private.sync_heads where account_id = ${accountId} for update`;
      expect(await compact(accountId)).toBe(false);
    });
    expect(await compact(accountId)).toBe(true);
    const [job] = await sql<{ command: string }[]>`select command from cron.job where jobname = 'compact-sync'`;
    expect(job?.command).toBe('call private.compact_sync()');
  });
});

describe('the feed’s reset boundary', () => {
  it('sends a device behind it to a new snapshot, keeping its queue and its edits, removing what was purged meanwhile', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-1', '2'));
    await queue(phone, testResult.name, result('r-2', '3'));
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casino('10'));
    await synced(phone);
    await synced(tablet);
    expect(await itemsOn(tablet, testResult.name)).toEqual(['r-1', 'r-2']);

    // The tablet goes away. Meanwhile r-2 is deleted and the item edited; the tablet edits it too, and contributes.
    tablet.proxy.online = false;
    await queue(phone, testResultPurge.name, { version: 1, target: 'r-2' });
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casino('20'));
    await synced(phone);
    await tablet.account.records.save(testRevisionedItem.name, 'casino-1', casino('30'));
    await queue(tablet, testContribution.name, contribution('c-1'));
    await away(accountId, 61);
    expect(await compact(accountId)).toBe(true);
    const raw = stack.rawClient(accessToken(phone));
    const [head] = await sql<{ sequence: number; pruned: number }[]>`select sequence::int, pruned_through::int as pruned from private.sync_heads where account_id = ${accountId}`;
    expect(head!.pruned).toBe(head!.sequence);
    expect((await raw.rpc('sync_feed_v1', { after: 0 })).data).toEqual({ status: 'reset', through: head!.pruned });
    expect((await raw.rpc('sync_feed_v1', { after: head!.pruned })).data).toEqual({ entries: [], more: false });

    const before = tablet.proxy.sent.length;
    tablet.proxy.online = true;
    await synced(tablet);
    const calls = tablet.proxy.sent.slice(before).flatMap(({ url }) => (url.includes('sync_bootstrap_v1') ? ['snapshot'] : url.includes('sync_feed_v1') ? ['feed'] : []));
    expect(calls.slice(0, 2)).toEqual(['feed', 'snapshot']);

    // The purge reached the tablet through the snapshot, though its feed entry is gone, and never comes back.
    expect(await itemsOn(tablet, testResult.name)).toEqual(['r-1']);
    expect(await tablet.vault.store().readPurgedItems(testResult.name)).toEqual(['r-2']);
    // Its own edit and contribution were kept and uploaded: the edit, made from an old revision, is a proposal for review.
    expect(await tablet.vault.store().readUploadQueue()).toEqual([]);
    const [item] = await tablet.vault.store().readRevisionedItems(testRevisionedItem.name);
    expect(item?.accepted).toMatchObject({ revision: 2, value: casino('20'), conflict: { proposals: [{ kind: 'edit', value: casino('30') }] } });
    expect((await sql`select 1 from private.test_contributions where account_id = ${accountId} and contribution_id = 'c-1'`).length).toBe(1);
    expect((await tablet.account.records.totals()).account).toEqual((await phone.account.records.totals()).account);
  });
});

describe('a device away for months (#43)', () => {
  it('a never-uploaded record and an accepted-then-deleted one whose answer was lost: preserved, reconciled, neither resurrected nor duplicated', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-kept'));
    await synced(phone);
    await answerLost(phone, () => queue(phone, testResult.name, result('r-deleted')));
    phone.proxy.online = false;
    await queue(phone, testResult.name, result('r-offline'));
    const { generation } = await phone.vault.store().readCommandScope();
    // Meanwhile another device deletes one of them.
    await synced(tablet);
    await queue(tablet, testResultPurge.name, { version: 1, target: 'r-deleted' });
    await synced(tablet);
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    phone.proxy.online = true;
    await synced(phone);
    // Refreshed before anything new was sent: the snapshot came before the never-sent record's first upload.
    const order = phone.proxy.sent.flatMap(({ url, body }) =>
      url.includes('sync_bootstrap_v1') ? ['snapshot'] : url.includes('sync_upload_v1') && body?.includes('r-offline') ? ['r-offline'] : [],
    );
    expect(order.indexOf('snapshot')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('snapshot')).toBeLessThan(order.lastIndexOf('r-offline'));
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(await serverResults(accountId)).toEqual(['r-kept', 'r-offline']);
    expect(await itemsOn(phone, testResult.name)).toEqual(['r-kept', 'r-offline']);
    // Each counted once.
    expect((await phone.account.records.totals()).account).toEqual([{ total: 'practice', game: 'test', currency: 'simulated', records: 2, net: '2' }]);
    expect((await phone.vault.store().readCommandScope()).generation).toBeGreaterThan(generation!);
  });

  it('an accepted result whose answer was lost, not deleted since: sent anew and accepted once', async () => {
    const { phone, accountId } = await twoDevices();
    await answerLost(phone, () => queue(phone, testResult.name, result('r-1', '4')));
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    await synced(phone);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(await serverResults(accountId)).toEqual(['r-1']);
    expect((await phone.account.records.totals()).account).toEqual([{ total: 'practice', game: 'test', currency: 'simulated', records: 1, net: '4' }]);
    const [accepted] = await phone.vault.store().readAcceptedRecords(testResult.name);
    expect(accepted?.sequence).toBe(1);
  });

  it('an edit accepted but unacknowledged, then deleted elsewhere: goes to review and never restores the item, while other edits upload', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casino('10'));
    await phone.account.records.save(testRevisionedItem.name, 'casino-2', casino('5'));
    await synced(phone);
    await synced(tablet);
    await answerLost(phone, () => phone.account.records.save(testRevisionedItem.name, 'casino-1', casino('15')));
    phone.proxy.online = false;
    await phone.account.records.save(testRevisionedItem.name, 'casino-2', casino('6'));
    await synced(tablet);
    await tablet.account.records.delete(testRevisionedItem.name, 'casino-1');
    await synced(tablet);
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    phone.proxy.online = true;
    await synced(phone);
    expect(statesOf(phone)).toEqual([[testRevisionedItem.name, 'unconfirmed']]);
    await synced(tablet);
    const states = Object.fromEntries((await tablet.vault.store().readRevisionedItems(testRevisionedItem.name)).map(({ item, accepted }) => [item, accepted]));
    expect(states['casino-1']).toMatchObject({ deleted: true, conflict: null });
    expect(states['casino-2']).toMatchObject({ revision: 2, value: casino('6'), conflict: null });

    // The player sets it aside: kept with the refused records, never sent.
    const [review] = phone.account.sync.status.uploads;
    await phone.account.sync.decideUnconfirmed(review!.id, 'set-aside');
    await synced(phone);
    expect(await phone.vault.store().readRejectedUploads()).toEqual([expect.objectContaining({ id: review!.id, code: 'set-aside' })]);
    await synced(tablet);
    expect((await tablet.vault.store().readRevisionedItems(testRevisionedItem.name)).find(({ item }) => item === 'casino-1')?.accepted).toMatchObject({ deleted: true });
  });

  it('a sharing withdrawal retried after sharing was enabled again never withdraws the new period', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await answerLost(phone, () => queue(phone, testSharingWithdrawal.name, withdrawal('w-1')));
    await queue(tablet, testSharingEnable.name, enable('e-1'));
    await synced(tablet);
    await synced(phone);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    // The retry got the first receipt back: no second withdrawal.
    expect(await sql`select 1 from private.test_sharing_withdrawals where account_id = ${accountId}`).toHaveLength(0);
    await queue(tablet, testContribution.name, contribution('c-new'));
    await synced(tablet);
    expect(await sql`select 1 from private.test_contributions where account_id = ${accountId} and contribution_id = 'c-new'`).toHaveLength(1);
  });

  it('a withdrawal whose retired scope leaves it ambiguous goes to review, keeps blocking the contributions it covers, and is never silently sent or dropped', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await answerLost(phone, () => queue(phone, testSharingWithdrawal.name, withdrawal('w-1')));
    phone.proxy.online = false;
    await queue(phone, testContribution.name, contribution('c-held'));
    await queue(phone, testContribution.name, contribution('c-other', 'strategies'));
    await queue(tablet, testSharingEnable.name, enable('e-1'));
    await synced(tablet);
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    phone.proxy.online = true;
    await synced(phone);
    expect(statesOf(phone)).toEqual([
      [testSharingWithdrawal.name, 'unconfirmed'],
      [testContribution.name, 'waiting'],
    ]);
    expect(uploadsOf(phone, 'w-1')).toBe(2);
    expect(uploadsOf(phone, 'c-held')).toBe(0);
    await synced(phone);
    expect(uploadsOf(phone, 'w-1')).toBe(2);
    // The account's current choice stands: sharing is enabled, and the contribution it doesn't cover went up.
    expect(await sql`select 1 from private.test_sharing_withdrawals where account_id = ${accountId}`).toHaveLength(0);
    expect((await sql<{ contribution_id: string }[]>`select contribution_id from private.test_contributions where account_id = ${accountId}`).map((row) => row.contribution_id)).toEqual([
      'c-other',
    ]);

    // Reconciled against the current choice: set aside, and the contribution follows it.
    const [review] = phone.account.sync.status.uploads;
    await phone.account.sync.decideUnconfirmed(review!.id, 'set-aside');
    await synced(phone);
    expect(await sql`select 1 from private.test_contributions where account_id = ${accountId} and contribution_id = 'c-held'`).toHaveLength(1);
  });

  it('a withdrawal the account never saw keeps the account-wide withdrawal behavior, whatever the scope', async () => {
    const { phone, accountId } = await twoDevices();
    phone.proxy.online = false;
    await queue(phone, testSharingWithdrawal.name, withdrawal('w-unseen'));
    await queue(phone, testContribution.name, contribution('c-1'));
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    phone.proxy.online = true;
    await synced(phone);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect((await sql<{ sharing_withdrawal_id: string }[]>`select sharing_withdrawal_id from private.test_sharing_withdrawals where account_id = ${accountId}`).map((row) => row.sharing_withdrawal_id)).toEqual([
      'w-unseen',
    ]);
    expect(await phone.vault.store().readRejectedUploads()).toEqual([expect.objectContaining({ code: 'sharing-withdrawn' })]);
  });

  it('a transfer whose answer was lost stays frozen for review, never repeated, while late history uploads', async () => {
    const { phone, accountId } = await twoDevices();
    await queue(phone, testAllowanceReconciliation.name, { version: 1, reconciliationId: 'rec-1', grant: 'g-1' });
    await synced(phone);
    await answerLost(phone, () => queue(phone, testAllowanceTransfer.name, { version: 1, transferId: 't-1', grant: 'g-1' }));
    phone.proxy.online = false;
    await queue(phone, testResult.name, result('r-late'));
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    phone.proxy.online = true;
    await synced(phone);
    await synced(phone);
    expect(statesOf(phone)).toEqual([[testAllowanceTransfer.name, 'unconfirmed']]);
    // Sent once, before the device went away; never again.
    expect(uploadsOf(phone, 't-1')).toBe(1);
    expect(await sql`select 1 from private.test_transfers where account_id = ${accountId}`).toHaveLength(1);
    expect(await serverResults(accountId)).toEqual(['r-late']);
  });

  it('a revoked session stays revoked: refreshing asks to sign in again, keeping the queue, and signing in reconciles it', async () => {
    const phone = device('phone');
    const email = uniqueEmail('revoked');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await phone.account.sync.idle();
    const accountId = accountOf(phone);
    phone.proxy.online = false;
    await queue(phone, testResult.name, result('r-1'));
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);
    const token = accessToken(phone);
    const authUser = await stack.authUserId(email);
    await sql`delete from auth.sessions where user_id = ${authUser!} and id = ${sessionId(token)}`;

    phone.proxy.online = true;
    await synced(phone);
    expect(phone.account.sync.status).toMatchObject({ error: 'sign-in-required', uploads: [{ state: 'waiting' }] });
    // The revoked session can't refresh into a new scope either.
    expect((await stack.rawClient(token).rpc('sync_scope_v1', { installation: installationOf(phone) })).error).not.toBeNull();

    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await synced(phone);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(await serverResults(accountId)).toEqual(['r-1']);
  });

  it('a device that syncs without uploading keeps its scope authoritative', async () => {
    const { phone, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-1'));
    await synced(phone);
    await away(accountId, MONTHS, [installationOf(phone)]);
    // A new account session, reading the account: no upload, but the device is heard from.
    await phone.restart();
    await phone.account.sync.idle();
    expect(await compact(accountId)).toBe(true);
    const [scope] = await sql<{ retired: boolean }[]>`select retired from private.command_scopes where account_id = ${accountId} and installation_id = ${installationOf(phone)}`;
    expect(scope?.retired).toBe(false);
  });

  it('a stale sync position never expires offline play', async () => {
    const { phone, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-1'));
    await synced(phone);
    await away(accountId, MONTHS, [installationOf(phone)]);
    expect(await compact(accountId)).toBe(true);

    phone.proxy.online = false;
    const played = await phone.playPracticeSession();
    expect(phone.account.gate.state).toBe('active');
    phone.proxy.online = true;
    await synced(phone);
    expect(await itemsOn(phone, 'completed-practice-session')).toEqual([played.activityId]);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
  });
});

describe('retention (Amendment 1 C6) and protected controls (Amendment 1 A5)', () => {
  it('gives every account-keyed table a retention rule, and every exception its unresolved dependency and owner', async () => {
    const missing = await sql<{ subject: string }[]>`
      select c.table_schema || '.' || c.table_name as subject
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.column_name = 'account_id' and c.table_schema in ('public', 'private')
        and not exists (select 1 from private.retention_rules r where r.subject = c.table_schema || '.' || c.table_name)
      order by 1`;
    expect(missing).toEqual([]);
    const exceptions = await sql<{ subject: string; dependency: string | null; owner: string | null }[]>`
      select subject, dependency, owner from private.retention_rules where dependency is not null or owner is not null order by subject`;
    expect(exceptions.map(({ subject }) => subject)).toEqual([
      'private.account_sessions',
      'private.control_journal',
      'private.deleted_sessions',
      'private.deletions',
      'private.exports',
      'private.purged_results',
      'public.accounts',
    ]);
    for (const { dependency, owner } of exceptions) {
      expect(dependency).toMatch(/\S/);
      expect(owner).toMatch(/\S/);
    }
    // Nothing keeps current state on an elapsed age alone, and no rule names the research's 15-day ceiling as a deadline.
    expect(await sql`select 1 from private.retention_rules where endpoint ~* '15[- ]day'`).toHaveLength(0);
  });

  it('journals every acknowledged sensitive outcome as it commits, carrying no record body', async () => {
    const { phone, tablet, email, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-1'));
    await queue(phone, testSharingWithdrawal.name, withdrawal('w-1'));
    await synced(phone);
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });
    await phone.account.privacy.withdrawAnalytics();
    await synced(phone);
    await synced(tablet);
    await queue(tablet, testResultPurge.name, { version: 1, target: 'r-1' });
    await synced(tablet);
    const authUser = await stack.authUserId(email);
    await sql`delete from auth.sessions where user_id = ${authUser!} and id = ${sessionId(accessToken(tablet))}`;
    await sql`update public.accounts set state = 'deletion_scheduled', deletion_deadline = now() + interval '30 days', deletion_scheduled_at = now() where account_id = ${accountId}`;

    const journal = await sql<{ kind: string; subject: string; control: Record<string, unknown> }[]>`
      select kind, subject, control from private.control_journal where account_id = ${accountId} order by position`;
    const kinds = journal.map(
      ({ kind, subject }) =>
        `${kind} ${kind === 'record-control' || kind === 'purge' ? subject : kind === 'command-scope' ? 'installation' : kind === 'account-state' ? 'account' : 'session'}`,
    );
    // The withdrawal of consent, last of the privacy changes: what a restore must reapply.
    expect(journal.filter(({ subject }) => subject === 'privacy-choice/current').at(-1)?.control).toMatchObject({ consent: 'withdrawn', adDataOptOut: null });
    expect(kinds).toEqual(
      expect.arrayContaining([
        'command-scope installation',
        'record-control test-sharing-withdrawal/w-1',
        'record-control privacy-choice/current',
        'purge test-result/r-1',
        'session-revoked session',
        'account-state account',
      ]),
    );
    expect(kinds.indexOf('purge test-result/r-1')).toBeLessThan(kinds.indexOf('session-revoked session'));
    expect(kinds.at(-1)).toBe('account-state account');
    expect(journal.at(-1)?.control).toEqual({ state: 'deletion_scheduled', deadline: expect.any(String) });
    expect(JSON.stringify(journal)).not.toContain('detail of');
    await sql`update public.accounts set state = 'active', deletion_deadline = null, deletion_scheduled_at = null where account_id = ${accountId}`;
  });
});

/** The session ID an access token names. */
function sessionId(token: string): string {
  return (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { session_id: string }).session_id;
}

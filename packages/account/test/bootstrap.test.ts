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
  testAttempt,
  testExperimentAssignment,
  testResult,
  testResultPurge,
  testRevisionedItem,
  testStrategyRevision,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();

/**
 * The longest a heavy account's snapshot may hold its synchronization head.
 * Under the 5 s an upload waits for the head (`lock_timeout` in
 * sync_upload_v1), so a snapshot never times out another device's upload, and
 * under the API's 8 s statement timeout. 100,001 practice-session summaries
 * took about 2.2 s on the local stack (2026-11-14), and with 10,000 casino
 * sessions besides, about 2.5 s; the hosted project is qualified at launch gate 12.
 */
const LOCK_BUDGET_MS = 4_000;

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

const accountOf = (d: SimulatedDevice): string => {
  const gate = d.account.gate;
  if (gate.state !== 'active') throw new Error(`${d.name} is not signed in`);
  return gate.accountId;
};
const installationOf = (d: SimulatedDevice) => d.vault.store().identity.installationId;
const payloads = async (d: SimulatedDevice, recordType: string) => (await d.vault.store().readAcceptedRecords(recordType)).map((record) => record.payload);

/**
 * Accepts `count` test results for an account straight into the server's
 * rows, as that many uploads would have: the results, their feed entries
 * (with detail) and the head, in one transaction under the head. Each adds 1 to the practice total.
 */
async function seedResults(accountId: string, count: number, prefix = 'seeded') {
  await stack.sql.begin(async (tx) => {
    await tx`insert into private.sync_heads (account_id) values (${accountId}) on conflict do nothing`;
    const [head] = await tx<{ sequence: number }[]>`select sequence::int from private.sync_heads where account_id = ${accountId} for update`;
    await tx`insert into private.test_results (account_id, result_id, payload, sequence)
      select ${accountId}, ${prefix} || '-' || n, jsonb_build_object('version', 1, 'resultId', ${prefix} || '-' || n, 'amount', '1'), ${head!.sequence} + n
      from generate_series(1, ${count}) n`;
    await tx`insert into private.test_result_details (account_id, result_id, detail)
      select ${accountId}, ${prefix} || '-' || n, 'detail' from generate_series(1, ${count}) n`;
    await tx`insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
      select ${accountId}, ${head!.sequence} + n, 'test-result', ${prefix} || '-' || n,
             jsonb_build_object('record', jsonb_build_object('version', 1, 'resultId', ${prefix} || '-' || n, 'amount', '1', 'detail', 'detail'))
      from generate_series(1, ${count}) n`;
    await tx`update private.sync_heads set sequence = sequence + ${count} where account_id = ${accountId}`;
  });
}

/** Takes the device offline as it asks for its `page`th snapshot page (from 1), so that page and everything after it is lost. */
function offlineAtPage(d: SimulatedDevice, page: number) {
  let pages = 0;
  d.proxy.onRequest = (url) => {
    if (url.includes('sync_bootstrap_page_v1') && ++pages === page) d.proxy.online = false;
  };
}

/** The bootstrap calls a device sent from the `since`th request on. */
const bootstrapCalls = (d: SimulatedDevice, since = 0) =>
  d.proxy.sent.slice(since).flatMap(({ url, body }) =>
    url.includes('sync_bootstrap_page_v1') ? [`page after ${(JSON.parse(body ?? '{}') as { after: number }).after}`] : url.includes('sync_bootstrap_v1') ? ['snapshot'] : [],
  );

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

describe('a snapshot holds', () => {
  it('challenge attempts with their device positions, open proposals, each live strategy’s latest revision and server-authored state; never a purged result', async () => {
    const email = uniqueEmail('snapshot');
    const phone = device('phone');
    const laptop = device('laptop');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    expect(await signInByEmail(laptop, email)).toEqual({ status: 'signed-in' });
    await Promise.all([phone.account.sync.idle(), laptop.account.sync.idle()]);

    // Attempts (spec 3) keep their originating-device positions.
    await queue(phone, testAttempt.name, { version: 1, attemptId: 'a-1', passed: true, at: 1 });
    await queue(phone, testAttempt.name, { version: 1, attemptId: 'a-2', passed: false, at: 2 });
    // Two strategies, each with two revisions; one strategy is then deleted.
    for (const strategy of ['s-kept', 's-deleted']) {
      await phone.account.records.save(testRevisionedItem.name, strategy, casinoValue('0'));
      await queue(phone, testStrategyRevision.name, { version: 1, revisionId: `${strategy}-r1`, strategy, executable: 'one' });
      await queue(phone, testStrategyRevision.name, { version: 1, revisionId: `${strategy}-r2`, strategy, executable: 'two' });
    }
    await phone.account.sync.reconcile();
    await phone.account.records.delete(testRevisionedItem.name, 's-deleted');
    // An open conflict: the laptop edits an item from a revision the phone has moved on from.
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casinoValue('10'));
    await phone.account.sync.reconcile();
    await laptop.account.sync.reconcile();
    laptop.proxy.online = false;
    await laptop.account.records.save(testRevisionedItem.name, 'casino-1', casinoValue('-3'));
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casinoValue('20'));
    await phone.account.sync.reconcile();
    laptop.proxy.online = true;
    await laptop.account.sync.reconcile();
    // A purged result, and server-authored state.
    await queue(phone, testResult.name, result('r-gone', '9'));
    await phone.account.sync.reconcile();
    await queue(phone, testResultPurge.name, { version: 1, target: 'r-gone' });
    await stack.sql`select private.assign_test_experiment(${accountOf(phone)}, 'pricing', 'b')`;
    await phone.account.sync.reconcile();

    // A third code request for the address, beyond the two the limit admits at once.
    await stack.resetCodeRequests();
    const tablet = device('tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();

    expect((await tablet.vault.store().readAcceptedRecords(testAttempt.name)).map(({ item, origin }) => ({ item, origin }))).toEqual([
      { item: 'a-1', origin: { installation: installationOf(phone), position: 1 } },
      { item: 'a-2', origin: { installation: installationOf(phone), position: 2 } },
    ]);
    expect(await payloads(tablet, testStrategyRevision.name)).toEqual([{ version: 1, revisionId: 's-kept-r2', strategy: 's-kept', executable: 'two' }]);
    const casino = (await tablet.account.records.revisionedItems(testRevisionedItem.name)).find((view) => view.item === 'casino-1');
    expect(casino?.accepted).toMatchObject({ revision: 2, value: casinoValue('20') });
    expect(casino?.accepted?.conflict?.proposals).toEqual([{ id: expect.any(String), kind: 'edit', installation: installationOf(laptop), value: casinoValue('-3') }]);
    expect(await payloads(tablet, testExperimentAssignment.name)).toEqual([{ version: 1, experiment: 'pricing', group: 'b' }]);
    expect(await payloads(tablet, testResult.name)).toEqual([]);
    expect((await tablet.account.records.totals()).account).toEqual((await serverTotals(phone)).totals);
    // Three devices and a dozen runs: headroom for a stack that has just started.
  }, 60_000);
});

describe('paging a snapshot', () => {
  it('stages its pages locally; progress survives a kill, and the first download shows as unfinished with the account’s totals meanwhile', async () => {
    const email = uniqueEmail('paging');
    const phone = device('phone');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await phone.account.sync.idle();
    await seedResults(accountOf(phone), 250);
    const { sequence: head, totals } = await serverTotals(phone);
    expect(totals).toEqual([{ total: 'practice', game: 'test', currency: 'simulated', records: 250, net: '250' }]);

    const tablet = device('tablet');
    offlineAtPage(tablet, 2);
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();
    tablet.proxy.onRequest = null;

    // One page of 100 staged: nothing installed yet, and nothing of the feed fetched.
    expect(tablet.account.sync.status.history).toEqual({ state: 'incomplete', summaries: 0.4, detail: 0 });
    expect(await tablet.vault.store().readAcceptedRecords(testResult.name)).toEqual([]);
    expect(await tablet.vault.store().readFeedCursor()).toBe(0);
    expect((await tablet.account.records.totals()).account).toEqual(totals);

    // The app dies and starts again: it carries on from the staged page, with the same snapshot.
    await tablet.restart();
    expect(tablet.account.sync.status.history).toEqual({ state: 'incomplete', summaries: 0.4, detail: 0 });
    const before = tablet.proxy.sent.length;
    tablet.proxy.online = true;
    await tablet.account.sync.idle();

    expect(bootstrapCalls(tablet, before)).toEqual([
      'page after 100',
      'page after 200',
    ]);
    expect(await tablet.vault.store().readAcceptedRecords(testResult.name)).toHaveLength(250);
    expect(await tablet.vault.store().readFeedCursor()).toBe(head);
    expect(tablet.account.sync.status.history).toEqual({ state: 'complete' });
    expect((await tablet.account.records.totals()).account).toEqual(totals);
  });
});

describe('an expired snapshot', () => {
  it('lasts 24 hours; the device then gets a new one, keeping its queue, and the job clears the old one’s rows', async () => {
    const email = uniqueEmail('expiry');
    const phone = device('phone');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await phone.account.sync.idle();
    const accountId = accountOf(phone);
    await seedResults(accountId, 150);

    const tablet = device('tablet');
    offlineAtPage(tablet, 2);
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();
    tablet.proxy.onRequest = null;
    const [made] = await stack.sql<{ hours: number }[]>`
      select (extract(epoch from expires_at - created_at) / 3600)::int as hours from private.bootstrap_snapshots where account_id = ${accountId}`;
    expect(made?.hours).toBe(24);
    // Offline meanwhile, the tablet saves a result of its own.
    await queue(tablet, testResult.name, result('mine', '3'));

    // A day passes on the server, and the expiry job runs.
    await stack.sql`update private.bootstrap_snapshots set expires_at = now() - interval '1 second' where account_id = ${accountId}`;
    await stack.sql`select private.expire_bootstrap_snapshots()`;
    expect(await stack.sql`select 1 from private.bootstrap_rows where account_id = ${accountId}`).toHaveLength(0);

    const before = tablet.proxy.sent.length;
    tablet.proxy.online = true;
    await tablet.account.sync.idle();
    expect(bootstrapCalls(tablet, before)).toEqual(['page after 100', 'snapshot', 'page after 0', 'page after 100']);
    const items = (await tablet.vault.store().readAcceptedRecords(testResult.name)).map((record) => record.item);
    expect(items).toHaveLength(151);
    expect(items).toContain('mine');
    expect(await tablet.account.sync.countWaiting()).toBe(0);
    expect((await tablet.account.records.totals()).account).toEqual((await serverTotals(phone)).totals);
  });
});

describe('a bootstrap overlapping concurrent edits', () => {
  it('converges: later edits, deletions, new results, purges and resolutions arrive after the watermark, and the snapshot never keeps a purged or rejected payload', async () => {
    const email = uniqueEmail('overlap');
    const phone = device('phone');
    const laptop = device('laptop');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    expect(await signInByEmail(laptop, email)).toEqual({ status: 'signed-in' });
    await Promise.all([phone.account.sync.idle(), laptop.account.sync.idle()]);
    const accountId = accountOf(phone);
    // History: items to edit and delete, a result to purge, a conflict to resolve, and enough rows for two pages.
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casinoValue('10'));
    await phone.account.records.save(testRevisionedItem.name, 'casino-2', casinoValue('20'));
    await phone.account.records.save(testRevisionedItem.name, 'casino-c', casinoValue('30'));
    await queue(phone, testResult.name, result('r-purged', '4'));
    await phone.account.sync.reconcile();
    await laptop.account.sync.reconcile();
    laptop.proxy.online = false;
    await laptop.account.records.save(testRevisionedItem.name, 'casino-c', casinoValue('-778/3'));
    await phone.account.records.save(testRevisionedItem.name, 'casino-c', casinoValue('31'));
    await phone.account.sync.reconcile();
    laptop.proxy.online = true;
    await laptop.account.sync.reconcile();
    await phone.account.sync.reconcile();
    await seedResults(accountId, 150);
    const { sequence: watermark } = await serverTotals(phone);

    // The tablet's snapshot is made, and its first page staged.
    await stack.resetCodeRequests();
    const tablet = device('tablet');
    offlineAtPage(tablet, 2);
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();
    tablet.proxy.onRequest = null;

    // Meanwhile the phone carries on.
    await phone.account.records.save(testRevisionedItem.name, 'casino-1', casinoValue('11'));
    await phone.account.records.delete(testRevisionedItem.name, 'casino-2');
    await queue(phone, testResult.name, result('r-new', '6'));
    await queue(phone, testResultPurge.name, { version: 1, target: 'r-purged' });
    await phone.account.sync.reconcile();
    const conflict = (await phone.account.records.revisionedItems(testRevisionedItem.name)).find((view) => view.item === 'casino-c')!.accepted!.conflict!;
    expect(
      await phone.account.records.resolve(testRevisionedItem.name, 'casino-c', { generation: conflict.generation, reviewed: conflict.proposals.map((p) => p.id), value: casinoValue('32') }),
    ).toEqual({ status: 'resolved' });

    // The snapshot's rows redact what the feed redacted.
    const rows = JSON.stringify(await stack.sql`select change from private.bootstrap_rows where account_id = ${accountId}`);
    expect(rows).not.toContain('r-purged');
    expect(rows).not.toContain('-778/3');

    tablet.proxy.online = true;
    await tablet.account.sync.idle();
    const phoneItems = await phone.account.records.revisionedItems(testRevisionedItem.name);
    const tabletItems = await tablet.account.records.revisionedItems(testRevisionedItem.name);
    expect(tabletItems).toEqual(phoneItems);
    expect(tabletItems.find((view) => view.item === 'casino-c')?.accepted).toEqual({ revision: 3, deleted: false, value: casinoValue('32'), conflict: null });
    const results = (await tablet.vault.store().readAcceptedRecords(testResult.name)).map((record) => record.item);
    expect(results).toHaveLength(151);
    expect(results).toContain('r-new');
    expect(results).not.toContain('r-purged');
    // The feed continued after the watermark.
    expect(feedRequests(tablet)[0]).toBe(watermark);
    const server = await serverTotals(phone);
    expect((await tablet.account.records.totals()).account).toEqual(server.totals);
    expect(await tablet.vault.store().readFeedCursor()).toBe(server.sequence);
  });

  it('is made under the synchronization head: it waits for an acceptance holding the head, and its rows and totals include it at the matching watermark', async () => {
    const phone = device('phone');
    expect(await createAccountByEmail(phone, uniqueEmail('head'))).toEqual({ status: 'signed-in' });
    await phone.account.sync.idle();
    const accountId = accountOf(phone);
    await seedResults(accountId, 3, 'early');
    const raw = stack.rawClient(accessToken(phone));

    let snapshot: Promise<{ data: unknown }> | null = null;
    await stack.sql.begin(async (tx) => {
      // An acceptance in progress: it holds the head, and has written rows not yet committed.
      const [head] = await tx<{ sequence: number }[]>`select sequence::int from private.sync_heads where account_id = ${accountId} for update`;
      await tx`insert into private.test_results (account_id, result_id, payload, sequence)
        values (${accountId}, 'late', jsonb_build_object('version', 1, 'resultId', 'late', 'amount', '5'), ${head!.sequence + 1})`;
      await tx`insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
        values (${accountId}, ${head!.sequence + 1}, 'test-result', 'late', jsonb_build_object('record', jsonb_build_object('version', 1, 'resultId', 'late', 'amount', '5')))`;
      await tx`update private.sync_heads set sequence = sequence + 1 where account_id = ${accountId}`;
      snapshot = Promise.resolve(raw.rpc('sync_bootstrap_v1', { installation: 'head-test' }));
      // The snapshot can't be made while the head is held.
      expect(await Promise.race([snapshot.then(() => 'made'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 500))])).toBe('waiting');
    });
    const { data } = await snapshot!;
    const made = data as { snapshot: string; watermark: number; rows: number; totals: TotalsRow[] };
    expect(made).toMatchObject({ watermark: 4, rows: 4, totals: [{ total: 'practice', game: 'test', currency: 'simulated', records: 4, net: '8' }] });
    const page = await raw.rpc('sync_bootstrap_page_v1', { snapshot: made.snapshot, after: 0 });
    expect((page.data as { rows: { item: string; sequence: number }[] }).rows.map(({ item, sequence }) => [item, sequence])).toEqual([
      ['early-1', 1],
      ['early-2', 2],
      ['early-3', 3],
      ['late', 4],
    ]);
  });
});

describe('the snapshot’s lock', () => {
  it('is held briefly even for a heavy account (100,000 practice-session summaries and 10,000 casino sessions)', async () => {
    const phone = device('phone');
    expect(await createAccountByEmail(phone, uniqueEmail('heavy'))).toEqual({ status: 'signed-in' });
    const played = await phone.playPracticeSession();
    await phone.account.sync.idle();
    const accountId = accountOf(phone);
    // 100,000 more sessions like the one played, accepted straight into the server's rows. The
    // totals trigger is skipped while seeding (it would take minutes) and the totals written once.
    await stack.sql.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`insert into private.practice_results (account_id, result_id, payload, installation_id, operation_id, sequence)
        select account_id, 'heavy-' || n, payload || jsonb_build_object('activityId', 'heavy-' || n), installation_id, lpad(to_hex(n), 32, '0'), 1 + n
        from private.practice_results, generate_series(1, 100000) n where account_id = ${accountId}`;
      await tx`insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
        select ${accountId}, 1 + n, 'completed-practice-session', 'heavy-' || n, '{}'::jsonb from generate_series(1, 100000) n`;
      await tx`insert into private.revisioned_items (account_id, record_type, item_id, payload_version, revision, payload, revision_operation, revision_sequence)
        select ${accountId}, 'test-revisioned-item', 'casino-' || n, 1, 1, jsonb_build_object('game', 'blackjack', 'currency', 'USD', 'net', '1'),
               lpad(to_hex(200000 + n), 32, '0'), 100001 + n
        from generate_series(1, 10000) n`;
      await tx`insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
        select ${accountId}, 100001 + n, 'test-revisioned-item', 'casino-' || n, '{}'::jsonb from generate_series(1, 10000) n`;
      await tx`update private.sync_heads set sequence = 110001 where account_id = ${accountId}`;
      await tx`update private.account_totals set records = 100001, net = private.money_add('0', (${played.netResult}::numeric * 100001)::text)
        where account_id = ${accountId} and total = 'practice'`;
    });
    const raw = stack.rawClient(accessToken(phone));

    // The head is held from the snapshot's start to its commit: the call's whole server time, and less than this.
    const started = performance.now();
    const { data, error } = await raw.rpc('sync_bootstrap_v1', { installation: 'heavy-test' });
    const held = performance.now() - started;
    expect(error).toBeNull();
    expect(data).toMatchObject({ watermark: 110_001, rows: 110_001 });
    console.log(`snapshot of 100,001 practice sessions and 10,000 casino sessions: ${Math.round(held)} ms`);
    expect(held).toBeLessThan(LOCK_BUDGET_MS);
  }, 180_000);
});

describe('a raw client calling the bootstrap operations', () => {
  it('reaches only its own account’s snapshots, and nothing without an active account and session', async () => {
    const phone = device('phone');
    const other = device('other');
    expect(await createAccountByEmail(phone, uniqueEmail('owner'))).toEqual({ status: 'signed-in' });
    expect(await createAccountByEmail(other, uniqueEmail('intruder'))).toEqual({ status: 'signed-in' });
    await Promise.all([phone.account.sync.idle(), other.account.sync.idle()]);
    await queue(phone, testResult.name, result('r-1', '7'));
    await phone.account.sync.idle();
    const owner = stack.rawClient(accessToken(phone));
    const { data } = await owner.rpc('sync_bootstrap_v1', { installation: 'raw-owner' });
    const { snapshot } = data as { snapshot: string };

    // Another account's session can't read it, or even tell it exists.
    expect((await stack.rawClient(accessToken(other)).rpc('sync_bootstrap_page_v1', { snapshot, after: 0 })).data).toEqual({ status: 'expired' });
    // No session at all.
    expect((await stack.rawClient().rpc('sync_bootstrap_v1', { installation: 'raw-anon' })).error).not.toBeNull();
    expect((await stack.rawClient().rpc('sync_bootstrap_page_v1', { snapshot, after: 0 })).error).not.toBeNull();
    // An account whose deletion is scheduled: ordinary access is closed.
    await stack.sql`update public.accounts set state = 'deletion_scheduled' where account_id = ${accountOf(phone)}`;
    expect((await owner.rpc('sync_bootstrap_page_v1', { snapshot, after: 0 })).error).not.toBeNull();
    expect((await owner.rpc('sync_bootstrap_v1', { installation: 'raw-owner' })).error).not.toBeNull();
    await stack.sql`update public.accounts set state = 'active' where account_id = ${accountOf(phone)}`;
    // A revoked session, its access token unexpired.
    const revoked = stack.rawClient(accessToken(phone));
    expect((await revoked.rpc('sync_bootstrap_page_v1', { snapshot, after: 0 })).data).toMatchObject({ status: 'page' });
    await phone.account.signOut();
    expect((await revoked.rpc('sync_bootstrap_page_v1', { snapshot, after: 0 })).error).not.toBeNull();
    expect((await revoked.rpc('sync_bootstrap_v1', { installation: 'raw-owner' })).error).not.toBeNull();
  });
});

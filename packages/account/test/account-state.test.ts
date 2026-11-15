// Seam 2 (#95): the record-type registry's remaining kinds, proven with
// test-only record types standing in for later specs' (src/testing/record-types.ts):
// barrier-bearing account-state operations and the reconnect order,
// server-authored state, purging an accepted immutable result, and
// per-device attempt ordering. Faults are injected at the network, the app
// process and the server's state, never inside the Account service.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { type AcceptedRecord, PLATFORM_TABLES, PROTOCOL_VERSION, byOriginatingDevice } from '../src';
import { type Envelope, prepareOperation } from '../src/sync/protocol';
import {
  type SimulatedDevice,
  TEST_RECORD_TYPES,
  type TestAttempt,
  accessTokenOf,
  createAccountByEmail,
  createDevice,
  installTestRecordTypes,
  localStack,
  signInByEmail,
  testAllowanceReconciliation,
  testAllowanceTransfer,
  testAttempt,
  testContribution,
  testExperimentAssignment,
  testRegistry,
  testResult,
  testResultPurge,
  testSharingWithdrawal,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
beforeAll(() => installTestRecordTypes(stack));

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name, registry: testRegistry });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** A phone that created an account and a tablet signed in to it. */
async function twoDevices() {
  const phone = device('phone');
  const tablet = device('tablet');
  const email = uniqueEmail('state');
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

/** Queues a record on a device and expects it queued. */
async function queue(d: SimulatedDevice, recordType: string, payload: unknown) {
  const result = await d.account.sync.queue(recordType, payload);
  if (result.status !== 'queued') throw new Error(`${recordType} was refused: ${result.reason}`);
  return result;
}

/** The server's receipts for an account, by item: what it decided for each upload. */
async function receipts(accountId: string) {
  const rows = await stack.sql<{ item_id: string; record_type: string; disposition: { status: string; sequence?: number; code?: string } }[]>`
    select item_id, record_type, disposition from private.sync_receipts where account_id = ${accountId} order by received_at, operation_id`;
  return rows.map((row) => ({ item: row.item_id, recordType: row.record_type, ...row.disposition }));
}

const itemsOn = async (d: SimulatedDevice, recordType: string) => (await d.vault.store().readAcceptedRecords(recordType)).map((record) => record.item);

/** The record types of the uploads a device sent, in order, from the request bodies. */
function uploadsSent(d: SimulatedDevice): string[] {
  return d.proxy.sent
    .filter((request) => request.url.includes('sync_upload_v1') && request.body)
    .map((request) => (JSON.parse(JSON.parse(request.body!).request as string) as { recordType: string }).recordType);
}

/** Every request a device sent from the `since`th on, as "upload <record type>" or "feed". */
function requestsSent(d: SimulatedDevice, since = 0): string[] {
  return d.proxy.sent
    .slice(since)
    .filter((request) => request.url.includes('sync_upload_v1') || request.url.includes('sync_feed_v1'))
    .map((request) =>
      request.url.includes('sync_feed_v1')
        ? 'feed'
        : `upload ${(JSON.parse(JSON.parse(request.body!).request as string) as { recordType: string }).recordType}`,
    );
}

const withdrawal = (scope: string, id = `w-${scope}`) => ({ version: 1, withdrawalId: id, scope });
const contribution = (scope: string, id = `c-${scope}`) => ({ version: 1, contributionId: id, scope });

describe('account-state operations behind barriers', () => {
  it('holds a contribution while a withdrawal of its scope is unacknowledged, then sends it after, serialized under the head', async () => {
    const { phone, accountId } = await twoDevices();
    phone.proxy.online = false;
    await queue(phone, testSharingWithdrawal.name, withdrawal('practice'));
    await queue(phone, testContribution.name, contribution('practice'));
    await phone.account.sync.idle();

    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    phone.proxy.online = true;
    await held.arrived;
    // The withdrawal is accepted on the server, its answer is still on the way: the contribution hasn't been sent.
    expect((await receipts(accountId)).map(({ item, status }) => [item, status])).toEqual([['w-practice', 'accepted']]);
    held.release();
    await phone.account.sync.idle();

    // The contribution reached the server after the withdrawal, which its acceptance (spec 6's stand-in rule) saw.
    expect((await receipts(accountId)).map(({ item, status, code }) => [item, status, code])).toEqual([
      ['w-practice', 'accepted', undefined],
      ['c-practice', 'rejected', 'sharing-withdrawn'],
    ]);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
  });

  it('holds only the contributions a withdrawal covers', async () => {
    const { phone, accountId } = await twoDevices();
    phone.proxy.online = false;
    await queue(phone, testContribution.name, contribution('practice'));
    await queue(phone, testSharingWithdrawal.name, withdrawal('strategies'));
    await queue(phone, testContribution.name, contribution('strategies'));
    phone.proxy.online = true;
    await phone.account.sync.idle();

    const decided = Object.fromEntries((await receipts(accountId)).map(({ item, status, code, sequence }) => [item, { status, code, sequence }]));
    expect(decided['c-practice']).toMatchObject({ status: 'accepted' });
    expect(decided['c-strategies']).toMatchObject({ status: 'rejected', code: 'sharing-withdrawn' });
    // Withdrawals go first in the reconnect order, whatever their place in the queue.
    expect(uploadsSent(phone)).toEqual([testSharingWithdrawal.name, testContribution.name, testContribution.name]);
  });

  it('holds a transfer until its grant’s allowance reconciliation is acknowledged', async () => {
    const { phone, accountId } = await twoDevices();
    phone.proxy.online = false;
    await queue(phone, testAllowanceTransfer.name, { version: 1, transferId: 't-1', grant: 'grant-1' });
    await queue(phone, testAllowanceReconciliation.name, { version: 1, reconciliationId: 'r-1', grant: 'grant-1' });

    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    phone.proxy.online = true;
    await held.arrived;
    expect((await receipts(accountId)).map(({ item }) => item)).toEqual(['r-1']);
    held.release();
    await phone.account.sync.idle();

    const [reconciled, transferred] = await receipts(accountId);
    expect(reconciled).toMatchObject({ item: 'r-1', status: 'accepted' });
    expect(transferred).toMatchObject({ item: 't-1', status: 'accepted' });
    expect(transferred!.sequence).toBeGreaterThan(reconciled!.sequence!);
  });

  it('keeps an uncertain withdrawal pending, and what it holds restricted, across a restart until its receipt arrives', async () => {
    const { phone, accountId } = await twoDevices();
    phone.proxy.online = false;
    await queue(phone, testSharingWithdrawal.name, withdrawal('practice'));
    await queue(phone, testContribution.name, contribution('practice'));

    // The server accepts the withdrawal, and its answer is lost.
    phone.proxy.dropNextResponse('sync_upload_v1');
    phone.proxy.online = true;
    await phone.account.sync.idle();
    expect(phone.account.sync.status.error).toBe('offline');
    expect((await phone.vault.store().readUploadQueue()).map((entry) => entry.recordType)).toEqual([testSharingWithdrawal.name, testContribution.name]);
    expect((await receipts(accountId)).map(({ item }) => item)).toEqual(['w-practice']);

    phone.proxy.online = false;
    await phone.restart();
    await phone.account.sync.idle();
    expect((await phone.vault.store().readUploadQueue()).map((entry) => entry.recordType)).toEqual([testSharingWithdrawal.name, testContribution.name]);

    phone.proxy.online = true;
    await phone.account.sync.idle();
    expect((await receipts(accountId)).map(({ item, status }) => [item, status])).toEqual([
      ['w-practice', 'accepted'],
      ['c-practice', 'rejected'],
    ]);
  });
});

describe('the reconnect order', () => {
  it('uploads and reads the account’s state before sending contributions: a withdrawal from another device is seen first', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    phone.proxy.online = false;
    await phone.playPracticeSession();
    await queue(phone, testContribution.name, contribution('practice'));

    await queue(tablet, testSharingWithdrawal.name, withdrawal('practice', 'w-tablet'));
    await tablet.account.sync.idle();

    const before = phone.proxy.sent.length;
    phone.proxy.online = true;
    await phone.account.sync.idle();
    const order = requestsSent(phone, before);
    expect(order.indexOf('upload completed-practice-session')).toBeLessThan(order.indexOf('feed'));
    expect(order.indexOf('feed')).toBeLessThan(order.indexOf(`upload ${testContribution.name}`));
    // The phone read the tablet's withdrawal before contributing; the server refused the contribution against it.
    expect(await itemsOn(phone, testSharingWithdrawal.name)).toEqual(['w-tablet']);
    expect((await receipts(accountId)).find(({ item }) => item === 'c-practice')).toMatchObject({ status: 'rejected', code: 'sharing-withdrawn' });
  });

  it('sends nothing with a barrier while the account’s access can’t be reconciled', async () => {
    const { phone, accountId } = await twoDevices();
    await stack.sql`update public.accounts set state = 'deletion_scheduled' where account_id = ${accountId}`;
    try {
      await queue(phone, testContribution.name, contribution('practice'));
      await phone.account.sync.idle();
      expect(await receipts(accountId)).toEqual([]);
      expect(uploadsSent(phone)).toEqual([]);
    } finally {
      await stack.sql`update public.accounts set state = 'active' where account_id = ${accountId}`;
    }
    await phone.account.sync.reconcile();
    expect(await receipts(accountId)).toMatchObject([{ item: 'c-practice', status: 'accepted' }]);
  });
});

describe('server-authored state', () => {
  it('is written by the backend and delivered to every device through the feed, replacing the earlier state', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await stack.sql`select private.assign_test_experiment(${accountId}, 'pricing', 'b')`;
    await stack.sql`select private.assign_test_experiment(${accountId}, 'pricing', 'c')`;

    for (const d of [phone, tablet]) {
      await d.account.sync.reconcile();
      expect(await d.vault.store().readAcceptedRecords(testExperimentAssignment.name)).toEqual([
        { recordType: testExperimentAssignment.name, item: 'pricing', sequence: 2, payload: { version: 1, experiment: 'pricing', group: 'c' } },
      ]);
    }
  });

  it('is never written by a client: the app refuses to queue it and the server refuses an upload of it', async () => {
    const { phone, accountId } = await twoDevices();
    const assignment = { version: 1, experiment: 'pricing', group: 'self-assigned' };
    expect(await phone.account.sync.queue(testExperimentAssignment.name, assignment)).toEqual({ status: 'refused', reason: 'server-authored' });

    const raw = stack.rawClient(accessTokenOf(phone));
    const { request } = prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: '5'.repeat(32),
      installation: phone.vault.store().identity.installationId,
      recordType: testExperimentAssignment.name,
      payloadVersion: 1,
      item: 'pricing',
      payload: assignment,
    });
    expect((await raw.rpc('sync_upload_v1', { request })).data).toMatchObject({ status: 'rejected', code: 'server-authored' });
    // The backend's own writer isn't reachable through the API.
    expect((await raw.rpc('author_server_state', { p_account: accountId, p_record_type: testExperimentAssignment.name, p_item: 'pricing', p_change: {} })).error).not.toBeNull();
    expect((await raw.schema('private').rpc('author_server_state', { p_account: accountId, p_record_type: testExperimentAssignment.name, p_item: 'pricing', p_change: {} })).error).not.toBeNull();
    expect(((await raw.rpc('sync_feed_v1', { after: 0 })).data as { entries: unknown[] }).entries).toEqual([]);
    expect(await stack.sql`select 1 from private.test_experiment_assignments where account_id = ${accountId}`).toHaveLength(0);
  });
});

describe('purging an accepted immutable result', () => {
  const result = (id: string, amount: number) => ({ version: 1, resultId: id, amount, detail: `detail of ${id}: private-${id}-marker` });

  /** Every account-owned server row that mentions `text`, by table. */
  async function rowsMentioning(accountId: string, text: string) {
    const tables = [...new Set([...PLATFORM_TABLES, ...TEST_RECORD_TYPES.flatMap((type) => type.deletion.serverTables)])];
    const found: string[] = [];
    for (const table of tables) {
      const [rows] = await stack.sql.unsafe<{ count: number }[]>(`select count(*)::int as count from ${table} t where t.account_id = $1 and t::text like $2`, [
        accountId,
        `%${text}%`,
      ]);
      if (rows!.count > 0) found.push(table);
    }
    return found;
  }

  it('removes it from every device through the feed, with its contribution, keeping only its identity and receipt', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    await queue(phone, testResult.name, result('r-1', 7));
    await queue(phone, testResult.name, result('r-2', 5));
    await phone.account.sync.idle();
    await tablet.account.sync.reconcile();
    expect(await itemsOn(tablet, testResult.name)).toEqual(['r-1', 'r-2']);
    expect(await stack.sql`select total::int from private.test_totals where account_id = ${accountId}`).toEqual([{ total: 12 }]);

    await queue(tablet, testResultPurge.name, { version: 1, target: 'r-1' });
    // Gone from the purging device at once.
    expect(await itemsOn(tablet, testResult.name)).toEqual(['r-2']);
    await tablet.account.sync.idle();
    await phone.account.sync.reconcile();
    expect(await itemsOn(phone, testResult.name)).toEqual(['r-2']);

    // Its contribution is gone, and nothing of it but its identity remains on the server.
    expect(await stack.sql`select total::int from private.test_totals where account_id = ${accountId}`).toEqual([{ total: 5 }]);
    expect(await rowsMentioning(accountId, 'private-r-1-marker')).toEqual([]);
    expect(await rowsMentioning(accountId, 'private-r-2-marker')).not.toEqual([]);
    expect(await stack.sql`select record_type, item_id from private.purged_results where account_id = ${accountId}`).toEqual([
      { record_type: testResult.name, item_id: 'r-1' },
    ]);

    // A device reading the feed from the start afterwards never sees it: its entry keeps its place with nothing in it.
    const feed = (await stack.rawClient(accessTokenOf(phone)).rpc('sync_feed_v1', { after: 0 })).data as { entries: { item: string; change: unknown }[] };
    expect(feed.entries.map(({ item, change }) => [item, change === null])).toEqual([
      ['r-1', true],
      ['r-2', false],
      ['r-1', false],
    ]);
    expect(JSON.stringify(feed)).not.toContain('private-r-1-marker');
  });

  it('never brings it back: not by a retried upload, a new upload of it or a stale device', async () => {
    const { phone, tablet, accountId } = await twoDevices();
    // The phone's answer for r-1 is lost; meanwhile the tablet purges it.
    phone.proxy.dropNextResponse('sync_upload_v1');
    await queue(phone, testResult.name, result('r-1', 7));
    await phone.account.sync.idle();
    const [stale] = await phone.vault.store().readUploadQueue();
    await tablet.account.sync.reconcile();
    await queue(tablet, testResultPurge.name, { version: 1, target: 'r-1' });
    await tablet.account.sync.idle();

    // The retry gets its receipt back, and the feed still takes the result away.
    await phone.account.sync.reconcile();
    await phone.account.sync.reconcile();
    expect(await itemsOn(phone, testResult.name)).toEqual([]);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);

    const raw = stack.rawClient(accessTokenOf(phone));
    const again = JSON.parse(stale!.operation!.request) as Envelope;
    const { request } = prepareOperation({ ...again, operation: '6'.repeat(32) });
    expect((await raw.rpc('sync_upload_v1', { request })).data).toMatchObject({ status: 'rejected', code: 'purged' });
    await tablet.account.sync.reconcile();
    expect(await itemsOn(tablet, testResult.name)).toEqual([]);
    expect(await stack.sql`select 1 from private.test_results where account_id = ${accountId}`).toHaveLength(0);
  });

  it('waits for its target’s acceptance', async () => {
    const { phone, accountId } = await twoDevices();
    phone.proxy.online = false;
    await queue(phone, testResult.name, result('r-1', 7));
    await queue(phone, testResultPurge.name, { version: 1, target: 'r-1' });
    expect(await itemsOn(phone, testResult.name)).toEqual([]);

    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    phone.proxy.online = true;
    await held.arrived;
    expect((await receipts(accountId)).map(({ recordType }) => recordType)).toEqual([testResult.name]);
    held.release();
    await phone.account.sync.idle();
    expect((await receipts(accountId)).map(({ recordType, status }) => [recordType, status])).toEqual([
      [testResult.name, 'accepted'],
      [testResultPurge.name, 'accepted'],
    ]);
    // Accepted, then purged: not on the device, and not counted.
    expect(await itemsOn(phone, testResult.name)).toEqual([]);
    expect(await stack.sql`select total::int from private.test_totals where account_id = ${accountId}`).toEqual([{ total: 0 }]);
  });
});

describe('the operation API enforces ordering, called directly', () => {
  interface UploadFields {
    operation: string;
    recordType: string;
    item: string;
    payload: unknown;
    after?: string[];
    position?: number;
  }
  /** A canonical request from the device, as its build would send it. */
  function upload(d: SimulatedDevice, fields: UploadFields) {
    return prepareOperation({
      protocol: PROTOCOL_VERSION,
      installation: d.vault.store().identity.installationId,
      payloadVersion: 1,
      ...fields,
    }).request;
  }

  it('answers "waiting", recording nothing, until every operation it names has a receipt; then accepts the identical request', async () => {
    const { phone } = await twoDevices();
    const raw = stack.rawClient(accessTokenOf(phone));
    const dependent = upload(phone, {
      operation: '7'.repeat(32),
      recordType: testContribution.name,
      item: 'c-practice',
      payload: contribution('practice'),
      after: ['8'.repeat(32)],
    });
    expect((await raw.rpc('sync_upload_v1', { request: dependent })).data).toEqual({ status: 'waiting', operation: '7'.repeat(32) });
    expect(((await raw.rpc('sync_feed_v1', { after: 0 })).data as { entries: unknown[] }).entries).toEqual([]);

    const barrier = upload(phone, { operation: '8'.repeat(32), recordType: testSharingWithdrawal.name, item: 'w-other', payload: withdrawal('other', 'w-other') });
    expect((await raw.rpc('sync_upload_v1', { request: barrier })).data).toMatchObject({ status: 'accepted', sequence: 1 });
    expect((await raw.rpc('sync_upload_v1', { request: dependent })).data).toMatchObject({ status: 'accepted', sequence: 2 });
  });

  it('refuses a purge whose target was never accepted', async () => {
    const { phone } = await twoDevices();
    const raw = stack.rawClient(accessTokenOf(phone));
    const purge = upload(phone, { operation: '9'.repeat(32), recordType: testResultPurge.name, item: 'r-unknown', payload: { version: 1, target: 'r-unknown' } });
    expect((await raw.rpc('sync_upload_v1', { request: purge })).data).toMatchObject({ status: 'rejected', code: 'target-not-accepted' });
  });

  it('holds each per-device position for one record, and positions only per-device types', async () => {
    const { phone } = await twoDevices();
    const raw = stack.rawClient(accessTokenOf(phone));
    const attempt = (id: string, position?: number) => ({
      recordType: testAttempt.name,
      item: id,
      payload: { version: 1, attemptId: id, passed: true, at: 0 },
      ...(position !== undefined ? { position } : {}),
    });
    const send = async (operation: string, fields: Omit<UploadFields, 'operation'>) =>
      (await raw.rpc('sync_upload_v1', { request: upload(phone, { operation: operation.repeat(32), ...fields }) })).data;

    expect(await send('a', attempt('a-1', 1))).toMatchObject({ status: 'accepted' });
    expect(await send('b', attempt('a-2', 1))).toMatchObject({ status: 'rejected', code: 'position-reused' });
    expect(await send('c', attempt('a-1', 2))).toMatchObject({ status: 'rejected', code: 'position-reused' });
    expect(await send('d', attempt('a-3'))).toMatchObject({ status: 'rejected', code: 'position-required' });
    expect(await send('e', { recordType: testResult.name, item: 'r-1', payload: result('r-1'), position: 1 })).toMatchObject({
      status: 'rejected',
      code: 'position-unexpected',
    });
    // The same record at its own position, under another operation, is the one acceptance.
    expect(await send('f', attempt('a-1', 1))).toMatchObject({ status: 'accepted', sequence: 1 });
  });

  const result = (id: string) => ({ version: 1, resultId: id, amount: 1, detail: 'd' });
});

describe('per-device attempt ordering', () => {
  /** Spec 3's rule, stood in: a milestone for `length` consecutive passing attempts on one installation. */
  function milestone(records: readonly AcceptedRecord[], length: number): boolean {
    return byOriginatingDevice(records).some((sequence) =>
      sequence.runs.some((run) => {
        let streak = 0;
        return run.some((record) => (streak = (record.payload as TestAttempt).passed ? streak + 1 : 0) >= length);
      }),
    );
  }
  const attempt = (d: SimulatedDevice, id: string, passed = true): TestAttempt => ({ version: 1, attemptId: id, passed, at: d.clock.now() });
  const attemptsOn = (d: SimulatedDevice) => d.vault.store().readAcceptedRecords(testAttempt.name);

  it('gives each attempt a durable position on its own installation, whatever the clock, and never stitches devices together', async () => {
    const { phone, tablet } = await twoDevices();
    expect(await queue(phone, testAttempt.name, attempt(phone, 'p-1'))).toMatchObject({ position: 1 });
    phone.clock.advance(-3_600_000);
    expect(await queue(phone, testAttempt.name, attempt(phone, 'p-2'))).toMatchObject({ position: 2 });
    await phone.restart();
    expect(await queue(phone, testAttempt.name, attempt(phone, 'p-3'))).toMatchObject({ position: 3 });
    expect(await queue(tablet, testAttempt.name, attempt(tablet, 't-1'))).toMatchObject({ position: 1 });
    await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);

    await tablet.account.sync.reconcile();
    const sequences = byOriginatingDevice(await attemptsOn(tablet));
    expect(sequences.map(({ installation, runs }) => [installation, runs.map((run) => run.map((record) => record.item))])).toEqual(
      [
        [phone.vault.store().identity.installationId, [['p-1', 'p-2', 'p-3']]],
        [tablet.vault.store().identity.installationId, [['t-1']]],
      ].sort(([a], [b]) => String(a).localeCompare(String(b))),
    );
    // Three on one device and one on another: four passes, but no four-in-a-row.
    expect(milestone(await attemptsOn(tablet), 4)).toBe(false);
    expect(milestone(await attemptsOn(tablet), 3)).toBe(true);
  });

  it('fills a late upload into its original position, and grants no milestone across the missing attempt until it arrives', async () => {
    const { phone, tablet } = await twoDevices();
    phone.proxy.online = false;
    for (const id of ['p-1', 'p-2', 'p-3']) await queue(phone, testAttempt.name, attempt(phone, id));
    // Positions 1 and 3 reach the account first (as another build's or a retried path might send them).
    const raw = stack.rawClient(accessTokenOf(phone));
    for (const [index, entry] of (await phone.vault.store().readUploadQueue()).entries()) {
      if (index === 1) continue;
      const { request } = prepareOperation({
        protocol: PROTOCOL_VERSION,
        operation: String(index).repeat(32),
        installation: phone.vault.store().identity.installationId,
        recordType: testAttempt.name,
        payloadVersion: 1,
        item: (entry.payload as TestAttempt).attemptId,
        payload: entry.payload,
        position: entry.position!,
      });
      expect((await raw.rpc('sync_upload_v1', { request })).data).toMatchObject({ status: 'accepted' });
    }

    await tablet.account.sync.reconcile();
    const [early] = byOriginatingDevice(await attemptsOn(tablet));
    expect(early?.positions.map((record) => record?.item ?? null)).toEqual(['p-1', null, 'p-3']);
    expect(milestone(await attemptsOn(tablet), 2)).toBe(false);

    phone.proxy.online = true;
    await phone.account.sync.idle();
    await tablet.account.sync.reconcile();
    const records = await attemptsOn(tablet);
    // Arrival order was 1, 3, 2; the positions are 1, 2, 3.
    expect(records.map((record) => record.item)).toEqual(['p-1', 'p-3', 'p-2']);
    expect(byOriginatingDevice(records)[0]?.runs.map((run) => run.map((record) => record.item))).toEqual([['p-1', 'p-2', 'p-3']]);
    expect(milestone(records, 3)).toBe(true);
  });
});

describe('the registry’s test-only types', () => {
  it('are registered on the server with the same kind, acceptance, ordering and purge hook, and covered by deletion', async () => {
    for (const type of TEST_RECORD_TYPES) {
      const [row] = await stack.sql<{ kind: string; accept: string | null; ordering: string; purgeable: boolean }[]>`
        select kind, accept::regproc::text as accept, ordering, purge is not null as purgeable from private.record_types
        where record_type = ${type.name} and payload_version = ${type.payloadVersion}`;
      expect(row, type.name).toEqual({
        kind: type.kind,
        accept: type.acceptance,
        ordering: type.ordering ?? 'account',
        purgeable: type === testResult,
      });
      for (const table of [...type.deletion.serverTables, ...PLATFORM_TABLES]) {
        const [schema, name] = table.split('.');
        const columns = await stack.sql`select 1 from information_schema.columns where table_schema = ${schema!} and table_name = ${name!} and column_name = 'account_id'`;
        expect(columns, table).toHaveLength(1);
      }
    }
  });
});

// Seam 2: operational metrics and the privacy boundary (#108; spec 2,
// *Observability and privacy boundaries*, Amendment 1 C4, gate 11). Real
// devices on the local stack report their sync health through the metrics
// port, and the backend's snapshot measures receipts, staging, storage and
// email; neither carries a record body, token, email code, age data, clock
// anchor, address, account or casino session. Faults come from the network
// (the fault proxy) and the data (a competing upload), never from inside the
// Account service.

import { afterEach, describe, expect, it } from 'vitest';

import { EMAIL_TYPES, type MetricEvent, metricEmailType, type OperationalSnapshot, PROTOCOL_VERSION, TEEN_METRICS, completedPracticeSession, serverMetricEvents } from '../src';
import { prepareOperation } from '../src/sync/protocol';
import {
  type SimulatedDevice,
  accessToken,
  createDevice,
  directCommands,
  localStack,
  testRevisionedItem,
  uniqueEmail,
} from '../src/testing';
import type { EligibilityBand } from '../src';

const stack = localStack();

const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** A device whose operational metrics land in `events`. */
function device(name: string) {
  const events: MetricEvent[] = [];
  const created = createDevice(stack, { name, metrics: { send: (event) => void events.push(event) } });
  devices.push(created);
  return { device: created, events };
}

/** Creates an account by email code, step by step, keeping the code and what was sent before eligibility was established. */
async function createAccount(name: string, band: EligibilityBand) {
  const { device: d, events } = device(name);
  const email = uniqueEmail('privacy');
  expect((await d.account.answerAgeQuestion(band)).status).toBe('eligible');
  expect((await d.account.requestEmailCode({ email, intent: 'create' })).status).toBe('sent');
  const code = await d.mailbox.latestCode(email);
  const beforeEligibility = [...events];
  expect(await d.account.verifyEmailCode({ email, code })).toEqual({ status: 'signed-in' });
  await d.account.sync.idle();
  return { d, events, email, code, beforeEligibility };
}

/** Everything private the scenario's account produced, which no event, snapshot or crash report may hold. */
function privateValues(d: SimulatedDevice, email: string, code: string): string[] {
  const tokens = [...d.credentials.items.values()].flatMap((value) => {
    try {
      const session = JSON.parse(value) as { access_token?: unknown; refresh_token?: unknown };
      return [session.access_token, session.refresh_token].filter((token): token is string => typeof token === 'string');
    } catch {
      return [];
    }
  });
  const gate = d.account.gate;
  return [
    email,
    code,
    accessToken(d),
    ...tokens,
    'accountId' in gate ? gate.accountId : '',
    d.vault.store().identity.installationId,
  ].filter((value) => value.length > 0);
}

/** A casino-session-shaped revisioned item, saved and uploaded. */
const CASINO = { game: 'blackjack', currency: 'USD', net: '-1005/4' };
const CASINO_ITEM = 'casino-at-the-bellagio';

/** Makes the server refuse the device's upload of a practice result: another upload already holds its identity with other content. */
async function refusedUpload(d: SimulatedDevice) {
  d.proxy.online = false;
  const result = await d.playPracticeSession();
  const raw = stack.rawClient(accessToken(d));
  const competing = prepareOperation({
    protocol: PROTOCOL_VERSION,
    operation: 'b'.repeat(32),
    installation: result.device,
    command: (await directCommands(raw, result.device)).next(),
    recordType: completedPracticeSession.name,
    payloadVersion: 1,
    item: result.activityId,
    payload: { ...result, netResult: '999', finalCashOut: '1999' },
  });
  expect((await raw.rpc('sync_upload_v1', { request: competing.request })).data).toMatchObject({ status: 'accepted' });
  return result;
}

const snapshot = async (since: Date) =>
  (await stack.sql<{ snapshot: OperationalSnapshot }[]>`select public.operational_metrics(${since}) as snapshot`)[0]!.snapshot;

describe("a device's operational metrics", () => {
  it('report sync failures, refusals and queue age, carrying nothing private', async () => {
    const { d, events, email, code, beforeEligibility } = await createAccount('phone', '18+');
    expect(beforeEligibility).toEqual([]);
    await d.account.records.save(testRevisionedItem.name, CASINO_ITEM, CASINO);
    const result = await refusedUpload(d);
    // Offline: the run can't reach the server, and the result waits.
    await d.account.sync.reconcile();
    d.clock.advance(30_000);
    await d.account.sync.reconcile();
    d.proxy.online = true;
    await d.account.sync.reconcile();

    const names = new Set(events.map((event) => `${event.name}${JSON.stringify(event.properties)}`));
    expect(names).toContain('sync_run_failed{"error":"offline"}');
    expect(names).toContain('sync_upload_failed{"outcome":"refused"}');
    expect(events.filter((event) => event.name === 'sync_queue_age').map((event) => event.value)).toContain(30_000);

    const sent = JSON.stringify(events);
    for (const text of [...privateValues(d, email, code), result.activityId, CASINO_ITEM, 'bellagio', '1005/4', 'casino', '18+', String(d.clock.now())]) {
      expect(sent).not.toContain(text);
    }
  });

  it("from a teen's device, are only the permitted ones, and nothing before eligibility is established", async () => {
    const { d, events, beforeEligibility } = await createAccount('teen-phone', '13-15');
    expect(beforeEligibility).toEqual([]);
    d.proxy.online = false;
    await d.account.records.save(testRevisionedItem.name, CASINO_ITEM, CASINO);
    await d.account.sync.reconcile();
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) expect(Object.keys(TEEN_METRICS)).toContain(event.name);
    expect(JSON.stringify(events)).not.toMatch(/13-15|teen/);
  });
});

describe("the backend's operational metrics", () => {
  it('count refused receipts, failed sends, bounces and complaints, and measure staging and storage, as aggregates only', async () => {
    const since = await stack.serverNow();
    const { d, email, code } = await createAccount('phone', '18+');
    await d.account.records.save(testRevisionedItem.name, CASINO_ITEM, CASINO);
    const result = await refusedUpload(d);
    d.proxy.online = true;
    await d.account.sync.reconcile();
    // A failed send, a bounce and a complaint, as the request-code function and the provider's webhook record them.
    await stack.sql`select public.log_email_send('code', 'immediate', 'failed')`;
    await stack.sql`select public.record_email_delivery_problem('code', 'bounced')`;
    await stack.sql`select public.record_email_delivery_problem('no-account', 'complained')`;
    // Every other type counts too: the security notices, export ready and both deletion emails.
    for (const type of EMAIL_TYPES.filter((type) => type !== 'code' && type !== 'no-account')) {
      await stack.sql`select public.log_email_send(${type}, 'immediate', 'failed')`;
      await stack.sql`select public.record_email_delivery_problem(${type}, 'bounced')`;
    }

    const measured = await snapshot(since);
    expect(measured).toMatchObject({
      sync_receipts_refused: 1,
      email_sends_failed: Object.fromEntries(EMAIL_TYPES.map((type) => [type, type === 'no-account' ? 0 : 1])),
      email_delivery_problems: Object.fromEntries(
        EMAIL_TYPES.map((type) => [type, type === 'no-account' ? { bounced: 0, complained: 1 } : { bounced: 1, complained: 0 }]),
      ),
      email_queue_age_ms: null,
    });
    expect(Object.keys(measured.email_sends_failed).sort()).toEqual([...EMAIL_TYPES].sort());
    for (const type of EMAIL_TYPES) {
      expect(serverMetricEvents(measured)).toContainEqual(expect.objectContaining({ name: 'email_sends_failed', properties: { type: metricEmailType(type) } }));
    }
    expect(measured.storage_bytes.database).toBeGreaterThan(0);
    // Cumulative across the database since its statistics were reset; aborted transactions are counted in it.
    expect(measured.transactions_rolled_back).toBeGreaterThanOrEqual(0);
    expect(serverMetricEvents(measured)).toContainEqual({ name: 'sync_receipts_refused', value: 1, properties: {} });

    const held = JSON.stringify(measured);
    for (const text of [...privateValues(d, email, code), result.activityId, CASINO_ITEM, '1005/4', 'blackjack']) expect(held).not.toContain(text);
  });

  it("measure the oldest staged chunk's wait", async () => {
    const [account] = await stack.sql<{ account_id: string }[]>`select account_id from public.accounts limit 1`;
    await stack.sql`
      insert into private.staged_chunks (account_id, record_type, item_id, sha256, data, received_at)
      values (${account!.account_id}, 'test-result', 'staged-metric', ${'c'.repeat(64)}, 'x', now() - interval '90 seconds')`;
    try {
      const measured = await snapshot(await stack.serverNow());
      expect(measured.staged_chunks_age_ms).toBeGreaterThanOrEqual(90_000);
      expect(measured.storage_bytes['staged-chunks']).toBeGreaterThan(0);
    } finally {
      await stack.sql`delete from private.staged_chunks where item_id = 'staged-metric'`;
    }
  });

  it('are out of reach of every client, signed in or not', async () => {
    const { d } = await createAccount('phone', '18+');
    for (const client of [stack.rawClient(), stack.rawClient(accessToken(d))]) {
      expect((await client.rpc('operational_metrics', { since: new Date(0).toISOString() })).error).not.toBeNull();
      expect((await client.rpc('record_email_delivery_problem', { type: 'code', problem: 'bounced' })).error).not.toBeNull();
    }
  });

  it('keep bounces and complaints 30 days, as the send log', async () => {
    const [old] = await stack.sql<{ id: number }[]>`
      insert into private.email_delivery_problems (type, problem, reported_at) values ('code', 'bounced', now() - interval '31 days') returning id`;
    const [recent] = await stack.sql<{ id: number }[]>`
      insert into private.email_delivery_problems (type, problem) values ('code', 'bounced') returning id`;
    const [job] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'expire-email-records'`;
    await stack.sql.unsafe(job!.command);
    expect(await stack.sql`select 1 from private.email_delivery_problems where id = ${old!.id}`).toHaveLength(0);
    expect(await stack.sql`select 1 from private.email_delivery_problems where id = ${recent!.id}`).toHaveLength(1);
  });

  it('can hold nothing but a message type and what happened to it', async () => {
    expect((await stack.columns('private.email_delivery_problems')).sort()).toEqual(['id', 'problem', 'reported_at', 'type']);
  });
});

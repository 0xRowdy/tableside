// Seam 2: history detail and Download all history (#97; spec 2, *History*,
// Amendments 1 A6 and C5, 2 §4, 4 §3). A new device gets summaries from its
// snapshot, then the newest 90 days of detail; older detail arrives when a
// record is opened, by the accepted revision the device holds, with the feed
// applied first when that revision changed; and Download all history keeps
// everything on the device, resumably. Storage running short stops a download
// without evicting anything; a budget alert throttles bulk downloads only and
// deletes nothing. Proven with seam 2's test results (src/testing/record-types.ts),
// whose summaries leave out their detail, and spec 1's practice sessions.

import { afterEach, describe, expect, it } from 'vitest';

import { PAGE_BYTES, STORAGE_RESERVE_BYTES } from '../src';
import {
  type SimulatedDevice,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  signInByEmail,
  testResult,
  testResultPurge,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
const DAY = 86_400_000;

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function queue(d: SimulatedDevice, recordType: string, payload: unknown) {
  const result = await d.account.sync.queue(recordType, payload);
  if (result.status !== 'queued') throw new Error(`${recordType} was refused: ${result.reason}`);
}

const result = (id: string, at: number, detail = `detail of ${id}`) => ({ version: 1, resultId: id, amount: '1', detail, at });
const accountOf = (d: SimulatedDevice): string => {
  const gate = d.account.gate;
  if (gate.state !== 'active') throw new Error(`${d.name} is not signed in`);
  return gate.accountId;
};
/** Each test result on a device: whole (with its detail) or a summary. */
async function resultsOn(d: SimulatedDevice): Promise<Record<string, 'whole' | 'summary'>> {
  const records = await d.vault.store().readAcceptedRecords(testResult.name);
  return Object.fromEntries(records.map((record) => [record.item, record.summaryAt === undefined ? 'whole' : 'summary']));
}
/** The detail calls a device sent: the items each named, and whether it was bulk. */
const detailCalls = (d: SimulatedDevice) =>
  d.proxy.sent.flatMap(({ url, body }) => {
    if (!url.includes('sync_details_v1')) return [];
    const { requests, bulk } = JSON.parse(body ?? '{}') as { requests: { item: string }[]; bulk: boolean };
    return [{ bulk, items: requests.map((request) => request.item) }];
  });

/**
 * Accepts `count` old test results (from a year back, a day apart) straight
 * into the server's rows, as that many uploads would have, each detail
 * `detailBytes` long: the results, their feed entries and the head, in one
 * transaction under the head.
 */
async function seedOldResults(accountId: string, count: number, now: number, detailBytes = 16, prefix = 'old') {
  const since = now - 365 * DAY;
  await stack.sql.begin(async (tx) => {
    await tx`insert into private.sync_heads (account_id) values (${accountId}) on conflict do nothing`;
    const [head] = await tx<{ sequence: number }[]>`select sequence::int from private.sync_heads where account_id = ${accountId} for update`;
    await tx`insert into private.test_results (account_id, result_id, payload)
      select ${accountId}, ${prefix} || '-' || n,
             jsonb_build_object('version', 1, 'resultId', ${prefix} || '-' || n, 'amount', '1', 'at', ${since}::bigint + n * ${DAY}::bigint)
      from generate_series(1, ${count}) n`;
    await tx`insert into private.test_result_details (account_id, result_id, detail)
      select ${accountId}, ${prefix} || '-' || n, repeat('x', ${detailBytes}) from generate_series(1, ${count}) n`;
    await tx`insert into private.sync_feed (account_id, sequence, record_type, item_id, change)
      select ${accountId}, ${head!.sequence} + n, 'test-result', ${prefix} || '-' || n,
             jsonb_build_object('record', jsonb_build_object('version', 1, 'resultId', ${prefix} || '-' || n, 'amount', '1',
                                                             'at', ${since}::bigint + n * ${DAY}::bigint, 'detail', repeat('x', ${detailBytes})))
      from generate_series(1, ${count}) n`;
    await tx`update private.sync_heads set sequence = sequence + ${count} where account_id = ${accountId}`;
  });
}

/** A phone with an account holding a recent result, an old one, and a practice session. */
async function accountWithHistory() {
  const email = uniqueEmail('history');
  const phone = device('phone');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  const now = phone.clock.now();
  await queue(phone, testResult.name, result('recent', now - 10 * DAY));
  await queue(phone, testResult.name, result('old', now - 200 * DAY));
  const practice = await phone.playPracticeSession();
  await phone.account.sync.reconcile();
  return { email, phone, practice };
}

const summaries = async (d: SimulatedDevice) => Object.values(await resultsOn(d)).filter((state) => state === 'summary').length;

describe('a new device', () => {
  it('gets a snapshot of summaries, then the newest 90 days’ detail; older detail stays on the server until opened', async () => {
    const { email, practice } = await accountWithHistory();
    const tablet = device('tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();

    // The snapshot itself holds summaries only (Amendment 1 A6).
    const rows = await stack.sql<{ change: { record: Record<string, unknown> } }[]>`
      select change from private.bootstrap_rows where account_id = ${accountOf(tablet)}`;
    expect(rows.length).toBeGreaterThan(0);
    for (const { change } of rows) {
      expect(change.record).not.toHaveProperty('detail');
      expect(change.record).not.toHaveProperty('outcomes');
    }
    // Then the newest 90 days' detail, never as a bulk download; the old result stays a summary.
    expect(await resultsOn(tablet)).toEqual({ recent: 'whole', old: 'summary' });
    const [session] = await tablet.vault.store().readAcceptedRecords('completed-practice-session');
    expect(session?.payload).toEqual(practice);
    expect(detailCalls(tablet).every((call) => !call.bulk)).toBe(true);
    expect(tablet.account.sync.status.history).toEqual({ state: 'complete' });
    expect(tablet.account.sync.status.download).toEqual({ state: 'not-requested' });

    // Opening the old one fetches its detail by the revision held here, and keeps it.
    const opened = await tablet.account.records.detail(testResult.name, 'old');
    expect(opened).toMatchObject({ status: 'detail', record: { item: 'old', payload: { resultId: 'old', detail: 'detail of old' } } });
    expect(await resultsOn(tablet)).toEqual({ recent: 'whole', old: 'whole' });
    tablet.proxy.online = false;
    expect((await tablet.account.records.detail(testResult.name, 'old')).status).toBe('detail');
  });

  it('marks the first download incomplete until the 90 days’ detail is here, carrying on after a restart', async () => {
    const { email } = await accountWithHistory();
    const tablet = device('tablet');
    // The network goes as the device first asks for detail: summaries are installed, detail isn't.
    tablet.proxy.onRequest = (url) => {
      if (url.includes('sync_details_v1')) tablet.proxy.online = false;
    };
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();
    expect(tablet.account.sync.status.history).toEqual({ state: 'incomplete', summaries: 1, detail: 0, stopped: null });
    expect(await resultsOn(tablet)).toEqual({ recent: 'summary', old: 'summary' });

    tablet.proxy.onRequest = null;
    tablet.proxy.online = true;
    await tablet.restart();
    await tablet.account.sync.idle();
    expect(tablet.account.sync.status.history).toEqual({ state: 'complete' });
    expect(await resultsOn(tablet)).toEqual({ recent: 'whole', old: 'summary' });
  });

  it('opening a record whose revision changed applies the feed first: a purged result leaves the device and reports gone', async () => {
    const { email, phone } = await accountWithHistory();
    const tablet = device('tablet');
    // No live hint reaches the tablet: it learns of the purge only by reconciling.
    tablet.proxy.refuseLive = true;
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await expect.poll(async () => (await resultsOn(tablet)).recent).toBe('whole');
    await tablet.account.sync.idle();
    // The phone deletes the old result after the tablet's snapshot.
    await queue(phone, testResultPurge.name, { version: 1, target: 'old' });
    await phone.account.sync.reconcile();

    expect(await tablet.account.records.detail(testResult.name, 'old')).toEqual({ status: 'gone' });
    expect(await resultsOn(tablet)).toEqual({ recent: 'whole' });
    // Asked for by the revision it held, before the feed brought the purge.
    expect(detailCalls(tablet).filter((call) => call.items.includes('old'))).toEqual([{ bulk: false, items: ['old'] }]);
  });

  it('reinstalling restores synced records by signing in; a record only on the old installation isn’t there', async () => {
    const { email, phone } = await accountWithHistory();
    phone.proxy.online = false;
    await queue(phone, testResult.name, result('device-only', phone.clock.now()));
    // The app is deleted with the record unsynced, and installed again: a new installation.
    phone.dispose();
    const reinstalled = device('phone, reinstalled');
    expect(await signInByEmail(reinstalled, email)).toEqual({ status: 'signed-in' });
    await reinstalled.account.sync.idle();
    expect(await resultsOn(reinstalled)).toEqual({ recent: 'whole', old: 'summary' });
    expect(await reinstalled.account.sync.countWaiting()).toBe(0);
  });
});

describe('Download all history', () => {
  it('keeps every record’s detail on the device, resuming where it stopped after the app is killed', async () => {
    const email = uniqueEmail('download');
    const phone = device('phone');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await seedOldResults(accountOf(phone), 250, phone.clock.now());

    const tablet = device('tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();
    expect(await summaries(tablet)).toBe(250);

    // The app is killed as it asks for the second bulk page.
    let bulk = 0;
    tablet.proxy.onRequest = (url) => {
      if (url.includes('sync_details_v1') && ++bulk === 2) tablet.kill();
    };
    void tablet.account.sync.downloadAllHistory().catch(() => undefined);
    await expect.poll(() => bulk).toBe(2);
    tablet.proxy.onRequest = null;
    await tablet.restart();
    await tablet.account.sync.idle();

    expect(tablet.account.sync.status.download).toEqual({ state: 'complete' });
    expect(await summaries(tablet)).toBe(0);
    const asked = detailCalls(tablet).flatMap((call) => call.items);
    // Only the page lost with the process is asked again; no request names more than 100.
    expect(asked.length - new Set(asked).size).toBeLessThanOrEqual(100);
    expect(detailCalls(tablet).every((call) => call.bulk && call.items.length <= 100)).toBe(true);
  });

  it('stops when storage is short, saying so, and evicts nothing: unsynced records and the unfinished session stay', async () => {
    const email = uniqueEmail('download-full');
    const phone = device('phone');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await seedOldResults(accountOf(phone), 20, phone.clock.now());

    const tablet = device('tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await tablet.account.sync.idle();
    await tablet.startPracticeSession();
    tablet.proxy.online = false;
    await queue(tablet, testResult.name, result('unsynced', tablet.clock.now()));
    tablet.proxy.online = true;

    tablet.freeStorage = STORAGE_RESERVE_BYTES + PAGE_BYTES - 1;
    await tablet.account.sync.downloadAllHistory();
    expect(tablet.account.sync.status.download).toEqual({ state: 'stopped', progress: 0, reason: 'storage' });
    expect(await summaries(tablet)).toBe(20);
    expect(await tablet.vault.store().findUnfinished()).not.toBeNull();
    // The unsynced record went up meanwhile: only downloads stop.
    expect(await tablet.account.sync.countWaiting()).toBe(0);

    // Room again, and the player resumes it.
    tablet.freeStorage = 4 * 1024 * 1024 * 1024;
    await tablet.account.sync.downloadAllHistory();
    expect(tablet.account.sync.status.download).toEqual({ state: 'complete' });
    expect(await tablet.vault.store().findUnfinished()).not.toBeNull();
  });

  it('is throttled first under a budget alert, and only it: recent and opened detail still arrive, and no history is deleted', async () => {
    const email = uniqueEmail('download-budget');
    const phone = device('phone');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    const now = phone.clock.now();
    await queue(phone, testResult.name, result('recent', now - DAY));
    await phone.account.sync.reconcile();
    await seedOldResults(accountOf(phone), 5, now);
    const serverDetails = async () => (await stack.sql`select 1 from private.test_result_details where account_id = ${accountOf(phone)}`).length;

    await stack.sql`update private.budget_alert set active = true, retry_after = 600`;
    try {
      const tablet = device('tablet');
      expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
      await tablet.account.sync.downloadAllHistory();
      expect(tablet.account.sync.status.download).toMatchObject({ state: 'stopped', reason: 'throttled' });
      expect((await resultsOn(tablet)).recent).toBe('whole');
      expect((await tablet.account.records.detail(testResult.name, 'old-3')).status).toBe('detail');
      expect(await summaries(tablet)).toBe(4);
      expect(await serverDetails()).toBe(6);

      // Cleared, and the wait over: it carries on by itself.
      await stack.sql`update private.budget_alert set active = false`;
      tablet.clock.advance(600_000);
      await tablet.account.sync.reconcile();
      expect(tablet.account.sync.status.download).toEqual({ state: 'complete' });
    } finally {
      await stack.sql`update private.budget_alert set active = false, retry_after = 3600`;
    }
  });
});

describe('pages', () => {
  it('of the feed, of snapshots and of details stay within PAGE_BYTES, an entry larger than that coming by itself', async () => {
    const email = uniqueEmail('pages');
    const phone = device('phone');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    const accountId = accountOf(phone);
    // Twelve 60 KB details, then one of 400 KB.
    await seedOldResults(accountId, 12, phone.clock.now(), 60_000, 'mid');
    await seedOldResults(accountId, 1, phone.clock.now(), 400_000, 'big');
    // The server's bound is the client's.
    expect((await stack.sql<{ bytes: number }[]>`select private.page_bytes() as bytes`)[0]?.bytes).toBe(PAGE_BYTES);
    const client = stack.rawClient(accessToken(phone));
    const sizes = (entries: readonly unknown[]) => entries.map((entry) => Buffer.byteLength(JSON.stringify(entry)));
    const withinBound = (entries: readonly unknown[]) => entries.length === 1 || sizes(entries).reduce((a, b) => a + b, 0) <= PAGE_BYTES;

    const feedPages: unknown[][] = [];
    for (let after = 0, more = true; more; ) {
      const { data } = await client.rpc('sync_feed_v1', { after, page_size: 100 });
      const page = data as { entries: { sequence: number }[]; more: boolean };
      feedPages.push(page.entries);
      after = page.entries.at(-1)!.sequence;
      more = page.more;
    }
    expect(feedPages.flat()).toHaveLength(13);
    expect(feedPages.every(withinBound)).toBe(true);
    expect(feedPages.length).toBeGreaterThan(2);

    const { data: snapshot } = await client.rpc('sync_bootstrap_v1', { installation: 'pages-check' });
    const id = (snapshot as { snapshot: string }).snapshot;
    const snapshotRows: unknown[] = [];
    for (let after = 0, more = true; more; ) {
      const { data } = await client.rpc('sync_bootstrap_page_v1', { snapshot: id, after, page_size: 500 });
      const page = data as { rows: { ordinal: number }[]; more: boolean };
      expect(withinBound(page.rows)).toBe(true);
      snapshotRows.push(...page.rows);
      after = page.rows.at(-1)!.ordinal;
      more = page.more;
    }
    expect(snapshotRows).toHaveLength(13);

    const items = [...Array.from({ length: 12 }, (_, index) => `mid-${index + 1}`), 'big-1'];
    const requests = await Promise.all(
      items.map(async (item) => {
        const [row] = await stack.sql<{ sequence: number }[]>`
          select min(sequence)::int as sequence from private.sync_feed where account_id = ${accountId} and item_id = ${item}`;
        return { recordType: testResult.name, item, sequence: row!.sequence };
      }),
    );
    const answered: string[] = [];
    for (let rest = requests; rest.length > 0; ) {
      const { data } = await client.rpc('sync_details_v1', { requests: rest, bulk: true });
      const { answers } = data as { answers: { item: string; status: string }[] };
      expect(withinBound(answers)).toBe(true);
      expect(answers.every((answer) => answer.status === 'detail')).toBe(true);
      answered.push(...answers.map((answer) => answer.item));
      rest = rest.slice(answers.length);
    }
    expect(answered).toEqual(items);
  });
});

describe('a raw client', () => {
  it('gets detail only for its own account, and nothing without an active session', async () => {
    const { phone } = await accountWithHistory();
    const other = device('other');
    expect(await createAccountByEmail(other, uniqueEmail('other'))).toEqual({ status: 'signed-in' });
    const [row] = await stack.sql<{ sequence: number }[]>`
      select min(sequence)::int as sequence from private.sync_feed where account_id = ${accountOf(phone)} and item_id = 'old'`;
    const requests = [{ recordType: testResult.name, item: 'old', sequence: row!.sequence }];

    const own = await stack.rawClient(accessToken(phone)).rpc('sync_details_v1', { requests });
    expect((own.data as { answers: { status: string }[] }).answers[0]?.status).toBe('detail');
    const stranger = await stack.rawClient(accessToken(other)).rpc('sync_details_v1', { requests });
    expect(stranger.data).toEqual({ status: 'details', answers: [{ recordType: testResult.name, item: 'old', status: 'gone' }] });
    const anonymous = await stack.rawClient(undefined).rpc('sync_details_v1', { requests });
    expect(anonymous.error).not.toBeNull();
    const malformed = await stack.rawClient(accessToken(phone)).rpc('sync_details_v1', { requests: [{ ...requests[0], sequence: -1 }] });
    expect(malformed.data).toEqual({ status: 'malformed' });
  });
});

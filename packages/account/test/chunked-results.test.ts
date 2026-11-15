// Seam 2, chunked results (#93): a practice session too large for one request
// reaches the account's other device whole, through bounded, content-hashed
// chunks staged privately; nothing partial is ever visible or counted, the
// device keeps the session until the final receipt, abandoned staging expires
// after 24 hours without progress, and resending the same bytes makes no new
// result. Faults are injected at the network (fault proxy), the app process
// (kill and restart) and the server clock (privileged SQL), never inside the
// Account service.

import { createHash } from 'node:crypto';

import { canonicalJson } from '@tableside/engine';
import { afterEach, describe, expect, it } from 'vitest';

import { CHUNK_BYTES, PROTOCOL_VERSION, REQUEST_LIMIT_BYTES, completedPracticeSession } from '../src';
import { chunkCallArguments, chunksOf, prepareOperation } from '../src/sync/protocol';
import { type SimulatedDevice, accessToken, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(localStack(), { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** Four times the request limit: sent in about a dozen chunks. */
const LONG = 4 * REQUEST_LIMIT_BYTES;

/** A phone that created an account and a tablet signed in to it, the tablet in the background (no live hints). */
async function twoDevices() {
  const phone = device('phone');
  const tablet = device('tablet');
  const email = uniqueEmail('chunks');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);
  tablet.foreground = false;
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('unreachable');
  return { phone, tablet, accountId: gate.accountId };
}

const sessionsOn = async (d: SimulatedDevice) => d.vault.store().readAcceptedRecords(completedPracticeSession.name);

/** A practice session as the account accepted it: whole, at the account's first sequence. */
const acceptedFirst = (result: { readonly activityId: string }) => [{ recordType: completedPracticeSession.name, item: result.activityId, sequence: 1, payload: result }];

/** The killed app starts again, back online. */
async function reopen(d: SimulatedDevice) {
  d.proxy.onRequest = null;
  d.proxy.online = true;
  await d.restart();
  await d.account.sync.idle();
}

/** Requests a device sent to an operation. */
const callsTo = (d: SimulatedDevice, operation: string) => d.proxy.sent.filter(({ url }) => url.includes(`/rpc/${operation}`));

/** The device goes offline as its `count`th chunk leaves, so that chunk and the rest never arrive. */
function offlineAtChunk(d: SimulatedDevice, count: number) {
  let chunks = 0;
  d.proxy.onRequest = (url) => {
    if (url.includes('/rpc/sync_stage_chunk_v1') && ++chunks === count) d.proxy.online = false;
  };
}

/** What the tablet sees of the account: its accepted sessions after reconciling, and the feed as a direct call reads it. */
async function seenByTablet(tablet: SimulatedDevice) {
  tablet.foreground = true;
  await tablet.account.sync.idle();
  const feed = await localStack().rawClient(accessToken(tablet)).rpc('sync_feed_v1', { after: 0 });
  tablet.foreground = false;
  return { sessions: await sessionsOn(tablet), feed: (feed.data as { entries: unknown[] }).entries };
}

/** Moves a result's staged chunks' arrival back by `hours`, as if that long had passed on the server; returns the job's command. */
async function ageStaging(accountId: string, hours: number) {
  const { sql } = localStack();
  await sql`update private.staged_chunks set received_at = received_at - make_interval(hours => ${hours}) where account_id = ${accountId}`;
  const [job] = await sql<{ command: string }[]>`select command from cron.job where jobname = 'expire-staged-chunks'`;
  expect(job).toBeDefined();
  return () => sql.unsafe(job!.command);
}

describe('a practice session too large for one request', () => {
  it('reaches the other device whole, in chunks, with every request within the limit', async () => {
    const { phone, tablet } = await twoDevices();

    const result = await phone.playPracticeSession({ longerThan: LONG });
    await phone.account.sync.idle();

    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(callsTo(phone, 'sync_stage_chunk_v1').length).toBeGreaterThan(LONG / CHUNK_BYTES);
    const bodies = phone.proxy.sent.filter(({ url }) => url.includes('/rpc/sync_')).map(({ bodyBytes }) => bodyBytes);
    expect(Math.min(...bodies)).toBeGreaterThan(0);
    expect(Math.max(...bodies)).toBeLessThanOrEqual(REQUEST_LIMIT_BYTES);

    const { sessions, feed } = await seenByTablet(tablet);
    expect(sessions).toEqual(acceptedFirst(result));
    expect(result.outcomes.length).toBeGreaterThan(1_000);
    expect(feed).toHaveLength(1);
  });

  it('is never visible half-uploaded, and the device keeps it until the final receipt', async () => {
    const { phone, tablet } = await twoDevices();
    offlineAtChunk(phone, 4);

    const result = await phone.playPracticeSession({ longerThan: LONG });
    await phone.account.sync.idle();
    expect(callsTo(phone, 'sync_stage_chunk_v1')).toHaveLength(4);

    // Three chunks are staged: no device sees a session, and the feed holds nothing.
    expect(await seenByTablet(tablet)).toEqual({ sessions: [], feed: [] });
    const [queued] = await phone.vault.store().readUploadQueue();
    expect(queued?.payload).toEqual(result);

    phone.kill();
    await reopen(phone);

    // Only the chunks that never arrived were sent again.
    const chunks = chunksOf(queued!.operation!, queued!.payload)!;
    expect(callsTo(phone, 'sync_stage_chunk_v1')).toHaveLength(4 + chunks.length - 3);
    const seen = await seenByTablet(tablet);
    expect(seen.sessions).toEqual(acceptedFirst(result));
    expect(seen.feed).toHaveLength(1);
  });

  it('whose final answer was lost gets its receipt on the retry, sending no chunk again', async () => {
    const { phone, tablet } = await twoDevices();
    let uploads = 0;
    phone.proxy.onRequest = (url) => {
      // The first upload names the chunks missing; the second, after staging them, is the final acceptance.
      if (url.includes('/rpc/sync_upload_v1') && ++uploads === 2) phone.proxy.dropNextResponse('sync_upload_v1');
    };

    const result = await phone.playPracticeSession({ longerThan: LONG });
    await phone.account.sync.idle();
    expect(phone.account.sync.status.error).toBe('offline');
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(1);
    const staged = callsTo(phone, 'sync_stage_chunk_v1').length;

    await phone.account.sync.reconcile();
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(callsTo(phone, 'sync_stage_chunk_v1')).toHaveLength(staged);
    expect((await seenByTablet(tablet)).sessions.map(({ item, sequence }) => ({ item, sequence }))).toEqual([{ item: result.activityId, sequence: 1 }]);
  });
});

describe('abandoned staging', () => {
  /** A long session three of whose chunks were staged before the phone went offline and its app was killed. */
  async function abandoned() {
    const devices = await twoDevices();
    const { phone } = devices;
    offlineAtChunk(phone, 4);
    const result = await phone.playPracticeSession({ longerThan: LONG });
    await phone.account.sync.idle();
    const [queued] = await phone.vault.store().readUploadQueue();
    phone.kill();
    return { ...devices, result, chunks: chunksOf(queued!.operation!, queued!.payload)! };
  }

  it('expires 24 hours after its last progress; the device resends the same bytes and they make one result', async () => {
    const { phone, tablet, accountId, result, chunks } = await abandoned();
    await (await ageStaging(accountId, 24))();

    await reopen(phone);
    // Every chunk was staged again.
    expect(callsTo(phone, 'sync_stage_chunk_v1')).toHaveLength(4 + chunks.length);
    expect((await seenByTablet(tablet)).sessions).toEqual(acceptedFirst(result));
  });

  it('is kept while it progressed within 24 hours', async () => {
    const { phone, accountId, chunks } = await abandoned();
    await (await ageStaging(accountId, 23))();

    await reopen(phone);
    expect(callsTo(phone, 'sync_stage_chunk_v1')).toHaveLength(4 + chunks.length - 3);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
  });

  it('is not kept alive by resending chunks it already holds', async () => {
    const { phone, accountId, chunks } = await abandoned();
    const expire = await ageStaging(accountId, 24);
    const raw = localStack().rawClient(accessToken(phone));
    expect((await raw.rpc('sync_stage_chunk_v1', chunkCallArguments(chunks[0]!))).data).toEqual({ status: 'staged' });
    await expire();

    await reopen(phone);
    expect(callsTo(phone, 'sync_stage_chunk_v1')).toHaveLength(4 + chunks.length);
  });
});

describe('the chunk operations, called directly', () => {
  /** The phone's own installation: the server takes uploads only from the caller's registered installation. */
  let installation = '';
  /** A practice result of the account's, `size` bytes long, prepared as `operation` would send it. */
  function longResult(accountId: string, operation: string, size = 3 * REQUEST_LIMIT_BYTES) {
    const payload = {
      recordVersion: 1,
      activityId: 'activity-1',
      owner: accountId,
      device: installation,
      game: 'roulette',
      startedAt: 1,
      endedAt: 2,
      netResult: '10',
      finalCashOut: '1010',
      outcomes: Array.from({ length: Math.ceil(size / 40) }, (_, turn) => ({ turn, target: 'red', returned: '20' })),
    };
    const prepared = prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: operation.repeat(32),
      installation,
      recordType: completedPracticeSession.name,
      payloadVersion: 1,
      item: 'activity-1',
      payload,
    });
    return { request: prepared.request, chunks: chunksOf(prepared, payload)! };
  }

  async function signedIn() {
    const { phone, accountId } = await twoDevices();
    installation = phone.vault.store().identity.installationId;
    return { accountId, raw: localStack().rawClient(accessToken(phone)) };
  }

  it('accept a manifest only once every chunk it names is staged, and the same bytes again make no new result', async () => {
    const { accountId, raw } = await signedIn();
    const { request, chunks } = longResult(accountId, '1');
    const upload = async (text = request) => (await raw.rpc('sync_upload_v1', { request: text })).data as { status: string; missing?: number[] };
    const stage = async (index: number) => expect((await raw.rpc('sync_stage_chunk_v1', chunkCallArguments(chunks[index]!))).data).toEqual({ status: 'staged' });
    const feed = async () => ((await raw.rpc('sync_feed_v1', { after: 0 })).data as { entries: { sequence: number }[] }).entries;

    expect(await upload()).toEqual({ status: 'chunks-missing', missing: chunks.map((_, index) => index) });
    for (const index of chunks.keys()) if (index !== 1) await stage(index);
    expect(await upload()).toEqual({ status: 'chunks-missing', missing: [1] });
    expect(await feed()).toEqual([]);

    await stage(1);
    expect(await upload()).toMatchObject({ status: 'accepted', sequence: 1 });
    expect(await upload()).toMatchObject({ status: 'accepted', sequence: 1 });

    // The same result's bytes staged and named again, under another operation: the one acceptance.
    const again = longResult(accountId, '2');
    for (const chunk of again.chunks) await raw.rpc('sync_stage_chunk_v1', chunkCallArguments(chunk));
    expect(await upload(again.request)).toMatchObject({ status: 'accepted', sequence: 1 });
    expect((await feed()).map(({ sequence }) => sequence)).toEqual([1]);
  });

  it('refuse chunks and manifests that don’t hold together, and anything over the limits', async () => {
    const { accountId, raw } = await signedIn();
    const { request, chunks } = longResult(accountId, '3');
    const chunk = chunks[0]!;
    const stage = async (fields: Partial<ReturnType<typeof chunkCallArguments>>) => (await raw.rpc('sync_stage_chunk_v1', { ...chunkCallArguments(chunk), ...fields })).data;

    expect(await stage({ sha256: '0'.repeat(64) })).toEqual({ status: 'malformed' });
    expect(await stage({ record_type: 'no-such-type' })).toEqual({ status: 'malformed' });
    const oversized = 'x'.repeat(CHUNK_BYTES + 1);
    expect(await stage({ data: oversized, sha256: createHash('sha256').update(oversized).digest('hex') })).toEqual({ status: 'malformed' });
    expect(await stage({ protocol: 2 })).toEqual({ status: 'incompatible', supported: [1] });
    expect((await localStack().rawClient().rpc('sync_stage_chunk_v1', chunkCallArguments(chunk))).error).not.toBeNull();

    // A manifest whose staged chunks rejoin to other text is refused, durably.
    const manifest = JSON.parse(request) as { content: { sha256: string } };
    const wrong = canonicalJson({ ...manifest, operation: '4'.repeat(32), content: { ...manifest.content, sha256: 'f'.repeat(64) } });
    for (const each of chunks) await raw.rpc('sync_stage_chunk_v1', chunkCallArguments(each));
    const refused = (await raw.rpc('sync_upload_v1', { request: wrong })).data;
    expect(refused).toMatchObject({ status: 'rejected', code: 'content-mismatch' });
    expect((await raw.rpc('sync_upload_v1', { request: wrong })).data).toEqual(refused);

    expect((await raw.rpc('sync_upload_v1', { request: 'x'.repeat(REQUEST_LIMIT_BYTES + 1) })).data).toEqual({ status: 'malformed' });
    expect(((await raw.rpc('sync_feed_v1', { after: 0 })).data as { entries: unknown[] }).entries).toEqual([]);
  });

  it('bound how much an account stages at once, and free it as staging expires', async () => {
    const { accountId, raw } = await signedIn();
    const { chunks } = longResult(accountId, '6');
    const { sql } = localStack();
    // 128 MiB already staged under made-up results.
    await sql`insert into private.staged_chunks (account_id, record_type, item_id, sha256, data)
      select ${accountId}, ${completedPracticeSession.name}, 'filler-' || n, md5(n::text) || md5(n::text), repeat('x', 49152)
      from generate_series(1, 2731) n`;

    expect((await raw.rpc('sync_stage_chunk_v1', chunkCallArguments(chunks[0]!))).data).toEqual({ status: 'staging-full' });
    await (await ageStaging(accountId, 24))();
    expect((await raw.rpc('sync_stage_chunk_v1', chunkCallArguments(chunks[0]!))).data).toEqual({ status: 'staged' });
  });

  it('count only the account’s own staged chunks', async () => {
    const { accountId, raw } = await signedIn();
    const other = device('other');
    expect(await createAccountByEmail(other, uniqueEmail('chunks-other'))).toEqual({ status: 'signed-in' });
    const { request, chunks } = longResult(accountId, '5');
    const otherRaw = localStack().rawClient(accessToken(other));
    for (const chunk of chunks) expect((await otherRaw.rpc('sync_stage_chunk_v1', chunkCallArguments(chunk))).data).toEqual({ status: 'staged' });

    expect((await raw.rpc('sync_upload_v1', { request })).data).toEqual({ status: 'chunks-missing', missing: chunks.map((_, index) => index) });
  });

  it('get a request four times the limit through the pinned stack, so the limit is the operations’ own, not the gateway’s', async () => {
    const { raw } = await signedIn();
    const body = 'x'.repeat(4 * REQUEST_LIMIT_BYTES);
    const upload = await raw.rpc('sync_upload_v1', { request: body });
    expect([upload.status, upload.data]).toEqual([200, { status: 'malformed' }]);
    const stage = await raw.rpc('sync_stage_chunk_v1', { protocol: 1, record_type: completedPracticeSession.name, item: 'activity-1', sha256: '0'.repeat(64), data: body });
    expect([stage.status, stage.data]).toEqual([200, { status: 'malformed' }]);
  });
});

// Seam 2: sync failures and protocol versions (#92). Faults are injected at the
// network (the fault proxy: an outage, throttling, a refused token), at the
// server (a revoked session, a retired protocol) and in the data (a malformed
// record); time is the device's clock. Nothing is stubbed inside the Account
// service. Spec 2, *Retries* and *Protocol versions*.

import { afterEach, describe, expect, it } from 'vitest';

import { laterBuild } from '../../../apps/mobile/src/account/testing/later-build';
import { PROTOCOL_VERSION, RECONCILE_INTERVAL_MS, completedPracticeSession } from '../src';
import { prepareOperation } from '../src/sync/protocol';
import { type SimulatedDevice, createAccountByEmail, createDevice, directCommands, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
function device(name: string, options: Omit<Parameters<typeof createDevice>[1], 'name'> = {}): SimulatedDevice {
  const created = createDevice(localStack(), { name, ...options });
  devices.push(created);
  return created;
}

afterEach(async () => {
  devices.splice(0).forEach((d) => d.dispose());
  // Protocol 1 is served again, with no retirement scheduled.
  await localStack().sql`update private.sync_protocols set retires_at = null, urgent_reason = null where protocol = 1`;
});

async function signedIn(name = 'phone') {
  const phone = device(name);
  const email = uniqueEmail('failures');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  await phone.account.sync.idle();
  return { phone, email };
}

async function twoDevices() {
  const { phone, email } = await signedIn();
  const tablet = device('tablet');
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);
  return { phone, tablet, email };
}

/** Lets the device's work that is already due finish. */
async function settle(d: SimulatedDevice) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await d.account.sync.idle();
}

/** Moves the device's clock on in steps, letting each step's work finish, as time passing with the app open. */
async function timePasses(d: SimulatedDevice, milliseconds: number, step = 250) {
  for (let passed = 0; passed < milliseconds; passed += step) {
    d.clock.advance(step);
    await settle(d);
  }
}

/** Requests to an operation, counted as the device sends them, with the device's time. */
function watchRequests(d: SimulatedDevice, operation: string): number[] {
  const times: number[] = [];
  d.proxy.onRequest = (url) => {
    if (url.includes(`/rpc/${operation}`)) times.push(d.clock.now());
  };
  return times;
}

const gaps = (times: readonly number[]) => times.slice(1).map((time, index) => time - times[index]!);

async function sessionsOn(d: SimulatedDevice) {
  return (await d.vault.store().readAcceptedRecords(completedPracticeSession.name)).map(({ item }) => item);
}

/** The access token a device's Auth session holds. */
function accessToken(d: SimulatedDevice): string {
  for (const value of d.credentials.items.values()) {
    try {
      const token = (JSON.parse(value) as { access_token?: unknown }).access_token;
      if (typeof token === 'string') return token;
    } catch {
      // Not the session.
    }
  }
  throw new Error(`${d.name} holds no session`);
}

describe('when the server can’t be reached', () => {
  it('backs off, jittered, from about 1 s up to 5 min, keeping the session, and never loops', async () => {
    const { phone } = await signedIn();
    phone.proxy.serverDown = true;
    const attempts = watchRequests(phone, 'sync_protocol');
    const result = await phone.playPracticeSession();
    await settle(phone);
    expect(phone.account.sync.status).toMatchObject({ error: 'offline', uploads: [{ id: `completed/${result.activityId}`, state: 'waiting' }] });

    await timePasses(phone, 20 * 60_000);
    const waits = gaps(attempts);
    // Spec 2: about 1 s, doubling, up to 5 min. Each wait is half to all of its
    // step (to within the clock's 250 ms steps).
    const steps = [1, 2, 4, 8, 16, 32, 64, 128, 256, 300, 300, 300, 300, 300].map((seconds) => seconds * 1_000);
    for (const [index, wait] of waits.entries()) {
      expect(wait).toBeGreaterThanOrEqual(steps[index]! / 2);
      expect(wait).toBeLessThanOrEqual(steps[index]! + 250);
    }
    expect(Math.max(...waits)).toBeGreaterThan(150_000);
    // 20 minutes of the 60 s cadence and saves would be 20 runs or more; the backoff makes far fewer.
    expect(attempts.length).toBeLessThan(16);
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(1);

    // Back up: a deliberate retry ("Retry now") goes at once.
    phone.proxy.serverDown = false;
    await phone.account.sync.reconcile();
    expect(phone.account.sync.status).toMatchObject({ error: null, uploads: [] });
    expect(await sessionsOn(phone)).toEqual([result.activityId]);
  });

  it('waits as long as a throttled answer’s Retry-After, even for a deliberate retry', async () => {
    const { phone } = await signedIn();
    phone.proxy.throttleNext('sync_protocol', '120');
    const attempts = watchRequests(phone, 'sync_protocol');
    const result = await phone.playPracticeSession();
    await settle(phone);
    expect(phone.account.sync.status.error).toBe('offline');

    await timePasses(phone, 60_000, 1_000);
    await phone.account.sync.reconcile();
    expect(attempts).toHaveLength(1);

    await timePasses(phone, 61_000, 1_000);
    expect(attempts.length).toBeGreaterThan(1);
    expect(attempts[1]! - attempts[0]!).toBeGreaterThanOrEqual(120_000);
    expect(await sessionsOn(phone)).toEqual([result.activityId]);
  });
});

describe('a malformed record among independent saves', () => {
  const MALFORMED = 'activity with spaces';

  it('is isolated: the others reach the other device, and it backs off by itself', async () => {
    const { phone, tablet } = await twoDevices();
    const bad = await phone.playPracticeSession({ activityId: MALFORMED });
    const first = await phone.playPracticeSession();
    const second = await phone.playPracticeSession();
    await settle(phone);

    expect(phone.account.sync.status.uploads).toEqual([expect.objectContaining({ id: `completed/${bad.activityId}`, state: 'waiting' })]);
    tablet.clock.advance(RECONCILE_INTERVAL_MS);
    await settle(tablet);
    expect((await sessionsOn(tablet)).sort()).toEqual([first.activityId, second.activityId].sort());
  });

  it('is flagged after repeated failures, then left alone, never deleted, while later saves keep syncing; Retry this record tries it again', async () => {
    const { phone } = await signedIn();
    const uploads = watchRequests(phone, 'sync_upload_v1');
    const bad = await phone.playPracticeSession({ activityId: MALFORMED });
    await settle(phone);

    // Flagged on its fifth failure.
    await timePasses(phone, 2 * 60_000);
    expect(uploads).toHaveLength(5);
    const id = `completed/${bad.activityId}`;
    expect(phone.account.sync.status.uploads).toEqual([expect.objectContaining({ id, state: 'flagged' })]);

    // An hour of the 60 s cadence, and a save: the flagged record isn't sent again; the save is.
    await timePasses(phone, 30 * 60_000, 5_000);
    const later = await phone.playPracticeSession();
    await settle(phone);
    expect(uploads).toHaveLength(6);
    expect(await sessionsOn(phone)).toEqual([later.activityId]);
    expect((await phone.vault.store().readUploadQueue()).map((entry) => entry.id)).toEqual([id]);
    expect((await phone.vault.store().load(bad.activityId))?.completion).toEqual(bad);

    await phone.account.sync.retryRecord(id);
    expect(uploads).toHaveLength(7);
    expect(phone.account.sync.status.uploads).toEqual([expect.objectContaining({ id, state: 'waiting' })]);
  });
});

describe('a database fault', () => {
  it('counts against no record: the run backs off, and the record uploads on the retry', async () => {
    const { phone } = await signedIn();
    phone.proxy.serverFaultNext('sync_upload_v1', '57014');
    const result = await phone.playPracticeSession();
    await settle(phone);
    expect(phone.account.sync.status.error).toBe('offline');
    expect(await phone.vault.store().readUploadQueue()).toMatchObject([{ failures: 0, flagged: false }]);

    await timePasses(phone, 2_000);
    expect(await sessionsOn(phone)).toEqual([result.activityId]);
  });
});

describe('a record the server refuses', () => {
  it('goes to review, kept on the device, and is never sent again', async () => {
    const { phone } = await signedIn();
    phone.proxy.online = false;
    const result = await phone.playPracticeSession();
    // Another upload already holds this session's identity with different content.
    const altered = { ...result, netResult: '999', finalCashOut: '1999' };
    const raw = localStack().rawClient(accessToken(phone));
    const competing = prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: 'a'.repeat(32),
      installation: result.device,
      command: (await directCommands(raw, result.device)).next(),
      recordType: completedPracticeSession.name,
      payloadVersion: 1,
      item: result.activityId,
      payload: altered,
    });
    expect((await raw.rpc('sync_upload_v1', { request: competing.request })).data).toMatchObject({ status: 'accepted' });

    const uploads = watchRequests(phone, 'sync_upload_v1');
    phone.proxy.online = true;
    await settle(phone);
    await phone.account.sync.reconcile();
    expect(uploads).toHaveLength(1);
    expect(phone.account.sync.status.uploads).toEqual([expect.objectContaining({ id: `completed/${result.activityId}`, state: 'review' })]);
    expect((await phone.vault.store().load(result.activityId))?.completion).toEqual(result);
  });
});

describe('when the session isn’t accepted', () => {
  it('renews an expired token and carries on, signing nothing out', async () => {
    const { phone } = await signedIn();
    phone.proxy.rejectTokenNext('sync_protocol');
    const renewals: string[] = [];
    phone.proxy.onRequest = (url) => url.includes('grant_type=refresh_token') && renewals.push(url);
    const result = await phone.playPracticeSession();
    await settle(phone);

    expect(renewals).toHaveLength(1);
    expect(phone.account.sync.status.error).toBeNull();
    expect(await sessionsOn(phone)).toEqual([result.activityId]);
    expect(phone.account.gate.state).toBe('active');
  });

  it('asks to sign in again when the session is gone, keeping every record, and signing in again uploads them', async () => {
    const { phone, email } = await signedIn();
    const authUser = await localStack().authUserId(email);
    // The phone's session no longer exists on the server (its refresh token went with it).
    await localStack().sql`delete from auth.sessions where user_id = ${authUser!} and id = ${sessionId(accessToken(phone))}`;
    const attempts = watchRequests(phone, 'sync_protocol');
    const result = await phone.playPracticeSession();
    await settle(phone);

    expect(phone.account.sync.status).toMatchObject({ error: 'sign-in-required', uploads: [{ state: 'waiting' }] });
    await timePasses(phone, 10 * 60_000, 1_000);
    expect(attempts.length).toBeLessThan(14);
    expect((await phone.vault.store().load(result.activityId))?.completion).toEqual(result);

    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    await settle(phone);
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(phone.account.sync.status.error).toBeNull();
    expect(await sessionsOn(phone)).toEqual([result.activityId]);
  });
});

/** The session ID an access token names. */
function sessionId(token: string): string {
  return (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { session_id: string }).session_id;
}

describe('protocol versions', () => {
  const { sql } = localStack();

  /** Protocol 1's retirement, announced long ago and now passed. */
  async function retireProtocolOne() {
    await sql.begin(async (tx) => {
      await tx`alter table private.sync_protocols disable trigger stamp_announcement`;
      await tx`update private.sync_protocols set announced_at = now() - interval '31 days', retires_at = now() - interval '1 day' where protocol = 1`;
      await tx`alter table private.sync_protocols enable trigger stamp_announcement`;
    });
  }

  it('a retirement is announced at least 30 days ahead, unless an urgent restriction explains why it can’t wait', async () => {
    await expect(sql`update private.sync_protocols set retires_at = now() + interval '29 days' where protocol = 1`).rejects.toThrow(/check constraint/);
    // The notice runs from the server's own announcement time, which the operator can't backdate.
    await expect(
      sql`update private.sync_protocols set retires_at = now() + interval '2 days', announced_at = now() - interval '60 days' where protocol = 1`,
    ).rejects.toThrow(/check constraint/);
    await sql`update private.sync_protocols set retires_at = now() + interval '30 days' where protocol = 1`;
    await sql`update private.sync_protocols set retires_at = null where protocol = 1`;
    await sql`update private.sync_protocols set retires_at = now() + interval '2 days', urgent_reason = 'A security fix needs this update.' where protocol = 1`;
  });

  it('shows the retirement date in sync status while the protocol still syncs', async () => {
    const { phone } = await signedIn();
    await sql`update private.sync_protocols set retires_at = now() + interval '31 days' where protocol = 1`;
    const [row] = await sql<{ retiresAt: Date }[]>`select retires_at as "retiresAt" from private.sync_protocols where protocol = 1`;
    const result = await phone.playPracticeSession();
    await settle(phone);

    expect(phone.account.sync.status.update).toEqual({ state: 'retiring', retiresAt: Math.floor(row!.retiresAt.getTime() / 1000) * 1000, reason: null });
    expect(await sessionsOn(phone)).toEqual([result.activityId]);
  });

  it('a retired protocol stops sync, not play: the server refuses its operations, records are kept, and nothing loops', async () => {
    const { phone } = await signedIn();
    const raw = localStack().rawClient(accessToken(phone));
    await retireProtocolOne();

    const attempts = watchRequests(phone, 'sync_protocol');
    const result = await phone.playPracticeSession();
    const another = await phone.playPracticeSession();
    await settle(phone);
    expect(phone.account.sync.status).toMatchObject({ error: 'incompatible', update: { state: 'required', reason: null } });
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(2);
    expect((await phone.vault.store().load(another.activityId))?.completion).toEqual(another);

    // The server enforces it, whatever the client does.
    for (const [operation, args] of [
      ['sync_upload_v1', { request: '{}' }],
      ['sync_feed_v1', { after: 0 }],
      ['realtime_claim_v1', {}],
    ] as const) {
      const { error, status } = await raw.rpc(operation, args);
      expect({ operation, status, code: error?.code }).toEqual({ operation, status: 426, code: 'PT426' });
    }
    expect((await raw.rpc('sync_protocol', { protocol: 1 })).data).toEqual({ status: 'retired', reason: null });

    await timePasses(phone, 10 * 60_000, 1_000);
    expect(attempts.length).toBeLessThan(14);
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(2);
    expect(result.activityId).not.toBe(another.activityId);
  });

  it('an urgent restriction is explained in sync status', async () => {
    const { phone } = await signedIn();
    await sql`update private.sync_protocols set retires_at = now() + interval '1 second', urgent_reason = 'A security fix needs this update.' where protocol = 1`;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await phone.account.sync.reconcile();
    expect(phone.account.sync.status.update).toEqual({ state: 'required', reason: 'A security fix needs this update.' });
  });

  it('local work migrates through the update before sync resumes, and nothing is discarded', async () => {
    const { phone, tablet } = await twoDevices();
    await retireProtocolOne();
    const waiting = [await phone.playPracticeSession(), await phone.playPracticeSession()];
    await settle(phone);
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(2);
    phone.kill();

    // The update: a later build with two more store migrations, installed over the
    // phone. It speaks a protocol the server serves (here protocol 1 is served
    // again, standing in for its successor).
    await sql`update private.sync_protocols set retires_at = null where protocol = 1`;
    // Its vault opens the database only at the later build's schema, after
    // migrating it, and sync starts only once the database is open.
    const updated = device('phone', { installedOver: phone, migrations: laterBuild() });
    expect(await updated.account.resume()).toEqual({ status: 'resumed' });
    await settle(updated);

    expect(await updated.vault.store().readUploadQueue()).toEqual([]);
    expect((await sessionsOn(updated)).sort()).toEqual(waiting.map((result) => result.activityId).sort());
    tablet.clock.advance(RECONCILE_INTERVAL_MS);
    await settle(tablet);
    expect((await sessionsOn(tablet)).sort()).toEqual(waiting.map((result) => result.activityId).sort());
    // Each counted once.
    expect(new Set((await tablet.vault.store().readAcceptedRecords(completedPracticeSession.name)).map((record) => record.sequence)).size).toBe(2);
  });
});

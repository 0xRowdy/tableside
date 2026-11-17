// #91

import { afterEach, describe, expect, it } from 'vitest';

import { PLATFORM_TABLES, RECONCILE_INTERVAL_MS, completedPracticeSession, recordTypes } from '../src';
import { type DirectCommands, type SimulatedDevice, accessToken, createAccountByEmail, createDevice, directCommands, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(localStack(), { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function twoDevices(options: { readonly tabletRefusesLive?: boolean } = {}) {
  const phone = device('phone');
  const tablet = device('tablet');
  if (options.tabletRefusesLive) tablet.proxy.refuseLive = true;
  const email = uniqueEmail('sync');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);
  return { phone, tablet, email };
}

async function sessionsOn(d: SimulatedDevice) {
  return (await d.vault.store().readAcceptedRecords(completedPracticeSession.name)).map(({ item, sequence }) => ({ item, sequence }));
}

async function minutePasses(d: SimulatedDevice) {
  d.clock.advance(RECONCILE_INTERVAL_MS);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await d.account.sync.idle();
}

async function eventually(check: () => Promise<void> | void, milliseconds = 10_000) {
  const deadline = Date.now() + milliseconds;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

describe('a completed practice session reaches the account’s other device', () => {
  it('uploads after it is saved, with no other prompt, and appears on the other device exactly as saved', async () => {
    const { phone, tablet } = await twoDevices();

    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();

    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    expect(await sessionsOn(phone)).toEqual([{ item: result.activityId, sequence: 1 }]);

    await minutePasses(tablet);
    const onTablet = await tablet.vault.store().readAcceptedRecords(completedPracticeSession.name);
    expect(onTablet).toEqual([{ recordType: 'completed-practice-session', item: result.activityId, sequence: 1, payload: result }]);
  });

  it('counts each session once on both devices when both play, at the same moment', async () => {
    const { phone, tablet } = await twoDevices();

    const [onPhone, onTablet] = await Promise.all([
      phone.playPracticeSession().then(async (first) => [first, await phone.playPracticeSession()]),
      tablet.playPracticeSession(),
    ]);
    const results = [...onPhone, onTablet];
    await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);
    await Promise.all([phone.account.sync.reconcile(), tablet.account.sync.reconcile()]);

    const ids = results.map((result) => result.activityId).sort();
    for (const d of [phone, tablet]) {
      const sessions = await sessionsOn(d);
      expect(sessions.map((session) => session.item).sort()).toEqual(ids);
      expect(sessions.map((session) => session.sequence)).toEqual([1, 2, 3]);
    }
  });
});

describe('when devices reconcile', () => {
  it('on opening the app', async () => {
    const { phone, tablet } = await twoDevices();
    tablet.kill();
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();

    await tablet.restart();
    await tablet.account.sync.idle();
    expect(await sessionsOn(tablet)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });

  it('on coming to the foreground, and not every 60 s while in the background', async () => {
    const { phone, tablet } = await twoDevices();
    tablet.foreground = false;
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();

    const before = tablet.proxy.requests;
    await minutePasses(tablet);
    expect(tablet.proxy.requests).toBe(before);
    expect(await sessionsOn(tablet)).toEqual([]);

    tablet.foreground = true;
    await tablet.account.sync.idle();
    expect(await sessionsOn(tablet)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });

  it('on reconnecting, and not every 60 s while offline', async () => {
    const { phone, tablet } = await twoDevices();
    tablet.proxy.online = false;
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();

    const before = tablet.proxy.requests;
    await minutePasses(tablet);
    expect(tablet.proxy.requests).toBe(before);

    tablet.proxy.online = true;
    await tablet.account.sync.idle();
    expect(await sessionsOn(tablet)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });

  it('uploads a session saved offline once the device reconnects', async () => {
    const { phone, tablet } = await twoDevices();
    phone.proxy.online = false;
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(1);

    phone.proxy.online = true;
    await phone.account.sync.idle();
    await minutePasses(tablet);
    expect(await sessionsOn(tablet)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });
});

describe('kills, lost answers and duplicates count each session exactly once', () => {
  async function countedOnce(phone: SimulatedDevice, tablet: SimulatedDevice, activityId: string) {
    await phone.account.sync.reconcile();
    await tablet.account.sync.reconcile();
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    for (const d of [phone, tablet]) expect(await sessionsOn(d)).toEqual([{ item: activityId, sequence: 1 }]);
  }

  it('killed after saving, before uploading: the restarted app uploads it', async () => {
    const { phone, tablet } = await twoDevices();
    phone.proxy.online = false;
    const result = await phone.playPracticeSession();
    phone.kill();
    phone.proxy.online = true;

    await phone.restart();
    await phone.account.sync.idle();
    await countedOnce(phone, tablet, result.activityId);
  });

  it('killed after the server committed the upload, before its answer arrived: the retry gets the durable receipt', async () => {
    const { phone, tablet } = await twoDevices();
    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    const result = await phone.playPracticeSession();
    await held.arrived;
    phone.kill();
    held.release();

    await phone.restart();
    await phone.account.sync.idle();
    await countedOnce(phone, tablet, result.activityId);
  });

  it('killed after the answer arrived, before its acknowledgement committed: the retry gets the same receipt', async () => {
    const { phone, tablet } = await twoDevices();
    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    const result = await phone.playPracticeSession();
    await held.arrived;
    phone.diskFailing = true;
    held.release();
    await phone.account.sync.idle();
    phone.diskFailing = false;
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(1);
    phone.kill();

    await phone.restart();
    await phone.account.sync.idle();
    await countedOnce(phone, tablet, result.activityId);
  });

  it('the final answer is lost: the session stays queued, and the next reconcile resends it identically', async () => {
    const { phone, tablet } = await twoDevices();
    phone.proxy.dropNextResponse('sync_upload_v1');
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();
    const [queued] = await phone.vault.store().readUploadQueue();
    expect(queued?.operation).not.toBeNull();
    expect(phone.account.sync.status.error).toBe('offline');

    const raw = localStack().rawClient(accessToken(phone));
    expect((await raw.rpc('sync_upload_v1', { request: queued!.operation!.request })).data).toMatchObject({ status: 'accepted', sequence: 1 });
    await countedOnce(phone, tablet, result.activityId);
  });

  it('a duplicated upload and a duplicated feed request', async () => {
    const { phone, tablet } = await twoDevices();
    phone.proxy.duplicateNextRequest('sync_upload_v1');
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();
    tablet.proxy.duplicateNextRequest('sync_feed_v1');
    await countedOnce(phone, tablet, result.activityId);
  });

  it('killed while the other device applied a feed page: the page applies once after the restart', async () => {
    const { phone, tablet } = await twoDevices();
    tablet.foreground = false;
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();

    tablet.diskFailing = true;
    await tablet.account.sync.reconcile().catch(() => undefined);
    tablet.diskFailing = false;
    expect(await sessionsOn(tablet)).toEqual([]);
    expect(await tablet.vault.store().readFeedCursor()).toBe(0);
    tablet.kill();

    await tablet.restart();
    await tablet.account.sync.idle();
    await countedOnce(phone, tablet, result.activityId);
  });

  it('a late answer for an earlier account session writes nothing into the next account', async () => {
    const { phone, tablet } = await twoDevices();
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();

    const held = tablet.proxy.delayNextResponse('sync_feed_v1');
    const pending = tablet.account.sync.reconcile();
    await held.arrived;
    expect(await createAccountByEmail(tablet, uniqueEmail('other'))).toEqual({ status: 'signed-in' });
    held.release();
    await pending;
    await tablet.account.sync.idle();
    expect(await sessionsOn(tablet)).toEqual([]);
    expect(await tablet.vault.store().readFeedCursor()).toBe(0);
    await phone.account.sync.reconcile();
    expect(await sessionsOn(phone)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });
});

describe('the synchronization head', () => {
  it('makes an upload wait for a contending transaction on the account, then commit after it', async () => {
    const { phone } = await twoDevices();
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('unreachable');
    const { sql } = localStack();
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    const contender = sql.begin(async (tx) => {
      await tx`insert into private.sync_heads (account_id) values (${gate.accountId}) on conflict do nothing`;
      await tx`select 1 from private.sync_heads where account_id = ${gate.accountId} for update`;
      locked();
      await released;
    });
    await isLocked;

    const result = await phone.playPracticeSession();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(await phone.vault.store().readUploadQueue()).toHaveLength(1);

    release();
    await contender;
    await phone.account.sync.idle();
    expect(await sessionsOn(phone)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });
});

describe('live updates', () => {
  it('bring a change to the live device without waiting for the 60 s reconciliation', async () => {
    const { phone, tablet } = await twoDevices();
    await eventually(() => expect(tablet.account.sync.status.live).toBe(true));

    const result = await phone.playPracticeSession();
    await eventually(async () => expect(await sessionsOn(tablet)).toEqual([{ item: result.activityId, sequence: 1 }]));
  });

  it('are held by the newest foregrounded device; the other leaves the connection and uses the 60 s path', async () => {
    const { phone, tablet } = await twoDevices();
    await eventually(() => {
      expect(tablet.account.sync.status.live).toBe(true);
      expect(phone.account.sync.status.live).toBe(false);
      expect(phone.proxy.openSockets).toBe(0);
    });

    phone.foreground = false;
    phone.foreground = true;
    await eventually(() => {
      expect(phone.account.sync.status.live).toBe(true);
      expect(tablet.account.sync.status.live).toBe(false);
      expect(tablet.proxy.openSockets).toBe(0);
    });

    const result = await tablet.playPracticeSession();
    await tablet.account.sync.idle();
    await eventually(async () => expect(await sessionsOn(phone)).toEqual([{ item: result.activityId, sequence: 1 }]));
    const later = await phone.playPracticeSession();
    await phone.account.sync.idle();
    await minutePasses(tablet);
    expect((await sessionsOn(tablet)).map((session) => session.item)).toEqual([result.activityId, later.activityId]);
  });

  it('end in the background and offline', async () => {
    const { tablet } = await twoDevices();
    await eventually(() => expect(tablet.account.sync.status.live).toBe(true));
    tablet.foreground = false;
    await eventually(() => expect([tablet.account.sync.status.live, tablet.proxy.openSockets]).toEqual([false, 0]));

    tablet.foreground = true;
    await eventually(() => expect(tablet.account.sync.status.live).toBe(true));
    tablet.proxy.online = false;
    await eventually(() => expect([tablet.account.sync.status.live, tablet.proxy.openSockets]).toEqual([false, 0]));
  });

  it('fall back to the 60 s reconciliation when the connection is refused', async () => {
    const { phone, tablet } = await twoDevices({ tabletRefusesLive: true });
    const result = await phone.playPracticeSession();
    await phone.account.sync.idle();
    expect(tablet.account.sync.status.live).toBe(false);

    await minutePasses(tablet);
    expect(await sessionsOn(tablet)).toEqual([{ item: result.activityId, sequence: 1 }]);
  });
});

describe('the operation API, called directly', () => {
  let installation = '';
  async function signedIn() {
    const { phone, tablet } = await twoDevices();
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('unreachable');
    installation = phone.vault.store().identity.installationId;
    const raw = localStack().rawClient(accessToken(phone));
    commands = await directCommands(raw, installation);
    return { phone, tablet, accountId: gate.accountId, raw };
  }

  let commands: DirectCommands;

  function request(fields: { operation: string; owner: string; activityId?: string; device?: string; protocol?: number; payload?: object }) {
    const activityId = fields.activityId ?? 'activity-1';
    const device = fields.device ?? installation;
    const payload = fields.payload ?? {
      recordVersion: 1,
      activityId,
      owner: fields.owner,
      device,
      game: 'roulette',
      startedAt: 1,
      endedAt: 2,
      netResult: '10',
      finalCashOut: '1010',
    };
    return JSON.stringify(
      Object.fromEntries(
        Object.entries({
          command: commands.next(),
          installation: device,
          item: activityId,
          operation: fields.operation,
          payload,
          payloadVersion: 1,
          protocol: fields.protocol ?? 1,
          recordType: 'completed-practice-session',
        }).sort(),
      ),
    );
  }

  it('returns the durable receipt for an identical retry and refuses a different request under the same operation ID', async () => {
    const { raw, accountId } = await signedIn();
    const first = request({ operation: 'a'.repeat(32), owner: accountId });

    const accepted = (await raw.rpc('sync_upload_v1', { request: first })).data as { status: string; sequence: number; requestHash: string };
    expect(accepted).toMatchObject({ status: 'accepted', sequence: 1, operation: 'a'.repeat(32) });
    expect((await raw.rpc('sync_upload_v1', { request: first })).data).toEqual(accepted);

    const changed = request({ operation: 'a'.repeat(32), owner: accountId, activityId: 'activity-2' });
    expect((await raw.rpc('sync_upload_v1', { request: changed })).data).toEqual({ status: 'operation-reused', operation: 'a'.repeat(32) });
    expect((await raw.rpc('sync_feed_v1', { after: 0 })).data).toMatchObject({ entries: [{ sequence: 1, item: 'activity-1' }], more: false });
  });

  it('accepts a result once even under a second operation, and never accepts different content under its identity', async () => {
    const { raw, accountId } = await signedIn();
    await raw.rpc('sync_upload_v1', { request: request({ operation: 'b'.repeat(32), owner: accountId }) });

    expect((await raw.rpc('sync_upload_v1', { request: request({ operation: 'c'.repeat(32), owner: accountId }) })).data).toMatchObject({
      status: 'accepted',
      sequence: 1,
    });
    const altered = request({
      operation: 'd'.repeat(32),
      owner: accountId,
      payload: { recordVersion: 1, activityId: 'activity-1', owner: accountId, device: installation, game: 'roulette', startedAt: 1, endedAt: 2, netResult: '999', finalCashOut: '1999' },
    });
    expect((await raw.rpc('sync_upload_v1', { request: altered })).data).toMatchObject({ status: 'rejected', code: 'identity-reused' });
    expect(((await raw.rpc('sync_feed_v1', { after: 0 })).data as { entries: unknown[] }).entries).toHaveLength(1);
  });

  it('takes the owner from authentication: a record naming another account is refused', async () => {
    const { raw } = await signedIn();
    const other = device('other');
    expect(await createAccountByEmail(other, uniqueEmail('victim'))).toEqual({ status: 'signed-in' });
    const victim = other.account.gate;
    if (victim.state !== 'active') throw new Error('unreachable');

    const answer = (await raw.rpc('sync_upload_v1', { request: request({ operation: 'e'.repeat(32), owner: victim.accountId }) })).data;
    expect(answer).toMatchObject({ status: 'rejected', code: 'owner-mismatch' });
    await other.account.sync.reconcile();
    expect(await sessionsOn(other)).toEqual([]);
  });

  it('asks an outdated protocol to update, and denies a caller with no session', async () => {
    const { raw, accountId } = await signedIn();
    expect((await raw.rpc('sync_upload_v1', { request: request({ operation: 'f'.repeat(32), owner: accountId, protocol: 2 }) })).data).toEqual({
      status: 'incompatible',
      supported: [1],
    });

    const anonymous = localStack().rawClient();
    expect((await anonymous.rpc('sync_upload_v1', { request: request({ operation: 'f'.repeat(32), owner: accountId }) })).error).not.toBeNull();
    expect((await anonymous.rpc('sync_feed_v1', { after: 0 })).error).not.toBeNull();
  });

  it('pages the feed in bounded pages after a cursor', async () => {
    const { raw, accountId } = await signedIn();
    for (const [index, operation] of ['1', '2', '3'].entries()) {
      await raw.rpc('sync_upload_v1', { request: request({ operation: operation.repeat(32), owner: accountId, activityId: `activity-${index}` }) });
    }
    const page = (after: number) => raw.rpc('sync_feed_v1', { after, page_size: 2 }).then(({ data }) => data as { entries: { sequence: number }[]; more: boolean });
    expect(await page(0)).toMatchObject({ entries: [{ sequence: 1 }, { sequence: 2 }], more: true });
    expect(await page(2)).toMatchObject({ entries: [{ sequence: 3 }], more: false });
  });
});

describe('the record-type registry', () => {
  it('registers each type on the server with the same kind, acceptance operation and snapshot function, and covers every table holding it in deletion', async () => {
    const { sql } = localStack();
    for (const type of recordTypes.values()) {
      const [row] = await sql<{ kind: string; accept: string; snapshot: string | null }[]>`
        select kind, accept::regproc::text as accept, snapshot::regproc::text as snapshot from private.record_types
        where record_type = ${type.name} and payload_version = ${type.payloadVersion}`;
      expect(row).toEqual({ kind: type.kind, accept: type.acceptance, snapshot: type.snapshot });
      for (const table of [...type.deletion.serverTables, ...PLATFORM_TABLES]) {
        const [schema, name] = table.split('.');
        const columns = await sql`select 1 from information_schema.columns where table_schema = ${schema!} and table_name = ${name!} and column_name = 'account_id'`;
        expect(columns, table).toHaveLength(1);
      }
    }
  });
});

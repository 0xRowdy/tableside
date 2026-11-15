// Seam 2, devices and revocation (#101, S2-19; spec 2 *Sessions, revocation
// and the authorization gate*, Amendment 1 B3 and C3). Each session maps to a
// registered installation; Devices lists them with platform, label, last
// activity and "this device", never inferring which physical device one is
// from what it calls itself. Signing a device out (all its sessions), or all
// other devices (keeping only this session), needs Confirm it's you and sends
// a security email. The revoked device learns it only from the server's
// lifecycle status, then suspends at once, locks and closes, keeping its
// records, until a fresh sign-in to the same account.

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeviceEntry } from '../src';
import {
  type SimulatedDevice,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  signInByEmail,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

function device(name: string, options: { readonly platform?: 'ios' | 'android'; readonly label?: string } = {}): SimulatedDevice {
  const created = createDevice(stack, { name, ...options });
  devices.push(created);
  return created;
}

/** A new email account on a phone, and the same account signed in on a tablet. */
async function phoneAndTablet(label: string) {
  const phone = device(`${label}-phone`, { label: 'iPhone 15 · iOS 18' });
  const tablet = device(`${label}-tablet`, { label: 'iPad Air · iPadOS 18' });
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { phone, tablet, email, accountId: gate.accountId };
}

/** Confirm it's you with an emailed code (as if the code-request backoff had passed since signing in). */
async function confirmByEmail(phone: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email);
  expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
  expect(await phone.account.freshAuthentication.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
}

/** Signs a further device in, as if the code-request backoff had passed since the last code. */
async function signInAlso(other: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  expect(await signInByEmail(other, email)).toEqual({ status: 'signed-in' });
}

const listed = async (phone: SimulatedDevice) => (await phone.account.devices.list()) ?? [];
const other = async (phone: SimulatedDevice, label: string) => (await listed(phone)).find((entry) => entry.label === label)!;
/** The Auth session an access token belongs to. */
const sessionOf = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { session_id: string }).session_id;
const sessionExists = async (session: string) => (await stack.sql`select 1 from auth.sessions where id = ${session}`).length > 0;

describe('Devices', () => {
  it('lists each signed-in device with its platform, label, last activity and which is this one', async () => {
    const { phone, tablet, email } = await phoneAndTablet('list');
    const pixel = device('list-pixel', { platform: 'android', label: 'Pixel 8 · Android 15' });
    await signInAlso(pixel, email);

    const entries = await listed(phone);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual<DeviceEntry>({ id: expect.any(String), platform: 'ios', label: 'iPhone 15 · iOS 18', lastActiveAt: expect.any(Number), thisDevice: true });
    expect(entries.slice(1).map(({ platform, label, thisDevice }) => ({ platform, label, thisDevice }))).toEqual(
      expect.arrayContaining([
        { platform: 'ios', label: 'iPad Air · iPadOS 18', thisDevice: false },
        { platform: 'android', label: 'Pixel 8 · Android 15', thisDevice: false },
      ]),
    );
    // Every device sees itself as this device, and the same list.
    expect((await listed(tablet)).find((entry) => entry.thisDevice)?.label).toBe('iPad Air · iPadOS 18');
    expect((await listed(tablet)).map((entry) => entry.id).sort()).toEqual(entries.map((entry) => entry.id).sort());
    expect(await phone.account.accountSummary()).toMatchObject({ devices: 3 });
  });

  it('counts a device once when an offline sign-out left its earlier session open', async () => {
    const { phone, tablet, email } = await phoneAndTablet('offline-out');
    tablet.proxy.online = false;
    expect(await tablet.account.signOut()).toEqual({ status: 'signed-out', serverSessionEnded: false });
    tablet.proxy.online = true;
    await signInAlso(tablet, email);

    expect((await listed(phone)).map((entry) => entry.label).sort()).toEqual(['iPad Air · iPadOS 18', 'iPhone 15 · iOS 18']);
    expect(await phone.account.accountSummary()).toMatchObject({ devices: 2 });
  });

  it('lists a session that never registered as an unknown device, so nothing signed in hides', async () => {
    const { phone, email } = await phoneAndTablet('unregistered');
    const raw = stack.rawClient();
    await stack.ageCodeRequests(email, 3600);
    const previous = await phone.mailbox.latestCode(email);
    await stack.requestCode({ email, intent: 'sign-in' });
    expect((await raw.auth.verifyOtp({ email, token: await phone.mailbox.latestCode(email, { after: previous }), type: 'email' })).error).toBeNull();

    const unknown = (await listed(phone)).find((entry) => entry.label === null);
    expect(unknown).toEqual({ id: expect.any(String), platform: null, label: null, lastActiveAt: expect.any(Number), thisDevice: false });
    await confirmByEmail(phone, email);
    expect(await phone.account.devices.signOut(unknown!.id)).toMatchObject({ status: 'signed-out', devices: 1 });
    expect((await raw.rpc('current_account')).data).toBeNull();
  });

  it('never lets a session pass itself off as another device of the account', async () => {
    const { phone, tablet } = await phoneAndTablet('claimed');
    const raw = stack.rawClient(accessToken(phone));
    const tabletInstallation = tablet.vault.store().identity.installationId;
    // Without the tablet's installation secret, nothing joins the phone's session to it.
    expect((await raw.rpc('register_device_v1', { installation: tabletInstallation, secret: null, platform: 'ios', label: 'iPad Air · iPadOS 18' })).data).toEqual({
      status: 'installation-claimed',
    });
    // A session registered to one installation stays there.
    expect((await raw.rpc('register_device_v1', { installation: 'another-installation', secret: null, platform: 'ios', label: 'iPhone' })).data).toEqual({
      status: 'session-bound',
    });
    // And it can't upload as the tablet: the envelope names the caller's own installation.
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('unreachable');
    const payload = { activityId: 'activity-1', device: tabletInstallation, endedAt: 2, finalCashOut: '1010', game: 'roulette', netResult: '10', owner: gate.accountId, recordVersion: 1, startedAt: 1 };
    const request = JSON.stringify({ installation: tabletInstallation, item: 'activity-1', operation: '9'.repeat(32), payload, payloadVersion: 1, protocol: 1, recordType: 'completed-practice-session' });
    expect((await raw.rpc('sync_upload_v1', { request })).error).not.toBeNull();
  });
});

describe('signing out another device', () => {
  it('needs Confirm it’s you, revokes every session of that device, and sends a security email', async () => {
    const { phone, tablet, email } = await phoneAndTablet('one');
    const since = await stack.serverNow();
    const ipad = await other(phone, 'iPad Air · iPadOS 18');
    expect(await phone.account.devices.signOut(ipad.id)).toEqual({ status: 'fresh-authentication-required' });
    expect(tablet.account.gate.state).toBe('active');

    await confirmByEmail(phone, email);
    const tabletSession = sessionOf(accessToken(tablet));
    expect(await phone.account.devices.signOut(ipad.id)).toEqual({ status: 'signed-out', devices: 1, email });
    expect(await sessionExists(tabletSession)).toBe(false);
    expect((await listed(phone)).map((entry) => entry.label)).toEqual(['iPhone 15 · iOS 18']);
    expect(await stack.emailSends(since)).toContainEqual({ type: 'device-revoked', pacing: 'immediate', outcome: 'sent' });
    const [notice] = await phone.mailbox.messages(email);
    expect(notice).toContain('A device was signed out of your Tableside account.');
    // The notice names no device: labels are only what each device called itself.
    expect(notice).not.toContain('iPad');
    // This device is never signed out this way: that is Sign out.
    const mine = (await listed(phone))[0]!;
    expect(await phone.account.devices.signOut(mine.id)).toEqual({ status: 'failed' });
    expect(phone.account.gate.state).toBe('active');
  });

  it('locks the revoked device when it hears from the server, suspending play and keeping its records', async () => {
    const { phone, tablet, email, accountId } = await phoneAndTablet('locks');
    const saved = await tablet.playPracticeSession();
    await tablet.account.sync.idle();
    tablet.proxy.online = false;
    const unsynced = await tablet.playPracticeSession();
    const playing = await tablet.startPracticeSession();

    await confirmByEmail(phone, email);
    expect(await phone.account.devices.signOut((await other(phone, 'iPad Air · iPadOS 18')).id)).toMatchObject({ status: 'signed-out' });
    // Nothing happens on the tablet until the server says so.
    expect(tablet.account.gate.state).toBe('active');
    tablet.proxy.online = true;
    await tablet.account.refreshEligibility();

    expect(tablet.account.gate).toEqual({ state: 'revoked', accountId, revokedAt: expect.any(Number) });
    expect(playing.snapshot()).toMatchObject({ suspension: { cause: 'sign-out' } });
    expect(tablet.vault.openAccount).toBeNull();
    expect(tablet.credentials.items.has(`tableside.${tablet.environment}.auth`)).toBe(false);

    // The next launch stays locked, offline.
    tablet.proxy.online = false;
    await tablet.restart();
    expect(tablet.account.gate).toEqual({ state: 'revoked', accountId, revokedAt: expect.any(Number) });

    // A fresh sign-in to the same account opens the same records, unsynced ones included.
    tablet.proxy.online = true;
    await signInAlso(tablet, email);
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(await tablet.vault.store().load(saved.activityId)).not.toBeNull();
    expect(await tablet.vault.store().load(unsynced.activityId)).not.toBeNull();
  });

  it('reaches a device awaiting renewal as an immediate suspend, and a foregrounded one within a minute', async () => {
    const { phone, tablet, email, accountId } = await phoneAndTablet('cadence');
    // The tablet's token expires while it is away, so it reopens awaiting renewal.
    tablet.proxy.online = false;
    tablet.clock.advance(2 * 60 * 60_000);
    await tablet.restart();
    expect(tablet.account.gate.state).toBe('renewal-pending');
    const playing = await tablet.startPracticeSession();

    await confirmByEmail(phone, email);
    expect(await phone.account.devices.signOutOthers()).toMatchObject({ status: 'signed-out', devices: 1 });

    // Its renewal is refused: that alone proves nothing, but the server's status does.
    tablet.proxy.online = true;
    await tablet.account.renew();
    expect(tablet.account.gate).toEqual({ state: 'revoked', accountId, revokedAt: expect.any(Number) });
    expect(playing.snapshot()).toMatchObject({ suspension: { cause: 'sign-out' } });

    // A device left in the foreground hears it on the connected cadence.
    const laptop = device('cadence-laptop');
    await signInAlso(laptop, email);
    await confirmByEmail(phone, email);
    expect(await phone.account.devices.signOutOthers()).toMatchObject({ status: 'signed-out', devices: 1 });
    laptop.clock.advance(60_000);
    await vi.waitFor(() => expect(laptop.account.gate.state).toBe('revoked'));
  });

  it('never moves to Revoked on a lost answer, a server fault, a refused token or a refused renewal alone', async () => {
    const { tablet, accountId } = await phoneAndTablet('no-proof');
    tablet.proxy.dropNextResponse('lifecycle_status_v1');
    await tablet.account.refreshEligibility();
    tablet.proxy.serverFaultNext('lifecycle_status_v1', '57014');
    await tablet.account.refreshEligibility();
    tablet.proxy.rejectTokenNext('current_account');
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });

    // A renewal refused for a session nobody revoked (its refresh token gone, say) stays Renewal pending.
    const session = sessionOf(accessToken(tablet));
    tablet.proxy.online = false;
    tablet.clock.advance(2 * 60 * 60_000);
    await tablet.restart();
    await stack.sql`delete from auth.refresh_tokens where session_id = ${session}`;
    tablet.proxy.online = true;
    await tablet.account.renew();
    expect(tablet.account.gate.state).toBe('renewal-pending');
    expect(tablet.vault.openAccount).toBe(accountId);
  });
});

describe('signing out all other devices', () => {
  it('keeps only this session, after Confirm it’s you, with one security email', async () => {
    const { phone, tablet, email } = await phoneAndTablet('others');
    const pixel = device('others-pixel', { label: 'Pixel 8 · Android 15', platform: 'android' });
    await signInAlso(pixel, email);
    const since = await stack.serverNow();
    expect(await phone.account.devices.signOutOthers()).toEqual({ status: 'fresh-authentication-required' });

    await confirmByEmail(phone, email);
    expect(await phone.account.devices.signOutOthers()).toEqual({ status: 'signed-out', devices: 2, email });
    expect((await listed(phone)).map((entry) => entry.label)).toEqual(['iPhone 15 · iOS 18']);
    expect(await phone.account.accountSummary()).toMatchObject({ devices: 1 });
    expect((await stack.emailSends(since)).filter((send) => send.type === 'device-revoked')).toEqual([{ type: 'device-revoked', pacing: 'immediate', outcome: 'sent' }]);
    for (const signedOut of [tablet, pixel]) {
      await signedOut.account.refreshEligibility();
      expect(signedOut.account.gate.state).toBe('revoked');
    }
    expect(phone.account.gate.state).toBe('active');
  });

  it('waits for an upload holding the account’s synchronization head; later requests are denied', async () => {
    const { phone, tablet, email, accountId } = await phoneAndTablet('boundary');
    await confirmByEmail(phone, email);
    const tabletSession = sessionOf(accessToken(tablet));
    let revoked: Promise<unknown> = Promise.resolve();
    // A transaction holding the head stands in for an upload already accepted under it.
    await stack.sql.begin(async (holding) => {
      await holding`insert into private.sync_heads (account_id) values (${accountId}) on conflict do nothing`;
      await holding`select 1 from private.sync_heads where account_id = ${accountId} for update`;
      revoked = phone.account.devices.signOutOthers();
      await new Promise((resolve) => setTimeout(resolve, 750));
      expect(await sessionExists(tabletSession)).toBe(true);
    });
    expect(await revoked).toMatchObject({ status: 'signed-out', devices: 1 });
    expect(await sessionExists(tabletSession)).toBe(false);
  });
});

describe('the lifecycle status', () => {
  /** The status credential a device holds for its session. */
  const statusToken = (phone: SimulatedDevice) => (JSON.parse(phone.credentials.items.get(`tableside.${phone.environment}.status`)!) as { token: string }).token;
  const status = async (token: string) => {
    const { data, error } = await stack.rawClient().rpc('lifecycle_status_v1', { token });
    return error ? 'no answer' : data;
  };

  it('answers only active, revoked, deletion scheduled with its deadline, or deleted, for the caller’s own session', async () => {
    const { phone, tablet, email, accountId } = await phoneAndTablet('status');
    const token = statusToken(tablet);
    expect(await status(token)).toEqual({ status: 'active' });
    expect(await status('0'.repeat(64))).toBe('no answer');
    expect(await status('not a token')).toBe('no answer');

    await confirmByEmail(phone, email);
    await phone.account.devices.signOutOthers();
    expect(await status(token)).toEqual({ status: 'revoked', at: expect.any(String) });
    // It restores nothing: the session's token is still refused.
    expect((await stack.rawClient(accessToken(tablet)).rpc('current_account')).data).toBeNull();

    const phoneToken = statusToken(phone);
    const deadline = new Date(Date.now() + 30 * 86_400_000);
    await stack.sql`update public.accounts set state = 'deletion_scheduled', deletion_deadline = ${deadline} where account_id = ${accountId}`;
    const scheduled = (await status(phoneToken)) as { status: string; deadline: string };
    expect(scheduled.status).toBe('deletion-scheduled');
    expect(Date.parse(scheduled.deadline)).toBe(deadline.getTime());

    // After the Auth user is gone it keeps answering, from the account's own records.
    await stack.sql`update public.accounts set state = 'deleted' where account_id = ${accountId}`;
    await stack.sql`delete from auth.users where id = (select auth_user_id from public.accounts where account_id = ${accountId})`;
    expect(await status(phoneToken)).toEqual({ status: 'deleted' });
    expect(await status(token)).toEqual({ status: 'deleted' });
  });

  it('gives a session that simply ended no answer: Sign out isn’t a revocation', async () => {
    const { tablet } = await phoneAndTablet('ended');
    const token = statusToken(tablet);
    expect(await tablet.account.signOut()).toEqual({ status: 'signed-out', serverSessionEnded: true });
    expect(await status(token)).toBe('no answer');
  });
});

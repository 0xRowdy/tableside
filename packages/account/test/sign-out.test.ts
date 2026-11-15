// Seam 2, signing out of this device (#99, spec 2 *Sessions, revocation*):
// current-session scope only, an open practice session saved and paused
// through spec 1's direct suspend, the database closed and kept with its key,
// credentials cleared. Offline it acts at once and never claims the server
// session ended. Another account on the same installation sees none of the
// first account's data, and late answers for the first account are dropped.

import { afterEach, describe, expect, it } from 'vitest';

import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function signedIn(phone: SimulatedDevice, label: string) {
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { email, accountId: gate.accountId };
}

/** The Auth credentials this device holds for its environment, if any. */
const authCredentials = (phone: SimulatedDevice) => phone.credentials.items.get(`tableside.${phone.environment}.auth`) ?? null;
const accessToken = (stored: string) => (JSON.parse(stored) as { access_token: string }).access_token;

/** Whether the server still accepts an access token for its own account. */
async function serverAccepts(token: string): Promise<boolean> {
  const { data, error } = await stack.rawClient(token).rpc('current_account');
  return !error && data !== null;
}

describe('signing out of this device', () => {
  it('ends only this session on the server, closes and keeps the database, and clears credentials', async () => {
    const phone = device('sign-out');
    const tablet = device('sign-out-tablet');
    const { email, accountId } = await signedIn(phone, 'sign-out');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    const saved = await phone.playPracticeSession();
    await phone.account.sync.idle();
    const token = accessToken(authCredentials(phone)!);
    const tabletToken = accessToken(authCredentials(tablet)!);

    expect(await phone.account.signOut()).toEqual({ status: 'signed-out', serverSessionEnded: true });
    expect(phone.account.gate).toEqual({ state: 'signed-out', accountId });
    expect(phone.vault.openAccount).toBeNull();
    expect(authCredentials(phone)).toBeNull();
    // This session ended; the tablet's (another session of the account) did not.
    expect(await serverAccepts(token)).toBe(false);
    expect(await serverAccepts(tabletToken)).toBe(true);

    // The next launch stays signed out, offline, sending nothing.
    phone.proxy.online = false;
    const sent = phone.proxy.sent.length;
    await phone.restart();
    expect(phone.account.gate).toEqual({ state: 'signed-out', accountId });
    expect(phone.vault.openAccount).toBeNull();
    expect(phone.proxy.sent.length).toBe(sent);

    // Signing in to the same account online reopens the same database.
    phone.proxy.online = true;
    // A third code for the address in a minute would wait out its pacing.
    await stack.resetCodeRequests();
    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(await phone.vault.store().load(saved.activityId)).not.toBeNull();
  });

  it('saves and pauses an open practice session first, so it resumes after signing back in', async () => {
    const phone = device('sign-out-practice');
    const { email } = await signedIn(phone, 'sign-out-practice');
    const practice = await phone.startPracticeSession();
    // A wager is still saving when the player signs out: it finishes, then nothing more happens.
    const saving = practice.placeWager('red', '10');

    await phone.account.signOut();
    await saving;
    expect(practice.snapshot()).toMatchObject({ status: 'active', suspension: { cause: 'sign-out' } });
    expect(phone.vault.openAccount).toBeNull();

    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    expect(await phone.vault.store().findUnfinished()).toMatchObject({ sequence: 1 });
  });

  it('offline, signs out locally at once and never claims the server session ended', async () => {
    const phone = device('sign-out-offline');
    const { accountId } = await signedIn(phone, 'sign-out-offline');
    const token = accessToken(authCredentials(phone)!);
    phone.proxy.online = false;

    expect(await phone.account.signOut()).toEqual({ status: 'signed-out', serverSessionEnded: false });
    expect(phone.account.gate).toEqual({ state: 'signed-out', accountId });
    expect(phone.vault.openAccount).toBeNull();
    expect(authCredentials(phone)).toBeNull();
    // The server was never told, and nothing pretends it was.
    expect(await serverAccepts(token)).toBe(true);
  });
});

describe('another account on the same installation', () => {
  it('sees none of the first account\'s records or activities', async () => {
    const phone = device('shared-tablet');
    const first = await signedIn(phone, 'shared-first');
    await phone.playPracticeSession();
    const unfinished = await phone.startPracticeSession();
    await unfinished.placeWager('red', '10');
    await phone.account.sync.idle();
    await phone.account.signOut();

    const second = await signedIn(phone, 'shared-second');
    expect(second.accountId).not.toBe(first.accountId);
    await phone.account.sync.idle();
    const store = phone.vault.store();
    expect(await store.findUnfinished()).toBeNull();
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);
    expect(await store.readUploadQueue()).toEqual([]);
  });

  it('drops a late answer for the first account', async () => {
    const phone = device('late-answer');
    await signedIn(phone, 'late-first');
    await phone.playPracticeSession();
    // The first account's upload answer is held past its sign-out and the next sign-in.
    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    void phone.account.sync.reconcile();
    await held.arrived;
    await phone.account.signOut();
    await signedIn(phone, 'late-second');

    held.release();
    await phone.account.sync.idle();
    const store = phone.vault.store();
    expect(await store.readAcceptedRecords('completed-practice-session')).toEqual([]);
    expect(await store.readUploadQueue()).toEqual([]);
  });
});

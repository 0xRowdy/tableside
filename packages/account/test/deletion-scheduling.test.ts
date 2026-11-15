// Seam 2, scheduling deletion with a 30-day undo (#103, S2-22, S2-23; spec 2
// *Deletion*, Amendments 1 A1, B2, B3, C2 and C3, 3 §3–4, 5 §2, 7 §4 and
// 9 §1). After Confirm it's you, scheduling is one transaction serialized with
// uploads, linking and purchases: the account is deletion scheduled with a
// server-set deadline 30 days out, ordinary access is denied while the
// restricted paths stay (cancel, status, export, billing and support help),
// public content is hidden, exports end, and a durable receipt answers a
// retry. Sessions, methods and data stay: nothing irreversible happens until
// the deadline (#104). Cancel deletion needs Confirm it's you again and
// restores the same account; signing in or renewing never cancels.

import { afterEach, describe, expect, it, vi } from 'vitest';

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

const DAY_MS = 24 * 60 * 60_000;

function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}

async function signedInPhone(label: string) {
  const phone = device(`${label}-phone`);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { phone, email, accountId: gate.accountId };
}

/** Confirm it's you with an emailed code (as if the code-request backoff had passed since the last code). */
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

describe('scheduling deletion', () => {
  it('needs Confirm it’s you, then locks the account with a server-set deadline 30 days out', async () => {
    const { phone, email, accountId } = await signedInPhone('schedule');
    expect(await phone.account.deletion.schedule()).toEqual({ status: 'fresh-authentication-required' });
    expect(phone.account.gate.state).toBe('active');

    await confirmByEmail(phone, email);
    const before = (await stack.serverNow()).getTime();
    const scheduled = await phone.account.deletion.schedule();
    const after = (await stack.serverNow()).getTime();
    if (scheduled.status !== 'scheduled') throw new Error(`schedule ${scheduled.status}`);
    expect(scheduled.deadline).toBeGreaterThanOrEqual(before + 30 * DAY_MS - 1000);
    expect(scheduled.deadline).toBeLessThanOrEqual(after + 30 * DAY_MS + 1000);
    expect(phone.account.gate).toEqual({ state: 'deletion-scheduled', accountId, deadline: scheduled.deadline });
    expect(await phone.account.deletion.status()).toEqual({ status: 'scheduled', deadline: scheduled.deadline, scheduledAt: expect.any(Number) });
  });

  it('denies ordinary access at once, keeping sessions, sign-in methods and records', async () => {
    const { phone, email, accountId } = await signedInPhone('ordinary');
    const saved = await phone.playPracticeSession();
    await phone.account.sync.idle();
    const token = accessToken(phone);
    const identities = await identityCount(accountId);
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });

    const raw = stack.rawClient(token);
    // The authorization gate denies ordinary operations: RLS, methods, sync.
    expect((await raw.from('accounts').select('account_id')).data).toEqual([]);
    expect((await raw.rpc('sign_in_methods_v1')).data).toBeNull();
    expect((await raw.rpc('sync_scope_v1', { installation: phone.vault.store().identity.installationId })).error).not.toBeNull();
    // Nothing irreversible: the session, its methods and the records stay, here and on the server.
    expect(await sessionExists(sessionOf(token))).toBe(true);
    expect(await identityCount(accountId)).toBe(identities);
    expect(await stack.sql`select 1 from private.practice_results where account_id = ${accountId}`).toHaveLength(1);
    expect(phone.vault.openAccount).toBe(accountId);
    expect(await phone.vault.store().load(saved.activityId)).not.toBeNull();
    // And it says what happened, with the deadline and how to undo it.
    const [notice] = await phone.mailbox.messages(email);
    expect(notice).toContain('scheduled for permanent deletion on');
    expect(notice).toContain('Cancel deletion');
    expect(notice).toContain("doesn't cancel a subscription");
  });

  it('ends a live export, and the account may ask for a new one during the window', async () => {
    const { phone, email, accountId } = await signedInPhone('exports');
    await confirmByEmail(phone, email);
    expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested' });
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });
    expect(await stack.sql`select state, ended_by from private.exports where account_id = ${accountId}`).toEqual([
      { state: 'invalidated', ended_by: 'deletion-scheduled' },
    ]);

    // During the window: a new server export (after Confirm it's you), and the local supplement.
    await confirmByEmail(phone, email);
    expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested' });
    expect(await phone.account.export.localSupplement()).not.toBeNull();
  });

  it('learns what a request whose answer was lost did, from the server', async () => {
    const { phone, email, accountId } = await signedInPhone('lost-status');
    await confirmByEmail(phone, email);
    phone.proxy.dropNextResponse('schedule-deletion');
    expect(await phone.account.deletion.schedule()).toEqual({ status: 'failed' });
    // It asked the server what became of the account: deletion is scheduled.
    const [row] = await stack.sql<{ deletion_deadline: Date }[]>`select deletion_deadline from public.accounts where account_id = ${accountId}`;
    expect(phone.account.gate).toEqual({ state: 'deletion-scheduled', accountId, deadline: row!.deletion_deadline.getTime() });
  });

  it('answers a retry of a request whose answer was lost with what happened, scheduling it once', async () => {
    const { phone, email, accountId } = await signedInPhone('lost');
    await confirmByEmail(phone, email);
    const since = await stack.serverNow();
    phone.proxy.dropNextResponse('schedule-deletion');
    phone.proxy.dropNextResponse('lifecycle_status_v1');
    expect(await phone.account.deletion.schedule()).toEqual({ status: 'failed' });
    // No proof reached the device, so it doesn't lock on its own.
    expect(phone.account.gate.state).toBe('active');

    const retried = await phone.account.deletion.schedule();
    if (retried.status !== 'scheduled') throw new Error(`retry ${retried.status}`);
    const [row] = await stack.sql<{ deletion_deadline: Date }[]>`select deletion_deadline from public.accounts where account_id = ${accountId}`;
    expect(retried.deadline).toBe(row!.deletion_deadline.getTime());
    expect(await stack.sql`select 1 from private.deletion_receipts where account_id = ${accountId}`).toHaveLength(1);
    expect((await stack.emailSends(since)).filter((send) => send.type === 'deletion-scheduled')).toEqual([
      { type: 'deletion-scheduled', pacing: 'immediate', outcome: 'sent' },
    ]);
  });

  it('never accepts a retry again once its scheduling was canceled', async () => {
    const { phone, email, accountId } = await signedInPhone('replay');
    const token = accessToken(phone);
    await confirmByEmail(phone, email);
    const [user] = await stack.sql<{ auth_user_id: string }[]>`select auth_user_id from public.accounts where account_id = ${accountId}`;
    const request = { session: sessionOf(token), auth_user: user!.auth_user_id, operation_id: 'b'.repeat(32) };
    expect((await stack.serviceClient().rpc('schedule_deletion', request)).data).toMatchObject({ status: 'scheduled', accepted: true });
    await phone.account.refreshEligibility();
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'canceled' });

    // The same request again (a retry arriving late): not a second scheduling.
    expect((await stack.serviceClient().rpc('schedule_deletion', request)).data).toEqual({ status: 'none', accepted: false });
    expect(await accountState(accountId)).toBe('active');
  });

  it('is serialized with uploads: a device that hasn’t heard yet has its later uploads refused, and keeps them', async () => {
    const { phone, email, accountId } = await signedInPhone('uploads');
    const tablet = device('uploads-tablet');
    await signInAlso(tablet, email);
    tablet.proxy.online = false;
    await tablet.playPracticeSession();
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });

    tablet.proxy.online = true;
    await tablet.account.sync.reconcile();
    await tablet.account.sync.idle();
    expect(await stack.sql`select 1 from private.practice_results where account_id = ${accountId}`).toHaveLength(0);
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate.state).toBe('deletion-scheduled');
    // Kept on the device, for export or for after a cancel.
    expect(await tablet.account.export.localSupplement()).toMatchObject({ unsynced: [expect.objectContaining({ recordType: 'completed-practice-session' })] });
  });

  it('needs a connection: there is no offline queue', async () => {
    const { phone, email } = await signedInPhone('offline');
    await confirmByEmail(phone, email);
    phone.proxy.online = false;
    expect(await phone.account.deletion.schedule()).toEqual({ status: 'offline' });
    phone.proxy.online = true;
    expect(phone.account.gate.state).toBe('active');
  });

  it('is serialized with linking: a link to a deletion-scheduled account is refused', async () => {
    const { phone, email, accountId } = await signedInPhone('linking');
    const token = accessToken(phone);
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });
    const [user] = await stack.sql<{ auth_user_id: string }[]>`select auth_user_id from public.accounts where account_id = ${accountId}`;
    const { data } = await stack.serviceClient().rpc('link_provider_identity', {
      session: sessionOf(token),
      auth_user: user!.auth_user_id,
      provider: 'google',
      subject: `linking-${accountId}`,
      claims: {},
    });
    expect(data).toEqual({ status: 'not-signed-in' });
    expect(await identityCount(accountId)).toBe(1);
  });

  it('is never scheduled by a player’s token directly, only through its function', async () => {
    const { phone, email, accountId } = await signedInPhone('direct');
    await confirmByEmail(phone, email);
    const [user] = await stack.sql<{ auth_user_id: string }[]>`select auth_user_id from public.accounts where account_id = ${accountId}`;
    const raw = stack.rawClient(accessToken(phone));
    const { error } = await raw.rpc('schedule_deletion', { session: sessionOf(accessToken(phone)), auth_user: user!.auth_user_id, operation_id: 'a'.repeat(32) });
    expect(error).not.toBeNull();
    expect(await accountState(accountId)).toBe('active');
  });
});

describe('a device learning deletion is scheduled', () => {
  it('suspends play at once and locks, keeping its records open for the restricted paths', async () => {
    const { phone, email, accountId } = await signedInPhone('learns');
    const tablet = device('learns-tablet');
    await signInAlso(tablet, email);
    const saved = await tablet.playPracticeSession();
    await tablet.account.sync.idle();
    const playing = await tablet.startPracticeSession();

    await confirmByEmail(phone, email);
    const scheduled = await phone.account.deletion.schedule();
    if (scheduled.status !== 'scheduled') throw new Error(`schedule ${scheduled.status}`);
    // Nothing changes on the tablet until the server says so.
    expect(tablet.account.gate.state).toBe('active');
    await tablet.account.refreshEligibility();

    expect(tablet.account.gate).toEqual({ state: 'deletion-scheduled', accountId, deadline: scheduled.deadline });
    await vi.waitFor(() => expect(playing.snapshot()).toMatchObject({ status: 'active', suspension: { cause: 'access', kind: 'immediate', reached: true } }));
    // Its session stays (scheduling revokes nothing), and so do its records, for export.
    expect(tablet.vault.openAccount).toBe(accountId);
    expect(await tablet.vault.store().load(saved.activityId)).not.toBeNull();
    expect(await tablet.account.export.localSupplement()).not.toBeNull();

    // The next launch stays locked, offline.
    tablet.proxy.online = false;
    await tablet.restart();
    expect(tablet.account.gate).toEqual({ state: 'deletion-scheduled', accountId, deadline: scheduled.deadline });
  });

  it('opens locked when signing in to it, and signing in or renewing never cancels', async () => {
    const { phone, email, accountId } = await signedInPhone('sign-in');
    await confirmByEmail(phone, email);
    const scheduled = await phone.account.deletion.schedule();
    if (scheduled.status !== 'scheduled') throw new Error(`schedule ${scheduled.status}`);

    const laptop = device('sign-in-laptop');
    await signInAlso(laptop, email);
    expect(laptop.account.gate).toEqual({ state: 'deletion-scheduled', accountId, deadline: scheduled.deadline });
    // Its token expires and renews: still scheduled.
    laptop.clock.advance(2 * 60 * 60_000);
    await laptop.account.renew();
    await laptop.account.refreshEligibility();
    expect(laptop.account.gate.state).toBe('deletion-scheduled');
    expect(await accountState(accountId)).toBe('deletion_scheduled');
  });
});

describe('canceling deletion', () => {
  it('needs Confirm it’s you again, then restores the same account with its records', async () => {
    const { phone, email, accountId } = await signedInPhone('cancel');
    const saved = await phone.playPracticeSession();
    await phone.account.sync.idle();
    const tablet = device('cancel-tablet');
    await signInAlso(tablet, email);
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate.state).toBe('deletion-scheduled');

    await staleFreshAuthentication(accessToken(phone));
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'fresh-authentication-required' });
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'canceled' });

    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(await accountState(accountId)).toBe('active');
    expect(await phone.account.deletion.status()).toEqual({ status: 'none' });
    expect(await phone.vault.store().load(saved.activityId)).not.toBeNull();
    // Ordinary access is back: it plays and syncs as the same account.
    await phone.playPracticeSession();
    await phone.account.sync.idle();
    expect(await phone.account.sync.countWaiting()).toBe(0);
    expect(await stack.sql`select 1 from private.practice_results where account_id = ${accountId}`).toHaveLength(2);
    // The other device reopens when it hears.
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });

  it('learns what a cancel whose answer was lost did, and a retry cancels it once', async () => {
    const { phone, email, accountId } = await signedInPhone('lost-cancel');
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });

    phone.proxy.dropNextResponse('cancel_deletion_v1');
    phone.proxy.dropNextResponse('lifecycle_status_v1');
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'failed' });
    expect(phone.account.gate.state).toBe('deletion-scheduled');
    expect(await accountState(accountId)).toBe('active');
    // The same request again: the account is active, and nothing more is accepted.
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'canceled' });
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(await stack.sql`select 1 from private.deletion_receipts where account_id = ${accountId} and action = 'cancel'`).toHaveLength(1);
  });

  it('changes nothing once the deadline has passed, or once the account is deleted', async () => {
    const { phone, email, accountId } = await signedInPhone('stale');
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });

    // The deadline passed before the job ran: only the server's finalization may follow.
    await stack.sql`update public.accounts set deletion_deadline = now() - interval '1 second' where account_id = ${accountId}`;
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'too-late' });
    expect(await accountState(accountId)).toBe('deletion_scheduled');

    // Finalized (#104's deadline finalization): a stale cancel is refused, and the device learns the account is deleted.
    await stack.sql`select private.finalize_deletion(${accountId})`;
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'failed' });
    expect(await accountState(accountId)).toBe('deleted');
    expect(phone.account.gate).toEqual({ state: 'deleted' });
  });
});

const sessionOf = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { session_id: string }).session_id;
const sessionExists = async (session: string) => (await stack.sql`select 1 from auth.sessions where id = ${session}`).length > 0;
const identityCount = async (accountId: string) =>
  (await stack.sql`select 1 from auth.identities i join public.accounts a on a.auth_user_id = i.user_id where a.account_id = ${accountId}`).length;
const accountState = async (accountId: string) =>
  (await stack.sql<{ state: string }[]>`select state from public.accounts where account_id = ${accountId}`)[0]!.state;
/** Moves the session's fresh authentication past its few minutes, as if they had passed. */
const staleFreshAuthentication = (token: string) =>
  stack.sql`update private.fresh_authentications set authenticated_at = now() - interval '6 minutes' where session_id = ${sessionOf(token)}`;

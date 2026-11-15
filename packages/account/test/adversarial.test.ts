// Seam 2 adversarial cases (#84): a raw client calls the stack directly, with
// no Account service in between, and is denied wherever the contract says.

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ENVIRONMENT_HEADER } from '../src';
import {
  Mailbox,
  type SimulatedDevice,
  TestIdentityProvider,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
const mailbox = new Mailbox(stack.mailUrl);

const rawClient = (accessToken?: string) => stack.rawClient(accessToken);

async function issueAssertion(client: SupabaseClient, range = '18+'): Promise<string> {
  const { data, error } = await client.rpc('issue_eligibility_assertion', { age_range: range });
  if (error) throw error;
  return (data as { assertion: string }).assertion;
}

const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** An active account, and a raw client signed in to it by email code. */
async function signedInAccount(label: string) {
  const email = uniqueEmail(label);
  const device = createDevice(stack, { name: label });
  devices.push(device);
  await createAccountByEmail(device, email);
  const gate = device.account.gate;
  if (gate.state !== 'active') throw new Error('account setup failed');

  const client = rawClient();
  const previous = await mailbox.latestCode(email);
  await stack.requestCode({ email, intent: 'sign-in' });
  const { data, error } = await client.auth.verifyOtp({ email, token: await mailbox.latestCode(email, { after: previous }), type: 'email' });
  if (error || !data.session) throw error ?? new Error('no session');
  return { accountId: gate.accountId, client, accessToken: data.session.access_token };
}

describe('creating an Auth user', () => {
  const idp = new TestIdentityProvider();
  beforeAll(() => idp.start());
  afterAll(() => idp.stop());

  it('is refused for an email code without an assertion', async () => {
    const email = uniqueEmail('no-assertion');
    const { error } = await rawClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    expect(error).not.toBeNull();
    expect(await stack.authUserId(email)).toBeNull();
  });

  it('is refused for a forged assertion', async () => {
    const email = uniqueEmail('forged');
    const { error } = await rawClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { eligibility_assertion: 'a'.repeat(64), environment: 'local' } },
    });
    expect(error).not.toBeNull();
    expect(await stack.authUserId(email)).toBeNull();
  });

  it('accepts an assertion once', async () => {
    const assertion = await issueAssertion(rawClient());
    const first = uniqueEmail('first');
    const second = uniqueEmail('second');
    expect(await stack.requestCode({ email: first, intent: 'create', assertion })).toEqual({ status: 200, body: { status: 'sent' } });
    expect(await stack.requestCode({ email: second, intent: 'create', assertion })).toEqual({ status: 403, body: { status: 'age-required' } });
    expect(await stack.authUserId(first)).not.toBeNull();
    expect(await stack.authUserId(second)).toBeNull();
  });

  it('lets only one of two racing sign-ups use an assertion', async () => {
    const assertion = await issueAssertion(rawClient());
    const emails = [uniqueEmail('race-a'), uniqueEmail('race-b')];
    await Promise.all(emails.map((email) => stack.requestCode({ email, intent: 'create', assertion })));
    const created = await Promise.all(emails.map((email) => stack.authUserId(email)));
    expect(created.filter((id) => id !== null)).toHaveLength(1);
  });

  it('is refused once the assertion has expired on the server', async () => {
    const assertion = await issueAssertion(rawClient());
    await stack.expireAssertion(assertion);
    const email = uniqueEmail('expired');
    expect(await stack.requestCode({ email, intent: 'create', assertion })).toEqual({ status: 403, body: { status: 'age-required' } });
    expect(await stack.authUserId(email)).toBeNull();
  });

  it('is refused for Create without an assertion, whether or not the address has an account', async () => {
    const known = uniqueEmail('create-known');
    const device = createDevice(stack, { name: 'setup' });
    devices.push(device);
    await createAccountByEmail(device, known);
    for (const email of [known, uniqueEmail('create-unknown')]) {
      expect(await stack.requestCode({ email, intent: 'create' })).toEqual({ status: 403, body: { status: 'age-required' } });
      expect(await stack.requestCode({ email, intent: 'create', assertion: 'a'.repeat(64) })).toEqual({ status: 403, body: { status: 'age-required' } });
    }
  });

  it('gets no assertion for under 13 or an unknown range', async () => {
    for (const range of ['under-13', 'adult', '']) {
      const { error } = await rawClient().rpc('issue_eligibility_assertion', { age_range: range });
      expect(error).not.toBeNull();
    }
  });

  it('Auth’s own code endpoint emails nothing, even for an address with an account', async () => {
    const email = uniqueEmail('raw-otp');
    const device = createDevice(stack, { name: 'setup' });
    devices.push(device);
    await createAccountByEmail(device, email);
    const before = (await mailbox.messages(email)).length;
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect((await rawClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } })).error).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await mailbox.messages(email)).toHaveLength(before);
  });

  // GoTrue v2.188 answers `otp_disabled` for an unknown address before any hook
  // runs, and a refused send for a known one, so a raw caller can still tell
  // them apart (no email is sent either way). Handed to launch gate 3 (#109).
  it.todo('Auth’s own code endpoint answers the same for an address with an account and one without');

  it('is refused for a password sign-up without an assertion', async () => {
    const email = uniqueEmail('password');
    const { error } = await rawClient().auth.signUp({ email, password: 'correct horse battery staple' });
    expect(error).not.toBeNull();
    expect(await stack.authUserId(email)).toBeNull();
  });

  it('is refused for a new identity from an identity provider', async () => {
    const email = uniqueEmail('provider');
    const { error } = await rawClient().auth.signInWithIdToken({
      provider: idp.provider,
      token: idp.idToken({ subject: `subject-${email}`, email }),
    });
    expect(error?.message).toMatch(/eligibility_assertion_required/);
    expect(await stack.authUserId(email)).toBeNull();
  });
});

describe('reading accounts', () => {
  let a: Awaited<ReturnType<typeof signedInAccount>>;
  let b: Awaited<ReturnType<typeof signedInAccount>>;
  beforeAll(async () => {
    a = await signedInAccount('reader-a');
    b = await signedInAccount('reader-b');
  });

  it('a signed-in client sees only its own account and eligibility rows', async () => {
    expect((await a.client.from('accounts').select('account_id')).data).toEqual([{ account_id: a.accountId }]);
    expect((await a.client.from('eligibility').select('account_id, band')).data).toEqual([{ account_id: a.accountId, band: '18+' }]);
    expect((await a.client.rpc('current_account')).data).toEqual({ account_id: a.accountId, eligibility: '18+', source: 'declaration', currency: 'USD' });
  });

  it('a client without a session sees nothing', async () => {
    const anonymous = rawClient();
    expect((await anonymous.from('accounts').select('account_id')).data ?? []).toEqual([]);
    expect((await anonymous.from('eligibility').select('account_id')).data ?? []).toEqual([]);
    expect((await anonymous.rpc('current_account')).error).not.toBeNull();
  });

  it('a client cannot write account state, currency or eligibility', async () => {
    await a.client.from('accounts').update({ state: 'deleted' }).eq('account_id', a.accountId);
    // The currency changes only through set_account_currency_v1, which checks for casino sessions.
    await a.client.from('accounts').update({ currency: 'EUR' }).eq('account_id', a.accountId);
    await a.client.from('eligibility').update({ band: '13-15' }).eq('account_id', a.accountId);
    expect((await a.client.from('eligibility').insert({ account_id: b.accountId, band: '18+', source: 'declaration', checked_at: new Date().toISOString(), policy_version: 1 })).error).not.toBeNull();
    expect((await a.client.rpc('current_account')).data).toEqual({ account_id: a.accountId, eligibility: '18+', source: 'declaration', currency: 'USD' });
    // The operation changes only the caller's own account.
    expect((await a.client.rpc('set_account_currency_v1', { new_currency: 'JPY' })).data).toEqual({ status: 'changed' });
    expect((await b.client.rpc('current_account')).data).toMatchObject({ currency: 'USD' });
  });

  it('storage holds each account’s objects in its own folder only', async () => {
    const bucket = (client: SupabaseClient) => client.storage.from('account-private');
    expect((await bucket(b.client).upload(`${b.accountId}/notes.txt`, 'b’s notes')).error).toBeNull();
    expect((await bucket(a.client).upload(`${a.accountId}/notes.txt`, 'a’s notes')).error).toBeNull();

    expect((await bucket(a.client).download(`${b.accountId}/notes.txt`)).error).not.toBeNull();
    expect((await bucket(a.client).upload(`${b.accountId}/planted.txt`, 'planted')).error).not.toBeNull();
    expect((await bucket(a.client).list(b.accountId)).data ?? []).toEqual([]);
    expect(await (await bucket(a.client).download(`${a.accountId}/notes.txt`)).data?.text()).toBe('a’s notes');
  });
});

describe('the authorization gate', () => {
  it('denies an account that is not active, in RLS, storage and functions', async () => {
    const a = await signedInAccount('inactive');
    const bucket = a.client.storage.from('account-private');
    expect((await bucket.upload(`${a.accountId}/before.txt`, 'kept')).error).toBeNull();

    await stack.sql`update public.accounts set state = 'deletion_scheduled' where account_id = ${a.accountId}`;
    expect((await a.client.from('accounts').select('account_id')).data).toEqual([]);
    expect((await a.client.from('eligibility').select('account_id')).data).toEqual([]);
    expect((await a.client.rpc('current_account')).data).toBeNull();
    expect((await bucket.download(`${a.accountId}/before.txt`)).error).not.toBeNull();
    expect((await bucket.upload(`${a.accountId}/after.txt`, 'denied')).error).not.toBeNull();
  });

  // #101: signed out from another device. Export delivery (#102), grant
  // issuance (spec 5) and publication (spec 6) don't exist yet; they go
  // through the same gate (private.active_account / signed_in_account).
  it('denies a device signed out from another device on every path, while its access token is unexpired', async () => {
    const email = uniqueEmail('revoked-device');
    const phone = createDevice(stack, { name: 'revoked-phone' });
    const tablet = createDevice(stack, { name: 'revoked-tablet' });
    devices.push(phone, tablet);
    await createAccountByEmail(phone, email);
    await stack.ageCodeRequests(email, 3600);
    const previous = await mailbox.latestCode(email);
    await tablet.account.requestEmailCode({ email, intent: 'sign-in' });
    await tablet.account.verifyEmailCode({ email, code: await mailbox.latestCode(email, { after: previous }) });
    const gate = tablet.account.gate;
    if (gate.state !== 'active') throw new Error('account setup failed');
    const { accountId } = gate;
    const token = accessToken(tablet);
    const stale = rawClient(token);
    const bucket = stale.storage.from('account-private');
    expect((await bucket.upload(`${accountId}/before.txt`, 'kept')).error).toBeNull();
    const installation = tablet.vault.store().identity.installationId;

    await stack.ageCodeRequests(email, 3600);
    const before = await mailbox.latestCode(email);
    await phone.account.freshAuthentication.requestCode();
    await phone.account.freshAuthentication.withCode(await mailbox.latestCode(email, { after: before }));
    expect(await phone.account.devices.signOutOthers()).toMatchObject({ status: 'signed-out', devices: 1 });

    // RLS tables and storage.
    expect((await stale.from('accounts').select('account_id')).data).toEqual([]);
    expect((await stale.from('eligibility').select('account_id')).data).toEqual([]);
    expect((await bucket.download(`${accountId}/before.txt`)).error).not.toBeNull();
    expect((await bucket.upload(`${accountId}/after.txt`, 'denied')).error).not.toBeNull();
    expect((await bucket.list(accountId)).data ?? []).toEqual([]);
    // Sync: uploads, staged chunks, the feed, the live connection's claim, totals.
    const payload = { activityId: 'activity-1', device: installation, endedAt: 2, finalCashOut: '1010', game: 'roulette', netResult: '10', owner: accountId, recordVersion: 1, startedAt: 1 };
    const request = JSON.stringify({ installation, item: 'activity-1', operation: '8'.repeat(32), payload, payloadVersion: 1, protocol: 1, recordType: 'completed-practice-session' });
    expect((await stale.rpc('sync_upload_v1', { request })).error).not.toBeNull();
    expect((await stale.rpc('sync_stage_chunk_v1', { protocol: 1, record_type: 'completed-practice-session', item: 'activity-1', sha256: '0'.repeat(64), data: 'AA' })).error).not.toBeNull();
    expect((await stale.rpc('sync_feed_v1', { after: 0 })).error).not.toBeNull();
    expect((await stale.rpc('realtime_claim_v1')).error).not.toBeNull();
    expect((await stale.rpc('account_totals_v1')).data ?? null).toBeNull();
    // Account operations, the restricted paths among them.
    expect((await stale.rpc('current_account')).data).toBeNull();
    expect((await stale.rpc('account_summary_v1')).data).toBeNull();
    expect((await stale.rpc('devices_v1')).data).toBeNull();
    expect((await stale.rpc('sign_in_methods_v1')).data).toBeNull();
    expect((await stale.rpc('caller_session_v1')).data).toBeNull();
    expect((await stale.rpc('issue_proof_nonce_v1')).error).not.toBeNull();
    expect((await stale.rpc('record_eligibility_v1', { band: '18+', source: 'declaration' })).error).not.toBeNull();
    expect((await stale.rpc('set_account_currency_v1', { new_currency: 'EUR' })).error).not.toBeNull();
    expect((await stale.rpc('register_device_v1', { installation, secret: null, platform: 'ios', label: 'again' })).error).not.toBeNull();
    // The functions acting for a player.
    for (const name of ['fresh-auth', 'link-method', 'revoke-devices']) {
      const response = await fetch(`${stack.url}/functions/v1/${name}`, {
        method: 'POST',
        headers: { apikey: stack.publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', [ENVIRONMENT_HEADER]: stack.environment },
        body: JSON.stringify(name === 'revoke-devices' ? { others: true } : { method: 'email', code: '123456' }),
      });
      await response.body?.cancel();
      expect(response.status).toBe(401);
    }
    // Its refresh token was revoked with it.
    const stored = JSON.parse(tablet.credentials.items.get(`tableside.${tablet.environment}.auth`)!) as { refresh_token: string };
    expect((await rawClient().auth.refreshSession({ refresh_token: stored.refresh_token })).error).not.toBeNull();
  });

  it('denies a revoked session even while its access token is unexpired', async () => {
    const a = await signedInAccount('revoked');
    await a.client.auth.signOut({ scope: 'local' });
    const stale = rawClient(a.accessToken);
    expect((await stale.from('accounts').select('account_id')).data).toEqual([]);
    expect((await stale.rpc('current_account')).data).toBeNull();
    expect((await stale.storage.from('account-private').upload(`${a.accountId}/after.txt`, 'denied')).error).not.toBeNull();
  });
});

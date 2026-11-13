// Seam 2 adversarial cases (#84): a raw client calls the stack directly, with
// no Account service in between, and is denied wherever the contract says.

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  Mailbox,
  type SimulatedDevice,
  TestIdentityProvider,
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
  await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
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
      options: { shouldCreateUser: true, data: { eligibility_assertion: 'a'.repeat(64) } },
    });
    expect(error).not.toBeNull();
    expect(await stack.authUserId(email)).toBeNull();
  });

  it('accepts an assertion once', async () => {
    const client = rawClient();
    const assertion = await issueAssertion(client);
    const first = uniqueEmail('first');
    const second = uniqueEmail('second');
    expect((await client.auth.signInWithOtp({ email: first, options: { data: { eligibility_assertion: assertion } } })).error).toBeNull();
    expect((await client.auth.signInWithOtp({ email: second, options: { data: { eligibility_assertion: assertion } } })).error).not.toBeNull();
    expect(await stack.authUserId(first)).not.toBeNull();
    expect(await stack.authUserId(second)).toBeNull();
  });

  it('lets only one of two racing sign-ups use an assertion', async () => {
    const client = rawClient();
    const assertion = await issueAssertion(client);
    const emails = [uniqueEmail('race-a'), uniqueEmail('race-b')];
    await Promise.all(emails.map((email) => client.auth.signInWithOtp({ email, options: { data: { eligibility_assertion: assertion } } })));
    const created = await Promise.all(emails.map((email) => stack.authUserId(email)));
    expect(created.filter((id) => id !== null)).toHaveLength(1);
  });

  it('is refused once the assertion has expired on the server', async () => {
    const client = rawClient();
    const assertion = await issueAssertion(client);
    await stack.expireAssertion(assertion);
    const email = uniqueEmail('expired');
    const { error } = await client.auth.signInWithOtp({ email, options: { data: { eligibility_assertion: assertion } } });
    expect(error).not.toBeNull();
    expect(await stack.authUserId(email)).toBeNull();
  });

  it('gets no assertion for under 13 or an unknown range', async () => {
    for (const range of ['under-13', 'adult', '']) {
      const { error } = await rawClient().rpc('issue_eligibility_assertion', { age_range: range });
      expect(error).not.toBeNull();
    }
  });

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
    expect((await a.client.rpc('current_account')).data).toEqual({ account_id: a.accountId, eligibility: '18+' });
  });

  it('a client without a session sees nothing', async () => {
    const anonymous = rawClient();
    expect((await anonymous.from('accounts').select('account_id')).data ?? []).toEqual([]);
    expect((await anonymous.from('eligibility').select('account_id')).data ?? []).toEqual([]);
    expect((await anonymous.rpc('current_account')).error).not.toBeNull();
  });

  it('a client cannot write account state or eligibility', async () => {
    await a.client.from('accounts').update({ state: 'deleted' }).eq('account_id', a.accountId);
    await a.client.from('eligibility').update({ band: '13-15' }).eq('account_id', a.accountId);
    expect((await a.client.from('eligibility').insert({ account_id: b.accountId, band: '18+', source: 'declaration', checked_at: new Date().toISOString(), policy_version: 1 })).error).not.toBeNull();
    expect((await a.client.rpc('current_account')).data).toEqual({ account_id: a.accountId, eligibility: '18+' });
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

  it('denies a revoked session even while its access token is unexpired', async () => {
    const a = await signedInAccount('revoked');
    await a.client.auth.signOut({ scope: 'local' });
    const stale = rawClient(a.accessToken);
    expect((await stale.from('accounts').select('account_id')).data).toEqual([]);
    expect((await stale.rpc('current_account')).data).toBeNull();
    expect((await stale.storage.from('account-private').upload(`${a.accountId}/after.txt`, 'denied')).error).not.toBeNull();
  });
});

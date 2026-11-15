// Seam 2: environment isolation (#87, spec 2 Amendment 1 A2). Beta and
// production are separate projects; one local stack plays each in turn
// (`asEnvironment`), which is how a scenario shows production refusing what
// beta made. Every request names its environment, every token carries the
// environment that issued it, and every account the environment it was made in.

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';

import { ENVIRONMENT_HEADER, type EnvironmentName } from '../src';
import { Mailbox, type SimulatedDevice, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const stack = localStack();
const mailbox = new Mailbox(stack.mailUrl);

const devices: SimulatedDevice[] = [];
function device(name: string, options: { environment?: EnvironmentName; installedOver?: SimulatedDevice } = {}): SimulatedDevice {
  const created = createDevice(stack, { name, ...options });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function createAccount(d: SimulatedDevice, email: string) {
  expect(await createAccountByEmail(d, email)).toEqual({ status: 'signed-in' });
  const gate = d.account.gate;
  if (gate.state !== 'active') throw new Error('unreachable');
  return gate.accountId;
}

/** A raw client signed in to an existing account by email code, naming `environment` on its requests. */
async function rawSignIn(email: string, environment: EnvironmentName): Promise<{ client: SupabaseClient; accessToken: string }> {
  const client = stack.rawClient(undefined, environment);
  const previous = await mailbox.latestCode(email);
  await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  const { data, error } = await client.auth.verifyOtp({ email, token: await mailbox.latestCode(email, { after: previous }), type: 'email' });
  if (error || !data.session) throw error ?? new Error('no session');
  return { client, accessToken: data.session.access_token };
}

const claims = (accessToken: string) => JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString()) as Record<string, unknown>;

describe('every request names its environment', () => {
  it('a device names its build’s environment on every request it sends', async () => {
    const phone = device('phone');
    await createAccount(phone, uniqueEmail('named'));

    expect(phone.proxy.sent.length).toBeGreaterThan(0);
    expect(phone.proxy.sent.map(({ headers }) => headers.get(ENVIRONMENT_HEADER))).toEqual(phone.proxy.sent.map(() => 'local'));
  });

  it('the server refuses a request naming another environment, or none', async () => {
    const email = uniqueEmail('refused');
    await createAccount(device('setup'), email);
    const { accessToken } = await rawSignIn(email, 'local');

    for (const environment of ['beta', 'production', null] as const) {
      const client = stack.rawClient(accessToken, environment);
      expect((await client.rpc('issue_eligibility_assertion', { age_range: '18+' })).error?.message).toBe('environment_mismatch');
      expect((await client.rpc('current_account')).error?.message).toBe('environment_mismatch');
      expect((await client.from('accounts').select('account_id')).error?.message).toBe('environment_mismatch');
    }
    expect((await stack.rawClient(accessToken).rpc('current_account')).error).toBeNull();
  });

  it('a sign-up must name this environment, even with a valid eligibility assertion', async () => {
    const client = stack.rawClient();
    for (const environment of ['production', undefined]) {
      const { data } = await client.rpc('issue_eligibility_assertion', { age_range: '18+' });
      const email = uniqueEmail('sign-up');
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { data: { eligibility_assertion: (data as { assertion: string }).assertion, environment } },
      });
      expect(error).not.toBeNull();
      expect(await stack.authUserId(email)).toBeNull();
    }
  });

  it('a build for another environment pointed at this backend creates nothing and never reaches an account', async () => {
    const known = uniqueEmail('known');
    await createAccount(device('setup'), known);
    const beta = device('beta-build', { environment: 'beta' });

    const email = uniqueEmail('cross');
    expect(await beta.account.answerAgeQuestion('18+')).toEqual({ status: 'failed' });
    expect(await beta.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'age-required' });
    expect(await stack.authUserId(email)).toBeNull();

    await beta.account.requestEmailCode({ email: known, intent: 'sign-in' });
    expect(await beta.account.verifyEmailCode({ email: known, code: await beta.mailbox.latestCode(known) })).toEqual({ status: 'failed' });
    expect(beta.account.gate).toEqual({ state: 'no-account' });
    expect(beta.vault.openAccount).toBeNull();
  });
});

describe('production rejects beta accounts and uploads', () => {
  it('an access token carries the environment that issued it', async () => {
    const email = uniqueEmail('claim');
    await createAccount(device('setup'), email);
    expect(claims((await rawSignIn(email, 'local')).accessToken)).toMatchObject({ environment: 'local' });
  });

  it('a beta session is refused by production, in functions, tables and storage, even when it names production', async () => {
    const email = uniqueEmail('beta-session');
    const { accountId, accessToken } = await stack.asEnvironment('beta', async () => {
      const accountId = await createAccount(device('tester', { environment: 'beta' }), email);
      const { client, accessToken } = await rawSignIn(email, 'beta');
      expect((await client.storage.from('account-private').upload(`${accountId}/beta.txt`, 'beta')).error).toBeNull();
      return { accountId, accessToken };
    });
    expect(claims(accessToken)).toMatchObject({ environment: 'beta' });

    await stack.asEnvironment('production', async () => {
      const stale = stack.rawClient(accessToken, 'production');
      expect((await stale.rpc('current_account')).data).toBeNull();
      expect((await stale.from('accounts').select('account_id')).data).toEqual([]);
      expect((await stale.storage.from('account-private').download(`${accountId}/beta.txt`)).error).not.toBeNull();
      expect((await stale.storage.from('account-private').upload(`${accountId}/upload.txt`, 'from beta')).error).not.toBeNull();
    });
  });

  // Each scenario makes its own beta account: Auth sends at most two codes an hour to an address.
  const betaAccount = async (label: string) => {
    const email = uniqueEmail(label);
    await stack.asEnvironment('beta', () => createAccount(device('tester', { environment: 'beta' }), email));
    return email;
  };

  it('a production build never reaches a beta account', async () => {
    const email = await betaAccount('beta-account');

    await stack.asEnvironment('production', async () => {
      const phone = device('production-phone', { environment: 'production' });
      await phone.account.requestEmailCode({ email, intent: 'sign-in' });
      expect(await phone.account.verifyEmailCode({ email, code: await phone.mailbox.latestCode(email) })).toEqual({ status: 'failed' });
      expect(phone.account.gate).toEqual({ state: 'no-account' });
      expect(phone.vault.openAccount).toBeNull();
    });
  });

  it('a beta account is refused by production even with a session production issued', async () => {
    const email = await betaAccount('beta-account-token');

    await stack.asEnvironment('production', async () => {
      const { client, accessToken } = await rawSignIn(email, 'production');
      expect(claims(accessToken)).toMatchObject({ environment: 'production' });
      expect((await client.rpc('current_account')).data).toBeNull();
      expect((await client.from('accounts').select('account_id')).data).toEqual([]);
    });
  });
});

describe('a production build installed over a beta build', () => {
  it('removes the beta namespace before it restores credentials, opens an account database or sends anything', async () => {
    const tester = await stack.asEnvironment('beta', async () => {
      const tester = device('tester', { environment: 'beta' });
      await createAccount(tester, uniqueEmail('tester'));
      return tester;
    });
    const betaAccount = tester.vault.openAccount;
    await tester.vault.close();
    // The beta build stops before the production build is installed over it; its last answers land first.
    tester.kill();
    await tester.account.sync.idle();
    const betaCredentials = () => [...tester.credentials.items.keys()].filter((key) => key.startsWith('tableside.beta.'));
    expect(tester.vault.holds('beta')).toBe(true);
    expect(betaCredentials()).not.toEqual([]);
    expect(tester.vault.removed).toEqual([]);
    const logBefore = tester.credentials.log.length;

    await stack.asEnvironment('production', async () => {
      const production = device('tester', { environment: 'production', installedOver: tester });
      const atEachRequest: { betaData: boolean; betaCredentials: string[] }[] = [];
      production.proxy.onRequest = () => atEachRequest.push({ betaData: production.vault.holds('beta'), betaCredentials: betaCredentials() });

      const accountId = await createAccount(production, uniqueEmail('durable'));

      expect(production.vault.removed).toEqual(['beta']);
      expect(atEachRequest.length).toBeGreaterThan(0);
      expect(atEachRequest.every(({ betaData, betaCredentials }) => !betaData && betaCredentials.length === 0)).toBe(true);
      // Credentials: every beta entry is removed before production's are first read, and no beta credential is ever restored.
      const log = tester.credentials.log.slice(logBefore);
      const lastBetaRemoval = log.map((entry) => entry.startsWith('remove tableside.beta.')).lastIndexOf(true);
      const firstProductionRead = log.findIndex((entry) => entry.startsWith('get tableside.production.'));
      expect(lastBetaRemoval).toBeGreaterThanOrEqual(0);
      expect(firstProductionRead).toBeGreaterThan(lastBetaRemoval);
      expect(log.filter((entry) => entry.startsWith('get tableside.beta.auth'))).toEqual([]);
      // Production starts fresh: a new account, never the beta one.
      expect(accountId).not.toBe(betaAccount);
      expect(production.vault.openAccount).toBe(accountId);
    });
  });

  it('a beta build removes nothing', async () => {
    const beta = await stack.asEnvironment('beta', async () => {
      const beta = device('tester', { environment: 'beta' });
      await createAccount(beta, uniqueEmail('beta-only'));
      return beta;
    });
    expect(beta.vault.removed).toEqual([]);
  });
});

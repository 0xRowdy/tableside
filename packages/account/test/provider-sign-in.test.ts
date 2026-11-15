// Seam 2: Apple and Google sign-in (#89), with the test identity provider
// standing in for both. Sign in never creates an account: when it finds none,
// it says so and leaves no Auth user, and Create runs the age step and then
// creates the account with the eligibility assertion bound to that identity.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { type ProviderIdentity, type SimulatedDevice, TestIdentityProvider, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const stack = localStack();
const idp = new TestIdentityProvider();
beforeAll(() => idp.start());
afterAll(() => idp.stop());

const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

function device(name: string, platform: 'ios' | 'android' = 'ios'): SimulatedDevice {
  const created = createDevice(stack, { name, identityProvider: idp, platform });
  devices.push(created);
  return created;
}

let counter = 0;
/** A person at the provider no earlier run has seen. */
function person(label: string, email = `${label}-${Date.now().toString(36)}-${counter}@example.com`): ProviderIdentity {
  counter += 1;
  return { subject: `${label}-${Date.now().toString(36)}-${counter}`, email };
}

/** Creates an account for `identity` on a fresh device, the way a new player does: age step, then Create with the provider. */
async function createWith(provider: 'apple' | 'google', identity: ProviderIdentity, band: '13-15' | '16-17' | '18+' = '18+') {
  const setup = device('setup');
  setup.providers!.accounts[provider] = identity;
  expect(await setup.account.answerAgeQuestion(band)).toEqual({ status: 'eligible' });
  expect(await setup.account.createWithProvider(provider)).toEqual({ status: 'created' });
  const gate = setup.account.gate;
  if (gate.state !== 'active') throw new Error('account setup failed');
  return gate.accountId;
}

const authUsersFor = async (identity: ProviderIdentity) =>
  (await stack.sql<{ id: string }[]>`select user_id as id from auth.identities where provider_id = ${identity.subject}`).length;

describe('Sign in with Apple or Google', () => {
  it('finds no account for a new identity, says so, and leaves no Auth user', async () => {
    const phone = device('phone');
    const someone = person('apple-new');
    phone.providers!.accounts.apple = someone;

    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'no-account' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
    expect(await stack.authUserId(someone.email)).toBeNull();
    expect(await authUsersFor(someone)).toBe(0);
  });

  it('signs in to the identity’s existing account on another device, without asking for age', async () => {
    const someone = person('google-existing');
    const accountId = await createWith('google', someone, '13-15');

    const tablet = device('tablet');
    tablet.providers!.accounts.google = someone;
    expect(await tablet.account.signInWithProvider('google')).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '13-15' });
    expect(tablet.vault.openAccount).toBe(accountId);
  });

  it('changes nothing when the player closes the provider’s sheet', async () => {
    const phone = device('phone');
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'cancelled' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
    expect(phone.proxy.sent.filter((request) => request.url.includes('/auth/'))).toEqual([]);
  });
});

describe('Create with Apple or Google', () => {
  it('after Sign in finds no account: the age step, then a new account with that band, without asking the provider again', async () => {
    const phone = device('phone');
    const someone = person('apple-create');
    phone.providers!.accounts.apple = someone;
    await phone.account.signInWithProvider('apple');

    expect(await phone.account.answerAgeQuestion('16-17')).toEqual({ status: 'eligible' });
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'created' });

    const gate = phone.account.gate;
    expect(gate).toMatchObject({ state: 'active', eligibility: '16-17' });
    if (gate.state !== 'active') throw new Error('unreachable');
    expect(gate.accountId).toBe(await stack.accountId(someone.email));
    expect(phone.vault.openAccount).toBe(gate.accountId);
    expect(phone.providers!.opened).toHaveLength(1);
  });
});

describe('the age step on Create', () => {
  it('under 13, after Sign in found no account, ends with no Auth user', async () => {
    const phone = device('phone');
    const child = person('apple-under13');
    phone.providers!.accounts.apple = child;
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'no-account' });

    expect(await phone.account.answerAgeQuestion('under-13')).toEqual({ status: 'ineligible' });
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'age-required' });
    expect(await stack.authUserId(child.email)).toBeNull();
    expect(await authUsersFor(child)).toBe(0);
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });

  it('is needed before Create, and Create without a Sign in asks the provider', async () => {
    const phone = device('phone');
    const someone = person('google-direct');
    phone.providers!.accounts.google = someone;
    expect(await phone.account.createWithProvider('google')).toEqual({ status: 'age-required' });
    expect(phone.providers!.opened).toEqual([]);

    await phone.account.answerAgeQuestion('18+');
    expect(await phone.account.createWithProvider('google')).toEqual({ status: 'created' });
    expect(phone.providers!.opened).toEqual([{ provider: 'google' }]);
    expect(phone.account.gate).toMatchObject({ state: 'active', eligibility: '18+' });
  });

  it('asks again when the assertion has expired on the server', async () => {
    const phone = device('phone');
    phone.providers!.accounts.apple = person('apple-expired');
    await phone.account.answerAgeQuestion('18+');
    await stack.sql`update private.eligibility_assertions set expires_at = now() - interval '1 second' where consumed_at is null and provider is null`;
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'age-required' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });
});

describe('Create for an identity that already has an account', () => {
  it('signs in to that account and says nothing was created', async () => {
    const someone = person('apple-twice');
    const accountId = await createWith('apple', someone);

    const tablet = device('tablet');
    tablet.providers!.accounts.apple = someone;
    await tablet.account.answerAgeQuestion('13-15');
    expect(await tablet.account.createWithProvider('apple')).toEqual({ status: 'signed-in' });
    // The account's own record governs; this device's answer is discarded.
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });
});

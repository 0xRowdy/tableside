// Seam 2: Apple and Google sign-in (#89), with the test identity provider
// standing in for both. Sign in never creates an account: when it finds none,
// it says so and leaves no Auth user, and Create runs the age step and then
// creates the account with the eligibility assertion bound to that identity.

import { createHash } from 'node:crypto';

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
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'canceled' });
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
    expect(await phone.account.createWithProvider('apple', { sameIdentity: true })).toEqual({ status: 'created' });

    const gate = phone.account.gate;
    expect(gate).toMatchObject({ state: 'active', eligibility: '16-17' });
    if (gate.state !== 'active') throw new Error('unreachable');
    expect(gate.accountId).toBe(await stack.accountId(someone.email));
    expect(phone.vault.openAccount).toBe(gate.accountId);
    expect(phone.providers!.opened).toHaveLength(1);
  });
});

describe('the account currency on Create', () => {
  it.each(['apple', 'google'] as const)('with %s starts in the creating device’s locale currency, as an email Create does', async (provider) => {
    const phone = createDevice(stack, { name: 'phone', identityProvider: idp, localeCurrency: 'EUR' });
    devices.push(phone);
    const someone = person(`${provider}-currency`);
    phone.providers!.accounts[provider] = someone;
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    expect(await phone.account.createWithProvider(provider)).toEqual({ status: 'created' });

    expect(await phone.account.accountSummary()).toMatchObject({ currency: 'EUR' });
    const [account] = await stack.sql<{ currency: string }[]>`select currency from public.accounts where account_id = ${await stack.accountId(someone.email)}`;
    expect(account?.currency).toBe('EUR');
  });
});

describe('the age step on Create', () => {
  it('under 13, after Sign in found no account, ends with no Auth user', async () => {
    const phone = device('phone');
    const child = person('apple-under13');
    phone.providers!.accounts.apple = child;
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'no-account' });

    expect(await phone.account.answerAgeQuestion('under-13')).toEqual({ status: 'ineligible' });
    expect(await phone.account.createWithProvider('apple', { sameIdentity: true })).toEqual({ status: 'age-required' });
    expect(await stack.authUserId(child.email)).toBeNull();
    expect(await authUsersFor(child)).toBe(0);
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });

  it('keeps nothing of the identity after an under-13 answer: a later Create asks the provider again', async () => {
    const phone = device('phone');
    phone.providers!.accounts.apple = person('apple-under13-later');
    await phone.account.signInWithProvider('apple');
    await phone.account.answerAgeQuestion('under-13');

    await phone.account.answerAgeQuestion('18+');
    expect(await phone.account.createWithProvider('apple', { sameIdentity: true })).toEqual({ status: 'created' });
    expect(phone.providers!.opened).toHaveLength(2);
  });

  it('a fresh Create asks the provider, even just after a Sign in found no account', async () => {
    const phone = device('phone');
    phone.providers!.accounts.google = person('google-fresh-create');
    await phone.account.signInWithProvider('google');
    await phone.account.answerAgeQuestion('18+');
    expect(await phone.account.createWithProvider('google')).toEqual({ status: 'created' });
    expect(phone.providers!.opened).toHaveLength(2);
  });

  it('asks for age again when the assertion runs out between binding it and Auth creating the user', async () => {
    const phone = device('phone');
    const someone = person('apple-expires-mid-create');
    phone.providers!.accounts.apple = someone;
    await phone.account.answerAgeQuestion('18+');
    const held = phone.proxy.delayNextResponse('bind-provider-assertion');
    const creating = phone.account.createWithProvider('apple');
    await held.arrived;
    await stack.sql`update private.eligibility_assertions set expires_at = now() - interval '1 second' where provider_subject = ${someone.subject}`;
    held.release();

    expect(await creating).toEqual({ status: 'age-required' });
    expect(await authUsersFor(someone)).toBe(0);
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

describe('Sign in with Apple on Android, through the system browser', () => {
  it('finds no account, then creates one after the age step, with only the state in the callback URL', async () => {
    const phone = device('android', 'android');
    const someone = person('apple-android');
    phone.providers!.accounts.apple = someone;

    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'no-account' });
    expect(await stack.authUserId(someone.email)).toBeNull();
    expect(phone.providers!.opened.map((open) => open.provider)).toEqual(['browser']);
    const [returned] = phone.providers!.returned;
    expect(returned).toMatch(/^tableside:\/\/auth\/local\?state=local~[0-9a-f]{64}$/);

    await phone.account.answerAgeQuestion('18+');
    expect(await phone.account.createWithProvider('apple', { sameIdentity: true })).toEqual({ status: 'created' });
    expect(phone.account.gate).toMatchObject({ state: 'active', eligibility: '18+' });
    expect(phone.providers!.opened).toHaveLength(1);
  });

  it('signs in to an existing account', async () => {
    const someone = person('apple-android-existing');
    const accountId = await createWith('apple', someone);
    const phone = device('android', 'android');
    phone.providers!.accounts.apple = someone;
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId });
  });

  it('treats a canceled page as canceled', async () => {
    const phone = device('android', 'android');
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'canceled' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });

  it('refuses a callback answering another flow, and a token that isn’t the provider’s', async () => {
    const someone = person('apple-android-tampered');
    await createWith('apple', someone);
    const phone = device('android', 'android');
    phone.providers!.accounts.apple = someone;

    phone.providers!.tamper = (form) => new URLSearchParams({ ...Object.fromEntries(form), state: `local~${'0'.repeat(64)}` });
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'failed' });

    phone.providers!.tamper = (form) => new URLSearchParams({ ...Object.fromEntries(form), id_token: forgedToken(someone) });
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'failed' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });
});

describe('the browser callback', () => {
  const callback = (form: Record<string, string>, provider = 'keycloak') =>
    fetch(`${stack.url}/functions/v1/provider-callback?provider=${provider}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
      redirect: 'manual',
    });
  const verifier = 'a'.repeat(64);
  const challenge = () => createHash('sha256').update(verifier).digest('hex');

  it('gives the token once, and only for the verifier', async () => {
    const token = idp.idToken(person('callback-once'));
    const response = await callback({ state: `local~${challenge()}`, id_token: token });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`tableside://auth/local?state=local~${challenge()}`);

    const raw = stack.rawClient();
    expect((await raw.rpc('redeem_provider_flow', { verifier: 'b'.repeat(64) })).data).toBeNull();
    expect((await raw.rpc('redeem_provider_flow', { verifier })).data).toBe(token);
    expect((await raw.rpc('redeem_provider_flow', { verifier })).data).toBeNull();
  });

  it('never answers another environment’s flow, a malformed state or a provider that has no browser flow', async () => {
    const token = idp.idToken(person('callback-other'));
    expect((await callback({ state: `production~${challenge()}`, id_token: token })).status).toBe(400);
    expect((await callback({ state: 'not-a-state', id_token: token })).status).toBe(400);
    expect((await callback({ state: `local~${challenge()}`, id_token: token }, 'google')).status).toBe(400);
  });

  it('keeps nothing for a token from another issuer or audience, or an expired one', async () => {
    const someone = person('callback-bad');
    for (const token of [
      idp.idToken(someone, { issuer: 'https://appleid.apple.com' }),
      idp.idToken(someone, { audience: 'another-app' }),
      idp.idToken(someone, { expiresIn: -120 }),
      forgedToken(someone),
    ]) {
      const response = await callback({ state: `local~${challenge()}`, id_token: token });
      expect(response.headers.get('location')).toBe(`tableside://auth/local?state=local~${challenge()}&error=failed`);
    }
    expect((await stack.rawClient().rpc('redeem_provider_flow', { verifier })).data).toBeNull();
  });
});

/** An ID token for the identity signed by a key the provider never published. */
function forgedToken(identity: ProviderIdentity): string {
  const forger = new TestIdentityProvider();
  return forger.idToken(identity);
}

describe('binding an assertion, as a raw client', () => {
  const bind = (body: Record<string, unknown>, environment: string | null = 'local') =>
    fetch(`${stack.url}/functions/v1/bind-provider-assertion`, {
      method: 'POST',
      headers: { apikey: stack.publishableKey, 'content-type': 'application/json', ...(environment ? { 'x-tableside-environment': environment } : {}) },
      body: JSON.stringify(body),
    }).then(async (response) => ({ status: response.status, body: await response.json().catch(() => null) }));
  const assertion = async (range = '18+') => {
    const { data, error } = await stack.rawClient().rpc('issue_eligibility_assertion', { age_range: range });
    if (error) throw error;
    return (data as { assertion: string }).assertion;
  };
  const nonce = 'n'.repeat(64);
  const hashed = createHash('sha256').update(nonce).digest('hex');
  const signUp = (identity: ProviderIdentity) =>
    stack.rawClient().auth.signInWithIdToken({ provider: idp.provider, token: idp.idToken(identity, { nonce: hashed }), nonce });

  it('lets an assertion create one identity only, once', async () => {
    const token = await assertion();
    const first = person('bind-first');
    const second = person('bind-second');
    expect(await bind({ provider: idp.provider, idToken: idp.idToken(first, { nonce: hashed }), nonce, assertion: token })).toEqual({ status: 200, body: { status: 'bound' } });
    expect(await bind({ provider: idp.provider, idToken: idp.idToken(second, { nonce: hashed }), nonce, assertion: token })).toEqual({ status: 403, body: { status: 'age-required' } });

    expect((await signUp(second)).error?.message).toMatch(/eligibility_assertion_required/);
    expect((await signUp(first)).error).toBeNull();
    expect(await authUsersFor(first)).toBe(1);
    expect(await authUsersFor(second)).toBe(0);
    // Used up: binding it again, even to a new identity, is refused.
    const third = person('bind-third');
    expect((await bind({ provider: idp.provider, idToken: idp.idToken(third, { nonce: hashed }), nonce, assertion: token })).status).toBe(403);
  });

  it('never binds without a valid ID token for this app and this nonce', async () => {
    const token = await assertion();
    const someone = person('bind-forged');
    for (const idToken of [
      forgedToken(someone),
      idp.idToken(someone, { nonce: hashed, audience: 'another-app' }),
      idp.idToken(someone, { nonce: hashed, issuer: 'https://accounts.google.com' }),
      idp.idToken(someone, { nonce: hashed, expiresIn: -120 }),
      idp.idToken(someone, { nonce: 'f'.repeat(64) }),
      idp.idToken(someone),
    ]) {
      expect(await bind({ provider: idp.provider, idToken, nonce, assertion: token })).toEqual({ status: 401, body: { status: 'invalid-token' } });
    }
    expect((await bind({ provider: 'apple', idToken: idp.idToken(someone, { nonce: hashed }), nonce, assertion: token })).status).toBe(401);
    expect((await signUp(someone)).error).not.toBeNull();
    expect(await authUsersFor(someone)).toBe(0);
  });

  it('is refused for another environment, or none', async () => {
    const token = await assertion();
    const someone = person('bind-environment');
    const request = { provider: idp.provider, idToken: idp.idToken(someone, { nonce: hashed }), nonce, assertion: token };
    expect((await bind(request, 'production')).status).toBe(502);
    expect((await bind(request, null)).status).toBe(502);
    expect((await signUp(someone)).error).not.toBeNull();
  });

  it('a bound assertion never creates an email account, and the binding functions aren’t callable directly', async () => {
    const token = await assertion();
    const someone = person('bind-then-email');
    await bind({ provider: idp.provider, idToken: idp.idToken(someone, { nonce: hashed }), nonce, assertion: token });
    const email = uniqueEmail('bound-email');
    expect(await stack.requestCode({ email, intent: 'create', assertion: token })).toEqual({ status: 403, body: { status: 'age-required' } });
    expect(await stack.authUserId(email)).toBeNull();

    const raw = stack.rawClient();
    expect((await raw.rpc('bind_provider_assertion', { assertion: await assertion(), provider: idp.provider, subject: 'anyone' })).error).not.toBeNull();
    expect((await raw.rpc('store_provider_flow', { challenge: '0'.repeat(64), id_token: 'x' })).error).not.toBeNull();
  });
});

describe('ownership', () => {
  it('keeps an Apple relay address and a different Google address as separate accounts, however alike', async () => {
    const apple = person('relay', `relay-${Date.now().toString(36)}@privaterelay.appleid.com`);
    const google = person('relay-google');
    const appleAccount = await createWith('apple', apple);
    const googleAccount = await createWith('google', google);
    expect(appleAccount).not.toBe(googleAccount);
  });

  it('the account is the identity’s, not its email: a changed provider email signs in to the same account', async () => {
    const someone = person('changed-email');
    const accountId = await createWith('google', someone);
    const phone = device('phone');
    phone.providers!.accounts.google = { ...someone, email: uniqueEmail('changed-later') };
    expect(await phone.account.signInWithProvider('google')).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId });
  });

  it('Create with a provider whose verified email Auth matches to an existing account signs in to it, never saying it was created', async () => {
    const email = uniqueEmail('linked');
    const setup = device('setup-email');
    expect(await createAccountByEmail(setup, email)).toEqual({ status: 'signed-in' });
    const existing = await stack.accountId(email);

    const phone = device('phone');
    phone.providers!.accounts.google = person('linked-google', email);
    await phone.account.answerAgeQuestion('18+');
    // Supabase's verified same-email linking returns the existing account (spec 2, *Ownership*); the app never compares emails.
    expect(await phone.account.createWithProvider('google')).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId: existing });
    expect(await stack.accountCount(email)).toBe(1);
  });
});

describe('credentials', () => {
  it('keeps the refresh credential only in secure storage, and no ID token, nonce or verifier anywhere a URL or storage could leak it', async () => {
    const phone = device('android', 'android');
    phone.providers!.accounts.apple = person('apple-secrets');
    await phone.account.signInWithProvider('apple');
    await phone.account.answerAgeQuestion('18+');
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'created' });

    const stored = [...phone.credentials.items.values()].join('\n');
    expect(stored).toMatch(/refresh_token/);
    const jwtLike = /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g;
    // The only tokens stored are Auth's own session, never the provider's ID token.
    for (const token of stored.match(jwtLike) ?? []) expect(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).iss).toMatch(/\/auth\/v1$/);
    for (const { url } of phone.proxy.sent) expect(url).not.toMatch(jwtLike);
    for (const url of [...phone.providers!.returned, ...phone.providers!.opened.map((open) => open.url ?? '')]) {
      expect(url).not.toMatch(jwtLike);
      expect(url).not.toMatch(/verifier|id_token=/);
    }
  });
});

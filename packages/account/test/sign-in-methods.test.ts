// Seam 2, sign-in methods and fresh authentication (#100, S2-18). Adding,
// removing and changing a sign-in method needs a fresh sign-in on the
// requesting session ("Confirm it's you"); being signed in already, or a
// token refresh, never counts. A method another account signs in with is a
// conflict, never a merge; the account always keeps a method; Secure Email
// Change confirms both addresses; linking sends a security email. The test
// identity provider stands in for Apple and Google, so a linked Google
// identity lists as Apple here.

import { createHash } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { SignInMethodEntry } from '../src';
import {
  type ProviderIdentity,
  type SimulatedDevice,
  TestIdentityProvider,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  signInByEmail,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
const idp = new TestIdentityProvider();
beforeAll(() => idp.start());
afterAll(() => idp.stop());

const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name, identityProvider: idp });
  devices.push(created);
  return created;
}

let counter = 0;
/** A person at the provider no earlier run has seen. */
function person(label: string): ProviderIdentity {
  counter += 1;
  const id = `${label}-${Date.now().toString(36)}-${counter}`;
  return { subject: id, email: `${id}@example.com` };
}

/** A new email account on a fresh device. */
async function emailAccount(label: string) {
  const phone = device(label);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  return { phone, email };
}

/** A new account created with the provider (Apple) on a fresh device. */
async function providerAccount(label: string) {
  const phone = device(label);
  const someone = person(label);
  phone.providers!.accounts.apple = someone;
  expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
  expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'created' });
  return { phone, someone };
}

/** Confirm it's you with an emailed code (as if the code-request backoff had passed since signing in). */
async function confirmByEmail(phone: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email);
  expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
  expect(await phone.account.freshAuthentication.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
}

const methods = async (phone: SimulatedDevice) => ((await phone.account.signInMethods.list()) ?? []).map((entry) => entry.method).sort();
const entry = async (phone: SimulatedDevice, method: SignInMethodEntry['method']) =>
  ((await phone.account.signInMethods.list()) ?? []).find((each) => each.method === method)!;

/** Ages every fresh authentication of an account's sessions, as if its window had passed on the server. */
const ageFreshAuthentications = (email: string) =>
  stack.sql`update private.fresh_authentications set authenticated_at = authenticated_at - interval '6 minutes'
    where auth_user_id = (select id from auth.users where lower(email) = lower(${email}))`;

describe('Confirm it’s you', () => {
  it('lists each method with the address it goes by', async () => {
    const { phone, email } = await emailAccount('list');
    expect(await phone.account.signInMethods.list()).toEqual([{ id: expect.any(String), method: 'email', email }]);
  });

  it('is needed for every method change: being signed in already isn’t enough', async () => {
    const { phone, email } = await emailAccount('not-fresh');
    phone.providers!.accounts.apple = person('not-fresh');
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'fresh-authentication-required' });
    expect(await phone.account.signInMethods.changeEmail(uniqueEmail('not-fresh-new'))).toEqual({ status: 'fresh-authentication-required' });
    expect(await methods(phone)).toEqual(['email']);
    // Signing in again on another device is a new session, and isn't a confirmation either.
    const tablet = device('not-fresh-tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    tablet.providers!.accounts.apple = person('not-fresh-tablet');
    expect(await tablet.account.signInMethods.link('apple')).toEqual({ status: 'fresh-authentication-required' });
  });

  it('counts only for the session that confirmed, and only for a few minutes', async () => {
    const { phone, email } = await emailAccount('window');
    const tablet = device('window-tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await confirmByEmail(phone, email);

    tablet.providers!.accounts.apple = person('window-tablet');
    expect(await tablet.account.signInMethods.link('apple')).toEqual({ status: 'fresh-authentication-required' });

    await ageFreshAuthentications(email);
    phone.providers!.accounts.apple = person('window');
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'fresh-authentication-required' });
  });

  it('isn’t renewed by a token refresh', async () => {
    const { phone, email } = await emailAccount('refresh');
    await confirmByEmail(phone, email);
    await ageFreshAuthentications(email);

    // The same session, refreshed directly: a new access token, still not fresh.
    const stored = JSON.parse([...phone.credentials.items.entries()].find(([key]) => key.endsWith('.auth'))![1]) as { refresh_token: string };
    const { data, error } = await stack.rawClient().auth.refreshSession({ refresh_token: stored.refresh_token });
    expect(error).toBeNull();
    const refreshed = stack.rawClient(data.session!.access_token);
    expect((await refreshed.rpc('authorize_email_change_v1', { new_email: uniqueEmail('refresh-new') })).data).toEqual({
      status: 'fresh-authentication-required',
    });
  });

  it('with a wrong code, or another person’s Apple ID, confirms nothing', async () => {
    const { phone, email } = await emailAccount('wrong-proof');
    expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
    const code = await phone.mailbox.latestCode(email);
    expect(await phone.account.freshAuthentication.withCode(code === '000000' ? '111111' : '000000')).toEqual({ status: 'invalid-code' });

    phone.providers!.accounts.apple = person('stranger');
    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'not-a-method' });
    expect(await phone.account.signInMethods.changeEmail(uniqueEmail('wrong-proof-new'))).toEqual({ status: 'fresh-authentication-required' });
  });

  it('works with Apple or Google, for an account that has it', async () => {
    const { phone } = await providerAccount('provider-confirm');
    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'confirmed' });
    expect(phone.account.gate.state).toBe('active');
  });

  it('leaves this device signed in to the same session', async () => {
    const { phone, email } = await emailAccount('same-session');
    const before = accessToken(phone);
    await confirmByEmail(phone, email);
    expect(accessToken(phone)).toBe(before);
    expect(await phone.account.accountSummary()).toMatchObject({ devices: 1 });
  });
});

describe('adding a method', () => {
  it('after confirming, with proof of the new method: it signs in to this account, and the account gets a security email', async () => {
    const { phone, email } = await emailAccount('link');
    const since = await stack.serverNow();
    await confirmByEmail(phone, email);
    const someone = person('link');
    phone.providers!.accounts.apple = someone;

    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
    expect(await methods(phone)).toEqual(['apple', 'email']);
    expect((await phone.mailbox.messages(email))[0]).toMatch(/new way to sign in was added/);
    expect(await stack.emailSends(since)).toContainEqual({ type: 'method-linked', pacing: 'immediate', outcome: 'sent' });

    const tablet = device('link-tablet');
    tablet.providers!.accounts.apple = someone;
    expect(await tablet.account.signInWithProvider('apple')).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toMatchObject({ accountId: (phone.account.gate as { accountId: string }).accountId });
  });

  it('owned by another account is a conflict, never a merge', async () => {
    const { phone: other, someone } = await providerAccount('conflict-owner');
    const otherAccount = (other.account.gate as { accountId: string }).accountId;
    const { phone, email } = await emailAccount('conflict');
    await confirmByEmail(phone, email);
    phone.providers!.accounts.apple = someone;

    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'conflict' });
    expect(await methods(phone)).toEqual(['email']);
    expect(await methods(other)).toEqual(['apple']);
    const tablet = device('conflict-tablet');
    tablet.providers!.accounts.apple = someone;
    expect(await tablet.account.signInWithProvider('apple')).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toMatchObject({ accountId: otherAccount });
  });

  it('already this account’s changes nothing', async () => {
    const { phone, someone } = await providerAccount('already');
    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'confirmed' });
    phone.providers!.accounts.apple = someone;
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'already-linked' });
  });

  it('email code, for an Apple account’s sign-in email, after its emailed code', async () => {
    const { phone, someone } = await providerAccount('add-email');
    // Without the method, email sign-in reaches no account.
    const before = device('add-email-before');
    expect(await before.account.requestEmailCode({ email: someone.email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    expect((await before.mailbox.messages(someone.email))[0]).toMatch(/no Tableside account/);

    expect(await phone.account.signInMethods.requestEmailMethodCode()).toEqual({ status: 'fresh-authentication-required' });
    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'confirmed' });
    expect(await phone.account.signInMethods.requestEmailMethodCode()).toEqual({ status: 'sent' });
    expect(await phone.account.signInMethods.confirmEmailMethod(await phone.mailbox.latestCode(someone.email))).toEqual({ status: 'linked' });
    expect(await methods(phone)).toEqual(['apple', 'email']);

    const tablet = device('add-email-tablet');
    await stack.ageCodeRequests(someone.email, 3600);
    expect(await signInByEmail(tablet, someone.email)).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toMatchObject({ accountId: (phone.account.gate as { accountId: string }).accountId });
  });
});

describe('removing a method', () => {
  it('never removes the last one', async () => {
    const { phone, email } = await emailAccount('last');
    await confirmByEmail(phone, email);
    expect(await phone.account.signInMethods.remove((await entry(phone, 'email')).id)).toEqual({ status: 'last-method' });
    expect(await methods(phone)).toEqual(['email']);
  });

  it('is confirmed through a method that stays', async () => {
    const { phone, email } = await emailAccount('remove');
    await confirmByEmail(phone, email);
    const someone = person('remove');
    phone.providers!.accounts.apple = someone;
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
    const emailMethod = await entry(phone, 'email');

    // Confirmed with the email code, so removing the email code needs another method.
    expect(await phone.account.signInMethods.remove(emailMethod.id)).toEqual({ status: 'confirm-with-another-method' });
    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'confirmed' });
    expect(await phone.account.signInMethods.remove(emailMethod.id)).toEqual({ status: 'removed' });
    expect(await methods(phone)).toEqual(['apple']);
  });

  it('stops the email code working, a code already sent included', async () => {
    const { phone, email } = await emailAccount('remove-email');
    await confirmByEmail(phone, email);
    phone.providers!.accounts.apple = person('remove-email');
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
    const tablet = device('remove-email-tablet');
    expect(await tablet.account.requestEmailCode({ email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    const pending = await tablet.mailbox.latestCode(email);

    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'confirmed' });
    expect(await phone.account.signInMethods.remove((await entry(phone, 'email')).id)).toEqual({ status: 'removed' });

    expect(await tablet.account.verifyEmailCode({ email, code: pending })).not.toEqual({ status: 'signed-in' });
    await stack.ageCodeRequests(email, 3600);
    expect(await tablet.account.requestEmailCode({ email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    expect((await tablet.mailbox.messages(email))[0]).toMatch(/no Tableside account/);
  });

  it('two removals at once both go, keeping the method that confirmed', async () => {
    const { phone, email } = await emailAccount('race');
    await confirmByEmail(phone, email);
    for (const label of ['race-a', 'race-b']) {
      phone.providers!.accounts.apple = person(label);
      expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
    }
    // Confirmed with the email code: both Apple IDs may go, but not together with the last method.
    const apples = ((await phone.account.signInMethods.list()) ?? []).filter((each) => each.method === 'apple');
    const outcomes = await Promise.all(apples.map((each) => phone.account.signInMethods.remove(each.id)));
    expect(outcomes).toEqual([{ status: 'removed' }, { status: 'removed' }]);
    expect(await methods(phone)).toEqual(['email']);
  });
});

describe('changing the email', () => {
  it('confirms the current and the new address, and the current one works until both are confirmed', async () => {
    const { phone, email } = await emailAccount('change');
    const next = uniqueEmail('change-new');
    const since = await stack.serverNow();
    await confirmByEmail(phone, email);
    const previous = await phone.mailbox.latestCode(email);

    expect(await phone.account.signInMethods.changeEmail(next)).toEqual({ status: 'codes-sent' });
    const current = await phone.mailbox.latestCode(email, { after: previous });
    const fresh = await phone.mailbox.latestCode(next);
    expect(await stack.emailSends(since)).toEqual(expect.arrayContaining([{ type: 'email-change', pacing: 'immediate', outcome: 'sent' }]));

    // A wrong code changes nothing.
    expect(await phone.account.signInMethods.confirmEmailChange({ currentCode: current, newCode: fresh === '000000' ? '111111' : '000000' })).toEqual({
      status: 'invalid-code',
      address: 'new',
    });
    expect(await phone.account.accountSummary()).toMatchObject({ email });

    expect(await phone.account.signInMethods.confirmEmailChange({ currentCode: current, newCode: fresh })).toEqual({ status: 'changed' });
    expect(await phone.account.accountSummary()).toMatchObject({ email: next, devices: 1 });
    expect(await phone.account.signInMethods.list()).toEqual([{ id: expect.any(String), method: 'email', email: next }]);

    const tablet = device('change-tablet');
    expect(await signInByEmail(tablet, next)).toEqual({ status: 'signed-in' });
  });

  it('can’t take an address another account uses', async () => {
    const { email: taken } = await emailAccount('taken');
    const { phone, email } = await emailAccount('taker');
    await confirmByEmail(phone, email);
    expect(await phone.account.signInMethods.changeEmail(taken)).toEqual({ status: 'in-use' });
    expect(await phone.account.accountSummary()).toMatchObject({ email });
  });
});

describe('Auth’s own endpoints, called directly', () => {
  it('refuse an email change without fresh authentication, emailing nothing', async () => {
    const { phone, email } = await emailAccount('raw-email');
    const next = uniqueEmail('raw-email-new');
    const raw = stack.rawClient(accessToken(phone));
    expect((await raw.auth.updateUser({ email: next })).error).not.toBeNull();
    // Even fresh, a change the session didn't authorize first is refused.
    await confirmByEmail(phone, email);
    expect((await raw.auth.updateUser({ email: next })).error).not.toBeNull();
    expect(await phone.mailbox.messages(next)).toEqual([]);
    expect(await phone.account.accountSummary()).toMatchObject({ email });
  });

  it('refuse setting a password', async () => {
    const { phone, email } = await emailAccount('raw-password');
    await confirmByEmail(phone, email);
    const raw = stack.rawClient(accessToken(phone));
    expect((await raw.auth.updateUser({ password: 'correct horse battery staple' })).error).not.toBeNull();
    expect((await stack.rawClient().auth.signInWithPassword({ email, password: 'correct horse battery staple' })).error).not.toBeNull();
  });

  it('refuse linking and unlinking', async () => {
    const { phone, email } = await emailAccount('raw-link');
    await confirmByEmail(phone, email);
    const raw = stack.rawClient(accessToken(phone));
    const { data } = await raw.auth.getUserIdentities();
    expect(data?.identities ?? []).toHaveLength(1);
    expect((await raw.auth.unlinkIdentity(data!.identities[0]!)).error).not.toBeNull();
    const response = await fetch(`${stack.url}/auth/v1/user/identities/authorize?provider=keycloak&skip_http_redirect=true`, {
      headers: { apikey: stack.publishableKey, authorization: `Bearer ${accessToken(phone)}` },
    });
    await response.body?.cancel();
    expect(response.ok).toBe(false);
    expect(await methods(phone)).toEqual(['email']);
  });

  it('refuse signing out other devices, even with fresh authentication: that goes through Devices, which emails the account (#101)', async () => {
    const { phone, email } = await emailAccount('raw-others');
    const tablet = device('raw-others-tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    const others = (token: string, scope: 'others' | 'global') =>
      fetch(`${stack.url}/auth/v1/logout?scope=${scope}`, { method: 'POST', headers: { apikey: stack.publishableKey, authorization: `Bearer ${token}` } });

    for (const scope of ['others', 'global'] as const) {
      const refused = await others(accessToken(phone), scope);
      await refused.body?.cancel();
      expect(refused.ok).toBe(false);
    }
    expect(await tablet.account.accountSummary()).toMatchObject({ devices: 2 });

    await confirmByEmail(phone, email);
    const refused = await others(accessToken(phone), 'others');
    await refused.body?.cancel();
    expect(refused.ok).toBe(false);
    expect(await phone.account.accountSummary()).toMatchObject({ devices: 2 });
  });

  it('still let a device sign out of itself', async () => {
    const { phone, email } = await emailAccount('raw-local');
    const tablet = device('raw-local-tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    expect(await tablet.account.signOut()).toEqual({ status: 'signed-out', serverSessionEnded: true });
    expect(await phone.account.accountSummary()).toMatchObject({ devices: 1 });
  });
});

describe('an Apple or Google proof, called directly', () => {
  const freshAuth = (token: string, body: Record<string, unknown>) =>
    fetch(`${stack.url}/functions/v1/fresh-auth`, {
      method: 'POST',
      headers: { apikey: stack.publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-tableside-environment': 'local' },
      body: JSON.stringify(body),
    }).then(async (response) => ({ status: response.status, body: await response.json() }));
  const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

  it('counts only for a nonce the server issued to this session, once: an earlier sign-in’s token proves nothing', async () => {
    const { phone, someone } = await providerAccount('replay');
    const token = accessToken(phone);
    // A token minted for a nonce the player chose (as at sign-in) isn't a confirmation.
    const own = 'f'.repeat(64);
    expect(await freshAuth(token, { method: 'provider', provider: idp.provider, idToken: idp.idToken(someone, { nonce: sha256(own) }), nonce: own })).toEqual({
      status: 401,
      body: { status: 'invalid-token' },
    });

    const { data: nonce } = await stack.rawClient(token).rpc('issue_proof_nonce_v1');
    const proof = { method: 'provider', provider: idp.provider, idToken: idp.idToken(someone, { nonce: sha256(nonce as string) }), nonce };
    expect(await freshAuth(token, proof)).toEqual({ status: 200, body: { status: 'confirmed' } });
    expect(await freshAuth(token, proof)).toEqual({ status: 401, body: { status: 'invalid-token' } });

    // Another session of the account can't use this session's nonce.
    const tablet = device('replay-tablet');
    tablet.providers!.accounts.apple = someone;
    expect(await tablet.account.signInWithProvider('apple')).toEqual({ status: 'signed-in' });
    const { data: phoneNonce } = await stack.rawClient(token).rpc('issue_proof_nonce_v1');
    expect(
      await freshAuth(accessToken(tablet), { method: 'provider', provider: idp.provider, idToken: idp.idToken(someone, { nonce: sha256(phoneNonce as string) }), nonce: phoneNonce }),
    ).toEqual({ status: 401, body: { status: 'invalid-token' } });
  });
});

describe('the method operations, called directly', () => {
  it('refuse a caller who isn’t the service, or a token whose session ended', async () => {
    const { phone, email } = await emailAccount('raw-rpc');
    const token = accessToken(phone);
    const raw = stack.rawClient(token);
    const userId = await stack.authUserId(email);
    for (const [name, args] of [
      ['record_fresh_authentication', { session: '00000000-0000-0000-0000-000000000000', auth_user: userId, provider: 'email', subject: null }],
      ['link_provider_identity', { session: '00000000-0000-0000-0000-000000000000', auth_user: userId, provider: 'keycloak', subject: 'x', claims: {} }],
      ['link_email_identity', { session: '00000000-0000-0000-0000-000000000000', auth_user: userId }],
      ['email_change_authorized', { auth_user: userId, address: 'someone@example.com' }],
      ['consume_proof_nonce', { session: '00000000-0000-0000-0000-000000000000', nonce: 'x' }],
    ] as const) {
      expect((await raw.rpc(name, args)).error).not.toBeNull();
    }

    await phone.account.signOut();
    const response = await fetch(`${stack.url}/functions/v1/fresh-auth`, {
      method: 'POST',
      headers: { apikey: stack.publishableKey, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-tableside-environment': 'local' },
      body: JSON.stringify({ method: 'email', code: '123456' }),
    });
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 401, body: { status: 'not-signed-in' } });
  });

  it('refuse removing a method without fresh authentication', async () => {
    const { phone, email } = await emailAccount('raw-remove');
    await confirmByEmail(phone, email);
    phone.providers!.accounts.apple = person('raw-remove');
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
    await ageFreshAuthentications(email);
    const raw = stack.rawClient(accessToken(phone));
    expect((await raw.rpc('remove_sign_in_method_v1', { identity: (await entry(phone, 'apple')).id })).data).toEqual({
      status: 'fresh-authentication-required',
    });
    expect(await methods(phone)).toEqual(['apple', 'email']);
  });
});

// Seam 2, provider revocation (#101; spec 2 *Sessions, revocation and the
// authorization gate*, Amendment 1 C3). Apple's server-to-server
// notifications and Google's security events reach the provider-notifications
// function as JWTs the provider signed. Once one checks out, the method it
// concerns is disabled (unless it is the account's only method) and the
// sessions signed in with that kind of method are revoked, at once, whatever
// the provider does with its own tokens. The account is never deleted. The
// test identity provider stands in for Apple and Google.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  type ProviderIdentity,
  type SimulatedDevice,
  TestIdentityProvider,
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
function person(label: string, email?: string): ProviderIdentity {
  counter += 1;
  const id = `${label}-${Date.now().toString(36)}-${counter}`;
  return { subject: id, email: email ?? `${id}@example.com` };
}

/** Posts a notification to the function as the provider would: no Supabase key, the environment in the URL. */
async function notify(body: string, contentType = 'application/json'): Promise<number> {
  const response = await fetch(`${stack.url}/functions/v1/provider-notifications?provider=${idp.provider}&environment=${stack.environment}`, {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });
  await response.body?.cancel();
  return response.status;
}

const methods = async (phone: SimulatedDevice) => ((await phone.account.signInMethods.list()) ?? []).map((entry) => entry.method).sort();
const accountState = async (accountId: string) => (await stack.sql`select state from public.accounts where account_id = ${accountId}`)[0]?.state;

/** An email account on a phone with Apple linked, and a tablet signed in with Apple. */
async function emailAccountWithApple(label: string) {
  const phone = device(`${label}-phone`);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email);
  expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
  expect(await phone.account.freshAuthentication.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
  const someone = person(label);
  phone.providers!.accounts.apple = someone;
  expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
  const tablet = device(`${label}-tablet`);
  tablet.providers!.accounts.apple = someone;
  expect(await tablet.account.signInWithProvider('apple')).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('unreachable');
  return { phone, tablet, email, someone, accountId: gate.accountId };
}

describe('a provider withdrawing an identity', () => {
  it('disables the method and revokes the sessions signed in with it, never deleting the account', async () => {
    const { phone, tablet, email, someone, accountId } = await emailAccountWithApple('consent');
    const since = await stack.serverNow();

    expect(await notify(idp.appleNotification({ type: 'consent-revoked', sub: someone.subject }))).toBe(202);

    await tablet.account.refreshEligibility();
    expect(tablet.account.gate).toEqual({ state: 'revoked', accountId, revokedAt: expect.any(Number), by: 'provider' });
    // The email-code session stays, and the account keeps its other method.
    await phone.account.refreshEligibility();
    expect(phone.account.gate.state).toBe('active');
    expect(await methods(phone)).toEqual(['email']);
    expect(await accountState(accountId)).toBe('active');
    expect(await stack.emailSends(since)).toContainEqual({ type: 'device-revoked', pacing: 'immediate', outcome: 'sent' });
    expect((await phone.mailbox.messages(email))[0]).toMatch(/stopped vouching/);
  });

  it('takes Google’s security events the same way', async () => {
    const { phone, tablet, someone, accountId } = await emailAccountWithApple('google');
    expect(await notify(idp.googleSecurityEvent('tokens-revoked', someone.subject), 'application/secevent+jwt')).toBe(202);
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate.state).toBe('revoked');
    expect(await methods(phone)).toEqual(['email']);
    expect(await accountState(accountId)).toBe('active');
  });

  it('keeps an account’s only method, revoking its sessions all the same', async () => {
    const phone = device('only-method');
    const someone = person('only-method');
    phone.providers!.accounts.apple = someone;
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'created' });
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('unreachable');

    const event = idp.appleNotification({ type: 'account-delete', sub: someone.subject });
    expect(await notify(event)).toBe(202);
    await phone.account.refreshEligibility();
    expect(phone.account.gate.state).toBe('revoked');
    expect(await accountState(gate.accountId)).toBe('active');
    // Signing in with it again (once the player has given consent again) reaches the same account.
    expect(await phone.account.signInWithProvider('apple')).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId: gate.accountId });
    // The same notification again does nothing more.
    expect(await notify(event)).toBe(202);
    await phone.account.refreshEligibility();
    expect(phone.account.gate.state).toBe('active');
  });

  it('turns off the email code at a private relay address Apple stopped forwarding to', async () => {
    const relay = `${Date.now().toString(36)}-${++counter}@privaterelay.appleid.com`;
    const phone = device('relay');
    const someone = person('relay', relay);
    phone.providers!.accounts.apple = someone;
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'created' });
    expect(await phone.account.freshAuthentication.withProvider('apple')).toEqual({ status: 'confirmed' });
    expect(await phone.account.signInMethods.requestEmailMethodCode()).toEqual({ status: 'sent' });
    expect(await phone.account.signInMethods.confirmEmailMethod(await phone.mailbox.latestCode(relay))).toEqual({ status: 'linked' });
    const tablet = device('relay-tablet');
    await stack.ageCodeRequests(relay, 3600);
    expect(await signInByEmail(tablet, relay)).toEqual({ status: 'signed-in' });

    expect(await notify(idp.appleNotification({ type: 'email-disabled', sub: someone.subject, email: relay }))).toBe(202);
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate.state).toBe('revoked');
    await phone.account.refreshEligibility();
    expect(phone.account.gate.state).toBe('active');
    expect(await methods(phone)).toEqual(['apple']);
  });
});

describe('a notification that doesn’t check out', () => {
  it('changes nothing: forged, for another audience, too old, or not a revocation', async () => {
    const { tablet, someone } = await emailAccountWithApple('forged');
    const event = { type: 'consent-revoked', sub: someone.subject };
    expect(await notify(idp.appleNotification(event, { forged: true }))).toBe(400);
    expect(await notify(idp.appleNotification(event, { audience: 'someone-else' }))).toBe(400);
    expect(await notify(idp.appleNotification(event, { issuedAt: Math.floor(Date.now() / 1000) - 3 * 86_400 }))).toBe(400);
    expect(await notify('not a token')).toBe(400);
    // A genuine event that withdraws nothing is acknowledged and does nothing.
    expect(await notify(idp.appleNotification({ type: 'email-enabled', sub: someone.subject, email: 'x@privaterelay.appleid.com' }))).toBe(202);
    // A relay address that isn't the account's email method revokes nothing.
    expect(await notify(idp.appleNotification({ type: 'email-disabled', sub: someone.subject, email: 'other@privaterelay.appleid.com' }))).toBe(202);
    // One for an identity nobody here has is acknowledged the same way.
    expect(await notify(idp.appleNotification({ type: 'consent-revoked', sub: 'nobody-at-all' }))).toBe(202);

    await tablet.account.refreshEligibility();
    expect(tablet.account.gate.state).toBe('active');
  });

  it('is refused for another environment', async () => {
    const { tablet, someone } = await emailAccountWithApple('other-environment');
    const response = await fetch(`${stack.url}/functions/v1/provider-notifications?provider=${idp.provider}&environment=production`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: idp.appleNotification({ type: 'consent-revoked', sub: someone.subject }),
    });
    await response.body?.cancel();
    expect(response.ok).toBe(false);
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate.state).toBe('active');
  });
});

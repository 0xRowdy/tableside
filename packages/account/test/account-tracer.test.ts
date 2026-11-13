// Seam 2 tracer (#84): a simulated device creates an account by email code
// against the local Supabase stack, and its account gate reaches Active.

import { afterEach, describe, expect, it } from 'vitest';

import type { EligibilityBand } from '../src';
import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(localStack(), { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function createAccount(d: SimulatedDevice, email: string, band: EligibilityBand = '18+') {
  expect(await createAccountByEmail(d, email, band)).toEqual({ status: 'signed-in' });
}

describe('creating an account by email code', () => {
  it('moves the gate from No account to Active and opens this installation’s account database', async () => {
    const phone = device('phone');
    const email = uniqueEmail('create');
    const seen: string[] = [];
    phone.account.subscribe((gate) => seen.push(gate.state));

    expect(phone.account.gate).toEqual({ state: 'no-account' });
    await createAccount(phone, email);

    const gate = phone.account.gate;
    expect(gate).toMatchObject({ state: 'active', eligibility: '18+' });
    expect(seen).toEqual(['active']);
    if (gate.state !== 'active') throw new Error('unreachable');
    expect(phone.vault.openAccount).toBe(gate.accountId);
  });

  it('opens no account until the code proves the address', async () => {
    const phone = device('phone');
    const email = uniqueEmail('unproven');
    await phone.account.answerAgeQuestion('18+');
    await phone.account.requestEmailCode({ email, intent: 'create' });
    expect(await localStack().authUserId(email)).not.toBeNull();
    expect(await localStack().accountId(email)).toBeNull();

    await phone.account.verifyEmailCode({ email, code: await phone.mailbox.latestCode(email) });
    expect(await localStack().accountId(email)).not.toBeNull();
  });

  it('records the declared band and gives each account its own random ID, kept across sign-ins', async () => {
    const phone = device('phone');
    const tablet = device('tablet');
    const email = uniqueEmail('stable');

    await createAccount(phone, email, '13-15');
    await createAccount(tablet, uniqueEmail('other'));
    const first = phone.account.gate;
    const other = tablet.account.gate;
    expect(first).toMatchObject({ state: 'active', eligibility: '13-15' });
    if (first.state !== 'active' || other.state !== 'active') throw new Error('unreachable');
    expect(first.accountId).not.toBe(other.accountId);
    expect(first.accountId).not.toBe(await localStack().authUserId(email));

    const laptop = device('laptop');
    expect(await laptop.account.requestEmailCode({ email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    expect(await laptop.account.verifyEmailCode({ email, code: await laptop.mailbox.latestCode(email) })).toEqual({
      status: 'signed-in',
    });
    expect(laptop.account.gate).toEqual(first);
  });
});

describe('the age step', () => {
  it('under 13 ends without contacting the server, and no Auth user can be created', async () => {
    const phone = device('phone');
    const email = uniqueEmail('under13');

    expect(await phone.account.answerAgeQuestion('under-13')).toEqual({ status: 'ineligible' });
    expect(phone.proxy.requests).toBe(0);
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'age-required' });
    expect(phone.proxy.requests).toBe(0);
    expect(await localStack().authUserId(email)).toBeNull();
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });

  it('asks again once the assertion has expired on this device’s clock', async () => {
    const phone = device('phone');
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    phone.clock.advance(11 * 60_000);
    expect(await phone.account.requestEmailCode({ email: uniqueEmail('late'), intent: 'create' })).toEqual({
      status: 'age-required',
    });
  });
});

describe('email-code sign-in', () => {
  it('answers identically whether or not an account exists, and never creates a user', async () => {
    const phone = device('phone');
    const known = uniqueEmail('known');
    await createAccount(device('setup'), known);
    const unknown = uniqueEmail('unknown');

    const forKnown = await phone.account.requestEmailCode({ email: known, intent: 'sign-in' });
    const forUnknown = await phone.account.requestEmailCode({ email: unknown, intent: 'sign-in' });
    expect(forUnknown).toEqual(forKnown);
    expect(forUnknown).toEqual({ status: 'sent' });
    expect(await localStack().authUserId(unknown)).toBeNull();
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });

  it('never reaches Active for an account whose eligibility isn’t established 13+', async () => {
    const email = uniqueEmail('restricted');
    await createAccount(device('setup'), email);
    const accountId = await localStack().accountId(email);
    await localStack().sql`update public.eligibility set band = 'under-13' where account_id = ${accountId}`;

    const phone = device('phone');
    await phone.account.requestEmailCode({ email, intent: 'sign-in' });
    expect(await phone.account.verifyEmailCode({ email, code: await phone.mailbox.latestCode(email) })).toEqual({ status: 'failed' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
    expect(phone.vault.openAccount).toBeNull();
  });

  it('a wrong code leaves the gate at No account', async () => {
    const phone = device('phone');
    const email = uniqueEmail('wrong');
    await createAccount(device('setup'), email);
    await phone.account.requestEmailCode({ email, intent: 'sign-in' });
    const code = await phone.mailbox.latestCode(email);
    const wrong = code === '000000' ? '111111' : '000000';
    expect(await phone.account.verifyEmailCode({ email, code: wrong })).toEqual({ status: 'invalid-code' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
  });
});

describe('through the fault-injection proxy', () => {
  it('offline, nothing is sent and the request fails', async () => {
    const phone = device('phone');
    phone.proxy.online = false;
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'failed' });
    phone.proxy.online = true;
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    phone.proxy.online = false;
    const email = uniqueEmail('offline');
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'failed' });
    expect(await localStack().authUserId(email)).toBeNull();
  });

  it('a lost verification response leaves No account; a new code reaches the same single account', async () => {
    const phone = device('phone');
    const email = uniqueEmail('dropped');
    await phone.account.answerAgeQuestion('18+');
    await phone.account.requestEmailCode({ email, intent: 'create' });
    const code = await phone.mailbox.latestCode(email);

    phone.proxy.dropNextResponse('/auth/v1/verify');
    expect(await phone.account.verifyEmailCode({ email, code })).toEqual({ status: 'failed' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });

    expect(await phone.account.requestEmailCode({ email, intent: 'sign-in' })).toEqual({ status: 'sent' });
    const second = await phone.mailbox.latestCode(email, { after: code });
    expect(await phone.account.verifyEmailCode({ email, code: second })).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toMatchObject({ state: 'active', accountId: await localStack().accountId(email) });
  });

  it('a duplicated create request makes one account', async () => {
    const phone = device('phone');
    const email = uniqueEmail('duplicate');
    await phone.account.answerAgeQuestion('18+');
    phone.proxy.duplicateNextRequest('/auth/v1/otp');
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'sent' });
    expect(await phone.account.verifyEmailCode({ email, code: await phone.mailbox.latestCode(email) })).toEqual({
      status: 'signed-in',
    });
    expect(await localStack().accountCount(email)).toBe(1);
  });

  it('the gate stays at No account until a delayed verification response arrives', async () => {
    const phone = device('phone');
    const email = uniqueEmail('delayed');
    await phone.account.answerAgeQuestion('18+');
    await phone.account.requestEmailCode({ email, intent: 'create' });
    const code = await phone.mailbox.latestCode(email);

    const held = phone.proxy.delayNextResponse('/auth/v1/verify');
    const verifying = phone.account.verifyEmailCode({ email, code });
    await held.arrived;
    expect(phone.account.gate).toEqual({ state: 'no-account' });
    held.release();
    expect(await verifying).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toMatchObject({ state: 'active' });
  });
});

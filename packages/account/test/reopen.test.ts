// #88

import { afterEach, describe, expect, it } from 'vitest';

import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(localStack(), { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function signedInPhone(label: string) {
  const phone = device(label);
  expect(await createAccountByEmail(phone, uniqueEmail(label))).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { phone, accountId: gate.accountId };
}

function expireToken(phone: SimulatedDevice) {
  phone.proxy.online = false;
  phone.clock.advance(2 * 60 * 60_000);
}

describe('reopening the app', () => {
  it('reopens offline into the same account and its database, sending nothing', async () => {
    const { phone, accountId } = await signedInPhone('offline-reopen');
    phone.proxy.online = false;
    const sent = phone.proxy.sent.length;

    await phone.restart();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(phone.vault.openAccount).toBe(accountId);
    expect(phone.proxy.sent.length).toBe(sent);
  });

  it('a fresh installation stays at No account', async () => {
    const phone = device('fresh');
    expect(await phone.account.resume()).toEqual({ status: 'no-account' });
    expect(phone.account.gate).toEqual({ state: 'no-account' });
    expect(phone.vault.openAccount).toBeNull();
  });

  it('with an expired token offline, opens as Renewal pending, keeping access and the database', async () => {
    const { phone, accountId } = await signedInPhone('expired');
    const saved = await phone.playPracticeSession();
    expireToken(phone);

    await phone.restart();
    expect(phone.account.gate).toEqual({ state: 'renewal-pending', accountId, eligibility: '18+' });
    expect(phone.vault.openAccount).toBe(accountId);
    expect(await phone.vault.store().load(saved.activityId)).not.toBeNull();

    await phone.account.renew();
    expect(phone.account.gate.state).toBe('renewal-pending');
    expect(phone.vault.openAccount).toBe(accountId);

    phone.proxy.online = true;
    phone.proxy.dropNextResponse('/auth/v1/token');
    await phone.account.renew();
    expect(phone.account.gate.state).toBe('renewal-pending');
  });

  it('renews once back online, and the renewed session is the one the next launch uses', async () => {
    const { phone, accountId } = await signedInPhone('renews');
    expireToken(phone);
    await phone.restart();
    const seen: string[] = [];
    phone.account.subscribe((gate) => seen.push(gate.state));

    phone.proxy.online = true;
    await phone.account.renew();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(seen).toEqual(['active']);

    phone.proxy.online = false;
    await phone.restart();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });
});

// Seam 2, reopening (#88): connectivity is needed only for first sign-in. The
// app reopens into the account offline, and an expired token is Renewal
// pending, keeping access and records until it renews.

import { afterEach, describe, expect, it } from 'vitest';

import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function signedInPhone(label: string) {
  const phone = createDevice(localStack(), { name: label });
  devices.push(phone);
  expect(await createAccountByEmail(phone, uniqueEmail(label))).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { phone, accountId: gate.accountId };
}

async function relaunch(phone: SimulatedDevice): Promise<SimulatedDevice> {
  const next = await phone.relaunch();
  devices.push(next);
  return next;
}

describe('reopening the app', () => {
  it('reopens offline into the same account and its database, sending nothing', async () => {
    const { phone, accountId } = await signedInPhone('offline-reopen');
    phone.proxy.online = false;
    const sent = phone.proxy.requests;

    const reopened = await relaunch(phone);
    expect(reopened.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(reopened.vault.openAccount).toBe(accountId);
    expect(phone.proxy.requests).toBe(sent);
  });

  it('a fresh installation stays at No account', async () => {
    const phone = createDevice(localStack(), { name: 'fresh' });
    devices.push(phone);
    const reopened = await relaunch(phone);
    expect(reopened.account.gate).toEqual({ state: 'no-account' });
    expect(reopened.vault.openAccount).toBeNull();
  });

  it('with an expired token offline, opens as Renewal pending, keeping access and the database', async () => {
    const { phone, accountId } = await signedInPhone('expired');
    phone.clock.advance(2 * 60 * 60_000);
    phone.proxy.online = false;

    const reopened = await relaunch(phone);
    expect(reopened.account.gate).toEqual({ state: 'renewal-pending', accountId, eligibility: '18+' });
    expect(reopened.vault.openAccount).toBe(accountId);

    // Renewal fails while offline and nothing changes.
    await reopened.account.renew();
    expect(reopened.account.gate.state).toBe('renewal-pending');
    expect(reopened.vault.openAccount).toBe(accountId);

    // A lost renewal response changes nothing either.
    reopened.proxy.online = true;
    reopened.proxy.dropNextResponse('/auth/v1/token');
    await reopened.account.renew();
    expect(reopened.account.gate.state).toBe('renewal-pending');
  });

  it('renews once back online, and the renewed token reaches the account', async () => {
    const { phone, accountId } = await signedInPhone('renews');
    phone.clock.advance(2 * 60 * 60_000);
    phone.proxy.online = false;
    const reopened = await relaunch(phone);
    const seen: string[] = [];
    reopened.account.subscribe((gate) => seen.push(gate.state));

    reopened.proxy.online = true;
    await reopened.account.renew();
    expect(reopened.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(seen).toEqual(['active']);

    // The renewed session is the one the next launch uses: still Active, offline.
    reopened.proxy.online = false;
    const again = await relaunch(reopened);
    expect(again.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });
});

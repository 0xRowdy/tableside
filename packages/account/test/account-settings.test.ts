// Spec 2 Amendment 4 §4; #99

import { afterEach, describe, expect, it } from 'vitest';

import { type DeviceOptions, type SimulatedDevice, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
function device(name: string, options: Omit<DeviceOptions, 'name'> = {}): SimulatedDevice {
  const created = createDevice(stack, { name, ...options });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function created(phone: SimulatedDevice, label: string) {
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  return email;
}

describe('the account summary', () => {
  it('shows the sign-in email, methods and signed-in devices, with the currency from the creating device\'s locale', async () => {
    const phone = device('summary', { localeCurrency: 'CAD' });
    const email = await created(phone, 'summary');

    expect(await phone.account.accountSummary()).toEqual({ email, methods: ['email'], currency: 'CAD', currencyChangeable: true, devices: 1 });

    const tablet = device('summary-tablet', { localeCurrency: 'EUR' });
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    expect(await tablet.account.accountSummary()).toMatchObject({ currency: 'CAD', devices: 2 });
  });

  it('defaults to US dollars when the device locale has no currency', async () => {
    const phone = device('no-locale-currency', { localeCurrency: null });
    await created(phone, 'no-locale-currency');
    expect(await phone.account.accountSummary()).toMatchObject({ currency: 'USD' });
  });

  it('offline, shows what this installation knows and leaves the server-only parts unknown', async () => {
    const phone = device('summary-offline', { localeCurrency: 'GBP' });
    const email = await created(phone, 'summary-offline');
    phone.proxy.online = false;
    await phone.restart();

    expect(await phone.account.accountSummary()).toEqual({ email, methods: ['email'], currency: 'GBP', currencyChangeable: null, devices: null });
  });

  it('drops an answer that arrives after the account changed', async () => {
    const phone = device('late-summary');
    await created(phone, 'late-summary');
    const held = phone.proxy.delayNextResponse('account_summary_v1');
    const asking = phone.account.accountSummary();
    await held.arrived;
    await phone.account.signOut();
    await created(phone, 'late-summary-second');

    held.release();
    expect(await asking).toBeNull();
  });
});

describe('the account currency', () => {
  it('changes online, for every device of the account', async () => {
    const phone = device('currency');
    const email = await created(phone, 'currency');
    const tablet = device('currency-tablet');
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });

    expect(await phone.account.setAccountCurrency('EUR')).toEqual({ status: 'changed' });
    expect(await tablet.account.accountSummary()).toMatchObject({ currency: 'EUR' });

    phone.proxy.online = false;
    expect(await phone.account.accountSummary()).toMatchObject({ currency: 'EUR' });
  });

  it('needs a connection, and a currency code', async () => {
    const phone = device('currency-refused');
    await created(phone, 'currency-refused');

    expect(await phone.account.setAccountCurrency('usd')).toEqual({ status: 'failed' });
    expect(await stack.rawClient().rpc('set_account_currency_v1', { new_currency: 'EUR' })).toMatchObject({ error: expect.anything() });
    phone.proxy.online = false;
    expect(await phone.account.setAccountCurrency('EUR')).toEqual({ status: 'failed' });
    phone.proxy.online = true;
    expect(await phone.account.accountSummary()).toMatchObject({ currency: 'USD' });
  });
});

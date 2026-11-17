// Spec 2 Deletion; #52

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type ProviderIdentity,
  type SimulatedDevice,
  TestIdentityProvider,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  uniqueEmail,
} from '../src/testing';

vi.setConfig({ testTimeout: 120_000 });

const stack = localStack();
const { sql } = stack;
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
function person(label: string): ProviderIdentity {
  counter += 1;
  const id = `${label}-${Date.now().toString(36)}-${counter}`;
  return { subject: id, email: `${id}@example.com` };
}

async function createdWith(provider: 'apple' | 'google', options: { readonly withoutCode?: boolean } = {}) {
  const phone = device('phone');
  const someone = person(`${provider}-grant`);
  phone.providers!.accounts[provider] = someone;
  if (options.withoutCode) phone.providers!.withoutCode.add(provider);
  expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
  expect(await phone.account.createWithProvider(provider)).toEqual({ status: 'created' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('account setup failed');
  return { phone, someone, accountId: gate.accountId };
}

const grantsOf = (accountId: string) =>
  sql<{ provider: string; subject: string; sealed: string }[]>`select provider, subject, sealed from private.provider_grants where account_id = ${accountId}`;

async function deleteNow(phone: SimulatedDevice, provider: 'apple' | 'google', accountId: string): Promise<Record<string, unknown>> {
  expect(await phone.account.freshAuthentication.withProvider(provider)).toEqual({ status: 'confirmed' });
  const token = (JSON.parse(phone.credentials.items.get('tableside.local.status')!) as { token: string }).token;
  expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
  await vi.waitFor(
    async () => {
      const [row] = await sql<{ completed_at: Date | null }[]>`select completed_at from private.deletions where account_id = ${accountId}`;
      if (!row?.completed_at) throw new Error('still processing');
    },
    { timeout: 60_000, interval: 250 },
  );
  return (await stack.rawClient().rpc('deletion_progress_v1', { token })).data as Record<string, unknown>;
}

describe('a provider grant', () => {
  it('is kept sealed when the provider gives a code, and permanent deletion revokes it with the provider before the identity goes', async () => {
    const { phone, someone, accountId } = await createdWith('apple');
    const [grant] = await grantsOf(accountId);
    expect(grant).toMatchObject({ provider: idp.provider, subject: someone.subject });
    expect(grant!.sealed).toMatch(/^v1\./);
    expect(grant!.sealed).not.toMatch(/refresh-/);
    expect(idp.grantsFor(someone.subject)).toEqual([{ revoked: false }]);

    const progress = await deleteNow(phone, 'apple', accountId);
    expect(progress).toMatchObject({ status: 'completed', providers: 'revoked' });
    expect(idp.grantsFor(someone.subject)).toEqual([{ revoked: true }]);
    expect(await grantsOf(accountId)).toEqual([]);
    expect(await sql`select 1 from auth.identities where provider_id = ${someone.subject}`).toHaveLength(0);
  });

  it('a newer sign-in replaces the one kept, and deletion revokes the one it holds', async () => {
    const { someone, accountId } = await createdWith('google');
    const tablet = device('tablet');
    tablet.providers!.accounts.google = someone;
    expect(await tablet.account.signInWithProvider('google')).toEqual({ status: 'signed-in' });
    expect(await grantsOf(accountId)).toHaveLength(1);
    expect(idp.grantsFor(someone.subject)).toHaveLength(2);

    const progress = await deleteNow(tablet, 'google', accountId);
    expect(progress).toMatchObject({ providers: 'revoked' });
    expect(idp.grantsFor(someone.subject).filter((g) => g.revoked)).toHaveLength(1);
  });

  it('is kept for a method added later', async () => {
    const phone = device('phone');
    const email = uniqueEmail('link-grant');
    expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('account setup failed');
    const someone = person('linked');
    phone.providers!.accounts.apple = someone;
    await stack.ageCodeRequests(email, 3600);
    const previous = await phone.mailbox.latestCode(email);
    expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
    expect(await phone.account.freshAuthentication.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
    expect(await phone.account.signInMethods.link('apple')).toEqual({ status: 'linked' });
    expect(await grantsOf(gate.accountId)).toMatchObject([{ subject: someone.subject }]);
  });
});

describe('Apple’s web flow on Android', () => {
  it('keeps the grant from the code Apple posts with the ID token', async () => {
    const phone = createDevice(stack, { name: 'android', identityProvider: idp, platform: 'android' });
    devices.push(phone);
    const someone = person('apple-web');
    phone.providers!.accounts.apple = someone;
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    expect(await phone.account.createWithProvider('apple')).toEqual({ status: 'created' });
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('account setup failed');
    expect(await grantsOf(gate.accountId)).toMatchObject([{ subject: someone.subject }]);
    for (const url of phone.providers!.returned) expect(url).not.toMatch(/code=/);
  });
});

describe('a flow that gives no code', () => {
  it('holds no grant: deletion reports a provider exception, never a revocation', async () => {
    const { phone, someone, accountId } = await createdWith('google', { withoutCode: true });
    expect(await grantsOf(accountId)).toEqual([]);
    const progress = await deleteNow(phone, 'google', accountId);
    expect(progress).toMatchObject({ status: 'completed', providers: 'not-held' });
    expect(idp.grantsFor(someone.subject)).toEqual([]);
  });
});

describe('a raw client', () => {
  it('can’t keep a grant for another account’s identity, or write grants directly', async () => {
    const { phone } = await createdWith('apple');
    const stranger = person('stranger');
    const code = idp.authorizationCode(stranger);
    const response = await fetch(`${stack.url}/functions/v1/provider-grant`, {
      method: 'POST',
      headers: { apikey: stack.publishableKey, authorization: `Bearer ${accessToken(phone)}`, 'content-type': 'application/json', 'x-tableside-environment': 'local' },
      body: JSON.stringify({ provider: idp.provider, code, flow: 'native' }),
    });
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 403, body: { status: 'not-a-method' } });
    const raw = stack.rawClient(accessToken(phone));
    expect((await raw.rpc('store_provider_grant', { session: crypto.randomUUID(), auth_user: crypto.randomUUID(), provider: 'apple', subject: 'x', sealed: 'v1.x.y' })).error).not.toBeNull();
    expect((await raw.from('provider_grants').select('*')).data ?? []).toEqual([]);
  });
});

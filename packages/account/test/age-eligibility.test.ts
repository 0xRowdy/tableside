// Seam 2: age eligibility (#90). Bands, platform signals against the fallback
// declaration, the restricted gate states, offline retention, and the suspend
// of an active spec-1 practice session when eligibility changes.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { REVEAL_MS } from '../../../apps/mobile/src/practice/controller';
import { FakeClock as ManualClock } from '../../../apps/mobile/src/practice/testing/substitutes';
import type { EligibilityBand } from '../src';
import { type SimulatedDevice, accessToken, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(localStack(), { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** Creates an account on a setup device, which stays signed in to it. */
async function createAccountOn(email: string, band: EligibilityBand = '18+') {
  const setup = device('setup');
  expect(await createAccountByEmail(setup, email, band)).toEqual({ status: 'signed-in' });
  const accountId = await localStack().accountId(email);
  if (!accountId) throw new Error('no account');
  return { accountId, setup };
}

const createAccount = async (email: string, band: EligibilityBand = '18+') => (await createAccountOn(email, band)).accountId;

/** What support review (or a platform signal reported from another device) leaves as the account's record. */
async function setServerRecord(accountId: string, band: string, source = 'platform-signal') {
  await localStack().sql`update public.eligibility set band = ${band}, source = ${source} where account_id = ${accountId}`;
}

describe('signing in to an account whose eligibility is not established', () => {
  it('opens the restricted state for an account found under 13, keeping its records', async () => {
    const email = uniqueEmail('under13-existing');
    const accountId = await createAccount(email);
    await setServerRecord(accountId, 'under-13');

    const phone = device('phone');
    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toEqual({ state: 'age-ineligible', accountId });
    // Restricted paths (export, the local supplement) need the database: it is open.
    expect(phone.vault.openAccount).toBe(accountId);
  });

  it('opens the unresolved state for an account with no eligibility record', async () => {
    const email = uniqueEmail('no-record');
    const accountId = await createAccount(email);
    await localStack().sql`delete from public.eligibility where account_id = ${accountId}`;

    const phone = device('phone');
    expect(await signInByEmail(phone, email)).toEqual({ status: 'signed-in' });
    expect(phone.account.gate).toEqual({ state: 'age-unresolved', accountId, reason: 'not-established' });
  });
});

/** The account's one current record, as the server keeps it. */
async function serverRecords(accountId: string) {
  return localStack().sql<{ band: string; source: string; policy_version: number }[]>`
    select band, source, policy_version from public.eligibility where account_id = ${accountId}`;
}

describe('the Create path with a platform age signal', () => {
  it('creates the account from the platform’s range, recorded as a platform signal', async () => {
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    phone.ageSignals.signal = { kind: 'range', range: '16-17' };
    const email = uniqueEmail('platform-create');

    expect(phone.account.platformAgeCheck).toBe(true);
    expect(await phone.account.checkAge()).toEqual({ status: 'eligible' });
    expect(phone.ageSignals.checks).toEqual(['interactive']);
    expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'sent' });
    expect(await phone.account.verifyEmailCode({ email, code: await phone.mailbox.latestCode(email) })).toEqual({ status: 'signed-in' });

    const accountId = await localStack().accountId(email);
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '16-17' });
    expect(await serverRecords(accountId!)).toEqual([{ band: '16-17', source: 'platform-signal', policy_version: 1 }]);
  });

  it('under 13 from the platform ends without contacting the server', async () => {
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    phone.ageSignals.signal = { kind: 'range', range: 'under-13' };

    expect(await phone.account.checkAge()).toEqual({ status: 'ineligible' });
    expect(phone.proxy.requests).toBe(0);
  });

  it('a declined or missing optional signal proves nothing: the fallback question decides', async () => {
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    const email = uniqueEmail('declined');
    phone.ageSignals.signal = { kind: 'declined' };
    expect(await phone.account.checkAge()).toEqual({ status: 'question' });
    phone.ageSignals.signal = { kind: 'unavailable' };
    expect(await phone.account.checkAge()).toEqual({ status: 'question' });

    expect(await createAccountByEmail(phone, email, '13-15')).toEqual({ status: 'signed-in' });
    expect(await serverRecords((await localStack().accountId(email))!)).toEqual([{ band: '13-15', source: 'declaration', policy_version: 1 }]);
  });

  it('a required check that is pending or can’t be met leaves it unresolved, and no answer overrides it', async () => {
    for (const kind of ['required-pending', 'required-unmet'] as const) {
      const phone = createDevice(localStack(), { name: kind, platformAgeSignals: true });
      devices.push(phone);
      const email = uniqueEmail(kind);
      phone.ageSignals.signal = { kind };

      expect(await phone.account.checkAge()).toEqual({ status: 'unresolved' });
      expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'unresolved' });
      expect(await phone.account.requestEmailCode({ email, intent: 'create' })).toEqual({ status: 'age-required' });
      expect(await localStack().authUserId(email)).toBeNull();
    }
  });
});

describe('an existing account on a new device', () => {
  it('its server record governs: the device’s missing signal proves nothing', async () => {
    const email = uniqueEmail('governs');
    const accountId = await createAccount(email, '13-15');
    const tablet = createDevice(localStack(), { name: 'tablet', platformAgeSignals: true });
    devices.push(tablet);

    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '13-15' });
    // Sign in never asks for age: the platform check runs without a prompt.
    expect(tablet.ageSignals.checks).toEqual(['silent']);
  });

  it('required platform checks still run there: a pending one restricts that device only', async () => {
    const email = uniqueEmail('required-on-new-device');
    const { accountId, setup: phone } = await createAccountOn(email);
    const tablet = createDevice(localStack(), { name: 'tablet', platformAgeSignals: true });
    devices.push(tablet);
    tablet.ageSignals.signal = { kind: 'required-pending' };

    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    expect(tablet.account.gate).toEqual({ state: 'age-unresolved', accountId, reason: 'check-pending' });
    // It isn't age information: the account's record and its other devices are untouched.
    expect(await serverRecords(accountId)).toEqual([{ band: '18+', source: 'declaration', policy_version: 1 }]);
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });

    // Once the platform no longer requires the check, the record governs again.
    tablet.ageSignals.signal = { kind: 'unavailable' };
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });

  it('a check that can’t be met surfaces the conflict', async () => {
    const email = uniqueEmail('unmet');
    const accountId = await createAccount(email);
    const tablet = createDevice(localStack(), { name: 'tablet', platformAgeSignals: true });
    devices.push(tablet);
    tablet.ageSignals.signal = { kind: 'required-unmet' };

    await signInByEmail(tablet, email);
    expect(tablet.account.gate).toEqual({ state: 'age-unresolved', accountId, reason: 'check-unmet' });
  });
});

describe('retrying while unresolved', () => {
  it('with no evidence on record, the fallback question may decide', async () => {
    const email = uniqueEmail('retry-question');
    const accountId = await createAccount(email);
    await localStack().sql`delete from public.eligibility where account_id = ${accountId}`;
    const phone = device('phone');
    await signInByEmail(phone, email);

    expect(await phone.account.checkAge()).toEqual({ status: 'question' });
    expect(await phone.account.answerAgeQuestion('16-17')).toEqual({ status: 'eligible' });
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '16-17' });
    expect(await serverRecords(accountId)).toEqual([{ band: '16-17', source: 'declaration', policy_version: 1 }]);
  });

  it('while a required check is owed, only the platform resolves it, never an answer', async () => {
    const email = uniqueEmail('retry-signal');
    const accountId = await createAccount(email, '16-17');
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    phone.ageSignals.signal = { kind: 'required-pending' };
    await signInByEmail(phone, email);

    expect(await phone.account.checkAge()).toEqual({ status: 'unresolved' });
    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'unresolved' });
    expect(phone.account.gate).toMatchObject({ state: 'age-unresolved' });

    phone.ageSignals.signal = { kind: 'range', range: '18+' };
    expect(await phone.account.checkAge()).toEqual({ status: 'eligible' });
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
    expect(await serverRecords(accountId)).toEqual([{ band: '18+', source: 'platform-signal', policy_version: 1 }]);
  });

  it('an under-13 answer makes it ineligible', async () => {
    const email = uniqueEmail('retry-under13');
    const accountId = await createAccount(email);
    await localStack().sql`delete from public.eligibility where account_id = ${accountId}`;
    const phone = device('phone');
    await signInByEmail(phone, email);

    expect(await phone.account.answerAgeQuestion('under-13')).toEqual({ status: 'ineligible' });
    expect(phone.account.gate).toEqual({ state: 'age-ineligible', accountId });
  });
});

describe('the record', () => {
  it('is one current record per account, replaced rather than kept as a history, with no raw response', async () => {
    const email = uniqueEmail('one-record');
    const accountId = await createAccount(email);
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    phone.ageSignals.signal = { kind: 'required-pending' };
    await signInByEmail(phone, email);
    phone.ageSignals.signal = { kind: 'range', range: '16-17' };
    await phone.account.checkAge();

    expect(await serverRecords(accountId)).toEqual([{ band: '16-17', source: 'platform-signal', policy_version: 1 }]);
    expect((await localStack().columns('public.eligibility')).sort()).toEqual(['account_id', 'band', 'checked_at', 'policy_version', 'source']);
  });

  it('no direct report raises an under-13 record, or records an unresolved check', async () => {
    const email = uniqueEmail('direct-under13');
    const accountId = await createAccount(email);
    const phone = device('phone');
    await signInByEmail(phone, email);
    await setServerRecord(accountId, 'under-13');

    const client = localStack().rawClient(accessToken(phone));
    expect((await client.rpc('record_eligibility_v1', { band: '18+', source: 'platform-signal' })).data).toEqual({
      accepted: false,
      eligibility: 'under-13',
      source: 'platform-signal',
    });
    expect((await client.rpc('record_eligibility_v1', { band: 'unresolved', source: 'platform-signal' })).error).not.toBeNull();
    expect(await serverRecords(accountId)).toEqual([{ band: 'under-13', source: 'platform-signal', policy_version: 1 }]);
  });

  it('a device that learned under 13 doesn’t raise it from its own platform’s later answer', async () => {
    const email = uniqueEmail('no-raise');
    const accountId = await createAccount(email);
    await setServerRecord(accountId, 'under-13');
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    await signInByEmail(phone, email);

    phone.ageSignals.signal = { kind: 'range', range: '18+' };
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'age-ineligible', accountId });
  });

  it('a device doesn’t keep reasserting its platform’s range over a later change made elsewhere', async () => {
    const email = uniqueEmail('no-flip');
    const accountId = await createAccount(email, '16-17');
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    phone.ageSignals.signal = { kind: 'range', range: '18+' };
    await signInByEmail(phone, email);
    expect(await serverRecords(accountId)).toEqual([{ band: '18+', source: 'platform-signal', policy_version: 1 }]);

    await setServerRecord(accountId, '13-15');
    const seen: string[] = [];
    phone.account.subscribe((gate) => seen.push(gate.state === 'active' ? gate.eligibility : gate.state));
    await phone.account.refreshEligibility();
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '13-15' });
    expect(seen).toEqual(['13-15']);
  });

  it('a declaration never replaces an established record, even called directly', async () => {
    const email = uniqueEmail('direct-declaration');
    const accountId = await createAccount(email, '13-15');
    const phone = device('phone');
    await signInByEmail(phone, email);

    const client = localStack().rawClient(accessToken(phone));
    const { data, error } = await client.rpc('record_eligibility_v1', { band: '18+', source: 'declaration' });
    expect(error).toBeNull();
    expect(data).toEqual({ accepted: false, eligibility: '13-15', source: 'declaration' });
    expect(await serverRecords(accountId)).toEqual([{ band: '13-15', source: 'declaration', policy_version: 1 }]);
  });
});

describe('restricted accounts on the server', () => {
  it('are denied every ordinary operation but keep their restricted paths', async () => {
    const email = uniqueEmail('server-restricted');
    const accountId = await createAccount(email);
    await setServerRecord(accountId, 'unresolved');
    const phone = device('phone');
    await signInByEmail(phone, email);
    const client = localStack().rawClient(accessToken(phone));

    expect((await client.rpc('sync_feed_v1', { after: 0 })).error).not.toBeNull();
    expect((await client.rpc('realtime_claim_v1')).error).not.toBeNull();
    expect((await client.from('accounts').select('account_id')).data).toEqual([]);
    expect((await client.storage.from('account-private').upload(`${accountId}/notes.txt`, 'notes')).error).not.toBeNull();
    const { data } = await client.rpc('current_account');
    expect(data).toEqual({ account_id: accountId, eligibility: 'unresolved', source: 'platform-signal', currency: 'USD' });
  });
});

describe('offline', () => {
  it('established eligibility persists with no age-related reconnect deadline, and time never promotes a band', async () => {
    const email = uniqueEmail('offline-teen');
    const accountId = await createAccount(email, '13-15');
    const phone = device('phone');
    await signInByEmail(phone, email);

    phone.proxy.online = false;
    phone.clock.advance(3 * 365 * 24 * 60 * 60_000);
    await phone.restart();
    expect(phone.account.gate).toMatchObject({ accountId, eligibility: '13-15' });
    expect(phone.account.gate.state).not.toMatch(/^age-/);

    phone.proxy.online = true;
    await phone.account.renew();
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '13-15' });
  });

  it('a restricted state is kept offline too', async () => {
    const email = uniqueEmail('offline-restricted');
    const accountId = await createAccount(email);
    await setServerRecord(accountId, 'under-13');
    const phone = device('phone');
    await signInByEmail(phone, email);

    phone.proxy.online = false;
    await phone.restart();
    expect(phone.account.gate).toEqual({ state: 'age-ineligible', accountId });
  });

  it('a required check expiring offline applies at once, on this device only', async () => {
    const email = uniqueEmail('offline-expiry');
    const accountId = await createAccount(email);
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    await signInByEmail(phone, email);

    phone.proxy.online = false;
    phone.ageSignals.signal = { kind: 'required-pending' };
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'age-unresolved', accountId, reason: 'check-pending' });
    expect(await serverRecords(accountId)).toEqual([{ band: '18+', source: 'declaration', policy_version: 1 }]);

    phone.proxy.online = true;
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toMatchObject({ state: 'age-unresolved' });
    expect(await serverRecords(accountId)).toEqual([{ band: '18+', source: 'declaration', policy_version: 1 }]);
  });

  it('a restricted account whose token expired offline renews before it asks the server', async () => {
    const email = uniqueEmail('restricted-expired');
    const accountId = await createAccount(email);
    await localStack().sql`delete from public.eligibility where account_id = ${accountId}`;
    const phone = device('phone');
    await signInByEmail(phone, email);
    phone.proxy.online = false;
    phone.clock.advance(2 * 60 * 60_000);
    await phone.restart();
    phone.proxy.online = true;

    expect(await phone.account.answerAgeQuestion('18+')).toEqual({ status: 'eligible' });
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });
});

describe('learning of a change', () => {
  it('a record changed elsewhere reaches the device on entering the foreground', async () => {
    const email = uniqueEmail('foreground');
    const accountId = await createAccount(email);
    const phone = device('phone');
    await signInByEmail(phone, email);

    await setServerRecord(accountId, 'under-13');
    phone.foreground = false;
    phone.foreground = true;
    await vi.waitFor(() => expect(phone.account.gate).toEqual({ state: 'age-ineligible', accountId }));
  });

  it('reopening online refreshes it', async () => {
    const email = uniqueEmail('reopen-refresh');
    const accountId = await createAccount(email);
    const phone = device('phone');
    await signInByEmail(phone, email);

    await setServerRecord(accountId, 'unresolved');
    await phone.restart();
    await vi.waitFor(() => expect(phone.account.gate).toEqual({ state: 'age-unresolved', accountId, reason: 'check-pending' }));
  });

  it('a move between eligible bands changes the band only', async () => {
    const email = uniqueEmail('band-move');
    const accountId = await createAccount(email, '16-17');
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    await signInByEmail(phone, email);

    phone.ageSignals.signal = { kind: 'range', range: '18+' };
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'active', accountId, eligibility: '18+' });
  });
});

describe('an active practice session', () => {
  it('suspends at once, saved and unsettled, when ineligibility is newly learned', async () => {
    const email = uniqueEmail('suspend');
    const accountId = await createAccount(email);
    const phone = device('phone');
    await signInByEmail(phone, email);
    const practice = await phone.startPracticeSession();
    await practice.placeWager('red', '10');
    const unfinished = await phone.vault.store().findUnfinished();
    expect(unfinished).not.toBeNull();

    await setServerRecord(accountId, 'under-13');
    await phone.account.refreshEligibility();
    await vi.waitFor(() => expect(practice.snapshot()).toMatchObject({ status: 'active', suspension: { cause: 'access', kind: 'immediate', reached: true } }));

    // Nothing more is revealed or settled: the spin is refused, ending is blocked, no completion exists.
    await practice.spin();
    await practice.endSession();
    expect(practice.snapshot()).toMatchObject({ status: 'active', view: { phase: 'open-decision', balance: '990' } });
    expect(await phone.vault.store().readOutgoing()).toEqual([]);
    // The session is saved in its committed phase, waiting.
    expect((await phone.vault.store().findUnfinished())?.activityId).toBe(unfinished?.activityId);
  });

  it('lets a turn in progress finish, then suspends at the boundary, when a required check expires', async () => {
    const email = uniqueEmail('turn-boundary');
    await createAccount(email);
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    await signInByEmail(phone, email);
    const clock = new ManualClock();
    const practice = await phone.startPracticeSession({ clock });
    await practice.placeWager('red', '10');
    const spinning = practice.spin();
    await vi.waitFor(() => expect(clock.pending).toBe(1));

    phone.ageSignals.signal = { kind: 'required-pending' };
    await phone.account.refreshEligibility();
    clock.advance(REVEAL_MS);
    await spinning;

    expect(practice.snapshot()).toMatchObject({
      status: 'active',
      view: { phase: 'settled-outcome' },
      suspension: { cause: 'access', kind: 'turn-boundary', reached: true },
    });
    expect(await phone.vault.store().readOutgoing()).toEqual([]);
  });

  it('carries on when the band moves between eligible bands', async () => {
    const email = uniqueEmail('no-pause');
    await createAccount(email, '16-17');
    const phone = createDevice(localStack(), { name: 'phone', platformAgeSignals: true });
    devices.push(phone);
    await signInByEmail(phone, email);
    const practice = await phone.startPracticeSession();
    await practice.placeWager('red', '10');

    phone.ageSignals.signal = { kind: 'range', range: '18+' };
    await phone.account.refreshEligibility();
    await practice.spin();
    expect(practice.snapshot()).toMatchObject({ status: 'active', suspension: null, view: { phase: 'settled-outcome' } });
  });
});

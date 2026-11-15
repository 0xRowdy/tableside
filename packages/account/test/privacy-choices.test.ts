// Seam 2 (#105): the privacy-choices record (spec 2 Amendment 8 §1) through
// the Account service, on devices against the local stack. Withdrawals and
// opt-outs apply at once and work offline; opting in is online only, starts a
// new generation and can't be replayed by a stale device. The raw-client
// cases are in adversarial.test.ts.

import { afterEach, describe, expect, it } from 'vitest';

import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, signInByEmail, uniqueEmail } from '../src/testing';

const stack = localStack();

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** The privacy changes a device sent, in order, by their change. */
function changesSent(d: SimulatedDevice): string[] {
  return d.proxy.sent.flatMap(({ url, body }) => {
    if (!url.includes('sync_upload_v1') || !body) return [];
    const envelope = JSON.parse((JSON.parse(body) as { request: string }).request) as { recordType: string; payload: { change?: string } };
    return envelope.recordType === 'privacy-choice' ? [envelope.payload.change!] : [];
  });
}

/** The account's choices as the server holds them. */
async function serverChoices(accountId: string) {
  const [row] = await stack.sql<{ analytics_consent: string; analytics_generation: number; ad_data_opt_out_source: string | null }[]>`
    select analytics_consent, analytics_generation, ad_data_opt_out_source from private.privacy_choices where account_id = ${accountId}`;
  return row ?? null;
}

async function signedInTablet(email: string) {
  const tablet = device('tablet');
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  await tablet.account.sync.idle();
  return tablet;
}

async function adultAccount(label: string) {
  const phone = device('phone');
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  await phone.account.sync.idle();
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('account setup failed');
  return { phone, email, accountId: gate.accountId };
}

describe('granting analytics consent', () => {
  it('starts a new generation online, with a random analytics ID that is neither the account ID nor the email', async () => {
    const { phone, email, accountId } = await adultAccount('grant');
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });

    const choices = await phone.account.privacy.read();
    expect(choices).toMatchObject({ analytics: { consent: 'granted', generation: 1 }, adDataOptOut: null, pending: false });
    const id = choices!.analytics.analyticsId!;
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toBe(accountId.replaceAll('-', ''));
    expect(id).not.toContain(email.split('@')[0]);
    expect(choices!.analyticsIds).toEqual([{ generation: 1, analyticsId: id }]);
  });
});

describe('granting analytics consent, refused', () => {
  it('needs a connection: offline, nothing changes', async () => {
    const { phone, accountId } = await adultAccount('grant-offline');
    phone.proxy.online = false;
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'offline' });
    expect((await phone.account.privacy.read())!.analytics).toEqual({ consent: 'never-granted', generation: 0, analyticsId: null });
    expect(await serverChoices(accountId)).toBeNull();
  });

  it.each(['13-15', '16-17'] as const)('for a teen (%s), without asking the server', async (band) => {
    const phone = device('teen');
    expect(await createAccountByEmail(phone, uniqueEmail('teen-grant'), band)).toEqual({ status: 'signed-in' });
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'not-eligible' });
    expect(changesSent(phone)).toEqual([]);
    expect((await phone.account.privacy.read())!.analytics.consent).toBe('never-granted');
  });

  it('can’t be queued: it is online only', async () => {
    const { phone } = await adultAccount('grant-queue');
    phone.proxy.online = false;
    const result = await phone.account.sync.queue('privacy-choice', { version: 1, choiceId: 'c'.repeat(32), change: 'grant-analytics', basis: 0 });
    expect(result).toEqual({ status: 'refused', reason: 'online-only' });
  });
});

describe('withdrawing analytics consent', () => {
  it('applies at once offline, holds across a restart, then reaches the account and every device', async () => {
    const { phone, email, accountId } = await adultAccount('withdraw');
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });
    const tablet = await signedInTablet(email);
    expect((await tablet.account.privacy.read())!.analytics.consent).toBe('granted');

    phone.proxy.online = false;
    expect(await phone.account.privacy.withdrawAnalytics()).toEqual({ status: 'applied' });
    const withdrawn = { consent: 'withdrawn', generation: 1, analyticsId: null };
    expect(await phone.account.privacy.read()).toMatchObject({ analytics: withdrawn, pending: true });
    await phone.restart();
    expect(await phone.account.privacy.read()).toMatchObject({ analytics: withdrawn, pending: true });
    expect(await serverChoices(accountId)).toMatchObject({ analytics_consent: 'granted' });

    phone.proxy.online = true;
    await phone.account.sync.reconcile();
    expect(await phone.account.privacy.read()).toMatchObject({ analytics: withdrawn, pending: false });
    expect(await serverChoices(accountId)).toMatchObject({ analytics_consent: 'withdrawn', analytics_generation: 1 });
    await tablet.account.sync.reconcile();
    expect((await tablet.account.privacy.read())!.analytics).toEqual(withdrawn);
  });

  it('then granting again starts generation 2 with a new analytics ID, keeping both', async () => {
    const { phone } = await adultAccount('regrant');
    await phone.account.privacy.grantAnalytics();
    const first = (await phone.account.privacy.read())!.analytics.analyticsId!;
    await phone.account.privacy.withdrawAnalytics();
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });

    const choices = (await phone.account.privacy.read())!;
    expect(choices.analytics).toMatchObject({ consent: 'granted', generation: 2 });
    expect(choices.analytics.analyticsId).not.toBe(first);
    expect(choices.analyticsIds).toEqual([
      { generation: 1, analyticsId: first },
      { generation: 2, analyticsId: choices.analytics.analyticsId },
    ]);
  });

  it('holds back a grant made after it on the same device until its receipt arrives (the barrier)', async () => {
    const { phone, accountId } = await adultAccount('barrier');
    await phone.account.privacy.grantAnalytics();
    phone.foreground = false;
    const held = phone.proxy.delayNextResponse('sync_upload_v1');
    await phone.account.privacy.withdrawAnalytics();
    await held.arrived;

    // The withdrawal is on the server and its answer on the way: the grant isn't sent.
    const granting = phone.account.privacy.grantAnalytics();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changesSent(phone)).toEqual(['grant-analytics', 'withdraw-analytics']);
    held.release();
    expect(await granting).toEqual({ status: 'changed' });
    expect(changesSent(phone)).toEqual(['grant-analytics', 'withdraw-analytics', 'grant-analytics']);
    expect(await serverChoices(accountId)).toMatchObject({ analytics_consent: 'granted', analytics_generation: 2 });
  });

  it('waits, sending no grant, while a withdrawal made here gets no answer', async () => {
    const { phone } = await adultAccount('barrier-unanswered');
    await phone.account.privacy.grantAnalytics();
    phone.foreground = false;
    phone.proxy.serverDown = true;
    await phone.account.privacy.withdrawAnalytics();
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'waiting' });
    expect(changesSent(phone).filter((change) => change === 'grant-analytics')).toHaveLength(1);
    expect(await phone.account.privacy.read()).toMatchObject({ analytics: { consent: 'withdrawn' }, pending: true });
  });
});

describe('a stale device', () => {
  it('can’t re-enable a consent withdrawn elsewhere: its grant, made from the old state, is refused and it learns the withdrawal', async () => {
    const { phone, email, accountId } = await adultAccount('stale-grant');
    await phone.account.privacy.grantAnalytics();
    await phone.account.privacy.withdrawAnalytics();
    const tablet = await signedInTablet(email);
    tablet.foreground = false;
    // The phone grants and withdraws again; the tablet, in the background, hears of neither.
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });
    expect(await phone.account.privacy.withdrawAnalytics()).toEqual({ status: 'applied' });
    await phone.account.sync.idle();

    // The tablet's look at the account is lost, so it grants from what it last heard.
    tablet.proxy.dropNextResponse('sync_feed_v1');
    expect(await tablet.account.privacy.grantAnalytics()).toEqual({ status: 'stale' });
    expect(await serverChoices(accountId)).toMatchObject({ analytics_consent: 'withdrawn', analytics_generation: 2 });
    expect((await tablet.account.privacy.read())!.analytics).toEqual({ consent: 'withdrawn', generation: 2, analyticsId: null });
  });

  it('still withdraws, late: an offline withdrawal arriving after a later grant elsewhere withdraws it (it fails closed)', async () => {
    const { phone, email, accountId } = await adultAccount('late-withdraw');
    await phone.account.privacy.grantAnalytics();
    const tablet = await signedInTablet(email);
    tablet.proxy.online = false;
    await tablet.account.privacy.withdrawAnalytics();
    await phone.account.privacy.withdrawAnalytics();
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });

    tablet.proxy.online = true;
    await tablet.account.sync.reconcile();
    expect(await serverChoices(accountId)).toMatchObject({ analytics_consent: 'withdrawn', analytics_generation: 2 });
    await phone.account.sync.reconcile();
    expect((await phone.account.privacy.read())!.analytics).toEqual({ consent: 'withdrawn', generation: 2, analyticsId: null });
  });
});

describe('limiting ad data', () => {
  it('applies at once offline with source in-app, then reaches the account', async () => {
    const { phone, accountId } = await adultAccount('limit');
    phone.proxy.online = false;
    expect(await phone.account.privacy.limitAdData()).toEqual({ status: 'applied' });
    expect(await phone.account.privacy.read()).toMatchObject({ adDataOptOut: { source: 'in-app' }, pending: true });
    phone.proxy.online = true;
    await phone.account.sync.reconcile();
    expect(await phone.account.privacy.read()).toMatchObject({ adDataOptOut: { source: 'in-app' }, pending: false });
    expect(await serverChoices(accountId)).toMatchObject({ ad_data_opt_out_source: 'in-app' });
  });

  it.each(['gpc', 'support'] as const)('from %s reaches every device with its source', async (source) => {
    const { phone, accountId } = await adultAccount(`limit-${source}`);
    await stack.sql`select private.record_ad_data_opt_out(${accountId}, ${source})`;
    await phone.account.sync.reconcile();
    expect((await phone.account.privacy.read())!.adDataOptOut).toEqual({ source });
  });

  it('can’t be cleared by a stale device; once current, allowing ad data clears it', async () => {
    const { phone, accountId } = await adultAccount('allow');
    await phone.account.privacy.limitAdData();
    await phone.account.sync.idle();
    phone.foreground = false;
    // The web page records GPC; the phone's look at the account is lost, so it clears from what it last heard.
    await stack.sql`select private.record_ad_data_opt_out(${accountId}, 'gpc')`;
    phone.proxy.dropNextResponse('sync_feed_v1');
    expect(await phone.account.privacy.allowAdData()).toEqual({ status: 'stale' });
    expect(await serverChoices(accountId)).toMatchObject({ ad_data_opt_out_source: 'gpc' });
    expect((await phone.account.privacy.read())!.adDataOptOut).toEqual({ source: 'gpc' });

    expect(await phone.account.privacy.allowAdData()).toEqual({ status: 'changed' });
    expect((await phone.account.privacy.read())!.adDataOptOut).toBeNull();
    expect(await serverChoices(accountId)).toMatchObject({ ad_data_opt_out_source: null });
    expect(await phone.account.privacy.allowAdData()).toEqual({ status: 'unchanged' });
  });
});

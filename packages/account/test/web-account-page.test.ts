// Seam 2, the web account page (#106; S2-24; spec 2 *Deletion*, Amendments
// 3 §4, 8 §5, 9 §2). Reachable without the app, it signs in with an email
// code and runs the app's own deletion operations under the same
// fresh-authentication rules: schedule deletion, Cancel deletion, Delete
// permanently now, and deletion status (scheduled with deadline, processing,
// completed), which a browser can still read once the account is gone. When
// a signed-in visitor's browser sends Global Privacy Control, the ad-data
// opt-out is recorded with source GPC.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type WebAccount, type WebStorage, createWebAccount } from '../src/web';
import { type SimulatedDevice, accessToken, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

vi.setConfig({ testTimeout: 120_000 });

const stack = localStack();
const { sql } = stack;
const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

const DAY_MS = 24 * 60 * 60_000;

/** A browser's Web Storage, in memory. */
class MemoryStorage implements WebStorage {
  readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
}

/**
 * One browser: its lasting storage (localStorage) outlives each tab, whose
 * session storage is its own. A browser with Global Privacy Control on adds
 * Sec-GPC: 1 to every request it sends; no page script can.
 */
function browser(options: { readonly gpc?: boolean } = {}) {
  const lasting = new MemoryStorage();
  const requests: { url: string; headers: Headers }[] = [];
  const browserFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('sec-gpc');
    if (options.gpc) headers.set('sec-gpc', '1');
    requests.push({ url: String(input), headers });
    return fetch(input, { ...init, headers });
  };
  const tab = (): WebAccount =>
    createWebAccount({
      backend: { name: stack.environment, url: stack.url, publishableKey: stack.publishableKey },
      fetch: browserFetch,
      session: new MemoryStorage(),
      lasting,
      randomBytes: (count: number) => crypto.getRandomValues(new Uint8Array(count)),
      globalPrivacyControl: () => options.gpc === true,
    });
  return { tab, lasting, requests };
}

async function phoneAccount(label: string) {
  const phone = createDevice(stack, { name: `${label}-phone` });
  devices.push(phone);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { phone, email, accountId: gate.accountId };
}

/** Signs a tab in with an emailed code, as if the code-request backoff had passed since the last code. */
async function signIn(page: WebAccount, phone: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email).catch(() => undefined);
  expect(await page.requestCode(email)).toEqual({ status: 'sent' });
  expect(await page.signIn(email, await phone.mailbox.latestCode(email, previous ? { after: previous } : {}))).toEqual({ status: 'signed-in' });
}

/** Confirm it's you on the page, with a further emailed code. */
async function confirm(page: WebAccount, phone: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email);
  expect(await page.confirm.requestCode()).toEqual({ status: 'sent' });
  expect(await page.confirm.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
}

const serverChoices = async (accountId: string) =>
  (await sql<{ ad_data_opt_out_source: string | null }[]>`
    select ad_data_opt_out_source from private.privacy_choices where account_id = ${accountId}`)[0] ?? null;

describe('the web account page', () => {
  it('signs in with an email code, and registers the browser as a web device', async () => {
    const { phone, email } = await phoneAccount('web-sign-in');
    const page = browser().tab();
    expect(await page.start()).toEqual({ state: 'signed-out' });
    expect(await page.signIn(email, '000000')).toEqual({ status: 'invalid-code' });

    await signIn(page, phone, email);
    expect(page.view).toEqual({ state: 'signed-in', email, deletion: { status: 'none' } });
    const listed = await phone.account.devices.list();
    expect(listed).toContainEqual(expect.objectContaining({ platform: 'web', label: 'Web browser', thisDevice: false }));

    // A reload keeps the tab signed in; signing out ends the server session.
    expect(await page.start()).toEqual({ state: 'signed-in', email, deletion: { status: 'none' } });
    await page.signOut();
    expect(page.view).toEqual({ state: 'signed-out' });
    expect((await phone.account.devices.list())?.some((entry) => entry.platform === 'web')).toBe(false);
  });

  it('schedules deletion after Confirm it’s you; Cancel deletion needs it again, and reopens the account', async () => {
    const { phone, email } = await phoneAccount('web-schedule');
    const web = browser();
    const page = web.tab();
    await page.start();
    await signIn(page, phone, email);

    expect(await page.schedule()).toEqual({ status: 'fresh-authentication-required' });
    await confirm(page, phone, email);
    const scheduled = await page.schedule();
    if (scheduled.status !== 'scheduled') throw new Error('not scheduled');
    expect(scheduled.deadline - Date.now()).toBeGreaterThan(29 * DAY_MS);
    expect(page.view).toEqual({ state: 'signed-in', email, deletion: { status: 'scheduled', deadline: scheduled.deadline, scheduledAt: expect.any(Number) } });

    // The phone locks once it hears; signing in on the web again never cancels.
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toMatchObject({ state: 'deletion-scheduled', deadline: scheduled.deadline });
    const later = web.tab();
    await later.start();
    await signIn(later, phone, email);
    expect(later.view).toMatchObject({ state: 'signed-in', deletion: { status: 'scheduled', deadline: scheduled.deadline } });

    expect(await later.cancel()).toEqual({ status: 'fresh-authentication-required' });
    await confirm(later, phone, email);
    expect(await later.cancel()).toEqual({ status: 'canceled' });
    expect(later.view).toMatchObject({ state: 'signed-in', deletion: { status: 'none' } });
    await phone.account.refreshEligibility();
    expect(phone.account.gate.state).toBe('active');
  });

  it('deletes permanently now after Confirm it’s you, and keeps showing the deletion’s progress in that browser', async () => {
    const { phone, email, accountId } = await phoneAccount('web-delete');
    const web = browser();
    const page = web.tab();
    await page.start();
    await signIn(page, phone, email);

    expect(await page.deletePermanently()).toEqual({ status: 'fresh-authentication-required' });
    expect(page.view.state).toBe('signed-in');
    await confirm(page, phone, email);
    expect(await page.deletePermanently()).toEqual({ status: 'deleted' });
    expect(page.view).toEqual({ state: 'deleted', progress: expect.objectContaining({ status: 'processing', completedAt: null }) });

    await vi.waitFor(
      async () => {
        const [row] = await sql<{ completed_at: Date | null }[]>`select completed_at from private.deletions where account_id = ${accountId}`;
        if (!row?.completed_at) throw new Error('still processing');
      },
      { timeout: 60_000, interval: 250 },
    );
    // A new tab in the same browser, with the session long gone, still reads the status.
    const reopened = web.tab();
    const view = await reopened.start();
    expect(view).toEqual({ state: 'deleted', progress: expect.objectContaining({ status: 'completed', completedAt: expect.any(Number) }) });
    // The phone erases the account once it hears, as it would from the app's own deletion.
    await phone.account.refreshEligibility();
    expect(phone.account.gate.state).toBe('deleted');

    await reopened.dismiss();
    expect(reopened.view).toEqual({ state: 'signed-out' });
    expect(await web.tab().start()).toEqual({ state: 'signed-out' });
    // Nothing of the deletion's credential is left in the browser.
    expect([...web.lasting.entries.keys()].some((key) => key.includes('deleted'))).toBe(false);
  });

  it('shows a scheduled deletion that reached its deadline as processing', async () => {
    const { phone, email, accountId } = await phoneAccount('web-deadline');
    const page = browser().tab();
    await page.start();
    await signIn(page, phone, email);
    await confirm(page, phone, email);
    expect((await page.schedule()).status).toBe('scheduled');

    await sql`update public.accounts set deletion_deadline = now() - interval '1 minute' where account_id = ${accountId}`;
    await sql`select private.finalize_deletion(${accountId}::uuid)`;
    expect(await page.refresh()).toEqual({ state: 'deleted', progress: expect.objectContaining({ status: expect.stringMatching(/^(processing|completed)$/) }) });
  });
});

describe('Global Privacy Control on the web account page', () => {
  it('records the ad-data opt-out with source GPC for a signed-in visitor whose browser sends it', async () => {
    const { phone, email, accountId } = await phoneAccount('web-gpc');
    const web = browser({ gpc: true });
    const page = web.tab();
    await page.start();
    // Nothing is recorded before sign-in: there is no account to record it for.
    expect(web.requests.some((request) => request.url.includes('record-gpc'))).toBe(false);
    await signIn(page, phone, email);
    expect(await serverChoices(accountId)).toEqual({ ad_data_opt_out_source: 'gpc' });
    await phone.account.sync.reconcile();
    expect((await phone.account.privacy.read())?.adDataOptOut).toEqual({ source: 'gpc' });

    // A later visit leaves the recorded choice as it is.
    const choices = async () =>
      (await sql<{ count: number }[]>`select count(*)::int as count from private.sync_feed where account_id = ${accountId} and record_type = 'privacy-choice'`)[0]?.count;
    const before = await choices();
    const again = web.tab();
    await again.start();
    await signIn(again, phone, email);
    expect(await choices()).toBe(before);
  });

  it('records nothing for a browser without GPC, and never replaces an opt-out the player made', async () => {
    const plain = await phoneAccount('web-no-gpc');
    const page = browser().tab();
    await page.start();
    await signIn(page, plain.phone, plain.email);
    expect(await serverChoices(plain.accountId)).toBeNull();

    const limited = await phoneAccount('web-gpc-limited');
    await limited.phone.account.privacy.limitAdData();
    await limited.phone.account.sync.idle();
    const gpcPage = browser({ gpc: true }).tab();
    await gpcPage.start();
    await signIn(gpcPage, limited.phone, limited.email);
    expect(await serverChoices(limited.accountId)).toEqual({ ad_data_opt_out_source: 'in-app' });
  });

  it('is refused without the browser’s signal or a signed-in session', async () => {
    const { phone, accountId } = await phoneAccount('web-gpc-refused');
    const headers = { apikey: stack.publishableKey, 'x-tableside-environment': stack.environment, 'content-type': 'application/json' };
    const call = (extra: Record<string, string>) => fetch(`${stack.url}/functions/v1/record-gpc`, { method: 'POST', headers: { ...headers, ...extra }, body: '{}' });

    const anonymous = await call({ 'sec-gpc': '1' });
    expect([anonymous.status, await anonymous.json()]).toEqual([401, { status: 'not-signed-in' }]);
    const unsignalled = await call({ authorization: `Bearer ${accessToken(phone)}` });
    expect([unsignalled.status, await unsignalled.json()]).toEqual([400, { status: 'no-signal' }]);
    expect(await serverChoices(accountId)).toBeNull();
  });
});

describe('the functions the web account page calls', () => {
  it.each(['request-code', 'fresh-auth', 'schedule-deletion', 'record-gpc'])('let a browser on another origin call %s', async (name) => {
    const preflight = await fetch(`${stack.url}/functions/v1/${name}`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'apikey, authorization, content-type, x-tableside-environment' },
    });
    await preflight.arrayBuffer();
    expect(preflight.ok).toBe(true);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('x-tableside-environment');

    const answer = await fetch(`${stack.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', apikey: stack.publishableKey, 'x-tableside-environment': stack.environment, 'content-type': 'application/json' },
      body: '{}',
    });
    await answer.arrayBuffer();
    // Exactly one allowed origin: a repeated header would make the browser refuse the answer.
    expect(answer.headers.get('access-control-allow-origin')).toBe('*');
  });
});

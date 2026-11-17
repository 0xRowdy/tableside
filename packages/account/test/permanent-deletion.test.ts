// Spec 2 Deletion, Amendments 1 A1 A5 C1–C3, 3 §3–4, 5 §2, 7 §5, 8 §3–4; #104

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type SimulatedDevice,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  signInByEmail,
  testAttempt,
  testResult,
  uniqueEmail,
} from '../src/testing';

vi.setConfig({ testTimeout: 120_000 });

const stack = localStack();
const { sql } = stack;
const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

const DAY_MS = 24 * 60 * 60_000;

function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}

async function signedInPhone(label: string) {
  const phone = device(`${label}-phone`);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  const gate = phone.account.gate;
  if (gate.state !== 'active') throw new Error('sign-in failed');
  return { phone, email, accountId: gate.accountId };
}

async function confirmByEmail(phone: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email);
  expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
  expect(await phone.account.freshAuthentication.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
}

async function signInAlso(other: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  expect(await signInByEmail(other, email)).toEqual({ status: 'signed-in' });
}

async function queue(d: SimulatedDevice, recordType: string, payload: unknown) {
  const result = await d.account.sync.queue(recordType, payload);
  if (result.status !== 'queued') throw new Error(`${recordType} was refused: ${result.reason}`);
}

async function synced(d: SimulatedDevice) {
  await d.account.sync.reconcile();
  await d.account.sync.idle();
}

const cleanedUp = (accountId: string) =>
  vi.waitFor(
    async () => {
      const [row] = await sql<{ completed_at: Date | null }[]>`select completed_at from private.deletions where account_id = ${accountId}`;
      if (!row?.completed_at) throw new Error('still processing');
    },
    { timeout: 60_000, interval: 250 },
  );

const accountRow = async (accountId: string) =>
  (await sql<{ state: string; auth_user_id: string | null }[]>`select state, auth_user_id from public.accounts where account_id = ${accountId}`)[0]!;

async function rowsLeft(accountId: string): Promise<Record<string, number>> {
  const tables = await sql<{ name: string }[]>`
    select c.table_schema || '.' || c.table_name as name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.column_name = 'account_id' and c.table_schema in ('public', 'private')
    order by 1`;
  const left: Record<string, number> = {};
  for (const { name } of tables) {
    const [row] = await sql.unsafe<{ count: string }[]>(`select count(*) from ${name} where account_id = $1`, [accountId]);
    if (Number(row!.count) > 0) left[name] = Number(row!.count);
  }
  return left;
}

async function authRowsLeft(authUser: string): Promise<Record<string, number>> {
  const tables = await sql<{ name: string; column: string }[]>`
    select table_schema || '.' || table_name as name, column_name as column from information_schema.columns
    where table_schema = 'auth' and ((table_name = 'users' and column_name = 'id') or column_name = 'user_id')`;
  const left: Record<string, number> = {};
  for (const { name, column } of tables) {
    const [row] = await sql.unsafe<{ count: string }[]>(`select count(*) from ${name} where ${column} = $1`, [authUser]);
    if (Number(row!.count) > 0) left[name] = Number(row!.count);
  }
  return left;
}

const exportReady = (phone: SimulatedDevice) =>
  vi.waitFor(
    async () => {
      const latest = await phone.account.export.serverExport();
      if (latest?.state !== 'ready') throw new Error('still preparing');
    },
    { timeout: 20_000, interval: 250 },
  );

const statusToken = (d: SimulatedDevice): string => {
  const stored = d.credentials.items.get('tableside.local.status') ?? d.credentials.items.get('tableside.local.deleted');
  return (JSON.parse(stored!) as { token: string }).token;
};

describe('Delete permanently now', () => {
  it('needs Confirm it’s you, then crosses the boundary at once and erases this device', async () => {
    const { phone, email, accountId } = await signedInPhone('now');
    await phone.playPracticeSession();
    await synced(phone);
    const authUser = (await accountRow(accountId)).auth_user_id!;
    const token = accessToken(phone);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'fresh-authentication-required' });
    expect(phone.account.gate.state).toBe('active');

    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    expect(phone.account.gate).toEqual({ state: 'deleted' });

    expect((await accountRow(accountId)).state).toBe('deleted');
    expect(await sql`select 1 from auth.sessions where user_id = ${authUser}`).toHaveLength(0);
    const [banned] = await sql<{ banned: boolean }[]>`select banned_until > now() as banned from auth.users where id = ${authUser}`;
    expect(banned?.banned ?? true).toBe(true);
    expect((await stack.rawClient(token).rpc('sync_scope_v1', { installation: 'any' })).error).not.toBeNull();

    expect(phone.vault.openAccount).toBeNull();
    expect(phone.vault.holdsAccount(accountId)).toBe(false);
    expect(phone.vault.erasedAppData).toEqual([accountId]);
    expect([...phone.credentials.items.keys()].filter((key) => key.includes(accountId))).toEqual([]);
    expect([...phone.credentials.items.keys()].sort()).toEqual(expect.not.arrayContaining(['tableside.local.account', 'tableside.local.status']));
    for (const value of phone.credentials.items.values()) expect(value).not.toContain(accountId);

    const progress = await phone.account.deletion.status();
    expect(progress).toMatchObject({ status: expect.stringMatching(/^(processing|completed)$/), delayed: false });
    if (!progress || !('cleanupBy' in progress)) throw new Error('no progress');
    expect(progress.cleanupBy - progress.deletedAt).toBe(7 * DAY_MS);
    await cleanedUp(accountId);
    expect(await phone.account.deletion.status()).toMatchObject({ status: 'completed', delayed: false, completedAt: expect.any(Number) });

    await phone.restart();
    expect(await phone.account.resume()).toEqual({ status: 'deleted' });
    expect(phone.account.gate).toEqual({ state: 'deleted' });
    await phone.account.deletion.dismiss();
    expect(phone.account.gate).toEqual({ state: 'no-account' });
    expect([...phone.credentials.items.keys()]).not.toContain('tableside.local.deleted');
  });

  it('works from a deletion-scheduled account, and reports a lost answer truthfully', async () => {
    const { phone, email, accountId } = await signedInPhone('now-lost');
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });

    phone.proxy.dropNextResponse('delete_permanently_v1');
    phone.proxy.dropNextResponse('lifecycle_status_v1');
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'failed' });
    expect(phone.account.gate.state).toBe('deletion-scheduled');
    expect(phone.vault.holdsAccount(accountId)).toBe(true);
    expect((await accountRow(accountId)).state).toBe('deleted');

    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    expect(phone.vault.holdsAccount(accountId)).toBe(false);
    expect(await sql`select origin, deadline from private.deletions where account_id = ${accountId}`).toEqual([{ origin: 'player', deadline: expect.any(Date) }]);
  });

  it('is online only: offline, nothing is sent or saved for later', async () => {
    const { phone, accountId } = await signedInPhone('now-offline');
    phone.proxy.online = false;
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'offline' });
    expect((await accountRow(accountId)).state).toBe('active');
  });

  it('sends "permanent deletion accepted", never claiming a subscription was canceled', async () => {
    const since = await stack.serverNow();
    const { phone, email, accountId } = await signedInPhone('mail');
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    await cleanedUp(accountId);
    const notice = (await phone.mailbox.messages(email)).find((message) => message.includes('being deleted permanently'));
    expect(notice).toContain("can't be undone");
    expect(notice).toContain("doesn't cancel a subscription");
    expect(notice).toContain('ask for a refund');
    expect(await stack.emailSends(since)).toContainEqual({ type: 'deletion-accepted', pacing: 'immediate', outcome: 'sent' });
  });
});

describe('other installations', () => {
  it('erase the account when the server says it is deleted, even after the cleanup, and keep another account’s data', async () => {
    const { phone, email, accountId } = await signedInPhone('others');
    const tablet = device('others-tablet');
    const otherEmail = uniqueEmail('others-b');
    expect(await createAccountByEmail(tablet, otherEmail)).toEqual({ status: 'signed-in' });
    const other = (tablet.account.gate as { accountId: string }).accountId;
    await tablet.playPracticeSession();
    await tablet.account.signOut();
    await signInAlso(tablet, email);
    await tablet.playPracticeSession();
    await synced(tablet);

    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    await cleanedUp(accountId);
    expect(tablet.vault.holdsAccount(accountId)).toBe(true);

    await tablet.account.refreshEligibility();
    expect(tablet.account.gate).toEqual({ state: 'deleted' });
    expect(tablet.vault.holdsAccount(accountId)).toBe(false);
    expect(tablet.vault.holdsAccount(other)).toBe(true);
    expect(await tablet.account.deletion.status()).toMatchObject({ status: 'completed' });
  });
});

describe('a revoked installation', () => {
  it('learns at its next launch that the account was deleted, and erases it', async () => {
    const { phone, email, accountId } = await signedInPhone('revoked');
    const tablet = device('revoked-tablet');
    await signInAlso(tablet, email);
    await tablet.playPracticeSession();
    await confirmByEmail(phone, email);
    expect(await phone.account.devices.signOutOthers()).toMatchObject({ status: 'signed-out', devices: 1 });
    await tablet.account.refreshEligibility();
    expect(tablet.account.gate).toMatchObject({ state: 'revoked', accountId });
    expect(tablet.vault.holdsAccount(accountId)).toBe(true);

    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    await cleanedUp(accountId);
    await tablet.restart();
    expect(tablet.account.gate).toEqual({ state: 'deleted' });
    expect(tablet.vault.holdsAccount(accountId)).toBe(false);
    expect([...tablet.credentials.items.keys()].filter((key) => key.includes(accountId))).toEqual([]);
  });
});

describe('the deadline', () => {
  it('finalizes a scheduled deletion; a stale cancel stays refused and the devices wipe', async () => {
    const { phone, email, accountId } = await signedInPhone('deadline');
    await confirmByEmail(phone, email);
    const scheduled = await phone.account.deletion.schedule();
    if (scheduled.status !== 'scheduled') throw new Error('not scheduled');
    const [scheduledRow] = await sql<{ scheduled_at: Date }[]>`
      select deletion_scheduled_at as scheduled_at from public.accounts where account_id = ${accountId}`;
    const scheduledAt = scheduledRow!.scheduled_at;

    await sql`update public.accounts set deletion_deadline = now() - interval '1 second' where account_id = ${accountId}`;
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'too-late' });
    await sql`select private.finalize_deletion(${accountId})`;
    expect((await accountRow(accountId)).state).toBe('deleted');
    expect(await sql`select origin, requested_at, deadline is not null as had_deadline from private.deletions where account_id = ${accountId}`).toEqual([
      { origin: 'player', requested_at: scheduledAt, had_deadline: true },
    ]);

    expect(await phone.account.deletion.cancel()).toEqual({ status: 'failed' });
    expect(phone.account.gate).toEqual({ state: 'deleted' });
    expect((await accountRow(accountId)).state).toBe('deleted');
  });

  it('is left alone before it comes', async () => {
    const { phone, email, accountId } = await signedInPhone('not-yet');
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.schedule()).toMatchObject({ status: 'scheduled' });
    await sql`select private.finalize_deletion(${accountId})`;
    expect((await accountRow(accountId)).state).toBe('deletion_scheduled');
    expect(await sql`select 1 from private.deletions where account_id = ${accountId}`).toHaveLength(0);
  });
});

describe('cleanup', () => {
  it('erases every row and object the account owned, keeping only the deletion control', async () => {
    const { phone, email, accountId } = await signedInPhone('complete');
    const tablet = device('complete-tablet');
    await signInAlso(tablet, email);
    await phone.playPracticeSession();
    // #142
    await phone.playCheck();
    await queue(phone, testResult.name, { version: 1, resultId: 'r-1', amount: '1', detail: 'detail of r-1' });
    await queue(phone, testAttempt.name, { version: 1, attemptId: 'a-1', passed: true, at: phone.clock.now() });
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });
    await synced(phone);
    await synced(tablet);
    await confirmByEmail(phone, email);
    expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested' });
    await exportReady(phone);
    const [exported] = await sql<{ object_path: string }[]>`select object_path from private.exports where account_id = ${accountId}`;
    const archive = exported!.object_path;
    const authUser = (await accountRow(accountId)).auth_user_id!;
    const bucket = stack.rawClient(accessToken(phone)).storage.from('account-private');
    for (const name of ['notes.txt', 'nested/more.txt']) expect((await bucket.upload(`${accountId}/${name}`, 'mine')).error).toBeNull();
    expect(Object.keys(await rowsLeft(accountId)).length).toBeGreaterThan(10);
    expect(await rowsLeft(accountId)).toMatchObject({ 'private.challenge_attempts': 1 });

    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    await cleanedUp(accountId);

    expect(await rowsLeft(accountId)).toEqual({
      'private.control_journal': 1,
      'private.deleted_sessions': 2,
      'private.deletions': 1,
      'public.accounts': 1,
    });
    expect(await accountRow(accountId)).toEqual({ state: 'deleted', auth_user_id: null });
    expect(await sql`select kind, control from private.control_journal where account_id = ${accountId}`).toEqual([
      { kind: 'account-state', control: { state: 'deleted' } },
    ]);
    expect(await authRowsLeft(authUser)).toEqual({});
    expect(await sql`select 1 from storage.objects where bucket_id = 'account-exports' and name = ${archive}`).toHaveLength(0);
    expect(await sql`select 1 from storage.objects where name like ${`${accountId}%`}`).toHaveLength(0);
    expect(await sql`select 1 from storage.objects where bucket_id = 'account-private' and name like ${`${accountId}/%`}`).toHaveLength(0);
    expect(await sql`select analytics_ids, analytics_requested_at is not null as requested, analytics_completed_at is null as pending
      from private.deletions where account_id = ${accountId}`).toEqual([{ analytics_ids: 1, requested: true, pending: true }]);
    expect(await stack.columns('private.deletions')).toEqual(
      expect.not.arrayContaining(['email', 'payload', 'purchase', 'receipt', 'entitlement', 'forfeited']),
    );
  });

  it('reports processing, a delay and the provider’s completion apart, and a failing step never reopens the account', async () => {
    const { phone, accountId } = await signedInPhone('delayed');
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });
    await synced(phone);
    const token = statusToken(phone);
    await sql.begin(async (tx) => {
      await tx`select public.begin_rights_request_deletion(${accountId}, now(), false)`;
      await tx`select public.deletion_step_failed(${accountId})`;
      await tx`update private.deletions set retry_at = now() + interval '1 hour' where account_id = ${accountId}`;
    });
    const progress = (await stack.rawClient().rpc('deletion_progress_v1', { token })).data as Record<string, unknown>;
    expect(progress).toMatchObject({ status: 'processing', delayed: true, completedAt: null, analytics: { requestedAt: null, completedAt: null }, backups: 'separate' });
    expect((await accountRow(accountId)).state).toBe('deleted');
    expect(await sql`select 1 from auth.sessions s join public.accounts a on a.auth_user_id = s.user_id where a.account_id = ${accountId}`).toHaveLength(0);
    expect(await phone.account.deletion.cancel()).toEqual({ status: 'failed' });
    expect((await accountRow(accountId)).state).toBe('deleted');

    await sql`update private.deletions set retry_at = null where account_id = ${accountId}`;
    await sql`select private.wake_deletion_job()`;
    await cleanedUp(accountId);
    const done = (await stack.rawClient().rpc('deletion_progress_v1', { token })).data as Record<string, unknown>;
    expect(done).toMatchObject({ status: 'completed', delayed: false, providers: 'none', analytics: { requestedAt: expect.any(String), completedAt: null } });
    await stack.serviceClient().rpc('analytics_erasure_completed', { account: accountId });
    expect(((await stack.rawClient().rpc('deletion_progress_v1', { token })).data as { analytics: { completedAt: unknown } }).analytics.completedAt).toEqual(
      expect.any(String),
    );
  });

  it('reports a delay once active cleanup is past its seven days', async () => {
    const { phone, accountId } = await signedInPhone('slow');
    const token = statusToken(phone);
    await sql.begin(async (tx) => {
      await tx`select public.begin_rights_request_deletion(${accountId}, now(), false)`;
      await tx`update private.deletions set cleanup_by = now() - interval '1 minute', leased_until = now() + interval '1 hour' where account_id = ${accountId}`;
    });
    expect((await stack.rawClient().rpc('deletion_progress_v1', { token })).data).toMatchObject({ status: 'processing', delayed: true });
    await sql`update private.deletions set leased_until = null where account_id = ${accountId}`;
    await sql`select private.wake_deletion_job()`;
    await cleanedUp(accountId);
  });

  it('runs each step once even when woken many times', async () => {
    const { phone, email, accountId } = await signedInPhone('retries');
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    for (let i = 0; i < 5; i++) await sql`select private.wake_deletion_job()`;
    await cleanedUp(accountId);
    expect((await phone.mailbox.messages(email)).filter((message) => message.includes('being deleted permanently'))).toHaveLength(1);
    await stack.serviceClient().rpc('deletion_step_done', { account: accountId, step: 'mail', outcome: {} });
    expect(await sql`select completed_at is not null as done from private.deletions where account_id = ${accountId}`).toEqual([{ done: true }]);
  });
});

describe('a verified rights request (the operator’s operation)', () => {
  it('deletes at once, keeping the origin and the original request time', async () => {
    const { phone, accountId } = await signedInPhone('rights-now');
    const requestedAt = new Date(Date.now() - 3 * DAY_MS);
    const { data, error } = await stack.serviceClient().rpc('begin_rights_request_deletion', { account: accountId, requested_at: requestedAt.toISOString() });
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: expect.stringMatching(/^(processing|completed)$/), irreversible: true, origin: 'rights-request', deadline: null });
    expect(Date.parse((data as { requestedAt: string }).requestedAt)).toBe(requestedAt.getTime());
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toEqual({ state: 'deleted' });
    await cleanedUp(accountId);
    expect((await stack.serviceClient().rpc('begin_rights_request_deletion', { account: accountId, requested_at: new Date().toISOString() })).data).toMatchObject({
      status: 'completed',
      origin: 'rights-request',
    });
  });

  it('uses the 30-day window only when the requester chose it, counted from the original request', async () => {
    const { phone, accountId } = await signedInPhone('rights-window');
    const requestedAt = new Date(Date.now() - 3 * DAY_MS);
    const { data } = await stack.serviceClient().rpc('begin_rights_request_deletion', {
      account: accountId,
      requested_at: requestedAt.toISOString(),
      use_window: true,
    });
    expect(data).toMatchObject({ status: 'scheduled', irreversible: false, origin: 'rights-request' });
    expect(Date.parse((data as { deadline: string }).deadline)).toBe(requestedAt.getTime() + 30 * DAY_MS);
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toMatchObject({ state: 'deletion-scheduled', deadline: requestedAt.getTime() + 30 * DAY_MS });

    await sql`update public.accounts set deletion_deadline = now() - interval '1 second' where account_id = ${accountId}`;
    await sql`select private.finalize_deletion(${accountId})`;
    const [row] = await sql<{ origin: string; requested_at: Date }[]>`select origin, requested_at from private.deletions where account_id = ${accountId}`;
    expect(row).toEqual({ origin: 'rights-request', requested_at: requestedAt });
    await cleanedUp(accountId);
  });

  it('is the operator’s alone', async () => {
    const { phone, accountId } = await signedInPhone('rights-denied');
    const raw = stack.rawClient(accessToken(phone));
    expect((await raw.rpc('begin_rights_request_deletion', { account: accountId, requested_at: new Date().toISOString() })).error).not.toBeNull();
    expect((await stack.rawClient().rpc('deletion_case_v1', { account: accountId })).error).not.toBeNull();
    for (const name of ['deletions_due', 'advance_deletion', 'deletion_step_done', 'deletion_step_failed', 'analytics_erasure_completed']) {
      expect((await raw.rpc(name, { account: accountId })).error).not.toBeNull();
    }
    expect((await accountRow(accountId)).state).toBe('active');
  });
});

describe('no resurrection', () => {
  it('denies the deleted account forever: stale uploads, old credentials and a new sign-up recreate nothing', async () => {
    const { phone, email, accountId } = await signedInPhone('resurrect');
    const token = accessToken(phone);
    const status = statusToken(phone);
    const installation = phone.vault.store().identity.installationId;
    await confirmByEmail(phone, email);
    expect(await phone.account.deletion.deletePermanently()).toEqual({ status: 'deleted' });
    await cleanedUp(accountId);
    const left = await rowsLeft(accountId);

    const raw = stack.rawClient(token);
    expect((await raw.rpc('sync_scope_v1', { installation })).error).not.toBeNull();
    expect((await raw.rpc('sync_upload_v1', { request: '{}' })).error).not.toBeNull();
    expect((await raw.rpc('request_export_v1')).error).not.toBeNull();
    expect((await raw.rpc('current_account')).data).toBeNull();
    expect(await rowsLeft(accountId)).toEqual(left);
    expect((await stack.rawClient().rpc('lifecycle_status_v1', { token: status })).data).toEqual({ status: 'deleted' });

    const again = device('resurrect-again');
    await stack.ageCodeRequests(email, 3600);
    expect(await createAccountByEmail(again, email)).toEqual({ status: 'signed-in' });
    const fresh = (again.account.gate as { accountId: string }).accountId;
    expect(fresh).not.toBe(accountId);
    expect((await accountRow(accountId)).state).toBe('deleted');
    expect(await rowsLeft(accountId)).toEqual(left);
  });
});

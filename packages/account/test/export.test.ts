// Spec 2 Export, S2-21, Amendments 1 B2, 2 §5, 5 §3, 6 §3, 7 §6, 8 §2; #102

import { afterEach, describe, expect, it, vi } from 'vitest';

import { completedPracticeSession } from '../src';
import {
  type SimulatedDevice,
  accessToken,
  createAccountByEmail,
  createDevice,
  localStack,
  type TestRevisionedValue,
  readZip,
  signInByEmail,
  testRevisionedItem,
  uniqueEmail,
} from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

function device(name: string): SimulatedDevice {
  const created = createDevice(stack, { name });
  devices.push(created);
  return created;
}

async function signedInPhone(label: string, band: '18+' | '13-15' = '18+') {
  const phone = device(`${label}-phone`);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email, band)).toEqual({ status: 'signed-in' });
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

async function settled(phone: SimulatedDevice) {
  return vi.waitFor(
    async () => {
      const latest = await phone.account.export.serverExport();
      if (!latest || latest.state === 'preparing') throw new Error('still preparing');
      return latest;
    },
    { timeout: 20_000, interval: 250 },
  );
}

async function exportArchive(phone: SimulatedDevice, email: string) {
  await confirmByEmail(phone, email);
  expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested' });
  expect(await settled(phone)).toMatchObject({ state: 'ready' });
  const download = await phone.account.export.downloadServerExport();
  if (download.status !== 'downloaded') throw new Error(`download ${download.status}`);
  return { download, files: readZip(download.bytes) };
}

describe('the server export', () => {
  it('holds the manifest and every synced practice session as CSV summaries and versioned JSON', async () => {
    const { phone, email } = await signedInPhone('archive');
    const first = await phone.playPracticeSession();
    const second = await phone.playPracticeSession();
    await phone.account.sync.reconcile();
    expect(await phone.account.sync.countWaiting()).toBe(0);

    const { download, files } = await exportArchive(phone, email);
    expect(download.fileName).toMatch(/^tableside-export-\d{4}-\d{2}-\d{2}\.zip$/);

    const manifest = JSON.parse(files.get('manifest.json')!) as {
      format: string;
      version: number;
      snapshotAt: string;
      files: { path: string; format: string; records?: number }[];
      omissions: { what: string; why: string }[];
    };
    expect(manifest).toMatchObject({ format: 'tableside-export', version: 1 });
    expect(Date.parse(manifest.snapshotAt)).not.toBeNaN();
    expect(manifest.files.map((file) => file.path).sort()).toEqual([...files.keys()].filter((path) => path !== 'manifest.json').sort());
    expect(manifest.files.find((file) => file.path === 'practice-sessions.csv')).toMatchObject({ format: 'csv', records: 2 });
    expect(manifest.omissions.map((omission) => omission.what)).toContain("Records on devices that haven't synced");

    const { header, row } = completedPracticeSession.export.csv!;
    const lines = files.get('practice-sessions.csv')!.trimEnd().split('\r\n');
    expect(lines[0]).toBe(header.join(','));
    expect(lines.slice(1).sort()).toEqual([first, second].map((record) => row(record).join(',')).sort());

    const json = JSON.parse(files.get('practice-sessions.json')!) as { version: number; recordType: string; records: { activityId: string }[] };
    expect(json).toMatchObject({ version: 1, recordType: 'completed-practice-session' });
    expect(json.records.map((record) => record.activityId).sort()).toEqual([first.activityId, second.activityId].sort());
  });
});

// Spec 3 Synchronized record types › Challenge attempt (exported as JSON); #142
describe('challenge attempts in the server export', () => {
  it('holds every synced challenge attempt whole as versioned JSON, with no CSV and no device preference', async () => {
    const { phone, email } = await signedInPhone('attempts');
    const training = await phone.training();
    await training.setStartHere(false);
    await training.hintSeen('count-entry');
    const first = await phone.playCheck({ wrong: 1 });
    const second = await phone.playCheck({ abandonAfter: 2 });
    await phone.account.sync.reconcile();
    expect(await phone.account.sync.countWaiting()).toBe(0);

    const { files } = await exportArchive(phone, email);
    const manifest = JSON.parse(files.get('manifest.json')!) as { files: { path: string; format: string; records?: number }[] };
    expect(manifest.files.find((file) => file.path === 'challenge-attempts.json')).toMatchObject({ format: 'json', records: 2 });
    expect(files.has('challenge-attempts.csv')).toBe(false);
    const json = JSON.parse(files.get('challenge-attempts.json')!) as { records: { endedAt: number }[] };
    expect(json).toMatchObject({ version: 1, recordType: 'challenge-attempt', payloadVersion: 1 });
    expect(json.records).toEqual([first, second].sort((a, b) => a.endedAt - b.endedAt));
    for (const preference of ['challenge.last-setup', 'learning.start-here-dismissed', 'learning.hints-seen']) {
      for (const [path, text] of files) expect(text, path).not.toContain(preference);
    }
  });
});

// Spec 3 Synchronized record types › Lesson-progress event (exported as JSON); Amendment 1 C7; #147
describe('lesson progress in the server export', () => {
  it('holds every synced lesson-progress event whole as versioned JSON in acceptance order, with no CSV and no device preference', async () => {
    const { phone, email } = await signedInPhone('lessons');
    const training = await phone.training();
    await training.setStartHere(false);
    await training.hintSeen('count-entry');
    await training.stepForward('app-orientation', 1);
    await training.completeLesson('app-orientation');
    await phone.account.sync.reconcile();
    expect(await phone.account.sync.countWaiting()).toBe(0);

    const { files } = await exportArchive(phone, email);
    const manifest = JSON.parse(files.get('manifest.json')!) as { files: { path: string; format: string; records?: number }[] };
    expect(manifest.files.find((file) => file.path === 'lesson-progress.json')).toMatchObject({ format: 'json', records: 2 });
    expect(files.has('lesson-progress.csv')).toBe(false);
    const json = JSON.parse(files.get('lesson-progress.json')!) as { records: { event: unknown; deviceSequence: number }[] };
    expect(json).toMatchObject({ version: 1, recordType: 'lesson-progress', payloadVersion: 1 });
    expect(json.records.map((record) => [record.deviceSequence, record.event])).toEqual([
      [1, { kind: 'bookmark', step: 2 }],
      [2, { kind: 'completed' }],
    ]);
    for (const preference of ['challenge.last-setup', 'learning.start-here-dismissed', 'learning.hints-seen']) {
      for (const [path, text] of files) expect(text, path).not.toContain(preference);
    }
  });
});

// Spec 3 Synchronized record types › Readiness milestone (exported as JSON); #148
describe('readiness milestones in the server export', () => {
  it('hold every accepted milestone whole as versioned JSON, with no CSV', async () => {
    const { phone, email } = await signedInPhone('milestones');
    const first = await phone.playCheck();
    const second = await phone.playCheck();
    await phone.account.sync.reconcile();
    expect(await phone.account.sync.countWaiting()).toBe(0);

    const { files } = await exportArchive(phone, email);
    const manifest = JSON.parse(files.get('manifest.json')!) as { files: { path: string; format: string; records?: number }[] };
    expect(manifest.files.find((file) => file.path === 'readiness-milestones.json')).toMatchObject({ format: 'json', records: 1 });
    expect(files.has('readiness-milestones.csv')).toBe(false);
    const json = JSON.parse(files.get('readiness-milestones.json')!) as { records: unknown[] };
    expect(json).toMatchObject({ version: 1, recordType: 'readiness-milestone', payloadVersion: 1 });
    expect(json.records).toEqual([
      {
        recordVersion: 1,
        owner: first.owner,
        installation: first.installation,
        groupKey: first.groupKey,
        attempts: [first.attemptId, second.attemptId],
        deviceSequences: [1, 2],
        earnedAt: second.endedAt,
      },
    ]);
  });
});

async function objectPath(accountId: string): Promise<string> {
  const [row] = await stack.sql<{ object_path: string }[]>`
    select object_path from private.exports where account_id = ${accountId} order by requested_at desc limit 1`;
  return row!.object_path;
}

async function fetchObject(path: string, token?: string): Promise<number> {
  const response = await fetch(`${stack.url}/storage/v1/object/authenticated/account-exports/${path}`, {
    headers: { apikey: stack.publishableKey, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  await response.body?.cancel();
  return response.status;
}

const objectStored = async (path: string) =>
  (await stack.sql`select 1 from storage.objects where bucket_id = 'account-exports' and name = ${path}`).length > 0;

const staleFreshAuthentication = (token: string) =>
  stack.sql`update private.fresh_authentications set authenticated_at = now() - interval '6 minutes' where session_id = ${sessionOf(token)}`;

const sessionOf = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { session_id: string }).session_id;

describe('asking for and downloading the server export', () => {
  it('needs Confirm it’s you to ask, and again to download once its few minutes have passed', async () => {
    const { phone, email } = await signedInPhone('fresh');
    expect(await phone.account.export.requestServerExport()).toEqual({ status: 'fresh-authentication-required' });
    expect(await phone.account.export.serverExport()).toEqual({ state: 'none' });

    await confirmByEmail(phone, email);
    expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested', export: { state: 'preparing' } });
    const again = await phone.account.export.requestServerExport();
    expect(['preparing', 'requested']).toContain(again.status);
    expect(await settled(phone)).toMatchObject({ state: 'ready', bytes: expect.any(Number) });

    await staleFreshAuthentication(accessToken(phone));
    expect(await phone.account.export.downloadServerExport()).toEqual({ status: 'fresh-authentication-required' });
    await confirmByEmail(phone, email);
    expect(await phone.account.export.downloadServerExport()).toMatchObject({ status: 'downloaded' });
  });

  it('is downloaded only with a live, fresh session of the account: never anonymously, with another account’s token or a stale one', async () => {
    const { phone, email, accountId } = await signedInPhone('denied');
    await exportArchive(phone, email);
    const path = await objectPath(accountId);
    expect(await fetchObject(path, accessToken(phone))).toBe(200);

    expect(await fetchObject(path)).not.toBe(200);
    const intruder = await signedInPhone('intruder');
    await confirmByEmail(intruder.phone, intruder.email);
    expect(await fetchObject(path, accessToken(intruder.phone))).not.toBe(200);
    expect(await intruder.phone.account.export.serverExport()).toEqual({ state: 'none' });
    const upload = await stack.rawClient(accessToken(intruder.phone)).storage.from('account-exports').upload(`${intruder.accountId}/x.zip`, new Blob(['x']), { contentType: 'application/zip' });
    expect(upload.error).not.toBeNull();

    await staleFreshAuthentication(accessToken(phone));
    expect(await fetchObject(path, accessToken(phone))).not.toBe(200);
  });

  it('ends at once when any of the account’s devices is signed out, and its archive is removed', async () => {
    const { phone, email, accountId } = await signedInPhone('revoke');
    const tablet = device('revoke-tablet');
    await stack.ageCodeRequests(email, 3600);
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await exportArchive(phone, email);
    const path = await objectPath(accountId);

    const ipad = (await phone.account.devices.list())!.find((entry) => !entry.thisDevice)!;
    expect(await phone.account.devices.signOut(ipad.id)).toMatchObject({ status: 'signed-out' });
    expect(await phone.account.export.serverExport()).toMatchObject({ state: 'ended', by: 'revocation' });
    expect(await phone.account.export.downloadServerExport()).toEqual({ status: 'not-ready' });
    expect(await fetchObject(path, accessToken(phone))).not.toBe(200);
    await vi.waitFor(async () => expect(await objectStored(path)).toBe(false), { timeout: 20_000, interval: 250 });
  });

  it('expires 24 hours after it was ready, and can be asked for again; a new one replaces the old', async () => {
    const { phone, email, accountId } = await signedInPhone('expiry');
    await exportArchive(phone, email);
    const first = await objectPath(accountId);

    await stack.sql`update private.exports set expires_at = now() - interval '1 second' where object_path = ${first}`;
    expect(await phone.account.export.serverExport()).toMatchObject({ state: 'expired' });
    expect(await phone.account.export.downloadServerExport()).toEqual({ status: 'not-ready' });
    expect(await fetchObject(first, accessToken(phone))).not.toBe(200);
    const [upkeep] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'export-upkeep'`;
    await stack.sql.unsafe(upkeep!.command);
    await vi.waitFor(async () => expect(await objectStored(first)).toBe(false), { timeout: 20_000, interval: 250 });

    await exportArchive(phone, email);
    const second = await objectPath(accountId);
    expect(second).not.toBe(first);
    expect(await objectStored(second)).toBe(true);
    await confirmByEmail(phone, email);
    expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested' });
    expect(await settled(phone)).toMatchObject({ state: 'ready' });
    expect(await fetchObject(second, accessToken(phone))).not.toBe(200);
    await vi.waitFor(async () => expect(await objectStored(second)).toBe(false), { timeout: 20_000, interval: 250 });
  });
});

describe('the export job', () => {
  it('emails "export ready" with no link once the archive is stored', async () => {
    const { phone, email } = await signedInPhone('ready-mail');
    const since = await stack.serverNow();
    await exportArchive(phone, email);
    const mail = await vi.waitFor(async () => {
      const ready = (await phone.mailbox.messages(email)).find((message) => message.includes('account archive is ready'));
      if (!ready) throw new Error('no mail yet');
      return ready;
    });
    expect(mail).toContain('More → Settings → Account → Export my data');
    expect(mail).not.toMatch(/https?:\/\//);
    expect(await stack.emailSends(since)).toContainEqual({ type: 'export-ready', pacing: 'immediate', outcome: 'sent' });
  });

  it('leaves no temporary files behind when a build stops part way', async () => {
    const { phone, email, accountId } = await signedInPhone('stopped');
    await phone.playPracticeSession();
    await phone.account.sync.reconcile();
    const [queued] = await stack.sql<{ export_id: string }[]>`
      insert into private.exports (account_id, object_path) values (${accountId}, ${`${accountId}/stopped.zip`}) returning export_id`;
    const [began] = await stack.sql<{ build: { status: string; export: string } }[]>`select public.begin_export_build() as build`;
    expect(began!.build).toMatchObject({ status: 'building', export: queued!.export_id });
    const parts = async () => (await stack.sql<{ count: number }[]>`select count(*)::int as count from private.export_parts where export_id = ${queued!.export_id}`)[0]!.count;
    expect(await parts()).toBeGreaterThan(0);
    expect(await phone.account.export.serverExport()).toMatchObject({ state: 'preparing' });

    await stack.sql`update private.exports set started_at = now() - interval '16 minutes' where export_id = ${queued!.export_id}`;
    const [upkeep] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'export-upkeep'`;
    await stack.sql.unsafe(upkeep!.command);
    expect(await parts()).toBe(0);
    expect(await phone.account.export.serverExport()).toMatchObject({ state: 'failed' });
    await vi.waitFor(async () => {
      const [row] = await stack.sql<{ object_pending: boolean }[]>`select object_pending from private.exports where export_id = ${queued!.export_id}`;
      expect(row!.object_pending).toBe(false);
    }, { timeout: 20_000, interval: 250 });

    expect((await exportArchive(phone, email)).files.get('practice-sessions.csv')!.trimEnd().split('\r\n')).toHaveLength(2);
  });

  it('removes an archive whose upload lands after its export ended and its folder was swept', async () => {
    const { phone, accountId } = await signedInPhone('late-upload');
    const path = `${accountId}/late.zip`;
    const [queued] = await stack.sql<{ export_id: string }[]>`
      insert into private.exports (account_id, object_path) values (${accountId}, ${path}) returning export_id`;
    await stack.sql`select public.begin_export_build()`;
    await stack.sql`select private.invalidate_exports(${accountId}::uuid, 'revocation')`;
    await vi.waitFor(async () => {
      const [row] = await stack.sql<{ object_pending: boolean }[]>`select object_pending from private.exports where export_id = ${queued!.export_id}`;
      expect(row!.object_pending).toBe(false);
    }, { timeout: 20_000, interval: 250 });
    const { error } = await stack.serviceClient().storage.from('account-exports').upload(path, new Blob(['late'], { type: 'application/zip' }), { contentType: 'application/zip' });
    expect(error).toBeNull();
    const [finished] = await stack.sql<{ answer: { status: string } }[]>`select public.finish_export_build(${queued!.export_id}::uuid, 4) as answer`;
    expect(finished!.answer).toEqual({ status: 'ended' });

    const [upkeep] = await stack.sql<{ command: string }[]>`select command from cron.job where jobname = 'export-upkeep'`;
    await stack.sql.unsafe(upkeep!.command);
    await vi.waitFor(async () => expect(await objectStored(path)).toBe(false), { timeout: 20_000, interval: 250 });
    expect(await phone.account.export.serverExport()).toMatchObject({ state: 'ended', by: 'revocation' });
  });
});

describe('what the archive holds', () => {
  it('holds the account, its settings, methods, devices, totals and privacy choices, with later specs’ sections empty', async () => {
    const { phone, email, accountId } = await signedInPhone('contents');
    const session = await phone.playPracticeSession();
    expect(await phone.account.privacy.grantAnalytics()).toEqual({ status: 'changed' });
    await phone.account.sync.reconcile();
    const { files } = await exportArchive(phone, email);

    const account = JSON.parse(files.get('account.json')!) as Record<string, unknown>;
    expect(account).toMatchObject({
      version: 1,
      account: { id: accountId },
      settings: { currency: 'USD', offlineGame: null, allowanceTimezone: null },
      eligibility: { band: '18+', source: 'declaration', policyVersion: 1 },
      signInMethods: [{ method: 'email', email }],
      devices: [{ platform: 'ios' }],
      totals: [{ total: 'practice', game: session.game, currency: 'simulated', records: 1, net: session.netResult }],
      plan: { status: null },
      allowanceUsage: [],
      experiment: { group: null, policyVersion: null },
      community: { profile: null, ratings: [], blocks: [], listings: [], contributionStatus: null },
    });

    const [id] = await stack.sql<{ analytics_id: string }[]>`select analytics_id from private.analytics_ids where account_id = ${accountId}`;
    expect(JSON.parse(files.get('privacy-choices.json')!)).toMatchObject({
      version: 1,
      recordType: 'privacy-choice',
      records: [{ analyticsConsent: 'granted', consentGeneration: 1, adDataOptOut: null, analyticsIds: [{ generation: 1, analyticsId: id!.analytics_id }] }],
    });
  });

  it('holds no credential, key, token, secret or other player’s record', async () => {
    const { phone, email } = await signedInPhone('secrets');
    const other = await signedInPhone('secrets-other');
    await other.phone.playPracticeSession();
    await other.phone.account.sync.reconcile();
    await phone.playPracticeSession();
    await phone.account.sync.reconcile();
    const { files } = await exportArchive(phone, email);
    const archive = [...files.values()].join('\n');

    const secrets = [...phone.credentials.items.values()].flatMap((value) => {
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        return [parsed.access_token, parsed.refresh_token, parsed.secret, parsed.status_token, parsed.token].filter((v): v is string => typeof v === 'string');
      } catch {
        return [value];
      }
    });
    expect(secrets.length).toBeGreaterThan(0);
    for (const secret of secrets) expect(archive).not.toContain(secret);
    expect(archive).not.toContain(sessionOf(accessToken(phone)));
    expect(archive).not.toContain(other.accountId);
    expect(archive).not.toContain(other.email);
  });
});

describe('an account whose age isn’t established', () => {
  it('still exports through the restricted path, after Confirm it’s you', async () => {
    const { phone, email, accountId } = await signedInPhone('restricted');
    await stack.sql`update public.eligibility set band = 'unresolved' where account_id = ${accountId}`;
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toMatchObject({ state: 'age-unresolved' });
    expect(await phone.account.freshAuthentication.methods()).toEqual([expect.objectContaining({ method: 'email', email })]);

    const { files } = await exportArchive(phone, email);
    expect(JSON.parse(files.get('account.json')!)).toMatchObject({ eligibility: { band: 'unresolved' } });
  });
});

describe('the local supplement', () => {
  const TYPE = testRevisionedItem.name;
  const value = (net: string): TestRevisionedValue => ({ game: 'blackjack', currency: 'USD', net });

  async function conflicted(label: string) {
    const { phone, email, accountId } = await signedInPhone(label);
    const tablet = device(`${label}-tablet`);
    await stack.ageCodeRequests(email, 3600);
    expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
    await phone.account.records.save(TYPE, 'item-1', value('10'));
    await phone.account.sync.reconcile();
    await tablet.account.sync.reconcile();
    phone.proxy.online = false;
    tablet.proxy.online = false;
    await phone.account.records.save(TYPE, 'item-1', value('20'));
    await tablet.account.records.save(TYPE, 'item-1', value('-30'));
    phone.proxy.online = true;
    await phone.account.sync.reconcile();
    tablet.proxy.online = true;
    await tablet.account.sync.reconcile();
    await phone.account.sync.reconcile();
    return { phone, tablet, email, accountId };
  }

  it('labels what hasn’t reached the account with its device, revision and sync status, offline, changing nothing', async () => {
    const { tablet } = await conflicted('supplement');
    const installation = tablet.vault.store().identity.installationId;
    tablet.proxy.online = false;
    const played = await tablet.playPracticeSession();
    await tablet.account.records.save(TYPE, 'item-2', value('5'));
    const practice = await tablet.startPracticeSession();
    await practice.placeWager('red', '10');
    const before = { totals: await tablet.account.records.totals(), waiting: await tablet.account.sync.countWaiting(), sent: tablet.proxy.sent.length };

    const supplement = await tablet.account.export.localSupplement();
    expect(supplement).toMatchObject({ format: 'tableside-local-supplement', version: 1, installation });
    expect(supplement!.notice).toContain("Records on your other devices aren't included");
    expect(supplement!.unsynced).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordType: 'completed-practice-session', item: played.activityId, installation, revision: null, syncStatus: 'waiting' }),
        expect.objectContaining({ recordType: TYPE, item: 'item-2', installation, revision: 0, syncStatus: 'waiting' }),
      ]),
    );
    expect(supplement!.conflicts).toEqual([
      expect.objectContaining({
        recordType: TYPE,
        item: 'item-1',
        acceptedRevision: 2,
        accepted: value('20'),
        proposals: [expect.objectContaining({ installation, revision: 2, syncStatus: 'conflict', record: expect.objectContaining({ kind: 'edit', value: value('-30') }) })],
      }),
    ]);
    const unfinished = (await tablet.vault.store().findUnfinished())!;
    expect(supplement!.unfinished).toEqual([
      { activityId: unfinished.activityId, kind: 'practice-session', game: 'roulette', mode: 'free-play', startedAt: unfinished.createdAt, steps: unfinished.sequence, installation, syncStatus: 'unfinished' },
    ]);
    const text = JSON.stringify(supplement);
    expect(text).not.toContain(unfinished.checkpoint);
    expect(text).not.toContain(JSON.stringify(unfinished.random));

    expect(tablet.proxy.sent.length).toBe(before.sent);
    expect(await tablet.account.records.totals()).toEqual(before.totals);
    expect(await tablet.account.sync.countWaiting()).toBe(before.waiting);
    expect((await tablet.account.records.revisionedItems(TYPE)).find((item) => item.item === 'item-1')?.accepted?.conflict?.proposals).toHaveLength(1);
  });

  it('works while the account’s age isn’t established, and stays empty of anything that has reached the account', async () => {
    const { phone, accountId } = await signedInPhone('supplement-restricted');
    await phone.playPracticeSession();
    await phone.account.sync.reconcile();
    await stack.sql`update public.eligibility set band = 'unresolved' where account_id = ${accountId}`;
    await phone.account.refreshEligibility();
    expect(phone.account.gate).toMatchObject({ state: 'age-unresolved' });
    expect(await phone.account.export.localSupplement()).toMatchObject({ unsynced: [], conflicts: [], unfinished: [] });
  });

  it('and the server archive holds the conflict as it is: the accepted revision with its proposal, unresolved', async () => {
    const { phone, email } = await conflicted('archive-conflict');
    const { files } = await exportArchive(phone, email);
    expect(JSON.parse(files.get('test-revisioned-items.json')!)).toMatchObject({
      recordType: TYPE,
      records: [
        {
          item: 'item-1',
          revision: 2,
          deleted: false,
          value: value('20'),
          conflict: { generation: expect.any(Number), proposals: [{ kind: 'edit', value: value('-30') }] },
        },
      ],
    });
  });
});

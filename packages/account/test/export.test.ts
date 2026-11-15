// Seam 2, export (#102, S2-21; spec 2 *Export*, Amendments 1 B2, 2 §5, 5 §3,
// 6 §3, 7 §6 and 8 §2). The server export needs fresh online authentication;
// a job builds it from one consistent snapshot into private storage, and it
// downloads only for a live, freshly authenticated session of the account,
// for 24 hours, until it is regenerated, a device is revoked or deletion is
// scheduled. The local supplement is built on the device, offline, from what
// hasn't reached the account, labelled so it can't pass for finished sessions.

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

/** Confirm it's you with an emailed code (as if the code-request backoff had passed since the last code). */
async function confirmByEmail(phone: SimulatedDevice, email: string) {
  await stack.ageCodeRequests(email, 3600);
  const previous = await phone.mailbox.latestCode(email);
  expect(await phone.account.freshAuthentication.requestCode()).toEqual({ status: 'sent' });
  expect(await phone.account.freshAuthentication.withCode(await phone.mailbox.latestCode(email, { after: previous }))).toEqual({ status: 'confirmed' });
}

/** Waits for the export job to finish the latest export. */
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

/** Requests, waits for and downloads a server export, then reads the archive. */
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

    // The CSV renders each session exactly as the registry's export rendering does.
    const { header, row } = completedPracticeSession.export.csv!;
    const lines = files.get('practice-sessions.csv')!.trimEnd().split('\r\n');
    expect(lines[0]).toBe(header.join(','));
    expect(lines.slice(1).sort()).toEqual([first, second].map((record) => row(record).join(',')).sort());

    const json = JSON.parse(files.get('practice-sessions.json')!) as { version: number; recordType: string; records: { activityId: string }[] };
    expect(json).toMatchObject({ version: 1, recordType: 'completed-practice-session' });
    expect(json.records.map((record) => record.activityId).sort()).toEqual([first.activityId, second.activityId].sort());
  });
});

/** The account's latest export's object, as the server keeps it. */
async function objectPath(accountId: string): Promise<string> {
  const [row] = await stack.sql<{ object_path: string }[]>`
    select object_path from private.exports where account_id = ${accountId} order by requested_at desc limit 1`;
  return row!.object_path;
}

/** A raw GET of an export object, with a token or none: the adversary's view of the bucket. */
async function fetchObject(path: string, token?: string): Promise<number> {
  const response = await fetch(`${stack.url}/storage/v1/object/authenticated/account-exports/${path}`, {
    headers: { apikey: stack.publishableKey, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  await response.body?.cancel();
  return response.status;
}

/** Whether the bucket still holds the object, once the job has had its turn. */
const objectStored = async (path: string) =>
  (await stack.sql`select 1 from storage.objects where bucket_id = 'account-exports' and name = ${path}`).length > 0;

/** Moves the account's fresh authentication past its few minutes, as if they had passed. */
const staleFreshAuthentication = (token: string) =>
  stack.sql`update private.fresh_authentications set authenticated_at = now() - interval '6 minutes' where session_id = ${sessionOf(token)}`;

/** The Auth session an access token belongs to. */
const sessionOf = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { session_id: string }).session_id;

describe('asking for and downloading the server export', () => {
  it('needs Confirm it’s you to ask, and again to download once its few minutes have passed', async () => {
    const { phone, email } = await signedInPhone('fresh');
    expect(await phone.account.export.requestServerExport()).toEqual({ status: 'fresh-authentication-required' });
    expect(await phone.account.export.serverExport()).toEqual({ state: 'none' });

    await confirmByEmail(phone, email);
    expect(await phone.account.export.requestServerExport()).toMatchObject({ status: 'requested', export: { state: 'preparing' } });
    // Asking again while it's being built answers with the same one.
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
    // Nor can another account ask about it, or write to the bucket.
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
    // An export whose build began and then its function died: its parts are written, nothing stored.
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

    // Asking again works as usual.
    expect((await exportArchive(phone, email)).files.get('practice-sessions.csv')!.trimEnd().split('\r\n')).toHaveLength(2);
  });

  it('removes an archive whose upload lands after its export ended and its folder was swept', async () => {
    const { phone, accountId } = await signedInPhone('late-upload');
    const path = `${accountId}/late.zip`;
    const [queued] = await stack.sql<{ export_id: string }[]>`
      insert into private.exports (account_id, object_path) values (${accountId}, ${path}) returning export_id`;
    await stack.sql`select public.begin_export_build()`;
    // A sign-out ends it mid-build; the sweep finds nothing stored yet.
    await stack.sql`select private.invalidate_exports(${accountId}::uuid, 'revocation')`;
    await vi.waitFor(async () => {
      const [row] = await stack.sql<{ object_pending: boolean }[]>`select object_pending from private.exports where export_id = ${queued!.export_id}`;
      expect(row!.object_pending).toBe(false);
    }, { timeout: 20_000, interval: 250 });
    // Then the slow build's upload lands, and it finishes.
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

  /** A phone and tablet on one account, with item-1 in conflict: the phone's edit accepted as R2, the tablet's a proposal. */
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
    // The unfinished session, without its hidden state.
    const unfinished = (await tablet.vault.store().findUnfinished())!;
    expect(supplement!.unfinished).toEqual([
      { activityId: unfinished.activityId, kind: 'practice-session', game: 'roulette', mode: 'free-play', startedAt: unfinished.createdAt, steps: unfinished.sequence, installation, syncStatus: 'unfinished' },
    ]);
    const text = JSON.stringify(supplement);
    expect(text).not.toContain(unfinished.checkpoint);
    expect(text).not.toContain(JSON.stringify(unfinished.random));

    // Nothing was sent, resolved or counted.
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

// Seam 2: revisioned items, conflicts, tombstones and totals (#94), proven with
// seam 2's test-only revisioned type (supabase/seed/test-record-types.sql) so
// spec 4's casino sessions and private strategies inherit the behavior. Each
// device runs the app's own SQLCipher store; faults are injected at the
// network (fault proxy), never inside the Account service.

import { afterEach, describe, expect, it } from 'vitest';

import { type RevisionedItemView, type TotalsRow, recordTypes } from '../src';
import {
  type SimulatedDevice,
  type TestRevisionedValue,
  createAccountByEmail,
  createDevice,
  directCommands,
  localStack,
  signInByEmail,
  testRevisionedItem,
  uniqueEmail,
} from '../src/testing';

const TYPE = testRevisionedItem.name;

const devices: SimulatedDevice[] = [];
function device(name: string): SimulatedDevice {
  const created = createDevice(localStack(), { name });
  devices.push(created);
  return created;
}
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

/** A phone that created an account, and a tablet (and, if asked, a laptop) signed in to it. */
async function devicesOnOneAccount(count: 2 | 3 = 2) {
  const email = uniqueEmail('revisioned');
  const phone = device('phone');
  const tablet = device('tablet');
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  let laptop: SimulatedDevice | null = null;
  if (count === 3) {
    // A third code request for the address, beyond the two #88 admits at once.
    await localStack().resetCodeRequests();
    laptop = device('laptop');
    expect(await signInByEmail(laptop, email)).toEqual({ status: 'signed-in' });
  }
  const all = [phone, tablet, ...(laptop ? [laptop] : [])];
  await Promise.all(all.map((d) => d.account.sync.idle()));
  return { phone, tablet, laptop: laptop!, all };
}

const session = (net: string, game = 'blackjack', currency = 'USD'): TestRevisionedValue => ({ game, currency, net });

const view = async (d: SimulatedDevice, item = 'item-1'): Promise<RevisionedItemView | undefined> =>
  (await d.account.records.revisionedItems(TYPE)).find((entry) => entry.item === item);
const accepted = async (d: SimulatedDevice, item = 'item-1') => (await view(d, item))?.accepted;
const installation = (d: SimulatedDevice) => d.vault.store().identity.installationId;

/** Brings every device current: each uploads, then each fetches what the others uploaded. */
async function syncAll(all: readonly SimulatedDevice[]) {
  for (const d of all) await d.account.sync.reconcile();
  for (const d of all) await d.account.sync.reconcile();
}

/** An item every device holds at revision 1. */
async function sharedItem(all: readonly SimulatedDevice[], value = session('10')) {
  await all[0]!.account.records.save(TYPE, 'item-1', value);
  await syncAll(all);
  for (const d of all) expect(await accepted(d)).toEqual({ revision: 1, deleted: false, value, conflict: null });
}

function accessToken(d: SimulatedDevice): string {
  for (const value of d.credentials.items.values()) {
    try {
      const token = (JSON.parse(value) as { access_token?: unknown }).access_token;
      if (typeof token === 'string') return token;
    } catch {
      // Not the session.
    }
  }
  throw new Error(`${d.name} holds no session`);
}

/** The account's totals as the server keeps them. */
async function serverTotals(d: SimulatedDevice): Promise<TotalsRow[]> {
  const { data, error } = await localStack().rawClient(accessToken(d)).rpc('account_totals_v1');
  if (error) throw new Error(error.message);
  return (data as { totals: TotalsRow[] }).totals;
}

/** The whole feed, as a device's own credentials read it. */
async function rawFeed(d: SimulatedDevice): Promise<unknown[]> {
  const { data } = await localStack().rawClient(accessToken(d)).rpc('sync_feed_v1', { after: 0, page_size: 100 });
  return (data as { entries: unknown[] }).entries;
}

const casino = (net: string, records = 1, game = 'blackjack', currency = 'USD'): TotalsRow => ({ total: 'casino', game, currency, records, net });

describe('an edit names its base revision', () => {
  it('and with no open conflict becomes the next revision, on every device', async () => {
    const { phone, tablet, all } = await devicesOnOneAccount();
    await sharedItem(all);

    await tablet.account.records.save(TYPE, 'item-1', session('-5/2'));
    await syncAll(all);

    for (const d of all) {
      expect(await view(d)).toEqual({
        item: 'item-1',
        status: 'accepted',
        value: session('-5/2'),
        accepted: { revision: 2, deleted: false, value: session('-5/2'), conflict: null },
      });
    }
    // The edit replaced the item's contribution: one record, the new amount, exactly.
    expect(await serverTotals(phone)).toEqual([casino('-5/2')]);
  });

  it('never conflicts with the installation’s own earlier edit, even when that one’s answer was lost', async () => {
    const { phone, tablet, all } = await devicesOnOneAccount();
    await sharedItem(all);

    phone.proxy.dropNextResponse('sync_upload_v1');
    await phone.account.records.save(TYPE, 'item-1', session('20'));
    await phone.account.sync.idle();
    // Sent, answer lost: the next edit follows it.
    await phone.account.records.save(TYPE, 'item-1', session('30'));
    await syncAll(all);

    for (const d of all) expect(await accepted(d)).toEqual({ revision: 3, deleted: false, value: session('30'), conflict: null });
    expect(await serverTotals(tablet)).toEqual([casino('30')]);
  });
});

describe('a stale competing edit', () => {
  it('becomes a proposal and freezes the accepted revision as the baseline; later devices add proposals without moving it (R1/R2 with a third device)', async () => {
    const { phone, tablet, laptop, all } = await devicesOnOneAccount(3);
    await sharedItem(all);
    for (const d of all) d.proxy.online = false;
    await phone.account.records.save(TYPE, 'item-1', session('20'));
    await tablet.account.records.save(TYPE, 'item-1', session('-30'));
    await laptop.account.records.save(TYPE, 'item-1', session('45'));

    // The phone reaches the account first: R1 to R2.
    phone.proxy.online = true;
    await phone.account.sync.idle();
    expect(await accepted(phone)).toEqual({ revision: 2, deleted: false, value: session('20'), conflict: null });

    // The tablet's edit from R1 is stale: a proposal, with R2 frozen as the baseline.
    tablet.proxy.online = true;
    await tablet.account.sync.idle();
    // The laptop's acknowledgement comes later still (its clock far ahead): one more proposal, the same baseline.
    laptop.clock.advance(7 * 24 * 60 * 60 * 1000);
    laptop.proxy.online = true;
    await laptop.account.sync.idle();
    // Even an edit made from R2 itself waits while the conflict is open.
    await phone.account.sync.reconcile();
    await phone.account.records.save(TYPE, 'item-1', session('25'));
    await syncAll(all);

    for (const d of all) {
      const state = await accepted(d);
      expect(state).toMatchObject({ revision: 2, deleted: false, value: session('20') });
      expect(state?.conflict?.proposals).toEqual([
        { id: expect.any(String), kind: 'edit', installation: installation(tablet), value: session('-30') },
        { id: expect.any(String), kind: 'edit', installation: installation(laptop), value: session('45') },
        { id: expect.any(String), kind: 'edit', installation: installation(phone), value: session('25') },
      ]);
    }
    // The baseline counts exactly once; no proposal counts.
    for (const d of all) expect((await d.account.records.totals()).account).toEqual([casino('20')]);
    expect(await serverTotals(phone)).toEqual([casino('20')]);
  });
});

describe('resolving a conflict', () => {
  /** A phone holding a conflict on item-1: baseline R2 (the phone's), the tablet's proposal; the laptop's edit still offline. */
  async function conflicted() {
    const devicesHere = await devicesOnOneAccount(3);
    const { phone, tablet, laptop, all } = devicesHere;
    await sharedItem(all);
    tablet.proxy.online = false;
    laptop.proxy.online = false;
    await phone.account.records.save(TYPE, 'item-1', session('20'));
    await tablet.account.records.save(TYPE, 'item-1', session('-778/3'));
    await laptop.account.records.save(TYPE, 'item-1', session('-888/5'));
    await phone.account.sync.idle();
    tablet.proxy.online = true;
    await tablet.account.sync.idle();
    await phone.account.sync.reconcile();
    return devicesHere;
  }

  it('needs the network: offline, nothing is resolved or queued', async () => {
    const { phone } = await conflicted();
    const { conflict } = (await accepted(phone))!;
    phone.proxy.online = false;

    const result = await phone.account.records.resolve(TYPE, 'item-1', { generation: conflict!.generation, reviewed: conflict!.proposals.map((p) => p.id), value: session('20') });
    expect(result).toEqual({ status: 'offline' });
    expect(await phone.vault.store().readUploadQueue()).toEqual([]);
    phone.proxy.online = true;
    await phone.account.sync.reconcile();
    expect((await accepted(phone))?.conflict).toEqual(conflict);
  });

  it('returns the changed conflict when a proposal arrived after the review; resolving that creates one revision and removes the rejected payloads', async () => {
    const { phone, tablet, laptop, all } = await conflicted();
    const reviewed = (await accepted(phone))!.conflict!;
    expect(reviewed.proposals.map((p) => p.value)).toEqual([session('-778/3')]);

    // The laptop's proposal arrives while the phone is deciding.
    laptop.proxy.online = true;
    await laptop.account.sync.idle();
    const stale = await phone.account.records.resolve(TYPE, 'item-1', { generation: reviewed.generation, reviewed: reviewed.proposals.map((p) => p.id), value: session('20') });
    expect(stale.status).toBe('conflict-changed');
    const changed = stale.status === 'conflict-changed' ? stale.item?.accepted?.conflict : null;
    expect(changed?.proposals.map((p) => p.value)).toEqual([session('-778/3'), session('-888/5')]);
    expect(changed?.generation).toBeGreaterThan(reviewed.generation);
    expect((await accepted(phone))?.revision).toBe(2);

    // Reviewed again: the phone keeps its own value, with a correction.
    const resolved = await phone.account.records.resolve(TYPE, 'item-1', {
      generation: changed!.generation,
      reviewed: changed!.proposals.map((p) => p.id),
      value: session('21/2'),
    });
    expect(resolved).toEqual({ status: 'resolved' });
    await syncAll(all);
    for (const d of all) expect(await accepted(d)).toEqual({ revision: 3, deleted: false, value: session('21/2'), conflict: null });
    expect(await serverTotals(tablet)).toEqual([casino('21/2')]);

    // The rejected payloads are gone from the account's feed: only their receipts remain.
    const feed = JSON.stringify(await rawFeed(phone));
    expect(feed).not.toContain('-778/3');
    expect(feed).not.toContain('-888/5');
  });

  it('lost its answer: resolving again repeats the same request, and the account makes one revision', async () => {
    const { phone, tablet } = await conflicted();
    const { conflict } = (await accepted(phone))!;
    const resolution = { generation: conflict!.generation, reviewed: conflict!.proposals.map((p) => p.id), value: session('20') };

    phone.proxy.dropNextResponse('sync_upload_v1');
    expect(await phone.account.records.resolve(TYPE, 'item-1', resolution)).toEqual({ status: 'offline' });
    expect(await phone.account.records.resolve(TYPE, 'item-1', resolution)).toEqual({ status: 'resolved' });
    await syncAll([phone, tablet]);
    for (const d of [phone, tablet]) expect(await accepted(d)).toEqual({ revision: 3, deleted: false, value: session('20'), conflict: null });
  });

  it('keeps the rejected proposal’s receipt, so a retry of it never brings it back', async () => {
    const { phone, tablet, all } = await devicesOnOneAccount();
    await sharedItem(all);
    tablet.proxy.online = false;
    await phone.account.records.save(TYPE, 'item-1', session('20'));
    await tablet.account.records.save(TYPE, 'item-1', session('-778/3'));
    await phone.account.sync.idle();
    // The tablet's proposal reaches the account, but its answer is lost: keep the exact request it sent.
    tablet.proxy.online = true;
    tablet.proxy.dropNextResponse('sync_upload_v1');
    await tablet.account.sync.idle();
    const [sent] = await tablet.vault.store().readUploadQueue();
    const request = sent!.operation!.request;
    await syncAll(all);
    const { conflict } = (await accepted(phone))!;

    expect(await phone.account.records.resolve(TYPE, 'item-1', { generation: conflict!.generation, reviewed: conflict!.proposals.map((p) => p.id), value: session('20') })).toEqual({
      status: 'resolved',
    });
    const feedBefore = await rawFeed(phone);

    const retry = await localStack().rawClient(accessToken(tablet)).rpc('sync_upload_v1', { request });
    expect(retry.data).toMatchObject({ status: 'accepted', operation: sent!.operation!.operationId });
    expect(await rawFeed(phone)).toEqual(feedBefore);
    await syncAll(all);
    for (const d of all) expect(await accepted(d)).toEqual({ revision: 3, deleted: false, value: session('20'), conflict: null });
  });
});

describe('deletion', () => {
  it('is a tombstone with zero contribution; a later offline edit is a recovery proposal, restored only by resolution', async () => {
    const { phone, tablet, all } = await devicesOnOneAccount();
    await sharedItem(all);
    tablet.proxy.online = false;
    await phone.account.records.delete(TYPE, 'item-1');
    await phone.account.sync.idle();
    expect(await accepted(phone)).toEqual({ revision: 2, deleted: true, value: null, conflict: null });
    expect(await serverTotals(phone)).toEqual([]);

    // The tablet edited before it learned of the deletion.
    await tablet.account.records.save(TYPE, 'item-1', session('15'));
    tablet.proxy.online = true;
    await syncAll(all);
    for (const d of all) {
      const state = await accepted(d);
      expect(state).toMatchObject({ revision: 2, deleted: true, value: null });
      expect(state?.conflict?.proposals).toEqual([{ id: expect.any(String), kind: 'recovery', installation: installation(tablet), value: session('15') }]);
      expect((await d.account.records.totals()).account).toEqual([]);
    }
    expect(await serverTotals(phone)).toEqual([]);

    // Explicit recovery, after review.
    const { conflict } = (await accepted(phone))!;
    expect(await phone.account.records.resolve(TYPE, 'item-1', { generation: conflict!.generation, reviewed: conflict!.proposals.map((p) => p.id), value: session('15') })).toEqual({
      status: 'resolved',
    });
    await syncAll(all);
    for (const d of all) expect(await accepted(d)).toEqual({ revision: 3, deleted: false, value: session('15'), conflict: null });
    expect(await serverTotals(tablet)).toEqual([casino('15')]);
  });

  it('based on an obsolete revision is itself a competing proposal', async () => {
    const { phone, tablet, all } = await devicesOnOneAccount();
    await sharedItem(all);
    phone.proxy.online = false;
    await tablet.account.records.save(TYPE, 'item-1', session('35'));
    await tablet.account.sync.idle();
    await phone.account.records.delete(TYPE, 'item-1');
    phone.proxy.online = true;
    await syncAll(all);

    for (const d of all) {
      const state = await accepted(d);
      expect(state).toMatchObject({ revision: 2, deleted: false, value: session('35') });
      expect(state?.conflict?.proposals).toEqual([{ id: expect.any(String), kind: 'delete', installation: installation(phone), value: null }]);
    }
    expect(await serverTotals(phone)).toEqual([casino('35')]);
  });
});

describe('totals', () => {
  it('keep exact money, each currency apart, and practice apart from casino; devices agree with the server', async () => {
    const { phone, tablet, all } = await devicesOnOneAccount();
    const practice = await phone.playPracticeSession();
    await phone.account.records.save(TYPE, 'a', session('1/3'));
    await tablet.account.records.save(TYPE, 'b', session('1/6'));
    await tablet.account.records.save(TYPE, 'c', session('-40', 'blackjack', 'EUR'));
    await phone.account.records.save(TYPE, 'd', session('7', 'craps'));
    await syncAll(all);

    const expected: TotalsRow[] = [
      casino('-40', 1, 'blackjack', 'EUR'),
      casino('1/2', 2),
      casino('7', 1, 'craps'),
      { total: 'practice', game: practice.game, currency: 'simulated', records: 1, net: practice.netResult },
    ];
    expect(await serverTotals(phone)).toEqual(expected);
    for (const d of all) expect(await d.account.records.totals()).toEqual({ account: expected, local: [] });
  });

  it('label unsynced new records local, and never count a pending edit as the account’s', async () => {
    const { phone, all } = await devicesOnOneAccount();
    await sharedItem(all, session('10'));
    phone.proxy.online = false;
    await phone.account.records.save(TYPE, 'item-1', session('99'));
    await phone.account.records.save(TYPE, 'item-2', session('5', 'craps'));
    const practice = await phone.playPracticeSession();
    await phone.account.sync.idle();

    expect(await view(phone, 'item-1')).toMatchObject({ status: 'pending', value: session('99'), accepted: { revision: 1, value: session('10') } });
    expect(await view(phone, 'item-2')).toEqual({ item: 'item-2', status: 'local', value: session('5', 'craps'), accepted: null });
    expect(await phone.account.records.totals()).toEqual({
      account: [casino('10')],
      local: [casino('5', 1, 'craps'), { total: 'practice', game: practice.game, currency: 'simulated', records: 1, net: practice.netResult }],
    });

    phone.proxy.online = true;
    await phone.account.sync.idle();
    expect((await phone.account.records.totals()).local).toEqual([]);
    expect((await phone.account.records.totals()).account).toEqual(await serverTotals(phone));
  });
});

describe('conflicts apply only to revisioned items', () => {
  it('an immutable result under a reused identity is refused, never proposed', async () => {
    const { phone } = await devicesOnOneAccount();
    const raw = localStack().rawClient(accessToken(phone));
    const gate = phone.account.gate;
    if (gate.state !== 'active') throw new Error('unreachable');
    // The phone's own installation: the server takes uploads only from the caller's registered installation.
    const installation = phone.vault.store().identity.installationId;
    const commands = await directCommands(raw, installation);
    const request = (operation: string, netResult: string) =>
      JSON.stringify({
        command: commands.next(),
        installation,
        item: 'activity-1',
        operation,
        payload: { activityId: 'activity-1', device: installation, endedAt: 2, finalCashOut: '1010', game: 'roulette', netResult, owner: gate.accountId, recordVersion: 1, startedAt: 1 },
        payloadVersion: 1,
        protocol: 1,
        recordType: 'completed-practice-session',
      });
    expect((await raw.rpc('sync_upload_v1', { request: request('1'.repeat(32), '10') })).data).toMatchObject({ status: 'accepted' });
    expect((await raw.rpc('sync_upload_v1', { request: request('2'.repeat(32), '99') })).data).toMatchObject({ status: 'rejected', code: 'identity-reused' });
    const feed = (await rawFeed(phone)) as { change: Record<string, unknown> }[];
    expect(feed).toHaveLength(1);
    expect(feed[0]!.change).not.toHaveProperty('state');
    expect(await serverTotals(phone)).toEqual([{ total: 'practice', game: 'roulette', currency: 'simulated', records: 1, net: '10' }]);
  });

  it('the registry: each type’s server registration has its kind, acceptance, contribution and snapshot function', async () => {
    const { sql } = localStack();
    for (const type of [...recordTypes.values(), testRevisionedItem]) {
      const [row] = await sql<{ kind: string; accept: string; contributes: boolean; snapshot: string | null }[]>`
        select kind, accept::regproc::text as accept, snapshot::regproc::text as snapshot,
               exists (select 1 from private.record_contributions c where c.record_type = t.record_type) as contributes
        from private.record_types t where record_type = ${type.name} and payload_version = ${type.payloadVersion}`;
      expect(row).toEqual({ kind: type.kind, accept: type.acceptance, contributes: type.contribution !== null, snapshot: type.snapshot });
    }
  });
});

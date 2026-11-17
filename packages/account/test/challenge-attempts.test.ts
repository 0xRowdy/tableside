// Spec 3 Synchronized record types, Amendments 1 C8 and C9, 4 §1; #142

import type { ChallengeAttemptRecord } from '@tableside/engine';
import { afterEach, describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, byOriginatingDevice, challengeAttempt, challengeAttemptSummary } from '../src';
import { prepareOperation } from '../src/sync/protocol';
import {
  type SimulatedDevice,
  accessToken,
  createAccountByEmail,
  createDevice,
  directCommands,
  localStack,
  signInByEmail,
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

async function twoDevices(label: string) {
  const phone = device(`${label}-phone`);
  const tablet = device(`${label}-tablet`);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  expect(await signInByEmail(tablet, email)).toEqual({ status: 'signed-in' });
  await Promise.all([phone.account.sync.idle(), tablet.account.sync.idle()]);
  return { phone, tablet, email };
}

async function synced(...all: SimulatedDevice[]) {
  for (const d of all) await d.account.sync.reconcile();
  for (const d of all) await d.account.sync.reconcile();
}

function accountOf(d: SimulatedDevice): string {
  const gate = d.account.gate;
  if (gate.state !== 'active') throw new Error(`${d.name} is not signed in`);
  return gate.accountId;
}

const installationOf = (d: SimulatedDevice) => d.vault.store().identity.installationId;
const acceptedOn = (d: SimulatedDevice) => d.vault.store().readAcceptedRecords(challengeAttempt.name);

async function historyOn(d: SimulatedDevice) {
  const progress = await (await d.training()).progress();
  return progress.history.map((entry) => ({ attempt: entry.record.attemptId, local: entry.local })).sort((a, b) => a.attempt.localeCompare(b.attempt));
}

async function bestsOn(d: SimulatedDevice) {
  const progress = await (await d.training()).progress();
  return progress.groups.map((group) => ({
    group: group.id,
    bests: group.bests.map((best) => `${best.metric} ${best.result.correct}/${best.result.total} ${best.attempt.attemptId}`),
    fastest: group.fastest?.attempt.attemptId ?? null,
  }));
}

describe('an ended challenge attempt', () => {
  it('reaches every device of the account, labelled local only until it is accepted', async () => {
    const { phone, tablet } = await twoDevices('reach');
    phone.proxy.online = false;
    const record = await phone.playCheck({ wrong: 1 });
    expect(record).toMatchObject({ endingReason: 'completed', deviceSequence: 1, installation: installationOf(phone), meteringBasis: 'challenge-attempt' });
    expect(await historyOn(phone)).toEqual([{ attempt: record.attemptId, local: true }]);

    phone.proxy.online = true;
    await synced(phone, tablet);
    expect(await historyOn(phone)).toEqual([{ attempt: record.attemptId, local: false }]);
    expect(await historyOn(tablet)).toEqual([{ attempt: record.attemptId, local: false }]);
    const [accepted] = await acceptedOn(tablet);
    expect(accepted).toMatchObject({ item: record.attemptId, payload: record, origin: { installation: installationOf(phone), position: 1 } });
  });

  it('is accepted whatever its ending, abandoned included', async () => {
    const { phone, tablet } = await twoDevices('ending');
    const abandoned = await phone.playCheck({ abandonAfter: 3 });
    expect(abandoned.endingReason).toBe('abandoned');
    await synced(phone, tablet);
    expect((await acceptedOn(tablet)).map((record) => record.item)).toEqual([abandoned.attemptId]);
  });

  it('never leaves the device while it is unfinished', async () => {
    const { phone } = await twoDevices('unfinished');
    const service = await phone.training();
    await service.startAttempt({ category: 'card-values', variant: 'check' });
    await phone.account.sync.reconcile();
    expect(await phone.account.sync.countWaiting()).toBe(0);
    expect(await stack.sql`select 1 from private.challenge_attempts where account_id = ${accountOf(phone)}`).toHaveLength(0);
  });
});

describe('per-device order', () => {
  it('fills a late upload into its original device position', async () => {
    const { phone, tablet } = await twoDevices('late');
    phone.proxy.online = false;
    const records: ChallengeAttemptRecord[] = [];
    for (let i = 0; i < 3; i++) records.push(await phone.playCheck());
    expect(records.map((record) => record.deviceSequence)).toEqual([1, 2, 3]);

    const raw = stack.rawClient(accessToken(phone));
    const positions = await directCommands(raw, installationOf(phone));
    for (const [index, entry] of (await phone.vault.store().readUploadQueue()).entries()) {
      if (index === 1) continue;
      const record = entry.payload as ChallengeAttemptRecord;
      expect(entry.position).toBe(record.deviceSequence);
      const { request } = prepareOperation({
        protocol: PROTOCOL_VERSION,
        operation: String(index).repeat(32),
        installation: installationOf(phone),
        command: positions.next(),
        recordType: challengeAttempt.name,
        payloadVersion: 1,
        item: record.attemptId,
        payload: record,
        position: entry.position!,
      });
      expect((await raw.rpc('sync_upload_v1', { request })).data).toMatchObject({ status: 'accepted' });
    }
    await tablet.account.sync.reconcile();
    expect(byOriginatingDevice(await acceptedOn(tablet))[0]?.positions.map((record) => record?.item ?? null)).toEqual([records[0]!.attemptId, null, records[2]!.attemptId]);

    phone.proxy.online = true;
    await synced(phone, tablet);
    const [sequence] = byOriginatingDevice(await acceptedOn(tablet));
    expect(sequence?.runs.map((run) => run.map((record) => record.item))).toEqual([records.map((record) => record.attemptId)]);
  });

  it('keeps each device’s attempts in their own sequence on every device, never stitched together', async () => {
    const { phone, tablet } = await twoDevices('stitch');
    const fromPhone = [await phone.playCheck(), await phone.playCheck()];
    const fromTablet = [await tablet.playCheck()];
    await synced(phone, tablet);
    for (const d of [phone, tablet]) {
      const sequences = byOriginatingDevice(await acceptedOn(d)).map(({ installation, runs }) => [installation, runs.map((run) => run.map((record) => record.item))]);
      expect(sequences).toEqual(
        [
          [installationOf(phone), [fromPhone.map((record) => record.attemptId)]],
          [installationOf(tablet), [fromTablet.map((record) => record.attemptId)]],
        ].sort(([a], [b]) => String(a).localeCompare(String(b))),
      );
    }
  });

  it('refuses a record whose installation or sequence isn’t the sender’s own position', async () => {
    const { phone } = await twoDevices('mismatch');
    phone.proxy.online = false;
    const record = await phone.playCheck();
    const raw = stack.rawClient(accessToken(phone));
    const positions = await directCommands(raw, installationOf(phone));
    const send = async (operation: string, payload: ChallengeAttemptRecord, position: number) =>
      (
        await raw.rpc('sync_upload_v1', {
          request: prepareOperation({
            protocol: PROTOCOL_VERSION,
            operation: operation.repeat(32),
            installation: installationOf(phone),
            command: positions.next(),
            recordType: challengeAttempt.name,
            payloadVersion: 1,
            item: payload.attemptId,
            payload,
            position,
          }).request,
        })
      ).data;
    expect(await send('a', record, 2)).toMatchObject({ status: 'rejected', code: 'position-mismatch' });
    expect(await send('b', { ...record, installation: 'someone-else' }, 1)).toMatchObject({ status: 'rejected', code: 'device-mismatch' });
    expect(await send('c', { ...record, endingReason: 'unfinished' as never }, 1)).toMatchObject({ status: 'rejected', code: 'not-ended' });
  });
});

describe('personal bests', () => {
  it('converge on every device, a new one included, from the attempts’ summaries (Amendment 1 C8)', async () => {
    const { phone, tablet, email } = await twoDevices('bests');
    const weaker = await phone.playCheck({ wrong: 2 });
    const stronger = await tablet.playCheck();
    expect(stronger.endingReason).toBe('completed');
    await synced(phone, tablet);

    const expected = await bestsOn(phone);
    expect(expected).toEqual([{ group: expect.any(String), bests: [`card-values 20/20 ${stronger.attemptId}`], fastest: stronger.attemptId }]);
    expect(await bestsOn(tablet)).toEqual(expected);

    const fresh = device('bests-new');
    await stack.ageCodeRequests(email, 3600);
    expect(await signInByEmail(fresh, email)).toEqual({ status: 'signed-in' });
    await fresh.account.sync.idle();
    expect(await bestsOn(fresh)).toEqual(expected);
    expect(await historyOn(fresh)).toEqual([weaker, stronger].map((record) => ({ attempt: record.attemptId, local: false })).sort((a, b) => a.attempt.localeCompare(b.attempt)));
  });
});

describe('bootstrap (Amendment 1 C8, Amendment 4 §1)', () => {
  it('gives a new device every attempt’s summary, and its review facts when the attempt is opened', async () => {
    const { phone, email } = await twoDevices('summary');
    const record = await phone.playCheck({ wrong: 1 });
    await synced(phone);

    const rows = await stack.sql<{ change: { record: Record<string, unknown>; origin: unknown } }[]>`
      select change from private.snapshot_challenge_attempts(${accountOf(phone)}::uuid, 'challenge-attempt')`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.change).toEqual({ record: challengeAttemptSummary(record), origin: { installation: installationOf(phone), position: 1 } });
    expect(rows[0]!.change.record).toMatchObject({
      groupKey: record.groupKey,
      metrics: record.metrics,
      endingReason: 'completed',
      deviceSequence: 1,
      performanceMs: record.performanceMs,
      finances: null,
      allowancePolicyVersion: record.allowancePolicyVersion,
      meteringBasis: 'challenge-attempt',
    });

    const fresh = device('summary-new');
    await stack.ageCodeRequests(email, 3600);
    expect(await signInByEmail(fresh, email)).toEqual({ status: 'signed-in' });
    await fresh.account.sync.idle();
    const service = await fresh.training();
    expect(await service.attemptReview(record.attemptId)).toEqual(record);
  });
});

// Spec 3 Amendment 1 C9
describe('the local export supplement', () => {
  it('holds an unfinished Check only as its entered answers and the fact it exists, and no device preference', async () => {
    const { phone } = await twoDevices('supplement');
    phone.proxy.online = false;
    const ended = await phone.playCheck();
    const service = await phone.training();
    await service.startAttempt({ category: 'card-values', variant: 'check' });
    let snapshot = service.snapshot();
    for (let guard = 0; snapshot.status === 'active' && snapshot.view.phase !== 'question' && guard < 10; guard++) {
      await service.submit({ kind: 'next-item' });
      snapshot = service.snapshot();
    }
    await service.submit({ kind: 'skip' });

    const supplement = await phone.account.export.localSupplement();
    expect(supplement?.unsynced.map((entry) => [entry.recordType, entry.item, entry.syncStatus])).toEqual([['challenge-attempt', ended.attemptId, 'waiting']]);
    expect(supplement?.unfinished).toEqual([
      {
        kind: 'challenge-attempt',
        activityId: expect.any(String),
        category: 'card-values',
        variant: 'check',
        startedAt: expect.any(Number),
        answers: [{ position: 1, entered: 'skip' }],
        installation: installationOf(phone),
        syncStatus: 'unfinished',
      },
    ]);
    const unfinished = JSON.stringify(supplement?.unfinished);
    for (const hidden of ['reference', 'rank', 'suit', 'items', 'random', 'checkpoint', 'review']) expect(unfinished).not.toContain(hidden);
    for (const preference of ['challenge.last-setup', 'learning.start-here-dismissed', 'learning.hints-seen']) {
      expect(JSON.stringify(supplement)).not.toContain(preference);
    }
  });
});

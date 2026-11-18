// Spec 3 Synchronized record types › Readiness milestone; Testing Decisions › Seam 2; #148

import type { ChallengeAttemptRecord } from '@tableside/engine';
import { afterEach, describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type ReadinessMilestoneRecord, challengeAttempt, readinessMilestone } from '../src';
import { prepareOperation } from '../src/sync/protocol';
import {
  type DirectCommands,
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

async function onePhone(label: string) {
  const phone = device(`${label}-phone`);
  const email = uniqueEmail(label);
  expect(await createAccountByEmail(phone, email)).toEqual({ status: 'signed-in' });
  await phone.account.sync.idle();
  return { phone, email };
}

async function twoDevices(label: string) {
  const { phone, email } = await onePhone(label);
  const tablet = device(`${label}-tablet`);
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

const serverMilestones = async (d: SimulatedDevice) =>
  (await stack.sql<{ payload: ReadinessMilestoneRecord; sequence: string }[]>`
    select payload, sequence from private.readiness_milestones where account_id = ${accountOf(d)}::uuid order by sequence`).map((row) => ({
    ...row.payload,
    sequence: Number(row.sequence),
  }));

const serverAttemptSequences = async (d: SimulatedDevice) =>
  new Map(
    (
      await stack.sql<{ attempt_id: string; sequence: string }[]>`
        select attempt_id, sequence from private.challenge_attempts where account_id = ${accountOf(d)}::uuid`
    ).map((row) => [row.attempt_id, Number(row.sequence)]),
  );

async function milestoneOn(d: SimulatedDevice) {
  const [group] = (await (await d.training()).progress()).groups.filter((entry) => entry.key.variant === 'check');
  return group?.milestone ? { installation: group.milestone.record.installation, attempts: group.milestone.record.attempts, local: group.milestone.local } : null;
}

function citing(first: ChallengeAttemptRecord, second: ChallengeAttemptRecord, overrides: Partial<ReadinessMilestoneRecord> = {}): ReadinessMilestoneRecord {
  return {
    recordVersion: 1,
    owner: first.owner,
    installation: first.installation,
    groupKey: second.groupKey,
    attempts: [first.attemptId, second.attemptId],
    deviceSequences: [first.deviceSequence, second.deviceSequence],
    earnedAt: second.endedAt,
    ...overrides,
  };
}

interface Uploader {
  attempt(operation: string, record: ChallengeAttemptRecord): Promise<unknown>;
  milestone(operation: string, milestone: ReadinessMilestoneRecord, after?: readonly string[]): Promise<unknown>;
}

async function uploaderFor(d: SimulatedDevice): Promise<Uploader> {
  const raw = stack.rawClient(accessToken(d));
  const positions: DirectCommands = await directCommands(raw, installationOf(d));
  const commands = new Map<string, ReturnType<DirectCommands['next']>>();
  const send = async (operation: string, fields: Record<string, unknown>) => {
    const command = commands.get(operation) ?? positions.next();
    commands.set(operation, command);
    const { request } = prepareOperation({
      protocol: PROTOCOL_VERSION,
      operation: operation.repeat(32),
      installation: installationOf(d),
      command,
      payloadVersion: 1,
      ...fields,
    } as Parameters<typeof prepareOperation>[0]);
    return (await raw.rpc('sync_upload_v1', { request })).data;
  };
  return {
    attempt: (operation, record) =>
      send(operation, { recordType: challengeAttempt.name, item: record.attemptId, payload: record, position: record.deviceSequence }),
    milestone: (operation, milestone, after) =>
      send(operation, {
        recordType: readinessMilestone.name,
        item: readinessMilestone.identity.of(milestone),
        payload: milestone,
        ...(after ? { after: after.map((id) => id.repeat(32)) } : {}),
      }),
  };
}

describe('a readiness milestone', () => {
  it('reaches the server only after the attempts it cites, and shows on every device once synced', async () => {
    const { phone, tablet } = await twoDevices('reach');
    phone.proxy.online = false;
    const first = await phone.playCheck();
    const second = await phone.playCheck({ wrong: 1 });
    expect(await milestoneOn(phone)).toEqual({ installation: installationOf(phone), attempts: [first.attemptId, second.attemptId], local: true });
    const queue = await phone.vault.store().readUploadQueue();
    const milestoneEntry = queue.find((entry) => entry.recordType === readinessMilestone.name);
    expect(milestoneEntry?.dependencies).toEqual(queue.filter((entry) => entry.recordType === challengeAttempt.name).map((entry) => entry.id));

    phone.proxy.online = true;
    await synced(phone, tablet);
    const attempts = await serverAttemptSequences(phone);
    const [accepted] = await serverMilestones(phone);
    expect(accepted).toMatchObject(citing(first, second));
    expect(accepted!.sequence).toBeGreaterThan(Math.max(attempts.get(first.attemptId)!, attempts.get(second.attemptId)!));
    for (const d of [phone, tablet]) expect(await milestoneOn(d)).toEqual({ installation: installationOf(phone), attempts: [first.attemptId, second.attemptId], local: false });
  });

  // Spec 3 Synchronized record types › Readiness milestone (Barrier)
  it('waits on the server until every attempt it names has its receipt, then is accepted', async () => {
    const { phone } = await onePhone('barrier');
    phone.proxy.online = false;
    const first = await phone.playCheck();
    const second = await phone.playCheck();
    const upload = await uploaderFor(phone);

    expect(await upload.milestone('d', citing(first, second), ['1', '2'])).toMatchObject({ status: 'waiting' });
    expect(await upload.attempt('1', first)).toMatchObject({ status: 'accepted' });
    expect(await upload.milestone('d', citing(first, second), ['1', '2'])).toMatchObject({ status: 'waiting' });
    expect(await upload.attempt('2', second)).toMatchObject({ status: 'accepted' });
    expect(await upload.milestone('d', citing(first, second), ['1', '2'])).toMatchObject({ status: 'accepted' });
    expect(await serverMilestones(phone)).toMatchObject([citing(first, second)]);
  });

  it('is rejected across a gap in its installation’s attempts', async () => {
    const { phone } = await onePhone('gap');
    phone.proxy.online = false;
    const [first, missing, third] = [await phone.playCheck(), await phone.playCheck(), await phone.playCheck()];
    expect(missing.deviceSequence).toBe(2);
    const upload = await uploaderFor(phone);
    for (const [operation, record] of [['1', first], ['3', third]] as const) expect(await upload.attempt(operation, record!)).toMatchObject({ status: 'accepted' });
    expect(await upload.milestone('d', citing(first!, third!))).toMatchObject({ status: 'rejected', code: 'gap' });
    expect(await upload.milestone('e', citing(first!, missing!))).toMatchObject({ status: 'rejected', code: 'attempt-missing' });
    expect(await serverMilestones(phone)).toEqual([]);
  });

  it('is rejected after a breaking attempt between the two it cites: below the threshold or abandoned (Amendment 1 C2)', async () => {
    const { phone } = await onePhone('broken');
    const pass1 = await phone.playCheck();
    await phone.playCheck({ wrong: 2 });
    const pass2 = await phone.playCheck();
    await phone.playCheck({ abandonAfter: 2 });
    const pass3 = await phone.playCheck();
    await synced(phone);
    expect(await milestoneOn(phone)).toBeNull();
    expect(await serverMilestones(phone)).toEqual([]);

    const upload = await uploaderFor(phone);
    expect(await upload.milestone('a', citing(pass1, pass2))).toMatchObject({ status: 'rejected', code: 'streak-broken' });
    expect(await upload.milestone('b', citing(pass2, pass3))).toMatchObject({ status: 'rejected', code: 'streak-broken' });
  });

  it('is rejected unless both cited attempts advance the streak, consecutively, in the milestone’s group, as the first one earned there', async () => {
    const { phone } = await onePhone('rules');
    phone.proxy.online = false;
    const [a, b, c] = [await phone.playCheck(), await phone.playCheck(), await phone.playCheck()];
    const below = await phone.playCheck({ wrong: 2 });
    const upload = await uploaderFor(phone);
    for (const [operation, record] of [['1', a], ['2', b], ['3', c], ['4', below]] as const) expect(await upload.attempt(operation, record!)).toMatchObject({ status: 'accepted' });

    expect(await upload.milestone('a', citing(a!, c!))).toMatchObject({ status: 'rejected', code: 'not-consecutive' });
    expect(await upload.milestone('b', citing(c!, below))).toMatchObject({ status: 'rejected', code: 'not-advancing' });
    expect(await upload.milestone('c', citing(b!, a!, { deviceSequences: [1, 2] }))).toMatchObject({ status: 'rejected', code: 'invalid-citation' });
    expect(await upload.milestone('d', citing(a!, b!, { groupKey: { ...a!.groupKey, pacing: '2s' } }))).toMatchObject({ status: 'rejected', code: 'group-mismatch' });
    expect(await upload.milestone('e', citing(a!, b!))).toMatchObject({ status: 'accepted' });
    expect(await upload.milestone('e', citing(a!, b!))).toMatchObject({ status: 'accepted' });
    expect(await upload.milestone('f', citing(b!, c!))).toMatchObject({ status: 'rejected', code: 'already-earned' });
    expect(await serverMilestones(phone)).toMatchObject([citing(a!, b!)]);
  });
});

// Spec 3 Synchronized record types › Readiness milestone; #148's handoff
describe('a refused milestone', () => {
  it('frees its group, so the next streak there is claimed and synced, and never shows meanwhile', async () => {
    const { phone } = await onePhone('refused');
    phone.proxy.online = false;
    const first = await phone.playCheck();
    const second = await phone.playCheck();
    // The server's own earlier milestone in the group stands in for any refusal.
    await stack.sql`
      insert into private.readiness_milestones (account_id, item_id, payload, installation_id, group_key, operation_id, sequence)
      values (${accountOf(phone)}::uuid, 'stand-in', '{}'::jsonb, ${installationOf(phone)}, ${stack.sql.json(second.groupKey as never)}, 'stand-in', 0)`;
    phone.proxy.online = true;
    await synced(phone);
    const [refused] = (await phone.vault.store().readMilestoneSync()).refused;
    expect(refused).toBe(readinessMilestone.identity.of(citing(first, second)));
    expect(await milestoneOn(phone)).toBeNull();

    await stack.sql`delete from private.readiness_milestones where item_id = 'stand-in'`;
    const third = await phone.playCheck();
    expect(await milestoneOn(phone)).toEqual({ installation: installationOf(phone), attempts: [second.attemptId, third.attemptId], local: true });
    await synced(phone);
    expect(await milestoneOn(phone)).toEqual({ installation: installationOf(phone), attempts: [second.attemptId, third.attemptId], local: false });
    expect(await serverMilestones(phone)).toMatchObject([citing(second, third)]);
  });
});

// Spec 3 Amendment 1 B3
describe('two devices’ streaks', () => {
  it('are never stitched: each device earns its own milestone, and both show on every device', async () => {
    const { phone, tablet } = await twoDevices('stitch');
    const fromPhone = await phone.playCheck();
    const fromTablet = await tablet.playCheck();
    await synced(phone, tablet);
    for (const d of [phone, tablet]) expect(await milestoneOn(d)).toBeNull();

    const upload = await uploaderFor(phone);
    const stitched = citing(fromPhone, fromTablet, { deviceSequences: [1, 2] });
    expect(await upload.milestone('a', stitched)).toMatchObject({ status: 'rejected', code: 'other-installation' });
    expect(await upload.milestone('b', citing(fromTablet, { ...fromTablet, attemptId: 'later', deviceSequence: 2 }))).toMatchObject({
      status: 'rejected',
      code: 'device-mismatch',
    });

    const secondOnPhone = await phone.playCheck();
    await synced(phone, tablet);
    expect(await milestoneOn(tablet)).toEqual({ installation: installationOf(phone), attempts: [fromPhone.attemptId, secondOnPhone.attemptId], local: false });

    const secondOnTablet = await tablet.playCheck();
    await synced(phone, tablet);
    expect((await serverMilestones(phone)).map((milestone) => [milestone.installation, milestone.attempts])).toEqual([
      [installationOf(phone), [fromPhone.attemptId, secondOnPhone.attemptId]],
      [installationOf(tablet), [fromTablet.attemptId, secondOnTablet.attemptId]],
    ]);
    expect(await tablet.vault.store().readMilestones()).toMatchObject([{ installation: installationOf(tablet), attempts: [fromTablet.attemptId, secondOnTablet.attemptId] }]);
  });
});

describe('bootstrap (Amendment 1 C8)', () => {
  it('gives a new device every accepted milestone whole', async () => {
    const { phone, email } = await onePhone('bootstrap');
    const first = await phone.playCheck();
    const second = await phone.playCheck();
    await synced(phone);
    const rows = await stack.sql<{ change: unknown }[]>`
      select change from private.snapshot_readiness_milestones(${accountOf(phone)}::uuid, 'readiness-milestone')`;
    expect(rows.map((row) => row.change)).toEqual([{ record: citing(first, second) }]);

    const fresh = device('bootstrap-new');
    await stack.ageCodeRequests(email, 3600);
    expect(await signInByEmail(fresh, email)).toEqual({ status: 'signed-in' });
    await fresh.account.sync.idle();
    expect(await milestoneOn(fresh)).toEqual({ installation: installationOf(phone), attempts: [first.attemptId, second.attemptId], local: false });
  });
});

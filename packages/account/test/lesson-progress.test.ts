// Spec 3 Synchronized record types › Lesson-progress event, Amendment 1 C7, C8, C10; #147

import { afterEach, describe, expect, it } from 'vitest';

import { LESSONS, type Lesson } from '../../definitions/src';
import { PROTOCOL_VERSION, type LessonProgressEvent, lessonProgressEvent } from '../src';
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

const ORIENTATION = 'app-orientation';
const BUILDER = 'building-a-strategy';

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

async function statusOn(d: SimulatedDevice, id = ORIENTATION, lessons?: readonly Lesson[]) {
  const service = await d.training(lessons ? { lessons } : {});
  return (await service.listLessons()).find((entry) => entry.id === id)!.status;
}

async function stepTo(d: SimulatedDevice, step: number) {
  const service = await d.training();
  for (let from = 1; from < step; from++) await service.stepForward(ORIENTATION, from);
}

const serverEvents = async (d: SimulatedDevice) =>
  (await stack.sql<{ payload: LessonProgressEvent }[]>`
    select payload from private.lesson_progress_events where account_id = ${accountOf(d)}::uuid order by sequence`).map((row) => row.payload);

describe('lesson completion', () => {
  it('is a union across devices', async () => {
    const { phone, tablet } = await twoDevices('union');
    await (await phone.training()).completeLesson(ORIENTATION);
    await (await tablet.training()).completeLesson(BUILDER);
    await synced(phone, tablet);
    for (const d of [phone, tablet]) {
      expect(await statusOn(d, ORIENTATION)).toEqual({ kind: 'completed' });
      expect(await statusOn(d, BUILDER)).toEqual({ kind: 'completed' });
    }
  });

  it('survives a restart from another device, which resets the bookmark to step 1', async () => {
    const { phone, tablet } = await twoDevices('restart');
    await (await phone.training()).completeLesson(ORIENTATION);
    await stepTo(phone, 3);
    await synced(phone, tablet);
    expect((await (await tablet.training()).openLesson(ORIENTATION)).step).toBe(3);

    await (await tablet.training()).restartLesson(ORIENTATION);
    await synced(tablet, phone);
    expect(await statusOn(phone)).toEqual({ kind: 'completed' });
    expect(await (await phone.training()).openLesson(ORIENTATION)).toMatchObject({ step: 1, prompt: null });
  });
});

describe('the lesson bookmark', () => {
  it('is the most recently synced, so a device that comes back late overwrites newer progress', async () => {
    const { phone, tablet } = await twoDevices('latest');
    phone.proxy.online = false;
    await stepTo(phone, 4);
    await stepTo(tablet, 2);
    await synced(tablet);
    expect(await statusOn(tablet)).toEqual({ kind: 'in-progress', step: 2 });

    phone.proxy.online = true;
    await synced(phone, tablet);
    for (const d of [phone, tablet]) expect(await statusOn(d)).toEqual({ kind: 'in-progress', step: 4 });

    await (await tablet.training()).stepBack(ORIENTATION, 2);
    await synced(tablet, phone);
    for (const d of [phone, tablet]) expect(await statusOn(d)).toEqual({ kind: 'in-progress', step: 1 });
  });

  it('persists offline through an app restart and syncs later', async () => {
    const { phone, tablet } = await twoDevices('offline');
    phone.proxy.online = false;
    await stepTo(phone, 3);
    await phone.restart();
    expect(await statusOn(phone)).toEqual({ kind: 'in-progress', step: 3 });
    await phone.account.sync.reconcile();
    expect(await phone.account.sync.countWaiting()).toBe(2);
    expect(await serverEvents(phone)).toEqual([]);
    await synced(tablet);
    expect(await statusOn(tablet)).toEqual({ kind: 'not-started' });

    phone.proxy.online = true;
    await synced(phone, tablet);
    expect(await phone.account.sync.countWaiting()).toBe(0);
    expect(await statusOn(tablet)).toEqual({ kind: 'in-progress', step: 3 });
  });
});

// Spec 3 Lessons › Progress, Amendment 1 C10
describe('a material lesson change', () => {
  it('keeps the earlier completion in history on every device', async () => {
    const { phone, tablet } = await twoDevices('material');
    await (await phone.training()).completeLesson(ORIENTATION);
    await synced(phone, tablet);

    const changed = LESSONS.map((lesson) =>
      lesson.id === ORIENTATION ? { ...lesson, content: { ...lesson.content!, version: 2, materialVersion: 2, change: 'help moved' } } : lesson,
    );
    expect(await statusOn(tablet, ORIENTATION, changed)).toEqual({ kind: 'completed-earlier-version' });
    const service = await tablet.training({ lessons: changed });
    expect(await service.openLesson(ORIENTATION)).toMatchObject({ step: 1, notice: { kind: 'after-completion', change: 'help moved' } });
    await service.restartLesson(ORIENTATION);
    await service.completeLesson(ORIENTATION);
    await synced(tablet, phone);

    expect(await statusOn(phone, ORIENTATION, changed)).toEqual({ kind: 'completed' });
    expect(await statusOn(phone)).toEqual({ kind: 'completed' });
    expect((await serverEvents(phone)).filter((event) => event.event.kind === 'completed').map((event) => event.lesson)).toEqual([
      { id: ORIENTATION, version: 1, materialVersion: 1 },
      { id: ORIENTATION, version: 2, materialVersion: 2 },
    ]);
  });
});

// Spec 3 Amendment 1 C8
describe('bootstrap', () => {
  it('gives a new device every lesson-progress event as summary data, so its lesson state converges', async () => {
    const { phone, tablet, email } = await twoDevices('bootstrap');
    await (await phone.training()).completeLesson(BUILDER);
    await stepTo(tablet, 3);
    await synced(phone, tablet);

    const rows = await stack.sql<{ change: { record: LessonProgressEvent; origin: unknown } }[]>`
      select change from private.snapshot_lesson_progress_events(${accountOf(phone)}::uuid, 'lesson-progress')`;
    expect(rows.map((row) => row.change.origin)).toEqual(
      expect.arrayContaining([
        { installation: installationOf(phone), position: 1 },
        { installation: installationOf(tablet), position: 1 },
        { installation: installationOf(tablet), position: 2 },
      ]),
    );
    expect(rows.map((row) => row.change.record)).toEqual(expect.arrayContaining(await serverEvents(phone)));

    const fresh = device('bootstrap-new');
    await stack.ageCodeRequests(email, 3600);
    expect(await signInByEmail(fresh, email)).toEqual({ status: 'signed-in' });
    await fresh.account.sync.idle();
    expect(await statusOn(fresh, BUILDER)).toEqual({ kind: 'completed' });
    expect(await statusOn(fresh, ORIENTATION)).toEqual({ kind: 'in-progress', step: 3 });
  });
});

describe('the server', () => {
  it('refuses an event whose installation or sequence isn’t the sender’s own position, or that isn’t a lesson-progress event', async () => {
    const { phone } = await twoDevices('mismatch');
    phone.proxy.online = false;
    await stepTo(phone, 2);
    const [entry] = await phone.vault.store().readUploadQueue();
    const event = entry!.payload as LessonProgressEvent;
    expect(entry!.position).toBe(event.deviceSequence);
    const raw = stack.rawClient(accessToken(phone));
    const positions = await directCommands(raw, installationOf(phone));
    const send = async (operation: string, payload: unknown, position: number) =>
      (
        await raw.rpc('sync_upload_v1', {
          request: prepareOperation({
            protocol: PROTOCOL_VERSION,
            operation: operation.repeat(32),
            installation: installationOf(phone),
            command: positions.next(),
            recordType: lessonProgressEvent.name,
            payloadVersion: 1,
            item: event.eventId,
            payload,
            position,
          }).request,
        })
      ).data;
    expect(await send('a', event, 2)).toMatchObject({ status: 'rejected', code: 'position-mismatch' });
    expect(await send('b', { ...event, installation: 'someone-else' }, 1)).toMatchObject({ status: 'rejected', code: 'device-mismatch' });
    expect(await send('c', { ...event, event: { kind: 'bookmark', step: 0 } }, 1)).toMatchObject({ status: 'rejected', code: 'invalid-payload' });
    expect(await send('d', { ...event, event: { kind: 'skipped' } }, 1)).toMatchObject({ status: 'rejected', code: 'invalid-payload' });
    expect(await send('e', event, 1)).toMatchObject({ status: 'accepted' });
  });
});

// Spec 3 Amendment 1 C7
describe('device-local preferences', () => {
  it('stay out of lesson-progress uploads and accepted records', async () => {
    const { phone, tablet } = await twoDevices('preferences');
    const service = await phone.training();
    await service.setStartHere(false);
    await service.hintSeen('count-entry');
    await service.completeLesson(ORIENTATION);
    await synced(phone, tablet);
    const uploads = phone.proxy.sent.filter(({ url }) => url.includes('sync_upload_v1')).map(({ body }) => body ?? '');
    expect(uploads.some((body) => body.includes('lesson-progress'))).toBe(true);
    const accepted = JSON.stringify(await tablet.vault.store().readAcceptedRecords(lessonProgressEvent.name));
    for (const preference of ['challenge.last-setup', 'learning.start-here-dismissed', 'learning.hints-seen']) {
      for (const body of uploads) expect(body).not.toContain(preference);
      expect(accepted).not.toContain(preference);
    }
  });
});

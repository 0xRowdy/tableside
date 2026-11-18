// Spec 3 Information hiding (end to end), Launch gates 2, Testing Decisions › Seam 2; Amendment 1 C7, C9; #156

import { decodeChallengeCheckpoint, type ChallengeView } from '@tableside/engine';
import { afterEach, describe, expect, it } from 'vitest';

import type { ChallengeSetup, TrainingService } from '../../../apps/mobile/src/training/service';
import { DEFAULT_TABLE_SETUP } from '../../definitions/src';
import { revealingFields } from '../../engine/test/information-hiding';
import { type MetricEvent, METRICS, TEEN_METRICS, challengeAttempt } from '../src';
import { type SimulatedDevice, createAccountByEmail, createDevice, localStack, uniqueEmail } from '../src/testing';

const stack = localStack();
const devices: SimulatedDevice[] = [];
afterEach(() => devices.splice(0).forEach((d) => d.dispose()));

async function signedIn(label: string, band: '18+' | '13-15' = '18+') {
  const events: MetricEvent[] = [];
  const d = createDevice(stack, { name: label, metrics: { send: (event) => void events.push(event) } });
  devices.push(d);
  expect(await createAccountByEmail(d, uniqueEmail(label), band)).toEqual({ status: 'signed-in' });
  await d.account.sync.idle();
  return { d, events };
}

function accountOf(d: SimulatedDevice): string {
  const gate = d.account.gate;
  if (gate.state !== 'active') throw new Error(`${d.name} is not signed in`);
  return gate.accountId;
}

const SETUPS: readonly ChallengeSetup[] = [
  { category: 'card-values', variant: 'check' },
  { category: 'running-count', variant: 'check' },
  { category: 'conversion', variant: 'check' },
  { category: 'table', variant: 'check', table: DEFAULT_TABLE_SETUP },
  { category: 'table', variant: 'check', table: { ...DEFAULT_TABLE_SETUP, seat: 'play', countingMode: 'deviations', betSchedule: true } },
];

const active = (service: TrainingService): ChallengeView => {
  const snapshot = service.snapshot();
  if (snapshot.status !== 'active') throw new Error(`no active attempt (${snapshot.status})`);
  return snapshot.view;
};

// Enters a mix of answers, plays and bets, never ending the attempt.
async function partway(service: TrainingService, answers: number) {
  let given = 0;
  for (let guard = 0; guard < 3000 && given < answers && service.snapshot().status === 'active'; guard++) {
    const snapshot = service.snapshot();
    if (snapshot.status !== 'active') break;
    if (snapshot.hold?.reached) {
      await service.resume();
      continue;
    }
    const { phase, table } = snapshot.view;
    if (phase === 'question') {
      await service.submit(given % 3 === 2 ? { kind: 'skip' } : { kind: 'answer', value: given % 2 === 0 ? 1 : -2 });
      given++;
    } else if (phase === 'decision') await service.submit({ kind: 'play', action: table?.decision?.kind === 'insurance' ? 'decline-insurance' : 'stand' });
    else if (phase === 'bet') await service.submit({ kind: 'bet', amount: table!.bet!.amounts.at(-1)! });
    else await service.submit({ kind: 'next-item' });
  }
  expect(given).toBe(answers);
  active(service);
}

// What an unfinished Check keeps on this device only: its identity, card sequence, answers and references.
async function hiddenData(d: SimulatedDevice) {
  const stored = await d.vault.store().findUnfinishedAttempt();
  if (!stored) throw new Error('no unfinished attempt');
  const decoded = decodeChallengeCheckpoint(stored.checkpoint);
  if (!decoded.ok) throw new Error('unreadable checkpoint');
  return { attemptId: stored.attemptId, state: decoded.state };
}

function sentSince(d: SimulatedDevice, from: number) {
  return d.proxy.sent.slice(from).map(({ url, body }) => ({ url, body: body ?? '' }));
}

// A sync call nests its request as canonical JSON text; read every level.
function parsed(value: unknown): unknown {
  if (typeof value === 'string' && /^[[{]/.test(value)) {
    try {
      return parsed(JSON.parse(value) as unknown);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(parsed);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, parsed(entry)]));
  return value;
}

function expectNothingOfTheAttempt(sent: readonly { url: string; body: string }[], events: readonly MetricEvent[], hidden: Awaited<ReturnType<typeof hiddenData>>) {
  const text = JSON.stringify([sent, events]);
  expect(text).not.toContain(hidden.attemptId);
  expect(text).not.toContain(JSON.stringify(hidden.state.answers));
  expect(text).not.toContain(JSON.stringify(hidden.state.items.slice(0, 3)));
  for (const { url, body } of sent) expect([url, revealingFields(parsed(body), 'body')]).toEqual([url, []]);
  for (const event of events) expect(Object.keys(METRICS)).toContain(event.name);
}

describe('an unfinished Check attempt', () => {
  it.each(SETUPS.map((setup) => [setup.table?.seat ? `${setup.category} (${setup.table.seat})` : setup.category, setup] as const))(
    'of %s sends nothing about itself — not its answers, cards or references — in sync payloads or metrics, and syncs once it ends',
    async (_, setup) => {
      const { d, events } = await signedIn(`privacy-${setup.category}`);
      const service = await d.training();
      const from = d.proxy.sent.length;
      await service.startAttempt(setup);
      await partway(service, 3);

      d.proxy.online = false;
      await d.account.sync.reconcile();
      d.clock.advance(30_000);
      d.proxy.online = true;
      await d.account.sync.reconcile();
      await d.restart();
      await d.account.sync.reconcile();

      const hidden = await hiddenData(d);
      expect(await d.account.sync.countWaiting()).toBe(0);
      expect(events.map((event) => event.name)).toContain('sync_run_failed');
      expectNothingOfTheAttempt(sentSince(d, from), events, hidden);
      expect(await stack.sql`select 1 from private.challenge_attempts where account_id = ${accountOf(d)}::uuid`).toHaveLength(0);

      const resumed = await d.training();
      if (resumed.snapshot().status === 'active') await resumed.end({ showResults: true });
      expect(resumed.snapshot().status).toBe('ended');
      await d.account.sync.reconcile();
      const uploads = sentSince(d, from).filter(({ url, body }) => url.includes('sync_upload_v1') && body.includes(hidden.attemptId));
      expect(uploads.length).toBeGreaterThan(0);
      // The same checks find the ended attempt's review once it may leave the device.
      expect(uploads.flatMap(({ body }) => revealingFields(parsed(body), 'body'))).not.toEqual([]);
      expect((await d.vault.store().readAcceptedRecords(challengeAttempt.name)).map((record) => record.item)).toEqual([hidden.attemptId]);
    },
  );

  it("from a teen's device sends no challenge or lesson analytics: only the permitted operational metrics, none naming the attempt", async () => {
    const { d, events } = await signedIn('privacy-teen', '13-15');
    const service = await d.training();
    const from = d.proxy.sent.length;
    await service.startAttempt({ category: 'running-count', variant: 'check' });
    await partway(service, 2);
    await service.completeLesson('app-orientation');
    d.proxy.online = false;
    await d.account.sync.reconcile();
    d.proxy.online = true;
    await d.account.sync.reconcile();

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) expect(Object.keys(TEEN_METRICS)).toContain(event.name);
    expectNothingOfTheAttempt(sentSince(d, from), events, await hiddenData(d));
  });
});

describe('lesson progress', () => {
  it('syncs only the lesson, its versions and the event, never a worked-example answer or an unfinished attempt', async () => {
    const { d } = await signedIn('privacy-lessons');
    const service = await d.training();
    await service.startAttempt({ category: 'card-values', variant: 'check' });
    await partway(service, 2);
    await service.stepForward('app-orientation', 1);
    await service.completeLesson('app-orientation');
    await d.account.sync.reconcile();

    const rows = await stack.sql<{ payload: Record<string, unknown> }[]>`
      select payload from private.lesson_progress_events where account_id = ${accountOf(d)}::uuid order by sequence`;
    expect(rows.map(({ payload }) => payload.event)).toEqual([{ kind: 'bookmark', step: 2 }, { kind: 'completed' }]);
    for (const { payload } of rows) {
      expect(Object.keys(payload).sort()).toEqual(['deviceSequence', 'event', 'eventId', 'installation', 'lesson', 'owner', 'recordVersion', 'recordedAt']);
      expect(Object.keys(payload.lesson as object).sort()).toEqual(['id', 'materialVersion', 'version']);
    }
    expect(JSON.stringify(rows)).not.toContain((await hiddenData(d)).attemptId);
  });
});

// Spec 3 Testing Decisions › Seam 2 (Lifecycle, Pause/suspend, Timer, Failure injection); Attempt lifecycle; Amendment 1 B5, C1, C3, C6; #135
import type { ChallengeView } from '@tableside/engine';

import { alwaysAllowed, type AccessDecision, type AccessSupervisor, type Disposition } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { RECORDED_MS } from '@/training/controller';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup, type TrainingSnapshot } from '@/training/service';
import { HI_LO_BY_RANK } from '@/training/testing/hi-lo';

const LEARN_CARD_VALUES = { category: 'card-values', variant: 'learn' } as const;
const CHECK_CARD_VALUES = { category: 'card-values', variant: 'check' } as const;

function setup(options: { access?: Partial<AccessSupervisor>; store?: MemoryTrainingStore; clock?: FakeClock } = {}) {
  const store = options.store ?? new MemoryTrainingStore();
  const admissions: unknown[] = [];
  const access: AccessSupervisor = {
    ...alwaysAllowed,
    beforeChallenge: async (context) => {
      admissions.push(context);
      return alwaysAllowed.beforeChallenge(context);
    },
    ...options.access,
  };
  let next = 0;
  let draws = 0;
  const entropy = { randomBytes: (length: number) => entropyFromWords([PI_WORDS[0] + draws++, PI_WORDS[1], PI_WORDS[2], PI_WORDS[3]]).randomBytes(length) };
  const clock = options.clock ?? new FakeClock(1_790_000_000_000, true);
  const service = new TrainingService({ store, access, allowance: plentyAllowance(() => clock.now()), clock, entropy, newId: () => `attempt-${++next}`, device: 'test-device', owner: 'local' });
  return { service, store, admissions, clock };
}

function active(snapshot: TrainingSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active attempt, got ${JSON.stringify(snapshot)}`);
  return snapshot;
}

const viewOf = (service: TrainingService): ChallengeView => active(service.snapshot()).view;

const reference = (view: ChallengeView) => HI_LO_BY_RANK[view.item!.card.rank]!;

async function started(setupOf: ChallengeSetup, options: Parameters<typeof setup>[0] = {}) {
  const harness = setup(options);
  await harness.service.load();
  await harness.service.startAttempt(setupOf);
  return harness;
}

async function settle(done: () => boolean) {
  for (let tries = 0; tries < 200 && !done(); tries++) await Promise.resolve();
  if (!done()) throw new Error('never settled');
}

async function finish(service: TrainingService) {
  for (let guard = 0; guard < 200 && service.snapshot().status === 'active'; guard++) {
    const view = viewOf(service);
    await service.submit(view.phase === 'question' ? { kind: 'answer', value: reference(view) } : { kind: 'next-item' });
  }
  const snapshot = service.snapshot();
  if (snapshot.status !== 'ended') throw new Error(`expected results, got ${snapshot.status}`);
  return snapshot.record;
}

describe('challenge attempt lifecycle', () => {
  describe('learner pause', () => {
    it('holds the attempt where it was, ignores answers while paused, and resumes in the same place', async () => {
      const { service } = await started(LEARN_CARD_VALUES);
      await service.submit({ kind: 'answer', value: reference(viewOf(service)) });
      await service.submit({ kind: 'next-item' });
      const before = viewOf(service);

      service.pause();
      expect(active(service.snapshot()).hold).toMatchObject({ kind: 'paused', reached: true });
      await service.submit({ kind: 'answer', value: 1 });
      expect(viewOf(service)).toEqual(before);

      await service.resume();
      expect(active(service.snapshot()).hold).toBeNull();
      expect(viewOf(service)).toEqual(before);
      await service.submit({ kind: 'answer', value: reference(before) });
      expect(viewOf(service)).toMatchObject({ phase: 'explanation', position: before.position });
    });

    it('marks the attempt interrupted; an attempt never paused is not', async () => {
      const paused = await started(LEARN_CARD_VALUES);
      paused.service.pause();
      await paused.service.resume();
      expect((await finish(paused.service)).interrupted).toBe(true);

      const steady = await started(LEARN_CARD_VALUES);
      expect((await finish(steady.service)).interrupted).toBe(false);
    });

    // #132 handoff
    it('takes effect during the recorded pause after a Check answer: the next card waits for Resume', async () => {
      const clock = new FakeClock(1_790_000_000_000, false);
      const { service } = await started(CHECK_CARD_VALUES, { clock });
      const answering = service.submit({ kind: 'answer', value: 1 });
      await settle(() => viewOf(service).phase === 'recorded' && clock.pending === 1);

      service.pause();
      clock.advance(RECORDED_MS);
      await answering;
      expect(viewOf(service)).toMatchObject({ phase: 'recorded', position: 1 });
      clock.advance(60_000);
      await settle(() => true);
      expect(viewOf(service)).toMatchObject({ phase: 'recorded', position: 1 });

      const resuming = service.resume();
      await settle(() => clock.pending === 1);
      clock.advance(RECORDED_MS);
      await resuming;
      expect(viewOf(service)).toMatchObject({ phase: 'question', position: 2 });
    });
  });

  // Spec 3 Amendment 1 B5, C1
  describe('direct suspend', () => {
    it.each([
      ['tab-bar navigation', 'navigation', (service: TrainingService) => service.suspend('navigation')],
      ['backgrounding', 'app-lifecycle', (service: TrainingService) => void service.lifecycle('backgrounded')],
      ['signing out', 'sign-out', (service: TrainingService) => void service.lifecycle('signed-out')],
    ] as const)('on %s holds the attempt with its answers, and marks it interrupted', async (_name, cause, suspend) => {
      const { service, store } = await started(CHECK_CARD_VALUES);
      await service.submit({ kind: 'answer', value: 1 });
      const before = viewOf(service);
      suspend(service);
      expect(active(service.snapshot()).hold).toMatchObject({ kind: 'suspended', cause, reached: true });
      await service.submit({ kind: 'answer', value: 0 });
      expect(viewOf(service)).toEqual(before);
      await service.resume();
      const record = await finish(service);
      expect([record.interrupted, record.review[0]?.entered, (await store.readAttemptRecords()).length]).toEqual([true, 1, 1]);
    });
  });

  // Spec 3 Attempt lifecycle › Suspend dispositions; Amendment 1 C6
  describe('access dispositions', () => {
    const RUNNING_CHECK = { category: 'running-count', variant: 'check' } as const;
    const RUNNING_LEARN = { category: 'running-count', variant: 'learn' } as const;
    const REASON = "Practice can't continue on this account.";

    function supervised() {
      let next: AccessDecision = { status: 'allowed', provenance: 'test' };
      const access: Partial<AccessSupervisor> = { onLifecycle: async () => next };
      return { access, deny: (disposition: Disposition) => (next = { status: 'denied', provenance: 'test', disposition, reason: REASON }) };
    }

    async function toPhase(service: TrainingService, phase: ChallengeView['phase']) {
      for (let guard = 0; guard < 60 && viewOf(service).phase !== phase; guard++) {
        const view = viewOf(service);
        await service.submit(view.phase === 'question' ? { kind: 'answer', value: 0 } : { kind: 'next-item' });
      }
      expect(viewOf(service).phase).toBe(phase);
    }

    async function heldAt(setupOf: ChallengeSetup, phase: ChallengeView['phase'], disposition: Disposition) {
      const { access, deny } = supervised();
      const clock = new FakeClock(1_790_000_000_000, false);
      const harness = await started(setupOf, { access, clock });
      if (phase === 'recorded') {
        void harness.service.submit({ kind: 'answer', value: 1 });
        await settle(() => viewOf(harness.service).phase === 'recorded' && clock.pending === 1);
      } else {
        await toPhase(harness.service, phase);
      }
      deny(disposition);
      await harness.service.lifecycle('access-changed');
      return { ...harness, clock };
    }

    it.each([
      ['at a checkpoint', RUNNING_CHECK, 'question'],
      ['mid-reveal', RUNNING_CHECK, 'card'],
      ['in a Learn explanation', RUNNING_LEARN, 'explanation'],
      ['while an answer is recorded', CHECK_CARD_VALUES, 'recorded'],
    ] as const)('suspend holds the attempt %s in its committed phase, with no further reveal, score, ending or charge', async (_where, setupOf, phase) => {
      const { service, store, clock } = await heldAt(setupOf, phase, 'suspend');
      const before = viewOf(service);
      expect(active(service.snapshot()).hold).toMatchObject({ kind: 'suspended', cause: 'access', reached: true, reason: REASON });
      clock.advance(60_000);
      await settle(() => true);
      for (const command of [{ kind: 'answer', value: 0 }, { kind: 'next-item' }, { kind: 'retry-item' }] as const) await service.submit(command);
      expect(viewOf(service)).toEqual(before);
      const stored = await store.loadAttempt(before.attemptId);
      expect([stored?.sequence, stored?.charge?.effect.amount, stored?.record, await store.readAttemptRecords()]).toEqual([before.sequence, '1', null, []]);
    });

    it('suspend at turn boundary lets a Check checkpoint be answered, then holds before the next card', async () => {
      const { service, clock } = await heldAt(RUNNING_CHECK, 'question', 'suspend-at-turn-boundary');
      expect(active(service.snapshot()).hold).toMatchObject({ cause: 'access', reached: false });
      const answering = service.submit({ kind: 'answer', value: 0 });
      await settle(() => viewOf(service).phase === 'recorded');
      expect(active(service.snapshot()).hold).toMatchObject({ reached: true });
      clock.advance(RECORDED_MS);
      await answering;
      expect(viewOf(service)).toMatchObject({ phase: 'recorded', position: 13 });
    });

    it('suspend at turn boundary lets a Learn item be retried, then holds instead of showing the next card', async () => {
      const { service } = await heldAt(RUNNING_LEARN, 'question', 'suspend-at-turn-boundary');
      const { position } = viewOf(service);
      await service.submit({ kind: 'answer', value: 9 });
      expect([viewOf(service).phase, active(service.snapshot()).hold?.reached]).toEqual(['explanation', false]);
      await service.submit({ kind: 'retry-item' });
      await service.submit({ kind: 'answer', value: 0 });
      await service.submit({ kind: 'next-item' });
      expect([viewOf(service).phase, viewOf(service).position, active(service.snapshot()).hold?.reached]).toEqual(['explanation', position, true]);
    });

    it('suspend at turn boundary holds at once when the current card is already finished', async () => {
      const { service } = await heldAt(RUNNING_CHECK, 'card', 'suspend-at-turn-boundary');
      expect(active(service.snapshot()).hold).toMatchObject({ reached: true });
    });

    it('stop after the charge waits for the end of the attempt: the attempt finishes and records normally', async () => {
      const { service } = await heldAt(LEARN_CARD_VALUES, 'question', 'stop');
      expect(active(service.snapshot()).hold).toBeNull();
      const record = await finish(service);
      expect([record.endingReason, record.interrupted]).toEqual(['completed', false]);
    });

    it('marks the attempt interrupted and keeps it held while resuming is denied', async () => {
      const { access, deny } = supervised();
      let resume: AccessDecision = { status: 'denied', provenance: 'test', disposition: 'suspend', reason: REASON };
      const { service } = await started(LEARN_CARD_VALUES, { access: { ...access, beforeResume: async () => resume } });
      deny('suspend');
      await service.lifecycle('access-changed');
      await service.resume();
      expect(active(service.snapshot()).hold).toMatchObject({ reached: true, resumeBlocked: REASON });
      resume = { status: 'allowed', provenance: 'test' };
      await service.resume();
      expect(active(service.snapshot()).hold).toBeNull();
      expect((await finish(service)).interrupted).toBe(true);
    });

    it('rechecks admission for an attempt that was created but never charged', async () => {
      const store = new MemoryTrainingStore();
      store.failNext('commitAttemptTransition', 'before');
      const first = await started(LEARN_CARD_VALUES, { store });
      expect(first.service.snapshot()).toMatchObject({ status: 'none', problem: 'save-failed' });

      const later = setup({ store: store.reopen() });
      await later.service.load();
      expect(later.service.snapshot()).toMatchObject({ status: 'none' });
      await later.service.startAttempt(LEARN_CARD_VALUES);
      expect([later.admissions, viewOf(later.service).position]).toEqual([[LEARN_CARD_VALUES], 1]);
    });
  });

  // Spec 3 Attempt lifecycle › Charge, One unfinished attempt; Testing Decisions › Seam 2 › Lifecycle
  describe('ending, retrying and the one unfinished attempt', () => {
    it('ending an attempt abandons it: it keeps its one charge and writes one record, with results from the answers given', async () => {
      const { service, store } = await started(CHECK_CARD_VALUES);
      await service.submit({ kind: 'answer', value: 1 });
      await service.submit({ kind: 'answer', value: 1 });
      await service.end();
      const snapshot = service.snapshot();
      if (snapshot.status !== 'ended') throw new Error(snapshot.status);
      expect(snapshot).toMatchObject({ position: 3, record: { endingReason: 'abandoned', metrics: { 'card-values': { total: 2 } } } });
      expect((await store.loadAttempt(snapshot.record.attemptId))?.charge?.effect.amount).toBe('1');
      expect(await store.readAttemptRecords()).toEqual([snapshot.record]);
    });

    it('ends a paused attempt from the pause sheet', async () => {
      const { service } = await started(LEARN_CARD_VALUES);
      service.pause();
      await service.end();
      expect(service.snapshot()).toMatchObject({ status: 'ended', record: { endingReason: 'abandoned', interrupted: true } });
    });

    it('asks the supervisor before ending a suspended attempt, and keeps it when ending is blocked', async () => {
      const blocked = 'Ending waits until access is checked.';
      const { service } = await started(LEARN_CARD_VALUES, {
        access: {
          onLifecycle: async () => ({ status: 'denied', provenance: 'test', disposition: 'suspend' }),
          beforeEndWhileSuspended: async () => ({ status: 'blocked', reason: blocked }),
        },
      });
      await service.lifecycle('access-changed');
      await service.end();
      expect(active(service.snapshot()).hold).toMatchObject({ endBlocked: blocked });
    });

    it('keeps one unfinished attempt per device: starting another changes nothing until the first is ended', async () => {
      const { service, store, admissions } = await started(CHECK_CARD_VALUES);
      service.pause();
      const held = active(service.snapshot());
      await service.startAttempt({ category: 'running-count', variant: 'learn' });
      expect([service.snapshot(), admissions.length]).toEqual([held, 1]);

      await service.end({ showResults: false });
      expect(service.snapshot()).toMatchObject({ status: 'none', problem: null });
      expect((await store.readAttemptRecords()).map((record) => record.endingReason)).toEqual(['abandoned']);
      await service.startAttempt({ category: 'running-count', variant: 'learn' });
      expect(viewOf(service)).toMatchObject({ category: 'running-count', variant: 'learn' });
    });

    it('Retry starts a new randomized attempt with its own charge', async () => {
      const { service, store, admissions } = await started(LEARN_CARD_VALUES);
      const firstCards: string[] = [];
      for (let guard = 0; guard < 100 && service.snapshot().status === 'active'; guard++) {
        const view = viewOf(service);
        if (view.phase === 'question') firstCards.push(`${view.item!.card.rank}${view.item!.card.suit}`);
        await service.submit(view.phase === 'question' ? { kind: 'answer', value: reference(view) } : { kind: 'next-item' });
      }
      await service.retry();
      const retried = viewOf(service);
      expect([retried.attemptId, retried.position, retried.variant, admissions.length]).toEqual(['attempt-2', 1, 'learn', 2]);
      expect(`${retried.item!.card.rank}${retried.item!.card.suit}`).not.toBe(firstCards[0]);
      expect((await store.loadAttempt('attempt-2'))?.charge?.effect.effectId.activity).toBe('attempt-2');
    });

    it('resuming costs nothing, and an attempt that runs past the daily reset is not charged again', async () => {
      const { service, store, admissions, clock } = await started(LEARN_CARD_VALUES);
      service.pause();
      clock.advance(26 * 60 * 60 * 1000);
      await service.resume();
      const record = await finish(service);
      expect([admissions.length, (await store.loadAttempt(record.attemptId))?.charge?.chargedAt]).toEqual([1, 1_790_000_000_000]);
    });
  });

  // Spec 3 Attempt lifecycle › Durability; Amendment 1 C1
  describe('recovery after the app ends', () => {
    it('reopens the attempt suspended in its committed phase, resumes without a charge, and marks it interrupted', async () => {
      const first = await started(LEARN_CARD_VALUES);
      await first.service.submit({ kind: 'answer', value: 1 });
      const before = viewOf(first.service);

      const later = setup({ store: first.store.reopen() });
      await later.service.load();
      expect(active(later.service.snapshot())).toMatchObject({ view: before, hold: { kind: 'suspended', cause: 'recovered', reached: true } });
      await later.service.resume();
      const record = await finish(later.service);
      expect([record.interrupted, later.admissions, (await later.store.loadAttempt(record.attemptId))?.charge?.effect.amount]).toEqual([true, [], '1']);
    });
  });

  // Spec 3 Attempt lifecycle › Performance timer; Testing Decisions › Seam 2 › Timer
  describe('performance timer', () => {
    it('times from the first card to the final answer, leaving out Learn explanations and pauses', async () => {
      const { service, clock } = await started({ ...LEARN_CARD_VALUES, timed: true });
      expect(active(service.snapshot()).timer).toEqual({ ms: 0, since: 1_790_000_000_000 });
      clock.advance(3_000);
      await service.submit({ kind: 'answer', value: reference(viewOf(service)) });
      expect(active(service.snapshot()).timer).toEqual({ ms: 3_000, since: null });
      clock.advance(5_000);
      await service.submit({ kind: 'next-item' });
      clock.advance(2_000);
      service.pause();
      clock.advance(10_000);
      await service.resume();
      clock.advance(1_000);
      await service.submit({ kind: 'answer', value: reference(viewOf(service)) });
      const record = await finish(service);
      expect(record.performanceMs).toBe(6_000);
    });

    it('counts the recorded pause after each Check answer except the last', async () => {
      const { service } = await started({ ...CHECK_CARD_VALUES, timed: true });
      expect((await finish(service)).performanceMs).toBe(19 * RECORDED_MS);
    });

    it('records no performance time when timing is off, the default', async () => {
      const { service } = await started(LEARN_CARD_VALUES);
      expect(active(service.snapshot()).timer).toBeNull();
      expect((await finish(service)).performanceMs).toBeNull();
    });

    it('keeps the time committed before the app ended', async () => {
      const first = await started({ ...LEARN_CARD_VALUES, timed: true });
      first.clock.advance(4_000);
      await first.service.submit({ kind: 'answer', value: reference(viewOf(first.service)) });

      const later = setup({ store: first.store.reopen() });
      await later.service.load();
      await later.service.resume();
      expect((await finish(later.service)).performanceMs).toBe(4_000);
    });

    it('remembers timing with the last setup, and Retry keeps it', async () => {
      const { service, admissions } = await started({ ...CHECK_CARD_VALUES, timed: true });
      expect(await service.lastSetup()).toEqual({ ...CHECK_CARD_VALUES, timed: true });
      await finish(service);
      await service.retry();
      expect([active(service.snapshot()).timer?.ms, admissions.length]).toEqual([0, 2]);
    });
  });
});

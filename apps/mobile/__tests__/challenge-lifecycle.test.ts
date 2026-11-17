// Spec 3 Testing Decisions › Seam 2; Attempt lifecycle; Amendment 1 B5, C1, C3, C6; #135
import { EMPTY_QUARANTINE_LIST, ENGINE_VERSION, type ChallengeView, type QuarantineList } from '@tableside/engine';

import { alwaysAllowed, type AccessDecision, type AccessSupervisor, type Disposition } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { RECORDED_MS } from '@/training/controller';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup, type TrainingSnapshot } from '@/training/service';
import { cardOf, HI_LO_BY_RANK } from '@/training/testing/hi-lo';
import { attemptTransition, chargeFor, newAttempt } from '@/training/testing/store-contract';
import { NO_SCREEN_READER } from '@/training/speech';

const LEARN_CARD_VALUES = { category: 'card-values', variant: 'learn' } as const;
const CHECK_CARD_VALUES = { category: 'card-values', variant: 'check' } as const;

function setup(options: { access?: Partial<AccessSupervisor>; store?: MemoryTrainingStore; clock?: FakeClock; quarantine?: QuarantineList } = {}) {
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
  const entropy = { randomBytes: (length: 16) => entropyFromWords([PI_WORDS[0] + draws++, PI_WORDS[1], PI_WORDS[2], PI_WORDS[3]]).randomBytes(length) };
  const clock = options.clock ?? new FakeClock(1_790_000_000_000, true);
  const service = new TrainingService({ store, access, allowance: plentyAllowance(() => clock.now()), clock, entropy, newId: () => `attempt-${++next}`, device: 'test-device', owner: 'local', quarantine: options.quarantine ?? EMPTY_QUARANTINE_LIST, speech: NO_SCREEN_READER });
  return { service, store, admissions, clock };
}

function active(snapshot: TrainingSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active attempt, got ${JSON.stringify(snapshot)}`);
  return snapshot;
}

const viewOf = (service: TrainingService): ChallengeView => active(service.snapshot()).view;

const reference = (view: ChallengeView) => HI_LO_BY_RANK[cardOf(view.item).rank]!;

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

    // Spec 3 Attempt lifecycle › Automatic pacing; Amendment 1 C1
    it('auto-pauses for a speech backlog, which also marks the attempt interrupted', async () => {
      const { service } = await started(LEARN_CARD_VALUES);
      service.pause('speech-backlog');
      expect(active(service.snapshot()).hold).toMatchObject({ kind: 'auto-paused', cause: 'speech-backlog' });
      await service.resume();
      expect((await finish(service)).interrupted).toBe(true);
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
      ['tab-bar navigation', 'navigation', (service: TrainingService): void => service.suspend('navigation')],
      ['backgrounding', 'app-lifecycle', (service: TrainingService): void => void service.lifecycle('backgrounded')],
      ['signing out', 'sign-out', (service: TrainingService): void => void service.lifecycle('signed-out')],
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

  // Spec 3 Attempt lifecycle › Charge, One unfinished attempt; Testing Decisions › Seam 2
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
        if (view.phase === 'question') firstCards.push(`${cardOf(view.item).rank}${cardOf(view.item).suit}`);
        await service.submit(view.phase === 'question' ? { kind: 'answer', value: reference(view) } : { kind: 'next-item' });
      }
      await service.retry();
      const retried = viewOf(service);
      expect([retried.attemptId, retried.position, retried.variant, admissions.length]).toEqual(['attempt-2', 1, 'learn', 2]);
      expect(`${cardOf(retried.item).rank}${cardOf(retried.item).suit}`).not.toBe(firstCards[0]);
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

  describe('the interrupted flag across the app ending', () => {
    async function endedBeforeItsRecord(pauseFirst: boolean) {
      const first = await started(LEARN_CARD_VALUES);
      if (pauseFirst) {
        first.service.pause();
        await first.service.resume();
      }
      first.store.failNext('recordAttempt', 'before');
      await finish(first.service).catch(() => undefined);
      const later = setup({ store: first.store.reopen() });
      await later.service.load();
      const snapshot = later.service.snapshot();
      if (snapshot.status !== 'ended') throw new Error(snapshot.status);
      return snapshot.record;
    }

    it('records an attempt whose last answer was saved before the app ended as uninterrupted, unless it was held before', async () => {
      expect((await endedBeforeItsRecord(false)).interrupted).toBe(false);
      expect((await endedBeforeItsRecord(true)).interrupted).toBe(true);
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

    it('keeps the time up to a pause when the app ends while the attempt is held', async () => {
      const first = await started({ ...LEARN_CARD_VALUES, timed: true });
      first.clock.advance(3_000);
      first.service.pause();
      await settle(() => true);

      const later = setup({ store: first.store.reopen() });
      await later.service.load();
      await later.service.resume();
      expect((await finish(later.service)).performanceMs).toBe(3_000);
    });

    it('remembers timing with the last setup, and Retry keeps it', async () => {
      const { service, admissions } = await started({ ...CHECK_CARD_VALUES, timed: true });
      expect(await service.lastSetup()).toEqual({ ...CHECK_CARD_VALUES, timed: true });
      await finish(service);
      await service.retry();
      expect([active(service.snapshot()).timer?.ms, admissions.length]).toEqual([0, 2]);
    });
  });

  // Spec 3 Attempt lifecycle › Phases (unusable); Amendment 1 C3; docs/development.md Releases
  describe('an attempt this build can no longer run', () => {
    const DEFECT: QuarantineList = { version: 2, entries: [{ id: 'defect-1', match: { engine: ENGINE_VERSION }, explanation: 'A defect affected these cards.' }] };

    it('ends a quarantined attempt as unusable: one neutral record, its charge kept, and the device free for the next attempt', async () => {
      const first = await started(CHECK_CARD_VALUES);
      await first.service.submit({ kind: 'answer', value: 1 });
      const { attemptId } = viewOf(first.service);

      const later = setup({ store: first.store.reopen(), quarantine: DEFECT });
      await later.service.load();
      expect(later.service.snapshot()).toMatchObject({
        status: 'ended',
        record: { attemptId, endingReason: 'unusable', metrics: { 'card-values': null }, review: [], interrupted: true, performanceMs: null },
      });
      expect([(await later.store.readAttemptRecords()).length, (await later.store.loadAttempt(attemptId))?.charge?.effect.amount]).toEqual([1, '1']);
      later.service.dismissResults();
      await later.service.startAttempt(LEARN_CARD_VALUES);
      expect(viewOf(later.service).attemptId).toBe('attempt-1');
    });

    it('ends a charged attempt whose checkpoint is damaged as unusable', async () => {
      const store = new MemoryTrainingStore();
      await store.createAttempt(newAttempt('broken'));
      await store.commitAttemptTransition(attemptTransition('broken', 0, { charge: chargeFor('broken') }));
      const { service } = setup({ store });
      await service.load();
      expect(service.snapshot()).toMatchObject({ status: 'ended', record: { attemptId: 'broken', endingReason: 'unusable', groupKey: { category: 'card-values', variant: 'learn' } } });
    });

    it('leaves an attempt from a later build untouched and asks for the update', async () => {
      const store = new MemoryTrainingStore();
      const later = '{"schema":999,"identities":{},"attempt":{},"receipts":[]}';
      await store.createAttempt(newAttempt('later', { checkpoint: later }));
      await store.commitAttemptTransition({ ...attemptTransition('later', 0, { charge: chargeFor('later') }), checkpoint: later });
      const { service } = setup({ store });
      await service.load();
      expect(service.snapshot()).toEqual({ status: 'needs-update' });
      await service.startAttempt(LEARN_CARD_VALUES);
      expect([service.snapshot(), (await store.findUnfinishedAttempt())?.attemptId, await store.readAttemptRecords()]).toEqual([{ status: 'needs-update' }, 'later', []]);
    });
  });

  // Spec 3 Testing Decisions › Seam 2 › Pause/suspend (trace equivalence), Failure injection
  describe('durability', () => {
    type Step = { readonly kind: 'answer'; readonly value: number } | { readonly kind: 'next-item' };
    const RUNNING_CHECK = { category: 'running-count', variant: 'check' } as const;

    async function play(service: TrainingService, between: (step: number) => Promise<TrainingService>) {
      let current = service;
      for (let step = 0; step < 120 && current.snapshot().status === 'active'; step++) {
        current = await between(step);
        const view = viewOf(current);
        const command: Step = view.phase === 'question' ? { kind: 'answer', value: step % 3 } : { kind: 'next-item' };
        await current.submit(command);
      }
      const snapshot = current.snapshot();
      if (snapshot.status !== 'ended') throw new Error(snapshot.status);
      return { service: current, record: snapshot.record };
    }

    it('resuming after a pause, a suspension or a restart gives the same trace as never stopping', async () => {
      const steady = await started(RUNNING_CHECK);
      const unbroken = await play(steady.service, async () => steady.service);

      const interrupted = await started(RUNNING_CHECK);
      let store = interrupted.store;
      const broken = await play(interrupted.service, async (step) => {
        const service = interrupted.service;
        if (step === 5) service.pause();
        if (step === 13) service.suspend('navigation');
        if (step === 30) await service.lifecycle('backgrounded');
        if (step === 40) {
          store = store.reopen();
          const later = setup({ store });
          await later.service.load();
          await later.service.resume();
          interrupted.service = later.service;
          return later.service;
        }
        await service.resume();
        return service;
      });

      const checkpoint = async (harness: { store: MemoryTrainingStore }, attemptId: string) => (await harness.store.loadAttempt(attemptId))?.checkpoint;
      expect(await checkpoint({ store }, broken.record.attemptId)).toBe(await checkpoint(steady, unbroken.record.attemptId));
      const comparable = ({ interrupted: _i, startedAt: _s, endedAt: _e, deviceSequence: _d, ...rest }: typeof broken.record) => rest;
      expect(comparable(broken.record)).toEqual(comparable(unbroken.record));
      expect([broken.record.interrupted, unbroken.record.interrupted]).toEqual([true, false]);
    });

    async function withFailure(failAt: number, operation: 'commitAttemptTransition' | 'recordAttempt' | 'createAttempt', when: 'before' | 'after', abandon: boolean) {
      const store = new MemoryTrainingStore();
      const { service } = setup({ store });
      await service.load();
      let writes = 0;
      const maybeFail = () => {
        if (writes++ === failAt) store.failNext(operation, when);
      };
      maybeFail();
      await service.startAttempt(CHECK_CARD_VALUES);
      for (let guard = 0; guard < 20 && service.snapshot().status === 'none'; guard++) await service.startAttempt(CHECK_CARD_VALUES);
      for (let step = 0; step < 200 && service.snapshot().status === 'active'; step++) {
        const snapshot = active(service.snapshot());
        if (snapshot.save === 'failed') {
          await service.retrySave();
          continue;
        }
        maybeFail();
        if (abandon && snapshot.view.position === 4) await service.end();
        else await service.submit(snapshot.view.phase === 'question' ? { kind: 'answer', value: 1 } : { kind: 'next-item' });
      }
      const attempts = await Promise.all(['attempt-1', 'attempt-2', 'attempt-3'].map((id) => store.loadAttempt(id)));
      return { snapshot: service.snapshot(), charges: attempts.filter((attempt) => attempt?.charge).length, records: await store.readAttemptRecords() };
    }

    it.each([
      ['commitAttemptTransition', 'before'],
      ['commitAttemptTransition', 'after'],
      ['recordAttempt', 'before'],
      ['recordAttempt', 'after'],
      ['createAttempt', 'before'],
      ['createAttempt', 'after'],
    ] as const)('a %s failure %s writing, at any point of a completed or abandoned attempt, leaves one charge and one record', async (operation, when) => {
      for (const abandon of [false, true]) {
        for (let failAt = 0; failAt < (abandon ? 6 : 22); failAt++) {
          const outcome = await withFailure(failAt, operation, when, abandon);
          expect([failAt, abandon, outcome.snapshot.status, outcome.charges, outcome.records.length, outcome.records[0]?.endingReason]).toEqual([
            failAt,
            abandon,
            'ended',
            1,
            1,
            abandon ? 'abandoned' : 'completed',
          ]);
        }
      }
    });
  });
});

// Spec 3 Testing Decisions › Seam 2 (Training service facade); Amendment 1 C6; #158
import type { ChallengeView } from '@tableside/engine';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type TrainingSnapshot } from '@/training/service';
import { CHALLENGE_CHARGE } from '@/training/store';

const LEARN_CARD_VALUES = { category: 'card-values', variant: 'learn' } as const;

// Hi-Lo by hand: 2–6 are +1, 7–9 are 0, 10, J, Q, K and A are −1.
const HI_LO: Record<number, -1 | 0 | 1> = { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: -1, 12: -1, 13: -1 };

function setup(options: { access?: Partial<AccessSupervisor>; store?: MemoryTrainingStore } = {}) {
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
  const clock = new FakeClock(1_790_000_000_000, true);
  const service = new TrainingService({ store, access, clock, entropy: entropyFromWords(PI_WORDS), newId: () => `attempt-${++next}`, device: 'test-device', owner: 'local' });
  return { service, store, admissions, clock };
}

function active(snapshot: TrainingSnapshot): ChallengeView {
  if (snapshot.status !== 'active') throw new Error(`expected an active attempt, got ${JSON.stringify(snapshot)}`);
  return snapshot.view;
}

async function answerEveryCard(service: TrainingService, choose: (view: ChallengeView) => -1 | 0 | 1) {
  for (let guard = 0; guard < 100 && service.snapshot().status === 'active'; guard++) {
    const view = active(service.snapshot());
    await service.submit(view.phase === 'question' ? { kind: 'answer', value: choose(view) } : { kind: 'next-item' });
  }
}

const reference = (view: ChallengeView) => HI_LO[view.item!.card.rank]!;

describe('the Training service', () => {
  it('lists the four challenge categories in the suggested order, all available, with no exercise content', () => {
    const { service } = setup();
    expect(service.listCatalog()).toEqual([
      { category: 'card-values', available: true, ready: ['learn'] },
      { category: 'running-count', available: true, ready: [] },
      { category: 'conversion', available: true, ready: [] },
      { category: 'table', available: true, ready: [] },
    ]);
  });

  it('validates a setup with structured diagnostics, creating and charging nothing', async () => {
    const { service, store } = setup();
    expect(service.validateSetup(LEARN_CARD_VALUES)).toEqual({ valid: true, diagnostics: [] });
    expect(service.validateSetup({ category: 'card-values', variant: 'check' })).toEqual({ valid: false, diagnostics: [{ field: 'variant', problem: 'not-ready' }] });
    expect(service.validateSetup({ category: 'running-count', variant: 'learn' })).toEqual({ valid: false, diagnostics: [{ field: 'category', problem: 'not-ready' }] });
    expect(service.validateSetup({ category: 'baccarat', variant: 'quiz' })).toEqual({
      valid: false,
      diagnostics: [
        { field: 'category', problem: 'unknown' },
        { field: 'variant', problem: 'unknown' },
      ],
    });
    expect(await store.findUnfinishedAttempt()).toBeNull();
  });

  it('starts an attempt: admission is asked once, and the charge commits with the first card, exactly once', async () => {
    const { service, store, admissions } = setup();
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);

    const view = active(service.snapshot());
    expect([view.phase, view.position, view.length, view.feedback]).toEqual(['question', 1, 20, null]);
    expect(admissions).toEqual([LEARN_CARD_VALUES]);
    const stored = await store.loadAttempt(view.attemptId);
    expect(stored?.charge).toEqual({ effectId: { grant: 'spec-1-stub', activity: view.attemptId, sequence: 0 }, kind: CHALLENGE_CHARGE, amount: '1' });
    expect(stored?.sequence).toBe(1);
    expect(await store.readAttemptReceipt(view.attemptId, `${view.attemptId}/0`)).toMatchObject({ receipt: { command: '{"kind":"begin"}' } });
  });

  it('shows no content and charges nothing for an invalid setup', async () => {
    const { service, store, admissions } = setup();
    await service.load();
    await service.startAttempt({ category: 'card-values', variant: 'check' });
    expect(service.snapshot()).toEqual({ status: 'none', problem: 'invalid-setup', diagnostics: [{ field: 'variant', problem: 'not-ready' }], busy: false });
    expect([admissions, await store.findUnfinishedAttempt(), await store.readAttemptRecords()]).toEqual([[], null, []]);
  });

  it('shows no content and charges nothing when admission is denied', async () => {
    const { service, store } = setup({ access: { beforeChallenge: async () => ({ status: 'denied', provenance: 'test', disposition: 'stop', reason: 'No attempts left.' }) } });
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    expect(service.snapshot()).toEqual({ status: 'none', problem: 'access-denied', diagnostics: [], busy: false });
    expect(await store.findUnfinishedAttempt()).toBeNull();
  });

  it('reports the charge once when the first-content commit is acknowledged late', async () => {
    const store = new MemoryTrainingStore();
    store.failNext('commitAttemptTransition', 'after');
    const { service } = setup({ store });
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    const view = active(service.snapshot());
    expect(view.position).toBe(1);
    expect((await store.loadAttempt(view.attemptId))?.charge?.kind).toBe(CHALLENGE_CHARGE);
  });

  it('shows no content when the first-content commit fails, and starting again rechecks admission and charges once', async () => {
    const store = new MemoryTrainingStore();
    store.failNext('commitAttemptTransition', 'before');
    const { service, admissions } = setup({ store });
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    expect(service.snapshot()).toMatchObject({ status: 'none', problem: 'save-failed' });
    const uncharged = await store.findUnfinishedAttempt();
    expect([uncharged?.sequence, uncharged?.charge]).toEqual([0, null]);

    await service.startAttempt(LEARN_CARD_VALUES);
    const view = active(service.snapshot());
    expect(view.attemptId).toBe(uncharged?.attemptId);
    expect(admissions).toHaveLength(2);
    expect((await store.loadAttempt(view.attemptId))?.charge).not.toBeNull();
  });

  it('runs a Learn attempt to results: only first answers are scored, and completion writes one attempt record', async () => {
    const { service, store } = setup();
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    const { attemptId } = active(service.snapshot());
    expect(await service.results(attemptId)).toBeNull();

    let expected = 0;
    for (let guard = 0; guard < 100 && service.snapshot().status === 'active'; guard++) {
      const view = active(service.snapshot());
      if (view.phase === 'question' && view.feedback === null) {
        if (reference(view) === 1) expected++;
        await service.submit({ kind: 'answer', value: 1 });
      } else if (view.phase === 'explanation' && view.legalCommands.includes('retry-item')) {
        expect(view.feedback).toMatchObject({ correct: false, scored: true, reference: reference(view) });
        await service.submit({ kind: 'retry-item' });
        await service.submit({ kind: 'answer', value: reference(view) });
      } else {
        await service.submit({ kind: 'next-item' });
      }
    }

    const snapshot = service.snapshot();
    if (snapshot.status !== 'ended') throw new Error('not ended');
    expect(snapshot.record).toMatchObject({
      attemptId,
      installation: 'test-device',
      deviceSequence: 1,
      endingReason: 'completed',
      metrics: { 'card-values': { correct: expected, total: 20 }, 'running-count': null, 'true-count': null },
      groupKey: { category: 'card-values', variant: 'learn', assistanceClass: 'learn' },
      meteringBasis: 'challenge-attempt',
      interrupted: false,
      performanceMs: null,
    });
    expect(await store.readAttemptRecords()).toEqual([snapshot.record]);
    expect(await service.results(attemptId)).toEqual(snapshot.record);
    expect(await store.findUnfinishedAttempt()).toBeNull();
  });

  it('writes one attempt record when its acknowledgement is lost', async () => {
    const store = new MemoryTrainingStore();
    const { service } = setup({ store });
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    store.failNext('recordAttempt', 'after');
    await answerEveryCard(service, reference);
    expect(service.snapshot()).toMatchObject({ status: 'ended', record: { metrics: { 'card-values': { correct: 20, total: 20 } } } });
    expect(await store.readAttemptRecords()).toHaveLength(1);
  });

  it('remembers the last setup as a device-local preference in the account database', async () => {
    const store = new MemoryTrainingStore();
    const first = setup({ store });
    expect(await first.service.lastSetup()).toBeNull();
    await first.service.load();
    await first.service.startAttempt(LEARN_CARD_VALUES);
    const later = setup({ store: store.reopen() });
    expect(await later.service.lastSetup()).toEqual(LEARN_CARD_VALUES);
  });

  it('picks up an unfinished charged attempt where it was after a restart, without charging again', async () => {
    const store = new MemoryTrainingStore();
    const first = setup({ store });
    await first.service.load();
    await first.service.startAttempt(LEARN_CARD_VALUES);
    await first.service.submit({ kind: 'answer', value: 1 });
    const before = active(first.service.snapshot());

    const later = setup({ store: store.reopen() });
    await later.service.load();
    expect(active(later.service.snapshot())).toEqual(before);
    expect(later.admissions).toEqual([]);
  });
});

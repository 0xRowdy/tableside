// Spec 3 Testing Decisions › Seam 2, Amendment 1 C6; #158, #132
import { createChallenge, encodeChallengeCheckpoint, type ChallengeView } from '@tableside/engine';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { resetTimeText } from '@/training/challenge-text';
import { MemoryTrainingStore } from '@/training/memory-store';
import { RECORDED_MS } from '@/training/controller';
import { TrainingService, type TrainingSnapshot } from '@/training/service';
import { CHALLENGE_CHARGE } from '@/training/store';
import { newAttempt } from '@/training/testing/store-contract';
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
  const clock = options.clock ?? new FakeClock(1_790_000_000_000, true);
  const service = new TrainingService({ store, access, allowance: plentyAllowance(() => clock.now()), clock, entropy: entropyFromWords(PI_WORDS), newId: () => `attempt-${++next}`, device: 'test-device', owner: 'local' });
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

const reference = (view: ChallengeView) => HI_LO_BY_RANK[view.item!.card.rank]!;

const feedbackOf = (view: ChallengeView) => (view.variant === 'learn' ? view.feedback : undefined);

describe('the Training service', () => {
  it('lists the four challenge categories in the suggested order, all available, with no exercise content', () => {
    const { service } = setup();
    expect(service.listCatalog()).toEqual([
      { category: 'card-values', available: true, ready: ['learn', 'check'] },
      { category: 'running-count', available: true, ready: ['learn', 'check'] },
      { category: 'conversion', available: true, ready: [] },
      { category: 'table', available: true, ready: [] },
    ]);
  });

  it('validates a setup with structured diagnostics, creating and charging nothing', async () => {
    const { service, store } = setup();
    expect(service.validateSetup(LEARN_CARD_VALUES)).toEqual({ valid: true, diagnostics: [] });
    expect(service.validateSetup(CHECK_CARD_VALUES)).toEqual({ valid: true, diagnostics: [] });
    expect(service.validateSetup({ category: 'running-count', variant: 'check' })).toEqual({ valid: true, diagnostics: [] });
    expect(service.validateSetup({ category: 'conversion', variant: 'learn' })).toEqual({ valid: false, diagnostics: [{ field: 'category', problem: 'not-ready' }] });
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
    expect([view.phase, view.position, view.length, feedbackOf(view)]).toEqual(['question', 1, 20, null]);
    expect(admissions).toEqual([LEARN_CARD_VALUES]);
    const stored = await store.loadAttempt(view.attemptId);
    expect(stored?.charge).toEqual({ effect: { effectId: { grant: 'spec-1-stub', activity: view.attemptId, sequence: 0 }, kind: CHALLENGE_CHARGE, amount: '1' }, chargedAt: 1_790_000_000_000 });
    expect(stored?.sequence).toBe(1);
    expect(await store.readAttemptReceipt(view.attemptId, `${view.attemptId}/0`)).toMatchObject({ receipt: { command: '{"kind":"begin"}' } });
  });

  it('shows no content and charges nothing for an invalid setup', async () => {
    const { service, store, admissions } = setup();
    await service.load();
    await service.startAttempt({ category: 'conversion', variant: 'check' });
    expect(service.snapshot()).toEqual({ status: 'none', problem: 'invalid-setup', diagnostics: [{ field: 'category', problem: 'not-ready' }], busy: false });
    expect([admissions, await store.findUnfinishedAttempt(), await store.readAttemptRecords()]).toEqual([[], null, []]);
  });

  // Spec 3 Learn, Check and assistance › Show/hide running count; Attempt lifecycle › Charge; #133
  it('revealing the running count in Check is a free, durable step that marks the attempt assisted, with no cue facts', async () => {
    const { service, store } = setup();
    await service.load();
    await service.startAttempt({ category: 'running-count', variant: 'check' });
    const shown = active(service.snapshot());
    expect([shown.phase, shown.countAid]).toEqual(['card', { revealed: false, count: null }]);
    await service.submit({ kind: 'reveal-count' });
    const snapshot = service.snapshot();
    if (snapshot.status !== 'active') throw new Error(snapshot.status);
    expect([snapshot.view.assisted, snapshot.view.countAid?.revealed, snapshot.facts]).toEqual([true, true, []]);
    const stored = await store.loadAttempt(shown.attemptId);
    expect([stored?.sequence, stored?.charge?.effect.amount]).toEqual([2, '1']);
    expect(await store.readAttemptReceipt(shown.attemptId, `${shown.attemptId}/1`)).toMatchObject({ receipt: { command: '{"kind":"reveal-count"}' } });
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
    expect((await store.loadAttempt(view.attemptId))?.charge?.effect.kind).toBe(CHALLENGE_CHARGE);
  });

  it('shows no content when the first-content commit fails; starting again asks admission again, replaces the uncharged attempt and charges once', async () => {
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
    expect(admissions).toHaveLength(2);
    expect((await store.loadAttempt(view.attemptId))?.charge).not.toBeNull();
    expect(await store.loadAttempt(uncharged!.attemptId)).toBeNull();
  });

  it('replaces a leftover uncharged attempt for another setup with the setup the learner chose', async () => {
    const store = new MemoryTrainingStore();
    const leftover = newAttempt('leftover', {
      specification: { ...newAttempt('leftover').specification, content: { category: 'card-values', id: 'card-values', version: 1, length: 13, coverage: 'every-rank' } },
    });
    await store.createAttempt({ ...leftover, checkpoint: encodeChallengeCheckpoint(createChallenge(leftover.specification, leftover.random)) });
    const { service } = setup({ store });
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    const view = active(service.snapshot());
    expect(view.length).toBe(20);
    expect(await store.loadAttempt('leftover')).toBeNull();
  });

  it('records the attempt as started when it was charged, not when it was created', async () => {
    const store = new MemoryTrainingStore();
    store.failNext('commitAttemptTransition', 'before');
    const { service, clock } = setup({ store });
    await service.load();
    await service.startAttempt(LEARN_CARD_VALUES);
    clock.advance(60_000);
    await service.startAttempt(LEARN_CARD_VALUES);
    await answerEveryCard(service, reference);
    expect(service.snapshot()).toMatchObject({ status: 'ended', record: { startedAt: 1_790_000_060_000 } });
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
      if (view.phase === 'question' && feedbackOf(view) === null) {
        if (reference(view) === 1) expected++;
        await service.submit({ kind: 'answer', value: 1 });
      } else if (view.phase === 'explanation' && view.legalCommands.includes('retry-item')) {
        expect(feedbackOf(view)).toMatchObject({ correct: false, scored: true, reference: reference(view) });
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

  // #150
  it('reports a plentiful free allowance by default that charges never use up, resetting at the next midnight', async () => {
    const { service, clock } = setup();
    await service.startAttempt(LEARN_CARD_VALUES);
    await answerEveryCard(service, reference);
    const allowance = await service.allowance();
    if (allowance.kind !== 'free') throw new Error(`expected a free allowance, got ${allowance.kind}`);
    expect(allowance.left).toBe(allowance.amount);
    expect(allowance.left).toBeGreaterThan(0);
    expect(allowance.allowanceDevice).toEqual({ here: true });
    expect(allowance.resetsAt).toBeGreaterThan(clock.now());
    expect(allowance.resetsAt - clock.now()).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
    expect(resetTimeText(allowance.resetsAt, allowance.timeZone)).toMatch(/^12:00 AM /);
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

  it('runs a Check attempt: each entry is recorded with no correctness, the next card follows after the same pause for right and wrong, and results review every card', async () => {
    const { service, clock } = setup();
    await service.load();
    await service.startAttempt(CHECK_CARD_VALUES);
    const timeline: { at: number; snapshot: TrainingSnapshot }[] = [];
    service.subscribe(() => timeline.push({ at: clock.now(), snapshot: service.snapshot() }));

    const review: { position: number; entered: unknown; reference: number }[] = [];
    const pauses = new Set<string>();
    for (let card = 1; card <= 20; card++) {
      const view = active(service.snapshot());
      expect([view.phase, view.position, view.legalCommands]).toEqual(['question', card, ['answer', 'skip', 'end']]);
      const right = reference(view);
      const entered = card === 4 ? 'skip' : card % 2 === 1 ? right : right === 1 ? -1 : 1;
      review.push({ position: card, entered, reference: right });
      timeline.length = 0;
      const submittedAt = clock.now();
      await service.submit(entered === 'skip' ? { kind: 'skip' } : { kind: 'answer', value: entered });

      const isRecorded = (entry: (typeof timeline)[number]) => entry.snapshot.status === 'active' && entry.snapshot.view.phase === 'recorded';
      const recorded = timeline.find(isRecorded)!;
      const after = timeline.slice(timeline.indexOf(recorded)).find((entry) => !isRecorded(entry))!;
      const recordedView = active(recorded.snapshot);
      expect(recordedView).toMatchObject({ variant: 'check', position: card, entered, legalCommands: ['next-item', 'end'], results: null, assisted: false });
      expect(recordedView).not.toHaveProperty('feedback');
      pauses.add(`${recorded.at - submittedAt}/${after.at - recorded.at}`);
    }
    expect([...pauses]).toEqual([`0/${RECORDED_MS}`]);

    const snapshot = service.snapshot();
    if (snapshot.status !== 'ended') throw new Error('not ended');
    const correct = review.filter((item) => item.entered === item.reference).length;
    expect(snapshot.record).toMatchObject({
      endingReason: 'completed',
      groupKey: { category: 'card-values', variant: 'check', assistanceClass: 'unassisted-check', countRevealed: false },
      metrics: { 'card-values': { correct, total: 20 } },
      assistanceStep: null,
    });
    expect(snapshot.record.review.map(({ position, entered, reference: value }) => ({ position, entered, reference: value }))).toEqual(review);
  });

  it('leaves the catalog and the attempt records as they were until a Check attempt ends', async () => {
    const { service, store } = setup();
    await service.load();
    const before = service.listCatalog();
    await service.startAttempt(CHECK_CARD_VALUES);
    for (let card = 1; card < 20; card++) {
      await service.submit({ kind: 'answer', value: 1 });
      expect([service.listCatalog(), await store.readAttemptRecords()]).toEqual([before, []]);
    }
    await service.submit({ kind: 'answer', value: 1 });
    expect(await store.readAttemptRecords()).toHaveLength(1);
  });

  it('moves on to the next card when it picks up a Check attempt whose answer was recorded', async () => {
    const store = new MemoryTrainingStore();
    const first = setup({ store, clock: new FakeClock(1_790_000_000_000, false) });
    await first.service.load();
    await first.service.startAttempt(CHECK_CARD_VALUES);
    void first.service.submit({ kind: 'answer', value: 0 });
    for (let tries = 0; tries < 50 && (await store.findUnfinishedAttempt())?.sequence !== 2; tries++) await Promise.resolve();
    expect((await store.findUnfinishedAttempt())?.sequence).toBe(2);

    const later = setup({ store: store.reopen() });
    await later.service.load();
    expect(active(later.service.snapshot())).toMatchObject({ phase: 'question', position: 2 });
    expect(later.admissions).toEqual([]);
  });
});

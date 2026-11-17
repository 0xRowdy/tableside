// Spec 3 Testing Decisions › Seam 2 (lessons); Lessons › Progress, Handoff; Amendment 1 C10; #143, #145
import { EMPTY_QUARANTINE_LIST } from '@tableside/engine';
import { APP_ORIENTATION, LESSONS, type Lesson, type LessonHandoff } from '@tableside/definitions';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService } from '@/training/service';
import { FIVE_OF_HEARTS, withWorkedExample } from '@/training/testing/worked-example';

const ORIENTATION = 'app-orientation';

// Spec 3 Lessons › Access: lessons are unmetered
const refusingAccess = (asked: string[]): AccessSupervisor =>
  Object.fromEntries(
    Object.keys(alwaysAllowed).map((name) => [
      name,
      async () => {
        asked.push(name);
        throw new Error(`lessons never ask ${name}`);
      },
    ]),
  ) as unknown as AccessSupervisor;

function revised(content: Partial<NonNullable<Lesson['content']>>): readonly Lesson[] {
  return LESSONS.map((lesson) => (lesson.id === ORIENTATION ? { ...lesson, content: { ...lesson.content!, ...content } } : lesson));
}

let services = 0;

function setup(options: { store?: MemoryTrainingStore; lessons?: readonly Lesson[] } = {}) {
  const store = options.store ?? new MemoryTrainingStore();
  const asked: string[] = [];
  const prefix = services++ === 0 ? 'event' : `service-${services}`;
  let next = 0;
  const service = new TrainingService(
    {
      store,
      access: refusingAccess(asked),
      allowance: {
        challengeAllowance: async () => {
          asked.push('challengeAllowance');
          throw new Error('lessons never read the challenge allowance');
        },
      },
      clock: new FakeClock(1_790_000_000_000, true),
      entropy: entropyFromWords(PI_WORDS),
      newId: () => `${prefix}-${++next}`,
      device: 'test-device',
      owner: 'local',
      quarantine: EMPTY_QUARANTINE_LIST,
    },
    options.lessons ? { lessons: options.lessons } : {},
  );
  return { service, store, asked };
}

const statusOf = async (service: TrainingService, id = ORIENTATION) => (await service.listLessons()).find((entry) => entry.id === id)!.status;

beforeEach(() => {
  services = 0;
});

describe('the Training service lessons', () => {
  it('lists all 24 lesson slots with completion, bookmark and access state; only written lessons can be opened', async () => {
    const { service } = setup();
    const catalog = await service.listLessons();
    expect(catalog).toHaveLength(24);
    expect(catalog[0]).toEqual({
      id: ORIENTATION,
      title: 'App orientation',
      summary: 'Tabs, help, practice vs casino records',
      section: 'app',
      steps: 5,
      access: 'available',
      status: { kind: 'not-started' },
    });
    expect(catalog.filter((entry) => entry.steps !== null).map((entry) => entry.id)).toEqual([
      ORIENTATION,
      'craps-basics',
      'pass-with-odds',
      'flat-place-6-8',
      'dont-pass-with-lay-odds',
      'three-point-molly',
      'press-and-collect-6-8',
      'roulette-basics',
      'flat-even-money',
      'fixed-two-dozen-coverage',
      'capped-martingale',
      'three-win-parlay',
      'bounded-labouchere',
      'building-a-strategy',
    ]);
    expect(catalog[1]).toMatchObject({ id: 'blackjack-basics', section: 'blackjack', steps: null, status: { kind: 'not-started' } });
    await expect(service.openLesson('blackjack-basics')).rejects.toThrow(/not available/);
  });

  it('opens a new lesson at step 1 and records nothing until the learner steps forward', async () => {
    const { service, store } = setup();
    const view = await service.openLesson(ORIENTATION);
    expect(view).toMatchObject({ id: ORIENTATION, title: 'App orientation', section: 'app', step: 1, prompt: null, notice: null });
    expect(view.steps.map((step) => step.heading)).toEqual(APP_ORIENTATION.content!.steps.map((step) => step.heading));
    expect(await store.readLessonEvents()).toEqual([]);
  });

  // Spec 3 Lessons › Structure (worked examples); #144
  it("serves the lesson's worked-example script, asking nothing of access or the allowance; leaving the example moves on past its step", async () => {
    const { service, store, asked } = setup({ lessons: withWorkedExample(LESSONS) });
    expect((await service.openLesson(ORIENTATION)).example).toEqual(FIVE_OF_HEARTS);
    expect((await setup().service.openLesson(ORIENTATION)).example).toBeNull();
    expect(await service.stepForward(ORIENTATION, FIVE_OF_HEARTS.step)).toMatchObject({ step: 3, example: FIVE_OF_HEARTS });
    expect((await store.readLessonEvents()).map((event) => event.event)).toEqual([{ kind: 'bookmark', step: 3 }]);
    expect(await store.readAttemptRecords()).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('steps forward and back, writing an immutable bookmark event with the installation sequence each time', async () => {
    const { service, store } = setup();
    await service.openLesson(ORIENTATION);
    expect((await service.stepForward(ORIENTATION, 1)).step).toBe(2);
    expect((await service.stepForward(ORIENTATION, 2)).step).toBe(3);
    expect((await service.stepBack(ORIENTATION, 3)).step).toBe(2);
    expect(await store.readLessonEvents()).toEqual(
      [2, 3, 2].map((step, index) => ({
        recordVersion: 1,
        eventId: `event-${index + 1}`,
        owner: 'local',
        installation: 'test-device',
        lesson: { id: ORIENTATION, version: 1, materialVersion: 1 },
        event: { kind: 'bookmark', step },
        recordedAt: 1_790_000_000_000,
        deviceSequence: index + 1,
      })),
    );
    expect(await statusOf(service)).toEqual({ kind: 'in-progress', step: 2 });
  });

  it('resumes where the learner left off, offering Resume or Restart, after the app restarts', async () => {
    const first = setup();
    await first.service.stepForward(ORIENTATION, 1);
    await first.service.stepForward(ORIENTATION, 2);
    const { service } = setup({ store: first.store.reopen() });
    expect(await service.openLesson(ORIENTATION)).toMatchObject({ step: 3, prompt: { kind: 'resume-or-restart', step: 3 }, notice: null });
  });

  it('restarts nothing when there is no place to reset: an unstarted or just-finished lesson stays as it was', async () => {
    const { service, store } = setup();
    expect(await service.restartLesson(ORIENTATION)).toMatchObject({ step: 1, prompt: null, notice: null });
    expect(await statusOf(service)).toEqual({ kind: 'not-started' });
    await service.completeLesson(ORIENTATION);
    await service.restartLesson(ORIENTATION);
    expect((await store.readLessonEvents()).map((event) => event.event.kind)).toEqual(['completed']);
  });

  it('restarts at step 1, writing a restarted event, and keeps completion', async () => {
    const { service, store } = setup();
    await service.stepForward(ORIENTATION, 1);
    expect(await service.restartLesson(ORIENTATION)).toMatchObject({ step: 1, prompt: null, notice: null });
    expect((await service.openLesson(ORIENTATION)).prompt).toBeNull();
    expect(await statusOf(service)).toEqual({ kind: 'in-progress', step: 1 });

    await service.completeLesson(ORIENTATION);
    await service.stepForward(ORIENTATION, 1);
    await service.restartLesson(ORIENTATION);
    expect(await statusOf(service)).toEqual({ kind: 'completed' });
    expect((await store.readLessonEvents()).map((event) => event.event.kind)).toEqual(['bookmark', 'restarted', 'completed', 'bookmark', 'restarted']);
  });

  it('completes: the lesson is only marked finished (no score, award or unlock) and reopens at step 1', async () => {
    const { service, store } = setup();
    await service.stepForward(ORIENTATION, 1);
    await service.stepForward(ORIENTATION, 2);
    await service.stepForward(ORIENTATION, 3);
    await service.completeLesson(ORIENTATION);
    expect((await store.readLessonEvents()).at(-1)).toMatchObject({ event: { kind: 'completed' }, lesson: { id: ORIENTATION, version: 1, materialVersion: 1 } });
    expect((await service.listLessons())[0]).toEqual({
      id: ORIENTATION,
      title: 'App orientation',
      summary: 'Tabs, help, practice vs casino records',
      section: 'app',
      steps: 5,
      access: 'available',
      status: { kind: 'completed' },
    });
    expect(await statusOf(service, 'blackjack-basics')).toEqual({ kind: 'not-started' });
    expect(await service.openLesson(ORIENTATION)).toMatchObject({ step: 1, prompt: null, notice: null });
  });

  it('keeps the bookmark and completion through a non-material change', async () => {
    const first = setup();
    await first.service.completeLesson(ORIENTATION);
    await first.service.stepForward(ORIENTATION, 1);
    await first.service.stepForward(ORIENTATION, 2);
    const { service } = setup({ store: first.store.reopen(), lessons: revised({ version: 2 }) });
    expect(await statusOf(service)).toEqual({ kind: 'completed' });
    expect(await service.openLesson(ORIENTATION)).toMatchObject({ step: 3, prompt: { kind: 'resume-or-restart', step: 3 }, notice: null });
    await service.stepForward(ORIENTATION, 3);
    expect((await first.store.readLessonEvents()).at(-1)?.lesson).toEqual({ id: ORIENTATION, version: 2, materialVersion: 1 });
  });

  it('after a material change shows "Completed (earlier version)" with the reason, restarts the bookmark at step 1 and keeps the earlier completion in history', async () => {
    const first = setup();
    await first.service.completeLesson(ORIENTATION);
    await first.service.stepForward(ORIENTATION, 1);
    await first.service.stepForward(ORIENTATION, 2);
    const changed = revised({ version: 2, materialVersion: 2, change: 'the Saved tab was described' });
    const { service, store } = setup({ store: first.store.reopen(), lessons: changed });

    expect(await statusOf(service)).toEqual({ kind: 'completed-earlier-version' });
    expect(await service.openLesson(ORIENTATION)).toMatchObject({
      step: 1,
      prompt: null,
      notice: { kind: 'after-completion', change: 'the Saved tab was described' },
    });

    expect(await service.restartLesson(ORIENTATION)).toMatchObject({ step: 1, notice: null });
    expect(await statusOf(service)).toEqual({ kind: 'in-progress', step: 1 });
    await service.completeLesson(ORIENTATION);
    expect(await statusOf(service)).toEqual({ kind: 'completed' });
    expect((await store.readLessonEvents()).filter((event) => event.event.kind === 'completed').map((event) => event.lesson.materialVersion)).toEqual([1, 2]);
  });

  it('after a material change explains why an unfinished lesson starts again at step 1', async () => {
    const first = setup();
    await first.service.stepForward(ORIENTATION, 1);
    const { service } = setup({ store: first.store.reopen(), lessons: revised({ version: 3, materialVersion: 3, change: 'help moved' }) });
    expect(await statusOf(service)).toEqual({ kind: 'not-started' });
    expect(await service.openLesson(ORIENTATION)).toMatchObject({ step: 1, prompt: null, notice: { kind: 'since-last-visit', change: 'help moved' } });
  });

  it('is unmetered: listing, opening, stepping, restarting and completing never ask the access supervisor or the allowance, or start an attempt', async () => {
    const { service, store, asked } = setup();
    await service.listLessons();
    await service.openLesson(ORIENTATION);
    await service.stepForward(ORIENTATION, 1);
    await service.restartLesson(ORIENTATION);
    await service.completeLesson(ORIENTATION);
    expect(asked).toEqual([]);
    expect([await store.findUnfinishedAttempt(), await store.readAttemptRecords()]).toEqual([null, []]);
  });

  // Spec 3 Lessons › Structure (Handoff); Testing Decisions › Seam 2 (handoffs prefill setup without starting or charging); #145
  it('offers the handoff targets with the lesson, and finishing it or preparing a handed-off Learn setup starts and charges nothing', async () => {
    const handoffs: LessonHandoff[] = [
      { kind: 'learn-challenge', category: 'card-values' },
      { kind: 'guided-practice', game: 'blackjack', strategy: 'counting-with-basic' },
      { kind: 'free-play', game: 'blackjack' },
    ];
    const lessons = revised({ handoffs });
    const { service, store, asked } = setup({ lessons });
    const view = await service.openLesson(ORIENTATION);
    expect(view.handoffs).toEqual(handoffs);
    await service.completeLesson(ORIENTATION);
    expect(service.validateSetup({ category: 'card-values', variant: 'learn' })).toEqual({ valid: true, diagnostics: [] });
    expect(asked).toEqual([]);
    expect([await store.findUnfinishedAttempt(), await store.readAttemptRecords()]).toEqual([null, []]);
    expect(service.snapshot()).toMatchObject({ status: 'loading' });
  });

  it('keeps the place it had when a progress write fails', async () => {
    const { service, store } = setup();
    await service.stepForward(ORIENTATION, 1);
    store.failNext('recordLessonEvent', 'before');
    await expect(service.stepForward(ORIENTATION, 2)).rejects.toThrow();
    expect(await statusOf(service)).toEqual({ kind: 'in-progress', step: 2 });
  });
});

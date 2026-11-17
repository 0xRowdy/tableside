// Spec 3 Lessons › Entry points, Structure (First-use hints), Amendment 1 C7; Testing Decisions › Seam 2; #146
import { HINT_IDS, HINTS, type Hint, type HintId } from '@tableside/definitions';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { MemoryTrainingStore } from '@/training/memory-store';
import { HINTS_SEEN, START_HERE_DISMISSED } from '@/training/learning-preferences';
import { TrainingService } from '@/training/service';

const refusingAccess = Object.fromEntries(
  Object.keys(alwaysAllowed).map((name) => [
    name,
    async () => {
      throw new Error(`learning preferences never ask ${name}`);
    },
  ]),
) as unknown as AccessSupervisor;

function setup(options: { store?: MemoryTrainingStore; hints?: Readonly<Record<HintId, Hint>> } = {}) {
  const store = options.store ?? new MemoryTrainingStore();
  const service = new TrainingService(
    {
      store,
      access: refusingAccess,
      allowance: {
        challengeAllowance: async () => {
          throw new Error('learning preferences never read the challenge allowance');
        },
      },
      clock: new FakeClock(1_790_000_000_000, true),
      entropy: entropyFromWords(PI_WORDS),
      newId: () => 'unused',
      device: 'test-device',
      owner: 'local',
      quarantine: { version: 0, entries: [] },
    },
    options.hints ? { hints: options.hints } : {},
  );
  return { service, store };
}

describe('Start here', () => {
  it('shows on a fresh device', async () => {
    const { service } = setup();
    expect((await service.learningPreferences()).startHere).toBe(true);
  });

  it('stays dismissed on this device across a restart, and turning it on again shows it', async () => {
    const { service, store } = setup();
    await service.setStartHere(false);
    expect((await service.learningPreferences()).startHere).toBe(false);

    const reopened = setup({ store: store.reopen() }).service;
    expect((await reopened.learningPreferences()).startHere).toBe(false);
    await reopened.setStartHere(true);
    expect((await setup({ store: store.reopen() }).service.learningPreferences()).startHere).toBe(true);
  });

  it('a dismissal that fails to save still holds until the app closes', async () => {
    const { service, store } = setup();
    store.failNext('writePreference', 'before');
    await service.setStartHere(false);
    expect((await service.learningPreferences()).startHere).toBe(false);
    expect((await setup({ store: store.reopen() }).service.learningPreferences()).startHere).toBe(true);
  });

  it('tells subscribers when it changes', async () => {
    const { service } = setup();
    const before = service.learningRevision();
    let told = 0;
    service.subscribe(() => told++);
    await service.setStartHere(false);
    expect(service.learningRevision()).not.toBe(before);
    expect(told).toBeGreaterThan(0);
  });
});

describe('first-use hints', () => {
  it('are all unseen on a fresh device', async () => {
    expect((await setup().service.learningPreferences()).unseenHints).toEqual(HINT_IDS);
  });

  it('are seen one at a time, on this device, across a restart', async () => {
    const { service, store } = setup();
    await service.hintSeen('count-entry');
    expect((await service.learningPreferences()).unseenHints).toEqual(['bet-selector', 'show-count']);
    expect((await setup({ store: store.reopen() }).service.learningPreferences()).unseenHints).toEqual(['bet-selector', 'show-count']);
  });

  it('all show again after "Show first-use hints again"', async () => {
    const { service, store } = setup();
    for (const id of HINT_IDS) await service.hintSeen(id);
    expect((await service.learningPreferences()).unseenHints).toEqual([]);
    await service.resetHints();
    expect((await service.learningPreferences()).unseenHints).toEqual(HINT_IDS);
    expect((await setup({ store: store.reopen() }).service.learningPreferences()).unseenHints).toEqual(HINT_IDS);
  });

  it('show again when their definition gets a new version', async () => {
    const { service, store } = setup();
    for (const id of HINT_IDS) await service.hintSeen(id);
    const revised = { ...HINTS, 'show-count': { ...HINTS['show-count'], version: HINTS['show-count'].version + 1 } };
    expect((await setup({ store: store.reopen(), hints: revised }).service.learningPreferences()).unseenHints).toEqual(['show-count']);
  });

  it('keep Start here and hints apart', async () => {
    const { service } = setup();
    await service.setStartHere(false);
    expect((await service.learningPreferences()).unseenHints).toEqual(HINT_IDS);
    await service.hintSeen('bet-selector');
    await service.setStartHere(true);
    expect(await service.learningPreferences()).toEqual({ startHere: true, unseenHints: ['count-entry', 'show-count'] });
  });
});

describe('device-local preferences (Amendment 1 C7)', () => {
  it('are never lesson-progress events or attempt records, so nothing syncs or exports them', async () => {
    const { service, store } = setup();
    await service.setStartHere(false);
    await service.hintSeen('show-count');
    await service.resetHints();
    expect(await store.readLessonEvents()).toEqual([]);
    expect(await store.readAttemptRecords()).toEqual([]);
  });

  it('read an unreadable saved value as the default', async () => {
    const store = new MemoryTrainingStore();
    for (const key of [START_HERE_DISMISSED, HINTS_SEEN]) await store.writePreference(key, '{not json');
    expect(await setup({ store }).service.learningPreferences()).toEqual({ startHere: true, unseenHints: HINT_IDS });
  });
});

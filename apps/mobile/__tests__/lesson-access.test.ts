// Spec 3 Testing Decisions › Seam 2 (lessons); Lessons › Access, Check protection
// Spec 3 Amendment 1 A2, Amendment 3, Amendment 4 §5, Amendment 5; #149
import { DEFAULT_TABLE_SETUP } from '@tableside/definitions';
import { EMPTY_QUARANTINE_LIST, type GameId } from '@tableside/engine';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup } from '@/training/service';
import { NO_SCREEN_READER } from '@/training/speech';

const CHECK_RUNNING_COUNT: ChallengeSetup = { category: 'running-count', variant: 'check' };
const LEARN_RUNNING_COUNT: ChallengeSetup = { category: 'running-count', variant: 'learn' };
const PLAY_CHECK: ChallengeSetup = { category: 'table', variant: 'check', table: { ...DEFAULT_TABLE_SETUP, seat: 'play' } };
const OBSERVE_CHECK: ChallengeSetup = { category: 'table', variant: 'check', table: DEFAULT_TABLE_SETUP };

function setup(options: { access?: Partial<AccessSupervisor>; store?: MemoryTrainingStore } = {}) {
  const store = options.store ?? new MemoryTrainingStore();
  const clock = new FakeClock(1_790_000_000_000, true);
  let next = 0;
  const service = new TrainingService({
    store,
    access: { ...alwaysAllowed, ...options.access },
    allowance: plentyAllowance(() => clock.now()),
    clock,
    entropy: entropyFromWords(PI_WORDS),
    newId: () => `id-${++next}`,
    device: 'test-device',
    owner: 'local',
    quarantine: EMPTY_QUARANTINE_LIST,
    speech: NO_SCREEN_READER,
  });
  return { service, store };
}

async function started(attempt: ChallengeSetup, options: Parameters<typeof setup>[0] = {}) {
  const harness = setup(options);
  await harness.service.load();
  await harness.service.startAttempt(attempt);
  if (harness.service.snapshot().status !== 'active') throw new Error(`expected an active attempt, got ${harness.service.snapshot().status}`);
  return harness;
}

describe('blackjack instruction withheld during a Check attempt', () => {
  it('is not withheld without an unfinished attempt, or during a Learn attempt', async () => {
    const { service } = setup();
    await service.load();
    expect(await service.instructionWithheld()).toBeNull();
    expect(await (await started(LEARN_RUNNING_COUNT)).service.instructionWithheld()).toBeNull();
  });

  it('names the unfinished Check attempt, and whether it is a Play Check', async () => {
    expect(await (await started(CHECK_RUNNING_COUNT)).service.instructionWithheld()).toEqual({ category: 'running-count', play: false });
    expect(await (await started(OBSERVE_CHECK)).service.instructionWithheld()).toEqual({ category: 'table', play: false });
    expect(await (await started(PLAY_CHECK)).service.instructionWithheld()).toEqual({ category: 'table', play: true });
  });
});

const COUNTING_LESSONS = ['card-values', 'running-count', 'true-count-conversion', 'table-counting'];
const MODE_AND_BET_SCHEDULE_LESSONS = ['basic-strategy', 'basic-with-deviations', 'counting-with-basic', 'counting-with-deviations', 'bet-schedule'];

const withheldIds = async (service: TrainingService) =>
  (await service.listLessons()).filter((entry) => entry.access.kind === 'after-check').map((entry) => entry.id);

describe('Check protection in the lesson catalog', () => {
  it('withholds only the four counting lessons for a Check attempt that is not Play', async () => {
    const { service } = await started(CHECK_RUNNING_COUNT);
    const catalog = await service.listLessons();
    expect(catalog.find((entry) => entry.id === 'running-count')?.access).toEqual({ kind: 'after-check', attempt: { category: 'running-count', play: false } });
    expect(await withheldIds(service)).toEqual(COUNTING_LESSONS);
    expect(await withheldIds((await started(OBSERVE_CHECK)).service)).toEqual(COUNTING_LESSONS);
  });

  it('also withholds the four blackjack mode lessons and the bet-schedule lesson for a Play Check', async () => {
    const { service } = await started(PLAY_CHECK);
    expect(new Set(await withheldIds(service))).toEqual(new Set([...COUNTING_LESSONS, ...MODE_AND_BET_SCHEDULE_LESSONS]));
    const open = (await service.listLessons()).filter((entry) => entry.access.kind === 'available').map((entry) => entry.id);
    expect(open).toEqual(expect.arrayContaining(['app-orientation', 'blackjack-basics', 'craps-basics', 'roulette-basics', 'building-a-strategy']));
    expect(open).toHaveLength(24 - 9);
  });

  it('withholds nothing during a Learn attempt', async () => {
    expect(await withheldIds((await started(LEARN_RUNNING_COUNT)).service)).toEqual([]);
  });
});

describe('opening a withheld lesson', () => {
  it('refuses the lesson and its worked example while the Check attempt is unfinished, even suspended, and records nothing', async () => {
    const { service, store } = await started(CHECK_RUNNING_COUNT);
    service.suspend('navigation');
    expect(await service.lessonAccess('running-count')).toEqual({ kind: 'after-check', attempt: { category: 'running-count', play: false } });
    await expect(service.openLesson('running-count')).rejects.toThrow(/after the Check attempt/);
    await expect(service.stepForward('running-count', 1)).rejects.toThrow(/after the Check attempt/);
    await expect(service.completeLesson('running-count')).rejects.toThrow(/after the Check attempt/);
    expect(await store.readLessonEvents()).toEqual([]);
    expect((await service.openLesson('blackjack-basics')).id).toBe('blackjack-basics');
  });

  it('opens it again once the attempt is ended, which is abandonment: the charge stays and nothing is earned', async () => {
    const { service, store } = await started(PLAY_CHECK);
    service.suspend('navigation');
    await service.end({ showResults: false });

    expect(service.snapshot().status).toBe('none');
    const [record] = await store.readAttemptRecords();
    expect(record).toMatchObject({ endingReason: 'abandoned', groupKey: { category: 'table', variant: 'check' } });
    expect((await store.loadAttempt(record!.attemptId))?.charge).not.toBeNull();
    expect(await store.readMilestones()).toEqual([]);

    expect(await service.instructionWithheld()).toBeNull();
    expect(await service.lessonAccess('bet-schedule')).toEqual({ kind: 'available' });
    expect((await service.openLesson('bet-schedule')).step).toBe(1);
  });
});

// Spec 3 Amendment 4 §5: the access service says whether a game is playable now
function offline(offlineGame: GameId | null): Pick<AccessSupervisor, 'gameAccess'> {
  return { gameAccess: async ({ game }) => (game === offlineGame ? { status: 'playable' } : { status: 'needs-connection', offlineGame }) };
}

const accessById = async (service: TrainingService) => new Map((await service.listLessons()).map((entry) => [entry.id, entry.access]));

describe('lesson offline access', () => {
  it("opens every lesson when spec 1's stub says every game is playable", async () => {
    const { service } = setup();
    expect([...(await accessById(service)).values()].every((access) => access.kind === 'available')).toBe(true);
  });

  it('follows the selected offline game; counting lessons are blackjack content; App orientation and Builder are always available', async () => {
    const blackjack = await accessById(setup({ access: offline('blackjack') }).service);
    expect(blackjack.get('running-count')).toEqual({ kind: 'available' });
    expect(blackjack.get('bet-schedule')).toEqual({ kind: 'available' });
    expect(blackjack.get('pass-with-odds')).toEqual({ kind: 'needs-connection', game: 'craps', offlineGame: 'blackjack' });
    expect(blackjack.get('capped-martingale')).toEqual({ kind: 'needs-connection', game: 'roulette', offlineGame: 'blackjack' });

    const craps = await accessById(setup({ access: offline('craps') }).service);
    expect(craps.get('pass-with-odds')).toEqual({ kind: 'available' });
    expect(craps.get('true-count-conversion')).toEqual({ kind: 'needs-connection', game: 'blackjack', offlineGame: 'craps' });
    expect(craps.get('blackjack-basics')).toEqual({ kind: 'needs-connection', game: 'blackjack', offlineGame: 'craps' });

    for (const always of [blackjack, craps, await accessById(setup({ access: offline(null) }).service)]) {
      expect(always.get('app-orientation')).toEqual({ kind: 'available' });
      expect(always.get('building-a-strategy')).toEqual({ kind: 'available' });
    }
  });

  it('keeps the bookmark of a lesson that needs a connection, and resumes there after reconnecting', async () => {
    let connected = true;
    const store = new MemoryTrainingStore();
    const access: Pick<AccessSupervisor, 'gameAccess'> = { gameAccess: async (context) => (connected ? { status: 'playable' } : offline('blackjack').gameAccess(context)) };
    const { service } = setup({ store, access });
    await service.stepForward('pass-with-odds', 1);
    await service.stepForward('pass-with-odds', 2);

    connected = false;
    await expect(service.openLesson('pass-with-odds')).rejects.toThrow(/needs a connection/);
    await expect(service.restartLesson('pass-with-odds')).rejects.toThrow(/needs a connection/);
    expect((await service.listLessons()).find((entry) => entry.id === 'pass-with-odds')).toMatchObject({
      access: { kind: 'needs-connection' },
      status: { kind: 'in-progress', step: 3 },
    });

    connected = true;
    expect(await service.openLesson('pass-with-odds')).toMatchObject({ step: 3, prompt: { kind: 'resume-or-restart', step: 3 } });
  });

  it("treats an access service that can't answer as needing a connection", async () => {
    const { service } = setup({ access: { gameAccess: async () => Promise.reject(new Error('no answer')) } });
    expect(await service.lessonAccess('craps-basics')).toEqual({ kind: 'needs-connection', game: 'craps', offlineGame: null });
    expect(await service.lessonAccess('app-orientation')).toEqual({ kind: 'available' });
  });

  it('says a lesson needs a connection, rather than offering to end a Check attempt, when ending would not open it', async () => {
    const { service } = await started(CHECK_RUNNING_COUNT, { access: offline('craps') });
    expect(await service.lessonAccess('running-count')).toEqual({ kind: 'needs-connection', game: 'blackjack', offlineGame: 'craps' });
  });
});

describe('lesson access changes', () => {
  it('revises the lessons when a Check attempt starts or ends, and when access changes', async () => {
    const { service } = setup();
    await service.load();
    const revisions = [service.lessonRevision()];
    await service.startAttempt(CHECK_RUNNING_COUNT);
    revisions.push(service.lessonRevision());
    await service.end({ showResults: false });
    revisions.push(service.lessonRevision());
    await service.lifecycle('access-changed');
    revisions.push(service.lessonRevision());
    expect(new Set(revisions).size).toBe(4);
  });
});

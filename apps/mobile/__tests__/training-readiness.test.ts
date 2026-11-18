// Spec 3 Comparison groups, records and progression (Readiness streak, Milestones, Recommendations)
// Testing Decisions › Seam 2 (Projection); #141, #148
import { EMPTY_QUARANTINE_LIST, type ChallengeView } from '@tableside/engine';

import { alwaysAllowed } from '@/practice/adapters';
import { entropyFromWords, FakeClock, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup } from '@/training/service';
import { NO_SCREEN_READER } from '@/training/speech';
import { cardOf, HI_LO_BY_RANK } from '@/training/testing/hi-lo';
import { milestone } from '@/training/testing/store-contract';

function setup(store = new MemoryTrainingStore()) {
  const clock = new FakeClock(1_790_000_000_000, true);
  let next = 0;
  const service = new TrainingService({
    store,
    access: alwaysAllowed,
    allowance: plentyAllowance(() => clock.now()),
    clock,
    entropy: entropyFromWords(PI_WORDS),
    newId: () => `attempt-${++next}`,
    device: 'test-device',
    owner: 'local',
    quarantine: EMPTY_QUARANTINE_LIST,
    speech: NO_SCREEN_READER,
  });
  return { service, store };
}

const right = (view: ChallengeView) => HI_LO_BY_RANK[cardOf(view.item).rank]!;
// 19/20 meets the 95% threshold; 18/20 doesn't
const wrongOn =
  (...positions: number[]) =>
  (view: ChallengeView) =>
    positions.includes(view.position) ? (right(view) === 1 ? -1 : 1) : right(view);

async function finish(service: TrainingService, setup: ChallengeSetup, choose: (view: ChallengeView) => -1 | 0 | 1) {
  service.dismissResults();
  await service.startAttempt(setup);
  for (let guard = 0; guard < 200 && service.snapshot().status === 'active'; guard++) {
    const snapshot = service.snapshot();
    if (snapshot.status !== 'active') break;
    if (snapshot.hold?.reached) await service.resume();
    else await service.submit(snapshot.view.phase === 'question' ? { kind: 'answer', value: choose(snapshot.view) } : { kind: 'next-item' });
  }
  const ended = service.snapshot();
  if (ended.status !== 'ended') throw new Error(`expected results, got ${ended.status}`);
  return ended;
}

async function abandon(service: TrainingService, setup: ChallengeSetup) {
  service.dismissResults();
  await service.startAttempt(setup);
  await service.submit({ kind: 'answer', value: 0 });
  await service.end({ showResults: false });
}

const CHECK = { category: 'card-values', variant: 'check' } as const;
const LEARN = { category: 'card-values', variant: 'learn' } as const;

describe('readiness through the Training service', () => {
  it('earns the milestone on the second advancing Check, records it once and names the next step on the path', async () => {
    const { service, store } = setup();
    await service.load();
    expect((await finish(service, CHECK, wrongOn(3))).earned.readiness).toBeNull();
    const earning = await finish(service, CHECK, right);
    expect(earning.earned.readiness).toEqual({ kind: 'earned', next: 'running-count' });

    expect(await store.readMilestones()).toEqual([
      { recordVersion: 1, owner: 'local', installation: 'test-device', groupKey: earning.record.groupKey, attempts: ['attempt-1', 'attempt-2'], deviceSequences: [1, 2], earnedAt: earning.record.endedAt },
    ]);
    expect((await finish(service, CHECK, right)).earned.readiness).toBeNull();
    expect(await store.readMilestones()).toHaveLength(1);

    const progress = await service.progress();
    expect(progress.groups.find((group) => group.key.variant === 'check')?.milestone).toMatchObject({ earnedAt: earning.record.endedAt, local: true });
    expect(progress.recommendation).toEqual({ category: 'running-count', reason: { kind: 'next', after: 'card-values' }, enter: null });
  });

  it('keeps the milestone after a later Check below the threshold, and suggests a review on its results', async () => {
    const { service } = setup();
    await service.load();
    await finish(service, CHECK, right);
    const earning = await finish(service, CHECK, right);
    const slip = await finish(service, CHECK, wrongOn(1, 2));
    expect(slip.earned.readiness).toEqual({ kind: 'kept', earnedAt: earning.record.endedAt });
    expect((await service.progress()).groups.find((group) => group.key.variant === 'check')?.milestone).not.toBeNull();
  });

  it('leaves the streak alone on Learn and breaks it on an abandoned Check', async () => {
    const { service } = setup();
    await service.load();
    await finish(service, CHECK, right);
    await finish(service, LEARN, wrongOn(1, 2, 3));
    expect((await finish(service, CHECK, right)).earned.readiness).toEqual({ kind: 'earned', next: 'running-count' });

    const other = setup().service;
    await other.load();
    await finish(other, CHECK, right);
    await abandon(other, CHECK);
    expect((await finish(other, CHECK, right)).earned.readiness).toBeNull();
    expect((await finish(other, CHECK, right)).earned.readiness).toEqual({ kind: 'earned', next: 'running-count' });
  });

  it('shows a milestone whose record failed to save on its results, and records it when the service next loads', async () => {
    const store = new MemoryTrainingStore();
    const first = setup(store).service;
    await first.load();
    await finish(first, CHECK, right);
    store.failNext('recordMilestone', 'before');
    expect((await finish(first, CHECK, right)).earned.readiness).toEqual({ kind: 'earned', next: 'running-count' });
    expect(await store.readMilestones()).toEqual([]);

    const again = setup(store.reopen()).service;
    await again.load();
    expect(await store.readMilestones()).toMatchObject([{ attempts: ['attempt-1', 'attempt-2'] }]);
  });
});

// Spec 3 Synchronized record types › Readiness milestone; Amendment 1 B3; #148
describe('milestones from every device', () => {
  const checkGroup = async (service: TrainingService) => (await service.progress()).groups.find((group) => group.key.variant === 'check');

  it('show another device’s accepted milestone, while this device keeps its own streak', async () => {
    const { service, store } = setup();
    await service.load();
    const first = await finish(service, CHECK, right);
    const theirs = milestone(['their-1', 'their-2'], { installation: 'other-device', groupKey: first.record.groupKey, earnedAt: 1_789_000_000_000 });
    await store.acceptMilestones([theirs]);

    expect(await checkGroup(service)).toMatchObject({ milestone: { record: theirs, local: false, earnedAt: theirs.earnedAt } });
    expect((await service.progress()).recommendation.category).toBe('running-count');
    expect(await store.readMilestones()).toEqual([]);
    const second = await finish(service, CHECK, right);
    expect(second.earned.readiness).toEqual({ kind: 'earned', next: 'running-count' });
    expect(await store.readMilestones()).toMatchObject([{ installation: 'test-device', attempts: [first.record.attemptId, second.record.attemptId] }]);
  });

  it('show this device’s milestone as synced once accepted, and drop it once the server refuses it', async () => {
    const { service, store } = setup();
    await service.load();
    await finish(service, CHECK, right);
    await finish(service, CHECK, right);
    const [own] = await store.readMilestones();
    expect(await checkGroup(service)).toMatchObject({ milestone: { local: true } });

    await store.acceptMilestones([own!]);
    expect(await checkGroup(service)).toMatchObject({ milestone: { record: own, local: false } });

    const refusedStore = new MemoryTrainingStore();
    const refused = setup(refusedStore).service;
    await refused.load();
    await finish(refused, CHECK, right);
    await finish(refused, CHECK, right);
    await refusedStore.refuseMilestones(['test-device/attempt-1/attempt-2']);
    expect(await checkGroup(refused)).toMatchObject({ milestone: null });
    expect((await refused.progress()).recommendation.category).toBe('card-values');
    expect((await finish(refused, CHECK, wrongOn(1, 2))).earned.readiness).toBeNull();
  });
});

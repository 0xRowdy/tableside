// Spec 3 Comparison groups, records and progression; Testing Decisions › Seam 2 (Projection, Timer); #140
import { EMPTY_QUARANTINE_LIST, type ChallengeView } from '@tableside/engine';

import { alwaysAllowed } from '@/practice/adapters';
import { entropyFromWords, FakeClock, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup } from '@/training/service';
import { cardOf, HI_LO_BY_RANK } from '@/training/testing/hi-lo';

function setup() {
  const store = new MemoryTrainingStore();
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
  });
  return { service, clock };
}

const right = (view: ChallengeView) => HI_LO_BY_RANK[cardOf(view.item).rank]!;
const wrongOnce = (view: ChallengeView) => (view.position === 1 ? (right(view) === 1 ? -1 : 1) : right(view));

async function finish(service: TrainingService, setup: ChallengeSetup, choose: (view: ChallengeView) => -1 | 0 | 1, during?: (view: ChallengeView) => void) {
  await service.startAttempt(setup);
  for (let guard = 0; guard < 200 && service.snapshot().status === 'active'; guard++) {
    const snapshot = service.snapshot();
    if (snapshot.status !== 'active') break;
    during?.(snapshot.view);
    if (snapshot.hold?.reached) await service.resume();
    else await service.submit(snapshot.view.phase === 'question' ? { kind: 'answer', value: choose(snapshot.view) } : { kind: 'next-item' });
  }
  const ended = service.snapshot();
  if (ended.status !== 'ended') throw new Error(`expected results, got ${ended.status}`);
  return ended;
}

const CARD_VALUES_LEARN = { category: 'card-values', variant: 'learn' } as const;
const CARD_VALUES_CHECK = { category: 'card-values', variant: 'check', timed: true } as const;

describe('records through the Training service', () => {
  it('shows a new personal best on the results of the first completed attempt, and the attempt in local history', async () => {
    const { service } = setup();
    await service.load();
    const ended = await finish(service, CARD_VALUES_LEARN, wrongOnce);
    expect(ended.earned).toEqual({ bests: ['card-values'], fastest: null });

    const progress = await service.progress();
    expect(progress.history.map((entry) => [entry.record.attemptId, entry.local])).toEqual([['attempt-1', true]]);
    expect(progress.groups.map((group) => group.bests.map((best) => `${best.metric} ${best.result.correct}/${best.result.total}`))).toEqual([['card-values 19/20']]);
  });

  it('earns nothing on a retry that only equals the best', async () => {
    const { service } = setup();
    await service.load();
    await finish(service, CARD_VALUES_LEARN, wrongOnce);
    await service.retry();
    service.dismissResults();
    const again = await finish(service, CARD_VALUES_LEARN, wrongOnce);
    expect(again.earned).toEqual({ bests: [], fastest: null });
  });

  it('sets the fastest from a perfect, uninterrupted, timed Check, and not from one that was paused', async () => {
    const { service } = setup();
    await service.load();
    const timed = await finish(service, CARD_VALUES_CHECK, right);
    expect(timed.earned.bests).toEqual(['card-values']);
    expect(timed.earned.fastest).toBe(timed.record.performanceMs);

    service.dismissResults();
    let paused = false;
    const interrupted = await finish(service, CARD_VALUES_CHECK, right, () => {
      if (!paused) service.pause();
      paused = true;
    });
    expect(interrupted.record.interrupted).toBe(true);
    expect(interrupted.earned).toEqual({ bests: [], fastest: null });
    const [group] = (await service.progress()).groups;
    expect(group?.fastest?.attempt.attemptId).toBe(timed.record.attemptId);
  });
});

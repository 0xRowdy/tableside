// Spec 3 Testing Decisions › Seam 2; Attempt lifecycle › Automatic pacing; Amendment 1 C1; #136
import { EMPTY_QUARANTINE_LIST, type ChallengeView } from '@tableside/engine';

import { alwaysAllowed } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { RECORDED_MS } from '@/training/controller';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type ChallengeSetup, type TrainingSnapshot } from '@/training/service';
import { followSpokenCards } from '@/training/speech';
import { cardOf } from '@/training/testing/hi-lo';

const CHECK_AT_2S: ChallengeSetup = { category: 'running-count', variant: 'check', pacing: '2s' };

function setup() {
  const clock = new FakeClock(1_790_000_000_000, false);
  const speech = { said: [] as string[], busy: false, announce: (message: string) => void speech.said.push(message), speaking: () => speech.busy };
  let next = 0;
  const store = new MemoryTrainingStore();
  const adapters = {
    store,
    access: alwaysAllowed,
    allowance: plentyAllowance(() => clock.now()),
    clock,
    entropy: entropyFromWords(PI_WORDS),
    newId: () => `attempt-${++next}`,
    device: 'test-device',
    owner: 'local',
    quarantine: EMPTY_QUARANTINE_LIST,
    speech,
  };
  return { service: new TrainingService(adapters), adapters, clock, speech, store };
}

function active(snapshot: TrainingSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active attempt, got ${JSON.stringify(snapshot)}`);
  return snapshot;
}

const viewOf = (service: TrainingService): ChallengeView => active(service.snapshot()).view;
const placeOf = (service: TrainingService) => [viewOf(service).phase, viewOf(service).position];

async function settle() {
  for (let tries = 0; tries < 50; tries++) await Promise.resolve();
}

async function started(setupOf: ChallengeSetup) {
  const harness = setup();
  followSpokenCards(harness.service, harness.speech);
  await harness.service.load();
  await harness.service.startAttempt(setupOf);
  return harness;
}

async function wait(clock: FakeClock, ms: number) {
  clock.advance(ms);
  await settle();
}

describe('automatic pacing for the running count', () => {
  it('advances each card after the chosen pace and stops at a checkpoint, where nothing is due', async () => {
    const { service, clock } = await started(CHECK_AT_2S);
    expect(placeOf(service)).toEqual(['card', 1]);
    await wait(clock, 1_999);
    expect(placeOf(service)).toEqual(['card', 1]);
    await wait(clock, 1);
    expect(placeOf(service)).toEqual(['card', 2]);
    for (let card = 3; card <= 13; card++) await wait(clock, 2_000);
    expect(placeOf(service)).toEqual(['question', 13]);
    await wait(clock, 10 * 60_000);
    expect(placeOf(service)).toEqual(['question', 13]);
  });

  it('auto-pauses when the screen reader is still reading the card as the next one falls due, then shows that next card first on Resume', async () => {
    const { service, clock, speech } = await started(CHECK_AT_2S);
    await wait(clock, 2_000);
    speech.busy = true;
    await wait(clock, 2_000);
    expect(placeOf(service)).toEqual(['card', 2]);
    expect(active(service.snapshot()).hold).toMatchObject({ kind: 'auto-paused', cause: 'speech-backlog', reached: true });
    await wait(clock, 10 * 60_000);
    expect(placeOf(service)).toEqual(['card', 2]);

    speech.busy = false;
    await service.resume();
    expect(placeOf(service)).toEqual(['card', 3]);
    await wait(clock, 1_999);
    expect(placeOf(service)).toEqual(['card', 3]);
    await wait(clock, 1);
    expect(placeOf(service)).toEqual(['card', 4]);
  });

  it('records the pacing in the comparison group key, and a speech backlog as an interruption', async () => {
    const steady = await started({ category: 'running-count', variant: 'learn', pacing: '1s' });
    await steady.service.end();
    expect(steady.service.snapshot()).toMatchObject({ status: 'ended', record: { groupKey: { pacing: '1s' }, interrupted: false } });

    const backlogged = await started({ category: 'running-count', variant: 'check', pacing: '3s' });
    backlogged.speech.busy = true;
    await wait(backlogged.clock, 3_000);
    await backlogged.service.end();
    expect(backlogged.service.snapshot()).toMatchObject({ status: 'ended', record: { groupKey: { pacing: '3s' }, interrupted: true } });
  });

  it('keeps the pace while the count is shown, Paused and resumed, and the card waits during any hold', async () => {
    const { service, clock } = await started(CHECK_AT_2S);
    await wait(clock, 1_000);
    await service.submit({ kind: 'reveal-count' });
    expect(active(service.snapshot()).view.countAid?.revealed).toBe(true);
    await wait(clock, 1_000);
    expect(placeOf(service)).toEqual(['card', 2]);

    await wait(clock, 1_500);
    service.pause();
    await wait(clock, 60_000);
    expect(placeOf(service)).toEqual(['card', 2]);
    await service.resume();
    await wait(clock, 1_999);
    expect(placeOf(service)).toEqual(['card', 2]);
    await wait(clock, 1);
    expect(placeOf(service)).toEqual(['card', 3]);
  });

  it('never advances a self-paced attempt, even while the screen reader is speaking', async () => {
    const { service, clock, speech } = await started({ category: 'running-count', variant: 'check' });
    speech.busy = true;
    await wait(clock, 60_000);
    expect(placeOf(service)).toEqual(['card', 1]);
    expect(active(service.snapshot())).toMatchObject({ hold: null, pacing: 'self-paced' });
  });

  // Spec 3 Challenge content › Generation (presentation and timing consume no draws)
  it('deals the same cards and checkpoints at any pace', async () => {
    const cardsAt = async (pacing: ChallengeSetup['pacing']) => {
      const { service, clock } = await started({ category: 'running-count', variant: 'check', ...(pacing ? { pacing } : {}) });
      const seen: unknown[] = [];
      for (let guard = 0; guard < 30 && viewOf(service).phase !== 'question'; guard++) {
        seen.push(viewOf(service).item);
        if (pacing) await wait(clock, 3_000);
        else await service.submit({ kind: 'next-item' });
      }
      const answering = service.submit({ kind: 'answer', value: 0 });
      await settle();
      await wait(clock, RECORDED_MS);
      await answering;
      return [...seen, viewOf(service).item, viewOf(service).position];
    };
    const selfPaced = await cardsAt(undefined);
    expect(selfPaced).toHaveLength(14);
    expect(await cardsAt('3s')).toEqual(selfPaced);
    expect(await cardsAt('1s')).toEqual(selfPaced);
  });

  it('accepts automatic pacing only for the running count, and remembers it with the last setup', async () => {
    const { service, store } = setup();
    await service.load();
    expect(service.listCatalog().map((entry) => [entry.category, entry.pacings])).toEqual([
      ['card-values', ['self-paced']],
      ['running-count', ['self-paced', '3s', '2s', '1s']],
      ['conversion', ['self-paced']],
      ['table', ['self-paced']],
    ]);
    expect(service.validateSetup({ category: 'card-values', variant: 'learn', pacing: '2s' })).toEqual({ valid: false, diagnostics: [{ field: 'pacing', problem: 'not-ready' }] });
    expect(service.validateSetup({ category: 'running-count', variant: 'learn', pacing: '5s' })).toEqual({ valid: false, diagnostics: [{ field: 'pacing', problem: 'unknown' }] });
    await service.startAttempt({ category: 'card-values', variant: 'learn', pacing: '2s' });
    expect([service.snapshot().status, await store.findUnfinishedAttempt()]).toEqual(['none', null]);

    await service.startAttempt(CHECK_AT_2S);
    expect(await service.lastSetup()).toEqual(CHECK_AT_2S);
  });

  it('keeps the pace across recovery, and Retry keeps it too', async () => {
    const first = await started(CHECK_AT_2S);
    await wait(first.clock, 2_000);
    const later = new TrainingService({ ...first.adapters, store: first.store.reopen() });
    await later.load();
    expect(active(later.snapshot())).toMatchObject({ pacing: '2s', hold: { cause: 'recovered' } });
    await later.resume();
    await later.end();
    await later.retry();
    expect(active(later.snapshot())).toMatchObject({ pacing: '2s', view: { position: 1 } });
  });

  // Spec 3 User stories 64, 66; Information hiding (announcements)
  it('announces each card once as it appears, and nothing else: no count, entry or reveal', async () => {
    const { service, clock, speech } = await started(CHECK_AT_2S);
    const names: string[] = [];
    const note = () => names.push(`${cardOf(viewOf(service).item).rank}`);
    note();
    for (let card = 2; card <= 13; card++) {
      await wait(clock, 2_000);
      note();
    }
    await service.submit({ kind: 'reveal-count' });
    const answering = service.submit({ kind: 'answer', value: 0 });
    await settle();
    await wait(clock, RECORDED_MS);
    await answering;
    note();
    expect(speech.said).toHaveLength(14);
    expect(speech.said.map((said) => said.split(' of ')[0])).toEqual(names.map((rank) => ({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[Number(rank)] ?? rank));
    expect(speech.said.filter((said) => /[+−-]|count|plus|minus|recorded/i.test(said))).toEqual([]);
  });
});

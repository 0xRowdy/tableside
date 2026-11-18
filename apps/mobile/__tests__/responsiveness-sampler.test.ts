// Spec 1 Launch gates 5; #121
import type { ChallengeCategory, ChallengeCommand, ChallengeFact, Command, DomainFact, Receipt } from '@tableside/engine';

import { MemoryActivityStore } from '@/practice/memory-store';
import { MemoryTrainingStore } from '@/training/memory-store';
import { FRESH_LIFECYCLE, type AttemptCommitOutcome, type AttemptLifecycle, type AttemptTransitionCommit, type NewAttempt, type TrainingStore } from '@/training/store';
import type { ActivityStore, CommitOutcome, NewActivity, TransitionCommit } from '@/practice/store';
import { CLAIM_MS, createSampler, HOLD_MS, type Sampler, type SamplerPorts } from '@/responsiveness/sampler';
import type { DeviceInfo, ResponsivenessSample } from '@/responsiveness/samples';

const DEVICE: DeviceInfo = { model: 'Pixel 3a', os: 'Android', osVersion: '14', build: '0.1.0 (1)', abi: 'arm64-v8a' };

function harness(processStart: number | null = 100) {
  const recorded: ResponsivenessSample[] = [];
  const deferred: (() => void)[] = [];
  let clock = 0;
  let frame = 0;
  const ports: SamplerPorts = {
    device: DEVICE,
    now: () => clock,
    afterCommit: (run) => void deferred.push(run),
    nextFrame: () => Promise.resolve(frame),
    processStart: () => processStart,
    record: (sample) => void recorded.push(sample),
  };
  return {
    sampler: createSampler(ports),
    recorded,
    at(ms: number) {
      clock = ms;
    },
    async drawAt(ms: number) {
      frame = ms;
      for (const run of deferred.splice(0)) run();
      await flush();
    },
  };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const touch = (timestamp: number) => ({ nativeEvent: { timestamp } });

class ScriptedStore extends MemoryActivityStore {
  outcome: CommitOutcome | Error = { status: 'committed' };
  override async commitTransition(_commit: TransitionCommit): Promise<CommitOutcome> {
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  }
}

const activity = (game: 'roulette' | 'blackjack' | 'craps'): NewActivity =>
  ({ activityId: `a-${game}`, specification: { game }, admission: { provenance: 'stub', meteringBasis: 'free-play' }, random: {}, checkpoint: '', createdAt: 0 }) as unknown as NewActivity;

const receipt = (command: Command): Receipt => ({ commandId: 'c', sequence: 1, command: JSON.stringify(command), disposition: 'applied' });
const commit = (game: string, command: Command): TransitionCommit => ({ activityId: `a-${game}`, priorSequence: 1, checkpoint: '', receipt: receipt(command), facts: [], effects: [] });

async function tableStore(sampler: Sampler, game: 'roulette' | 'blackjack' | 'craps' = 'roulette') {
  const inner = new ScriptedStore();
  const store: ActivityStore = sampler.practiceStore(inner);
  await store.createActivity(activity(game));
  return { inner, store };
}

type Harness = ReturnType<typeof harness>;

// docs/development.md Responsiveness sampling (touch order)
async function tap(h: Harness, store: ActivityStore, transition: TransitionCommit, times: { down: number; up: number; at?: number }) {
  h.sampler.touchStart(touch(times.down));
  h.at(times.at ?? times.up);
  const committing = store.commitTransition(transition);
  h.sampler.touchEnd(touch(times.up));
  return committing;
}

describe('acknowledgment and durable completion', () => {
  it('measures a tapped action from the touch to the frames after its press response and its commit', async () => {
    const h = harness();
    const { store } = await tableStore(h.sampler);
    h.sampler.touchStart(touch(1000));
    await h.drawAt(1030);
    h.at(1080);
    const committing = store.commitTransition(commit('roulette', { kind: 'place-wager', target: 'red', amount: '10' }));
    h.sampler.touchEnd(touch(1080));
    await committing;
    await h.drawAt(1250);
    expect(h.recorded).toEqual([
      { version: 1, device: DEVICE, measure: 'acknowledgment', game: 'roulette', family: 'place-wager', start: 1000, end: 1030, ms: 30 },
      { version: 1, device: DEVICE, measure: 'completion', game: 'roulette', family: 'place-wager', start: 1080, end: 1250, ms: 170 },
    ]);
  });

  it('also measures an action whose commit waits for something after the touch ends', async () => {
    const h = harness();
    const { store } = await tableStore(h.sampler);
    h.sampler.touchStart(touch(10));
    h.sampler.touchEnd(touch(20));
    h.at(20 + CLAIM_MS);
    await store.commitTransition(commit('roulette', { kind: 'begin-turn' }));
    await h.drawAt(1100);
    expect(h.recorded.map((sample) => [sample.measure, sample.start])).toEqual([
      ['acknowledgment', 10],
      ['completion', 20],
    ]);
  });

  it.each<[string, 'roulette' | 'blackjack' | 'craps', Command, string]>([
    ['removing a wager', 'roulette', { kind: 'place-wager', target: 'red', amount: '0' }, 'remove-wager'],
    ['taking insurance', 'blackjack', { kind: 'place-wager', target: 'insurance', amount: '5' }, 'insurance'],
    ['each blackjack decision', 'blackjack', { kind: 'play', action: 'double' }, 'play:double'],
    ['declining insurance', 'blackjack', { kind: 'play', action: 'decline-insurance' }, 'play:decline-insurance'],
    ['a deal, roll or spin', 'craps', { kind: 'begin-turn' }, 'begin-turn'],
    ['turning a bet off', 'craps', { kind: 'set-working', target: 'place-6', working: false }, 'set-working'],
    ['a rebuy', 'roulette', { kind: 'rebuy', amount: '100' }, 'rebuy'],
    ['retrying a correction', 'roulette', { kind: 'retry-correction' }, 'retry-correction'],
    ['overriding a correction', 'roulette', { kind: 'override-correction' }, 'override-correction'],
  ])('names the family for %s', async (_, game, command, family) => {
    const h = harness();
    const { store } = await tableStore(h.sampler, game);
    await tap(h, store, commit(game, command), { down: 10, up: 20 });
    await h.drawAt(100);
    expect(h.recorded.map((sample) => [sample.measure, sample.game, sample.family])).toEqual([
      ['acknowledgment', game, family],
      ['completion', game, family],
    ]);
  });

  it.each<[string, Command]>([
    ['settling a turn', { kind: 'settle-turn' }],
    ['stopping (final settlement is long work)', { kind: 'request-stop' }],
    ['advancing final settlement', { kind: 'advance-final-settlement' }],
    ['advancing strategy settlement', { kind: 'advance-strategy-settlement' }],
  ])('leaves out %s', async (_, command) => {
    const h = harness();
    const { store } = await tableStore(h.sampler);
    await tap(h, store, commit('roulette', command), { down: 10, up: 20 });
    await h.drawAt(100);
    expect(h.recorded).toEqual([]);
  });

  it('records nothing for a command no touch started, or a touch already used, ended too long ago, held too long or cancelled', async () => {
    const h = harness();
    const { store } = await tableStore(h.sampler);
    const spin = commit('roulette', { kind: 'begin-turn' });
    await store.commitTransition(spin);
    h.sampler.touchStart(touch(10));
    h.sampler.touchEnd(touch(20));
    h.at(20 + CLAIM_MS + 1);
    await store.commitTransition(spin);
    h.sampler.touchStart(touch(2000));
    h.at(2000 + HOLD_MS + 1);
    await store.commitTransition(spin);
    h.sampler.touchStart(touch(20_000));
    h.sampler.touchCancel();
    h.at(20_010);
    await store.commitTransition(spin);
    await tap(h, store, spin, { down: 30_000, up: 30_010 });
    await store.commitTransition(spin);
    await h.drawAt(30_100);
    expect(h.recorded.map((sample) => [sample.measure, sample.start])).toEqual([
      ['acknowledgment', 30_000],
      ['completion', 30_010],
    ]);
  });

  it('records nothing for an action the engine refused', async () => {
    const h = harness();
    const { store } = await tableStore(h.sampler);
    const command: Command = { kind: 'place-wager', target: 'red', amount: '1' };
    const refused: TransitionCommit = { ...commit('roulette', command), facts: [{ kind: 'illegal-action', command, reason: 'below-minimum' } as unknown as DomainFact] };
    await tap(h, store, refused, { down: 10, up: 20 });
    await h.drawAt(100);
    expect(h.recorded).toEqual([]);
  });

  it('records no completion for a commit that failed or was not this one', async () => {
    const h = harness();
    const { inner, store } = await tableStore(h.sampler);
    const outcomes: (CommitOutcome | Error)[] = [new Error('disk full'), { status: 'sequence-conflict', sequence: 2 }];
    for (const outcome of outcomes) {
      inner.outcome = outcome;
      await tap(h, store, commit('roulette', { kind: 'begin-turn' }), { down: 10, up: 20 }).catch(() => undefined);
    }
    await h.drawAt(100);
    expect(h.recorded.map((sample) => sample.measure)).toEqual(['acknowledgment', 'acknowledgment']);
  });

  it('passes every store call through', async () => {
    const h = harness();
    const { inner, store } = await tableStore(h.sampler);
    await expect(store.commitTransition(commit('roulette', { kind: 'begin-turn' }))).resolves.toEqual({ status: 'committed' });
    await expect(store.load('a-roulette')).resolves.toEqual(await inner.load('a-roulette'));
    await expect(store.findUnfinished()).resolves.toEqual(await inner.findUnfinished());
    await expect(store.readTransitions('a-roulette')).resolves.toEqual(await inner.readTransitions('a-roulette'));
    await expect(store.readOutgoing()).resolves.toEqual(await inner.readOutgoing());
  });

  it('knows the game of a practice session it finds on launch', async () => {
    const h = harness();
    const inner = new ScriptedStore();
    await inner.createActivity(activity('craps'));
    const store = h.sampler.practiceStore(inner);
    await store.findUnfinished();
    await tap(h, store, commit('craps', { kind: 'begin-turn' }), { down: 10, up: 20 });
    await h.drawAt(100);
    expect(h.recorded.map((sample) => sample.game)).toEqual(['craps', 'craps']);
  });
});

// Spec 3 Launch gates 8; #156
describe('challenge actions', () => {
  const attempt = (category: ChallengeCategory, id = `attempt-${category}`): NewAttempt =>
    ({ attemptId: id, specification: { variant: 'check', content: { category } }, lifecycle: FRESH_LIFECYCLE }) as unknown as NewAttempt;

  const challengeCommit = (category: ChallengeCategory, command: ChallengeCommand, facts: readonly ChallengeFact[] = [], lifecycle: AttemptLifecycle = FRESH_LIFECYCLE): AttemptTransitionCommit => ({
    attemptId: `attempt-${category}`,
    priorSequence: 1,
    checkpoint: '',
    receipt: { commandId: 'c', sequence: 1, command: JSON.stringify(command), disposition: 'applied' },
    facts,
    charge: null,
    lifecycle,
  });

  class ScriptedTrainingStore extends MemoryTrainingStore {
    override async commitAttemptTransition(_commit: AttemptTransitionCommit): Promise<AttemptCommitOutcome> {
      return { status: 'committed' };
    }
  }

  async function challengeStore(sampler: Sampler, category: ChallengeCategory) {
    const store = sampler.trainingStore(new ScriptedTrainingStore());
    await store.createAttempt(attempt(category));
    return store;
  }

  async function tapChallenge(h: Harness, store: TrainingStore, transition: AttemptTransitionCommit) {
    h.sampler.touchStart(touch(10));
    h.at(20);
    const committing = store.commitAttemptTransition(transition);
    h.sampler.touchEnd(touch(20));
    await committing;
    await h.drawAt(100);
    return h.recorded.map((sample) => [sample.measure, sample.game, sample.family]);
  }

  const both = (family: string) => [
    ['acknowledgment', 'challenge', family],
    ['completion', 'challenge', family],
  ];

  it.each<[string, ChallengeCategory, ChallengeCommand, readonly ChallengeFact[], string]>([
    ['a card value', 'card-values', { kind: 'answer', value: 1 }, [{ kind: 'answer-accepted', position: 0, scored: true }], 'answer-submission'],
    ['a true count', 'conversion', { kind: 'answer', value: -2 }, [{ kind: 'answer-accepted', position: 0, scored: true }], 'answer-submission'],
    ['a skipped card value', 'card-values', { kind: 'skip' }, [{ kind: 'answer-accepted', position: 0, scored: true }], 'answer-submission'],
    ['a Play decision', 'table', { kind: 'play', action: 'hit' }, [], 'answer-submission'],
    ['an opening wager', 'table', { kind: 'bet', amount: '20' }, [{ kind: 'wager-placed', position: 3 }], 'answer-submission'],
    ['a running count at a checkpoint', 'running-count', { kind: 'answer', value: 3 }, [{ kind: 'answer-accepted', position: 9, scored: true }], 'checkpoint-entry'],
    ['a table count at a checkpoint', 'table', { kind: 'answer', value: -1 }, [{ kind: 'answer-accepted', position: 9, scored: true }], 'checkpoint-entry'],
    ['a skipped checkpoint', 'running-count', { kind: 'skip' }, [{ kind: 'answer-accepted', position: 9, scored: true }], 'checkpoint-entry'],
    ['the next card', 'running-count', { kind: 'next-item' }, [{ kind: 'content-shown', position: 4 }], 'card-advance'],
    ['the next card, due a checkpoint', 'running-count', { kind: 'next-item' }, [{ kind: 'content-shown', position: 4 }, { kind: 'checkpoint-due', position: 4 }], 'card-advance'],
    ['the next table step', 'table', { kind: 'next-item' }, [], 'card-advance'],
  ])('names the family for %s', async (_, category, command, facts, family) => {
    const h = harness();
    const store = await challengeStore(h.sampler, category);
    expect(await tapChallenge(h, store, challengeCommit(category, command, facts))).toEqual(both(family));
  });

  it.each<[string, ChallengeCategory, ChallengeCommand, readonly ChallengeFact[], AttemptLifecycle]>([
    ['starting (the charge commits with the first content)', 'card-values', { kind: 'begin' }, [{ kind: 'content-shown', position: 0 }], FRESH_LIFECYCLE],
    ['ending', 'card-values', { kind: 'end' }, [{ kind: 'attempt-ended', ending: 'abandoned' }], FRESH_LIFECYCLE],
    ['the last card, which ends the attempt', 'running-count', { kind: 'next-item' }, [{ kind: 'attempt-ended', ending: 'completed' }], FRESH_LIFECYCLE],
    ['a card that automatic pacing advanced', 'running-count', { kind: 'next-item' }, [{ kind: 'content-shown', position: 4 }], { ...FRESH_LIFECYCLE, pacing: '2s' }],
    ['showing the count', 'running-count', { kind: 'reveal-count' }, [], FRESH_LIFECYCLE],
    ['retrying an item', 'card-values', { kind: 'retry-item' }, [], FRESH_LIFECYCLE],
    ['a Play decision the rules refuse', 'table', { kind: 'play', action: 'split' }, [{ kind: 'move-refused', position: 3, action: 'split' }], FRESH_LIFECYCLE],
    ['retrying a correction', 'table', { kind: 'retry-correction' }, [], FRESH_LIFECYCLE],
  ])('leaves out %s', async (_, category, command, facts, lifecycle) => {
    const h = harness();
    const store = await challengeStore(h.sampler, category);
    expect(await tapChallenge(h, store, challengeCommit(category, command, facts, lifecycle))).toEqual([]);
  });

  // Spec 3 Information hiding (end to end)
  it('samples a right and a wrong answer identically: the family, never the answer, card or attempt', async () => {
    const run = async (value: number, scored: boolean) => {
      const h = harness();
      const store = await challengeStore(h.sampler, 'running-count');
      await tapChallenge(h, store, challengeCommit('running-count', { kind: 'answer', value }, [{ kind: 'answer-accepted', position: 9, scored }]));
      return h.recorded;
    };
    const right = await run(4, true);
    expect(await run(-7, true)).toEqual(right);
    const sent = JSON.stringify(right);
    for (const hidden of ['attempt-running-count', 'value', 'position', '"4"', 'scored', 'running-count']) expect(sent).not.toContain(hidden);
  });

  it('knows the category of an attempt it finds or loads after a restart', async () => {
    for (const find of ['findUnfinishedAttempt', 'loadAttempt'] as const) {
      const h = harness();
      const inner = new ScriptedTrainingStore();
      await inner.createAttempt(attempt('table'));
      const store = h.sampler.trainingStore(inner);
      await (find === 'loadAttempt' ? store.loadAttempt('attempt-table') : store.findUnfinishedAttempt());
      expect(await tapChallenge(h, store, challengeCommit('table', { kind: 'answer', value: 2 }))).toEqual(both('checkpoint-entry'));
    }
  });

  it('passes every training store call through', async () => {
    const h = harness();
    const inner = new MemoryTrainingStore();
    const store = h.sampler.trainingStore(inner);
    await store.createAttempt(attempt('card-values'));
    await store.writePreference('challenge.last-setup', '{}');
    await expect(store.readPreference('challenge.last-setup')).resolves.toBe('{}');
    await expect(store.findUnfinishedAttempt()).resolves.toEqual(await inner.findUnfinishedAttempt());
    await expect(store.readAttemptRecords()).resolves.toEqual([]);
    await expect(store.readLessonSync()).resolves.toEqual(await inner.readLessonSync());
    await expect(store.readMilestoneSync()).resolves.toEqual(await inner.readMilestoneSync());
  });
});

describe('cold launch', () => {
  it('measures from process start to the frame after Home is usable, once per process', async () => {
    const h = harness(100);
    h.sampler.launchUsable();
    await h.drawAt(2600);
    h.sampler.launchUsable();
    await h.drawAt(9000);
    expect(h.recorded).toEqual([{ version: 1, device: DEVICE, measure: 'cold-launch', game: null, family: 'cold-launch', start: 100, end: 2600, ms: 2500 }]);
  });

  it('records nothing when the process start is unknown', async () => {
    const h = harness(null);
    h.sampler.launchUsable();
    await h.drawAt(2600);
    expect(h.recorded).toEqual([]);
  });

  it('records nothing when the player had to touch the screen before Home (signing in, choosing the offline game)', async () => {
    const h = harness(100);
    h.sampler.touchStart(touch(500));
    h.sampler.touchEnd(touch(600));
    h.sampler.launchUsable();
    await h.drawAt(9000);
    expect(h.recorded).toEqual([]);
  });
});

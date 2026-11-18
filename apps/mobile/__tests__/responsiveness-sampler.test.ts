// Spec 1 Launch gates 5; #121
import type { Command, Receipt } from '@tableside/engine';

import { MemoryActivityStore } from '@/practice/memory-store';
import type { ActivityStore, CommitOutcome, NewActivity, TransitionCommit } from '@/practice/store';
import { CLAIM_MS, createSampler, type SamplerPorts } from '@/responsiveness/sampler';
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
    // The commit has rendered and the next frame is drawn at `ms`.
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

async function tableStore(sampler: ReturnType<typeof createSampler>, game: 'roulette' | 'blackjack' | 'craps' = 'roulette') {
  const inner = new ScriptedStore();
  const store: ActivityStore = sampler.practiceStore(inner);
  await store.createActivity(activity(game));
  return { inner, store };
}

describe('acknowledgement and durable completion', () => {
  it('measures a tapped action from the touch to the frames after its press response and its commit', async () => {
    const { sampler, recorded, at, drawAt } = harness();
    const { store } = await tableStore(sampler);
    sampler.touchStart(touch(1000));
    await drawAt(1030);
    sampler.touchEnd(touch(1080));
    at(1090);
    await store.commitTransition(commit('roulette', { kind: 'place-wager', target: 'red', amount: '10' }));
    await drawAt(1250);
    expect(recorded).toEqual([
      { version: 1, device: DEVICE, measure: 'acknowledgement', game: 'roulette', family: 'place-wager', start: 1000, end: 1030, ms: 30 },
      { version: 1, device: DEVICE, measure: 'completion', game: 'roulette', family: 'place-wager', start: 1080, end: 1250, ms: 170 },
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
    const { sampler, recorded, at, drawAt } = harness();
    const { store } = await tableStore(sampler, game);
    sampler.touchStart(touch(10));
    sampler.touchEnd(touch(20));
    at(30);
    await store.commitTransition(commit(game, command));
    await drawAt(100);
    expect(recorded.map((sample) => [sample.measure, sample.game, sample.family])).toEqual([
      ['acknowledgement', game, family],
      ['completion', game, family],
    ]);
  });

  it.each<[string, Command]>([
    ['settling a turn', { kind: 'settle-turn' }],
    ['stopping (final settlement is long work)', { kind: 'request-stop' }],
    ['advancing final settlement', { kind: 'advance-final-settlement' }],
    ['advancing strategy settlement', { kind: 'advance-strategy-settlement' }],
  ])('leaves out %s', async (_, command) => {
    const { sampler, recorded, at, drawAt } = harness();
    const { store } = await tableStore(sampler);
    sampler.touchStart(touch(10));
    sampler.touchEnd(touch(20));
    at(30);
    await store.commitTransition(commit('roulette', command));
    await drawAt(100);
    expect(recorded).toEqual([]);
  });

  it('records nothing for a command no touch started, or a touch already used or too old', async () => {
    const { sampler, recorded, at, drawAt } = harness();
    const { store } = await tableStore(sampler);
    const spin = commit('roulette', { kind: 'begin-turn' });
    await store.commitTransition(spin);
    sampler.touchStart(touch(10));
    sampler.touchEnd(touch(20));
    at(20 + CLAIM_MS + 1);
    await store.commitTransition(spin);
    sampler.touchStart(touch(5000));
    sampler.touchEnd(touch(5010));
    at(5020);
    await store.commitTransition(spin);
    await store.commitTransition(spin);
    await drawAt(5100);
    expect(recorded.map((sample) => [sample.measure, sample.start])).toEqual([
      ['acknowledgement', 5000],
      ['completion', 5010],
    ]);
  });

  it('records no completion for a commit that failed or was not this one', async () => {
    const { sampler, recorded, at, drawAt } = harness();
    const { inner, store } = await tableStore(sampler);
    const outcomes: (CommitOutcome | Error)[] = [new Error('disk full'), { status: 'sequence-conflict', sequence: 2 }];
    for (const outcome of outcomes) {
      inner.outcome = outcome;
      sampler.touchStart(touch(10));
      sampler.touchEnd(touch(20));
      at(30);
      await store.commitTransition(commit('roulette', { kind: 'begin-turn' })).catch(() => undefined);
    }
    await drawAt(100);
    expect(recorded.map((sample) => sample.measure)).toEqual(['acknowledgement', 'acknowledgement']);
  });

  it('passes every store call through', async () => {
    const { sampler } = harness();
    const { inner, store } = await tableStore(sampler);
    await expect(store.commitTransition(commit('roulette', { kind: 'begin-turn' }))).resolves.toEqual({ status: 'committed' });
    await expect(store.load('a-roulette')).resolves.toEqual(await inner.load('a-roulette'));
    await expect(store.findUnfinished()).resolves.toEqual(await inner.findUnfinished());
  });

  it('knows the game of a practice session it finds on launch', async () => {
    const { sampler, recorded, at, drawAt } = harness();
    const inner = new ScriptedStore();
    await inner.createActivity(activity('craps'));
    const store = sampler.practiceStore(inner);
    await store.findUnfinished();
    sampler.touchStart(touch(10));
    sampler.touchEnd(touch(20));
    at(30);
    await store.commitTransition(commit('craps', { kind: 'begin-turn' }));
    await drawAt(100);
    expect(recorded.map((sample) => sample.game)).toEqual(['craps', 'craps']);
  });
});

describe('cold launch', () => {
  it('measures from process start to the frame after Home first renders, once per process', async () => {
    const { sampler, recorded, drawAt } = harness(100);
    sampler.launchUsable();
    await drawAt(2600);
    sampler.launchUsable();
    await drawAt(9000);
    expect(recorded).toEqual([{ version: 1, device: DEVICE, measure: 'cold-launch', game: null, family: 'cold-launch', start: 100, end: 2600, ms: 2500 }]);
  });

  it('records nothing when the process start is unknown', async () => {
    const { sampler, recorded, drawAt } = harness(null);
    sampler.launchUsable();
    await drawAt(2600);
    expect(recorded).toEqual([]);
  });
});

// Spec 1 Launch gates 5; #121
import type { Command, DomainFact, Receipt } from '@tableside/engine';

import { MemoryActivityStore } from '@/practice/memory-store';
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

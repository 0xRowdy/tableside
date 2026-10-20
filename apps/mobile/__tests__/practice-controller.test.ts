// Seam 2: the practice controller with substitute adapters (in-memory store,
// fake clock, deterministic entropy, always-allowed access supervisor).
// Spin outcomes come from the Random123 "pi digits" stream: 27, 0, 25, 31, 9.

import { ENDING_STEP_MS, PracticeController, REVEAL_MS, type PracticeSnapshot } from '@/practice/controller';
import { FakeClock, PI_WORDS, substituteAdapters } from '@/practice/testing/substitutes';

function setup(options: { autoClock?: boolean } = {}) {
  const adapters = substituteAdapters({ clock: new FakeClock(undefined, options.autoClock ?? true) });
  const controller = new PracticeController(adapters);
  const published: PracticeSnapshot[] = [];
  controller.subscribe(() => published.push(controller.snapshot()));
  return { adapters, store: adapters.store, clock: adapters.clock, controller, published };
}

async function started(options: { autoClock?: boolean } = {}) {
  const context = setup(options);
  await context.controller.load();
  await context.controller.start({ game: 'roulette', buyIn: '1000' });
  return context;
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return snapshot;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

describe('starting', () => {
  it('starts with no session, then starts a free-play roulette session at the chosen buy-in', async () => {
    const { controller, store } = setup();
    await controller.load();
    expect(controller.snapshot().status).toBe('none');

    await controller.start({ game: 'roulette', buyIn: '1000' });

    const session = active(controller.snapshot());
    expect(session.view.phase).toBe('open-decision');
    expect(session.view.balance).toBe('1000');
    expect(session.view.wagers).toEqual([]);
    const stored = await store.load(session.view.activityId);
    expect(stored?.random).toEqual({ protocol: 1, key: [PI_WORDS[0], PI_WORDS[1]], session: [PI_WORDS[2], PI_WORDS[3]] });
    expect(stored?.sequence).toBe(0);
  });

  it('refuses a buy-in the engine rejects and stores nothing', async () => {
    const { controller, store } = setup();
    await controller.load();

    await controller.start({ game: 'roulette', buyIn: '0' });

    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: 'invalid-buy-in' });
    expect(await store.findUnfinished()).toBeNull();
  });

  it('resumes the unfinished session instead of starting a second one', async () => {
    const { controller, adapters, store } = await started();
    await controller.placeWager('red', '10');
    const other = new PracticeController({ ...adapters, newId: () => 'activity-2' });

    await other.start({ game: 'roulette', buyIn: '500' });

    const { view } = active(other.snapshot());
    expect(view.activityId).toBe('activity-1');
    expect(view.balance).toBe('990');
    expect((await store.findUnfinished())?.activityId).toBe('activity-1');
    expect(await store.load('activity-2')).toBeNull();
  });

  it('recovers the same activity and random identity when creation was not acknowledged', async () => {
    const { store, adapters } = setup();
    let draws = 0;
    const controller = new PracticeController({
      ...adapters,
      entropy: { randomBytes: (length) => (draws++, adapters.entropy.randomBytes(length)) },
    });
    await controller.load();
    store.failNext('createActivity', 'before');

    await controller.start({ game: 'roulette', buyIn: '1000' });
    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: 'save-failed' });

    store.failNext('createActivity', 'after');
    await controller.start({ game: 'roulette', buyIn: '1000' });

    const { view } = active(controller.snapshot());
    expect(view.activityId).toBe('activity-1');
    expect(draws).toBe(1);
    expect((await store.findUnfinished())?.activityId).toBe('activity-1');
  });
});

describe('wagers', () => {
  it('places red and a straight-up bet, moving their stakes from the balance to the table', async () => {
    const { controller } = await started();

    await controller.placeWager('red', '10');
    await controller.placeWager('straight-17', '5');

    const { view, facts } = active(controller.snapshot());
    expect(view.wagers).toEqual([
      { target: 'straight-17', amount: '5' },
      { target: 'red', amount: '10' },
    ]);
    expect(view.balance).toBe('985');
    expect(facts).toEqual([{ kind: 'wager-changed', target: 'straight-17', amount: '5', previous: '0' }]);
  });

  it('leaves legality to the engine: an outside bet under the minimum is recorded and changes nothing', async () => {
    const { controller, store } = await started();

    await controller.placeWager('red', '5');

    const { view, facts } = active(controller.snapshot());
    expect(view.wagers).toEqual([]);
    expect(view.balance).toBe('1000');
    expect(facts).toEqual([{ kind: 'illegal-action', command: { kind: 'place-wager', target: 'red', amount: '5' }, reason: 'below-minimum' }]);
    expect((await store.load(view.activityId))?.sequence).toBe(1);
  });
});

describe('spinning', () => {
  it('reveals the committed spin, then settles it automatically without a tap', async () => {
    const { controller, clock } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    await controller.placeWager('straight-17', '5');

    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);

    const revealing = active(controller.snapshot());
    expect(revealing.view.phase).toBe('revealing-outcome');
    expect(revealing.view.outcome).toEqual({ turn: 1, pocket: 27 });
    expect(revealing.view.wagersCommitted).toBe(true);

    clock.advance(REVEAL_MS);
    await spinning;

    const settled = active(controller.snapshot());
    expect(settled.view.phase).toBe('settled-outcome');
    // 27 is red: red 10 returns 20; straight 17 loses its 5. 985 + 20.
    expect(settled.view.balance).toBe('1005');
    expect(settled.view.wagers).toEqual([]);
    expect(settled.facts).toEqual([
      { kind: 'wager-settled', turn: 1, target: 'straight-17', stake: '5', result: 'loss', net: '-5', returned: '0' },
      { kind: 'wager-settled', turn: 1, target: 'red', stake: '10', result: 'win', net: '10', returned: '20' },
    ]);
  });

  it('never shows a spin whose commit failed, and reveals the same spin once the retry saves it', async () => {
    const { controller, store, published } = await started();
    await controller.placeWager('red', '10');
    store.failNext('commitTransition', 'before');

    await controller.spin();

    const paused = active(controller.snapshot());
    expect(paused.save).toBe('failed');
    expect(paused.view.phase).toBe('open-decision');
    expect(published.some((snapshot) => snapshot.status === 'active' && snapshot.view.outcome !== null)).toBe(false);
    expect((await store.load(paused.view.activityId))?.sequence).toBe(1);

    await controller.retrySave();

    const settled = active(controller.snapshot());
    expect(settled.save).toBe('saved');
    expect(settled.view.outcome).toEqual({ turn: 1, pocket: 27 });
    expect(settled.view.phase).toBe('settled-outcome');
  });

  it('resolves a lost acknowledgement from the receipt instead of spinning again', async () => {
    const { controller, store } = await started();
    await controller.placeWager('red', '10');
    store.failNext('commitTransition', 'after');

    await controller.spin();

    const { view } = active(controller.snapshot());
    expect(view.outcome).toEqual({ turn: 1, pocket: 27 });
    expect(view.phase).toBe('settled-outcome');
    expect((await store.load(view.activityId))?.sequence).toBe(view.sequence);
  });

  it('stays paused while it is unknown whether a spin committed, then recovers the committed spin on retry', async () => {
    const { controller, store } = await started();
    await controller.placeWager('red', '10');
    store.failNext('commitTransition', 'after');
    store.failNext('readReceipt', 'before');

    await controller.spin();

    const paused = active(controller.snapshot());
    expect(paused.save).toBe('failed');
    expect(paused.view.outcome).toBeNull();

    await controller.retrySave();

    const { view } = active(controller.snapshot());
    expect(view.outcome).toEqual({ turn: 1, pocket: 27 });
    expect(view.phase).toBe('settled-outcome');
    expect(view.balance).toBe('1010');
    // The spin committed once; the retry recovered it rather than drawing again.
    expect((await store.readReceipt(view.activityId, `${view.activityId}/1`))?.facts).toContainEqual({ kind: 'outcome-generated', turn: 1, pocket: 27 });
    expect((await store.load(view.activityId))?.sequence).toBe(3);
  });

  it('commits each transition with its command identity, facts and checkpoint before publishing it', async () => {
    const { controller, store, published } = await started();
    await controller.placeWager('red', '10');
    await controller.spin();

    const { view } = active(controller.snapshot());
    expect((await store.load(view.activityId))?.sequence).toBe(3);
    const spin = await store.readReceipt(view.activityId, `${view.activityId}/1`);
    expect(spin?.receipt).toMatchObject({ sequence: 1, command: '{"kind":"begin-turn"}', disposition: 'applied' });
    expect(spin?.facts).toEqual([
      { kind: 'turn-began', turn: 1, wagers: [{ target: 'red', amount: '10' }] },
      { kind: 'outcome-generated', turn: 1, pocket: 27 },
    ]);
    // Every published view is a committed one: the transition that led to it has a receipt.
    for (const snapshot of published) {
      if (snapshot.status !== 'active' || snapshot.view.sequence === 0) continue;
      expect(await store.readReceipt(view.activityId, `${view.activityId}/${snapshot.view.sequence - 1}`)).not.toBeNull();
    }
  });

  it('conditions each commit on the prior sequence: a stale writer adopts what is stored instead', async () => {
    const { controller, adapters } = await started();
    const other = new PracticeController(adapters);
    await other.load();
    await controller.placeWager('red', '10');

    await other.placeWager('black', '20');

    const { view } = active(other.snapshot());
    expect(view.wagers).toEqual([{ target: 'red', amount: '10' }]);
    expect(view.sequence).toBe(1);
  });

  it('carries on the automatic steps of a state adopted from another writer', async () => {
    const { controller, adapters } = await started({ autoClock: false });
    const other = new PracticeController({ ...adapters, clock: new FakeClock(undefined, true) });
    await other.load();
    await controller.placeWager('red', '10');
    void controller.spin();
    await waitFor(() => adapters.clock.pending === 1);

    await other.placeWager('black', '20');

    const { view } = active(other.snapshot());
    expect(view.phase).toBe('settled-outcome');
    expect(view.outcome).toEqual({ turn: 1, pocket: 27 });
    expect(view.balance).toBe('1010');
  });

  it('resumes a spin committed before a crash in its revealing phase and settles the same outcome', async () => {
    const { controller, adapters } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    void controller.spin();
    await waitFor(() => adapters.clock.pending === 1);

    // The app restarts: a new controller over the same durable store.
    const restarted = new PracticeController({ ...adapters, clock: new FakeClock(undefined, true) });
    await restarted.load();

    const { view } = active(restarted.snapshot());
    expect(view.phase).toBe('settled-outcome');
    expect(view.outcome).toEqual({ turn: 1, pocket: 27 });
    expect(view.balance).toBe('1010');
  });

  it('ignores input while a spin is in flight rather than queueing it', async () => {
    const { controller, clock } = await started({ autoClock: false });
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    expect(active(controller.snapshot()).busy).toBe(true);

    await controller.placeWager('black', '10');
    await controller.endSession();

    clock.advance(REVEAL_MS);
    await spinning;
    const { view } = active(controller.snapshot());
    expect(view.phase).toBe('settled-outcome');
    expect(view.sequence).toBe(3);
  });
});

describe('ending', () => {
  it('returns removable wagers, settles automatically and records one result and one sync record', async () => {
    const { controller, store } = await started();
    await controller.placeWager('red', '10');
    await controller.spin(); // 27: red wins, balance 1010
    await controller.placeWager('straight-17', '5');

    await controller.endSession();

    expect(controller.snapshot()).toMatchObject({
      status: 'completed',
      result: { buyIn: '1000', rebuys: [], cumulativeFunding: '1000', finalCashOut: '1010', netResult: '10', game: 'roulette', mode: 'free-play' },
    });
    const outgoing = await store.readOutgoing();
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]?.record.netResult).toBe('10');
    const stop = await store.readReceipt('activity-1', 'activity-1/4');
    expect(stop?.facts).toEqual([
      { kind: 'stop-requested', phase: 'open-decision' },
      { kind: 'wager-returned', target: 'straight-17', amount: '5' },
    ]);

    // Loading again finds nothing unfinished and writes nothing more.
    const again = new PracticeController({ ...substituteAdapters(), store });
    await again.load();
    expect(again.snapshot().status).toBe('none');
    expect(await store.readOutgoing()).toHaveLength(1);
  });

  it('shows the ending steps before the result, with no tap between them', async () => {
    const { controller, clock } = await started({ autoClock: false });
    await controller.placeWager('red', '10');

    const ending = controller.endSession();
    await waitFor(() => clock.pending === 1);
    const settling = active(controller.snapshot());
    expect(settling.view.phase).toBe('final-settlement');
    expect(settling.view.balance).toBe('1000');
    expect(settling.view.legalCommands).toEqual(['advance-final-settlement']);

    clock.advance(ENDING_STEP_MS);
    await ending;
    expect(controller.snapshot().status).toBe('completed');
  });

  it.each(['before', 'after'] as const)('completes exactly once when recording the result fails %s writing', async (when) => {
    const { controller, store } = await started();
    store.failNext('complete', when);

    await controller.endSession();
    await controller.retrySave();

    expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { netResult: '0' } });
    expect(await store.readOutgoing()).toHaveLength(1);
  });

  it('offers setup again once the result is dismissed', async () => {
    const { controller } = await started();
    await controller.endSession();

    controller.dismissResult();

    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: null });
  });
});

describe('craps', () => {
  // Pi stream rolls: 8 (point), 11, 6, 4, 12, 8 (point made).
  async function crapsStarted() {
    const context = setup();
    await context.controller.load();
    await context.controller.start({ game: 'craps', odds: '5x', buyIn: '1000' });
    return context;
  }

  it('starts a standard craps session pinned to the chosen odds cap', async () => {
    const { controller, store } = await crapsStarted();

    const session = active(controller.snapshot());
    expect(session.view).toMatchObject({ game: 'craps', phase: 'open-decision', balance: '1000', table: { odds: '5x', point: null } });
    const stored = await store.load(session.view.activityId);
    expect(stored?.specification).toMatchObject({ game: 'craps', rules: { id: 'standard-craps', version: 1, odds: '5x' } });
  });

  it('rolls one turn and settles it automatically, leaving the contract on the table', async () => {
    const { controller } = await crapsStarted();
    await controller.placeWager('pass', '10');

    await controller.beginTurn();

    const session = active(controller.snapshot());
    expect(session.view).toMatchObject({ phase: 'settled-outcome', turn: 1, outcome: { turn: 1, dice: [5, 3] }, table: { point: 8 } });
    expect(session.view.wagers).toEqual([{ target: 'pass', amount: '10' }]);
  });

  it('ends by returning removable wagers, rolling on one committed step at a time for the contracts, and recording one result', async () => {
    const { controller, store } = await crapsStarted();
    await controller.placeWager('pass', '10');
    await controller.beginTurn();
    await controller.placeWager('pass-odds', '50');

    await controller.endSession();

    expect(controller.snapshot()).toMatchObject({
      status: 'completed',
      result: { game: 'craps', buyIn: '1000', finalCashOut: '1010', netResult: '10', identities: { rules: { id: 'standard-craps', version: 1 } } },
    });
    // Pass, roll, settle, odds, stop, then one final-settlement roll each for 11, 6, 4, 12 and 8.
    expect((await store.load('activity-1'))?.sequence).toBe(10);
    expect(await store.readOutgoing()).toHaveLength(1);
  });
});

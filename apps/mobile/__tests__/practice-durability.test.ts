// Seam 2, durability: "saved before shown" under failure injection, with the
// practice controller on substitute adapters. A restart is a new controller
// over a reopened in-memory store (same durable data, nothing in flight).
// Spin outcomes come from the Random123 "pi digits" stream: 27 (red), then 0.

import { createActivity, encodeCheckpoint, readPermittedView, decodeCheckpoint, type DomainFact } from '@tableside/engine';
import { SINGLE_ZERO_ROULETTE } from '@tableside/definitions';

import { PracticeController, REVEAL_MS, SAVE_RETRY_MS, type PracticeSnapshot } from '@/practice/controller';
import type { ActivityStore } from '@/practice/store';
import type { AccessSupervisor } from '@/practice/adapters';
import { FakeClock, PI_WORDS, substituteAdapters } from '@/practice/testing/substitutes';

type Adapters = ReturnType<typeof setup>['adapters'];

/** A supervisor that charges one turn of allowance for every turn, as spec 5's turn metering will. */
const chargingAccess: AccessSupervisor = {
  beforeActivity: async () => ({ status: 'allowed', provenance: 'test' }),
  beforeTurn: async () => ({ status: 'allowed', provenance: 'test', turnCharge: { grant: 'grant-1', amount: '1' } }),
};

function setup(clock = new FakeClock(undefined, true)) {
  const adapters = { ...substituteAdapters({ clock }), access: chargingAccess };
  const controller = new PracticeController(adapters);
  return { adapters, store: adapters.store, clock, controller };
}

/** The app restarts: a new controller over the same durable data. */
function restarted(adapters: Adapters, clock = new FakeClock(undefined, true)) {
  const store = adapters.store.reopen();
  return { controller: new PracticeController({ ...adapters, store, clock }), store };
}

/** Restarts and waits for the launch to finish resuming. */
async function restart(adapters: Adapters) {
  const next = restarted(adapters);
  await next.controller.load();
  return next;
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return snapshot;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

/** Every fact the store committed for an activity, in sequence order. */
async function committedFacts(store: ActivityStore, activityId: string): Promise<DomainFact[]> {
  const stored = await store.load(activityId);
  const facts: DomainFact[] = [];
  for (let sequence = 0; sequence < (stored?.sequence ?? 0); sequence++) {
    const transition = await store.readReceipt(activityId, `${activityId}/${sequence}`);
    if (!transition) throw new Error(`no receipt at sequence ${sequence}`);
    facts.push(...transition.facts);
  }
  return facts;
}

const settlements = (facts: DomainFact[]) => facts.filter((fact) => fact.kind === 'wager-settled');

// Red 10 on 27 (red) wins 10.
const TURN_1_CHARGE = { effectId: { grant: 'grant-1', activity: 'activity-1', sequence: 1 }, kind: 'turn-charge', amount: '1' };
const RED_WINS = { kind: 'wager-settled', turn: 1, target: 'red', stake: '10', result: 'win', net: '10', returned: '20' };

describe('a command delivered twice', () => {
  it('takes effect once, charges once, and the controller shows the committed result', async () => {
    const { adapters, store } = setup();
    // A store link that delivers every commit twice, answering with the second delivery.
    const twice: ActivityStore = new Proxy(store, {
      get(target, property, receiver) {
        if (property === 'commitTransition') {
          return async (commit: Parameters<ActivityStore['commitTransition']>[0]) => {
            await target.commitTransition(commit);
            return target.commitTransition(commit);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const controller = new PracticeController({ ...adapters, store: twice });
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');

    await controller.spin();

    const { view, facts, save } = active(controller.snapshot());
    expect(save).toBe('saved');
    expect(view).toMatchObject({ phase: 'settled-outcome', sequence: 3, balance: '1010', outcome: { turn: 1, pocket: 27 } });
    expect(facts).toEqual([RED_WINS]);
    expect(settlements(await committedFacts(store, 'activity-1'))).toEqual([RED_WINS]);
    expect(await store.readEffects('activity-1')).toEqual([TURN_1_CHARGE]);
  });
});

describe('a save failure', () => {
  it('pauses play, retries automatically, and reveals only what was saved', async () => {
    const { controller, store, clock } = setup(new FakeClock(undefined, false));
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    const shown: PracticeSnapshot[] = [];
    controller.subscribe(() => shown.push(controller.snapshot()));
    store.failNext('commitTransition', 'before');

    await controller.spin();

    expect(active(controller.snapshot())).toMatchObject({ save: 'failed', view: { phase: 'open-decision', outcome: null } });
    await waitFor(() => clock.pending === 1);

    clock.advance(SAVE_RETRY_MS);
    await waitFor(() => active(controller.snapshot()).view.phase === 'revealing-outcome');
    expect(active(controller.snapshot()).save).toBe('saved');
    expect(shown.filter((snapshot) => snapshot.status === 'active' && snapshot.save === 'failed').every((snapshot) => active(snapshot).view.outcome === null)).toBe(true);
  });

  it('keeps play paused while the disk stays full, then carries on once a retry saves', async () => {
    const { controller, store, clock } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    let attempts = 0;
    const commit = store.commitTransition.bind(store);
    store.commitTransition = (transition) => (attempts++, commit(transition));
    store.setFull(true);

    await controller.spin();
    expect(attempts).toBe(1);
    for (let retry = 1; retry <= 3; retry++) {
      await waitFor(() => clock.pending === 1);
      clock.advance(SAVE_RETRY_MS - 1);
      expect(attempts).toBe(retry);
      clock.advance(1);
      await waitFor(() => attempts === retry + 1 && clock.pending === 1);
      expect(active(controller.snapshot())).toMatchObject({ save: 'failed', view: { phase: 'open-decision', outcome: null } });
    }
    // Input waits too: nothing is accepted while the last move isn't saved.
    await controller.placeWager('black', '20');
    expect(active(controller.snapshot()).view.wagers).toEqual([{ target: 'red', amount: '10' }]);

    store.setFull(false);
    await controller.retrySave();
    expect(active(controller.snapshot())).toMatchObject({ save: 'saved', view: { phase: 'settled-outcome', outcome: { turn: 1, pocket: 27 }, balance: '1010' } });
  });

  it('draws the same spin after a restart when the disk was full before the spin committed', async () => {
    const { controller, adapters, store } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    store.setFull(true);
    await controller.spin();

    const restarted = await restart(adapters);
    expect(active(restarted.controller.snapshot()).view).toMatchObject({ phase: 'open-decision', wagers: [{ target: 'red', amount: '10' }] });
    await restarted.controller.spin();

    expect(active(restarted.controller.snapshot()).view).toMatchObject({ outcome: { turn: 1, pocket: 27 }, balance: '1010' });
  });
});

describe('failure injection before and after each commit and acknowledgement', () => {
  // The script: place red 10 (commit 1), spin (2), settle (3), end session (4),
  // final settlement (5), then complete. A failure before writing pauses at its
  // commit and the remaining script steps are ignored while paused; a lost
  // acknowledgement is resolved from the receipt and the script carries on.
  // Recovery is then a retry or a restart, and the session is ended if it is
  // still open. Each case must show one settlement effect for the spin if it
  // happened, and one final result.
  const cases = [1, 2, 3, 4, 5].flatMap((commit) =>
    (['before', 'after', 'after-unread'] as const).flatMap((when) => (['retry', 'restart'] as const).map((recovery) => ({ commit, when, recovery }))),
  );

  it.each(cases)('commit $commit fails $when writing, recovered by $recovery', async ({ commit, when, recovery }) => {
    const { controller, adapters, store } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    let commits = 0;
    const original = store.commitTransition.bind(store);
    store.commitTransition = (transition) => {
      if (++commits === commit) {
        store.failNext('commitTransition', when === 'before' ? 'before' : 'after');
        // The acknowledgement is lost and so is the receipt read: whether it committed is unknown.
        if (when === 'after-unread') store.failNext('readReceipt', 'before');
      }
      return original(transition);
    };

    await controller.placeWager('red', '10');
    await controller.spin();
    await controller.endSession();

    let recovered = controller;
    let durable: ActivityStore = store;
    if (recovery === 'retry') {
      await controller.retrySave();
    } else {
      ({ controller: recovered, store: durable } = await restart(adapters));
    }
    if (recovered.snapshot().status === 'active') await recovered.endSession();

    // The spin happened unless play paused before it (at place-wager), or its
    // commit never reached the store and the app restarted.
    const spun = when === 'after' || commit > 2 || (commit === 2 && (when === 'after-unread' || recovery === 'retry'));
    const outgoing = await durable.readOutgoing();
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]?.record).toMatchObject({ netResult: spun ? '10' : '0', finalCashOut: spun ? '1010' : '1000' });
    expect(settlements(await committedFacts(durable, 'activity-1'))).toEqual(spun ? [RED_WINS] : []);
    expect(await durable.readEffects('activity-1')).toEqual(spun ? [TURN_1_CHARGE] : []);
    expect(await durable.findUnfinished()).toBeNull();
  });

  it.each([
    ['before', 'retry'],
    ['before', 'restart'],
    ['after', 'retry'],
    ['after', 'restart'],
  ] as const)('recording the result fails %s writing, recovered by %s: one final result', async (when, recovery) => {
    const { controller, adapters, store } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    await controller.spin();
    store.failNext('complete', when);

    await controller.endSession();
    // A lost acknowledgement is resolved by reading the result back; a failed write pauses.
    expect(controller.snapshot().status === 'completed').toBe(when === 'after');
    let durable: ActivityStore = store;
    if (recovery === 'retry') {
      await controller.retrySave();
      expect(controller.snapshot()).toMatchObject({ status: 'completed', result: { netResult: '10' } });
    } else {
      const restarted = await restart(adapters);
      durable = restarted.store;
      // A completed session isn't resumed; one that wasn't recorded yet completes on launch.
      expect(restarted.controller.snapshot().status).toBe(when === 'after' ? 'none' : 'completed');
    }

    expect(await durable.readOutgoing()).toEqual([expect.objectContaining({ record: expect.objectContaining({ netResult: '10' }) })]);
  });
});

describe('restarts', () => {
  it('resumes a spin whose acknowledgement was lost in its committed reveal, and settles and charges it once', async () => {
    const { controller, adapters } = setup(new FakeClock(undefined, false));
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    adapters.store.failNext('commitTransition', 'after');
    adapters.store.failNext('readReceipt', 'before');
    await controller.spin();
    expect(active(controller.snapshot()).view.outcome).toBeNull();

    // The reveal animation never ran; the committed reveal is what resumes.
    const clock = new FakeClock(undefined, false);
    const { controller: relaunched, store } = restarted(adapters, clock);
    const launching = relaunched.load();
    await waitFor(() => relaunched.snapshot().status === 'active' && clock.pending === 1);
    expect(active(relaunched.snapshot()).view).toMatchObject({ phase: 'revealing-outcome', outcome: { turn: 1, pocket: 27 }, balance: '990' });

    clock.advance(REVEAL_MS);
    await launching;
    expect(active(relaunched.snapshot()).view).toMatchObject({ phase: 'settled-outcome', balance: '1010' });
    expect(settlements(await committedFacts(store, 'activity-1'))).toEqual([RED_WINS]);
    expect(await store.readEffects('activity-1')).toEqual([TURN_1_CHARGE]);
  });

  it('resumes during final settlement and finishes with one final result', async () => {
    const { controller, adapters, clock } = setup(new FakeClock(undefined, false));
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    const spinning = controller.spin();
    await waitFor(() => clock.pending === 1);
    clock.advance(REVEAL_MS);
    await spinning;
    void controller.endSession();
    await waitFor(() => clock.pending === 1 && active(controller.snapshot()).view.phase === 'final-settlement');

    const { controller: restarted, store } = await restart(adapters);

    expect(restarted.snapshot()).toMatchObject({ status: 'completed', result: { finalCashOut: '1010', netResult: '10' } });
    expect(await store.readOutgoing()).toHaveLength(1);
    expect(settlements(await committedFacts(store, 'activity-1'))).toEqual([RED_WINS]);
  });

  it('resumes after a payout, before the next wager, without paying again', async () => {
    const { controller, adapters } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    await controller.spin();

    const { controller: restarted, store } = await restart(adapters);

    expect(active(restarted.snapshot()).view).toMatchObject({ phase: 'settled-outcome', balance: '1010', wagers: [] });
    await restarted.placeWager('red', '10');
    await restarted.spin(); // 0: red loses
    expect(active(restarted.snapshot()).view.balance).toBe('1000');
    expect(settlements(await committedFacts(store, 'activity-1'))).toEqual([
      RED_WINS,
      { kind: 'wager-settled', turn: 2, target: 'red', stake: '10', result: 'loss', net: '-10', returned: '0' },
    ]);
  });

  it('publishes nothing that is not already durable, so no lifecycle event is needed to save', async () => {
    const { controller, store } = setup();
    const checks: Promise<void>[] = [];
    controller.subscribe(() => {
      const snapshot = controller.snapshot();
      if (snapshot.status !== 'active') return;
      // Queued behind every write issued before this publish, and ahead of every later one.
      checks.push(
        store.load(snapshot.view.activityId).then((stored) => {
          const decoded = stored && decodeCheckpoint(stored.checkpoint);
          if (!decoded?.ok) throw new Error('nothing durable behind a published view');
          expect(readPermittedView(decoded.state)).toEqual(snapshot.view);
        }),
      );
    });
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000' });
    await controller.placeWager('red', '10');
    await controller.spin();
    await controller.placeWager('straight-17', '5');
    await controller.endSession();

    expect(checks.length).toBeGreaterThan(5);
    await Promise.all(checks);
  });
});

describe('snapshots', () => {
  it('pin the rule content the session started with, not the current definitions', async () => {
    const { adapters } = setup();
    // A session saved under rules whose outside minimum was 50, unlike today's 10.
    const rules = { ...SINGLE_ZERO_ROULETTE, limits: { ...SINGLE_ZERO_ROULETTE.limits, outside: { min: '50', max: '1000' } } };
    const random = { protocol: 1, key: [PI_WORDS[0], PI_WORDS[1]], session: [PI_WORDS[2], PI_WORDS[3]] } as const;
    const specification = { activityId: 'old', owner: 'local', device: 'test-device', game: 'roulette', rules, strategy: null, reference: null, funding: '1000' } as const;
    const initial = createActivity(specification, random);
    await adapters.store.createActivity({ activityId: 'old', specification, random, checkpoint: encodeCheckpoint(initial), createdAt: 0 });
    expect(JSON.parse(encodeCheckpoint(initial)).rules.limits.outside).toEqual({ min: '50', max: '1000' });

    const { controller } = await restart(adapters);
    await controller.placeWager('red', '10');

    const { view, facts } = active(controller.snapshot());
    expect(view.wagers).toEqual([]);
    expect(facts).toEqual([{ kind: 'illegal-action', command: { kind: 'place-wager', target: 'red', amount: '10' }, reason: 'below-minimum' }]);
  });
});

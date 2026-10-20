// Seam 2: guided practice through the practice controller on substitute
// adapters, including failure injection around a correction. A restart is a
// new controller over a reopened in-memory store. Spins come from the
// Random123 "pi digits" stream: 27 (red), 0, 25 (red).

import { FIXED_TWO_DOZENS, FLAT_EVEN_MONEY } from '@tableside/definitions';
import type { DomainFact } from '@tableside/engine';

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { PracticeController, type PracticeSnapshot } from '@/practice/controller';
import type { ActivityStore } from '@/practice/store';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const turnsAsked: number[] = [];
/** Charges one turn of allowance per turn, as spec 5's turn metering will, and notes each ask. */
const chargingAccess: AccessSupervisor = {
  ...alwaysAllowed,
  beforeTurn: async ({ turn }) => {
    turnsAsked.push(turn);
    return { status: 'allowed', provenance: 'test', turnCharge: { grant: 'grant-1', amount: '1' } };
  },
};

function setup() {
  turnsAsked.length = 0;
  const adapters = { ...substituteAdapters({ clock: new FakeClock(undefined, true) }), access: chargingAccess };
  return { adapters, store: adapters.store, controller: new PracticeController(adapters) };
}

const RED = { definition: FLAT_EVEN_MONEY, parameters: { target: 'red' } };

async function guided(strategy = RED) {
  const context = setup();
  await context.controller.load();
  await context.controller.start({ game: 'roulette', buyIn: '1000', strategy });
  return context;
}

function active(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'active') throw new Error(`expected an active session, got ${snapshot.status}`);
  return snapshot;
}

async function restart(adapters: ReturnType<typeof setup>['adapters']) {
  const store = adapters.store.reopen();
  const controller = new PracticeController({ ...adapters, store, clock: new FakeClock(undefined, true) });
  await controller.load();
  // An interrupted session resumes in its committed phase.
  await controller.resume();
  return { controller, store };
}

async function committedFacts(store: ActivityStore, activityId: string): Promise<DomainFact[]> {
  const stored = await store.load(activityId);
  const facts: DomainFact[] = [];
  for (let sequence = 0; sequence < (stored?.sequence ?? 0); sequence++) {
    facts.push(...((await store.readReceipt(activityId, `${activityId}/${sequence}`))?.facts ?? []));
  }
  return facts;
}

const departuresIn = (facts: DomainFact[]) => facts.filter((fact) => fact.kind === 'departure-recorded');

describe('guided practice', () => {
  it('starts pinned to the chosen strategy revision and its target', async () => {
    const { controller } = await guided({ definition: FLAT_EVEN_MONEY, parameters: { target: 'black' } });
    const strategy = active(controller.snapshot()).view.strategy;
    expect([strategy?.id, strategy?.revision, strategy?.parameters]).toEqual([
      'builtin-roulette-flat-even-money',
      1,
      [{ id: 'target', label: 'Target', value: 'black' }],
    ]);
  });

  it('refuses a strategy that does not fit the table, and stores nothing', async () => {
    const { controller, store } = setup();
    await controller.load();
    await controller.start({ game: 'roulette', buyIn: '1000', strategy: { definition: FIXED_TWO_DOZENS, parameters: { first: 'dozen-1', second: 'dozen-1' } } });
    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: 'strategy-incompatible' });
    expect(await store.findUnfinished()).toBeNull();
  });

  it('spins a bet that follows the strategy as usual, settling it automatically', async () => {
    const { controller } = await guided();
    await controller.placeWager('red', '10');
    await controller.spin();
    const snapshot = active(controller.snapshot());
    expect([snapshot.view.phase, snapshot.view.balance]).toEqual(['settled-outcome', '1010']);
    expect(snapshot.view.strategy?.adherence).toEqual({ decisions: 1, followed: 1, departures: 0 });
  });

  it('pauses a departing spin before it executes, without asking for or charging a turn', async () => {
    const { controller, store } = await guided();
    await controller.placeWager('red', '50');
    await controller.spin();
    const snapshot = active(controller.snapshot());
    expect(snapshot.view.phase).toBe('correction');
    expect(snapshot.view.outcome).toBeNull();
    expect(snapshot.facts.map((fact) => fact.kind)).toEqual(['correction-offered']);
    expect(turnsAsked).toEqual([]);
    expect(await store.readEffects('activity-1')).toEqual([]);
  });

  it('records a retried departure once, even when the tap is sent twice', async () => {
    const { controller, store } = await guided();
    await controller.placeWager('red', '50');
    await controller.spin();
    await Promise.all([controller.retryCorrection(), controller.retryCorrection()]);
    await controller.retryCorrection();
    const snapshot = active(controller.snapshot());
    expect([snapshot.view.phase, snapshot.view.wagers, snapshot.view.balance]).toEqual(['open-decision', [{ target: 'red', amount: '10' }], '990']);
    expect(departuresIn(await committedFacts(store, 'activity-1'))).toHaveLength(1);
    expect(snapshot.view.strategy?.departures.map((d) => [d.id, d.resolution])).toEqual([['activity-1/departure/1', 'retried']]);
  });

  it('overrides into the player\'s spin, asking for and charging that turn once, and coaching goes on', async () => {
    const { controller, store } = await guided();
    await controller.placeWager('red', '50');
    await controller.spin();
    await controller.overrideCorrection();
    const snapshot = active(controller.snapshot());
    expect([snapshot.view.phase, snapshot.view.balance, snapshot.view.strategy?.status, snapshot.view.strategy?.overrideAffected]).toEqual([
      'settled-outcome',
      '1050',
      'active',
      true,
    ]);
    expect(turnsAsked).toEqual([1]);
    expect(await store.readEffects('activity-1')).toEqual([{ effectId: { grant: 'grant-1', activity: 'activity-1', sequence: 2 }, kind: 'turn-charge', amount: '1' }]);
  });

  it('stops the strategy without ending the session: removable wagers come back and play goes on uncoached', async () => {
    const { controller } = await guided();
    await controller.placeWager('red', '50');
    await controller.stopStrategy();
    let snapshot = active(controller.snapshot());
    expect([snapshot.view.phase, snapshot.view.balance, snapshot.view.wagers, snapshot.view.strategy?.status]).toEqual(['open-decision', '1000', [], 'stopped']);
    await controller.placeWager('red', '50');
    await controller.spin();
    snapshot = active(controller.snapshot());
    expect([snapshot.view.phase, snapshot.view.balance]).toEqual(['settled-outcome', '1050']);
  });

  it('records the departure log and adherence with the completed session, apart from the money', async () => {
    const { controller } = await guided();
    await controller.placeWager('red', '50');
    await controller.spin();
    await controller.retryCorrection();
    await controller.spin();
    await controller.endSession();
    const snapshot = controller.snapshot();
    if (snapshot.status !== 'completed') throw new Error(snapshot.status);
    expect(snapshot.result.mode).toBe('guided');
    expect(snapshot.result.netResult).toBe('10');
    expect(snapshot.result.guidance).toMatchObject({
      adherence: { decisions: 1, followed: 0, departures: 1 },
      overrideAffected: false,
      departures: [{ id: 'activity-1/departure/1', turn: 1, resolution: 'retried', actual: [{ target: 'red', amount: '50' }] }],
    });
  });
});

describe('failure injection: restart during a correction', () => {
  it('resumes the committed correction after a restart, and the departure is recorded once', async () => {
    const { adapters, controller: first } = await guided();
    await first.placeWager('red', '50');
    await first.spin();
    // The app dies with the correction on screen.
    const { controller, store } = await restart(adapters);
    const snapshot = active(controller.snapshot());
    expect([snapshot.view.phase, snapshot.view.strategy?.correction?.id]).toEqual(['correction', 'activity-1/departure/1']);
    await controller.retryCorrection();
    expect(active(controller.snapshot()).view.phase).toBe('open-decision');
    expect(departuresIn(await committedFacts(store, 'activity-1'))).toHaveLength(1);
  });

  it('a retry whose commit failed before the crash is still a correction after restart, then records once', async () => {
    const { adapters, controller } = await guided();
    await controller.placeWager('red', '50');
    await controller.spin();
    const commit = adapters.store.commitTransition.bind(adapters.store);
    adapters.store.commitTransition = async () => {
      throw new Error('disk full');
    };
    await controller.retryCorrection();
    expect(active(controller.snapshot()).save).toBe('failed');
    adapters.store.commitTransition = commit;
    const { controller: resumed, store } = await restart(adapters);
    expect(active(resumed.snapshot()).view.phase).toBe('correction');
    await resumed.overrideCorrection();
    const facts = await committedFacts(store, 'activity-1');
    expect(departuresIn(facts).map((fact) => fact.kind === 'departure-recorded' && fact.departure.resolution)).toEqual(['overridden']);
  });

  it('an override whose acknowledgement was lost recovers from the receipt: one departure, one spin, one charge', async () => {
    const { adapters, controller, store } = await guided();
    await controller.placeWager('red', '50');
    await controller.spin();
    const commit = adapters.store.commitTransition.bind(adapters.store);
    adapters.store.commitTransition = async (transition) => {
      await commit(transition);
      throw new Error('acknowledgement lost');
    };
    await controller.overrideCorrection();
    adapters.store.commitTransition = commit;
    await controller.retrySave();
    const facts = await committedFacts(store, 'activity-1');
    expect(departuresIn(facts)).toHaveLength(1);
    expect(facts.filter((fact) => fact.kind === 'turn-began')).toHaveLength(1);
    expect(await store.readEffects('activity-1')).toHaveLength(1);
  });
});

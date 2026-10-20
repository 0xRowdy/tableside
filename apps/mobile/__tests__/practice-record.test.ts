// Seam 2: the completed practice session record as the practice controller
// writes it (durability step 5), with substitute adapters, and the post-result
// hook that spec 5's ads use (Amendment 4 §D: only when leaving a result just
// produced, after its record is durably saved). Spin outcomes come from the
// Random123 "pi digits" stream: 27 (red), 0, 25, 31, 9.

import { alwaysAllowed, type AccessSupervisor } from '@/practice/adapters';
import { PracticeController, type PracticeSnapshot } from '@/practice/controller';
import type { CompletedPracticeSession } from '@/practice/store';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const START = 1_790_000_000_000;

interface Options {
  access?: AccessSupervisor;
  clock?: FakeClock;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

function setup(options: Options = {}) {
  const left: CompletedPracticeSession[] = [];
  const adapters = {
    ...substituteAdapters({ clock: options.clock ?? new FakeClock(START, true) }),
    ...(options.access ? { access: options.access } : {}),
    leftFreshResult: (record: CompletedPracticeSession) => left.push(record),
  };
  const controller = new PracticeController(adapters);
  return { adapters, store: adapters.store, clock: adapters.clock, controller, left };
}

async function started(options: Options = {}) {
  const context = setup(options);
  await context.controller.load();
  await context.controller.start({ game: 'roulette', buyIn: '1000' });
  return context;
}

function completed(snapshot: PracticeSnapshot) {
  if (snapshot.status !== 'completed') throw new Error(`expected a completed session, got ${snapshot.status}`);
  return snapshot.result;
}

describe('the completed practice session record', () => {
  it('records every outcome with its turn, the times, the rules and limits, turns played and the ending reason, and syncs that same record', async () => {
    const { controller, store } = await started();
    await controller.placeWager('red', '10');
    await controller.placeWager('black', '10');
    await controller.spin(); // 27, red: red wins 10, black loses 10
    await controller.placeWager('red', '10');
    await controller.spin(); // 0: red loses 10
    await controller.endSession();

    const record = completed(controller.snapshot());
    expect(record).toMatchObject({
      activityId: 'activity-1',
      owner: 'local',
      device: 'test-device',
      game: 'roulette',
      startedAt: START,
      mode: 'free-play',
      rules: { id: 'roulette-single-zero', version: 1, content: { wheel: 'single-zero', limits: { inside: { min: '1', max: '100' } } } },
      meteringBasis: 'free-play',
      allowancePolicyVersion: null,
      finalCashOut: '990',
      netResult: '-10',
      turnsPlayed: 2,
      endingReason: 'stop',
      wagers: { wins: 1, losses: 2, pushes: 0, resolved: 3 },
      noBet: false,
      outcomes: [
        { turn: 1, target: 'red', result: 'win', net: '10' },
        { turn: 1, target: 'black', result: 'loss', net: '-10' },
        { turn: 2, target: 'red', result: 'loss', net: '-10' },
      ],
    });
    // Ended after the paced automatic steps, on the controller's clock.
    expect(record.endedAt).toBeGreaterThan(record.startedAt);
    expect(await store.readOutgoing()).toEqual([{ id: 'completed/activity-1', kind: 'completed-practice-session', record }]);
  });

  it('records a reset or a switch of game as the ending reason', async () => {
    const reset = await started();
    await reset.controller.endSession('reset');
    expect(completed(reset.controller.snapshot()).endingReason).toBe('reset');
    const switched = await started();
    await switched.controller.endSession('switch');
    expect(completed(switched.controller.snapshot())).toMatchObject({ endingReason: 'switch', noBet: true, turnsPlayed: 0 });
  });

  it('records an access-ended stop, and the metering basis and allowance-policy version from the admission', async () => {
    const access: AccessSupervisor = {
      ...alwaysAllowed,
      beforeActivity: async () => ({ status: 'allowed', provenance: 'test', meteringBasis: 'turns', allowancePolicyVersion: 'turns-policy-2' }),
      beforeTurn: async () => ({ status: 'denied', provenance: 'test', disposition: 'stop' }),
    };
    const { controller } = await started({ access });
    await controller.placeWager('red', '10');
    await controller.spin();
    expect(completed(controller.snapshot())).toMatchObject({
      endingReason: 'access-ended',
      meteringBasis: 'turns',
      allowancePolicyVersion: 'turns-policy-2',
      outcomes: [{ turn: 0, target: 'red', result: 'returned' }],
    });
  });

  it('keeps the ending reason across a restart during final settlement', async () => {
    const first = await started({ clock: new FakeClock(START, false) });
    await first.controller.placeWager('red', '10');
    // The stop path has started (the switch is committed); the app dies before final settlement finishes.
    void first.controller.endSession('switch');
    await waitFor(() => first.clock.pending === 1);
    const reopened = new PracticeController({ ...first.adapters, clock: new FakeClock(START, true), store: first.store.reopen() });
    await reopened.load();
    await reopened.resume();
    expect(completed(reopened.snapshot())).toMatchObject({ endingReason: 'switch', outcomes: [{ turn: 0, target: 'red', result: 'returned' }] });
  });

  it('waits to complete while the committed transitions can\'t be read, then completes with the full record', async () => {
    const { controller, store, clock } = await started();
    await controller.placeWager('red', '10');
    await controller.spin();
    store.failNext('readTransitions', 'before');
    await controller.endSession();
    expect(controller.snapshot()).toMatchObject({ status: 'active', save: 'failed' });
    expect(await store.readOutgoing()).toEqual([]);
    await controller.retrySave();
    expect(completed(controller.snapshot()).outcomes).toEqual([{ turn: 1, target: 'red', stake: '10', result: 'win', net: '10', returned: '20' }]);
    expect(clock.now()).toBeGreaterThan(START);
  });
});

describe('the post-result hook', () => {
  it('fires once, with the durably saved record, when the player leaves a result just produced', async () => {
    const { controller, store, left } = await started();
    await controller.endSession();
    expect(left).toEqual([]);
    const record = completed(controller.snapshot());
    controller.dismissResult();
    expect(left).toEqual([record]);
    expect((await store.load('activity-1'))?.completion).toEqual(record);
    controller.dismissResult();
    expect(left).toHaveLength(1);
  });

  it('never fires while the result is still unsaved', async () => {
    const { controller, store, left } = await started();
    store.failNext('complete', 'before');
    await controller.endSession();
    expect(controller.snapshot().status).toBe('active');
    controller.dismissResult();
    expect(left).toEqual([]);
  });
});

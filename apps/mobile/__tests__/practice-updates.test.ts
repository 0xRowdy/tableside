// Seam 2, updates and quarantine (#80): the practice controller on substitute
// adapters, over a store holding what an earlier build left behind. Recorded
// checkpoints come from the engine's recordings of earlier builds; a "later
// build" checkpoint is a recorded one with a newer schema, as a rollback finds it.

import type { QuarantineList } from '@tableside/engine';
import { RECORDED_BUILDS } from '@tableside/engine/recorded-checkpoints';

import { PracticeController, type PracticeSnapshot } from '@/practice/controller';
import type { StoredActivity } from '@/practice/store';
import { FakeClock, fromLaterBuild, leftBy, storeHolding, substituteAdapters } from '@/practice/testing/substitutes';

function setup(stored: StoredActivity, quarantine?: QuarantineList) {
  const store = storeHolding(stored);
  const adapters = { ...substituteAdapters({ clock: new FakeClock(undefined, true) }), store, ...(quarantine ? { quarantine } : {}) };
  return { store, controller: new PracticeController(adapters) };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

const status = (snapshot: PracticeSnapshot) => snapshot.status;

const recordedCheckpoints = RECORDED_BUILDS.flatMap((build) => build.checkpoints.map((recorded) => [`${build.engine}: ${recorded.name}`, recorded] as const));

const CRAPS = RECORDED_BUILDS[0]!.checkpoints.find((recorded) => recorded.game === 'craps')!;

describe('an update', () => {
  it.each(recordedCheckpoints)('resumes the unfinished session an earlier build left (%s), skipped versions included, and ends with the recorded result', async (_, recorded) => {
    const { controller } = setup(leftBy(recorded));
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ status: 'active', suspension: { cause: 'interrupted' } });

    await controller.resume();
    // A blackjack round under way finishes first; ending stops the session between turns.
    if (recorded.game === 'blackjack') await controller.play('stand');
    await controller.endSession();
    await waitFor(() => status(controller.snapshot()) === 'completed');

    const snapshot = controller.snapshot();
    if (snapshot.status !== 'completed') throw new Error('not completed');
    expect(snapshot.result.finalCashOut).toBe(recorded.finalBalance);
    expect(snapshot.result.identities.engine).toBe(JSON.parse(recorded.checkpoint).identities.engine);
  });
});

describe('a rollback', () => {
  it('never reopens a session a later build saved, and leaves it untouched for when the app is updated again', async () => {
    const stored = leftBy(CRAPS, fromLaterBuild(CRAPS));
    const { store, controller } = setup(stored);

    await controller.load();
    expect(controller.snapshot()).toEqual({ status: 'needs-update', game: 'craps' });
    // Starting another session finds the same one, and still doesn't reopen it.
    await controller.start({ game: 'roulette', buyIn: '1000' });
    expect(controller.snapshot()).toEqual({ status: 'needs-update', game: 'craps' });

    expect(await store.load(stored.activityId)).toEqual(stored);
    expect(await store.findUnfinished()).toEqual(stored);
    expect(await store.readTransitions(stored.activityId)).toEqual([]);
  });
});

describe('the quarantine list', () => {
  const recorded = CRAPS;
  const identities = JSON.parse(recorded.checkpoint).identities;
  const list: QuarantineList = {
    version: 2,
    entries: [{ id: 'q-craps-1', match: { engine: identities.engine, rules: identities.rules }, explanation: 'A craps settlement defect in this engine.' }],
  };

  it('marks an affected unfinished session incomplete with the explanation, instead of resuming it or inventing a result', async () => {
    const stored = leftBy(recorded);
    const { store, controller } = setup(stored, list);

    await controller.load();

    expect(controller.snapshot()).toEqual({
      status: 'incomplete',
      session: {
        game: 'craps',
        buyIn: '1000',
        turnsRecorded: 1,
        engine: identities.engine,
        reason: { kind: 'quarantined', entry: 'q-craps-1', listVersion: 2 },
        explanation: 'A craps settlement defect in this engine.',
      },
    });
    const marked = await store.load(stored.activityId);
    expect([marked?.incomplete?.kind, marked?.completion, marked?.checkpoint]).toEqual(['quarantined', null, stored.checkpoint]);
    expect(await store.readTransitions(stored.activityId)).toEqual([]);
    expect(await store.readOutgoing()).toEqual([]);
  });

  it('leaves a session the list does not name to resume as usual', async () => {
    const other = RECORDED_BUILDS[0]!.checkpoints.find((checkpoint) => checkpoint.game === 'roulette')!;
    const { controller } = setup(leftBy(other), list);
    await controller.load();
    expect(controller.snapshot()).toMatchObject({ status: 'active' });
  });

  it('after the explanation, a new session can start', async () => {
    const { store, controller } = setup(leftBy(recorded), list);
    await controller.load();

    controller.dismissIncomplete();
    expect(controller.snapshot()).toMatchObject({ status: 'none', problem: null });
    await controller.start({ game: 'roulette', buyIn: '500' });

    expect(controller.snapshot()).toMatchObject({ status: 'active', view: { game: 'roulette', balance: '500' } });
    expect((await store.findUnfinished())?.activityId).not.toBe(leftBy(recorded).activityId);
  });

  it('is applied to a session found when starting another, too', async () => {
    const { controller } = setup(leftBy(recorded), list);
    await controller.start({ game: 'roulette', buyIn: '1000' });
    expect(controller.snapshot()).toMatchObject({ status: 'incomplete', session: { reason: { kind: 'quarantined' } } });
  });
});

describe('a damaged checkpoint', () => {
  it('marks the session incomplete rather than inventing an outcome', async () => {
    const stored = leftBy(CRAPS, CRAPS.checkpoint.replace('"balance":"', '"balance":"-'));
    const { store, controller } = setup(stored);

    await controller.load();

    expect(controller.snapshot()).toMatchObject({
      status: 'incomplete',
      session: { game: 'craps', buyIn: '1000', turnsRecorded: null, engine: null, reason: { kind: 'damaged' }, explanation: null },
    });
    expect((await store.load(stored.activityId))?.incomplete).toMatchObject({ kind: 'damaged' });
    expect(await store.readOutgoing()).toEqual([]);
  });
});

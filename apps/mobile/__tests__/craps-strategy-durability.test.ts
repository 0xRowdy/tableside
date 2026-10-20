// Seam 2, failure injection for a craps strategy adjustment (spec #51,
// Strategy execution semantics): settlement and the next adjustment are
// separate transitions. Capped press-and-collect at a 20 place maximum on the
// all-zero stream (totals 8 8 9 6 11 5 3 5 2 6): the 10th roll's place 6 win
// pays 14 and its press to 24 is blocked. A crash around that settlement's
// commit, then a restart, pays the win exactly once and keeps the press waiting.

import { PRESS_AND_COLLECT_6_8 } from '@tableside/definitions';
import type { CrapsPermittedView, DomainFact } from '@tableside/engine';

import { PracticeController, type PracticeSnapshot } from '@/practice/controller';
import type { ActivityStore } from '@/practice/store';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

const LIMITS = { flat: { min: '10', max: '20' }, props: { min: '1', max: '100' } };

function view(snapshot: PracticeSnapshot): CrapsPermittedView {
  if (snapshot.status !== 'active' || snapshot.view.game !== 'craps') throw new Error(`expected an active craps session, got ${snapshot.status}`);
  return snapshot.view;
}

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

const placeSixWins = (facts: DomainFact[]) => facts.filter((fact) => fact.kind === 'wager-settled' && fact.target === 'place-6' && fact.result === 'win');

/** Plays the strategy up to the 10th roll, whose settlement commit fails as told. */
async function toBlockedPress(when: 'before' | 'after') {
  const adapters = substituteAdapters({ clock: new FakeClock(undefined, true), words: [0, 0, 0, 0] });
  const controller = new PracticeController(adapters);
  await controller.load();
  await controller.start({ game: 'craps', odds: '3-4-5x', limits: LIMITS, buyIn: '1000', strategy: { definition: PRESS_AND_COLLECT_6_8, parameters: {} } });
  const { store } = adapters;
  const commit = store.commitTransition.bind(store);
  store.commitTransition = (transition) => {
    if (transition.facts.some((fact) => fact.kind === 'wager-settled' && fact.turn === 10)) store.failNext('commitTransition', when);
    return commit(transition);
  };
  await controller.beginTurn(); // 8 with nothing at stake
  await controller.placeWager('place-6', '12');
  await controller.placeWager('place-8', '12');
  for (let roll = 2; roll <= 10; roll++) await controller.beginTurn();
  return { adapters, controller, store };
}

describe('a craps strategy adjustment under failure injection', () => {
  it.each(['before', 'after'] as const)('the settlement commit fails %s writing, the app restarts: one payout, and the press still waits', async (when) => {
    const { adapters, store } = await toBlockedPress(when);

    // The app restarts: a new controller over the same durable data.
    const reopened = store.reopen();
    const restarted = new PracticeController({ ...adapters, store: reopened, clock: new FakeClock(undefined, true) });
    await restarted.load();
    await restarted.resume();
    for (let i = 0; i < 100 && view(restarted.snapshot()).phase === 'revealing-outcome'; i++) await new Promise((resolve) => setImmediate(resolve));

    const after = view(restarted.snapshot());
    expect(after).toMatchObject({ phase: 'settled-outcome', balance: '1018', turn: 10 });
    expect(after.strategy?.pending).toEqual({ reason: 'limit', unavailable: [{ target: 'place-6', amount: '24' }], turn: 10 });
    expect(after.wagers).toEqual([
      { target: 'place-6', amount: '12' },
      { target: 'place-8', amount: '12' },
    ]);
    // Paid once: the first hit on roll 4 and the second on roll 10.
    expect(placeSixWins(await committedFacts(reopened, 'activity-1')).map((fact) => fact.kind === 'wager-settled' && fact.turn)).toEqual([4, 10]);

    // Resolving it pays nothing again; the record nets the three 14s once each.
    await restarted.collectInstead();
    expect(view(restarted.snapshot())).toMatchObject({ phase: 'cycle-completion', balance: '1042', wagers: [] });
    expect(placeSixWins(await committedFacts(reopened, 'activity-1'))).toHaveLength(2);
    await restarted.endSession();
    const outgoing = await reopened.readOutgoing();
    expect(outgoing[0]?.record).toMatchObject({ netResult: '42', finalCashOut: '1042' });
  });
});

// Seam 2 for blackjack: the practice controller with substitute adapters. The
// shoe comes from the Random123 "pi digits" stream; its six-deck shuffle starts
// T, T, J, 6, A, T, 9, T, 5, 3 (engine draws.cases, from the Python reference):
// round 1 deals the player T and J against a dealer ten up with a 6 in the hole.

import { blackjackRules } from '@tableside/definitions';
import type { BlackjackPermittedView } from '@tableside/engine';

import { PracticeController, REVEAL_MS, type PracticeSnapshot } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

/** A stream whose first round deals 2♥ J♦ against an A♥ up with a 2♠ in the hole, then 5♥ (found through the engine). */
const ACE_UP = [3, 0x5441424c, 0x45534944, 0x45] as const;

function setup(words?: readonly [number, number, number, number]) {
  const adapters = substituteAdapters({ clock: new FakeClock(undefined, false), ...(words && { words }) });
  const controller = new PracticeController(adapters);
  return { adapters, store: adapters.store, clock: adapters.clock, controller };
}

function view(snapshot: PracticeSnapshot): BlackjackPermittedView {
  if (snapshot.status !== 'active' || snapshot.view.game !== 'blackjack') throw new Error(`expected an active blackjack session, got ${snapshot.status}`);
  return snapshot.view;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

describe('blackjack through the practice controller', () => {
  it('starts a session on the chosen preset and penetration and pins those rules', async () => {
    const { controller, store } = setup();
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules('H17_noLS', 60) });

    const table = view(controller.snapshot()).table;
    expect(table).toEqual({ decks: 6, dealer: 'H17', lateSurrender: false, penetration: 60, initial: { min: '10', max: '1000' }, blackjackPays: '3:2', players: { learnerSeat: 0, others: [] } });
    const stored = await store.findUnfinished();
    expect(stored?.specification).toMatchObject({ game: 'blackjack', rules: { id: 'blackjack-six-deck', dealer: 'H17', penetration: 60 } });
  });

  it('deals, waits for the player, then settles automatically after the reveal without a tap', async () => {
    const { controller, clock, store } = setup();
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules() });
    await controller.placeWager('hand-1', '10');
    await controller.beginTurn();

    // A decision: the controller waits; nothing settles while time passes.
    let current = view(controller.snapshot());
    expect([current.phase, current.playActions, current.outcome?.dealer.cards[1]]).toEqual(['open-decision', ['hit', 'stand', 'double', 'split', 'surrender'], null]);
    clock.advance(10_000);
    expect(view(controller.snapshot()).sequence).toBe(current.sequence);

    const standing = controller.play('stand');
    await waitFor(() => clock.pending === 1);
    // The reveal is published (and durable) before the automatic settle.
    current = view(controller.snapshot());
    expect(current.phase).toBe('revealing-outcome');
    expect(current.outcome?.dealer.cards.map((card) => card?.rank)).toEqual([10, 6, 1]);
    expect((await store.load(current.activityId))?.sequence).toBe(current.sequence);

    clock.advance(REVEAL_MS);
    await standing;
    current = view(controller.snapshot());
    expect([current.phase, current.balance]).toEqual(['settled-outcome', '1010']);
  });

  it('treats a hand in play as a round under way: suspended there it cannot end, and it resumes to the same decision', async () => {
    const { controller } = setup();
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules() });
    await controller.placeWager('hand-1', '10');
    await controller.beginTurn();
    const before = view(controller.snapshot());

    controller.suspend('navigation');

    const suspended = controller.snapshot();
    expect(suspended.status === 'active' && suspended.suspension).toMatchObject({ reached: true, canEnd: false });
    // Nothing is played while suspended.
    await controller.play('stand');
    expect(view(controller.snapshot()).sequence).toBe(before.sequence);

    await controller.resume();
    const resumed = controller.snapshot();
    expect(resumed.status === 'active' && resumed.suspension).toBeNull();
    expect(view(resumed).playActions).toEqual(['hit', 'stand', 'double', 'split', 'surrender']);
  });

  it('ending mid-hand lets the hand finish, then settles it and completes once', async () => {
    const { controller, clock } = setup();
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules() });
    await controller.placeWager('hand-1', '10');
    await controller.beginTurn();

    await controller.endSession();
    // The engine never stops a hand mid-decision: the player still plays it.
    expect(view(controller.snapshot()).playActions).toEqual(['hit', 'stand', 'double', 'split', 'surrender']);

    const standing = controller.play('stand');
    for (let i = 0; i < 4; i++) {
      await waitFor(() => clock.pending === 1 || controller.snapshot().status === 'completed');
      if (controller.snapshot().status === 'completed') break;
      clock.advance(REVEAL_MS);
    }
    await standing;
    const done = controller.snapshot();
    expect(done.status === 'completed' && [done.result.finalCashOut, done.result.netResult]).toEqual(['1010', '10']);
  });

  it('a double the balance cannot cover is assessed and changes nothing', async () => {
    const { controller } = setup();
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '15', rules: blackjackRules() });
    await controller.placeWager('hand-1', '10');
    await controller.beginTurn();
    await controller.play('double');

    const snapshot = controller.snapshot();
    expect(snapshot.status === 'active' && snapshot.facts).toEqual([
      { kind: 'illegal-action', command: { kind: 'play', action: 'double' }, reason: 'insufficient-funds' },
    ]);
    expect([view(snapshot).balance, view(snapshot).wagers, view(snapshot).phase]).toEqual(['5', [{ target: 'hand-1', amount: '10' }], 'open-decision']);
  });

  it('insurance is part of the hand: still taken after ending is asked for, and the hand then finishes and settles once', async () => {
    const { controller, clock } = setup(ACE_UP);
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules() });
    await controller.placeWager('hand-1', '10');
    await controller.beginTurn();
    expect(view(controller.snapshot()).insuranceOffer).toEqual({ max: '5', evenMoney: false });

    await controller.endSession();
    await controller.insure('5');
    const insured = controller.snapshot();
    expect(insured.status === 'active' && insured.facts.find((fact) => fact.kind === 'wager-settled')).toMatchObject({ target: 'insurance', result: 'loss', net: '-5' });
    expect(view(insured).playActions).toEqual(['hit', 'stand', 'double', 'surrender']);

    const standing = controller.play('stand');
    for (let i = 0; i < 4; i++) {
      await waitFor(() => clock.pending === 1 || controller.snapshot().status === 'completed');
      if (controller.snapshot().status === 'completed') break;
      clock.advance(REVEAL_MS);
    }
    await standing;
    const done = controller.snapshot();
    // 12 stands; the dealer's A,2 draws the 5♥ to 18. Insurance 5 and the hand's 10 are lost, once each.
    expect(done.status === 'completed' && [done.result.finalCashOut, done.result.netResult]).toEqual(['985', '-15']);
  });

  it('pins other players with the rules: their fixed wagers and seats, and the learner after them', async () => {
    const { controller, store } = setup();
    await controller.load();
    await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules('S17_LS', 75, 2) });
    expect(view(controller.snapshot()).table.players).toEqual({ learnerSeat: 2, others: ['10', '10'] });
    const stored = await store.findUnfinished();
    expect(stored?.specification).toMatchObject({ rules: { players: { learnerSeat: 2, others: ['10', '10'] } } });
  });
});

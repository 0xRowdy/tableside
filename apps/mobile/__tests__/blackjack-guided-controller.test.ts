// Seam 2 for guided blackjack: the practice controller with substitute
// adapters. The shoe comes from the Random123 "pi digits" stream: round 1
// deals the player T and J (hard 20) against a dealer ten up with a 6 in the
// hole; the next card is an ace. Basic strategy stands on 20, so a hit departs.

import { BLACKJACK_REFERENCE_IDENTITY, blackjackRules, blackjackStrategy } from '@tableside/definitions';
import { isPlayCorrection, type BlackjackPermittedView } from '@tableside/engine';

import { PracticeController, REVEAL_MS, type PracticeSnapshot } from '@/practice/controller';
import { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

function setup() {
  const substitutes = substituteAdapters({ clock: new FakeClock(undefined, false) });
  // A copy of the always-allow supervisor, so each test counts only its own questions.
  const adapters = { ...substitutes, access: { ...substitutes.access } };
  const beforeTurn = jest.spyOn(adapters.access, 'beforeTurn');
  const controller = new PracticeController(adapters);
  return { adapters, store: adapters.store, clock: adapters.clock, controller, beforeTurn };
}

function view(snapshot: PracticeSnapshot): BlackjackPermittedView {
  if (snapshot.status !== 'active' || snapshot.view.game !== 'blackjack') throw new Error(`expected an active blackjack session, got ${snapshot.status}`);
  return snapshot.view;
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setImmediate(resolve));
  if (!condition()) throw new Error('condition never held');
}

/** Lets automatic steps (reveal, settle, final settlement) run to the end. */
async function settleAll(controller: PracticeController, clock: FakeClock, until: () => boolean) {
  for (let i = 0; i < 6 && !until(); i++) {
    await waitFor(() => clock.pending === 1 || until());
    if (until()) break;
    clock.advance(REVEAL_MS);
  }
}

async function guidedRound(controller: PracticeController, mode: 'basic' | 'basic-with-deviations' = 'basic') {
  await controller.load();
  await controller.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules(), strategy: { definition: blackjackStrategy('S17_LS', mode), parameters: {} } });
  await controller.placeWager('hand-1', '10');
  await controller.beginTurn();
}

describe('guided blackjack through the practice controller', () => {
  it('pins the built-in strategy and the certified reference; the initial wager is the player\'s own', async () => {
    const { controller, store } = setup();
    await guidedRound(controller);
    const stored = await store.findUnfinished();
    expect(stored?.specification).toMatchObject({ reference: BLACKJACK_REFERENCE_IDENTITY, strategy: { definition: { id: 'blackjack-basic-S17_LS' } } });
    const current = view(controller.snapshot());
    expect([current.phase, current.strategy?.adherence, current.count]).toEqual(['open-decision', { decisions: 0, followed: 0, departures: 0 }, null]);
  });

  it('holds a departing play before it executes, asks no access question for it, and retry plays the strategy and settles automatically', async () => {
    const { controller, clock, beforeTurn, store } = setup();
    await guidedRound(controller);
    expect(beforeTurn).toHaveBeenCalledTimes(1);

    await controller.play('hit');
    let current = view(controller.snapshot());
    const held = current.strategy?.correction;
    expect([current.phase, held && isPlayCorrection(held) && held.explanation.prescribed]).toEqual(['correction', { action: 'stand', amount: null }]);
    // Nothing was dealt: still two cards; the correction is durable before it shows.
    expect(current.outcome?.hands[0]?.cards).toHaveLength(2);
    expect((await store.load(current.activityId))?.sequence).toBe(current.sequence);

    const retried = controller.retryCorrection();
    await settleAll(controller, clock, () => view(controller.snapshot()).phase === 'settled-outcome');
    await retried;
    current = view(controller.snapshot());
    // Stood on 20: the dealer's 16 draws the ace for 17. 20 wins 10.
    expect([current.phase, current.balance, current.strategy?.adherence]).toEqual(['settled-outcome', '1010', { decisions: 1, followed: 0, departures: 1 }]);
    expect(current.strategy?.departures.map((d) => d.resolution)).toEqual(['retried']);
    expect(beforeTurn).toHaveBeenCalledTimes(1);
  });

  it('a session suspended during a held play cannot end there and resumes to the same correction', async () => {
    const { controller } = setup();
    await guidedRound(controller);
    await controller.play('hit');
    const before = view(controller.snapshot());

    controller.suspend('navigation');
    const suspended = controller.snapshot();
    expect(suspended.status === 'active' && suspended.suspension).toMatchObject({ reached: true, canEnd: false });
    await controller.overrideCorrection();
    expect(view(controller.snapshot()).sequence).toBe(before.sequence);

    await controller.resume();
    const resumed = view(controller.snapshot());
    expect([resumed.phase, resumed.strategy?.correction]).toEqual(['correction', before.strategy?.correction]);
  });

  it('ending during a held play lets the hand finish: the override plays the hit once, then the stop path completes with playing adherence in the record', async () => {
    const { controller, clock } = setup();
    await guidedRound(controller);
    await controller.play('hit');

    await controller.endSession();
    // The hand is still the player's to finish: the held move waits for retry or override.
    expect(view(controller.snapshot()).legalCommands).toEqual(['retry-correction', 'override-correction']);

    const overriding = controller.overrideCorrection();
    await settleAll(controller, clock, () => controller.snapshot().status === 'completed');
    await overriding;
    const done = controller.snapshot();
    if (done.status !== 'completed') throw new Error('expected the session to complete');
    // Hit 20: the ace makes 21; the dealer's 16 draws a ten and busts. 21 wins 10.
    expect([done.result.finalCashOut, done.result.netResult, done.result.blackjackMode]).toEqual(['1010', '10', 'basic']);
    expect(done.result.guidance?.adherence).toEqual({ playing: { decisions: 1, followed: 0 }, betting: null, counting: null });
    expect(done.result.guidance?.departures.map((d) => d.resolution)).toEqual(['overridden']);
  });

  it('basic with deviations supplies the count from exposed cards only: the face-down 6 is not in it', async () => {
    const { controller } = setup();
    await guidedRound(controller, 'basic-with-deviations');
    // T, T and J are exposed (-3); 308 cards are 6 decks to the half deck: -3 / 6 truncates to 0.
    expect(view(controller.snapshot()).count).toEqual({ running: -3, decks: '6', trueCount: 0 });
  });
});

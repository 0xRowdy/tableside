// Blackjack splits, insurance, late surrender and simulated players through
// the engine interface (seam 1). Rules come from the launch rules (#3 / spec
// #51): split equal values incl. mixed tens up to four hands, resplit
// non-aces, split aces one card each with no resplit or double, split 21 is
// not blackjack, DAS; insurance before the peek up to half the initial wager
// paying 2:1 and settled separately, surrender still allowed after it, even
// money equivalent for a natural; late surrender on the original unsplit two
// cards after the peek in LS presets; 0-4 simulated players with fixed wagers.
// Also the engine-level checks the certified reference left to the
// implementation (research report "Implementation checks"): seats after other
// players, a learner who stops resplitting T,T, the split-hand dealing order
// (a split hand's second card comes when that hand is played) and play-order
// funding of the last affordable double. Every shoe names its cards; payouts
// are worked by hand.
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  checkpointHash,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  RandomStream,
  readPermittedView,
  uniformInt,
  type BlackjackActivitySpecification,
  type BlackjackActivityState,
  type BlackjackHandView,
  type Command,
  type DomainFact,
} from '../src';

import { run, step } from './activity.fixtures';
import {
  BJ_SPEC,
  BJ_STREAM,
  bet,
  DEAL,
  DOUBLE,
  HIT,
  insure,
  NO_INSURANCE,
  SETTLE,
  SPLIT,
  STAND,
  stacked,
  SURRENDER,
  TEST_STRATEGY,
  withPlayers,
} from './blackjack.fixtures';
import { throws, ZERO } from './fixtures';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const view = (state: BlackjackActivityState) => readPermittedView(state);
const rank = (card: { rank: number } | null) => (card === null ? 'down' : (RANKS[card.rank - 1] as string));
/** Each learner hand's ranks, in play order: { "hand-1": "8 3 T", ... }. */
const hands = (state: BlackjackActivityState) =>
  Object.fromEntries((view(state).outcome?.hands ?? []).map((hand) => [hand.target, hand.cards.map(rank).join(' ')]));
const dealt = (facts: readonly DomainFact[]) => facts.flatMap((fact) => (fact.kind === 'card-dealt' ? [[fact.to, rank(fact.card)]] : []));
const settled = (facts: readonly DomainFact[]) =>
  facts.flatMap((fact) => (fact.kind === 'wager-settled' ? [[fact.target, fact.result, fact.net, fact.returned]] : []));
const seatSettled = (facts: readonly DomainFact[]) =>
  facts.flatMap((fact) => (fact.kind === 'seat-settled' ? [[fact.target, fact.result, fact.stake, fact.net]] : []));
/** Facts with each dealt card shown by rank. */
const brief = (facts: readonly DomainFact[]) => facts.map((fact) => (fact.kind === 'card-dealt' ? { ...fact, card: rank(fact.card) } : fact));
const played = (facts: readonly DomainFact[]) => facts.flatMap((fact) => (fact.kind === 'played' ? [[fact.target, fact.action]] : []));
const withRules = (change: Partial<BlackjackActivitySpecification['rules']>, spec = BJ_SPEC): BlackjackActivitySpecification => ({
  ...spec,
  rules: { ...spec.rules, ...change },
});
const NO_LS = withRules({ lateSurrender: false });
const funded = (funding: string, spec = BJ_SPEC): BlackjackActivitySpecification => ({ ...spec, funding });
const envelope = (state: BlackjackActivityState, command: Command) => ({ sequence: state.sequence, commandId: `c${state.sequence}`, command });

/** The illegal-action reason a command is assessed with; throws if it commits a change. */
function refused(state: BlackjackActivityState, command: Command): string {
  const result = advanceActivity(state, envelope(state, command));
  if (result.status !== 'committed') throw new Error(`expected an assessment, got ${result.status}`);
  const fact = result.facts[0];
  if (fact?.kind !== 'illegal-action') throw new Error(`expected an illegal action, got ${JSON.stringify(result.facts)}`);
  // Nothing is drawn or changed by an illegal action.
  if (encodeCheckpoint({ ...result.state, sequence: state.sequence, receipts: state.receipts }) !== encodeCheckpoint(state)) {
    throw new Error('an illegal action changed the state');
  }
  return fact.reason;
}

export const blackjackTableCases: TestCase[] = [
  // ---- splits -----------------------------------------------------------------
  {
    name: 'blackjack splits: any two cards of equal value split, mixed tens included; unequal ones do not',
    run: (t) => {
      const actions = (shoe: string) => view(run(stacked(shoe), [bet('10'), DEAL]).state).playActions;
      t.equal(actions('T 6 K 7'), ['hit', 'stand', 'double', 'split', 'surrender']);
      t.equal(actions('Q 6 J 7'), ['hit', 'stand', 'double', 'split', 'surrender']);
      t.equal(actions('8 6 8 7'), ['hit', 'stand', 'double', 'split', 'surrender']);
      t.equal(actions('9 6 T 7'), ['hit', 'stand', 'double', 'surrender']);
      t.equal(refused(run(stacked('9 6 T 7'), [bet('10'), DEAL]).state, SPLIT), 'action-not-available');
    },
  },
  {
    name: 'blackjack splits: the split hand takes its second card at once; the hand split off takes its second card when its play begins; doubling after a split',
    run: (t) => {
      // 8,8 against a 6 up (hole T). Shoe after the deal: 3, T, 9, 2.
      let { state, facts } = run(stacked('8 6 8 T 3 T 9 2'), [bet('10'), DEAL]);
      t.equal(dealt(facts), [
        ['hand-1', '8'],
        ['dealer', '6'],
        ['hand-1', '8'],
        ['dealer', 'down'],
      ]);
      ({ state, facts } = step(state, SPLIT));
      t.equal(brief(facts), [
        { kind: 'played', turn: 1, target: 'hand-1', action: 'split' },
        { kind: 'hand-split', turn: 1, target: 'hand-1', into: 'hand-2' },
        { kind: 'wager-changed', target: 'hand-2', amount: '10', previous: '0' },
        { kind: 'card-dealt', turn: 1, to: 'hand-1', card: '3' },
      ]);
      t.equal([hands(state), state.wagers, state.balance], [{ 'hand-1': '8 3', 'hand-2': '8' }, [{ target: 'hand-1', amount: '10' }, { target: 'hand-2', amount: '10' }], '980']);
      // A split hand never surrenders; 8,3 is no pair.
      t.equal([view(state).outcome?.active, view(state).playActions], [0, ['hit', 'stand', 'double']]);
      ({ state, facts } = step(state, DOUBLE));
      // The double takes one card (T: 21), then play reaches hand 2, which takes its second card (9).
      t.equal(dealt(facts), [
        ['hand-1', 'T'],
        ['hand-2', '9'],
      ]);
      t.equal([hands(state), view(state).outcome?.active, state.balance], [{ 'hand-1': '8 3 T', 'hand-2': '8 9' }, 1, '970']);
      ({ state, facts } = step(state, STAND));
      // Dealer 6,T = 16 draws the 2: 18.
      t.equal(dealt(facts), [['dealer', '2']]);
      ({ state, facts } = step(state, SETTLE));
      // Doubled 21 wins 20 on 20; 17 loses 10 against 18. 1,000 - 30 + 40 = 1,010.
      t.equal(settled(facts), [
        ['hand-1', 'win', '20', '40'],
        ['hand-2', 'loss', '-10', '0'],
      ]);
      t.equal(state.balance, '1010');
    },
  },
  {
    name: 'blackjack splits: pairs resplit to four hands, then split is off; hands play left to right with each new hand just right of its source',
    run: (t) => {
      // 8,8 v 6 (hole T); every card to hand 1 is another 8; then 2, 9, 3 for the waiting hands and T for the dealer.
      let state = run(stacked('8 6 8 T 8 8 8 2 9 3 T'), [bet('10'), DEAL, SPLIT, SPLIT, SPLIT]).state;
      t.equal(Object.keys(hands(state)), ['hand-1', 'hand-4', 'hand-3', 'hand-2']);
      t.equal(hands(state), { 'hand-1': '8 8', 'hand-4': '8', 'hand-3': '8', 'hand-2': '8' });
      t.equal(view(state).playActions, ['hit', 'stand', 'double']);
      t.equal(refused(state, SPLIT), 'action-not-available');
      t.equal(state.wagers.map((wager) => wager.target), ['hand-1', 'hand-4', 'hand-3', 'hand-2']);
      t.equal(state.balance, '960');
      const actives: (number | null | undefined)[] = [];
      for (let i = 0; i < 4; i++) {
        state = step(state, STAND).state;
        actives.push(view(state).outcome?.active);
      }
      t.equal(actives, [1, 2, 3, null]);
      t.equal(hands(state), { 'hand-1': '8 8', 'hand-4': '8 2', 'hand-3': '8 9', 'hand-2': '8 3' });
      // Dealer 16 draws T and busts: all four hands win 10.
      const end = step(state, SETTLE);
      t.equal(settled(end.facts).map((s) => s[2]), ['10', '10', '10', '10']);
      t.equal(end.state.balance, '1040');
    },
  },
  {
    name: 'blackjack splits: split aces take one card each with no resplit or double, and a split 21 is not blackjack',
    run: (t) => {
      // A,A v 6 (hole T): hand 1 takes a K (21), hand 2 takes another ace (no resplit). Dealer 16 draws 9: bust.
      const { state, facts } = run(stacked('A 6 A T K A 9'), [bet('10'), DEAL, SPLIT]);
      t.equal([state.phase, view(state).playActions], ['revealing-outcome', []]);
      t.equal(hands(state), { 'hand-1': 'A K', 'hand-2': 'A A' });
      t.equal(
        view(state).outcome?.hands.map((hand) => [hand.natural, hand.total]),
        [
          [false, { value: 21, soft: true }],
          [false, { value: 12, soft: true }],
        ],
      );
      t.equal(dealt(facts).slice(4), [
        ['hand-1', 'K'],
        ['hand-2', 'A'],
        ['dealer', '9'],
      ]);
      // Even money for the split 21, not 3:2.
      t.equal(settled(step(state, SETTLE).facts), [
        ['hand-1', 'win', '10', '20'],
        ['hand-2', 'win', '10', '20'],
      ]);
    },
  },
  {
    name: 'blackjack splits: a learner who stops resplitting tens: each resplit is its own decision',
    run: (t) => {
      // T,T v 6 (hole 7). After the split hand 1 draws another T: resplit is offered, the learner stands on 20.
      let state = run(stacked('T 6 T 7 T 9 5'), [bet('10'), DEAL, SPLIT]).state;
      t.equal([hands(state), view(state).playActions], [{ 'hand-1': 'T T', 'hand-2': 'T' }, ['hit', 'stand', 'double', 'split']]);
      state = step(state, STAND).state;
      t.equal([hands(state), view(state).outcome?.active, view(state).playActions], [{ 'hand-1': 'T T', 'hand-2': 'T 9' }, 1, ['hit', 'stand', 'double']]);
      const end = run(state, [STAND, SETTLE]);
      // Dealer 13 draws 5: 18. 20 and 19 both win.
      t.equal(settled(end.facts), [
        ['hand-1', 'win', '10', '20'],
        ['hand-2', 'win', '10', '20'],
      ]);
      t.equal(end.state.balance, '1020');
    },
  },
  {
    name: 'blackjack splits: a split or double needs the whole stake again, and the last affordable stake goes to the earliest hand in play order',
    run: (t) => {
      // 15 funds the 10 bet but not a split; a rebuy funds it.
      const short = run(stacked('8 6 8 T 3', funded('15')), [bet('10'), DEAL]).state;
      t.equal(refused(short, SPLIT), 'insufficient-funds');
      t.equal(step(step(short, { kind: 'rebuy', amount: '5' }).state, SPLIT).state.wagers.length, 2);
      // 30: bet 10, split 10, leaves 10 for one double. Both 9,2 hands want to double 11.
      let state = run(stacked('9 6 9 T 2 8 2 5', funded('30')), [bet('10'), DEAL, SPLIT, DOUBLE]).state;
      t.equal([hands(state), state.balance, view(state).outcome?.active], [{ 'hand-1': '9 2 8', 'hand-2': '9 2' }, '0', 1]);
      t.equal(refused(state, DOUBLE), 'insufficient-funds');
      state = step(state, STAND).state;
      // Dealer 16 draws 5: 21. Doubled 19 loses 20, 11 loses 10.
      t.equal(settled(step(state, SETTLE).facts), [
        ['hand-1', 'loss', '-20', '0'],
        ['hand-2', 'loss', '-10', '0'],
      ]);
    },
  },

  // ---- insurance and even money ----------------------------------------------
  {
    name: 'blackjack insurance: an ace up offers insurance before the peek, up to half the bet; it pays 2:1 on a dealer blackjack and settles on its own',
    run: (t) => {
      // T,9 v A (hole K: blackjack).
      let { state, facts } = run(stacked('T A 9 K'), [bet('10'), DEAL]);
      t.equal(facts.at(-1), { kind: 'insurance-offered', turn: 1, max: '5', evenMoney: false });
      t.equal(facts.some((fact) => fact.kind === 'peeked'), false);
      const offered = view(state);
      t.equal(
        [state.phase, offered.outcome?.dealer.cards.map(rank), offered.outcome?.dealer.peek, offered.outcome?.insurance, offered.playActions, offered.insuranceOffer],
        ['open-decision', ['A', 'down'], 'pending', 'offered', ['decline-insurance'], { max: '5', evenMoney: false }],
      );
      t.equal(offered.legalCommands, ['play', 'place-wager', 'rebuy']);
      ({ state, facts } = step(state, insure('5')));
      t.equal(facts.slice(0, 3), [
        { kind: 'wager-changed', target: 'insurance', amount: '5', previous: '0' },
        { kind: 'peeked', turn: 1, result: 'blackjack' },
        { kind: 'wager-settled', turn: 1, target: 'insurance', stake: '5', result: 'win', net: '10', returned: '15' },
      ]);
      // The insurance is off the table at once; only the hand waits for settlement.
      t.equal([state.phase, state.wagers, state.balance, view(state).insuranceOffer], ['revealing-outcome', [{ target: 'hand-1', amount: '10' }], '1000', null]);
      ({ state, facts } = step(state, SETTLE));
      t.equal(settled(facts), [['hand-1', 'loss', '-10', '0']]);
      t.equal(state.balance, '1000');
    },
  },
  {
    name: 'blackjack insurance: it loses at a negative peek, and late surrender is still allowed after it',
    run: (t) => {
      // T,6 v A (hole 7).
      let { state, facts } = run(stacked('T A 6 7'), [bet('10'), DEAL, insure('5')]);
      t.equal(settled(facts), [['insurance', 'loss', '-5', '0']]);
      t.equal([view(state).outcome?.dealer.peek, view(state).playActions, state.balance], ['no-blackjack', ['hit', 'stand', 'double', 'surrender'], '985']);
      ({ state, facts } = run(state, [SURRENDER, SETTLE]));
      t.equal(settled(facts), [['hand-1', 'loss', '-5', '5']]);
      t.equal(state.balance, '990');
    },
  },
  {
    name: 'blackjack insurance: amounts are up to half the initial wager, in whole units or exactly half; unaffordable insurance waits for a rebuy',
    run: (t) => {
      const offer = run(stacked('T A 6 7'), [bet('15'), DEAL]).state;
      t.equal(view(offer).insuranceOffer, { max: '15/2', evenMoney: false });
      t.equal(
        [insure('8'), insure('13/2'), insure('0'), { kind: 'place-wager', target: 'hand-1', amount: '20' } as Command].map((command) => refused(offer, command)),
        ['above-maximum', 'not-whole-units', 'no-wager-to-remove', 'unknown-target'],
      );
      t.equal(settled(step(offer, insure('15/2')).facts), [['insurance', 'loss', '-15/2', '0']]);
      t.equal(settled(step(offer, insure('7')).facts), [['insurance', 'loss', '-7', '0']]);
      const broke = run(stacked('T A 6 7', funded('15')), [bet('15'), DEAL]).state;
      t.equal(refused(broke, insure('7')), 'insufficient-funds');
      t.equal(view(broke).legalCommands.includes('rebuy'), true);
      t.equal(settled(run(broke, [{ kind: 'rebuy', amount: '7' }, insure('7')]).facts), [['insurance', 'loss', '-7', '0']]);
    },
  },
  {
    name: 'blackjack insurance: declining goes straight to the peek; a ten up offers no insurance',
    run: (t) => {
      const { state, facts } = run(stacked('T A 9 K'), [bet('10'), DEAL, NO_INSURANCE]);
      t.equal(played(facts), [['hand-1', 'decline-insurance']]);
      t.equal([state.phase, view(state).outcome?.insurance], ['revealing-outcome', 'declined']);
      t.equal(settled(step(state, SETTLE).facts), [['hand-1', 'loss', '-10', '0']]);
      const ten = run(stacked('T T 6 7'), [bet('10'), DEAL]);
      t.equal(
        [ten.facts.some((fact) => fact.kind === 'insurance-offered'), view(ten.state).outcome?.insurance, view(ten.state).insuranceOffer],
        [false, 'not-offered', null],
      );
    },
  },
  {
    name: 'blackjack insurance: even money on a natural is the same as insuring it for half: +1 bet whatever the hole card',
    run: (t) => {
      for (const shoe of ['A A K 9', 'A A K K']) {
        const offer = run(stacked(shoe), [bet('10'), DEAL]).state;
        t.equal(view(offer).insuranceOffer, { max: '5', evenMoney: true });
        const taken = run(offer, [insure('5'), SETTLE]).state;
        t.equal(taken.balance, '1010');
      }
      // Declined: 3:2 against no blackjack, a push against one.
      t.equal(run(stacked('A A K 9'), [bet('10'), DEAL, NO_INSURANCE, SETTLE]).state.balance, '1015');
      t.equal(run(stacked('A A K K'), [bet('10'), DEAL, NO_INSURANCE, SETTLE]).state.balance, '1000');
    },
  },

  // ---- late surrender ------------------------------------------------------------
  {
    name: 'blackjack surrender: late surrender on the original two cards after the peek returns half the bet; the dealer draws nothing',
    run: (t) => {
      // T,6 v T (hole 7).
      const { state, facts } = step(run(stacked('T T 6 7 5'), [bet('10'), DEAL]).state, SURRENDER);
      t.equal(facts.map((fact) => fact.kind), ['played', 'hole-card-revealed']);
      t.equal(view(state).outcome?.hands[0]?.surrendered, true);
      const end = step(state, SETTLE);
      t.equal(settled(end.facts), [['hand-1', 'loss', '-5', '5']]);
      t.equal(end.state.balance, '995');
    },
  },
  {
    name: 'blackjack surrender: not in no-surrender presets, not after a hit and not on a split hand',
    run: (t) => {
      const noLs = run(stacked('T T 6 7', NO_LS), [bet('10'), DEAL]).state;
      t.equal([view(noLs).playActions, refused(noLs, SURRENDER)], [['hit', 'stand', 'double'], 'action-not-available']);
      const hit = run(stacked('T T 2 7 3'), [bet('10'), DEAL, HIT]).state;
      t.equal([view(hit).playActions, refused(hit, SURRENDER)], [['hit', 'stand'], 'action-not-available']);
      const split = run(stacked('8 T 8 7 8'), [bet('10'), DEAL, SPLIT]).state;
      t.equal(refused(split, SURRENDER), 'action-not-available');
    },
  },

  // ---- simulated players -----------------------------------------------------------
  {
    name: 'blackjack players: cards go round the seats from first base; a seat ahead plays before the learner decides and one after plays after',
    run: (t) => {
      // Seat 1 (10 a hand) ahead, the learner in seat 2, seat 3 (25) after. Dealer 9 up, 8 down.
      const spec = withPlayers(1, ['10', '25']);
      let { state, facts } = run(stacked('T T 5 9 6 9 6 8 T 9', spec), [bet('10'), DEAL]);
      t.equal(dealt(facts), [
        ['seat-1-hand-1', 'T'],
        ['hand-1', 'T'],
        ['seat-3-hand-1', '5'],
        ['dealer', '9'],
        ['seat-1-hand-1', '6'],
        ['hand-1', '9'],
        ['seat-3-hand-1', '6'],
        ['dealer', 'down'],
        // Seat 1 hits 16 against a 9 and busts, before the learner's decision.
        ['seat-1-hand-1', 'T'],
      ]);
      t.equal(played(facts), [['seat-1-hand-1', 'hit']]);
      const others = view(state).outcome?.others.map((seat) => [seat.seat, seat.wager, seat.hands.map((hand) => hand.cards.map(rank).join(' '))]);
      t.equal(others, [
        [1, '10', ['T 6 T']],
        [3, '25', ['5 6']],
      ]);
      t.equal([view(state).outcome?.active, view(state).table.players], [0, { learnerSeat: 1, others: ['10', '25'] }]);
      ({ state, facts } = step(state, STAND));
      // Seat 3 doubles 11 against the 9 for one card: 20. Dealer 17 stands.
      t.equal(played(facts), [
        ['hand-1', 'stand'],
        ['seat-3-hand-1', 'double'],
      ]);
      t.equal(dealt(facts), [['seat-3-hand-1', '9']]);
      ({ state, facts } = step(state, SETTLE));
      t.equal(settled(facts), [['hand-1', 'win', '10', '20']]);
      t.equal(seatSettled(facts), [
        ['seat-1-hand-1', 'loss', '10', '-10'],
        ['seat-3-hand-1', 'win', '50', '50'],
      ]);
      // Simulated players have their own funds: only the learner's result moves the balance.
      t.equal(state.balance, '1010');
    },
  },
  {
    name: 'blackjack players: the dealer still draws for a live simulated hand after the learner busts',
    run: (t) => {
      // Learner first base: T,6 v 6 hits a T. Seat 2 stands on 17. Dealer 6,T draws 5: 21.
      const { state, facts } = run(stacked('T T 6 6 7 T T 5', withPlayers(0, ['10'])), [bet('10'), DEAL, HIT]);
      t.equal(played(facts), [
        ['hand-1', 'hit'],
        ['seat-2-hand-1', 'stand'],
      ]);
      t.equal(dealt(facts).at(-1), ['dealer', '5']);
      const end = step(state, SETTLE);
      t.equal([settled(end.facts), seatSettled(end.facts)], [[['hand-1', 'loss', '-10', '0']], [['seat-2-hand-1', 'loss', '10', '-10']]]);
    },
  },
  {
    name: 'blackjack players: simulated players split, double after splitting and surrender by their basic strategy',
    run: (t) => {
      // Seat 1 ahead with 8,8 v 6 splits; hand 1 takes 3 and doubles 11 (T: 21), hand 2 takes 2 and doubles 10 (5: 15).
      const { state, facts } = run(stacked('8 T 6 8 9 T 3 T 2 5 4', withPlayers(1, ['10'])), [bet('10'), DEAL]);
      t.equal(brief(facts).slice(8), [
        { kind: 'played', turn: 1, target: 'seat-1-hand-1', action: 'split' },
        { kind: 'hand-split', turn: 1, target: 'seat-1-hand-1', into: 'seat-1-hand-2' },
        { kind: 'card-dealt', turn: 1, to: 'seat-1-hand-1', card: '3' },
        { kind: 'played', turn: 1, target: 'seat-1-hand-1', action: 'double' },
        { kind: 'card-dealt', turn: 1, to: 'seat-1-hand-1', card: 'T' },
        { kind: 'card-dealt', turn: 1, to: 'seat-1-hand-2', card: '2' },
        { kind: 'played', turn: 1, target: 'seat-1-hand-2', action: 'double' },
        { kind: 'card-dealt', turn: 1, to: 'seat-1-hand-2', card: '5' },
      ]);
      t.equal(view(state).outcome?.others[0]?.hands.map((hand) => hand.cards.map(rank).join(' ')), ['8 3 T', '8 2 5']);
      // Learner 19 stands; dealer 16 draws 4: 20.
      const end = run(state, [STAND, SETTLE]);
      t.equal(seatSettled(end.facts), [
        ['seat-1-hand-1', 'win', '20', '20'],
        ['seat-1-hand-2', 'loss', '20', '-20'],
      ]);
      // A seat after the learner surrenders 16 against a T: half its wager.
      const surrender = run(stacked('T T T 9 6 7', withPlayers(0, ['10'])), [bet('10'), DEAL, STAND, SETTLE]);
      t.equal(played(surrender.facts), [
        ['hand-1', 'stand'],
        ['seat-2-hand-1', 'surrender'],
      ]);
      t.equal(seatSettled(surrender.facts), [['seat-2-hand-1', 'loss', '10', '-5']]);
    },
  },
  {
    name: 'blackjack players: a dealer blackjack ends every seat at the peek; a simulated natural pushes it and never insures',
    run: (t) => {
      // Learner T,9; seat 2 A,Q; dealer K up, A down.
      const { state, facts } = run(stacked('T A K 9 Q A', withPlayers(0, ['10'])), [bet('10'), DEAL]);
      t.equal([state.phase, played(facts)], ['revealing-outcome', []]);
      const end = step(state, SETTLE);
      t.equal([settled(end.facts), seatSettled(end.facts)], [[['hand-1', 'loss', '-10', '0']], [['seat-2-hand-1', 'push', '10', '0']]]);
      // Against an ace up, only the learner is asked about insurance.
      const ace = run(stacked('T 9 A 9 Q K', withPlayers(1, ['10'])), [bet('10'), DEAL]);
      t.equal([played(ace.facts), view(ace.state).insuranceOffer], [[], { max: '5', evenMoney: false }]);
      t.equal(played(step(ace.state, NO_INSURANCE).facts), [['hand-1', 'decline-insurance']]);
    },
  },
  {
    name: 'blackjack players: zero to four players with fixed whole-unit wagers within the table limits and a basic strategy',
    run: (t) => {
      const ok = createActivity(withPlayers(4, ['10', '10', '1000', '25']), BJ_STREAM);
      t.equal(view(ok).table.players, { learnerSeat: 4, others: ['10', '10', '1000', '25'] });
      // The view never carries the strategy table.
      t.equal(JSON.stringify(view(ok)).includes('HSSSSSHHHH'), false);
      const players = withPlayers(1, ['10']).rules.players;
      const bad: BlackjackActivitySpecification[] = [
        withPlayers(0, ['10', '10', '10', '10', '10']),
        withPlayers(0, ['9']),
        withPlayers(0, ['1001']),
        withPlayers(0, ['21/2']),
        withPlayers(2, ['10']),
        withRules({ players: { ...players, strategy: null } }),
        withRules({ players: { learnerSeat: 0, others: [], strategy: TEST_STRATEGY } }),
        withRules({ players: { ...players, strategy: { ...TEST_STRATEGY, pairAtCap: TEST_STRATEGY.pairAtCap.slice(1) } } }),
        withRules({ players: { ...players, strategy: { ...TEST_STRATEGY, later: { ...TEST_STRATEGY.later, hard: TEST_STRATEGY.later.hard.map(() => 'HHHHHHHHHX') } } } }),
        // A surrender play is malformed where the rules have no late surrender.
        withPlayers(1, ['10'], NO_LS),
      ];
      t.equal(
        bad.map((spec) => throws(() => createActivity(spec, BJ_STREAM))),
        bad.map(() => 'ActivitySpecificationError'),
      );
    },
  },

  // ---- information, checkpoints and invariants ----------------------------------------
  {
    name: 'blackjack table: no fact or view names the hole card while it is down, with players, splits and an insurance offer',
    run: (t) => {
      const spec = withPlayers(1, ['10', '10']);
      const offer = run(stacked('T 8 9 A 8 8 7 6 5 4 3 2', spec), [bet('10'), DEAL]);
      // Hole card: the 6 of clubs from deck 0 (the first 6 left in canonical order).
      const hole = { deck: 0, suit: 'clubs', rank: 6 };
      t.equal(offer.state.outcome?.dealer[1], hole);
      const split = run(offer.state, [NO_INSURANCE, SPLIT]);
      t.equal(JSON.stringify([offer.facts, view(offer.state), split.facts, view(split.state)]).includes(JSON.stringify(hole)), false);
    },
  },
  {
    name: 'blackjack table: checkpoints round-trip through an insurance offer, splits and simulated players, and resume the same round',
    run: (t) => {
      const spec = withPlayers(1, ['10', '25']);
      const states: BlackjackActivityState[] = [stacked('9 8 9 A 9 8 9 6 3 T 9', spec)];
      for (const command of [bet('10'), DEAL, NO_INSURANCE, SPLIT, DOUBLE, STAND, SETTLE]) states.push(step(states.at(-1)!, command).state);
      for (const state of states) {
        const decoded = decodeCheckpoint(encodeCheckpoint(state));
        if (!decoded.ok) throw new Error(decoded.error.message);
        t.equal(decoded.state, state);
      }
      const middle = decodeCheckpoint(encodeCheckpoint(states[4]!));
      if (!middle.ok) throw new Error('round trip failed');
      t.equal(checkpointHash(step(middle.state as BlackjackActivityState, DOUBLE).state), checkpointHash(states[5]!));
      const text = encodeCheckpoint(states[4]!);
      const edit = (change: (value: Record<string, Record<string, unknown>>) => void) => {
        const value = JSON.parse(text) as Record<string, Record<string, unknown>>;
        change(value);
        const result = decodeCheckpoint(JSON.stringify(value));
        return result.ok ? 'ok' : result.error.kind;
      };
      const outcome = (v: Record<string, Record<string, unknown>>) => v.outcome as Record<string, Record<string, unknown>[]>;
      const damaged = [
        edit((v) => (outcome(v).hands![1]!.target = 'hand-7')),
        edit((v) => (outcome(v).hands = [...outcome(v).hands!, ...outcome(v).hands!, ...outcome(v).hands!])),
        edit((v) => (outcome(v).others = outcome(v).others!.slice(1))),
        edit((v) => (outcome(v).others![0]!.seat = 2)),
        edit((v) => ((outcome(v) as Record<string, unknown>).insurance = 'offered')),
        edit((v) => (v.wagers = (v.wagers as unknown as unknown[]).slice(0, 1) as never)),
        edit((v) => ((v.rules!.players as Record<string, unknown>).others = ['10'])),
      ];
      t.equal(damaged, damaged.map(() => 'damaged'));
    },
  },
  {
    name: 'blackjack table: money is conserved over random play with splits, doubles, insurance, surrender and players, and every settlement follows from the cards (property)',
    run: (t) => {
      const driver = RandomStream.create({ ...ZERO, key: [0x73706c69, 0x74746564] });
      let state = createActivity({ ...withPlayers(1, ['10', '50']), funding: '100000' }, BJ_STREAM);
      let halves = 200000n;
      let rounds = 0;
      const inHalves = (amount: string) => (amount.endsWith('/2') ? BigInt(amount.slice(0, -2)) : BigInt(amount) * 2n);
      const value = (cards: readonly { rank: number }[]) => {
        const hard = cards.reduce((sum, card) => sum + Math.min(card.rank, 10), 0);
        return cards.some((card) => card.rank === 1) && hard <= 11 ? hard + 10 : hard;
      };
      /** The net in halves of a hand with `stake` halves, from the final cards alone. */
      const expectedNet = (hand: BlackjackHandView, count: number, dealer: readonly { rank: number }[], stake: bigint) => {
        const player = value(hand.cards);
        const dealerTotal = value(dealer);
        const dealerNatural = value(dealer.slice(0, 2)) === 21;
        if (hand.surrendered) return -stake / 2n;
        if (count === 1 && hand.cards.length === 2 && player === 21) return dealerNatural ? 0n : (stake * 3n) / 2n;
        if (dealerNatural || player > 21) return -stake;
        if (dealerTotal > 21 || player > dealerTotal) return stake;
        return player === dealerTotal ? 0n : -stake;
      };
      const seen = { split: 0, insured: 0, surrendered: 0, seatSettled: 0 };
      while (rounds < 400) {
        const current = view(state);
        const actions = current.playActions;
        let command: Command;
        if (state.phase === 'revealing-outcome') command = SETTLE;
        else if (current.insuranceOffer && uniformInt(driver, 2) === 0) command = insure(current.insuranceOffer.max);
        else if (actions.length > 0) command = { kind: 'play', action: actions[uniformInt(driver, actions.length)]! };
        else if (state.wagers.length === 0) command = bet(String(10 + uniformInt(driver, 41)));
        else command = DEAL;
        const next = step(state, command);
        state = next.state;
        const after = view(state);
        for (const fact of next.facts) {
          if (fact.kind === 'hand-split' && !fact.target.startsWith('seat')) seen.split++;
          if (fact.kind === 'seat-settled') {
            seen.seatSettled++;
            const seat = current.outcome!.others.find((s) => fact.target.startsWith(`seat-${s.seat}-`))!;
            const hand = seat.hands.find((h) => h.target === fact.target)!;
            const stake = inHalves(seat.wager) * (hand.doubled ? 2n : 1n);
            t.equal([inHalves(fact.stake), inHalves(fact.net)], [stake, expectedNet(hand, seat.hands.length, current.outcome!.dealer.cards.filter((c) => c !== null), stake)]);
          }
          if (fact.kind !== 'wager-settled') continue;
          let expected: bigint;
          if (fact.target === 'insurance') {
            seen.insured++;
            // 2:1 on a dealer blackjack found by the peek, else lost.
            expected = after.outcome!.dealer.peek === 'blackjack' ? 2n * inHalves(fact.stake) : -inHalves(fact.stake);
          } else {
            const round = current.outcome!;
            const hand = round.hands.find((h) => h.target === fact.target)!;
            if (hand.surrendered) seen.surrendered++;
            expected = expectedNet(hand, round.hands.length, round.dealer.cards.filter((c) => c !== null), inHalves(fact.stake));
            if (fact.target === 'hand-1') rounds++;
          }
          t.equal(inHalves(fact.net), expected);
          halves += expected;
        }
        const staked = state.wagers.reduce((sum, wager) => sum + inHalves(wager.amount), 0n);
        t.equal(inHalves(state.balance) + staked, halves);
      }
      t.equal([seen.split > 0, seen.insured > 0, seen.surrendered > 0, seen.seatSettled > 0], [true, true, true, true]);
      t.record('final', { balance: state.balance, hash: checkpointHash(state) });
    },
  },
  {
    name: 'blackjack table: a full trace with players, insurance and splits (compared across runtimes)',
    run: (t) => {
      let state = createActivity(withPlayers(2, ['10', '25', '10', '100']), BJ_STREAM);
      const trace: unknown[] = [checkpointHash(state)];
      for (let i = 0; i < 40; i++) {
        const current = view(state);
        const command: Command =
          state.phase === 'revealing-outcome'
            ? SETTLE
            : current.insuranceOffer
              ? NO_INSURANCE
              : current.playActions.length > 0
                ? { kind: 'play', action: current.playActions.includes('split') ? 'split' : current.playActions[i % 2]! }
                : state.wagers.length === 0
                  ? bet('20')
                  : DEAL;
        const next = step(state, command);
        state = next.state;
        trace.push({ facts: next.facts, view: view(state), hash: checkpointHash(state) });
      }
      t.record('trace', trace);
    },
  },
];


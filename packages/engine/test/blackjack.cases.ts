// The blackjack core round through the engine interface (seam 1). Rules and
// payouts come from the launch rules (#3 / spec #51): six decks, 3:2 naturals,
// U.S. hole card with peek, S17/H17 dealer, double on any first two cards with
// no double-for-less, cut card after floor(312 x penetration) cards with the
// cut-card round finished and no burn card. Shuffled cards come from the
// independent Python reference (draws.cases); stacked shoes name their cards.
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
  type Command,
  type DomainFact,
} from '../src';

import { run, status, step } from './activity.fixtures';
import { BJ_SPEC, BJ_STREAM, bet, CUT, DEAL, DOUBLE, FINAL, HIT, S17_LS, SETTLE, STAND, stacked, STOP } from './blackjack.fixtures';
import { throws, ZERO } from './fixtures';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const view = (state: BlackjackActivityState) => readPermittedView(state);
const label = (card: { rank: number; suit: string } | null) => (card === null ? 'down' : `${RANKS[card.rank - 1]}${card.suit[0]!.toUpperCase()}`);
const cards = (state: BlackjackActivityState) => {
  const round = view(state).round;
  return round && { dealer: round.dealer.cards.map(label), hand: round.hands.map((hand) => hand.cards.map(label)) };
};
/** Ranks only: "dealer: T 6 A, hand: T 6 9". */
const ranks = (state: BlackjackActivityState) => {
  const round = view(state).round;
  return (
    round && {
      dealer: round.dealer.cards.map((card) => (card ? RANKS[card.rank - 1] : 'down')).join(' '),
      hand: round.hands[0]!.cards.map((card) => RANKS[card.rank - 1]).join(' '),
    }
  );
};
const settled = (facts: readonly DomainFact[]) =>
  facts.filter((fact) => fact.kind === 'wager-settled').map((fact) => [fact.target, fact.result, fact.net, fact.returned]);
const fresh = () => createActivity(BJ_SPEC, BJ_STREAM);
const withRules = (change: Partial<BlackjackActivitySpecification['rules']>): BlackjackActivitySpecification => ({
  ...BJ_SPEC,
  rules: { ...S17_LS, ...change },
});
const H17 = withRules({ dealer: 'H17' });
const envelope = (state: BlackjackActivityState, command: Command, commandId = `c${state.sequence}`) => ({ sequence: state.sequence, commandId, command });

/** Bets, deals and plays a stacked shoe, then settles. */
function playOut(shoe: string, amount: string, actions: Command[], spec = BJ_SPEC) {
  const revealing = run(stacked(shoe, spec), [bet(amount), DEAL, ...actions]).state;
  const { state, facts } = step(revealing, SETTLE);
  return { settled: settled(facts), balance: state.balance, cards: ranks(revealing), revealing };
}

const assessed = (state: BlackjackActivityState, command: Command) => {
  const result = advanceActivity(state, envelope(state, command));
  if (result.status !== 'committed') throw new Error(`expected an assessment, got ${result.status}`);
  return result;
};

export const blackjackCases: TestCase[] = [
  {
    name: 'blackjack: a round deals player, dealer up, player, dealer hole from the top of a fresh shuffle',
    run: (t) => {
      const { state, facts } = run(fresh(), [bet('10'), DEAL]);
      // Shoe top (Python reference): T, T, J, 6, A, T, 9, T, 5, 3.
      t.equal(cards(state), { dealer: ['TS', 'down'], hand: [['TS', 'JD']] });
      t.equal(
        facts.filter((fact) => fact.kind === 'card-dealt').map((fact) => fact.kind === 'card-dealt' && [fact.to, label(fact.card)]),
        [
          ['hand-1', 'TS'],
          ['dealer', 'TS'],
          ['hand-1', 'JD'],
          ['dealer', 'down'],
        ],
      );
      // A ten up is peeked; the hole 6 is no blackjack, and the peek reveals no rank.
      t.equal(view(state).round?.dealer.peek, 'no-blackjack');
      t.equal([state.phase, view(state).playActions], ['open-decision', ['hit', 'stand', 'double']]);
      t.equal(view(state).shoe.remaining, 308);
    },
  },
  {
    name: 'blackjack: standing on 20 against a dealer 16 that draws to 17 wins even money (S17)',
    run: (t) => {
      let { state, facts } = step(run(fresh(), [bet('10'), DEAL]).state, STAND);
      t.equal(cards(state), { dealer: ['TS', '6S', 'AD'], hand: [['TS', 'JD']] });
      t.equal(state.phase, 'revealing-outcome');
      t.equal(facts.map((fact) => fact.kind), ['played', 'hole-card-revealed', 'card-dealt']);
      ({ state, facts } = step(state, SETTLE));
      t.equal(settled(facts), [['hand-1', 'win', '10', '20']]);
      t.equal([state.phase, state.balance, state.wagers], ['settled-outcome', '1010', []]);
      // Round 2 continues from the same shoe: T, 9 up, T, hole 5; dealer 14 draws the 3 to 17.
      ({ state, facts } = run(state, [bet('20'), DEAL, STAND, SETTLE]));
      t.equal(cards(state), { dealer: ['9H', '5S', '3H'], hand: [['TH', 'TD']] });
      t.equal(settled(facts), [['hand-1', 'win', '20', '40']]);
      t.equal(state.balance, '1030');
    },
  },

  // ---- naturals and the peek ------------------------------------------------
  {
    name: 'blackjack: a natural pays 3:2 in exact half units, and a dealer 2-9 up card is not peeked',
    run: (t) => {
      // A,K against a 9 up: no peek, no decision, and the hole card is turned at once.
      const { state, facts } = run(stacked('A 9 K 7'), [bet('15'), DEAL]);
      t.equal(facts.some((fact) => fact.kind === 'peeked'), false);
      t.equal([state.phase, view(state).round?.dealer.peek, view(state).playActions], ['revealing-outcome', 'not-needed', []]);
      t.equal(ranks(state), { dealer: '9 7', hand: 'A K' });
      t.equal(view(state).round?.hands[0]?.natural, true);
      const end = step(state, SETTLE);
      // 15 x 3/2 = 22.5 net; 37.5 returned; 1,000 - 15 + 37.5 = 1,022.5.
      t.equal(settled(end.facts), [['hand-1', 'win', '45/2', '75/2']]);
      t.equal(end.state.balance, '2045/2');
    },
  },
  {
    name: 'blackjack: a natural against a peeked ten that is not a blackjack pays 3:2',
    run: (t) => {
      const result = playOut('A T K 6', '10', []);
      t.equal(result.cards, { dealer: 'T 6', hand: 'A K' });
      t.equal(view(result.revealing).round?.dealer.peek, 'no-blackjack');
      t.equal(result.settled, [['hand-1', 'win', '15', '25']]);
      t.equal(result.balance, '1015');
    },
  },
  {
    name: 'blackjack: a dealer blackjack found by the peek ends the round before any decision (ace up and ten up)',
    run: (t) => {
      for (const shoe of ['9 A 8 K', '9 K 8 A']) {
        const { state, facts } = run(stacked(shoe), [bet('10'), DEAL]);
        t.equal(
          facts.filter((fact) => fact.kind === 'peeked').map((fact) => fact.kind === 'peeked' && fact.result),
          ['blackjack'],
        );
        t.equal([state.phase, view(state).playActions, view(state).legalCommands], ['revealing-outcome', [], ['settle-turn', 'request-stop']]);
        t.equal(settled(step(state, SETTLE).facts), [['hand-1', 'loss', '-10', '0']]);
      }
    },
  },
  {
    name: 'blackjack: a natural against a dealer blackjack pushes',
    run: (t) => {
      const result = playOut('A A K Q', '10', []);
      t.equal(result.cards, { dealer: 'A Q', hand: 'A K' });
      t.equal(result.settled, [['hand-1', 'push', '0', '10']]);
      t.equal(result.balance, '1000');
    },
  },
  {
    name: 'blackjack: a negative peek reveals no rank: the view is the same whatever the hole card and the shoe hold',
    run: (t) => {
      // Ten up, 16 in hand; hole 6 or 7 (both no blackjack), different cards behind.
      const a = run(stacked('T T 6 6 2 3'), [bet('10'), DEAL]).state;
      const b = run(stacked('T T 6 7 9 K'), [bet('10'), DEAL]).state;
      t.equal(view(a).round?.dealer.cards[1], null);
      t.equal([view(a).round?.dealer.total, view(a).round?.dealer.peek], [{ value: 10, soft: false }, 'no-blackjack']);
      t.equal(view(a), view(b));
      // An ace up is peeked the same way.
      const c = run(stacked('T A 6 6'), [bet('10'), DEAL]).state;
      const d = run(stacked('T A 6 9'), [bet('10'), DEAL]).state;
      t.equal([view(c), view(c).round?.dealer.peek], [view(d), 'no-blackjack']);
    },
  },
  {
    name: 'blackjack: facts and views never carry the concealed hole card, and hold no shoe or random state',
    run: (t) => {
      const keys: string[] = [];
      const collect = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (typeof value === 'object' && value !== null) {
          for (const [key, inner] of Object.entries(value)) {
            keys.push(key);
            collect(inner);
          }
        }
      };
      const { state, facts } = run(fresh(), [bet('10'), DEAL]);
      // The hole card is the 6 of spades from deck 3 (Python reference); nothing visible names it.
      const hole = { deck: 3, suit: 'spades', rank: 6 };
      t.equal(JSON.stringify([facts, view(state)]).includes(JSON.stringify(hole)), false);
      t.equal(facts.filter((fact) => fact.kind === 'card-dealt' && fact.card === null).length, 1);
      collect(view(state));
      t.equal(
        keys.filter((key) => ['random', 'key', 'session', 'block', 'lane', 'order', 'next', 'cut', 'identities', 'receipts'].includes(key)),
        [],
      );
      // Revealed at the round's end, as a fact and in the view.
      const done = step(state, STAND);
      t.equal(done.facts.find((fact) => fact.kind === 'hole-card-revealed'), { kind: 'hole-card-revealed', turn: 1, card: hole });
      t.equal(view(done.state).round?.dealer.cards[1], hole);
    },
  },

  // ---- player actions -----------------------------------------------------
  {
    name: 'blackjack: doubling 11 takes one card for the whole stake again and settles at the doubled stake',
    run: (t) => {
      // 6,5 vs 6 up; double draws a ten for 21; dealer 6,T = 16 draws 9 and busts.
      const ready = run(stacked('6 6 5 T T 9'), [bet('10'), DEAL]).state;
      const doubled = step(ready, DOUBLE);
      t.equal(doubled.facts.slice(0, 2), [
        { kind: 'played', turn: 1, target: 'hand-1', action: 'double' },
        { kind: 'wager-changed', target: 'hand-1', amount: '20', previous: '10' },
      ]);
      t.equal([doubled.state.balance, doubled.state.wagers, doubled.state.phase], ['980', [{ target: 'hand-1', amount: '20' }], 'revealing-outcome']);
      t.equal(ranks(doubled.state), { dealer: '6 T 9', hand: '6 5 T' });
      t.equal(view(doubled.state).round?.hands[0]?.doubled, true);
      const end = step(doubled.state, SETTLE);
      t.equal(settled(end.facts), [['hand-1', 'win', '20', '40']]);
      t.equal(end.state.balance, '1020');
    },
  },
  {
    name: 'blackjack: double is offered on any first two cards (soft 17 here), never after a hit',
    run: (t) => {
      const soft = run(stacked('A 5 6 4 3 T'), [bet('10'), DEAL]).state;
      t.equal([view(soft).round?.hands[0]?.total, view(soft).playActions], [{ value: 17, soft: true }, ['hit', 'stand', 'double']]);
      const hit = step(run(stacked('2 5 3 4 3 T'), [bet('10'), DEAL]).state, HIT).state;
      t.equal(view(hit).playActions, ['hit', 'stand']);
      const attempt = assessed(hit, DOUBLE);
      t.equal(attempt.facts, [{ kind: 'illegal-action', command: DOUBLE, reason: 'action-not-available' }]);
      t.equal(
        [attempt.receipt.disposition, attempt.state.wagers, attempt.state.balance, attempt.state.round],
        ['assessed', hit.wagers, hit.balance, hit.round],
      );
    },
  },
  {
    name: 'blackjack: no double-for-less: a double needs the whole stake again',
    run: (t) => {
      const short = run(stacked('6 6 5 T T 9', { ...BJ_SPEC, funding: '19' }), [bet('10'), DEAL]).state;
      const attempt = assessed(short, DOUBLE);
      t.equal(attempt.facts, [{ kind: 'illegal-action', command: DOUBLE, reason: 'insufficient-funds' }]);
      t.equal([attempt.state.balance, attempt.state.wagers, attempt.state.round, attempt.state.shoe], ['9', short.wagers, short.round, short.shoe]);
      // Exactly the stake left: the double goes ahead and the balance reaches 0.
      const exact = run(stacked('6 6 5 T T 9', { ...BJ_SPEC, funding: '20' }), [bet('10'), DEAL, DOUBLE]).state;
      t.equal([exact.balance, exact.wagers], ['0', [{ target: 'hand-1', amount: '20' }]]);
    },
  },
  {
    name: 'blackjack: a bust loses at once; the dealer draws nothing but the hole card is still revealed',
    run: (t) => {
      const result = playOut('T 6 6 T T 5', '10', [HIT]);
      t.equal(result.cards, { dealer: '6 T', hand: 'T 6 T' });
      t.equal(view(result.revealing).round?.hands[0]?.busted, true);
      t.equal(result.settled, [['hand-1', 'loss', '-10', '0']]);
    },
  },
  {
    name: 'blackjack: hitting to 21 ends the hand; equal totals push; a lower total loses',
    run: (t) => {
      const to21 = run(stacked('5 9 6 T T'), [bet('10'), DEAL, HIT]).state;
      t.equal([to21.phase, ranks(to21)], ['revealing-outcome', { dealer: '9 T', hand: '5 6 T' }]);
      t.equal(settled(step(to21, SETTLE).facts), [['hand-1', 'win', '10', '20']]);
      t.equal(playOut('T T 8 8', '10', [STAND]).settled, [['hand-1', 'push', '0', '10']]);
      t.equal(playOut('T T 7 8', '10', [STAND]).settled, [['hand-1', 'loss', '-10', '0']]);
    },
  },
  {
    name: 'blackjack: S17 stands on soft 17; H17 hits it',
    run: (t) => {
      // Player 18; dealer 6 up, ace in the hole; the next cards are 5 and 7.
      const s17 = playOut('T 6 8 A 5 7', '10', [STAND]);
      t.equal([s17.cards?.dealer, s17.settled], ['6 A', [['hand-1', 'win', '10', '20']]]);
      // H17: 6 + A + 5 = 12 (the ace now counts one), + 7 = 19.
      const h17 = playOut('T 6 8 A 5 7', '10', [STAND], H17);
      t.equal([h17.cards?.dealer, h17.settled], ['6 A 5 7', [['hand-1', 'loss', '-10', '0']]]);
      // Hard 17 stands under both rules.
      for (const spec of [BJ_SPEC, H17]) t.equal(playOut('T T 8 7 5', '10', [STAND], spec).cards?.dealer, 'T 7');
    },
  },

  // ---- penetration and the shoe ---------------------------------------------
  {
    name: 'blackjack: the cut card sits after floor(312 x penetration) cards for every penetration from 50% to 80%',
    run: (t) => {
      for (const penetration of [50, 55, 60, 65, 70, 75, 80]) {
        const { facts } = run(createActivity(withRules({ penetration }), BJ_STREAM), [bet('10'), DEAL]);
        t.equal(facts.find((fact) => fact.kind === 'shoe-shuffled'), { kind: 'shoe-shuffled', cards: 312, cut: CUT[penetration] as number });
      }
      for (const penetration of [45, 85, 72, 77.5]) {
        t.equal(throws(() => createActivity(withRules({ penetration }), BJ_STREAM)), 'ActivitySpecificationError');
      }
    },
  },
  {
    name: 'blackjack: the round that reaches the cut card is finished; the next round starts a fresh shoe with no burn card',
    run: (t) => {
      // Two cards before the cut (234 at 75%): the round deals across it and plays to the end.
      const crossing = run(stacked('T T 6 6 9', BJ_SPEC, 232), [bet('10'), DEAL]).state;
      t.equal([crossing.phase, view(crossing).shoe], ['open-decision', { cards: 312, remaining: 76, shuffleBeforeNextRound: true }]);
      const finished = run(crossing, [HIT, SETTLE]).state;
      t.equal(ranks(finished)?.hand, 'T 6 9');
      const next = run(finished, [bet('10'), DEAL]);
      t.equal(next.facts.find((fact) => fact.kind === 'shoe-shuffled'), { kind: 'shoe-shuffled', cards: 312, cut: 234 });
      // The fresh shoe is the stream's first shuffle; its top four cards are dealt with none burned.
      t.equal(cards(next.state), { dealer: ['TS', 'down'], hand: [['TS', 'JD']] });
      t.equal(view(next.state).shoe, { cards: 312, remaining: 308, shuffleBeforeNextRound: false });
      // One card before the cut, a round is still dealt from the same shoe.
      t.equal(run(stacked('T T 6 6 9', BJ_SPEC, 233), [bet('10'), DEAL]).facts.some((fact) => fact.kind === 'shoe-shuffled'), false);
    },
  },
  {
    name: 'blackjack: at every penetration a shoe is replaced only after a round has dealt past its cut card (property)',
    run: (t) => {
      for (const penetration of [50, 55, 60, 65, 70, 75, 80]) {
        const cut = CUT[penetration] as number;
        let state = run(createActivity({ ...withRules({ penetration }), funding: '100000' }, { ...ZERO, key: [penetration, 7] }), [bet('10'), DEAL]).state;
        let roundStart = 0;
        let shuffles = 0;
        while (shuffles < 2) {
          state = run(state, state.phase === 'open-decision' ? [STAND, SETTLE] : [SETTLE]).state;
          const dealt = 312 - view(state).shoe.remaining;
          const next = run(state, [bet('10'), DEAL]);
          if (next.facts.some((fact) => fact.kind === 'shoe-shuffled')) {
            shuffles++;
            // The last round of the old shoe began before the cut and finished at or past it.
            t.equal([penetration, roundStart < cut, dealt >= cut], [penetration, true, true]);
            roundStart = 0;
          } else {
            t.equal([penetration, dealt < cut], [penetration, true]);
            roundStart = dealt;
          }
          state = next.state;
        }
      }
    },
  },

  // ---- phases and legality --------------------------------------------------
  {
    name: 'blackjack: each phase allows only its commands; a hand in play takes only playing actions',
    run: (t) => {
      const betting = step(stacked('T 9 7 8 5'), bet('10')).state;
      const playing = step(betting, DEAL).state;
      const revealing = step(playing, STAND).state;
      const settledOutcome = step(revealing, SETTLE).state;
      const legal = (state: BlackjackActivityState) => [state.phase, view(state).legalCommands];
      t.equal([betting, playing, revealing, settledOutcome].map(legal), [
        ['open-decision', ['place-wager', 'begin-turn', 'request-stop']],
        ['open-decision', ['play']],
        ['revealing-outcome', ['settle-turn', 'request-stop']],
        ['settled-outcome', ['place-wager', 'begin-turn', 'request-stop']],
      ]);
      t.equal(status(advanceActivity(betting, envelope(betting, STAND))), 'rejected:not-legal-in-phase');
      for (const command of [bet('20'), DEAL, STOP, SETTLE]) {
        t.equal(status(advanceActivity(playing, envelope(playing, command))), 'rejected:not-legal-in-phase');
      }
      t.equal([view(betting).wagersCommitted, view(playing).wagersCommitted], [false, true]);
      t.equal(status(advanceActivity(playing, envelope(playing, { kind: 'play', action: 'split' } as never))), 'rejected:malformed');
    },
  },
  {
    name: 'blackjack: initial wagers are whole units within 10/1,000 on the learner box; illegal ones are assessed, drawing nothing',
    run: (t) => {
      const base = fresh();
      const attempts: [Command, string][] = [
        [bet('9'), 'below-minimum'],
        [bet('1001'), 'above-maximum'],
        [bet('25/2'), 'not-whole-units'],
        [{ kind: 'place-wager', target: 'hand-2', amount: '10' }, 'unknown-target'],
        [bet('0'), 'no-wager-to-remove'],
        [DEAL, 'no-wager'],
      ];
      for (const [command, reason] of attempts) {
        const result = assessed(base, command);
        t.equal(
          [result.facts, result.state.balance, result.state.wagers, result.state.random],
          [[{ kind: 'illegal-action', command, reason }], '1000', [], base.random],
        );
      }
      t.equal(step(base, bet('1000')).state.balance, '0');
      t.equal(step(step(base, bet('10')).state, bet('0')).state.wagers, []);
      t.equal(assessed(createActivity({ ...BJ_SPEC, funding: '5' }, BJ_STREAM), bet('10')).facts[0], {
        kind: 'illegal-action',
        command: bet('10'),
        reason: 'insufficient-funds',
      });
    },
  },
  {
    name: 'blackjack: stopping between rounds returns the wager; stopping once the hand is played settles it automatically',
    run: (t) => {
      const between = run(stacked('T 9 7 8 5'), [bet('10'), STOP, FINAL]);
      t.equal(between.facts.slice(1), [
        { kind: 'stop-requested', phase: 'open-decision' },
        { kind: 'wager-returned', target: 'hand-1', amount: '10' },
        { kind: 'activity-completed', balance: '1000' },
      ]);
      const stopped = run(stacked('T 9 9 8 5'), [bet('10'), DEAL, STAND, STOP]).state;
      t.equal([stopped.phase, view(stopped).wagersCommitted], ['final-settlement', true]);
      const { state, facts } = step(stopped, FINAL);
      t.equal(settled(facts), [['hand-1', 'win', '10', '20']]);
      t.equal([state.phase, state.balance], ['completed', '1010']);
    },
  },
  {
    name: 'blackjack: money is conserved over random play, and every settlement follows from the final cards (property)',
    run: (t) => {
      const driver = RandomStream.create({ ...ZERO, key: [0x626c6163, 0x6b6a6163] });
      let state = createActivity({ ...BJ_SPEC, funding: '20000' }, BJ_STREAM);
      // In half units, so 3:2 stays exact.
      let halves = 40000n;
      let rounds = 0;
      const total = (cs: readonly { rank: number }[]) => {
        const hard = cs.reduce((sum, card) => sum + Math.min(card.rank, 10), 0);
        return cs.some((card) => card.rank === 1) && hard <= 11 ? hard + 10 : hard;
      };
      const inHalves = (amount: string) => (amount.endsWith('/2') ? BigInt(amount.slice(0, -2)) : BigInt(amount) * 2n);
      while (rounds < 300) {
        const actions = view(state).playActions;
        const command: Command =
          state.phase === 'revealing-outcome'
            ? SETTLE
            : actions.length > 0
              ? { kind: 'play', action: actions[uniformInt(driver, actions.length)]! }
              : state.wagers.length === 0
                ? bet(String(10 + uniformInt(driver, 41)))
                : DEAL;
        const before = view(state).round;
        const next = step(state, command);
        state = next.state;
        for (const fact of next.facts) {
          if (fact.kind !== 'wager-settled') continue;
          rounds++;
          const player = total(before!.hands[0]!.cards);
          const dealerCards = before!.dealer.cards.filter((card) => card !== null);
          const dealer = total(dealerCards);
          const playerNatural = before!.hands[0]!.cards.length === 2 && player === 21;
          const dealerNatural = total(dealerCards.slice(0, 2)) === 21;
          const stake = inHalves(fact.stake);
          const expected = playerNatural
            ? dealerNatural ? 0n : (stake * 3n) / 2n
            : dealerNatural || player > 21 ? -stake
              : dealer > 21 || player > dealer ? stake
                : player === dealer ? 0n : -stake;
          t.equal(inHalves(fact.net), expected);
          halves += expected;
        }
        const staked = state.wagers.reduce((sum, wager) => sum + inHalves(wager.amount), 0n);
        t.equal(inHalves(state.balance) + staked, halves);
      }
      t.record('final', { balance: state.balance, hash: checkpointHash(state) });
    },
  },

  // ---- checkpoints and specification ----------------------------------------
  {
    name: 'blackjack: create pins the rule set and refuses unsupported rules',
    run: (t) => {
      const state = fresh();
      t.equal([state.identities.game, state.identities.rules], ['blackjack', { id: 'blackjack-six-deck', version: 1 }]);
      t.equal(state.rules, { decks: 6, dealer: 'S17', lateSurrender: true, penetration: 75, limits: { initial: { min: '10', max: '1000' } } });
      t.equal([state.shoe, state.round, state.random.block], [null, null, [0, 0]]);
      const bad: Partial<BlackjackActivitySpecification['rules']>[] = [
        { decks: 8 as never },
        { dealer: 'H18' as never },
        { lateSurrender: 'yes' as never },
        { id: 'blackjack-eight-deck' },
        { version: 2 },
        { limits: { initial: { min: '1000', max: '10' } } },
      ];
      t.equal(
        bad.map((change) => throws(() => createActivity(withRules(change), BJ_STREAM))),
        bad.map(() => 'ActivitySpecificationError'),
      );
    },
  },
  {
    name: 'blackjack: checkpoints round-trip exactly in every phase and resume the same round',
    run: (t) => {
      const commands = [bet('10'), DEAL, HIT, STAND, SETTLE, bet('25'), DEAL, STOP, FINAL];
      const states: BlackjackActivityState[] = [stacked('5 9 6 T 3 A 9 K 7')];
      for (const command of commands) states.push(step(states.at(-1) as BlackjackActivityState, command).state);
      t.equal(
        states.map((state) => state.phase),
        ['open-decision', 'open-decision', 'open-decision', 'open-decision', 'revealing-outcome', 'settled-outcome', 'open-decision', 'revealing-outcome', 'final-settlement', 'completed'],
      );
      for (const state of states) {
        const decoded = decodeCheckpoint(encodeCheckpoint(state));
        if (!decoded.ok) throw new Error(decoded.error.message);
        t.equal(decoded.state, state);
      }
      // A decoded mid-hand checkpoint continues exactly as the original.
      const middle = states[3] as BlackjackActivityState;
      const resumed = decodeCheckpoint(encodeCheckpoint(middle));
      if (!resumed.ok) throw new Error('round trip failed');
      t.equal(checkpointHash(step(resumed.state as BlackjackActivityState, STAND).state), checkpointHash(states[4] as BlackjackActivityState));
    },
  },
  {
    name: 'blackjack: damaged or unsupported checkpoints return explicit recovery errors',
    run: (t) => {
      const text = encodeCheckpoint(run(fresh(), [bet('10'), DEAL]).state);
      const edit = (change: (value: Record<string, Record<string, unknown>>) => void) => {
        const value = JSON.parse(text) as Record<string, Record<string, unknown>>;
        change(value);
        return JSON.stringify(value);
      };
      const kind = (input: string) => {
        const result = decodeCheckpoint(input);
        return result.ok ? 'ok' : result.error.kind;
      };
      const order = (v: Record<string, Record<string, unknown>>) => v.shoe!.order as number[];
      const damaged = [
        edit((v) => (order(v)[0] = order(v)[1]!)),
        edit((v) => (v.shoe!.order = order(v).slice(1))),
        edit((v) => (v.shoe!.cut = 200)),
        edit((v) => (v.shoe!.next = 313)),
        edit((v) => (v.round!.holeRevealed = true)),
        edit((v) => (v.round!.active = 1)),
        edit((v) => (v.round!.peek = 'peeked')),
        edit((v) => ((v.round!.dealer as Record<string, unknown>[])[0]!.rank = 14)),
        edit((v) => (v.wagers = [] as never)),
        edit((v) => (v.rules!.penetration = 77)),
        edit((v) => (v.round = null as never)),
        edit((v) => delete v.shoe),
        edit((v) => ((v as Record<string, unknown>).outcome = null)),
      ];
      t.equal(damaged.map(kind), damaged.map(() => 'damaged'));
      const unsupported = [
        edit((v) => (v.identities!.rules = { id: 'blackjack-six-deck', version: 2 })),
        edit((v) => (v.identities!.rules = { id: 'roulette-single-zero', version: 1 })),
      ];
      t.equal(unsupported.map(kind), unsupported.map(() => 'unsupported'));
    },
  },
  {
    name: 'blackjack: a full transition trace with checkpoint hashes (compared across runtimes)',
    run: (t) => {
      let state = fresh();
      const trace: unknown[] = [checkpointHash(state)];
      // From the shoe top: 20 v T stands; then 20 v 9; then T,5 v T (Python reference order).
      for (const command of [bet('10'), DEAL, STAND, SETTLE, bet('15'), DEAL, STAND, SETTLE, bet('25'), DEAL, HIT]) {
        if (!view(state).legalCommands.includes(command.kind)) continue;
        const next = step(state, command);
        state = next.state;
        trace.push({ facts: next.facts, view: view(state), hash: checkpointHash(state) });
      }
      t.record('trace', trace);
      t.record('checkpoint', encodeCheckpoint(state));
    },
  },
];

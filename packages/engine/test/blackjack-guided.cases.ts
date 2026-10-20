// Guided blackjack at the engine interface: basic strategy and basic with
// deviations (spec #51, Blackjack reference). Each playing decision is
// assessed before it executes against the pinned playing policy (test
// fixtures written from the published S17 LS basic strategy and the certified
// S17 curriculum; the certified tables are checked in the definitions
// package). Shoes are stacked so the exposed cards, and so the Hi-Lo count, are
// known: 2-6 count +1, 7-9 count 0, tens and aces -1; the divisor is the
// physical shoe to the nearest half deck, and the true count truncates toward
// zero.
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  checkpointHash,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  explainPlay,
  isPlayCorrection,
  readPermittedView,
  validateStrategy,
  type BlackjackActivitySpecification,
  type BlackjackActivityState,
  type BlackjackPlaySituation,
  type Command,
  type DomainFact,
  type PlayExplanation,
  type StrategyDefinition,
} from '../src';

import { run, step } from './activity.fixtures';
import { bet, BJ_SPEC, BJ_STREAM, DEAL, DOUBLE, HIT, insure, NO_INSURANCE, SETTLE, SPLIT, STAND, stacked, withPlayers } from './blackjack.fixtures';
import { TEST_BASIC, TEST_DEVIATING, TEST_POLICY } from './blackjack-strategy.fixtures';

const RETRY: Command = { kind: 'retry-correction' };
const OVERRIDE: Command = { kind: 'override-correction' };

const guided = (definition: StrategyDefinition, extra: Partial<BlackjackActivitySpecification> = {}): BlackjackActivitySpecification => ({
  ...BJ_SPEC,
  strategy: { definition, parameters: {} },
  ...extra,
});
const funded = (definition: StrategyDefinition, funding: string) => guided(definition, { funding });

/**
 * A guided activity whose shoe deals `seen` first (cards already exposed in
 * earlier rounds) and then `round`; the rest in canonical order.
 */
function counted(seen: string, round: string, spec: BlackjackActivitySpecification): BlackjackActivityState {
  const base = stacked(`${seen} ${round}`, spec);
  const next = seen.split(' ').filter(Boolean).length;
  const decoded = decodeCheckpoint(encodeCheckpoint({ ...base, shoe: { ...(base.shoe as NonNullable<BlackjackActivityState['shoe']>), next } }));
  if (!decoded.ok) throw new Error(decoded.error.message);
  return decoded.state as BlackjackActivityState;
}

/** Eight low cards seen: running count +8. */
const PLUS_EIGHT = '2 3 4 5 6 2 3 4';
/** 4,3 against a 10 (hole 9), then a 9: a three-card 16 against a 10. */
const SIXTEEN = '4 T 3 9 9';
/** Eighteen low cards seen: running count +18. */
const PLUS_EIGHTEEN = '2 3 4 5 6 2 3 4 5 6 2 3 4 5 6 2 3 4';

const view = (state: BlackjackActivityState) => readPermittedView(state);
const kinds = (facts: readonly DomainFact[]) => facts.map((fact) => fact.kind);
const held = (state: BlackjackActivityState) => {
  const correction = state.strategy?.correction;
  return correction && isPlayCorrection(correction) ? correction : null;
};
const prescribed = (explanation: PlayExplanation) => explanation.prescribed.action;
const adherence = (state: BlackjackActivityState) => view(state).strategy?.adherence;

/** The decision the activity waits on, explained with Explain play (the same answer the activity assesses). */
function situation(cards: string, up: string, extra: Partial<BlackjackPlaySituation> = {}): BlackjackPlaySituation {
  const rank = (label: string) => (({ A: 1, T: 10, J: 11, Q: 12, K: 13 }) as Record<string, number>)[label] ?? Number(label);
  const card = (label: string) => ({ deck: 0, suit: 'spades' as const, rank: rank(label) as 1 });
  return {
    game: 'blackjack',
    rules: { dealer: 'S17', lateSurrender: true },
    decision: 'hand',
    cards: cards.split(' ').map(card),
    hands: 1,
    up: card(up),
    balance: '990',
    stake: '10',
    shoe: { running: 0, remaining: 308 },
    ...extra,
  };
}
const explained = (definition: StrategyDefinition, s: BlackjackPlaySituation) => {
  const result = explainPlay(definition, s);
  if (!result.ok) throw new Error(result.error);
  return result.explanation;
};

export const blackjackGuidedCases: TestCase[] = [
  // ---- definitions --------------------------------------------------------
  {
    name: 'blackjack guided: a playing policy is vocabulary data; basic and basic with deviations are runnable with no betting instructions',
    run: (t) => {
      t.equal(validateStrategy(TEST_BASIC), { diagnostics: [], runnable: true });
      t.equal(validateStrategy(TEST_DEVIATING), { diagnostics: [], runnable: true });
      // A copy built from the same data (as a builder would) pins and plays identically.
      const copy = JSON.parse(JSON.stringify(TEST_DEVIATING)) as StrategyDefinition;
      const play = (definition: StrategyDefinition) => run(counted(PLUS_EIGHT, '9 T 7 9', guided(definition)), [bet('10'), DEAL, STAND]).state;
      t.equal(checkpointHash(play(copy)), checkpointHash(play(TEST_DEVIATING)));
    },
  },
  {
    name: 'blackjack guided: Validate names a malformed table row, a surrender the declared table lacks, a Fab 4 play without late surrender and two deviations for one play',
    run: (t) => {
      const categories = (definition: unknown) => validateStrategy(definition).diagnostics.map((d) => `${d.category} ${d.path}`);
      const policy = TEST_DEVIATING.play as typeof TEST_POLICY;
      t.equal(categories({ ...TEST_BASIC, play: { ...TEST_POLICY, first: { ...TEST_POLICY.first, hard: TEST_POLICY.first.hard.slice(1) } } }), ['incomplete /play/first/hard']);
      const noSurrender = { ...TEST_DEVIATING, table: { ...TEST_DEVIATING.table as object, lateSurrender: false } };
      t.equal(categories(noSurrender).filter((d) => d.startsWith('incompatible')), ['incompatible /play/deviations/6', 'incompatible /play/deviations/7', 'incompatible /play']);
      const twice = { ...TEST_DEVIATING, play: { ...policy, deviations: [...policy.deviations, { ...policy.deviations[0], id: 'again', threshold: 2 }] } };
      t.equal(categories(twice), ['conflict /play/deviations/9']);
      t.equal(categories({ ...TEST_BASIC, game: 'roulette' }).includes('incomplete /play'), true);
      t.equal(categories(Object.fromEntries(Object.entries(TEST_BASIC).filter(([key]) => key !== 'play'))).includes('incomplete /instructions'), true);
    },
  },

  // ---- basic strategy -----------------------------------------------------
  {
    name: 'blackjack guided: the initial wager is the player\'s; a departing play waits in a correction before it executes, with the hand still in play',
    run: (t) => {
      // Soft 17 (A,6) against a 5: basic strategy doubles. The player stands.
      const dealt = run(stacked('A 5 6 T', guided(TEST_BASIC)), [bet('25'), DEAL]).state;
      t.equal([dealt.phase, adherence(dealt)], ['open-decision', { decisions: 0, followed: 0, departures: 0 }]);
      const { state, facts } = step(dealt, STAND);
      t.equal([state.phase, kinds(facts), state.wagers, state.balance], ['correction', ['correction-offered'], [{ target: 'hand-1', amount: '25' }], '975']);
      // Nothing was played or dealt: the hand still has its two cards, the hole card is still down.
      t.equal([state.outcome?.hands[0]?.cards.length, view(state).outcome?.dealer.cards[1], view(state).wagersCommitted], [2, null, true]);
      const explanation = held(state)?.explanation as PlayExplanation;
      t.equal([explanation.cell, explanation.preferred, explanation.prescribed, explanation.ifUnaffordable, explanation.situation.count], [
        { table: 'first', kind: 'soft', hand: 17, up: 5, play: 'double' },
        'double',
        { action: 'double', amount: null },
        { play: 'double', fallback: 'hit' },
        null,
      ]);
      t.equal(held(state)?.actual, { action: 'stand', amount: null });
      // A hand in play finishes: no stopping while the move is held.
      t.equal(view(state).legalCommands, ['retry-correction', 'override-correction']);
    },
  },
  {
    name: 'blackjack guided: retry plays the prescription; the departure is recorded once and a resent retry changes nothing',
    run: (t) => {
      const corrected = run(stacked('A 5 6 T', guided(TEST_BASIC)), [bet('25'), DEAL, STAND]).state;
      const envelope = { sequence: corrected.sequence, commandId: 'retry-1', command: RETRY };
      const first = advanceActivity(corrected, envelope);
      if (first.status !== 'committed') throw new Error('retry was not committed');
      t.equal(kinds(first.facts).slice(0, 3), ['departure-recorded', 'played', 'wager-changed']);
      t.equal([first.state.wagers, first.state.outcome?.hands[0]?.doubled, first.state.phase], [[{ target: 'hand-1', amount: '50' }], true, 'revealing-outcome']);
      t.equal(advanceActivity(first.state, envelope).status, 'duplicate');
      const strategy = view(first.state).strategy;
      t.equal([strategy?.departures.length, strategy?.departures[0]?.resolution, strategy?.adherence], [1, 'retried', { decisions: 1, followed: 0, departures: 1 }]);
    },
  },
  {
    name: 'blackjack guided: an override applies to that one decision and the strategy coaches the next',
    run: (t) => {
      // Round 1: hard 9 (5,4) against a 10 hits; the player stands and overrides. Round 2: 10,7 against 6 stands.
      const shoe = '5 T 4 9 T 6 7 T';
      let state = run(stacked(shoe, guided(TEST_BASIC)), [bet('10'), DEAL, STAND]).state;
      const overridden = step(state, OVERRIDE);
      t.equal(kinds(overridden.facts).slice(0, 2), ['departure-recorded', 'played']);
      state = run(overridden.state, [SETTLE, bet('10'), DEAL]).state;
      t.equal([state.strategy?.status, state.phase], ['active', 'open-decision']);
      const next = step(state, STAND);
      t.equal([next.state.phase, kinds(next.facts).includes('correction-offered')], ['revealing-outcome', false]);
      t.equal(view(next.state).strategy?.adherence, { decisions: 2, followed: 1, departures: 1 });
      t.equal([view(next.state).strategy?.overrideAffected, view(next.state).strategy?.overrideEndsCycle], [true, false]);
    },
  },
  {
    name: 'blackjack guided: an unaffordable double is replaced by its validated fallback and assessed against it; attempting it is an illegal action, not a departure',
    run: (t) => {
      // 11 (6,5) against a 5 doubles; 15 funds the 10 bet and leaves 5, so the fallback (hit) is prescribed.
      const dealt = run(stacked('6 5 5 T', funded(TEST_BASIC, '15')), [bet('10'), DEAL]).state;
      const tried = step(dealt, DOUBLE);
      t.equal([tried.state.phase, kinds(tried.facts)], ['open-decision', ['illegal-action']]);
      const hit = step(dealt, HIT);
      t.equal([hit.state.phase === 'correction', adherence(hit.state)], [false, { decisions: 1, followed: 1, departures: 0 }]);
      const standing = step(dealt, STAND).state;
      t.equal(
        [held(standing)?.explanation.preferred, held(standing)?.explanation.unavailable, prescribed(held(standing)?.explanation as PlayExplanation)],
        ['double', [{ play: 'double', reason: 'balance' }], 'hit'],
      );
      // Soft 18 (A,7) against a 4 doubles; unaffordable on the original late-surrender hand it stands.
      const soft = explained(TEST_BASIC, situation('A 7', '4', { balance: '5' }));
      t.equal([soft.preferred, soft.unavailable, prescribed(soft)], ['double', [{ play: 'double', reason: 'balance' }], 'stand']);
    },
  },
  {
    name: 'blackjack guided: an unaffordable split falls back by balance (8,8 against a 10 surrenders); at four hands it falls back by rule',
    run: (t) => {
      const short = explained(TEST_BASIC, situation('8 8', 'T', { balance: '5' }));
      t.equal([short.preferred, short.unavailable, prescribed(short)], ['split', [{ play: 'split', reason: 'balance' }], 'surrender']);
      const capped = explained(TEST_BASIC, situation('8 8', 'T', { hands: 4 }));
      t.equal([capped.unavailable, prescribed(capped)], [[{ play: 'split', reason: 'rule' }], 'hit']);
      // A split hand can't surrender: a short split 8,8 there hits.
      const split = explained(TEST_BASIC, situation('8 8', 'T', { hands: 2, balance: '5' }));
      t.equal([split.unavailable.map((u) => u.play), prescribed(split)], [['split', 'surrender'], 'hit']);
      // 16 against a 10 surrenders on the original hand; after a hit it can't, so it hits.
      t.equal([prescribed(explained(TEST_BASIC, situation('T 6', 'T'))), prescribed(explained(TEST_BASIC, situation('5 6 5', 'T')))], ['surrender', 'hit']);
    },
  },
  {
    name: 'blackjack guided: play-order funding: the last affordable double across split hands goes to the earliest live hand that prescribes it',
    run: (t) => {
      // 9,9 against a 6 splits; each hand draws a 2 for 11, which doubles. 30 funds the bet, the split and one double.
      let state = run(stacked('9 6 9 T 2 8 2 5', funded(TEST_BASIC, '30')), [bet('10'), DEAL, SPLIT]).state;
      t.equal(adherence(state), { decisions: 1, followed: 1, departures: 0 });
      state = step(state, DOUBLE).state;
      t.equal([state.balance, state.outcome?.active, state.phase], ['0', 1, 'open-decision']);
      // Hand 2's 11 can't be funded: it hits, and standing departs from that fallback.
      const standing = step(state, STAND).state;
      const explanation = held(standing)?.explanation as PlayExplanation;
      t.equal([explanation.situation.target, explanation.unavailable, prescribed(explanation)], ['hand-2', [{ play: 'double', reason: 'balance' }], 'hit']);
      t.equal(step(state, HIT).state.phase === 'correction', false);
    },
  },
  {
    name: 'blackjack guided: insurance is a decision: basic strategy declines; the departure is held before the peek',
    run: (t) => {
      const offered = run(stacked('9 A 7 T', guided(TEST_BASIC)), [bet('10'), DEAL]).state;
      t.equal(step(offered, NO_INSURANCE).state.phase === 'correction', false);
      const insured = step(offered, insure('5')).state;
      t.equal([insured.phase, held(insured)?.actual, prescribed(held(insured)?.explanation as PlayExplanation)], ['correction', { action: 'insure', amount: '5' }, 'decline-insurance']);
      // Nothing settled and the peek hasn't happened.
      t.equal([insured.outcome?.peek, insured.balance], ['pending', '990']);
    },
  },

  // ---- basic with deviations ------------------------------------------------
  {
    name: 'blackjack guided: with deviations Tableside supplies the count from exposed cards only; basic strategy shows none',
    run: (t) => {
      // Eight low cards seen (+8); this round shows 4, T and 3 (+1): +9 over 300 cards (6 decks to the half deck) is +1.
      const deviating = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_DEVIATING)), [bet('10'), DEAL]).state;
      t.equal(view(deviating).count, { running: 9, decks: '6', trueCount: 1 });
      t.equal(view(run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_BASIC)), [bet('10'), DEAL]).state).count, null);
      t.equal(view(run(counted(PLUS_EIGHT, SIXTEEN, BJ_SPEC), [bet('10'), DEAL]).state).count, null);
      // The face-down hole card never counts: a 2 or an 8 there gives the same count and the same prescription.
      for (const hole of ['2', '8']) {
        const other = run(counted(PLUS_EIGHT, `4 T 3 ${hole} 9`, guided(TEST_DEVIATING)), [bet('10'), DEAL, HIT]).state;
        t.equal([view(other).count, prescribed(held(step(other, HIT).state)?.explanation as PlayExplanation)], [{ running: 9, decks: '6', trueCount: 1 }, 'stand']);
      }
      // Before the next deal the count is the one the deal starts from: the hole card's 9 counts 0 once it is turned.
      t.equal(view(run(deviating, [HIT, STAND, SETTLE]).state).count, { running: 9, decks: '6', trueCount: 1 });
    },
  },
  {
    name: 'blackjack guided: 16 against a 10 stands at a true count of +1 or more and hits below; the correction carries the index and the published value',
    run: (t) => {
      // 4,3 against a 10 hits to 4,3,9: a three-card 16, where surrender is no longer offered.
      const atOne = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_DEVIATING)), [bet('10'), DEAL, HIT, HIT]).state;
      const explanation = held(atOne)?.explanation as PlayExplanation;
      t.equal([explanation.situation.count, explanation.cell, prescribed(explanation)], [{ running: 9, decks: '6', trueCount: 1 }, { table: 'later', kind: 'hard', hand: 16, up: 10, play: 'hit' }, 'stand']);
      t.equal([explanation.deviation?.id, explanation.deviation?.side, explanation.deviation?.threshold, explanation.deviation?.published.schlesinger], [
        '16v10',
        'at-or-above',
        1,
        { value: '+0', difference: 1, cost: [{ trueCount: 0, perBet: '+0.0000' }] },
      ]);
      // A fresh shoe: +1 over 307 cards is 0, below the index, so 16 hits.
      const fresh = run(stacked(SIXTEEN, guided(TEST_DEVIATING)), [bet('10'), DEAL, HIT, STAND]).state;
      t.equal([held(fresh)?.explanation.situation.count?.trueCount, held(fresh)?.explanation.deviation?.side, prescribed(held(fresh)?.explanation as PlayExplanation)], [0, 'below', 'hit']);
      // Basic strategy hits whatever the count.
      t.equal(run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_BASIC)), [bet('10'), DEAL, HIT, HIT]).state.phase === 'correction', false);
      // On the original two cards at a late-surrender table, 16 against a 10 surrenders whatever the count.
      t.equal(prescribed(held(run(counted(PLUS_EIGHT, '9 T 7 9', guided(TEST_DEVIATING)), [bet('10'), DEAL, STAND]).state)?.explanation as PlayExplanation), 'surrender');
    },
  },
  {
    name: 'blackjack guided: insurance at +3 or more; with deviations the player who declines is corrected to insure half the bet',
    run: (t) => {
      // +18 seen; this round shows 9, A, 7 (-1): +17 over 290 cards (5.5 decks) is +3.
      const offered = run(counted(PLUS_EIGHTEEN, '9 A 7 T', guided(TEST_DEVIATING)), [bet('10'), DEAL]).state;
      t.equal(view(offered).count, { running: 17, decks: '5.5', trueCount: 3 });
      const declined = step(offered, NO_INSURANCE).state;
      const explanation = held(declined)?.explanation as PlayExplanation;
      t.equal([explanation.situation.decision, explanation.preferred, explanation.prescribed, explanation.deviation?.id], ['insurance', 'insure', { action: 'insure', amount: '5' }, 'insurance']);
      // Retry insures 5; the dealer's ten in the hole pays it 2:1.
      const retried = step(declined, RETRY);
      t.equal(
        retried.facts.flatMap((fact) => (fact.kind === 'wager-settled' ? [[fact.target, fact.result, fact.net]] : [])),
        [['insurance', 'win', '10']],
      );
      // Unaffordable insurance falls back to declining.
      const short = explained(TEST_DEVIATING, situation('9 7', 'A', { decision: 'insurance', balance: '4', shoe: { running: 17, remaining: 290 } }));
      t.equal([short.unavailable, short.prescribed], [[{ play: 'insure', reason: 'balance' }], { action: 'decline-insurance', amount: null }]);
    },
  },
  {
    name: 'blackjack guided: Fab 4 surrender comes first where surrender is offered; I18 stand/hit applies where it is not',
    run: (t) => {
      const at = (running: number) => ({ shoe: { running, remaining: 260 } });
      // 260 cards is 5 decks: running +20 is +4, +5 is +1, -5 is -1.
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T 4', 'T', at(20)))), 'surrender');
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T 4', 'T', at(5)))), 'hit');
      // 15 against a 10: surrender at 0 or more; below, the basic play with surrender set aside (hit).
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T 5', 'T', at(0)))), 'surrender');
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T 5', 'T', at(-5)))), 'hit');
      // 16 against a 10 surrenders on the original hand; after a hit (no surrender) the I18 index decides.
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T 6', 'T', at(5)))), 'surrender');
      t.equal(prescribed(explained(TEST_DEVIATING, situation('5 5 6', 'T', at(5)))), 'stand');
      t.equal(prescribed(explained(TEST_DEVIATING, situation('5 5 6', 'T', at(-5)))), 'hit');
      // 13 against a 2 keeps basic (stand) at 0 or more and hits below.
      t.equal([prescribed(explained(TEST_DEVIATING, situation('T 3', '2', at(0)))), prescribed(explained(TEST_DEVIATING, situation('T 3', '2', at(-5))))], ['stand', 'hit']);
      // A doubling index applies only on two cards: three-card 10 against a 10 at +4 hits.
      t.equal([prescribed(explained(TEST_DEVIATING, situation('6 4', 'T', at(20)))), prescribed(explained(TEST_DEVIATING, situation('2 4 4', 'T', at(20))))], ['double', 'hit']);
      // 5,5 is played as hard 10, so the same index applies.
      t.equal(prescribed(explained(TEST_DEVIATING, situation('5 5', 'T', at(20)))), 'double');
    },
  },
  {
    name: 'blackjack guided: a learner who stops resplitting T,T: the index applies at each split decision from that decision\'s count',
    run: (t) => {
      // T,T against a 6 splits at +5. 260 cards: +25 is +5; one more ten seen makes +24, which is +4.
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T T', '6', { shoe: { running: 25, remaining: 260 } }))), 'split');
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T T', '6', { hands: 2, shoe: { running: 24, remaining: 258 } }))), 'stand');
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T T', '6', { hands: 2, shoe: { running: 27, remaining: 258 } }))), 'split');
      // At four hands T,T can't split again: it stands.
      t.equal(prescribed(explained(TEST_DEVIATING, situation('T T', '6', { hands: 4, shoe: { running: 40, remaining: 258 } }))), 'stand');
      t.equal(prescribed(explained(TEST_BASIC, situation('T T', '6', { shoe: { running: 40, remaining: 258 } }))), 'stand');
    },
  },
  {
    name: 'blackjack guided: seats after other players count their exposed cards; the index applies from the true count at each penetration from 55% to 70%',
    run: (t) => {
      // One simulated player ahead holds 2,3 and hits a 4 then a 9 (+3); the learner's 4,3 against a 10 hits a 9 (+1):
      // +4 over 303 cards is 0, so the three-card 16 hits.
      const spec = withPlayers(1, ['10'], guided(TEST_DEVIATING));
      const state = run(stacked('2 4 T 3 3 9 4 9 9', spec), [bet('10'), DEAL, HIT]).state;
      t.equal(view(state).count, { running: 4, decks: '6', trueCount: 0 });
      t.equal(prescribed(held(step(state, STAND).state)?.explanation as PlayExplanation), 'hit');
      for (const penetration of [55, 60, 65, 70]) {
        const deep = guided(TEST_DEVIATING, { rules: { ...BJ_SPEC.rules, penetration } });
        const dealt = run(counted(PLUS_EIGHT, SIXTEEN, deep), [bet('10'), DEAL, HIT]).state;
        t.equal([penetration, view(dealt).count?.trueCount, prescribed(held(step(dealt, HIT).state)?.explanation as PlayExplanation)], [penetration, 1, 'stand']);
      }
    },
  },
  {
    name: 'blackjack guided: split hands are assessed in dealing order, each with the cards exposed when its play begins',
    run: (t) => {
      // 8,8 against a 6 splits; hand 1 draws a 3 (11, double); hand 2 waits for its card until hand 1 is done.
      let state = run(stacked('8 6 8 T 3 4 5 9', guided(TEST_DEVIATING)), [bet('10'), DEAL, SPLIT]).state;
      const first = view(state).count;
      state = step(state, DOUBLE).state;
      // Hand 1 took the 3 and the double card 4; hand 2 then took the 5: 8,5 is 13 against a 6, which stands.
      const second = view(state).count;
      t.equal([first, second, state.outcome?.active], [{ running: 2, decks: '6', trueCount: 0 }, { running: 4, decks: '6', trueCount: 0 }, 1]);
      t.equal(prescribed(held(step(state, HIT).state)?.explanation as PlayExplanation), 'stand');
    },
  },
  {
    name: 'blackjack guided: checkpoints round-trip a held playing move; a held move that is not the policy\'s answer is damaged',
    run: (t) => {
      const state = run(stacked('A 5 6 T', guided(TEST_DEVIATING)), [bet('25'), DEAL, STAND]).state;
      const text = encodeCheckpoint(state);
      const decoded = decodeCheckpoint(text);
      t.equal([decoded.ok, decoded.ok && encodeCheckpoint(decoded.state) === text], [true, true]);
      const correction = held(state);
      const tampered = { ...state, strategy: { ...state.strategy, correction: { ...correction, actual: { action: 'double', amount: null } } } };
      t.equal(decodeCheckpoint(encodeCheckpoint(tampered as BlackjackActivityState)), { ok: false, error: { kind: 'damaged', message: 'damaged correction' } });
      const resolved = step(state, OVERRIDE).state;
      t.equal(decodeCheckpoint(encodeCheckpoint(resolved)).ok, true);
    },
  },
  {
    name: 'blackjack guided: Stop strategy between rounds ends the coaching and the supplied count; the practice session plays on',
    run: (t) => {
      const settled = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_DEVIATING)), [bet('10'), DEAL, HIT, STAND, SETTLE]).state;
      t.equal(view(settled).legalCommands.includes('stop-strategy'), true);
      const stopped = step(settled, { kind: 'stop-strategy' }).state;
      t.equal([stopped.strategy?.status, view(stopped).count], ['stopped', null]);
      const played = run(stopped, [bet('10'), DEAL]).state;
      t.equal([played.strategy?.decisions, played.phase === 'correction'], [stopped.strategy?.decisions, false]);
    },
  },
  {
    name: 'blackjack guided: a guided trace with a correction, an override, a retry and insurance (compared across runtimes)',
    run: (t) => {
      let state = createActivity(guided(TEST_DEVIATING), BJ_STREAM);
      const hashes: string[] = [];
      for (let round = 0; round < 12; round++) {
        state = step(state, bet('10')).state;
        state = step(state, DEAL).state;
        while (state.phase === 'open-decision' || state.phase === 'correction') {
          if (state.phase === 'correction') {
            state = step(state, round % 2 === 0 ? RETRY : OVERRIDE).state;
            continue;
          }
          // The player always stands (or declines insurance): every departure is corrected.
          state = step(state, state.outcome?.insurance === 'offered' ? NO_INSURANCE : STAND).state;
        }
        if (state.phase === 'revealing-outcome') state = step(state, SETTLE).state;
        hashes.push(checkpointHash(state));
      }
      t.record('balance', state.balance);
      t.record('adherence', view(state).strategy?.adherence);
      t.record('hashes', hashes);
    },
  },
];

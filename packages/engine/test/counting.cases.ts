// The blackjack counting modes and the Hi-Lo bet schedule at the engine
// interface (spec #51, Counting (Hi-Lo)). Expected values are worked by hand
// from the spec's rules, not from the engine: Hi-Lo tags 2-6 as +1, 7-9 as 0
// and tens and aces as -1, over exposed cards only; the divisor is the cards
// left in the shoe to the nearest half deck (26 cards), ties up, at least half
// a deck; the true count truncates toward zero (+7/2 is +3, -7/2 is -3); the
// schedule bets 1 unit below +1, then 2, 4 and 6 units at +1, +2 and +3, and 8
// at +4 or more, scored apart from the play.
import type { TestCase } from '@tableside/harness';

import {
  completedPracticeRecord,
  countOf,
  encodeCheckpoint,
  explainPrescription,
  initialProgress,
  isPlayCorrection,
  readPermittedView,
  referenceCount,
  trueCount,
  validateStrategy,
  type BlackjackActivitySpecification,
  type BlackjackActivityState,
  type BlackjackSituation,
  type Command,
  type PlayExplanation,
  type StrategyDefinition,
} from '../src';

import { run, step } from './activity.fixtures';
import { bet, BJ_SPEC, counted, DEAL, FINAL, HIT, PLUS_EIGHT, SETTLE, STAND, STOP, stacked } from './blackjack.fixtures';
import { TEST_BASIC, TEST_COUNTING_BASIC, TEST_COUNTING_DEVIATING, TEST_COUNTING_SCHEDULE, TEST_DEVIATING, TEST_POLICY, TEST_SCHEDULE } from './blackjack-strategy.fixtures';

const RETRY: Command = { kind: 'retry-correction' };
const OVERRIDE: Command = { kind: 'override-correction' };

/** Counting with deviations and the bet schedule. */
const COUNTING_DEVIATIONS_SCHEDULE: StrategyDefinition = { ...TEST_COUNTING_DEVIATING, id: 'test-counting-deviations-schedule', instructions: TEST_SCHEDULE };

const guided = (definition: StrategyDefinition, extra: Partial<BlackjackActivitySpecification> = {}): BlackjackActivitySpecification => ({
  ...BJ_SPEC,
  strategy: { definition, parameters: {} },
  ...extra,
});
const view = (state: BlackjackActivityState) => readPermittedView(state);

/** 4,3 against a 10 (hole 9), then a 9: a three-card 16 against a 10. */
const SIXTEEN = '4 T 3 9 9';

/** The schedule's bet for a betting decision at this exposed running count with this many cards left. */
function scheduled(running: number, remaining: number): string | undefined {
  const situation: BlackjackSituation = {
    game: 'blackjack',
    rules: { dealer: 'S17', lateSurrender: true, limits: { initial: { min: '10', max: '1000' } } },
    balance: '1000',
    shoe: { running, remaining },
  };
  const result = explainPrescription(TEST_COUNTING_SCHEDULE, {}, situation, initialProgress(TEST_COUNTING_SCHEDULE));
  if (!result.ok) throw new Error(result.error);
  const prescription = result.explanation.prescription;
  return prescription.status === 'prescribed' ? prescription.bets.map((b) => `${b.target} ${b.amount}`).join() : undefined;
}

export const countingCases: TestCase[] = [
  {
    name: 'counting: the true count divides by the shoe to the nearest half deck (ties up, at least half a deck) and truncates toward zero',
    run: (t) => {
      // 104 cards is 2 decks: +7/2 is +3 and -7/2 is -3, never -4.
      t.equal([trueCount(7, 104), trueCount(-7, 104)], [3, -3]);
      // 117 cards is 4.5 half decks, a tie, so 5 half decks (2.5 decks): +7/2.5 = 2.8 is +2.
      t.equal([countOf({ running: 7, remaining: 117 }), countOf({ running: 7, remaining: 116 })], [
        { running: 7, decks: '2.5', trueCount: 2 },
        // 116 cards is 4.46 half decks, so 4 (2 decks): +3.
        { running: 7, decks: '2', trueCount: 3 },
      ]);
      // A nearly empty shoe still divides by half a deck: +3/0.5 is +6; -1 over 0.5 is -2.
      t.equal([countOf({ running: 3, remaining: 5 }), trueCount(-1, 0)], [{ running: 3, decks: '0.5', trueCount: 6 }, -2]);
      // Under a whole count truncates to zero from either side: +5/6 and -5/6.
      t.equal([trueCount(5, 312), trueCount(-5, 312)], [0, 0]);
    },
  },
  {
    name: 'counting: Validate accepts the counting modes and the bet schedule; deviations need someone to keep the count, and only a condition reads it',
    run: (t) => {
      for (const definition of [TEST_COUNTING_BASIC, TEST_COUNTING_DEVIATING, TEST_COUNTING_SCHEDULE, COUNTING_DEVIATIONS_SCHEDULE]) t.equal(validateStrategy(definition), { diagnostics: [], runnable: true });
      const paths = (definition: unknown) => validateStrategy(definition).diagnostics.map((d) => `${d.category} ${d.path}`);
      t.equal(paths({ ...TEST_DEVIATING, play: { ...(TEST_DEVIATING.play as object), count: 'none' } }), ['incomplete /play/count']);
      t.equal(paths({ ...TEST_BASIC, play: { ...TEST_POLICY, count: 'supplied' } }), ['incomplete /play/count']);
      t.equal(paths({ ...TEST_BASIC, play: { ...TEST_POLICY, count: 'shown' } }), ['incomplete /play/count']);
      // A bet can't be sized by the count, and only the vocabulary's own values exist.
      const [first, second] = TEST_SCHEDULE as [(typeof TEST_SCHEDULE)[number], (typeof TEST_SCHEDULE)[number]];
      const sizedByCount = { ...first, bets: [{ target: { target: 'hand-1' }, amount: { value: 'true-count' } }] };
      t.equal(paths({ ...TEST_COUNTING_SCHEDULE, instructions: [sizedByCount] }), ['incomplete /instructions/0/bets/0/amount']);
      const unknown = { ...second, when: { compare: { value: 'running-count' }, op: 'ge', to: { lit: '1' } } };
      t.equal(paths({ ...TEST_COUNTING_SCHEDULE, instructions: [first, unknown] }), ['incomplete /instructions/1/when/compare']);
      // Two bands with no priority between them may both bet the hand: a conflict.
      t.equal(paths({ ...TEST_COUNTING_SCHEDULE, instructions: [first, second].map((i) => JSON.parse(JSON.stringify({ ...i, priority: undefined }))) }), ['conflict /instructions/1']);
    },
  },
  {
    name: 'counting: the bet schedule bets 1 unit below +1, 2 at +1, 4 at +2, 6 at +3 and 8 at +4 or more, from the true count the deal sees',
    run: (t) => {
      // 260 cards is 5 decks: running +4 is 0, +5 is +1, +10 is +2, +15 is +3, +20 is +4, +50 is +10, -20 is -4.
      t.equal(
        [-20, 4, 5, 10, 15, 20, 50].map((running) => scheduled(running, 260)),
        ['hand-1 10', 'hand-1 10', 'hand-1 20', 'hand-1 40', 'hand-1 60', 'hand-1 80', 'hand-1 80'],
      );
      // +7 over 2 decks is +3 (6 units); -7 is -3 (1 unit).
      t.equal([scheduled(7, 104), scheduled(-7, 104)], ['hand-1 60', 'hand-1 10']);
    },
  },
  {
    name: 'counting: the counting modes hide the count, yet assess play against the actual count of exposed cards',
    run: (t) => {
      // +8 seen; this round shows 4, T, 3 and the hit 9: +9 over 300 cards (6 decks) is +1, where 16 against a 10 stands.
      for (const definition of [TEST_COUNTING_DEVIATING, TEST_DEVIATING]) {
        const sixteen = run(counted(PLUS_EIGHT, SIXTEEN, guided(definition)), [bet('10'), DEAL, HIT]).state;
        const held = step(sixteen, HIT).state.strategy?.correction;
        const explanation = (held && isPlayCorrection(held) ? held.explanation : null) as PlayExplanation;
        t.equal([explanation.prescribed.action, explanation.situation.count?.trueCount], ['stand', 1]);
        // Only basic with deviations shows it; the reference count is there either way.
        t.equal([view(sixteen).count?.trueCount ?? null, referenceCount(sixteen)], [definition === TEST_DEVIATING ? 1 : null, { running: 9, decks: '6', trueCount: 1 }]);
      }
      // Counting with basic: basic strategy doesn't depend on the count, so the hit follows it.
      const basic = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_COUNTING_BASIC)), [bet('10'), DEAL, HIT, HIT]).state;
      t.equal([basic.phase === 'correction', view(basic).count], [false, null]);
      // Nothing the player can read before acting carries the count: no view field, no fact.
      const dealt = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_COUNTING_DEVIATING)), [bet('10')]);
      const later = step(dealt.state, DEAL);
      t.equal([JSON.stringify(view(later.state)).includes('trueCount'), JSON.stringify(later.facts).includes('trueCount')], [false, false]);
    },
  },
  {
    name: 'counting: no view field carries the count the player keeps: not a held play, a held bet, nor a recorded departure; basic with deviations still shows it',
    run: (t) => {
      // +8 seen, then 4, T, 3 and the hit 9: +9 over 300 cards is +1, where 16 against a 10 stands; the player hits.
      const heldPlay = run(counted(PLUS_EIGHT, SIXTEEN, guided(COUNTING_DEVIATIONS_SCHEDULE)), [bet('20'), DEAL, HIT, HIT]).state;
      t.equal(heldPlay.phase, 'correction');
      const shown = view(heldPlay).strategy?.correction;
      t.equal(shown && isPlayCorrection(shown) ? [shown.explanation.situation.count, shown.explanation.prescribed.action] : null, [null, 'stand']);
      // (A deviation's published cost is binned by true count: that is the index's data, not this shoe's count.)
      t.equal(JSON.stringify(view(heldPlay)).includes('"running"'), false);
      // Overridden: the departure log keeps no count either.
      const overridden = step(heldPlay, OVERRIDE).state;
      t.equal([view(overridden).strategy?.departures.length, JSON.stringify(view(overridden)).includes('"running"')], [1, false]);
      // A bet off the schedule (10 where +1 bets 20): held before the deal, without the true-count value it was checked against.
      const heldBet = run(counted(PLUS_EIGHT, SIXTEEN, guided(COUNTING_DEVIATIONS_SCHEDULE)), [bet('10'), DEAL]).state;
      const bet10 = view(heldBet).strategy?.correction;
      t.equal(bet10 && !isPlayCorrection(bet10) ? [bet10.explanation.situation.values, bet10.explanation.prescription.status] : null, [{}, 'prescribed']);
      const kept = view(step(heldBet, OVERRIDE).state);
      t.equal([kept.strategy?.departures.length, JSON.stringify(kept.strategy?.departures).includes('true-count')], [1, false]);
      // Basic with deviations: Tableside supplies the count, so the correction states it.
      const supplied = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_DEVIATING)), [bet('10'), DEAL, HIT, HIT]).state;
      const suppliedShown = view(supplied).strategy?.correction;
      t.equal(suppliedShown && isPlayCorrection(suppliedShown) ? suppliedShown.explanation.situation.count : null, { running: 9, decks: '6', trueCount: 1 });
    },
  },
  {
    name: 'counting: the reference count is derived from the exposed cards, never stored, so no learner entry can change it',
    run: (t) => {
      const state = run(counted(PLUS_EIGHT, SIXTEEN, guided(TEST_COUNTING_DEVIATING)), [bet('10'), DEAL]).state;
      // The checkpoint holds the shoe, not a count: there is no count field for anything to overwrite
      // (the pinned strategy's published index costs are the only true counts in it).
      const checkpoint = encodeCheckpoint({ ...state, strategy: null });
      t.equal([checkpoint.includes('running'), checkpoint.includes('trueCount')], [false, false]);
      // Between rounds the reference count is the one the next deal starts from; a fresh shoe once the cut card is out.
      const settled = run(state, [HIT, STAND, SETTLE]).state;
      // 4, T, 3, the hit 9 and the turned hole 9: +9 over 299 cards (6 decks) is +1.
      t.equal([settled.phase, referenceCount(settled)], ['settled-outcome', { running: 9, decks: '6', trueCount: 1 }]);
      const fresh = stacked('', guided(TEST_COUNTING_DEVIATING));
      t.equal(referenceCount(fresh), { running: 0, decks: '6', trueCount: 0 });
    },
  },
  {
    name: 'counting: a bet off the schedule waits in a correction before the deal; retry sets the scheduled bet; betting and playing adherence stay apart',
    run: (t) => {
      // The deal sees +8 over 304 cards (6 decks): +1, so the schedule bets 2 units (20).
      const start = counted(PLUS_EIGHT, SIXTEEN, guided(COUNTING_DEVIATIONS_SCHEDULE));
      t.equal(view(start).strategy?.pending, null);
      const corrected = run(start, [bet('10'), DEAL]).state;
      const held = corrected.strategy?.correction;
      t.equal(corrected.phase, 'correction');
      t.equal(held && !isPlayCorrection(held) ? [held.explanation.situation.values, held.explanation.instructions, held.explanation.prescription] : null, [
        { 'true-count': '1' },
        [{ id: 'from-1', label: '+1: 2 units' }],
        { status: 'prescribed', bets: [{ target: 'hand-1', amount: '20' }], held: [] },
      ]);
      // Retry sets 20 in place of 10; nothing is dealt until the player deals.
      const retried = step(corrected, RETRY).state;
      t.equal([retried.phase, retried.wagers, retried.outcome], ['open-decision', [{ target: 'hand-1', amount: '20' }], null]);
      // The deal follows the schedule; a hit at 16 against a 10 at +1 departs from the index play and is overridden.
      const played = run(retried, [DEAL, HIT, HIT, OVERRIDE]).state;
      t.equal(view(played).strategy?.adherence, { betting: { decisions: 1, followed: 0 }, playing: { decisions: 2, followed: 1 }, departures: 2 });
      // The completed record keeps the mode, the schedule and each kind of adherence apart; counting needs spec 3's entry.
      let rest = played;
      while (view(rest).playActions.length > 0) rest = step(rest, STAND).state;
      const finished = run(rest, [SETTLE, STOP, FINAL]);
      const record = completedPracticeRecord(finished.state, [], { startedAt: 0, endedAt: 1, meteringBasis: 'free-play', allowancePolicyVersion: null });
      const { betting, playing } = view(finished.state).strategy?.adherence ?? {};
      t.equal([record.blackjackMode, record.betSchedule, record.guidance?.adherence], ['counting-with-deviations', true, { betting, playing, counting: null }]);
      t.equal(betting, { decisions: 1, followed: 0 });
    },
  },
  {
    name: 'counting: the schedule\'s unfunded bet is not announced while the count is hidden; the correction explains it after the player acts',
    run: (t) => {
      // 15 units of funding: the schedule's 20 at +1 can't be funded.
      const short = counted(PLUS_EIGHT, SIXTEEN, guided(COUNTING_DEVIATIONS_SCHEDULE, { funding: '15' }));
      t.equal(view(short).strategy?.pending, null);
      const held = run(short, [bet('10'), DEAL]).state.strategy?.correction;
      t.equal(held && !isPlayCorrection(held) ? held.explanation.prescription : null, { status: 'paused', reason: 'unfunded-group', unavailable: [{ target: 'hand-1', amount: '20' }] });
    },
  },
  {
    name: 'counting: free play and the modes without a schedule record their mode and leave the bets unassessed',
    run: (t) => {
      const finish = (spec: BlackjackActivitySpecification) => {
        const done = run(stacked('T 7 T 9', spec), [bet('10'), DEAL, STAND, SETTLE, STOP, FINAL]).state;
        const record = completedPracticeRecord(done, [], { startedAt: 0, endedAt: 1, meteringBasis: 'free-play', allowancePolicyVersion: null });
        return [record.blackjackMode, record.betSchedule, record.guidance?.adherence.betting ?? null];
      };
      t.equal(finish(BJ_SPEC), [null, false, null]);
      t.equal(finish(guided(TEST_BASIC)), ['basic', false, null]);
      t.equal(finish(guided(TEST_DEVIATING)), ['basic-with-deviations', false, null]);
      t.equal(finish(guided(TEST_COUNTING_BASIC)), ['counting-with-basic', false, null]);
      t.equal(finish(guided(TEST_COUNTING_SCHEDULE)), ['counting-with-basic', true, { decisions: 1, followed: 1 }]);
    },
  },
];

// Spec 1 Game rules, Counting (Hi-Lo)
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

const COUNTING_DEVIATIONS_SCHEDULE: StrategyDefinition = { ...TEST_COUNTING_DEVIATING, id: 'test-counting-deviations-schedule', instructions: TEST_SCHEDULE };

const guided = (definition: StrategyDefinition, extra: Partial<BlackjackActivitySpecification> = {}): BlackjackActivitySpecification => ({
  ...BJ_SPEC,
  strategy: { definition, parameters: {} },
  ...extra,
});
const view = (state: BlackjackActivityState) => readPermittedView(state);

const THREE_CARD_SIXTEEN_VS_TEN = '4 T 3 9 9';

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
      t.equal([trueCount(7, 104), trueCount(-7, 104)], [3, -3]);
      t.equal([countOf({ running: 7, remaining: 117 }), countOf({ running: 7, remaining: 116 })], [
        { running: 7, decks: '2.5', trueCount: 2 },
        { running: 7, decks: '2', trueCount: 3 },
      ]);
      t.equal([countOf({ running: 3, remaining: 5 }), trueCount(-1, 0)], [{ running: 3, decks: '0.5', trueCount: 6 }, -2]);
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
      const [first, second] = TEST_SCHEDULE as [(typeof TEST_SCHEDULE)[number], (typeof TEST_SCHEDULE)[number]];
      const sizedByCount = { ...first, bets: [{ target: { target: 'hand-1' }, amount: { value: 'true-count' } }] };
      t.equal(paths({ ...TEST_COUNTING_SCHEDULE, instructions: [sizedByCount] }), ['incomplete /instructions/0/bets/0/amount']);
      const unknown = { ...second, when: { compare: { value: 'running-count' }, op: 'ge', to: { lit: '1' } } };
      t.equal(paths({ ...TEST_COUNTING_SCHEDULE, instructions: [first, unknown] }), ['incomplete /instructions/1/when/compare']);
      t.equal(paths({ ...TEST_COUNTING_SCHEDULE, instructions: [first, second].map((i) => JSON.parse(JSON.stringify({ ...i, priority: undefined }))) }), ['conflict /instructions/1']);
    },
  },
  {
    name: 'counting: the bet schedule bets 1 unit below +1, 2 at +1, 4 at +2, 6 at +3 and 8 at +4 or more, from the true count the deal sees',
    run: (t) => {
      t.equal(
        [-20, 4, 5, 10, 15, 20, 50].map((running) => scheduled(running, 260)),
        ['hand-1 10', 'hand-1 10', 'hand-1 20', 'hand-1 40', 'hand-1 60', 'hand-1 80', 'hand-1 80'],
      );
      t.equal([scheduled(7, 104), scheduled(-7, 104)], ['hand-1 60', 'hand-1 10']);
    },
  },
  {
    name: 'counting: the counting modes hide the count, yet assess play against the actual count of exposed cards',
    run: (t) => {
      for (const definition of [TEST_COUNTING_DEVIATING, TEST_DEVIATING]) {
        const sixteen = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(definition)), [bet('10'), DEAL, HIT]).state;
        const held = step(sixteen, HIT).state.strategy?.correction;
        const explanation = (held && isPlayCorrection(held) ? held.explanation : null) as PlayExplanation;
        t.equal([explanation.prescribed.action, explanation.situation.count?.trueCount], ['stand', 1]);
        t.equal([view(sixteen).count?.trueCount ?? null, referenceCount(sixteen)], [definition === TEST_DEVIATING ? 1 : null, { running: 9, decks: '6', trueCount: 1 }]);
      }
      const basic = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(TEST_COUNTING_BASIC)), [bet('10'), DEAL, HIT, HIT]).state;
      t.equal([basic.phase === 'correction', view(basic).count], [false, null]);
      const dealt = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(TEST_COUNTING_DEVIATING)), [bet('10')]);
      const later = step(dealt.state, DEAL);
      t.equal([JSON.stringify(view(later.state)).includes('trueCount'), JSON.stringify(later.facts).includes('trueCount')], [false, false]);
    },
  },
  {
    name: 'counting: no view field carries the count the player keeps: not a held play, a held bet, nor a recorded departure; basic with deviations still shows it',
    run: (t) => {
      const heldPlay = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(COUNTING_DEVIATIONS_SCHEDULE)), [bet('20'), DEAL, HIT, HIT]).state;
      t.equal(heldPlay.phase, 'correction');
      const shown = view(heldPlay).strategy?.correction;
      t.equal(shown && isPlayCorrection(shown) ? [shown.explanation.situation.count, shown.explanation.prescribed.action] : null, [null, 'stand']);
      t.equal(JSON.stringify(view(heldPlay)).includes('"running"'), false);
      const overridden = step(heldPlay, OVERRIDE).state;
      t.equal([view(overridden).strategy?.departures.length, JSON.stringify(view(overridden)).includes('"running"')], [1, false]);
      const heldBet = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(COUNTING_DEVIATIONS_SCHEDULE)), [bet('10'), DEAL]).state;
      const bet10 = view(heldBet).strategy?.correction;
      t.equal(bet10 && !isPlayCorrection(bet10) ? [bet10.explanation.situation.values, bet10.explanation.prescription.status] : null, [{}, 'prescribed']);
      const kept = view(step(heldBet, OVERRIDE).state);
      t.equal([kept.strategy?.departures.length, JSON.stringify(kept.strategy?.departures).includes('true-count')], [1, false]);
      const supplied = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(TEST_DEVIATING)), [bet('10'), DEAL, HIT, HIT]).state;
      const suppliedShown = view(supplied).strategy?.correction;
      t.equal(suppliedShown && isPlayCorrection(suppliedShown) ? suppliedShown.explanation.situation.count : null, { running: 9, decks: '6', trueCount: 1 });
    },
  },
  {
    name: 'counting: the reference count is derived from the exposed cards, never stored, so no learner entry can change it',
    run: (t) => {
      const state = run(counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(TEST_COUNTING_DEVIATING)), [bet('10'), DEAL]).state;
      const checkpoint = encodeCheckpoint({ ...state, strategy: null });
      t.equal([checkpoint.includes('running'), checkpoint.includes('trueCount')], [false, false]);
      const settled = run(state, [HIT, STAND, SETTLE]).state;
      t.equal([settled.phase, referenceCount(settled)], ['settled-outcome', { running: 9, decks: '6', trueCount: 1 }]);
      const fresh = stacked('', guided(TEST_COUNTING_DEVIATING));
      t.equal(referenceCount(fresh), { running: 0, decks: '6', trueCount: 0 });
    },
  },
  {
    name: 'counting: a bet off the schedule waits in a correction before the deal; retry sets the scheduled bet; betting and playing adherence stay apart',
    run: (t) => {
      const start = counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(COUNTING_DEVIATIONS_SCHEDULE));
      t.equal(view(start).strategy?.pending, null);
      const corrected = run(start, [bet('10'), DEAL]).state;
      const held = corrected.strategy?.correction;
      t.equal(corrected.phase, 'correction');
      t.equal(held && !isPlayCorrection(held) ? [held.explanation.situation.values, held.explanation.instructions, held.explanation.prescription] : null, [
        { 'true-count': '1' },
        [{ id: 'from-1', label: '+1: 2 units' }],
        { status: 'prescribed', bets: [{ target: 'hand-1', amount: '20' }], held: [] },
      ]);
      const retried = step(corrected, RETRY).state;
      t.equal([retried.phase, retried.wagers, retried.outcome], ['open-decision', [{ target: 'hand-1', amount: '20' }], null]);
      const played = run(retried, [DEAL, HIT, HIT, OVERRIDE]).state;
      t.equal(view(played).strategy?.adherence, { betting: { decisions: 1, followed: 0 }, playing: { decisions: 2, followed: 1 }, departures: 2 });
      // Spec 1 Game rules, Counting (Hi-Lo)
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
      const short = counted(PLUS_EIGHT, THREE_CARD_SIXTEEN_VS_TEN, guided(COUNTING_DEVIATIONS_SCHEDULE, { funding: '15' }));
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

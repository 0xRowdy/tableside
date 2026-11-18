// Spec 3 Play challenge funding (#20); Scoring and review; Amendment 1 C4; Testing Decisions › Seam 1 (funding); #139
import type { TestCase } from '@tableside/harness';

import {
  advanceChallenge,
  challengeAttemptRecord,
  challengeResults,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeFact,
  type ChallengeSpecification,
  type ChallengeState,
  type TableBetReview,
  type TableCountReview,
  type TableStep,
} from '../src';

import { begun, checkView, NEXT, seed, SKIP, step } from './challenge.fixtures';
import { expectCheckViewHides } from './information-hiding';
import { playSpec } from './table.fixtures';

const CONTEXT = { installation: 'i', startedAt: 1, endedAt: 2, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null, pacing: 'self-paced' } as const;

const funded = (variant: 'learn' | 'check', funding: { betSchedule?: boolean; baseWager?: string; startingBalance?: string }, mode: 'basic' | 'deviations' = 'basic'): ChallengeSpecification =>
  playSpec(variant, mode, funding);

function refusal(spec: ChallengeSpecification): string {
  try {
    begun(spec, seed(1));
  } catch (error) {
    return error instanceof Error ? error.message : 'non-error';
  }
  return 'no error';
}

const END = { kind: 'end' } as const;
const BET = (amount: string): ChallengeCommand => ({ kind: 'bet', amount });
const STAND: ChallengeCommand = { kind: 'play', action: 'stand' };
const DECLINE: ChallengeCommand = { kind: 'play', action: 'decline-insurance' };

const stepOf = (state: ChallengeState) => state.items[state.position] as TableStep;

const standing = (state: ChallengeState): ChallengeCommand => (readChallengeView(state).table?.decision?.kind === 'insurance' ? DECLINE : STAND);
const lowest = (state: ChallengeState): ChallengeCommand => BET(readChallengeView(state).table?.bet?.amounts[0] as string);

function playAll(
  start: ChallengeState,
  options: { readonly bet?: (state: ChallengeState) => ChallengeCommand; readonly decide?: (state: ChallengeState) => ChallengeCommand; readonly visit?: (state: ChallengeState) => void } = {},
): ChallengeState {
  const { bet = lowest, decide = standing, visit = () => undefined } = options;
  let state = start;
  while (state.phase !== 'ended') {
    visit(state);
    const command = state.phase === 'question' ? SKIP : state.phase === 'bet' ? bet(state) : state.phase === 'decision' ? decide(state) : state.phase === 'correction' ? { kind: 'override-correction' } as const : NEXT;
    state = step(state, command);
  }
  return state;
}

function toPhase(start: ChallengeState, phase: ChallengeState['phase']): ChallengeState {
  let state = start;
  while (state.phase !== phase && state.phase !== 'ended') state = step(state, state.phase === 'question' ? SKIP : state.phase === 'decision' ? standing(state) : state.phase === 'bet' ? lowest(state) : NEXT);
  return state;
}

function factsOf(state: ChallengeState, command: ChallengeCommand): readonly ChallengeFact[] {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `f-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
  return result.facts;
}

const reviewOf = <K extends 'table-bet' | 'table'>(state: ChallengeState, kind: K) =>
  (challengeResults(state)?.review ?? []).filter((fact) => fact.kind === kind) as (K extends 'table-bet' ? TableBetReview : TableCountReview)[];

// Spec 1 Counting (Hi-Lo) bet schedule, as units of the base wager (independent of the engine's table)
const SCHEDULE_UNITS = (trueCount: number) => (trueCount >= 4 ? 8 : trueCount >= 3 ? 6 : trueCount >= 2 ? 4 : trueCount >= 1 ? 2 : 1);

export const tableFundingCases: TestCase[] = [
  {
    name: 'table Play funding: the starting balance must cover the opening wager, in whole units within the funding ceiling; the base wager fits the table',
    run: (t) => {
      t.equal(refusal(funded('check', { baseWager: '10', startingBalance: '5' })), "the starting balance can't cover the opening wager");
      t.equal(refusal(funded('check', { baseWager: '25', startingBalance: '24' })), "the starting balance can't cover the opening wager");
      t.equal(refusal(funded('check', { baseWager: '25', startingBalance: '25' })), 'no error');
      t.equal(refusal(funded('check', { startingBalance: '0' })), 'the starting balance is whole units from 1 to 1000000000');
      t.equal(refusal(funded('check', { startingBalance: '10.5' })), 'the starting balance is whole units from 1 to 1000000000');
      t.equal(refusal(funded('check', { startingBalance: '1000000001' })), 'the starting balance is whole units from 1 to 1000000000');
      t.equal(refusal(funded('check', { baseWager: '5' })), 'the base wager is whole units within the table limits, 10 to 1000');
      t.equal(refusal(funded('check', { baseWager: '1001', startingBalance: '5000' })), 'the base wager is whole units within the table limits, 10 to 1000');
      t.equal(refusal(funded('check', { betSchedule: true, baseWager: '125', startingBalance: '5000' })), 'no error');
      t.equal(refusal(funded('check', { betSchedule: true, baseWager: '130', startingBalance: '5000' })), "the bet schedule's top wager of 1040 is over the table maximum of 1000");
    },
  },
  {
    name: 'table Play funding: the group key carries the bet schedule, base wager and starting balance',
    run: (t) => {
      const ended = step(begun(funded('check', { betSchedule: true, baseWager: '20', startingBalance: '500' }), seed(1)), END);
      const key = challengeAttemptRecord(ended, CONTEXT).groupKey.table;
      t.equal([key?.betSchedule, key?.baseWager, key?.startingBalance], [true, '20', '500']);
    },
  },
  {
    name: 'table Play bet schedule Check: after the before-bet counts the learner chooses the opening wager from the schedule; nothing hints at the prescribed amount',
    run: (t) => {
      const atBet = toPhase(begun(funded('check', { betSchedule: true }), seed(1)), 'bet');
      const view = checkView(atBet);
      const before = atBet.items.slice(0, atBet.position) as TableStep[];
      t.equal(before.map((item) => (item.step === 'prompt' ? `${item.timing} ${item.count}` : item.step)), ['before-bet running', 'before-bet true']);
      t.equal([view.phase, view.legalCommands, view.table?.step, view.table?.bet], ['bet', ['bet', 'reveal-count', 'end'], 'bet', { amounts: ['10', '20', '40', '60', '80'], funding: false }]);
      t.equal(view.table?.funds, { balance: '1000', wager: null });
      expectCheckViewHides(t, 'bet', view);
      const result = advanceChallenge(atBet, { sequence: atBet.sequence, commandId: 'odd', command: BET('30') });
      t.equal(result.status === 'rejected' && result.reason, 'malformed');
      t.equal(factsOf(atBet, BET('20')), [
        { kind: 'content-shown', position: atBet.position + 1 },
        { kind: 'wager-placed', position: atBet.position + 1 },
      ]);
      const placed = checkView(step(atBet, BET('20')));
      t.equal([placed.phase, placed.table?.step, placed.table?.funds], ['card', 'deal', { balance: '980', wager: '20' }]);
      expectCheckViewHides(t, 'placed', placed);
    },
  },
  {
    name: 'table Play bet schedule: betting adherence scores each first wager against 1/2/4/6/8 units at the true count before the bet, apart from play and counting',
    run: (t) => {
      const ended = playAll(begun(funded('check', { betSchedule: true, baseWager: '15', startingBalance: '2000' }), seed(3)));
      const counts = reviewOf(ended, 'table').filter((fact) => fact.timing === 'before-bet' && fact.count === 'true');
      const bets = reviewOf(ended, 'table-bet');
      t.equal(bets.length, 10);
      t.equal(
        bets.map((fact) => [fact.round, fact.prescribed, fact.chosen, fact.override]),
        counts.map((fact) => [fact.round, String(15 * SCHEDULE_UNITS(fact.reference)), '15', false]),
      );
      const results = challengeResults(ended);
      t.equal(results?.metrics['betting-adherence'], { correct: counts.filter((fact) => fact.reference < 1).length, total: 10 });
      t.equal(counts.some((fact) => fact.reference >= 1), true);
      t.equal([results?.metrics['playing-adherence']?.total !== undefined, results?.metrics['running-count']?.total], [true, 20]);
    },
  },
  {
    name: 'table Play without the bet schedule: the base wager is placed for the learner each round, and betting adherence is N/A',
    run: (t) => {
      const ended = playAll(begun(funded('check', { baseWager: '25' }), seed(1)), {
        visit: (state) => t.equal(state.phase === 'bet', false),
      });
      t.equal([challengeResults(ended)?.metrics['betting-adherence'], reviewOf(ended, 'table-bet')], [null, []]);
      const dealt = toPhase(begun(funded('check', { baseWager: '25' }), seed(1)), 'decision');
      t.equal(checkView(dealt).table?.funds, { balance: '975', wager: '25' });
    },
  },
];

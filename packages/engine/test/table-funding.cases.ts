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
  type PlaySetup,
  type TableBetReview,
  type TableCountReview,
  type TableDecisionReview,
  type TableStep,
} from '../src';

import { begun, checkView, NEXT, seed, SKIP, step } from './challenge.fixtures';
import { TEST_POLICY } from './blackjack-strategy.fixtures';
import { expectCheckViewHides } from './information-hiding';
import { playSpec, TABLE_CHECK } from './table.fixtures';

const CONTEXT = { installation: 'i', startedAt: 1, endedAt: 2, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null, pacing: 'self-paced' } as const;

const funded = (variant: 'learn' | 'check', funding: Partial<Pick<PlaySetup, 'betSchedule' | 'baseWager' | 'startingBalance'>>, mode: 'basic' | 'deviations' = 'basic'): ChallengeSpecification =>
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
    const command = state.phase === 'question' ? SKIP : state.phase === 'bet' ? bet(state) : state.phase === 'decision' ? decide(state) : state.phase === 'correction' ? OVERRIDE : NEXT;
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

const OVERRIDE: ChallengeCommand = { kind: 'override-correction' };
const SURRENDER: ChallengeCommand = { kind: 'play', action: 'surrender' };

// Round 1 loses half the wager by surrendering, where surrender is offered; later rounds stand
const surrenderFirst = (state: ChallengeState): ChallengeCommand =>
  state.table?.round === 1 && readChallengeView(state).table?.decision?.actions.includes('surrender') ? SURRENDER : standing(state);

function findSeed(spec: ChallengeSpecification, wanted: (state: ChallengeState) => boolean, options: Parameters<typeof playAll>[1] = {}): number {
  for (let n = 1; n < 300; n++) if (wanted(playAll(begun(spec, seed(n)), options))) return n;
  throw new Error('no seed has that attempt');
}

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
  {
    name: 'table Play funding: an unaffordable prescribed opening wager offers only the affordable legal amounts, with no hint of the prescribed one; the wager placed is a legal betting override',
    run: (t) => {
      for (const variant of ['check', 'learn'] as const) {
        const spec = funded(variant, { betSchedule: true, baseWager: '20', startingBalance: '20' });
        const n = findSeed(spec, (ended) => reviewOf(ended, 'table-bet').some((fact) => fact.round === 2 && fact.override), { decide: surrenderFirst });
        let state = begun(spec, seed(n));
        while (!(state.phase === 'bet' && state.table?.round === 2)) {
          const next = state.phase === 'question' ? SKIP : state.phase === 'bet' ? lowest(state) : state.phase === 'decision' ? surrenderFirst(state) : state.phase === 'correction' ? OVERRIDE : NEXT;
          state = step(state, next);
        }
        const view = readChallengeView(state);
        t.equal([variant, view.table?.bet, view.table?.funds], [variant, { amounts: ['10'], funding: true }, { balance: '10', wager: null }]);
        if (view.variant === 'check') expectCheckViewHides(t, 'funding notice', view);
        t.equal(factsOf(state, BET('10')), [
          { kind: 'content-shown', position: state.position + 1 },
          { kind: 'wager-placed', position: state.position + 1 },
        ]);
        const ended = playAll(step(state, BET('10')));
        const override = reviewOf(ended, 'table-bet').find((fact) => fact.round === 2);
        t.equal([override?.override, override?.chosen, override?.placed, override?.resolution, Number(override?.prescribed) > 10], [true, '10', '10', 'overridden', true]);
        const betting = challengeResults(ended)?.metrics['betting-adherence'];
        const misses = reviewOf(ended, 'table-bet').filter((fact) => fact.override || fact.chosen !== fact.prescribed).length;
        t.equal([betting?.total, betting && betting.total - betting.correct], [reviewOf(ended, 'table-bet').length, misses]);
      }
    },
  },
  {
    name: 'table Play funding without the bet schedule: an unaffordable base wager offers the affordable legal amounts; the override is reviewed but betting stays N/A',
    run: (t) => {
      const spec = funded('check', { baseWager: '20', startingBalance: '20' });
      const n = findSeed(spec, (ended) => reviewOf(ended, 'table-bet').some((fact) => fact.override), { decide: surrenderFirst });
      const ended = playAll(begun(spec, seed(n)), { decide: surrenderFirst });
      const [override] = reviewOf(ended, 'table-bet');
      t.equal([override?.round, override?.prescribed, override?.chosen, override?.override], [2, '20', '10', true]);
      t.equal(challengeResults(ended)?.metrics['betting-adherence'], null);
    },
  },
  {
    name: 'table Play bet schedule Learn: a wager off the schedule pauses before it is placed (cue 15) with retry or override; the first wager is scored',
    run: (t) => {
      const spec = funded('learn', { betSchedule: true });
      const atBet = toPhase(begun(spec, seed(1)), 'bet');
      t.equal(factsOf(atBet, BET('40')), [{ kind: 'correction-offered', position: atBet.position }]);
      const paused = step(atBet, BET('40'));
      const view = readChallengeView(paused);
      t.equal([view.phase, view.legalCommands, view.variant === 'learn' && view.betCorrection], [
        'correction',
        ['retry-correction', 'override-correction', 'reveal-count', 'end'],
        { position: atBet.position, trueCount: 0, prescribed: '10', chosen: '40' },
      ]);
      const retried = step(paused, { kind: 'retry-correction' });
      const overridden = step(paused, { kind: 'override-correction' });
      t.equal([readChallengeView(retried).table?.funds, readChallengeView(overridden).table?.funds], [
        { balance: '990', wager: '10' },
        { balance: '960', wager: '40' },
      ]);
      const [byRetry] = reviewOf(playAll(retried), 'table-bet');
      const [byOverride] = reviewOf(playAll(overridden), 'table-bet');
      t.equal([byRetry?.chosen, byRetry?.placed, byRetry?.resolution, byOverride?.chosen, byOverride?.placed, byOverride?.resolution], ['40', '10', 'retried', '40', '40', 'overridden']);
      t.equal([byRetry?.override, byOverride?.override], [false, false]);
      t.equal(factsOf(atBet, BET('10'))[0], { kind: 'content-shown', position: atBet.position + 1 });
    },
  },
  {
    name: 'table Play funding (#20 example): insufficient funds after round 7 with checkpoints at 4/8/10 ends early; the round-4 checkpoint stays and no round-7 question is added',
    run: (t) => {
      const spec = funded('check', { startingBalance: '30' });
      const ended = playAll(begun({ ...spec, table: { ...(spec.table as object), interval: 4 } } as ChallengeSpecification, seed(1)));
      t.equal([ended.ending, ended.table?.round], ['insufficient-funds', 7]);
      const asked = (ended.items as TableStep[]).flatMap((item) => (item.step === 'prompt' ? [`${item.round} ${item.timing} ${item.count}`] : []));
      t.equal(asked, ['4 block running', '4 block true']);
      const results = challengeResults(ended);
      t.equal([results?.ending, results?.metrics['running-count'], results?.metrics['true-count']], ['insufficient-funds', { correct: 0, total: 1 }, { correct: 0, total: 1 }]);
      t.equal(results?.metrics['playing-adherence']?.total, (ended.items as TableStep[]).filter((item) => item.step === 'decision').length);
      const finances = results?.finances;
      t.equal([finances?.startingBalance, Number(finances?.finishingBalance) < 10, Number(finances?.net)], ['30', true, Number(finances?.finishingBalance) - 30]);
      t.equal(challengeAttemptRecord(ended, CONTEXT).finances, finances);
      t.equal(challengeAttemptRecord(ended, CONTEXT).endingReason, 'insufficient-funds');
    },
  },
  {
    name: 'table Play funding at N=1: the after-round running count already due for the last completed round is asked; no before-bet count follows',
    run: (t) => {
      const ended = playAll(begun(funded('check', { startingBalance: '30' }), seed(1)));
      t.equal([ended.ending, ended.table?.round], ['insufficient-funds', 7]);
      const last = (ended.items as TableStep[]).at(-1);
      t.equal(last?.step === 'prompt' && [last.round, last.timing, last.count], [7, 'after-round', 'running']);
      t.equal(challengeResults(ended)?.metrics['running-count']?.total, 14);
      t.equal(challengeResults(ended)?.metrics['true-count']?.total, 7);
    },
  },
  {
    name: 'table Play funding (#20 example): ending while a legal opening wager is affordable is abandonment; once none is affordable it is insufficient funds',
    run: (t) => {
      const affordable = step(toPhase(begun(funded('check', { startingBalance: '30' }), seed(1)), 'decision'), END);
      t.equal(affordable.ending, 'abandoned');
      let state = begun(funded('check', { startingBalance: '30' }), seed(1));
      while (!(state.table?.round === 7 && state.phase === 'question' && (stepOf(state) as { timing?: string }).timing === 'after-round')) {
        state = step(state, state.phase === 'question' ? SKIP : state.phase === 'decision' ? standing(state) : NEXT);
      }
      t.equal(step(state, END).ending, 'insufficient-funds');
      t.equal(challengeResults(step(state, END))?.finances?.startingBalance, '30');
    },
  },
  {
    name: 'table Play funding (#20 example): challenge finances sit beside the skill metrics and never inside them; Observe has none',
    run: (t) => {
      const ended = playAll(begun(funded('check', { startingBalance: '500' }), seed(2)));
      const results = challengeResults(ended);
      const finances = results?.finances;
      t.equal([finances?.startingBalance, Number(finances?.net)], ['500', Number(finances?.finishingBalance) - 500]);
      t.equal(Object.keys(results?.metrics ?? {}).sort(), ['betting-adherence', 'card-values', 'playing-adherence', 'running-count', 'true-count']);
      const richer = challengeResults(playAll(begun(funded('check', { startingBalance: '5000' }), seed(2))));
      t.equal(richer?.metrics, results?.metrics);
      t.equal(challengeResults(playAll(begun(TABLE_CHECK, seed(2))))?.finances, null);
    },
  },
  {
    name: 'table Play funding: an unaffordable double, split or insurance is refused for funds alone (cue 9), never resized; play is graded against the legal fallback',
    run: (t) => {
      const spec = funded('check', { startingBalance: '10' });
      const value = (card: { rank: number }) => (card.rank >= 10 ? 10 : card.rank);
      // TEST_POLICY doubles hard 9–11 against these up cards; on the original late-surrender hand short of funds it hits instead
      const doubles = (state: ChallengeState) => {
        const table = readChallengeView(state).table;
        const hand = table?.seats.find((seat) => seat.learner)?.hands[0];
        const total = (hand?.cards ?? []).reduce((sum, card) => sum + value(card), 0);
        const soft = (hand?.cards ?? []).some((card) => card.rank === 1);
        return table?.round === 1 && table.decision?.kind === 'hand' && !soft && hand?.cards.length === 2 && TEST_POLICY.first.hard[total - 4]?.[value(table.dealer.cards[0] as { rank: number }) - 1] === 'D';
      };
      let found: ChallengeState | null = null;
      for (let n = 1; n < 300 && !found; n++) {
        const state = toPhase(begun(spec, seed(n)), 'decision');
        if (doubles(state)) found = state;
      }
      if (!found) throw new Error('no seed doubles first');
      const view = checkView(found);
      t.equal([view.table?.decision?.actions.includes('double'), view.table?.decision?.unaffordable, view.table?.funds], [false, [{ action: 'double', amount: '10' }], { balance: '0', wager: '10' }]);
      t.equal(factsOf(found, { kind: 'play', action: 'double' }), [{ kind: 'move-refused', position: found.position, action: 'double' }]);
      const refused = step(found, { kind: 'play', action: 'double' });
      t.equal([checkView(refused).phase, checkView(refused).table?.decision?.refused, checkView(refused).table?.decision?.refusal], ['decision', 'double', 'funds']);
      expectCheckViewHides(t, 'refused for funds', checkView(refused));
      const ended = playAll(step(refused, { kind: 'play', action: 'hit' }), { decide: standing });
      const [first] = (challengeResults(ended)?.review ?? []).filter((fact): fact is TableDecisionReview => fact.kind === 'table-decision');
      t.equal([first?.prescribed, first?.fallback, first?.chosen, first?.refused, first?.unaffordable, first?.played], ['hit', true, 'hit', [], ['double'], 'hit']);
    },
  },
  {
    name: 'table Play funding: insurance the balance can\'t cover is refused for funds; declining is the legal fallback',
    run: (t) => {
      const spec = funded('check', { startingBalance: '10' }, 'deviations');
      let found: ChallengeState | null = null;
      for (let n = 1; n < 400 && !found; n++) {
        const state = toPhase(begun(spec, seed(n)), 'decision');
        if (readChallengeView(state).table?.decision?.kind === 'insurance') found = state;
      }
      if (!found) throw new Error('no seed offers insurance first');
      t.equal([checkView(found).table?.decision?.actions, checkView(found).table?.decision?.unaffordable], [['decline-insurance'], [{ action: 'insure', amount: '5' }]]);
      const refused = step(found, { kind: 'play', action: 'insure' });
      t.equal(checkView(refused).table?.decision?.refusal, 'funds');
      const ended = playAll(step(refused, DECLINE));
      const [first] = (challengeResults(ended)?.review ?? []).filter((fact): fact is TableDecisionReview => fact.kind === 'table-decision');
      t.equal([first?.decision, first?.prescribed, first?.chosen, first?.unaffordable], ['insurance', 'decline-insurance', 'decline-insurance', ['insure']]);
    },
  },
  {
    name: 'table Play funding (#20 example): a zero balance after round 10 and its answers still completes the attempt',
    run: (t) => {
      const ended = playAll(begun(funded('check', { startingBalance: '10' }), seed(28)));
      const results = challengeResults(ended);
      t.equal([ended.ending, ended.table?.round, results?.finances?.finishingBalance, results?.finances?.net], ['completed', 10, '0', '-10']);
      t.equal([results?.metrics['running-count']?.total, results?.metrics['true-count']?.total], [20, 10]);
    },
  },
  {
    name: 'table Play: the wager (cue 2) and the round\'s net result (cues 6–8) are facts when they are shown, and the balance moves only then',
    run: (t) => {
      let state = begun(funded('check', {}), seed(1));
      const seen: string[] = [];
      while (state.phase !== 'ended' && (state.table?.round ?? 0) <= 2) {
        const command = state.phase === 'question' ? SKIP : state.phase === 'decision' ? standing(state) : NEXT;
        const facts = factsOf(state, command);
        state = step(state, command);
        const funds = readChallengeView(state).table?.funds;
        for (const fact of facts) {
          if (fact.kind === 'wager-placed') seen.push(`wager ${funds?.balance} ${funds?.wager}`);
          if (fact.kind === 'round-settled') seen.push(`settled ${fact.net} ${funds?.balance} ${funds?.wager}`);
        }
      }
      t.equal(seen.slice(0, 2), ['wager 990 10', `settled ${seen[1]?.split(' ')[1]} ${990 + 10 + Number(seen[1]?.split(' ')[1])} null`]);
      t.equal(seen.filter((line) => line.startsWith('wager')).length >= 2, true);
    },
  },
  {
    name: 'table Play funding Check: no view in a funded attempt carries a prescription, correctness or a future card, through bets, notices, shortfalls and the early ending',
    run: (t) => {
      for (const n of [1, 3, 7]) {
        const ended = playAll(begun(funded('check', { betSchedule: true, baseWager: '10', startingBalance: '40' }, 'deviations'), seed(n)), {
          bet: (state) => BET(readChallengeView(state).table?.bet?.amounts.at(-1) as string),
          decide: (state) => {
            const decision = readChallengeView(state).table?.decision;
            const short = decision?.unaffordable[0];
            return short && decision?.refused === null ? { kind: 'play', action: short.action } : standing(state);
          },
          visit: (state) => {
            const view = checkView(state);
            expectCheckViewHides(t, `${n} ${state.phase} ${state.position}`, view);
            t.equal(JSON.stringify(view).includes('"order"'), false);
          },
        });
        expectCheckViewHides(t, 'ended', checkView(ended));
      }
    },
  },
];

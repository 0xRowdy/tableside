// Spec 3 Count checkpoints (table), Scoring and review; Amendment 1 A3, C4; #138
import type { TestCase } from '@tableside/harness';

import {
  advanceChallenge,
  challengeAttemptRecord,
  challengeResults,
  decodeChallengeCheckpoint,
  encodeChallengeCheckpoint,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeFact,
  type ChallengeSpecification,
  type ChallengeState,
  type PlayChoice,
  type TableDecisionReview,
  type TableStep,
} from '../src';

import { ANSWER, begun, checkView, learnView, NEXT, seed, SKIP, step } from './challenge.fixtures';
import { expectCheckViewHides } from './information-hiding';
import { TEST_POLICY } from './blackjack-strategy.fixtures';
import { playSpec } from './table.fixtures';

const stepOf = (state: ChallengeState) => state.items[state.position] as TableStep;

function toDecision(start: ChallengeState): ChallengeState {
  let state = start;
  while (state.phase !== 'decision' && state.phase !== 'ended') state = step(state, state.phase === 'question' ? SKIP : NEXT);
  return state;
}

const PLAY = (action: PlayChoice): ChallengeCommand => ({ kind: 'play', action });
const RETRY_MOVE: ChallengeCommand = { kind: 'retry-correction' };
const OVERRIDE: ChallengeCommand = { kind: 'override-correction' };

const standing = (state: ChallengeState): ChallengeCommand => PLAY(readChallengeView(state).table?.decision?.kind === 'insurance' ? 'decline-insurance' : 'stand');

function playAll(
  start: ChallengeState,
  options: { readonly decide?: (state: ChallengeState) => ChallengeCommand; readonly answer?: (state: ChallengeState) => ChallengeCommand; readonly visit?: (state: ChallengeState) => void } = {},
): ChallengeState {
  const { decide = standing, answer = () => SKIP, visit = () => undefined } = options;
  let state = start;
  while (state.phase !== 'ended') {
    visit(state);
    const command = state.phase === 'question' ? answer(state) : state.phase === 'decision' ? decide(state) : state.phase === 'correction' ? OVERRIDE : NEXT;
    state = step(state, command);
  }
  return state;
}

function factsOf(state: ChallengeState, command: ChallengeCommand): readonly ChallengeFact[] {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `f-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
  return result.facts;
}

const decisionsOf = (state: ChallengeState) => (challengeResults(state)?.review ?? []).filter((fact): fact is TableDecisionReview => fact.kind === 'table-decision');

const value = (card: { rank: number }) => (card.rank >= 10 ? 10 : card.rank);

// Spec 3 Testing Decisions › Seam 1 (independent fixtures: TEST_DEVIATIONS)
function dependsOnCount(step: Extract<TableStep, { step: 'decision' }>, cards: readonly { rank: number }[], up: { rank: number }, hands: number): boolean | null {
  if (step.decision === 'insurance') return true;
  const total = cards.reduce((sum, card) => sum + value(card), 0);
  const soft = cards.some((card) => card.rank === 1) && total + 10 <= 21;
  const pair = cards.length === 2 && value(cards[0] as { rank: number }) === value(cards[1] as { rank: number });
  const u = value(up);
  if (pair) return value(cards[0] as { rank: number }) === 10 && (u === 5 || u === 6) ? true : null;
  if (soft) return false;
  const two = cards.length === 2;
  const surrender = two && hands === 1;
  const basicSurrenders16v10 = surrender;
  return (total === 16 && u === 10 && !basicSurrenders16v10) || (total === 12 && u === 3) || (total === 13 && u === 2) || (two && total === 10 && u === 10) || (surrender && u === 10 && (total === 14 || total === 15));
}

// Spec 3 Testing Decisions › Seam 1 (independent fixtures: TEST_POLICY's first-decision rows)
function standingIsBasic(fact: TableDecisionReview): boolean {
  if (fact.decision === 'insurance') return fact.chosen === 'decline-insurance';
  const up = value(fact.up);
  const row = fact.pair ? TEST_POLICY.first.pair[value(fact.cards[0] as { rank: number }) - 1] : fact.total.soft ? TEST_POLICY.first.soft[fact.total.value - 12] : TEST_POLICY.first.hard[fact.total.value - 4];
  return row?.[up - 1] === 'S';
}

function findSeed(spec: ChallengeSpecification, wanted: (ended: ChallengeState) => boolean, decide = standing): number {
  for (let n = 1; n < 400; n++) if (wanted(playAll(begun(spec, seed(n)), { decide }))) return n;
  throw new Error('no seed has that attempt');
}

export const tablePlayCases: TestCase[] = [
  {
    name: 'table Play: the round deals in order and stops at the learner\'s first decision, offering the legal moves',
    run: (t) => {
      const state = toDecision(begun(playSpec('check', 'basic'), seed(1)));
      const view = checkView(state);
      t.equal([view.phase, view.legalCommands, view.table?.seat, view.table?.countingMode], ['decision', ['play', 'reveal-count', 'end'], 'play', 'basic']);
      t.equal(stepOf(state), { step: 'decision', round: 1, target: 'hand-1', decision: 'hand', actions: ['hit', 'stand', 'double', 'surrender'], unaffordable: [], events: [] });
      t.equal(view.table?.decision, { target: 'hand-1', kind: 'hand', actions: ['hit', 'stand', 'double', 'surrender'], unaffordable: [], refused: null, refusal: null });
      t.equal(view.table?.seats.find((seat) => seat.learner)?.hands[0]?.cards, [
        { rank: 13, suit: 'diamonds' },
        { rank: 4, suit: 'clubs' },
      ]);
      t.equal(readChallengeView(state).table?.dealer.cards, [{ rank: 3, suit: 'hearts' }, null]);
    },
  },
  {
    name: 'table Play Check: a legal move plays at once with no hint; the round finishes, settles and asks the running count after the dealer\'s last card',
    run: (t) => {
      const atDecision = toDecision(begun(playSpec('check', 'basic'), seed(1)));
      t.equal(factsOf(atDecision, PLAY('stand')), [{ kind: 'content-shown', position: atDecision.position + 1 }]);
      let state = step(atDecision, PLAY('stand'));
      const seen: string[] = [];
      while (state.phase === 'card') {
        const item = stepOf(state);
        if (item.step === 'reveal' || item.step === 'deal') seen.push(`${item.step === 'reveal' ? 'hole' : item.to} ${item.face?.rank}${item.face?.suit[0]}`);
        state = step(state, NEXT);
      }
      t.equal(seen, ['hole 3d', 'dealer 3c', 'dealer 4c', 'dealer 12c']);
      const view = checkView(state);
      t.equal([view.phase, view.table?.prompt, view.table?.settled], ['question', { checkpoint: 2, timing: 'after-round', count: 'running' }, true]);
      t.equal(view.table?.seats.find((seat) => seat.learner)?.hands[0]?.action, 'stand');
      expectCheckViewHides(t, 'after the move', view);
    },
  },
  {
    name: 'table Play Check: an illegal move is refused at once (cue 9) and kept as the attempt; the legal move then plays',
    run: (t) => {
      const atDecision = toDecision(begun(playSpec('check', 'basic'), seed(1)));
      t.equal(factsOf(atDecision, PLAY('split')), [{ kind: 'move-refused', position: atDecision.position, action: 'split' }]);
      const refused = step(atDecision, PLAY('split'));
      const view = checkView(refused);
      t.equal([view.phase, view.legalCommands, view.table?.decision?.refused], ['decision', ['play', 'reveal-count', 'end'], 'split']);
      expectCheckViewHides(t, 'refused', view);
      const ended = playAll(step(refused, PLAY('stand')));
      const [first] = decisionsOf(ended);
      t.equal(first && [first.round, first.cards, first.up, first.total, first.prescribed, first.chosen, first.refused, first.played, first.resolution], [
        1,
        [
          { rank: 13, suit: 'diamonds' },
          { rank: 4, suit: 'clubs' },
        ],
        { rank: 3, suit: 'hearts' },
        { value: 14, soft: false },
        'stand',
        'split',
        ['split'],
        'stand',
        'followed',
      ]);
    },
  },
  {
    name: 'table Play: playing adherence is exact first-move accuracy against the reference at the actual count, beside the two count metrics',
    run: (t) => {
      const ended = playAll(begun(playSpec('check', 'basic'), seed(1)));
      const results = challengeResults(ended);
      const decisions = decisionsOf(ended);
      t.equal([results?.ending, decisions.length > 0, results?.metrics['card-values'], results?.metrics['betting-adherence']], ['completed', true, null, null]);
      t.equal(results?.metrics['playing-adherence'], { correct: decisions.filter(standingIsBasic).length, total: decisions.length });
      t.equal(results?.metrics['running-count'], { correct: 0, total: 20 });
      t.equal(results?.metrics['true-count'], { correct: 0, total: 10 });
      const positions = results?.review.map((fact) => fact.position) ?? [];
      t.equal(positions, [...positions].sort((a, b) => a - b));
      t.equal([decisions[0]?.prescribed, decisions[0]?.chosen], ['stand', 'stand']);
    },
  },
  {
    name: 'table Play N=1 with deviations: the true count is asked before each count-dependent decision, insurance included, and nowhere else',
    run: (t) => {
      let dependent = 0;
      let insurance = 0;
      for (let n = 1; n <= 12; n++) {
        const ended = playAll(begun(playSpec('check', 'deviations'), seed(n)), {
          visit: (state) => {
            if (state.phase !== 'decision') return;
            const item = stepOf(state);
            if (item.step !== 'decision') return;
            const table = checkView(state).table;
            const hands = table?.seats.find((seat) => seat.learner)?.hands ?? [];
            const hand = hands.find((candidate) => candidate.target === item.target);
            const expected = dependsOnCount(item, hand?.cards ?? [], table?.dealer.cards[0] ?? { rank: 0 }, hands.length);
            const before = state.items[state.position - 1] as TableStep;
            const asked = before.step === 'prompt' && before.timing === 'decision';
            if (expected !== null) t.equal([n, state.position, item.target, asked], [n, state.position, item.target, expected]);
            if (asked) {
              t.equal([before.count, before.round], ['true', item.round]);
              dependent++;
              if (item.decision === 'insurance') insurance++;
            }
          },
        });
        const prompts = (ended.items as TableStep[]).filter((item) => item.step === 'prompt');
        t.equal(prompts.filter((item) => item.timing === 'decision').every((item, index, all) => index === 0 || item.checkpoint > (all[index - 1] as typeof item).checkpoint), true);
      }
      t.equal([dependent > 0, insurance > 0], [true, true]);
    },
  },
  {
    name: 'table Play: deviation-decision prompts score in the true-count metric; cue 11 is due when one appears',
    run: (t) => {
      const n = findSeed(playSpec('check', 'deviations'), (ended) => (ended.items as TableStep[]).some((item) => item.step === 'prompt' && item.timing === 'decision'));
      const ended = playAll(begun(playSpec('check', 'deviations'), seed(n)));
      const asked = (ended.items as TableStep[]).filter((item) => item.step === 'prompt');
      const results = challengeResults(ended);
      t.equal(results?.metrics['true-count']?.total, asked.filter((item) => item.count === 'true').length);
      t.equal(results?.metrics['true-count']?.total, 10 + asked.filter((item) => item.timing === 'decision').length);
      let state = begun(playSpec('check', 'deviations'), seed(n));
      while (!(stepOf(state).step === 'prompt' && (stepOf(state) as { timing: string }).timing === 'decision')) {
        const next = state.phase === 'question' ? SKIP : state.phase === 'decision' ? standing(state) : NEXT;
        const upcoming = state.position + 1;
        const facts = factsOf(state, next);
        state = step(state, next);
        if (state.position === upcoming && stepOf(state).step === 'prompt' && (stepOf(state) as { timing: string }).timing === 'decision') t.equal(facts, [{ kind: 'checkpoint-due', position: upcoming }]);
      }
      t.equal([checkView(state).phase, checkView(state).table?.prompt?.timing, checkView(state).countRange], ['question', 'decision', { min: -240, max: 240 }]);
      expectCheckViewHides(t, 'deviation prompt', checkView(state));
    },
  },
  {
    name: 'table Play: with basic, or at N>1, no deviation-decision prompt is asked and decisions continue normally',
    run: (t) => {
      for (let n = 1; n <= 6; n++) {
        for (const spec of [playSpec('check', 'basic'), playSpec('check', 'deviations', { interval: 3 })]) {
          const ended = playAll(begun(spec, seed(n)));
          t.equal((ended.items as TableStep[]).some((item) => item.step === 'prompt' && item.timing === 'decision'), false);
          t.equal((ended.items as TableStep[]).filter((item) => item.step === 'decision').length, decisionsOf(ended).length);
        }
      }
      const blocks = playAll(begun(playSpec('check', 'deviations', { interval: 3 }), seed(2)));
      t.equal(
        (blocks.items as TableStep[]).flatMap((item) => (item.step === 'prompt' ? [`${item.round} ${item.timing} ${item.count}`] : [])),
        [3, 6, 9, 10].flatMap((round) => [`${round} block running`, `${round} block true`]),
      );
    },
  },
  {
    name: 'table Play Learn: a departing move pauses before it executes (cue 15) with retry or override; following moves play at once',
    run: (t) => {
      const atDecision = toDecision(begun(playSpec('learn', 'basic'), seed(1)));
      t.equal(factsOf(atDecision, PLAY('hit')), [{ kind: 'correction-offered', position: atDecision.position }]);
      const paused = step(atDecision, PLAY('hit'));
      const view = learnView(paused);
      t.equal([view.phase, view.legalCommands, view.correction?.actual, view.correction?.explanation.prescribed, view.correction?.explanation.cell?.play], [
        'correction',
        ['retry-correction', 'override-correction', 'reveal-count', 'end'],
        { action: 'hit', amount: null },
        { action: 'stand', amount: null },
        'stand',
      ]);
      t.equal(view.table?.seats.find((seat) => seat.learner)?.hands[0]?.cards.length, 2);
      const retried = step(paused, RETRY_MOVE);
      t.equal([learnView(retried).correction, learnView(retried).table?.step], [null, 'reveal']);
      const overridden = step(paused, OVERRIDE);
      t.equal([learnView(overridden).table?.step, (stepOf(overridden) as { to?: string }).to], ['deal', 'hand-1']);
      t.equal(learnView(overridden).table?.seats.find((seat) => seat.learner)?.hands[0]?.cards.length, 3);
      t.equal(factsOf(atDecision, PLAY('stand')), [{ kind: 'content-shown', position: atDecision.position + 1 }]);
      const [byRetry] = decisionsOf(playAll(retried));
      const [byOverride] = decisionsOf(playAll(overridden));
      t.equal([byRetry?.chosen, byRetry?.played, byRetry?.resolution, byOverride?.chosen, byOverride?.played, byOverride?.resolution], ['hit', 'stand', 'retried', 'hit', 'hit', 'overridden']);
    },
  },
  {
    name: 'table Play Learn: an override keeps the shoe, the round, the answers and the decisions already made (Amendment 1 C4)',
    run: (t) => {
      const atDecision = toDecision(begun(playSpec('learn', 'basic'), seed(1)));
      const overridden = step(step(atDecision, PLAY('hit')), OVERRIDE);
      t.equal([overridden.answers, overridden.table?.round, overridden.items.slice(0, atDecision.position + 1)], [atDecision.answers, atDecision.table?.round, atDecision.items.slice(0, atDecision.position + 1)]);
      t.equal(overridden.table?.seat?.activity.shoe?.order, atDecision.table?.seat?.activity.shoe?.order);
      t.equal(playAll(overridden).table?.round, 10);
    },
  },
  {
    name: 'table Play review: where the learner entered a count, the review names the play at that count; right policy on a wrong count changes no score',
    run: (t) => {
      const spec = playSpec('check', 'deviations');
      const hitting = (state: ChallengeState) => (readChallengeView(state).table?.decision?.kind === 'insurance' ? PLAY('decline-insurance') : PLAY('hit'));
      const lowCount = (state: ChallengeState) => ((stepOf(state) as { timing?: string }).timing === 'decision' ? ANSWER(-5) : SKIP);
      const isCase = (fact: TableDecisionReview) => fact.total.value === 16 && value(fact.up) === 10 && fact.prescribed === 'stand';
      let found: { n: number; fact: TableDecisionReview } | null = null;
      for (let n = 1; n < 400 && !found; n++) {
        const fact = decisionsOf(playAll(begun(spec, seed(n)), { decide: hitting, answer: lowCount })).find(isCase);
        if (fact) found = { n, fact };
      }
      if (!found) throw new Error('no seed has 16 v 10 at a positive count');
      const { fact } = found;
      t.equal([fact.countDependent, fact.trueCount >= 1, fact.entered, fact.atEntered, fact.chosen, fact.prescribed], [true, true, -5, 'hit', 'hit', 'stand']);
      const entered = challengeResults(playAll(begun(spec, seed(found.n)), { decide: hitting, answer: lowCount }));
      const skipped = challengeResults(playAll(begun(spec, seed(found.n)), { decide: hitting }));
      t.equal([entered?.metrics['playing-adherence'], entered?.metrics['true-count']?.total], [skipped?.metrics['playing-adherence'], skipped?.metrics['true-count']?.total]);
      t.equal(entered?.metrics['true-count']?.correct, skipped?.metrics['true-count']?.correct);
      const unentered = decisionsOf(playAll(begun(spec, seed(found.n)), { decide: hitting })).find(isCase);
      t.equal([unentered?.entered, unentered?.atEntered], ['skip', null]);
    },
  },
  {
    name: 'table Play Check: no view in any phase carries correctness, a reference, a prescription or a future card; a checkpoint resumes mid-decision',
    run: (t) => {
      for (const spec of [playSpec('check', 'deviations'), playSpec('check', 'basic', { interval: 2 })]) {
        let resumed = 0;
        const ended = playAll(begun(spec, seed(3)), {
          answer: (state) => ANSWER(stepOf(state).round),
          decide: (state) => (state.sequence % 3 === 0 ? PLAY('split') : standing(state)),
          visit: (state) => {
            const view = checkView(state);
            expectCheckViewHides(t, `${state.phase} ${state.position}`, view);
            t.equal(JSON.stringify(view).includes('"order"'), false);
            if (state.phase === 'decision') {
              const decoded = decodeChallengeCheckpoint(encodeChallengeCheckpoint(state));
              if (decoded.ok && encodeChallengeCheckpoint(decoded.state) === encodeChallengeCheckpoint(state)) resumed++;
            }
          },
        });
        expectCheckViewHides(t, 'ended', checkView(ended));
        t.equal(resumed > 0, true);
      }
      const paused = step(toDecision(begun(playSpec('learn', 'basic'), seed(1))), PLAY('hit'));
      const decoded = decodeChallengeCheckpoint(encodeChallengeCheckpoint(paused));
      t.equal(decoded.ok && learnView(decoded.state).correction?.actual, { action: 'hit', amount: null });
    },
  },
  {
    name: 'table Play record: the group key carries Play and the counting mode',
    run: (t) => {
      const context = { installation: 'i', startedAt: 1, endedAt: 2, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null, pacing: 'self-paced' } as const;
      const basic = challengeAttemptRecord(playAll(begun(playSpec('check', 'basic'), seed(1))), context).groupKey.table;
      const deviations = challengeAttemptRecord(playAll(begun(playSpec('check', 'deviations', { interval: 2 }), seed(1))), context).groupKey.table;
      t.equal([basic?.seat, basic?.countingMode, basic?.betSchedule, basic?.baseWager, basic?.startingBalance, basic?.checkpointInterval], ['play', 'basic', false, '10', '1000', 1]);
      t.equal([deviations?.seat, deviations?.countingMode, deviations?.checkpointInterval], ['play', 'deviations', 2]);
    },
  },
  {
    name: 'table Play: setups are refused when the policy doesn\'t fit the table or the count isn\'t the learner\'s',
    run: (t) => {
      const refusal = (setup: unknown) => {
        try {
          begun({ ...playSpec('check', 'basic'), table: setup } as never, seed(1));
        } catch (error) {
          return error instanceof Error ? error.message : 'non-error';
        }
        return 'no error';
      };
      const setup = playSpec('check', 'deviations').table as unknown as Record<string, unknown> & { policy: Record<string, unknown>; rules: Record<string, unknown> };
      t.equal(refusal({ ...setup, policy: { ...setup.policy, count: 'supplied' } }), 'in table counting you keep the count yourself');
      t.equal(refusal({ ...setup, rules: { ...setup.rules, lateSurrender: false } }), "your seat needs a playing policy for the table's rules");
      t.equal(refusal({ ...setup, policy: null }), "your seat needs a playing policy for the table's rules");
      t.equal(refusal({ ...setup, strategy: null }), 'a table setup has a seat, rules, a strategy or playing policy, and interval');
    },
  },
];

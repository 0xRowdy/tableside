// Spec 3 Challenge content › Conversion, Learn, Check and assistance, Scoring and review, Seam 1; #134
import type { TestCase } from '@tableside/harness';

import {
  advanceChallenge,
  challengeAttemptRecord,
  challengeResults,
  createChallenge,
  decodeChallengeCheckpoint,
  encodeChallengeCheckpoint,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeState,
} from '../src';

import { ANSWER, begun, checkView, CONVERSION_CHECK, CONVERSION_LEARN, learnView, NEXT, RETRY, REVEAL, run, seed, SKIP, step } from './challenge.fixtures';
import { throws } from './fixtures';
import { expectCheckViewHides } from './information-hiding';

// docs/cross-runtime-harness.md Adding cases
const SEED_1_QUESTIONS = [[-15, 5.5], [12, 0.5], [11, 3.5], [18, 5], [-19, 3.5], [0, 1.5], [14, 4.5], [0, 5], [19, 3], [9, 0.5]];
const SEED_1_TRUE_COUNTS_BY_HAND = [-2, 24, 3, 3, -5, 0, 3, 0, 6, 18];

const questions = (state: ChallengeState) => state.items.map((item) => ('running' in item ? [item.running, item.decks] : null));

// Spec 3 Challenge content › Conversion
const isExact = ([running, decks]: readonly number[]) => Number.isInteger((running as number) / (decks as number));

// Spec 3 Testing Decisions › Seam 1
const BOUNDARIES = [
  { running: 0, decks: 3, trueCount: 0, rounded: 0 },
  { running: 8, decks: 2, trueCount: 4, rounded: 4 },
  { running: -9, decks: 1.5, trueCount: -6, rounded: -6 },
  { running: 7, decks: 2, trueCount: 3, rounded: 4 },
  { running: -7, decks: 2, trueCount: -3, rounded: -4 },
  { running: 5, decks: 0.5, trueCount: 10, rounded: 10 },
  { running: -20, decks: 0.5, trueCount: -40, rounded: -40 },
  { running: 20, decks: 6, trueCount: 3, rounded: 3 },
  { running: -13, decks: 6, trueCount: -2, rounded: -3 },
  { running: -1, decks: 6, trueCount: 0, rounded: -1 },
] as const;

const stacked = (state: ChallengeState): ChallengeState => ({ ...state, items: BOUNDARIES.map(({ running, decks }) => ({ running, decks })) });

const answering = (entries: readonly ChallengeCommand[]) => entries.flatMap((entry) => [entry, NEXT]);

export const conversionCases: TestCase[] = [
  {
    name: 'conversion: 10 questions with a running count in −20..+20 and a half-deck divisor in 0.5..6, covering every case, across many seeds',
    run: (t) => {
      for (let n = 0; n < 300; n++) {
        const set = questions(begun(CONVERSION_CHECK, seed(n))) as [number, number][];
        const inRange = set.every(([running, decks]) => Number.isInteger(running) && Math.abs(running) <= 20 && Number.isInteger(decks * 2) && decks >= 0.5 && decks <= 6);
        const covers = {
          zero: set.some(([running]) => running === 0),
          positive: set.some(([running]) => running > 0),
          negative: set.some(([running]) => running < 0),
          exact: set.some((question) => question[0] !== 0 && isExact(question)),
          positiveTruncated: set.some((question) => question[0] > 0 && !isExact(question)),
          negativeTruncated: set.some((question) => question[0] < 0 && !isExact(question)),
        };
        t.equal([n, set.length, inRange, covers], [n, 10, true, { zero: true, positive: true, negative: true, exact: true, positiveTruncated: true, negativeTruncated: true }]);
      }
    },
  },
  {
    name: 'conversion: content is a pure function of the content definition and the random stream, the same in Learn and Check',
    run: (t) => {
      t.equal(questions(begun(CONVERSION_LEARN, seed(3))), questions(begun(CONVERSION_CHECK, seed(3))));
      t.equal([questions(begun(CONVERSION_CHECK, seed(1))), begun(CONVERSION_CHECK, seed(1)).rejected], [SEED_1_QUESTIONS, 1]);
      t.equal(challengeResults(run(begun(CONVERSION_CHECK, seed(1)), answering(SEED_1_TRUE_COUNTS_BY_HAND.map(ANSWER))))?.metrics['true-count'], { correct: 10, total: 10 });
      t.equal(JSON.stringify(questions(begun(CONVERSION_CHECK, seed(3)))) === JSON.stringify(questions(begun(CONVERSION_CHECK, seed(4)))), false);
    },
  },
  {
    name: 'conversion: the answer is the running count ÷ decks remaining truncated toward zero, at zero, ±exact, ±fractional, and divisors 0.5 and 6',
    run: (t) => {
      const exact = challengeResults(run(stacked(begun(CONVERSION_CHECK, seed(1))), answering(BOUNDARIES.map(({ trueCount }) => ANSWER(trueCount)))));
      t.equal([exact?.ending, exact?.metrics['true-count'], exact?.metrics['running-count'], exact?.metrics['card-values']], ['completed', { correct: 10, total: 10 }, null, null]);
      const rounded = challengeResults(run(stacked(begun(CONVERSION_CHECK, seed(1))), answering(BOUNDARIES.map(({ rounded }) => ANSWER(rounded)))));
      t.equal(rounded?.metrics['true-count'], { correct: 6, total: 10 });
      t.equal(rounded?.review.slice(3, 5), [
        { kind: 'conversion', position: 4, running: 7, decks: 2, entered: 4, reference: 3, error: 1 },
        { kind: 'conversion', position: 5, running: -7, decks: 2, entered: -4, reference: -3, error: -1 },
      ]);
      t.equal(Object.is(rounded?.review[9]?.reference, -0), false);
    },
  },
  {
    name: 'conversion Check: Skip is a submission scored incorrect, with no error magnitude',
    run: (t) => {
      const results = challengeResults(run(stacked(begun(CONVERSION_CHECK, seed(1))), answering([SKIP, ...BOUNDARIES.slice(1).map(({ trueCount }) => ANSWER(trueCount))])));
      t.equal([results?.metrics['true-count'], results?.review[0]], [{ correct: 9, total: 10 }, { kind: 'conversion', position: 1, running: 0, decks: 3, entered: 'skip', reference: 0, error: null }]);
    },
  },
  {
    name: 'conversion Learn: each question gives the running count and decks remaining, then explains the arithmetic; only the first answer is scored',
    run: (t) => {
      const question = learnView(stacked(begun(CONVERSION_LEARN, seed(1))));
      t.equal([question.phase, question.position, question.length, question.item, question.choices, question.countRange, question.checkpoints, question.countAid, question.legalCommands, question.feedback], [
        'question',
        1,
        10,
        { running: 0, decks: 3 },
        [],
        { min: -40, max: 40 },
        null,
        null,
        ['answer', 'skip', 'end'],
        null,
      ]);
      const atFive = run(stacked(begun(CONVERSION_LEARN, seed(1))), [ANSWER(0), NEXT, ANSWER(4), NEXT, ANSWER(-6), NEXT, ANSWER(3), NEXT]);
      const wrong = learnView(step(atFive, ANSWER(-4)));
      t.equal([wrong.phase, wrong.item, wrong.legalCommands, wrong.feedback], [
        'explanation',
        { running: -7, decks: 2 },
        ['retry-item', 'next-item', 'end'],
        { entered: -4, correct: false, reference: -3, scored: true, explanation: { kind: 'conversion', running: -7, decks: 2, trueCount: -3, exact: false } },
      ]);
      const retried = learnView(run(atFive, [ANSWER(-4), RETRY, ANSWER(-3)]));
      t.equal([retried.feedback?.correct, retried.feedback?.scored, retried.legalCommands], [true, false, ['next-item', 'end']]);
      t.equal(learnView(step(stacked(begun(CONVERSION_LEARN, seed(1))), ANSWER(0))).feedback?.explanation, { kind: 'conversion', running: 0, decks: 3, trueCount: 0, exact: true });
      const ended = run(atFive, [ANSWER(-4), RETRY, ANSWER(-3), NEXT, ...answering(BOUNDARIES.slice(5).map(({ trueCount }) => ANSWER(trueCount)))]);
      t.equal(challengeResults(ended)?.metrics['true-count'], { correct: 9, total: 10 });
    },
  },
  {
    name: 'conversion: a malformed or out-of-range true count is refused with no transition, and there is no count to reveal',
    run: (t) => {
      const state = stacked(begun(CONVERSION_CHECK, seed(1)));
      const send = (value: unknown) => advanceChallenge(state, { sequence: state.sequence, commandId: 'x', command: { kind: 'answer', value } as never });
      t.equal([2.5, 41, -41, '3', null].map((value) => send(value).status), ['rejected', 'rejected', 'rejected', 'rejected', 'rejected']);
      t.equal([send(40).status, send(-40).status], ['committed', 'committed']);
      t.equal(advanceChallenge(state, { sequence: state.sequence, commandId: 'r', command: REVEAL }).status, 'rejected');
      t.equal([checkView(state).countAid, checkView(state).legalCommands], [null, ['answer', 'skip', 'end']]);
    },
  },
  {
    name: 'conversion Check: views hide correctness and references in every phase; right and wrong answers look the same until the end',
    run: (t) => {
      const visitAll = (entries: readonly ChallengeCommand[]) => {
        let state = createChallenge(CONVERSION_CHECK, seed(1));
        const trace: unknown[] = [];
        for (const command of [{ kind: 'begin' } as const, ...answering(entries)]) {
          const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
          if (result.status !== 'committed') throw new Error(result.status);
          state = command.kind === 'begin' ? stacked(result.state) : result.state;
          const view = checkView(state);
          expectCheckViewHides(t, `${view.phase} ${view.position}`, view);
          trace.push({ view: { ...view, entered: null, results: null }, facts: result.facts });
        }
        return trace;
      };
      t.equal(visitAll(BOUNDARIES.map(({ rounded }) => ANSWER(rounded))), visitAll(BOUNDARIES.map(({ trueCount }) => ANSWER(trueCount))));
      const recorded = checkView(step(stacked(begun(CONVERSION_CHECK, seed(1))), ANSWER(5)));
      t.equal([recorded.phase, recorded.entered, recorded.item, recorded.legalCommands], ['recorded', 5, { running: 0, decks: 3 }, ['next-item', 'end']]);
    },
  },
  {
    name: 'conversion: an attempt resumes exactly, its record is grouped as conversion with no reference, and the content definition is validated',
    run: (t) => {
      const midway = run(begun(CONVERSION_LEARN, seed(5)), [ANSWER(1), NEXT, ANSWER(0)]);
      const text = encodeChallengeCheckpoint(midway);
      const decoded = decodeChallengeCheckpoint(text);
      if (!decoded.ok) throw new Error(decoded.error.message);
      t.equal([encodeChallengeCheckpoint(decoded.state), readChallengeView(decoded.state)], [text, readChallengeView(midway)]);
      const ended = step(begun(CONVERSION_CHECK, seed(5)), { kind: 'end' });
      const record = challengeAttemptRecord(ended, { installation: 'd', startedAt: 0, endedAt: 1, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null });
      t.equal([record.groupKey.category, record.groupKey.assistanceClass, record.groupKey.countRevealed, record.groupKey.reference, record.groupKey.length, record.metrics['true-count']], [
        'conversion',
        'unassisted-check',
        false,
        null,
        10,
        null,
      ]);
      const content = CONVERSION_CHECK.content;
      const bad = [{ ...content, length: 3 }, { ...content, length: 41 }, { ...content, maxRunningCount: 0 }, { ...content, maxDecks: 1 }, { ...content, maxDecks: 9 }, { ...content, maxDecks: 6.5 }, { ...content, coverage: 'every-rank' }];
      t.equal(
        bad.map((spec) => throws(() => createChallenge({ ...CONVERSION_CHECK, content: spec as never }, seed(1)))),
        bad.map(() => 'ChallengeSpecificationError'),
      );
    },
  },
];

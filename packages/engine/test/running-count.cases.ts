// Spec 3 Challenge content › Running count; Learn, Check and assistance; Scoring and review; Testing Decisions › Seam 1; #133
import type { TestCase } from '@tableside/harness';

import {
  advanceChallenge,
  challengeAttemptRecord,
  challengeResults,
  createChallenge,
  decodeChallengeCheckpoint,
  encodeChallengeCheckpoint,
  readChallengeView,
  runningCountDrift,
  type ChallengeCommand,
  type ChallengeState,
} from '../src';

import { ANSWER, begun, COUNT_CHECK, COUNT_LEARN, checkView, learnView, NEXT, RETRY, REVEAL, run, seed, SKIP, step } from './challenge.fixtures';
import { throws } from './fixtures';
import { expectCheckViewHides } from './information-hiding';

// Seed 1: the first 52 cards of a six-deck shoe shuffled with spec 1's random protocol.
const SEED_1_SHOE = [
  '13d', '3h', '4c', '3d', '3c', '4c', '12c', '11d', '13c', '7s', '11d', '12h', '1s',
  '6s', '8h', '2h', '10h', '13c', '5c', '13h', '7s', '9h', '5h', '1h', '5h', '4s',
  '9h', '6c', '3s', '7c', '11d', '1c', '9h', '12s', '3c', '5h', '12c', '12d', '7d',
  '4c', '11c', '13d', '10s', '9s', '9s', '1s', '12s', '10c', '10c', '8s', '7d', '7d',
];

// Hand-computed Hi-Lo running counts after cards 13, 26, 39 and 52 of SEED_1_SHOE.
const SEED_1_CHECKPOINTS = [-2, 0, -1, -7];
// Hand-computed running count after card 21 (13 cards at −2, then 6s +1, 8h 0, 2h +1, 10h −1, Kc −1, 5c +1, Kh −1, 7s 0).
const SEED_1_AFTER_21 = -2;

const cards = (state: ChallengeState) => state.items.map((item) => `${item.card.rank}${item.card.suit[0]}`);

const nexts = (count: number): ChallengeCommand[] => Array.from({ length: count }, () => NEXT);

// Check: twelve cards pass, then each checkpoint is answered and the next block of twelve passes.
const checkRun = (entries: readonly ChallengeCommand[]) => [...nexts(12), ...entries.flatMap((entry, index) => [entry, ...(index < 3 ? [NEXT, ...nexts(12)] : [NEXT])])];

export const runningCountCases: TestCase[] = [
  {
    name: 'running count: 52 cards exposed from index 0 of a shuffled six-deck shoe, starting at zero',
    run: (t) => {
      const state = begun(COUNT_CHECK, seed(1));
      t.equal(cards(state), SEED_1_SHOE);
      t.equal(cards(begun(COUNT_LEARN, seed(1))), SEED_1_SHOE);
      for (let n = 0; n < 50; n++) {
        const copies = new Map<string, number>();
        for (const card of cards(begun(COUNT_CHECK, seed(n)))) copies.set(card, (copies.get(card) ?? 0) + 1);
        t.equal([n, [...copies.values()].every((count) => count <= 6), cards(begun(COUNT_CHECK, seed(n))).length], [n, true, 52]);
      }
      const view = checkView(state);
      t.equal([view.phase, view.position, view.length, view.legalCommands, view.choices, view.countRange, view.checkpoints, view.countAid], [
        'card',
        1,
        52,
        ['next-item', 'reveal-count', 'end'],
        [],
        { min: -52, max: 52 },
        [13, 26, 39, 52],
        { revealed: false, count: null },
      ]);
    },
  },
  {
    name: 'running count Check: asks only after cards 13, 26, 39 and 52',
    run: (t) => {
      let state = begun(COUNT_CHECK, seed(1));
      const asked: number[] = [];
      while (state.phase !== 'ended') {
        if (state.phase === 'question') {
          asked.push(state.position + 1);
          state = step(state, ANSWER(0));
        } else state = step(state, NEXT);
      }
      t.equal(asked, [13, 26, 39, 52]);
      t.equal(challengeResults(state)?.metrics['running-count']?.total, 4);
    },
  },
  {
    name: 'running count Check: hand-computed checkpoints with drift carried across checkpoints, each wrong checkpoint its own error',
    run: (t) => {
      // One early miss after checkpoint 1 (the 6 of spades at card 14 counted as 0) carries through to the end.
      const ended = run(begun(COUNT_CHECK, seed(1)), checkRun([ANSWER(-2), ANSWER(-1), ANSWER(-2), ANSWER(-8)]));
      const results = challengeResults(ended);
      t.equal([results?.ending, results?.metrics['running-count'], results?.metrics['card-values'], results?.assisted], ['completed', { correct: 1, total: 4 }, null, false]);
      t.equal(results?.review, [
        { kind: 'running-count', checkpoint: 1, position: 13, entered: -2, reference: SEED_1_CHECKPOINTS[0], error: 0 },
        { kind: 'running-count', checkpoint: 2, position: 26, entered: -1, reference: SEED_1_CHECKPOINTS[1], error: -1 },
        { kind: 'running-count', checkpoint: 3, position: 39, entered: -2, reference: SEED_1_CHECKPOINTS[2], error: -1 },
        { kind: 'running-count', checkpoint: 4, position: 52, entered: -8, reference: SEED_1_CHECKPOINTS[3], error: -1 },
      ]);
      t.equal(runningCountDrift(results?.review ?? []), { from: 2, error: -1 });
      const perfect = challengeResults(run(begun(COUNT_CHECK, seed(1)), checkRun(SEED_1_CHECKPOINTS.map(ANSWER))));
      t.equal([perfect?.metrics['running-count'], runningCountDrift(perfect?.review ?? [])], [{ correct: 4, total: 4 }, null]);
    },
  },
  {
    name: 'running count: drift is a run of at least two answered checkpoints off by the same amount up to the last answer; skips neither break nor make one',
    run: (t) => {
      const fact = (checkpoint: number, entered: number | 'skip', reference: number) => ({
        kind: 'running-count' as const,
        checkpoint,
        position: checkpoint * 13,
        entered,
        reference,
        error: entered === 'skip' ? null : entered - reference,
      });
      t.equal(
        [
          runningCountDrift([fact(1, 3, 3), fact(2, 1, -1), fact(3, 4, 2), fact(4, 'skip', -2)]),
          runningCountDrift([fact(1, 3, 3), fact(2, 1, -1), fact(3, 2, 2), fact(4, 0, -2)]),
          runningCountDrift([fact(1, 3, 3), fact(2, 3, 3), fact(3, 2, 2), fact(4, 0, -2)]),
          runningCountDrift([fact(1, 'skip', 3), fact(2, 'skip', 3)]),
          runningCountDrift([fact(1, 5, 3), fact(2, 'skip', 3), fact(3, 4, 2)]),
        ],
        [{ from: 2, error: 2 }, null, null, null, { from: 1, error: 2 }],
      );
    },
  },
  {
    name: 'running count Check: Skip at a checkpoint is a submission scored incorrect, with no error magnitude',
    run: (t) => {
      const results = challengeResults(run(begun(COUNT_CHECK, seed(1)), checkRun([ANSWER(-2), ANSWER(0), ANSWER(-1), SKIP])));
      t.equal(results?.metrics['running-count'], { correct: 3, total: 4 });
      t.equal(results?.review[3], { kind: 'running-count', checkpoint: 4, position: 52, entered: 'skip', reference: -7, error: null });
      const recorded = checkView(run(begun(COUNT_CHECK, seed(1)), [...nexts(12), SKIP]));
      t.equal([recorded.phase, recorded.entered, recorded.legalCommands], ['recorded', 'skip', ['next-item', 'reveal-count', 'end']]);
    },
  },
  {
    name: 'running count Learn: asks after every card and explains the count before the next card; only the first answer is scored',
    run: (t) => {
      const first = learnView(begun(COUNT_LEARN, seed(1)));
      t.equal([first.phase, first.position, first.legalCommands, first.checkpoints, first.feedback], ['question', 1, ['answer', 'skip', 'reveal-count', 'end'], null, null]);
      const wrong = learnView(step(begun(COUNT_LEARN, seed(1)), ANSWER(1)));
      t.equal([wrong.phase, wrong.legalCommands, wrong.feedback], [
        'explanation',
        ['retry-item', 'next-item', 'reveal-count', 'end'],
        { entered: 1, correct: false, reference: -1, scored: true, explanation: { kind: 'running-count', rank: 13, value: -1, before: 0, count: -1 } },
      ]);
      const corrected = learnView(run(begun(COUNT_LEARN, seed(1)), [ANSWER(1), RETRY, ANSWER(-1)]));
      t.equal([corrected.feedback?.correct, corrected.feedback?.scored, corrected.legalCommands], [true, false, ['next-item', 'reveal-count', 'end']]);
      const second = learnView(run(begun(COUNT_LEARN, seed(1)), [ANSWER(1), NEXT, ANSWER(0)]));
      t.equal(second.feedback, { entered: 0, correct: true, reference: 0, scored: true, explanation: { kind: 'running-count', rank: 3, value: 1, before: -1, count: 0 } });
      const ended = run(
        begun(COUNT_LEARN, seed(1)),
        Array.from({ length: 52 }, (_, index): ChallengeCommand[] => (index === 0 ? [ANSWER(1), RETRY, ANSWER(-1), NEXT] : [SKIP, NEXT])).flat(),
      );
      const results = challengeResults(ended);
      t.equal([results?.metrics['running-count'], results?.review.length, results?.review[12]], [
        { correct: 0, total: 52 },
        52,
        { kind: 'running-count', checkpoint: 13, position: 13, entered: 'skip', reference: SEED_1_CHECKPOINTS[0], error: null },
      ]);
    },
  },
  {
    name: 'running count: a malformed or out-of-range count is refused with no transition',
    run: (t) => {
      const state = run(begun(COUNT_CHECK, seed(1)), nexts(12));
      const send = (value: unknown) => advanceChallenge(state, { sequence: state.sequence, commandId: 'x', command: { kind: 'answer', value } as never });
      t.equal([2.5, 53, -53, '3', null, Number.NaN].map((value) => send(value).status), ['rejected', 'rejected', 'rejected', 'rejected', 'rejected', 'rejected']);
      t.equal([send(52).status, send(-52).status], ['committed', 'committed']);
      t.equal(advanceChallenge(begun(), { sequence: 1, commandId: 'x', command: ANSWER(2) }).status, 'rejected');
    },
  },
  {
    name: 'running count Check: the first reveal marks the attempt assisted permanently, records its card and shows only the exposed cards’ count',
    run: (t) => {
      const before = run(begun(COUNT_CHECK, seed(1)), [...nexts(12), ANSWER(-2), NEXT, ...nexts(7)]);
      const result = advanceChallenge(before, { sequence: before.sequence, commandId: 'reveal', command: REVEAL });
      if (result.status !== 'committed') throw new Error(result.status);
      t.equal(result.facts, []);
      const revealed = checkView(result.state);
      t.equal([revealed.phase, revealed.position, revealed.assisted, revealed.countAid, revealed.legalCommands], ['card', 21, true, { revealed: true, count: SEED_1_AFTER_21 }, ['next-item', 'end']]);
      t.equal(advanceChallenge(result.state, { sequence: result.state.sequence, commandId: 'again', command: REVEAL }).status, 'rejected');
      const later = run(result.state, [...nexts(5), ANSWER(0)]);
      t.equal([checkView(later).countAid, checkView(later).assisted], [{ revealed: true, count: SEED_1_CHECKPOINTS[1] }, true]);
      const ended = run(result.state, [...nexts(5), ANSWER(0), NEXT, ...nexts(12), ANSWER(-1), NEXT, ...nexts(12), ANSWER(-7), NEXT]);
      const results = challengeResults(ended);
      t.equal([results?.assisted, results?.assistanceStep, results?.metrics['running-count']], [true, 21, { correct: 4, total: 4 }]);
      const record = challengeAttemptRecord(ended, { installation: 'd', startedAt: 0, endedAt: 1, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null });
      t.equal([record.groupKey.assistanceClass, record.groupKey.countRevealed, record.groupKey.reference, record.groupKey.length, record.assistanceStep], [
        'assisted-check',
        true,
        { id: 'blackjack-reference', version: 1 },
        52,
        21,
      ]);
      t.equal(advanceChallenge(createChallenge(COUNT_CHECK, seed(1)), { sequence: 0, commandId: 'r', command: REVEAL }).status, 'rejected');
      t.equal(advanceChallenge(begun(), { sequence: 1, commandId: 'r', command: REVEAL }).status, 'rejected');
    },
  },
  {
    name: 'running count Learn: revealing is recorded for the comparison group',
    run: (t) => {
      const shown = run(begun(COUNT_LEARN, seed(1)), [ANSWER(-1), NEXT, REVEAL]);
      t.equal([learnView(shown).countAid, learnView(shown).legalCommands], [{ revealed: true, count: 0 }, ['answer', 'skip', 'end']]);
      const ended = step(shown, { kind: 'end' });
      const record = challengeAttemptRecord(ended, { installation: 'd', startedAt: 0, endedAt: 1, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null });
      t.equal([record.groupKey.assistanceClass, record.groupKey.countRevealed, record.assistanceStep, record.endingReason], ['learn', true, 2, 'abandoned']);
      const hidden = challengeAttemptRecord(step(begun(COUNT_LEARN, seed(1)), { kind: 'end' }), { installation: 'd', startedAt: 0, endedAt: 1, interrupted: false, performanceMs: null, meteringBasis: 'challenge-attempt', allowancePolicyVersion: null });
      t.equal([hidden.groupKey.countRevealed, hidden.assistanceStep], [false, null]);
    },
  },
  {
    name: 'running count Check: unrevealed views hide correctness, references and drift in every phase; right and wrong counts look the same',
    run: (t) => {
      const visitAll = (entries: readonly ChallengeCommand[]) => {
        let state = createChallenge(COUNT_CHECK, seed(1));
        const trace: unknown[] = [];
        for (const command of [{ kind: 'begin' } as const, ...checkRun(entries)]) {
          const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
          if (result.status !== 'committed') throw new Error(result.status);
          state = result.state;
          const view = checkView(state);
          expectCheckViewHides(t, `${view.phase} ${view.position}`, view);
          t.equal(view.countAid?.count ?? null, null);
          trace.push({ view: { ...view, entered: null, results: null }, facts: result.facts });
        }
        return trace;
      };
      t.equal(visitAll([ANSWER(5), ANSWER(-9), ANSWER(20), ANSWER(1)]), visitAll(SEED_1_CHECKPOINTS.map(ANSWER)));
    },
  },
  {
    name: 'running count: a checkpoint with a reveal resumes exactly, and the content definition is validated',
    run: (t) => {
      const midway = run(begun(COUNT_CHECK, seed(1)), [...nexts(4), REVEAL, ...nexts(8), ANSWER(-2)]);
      const text = encodeChallengeCheckpoint(midway);
      const decoded = decodeChallengeCheckpoint(text);
      if (!decoded.ok) throw new Error(decoded.error.message);
      t.equal([encodeChallengeCheckpoint(decoded.state), readChallengeView(decoded.state)], [text, readChallengeView(midway)]);
      const content = COUNT_CHECK.content;
      const bad = [
        { ...content, checkpoints: [13, 26, 39] },
        { ...content, checkpoints: [26, 13, 39, 52] },
        { ...content, checkpoints: [0, 13, 52] },
        { ...content, decks: 0 },
        { ...content, length: 400 },
        { ...content, reference: null },
        { ...content, coverage: 'every-rank' },
      ];
      t.equal(
        bad.map((spec) => throws(() => createChallenge({ ...COUNT_CHECK, content: spec as never }, seed(1)))),
        bad.map(() => 'ChallengeSpecificationError'),
      );
    },
  },
];

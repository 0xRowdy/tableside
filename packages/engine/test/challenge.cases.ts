// Spec 3 Challenge content, Learn, Check and assistance, Scoring and review; #158, #132, #133
import type { TestCase } from '@tableside/harness';

import { advanceChallenge, canonicalJson, challengeAttemptRecord, challengeResults, ENGINE_VERSION, createChallenge, decodeChallengeCheckpoint, encodeChallengeCheckpoint, readChallengeView, type ChallengeState } from '../src';

import { ANSWER, begun, cardItems, CHECK, checkView, LEARN, learnView, NEXT, RETRY, run, seed, SKIP, step } from './challenge.fixtures';
import { throws } from './fixtures';
import { expectCheckViewHides, revealingFields } from './information-hiding';

const SEED_1_CARDS = ['5d', '7d', '10c', '2c', '7h', '2s', '11h', '4s', '6h', '11c', '12d', '9h', '2d', '6h', '2s', '1c', '9s', '8d', '3c', '13s'];
// Spec 1 Game rules, Counting (Hi-Lo)
const SEED_1_HI_LO = [1, 0, -1, 1, 0, 1, -1, 1, 1, -1, -1, 0, 1, 1, 1, -1, 0, 0, 1, -1] as const;

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];

const cards = (state: ChallengeState) => cardItems(state).map((item) => `${item.card.rank}${item.card.suit[0]}`);

export const challengeCases: TestCase[] = [
  {
    name: 'challenge: a card-values attempt shows no content until it begins',
    run: (t) => {
      const created = createChallenge(LEARN, seed(1));
      const view = readChallengeView(created);
      t.equal([view.phase, view.item, view.length, view.legalCommands], ['ready', null, 20, ['begin', 'end']]);
      t.equal(created.items, []);
    },
  },
  {
    name: 'challenge: card values has 20 cards from the thirteen ranks and four suits, every rank at least once, across many seeds',
    run: (t) => {
      const suitsSeen = new Set<string>();
      for (let n = 0; n < 300; n++) {
        const state = begun(LEARN, seed(n));
        const items = cardItems(state);
        t.equal([n, items.length], [n, 20]);
        t.equal([n, [...new Set(items.map((item) => item.card.rank))].sort((a, b) => a - b)], [n, RANKS]);
        for (const item of items) {
          if (!SUITS.includes(item.card.suit)) throw new Error(`seed ${n}: suit ${item.card.suit}`);
          suitsSeen.add(item.card.suit);
        }
      }
      t.equal([...suitsSeen].sort(), SUITS);
    },
  },
  {
    name: 'challenge: content is a pure function of the content definition and the random stream',
    run: (t) => {
      t.equal(cards(begun(LEARN, seed(7))), cards(begun({ ...LEARN, attemptId: 'other', owner: 'o', device: 'd' }, seed(7))));
      t.equal(cards(begun(LEARN, seed(7))) === cards(begun(LEARN, seed(8))), false);
      const pinned = begun(LEARN, seed(1));
      t.equal(cards(pinned), SEED_1_CARDS);
      t.equal(pinned.rejected, 39);
    },
  },
  {
    name: 'challenge: Learn shows no reference while a card waits, then correctness, the reference and an explanation after the answer',
    run: (t) => {
      const waiting = learnView(step(begun(), ANSWER(1)));
      t.equal(waiting.feedback?.correct, true);
      const second = step(step(begun(), ANSWER(1)), NEXT);
      const question = learnView(second);
      t.equal([question.phase, question.position, question.item, question.feedback, question.choices, question.legalCommands], [
        'question',
        2,
        { card: { rank: 7, suit: 'diamonds' } },
        null,
        [1, 0, -1],
        ['answer', 'skip', 'end'],
      ]);
      const wrong = learnView(step(second, ANSWER(1)));
      t.equal([wrong.phase, wrong.feedback, wrong.legalCommands], [
        'explanation',
        { entered: 1, correct: false, reference: 0, scored: true, explanation: { kind: 'hi-lo-value', rank: 7, value: 0 } },
        ['retry-item', 'next-item', 'end'],
      ]);
      const retried = learnView(run(second, [ANSWER(1), RETRY, ANSWER(0)]));
      t.equal([retried.feedback?.correct, retried.feedback?.scored, retried.legalCommands], [true, false, ['next-item', 'end']]);
      t.equal(wrong.assisted, true);
    },
  },
  {
    name: 'challenge: only the first submission is scored; a corrected card still counts as wrong (hand-computed)',
    run: (t) => {
      const commands = SEED_1_HI_LO.flatMap((value) => (value === 1 ? [ANSWER(1), NEXT] : [ANSWER(1), RETRY, ANSWER(value), NEXT]));
      const ended = run(begun(), commands);
      const results = challengeResults(ended);
      t.equal([ended.phase, results?.ending], ['ended', 'completed']);
      t.equal(results?.metrics, { 'card-values': { correct: 9, total: 20 }, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null });
      t.equal(results?.review[1], { kind: 'card-value', position: 2, card: { rank: 7, suit: 'diamonds' }, entered: 1, reference: 0 });
      t.equal([results?.assisted, results?.assistanceStep], [true, null]);
    },
  },
  {
    name: 'challenge: Skip is an explicit submission scored incorrect',
    run: (t) => {
      const commands = SEED_1_HI_LO.flatMap((value, index) => (index === 2 ? [SKIP, NEXT] : [ANSWER(value), NEXT]));
      const results = challengeResults(run(begun(), commands));
      t.equal(results?.metrics['card-values'], { correct: 19, total: 20 });
      t.equal(results?.review[2]?.entered, 'skip');
    },
  },
  {
    name: 'challenge: ending early keeps the answers so far; a metric with no answers is N/A, never 100%',
    run: (t) => {
      const abandoned = challengeResults(run(begun(), [ANSWER(1), NEXT, ANSWER(0), NEXT, { kind: 'end' }]));
      t.equal([abandoned?.ending, abandoned?.metrics['card-values']], ['abandoned', { correct: 2, total: 2 }]);
      const before = challengeResults(run(createChallenge(LEARN, seed(1)), [{ kind: 'end' }]));
      t.equal([before?.ending, before?.metrics['card-values'], before?.review], ['abandoned', null, []]);
    },
  },
  {
    name: 'challenge: commands outside their phase, stale sequences and reused command ids are refused',
    run: (t) => {
      const state = begun();
      const send = (envelope: unknown) => advanceChallenge(state, envelope as never).status;
      t.equal(
        [
          send({ sequence: 1, commandId: 'x', command: { kind: 'next-item' } }),
          send({ sequence: 0, commandId: 'x', command: ANSWER(1) }),
          send({ sequence: 1, commandId: 'x', command: { kind: 'answer', value: 2 } }),
          send({ sequence: 0, commandId: 'c-0', command: { kind: 'begin' } }),
          send({ sequence: 0, commandId: 'c-0', command: ANSWER(1) }),
        ],
        ['rejected', 'rejected', 'rejected', 'duplicate', 'rejected'],
      );
    },
  },
  {
    name: 'challenge: a checkpoint resumes exactly where it was, regenerating nothing, and a damaged one is refused',
    run: (t) => {
      const midway = run(begun(), [ANSWER(1), NEXT, ANSWER(1)]);
      const text = encodeChallengeCheckpoint(midway);
      const decoded = decodeChallengeCheckpoint(text);
      if (!decoded.ok) throw new Error(decoded.error.message);
      t.equal(encodeChallengeCheckpoint(decoded.state), text);
      t.equal(readChallengeView(step(decoded.state, RETRY)), readChallengeView(step(midway, RETRY)));
      const tampered = (change: (value: Record<string, unknown>) => void) => {
        const value = JSON.parse(text) as Record<string, unknown>;
        change(value);
        const result = decodeChallengeCheckpoint(canonicalJson(value));
        return result.ok ? 'ok' : result.error.kind;
      };
      t.equal(
        [
          tampered((v) => (v.position = 5)),
          tampered((v) => ((v.items as { card: { rank: number } }[])[0]!.card.rank = 13)),
          tampered((v) => (v.schema = (v.schema as number) + 1)),
          tampered((v) => ((v.identities as { engine: string }).engine = '99.0.0')),
          decodeChallengeCheckpoint('{').ok ? 'ok' : 'damaged',
        ],
        ['damaged', 'damaged', 'unsupported', 'unsupported', 'damaged'],
      );
    },
  },
  {
    name: 'challenge: an ended attempt makes one attempt record with every field of the shape, filled from the attempt and its context',
    run: (t) => {
      const ended = run(begun(), SEED_1_HI_LO.flatMap((value) => [ANSWER(value), NEXT]));
      const record = challengeAttemptRecord(ended, {
        installation: 'device-1',
        startedAt: 1_000,
        endedAt: 61_000,
        interrupted: false,
        performanceMs: null,
        meteringBasis: 'challenge-attempt',
        allowancePolicyVersion: 'policy-3',
      });
      t.equal(record, {
        recordVersion: 1,
        attemptId: 'attempt-1',
        owner: 'owner-1',
        installation: 'device-1',
        groupKey: {
          category: 'card-values',
          variant: 'learn',
          assistanceClass: 'learn',
          countRevealed: false,
          content: { id: 'card-values', version: 1 },
          reference: null,
          length: 20,
          pacing: 'self-paced',
          table: null,
        },
        identities: { engine: ENGINE_VERSION, content: { id: 'card-values', version: 1 }, reference: null, random: seed(1) },
        endingReason: 'completed',
        metrics: { 'card-values': { correct: 20, total: 20 }, 'running-count': null, 'true-count': null, 'playing-adherence': null, 'betting-adherence': null },
        review: challengeResults(ended)?.review,
        assistanceStep: null,
        interrupted: false,
        performanceMs: null,
        finances: null,
        allowancePolicyVersion: 'policy-3',
        meteringBasis: 'challenge-attempt',
        startedAt: 1_000,
        endedAt: 61_000,
      });
      t.equal(throws(() => challengeAttemptRecord(begun(), { installation: 'd', startedAt: 0, endedAt: 0, interrupted: false, performanceMs: null, meteringBasis: 'premium', allowancePolicyVersion: null })), 'Error');
    },
  },
  {
    name: 'challenge: a malformed specification or content definition is refused',
    run: (t) => {
      const bad = [
        { ...LEARN, content: { ...LEARN.content, length: 12 } },
        { ...LEARN, content: { ...LEARN.content, coverage: 'some' } },
        { ...LEARN, content: { ...LEARN.content, category: 'poker' } },
        { ...LEARN, attemptId: '' },
        { ...LEARN, variant: 'quiz' },
      ];
      t.equal(
        bad.map((spec) => throws(() => createChallenge(spec as never, seed(1)))),
        bad.map(() => 'ChallengeSpecificationError'),
      );
    },
  },
  {
    name: 'challenge Check: every phase shows only the exercise, legal choices and the attempt’s own entry; the review arrives when it ends',
    run: (t) => {
      let state = createChallenge(CHECK, seed(1));
      const phases: string[] = [];
      const visit = (label: string) => {
        const view = readChallengeView(state);
        if (!phases.includes(view.phase)) phases.push(view.phase);
        expectCheckViewHides(t, label, view);
        t.equal([label, view.assisted], [label, false]);
      };
      visit('created');
      state = step(state, { kind: 'begin' });
      SEED_1_HI_LO.forEach((value, index) => {
        visit(`card ${index + 1} waiting`);
        state = step(state, index % 3 === 2 ? SKIP : ANSWER(index % 2 === 0 ? value : (-value as -1 | 0 | 1)));
        visit(`card ${index + 1} recorded`);
        state = step(state, NEXT);
      });
      visit('ended');
      t.equal(phases, ['ready', 'question', 'recorded', 'ended']);
    },
  },
  {
    name: 'challenge Check: a recorded answer shows the entry and nothing else, and offers only the next card or ending',
    run: (t) => {
      const recorded = readChallengeView(step(begun(CHECK), ANSWER(-1)));
      t.equal(recorded, {
        attemptId: 'attempt-1',
        category: 'card-values',
        variant: 'check',
        phase: 'recorded',
        sequence: 2,
        legalCommands: ['next-item', 'end'],
        length: 20,
        position: 1,
        item: { card: { rank: 5, suit: 'diamonds' } },
        choices: [1, 0, -1],
        countRange: null,
        checkpoints: null,
        countAid: null,
        table: null,
        entered: -1,
        assisted: false,
        results: null,
      });
      t.equal(checkView(step(begun(CHECK), SKIP)).entered, 'skip');
      t.equal(advanceChallenge(step(begun(CHECK), ANSWER(1)), { sequence: 2, commandId: 'r', command: RETRY }).status, 'rejected');
    },
  },
  {
    name: 'challenge Check: right and wrong answers give the same views, legal commands and facts, apart from the entry itself',
    run: (t) => {
      const right = SEED_1_HI_LO.map((value) => ANSWER(value));
      const wrong = SEED_1_HI_LO.map((value) => ANSWER(value === 1 ? -1 : 1));
      const trace = (answers: readonly ReturnType<typeof ANSWER>[]) => {
        let state = begun(CHECK);
        return answers.flatMap((answer) => {
          const out = [];
          for (const command of [answer, NEXT]) {
            const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
            if (result.status !== 'committed') throw new Error(result.status);
            state = result.state;
            const view = { ...checkView(state), entered: null, results: null };
            out.push({ view, facts: result.facts });
          }
          return out;
        });
      };
      t.equal(trace(wrong), trace(right));
    },
  },
  {
    name: 'challenge Check: scores first answers and reviews every card with its entry or skip, reference and position (hand-computed)',
    run: (t) => {
      const commands = SEED_1_HI_LO.flatMap((_, index) => [index === 0 ? SKIP : ANSWER(1), NEXT]);
      const results = challengeResults(run(begun(CHECK), commands));
      t.equal([results?.ending, results?.metrics['card-values'], results?.assisted, results?.assistanceStep], ['completed', { correct: 8, total: 20 }, false, null]);
      t.equal(results?.review.slice(0, 3), [
        { kind: 'card-value', position: 1, card: { rank: 5, suit: 'diamonds' }, entered: 'skip', reference: 1 },
        { kind: 'card-value', position: 2, card: { rank: 7, suit: 'diamonds' }, entered: 1, reference: 0 },
        { kind: 'card-value', position: 3, card: { rank: 10, suit: 'clubs' }, entered: 1, reference: -1 },
      ]);
      t.equal(results?.review.length, 20);
      const record = challengeAttemptRecord(run(begun(CHECK), commands), {
        installation: 'device-1',
        startedAt: 0,
        endedAt: 1,
        interrupted: false,
        performanceMs: null,
        meteringBasis: 'challenge-attempt',
        allowancePolicyVersion: null,
      });
      t.equal([record.groupKey.variant, record.groupKey.assistanceClass, record.groupKey.countRevealed], ['check', 'unassisted-check', false]);
    },
  },
  {
    name: 'challenge: cards not on display never change the current view, in Learn or Check (no future cards, no history)',
    run: (t) => {
      for (const spec of [LEARN, CHECK]) {
        const states = [run(begun(spec), [ANSWER(1), NEXT]), run(begun(spec), [ANSWER(1), NEXT, ANSWER(0)])];
        for (const state of states) {
          const others: ChallengeState = {
            ...state,
            items: cardItems(state).map((item, index) => (index === state.position ? item : { card: { rank: item.card.rank === 13 ? 1 : 13, suit: 'spades' } })),
          };
          t.equal([spec.variant, readChallengeView(others)], [spec.variant, readChallengeView(state)]);
        }
      }
    },
  },
  {
    name: 'challenge Learn: the view carries correctness, the reference and an explanation once a card is answered',
    run: (t) => {
      const explained = readChallengeView(step(begun(), ANSWER(-1)));
      t.equal(revealingFields(explained), ['view.feedback']);
      t.equal(revealingFields(readChallengeView(begun())), []);
    },
  },
];

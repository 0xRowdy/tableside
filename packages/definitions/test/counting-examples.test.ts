// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #153
import type { ConversionExplanation, RunningCountExplanation, TableRunningExplanation } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { workedExampleProblems, type ConversionExample, type RunningCountExample, type TableCountExample } from '../src';

const SEVEN_OVER_TWO: ConversionExplanation = { kind: 'conversion', running: 7, decks: 2, trueCount: 3, exact: false };
const CONVERSION: ConversionExample = {
  kind: 'conversion',
  step: 1,
  running: 7,
  decks: 2,
  choices: [
    { answer: 3, response: { correct: true, explanation: SEVEN_OVER_TWO, note: null } },
    { answer: 4, response: { correct: false, explanation: SEVEN_OVER_TWO, note: 'Rounding up is the slip.' } },
  ],
};

const PLUS_TWO_THEN_FIVE: RunningCountExplanation = { kind: 'running-count', rank: 5, value: 1, before: 2, count: 3 };
const RUNNING: RunningCountExample = {
  kind: 'running-count',
  step: 1,
  before: 2,
  card: { rank: 5, suit: 'hearts' },
  choices: [
    { answer: 3, response: { correct: true, explanation: PLUS_TWO_THEN_FIVE, note: null } },
    { answer: 1, response: { correct: false, explanation: PLUS_TWO_THEN_FIVE, note: null } },
  ],
};

// Spec 3 Count checkpoints (table): the hole card counts once it is turned over
const ROUND: TableRunningExplanation = {
  kind: 'table-running',
  round: 1,
  cards: [
    { rank: 10, suit: 'spades' },
    { rank: 5, suit: 'clubs' },
    { rank: 6, suit: 'hearts' },
    { rank: 13, suit: 'diamonds' },
    { rank: 9, suit: 'spades' },
  ],
  values: [-1, 1, 1, -1, 0],
  before: 0,
  shuffled: false,
  count: 0,
};
const TABLE: TableCountExample = {
  kind: 'table-count',
  step: 1,
  seat: [
    { rank: 10, suit: 'spades' },
    { rank: 6, suit: 'hearts' },
  ],
  dealer: [
    { rank: 5, suit: 'clubs' },
    { rank: 13, suit: 'diamonds' },
    { rank: 9, suit: 'spades' },
  ],
  choices: [
    { answer: 0, response: { correct: true, explanation: ROUND, note: null } },
    { answer: 1, response: { correct: false, explanation: ROUND, note: 'The hole card counts once it is turned over.' } },
  ],
};

describe('counting worked examples', () => {
  it('pass the build-time check when every scripted response matches the engine replay', () => {
    expect(workedExampleProblems(CONVERSION, 1)).toEqual([]);
    expect(workedExampleProblems({ ...CONVERSION, running: -7, choices: CONVERSION.choices.map((c) => ({ ...c, answer: -c.answer, response: { ...c.response, explanation: { ...SEVEN_OVER_TWO, running: -7, trueCount: -3 } } })) }, 1)).toEqual([]);
    expect(workedExampleProblems(RUNNING, 1)).toEqual([]);
    const negative: RunningCountExample = {
      ...RUNNING,
      before: -3,
      card: { rank: 1, suit: 'clubs' },
      choices: [
        { answer: -4, response: { correct: true, explanation: { kind: 'running-count', rank: 1, value: -1, before: -3, count: -4 }, note: null } },
        { answer: -2, response: { correct: false, explanation: { kind: 'running-count', rank: 1, value: -1, before: -3, count: -4 }, note: null } },
      ],
    };
    expect(workedExampleProblems(negative, 1)).toEqual([]);
    expect(workedExampleProblems(TABLE, 1)).toEqual([]);
  });

  it('fail the build when a scripted verdict or explanation disagrees with the engine', () => {
    const swapped = { ...CONVERSION, choices: CONVERSION.choices.map((c) => ({ ...c, response: { ...c.response, correct: !c.response.correct } })) };
    expect(workedExampleProblems(swapped, 1)).toEqual([
      'worked example, choice +3: scripted as incorrect, but the engine marks it correct',
      'worked example, choice +4: scripted as correct, but the engine marks it incorrect',
    ]);
    const rounded = { ...CONVERSION, choices: [CONVERSION.choices[0]!, { answer: 4, response: { correct: false, explanation: { ...SEVEN_OVER_TWO, trueCount: 4 }, note: null } }] };
    expect(workedExampleProblems(rounded, 1)).toEqual([
      'worked example, choice +4: the scripted explanation {"decks":2,"exact":false,"kind":"conversion","running":7,"trueCount":4} differs from the engine\'s {"decks":2,"exact":false,"kind":"conversion","running":7,"trueCount":3}',
    ]);
    const before = { ...RUNNING, before: 1 };
    expect(workedExampleProblems(before, 1)).toEqual([
      'worked example, choice +3: scripted as correct, but the engine marks it incorrect',
      'worked example, choice +3: the scripted explanation {"before":2,"count":3,"kind":"running-count","rank":5,"value":1} differs from the engine\'s {"before":1,"count":2,"kind":"running-count","rank":5,"value":1}',
      'worked example, choice +1: the scripted explanation {"before":2,"count":3,"kind":"running-count","rank":5,"value":1} differs from the engine\'s {"before":1,"count":2,"kind":"running-count","rank":5,"value":1}',
    ]);
  });

  it('fail the build when the scripted round is not what the table deals', () => {
    // A hard 16 against a 5 stands, so a third card for the seat is never dealt.
    const hit = { ...TABLE, seat: [...TABLE.seat, { rank: 2, suit: 'clubs' } as const] };
    expect(workedExampleProblems(hit, 1)[0]).toMatch(/^worked example: the table deals the seat 10♠ 6♥ and the dealer 5♣ K♦ /);
  });

  it('fail the build when the script is malformed', () => {
    expect(workedExampleProblems({ ...CONVERSION, decks: 2.25 }, 1)).toEqual(['the worked example’s decks remaining is not a half-deck value from 0.5 to 6']);
    expect(workedExampleProblems({ ...CONVERSION, running: 21 }, 1)).toEqual(['the worked example’s running count is not a whole number from −20 to +20']);
    expect(workedExampleProblems({ ...CONVERSION, choices: [CONVERSION.choices[0]!, { ...CONVERSION.choices[1]!, answer: 3 }] }, 1)).toEqual(['worked example choice +3 is offered twice']);
    expect(workedExampleProblems({ ...CONVERSION, choices: [CONVERSION.choices[1]!, { ...CONVERSION.choices[1]!, answer: 5 }] }, 1)).toEqual(['a worked example has exactly one correct choice']);
    expect(workedExampleProblems({ ...CONVERSION, choices: [CONVERSION.choices[0]!, { ...CONVERSION.choices[1]!, answer: 3.5 }] }, 1)).toEqual(['worked example choice +3.5 is not a whole number']);
    expect(workedExampleProblems({ ...RUNNING, before: 40 }, 1)).toEqual(['the worked example’s running count before the card is not a whole number from −20 to +20']);
    expect(workedExampleProblems({ ...RUNNING, card: { rank: 0, suit: 'hearts' } as never }, 1)).toEqual(["the worked example's card is not a playing card"]);
    expect(workedExampleProblems({ ...TABLE, dealer: [TABLE.dealer[0]!] }, 1)).toEqual(['the worked example deals the seat and the dealer two cards each']);
  });
});

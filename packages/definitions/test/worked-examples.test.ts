// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #144
import { describe, expect, it } from 'vitest';

import { APP_ORIENTATION, lessonProblems, type Lesson, type WorkedExample } from '../src';

// Spec 1 Game rules, Counting (Hi-Lo): 2–6 are +1, 7–9 are 0, ten-value cards and aces are −1
const FIVE_OF_HEARTS: WorkedExample = {
  kind: 'card-value',
  step: 2,
  card: { rank: 5, suit: 'hearts' },
  choices: [
    { answer: 1, response: { correct: true, explanation: { kind: 'hi-lo-value', rank: 5, value: 1 }, note: 'Low cards leaving the shoe help you, so they count up.' } },
    { answer: 0, response: { correct: false, explanation: { kind: 'hi-lo-value', rank: 5, value: 1 }, note: 'Only 7, 8 and 9 count 0.' } },
    { answer: -1, response: { correct: false, explanation: { kind: 'hi-lo-value', rank: 5, value: 1 }, note: null } },
  ],
};

const content = APP_ORIENTATION.content!;
const withExample = (workedExample: WorkedExample, id = 'fixture-card-values'): Lesson => ({
  ...APP_ORIENTATION,
  id,
  content: { ...content, workedExample },
});

const choice = (index: number) => FIVE_OF_HEARTS.choices[index]!;
const replace = (index: number, next: WorkedExample['choices'][number]) => FIVE_OF_HEARTS.choices.map((c: WorkedExample['choices'][number], i: number) => (i === index ? next : c));

describe('worked examples', () => {
  it('pass the build-time check when every scripted response matches the engine replay', () => {
    expect(lessonProblems([withExample(FIVE_OF_HEARTS)])).toEqual([]);
    const queen: WorkedExample = {
      ...FIVE_OF_HEARTS,
      step: 1,
      card: { rank: 12, suit: 'spades' },
      choices: [
        { answer: -1, response: { correct: true, explanation: { kind: 'hi-lo-value', rank: 12, value: -1 }, note: null } },
        { answer: 1, response: { correct: false, explanation: { kind: 'hi-lo-value', rank: 12, value: -1 }, note: null } },
      ],
    };
    const eight: WorkedExample = {
      ...FIVE_OF_HEARTS,
      card: { rank: 8, suit: 'clubs' },
      choices: [
        { answer: 0, response: { correct: true, explanation: { kind: 'hi-lo-value', rank: 8, value: 0 }, note: null } },
        { answer: -1, response: { correct: false, explanation: { kind: 'hi-lo-value', rank: 8, value: 0 }, note: null } },
      ],
    };
    expect(lessonProblems([withExample(queen, 'a'), withExample(eight, 'b')])).toEqual([]);
  });

  it('fail the build when a scripted verdict disagrees with the engine', () => {
    const swapped = [
      { answer: 1, response: { ...choice(0).response, correct: false } },
      { answer: 0, response: { ...choice(1).response, correct: true } },
      choice(2),
    ] as const;
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, choices: swapped })])).toEqual([
      'fixture-card-values: worked example, choice +1: scripted as incorrect, but the engine marks it correct',
      'fixture-card-values: worked example, choice 0: scripted as correct, but the engine marks it incorrect',
    ]);
  });

  it('fail the build when a scripted explanation disagrees with the engine', () => {
    const wrong = { ...FIVE_OF_HEARTS, choices: replace(0, { answer: 1, response: { ...choice(0).response, explanation: { kind: 'hi-lo-value', rank: 5, value: 0 } } }) };
    expect(lessonProblems([withExample(wrong)])).toEqual([
      'fixture-card-values: worked example, choice +1: the scripted explanation {"kind":"hi-lo-value","rank":5,"value":0} differs from the engine\'s {"kind":"hi-lo-value","rank":5,"value":1}',
    ]);
  });

  it('fail the build when the script is malformed', () => {
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, step: 5 })])).toEqual(['fixture-card-values: the worked example is on step 5, but the lesson has 4 steps']);
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, choices: [choice(0)] })])).toEqual(['fixture-card-values: a worked example offers at least two choices']);
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, choices: [choice(0), { answer: 1, response: choice(1).response }] })])).toEqual(['fixture-card-values: worked example choice +1 is offered twice']);
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, choices: [choice(1), choice(2)] })])).toEqual(['fixture-card-values: a worked example has exactly one correct choice']);
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, card: { rank: 14, suit: 'hearts' } as never })])).toEqual([
      "fixture-card-values: the worked example's card is not a playing card",
    ]);
    const blankNote = replace(2, { answer: -1, response: { ...choice(2).response, note: ' ' } });
    expect(lessonProblems([withExample({ ...FIVE_OF_HEARTS, choices: blankNote })])).toEqual(['fixture-card-values: worked example, choice -1: an empty note is written as null']);
  });
});

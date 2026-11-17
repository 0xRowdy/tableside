// Spec 3 Lessons › Structure (worked examples); #144
import { APP_ORIENTATION, type Lesson, type WorkedExample } from '@tableside/definitions';

// Spec 1 Game rules, Counting (Hi-Lo)
export const FIVE_OF_HEARTS: WorkedExample = {
  kind: 'card-value',
  step: 2,
  card: { rank: 5, suit: 'hearts' },
  choices: [
    { answer: 1, response: { correct: true, explanation: { kind: 'hi-lo-value', rank: 5, value: 1 }, note: 'Low cards leaving the shoe help you, so they count up.' } },
    { answer: 0, response: { correct: false, explanation: { kind: 'hi-lo-value', rank: 5, value: 1 }, note: 'Only 7, 8 and 9 count 0.' } },
    { answer: -1, response: { correct: false, explanation: { kind: 'hi-lo-value', rank: 5, value: 1 }, note: null } },
  ],
};

export const withWorkedExample = (lessons: readonly Lesson[], example: WorkedExample = FIVE_OF_HEARTS): Lesson[] =>
  lessons.map((lesson) => (lesson.id === APP_ORIENTATION.id ? { ...lesson, content: { ...lesson.content!, workedExample: example } } : lesson));

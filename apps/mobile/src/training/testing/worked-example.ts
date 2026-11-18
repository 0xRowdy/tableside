// Spec 3 Lessons › Structure (worked examples); #144
import { APP_ORIENTATION, CAPPED_MARTINGALE, type Lesson, type StrategyStepExplanation, type WorkedExample } from '@tableside/definitions';

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

// Spec 1 Built-in strategies (capped Martingale); #155
const FORTY_ON_RED: StrategyStepExplanation = {
  situation: { available: '970', subjects: { 'last-pocket-color': 'green', 'last-result': 'loss' }, values: {} },
  instructions: [{ id: 'stake', label: 'The current stake on your even-money target' }],
  prescription: { status: 'prescribed', bets: [{ target: 'red', amount: '40' }], held: [] },
  fallback: null,
  state: { counters: { stake: '40' }, lists: {}, lastResult: 'loss', cycleTurn: 2 },
};

export const MARTINGALE_STRATEGY_STEP: WorkedExample = {
  kind: 'strategy-step',
  step: 2,
  game: 'roulette',
  strategy: CAPPED_MARTINGALE.id,
  parameters: { target: 'red' },
  table: 'single-zero',
  practiceFunding: '1000',
  turns: [
    { wagers: [{ target: 'red', amount: '10' }], outcome: { pocket: 2 } },
    { wagers: [{ target: 'red', amount: '20' }], outcome: { pocket: 0 } },
  ],
  choices: [
    { answer: { kind: 'bets', bets: [{ target: 'red', amount: '10' }] }, response: { correct: false, explanation: FORTY_ON_RED, note: 'Only a win starts the next cycle at 10.' } },
    { answer: { kind: 'bets', bets: [{ target: 'red', amount: '40' }] }, response: { correct: true, explanation: FORTY_ON_RED, note: null } },
  ],
};

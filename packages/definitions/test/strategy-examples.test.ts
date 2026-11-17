// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #155
import type { PlayExplanation } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { CAPPED_MARTINGALE, CRAPS_STRATEGIES, strategyStepProblems, workedExampleProblems, type StrategyStepExample, type StrategyStepExplanation } from '../src';
import {
  BASIC_STRATEGY_EXAMPLE,
  BASICS_EXAMPLE,
  BET_SCHEDULE_EXAMPLE,
  COUNTING_BASIC_EXAMPLE,
  COUNTING_DEVIATIONS_EXAMPLE,
  DEVIATIONS_EXAMPLE,
} from '../src/lessons/blackjack-examples';

const FORTY_AFTER_LOSSES_TO_2_AND_0: StrategyStepExplanation = {
  situation: { available: '970', subjects: { 'last-pocket-color': 'green', 'last-result': 'loss' }, values: {} },
  instructions: [{ id: 'stake', label: 'The current stake on your even-money target' }],
  prescription: { status: 'prescribed', bets: [{ target: 'red', amount: '40' }], held: [] },
  fallback: null,
  state: { counters: { stake: '40' }, lists: {}, lastResult: 'loss', cycleTurn: 2 },
};

const red = (amount: string) => ({ kind: 'bets' as const, bets: [{ target: 'red', amount }] });

const MARTINGALE: StrategyStepExample = {
  kind: 'strategy-step',
  step: 1,
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
    { answer: red('40'), response: { correct: true, explanation: FORTY_AFTER_LOSSES_TO_2_AND_0, note: null } },
    { answer: red('10'), response: { correct: false, explanation: FORTY_AFTER_LOSSES_TO_2_AND_0, note: 'A loss doubles the stake.' } },
  ],
};

describe('strategy-step worked examples', () => {
  it('pass when every choice and explanation matches a guided-practice replay through the engine', () => {
    expect(strategyStepProblems(MARTINGALE)).toEqual([]);
    expect(workedExampleProblems(MARTINGALE, 1)).toEqual([]);
  });

  it('report a choice scripted against the engine’s assessment, or an explanation the engine did not give', () => {
    const [right, wrong] = MARTINGALE.choices;
    const stale = { ...FORTY_AFTER_LOSSES_TO_2_AND_0, situation: { ...FORTY_AFTER_LOSSES_TO_2_AND_0.situation, available: '1000' } };
    expect(
      strategyStepProblems({
        ...MARTINGALE,
        choices: [
          { ...right!, response: { ...right!.response, explanation: stale } },
          { ...wrong!, response: { ...wrong!.response, correct: true } },
        ],
      }),
    ).toEqual([
      expect.stringMatching(/^worked example, choice 40 on red: the scripted explanation .* differs from the engine's /),
      'worked example, choice 10 on red: scripted as correct, but the engine marks it incorrect',
      'a worked example has exactly one correct choice',
    ]);
  });

  it('report a strategy that is not a built-in for the game', () => {
    expect(strategyStepProblems({ ...MARTINGALE, strategy: 'reverse-martingale' })).toEqual(['the worked example names no built-in roulette strategy: reverse-martingale']);
    expect(strategyStepProblems({ ...MARTINGALE, strategy: CRAPS_STRATEGIES[0]!.id })).toEqual([`the worked example names no built-in roulette strategy: ${CRAPS_STRATEGIES[0]!.id}`]);
    expect(strategyStepProblems({ ...MARTINGALE, game: 'craps' })).toEqual([`the worked example names no built-in craps strategy: ${MARTINGALE.strategy}`]);
    expect(strategyStepProblems({ ...MARTINGALE, game: 'blackjack' })).toEqual([`the worked example names no built-in blackjack strategy: ${MARTINGALE.strategy}`]);
  });

  it('report scripted turns that leave the strategy, end its cycle, or name an unknown wheel', () => {
    expect(strategyStepProblems({ ...MARTINGALE, turns: [{ wagers: [{ target: 'black', amount: '10' }], outcome: { pocket: 2 } }] })).toEqual([
      'the worked example does not replay through the engine: scripted turn 1 (10 on black) does not follow Capped Martingale',
    ]);
    expect(strategyStepProblems({ ...MARTINGALE, turns: [{ wagers: [{ target: 'red', amount: '10' }], outcome: { pocket: 1 } }] })).toEqual([
      'after the scripted turns Capped Martingale has no next bet (its cycle ended)',
    ]);
    expect(strategyStepProblems({ ...MARTINGALE, table: 'triple-zero' })).toEqual(['the worked example does not replay through the engine: triple-zero is not a roulette wheel']);
  });

  it('report a choice with no bets, a repeated choice, or too few choices', () => {
    const [right] = MARTINGALE.choices;
    expect(strategyStepProblems({ ...MARTINGALE, choices: [right!, { ...right!, answer: { kind: 'bets', bets: [] } }, right!] })).toEqual([
      'a worked example choice places at least one bet',
      'worked example choice 40 on red is offered twice',
    ]);
    expect(workedExampleProblems({ ...MARTINGALE, choices: [right!] }, 1)).toEqual(['a worked example offers at least two choices']);
    expect(workedExampleProblems(MARTINGALE, 0)).toEqual(['the worked example is on step 1, but the lesson has 0 steps']);
  });
});

// Spec 3 Lessons › Structure (worked examples); Spec 1 Guided practice; #152
describe('blackjack strategy-step worked examples', () => {
  const play = (action: 'hit' | 'stand' | 'surrender') => ({ kind: 'play' as const, move: { action, amount: null } });
  const SIXTEEN = DEVIATIONS_EXAMPLE;
  const [hit, stand] = SIXTEEN.choices;

  it('pass for each blackjack lesson: the play or bet replays through guided practice and matches the certified files', () => {
    for (const example of [BASICS_EXAMPLE, BASIC_STRATEGY_EXAMPLE, DEVIATIONS_EXAMPLE, COUNTING_BASIC_EXAMPLE, COUNTING_DEVIATIONS_EXAMPLE, BET_SCHEDULE_EXAMPLE]) {
      expect(strategyStepProblems(example)).toEqual([]);
    }
  });

  // docs/research/blackjack-lessons.md Deviations (S17 16 vs T: stand at +1 or higher)
  it('teach standing on 16 against a 10 at a supplied true count of +1, with no surrender at the table', () => {
    expect(SIXTEEN.table).toBe('S17_noLS');
    expect(SIXTEEN.choices.map(({ answer, response }) => [answer, response.correct])).toEqual([
      [play('hit'), false],
      [play('stand'), true],
    ]);
    const explanation = stand!.response.explanation as PlayExplanation;
    expect([explanation.situation.count, explanation.deviation?.threshold, explanation.prescribed.action]).toEqual([{ running: 7, decks: '6', trueCount: 1 }, 1, 'stand']);
  });

  it('report a play scripted against the engine’s assessment, or a count that no longer reaches the index', () => {
    expect(strategyStepProblems({ ...SIXTEEN, choices: [{ ...hit!, response: { ...hit!.response, correct: true } }, { ...stand!, response: { ...stand!.response, correct: false } }] })).toEqual([
      'worked example, choice hit: scripted as correct, but the engine marks it incorrect',
      'worked example, choice stand: scripted as incorrect, but the engine marks it correct',
    ]);
    const fewerLowCards = { ...SIXTEEN, turns: [{ ...SIXTEEN.turns[0]!, outcome: { shown: [2, 3], dealt: [9, 10, 7, 9] } }] } as StrategyStepExample;
    expect(strategyStepProblems(fewerLowCards)).toContain('worked example, choice stand: scripted as correct, but the engine marks it incorrect');
  });

  it('report an unknown mode or table, a bet schedule without a counting mode, mixed bet and play answers, or a play with no hand dealt', () => {
    expect(strategyStepProblems({ ...SIXTEEN, strategy: 'wonging' })).toEqual(['the worked example names no built-in blackjack strategy: wonging']);
    expect(strategyStepProblems({ ...SIXTEEN, table: 'S19_LS' })).toEqual(['the worked example names no built-in blackjack strategy: basic-with-deviations']);
    expect(strategyStepProblems({ ...SIXTEEN, parameters: { 'bet-schedule': 'on' } })).toEqual(['the worked example names no built-in blackjack strategy: basic-with-deviations']);
    expect(strategyStepProblems({ ...SIXTEEN, choices: [hit!, BET_SCHEDULE_EXAMPLE.choices[0]!] })).toEqual(['a worked example asks for bets or for a play, not both, in a game with plays']);
    expect(strategyStepProblems({ ...SIXTEEN, turns: [] })).toEqual(['a worked example asking for a play deals the hand in its last turn']);
    expect(strategyStepProblems({ ...SIXTEEN, choices: [stand!, stand!] })).toEqual(['worked example choice stand is offered twice']);
  });
});

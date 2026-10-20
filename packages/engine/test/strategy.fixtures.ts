// Strategy definitions for the strategy cases, written from spec #51's
// built-in strategy table ("Flat even-money: 1 unit on the selected even-money
// target (default red)"; "Fixed two-dozen coverage: 1 unit on each selected
// dozen (default 1-12 and 13-24)"), with amounts on the default 10-minimum
// table, where 1 strategy unit is 10. They are independent of the definitions
// package's shipped copies.
import type { StrategyDefinition } from '../src';

const LAUNCH_TABLE = {
  wheels: ['single-zero', 'double-zero'],
  limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } },
} as const;

export const FLAT_EVEN_MONEY: StrategyDefinition = {
  format: 1,
  id: 'test-flat-even-money',
  revision: 1,
  name: 'Flat even-money',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [{ id: 'target', label: 'Target', choices: ['red', 'black', 'odd', 'even', 'low', 'high'], default: 'red' }],
  counters: [],
  instructions: [
    { id: 'flat', label: '1 unit on the target, every spin', when: { always: true }, bets: [{ target: { param: 'target' }, amount: { lit: '10' } }] },
  ],
  adjustments: [],
  stopWhen: null,
};

export const TWO_DOZENS: StrategyDefinition = {
  format: 1,
  id: 'test-two-dozens',
  revision: 1,
  name: 'Fixed two-dozen coverage',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [
    { id: 'first', label: 'First dozen', choices: ['dozen-1', 'dozen-2', 'dozen-3'], default: 'dozen-1' },
    { id: 'second', label: 'Second dozen', choices: ['dozen-1', 'dozen-2', 'dozen-3'], default: 'dozen-2', distinctFrom: 'first' },
  ],
  counters: [],
  instructions: [
    {
      id: 'cover',
      label: '1 unit on each dozen, every spin',
      when: { always: true },
      bets: [
        { target: { param: 'first' }, amount: { lit: '10' } },
        { target: { param: 'second' }, amount: { lit: '10' } },
      ],
    },
  ],
  adjustments: [],
  stopWhen: null,
};

/**
 * A doubling stake after each loss, reset by a win, capped at 320 (the spec's
 * capped Martingale, 1/2/4/8/16/32 units): exercises counters, adjustments and caps.
 */
export const DOUBLING: StrategyDefinition = {
  format: 1,
  id: 'test-doubling',
  revision: 3,
  name: 'Doubling on red',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [],
  counters: [{ id: 'stake', initial: '10', cap: '320' }],
  instructions: [{ id: 'bet', label: 'The stake on red', when: { always: true }, bets: [{ target: { target: 'red' }, amount: { counter: 'stake' } }] }],
  adjustments: [
    { id: 'double', on: 'loss', counter: 'stake', to: { mul: [{ counter: 'stake' }, { lit: '2' }] } },
    { id: 'reset', on: 'win', counter: 'stake', to: { lit: '10' } },
  ],
  stopWhen: null,
};

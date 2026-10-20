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

// The three roulette progressions, from spec #51's built-in strategy table, in
// units of 10 on the default 10-minimum table.

const EVEN_MONEY = { id: 'target', label: 'Target', choices: ['red', 'black', 'odd', 'even', 'low', 'high'], default: 'red' };

/** "Capped Martingale: 1/2/4/8/16/32 after successive losses; a win completes and resets; a loss at 32 terminates at cap." */
export const MARTINGALE: StrategyDefinition = {
  format: 1,
  id: 'test-martingale',
  revision: 1,
  name: 'Capped Martingale',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [EVEN_MONEY],
  counters: [{ id: 'stake', initial: '10' }],
  instructions: [
    { id: 'bet', label: 'The stake on your target', when: { always: true }, bets: [{ target: { param: 'target' }, amount: { counter: 'stake' }, cap: '320' }] },
  ],
  adjustments: [{ id: 'double', on: 'loss', counter: 'stake', to: { mul: [{ counter: 'stake' }, { lit: '2' }] } }],
  stopWhen: null,
  completeWhen: { subject: 'last-result', is: 'win' },
};

/** "Three-win parlay: 1/2/4 after consecutive wins; a loss or third win completes and resets." */
export const PARLAY: StrategyDefinition = {
  format: 1,
  id: 'test-parlay',
  revision: 1,
  name: 'Three-win parlay',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [EVEN_MONEY],
  counters: [
    { id: 'stake', initial: '10', cap: '40' },
    { id: 'wins', initial: '0', cap: '3' },
  ],
  instructions: [{ id: 'bet', label: 'The stake on your target', when: { always: true }, bets: [{ target: { param: 'target' }, amount: { counter: 'stake' } }] }],
  adjustments: [
    { id: 'let-it-ride', on: 'win', counter: 'stake', to: { mul: [{ counter: 'stake' }, { lit: '2' }] } },
    { id: 'count', on: 'win', counter: 'wins', to: { add: [{ counter: 'wins' }, { lit: '1' }] } },
  ],
  stopWhen: null,
  completeWhen: { any: [{ subject: 'last-result', is: 'loss' }, { compare: { counter: 'wins' }, op: 'ge', to: { lit: '3' } }] },
};

/**
 * "Bounded Labouchere: start [1,2,3]; bet first+last (or sole); win removes
 * endpoints; loss appends stake; empty completes; max required stake 32 units."
 */
export const LABOUCHERE: StrategyDefinition = {
  format: 1,
  id: 'test-labouchere',
  revision: 1,
  name: 'Bounded Labouchere',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [EVEN_MONEY],
  counters: [],
  lists: [{ id: 'line', initial: ['10', '20', '30'] }],
  instructions: [
    {
      id: 'ends',
      label: 'First plus last on your target',
      when: { compare: { length: 'line' }, op: 'ge', to: { lit: '2' } },
      bets: [{ target: { param: 'target' }, amount: { add: [{ first: 'line' }, { last: 'line' }] }, cap: '320' }],
    },
    {
      id: 'sole',
      label: 'The one number left on your target',
      priority: 1,
      when: { compare: { length: 'line' }, op: 'eq', to: { lit: '1' } },
      bets: [{ target: { param: 'target' }, amount: { first: 'line' }, cap: '320' }],
    },
  ],
  adjustments: [
    { id: 'cross-off', on: 'win', list: 'line', drop: 'ends' },
    { id: 'add-loss', on: 'loss', list: 'line', append: { staked: true } },
  ],
  stopWhen: null,
  completeWhen: { compare: { length: 'line' }, op: 'eq', to: { lit: '0' } },
};

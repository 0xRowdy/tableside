// Built-in roulette strategies (spec #51, Built-in strategies): executable
// data in the roulette strategy vocabulary, with no special-cased code, so a
// builder-authored equivalent runs identically. Amounts are on the default
// 10-minimum table, where 1 strategy unit is 10. Targets are chosen before the
// session starts and stay fixed for every cycle. The progressions (capped
// Martingale, three-win parlay, bounded Labouchere) declare caps and a
// completion rule, so each cycle ends on completion or at its cap.

import type { StrategyDefinition } from '@tableside/engine';

/** Written for both launch wheels at the launch default limits (#3). */
const LAUNCH_TABLE = {
  wheels: ['single-zero', 'double-zero'],
  limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } },
} as const;

export const FLAT_EVEN_MONEY: StrategyDefinition = {
  format: 1,
  id: 'builtin-roulette-flat-even-money',
  revision: 1,
  name: 'Flat even-money',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [{ id: 'target', label: 'Target', choices: ['red', 'black', 'odd', 'even', 'low', 'high'], default: 'red' }],
  counters: [],
  instructions: [
    {
      id: 'flat',
      label: '1 unit on your even-money target, every spin',
      when: { always: true },
      bets: [{ target: { param: 'target' }, amount: { lit: '10' } }],
    },
  ],
  adjustments: [],
  stopWhen: null,
  note: '1 unit on one even-money target, every spin.',
};

export const FIXED_TWO_DOZENS: StrategyDefinition = {
  format: 1,
  id: 'builtin-roulette-fixed-two-dozens',
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
      label: '1 unit on each of your two dozens, every spin',
      when: { always: true },
      bets: [
        { target: { param: 'first' }, amount: { lit: '10' } },
        { target: { param: 'second' }, amount: { lit: '10' } },
      ],
    },
  ],
  adjustments: [],
  stopWhen: null,
  note: '1 unit on each of two dozens you choose.',
};

/** An even-money target chosen before the session, fixed for every cycle. */
const EVEN_MONEY_TARGET = { id: 'target', label: 'Target', choices: ['red', 'black', 'odd', 'even', 'low', 'high'], default: 'red' };

export const CAPPED_MARTINGALE: StrategyDefinition = {
  format: 1,
  id: 'builtin-roulette-capped-martingale',
  revision: 1,
  name: 'Capped Martingale',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [EVEN_MONEY_TARGET],
  counters: [{ id: 'stake', initial: '10' }],
  instructions: [
    {
      id: 'stake',
      label: 'The current stake on your even-money target',
      when: { always: true },
      // 32 units is the cap: a loss at 32 ends the cycle rather than betting 64.
      bets: [{ target: { param: 'target' }, amount: { counter: 'stake' }, cap: '320' }],
    },
  ],
  adjustments: [{ id: 'double', on: 'loss', counter: 'stake', to: { mul: [{ counter: 'stake' }, { lit: '2' }] } }],
  stopWhen: null,
  completeWhen: { subject: 'last-result', is: 'win' },
  note: '1, 2, 4, 8, 16, 32 units after each loss. A win completes the cycle; a loss at 32 ends it at the cap.',
};

export const THREE_WIN_PARLAY: StrategyDefinition = {
  format: 1,
  id: 'builtin-roulette-three-win-parlay',
  revision: 1,
  name: 'Three-win parlay',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [EVEN_MONEY_TARGET],
  counters: [
    { id: 'stake', initial: '10', cap: '40' },
    { id: 'wins', initial: '0', cap: '3' },
  ],
  instructions: [{ id: 'stake', label: 'The current stake on your even-money target', when: { always: true }, bets: [{ target: { param: 'target' }, amount: { counter: 'stake' } }] }],
  adjustments: [
    { id: 'let-it-ride', on: 'win', counter: 'stake', to: { mul: [{ counter: 'stake' }, { lit: '2' }] } },
    { id: 'count-win', on: 'win', counter: 'wins', to: { add: [{ counter: 'wins' }, { lit: '1' }] } },
  ],
  stopWhen: null,
  completeWhen: { any: [{ subject: 'last-result', is: 'loss' }, { compare: { counter: 'wins' }, op: 'ge', to: { lit: '3' } }] },
  note: '1, 2, 4 units after each win. A loss or the third win completes the cycle.',
};

export const BOUNDED_LABOUCHERE: StrategyDefinition = {
  format: 1,
  id: 'builtin-roulette-bounded-labouchere',
  revision: 1,
  name: 'Bounded Labouchere',
  game: 'roulette',
  table: LAUNCH_TABLE,
  parameters: [EVEN_MONEY_TARGET],
  counters: [],
  lists: [{ id: 'line', initial: ['10', '20', '30'] }],
  instructions: [
    {
      id: 'ends',
      label: 'The first and last numbers of your line, added, on your target',
      when: { compare: { length: 'line' }, op: 'ge', to: { lit: '2' } },
      bets: [{ target: { param: 'target' }, amount: { add: [{ first: 'line' }, { last: 'line' }] }, cap: '320' }],
    },
    {
      id: 'sole',
      label: 'The one number left in your line, on your target',
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
  note: 'Line 1, 2, 3: bet first plus last. A win crosses them off, a loss adds the stake. An empty line completes the cycle; a stake over 32 units ends it at the cap.',
};

/** The built-in roulette strategies, in picker order. */
export const ROULETTE_STRATEGIES: readonly StrategyDefinition[] = [FLAT_EVEN_MONEY, FIXED_TWO_DOZENS, CAPPED_MARTINGALE, THREE_WIN_PARLAY, BOUNDED_LABOUCHERE];

/** Each parameter's default choice. */
export const strategyDefaults = (definition: StrategyDefinition): Record<string, string> =>
  Object.fromEntries(definition.parameters.map((param) => [param.id, param.default]));

// Built-in roulette strategies (spec #51, Built-in strategies): executable
// data in the roulette strategy vocabulary, with no special-cased code, so a
// builder-authored equivalent runs identically. Amounts are on the default
// 10-minimum table, where 1 strategy unit is 10. Targets are chosen before the
// session starts and stay fixed for the cycle. The progressions (capped
// Martingale, three-win parlay, bounded Labouchere) arrive with #75.

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

/** The built-in roulette strategies, in picker order. */
export const ROULETTE_STRATEGIES: readonly StrategyDefinition[] = [FLAT_EVEN_MONEY, FIXED_TWO_DOZENS];

/** Each parameter's default choice. */
export const strategyDefaults = (definition: StrategyDefinition): Record<string, string> =>
  Object.fromEntries(definition.parameters.map((param) => [param.id, param.default]));

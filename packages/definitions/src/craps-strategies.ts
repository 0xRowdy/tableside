// Built-in craps strategies (spec #51, Built-in strategies): executable data
// in the standard craps strategy vocabulary, with no special-cased code, so a
// builder-authored equivalent runs identically. Amounts are on the default
// 10-minimum table. A craps prescription is the whole table for the next roll:
// bases already established are restated at their amounts.
//
// Place amounts and press counters persist through a made point (the place
// bets stay up, off, on the come-out) and reset after a seven-out: the "up"
// counter is 1 from the place bets' first roll until a seven-out takes them.

import type { StrategyAdjustment, StrategyCondition, StrategyDefinition, StrategyInstruction } from '@tableside/engine';

/** Written for every launch odds cap at the launch default limits (#3). */
const LAUNCH_TABLE = {
  odds: ['1x', '2x', '3-4-5x', '5x', '10x'],
  limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } },
} as const;

const POINTS = ['4', '5', '6', '8', '9', '10'] as const;
const is = (subject: string, value: string): StrategyCondition => ({ subject, is: value });
const lit = (value: string) => ({ lit: value });
const bet = (target: string, amount: string) => ({ target: { target }, amount: lit(amount) });
/** The point is on and this base is established on it. */
const onAnyPoint = (base: string, points: readonly string[] = POINTS): StrategyCondition => ({ any: points.map((n) => ({ all: [is('point', n), is(base, 'on')] })) });
const upOnComeOut: StrategyCondition = { all: [is('puck', 'off'), { compare: { counter: 'up' }, op: 'eq', to: lit('1') }] };

const passLine: StrategyInstruction = { id: 'come-out', label: 'Pass line 10 on the come-out roll', when: is('point', 'none'), bets: [bet('pass', '10')] };
const passOdds: StrategyInstruction = {
  id: 'pass-odds',
  label: '10 odds behind your pass line once the point is set',
  when: onAnyPoint('pass'),
  bets: [bet('pass', '10'), bet('pass-odds', '10')],
};

export const PASS_WITH_ODDS: StrategyDefinition = {
  format: 1,
  id: 'builtin-craps-pass-with-odds',
  revision: 1,
  name: 'Pass with odds',
  game: 'craps',
  table: LAUNCH_TABLE,
  parameters: [],
  counters: [],
  instructions: [passLine, passOdds],
  adjustments: [],
  stopWhen: null,
  note: 'Pass 10, then 10 odds once a point is set.',
};

/** Either place bet on the table for a roll keeps them up; a seven-out takes them down (each number's loss is the same seven). */
const UP: StrategyAdjustment[] = [
  { id: 'up-6', on: 'any', wager: 'place-6', counter: 'up', to: lit('1') },
  { id: 'up-8', on: 'any', wager: 'place-8', counter: 'up', to: lit('1') },
  { id: 'seven-out-6', on: 'loss', wager: 'place-6', counter: 'up', to: lit('0') },
  { id: 'seven-out-8', on: 'loss', wager: 'place-8', counter: 'up', to: lit('0') },
];

export const FLAT_PLACE_6_8: StrategyDefinition = {
  format: 1,
  id: 'builtin-craps-flat-place-6-8',
  revision: 1,
  name: 'Flat place 6 and 8',
  game: 'craps',
  table: LAUNCH_TABLE,
  parameters: [],
  counters: [{ id: 'up', initial: '0' }],
  instructions: [
    { id: 'place', label: 'Place 6 and 8, 12 each, once a point is on', when: is('puck', 'on'), bets: [bet('place-6', '12'), bet('place-8', '12')] },
    { id: 'keep', label: 'Keep place 6 and 8 up, off, on the come-out', when: upOnComeOut, bets: [bet('place-6', '12'), bet('place-8', '12')] },
  ],
  adjustments: UP,
  stopWhen: null,
  note: '12 on each after the point. Collect every win.',
};

export const DONT_PASS_WITH_LAY_ODDS: StrategyDefinition = {
  format: 1,
  id: 'builtin-craps-dont-pass-lay-odds',
  revision: 1,
  name: "Don't pass with lay odds",
  game: 'craps',
  table: LAUNCH_TABLE,
  parameters: [],
  counters: [],
  instructions: [
    { id: 'come-out', label: "Don't pass 10 on the come-out roll", when: is('point', 'none'), bets: [bet('dont-pass', '10')] },
    { id: 'lay-4-10', label: 'Lay 20 to win 10 against 4 or 10', when: onAnyPoint('dont-pass', ['4', '10']), bets: [bet('dont-pass', '10'), bet('dont-pass-odds', '20')] },
    { id: 'lay-5-9', label: 'Lay 15 to win 10 against 5 or 9', when: onAnyPoint('dont-pass', ['5', '9']), bets: [bet('dont-pass', '10'), bet('dont-pass-odds', '15')] },
    { id: 'lay-6-8', label: 'Lay 12 to win 10 against 6 or 8', when: onAnyPoint('dont-pass', ['6', '8']), bets: [bet('dont-pass', '10'), bet('dont-pass-odds', '12')] },
  ],
  adjustments: [],
  stopWhen: null,
  note: "Don't pass 10, then lay odds to win 10.",
};

export const THREE_POINT_MOLLY: StrategyDefinition = {
  format: 1,
  id: 'builtin-craps-three-point-molly',
  revision: 1,
  name: 'Three-point Molly',
  game: 'craps',
  table: LAUNCH_TABLE,
  parameters: [],
  counters: [],
  instructions: [
    passLine,
    passOdds,
    ...POINTS.map((n) => ({
      id: `come-${n}`,
      label: `10 odds on your come bet on ${n}`,
      when: is(`come-${n}`, 'on'),
      bets: [bet(`come-${n}`, '10'), bet(`come-${n}-odds`, '10')],
    })),
    {
      id: 'add-come',
      label: 'One more come bet of 10 while fewer than two come bets are working',
      when: { any: ['0', '1'].map((count) => ({ all: [is('puck', 'on'), is('come-bases', count)] })) },
      bets: [bet('come', '10')],
    },
  ],
  adjustments: [],
  stopWhen: null,
  note: 'Pass plus up to two come bets, 10 odds on each.',
};

const pressing = (n: '6' | '8'): StrategyAdjustment[] => [
  {
    id: `press-${n}`,
    on: 'win',
    wager: `place-${n}`,
    counter: `stake-${n}`,
    to: { min: [lit('48'), { add: [{ counter: `stake-${n}` }, { mul: [lit('12'), { counter: `press-${n}` }] }] }] },
  },
  { id: `alternate-${n}`, on: 'win', wager: `place-${n}`, counter: `press-${n}`, to: { sub: [lit('1'), { counter: `press-${n}` }] } },
  { id: `reset-${n}`, on: 'loss', wager: `place-${n}`, counter: `stake-${n}`, to: lit('12') },
  { id: `reset-press-${n}`, on: 'loss', wager: `place-${n}`, counter: `press-${n}`, to: lit('0') },
];

const pressed = (n: '6' | '8') => ({ target: { target: `place-${n}` }, amount: { counter: `stake-${n}` } });

export const PRESS_AND_COLLECT_6_8: StrategyDefinition = {
  format: 1,
  id: 'builtin-craps-press-and-collect-6-8',
  revision: 1,
  name: 'Press-and-collect 6 and 8',
  game: 'craps',
  table: LAUNCH_TABLE,
  parameters: [],
  counters: [
    { id: 'stake-6', initial: '12', cap: '48' },
    { id: 'press-6', initial: '0', cap: '1' },
    { id: 'stake-8', initial: '12', cap: '48' },
    { id: 'press-8', initial: '0', cap: '1' },
    { id: 'up', initial: '0' },
  ],
  instructions: (['6', '8'] as const).flatMap((n) => [
    { id: `place-${n}`, label: `Place ${n} at its current stake once a point is on`, when: is('puck', 'on'), bets: [pressed(n)] },
    { id: `keep-${n}`, label: `Keep place ${n} up, off, on the come-out`, when: upOnComeOut, bets: [pressed(n)] },
  ]),
  adjustments: [...UP, ...pressing('6'), ...pressing('8')],
  stopWhen: null,
  note: 'Collect the first hit, then alternate press and collect up to 48.',
};

/** The built-in craps strategies, in picker order. */
export const CRAPS_STRATEGIES: readonly StrategyDefinition[] = [PASS_WITH_ODDS, FLAT_PLACE_6_8, DONT_PASS_WITH_LAY_ODDS, THREE_POINT_MOLLY, PRESS_AND_COLLECT_6_8];

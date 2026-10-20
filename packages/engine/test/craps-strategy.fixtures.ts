// The five craps built-in strategies for the craps strategy cases, written
// from spec #51's built-in strategy table on the default 10-minimum table
// (independent of the definitions package's shipped copies):
//   Pass with odds: "Pass 10; add 10 odds after point; repeat."
//   Flat place 6 and 8: "Place 12 each after point (including when 6/8 is the
//     point); collect every win, stakes unchanged."
//   Don't pass with lay odds: "Don't pass 10; after point lay to win 10 (20 vs
//     4/10, 15 vs 5/9, 12 vs 6/8); keep base through bar-12 push."
//   Bounded Three-point Molly: "Pass 10 + at most two concurrent 10 come bases
//     (pending come-area bet counts); 10 odds on each established contract;
//     before a point-on roll add one come base if room; settle the whole roll
//     before replacing."
//   Capped press-and-collect 6 and 8: "Start 12 each; per number
//     independently: collect first hit, press +12 from second payout, alternate
//     collect/press to a 48 cap; collect all hits once capped."
// Place amounts and press counters persist through a made point (off on the
// come-out) and reset after a seven-out.
import type { StrategyAdjustment, StrategyCondition, StrategyDefinition, StrategyInstruction } from '../src';

export const CRAPS_TABLE = {
  odds: ['1x', '2x', '3-4-5x', '5x', '10x'],
  limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } },
} as const;

const POINTS = [4, 5, 6, 8, 9, 10] as const;
const is = (subject: string, value: string): StrategyCondition => ({ subject, is: value });
const lit = (value: string) => ({ lit: value });
const bet = (target: string, amount: string) => ({ target: { target }, amount: lit(amount) });

export const PASS_WITH_ODDS: StrategyDefinition = {
  format: 1,
  id: 'test-pass-with-odds',
  revision: 1,
  name: 'Pass with odds',
  game: 'craps',
  table: CRAPS_TABLE,
  parameters: [],
  counters: [],
  instructions: [
    { id: 'come-out', label: 'Pass 10 on the come-out', when: is('point', 'none'), bets: [bet('pass', '10')] },
    {
      id: 'odds',
      label: '10 odds behind the pass line',
      when: { any: POINTS.map((n) => ({ all: [is('point', String(n)), is('pass', 'on')] })) },
      bets: [bet('pass', '10'), bet('pass-odds', '10')],
    },
  ],
  adjustments: [],
  stopWhen: null,
};

/** Place bets stay up through a made point: the "up" counter is 1 from their first roll until a seven-out takes them. */
const UP: StrategyAdjustment[] = [
  { id: 'up-6', on: 'any', wager: 'place-6', counter: 'up', to: lit('1') },
  { id: 'up-8', on: 'any', wager: 'place-8', counter: 'up', to: lit('1') },
  { id: 'down-6', on: 'loss', wager: 'place-6', counter: 'up', to: lit('0') },
  { id: 'down-8', on: 'loss', wager: 'place-8', counter: 'up', to: lit('0') },
];

const placeBoth = (id: string, label: string, when: StrategyCondition): StrategyInstruction => ({
  id,
  label,
  when,
  bets: [bet('place-6', '12'), bet('place-8', '12')],
});

export const FLAT_PLACE: StrategyDefinition = {
  format: 1,
  id: 'test-flat-place',
  revision: 1,
  name: 'Flat place 6 and 8',
  game: 'craps',
  table: CRAPS_TABLE,
  parameters: [],
  counters: [{ id: 'up', initial: '0' }],
  instructions: [
    placeBoth('place', 'Place 6 and 8, 12 each, once a point is on', is('puck', 'on')),
    placeBoth('keep', 'Keep them up, off, on the come-out', { all: [is('puck', 'off'), { compare: { counter: 'up' }, op: 'eq', to: lit('1') }] }),
  ],
  adjustments: UP,
  stopWhen: null,
};

const LAY: Record<string, string> = { '4': '20', '10': '20', '5': '15', '9': '15', '6': '12', '8': '12' };

export const DONT_PASS_LAY: StrategyDefinition = {
  format: 1,
  id: 'test-dont-pass-lay',
  revision: 1,
  name: "Don't pass with lay odds",
  game: 'craps',
  table: CRAPS_TABLE,
  parameters: [],
  counters: [],
  instructions: [
    { id: 'come-out', label: "Don't pass 10 on the come-out", when: is('point', 'none'), bets: [bet('dont-pass', '10')] },
    ...[['4', '10'], ['5', '9'], ['6', '8']].map(([a, b]) => ({
      id: `lay-${a}-${b}`,
      label: `Lay ${LAY[a as string]} to win 10 against ${a} or ${b}`,
      when: { any: [a, b].map((n) => ({ all: [is('point', n as string), is('dont-pass', 'on')] })) },
      bets: [bet('dont-pass', '10'), bet('dont-pass-odds', LAY[a as string] as string)],
    })),
  ],
  adjustments: [],
  stopWhen: null,
};

export const THREE_POINT_MOLLY: StrategyDefinition = {
  format: 1,
  id: 'test-three-point-molly',
  revision: 1,
  name: 'Bounded Three-point Molly',
  game: 'craps',
  table: CRAPS_TABLE,
  parameters: [],
  counters: [],
  instructions: [
    { id: 'come-out', label: 'Pass 10 on the come-out', when: is('point', 'none'), bets: [bet('pass', '10')] },
    {
      id: 'pass-odds',
      label: '10 odds behind the pass line',
      when: { any: POINTS.map((n) => ({ all: [is('point', String(n)), is('pass', 'on')] })) },
      bets: [bet('pass', '10'), bet('pass-odds', '10')],
    },
    ...POINTS.map((n) => ({
      id: `come-${n}`,
      label: `10 odds on your come ${n}`,
      when: is(`come-${n}`, 'on'),
      bets: [bet(`come-${n}`, '10'), bet(`come-${n}-odds`, '10')],
    })),
    {
      id: 'add-come',
      label: 'One more come bet of 10 while fewer than two are working',
      when: { any: ['0', '1'].map((count) => ({ all: [is('puck', 'on'), is('come-bases', count)] })) },
      bets: [bet('come', '10')],
    },
  ],
  adjustments: [],
  stopWhen: null,
};

/** Per number: a win presses 12 every other payout (the toggle), to 48; a seven-out resets both. */
const pressing = (n: 6 | 8): StrategyAdjustment[] => [
  { id: `press-${n}`, on: 'win' as const, wager: `place-${n}`, counter: `stake-${n}`, to: { min: [lit('48'), { add: [{ counter: `stake-${n}` }, { mul: [lit('12'), { counter: `press-${n}` }] }] }] } },
  { id: `toggle-${n}`, on: 'win' as const, wager: `place-${n}`, counter: `press-${n}`, to: { sub: [lit('1'), { counter: `press-${n}` }] } },
  { id: `reset-${n}`, on: 'loss' as const, wager: `place-${n}`, counter: `stake-${n}`, to: lit('12') },
  { id: `reset-press-${n}`, on: 'loss' as const, wager: `place-${n}`, counter: `press-${n}`, to: lit('0') },
];

const pressBet = (n: 6 | 8) => ({ target: { target: `place-${n}` }, amount: { counter: `stake-${n}` } });

export const PRESS_AND_COLLECT: StrategyDefinition = {
  format: 1,
  id: 'test-press-and-collect',
  revision: 1,
  name: 'Capped press-and-collect 6 and 8',
  game: 'craps',
  table: CRAPS_TABLE,
  parameters: [],
  counters: [
    { id: 'stake-6', initial: '12', cap: '48' },
    { id: 'press-6', initial: '0', cap: '1' },
    { id: 'stake-8', initial: '12', cap: '48' },
    { id: 'press-8', initial: '0', cap: '1' },
    { id: 'up', initial: '0' },
  ],
  instructions: [6, 8].flatMap((n) => [
    { id: `place-${n}`, label: `Place ${n} at its current stake once a point is on`, when: is('puck', 'on'), bets: [pressBet(n as 6 | 8)] },
    {
      id: `keep-${n}`,
      label: `Keep place ${n} up, off, on the come-out`,
      when: { all: [is('puck', 'off'), { compare: { counter: 'up' }, op: 'eq', to: lit('1') }] },
      bets: [pressBet(n as 6 | 8)],
    },
  ]),
  adjustments: [...UP, ...pressing(6), ...pressing(8)],
  stopWhen: null,
};

export const CRAPS_BUILT_INS = [PASS_WITH_ODDS, FLAT_PLACE, DONT_PASS_LAY, THREE_POINT_MOLLY, PRESS_AND_COLLECT];

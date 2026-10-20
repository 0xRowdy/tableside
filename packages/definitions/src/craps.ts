// Standard craps rule presets and house-edge facts. Limits are the launch
// defaults (#3): pass, come, place, buy, lay and field 10-1,000 units per
// wager or number; hardways and propositions 1-100 per component. The default
// odds cap is 3-4-5x and a field 12 pays triple by default.
//
// House edges are a property of the pinned rules, derived exactly from the 36
// dice combinations (no simulation), and tested against published figures.
// Edges are per bet resolved (a place or hardway bet that sees no decision is
// not counted), the standard basis for comparing craps wagers.

import {
  add,
  commission,
  div,
  HARDWAYS,
  money,
  mul,
  sub,
  STANDARD_CRAPS,
  type CrapsPoint,
  type CrapsRuleSet,
  type FieldPayout,
  type Hardway,
  type Money,
  type OddsCap,
  type VersionedIdentity,
} from '@tableside/engine';

/** A standard craps table with the launch limits, the chosen odds cap (default 3-4-5x) and field payout (default 12 pays triple). */
export const standardCraps = (odds: OddsCap = '3-4-5x', field: FieldPayout = 'triple-12'): CrapsRuleSet => ({
  id: STANDARD_CRAPS.id,
  version: STANDARD_CRAPS.version,
  odds,
  field,
  limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } },
});

export type CrapsLineWager = 'pass' | 'dont-pass' | 'come' | 'dont-come' | 'odds';
export type CrapsProposition = 'any-seven' | 'any-craps' | 'prop-2' | 'prop-3' | 'prop-11' | 'prop-12';

/** Every wager a house edge is given for: the line game, then the rest of the launch menu by engine target. */
export type CrapsWager =
  | CrapsLineWager
  | `place-${CrapsPoint}`
  | `buy-${CrapsPoint}`
  | `lay-${CrapsPoint}`
  | 'field'
  | `hard-${Hardway}`
  | CrapsProposition
  | 'horn';

/** The version of the craps house-edge values; bump it when any value or its derivation changes. */
export const CRAPS_HOUSE_EDGE_VERSION = 2;

export interface CrapsHouseEdge {
  readonly wager: CrapsWager;
  /** Per bet resolved, as a percentage with two decimals ("1.41"). */
  readonly percent: string;
  /** The line bet with full odds behind it, per total amount bet; null for every other wager. */
  readonly withFullOdds: string | null;
  /**
   * Buy and lay only: the stake the commission was rounded for, or null when
   * the edge uses exactly 5% (as at any stake where 5% is a whole unit).
   */
  readonly stake: string | null;
  readonly odds: OddsCap;
  readonly field: FieldPayout;
  /** The version of these values. */
  readonly version: number;
  /** The rule identity these facts belong to. */
  readonly rules: VersionedIdentity;
}

const POINTS: readonly CrapsPoint[] = [4, 5, 6, 8, 9, 10];
/** Ways to roll each total with two dice, out of 36. */
const ways = (total: number) => 6 - Math.abs(7 - total);
const p = (total: number) => money(BigInt(ways(total)), 36n);
const sum = (values: Money[]) => values.reduce(add, money(0n));
const ONE = money(1n);

/** Chance the number repeats before a 7. */
const repeats = (n: CrapsPoint) => money(BigInt(ways(n)), BigInt(ways(n) + 6));

/** Expected loss per unit bet: positive is the house's edge. */
function lineEdge(dont: boolean): Money {
  const comeOutWin = dont ? add(p(2), p(3)) : add(p(7), p(11));
  const comeOutLoss = dont ? add(p(7), p(11)) : sum([p(2), p(3), p(12)]);
  const pointWin = sum(POINTS.map((n) => mul(p(n), dont ? sub(ONE, repeats(n)) : repeats(n))));
  const pointLoss = sum(POINTS.map((n) => mul(p(n), dont ? repeats(n) : sub(ONE, repeats(n)))));
  return sub(add(comeOutLoss, pointLoss), add(comeOutWin, pointWin));
}

/** True odds taken: profit per unit (2:1, 3:2, 6:5). */
const trueOdds = (n: CrapsPoint) => (n === 4 || n === 10 ? money(2n) : n === 5 || n === 9 ? money(3n, 2n) : money(6n, 5n));
/** Place payouts from the payout table: 9:5, 7:5, 7:6. */
const placePays = (n: CrapsPoint) => (n === 4 || n === 10 ? money(9n, 5n) : n === 5 || n === 9 ? money(7n, 5n) : money(7n, 6n));
const COMMISSION_RATE = money(1n, 20n);

function takeMultiple(cap: OddsCap, n: CrapsPoint): Money {
  if (cap === '3-4-5x') return money(n === 4 || n === 10 ? 3n : n === 5 || n === 9 ? 4n : 5n);
  return money(BigInt(cap.slice(0, -1)));
}

/** Expected full-odds stake per unit of line bet: taken odds per the cap, or laid to win the cap. */
const fullOdds = (cap: OddsCap, dont: boolean) =>
  sum(POINTS.map((n) => mul(p(n), dont ? mul(takeMultiple(cap, n), trueOdds(n)) : takeMultiple(cap, n))));

/** Edge of a bet that wins `profit` per unit with chance `win` and otherwise loses the unit. */
const decisionEdge = (win: Money, profit: Money) => sub(sub(ONE, win), mul(win, profit));

/**
 * Edge of a buy or lay: true odds less the commission a win charges. With a
 * stake, the commission is rounded up to a whole unit (minimum 1) as the table
 * charges it; without one, it is exactly 5%.
 */
function commissionedEdge(lay: boolean, n: CrapsPoint, stake: Money | null): Money {
  const profit = lay ? div(ONE, trueOdds(n)) : trueOdds(n);
  const win = lay ? sub(ONE, repeats(n)) : repeats(n);
  const basis = lay ? profit : ONE;
  const fee = stake === null ? mul(basis, COMMISSION_RATE) : div(commission(mul(basis, stake), COMMISSION_RATE), stake);
  return decisionEdge(win, sub(profit, fee));
}

const PROPOSITIONS: Record<CrapsProposition, { totals: readonly number[]; pays: Money }> = {
  'any-seven': { totals: [7], pays: money(4n) },
  'any-craps': { totals: [2, 3, 12], pays: money(7n) },
  'prop-2': { totals: [2], pays: money(30n) },
  'prop-3': { totals: [3], pays: money(15n) },
  'prop-11': { totals: [11], pays: money(15n) },
  'prop-12': { totals: [12], pays: money(30n) },
};

const oneRollEdge = (prop: CrapsProposition) => decisionEdge(sum(PROPOSITIONS[prop].totals.map(p)), PROPOSITIONS[prop].pays);

function fieldEdge(field: FieldPayout): Money {
  const evens = sum([3, 4, 9, 10, 11].map(p));
  const ev = sum([evens, mul(p(2), money(2n)), mul(p(12), money(field === 'triple-12' ? 3n : 2n))]);
  const losses = sum([5, 6, 7, 8].map(p));
  return sub(losses, ev);
}

/** A rational as a percentage rounded half up to two decimals. */
function percent(value: Money): string {
  const hundredths = (value.n * 10000n * 2n + value.d) / (value.d * 2n);
  const whole = hundredths / 100n;
  return `${whole.toString()}.${(hundredths % 100n).toString().padStart(2, '0')}`;
}

function edgeOf(wager: CrapsWager, field: FieldPayout, stake: Money | null): Money {
  if (wager === 'odds') return money(0n);
  if (wager === 'pass' || wager === 'come') return lineEdge(false);
  if (wager === 'dont-pass' || wager === 'dont-come') return lineEdge(true);
  if (wager === 'field') return fieldEdge(field);
  // Four equal parts: the mean of the four individual propositions.
  if (wager === 'horn') return div(sum((['prop-2', 'prop-3', 'prop-11', 'prop-12'] as const).map(oneRollEdge)), money(4n));
  if (wager in PROPOSITIONS) return oneRollEdge(wager as CrapsProposition);
  const [family, number] = wager.split('-') as [string, string];
  const n = Number(number) as CrapsPoint;
  if (family === 'place') return decisionEdge(repeats(n), placePays(n));
  if (family === 'buy' || family === 'lay') return commissionedEdge(family === 'lay', n, stake);
  // Hard n: the hard roll before an easy n or a 7.
  const hard = money(1n, BigInt(ways(n) + 6));
  return decisionEdge(hard, money(n === 4 || n === 10 ? 7n : 9n));
}

/**
 * The house edge of a wager under the given standard craps rules. For buy and
 * lay bets, pass a stake to include the commission's rounding at that stake.
 */
export function crapsHouseEdge(
  wager: CrapsWager,
  rules: Pick<CrapsRuleSet, 'id' | 'version' | 'odds' | 'field'>,
  stake?: string,
): CrapsHouseEdge {
  const commissioned = wager.startsWith('buy-') || wager.startsWith('lay-');
  const rounded = commissioned && stake !== undefined ? money(BigInt(stake)) : null;
  const facts = {
    wager,
    odds: rules.odds,
    field: rules.field,
    stake: rounded && stake !== undefined ? stake : null,
    version: CRAPS_HOUSE_EDGE_VERSION,
    rules: { id: rules.id, version: rules.version },
  };
  const edge = edgeOf(wager, rules.field, rounded);
  const line = wager === 'pass' || wager === 'come' || wager === 'dont-pass' || wager === 'dont-come';
  if (!line) return { ...facts, percent: percent(edge), withFullOdds: null };
  const combined = div(edge, add(ONE, fullOdds(rules.odds, wager.startsWith('dont'))));
  return { ...facts, percent: percent(edge), withFullOdds: percent(combined) };
}

/** The house-edge wager for an engine target: a traveled come bet is a come bet, any attached odds are odds. */
export function crapsEdgeWager(target: string): CrapsWager {
  if (target.endsWith('-odds')) return 'odds';
  const traveled = /^(dont-come|come)-\d+$/.exec(target);
  return (traveled ? traveled[1] : target) as CrapsWager;
}

/** Every wager a house edge is given for, in table order. */
export const CRAPS_EDGE_WAGERS: readonly CrapsWager[] = [
  'pass', 'dont-pass', 'come', 'dont-come', 'odds',
  ...POINTS.map((n) => `place-${n}` as const),
  ...POINTS.map((n) => `buy-${n}` as const),
  ...POINTS.map((n) => `lay-${n}` as const),
  'field',
  ...HARDWAYS.map((n) => `hard-${n}` as const),
  'any-seven', 'any-craps', 'prop-2', 'prop-3', 'prop-11', 'prop-12', 'horn',
];

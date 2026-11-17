// #3
// Spec 1 Amendment 1 §B

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

export const CRAPS_LIMITS: CrapsRuleSet['limits'] = { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } };

export const standardCraps = (
  odds: OddsCap = STANDARD_CRAPS.defaults.odds,
  field: FieldPayout = STANDARD_CRAPS.defaults.field,
  limits: CrapsRuleSet['limits'] = CRAPS_LIMITS,
): CrapsRuleSet => ({
  id: STANDARD_CRAPS.id,
  version: STANDARD_CRAPS.version,
  odds,
  field,
  limits: { flat: { ...limits.flat }, props: { ...limits.props } },
});

export type CrapsLineWager = 'pass' | 'dont-pass' | 'come' | 'dont-come' | 'odds';
export type CrapsProposition = 'any-seven' | 'any-craps' | 'prop-2' | 'prop-3' | 'prop-11' | 'prop-12';

export type CrapsWager =
  | CrapsLineWager
  | `place-${CrapsPoint}`
  | `buy-${CrapsPoint}`
  | `lay-${CrapsPoint}`
  | 'field'
  | `hard-${Hardway}`
  | CrapsProposition
  | 'horn';

export const CRAPS_HOUSE_EDGE_VERSION = 2;

export interface CrapsHouseEdge {
  readonly wager: CrapsWager;
  readonly percent: string;
  readonly withFullOdds: string | null;
  readonly stake: string | null;
  readonly odds: OddsCap;
  readonly field: FieldPayout;
  readonly version: number;
  readonly rules: VersionedIdentity;
}

const POINTS: readonly CrapsPoint[] = [4, 5, 6, 8, 9, 10];
const ways = (total: number) => 6 - Math.abs(7 - total);
const p = (total: number) => money(BigInt(ways(total)), 36n);
const sum = (values: Money[]) => values.reduce(add, money(0n));
const ONE = money(1n);

const repeats = (n: CrapsPoint) => money(BigInt(ways(n)), BigInt(ways(n) + 6));

function lineEdge(dont: boolean): Money {
  const comeOutWin = dont ? add(p(2), p(3)) : add(p(7), p(11));
  const comeOutLoss = dont ? add(p(7), p(11)) : sum([p(2), p(3), p(12)]);
  const pointWin = sum(POINTS.map((n) => mul(p(n), dont ? sub(ONE, repeats(n)) : repeats(n))));
  const pointLoss = sum(POINTS.map((n) => mul(p(n), dont ? repeats(n) : sub(ONE, repeats(n)))));
  return sub(add(comeOutLoss, pointLoss), add(comeOutWin, pointWin));
}

const trueOdds = (n: CrapsPoint) => (n === 4 || n === 10 ? money(2n) : n === 5 || n === 9 ? money(3n, 2n) : money(6n, 5n));
const placePays = (n: CrapsPoint) => (n === 4 || n === 10 ? money(9n, 5n) : n === 5 || n === 9 ? money(7n, 5n) : money(7n, 6n));
const COMMISSION_RATE = money(1n, 20n);

function takeMultiple(cap: OddsCap, n: CrapsPoint): Money {
  if (cap === '3-4-5x') return money(n === 4 || n === 10 ? 3n : n === 5 || n === 9 ? 4n : 5n);
  return money(BigInt(cap.slice(0, -1)));
}

const fullOdds = (cap: OddsCap, dont: boolean) =>
  sum(POINTS.map((n) => mul(p(n), dont ? mul(takeMultiple(cap, n), trueOdds(n)) : takeMultiple(cap, n))));

const decisionEdge = (win: Money, profit: Money) => sub(sub(ONE, win), mul(win, profit));

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
  if (wager === 'horn') return div(sum((['prop-2', 'prop-3', 'prop-11', 'prop-12'] as const).map(oneRollEdge)), money(4n));
  if (wager in PROPOSITIONS) return oneRollEdge(wager as CrapsProposition);
  const [family, number] = wager.split('-') as [string, string];
  const n = Number(number) as CrapsPoint;
  if (family === 'place') return decisionEdge(repeats(n), placePays(n));
  if (family === 'buy' || family === 'lay') return commissionedEdge(family === 'lay', n, stake);
  const hardBeforeEasyOrSeven = money(1n, BigInt(ways(n) + 6));
  return decisionEdge(hardBeforeEasyOrSeven, money(n === 4 || n === 10 ? 7n : 9n));
}

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
    stake: rounded ? rounded.n.toString() : null,
    version: CRAPS_HOUSE_EDGE_VERSION,
    rules: { id: rules.id, version: rules.version },
  };
  const edge = edgeOf(wager, rules.field, rounded);
  const line = wager === 'pass' || wager === 'come' || wager === 'dont-pass' || wager === 'dont-come';
  if (!line) return { ...facts, percent: percent(edge), withFullOdds: null };
  const combined = div(edge, add(ONE, fullOdds(rules.odds, wager.startsWith('dont'))));
  return { ...facts, percent: percent(edge), withFullOdds: percent(combined) };
}

export function crapsEdgeWager(target: string): CrapsWager {
  if (target.endsWith('-odds')) return 'odds';
  const traveled = /^(dont-come|come)-\d+$/.exec(target);
  return (traveled ? traveled[1] : target) as CrapsWager;
}

export const CRAPS_EDGE_WAGERS: readonly CrapsWager[] = [
  'pass', 'dont-pass', 'come', 'dont-come', 'odds',
  ...POINTS.map((n) => `place-${n}` as const),
  ...POINTS.map((n) => `buy-${n}` as const),
  ...POINTS.map((n) => `lay-${n}` as const),
  'field',
  ...HARDWAYS.map((n) => `hard-${n}` as const),
  'any-seven', 'any-craps', 'prop-2', 'prop-3', 'prop-11', 'prop-12', 'horn',
];

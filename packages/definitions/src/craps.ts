// Standard craps rule presets and house-edge facts. Limits are the launch
// defaults (#3): line bets 10-1,000 units per wager; the default odds cap is
// 3-4-5x. Field, place/buy/lay, hardways and propositions arrive with #71.
//
// House edges are a property of the pinned rules, derived exactly from the 36
// dice combinations (no simulation), and tested against published figures.

import {
  add,
  div,
  money,
  mul,
  sub,
  STANDARD_CRAPS,
  type CrapsPoint,
  type CrapsRuleSet,
  type Money,
  type OddsCap,
  type VersionedIdentity,
} from '@tableside/engine';

/** A standard craps table with the launch limits and the chosen odds cap (default 3-4-5x). */
export const standardCraps = (odds: OddsCap = '3-4-5x'): CrapsRuleSet => ({
  id: STANDARD_CRAPS.id,
  version: STANDARD_CRAPS.version,
  odds,
  limits: { line: { min: '10', max: '1000' } },
});

export type CrapsLineWager = 'pass' | 'dont-pass' | 'come' | 'dont-come' | 'odds';

export interface CrapsHouseEdge {
  readonly wager: CrapsLineWager;
  /** Per bet made, as a percentage with two decimals ("1.41"). */
  readonly percent: string;
  /** The line bet with full odds behind it, per total amount bet; null for odds alone. */
  readonly withFullOdds: string | null;
  readonly odds: OddsCap;
  /** The rule identity these facts belong to. */
  readonly rules: VersionedIdentity;
}

const POINTS: readonly CrapsPoint[] = [4, 5, 6, 8, 9, 10];
/** Ways to roll each total with two dice, out of 36. */
const ways = (total: number) => 6 - Math.abs(7 - total);
const p = (total: number) => money(BigInt(ways(total)), 36n);
const sum = (values: Money[]) => values.reduce(add, money(0n));

/** Chance the point repeats before a 7. */
const repeats = (n: CrapsPoint) => money(BigInt(ways(n)), BigInt(ways(n) + 6));

/** Expected loss per unit bet: positive is the house's edge. */
function lineEdge(dont: boolean): Money {
  const comeOutWin = dont ? add(p(2), p(3)) : add(p(7), p(11));
  const comeOutLoss = dont ? add(p(7), p(11)) : sum([p(2), p(3), p(12)]);
  const pointWin = sum(POINTS.map((n) => mul(p(n), dont ? sub(money(1n), repeats(n)) : repeats(n))));
  const pointLoss = sum(POINTS.map((n) => mul(p(n), dont ? repeats(n) : sub(money(1n), repeats(n)))));
  return sub(add(comeOutLoss, pointLoss), add(comeOutWin, pointWin));
}

/** True odds taken: profit per unit (2:1, 3:2, 6:5). */
const trueOdds = (n: CrapsPoint) => (n === 4 || n === 10 ? money(2n) : n === 5 || n === 9 ? money(3n, 2n) : money(6n, 5n));

function takeMultiple(cap: OddsCap, n: CrapsPoint): Money {
  if (cap === '3-4-5x') return money(n === 4 || n === 10 ? 3n : n === 5 || n === 9 ? 4n : 5n);
  return money(BigInt(cap.slice(0, -1)));
}

/** Expected full-odds stake per unit of line bet: taken odds per the cap, or laid to win the cap. */
const fullOdds = (cap: OddsCap, dont: boolean) =>
  sum(POINTS.map((n) => mul(p(n), dont ? mul(takeMultiple(cap, n), trueOdds(n)) : takeMultiple(cap, n))));

/** A rational as a percentage rounded half up to two decimals. */
function percent(value: Money): string {
  const hundredths = (value.n * 10000n * 2n + value.d) / (value.d * 2n);
  const whole = hundredths / 100n;
  return `${whole.toString()}.${(hundredths % 100n).toString().padStart(2, '0')}`;
}

/** The house edge of a line-game wager under the given standard craps rules. */
export function crapsHouseEdge(wager: CrapsLineWager, rules: Pick<CrapsRuleSet, 'id' | 'version' | 'odds'>): CrapsHouseEdge {
  const identity = { id: rules.id, version: rules.version };
  if (wager === 'odds') return { wager, percent: percent(money(0n)), withFullOdds: null, odds: rules.odds, rules: identity };
  const dont = wager === 'dont-pass' || wager === 'dont-come';
  const edge = lineEdge(dont);
  const combined = div(edge, add(money(1n), fullOdds(rules.odds, dont)));
  return { wager, percent: percent(edge), withFullOdds: percent(combined), odds: rules.odds, rules: identity };
}

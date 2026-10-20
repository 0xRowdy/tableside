import { oneSpinOutcomeTable, rouletteLayout, type PlacementKind, type RouletteWheel } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { DOUBLE_ZERO_ROULETTE, ROULETTE_HOUSE_EDGE_VERSION, rouletteHouseEdge, SINGLE_ZERO_ROULETTE } from '../src/index';

// Coverage and net payout of each wager kind, from the launch rules (#3) and
// the Wizard of Odds payout table; first four is single-zero only and the
// five-number basket double-zero only.
const KINDS: Record<PlacementKind, { covers: number; payout: number }> = {
  straight: { covers: 1, payout: 35 },
  split: { covers: 2, payout: 17 },
  street: { covers: 3, payout: 11 },
  trio: { covers: 3, payout: 11 },
  corner: { covers: 4, payout: 8 },
  'first-four': { covers: 4, payout: 8 },
  'six-line': { covers: 6, payout: 5 },
  basket: { covers: 5, payout: 6 },
  red: { covers: 18, payout: 1 },
  black: { covers: 18, payout: 1 },
  odd: { covers: 18, payout: 1 },
  even: { covers: 18, payout: 1 },
  low: { covers: 18, payout: 1 },
  high: { covers: 18, payout: 1 },
  dozen: { covers: 12, payout: 2 },
  column: { covers: 12, payout: 2 },
};
const WHEELS: Record<RouletteWheel, { pockets: number; kinds: PlacementKind[] }> = {
  'single-zero': { pockets: 37, kinds: (Object.keys(KINDS) as PlacementKind[]).filter((kind) => kind !== 'basket') },
  'double-zero': { pockets: 38, kinds: (Object.keys(KINDS) as PlacementKind[]).filter((kind) => kind !== 'first-four') },
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
/** The exact edge per unit staked: 1 - P(win) × (payout + 1), as a reduced fraction. */
function exactEdge(wheel: RouletteWheel, kind: PlacementKind): [number, number] {
  const { covers, payout } = KINDS[kind];
  const { pockets } = WHEELS[wheel];
  const n = pockets - covers * (payout + 1);
  const g = gcd(n, pockets);
  return [n / g, pockets / g];
}

/** The same edge from the engine's one-spin outcome table for one unit on a placement of that kind. */
function tableEdge(wheel: RouletteWheel, kind: PlacementKind): string {
  const placement = rouletteLayout(wheel).find((p) => p.kind === kind);
  if (!placement) throw new Error(`no ${kind} on ${wheel}`);
  let numerator = 0n;
  let denominator = 1n;
  for (const group of oneSpinOutcomeTable([{ target: placement.target, amount: '1' }], wheel)) {
    const [pn, pd = '1'] = group.probability.split('/');
    // expected += probability × net, kept as a fraction over a common denominator
    numerator = numerator * BigInt(pd) + BigInt(pn as string) * BigInt(group.net) * denominator;
    denominator *= BigInt(pd);
  }
  const g = BigInt(gcd(Number(numerator < 0n ? -numerator : numerator), Number(denominator)));
  const [n, d] = [-numerator / g, denominator / g];
  return d === 1n ? String(n) : `${n}/${d}`;
}

const percent = ([n, d]: [number, number]) => ((n * 100) / d).toFixed(2);

describe('roulette house edge', () => {
  for (const wheel of ['single-zero', 'double-zero'] as const) {
    it.each(WHEELS[wheel].kinds)(`${wheel} %s matches the exact computation`, (kind) => {
      const edge = rouletteHouseEdge(wheel, kind);
      const exact = exactEdge(wheel, kind);
      expect(edge).toEqual({ exact: `${exact[0]}/${exact[1]}`, percent: percent(exact), version: ROULETTE_HOUSE_EDGE_VERSION });
      expect(tableEdge(wheel, kind)).toBe(edge?.exact);
    });
  }

  it('has a value for exactly the wagers each layout offers', () => {
    for (const wheel of ['single-zero', 'double-zero'] as const) {
      const offered = [...new Set(rouletteLayout(wheel).map((p) => p.kind))].sort();
      expect(offered).toEqual([...WHEELS[wheel].kinds].sort());
    }
    expect(rouletteHouseEdge('single-zero', 'basket')).toBeUndefined();
    expect(rouletteHouseEdge('double-zero', 'first-four')).toBeUndefined();
  });

  it('gives the published figures: 2.70% single zero, 5.26% double zero, 7.89% five-number basket', () => {
    expect(rouletteHouseEdge('single-zero', 'red')?.percent).toBe('2.70');
    expect(rouletteHouseEdge('single-zero', 'first-four')?.percent).toBe('2.70');
    expect(rouletteHouseEdge('double-zero', 'straight')?.percent).toBe('5.26');
    expect(rouletteHouseEdge('double-zero', 'basket')?.percent).toBe('7.89');
  });
});

describe('roulette presets', () => {
  it('pin each wheel at the launch default limits', () => {
    const limits = { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } };
    expect(SINGLE_ZERO_ROULETTE).toEqual({ id: 'roulette-single-zero', version: 1, wheel: 'single-zero', limits });
    expect(DOUBLE_ZERO_ROULETTE).toEqual({ id: 'roulette-double-zero', version: 1, wheel: 'double-zero', limits });
  });
});

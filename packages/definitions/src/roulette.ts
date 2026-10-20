// Roulette rule presets and house-edge facts. Limits are the launch defaults
// (#3): inside 1-100, outside 10-1,000 units per placement, with no aggregate
// table cap. Editable limits arrive with #72.

import { ROULETTE_RULE_SETS, type PlacementKind, type RouletteRuleSet, type RouletteWheel, type VersionedIdentity } from '@tableside/engine';

const LAUNCH_LIMITS: RouletteRuleSet['limits'] = {
  inside: { min: '1', max: '100' },
  outside: { min: '10', max: '1000' },
};

export const SINGLE_ZERO_ROULETTE: RouletteRuleSet = { ...ROULETTE_RULE_SETS['single-zero'], limits: LAUNCH_LIMITS };

export const DOUBLE_ZERO_ROULETTE: RouletteRuleSet = { ...ROULETTE_RULE_SETS['double-zero'], limits: LAUNCH_LIMITS };

export const ROULETTE_PRESETS: Readonly<Record<RouletteWheel, RouletteRuleSet>> = {
  'single-zero': SINGLE_ZERO_ROULETTE,
  'double-zero': DOUBLE_ZERO_ROULETTE,
};

/** The version of the roulette house-edge values; bump it when any value changes. */
export const ROULETTE_HOUSE_EDGE_VERSION = 1;

export interface RouletteHouseEdge {
  /** The exact edge per unit staked, canonical money encoding ("1/37"). */
  readonly exact: string;
  /** Percent of the stake, two decimals, as displayed ("2.70"). */
  readonly percent: string;
  /** The version of these values. */
  readonly version: number;
  /** The rule set the value is a property of. */
  readonly rules: VersionedIdentity;
}

const SINGLE_ZERO = { exact: '1/37', percent: '2.70' } as const;
const DOUBLE_ZERO = { exact: '1/19', percent: '5.26' } as const;

// The exact edge of each wager the layout offers: 1 - P(win) × (payout + 1).
// Every single-zero wager is 1/37 and every double-zero wager 2/38, except the
// five-number basket, 1 - 5/38 × 7 = 3/38. A property of the rules, never a
// prediction of a session's results (see test/roulette-house-edge.test.ts).
const HOUSE_EDGES: Readonly<Record<RouletteWheel, Partial<Record<PlacementKind, { exact: string; percent: string }>>>> = {
  'single-zero': {
    straight: SINGLE_ZERO, split: SINGLE_ZERO, street: SINGLE_ZERO, trio: SINGLE_ZERO, corner: SINGLE_ZERO,
    'first-four': SINGLE_ZERO, 'six-line': SINGLE_ZERO, red: SINGLE_ZERO, black: SINGLE_ZERO, odd: SINGLE_ZERO,
    even: SINGLE_ZERO, low: SINGLE_ZERO, high: SINGLE_ZERO, dozen: SINGLE_ZERO, column: SINGLE_ZERO,
  },
  'double-zero': {
    straight: DOUBLE_ZERO, split: DOUBLE_ZERO, street: DOUBLE_ZERO, trio: DOUBLE_ZERO, corner: DOUBLE_ZERO,
    'six-line': DOUBLE_ZERO, basket: { exact: '3/38', percent: '7.89' }, red: DOUBLE_ZERO, black: DOUBLE_ZERO,
    odd: DOUBLE_ZERO, even: DOUBLE_ZERO, low: DOUBLE_ZERO, high: DOUBLE_ZERO, dozen: DOUBLE_ZERO, column: DOUBLE_ZERO,
  },
};

/** The house edge of a wager under a wheel's rules, or undefined when that layout doesn't offer it. */
export function rouletteHouseEdge(wheel: RouletteWheel, kind: PlacementKind): RouletteHouseEdge | undefined {
  const edge = HOUSE_EDGES[wheel][kind];
  const { id, version } = ROULETTE_PRESETS[wheel];
  return edge && { exact: edge.exact, percent: edge.percent, version: ROULETTE_HOUSE_EDGE_VERSION, rules: { id, version } };
}

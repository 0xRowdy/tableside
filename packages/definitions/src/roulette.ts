// #3

import { ROULETTE_RULE_SETS, type PlacementKind, type RouletteRuleSet, type RouletteWheel, type VersionedIdentity } from '@tableside/engine';

export const ROULETTE_LIMITS: RouletteRuleSet['limits'] = {
  inside: { min: '1', max: '100' },
  outside: { min: '10', max: '1000' },
};

export const SINGLE_ZERO_ROULETTE: RouletteRuleSet = { ...ROULETTE_RULE_SETS['single-zero'], limits: ROULETTE_LIMITS };

export const DOUBLE_ZERO_ROULETTE: RouletteRuleSet = { ...ROULETTE_RULE_SETS['double-zero'], limits: ROULETTE_LIMITS };

export const ROULETTE_PRESETS: Readonly<Record<RouletteWheel, RouletteRuleSet>> = {
  'single-zero': SINGLE_ZERO_ROULETTE,
  'double-zero': DOUBLE_ZERO_ROULETTE,
};

export const rouletteRules = (wheel: RouletteWheel, limits: RouletteRuleSet['limits'] = ROULETTE_LIMITS): RouletteRuleSet => ({
  ...ROULETTE_RULE_SETS[wheel],
  limits: { inside: { ...limits.inside }, outside: { ...limits.outside } },
});

export const ROULETTE_HOUSE_EDGE_VERSION = 1;

export interface RouletteHouseEdge {
  readonly exact: string;
  readonly percent: string;
  readonly version: number;
  readonly rules: VersionedIdentity;
}

const SINGLE_ZERO = { exact: '1/37', percent: '2.70' } as const;
const DOUBLE_ZERO = { exact: '1/19', percent: '5.26' } as const;

// Spec 1 Amendment 1 §B
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

export function rouletteHouseEdge(wheel: RouletteWheel, kind: PlacementKind): RouletteHouseEdge | undefined {
  const edge = HOUSE_EDGES[wheel][kind];
  const { id, version } = ROULETTE_PRESETS[wheel];
  return edge && { exact: edge.exact, percent: edge.percent, version: ROULETTE_HOUSE_EDGE_VERSION, rules: { id, version } };
}

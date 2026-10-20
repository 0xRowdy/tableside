// The seven benchmark profiles of standardized evaluation (spec 6, Amendment
// 6 §1). Each starts with 1,000 units, a 10-unit base and 200 table
// opportunities (waiting counts), settles everything at the end, and uses the
// launch presets, default limits and legal increments. A blackjack profile
// seats one simulated player ahead of the evaluated one: fixed minimum bet,
// the preset's basic strategy, unlimited funds, outside every metric. Each
// profile carries its monetary-exposure bound, checked against the bound its
// rules imply (test/benchmark-profiles.test.ts). A change to a profile bumps
// its version.

import { BENCHMARK_PROTOCOL, type BenchmarkProfile } from '@tableside/engine';

import { blackjackRules, DEFAULT_PENETRATION } from './blackjack/rules';
import { BLACKJACK_REFERENCE_IDENTITY } from './blackjack/strategies';
import type { BlackjackPreset } from './blackjack/reference';
import { standardCraps } from './craps';
import { DOUBLE_ZERO_ROULETTE, SINGLE_ZERO_ROULETTE } from './roulette';

const PROTOCOL = {
  version: 1,
  funding: BENCHMARK_PROTOCOL.funding,
  base: BENCHMARK_PROTOCOL.base,
  opportunities: BENCHMARK_PROTOCOL.opportunities,
  finalSettlement: 'complete',
} as const;

/** Six decks, fresh shuffle (count 0), 75% penetration, one benchmark seat ahead of the evaluated player. */
const blackjack = (preset: BlackjackPreset, exposureBound: string): BenchmarkProfile => ({
  id: `benchmark-blackjack-${preset}`,
  ...PROTOCOL,
  game: 'blackjack',
  rules: blackjackRules(preset, DEFAULT_PENETRATION, 1),
  reference: { ...BLACKJACK_REFERENCE_IDENTITY },
  exposureBound,
});

export const BENCHMARK_PROFILES: readonly BenchmarkProfile[] = [
  blackjack('H17_LS', '5126500'),
  blackjack('H17_noLS', '5126500'),
  blackjack('S17_LS', '5126500'),
  blackjack('S17_noLS', '5126500'),
  // Default odds (3-4-5x) and field (12 pays triple); come-out start, no wagers.
  { id: 'benchmark-craps-standard', ...PROTOCOL, game: 'craps', rules: standardCraps(), reference: null, exposureBound: '750213400' },
  { id: 'benchmark-roulette-single-zero', ...PROTOCOL, game: 'roulette', rules: SINGLE_ZERO_ROULETTE, reference: null, exposureBound: '191755000' },
  { id: 'benchmark-roulette-double-zero', ...PROTOCOL, game: 'roulette', rules: DOUBLE_ZERO_ROULETTE, reference: null, exposureBound: '194649400' },
];

/** A benchmark profile by id. */
export const benchmarkProfile = (id: string): BenchmarkProfile | undefined => BENCHMARK_PROFILES.find((profile) => profile.id === id);

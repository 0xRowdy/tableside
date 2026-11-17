// Spec 1 Amendment 6 §1

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
  { id: 'benchmark-craps-standard', ...PROTOCOL, game: 'craps', rules: standardCraps(), reference: null, exposureBound: '750213400' },
  { id: 'benchmark-roulette-single-zero', ...PROTOCOL, game: 'roulette', rules: SINGLE_ZERO_ROULETTE, reference: null, exposureBound: '191755000' },
  { id: 'benchmark-roulette-double-zero', ...PROTOCOL, game: 'roulette', rules: DOUBLE_ZERO_ROULETTE, reference: null, exposureBound: '194649400' },
];

export const benchmarkProfile = (id: string): BenchmarkProfile | undefined => BENCHMARK_PROFILES.find((profile) => profile.id === id);

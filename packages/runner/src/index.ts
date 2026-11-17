// Spec 6 Amendment 6
import {
  BENCHMARK_PROFILES,
  BLACKJACK_MODES,
  BLACKJACK_PRESETS,
  blackjackStrategy,
  countingMode,
  CRAPS_STRATEGIES,
  DEFINITIONS_VERSION,
  ROULETTE_STRATEGIES,
} from '@tableside/definitions';
import {
  ENGINE_VERSION,
  exposureBoundProblems,
  recordExposureProblems,
  runStandardizedSession,
  strategyTableCompatibility,
  type BenchmarkProfile,
  type StandardizedSessionRecord,
  type StrategyDefinition,
  type StrategySelection,
  type Words2,
} from '@tableside/engine';

export interface RunnerInfo {
  engine: string;
  definitions: string;
  node: string;
}

export function runnerInfo(): RunnerInfo {
  return { engine: ENGINE_VERSION, definitions: DEFINITIONS_VERSION, node: process.version };
}

export function builtInStrategies(): StrategyDefinition[] {
  const blackjack = BLACKJACK_PRESETS.flatMap((preset) =>
    BLACKJACK_MODES.flatMap((mode) => [blackjackStrategy(preset, mode), ...(countingMode(mode) ? [blackjackStrategy(preset, mode, true)] : [])]),
  );
  return [...ROULETTE_STRATEGIES, ...CRAPS_STRATEGIES, ...blackjack];
}

export function compatibleProfiles({ definition, parameters }: StrategySelection): BenchmarkProfile[] {
  return BENCHMARK_PROFILES.filter((profile) => profile.game === definition.game && strategyTableCompatibility(definition, parameters, profile.rules).compatible);
}

export function parseKey(hex: string): Words2 {
  if (!/^[0-9a-f]{16}$/i.test(hex)) throw new RangeError('the key is 16 hex digits');
  const value = BigInt(`0x${hex}`);
  return [Number(value & 0xffffffffn), Number(value >> 32n)];
}

export interface RunRequest {
  readonly profile: BenchmarkProfile;
  readonly strategy: StrategySelection;
  readonly key: Words2;
  readonly indices: readonly number[];
}

export function runStandardized(request: RunRequest): StandardizedSessionRecord[] {
  const { profile, strategy, key } = request;
  const problems = exposureBoundProblems(profile);
  if (problems.length > 0) throw new Error(problems.join('; '));
  return request.indices.map((index) => {
    const { record } = runStandardizedSession({ profile, strategy, key, index });
    const past = recordExposureProblems(record, profile);
    if (past.length > 0) throw new Error(past.join('; '));
    return record;
  });
}

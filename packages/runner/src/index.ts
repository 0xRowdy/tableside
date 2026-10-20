// The headless runner: the shared engine on Node, running standardized
// sessions under the same determinism contract as the app (spec 6, Amendment
// 6). The engine does the work; the runner is the host: it picks the
// strategy and profile, takes the coordinator's key, checks each profile's
// exposure bound before any session runs and each record against it after.
import {
  BENCHMARK_PROFILES,
  BLACKJACK_MODES,
  BLACKJACK_PRESETS,
  blackjackStrategy,
  countingMode,
  CRAPS_STRATEGIES,
  DEFINITIONS_VERSION,
  ROULETTE_STRATEGIES,
  strategyDefaults,
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

/** Every built-in strategy: roulette, craps, and each blackjack preset's modes (counting modes also with the bet schedule). */
export function builtInStrategies(): StrategyDefinition[] {
  const blackjack = BLACKJACK_PRESETS.flatMap((preset) =>
    BLACKJACK_MODES.flatMap((mode) => [blackjackStrategy(preset, mode), ...(countingMode(mode) ? [blackjackStrategy(preset, mode, true)] : [])]),
  );
  return [...ROULETTE_STRATEGIES, ...CRAPS_STRATEGIES, ...blackjack];
}

/** The profiles a strategy is evaluated under: every profile of its game it fits, without adjustment. */
export function compatibleProfiles(definition: StrategyDefinition, parameters: Readonly<Record<string, string>> = strategyDefaults(definition)): BenchmarkProfile[] {
  return BENCHMARK_PROFILES.filter((profile) => profile.game === definition.game && strategyTableCompatibility(definition, parameters, profile.rules).compatible);
}

/** The coordinator's 64-bit Philox key, as 16 hex digits, read as [keyLow32, keyHigh32]. */
export function parseKey(hex: string): Words2 {
  if (!/^[0-9a-f]{16}$/i.test(hex)) throw new RangeError('the key is 16 hex digits');
  const value = BigInt(`0x${hex}`);
  return [Number(value & 0xffffffffn), Number(value >> 32n)];
}

export interface RunRequest {
  readonly profile: BenchmarkProfile;
  readonly definition: StrategyDefinition;
  /** The strategy's choices; its defaults when omitted. */
  readonly parameters?: Readonly<Record<string, string>>;
  readonly key: Words2;
  /** The session indices to run, in order. */
  readonly indices: readonly number[];
}

/**
 * Runs the sessions and returns their records in index order. Throws before
 * running anything when the profile's exposure bound fails validation, and
 * when any record exceeds it (an integrity error, never a result).
 */
export function runStandardized(request: RunRequest): StandardizedSessionRecord[] {
  const { profile, definition, key } = request;
  const problems = exposureBoundProblems(profile);
  if (problems.length > 0) throw new Error(problems.join('; '));
  const parameters = request.parameters ?? strategyDefaults(definition);
  return request.indices.map((index) => {
    const { record } = runStandardizedSession({ profile, strategy: { definition, parameters }, key, index });
    const past = recordExposureProblems(record, profile);
    if (past.length > 0) throw new Error(past.join('; '));
    return record;
  });
}

export const DEFINITIONS_VERSION = '0.0.0';

export {
  basicStrategy,
  BLACKJACK_PRESETS,
  BLACKJACK_REFERENCE,
  blackjackHouseEdge,
  type BlackjackHouseEdge,
  continuation,
  deviationAction,
  playingDeviations,
  type BasicStrategyCell,
  type ContinuationCell,
  type DeviationAction,
  type PlayingDeviation,
  type PublishedCost,
  type BlackjackPreset,
  type CardValue,
  type DealerRule,
  type HandKind,
  type PlayAction,
} from './blackjack/reference';

export { BLACKJACK_LIMITS, blackjackRules, DEFAULT_BLACKJACK_PRESET, DEFAULT_PENETRATION } from './blackjack/rules';
export { seatStrategy } from './blackjack/seats';
export { BET_SCHEDULE, BLACKJACK_MODES, BLACKJACK_REFERENCE_IDENTITY, blackjackStrategy, countingMode, type BlackjackMode } from './blackjack/strategies';
export {
  CRAPS_EDGE_WAGERS,
  CRAPS_LIMITS,
  CRAPS_HOUSE_EDGE_VERSION,
  crapsEdgeWager,
  crapsHouseEdge,
  standardCraps,
  type CrapsHouseEdge,
  type CrapsLineWager,
  type CrapsProposition,
  type CrapsWager,
} from './craps';
export {
  DOUBLE_ZERO_ROULETTE,
  ROULETTE_HOUSE_EDGE_VERSION,
  ROULETTE_LIMITS,
  ROULETTE_PRESETS,
  rouletteRules,
  rouletteHouseEdge,
  SINGLE_ZERO_ROULETTE,
  type RouletteHouseEdge,
} from './roulette';

export {
  BOUNDED_LABOUCHERE,
  CAPPED_MARTINGALE,
  FIXED_TWO_DOZENS,
  FLAT_EVEN_MONEY,
  ROULETTE_STRATEGIES,
  strategyDefaults,
  THREE_WIN_PARLAY,
} from './roulette-strategies';

export {
  CRAPS_STRATEGIES,
  DONT_PASS_WITH_LAY_ODDS,
  FLAT_PLACE_6_8,
  PASS_WITH_ODDS,
  PRESS_AND_COLLECT_6_8,
  THREE_POINT_MOLLY,
} from './craps-strategies';

export { QUARANTINE_LIST } from './quarantine';

export { benchmarkProfile, BENCHMARK_PROFILES } from './benchmark-profiles';

export { CARD_VALUES_CONTENT, CATALOG_CATEGORIES, CHALLENGE_CONTENT, CONVERSION_CONTENT, RUNNING_COUNT_CONTENT, type CatalogCategory } from './challenges';

export {
  APP_ORIENTATION,
  CHALLENGE_LESSONS,
  LESSONS,
  lessonProblems,
  type Lesson,
  type LessonContent,
  type LessonHandoff,
  type LessonSection,
  type LessonSource,
  type LessonStep,
} from './lessons';

export { workedExampleProblems, type CardValueExample, type ScriptedChoice, type ScriptedResponse, type WorkedExample } from './worked-examples';
export {
  strategyStepProblems,
  type ScriptedOutcome,
  type ScriptedTurn,
  type StrategyBetsAnswer,
  type StrategyStepAnswer,
  type StrategyStepExample,
  type StrategyStepExplanation,
} from './strategy-examples';

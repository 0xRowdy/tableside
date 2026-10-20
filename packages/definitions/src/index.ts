// Versioned game content the engine interprets: rule presets, built-in
// strategies, the certified blackjack reference and house-edge facts. Content
// is data, not code, and is portable under the same rule as the engine.

/** The definitions release. Activities will pin the identities of the content they use. */
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
export { BLACKJACK_MODES, BLACKJACK_REFERENCE_IDENTITY, blackjackStrategy, type BlackjackMode } from './blackjack/strategies';
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

export { QUARANTINE_LIST } from './quarantine';

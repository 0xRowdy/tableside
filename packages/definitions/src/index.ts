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

export {
  DOUBLE_ZERO_ROULETTE,
  ROULETTE_HOUSE_EDGE_VERSION,
  ROULETTE_PRESETS,
  rouletteHouseEdge,
  SINGLE_ZERO_ROULETTE,
  type RouletteHouseEdge,
} from './roulette';

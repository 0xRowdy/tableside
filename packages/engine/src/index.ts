// The shared game engine: portable TypeScript that runs unchanged on Node and
// on the app's bundled Hermes. It has no React, Expo, Node-only, network,
// storage, clock, account, advertising or subscription dependency; the app and
// the runner supply adapters. The portability rule is enforced by lint.

export { ENGINE_VERSION } from './version';
export {
  advanceActivity,
  checkpointHash,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  readPermittedView,
  ActivitySpecificationError,
  STATE_SCHEMA_VERSION,
  type ActivitySpecification,
  type ActivityState,
  type BlackjackActivitySpecification,
  type GameId,
  type Limit,
  type RouletteActivitySpecification,
  type RouletteActivityState,
  type FundingView,
  type GameCommand,
  type RoulettePermittedView,
  type AdvanceResult,
  type CheckpointResult,
  type Command,
  type CommandEnvelope,
  type CommandKind,
  type DomainFact,
  type Phase,
  type PermittedView,
  type Receipt,
  type IllegalActionReason,
  type RejectionReason,
  type RouletteRuleSet,
  type VersionedIdentity,
  type Wager,
} from './activity';
export {
  BLACKJACK_RULES,
  PENETRATIONS,
  type BlackjackAction,
  type BlackjackActivityState,
  type BlackjackHand,
  type BlackjackPermittedView,
  type BlackjackRound,
  type BlackjackRuleSet,
  type BlackjackTable,
  type HandTotal,
  type Peek,
} from './blackjack';
export {
  cumulativeFunding,
  FUNDING_CEILING,
  fundingHeadroom,
  summarizeFunding,
  type Funding,
  type FundingResult,
  type FundingSource,
  type RebuyRefusal,
} from './funding';

export {
  oneSpinOutcomeTable,
  ROULETTE_RULE_SETS,
  rouletteLayout,
  type LimitClass,
  type OneSpinOutcome,
  type PlacementKind,
  type RoulettePlacement,
} from './roulette';
export { philox4x32 } from './philox';
export {
  RANDOM_PROTOCOL_VERSION,
  RandomStream,
  RandomStreamExhaustedError,
  RandomStreamStateError,
  streamIdentityFromEntropy,
  uniformInt,
  type EntropySource,
  type RandomStreamIdentity,
  type RandomStreamState,
} from './random';
export {
  canonicalShoe,
  rollDice,
  roulettePockets,
  shuffle,
  spinRoulette,
  type Card,
  type RoulettePocket,
  type RouletteWheel,
  type Rank,
  type Suit,
} from './draws';
export {
  add,
  commission,
  compare,
  decodeMoney,
  div,
  encodeMoney,
  money,
  MoneyFormatError,
  mul,
  neg,
  sub,
  type Money,
} from './money';
export { canonicalJson } from './canonical';
export { sha256Hex } from './sha256';
export {
  decodeStrategyLiteral,
  STRATEGY_LITERAL_DIGITS,
  STRATEGY_VALUE_BITS,
  StrategyEnvelopeError,
  withinStrategyBits,
} from './strategy-envelope';

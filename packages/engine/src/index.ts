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
  type CrapsActivitySpecification,
  type CrapsPermittedView,
  type GameId,
  type Limit,
  type RouletteActivitySpecification,
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
  type VersionedIdentity,
  type Wager,
} from './activity';
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
  CRAPS_POINTS,
  ODDS_CAPS,
  STANDARD_CRAPS,
  type CrapsActivityState,
  type CrapsDomainFact,
  type CrapsIllegalActionReason,
  type CrapsOutcome,
  type CrapsPlacement,
  type CrapsPoint,
  type CrapsRuleSet,
  type CrapsTable,
  type CrapsWagerStatus,
  type OddsCap,
} from './craps';
export { ROULETTE_RULES, type RouletteActivityState, type RouletteRuleSet, type RouletteTable } from './roulette';

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
export { sha256Hex } from './sha256';
export {
  decodeStrategyLiteral,
  STRATEGY_LITERAL_DIGITS,
  STRATEGY_VALUE_BITS,
  StrategyEnvelopeError,
  withinStrategyBits,
} from './strategy-envelope';

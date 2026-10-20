// The shared game engine: portable TypeScript that runs unchanged on Node and
// on the app's bundled Hermes. It has no React, Expo, Node-only, network,
// storage, clock, account, advertising or subscription dependency; the app and
// the runner supply adapters. The portability rule is enforced by lint.

/** The engine build's version. Activities will pin it alongside rule and strategy identities. */
export const ENGINE_VERSION = '0.0.0';

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
export {
  decodeStrategyLiteral,
  STRATEGY_LITERAL_DIGITS,
  STRATEGY_VALUE_BITS,
  StrategyEnvelopeError,
  withinStrategyBits,
} from './strategy-envelope';

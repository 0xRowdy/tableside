// The strategy envelope's numeric guards. They bound user-authored strategy
// definitions and their evaluation only; payouts, balances and settlement are
// never capped.

import { decodeMoney, type Money } from './money';

export class StrategyEnvelopeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyEnvelopeError';
  }
}

export const STRATEGY_LITERAL_DIGITS = 40;
export const STRATEGY_VALUE_BITS = 256;

/**
 * Decodes a strategy numeric literal, refusing any component longer than 40
 * decimal digits before a BigInt is constructed.
 */
export function decodeStrategyLiteral(text: string): Money {
  const slash = text.indexOf('/');
  const numerator = slash < 0 ? text : text.slice(0, slash);
  const digits = numerator.startsWith('-') ? numerator.length - 1 : numerator.length;
  const denominatorDigits = slash < 0 ? 0 : text.length - slash - 1;
  if (digits > STRATEGY_LITERAL_DIGITS || denominatorDigits > STRATEGY_LITERAL_DIGITS) {
    throw new StrategyEnvelopeError(`strategy literals allow at most ${STRATEGY_LITERAL_DIGITS} digits per component`);
  }
  return decodeMoney(text);
}

const STRATEGY_BOUND = 1n << BigInt(STRATEGY_VALUE_BITS);

/** Whether both components of a strategy intermediate fit in 256 bits (magnitude below 2^256). */
export function withinStrategyBits(value: Money): boolean {
  const magnitude = value.n < 0n ? -value.n : value.n;
  return magnitude < STRATEGY_BOUND && value.d < STRATEGY_BOUND;
}

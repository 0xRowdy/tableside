// Exact money. Every amount is a normalized rational: a BigInt numerator and a
// positive BigInt denominator with no common factor (zero is 0/1). The
// canonical encoding writes the components as decimal integers, "n" when the
// denominator is 1 and "n/d" otherwise, so every value round-trips exactly.
// Nothing here rounds except `commission`, the one rule-prescribed rounding.

export interface Money {
  readonly n: bigint;
  readonly d: bigint;
}

export class MoneyFormatError extends Error {
  constructor(text: string) {
    super(`not a canonical money value: ${JSON.stringify(text.length > 64 ? `${text.slice(0, 64)}…` : text)}`);
    this.name = 'MoneyFormatError';
  }
}

export class StrategyEnvelopeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyEnvelopeError';
  }
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** The normalized value n/d. Throws RangeError for a zero denominator. */
export function money(n: bigint, d = 1n): Money {
  if (d === 0n) throw new RangeError('money denominator must not be zero');
  if (d < 0n) [n, d] = [-n, -d];
  if (n === 0n) return { n: 0n, d: 1n };
  const g = gcd(n, d);
  return g === 1n ? { n, d } : { n: n / g, d: d / g };
}

export const add = (a: Money, b: Money): Money => money(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Money, b: Money): Money => money(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Money, b: Money): Money => money(a.n * b.n, a.d * b.d);
export const neg = (a: Money): Money => money(-a.n, a.d);

/** a / b. Throws RangeError when b is zero. */
export function div(a: Money, b: Money): Money {
  if (b.n === 0n) throw new RangeError('cannot divide money by zero');
  return money(a.n * b.d, a.d * b.n);
}

/** -1, 0 or 1 as a is less than, equal to or greater than b. */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
}

/** The canonical encoding: "n" or "n/d" in decimal. */
export function encodeMoney(value: Money): string {
  return value.d === 1n ? value.n.toString() : `${value.n.toString()}/${value.d.toString()}`;
}

const CANONICAL = /^(-?)(0|[1-9][0-9]*)(?:\/([1-9][0-9]*))?$/;

/** Decodes the canonical encoding; any other spelling throws MoneyFormatError. */
export function decodeMoney(text: string): Money {
  const match = typeof text === 'string' ? CANONICAL.exec(text) : null;
  if (!match) throw new MoneyFormatError(String(text));
  const [, sign, numerator, denominator] = match;
  const n = BigInt(numerator as string);
  const d = denominator === undefined ? 1n : BigInt(denominator);
  const canonical =
    n === 0n ? sign === '' && denominator === undefined : denominator === undefined || (d !== 1n && gcd(n, d) === 1n);
  if (!canonical) throw new MoneyFormatError(text);
  return { n: sign === '-' ? -n : n, d };
}

/**
 * The rule-prescribed commission (buy: on the stake; standalone lay: on the
 * potential gross win): basis × rate rounded up to a whole unit, minimum 1.
 */
export function commission(basis: Money, rate: Money): Money {
  if (basis.n <= 0n || rate.n <= 0n) throw new RangeError('commission needs a positive basis and rate');
  const exact = mul(basis, rate);
  const ceiling = (exact.n + exact.d - 1n) / exact.d;
  return money(ceiling < 1n ? 1n : ceiling);
}

// The strategy envelope. These guard user-authored strategy definitions and
// their evaluation only; payouts, balances and settlement are never capped.

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

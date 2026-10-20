// Shape checks shared by the session protocol and the game modules: commands,
// specifications and checkpoints arrive as untrusted data.

import { compare, decodeMoney, type Money } from './money';

/** Ceiling for configurable base-wager limits, in units. */
export const BASE_WAGER_CEILING = 1_000_000n;
/** Longest accepted id or amount text; anything longer is malformed. */
export const MAX_TEXT = 128;

export interface Limit {
  /** Canonical whole-unit amounts. */
  readonly min: string;
  readonly max: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasExactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && Object.keys(value).sort().join() === [...keys].sort().join();

export const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT;

export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** A canonical money value, or undefined. */
export function parseMoney(value: unknown): Money | undefined {
  if (typeof value !== 'string' || value.length > MAX_TEXT) return undefined;
  try {
    return decodeMoney(value);
  } catch {
    return undefined;
  }
}

export const isWholeIn = (amount: Money | undefined, low: bigint, high: bigint): amount is Money =>
  amount !== undefined && amount.d === 1n && amount.n >= low && amount.n <= high;

/** Whole-unit min and max within the base-wager ceiling, min <= max. */
export function isLimit(value: unknown): value is Limit {
  if (!hasExactKeys(value, ['min', 'max'])) return false;
  const min = parseMoney(value.min);
  const max = parseMoney(value.max);
  return isWholeIn(min, 1n, BASE_WAGER_CEILING) && isWholeIn(max, 1n, BASE_WAGER_CEILING) && compare(min, max) <= 0;
}

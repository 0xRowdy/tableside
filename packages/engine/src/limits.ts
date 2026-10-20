// Table limits as a player types them at setup. The engine judges each amount
// and the pair so setup can explain every problem; nothing is ever corrected
// (rounded, clamped or swapped) on the player's behalf.

import { BASE_WAGER_CEILING, MAX_TEXT, type Limit } from './shape';

/** Why one typed limit amount can't be used. */
export type LimitAmountProblem = 'missing' | 'not-a-number' | 'not-positive' | 'not-whole' | 'over-ceiling';

export interface LimitInputCheck {
  readonly min: LimitAmountProblem | null;
  readonly max: LimitAmountProblem | null;
  /** Both amounts are good but the minimum is more than the maximum. */
  readonly minAboveMax: boolean;
  /** The canonical limit, when there is no problem. */
  readonly limit: Limit | null;
}

const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/;

function amount(text: string): { readonly problem: LimitAmountProblem } | { readonly value: bigint } {
  const trimmed = text.trim();
  if (trimmed === '') return { problem: 'missing' };
  const match = trimmed.length <= MAX_TEXT ? DECIMAL.exec(trimmed) : null;
  if (!match) return { problem: 'not-a-number' };
  const sign = match[1] as string;
  const units = BigInt(match[2] as string);
  const fractional = /[1-9]/.test(match[3] ?? '');
  if (sign === '-' || (units === 0n && !fractional)) return { problem: 'not-positive' };
  if (fractional) return { problem: 'not-whole' };
  if (units > BASE_WAGER_CEILING) return { problem: 'over-ceiling' };
  return { value: units };
}

/**
 * Checks a typed minimum and maximum (plain decimal text, any grouping
 * separators already removed). A limit is positive whole units up to the
 * base-wager ceiling, with the minimum no more than the maximum.
 */
export function checkLimitInput(min: string, max: string): LimitInputCheck {
  const low = amount(min);
  const high = amount(max);
  if ('problem' in low || 'problem' in high) {
    return { min: 'problem' in low ? low.problem : null, max: 'problem' in high ? high.problem : null, minAboveMax: false, limit: null };
  }
  if (low.value > high.value) return { min: null, max: null, minAboveMax: true, limit: null };
  return { min: null, max: null, minAboveMax: false, limit: { min: low.value.toString(), max: high.value.toString() } };
}

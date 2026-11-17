import { BASE_WAGER_CEILING, MAX_TEXT, type Limit } from './shape';

export type LimitAmountProblem = 'missing' | 'not-a-number' | 'not-positive' | 'not-whole' | 'over-ceiling';

export interface LimitInputCheck {
  readonly min: LimitAmountProblem | null;
  readonly max: LimitAmountProblem | null;
  readonly minAboveMax: boolean;
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

export function checkLimitInput(min: string, max: string): LimitInputCheck {
  const low = amount(min);
  const high = amount(max);
  if ('problem' in low || 'problem' in high) {
    return { min: 'problem' in low ? low.problem : null, max: 'problem' in high ? high.problem : null, minAboveMax: false, limit: null };
  }
  if (low.value > high.value) return { min: null, max: null, minAboveMax: true, limit: null };
  return { min: null, max: null, minAboveMax: false, limit: { min: low.value.toString(), max: high.value.toString() } };
}

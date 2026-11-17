import { compare, decodeMoney, type Money } from './money';

export const BASE_WAGER_CEILING = 1_000_000n;
export const MAX_TEXT = 128;

export interface VersionedIdentity {
  readonly id: string;
  readonly version: number;
}

export interface Limit {
  readonly min: string;
  readonly max: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasExactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && Object.keys(value).sort().join() === [...keys].sort().join();

export const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT;

export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export const isIdentity = (value: unknown): value is VersionedIdentity =>
  hasExactKeys(value, ['id', 'version']) && isText(value.id) && isCount(value.version);

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

export function isLimit(value: unknown): value is Limit {
  if (!hasExactKeys(value, ['min', 'max'])) return false;
  const min = parseMoney(value.min);
  const max = parseMoney(value.max);
  return isWholeIn(min, 1n, BASE_WAGER_CEILING) && isWholeIn(max, 1n, BASE_WAGER_CEILING) && compare(min, max) <= 0;
}

export function limitGroupProblems(limits: unknown, groups: readonly string[], path: string): { path: string; message: string }[] {
  if (!hasExactKeys(limits, groups)) return [{ path, message: `${groups.join(' and ')} limits are required` }];
  return groups
    .filter((group) => !isLimit(limits[group]))
    .map((group) => ({ path: `${path}/${group}`, message: `${group} limits are whole units from 1 to ${BASE_WAGER_CEILING} with min <= max` }));
}

export function isWagerList(value: unknown, order: (target: string) => number): value is { target: string; amount: string }[] {
  if (!Array.isArray(value)) return false;
  let last = -1;
  for (const wager of value as unknown[]) {
    if (!hasExactKeys(wager, ['target', 'amount']) || typeof wager.target !== 'string') return false;
    const amount = parseMoney(wager.amount);
    const index = order(wager.target);
    if (amount === undefined || amount.n <= 0n || index <= last) return false;
    last = index;
  }
  return true;
}

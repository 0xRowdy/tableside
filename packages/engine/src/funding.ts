// Practice funding, shared by every game's session protocol: the buy-in (or the
// training-bankroll allocation), explicit rebuys within the funding ceiling, and
// the buy-in-adjusted drawdown. Game modules report their session value (funds
// off the table plus outstanding stakes at their original value) after each
// transition; nothing here knows a game's rules. Plain JSON-safe data, pure.

import { add, compare, decodeMoney, encodeMoney, money, sub, type Money } from './money';

/** Cumulative session funding ceiling (buy-in plus rebuys, never winnings), in units. */
export const FUNDING_CEILING = 1_000_000_000n;

/**
 * Practice funding (a fresh buy-in, with rebuys) or spec 5's training bankroll
 * (the whole available bankroll allocated at start; no buy-in field, no rebuys).
 */
export type FundingSource = 'practice-funding' | 'training-bankroll';

export const FUNDING_SOURCES: readonly FundingSource[] = ['practice-funding', 'training-bankroll'];

export interface Funding {
  readonly source: FundingSource;
  /** The initial buy-in, or the training-bankroll allocation. Canonical whole units. */
  readonly buyIn: string;
  /** Each rebuy in order. Always empty for a training bankroll. */
  readonly rebuys: readonly string[];
  /** Highest game result so far (session value minus cumulative funding); starts at 0. */
  readonly peak: string;
  /** Largest fall of the game result from a previous peak, including final settlement. */
  readonly maxDrawdown: string;
}

/** Why a rebuy is refused. A refused rebuy is never resized. */
export type RebuyRefusal = 'not-whole-units' | 'over-funding-ceiling';

export interface FundingResult {
  readonly source: FundingSource;
  readonly buyIn: string;
  readonly rebuys: readonly string[];
  readonly cumulativeFunding: string;
  readonly finalCashOut: string;
  /** Final cash-out minus cumulative funding. */
  readonly netResult: string;
  readonly currentDrawdown: string;
  readonly maxDrawdown: string;
}

const ZERO = money(0n);

const isWhole = (amount: Money | undefined, low: bigint, high: bigint): amount is Money =>
  amount !== undefined && amount.d === 1n && amount.n >= low && amount.n <= high;

const max = (a: Money, b: Money) => (compare(a, b) >= 0 ? a : b);

/** Buy-in plus every rebuy. */
export const cumulativeFunding = (funding: Funding): Money =>
  funding.rebuys.reduce((sum, rebuy) => add(sum, decodeMoney(rebuy)), decodeMoney(funding.buyIn));

/** How much more may be added before the ceiling. */
export const fundingHeadroom = (funding: Funding): Money => sub(money(FUNDING_CEILING), cumulativeFunding(funding));

/** True when this funding source ever takes rebuys. */
export const rebuysOffered = (funding: Funding): boolean => funding.source === 'practice-funding';

/** Opening funding, or undefined when the amount isn't whole units from 1 to the ceiling. */
export function openFunding(source: FundingSource, amount: Money | undefined): Funding | undefined {
  if (!FUNDING_SOURCES.includes(source) || !isWhole(amount, 1n, FUNDING_CEILING)) return undefined;
  return { source, buyIn: encodeMoney(amount), rebuys: [], peak: '0', maxDrawdown: '0' };
}

/** Why this positive rebuy can't be taken as it is, if it can't. */
export function rebuyRefusal(funding: Funding, amount: Money): RebuyRefusal | undefined {
  if (amount.d !== 1n) return 'not-whole-units';
  if (compare(amount, fundingHeadroom(funding)) > 0) return 'over-funding-ceiling';
  return undefined;
}

/** Records a rebuy that rebuyRefusal accepted. It changes the game result by nothing. */
export const addRebuy = (funding: Funding, amount: Money): Funding => ({ ...funding, rebuys: [...funding.rebuys, encodeMoney(amount)] });

const gameResult = (funding: Funding, sessionValue: Money) => sub(sessionValue, cumulativeFunding(funding));

/**
 * Updates the peak and maximum drawdown for the session value after a
 * transition. Simultaneous settlements are observed once, as one transition.
 */
export function observeSessionValue(funding: Funding, sessionValue: Money): Funding {
  const result = gameResult(funding, sessionValue);
  const peak = max(decodeMoney(funding.peak), result);
  const drawdown = sub(peak, result);
  return { ...funding, peak: encodeMoney(peak), maxDrawdown: encodeMoney(max(decodeMoney(funding.maxDrawdown), drawdown)) };
}

/** The funding lines of a session result, for the cash-out (the session value once everything settled). */
export function summarizeFunding(funding: Funding, finalCashOut: Money): FundingResult {
  const cumulative = cumulativeFunding(funding);
  return {
    source: funding.source,
    buyIn: funding.buyIn,
    rebuys: [...funding.rebuys],
    cumulativeFunding: encodeMoney(cumulative),
    finalCashOut: encodeMoney(finalCashOut),
    netResult: encodeMoney(sub(finalCashOut, cumulative)),
    currentDrawdown: encodeMoney(sub(decodeMoney(funding.peak), gameResult(funding, finalCashOut))),
    maxDrawdown: funding.maxDrawdown,
  };
}

/** A description of what is wrong with stored funding, if anything. `parse` reads canonical money or gives undefined. */
export function fundingDamage(value: unknown, parse: (text: unknown) => Money | undefined): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'damaged funding';
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join() !== 'buyIn,maxDrawdown,peak,rebuys,source') return 'damaged funding';
  const { source, buyIn, rebuys, peak, maxDrawdown } = record;
  if (!FUNDING_SOURCES.includes(source as FundingSource) || !isWhole(parse(buyIn), 1n, FUNDING_CEILING)) return 'damaged funding';
  if (!Array.isArray(rebuys) || (source === 'training-bankroll' && rebuys.length > 0)) return 'damaged rebuys';
  let total = decodeMoney(buyIn as string);
  for (const rebuy of rebuys as unknown[]) {
    const amount = parse(rebuy);
    if (!isWhole(amount, 1n, FUNDING_CEILING)) return 'damaged rebuys';
    total = add(total, amount);
  }
  if (total.n > FUNDING_CEILING) return 'funding exceeds the ceiling';
  const peakValue = parse(peak);
  const drawdown = parse(maxDrawdown);
  if (!peakValue || compare(peakValue, ZERO) < 0 || !drawdown || compare(drawdown, ZERO) < 0) return 'damaged drawdown';
  return undefined;
}

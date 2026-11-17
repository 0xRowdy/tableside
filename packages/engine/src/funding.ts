import { add, compare, decodeMoney, encodeMoney, money, sub, type Money } from './money';

export const FUNDING_CEILING = 1_000_000_000n;

// Spec 5 training bankroll
export type FundingSource = 'practice-funding' | 'training-bankroll';

export const FUNDING_SOURCES: readonly FundingSource[] = ['practice-funding', 'training-bankroll'];

export interface Funding {
  readonly source: FundingSource;
  readonly buyIn: string;
  readonly rebuys: readonly string[];
  readonly peak: string;
  readonly maxDrawdown: string;
}

export type RebuyRefusal = 'not-whole-units' | 'over-funding-ceiling';

export interface FundingResult {
  readonly source: FundingSource;
  readonly buyIn: string;
  readonly rebuys: readonly string[];
  readonly cumulativeFunding: string;
  readonly finalCashOut: string;
  readonly netResult: string;
  readonly currentDrawdown: string;
  readonly maxDrawdown: string;
}

const ZERO = money(0n);

const isWhole = (amount: Money | undefined, low: bigint, high: bigint): amount is Money =>
  amount !== undefined && amount.d === 1n && amount.n >= low && amount.n <= high;

const max = (a: Money, b: Money) => (compare(a, b) >= 0 ? a : b);

export const cumulativeFunding = (funding: Funding): Money =>
  funding.rebuys.reduce((sum, rebuy) => add(sum, decodeMoney(rebuy)), decodeMoney(funding.buyIn));

export const fundingHeadroom = (funding: Funding): Money => sub(money(FUNDING_CEILING), cumulativeFunding(funding));

export const rebuysOffered = (funding: Funding): boolean => funding.source === 'practice-funding';

export function openFunding(source: FundingSource, amount: Money | undefined): Funding | undefined {
  if (!FUNDING_SOURCES.includes(source) || !isWhole(amount, 1n, FUNDING_CEILING)) return undefined;
  return { source, buyIn: encodeMoney(amount), rebuys: [], peak: '0', maxDrawdown: '0' };
}

export function rebuyRefusal(funding: Funding, amount: Money): RebuyRefusal | undefined {
  if (amount.d !== 1n) return 'not-whole-units';
  if (compare(amount, fundingHeadroom(funding)) > 0) return 'over-funding-ceiling';
  return undefined;
}

export const addRebuy = (funding: Funding, amount: Money): Funding => ({ ...funding, rebuys: [...funding.rebuys, encodeMoney(amount)] });

const gameResult = (funding: Funding, sessionValue: Money) => sub(sessionValue, cumulativeFunding(funding));

export function observeSessionValue(funding: Funding, sessionValue: Money): Funding {
  const result = gameResult(funding, sessionValue);
  const peak = max(decodeMoney(funding.peak), result);
  const drawdown = sub(peak, result);
  return { ...funding, peak: encodeMoney(peak), maxDrawdown: encodeMoney(max(decodeMoney(funding.maxDrawdown), drawdown)) };
}

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

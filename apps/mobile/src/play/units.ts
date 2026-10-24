// Amounts on screen and aloud, for every table. Plain units (no currency
// symbol); formatting never changes a ledger value.

import { add, compare, decodeMoney, encodeMoney, money, mul, type Wager } from '@tableside/engine';

/**
 * Canonical money text with thousands separators: "1000" → "1,000",
 * "2045/2" → "1,022.5". A fraction shows as its exact decimal; one without a
 * finite decimal (never produced by launch payouts) stays a fraction.
 */
export function formatUnits(amount: string): string {
  const negative = amount.startsWith('-');
  const [numerator = '0', denominator] = (negative ? amount.slice(1) : amount).split('/');
  let whole = numerator;
  let fraction = '';
  if (denominator) {
    const n = BigInt(numerator);
    const d = BigInt(denominator);
    let rest = n % d;
    whole = (n / d).toString();
    // An exact decimal needs a denominator of only 2s and 5s; cap the digits to stay finite.
    for (let digits = 0; rest !== 0n && digits < 12; digits++) {
      rest *= 10n;
      fraction += (rest / d).toString();
      rest %= d;
    }
    if (rest !== 0n) return amount;
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Typed amount text without its thousands separators ("1,000" → "1000"). Only
 * separators in their proper places are dropped: anything else ("1,0,0",
 * "1 000") comes back as typed, so it is explained rather than read as a
 * different amount.
 */
export function withoutGrouping(text: string): string {
  const trimmed = text.trim();
  return /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, '') : trimmed;
}

/** "+120", "−85" (minus sign), "0". */
export function formatSigned(amount: string): string {
  if (amount.startsWith('-')) return `−${formatUnits(amount.slice(1))}`;
  return amount === '0' ? '0' : `+${formatUnits(amount)}`;
}

/** "plus 120", "minus 85", "0": for screen readers, which may skip a sign. */
export function speakSigned(amount: string): string {
  if (amount.startsWith('-')) return `minus ${formatUnits(amount.slice(1))}`;
  return amount === '0' ? '0' : `plus ${formatUnits(amount)}`;
}

/** The exact sum of canonical amounts, fractions included ("2045/2" + "10" is "2065/2"). */
export const sumUnits = (...amounts: readonly string[]): string =>
  encodeMoney(amounts.reduce((sum, amount) => add(sum, decodeMoney(amount)), money(0n)));

/** The exact total a list of bets stakes. */
export const totalStake = (bets: readonly Wager[]): string => sumUnits(...bets.map((bet) => bet.amount));

/** The exact total of the stakes on the table, as canonical money text. */
export const totalOnTable = (view: { readonly wagers: readonly Wager[] }): string => totalStake(view.wagers);

/** Half an amount, exactly: "25" is "25/2" (read as 12.5). */
export const halfUnits = (amount: string): string => encodeMoney(mul(decodeMoney(amount), money(1n, 2n)));

/** Whether a is less than b. */
export const lessUnits = (a: string, b: string): boolean => compare(decodeMoney(a), decodeMoney(b)) < 0;

/** The smaller of two amounts. */
export const smallerUnits = (a: string, b: string): string => (lessUnits(b, a) ? b : a);

/** "Hello" from "hello": a sentence's first letter in capitals. */
export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

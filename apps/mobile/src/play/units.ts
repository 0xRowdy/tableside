// Amounts on screen and aloud, for every table. Plain units (no currency
// symbol); formatting never changes a ledger value.

import { add, decodeMoney, encodeMoney, money, type Wager } from '@tableside/engine';

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

/** The exact total of the stakes on the table, as canonical money text. */
export const totalOnTable = (view: { readonly wagers: readonly Wager[] }): string =>
  encodeMoney(view.wagers.reduce((sum, wager) => add(sum, decodeMoney(wager.amount)), money(0n)));

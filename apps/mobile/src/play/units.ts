import { add, compare, decodeMoney, encodeMoney, money, mul, sub, type Wager } from '@tableside/engine';

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

export function withoutGrouping(text: string): string {
  const trimmed = text.trim();
  return /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, '') : trimmed;
}

export const wholeUnits = (digits: string): string => BigInt(digits).toString();

export const decimalUnits = (whole: string, fraction: string): string =>
  encodeMoney(money(BigInt(whole + fraction), 10n ** BigInt(fraction.length)));

export function formatSigned(amount: string): string {
  if (amount.startsWith('-')) return `−${formatUnits(amount.slice(1))}`;
  return amount === '0' ? '0' : `+${formatUnits(amount)}`;
}

export function speakSigned(amount: string): string {
  if (amount.startsWith('-')) return `minus ${formatUnits(amount.slice(1))}`;
  return amount === '0' ? '0' : `plus ${formatUnits(amount)}`;
}

export const sumUnits = (...amounts: readonly string[]): string =>
  encodeMoney(amounts.reduce((sum, amount) => add(sum, decodeMoney(amount)), money(0n)));

export const differenceUnits = (a: string, b: string): string => encodeMoney(sub(decodeMoney(a), decodeMoney(b)));

export const totalStake = (bets: readonly Wager[]): string => sumUnits(...bets.map((bet) => bet.amount));

export const totalOnTable = (view: { readonly wagers: readonly Wager[] }): string => totalStake(view.wagers);

export const halfUnits = (amount: string): string => encodeMoney(mul(decodeMoney(amount), money(1n, 2n)));

export const lessUnits = (a: string, b: string): boolean => compare(decodeMoney(a), decodeMoney(b)) < 0;

export const smallerUnits = (a: string, b: string): string => (lessUnits(b, a) ? b : a);

export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

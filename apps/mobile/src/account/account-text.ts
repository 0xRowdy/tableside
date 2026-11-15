// Player wording for Settings → Account (S2-17) and the signed-out locked
// state (S2-23): the device, sign-in methods, devices, sync and currency.

import type { SignInMethod } from '@tableside/account';
import { Platform } from 'react-native';

/** What the copy calls this device: "this iPhone", "this iPad", or "this device" on Android. */
export function thisDevice(): string {
  if (Platform.OS !== 'ios') return 'device';
  return Platform.isPad ? 'iPad' : 'iPhone';
}

const METHOD_ORDER: readonly SignInMethod[] = ['apple', 'google', 'email'];
const sorted = (methods: readonly SignInMethod[]) => METHOD_ORDER.filter((method) => methods.includes(method));
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The Sign-in methods row: "Apple, email code". */
export function methodsList(methods: readonly SignInMethod[]): string {
  const words = { apple: 'Apple', google: 'Google', email: 'email code' } as const;
  return capitalized(sorted(methods).map((method) => words[method]).join(', '));
}

/** The Settings row's short form: "Apple and email". */
export function methodsSummary(methods: readonly SignInMethod[]): string {
  const words = sorted(methods).map((method) => ({ apple: 'Apple', google: 'Google', email: 'email' })[method]);
  if (words.length <= 1) return capitalized(words[0] ?? '');
  return capitalized(`${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);
}

export function devicesText(devices: number): string {
  return `${devices} signed in, including this ${thisDevice()}`;
}

export function waitingText(waiting: number): string {
  if (waiting === 0) return 'All synced';
  return waiting === 1 ? '1 record waiting to sync' : `${waiting} records waiting to sync`;
}

/** The sign-out confirmation's first paragraph. */
export function signOutText(waiting: number): string {
  const device = thisDevice();
  if (waiting === 0) return `Your session is saved and paused. Your records stay on this ${device}, locked, until you sign back in to this account.`;
  const records = waiting === 1 ? "1 record hasn't synced yet: it stays" : `${waiting} records haven't synced yet: they stay`;
  return `Your session is saved and paused. ${records} on this ${device}, locked, until you sign back in to this account. If you delete the app first, they're lost.`;
}

/**
 * Currencies the account currency can be set to, with their US English names.
 * Casino records use the account's one real-money currency (spec 2 Amendment 4 §4).
 */
export const CURRENCIES: readonly { readonly code: string; readonly name: string }[] = [
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'GBP', name: 'British pound' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'EUR', name: 'Euro' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'ILS', name: 'Israeli new shekel' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'MOP', name: 'Macanese pataca' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'TWD', name: 'New Taiwan dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'PLN', name: 'Polish zloty' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'USD', name: 'US dollar' },
];

/** "US dollar (USD)"; a code without a name here shows as itself. */
export function currencyText(code: string): string {
  const name = CURRENCIES.find((currency) => currency.code === code)?.name;
  return name ? `${name} (${code})` : code;
}

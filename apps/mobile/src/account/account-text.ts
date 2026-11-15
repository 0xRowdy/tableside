// Player wording for Settings → Account (S2-17), Devices (S2-19) and the
// locked states (S2-23): the device, sign-in methods, devices, sync and currency.

import type { SignInMethod } from '@tableside/account';
import { Platform } from 'react-native';

/** What the copy calls this device, after "this": iPhone, iPad, or device on Android. */
export function deviceName(): string {
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
  return `${devices} signed in, including this ${deviceName()}`;
}

export function waitingText(waiting: number): string {
  if (waiting === 0) return 'All synced';
  return waiting === 1 ? '1 record waiting to sync' : `${waiting} records waiting to sync`;
}

/** The sign-out confirmation's first paragraph. */
export function signOutText(waiting: number): string {
  const device = deviceName();
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

/**
 * How this device describes itself on Devices (S2-19): "iPhone 15 · iOS 18",
 * "iPad Air · iPadOS 18", "Pixel 8 · Android 15". It's what the device says
 * about itself, shown to the account owner only.
 */
export function describeDevice(os: 'ios' | 'android', device: { readonly modelName: string | null; readonly osName: string | null; readonly osVersion: string | null }) {
  const model = device.modelName?.trim() || (os === 'ios' ? 'iPhone' : 'Android device');
  // Android's OS name can be a build fingerprint; the platform names it plainly.
  const system = os === 'ios' ? (device.osName === 'iPadOS' ? 'iPadOS' : 'iOS') : 'Android';
  const major = device.osVersion?.split('.')[0]?.trim();
  return { platform: os, label: `${model} · ${major ? `${system} ${major}` : system}` } as const;
}

/** A device's name in sentences: the model its label begins with ("Pixel 8"), or "Unknown device" for a sign-in that never said. */
export function deviceShortName(label: string | null): string {
  return label?.split(' · ')[0]?.trim() || 'Unknown device';
}

/** "iPad Air", "iPad Air and Pixel 8", "iPad Air, Pixel 8 and Unknown device". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Last active now", "… 5 minutes ago", "… 2 days ago", "… 3 months ago". */
export function lastActiveText(then: number | null, now: number): string {
  if (then === null) return 'Last active: not known';
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  const unit = (count: number, name: string) => `Last active ${count} ${name}${count === 1 ? '' : 's'} ago`;
  if (minutes < 2) return 'Last active now';
  if (minutes < 60) return unit(minutes, 'minute');
  if (minutes < 48 * 60) return unit(Math.floor(minutes / 60), 'hour');
  const days = Math.floor(minutes / (24 * 60));
  if (days < 60) return unit(days, 'day');
  if (days < 730) return unit(Math.floor(days / 30), 'month');
  return unit(Math.floor(days / 365), 'year');
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "17 Oct 2026", in the device's time zone. */
export function dayText(at: number): string {
  const day = new Date(at);
  return `${day.getDate()} ${SHORT_MONTHS[day.getMonth()]} ${day.getFullYear()}`;
}

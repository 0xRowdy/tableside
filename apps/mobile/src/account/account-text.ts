// Spec 2 S2-17, S2-19, S2-23

import type { SignInMethod } from '@tableside/account';
import { Platform } from 'react-native';

export function deviceName(): string {
  if (Platform.OS !== 'ios') return 'device';
  return Platform.isPad ? 'iPad' : 'iPhone';
}

const METHOD_ORDER: readonly SignInMethod[] = ['apple', 'google', 'email'];
const sorted = (methods: readonly SignInMethod[]) => METHOD_ORDER.filter((method) => methods.includes(method));
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function methodsList(methods: readonly SignInMethod[]): string {
  const words = { apple: 'Apple', google: 'Google', email: 'email code' } as const;
  return capitalized(sorted(methods).map((method) => words[method]).join(', '));
}

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

export function signOutText(waiting: number): string {
  const device = deviceName();
  if (waiting === 0) return `Your session is saved and paused. Your records stay on this ${device}, locked, until you sign back in to this account.`;
  const records = waiting === 1 ? "1 record hasn't synced yet: it stays" : `${waiting} records haven't synced yet: they stay`;
  return `Your session is saved and paused. ${records} on this ${device}, locked, until you sign back in to this account. If you delete the app first, they're lost.`;
}

// Spec 2 Amendment 4 §4
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

export function currencyText(code: string): string {
  const name = CURRENCIES.find((currency) => currency.code === code)?.name;
  return name ? `${name} (${code})` : code;
}

export function describeDevice(os: 'ios' | 'android', device: { readonly modelName: string | null; readonly osName: string | null; readonly osVersion: string | null }) {
  const model = device.modelName?.trim() || (os === 'ios' ? 'iPhone' : 'Android device');
  const system = os === 'ios' ? (device.osName === 'iPadOS' ? 'iPadOS' : 'iOS') : 'Android';
  const major = device.osVersion?.split('.')[0]?.trim();
  return { platform: os, label: `${model} · ${major ? `${system} ${major}` : system}` } as const;
}

export function deviceShortName(label: string | null): string {
  return label?.split(' · ')[0]?.trim() || 'Unknown device';
}

export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

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

export { dayText } from '@tableside/account';

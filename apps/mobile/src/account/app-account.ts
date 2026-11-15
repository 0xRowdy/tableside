// The app's account: the Account service (packages/account) on this device's
// network, SecureStore and account vault, plus what the first run records for
// the account. App tests replace this module with fakes (jest.setup.ts).

import { createAccountService, noPlatformAgeSignals, type AccountService, type AccountVault, type CredentialStorage } from '@tableside/account';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import { Linking, Platform } from 'react-native';

import { findGame, type GameId } from '@/games';
import type { PracticeAdapters } from '@/practice/adapters';

import { describeDevice } from './account-text';
import { buildBackend } from './backend';
import { appDevicePorts } from './device-ports';
import { createNativeVault, KEYCHAIN_OPTIONS } from './native-vault';
import { forAccountSession } from './practice';
import type { RestrictedPaths } from './RestrictedPaths';
import { providerSettings } from './provider-ports';
import type { AccountSession } from './vault';
import { WEB_PAGES } from './web-pages';

/**
 * The account's offline game selection. Every account, even one that has
 * Premium, makes it at first run (spec 2 Amendment 3 §4). Spec 5 owns its
 * rules and syncs it; until then it is kept on this device per account.
 */
export interface OfflineGameSelection {
  get(accountId: string): Promise<GameId | null>;
  set(accountId: string, game: GameId): Promise<void>;
}

export interface AppAccount {
  readonly service: AccountService;
  /** The practice adapters for the open account session: its store, account and installation. */
  practice(base: PracticeAdapters): PracticeAdapters;
  readonly offlineGame: OfflineGameSelection;
  /** The restricted gate states' paths (support, privacy request, billing help, export, deletion). */
  readonly restrictedPaths: RestrictedPaths;
}

/** Refresh credentials: device-only secure storage, never in a backup. */
const secureCredentials: CredentialStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS),
};

export function createAppAccount(): AppAccount {
  const backend = buildBackend();
  const vault = createNativeVault(backend.name);
  let session: AccountSession | null = null;
  // The vault port the Account service drives: it keeps the open session for practice.
  const port: AccountVault = {
    async open(accountId) {
      const opening = await vault.open(accountId);
      // A superseded open leaves the newer one's session alone.
      if (opening.status === 'open') session = opening.session;
      else if (opening.status !== 'superseded') session = null;
      return opening;
    },
    async close() {
      session = null;
      await vault.close();
    },
    removeEnvironment: (environment) => vault.removeEnvironment(environment),
  };
  const service = createAccountService({
    backend,
    fetch: (input, init) => fetch(input, init),
    credentials: secureCredentials,
    vault: port,
    clock: () => Date.now(),
    device: appDevicePorts,
    randomBytes: (count) => Crypto.getRandomValues(new Uint8Array(count)),
    localeCurrency: () => getLocales()[0].currencyCode,
    providers: providerSettings(),
    // Apple's Declared Age Range and Google Play's Age Signals need native
    // modules, which aren't built yet: every device uses the fallback question.
    ageSignals: noPlatformAgeSignals,
    // History downloads stop before they would run the device short.
    freeStorage: () => {
      try {
        return Paths.availableDiskSpace;
      } catch {
        return null;
      }
    },
    // What Devices shows for this one: its own model and OS, never proof of which device it is.
    deviceDescription: () => describeDevice(Platform.OS === 'ios' ? 'ios' : 'android', Device),
  });
  const offlineGameKey = (accountId: string) => `tableside.${backend.name}.${accountId}.offline-game`;
  return {
    service,
    practice(base) {
      if (!session) throw new Error('no open account session');
      return forAccountSession(base, session);
    },
    offlineGame: {
      async get(accountId) {
        return findGame(await SecureStore.getItemAsync(offlineGameKey(accountId), KEYCHAIN_OPTIONS))?.id ?? null;
      },
      set: (accountId, game) => SecureStore.setItemAsync(offlineGameKey(accountId), game, KEYCHAIN_OPTIONS),
    },
    restrictedPaths: {
      open(path) {
        // Contact support and Make a privacy request are web pages that work without signing in (Amendment 9 §1).
        if (path === 'contact-support') void Linking.openURL(WEB_PAGES.contactSupport);
        else if (path === 'privacy-request') void Linking.openURL(WEB_PAGES.privacyRequest);
        // Billing help (spec 5), export and deletion (spec 2's own tickets) open nothing until their screens land.
      },
    },
  };
}

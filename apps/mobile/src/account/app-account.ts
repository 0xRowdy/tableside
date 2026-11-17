import { createAccountService, noPlatformAgeSignals, type AccountService, type AccountVault, type CredentialStorage } from '@tableside/account';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Paths } from 'expo-file-system';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { findGame, type GameId } from '@/games';
import type { PracticeAdapters } from '@/practice/adapters';
import type { TrainingAdapters } from '@/training/adapters';

import { describeDevice } from './account-text';
import { deviceExportFiles, type ExportFiles } from './export-files';
import { buildBackend } from './backend';
import { appDevicePorts } from './device-ports';
import { createNativeVault, KEYCHAIN_OPTIONS } from './native-vault';
import { forAccountSession } from './practice';
import { attemptDetailFrom } from './training';
import type { RestrictedPaths } from './RestrictedPaths';
import { providerSettings } from './provider-ports';
import type { AccountSession } from './vault';
import { WEB_PAGES } from './web-pages';

// Spec 2 Amendment 3 §4
export interface OfflineGameSelection {
  get(accountId: string): Promise<GameId | null>;
  set(accountId: string, game: GameId): Promise<void>;
}

export interface AppAccount {
  readonly service: AccountService;
  practice(base: PracticeAdapters): PracticeAdapters;
  training(base: TrainingAdapters): TrainingAdapters;
  readonly offlineGame: OfflineGameSelection;
  readonly restrictedPaths: RestrictedPaths;
  readonly exportFiles: ExportFiles;
}

const secureCredentials: CredentialStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS),
};

export function createAppAccount(): AppAccount {
  const backend = buildBackend();
  const vault = createNativeVault(backend.name);
  let session: AccountSession | null = null;
  const port: AccountVault = {
    async open(accountId) {
      const opening = await vault.open(accountId);
      if (opening.status === 'open') session = opening.session;
      else if (opening.status !== 'superseded') session = null;
      return opening;
    },
    async close() {
      session = null;
      await vault.close();
    },
    async erase(accountId) {
      if (session?.accountId === accountId) session = null;
      await vault.erase(accountId);
    },
    removeEnvironment: (environment) => vault.removeEnvironment(environment),
    async recover(accountId) {
      if (session?.accountId === accountId) session = null;
      await vault.recover(accountId);
    },
  };
  const offlineGameKey = (accountId: string) => `tableside.${backend.name}.${accountId}.offline-game`;
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
    // TODO(#129)
    ageSignals: noPlatformAgeSignals,
    freeStorage: () => {
      try {
        return Paths.availableDiskSpace;
      } catch {
        return null;
      }
    },
    deviceDescription: () => describeDevice(Platform.OS === 'ios' ? 'ios' : 'android', Device),
    async eraseAppData(accountId) {
      await deviceExportFiles.clear(accountId);
      await SecureStore.deleteItemAsync(offlineGameKey(accountId), KEYCHAIN_OPTIONS);
    },
  });
  return {
    service,
    practice(base) {
      if (!session) throw new Error('no open account session');
      return forAccountSession(base, session);
    },
    training(base) {
      if (!session) throw new Error('no open account session');
      return { ...forAccountSession(base, session), attemptDetail: attemptDetailFrom(service.records) };
    },
    offlineGame: {
      async get(accountId) {
        return findGame(await SecureStore.getItemAsync(offlineGameKey(accountId), KEYCHAIN_OPTIONS))?.id ?? null;
      },
      set: (accountId, game) => SecureStore.setItemAsync(offlineGameKey(accountId), game, KEYCHAIN_OPTIONS),
    },
    restrictedPaths: {
      open(path) {
        // Spec 2 Amendment 9 §1
        if (path === 'contact-support') void Linking.openURL(WEB_PAGES.contactSupport);
        else if (path === 'privacy-request') void Linking.openURL(WEB_PAGES.privacyRequest);
        // Spec 2 S2-21
        else if (path === 'export') router.navigate('/export');
        // Spec 2 S2-22
        else if (path === 'delete-account') router.navigate('/delete-account');
        else if (path === 'billing-help') router.navigate('/billing-help');
      },
    },
    exportFiles: deviceExportFiles,
  };
}

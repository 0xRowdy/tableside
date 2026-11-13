// The app's account: the Account service (packages/account) on this device's
// network, SecureStore and account vault, plus what the first run records for
// the account. App tests replace this module with fakes (jest.setup.ts).

import { createAccountService, type AccountService, type AccountVault, type CredentialStorage } from '@tableside/account';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import type { GameId } from '@/games';
import type { PracticeAdapters } from '@/practice/adapters';

import { createNativeVault, KEYCHAIN_OPTIONS } from './native-vault';
import { forAccountSession } from './practice';
import type { AccountSession } from './vault';

/**
 * Which game the account practices offline. Every account, premium included,
 * picks one at first run (spec 2 Amendment 3 §4). Spec 5 owns the choice's
 * rules and syncs it; until then it is kept on this device per account.
 */
export interface OfflineGameChoice {
  get(accountId: string): Promise<GameId | null>;
  set(accountId: string, game: GameId): Promise<void>;
}

export interface AppAccount {
  readonly service: AccountService;
  /** The practice adapters for the open account session: its store, account and installation. */
  practice(base: PracticeAdapters): PracticeAdapters;
  readonly offlineGame: OfflineGameChoice;
}

/** The backend this build talks to; local development by default. Environment isolation (#87) replaces this. */
const backend = {
  environment: 'development',
  url: (Constants.expoConfig?.extra?.backendUrl as string | undefined) ?? 'http://127.0.0.1:54321',
  publishableKey: (Constants.expoConfig?.extra?.publishableKey as string | undefined) ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
};

/** Refresh credentials: device-only secure storage, never in a backup. */
const secureCredentials: CredentialStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS),
};

const offlineGameKey = (accountId: string) => `tableside.${backend.environment}.${accountId}.offline-game`;
const GAME_IDS: readonly string[] = ['blackjack', 'craps', 'roulette'] satisfies GameId[];

export function createAppAccount(): AppAccount {
  const vault = createNativeVault(backend.environment);
  let session: AccountSession | null = null;
  // The vault port the Account service drives: it keeps the open session for practice.
  const port: AccountVault = {
    async open(accountId) {
      const opening = await vault.open(accountId);
      if (opening.status === 'open') session = opening.session;
      return { status: opening.status };
    },
    async close() {
      session = null;
      await vault.close();
    },
  };
  const service = createAccountService({
    backend: { url: backend.url, publishableKey: backend.publishableKey },
    fetch: (input, init) => fetch(input, init),
    credentials: secureCredentials,
    vault: port,
    clock: () => Date.now(),
  });
  return {
    service,
    practice(base) {
      if (!session) throw new Error('no open account session');
      return forAccountSession(base, session);
    },
    offlineGame: {
      async get(accountId) {
        const value = await SecureStore.getItemAsync(offlineGameKey(accountId), KEYCHAIN_OPTIONS);
        return value !== null && GAME_IDS.includes(value) ? (value as GameId) : null;
      },
      set: (accountId, game) => SecureStore.setItemAsync(offlineGameKey(accountId), game, KEYCHAIN_OPTIONS),
    },
  };
}

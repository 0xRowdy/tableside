// docs/decisions/local-persistence-account-synchronization.md Storage and ownership
// docs/account-service.md Credentials and the account vault

import type { EnvironmentName } from '@tableside/account/environment';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { AppState } from 'react-native';

import { excludeFromBackup } from '../../modules/backup-exclusion';
import { classifySqlError, isDatabaseKey, openVerifiedConnection, SqlError, type RawSqlConnection, type SqlDriver } from './sql';
import { AccountVault, type VaultFiles, type VaultKeyStore } from './vault';

export const VAULT_DIRECTORY = 'tableside-vault';

export const LOCKED_RETRY_MS = 30_000;

export function createNativeVault(environment: EnvironmentName): AccountVault {
  return new AccountVault({
    environment,
    keys: secureStoreKeys,
    files: appFiles(),
    driver: expoSqlCipherDriver,
    randomBytes: (length) => Crypto.getRandomValues(new Uint8Array(length)),
    newId: () => Crypto.randomUUID(),
    unlocked: () =>
      new Promise((resolve) => {
        const done = () => {
          clearTimeout(timer);
          subscription.remove();
          resolve();
        };
        const timer = setTimeout(done, LOCKED_RETRY_MS);
        const subscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') done();
        });
      }),
  });
}

export const expoSqlCipherDriver: SqlDriver = {
  async open(path, keyHex) {
    if (!isDatabaseKey(keyHex)) throw new SqlError('other', 'the key must be 64 hex digits');
    const slash = path.lastIndexOf('/');
    let db: SQLite.SQLiteDatabase;
    try {
      db = await SQLite.openDatabaseAsync(path.slice(slash + 1), { useNewConnection: true }, path.slice(0, slash));
    } catch (error) {
      throw classifySqlError(error);
    }
    const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version').catch(() => null);
    if (!cipher?.cipher_version) {
      await db.closeAsync().catch(() => undefined);
      throw new SqlError('cipher-missing', 'this build has no SQLCipher');
    }
    try {
      await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    } catch (error) {
      await db.closeAsync().catch(() => undefined);
      throw classifySqlError(error);
    }
    return openVerifiedConnection(expoRaw(db));
  },
};

function expoRaw(db: SQLite.SQLiteDatabase): RawSqlConnection {
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => (await db.runAsync(sql, [...params])).changes,
    get: (sql, params = []) => db.getFirstAsync(sql, [...params]),
    all: (sql, params = []) => db.getAllAsync(sql, [...params]),
    close: () => db.closeAsync(),
  };
}

export const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const isKeychainLocked = (error: unknown): boolean => /-25308|interaction is not allowed|device is locked/i.test(error instanceof Error ? error.message : String(error));

export const secureStoreKeys: VaultKeyStore = {
  async read(name) {
    try {
      const value = await SecureStore.getItemAsync(name, KEYCHAIN_OPTIONS);
      return value === null ? { status: 'missing' } : { status: 'found', value };
    } catch (error) {
      if (isKeychainLocked(error)) return { status: 'locked' };
      throw error;
    }
  },
  async write(name, value) {
    try {
      await SecureStore.setItemAsync(name, value, KEYCHAIN_OPTIONS);
      return 'written';
    } catch (error) {
      if (isKeychainLocked(error)) return 'locked';
      throw error;
    }
  },
  async remove(name) {
    try {
      await SecureStore.deleteItemAsync(name, KEYCHAIN_OPTIONS);
      return 'removed';
    } catch (error) {
      if (isKeychainLocked(error)) return 'locked';
      throw error;
    }
  },
};

function appFiles(): VaultFiles {
  const root = new Directory(Paths.document, VAULT_DIRECTORY).uri.replace(/\/+$/, '');
  return {
    root,
    async ensureDirectory(path) {
      const directory = new Directory(path);
      directory.create({ idempotent: true, intermediates: true });
      await excludeFromBackup(directory.uri);
    },
    async list(path) {
      const directory = new Directory(path);
      return directory.exists ? directory.list().map((entry) => entry.name) : [];
    },
    async size(path) {
      const file = new File(path);
      return file.exists ? file.size : null;
    },
    async readText(path) {
      const file = new File(path);
      return file.exists ? file.text() : null;
    },
    async writeText(path, text) {
      new File(path).write(text);
    },
    // Spec 2 launch gate 2
    async copy(from, to) {
      const target = new File(to);
      if (target.exists) target.delete();
      new File(from).copy(target);
    },
    async move(from, to) {
      new File(from).move(new File(to));
    },
    async remove(path) {
      const directory = new Directory(path);
      if (directory.exists) directory.delete();
      else {
        const file = new File(path);
        if (file.exists) file.delete();
      }
    },
  };
}

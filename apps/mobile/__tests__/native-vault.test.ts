// The vault's native adapters at their platform boundary: what they ask of
// SecureStore and Expo SQLite, and the Android backup rules. Native behavior
// itself (the keychain, SQLCipher, iCloud and Auto Backup) is qualified on
// devices (spec 2, launch gate 1).

import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { expoSqlCipherDriver, secureStoreKeys, VAULT_DIRECTORY } from '@/account/native-vault';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn() }));

const secure = SecureStore as jest.Mocked<typeof SecureStore>;
const sqlite = SQLite as jest.Mocked<typeof SQLite>;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the config plugin is CommonJS, as Expo loads it.
const backupRules = require('../plugins/with-backup-exclusion') as { VAULT_DIRECTORY: string; FULL_BACKUP_CONTENT: string; DATA_EXTRACTION_RULES: string };

describe('key material in SecureStore', () => {
  beforeEach(() => jest.resetAllMocks());

  it('reads and writes keys as device-only entries, readable only while unlocked', async () => {
    secure.getItemAsync.mockResolvedValue('value');

    expect(await secureStoreKeys.read('tableside.production.key')).toEqual({ status: 'found', value: 'value' });
    expect(await secureStoreKeys.write('tableside.production.key', 'value')).toBe('written');

    expect(secure.getItemAsync).toHaveBeenCalledWith('tableside.production.key', { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    expect(secure.setItemAsync).toHaveBeenCalledWith('tableside.production.key', 'value', { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });

  it('reports a locked device as locked, a missing entry as missing, and any other failure as itself', async () => {
    const locked = new Error("Calling the 'getValueWithKeyAsync' function has failed → Caused by: The operation couldn’t be completed. (OSStatus error -25308.)");
    secure.getItemAsync.mockRejectedValueOnce(locked).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('keystore failure'));
    secure.setItemAsync.mockRejectedValueOnce(locked);

    expect(await secureStoreKeys.read('k')).toEqual({ status: 'locked' });
    expect(await secureStoreKeys.read('k')).toEqual({ status: 'missing' });
    await expect(secureStoreKeys.read('k')).rejects.toThrow('keystore failure');
    expect(await secureStoreKeys.write('k', 'v')).toBe('locked');
  });
});

describe('the Expo SQLCipher driver', () => {
  beforeEach(() => jest.resetAllMocks());

  function database(cipher: string | null) {
    const statements: string[] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        statements.push(sql);
        if (sql === 'PRAGMA cipher_version') return cipher === null ? null : { cipher_version: cipher };
        if (sql.startsWith('PRAGMA journal_mode')) return { journal_mode: 'wal' };
        if (sql === 'PRAGMA synchronous') return { synchronous: 2 };
        return { count: 0 };
      }),
      execAsync: jest.fn(async (sql: string) => void statements.push(sql)),
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      closeAsync: jest.fn(async () => undefined),
    };
    sqlite.openDatabaseAsync.mockResolvedValue(db as unknown as SQLite.SQLiteDatabase);
    return { db, statements };
  }

  it('opens its own connection in the vault directory, keys it first, then sets and verifies WAL and synchronous=FULL', async () => {
    const { statements } = database('4.6.1 community');

    await expoSqlCipherDriver.open('file:///data/tableside-vault/production/installation-1/account-a.db', 'ab'.repeat(32));

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledWith('account-a.db', { useNewConnection: true }, 'file:///data/tableside-vault/production/installation-1');
    expect(statements).toEqual([
      'PRAGMA cipher_version',
      `PRAGMA key = "x'${'ab'.repeat(32)}'"`,
      'SELECT count(*) AS count FROM sqlite_master',
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = FULL',
      'PRAGMA synchronous',
    ]);
  });

  it('refuses to open a database in a build without SQLCipher, where the key would silently do nothing', async () => {
    const { db, statements } = database(null);

    await expect(expoSqlCipherDriver.open('file:///data/account-a.db', 'ab'.repeat(32))).rejects.toMatchObject({ kind: 'cipher-missing' });

    expect(statements).toEqual(['PRAGMA cipher_version']);
    expect(db.closeAsync).toHaveBeenCalled();
  });
});

describe('Android backup rules', () => {
  it('exclude the vault directory and SecureStore from Auto Backup, cloud backup and device transfer', () => {
    const excludes = ['<exclude domain="file" path="tableside-vault"/>', '<exclude domain="sharedpref" path="SecureStore"/>'];
    const section = (xml: string, tag: string) => xml.slice(xml.indexOf(`<${tag}>`), xml.indexOf(`</${tag}>`));

    expect(backupRules.VAULT_DIRECTORY).toBe(VAULT_DIRECTORY);
    for (const xml of [backupRules.FULL_BACKUP_CONTENT, section(backupRules.DATA_EXTRACTION_RULES, 'cloud-backup'), section(backupRules.DATA_EXTRACTION_RULES, 'device-transfer')]) {
      for (const exclude of excludes) expect(xml).toContain(exclude);
      // Nothing is included explicitly, so no rule re-admits the vault.
      expect(xml).not.toContain('<include');
    }
  });
});

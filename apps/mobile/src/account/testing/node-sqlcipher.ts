// The Node SQL driver for tests and CI: real SQLCipher (SQLCipher 4 format)
// through better-sqlite3-multiple-ciphers, behind the same verified connection
// the app's Expo SQLite driver uses. It never replaces native evidence (spec 2,
// Testing Decisions). Tests only: the app bundle never imports it.

import Database from 'better-sqlite3-multiple-ciphers';

import { classifySqlError, openVerifiedConnection, SqlError, type RawSqlConnection, type SqlDriver, type SqlValue } from '../sql';

export interface NodeSqlCipherOptions {
  /**
   * Fault injection at the driver boundary: while it returns a fault, every
   * write statement fails with the error SQLite raises for it (a full disk, or
   * an I/O error), so its transaction rolls back. Reads still work.
   */
  readonly fault?: () => 'full' | 'io' | undefined;
}

const FAULTS = {
  full: { code: 'SQLITE_FULL', message: 'database or disk is full' },
  io: { code: 'SQLITE_IOERR', message: 'disk I/O error' },
} as const;

export function nodeSqlCipherDriver(options: NodeSqlCipherOptions = {}): SqlDriver {
  return {
    async open(path, keyHex) {
      if (!/^[0-9a-f]{64}$/.test(keyHex)) throw new SqlError('other', 'the key must be 64 hex digits');
      let db: Database.Database;
      try {
        db = new Database(path);
        db.pragma(`cipher = 'sqlcipher'`);
        db.pragma('legacy = 4');
        db.pragma(`key = "x'${keyHex}'"`);
      } catch (error) {
        throw classifySqlError(error);
      }
      return openVerifiedConnection(rawConnection(db, options));
    },
  };
}

function rawConnection(db: Database.Database, options: NodeSqlCipherOptions): RawSqlConnection {
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      const fault = options.fault?.();
      if (fault) throw Object.assign(new Error(FAULTS[fault].message), { code: FAULTS[fault].code });
      return db.prepare(sql).run(...(params as SqlValue[])).changes;
    },
    get: async <T>(sql: string, params: readonly SqlValue[] = []) => (db.prepare(sql).get(...(params as SqlValue[])) as T | undefined) ?? null,
    all: async <T>(sql: string, params: readonly SqlValue[] = []) => db.prepare(sql).all(...(params as SqlValue[])) as T[],
    close: async () => {
      db.close();
    },
  };
}

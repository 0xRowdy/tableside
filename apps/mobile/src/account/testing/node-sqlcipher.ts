// Spec 2 Testing Decisions

import Database from 'better-sqlite3-multiple-ciphers';

import { classifySqlError, isDatabaseKey, openVerifiedConnection, SqlError, type RawSqlConnection, type SqlDriver, type SqlValue } from '../sql';

export interface NodeSqlCipherOptions {
  readonly fault?: () => 'full' | 'io' | undefined;
}

const FAULTS = {
  full: { code: 'SQLITE_FULL', message: 'database or disk is full' },
  io: { code: 'SQLITE_IOERR', message: 'disk I/O error' },
} as const;

export function nodeSqlCipherDriver(options: NodeSqlCipherOptions = {}): SqlDriver {
  return {
    async open(path, keyHex) {
      if (!isDatabaseKey(keyHex)) throw new SqlError('other', 'the key must be 64 hex digits');
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

// The SQL driver port the account store runs on. Expo SQLite with SQLCipher
// implements it in the app (native-vault.ts); a Node SQLCipher driver
// implements it in tests (testing/node-sqlcipher.ts). Both hand a raw
// connection to `openVerifiedConnection`, which owns what the spec requires of
// every writing connection: WAL with synchronous=FULL, set and verified, and one
// serialized writer whose in-transition statements all run on the transaction.

/** Statement parameters: text, integers and null. There are no floating-point columns. */
export type SqlValue = string | number | null;

export interface SqlExecutor {
  /** Runs a statement and returns how many rows it changed. */
  run(sql: string, params?: readonly SqlValue[]): Promise<number>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

/** A driver's connection before verification. `exec` runs SQL with no parameters (pragmas, schema). */
export interface RawSqlConnection extends SqlExecutor {
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** A keyed connection that was verified durable: the only way the store reaches a database. */
export interface SqlConnection {
  /**
   * Runs `work` as one exclusive transaction (BEGIN IMMEDIATE), after every
   * earlier transaction on this connection settled: commits when it resolves,
   * rolls back when it rejects. Every statement must go through `tx`.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  /** Closes after the transactions already queued. */
  close(): Promise<void>;
}

/** A database key: 32 random bytes as 64 lowercase hex digits. */
export const isDatabaseKey = (keyHex: string): boolean => /^[0-9a-f]{64}$/.test(keyHex);

export interface SqlDriver {
  /**
   * Opens the database file at `path` (creating it when absent) keyed with
   * `keyHex` (64 hex digits), and verifies it is durable. Rejects with an
   * SqlError: "unreadable" for a wrong key or a damaged file, and never opens
   * an unencrypted database (a build without SQLCipher).
   */
  open(path: string, keyHex: string): Promise<SqlConnection>;
}

/**
 * full: the disk or database is full. unreadable: wrong key, not a database,
 * or corrupt. busy: another connection holds the lock. io: a read or write
 * failed. cipher-missing: the build has no SQLCipher. not-durable: WAL or
 * synchronous=FULL could not be set.
 */
export type SqlErrorKind = 'full' | 'unreadable' | 'busy' | 'io' | 'cipher-missing' | 'not-durable' | 'other';

export class SqlError extends Error {
  constructor(
    readonly kind: SqlErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SqlError';
  }
}

/** Maps a driver's error (an SQLite result code, or the native message carrying one) to its kind. */
export function classifySqlError(error: unknown): SqlError {
  if (error instanceof SqlError) return error;
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
  const message = error instanceof Error ? error.message : String(error);
  const text = `${code} ${message}`;
  const kind: SqlErrorKind = /SQLITE_FULL|disk is full|database or disk is full/i.test(text)
    ? 'full'
    : /SQLITE_NOTADB|SQLITE_CORRUPT|not a database|malformed/i.test(text)
      ? 'unreadable'
      : /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(text)
        ? 'busy'
        : /SQLITE_IOERR|SQLITE_CANTOPEN|disk I\/O error|unable to open/i.test(text)
          ? 'io'
          : 'other';
  return new SqlError(kind, message);
}

/** synchronous=FULL as `PRAGMA synchronous` reads it back. */
const SYNCHRONOUS_FULL = 2;

/**
 * Verifies a keyed raw connection and wraps it as the database's one writer.
 * The key must already be applied: the first read here is what fails for a
 * wrong key or a damaged file.
 */
export async function openVerifiedConnection(raw: RawSqlConnection): Promise<SqlConnection> {
  try {
    await raw.get('SELECT count(*) AS count FROM sqlite_master');
    const journal = await raw.get<{ journal_mode: string }>('PRAGMA journal_mode = WAL');
    await raw.exec('PRAGMA synchronous = FULL');
    const synchronous = await raw.get<{ synchronous: number }>('PRAGMA synchronous');
    if (journal?.journal_mode?.toLowerCase() !== 'wal' || synchronous?.synchronous !== SYNCHRONOUS_FULL) {
      throw new SqlError('not-durable', `the connection is not durable (journal ${journal?.journal_mode}, synchronous ${synchronous?.synchronous})`);
    }
  } catch (error) {
    await raw.close().catch(() => undefined);
    throw classifySqlError(error);
  }
  return new SerializedConnection(raw);
}

class SerializedConnection implements SqlConnection {
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(private readonly raw: RawSqlConnection) {}

  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      if (this.closed) throw new SqlError('other', 'the connection is closed');
      let open = true;
      // The transaction object: usable only while its transaction runs.
      const guard = <R>(run: () => Promise<R>): Promise<R> => {
        if (!open) return Promise.reject(new SqlError('other', 'statement after its transaction ended'));
        return run().catch((error: unknown) => Promise.reject(classifySqlError(error)));
      };
      const tx: SqlExecutor = {
        run: (sql, params) => guard(() => this.raw.run(sql, params)),
        get: <R>(sql: string, params?: readonly SqlValue[]) => guard(() => this.raw.get<R>(sql, params)),
        all: <R>(sql: string, params?: readonly SqlValue[]) => guard(() => this.raw.all<R>(sql, params)),
      };
      try {
        await this.raw.exec('BEGIN IMMEDIATE');
      } catch (error) {
        open = false;
        throw classifySqlError(error);
      }
      let result: T;
      try {
        // Statement errors arrive classified (guard); the store's own errors pass through.
        result = await work(tx);
      } catch (error) {
        await this.raw.exec('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        open = false;
      }
      try {
        await this.raw.exec('COMMIT');
      } catch (error) {
        await this.raw.exec('ROLLBACK').catch(() => undefined);
        throw classifySqlError(error);
      }
      return result;
    });
  }

  close(): Promise<void> {
    return this.enqueue(async () => {
      if (this.closed) return;
      this.closed = true;
      await this.raw.close();
    });
  }

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

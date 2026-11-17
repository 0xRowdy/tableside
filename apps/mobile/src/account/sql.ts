// docs/decisions/local-persistence-account-synchronization.md Storage and ownership

export type SqlValue = string | number | null;

export interface SqlExecutor {
  run(sql: string, params?: readonly SqlValue[]): Promise<number>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
}

export interface RawSqlConnection extends SqlExecutor {
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export interface SqlConnection {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  checkpoint(): Promise<void>;
  close(): Promise<void>;
}

export const isDatabaseKey = (keyHex: string): boolean => /^[0-9a-f]{64}$/.test(keyHex);

export interface SqlDriver {
  open(path: string, keyHex: string): Promise<SqlConnection>;
}

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

const SYNCHRONOUS_FULL = 2;

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

  checkpoint(): Promise<void> {
    return this.enqueue(async () => {
      if (this.closed) throw new SqlError('other', 'the connection is closed');
      let result: { busy: number; log: number; checkpointed: number } | null;
      try {
        result = await this.raw.get('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch (error) {
        throw classifySqlError(error);
      }
      if (result?.busy !== 0) throw new SqlError('busy', 'the write-ahead log could not be checkpointed');
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

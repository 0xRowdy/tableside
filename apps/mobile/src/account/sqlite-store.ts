// The SQLite account store: spec 1's durable activity store port over one
// account's encrypted database (spec 2, *Local storage*). The account vault
// opens it; the practice controller is its only caller.
//
// - Every operation is one exclusive transaction on the database's one
//   serialized writer (sql.ts), so a resolved promise means committed.
// - Values are stored as spec 1's canonical JSON text, with a format version,
//   UTF-8 length and SHA-256 that every read checks. Tables are STRICT and hold
//   only TEXT and INTEGER columns: money stays exact canonical text and nothing
//   is ever a floating-point column.
// - The store belongs to one (environment, account, installation): the account
//   ID is the activity owner and the installation ID its originating device, and
//   it refuses activities and results for anyone else.
// - Pinned definitions (rule content, strategy revision) travel inside the
//   activity's specification, so they live exactly as long as the activity row.
// - Schema changes are the migration runner's (#86): this store opens only the
//   schema it creates and refuses any other (UnsupportedSchemaError).

import { canonicalJson, sha256Hex } from '@tableside/engine';

import type {
  ActivityStore,
  AllowanceEffect,
  CommitOutcome,
  CommittedTransition,
  CompletedPracticeSession,
  IncompleteReason,
  NewActivity,
  OutgoingSyncRecord,
  StoredActivity,
  TransitionCommit,
} from '../practice/store';
import type { SqlConnection, SqlExecutor } from './sql';

/** Whose database this is. */
export interface StoreIdentity {
  readonly environment: string;
  readonly accountId: string;
  readonly installationId: string;
}

export interface StoreOptions {
  /**
   * Whether the account session that opened the store is still the current
   * one. Checked inside every transaction: a stale session reads and writes nothing.
   */
  readonly isCurrent?: () => boolean;
}

export const STORE_SCHEMA_VERSION = 1;
const BODY_FORMAT = 1;

export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

/** A stored value failed its version, length or hash check: the bytes aren't what was written. */
export class StoreIntegrityError extends StoreError {
  constructor(message: string) {
    super(message);
    this.name = 'StoreIntegrityError';
  }
}

/** The account session that opened the store has ended (sign-out, sign-in or account switch). */
export class StaleSessionError extends StoreError {
  constructor() {
    super('the account session that opened this store has ended');
    this.name = 'StaleSessionError';
  }
}

/** The database, activity or result belongs to another environment, account or installation. */
export class StoreMismatchError extends StoreError {
  constructor(message: string) {
    super(message);
    this.name = 'StoreMismatchError';
  }
}

/**
 * The database has a schema version this build doesn't open: an older one
 * awaits the migration runner (#86), a newer one is a rollback. Either way the
 * data is left as it is; it is not Recovery needed.
 */
export class UnsupportedSchemaError extends StoreError {
  constructor(readonly version: string) {
    super(`the database has schema version ${version}; this build opens version ${STORE_SCHEMA_VERSION}`);
    this.name = 'UnsupportedSchemaError';
  }
}

const SCHEMA = [
  'CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
  `CREATE TABLE activities (
    activity_id TEXT PRIMARY KEY,
    position INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('unfinished', 'completed', 'incomplete')),
    sequence INTEGER NOT NULL,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL
  ) STRICT`,
  'CREATE INDEX activities_unfinished ON activities (status, position)',
  `CREATE TABLE transitions (
    activity_id TEXT NOT NULL REFERENCES activities (activity_id),
    command_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    PRIMARY KEY (activity_id, command_id),
    UNIQUE (activity_id, sequence)
  ) STRICT`,
  `CREATE TABLE effects (
    activity_id TEXT NOT NULL REFERENCES activities (activity_id),
    effect_key TEXT NOT NULL,
    position INTEGER NOT NULL,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    PRIMARY KEY (activity_id, effect_key)
  ) STRICT`,
  // One outgoing synchronization record per completion: the activity id is unique.
  `CREATE TABLE outgoing (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL UNIQUE REFERENCES activities (activity_id),
    position INTEGER NOT NULL UNIQUE,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL
  ) STRICT`,
];

interface BodyRow {
  readonly body: string;
  readonly body_format: number;
  readonly body_length: number;
  readonly body_sha256: string;
}

export class SqliteActivityStore implements ActivityStore {
  private constructor(
    private readonly connection: SqlConnection,
    readonly identity: StoreIdentity,
    private readonly isCurrent: () => boolean,
  ) {}

  /**
   * Opens the store on a verified connection: creates the schema in an empty
   * database, or checks an existing one belongs to `identity` and has this
   * build's schema. Closes the connection when it refuses.
   */
  static async open(connection: SqlConnection, identity: StoreIdentity, options: StoreOptions = {}): Promise<SqliteActivityStore> {
    const meta: Record<string, string> = {
      schema_version: String(STORE_SCHEMA_VERSION),
      environment: identity.environment,
      account_id: identity.accountId,
      installation_id: identity.installationId,
    };
    try {
      await connection.transaction(async (tx) => {
        const tables = await tx.get<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'");
        if (tables?.count === 0) {
          for (const statement of SCHEMA) await tx.run(statement);
          for (const [name, value] of Object.entries(meta)) await tx.run('INSERT INTO meta (name, value) VALUES (?, ?)', [name, value]);
          return;
        }
        const rows = await tx.all<{ name: string; value: string }>('SELECT name, value FROM meta').catch(() => []);
        const stored = Object.fromEntries(rows.map((row) => [row.name, row.value]));
        if (stored.schema_version !== meta.schema_version) throw new UnsupportedSchemaError(stored.schema_version ?? 'missing');
        for (const [name, value] of Object.entries(meta)) {
          if (stored[name] !== value) throw new StoreMismatchError(`the database's ${name} is ${stored[name] ?? 'missing'}, not ${value}`);
        }
      });
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
    return new SqliteActivityStore(connection, identity, options.isCurrent ?? (() => true));
  }

  /** Closes the database after the operations already queued. */
  close(): Promise<void> {
    return this.connection.close();
  }

  createActivity(activity: NewActivity): Promise<StoredActivity> {
    return this.transaction(async (tx) => {
      const { owner, device } = activity.specification;
      if (owner !== this.identity.accountId || device !== this.identity.installationId) {
        throw new StoreMismatchError(`activity ${activity.activityId} belongs to another account or installation`);
      }
      const existing = await readActivity(tx, activity.activityId);
      if (existing) return existing;
      const stored: StoredActivity = { ...activity, sequence: 0, completion: null, incomplete: null };
      await tx.run(
        `INSERT INTO activities (activity_id, position, status, sequence, body, body_format, body_length, body_sha256)
         VALUES (?, (SELECT coalesce(max(position), 0) + 1 FROM activities), ?, 0, ?, ?, ?, ?)`,
        [activity.activityId, statusOf(stored), ...encode(stored)],
      );
      return decodeText<StoredActivity>(encode(stored)[0]);
    });
  }

  load(activityId: string): Promise<StoredActivity | null> {
    return this.transaction((tx) => readActivity(tx, activityId));
  }

  findUnfinished(): Promise<StoredActivity | null> {
    return this.transaction(async (tx) => {
      const row = await tx.get<BodyRow>(
        `SELECT body, body_format, body_length, body_sha256 FROM activities WHERE status = 'unfinished' ORDER BY position LIMIT 1`,
      );
      return row ? decode<StoredActivity>(row) : null;
    });
  }

  commitTransition(commit: TransitionCommit): Promise<CommitOutcome> {
    return this.transaction(async (tx): Promise<CommitOutcome> => {
      const activity = await requireActivity(tx, commit.activityId);
      const earlier = await readTransition(tx, commit.activityId, commit.receipt.commandId);
      if (earlier) return { status: 'already-committed', transition: earlier };
      if (activity.sequence !== commit.priorSequence) return { status: 'sequence-conflict', sequence: activity.sequence };
      await addEffects(tx, commit.activityId, commit.effects);
      const transition: CommittedTransition = { receipt: commit.receipt, checkpoint: commit.checkpoint, facts: commit.facts };
      await tx.run(
        `INSERT INTO transitions (activity_id, command_id, sequence, body, body_format, body_length, body_sha256) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [commit.activityId, commit.receipt.commandId, commit.priorSequence, ...encode(transition)],
      );
      await writeActivity(tx, { ...activity, checkpoint: commit.checkpoint, sequence: commit.priorSequence + 1 });
      return { status: 'committed' };
    });
  }

  recordEffects(activityId: string, effects: readonly AllowanceEffect[]): Promise<void> {
    return this.transaction(async (tx) => {
      await requireActivity(tx, activityId);
      await addEffects(tx, activityId, effects);
    });
  }

  readEffects(activityId: string): Promise<readonly AllowanceEffect[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>('SELECT body, body_format, body_length, body_sha256 FROM effects WHERE activity_id = ? ORDER BY position', [activityId])).map((row) =>
        decode<AllowanceEffect>(row),
      ),
    );
  }

  readTransitions(activityId: string): Promise<readonly CommittedTransition[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>('SELECT body, body_format, body_length, body_sha256 FROM transitions WHERE activity_id = ? ORDER BY sequence', [activityId])).map((row) =>
        decode<CommittedTransition>(row),
      ),
    );
  }

  readReceipt(activityId: string, commandId: string): Promise<CommittedTransition | null> {
    return this.transaction((tx) => readTransition(tx, activityId, commandId));
  }

  complete(record: CompletedPracticeSession): Promise<CompletedPracticeSession> {
    return this.transaction(async (tx) => {
      if (record.owner !== this.identity.accountId || record.device !== this.identity.installationId) {
        throw new StoreMismatchError(`the result of ${record.activityId} belongs to another account or installation`);
      }
      const activity = await requireActivity(tx, record.activityId);
      if (activity.completion) return activity.completion;
      await writeActivity(tx, { ...activity, completion: record });
      const sync: OutgoingSyncRecord = { id: `completed/${record.activityId}`, kind: 'completed-practice-session', record };
      await tx.run(
        `INSERT INTO outgoing (id, activity_id, position, body, body_format, body_length, body_sha256)
         VALUES (?, ?, (SELECT coalesce(max(position), 0) + 1 FROM outgoing), ?, ?, ?, ?)`,
        [sync.id, record.activityId, ...encode(sync)],
      );
      return decodeText<CompletedPracticeSession>(encode(record)[0]);
    });
  }

  markIncomplete(activityId: string, reason: IncompleteReason): Promise<StoredActivity> {
    return this.transaction(async (tx) => {
      const activity = await requireActivity(tx, activityId);
      if (activity.completion || activity.incomplete) return activity;
      const marked: StoredActivity = { ...activity, incomplete: reason };
      await writeActivity(tx, marked);
      return decodeText<StoredActivity>(encode(marked)[0]);
    });
  }

  readOutgoing(): Promise<readonly OutgoingSyncRecord[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>('SELECT body, body_format, body_length, body_sha256 FROM outgoing ORDER BY position')).map((row) => decode<OutgoingSyncRecord>(row)),
    );
  }

  private transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    // Checked before queuing (the session's connection may be closed already) and again when the transaction runs.
    if (!this.isCurrent()) return Promise.reject(new StaleSessionError());
    return this.connection.transaction(async (tx) => {
      if (!this.isCurrent()) throw new StaleSessionError();
      return work(tx);
    });
  }
}

const statusOf = (activity: StoredActivity) => (activity.completion ? 'completed' : activity.incomplete ? 'incomplete' : 'unfinished');

async function readActivity(tx: SqlExecutor, activityId: string): Promise<StoredActivity | null> {
  const row = await tx.get<BodyRow>('SELECT body, body_format, body_length, body_sha256 FROM activities WHERE activity_id = ?', [activityId]);
  return row ? decode<StoredActivity>(row) : null;
}

async function requireActivity(tx: SqlExecutor, activityId: string): Promise<StoredActivity> {
  const activity = await readActivity(tx, activityId);
  if (!activity) throw new StoreError(`no activity ${activityId}`);
  return activity;
}

async function writeActivity(tx: SqlExecutor, activity: StoredActivity): Promise<void> {
  await tx.run(
    'UPDATE activities SET status = ?, sequence = ?, body = ?, body_format = ?, body_length = ?, body_sha256 = ? WHERE activity_id = ?',
    [statusOf(activity), activity.sequence, ...encode(activity), activity.activityId],
  );
}

async function readTransition(tx: SqlExecutor, activityId: string, commandId: string): Promise<CommittedTransition | null> {
  const row = await tx.get<BodyRow>('SELECT body, body_format, body_length, body_sha256 FROM transitions WHERE activity_id = ? AND command_id = ?', [
    activityId,
    commandId,
  ]);
  return row ? decode<CommittedTransition>(row) : null;
}

/** Records each effect once, by its effect id, in the order first recorded. */
async function addEffects(tx: SqlExecutor, activityId: string, effects: readonly AllowanceEffect[]): Promise<void> {
  for (const effect of effects) {
    const { grant, activity, sequence } = effect.effectId;
    await tx.run(
      `INSERT OR IGNORE INTO effects (activity_id, effect_key, position, body, body_format, body_length, body_sha256)
       VALUES (?, ?, (SELECT coalesce(max(position), 0) + 1 FROM effects WHERE activity_id = ?), ?, ?, ?, ?)`,
      [activityId, JSON.stringify([grant, activity, sequence]), activityId, ...encode(effect)],
    );
  }
}

/** The stored text of a value, and the format, length and hash its reads check. */
function encode(value: unknown): [body: string, format: number, length: number, sha256: string] {
  const body = canonicalJson(withoutUndefined(value));
  return [body, BODY_FORMAT, utf8Length(body), sha256Hex(body)];
}

function decode<T>(row: BodyRow): T {
  if (row.body_format !== BODY_FORMAT) throw new StoreIntegrityError(`unknown stored format ${row.body_format}`);
  if (utf8Length(row.body) !== row.body_length) throw new StoreIntegrityError('a stored value has the wrong length');
  if (sha256Hex(row.body) !== row.body_sha256) throw new StoreIntegrityError('a stored value fails its hash');
  return decodeText<T>(row.body);
}

const decodeText = <T>(text: string): T => JSON.parse(text) as T;

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

/** Optional fields left undefined are absent from the stored text, as JSON leaves them. */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, withoutUndefined(entry)]),
  );
}

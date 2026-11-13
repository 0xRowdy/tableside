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

// The sync engine's store port (packages/account/src/sync/store.ts), matched
// structurally: the app doesn't depend on the Account service's package for it.

/** An operation fixed for sending: the request every retry repeats, and its SHA-256. */
export interface PreparedOperation {
  readonly operationId: string;
  readonly request: string;
  readonly requestHash: string;
}

/** A receipt's disposition. */
export type Disposition =
  | { readonly status: 'accepted'; readonly operation: string; readonly requestHash: string; readonly sequence: number }
  | { readonly status: 'rejected'; readonly operation: string; readonly requestHash: string; readonly code: string };

export interface QueuedUpload {
  readonly id: string;
  readonly recordType: string;
  readonly payload: unknown;
  readonly dependencies: readonly string[];
  readonly operation: PreparedOperation | null;
}

export interface AcceptedRecord {
  readonly recordType: string;
  readonly item: string;
  readonly sequence: number;
  readonly payload: unknown;
}

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
  // It is also the upload queue entry, written in the completion's transaction:
  // its dependencies, its receipt status, the operation it is sent as (fixed
  // before it is first sent) and the receipt's disposition.
  `CREATE TABLE outgoing (
    id TEXT PRIMARY KEY,
    activity_id TEXT NOT NULL UNIQUE REFERENCES activities (activity_id),
    position INTEGER NOT NULL UNIQUE,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    dependencies TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    operation_id TEXT UNIQUE,
    request TEXT,
    request_sha256 TEXT,
    receipt TEXT
  ) STRICT`,
  'CREATE INDEX outgoing_pending ON outgoing (status, position)',
  // Records the account has accepted: this installation's acknowledged uploads and the feed's changes.
  `CREATE TABLE accepted_records (
    record_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    PRIMARY KEY (record_type, item_id)
  ) STRICT`,
  // The account sequence the feed has been applied through.
  'CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL) STRICT',
  'INSERT INTO feed_cursor (singleton, sequence) VALUES (1, 0)',
];

/** The columns every stored value carries: its text, and the format, length and hash its reads check. */
const BODY = 'body, body_format, body_length, body_sha256';

interface BodyRow {
  readonly body: string;
  readonly body_format: number;
  readonly body_length: number;
  readonly body_sha256: string;
}

export class SqliteActivityStore implements ActivityStore {
  private readonly queuedListeners = new Set<() => void>();

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
        `INSERT INTO activities (activity_id, position, status, sequence, ${BODY})
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
        `SELECT ${BODY} FROM activities WHERE status = 'unfinished' ORDER BY position LIMIT 1`,
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
        `INSERT INTO transitions (activity_id, command_id, sequence, ${BODY}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
      (await tx.all<BodyRow>(`SELECT ${BODY} FROM effects WHERE activity_id = ? ORDER BY position`, [activityId])).map((row) =>
        decode<AllowanceEffect>(row),
      ),
    );
  }

  readTransitions(activityId: string): Promise<readonly CommittedTransition[]> {
    return this.transaction(async (tx) =>
      (await tx.all<BodyRow>(`SELECT ${BODY} FROM transitions WHERE activity_id = ? ORDER BY sequence`, [activityId])).map((row) =>
        decode<CommittedTransition>(row),
      ),
    );
  }

  readReceipt(activityId: string, commandId: string): Promise<CommittedTransition | null> {
    return this.transaction((tx) => readTransition(tx, activityId, commandId));
  }

  complete(record: CompletedPracticeSession): Promise<CompletedPracticeSession> {
    let queued = false;
    return this.transaction(async (tx) => {
      if (record.owner !== this.identity.accountId || record.device !== this.identity.installationId) {
        throw new StoreMismatchError(`the result of ${record.activityId} belongs to another account or installation`);
      }
      const activity = await requireActivity(tx, record.activityId);
      if (activity.completion) return activity.completion;
      await writeActivity(tx, { ...activity, completion: record });
      const sync: OutgoingSyncRecord = { id: `completed/${record.activityId}`, kind: 'completed-practice-session', record };
      await tx.run(
        `INSERT INTO outgoing (id, activity_id, position, ${BODY}, dependencies, status)
         VALUES (?, ?, (SELECT coalesce(max(position), 0) + 1 FROM outgoing), ?, ?, ?, ?, '[]', 'pending')`,
        [sync.id, record.activityId, ...encode(sync)],
      );
      queued = true;
      return decodeText<CompletedPracticeSession>(encode(record)[0]);
    }).then((result) => {
      // After the commit: the upload queue gained an entry.
      if (queued) this.notifyQueued();
      return result;
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
      (await tx.all<BodyRow>(`SELECT ${BODY} FROM outgoing ORDER BY position`)).map((row) => decode<OutgoingSyncRecord>(row)),
    );
  }

  // -------------------------------------------------------------------------
  // The sync engine's store port
  // -------------------------------------------------------------------------

  /** Unacknowledged upload queue entries, in queue order. */
  readUploadQueue(): Promise<readonly QueuedUpload[]> {
    return this.transaction(async (tx) => {
      const rows = await tx.all<BodyRow & QueueRow>(
        `SELECT ${BODY}, id, dependencies, operation_id, request, request_sha256 FROM outgoing WHERE status = 'pending' ORDER BY position`,
      );
      return rows.map((row) => {
        const outgoing = decode<OutgoingSyncRecord>(row);
        return {
          id: row.id,
          recordType: outgoing.kind,
          payload: outgoing.record,
          dependencies: JSON.parse(row.dependencies) as string[],
          operation: preparedOf(row),
        };
      });
    });
  }

  /** Fixes the operation an entry is sent as; once stored it never changes, and the stored one is returned. */
  prepareUpload(id: string, operation: PreparedOperation): Promise<PreparedOperation> {
    return this.transaction(async (tx) => {
      const row = await tx.get<QueueRow>('SELECT id, dependencies, operation_id, request, request_sha256 FROM outgoing WHERE id = ?', [id]);
      if (!row) throw new StoreError(`no upload ${id}`);
      const stored = preparedOf(row);
      if (stored) return stored;
      if (sha256Hex(operation.request) !== operation.requestHash) throw new StoreError('the operation\'s request hash does not match its request');
      await tx.run('UPDATE outgoing SET operation_id = ?, request = ?, request_sha256 = ? WHERE id = ?', [
        operation.operationId,
        operation.request,
        operation.requestHash,
        id,
      ]);
      return operation;
    });
  }

  /** Records the receipt's disposition and acknowledges the entry, with the record an acceptance makes, in one transaction. */
  acknowledgeUpload(id: string, disposition: Disposition, accepted: AcceptedRecord | null): Promise<void> {
    return this.transaction(async (tx) => {
      const row = await tx.get<{ status: string; operation_id: string | null }>('SELECT status, operation_id FROM outgoing WHERE id = ?', [id]);
      if (!row) throw new StoreError(`no upload ${id}`);
      if (row.operation_id === null || row.operation_id !== disposition.operation) {
        throw new StoreError(`upload ${id} was not sent as operation ${disposition.operation}`);
      }
      if (row.status !== 'pending') return;
      await tx.run('UPDATE outgoing SET status = ?, receipt = ? WHERE id = ?', [disposition.status, canonicalJson(disposition), id]);
      if (accepted) await putAccepted(tx, accepted);
    });
  }

  readFeedCursor(): Promise<number> {
    return this.transaction(readCursor);
  }

  /** Applies records that follow `from` without a gap and moves the cursor to the last, in one transaction; false when the cursor moved. */
  applyFeedPage(from: number, records: readonly AcceptedRecord[]): Promise<boolean> {
    return this.transaction(async (tx) => {
      if ((await readCursor(tx)) !== from) return false;
      for (const [index, record] of records.entries()) {
        if (record.sequence !== from + index + 1) throw new StoreError(`feed entry ${record.sequence} does not follow ${from + index}`);
        await putAccepted(tx, record);
      }
      if (records.length > 0) await tx.run('UPDATE feed_cursor SET sequence = ? WHERE singleton = 1', [from + records.length]);
      return true;
    });
  }

  readAcceptedRecords(recordType: string): Promise<readonly AcceptedRecord[]> {
    return this.transaction(async (tx) =>
      (
        await tx.all<BodyRow & { item_id: string; sequence: number }>(
          `SELECT ${BODY}, item_id, sequence FROM accepted_records WHERE record_type = ? ORDER BY sequence`,
          [recordType],
        )
      ).map((row) => ({ recordType, item: row.item_id, sequence: row.sequence, payload: decode<unknown>(row) })),
    );
  }

  /** Called after a commit adds an entry to the upload queue. */
  onUploadQueued(listener: () => void): () => void {
    this.queuedListeners.add(listener);
    return () => this.queuedListeners.delete(listener);
  }

  private notifyQueued(): void {
    for (const listener of this.queuedListeners) listener();
  }

  private transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    // Checked before queuing (the session's connection may be closed already), when the transaction starts, and before it commits.
    if (!this.isCurrent()) return Promise.reject(new StaleSessionError());
    return this.connection.transaction(async (tx) => {
      if (!this.isCurrent()) throw new StaleSessionError();
      const result = await work(tx);
      // The session may have ended while the work ran: then nothing commits.
      if (!this.isCurrent()) throw new StaleSessionError();
      return result;
    });
  }
}

interface QueueRow {
  readonly id: string;
  readonly dependencies: string;
  readonly operation_id: string | null;
  readonly request: string | null;
  readonly request_sha256: string | null;
}

/** The stored operation, checked against its hash like every stored value. */
function preparedOf(row: QueueRow): PreparedOperation | null {
  if (row.operation_id === null || row.request === null || row.request_sha256 === null) return null;
  if (sha256Hex(row.request) !== row.request_sha256) throw new StoreIntegrityError('a stored upload request fails its hash');
  return { operationId: row.operation_id, request: row.request, requestHash: row.request_sha256 };
}

async function readCursor(tx: SqlExecutor): Promise<number> {
  const row = await tx.get<{ sequence: number }>('SELECT sequence FROM feed_cursor WHERE singleton = 1');
  if (!row) throw new StoreIntegrityError('the feed cursor is missing');
  return row.sequence;
}

async function putAccepted(tx: SqlExecutor, record: AcceptedRecord): Promise<void> {
  await tx.run(
    `INSERT INTO accepted_records (record_type, item_id, sequence, ${BODY}) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (record_type, item_id) DO UPDATE SET sequence = excluded.sequence, body = excluded.body,
       body_format = excluded.body_format, body_length = excluded.body_length, body_sha256 = excluded.body_sha256`,
    [record.recordType, record.item, record.sequence, ...encode(record.payload)],
  );
}

const statusOf = (activity: StoredActivity) => (activity.completion ? 'completed' : activity.incomplete ? 'incomplete' : 'unfinished');

async function readActivity(tx: SqlExecutor, activityId: string): Promise<StoredActivity | null> {
  const row = await tx.get<BodyRow>(`SELECT ${BODY} FROM activities WHERE activity_id = ?`, [activityId]);
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
  const row = await tx.get<BodyRow>(`SELECT ${BODY} FROM transitions WHERE activity_id = ? AND command_id = ?`, [
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
      `INSERT OR IGNORE INTO effects (activity_id, effect_key, position, ${BODY})
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

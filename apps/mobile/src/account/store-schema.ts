// The account store's schema and its migrations (spec 2, *Local storage ›
// Migrations*). A database is created at the base schema and brought to this
// build's version by running every later migration in order; the migration
// runner (migration-runner.ts) does the same for an existing database, under a
// verified backup.
//
// The store schema version is its own identity (spec 1, *Version identities*):
// it is never the engine version or the state schema of the checkpoints the
// store holds, and no migration rewrites a stored checkpoint, specification or
// receipt. A migration is append-only: once released it is never edited, and
// each build keeps every migration from the base schema, so a database left by
// any earlier build (skipped releases included) upgrades directly.

import type { SqlExecutor } from './sql';

/** One step: brings a database at schema `to - 1` to `to`, inside the migration's one transaction. */
export interface StoreMigration {
  readonly to: number;
  migrate(tx: SqlExecutor): Promise<void>;
}

export const BASE_SCHEMA_VERSION = 1;

/** Every migration after the base schema, in order. None has been needed yet. */
export const STORE_MIGRATIONS: readonly StoreMigration[] = [];

/** The schema version this build's migrations reach. */
export const schemaVersionOf = (migrations: readonly StoreMigration[]): number => BASE_SCHEMA_VERSION + migrations.length;

/** The schema version this build opens. */
export const STORE_SCHEMA_VERSION = schemaVersionOf(STORE_MIGRATIONS);

const BASE_SCHEMA = [
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
  // The upload queue: each entry with its dependencies, its receipt status,
  // the operation it is sent as (fixed before it is first sent), the receipt's
  // disposition and the account sequence an acceptance names. A completion's
  // entry is its one outgoing synchronization record (the activity id is
  // unique), written in the completion's transaction; a revisioned item's is
  // written with the local save or deletion, and goes once the item's
  // accepted state reflects it.
  `CREATE TABLE outgoing (
    id TEXT PRIMARY KEY,
    activity_id TEXT UNIQUE REFERENCES activities (activity_id),
    record_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    revisioned INTEGER NOT NULL CHECK (revisioned IN (0, 1)),
    position INTEGER NOT NULL UNIQUE,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    dependencies TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    operation_id TEXT UNIQUE,
    request TEXT,
    request_sha256 TEXT,
    receipt TEXT,
    receipt_sequence INTEGER
  ) STRICT`,
  'CREATE INDEX outgoing_pending ON outgoing (status, position)',
  'CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)',
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

/** Creates the schema in an empty database: the base schema, then every migration, with `meta` naming the result. */
export async function createSchema(tx: SqlExecutor, meta: Readonly<Record<string, string>>, migrations: readonly StoreMigration[]): Promise<void> {
  for (const statement of BASE_SCHEMA) await tx.run(statement);
  for (const [name, value] of Object.entries({ ...meta, schema_version: String(BASE_SCHEMA_VERSION) })) {
    await tx.run('INSERT INTO meta (name, value) VALUES (?, ?)', [name, value]);
  }
  await migrate(tx, BASE_SCHEMA_VERSION, migrations);
}

/** Runs the migrations after `from`, in order, and records the version they reach. */
export async function migrate(tx: SqlExecutor, from: number, migrations: readonly StoreMigration[]): Promise<void> {
  for (const [index, migration] of migrations.entries()) {
    if (migration.to !== BASE_SCHEMA_VERSION + index + 1) throw new Error(`migration ${index} reaches ${migration.to}, not ${BASE_SCHEMA_VERSION + index + 1}`);
    if (migration.to > from) await migration.migrate(tx);
  }
  await tx.run(`UPDATE meta SET value = ? WHERE name = 'schema_version'`, [String(schemaVersionOf(migrations))]);
}

/** The database's schema version; null for an empty database, NaN when it has tables but no readable version. */
export async function readSchemaVersion(tx: SqlExecutor): Promise<number | null> {
  const tables = await tx.get<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'");
  if (tables?.count === 0) return null;
  const hasMeta = await tx.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'");
  const row = hasMeta ? await tx.get<{ value: string }>(`SELECT value FROM meta WHERE name = 'schema_version'`) : null;
  return row && /^[1-9][0-9]*$/.test(row.value) ? Number(row.value) : Number.NaN;
}

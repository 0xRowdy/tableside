// Spec 2 Local storage › Migrations

import type { SqlExecutor } from './sql';

export interface StoreMigration {
  readonly to: number;
  migrate(tx: SqlExecutor): Promise<void>;
}

export const BASE_SCHEMA_VERSION = 1;

// Spec 3 Attempt lifecycle › Durability, Amendment 1 C7; #158
const CHALLENGE_ATTEMPTS: StoreMigration = {
  to: 2,
  async migrate(tx) {
    for (const statement of [
      `CREATE TABLE challenge_attempts (
        attempt_id TEXT PRIMARY KEY,
        position INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('unfinished', 'ended')),
        sequence INTEGER NOT NULL,
        body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL
      ) STRICT`,
      "CREATE UNIQUE INDEX challenge_attempts_one_unfinished ON challenge_attempts (status) WHERE status = 'unfinished'",
      `CREATE TABLE challenge_transitions (
        attempt_id TEXT NOT NULL REFERENCES challenge_attempts (attempt_id),
        command_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
        PRIMARY KEY (attempt_id, command_id),
        UNIQUE (attempt_id, sequence)
      ) STRICT`,
      `CREATE TABLE challenge_charges (
        attempt_id TEXT PRIMARY KEY REFERENCES challenge_attempts (attempt_id),
        body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL
      ) STRICT`,
      `CREATE TABLE challenge_attempt_records (
        attempt_id TEXT PRIMARY KEY REFERENCES challenge_attempts (attempt_id),
        device_sequence INTEGER NOT NULL UNIQUE,
        body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL
      ) STRICT`,
      'CREATE TABLE device_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
    ]) {
      await tx.run(statement);
    }
  },
};

export const STORE_MIGRATIONS: readonly StoreMigration[] = [CHALLENGE_ATTEMPTS];

export const schemaVersionOf = (migrations: readonly StoreMigration[]): number => BASE_SCHEMA_VERSION + migrations.length;

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
  // #92, #98
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
    receipt_sequence INTEGER,
    failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
    flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0, 1)),
    device_position INTEGER,
    command_generation INTEGER,
    command_position INTEGER,
    unconfirmed INTEGER NOT NULL DEFAULT 0 CHECK (unconfirmed IN (0, 1)),
    UNIQUE (command_generation, command_position)
  ) STRICT`,
  'CREATE INDEX outgoing_pending ON outgoing (status, position)',
  'CREATE INDEX outgoing_items ON outgoing (record_type, item_id, position)',
  // #97
  `CREATE TABLE accepted_records (
    record_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    installation_id TEXT,
    device_position INTEGER,
    summary_at INTEGER,
    PRIMARY KEY (record_type, item_id)
  ) STRICT`,
  // #98
  'CREATE TABLE command_scope (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), generation INTEGER, last INTEGER NOT NULL) STRICT',
  'INSERT INTO command_scope (singleton, generation, last) VALUES (1, NULL, 0)',
  'CREATE INDEX accepted_summaries ON accepted_records (summary_at) WHERE summary_at IS NOT NULL',
  'CREATE TABLE device_positions (record_type TEXT PRIMARY KEY, last INTEGER NOT NULL) STRICT',
  'CREATE TABLE purged_records (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT',
  'CREATE TABLE feed_cursor (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), sequence INTEGER NOT NULL, synced_at INTEGER) STRICT',
  'INSERT INTO feed_cursor (singleton, sequence) VALUES (1, 0)',
  // #96
  `CREATE TABLE bootstrap (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    installed INTEGER NOT NULL CHECK (installed IN (0, 1)),
    body TEXT, body_format INTEGER, body_length INTEGER, body_sha256 TEXT,
    staged INTEGER NOT NULL DEFAULT 0 CHECK (staged >= 0),
    after_ordinal INTEGER NOT NULL DEFAULT 0 CHECK (after_ordinal >= 0)
  ) STRICT`,
  'INSERT INTO bootstrap (singleton, installed) VALUES (1, 0)',
  `CREATE TABLE bootstrap_rows (
    position INTEGER PRIMARY KEY,
    record_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
    installation_id TEXT,
    device_position INTEGER,
    summary_at INTEGER
  ) STRICT`,
  // #98
  'CREATE TABLE bootstrap_purges (record_type TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (record_type, item_id)) STRICT',
  // #97
  `CREATE TABLE history (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    recent INTEGER CHECK (recent >= 0),
    download_requested INTEGER NOT NULL CHECK (download_requested IN (0, 1)),
    download_total INTEGER CHECK (download_total >= 0)
  ) STRICT`,
  'INSERT INTO history (singleton, download_requested) VALUES (1, 0)',
];

export async function createSchema(tx: SqlExecutor, meta: Readonly<Record<string, string>>, migrations: readonly StoreMigration[]): Promise<void> {
  for (const statement of BASE_SCHEMA) await tx.run(statement);
  for (const [name, value] of Object.entries({ ...meta, schema_version: String(BASE_SCHEMA_VERSION) })) {
    await tx.run('INSERT INTO meta (name, value) VALUES (?, ?)', [name, value]);
  }
  await migrate(tx, BASE_SCHEMA_VERSION, migrations);
}

export async function migrate(tx: SqlExecutor, from: number, migrations: readonly StoreMigration[]): Promise<void> {
  for (const [index, migration] of migrations.entries()) {
    if (migration.to !== BASE_SCHEMA_VERSION + index + 1) throw new Error(`migration ${index} reaches ${migration.to}, not ${BASE_SCHEMA_VERSION + index + 1}`);
    if (migration.to > from) await migration.migrate(tx);
  }
  await tx.run(`UPDATE meta SET value = ? WHERE name = 'schema_version'`, [String(schemaVersionOf(migrations))]);
}

export async function readSchemaVersion(tx: SqlExecutor): Promise<number | null> {
  const tables = await tx.get<{ count: number }>("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table'");
  if (tables?.count === 0) return null;
  const hasMeta = await tx.get("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'");
  const row = hasMeta ? await tx.get<{ value: string }>(`SELECT value FROM meta WHERE name = 'schema_version'`) : null;
  return row && /^[1-9][0-9]*$/.test(row.value) ? Number(row.value) : Number.NaN;
}

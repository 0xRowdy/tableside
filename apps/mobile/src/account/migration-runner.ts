// The store's migration runner (spec 2, *Local storage › Migrations*): the
// account vault opens every account database through it, so a database an
// earlier build left is brought to this build's schema before anything reads
// or writes it.
//
// - Writers are quiesced: the vault runs it while opening the account, after
//   closing any open session and before any store exists, so the database's
//   one writer is the runner's own connection.
// - Backup: a WAL checkpoint moves every committed transaction into the
//   database file, which is copied beside it (still encrypted under the same
//   key) and verified: the copy opens with the key, passes an integrity check
//   and holds exactly the database's schema and rows.
// - Manifest: once the backup is verified, `<database>.migration` records the
//   migration. Then one transaction runs every step: a kill or failure leaves
//   the old generation and a commit is the complete new one.
// - Two generations are live only while the manifest exists, and the store
//   opens only after the backup and manifest are gone, so nothing plays then.
//   A later open finding a manifest settles it first: a readable database
//   (either generation) discards the backup; a damaged or missing one gets the
//   backup back, since no play can have reached the new generation. Without a
//   manifest there is never a restore: a damaged database is Recovery needed.
// - A later build's schema, or its manifest, is never touched (a rollback).

import { sha256Hex } from '@tableside/engine';

import { classifySqlError, SqlError, type SqlConnection, type SqlDriver, type SqlExecutor } from './sql';
import { migrate, readSchemaVersion, schemaVersionOf, type StoreMigration } from './store-schema';

/** The vault's file operations the runner uses. */
export interface MigrationFiles {
  size(path: string): Promise<number | null>;
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface MigrationPorts {
  readonly driver: SqlDriver;
  readonly files: MigrationFiles;
  /** This build's migrations (store-schema.ts). */
  readonly migrations: readonly StoreMigration[];
}

export type DatabaseOpening =
  /** At this build's schema (or empty, for the store to create): ready for the store. */
  | { readonly status: 'open'; readonly connection: SqlConnection }
  /** There is no database file (after settling any interrupted migration). */
  | { readonly status: 'missing' }
  /** A later build's schema or migration: this build can't read it, and leaves it exactly as it is. */
  | { readonly status: 'needs-update'; readonly schema: number | null }
  /** The migration didn't complete. The database is as the earlier build left it; the next open tries again. */
  | { readonly status: 'migration-failed'; readonly reason: string };

interface Manifest {
  readonly v: 1;
  readonly from: number;
  readonly to: number;
}

const backupOf = (path: string) => `${path}.migration-backup`;
const manifestOf = (path: string) => `${path}.migration`;
const SIDECARS = ['-wal', '-shm'];

/**
 * Opens the database at `path` and brings it to this build's schema. `existing`
 * says a database was made for this key: then a missing file is reported, never
 * created. Rejects with the driver's SqlError ("unreadable" for a wrong key or
 * a damaged file).
 */
export async function openMigrated(ports: MigrationPorts, path: string, keyHex: string, existing: boolean): Promise<DatabaseOpening> {
  const { driver, files } = ports;
  const target = schemaVersionOf(ports.migrations);

  const manifest = parseManifest(await files.readText(manifestOf(path)));
  if (manifest === 'later') return { status: 'needs-update', schema: null };
  if (manifest && !(await readable(driver, files, path, keyHex))) await restoreBackup(files, path);
  if (existing && !((await files.size(path)) ?? 0)) return { status: 'missing' };

  const connection = await driver.open(path, keyHex);
  let version: number | null;
  try {
    version = await connection.transaction(readSchemaVersion);
    // The database reads, so whatever a migration left beside it has done its job.
    await discardBackup(files, path);
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
  if (version === null || version === target || Number.isNaN(version)) return { status: 'open', connection };
  if (version > target) {
    await connection.close();
    return { status: 'needs-update', schema: version };
  }

  try {
    await backUp(ports, connection, path, keyHex);
    const record: Manifest = { v: 1, from: version, to: target };
    await files.writeText(manifestOf(path), JSON.stringify(record));
    await connection.transaction((tx) => migrate(tx, version, ports.migrations));
  } catch (error) {
    await connection.close().catch(() => undefined);
    await discardBackup(files, path).catch(() => undefined);
    return { status: 'migration-failed', reason: classifySqlError(error).kind };
  }
  try {
    // Before anything plays on the new generation.
    await discardBackup(files, path);
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
  return { status: 'open', connection };
}

/** The manifest, null when there is none (or only part of one: written before the migration began), or "later" for a later build's. */
function parseManifest(text: string | null): Manifest | 'later' | null {
  if (text === null) return null;
  let value: Partial<Manifest>;
  try {
    value = JSON.parse(text) as Partial<Manifest>;
  } catch {
    return null;
  }
  return value.v === 1 && Number.isInteger(value.from) && Number.isInteger(value.to) ? (value as Manifest) : 'later';
}

/** Copies the database's committed state beside it and verifies the copy, rejecting when it doesn't match. */
async function backUp({ driver, files }: MigrationPorts, connection: SqlConnection, path: string, keyHex: string): Promise<void> {
  await connection.checkpoint();
  const digest = await connection.transaction(contentDigest);
  const backup = backupOf(path);
  await files.copy(path, backup);
  const copy = await driver.open(backup, keyHex);
  try {
    const verified = await copy.transaction(async (tx) => {
      const check = await tx.get<{ integrity_check: string }>('PRAGMA integrity_check');
      return check?.integrity_check === 'ok' && (await contentDigest(tx)) === digest;
    });
    if (!verified) throw new SqlError('other', 'the backup does not match the database');
  } finally {
    await copy.close();
  }
}

/**
 * A digest of the database's schema and every row, in a fixed order: equal
 * digests mean equal contents. It reads each table whole (the store is small
 * until spec 2's history detail grows it).
 */
async function contentDigest(tx: SqlExecutor): Promise<string> {
  const schema = await tx.all<{ type: string; name: string; sql: string | null }>(
    "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
  );
  const parts: string[] = [JSON.stringify(schema)];
  for (const { name } of schema.filter((entry) => entry.type === 'table')) {
    parts.push(sha256Hex(JSON.stringify(await tx.all(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`))));
  }
  return sha256Hex(parts.join('\n'));
}

/** Whether the database file exists and opens with its key. */
async function readable(driver: SqlDriver, files: MigrationFiles, path: string, keyHex: string): Promise<boolean> {
  if (!((await files.size(path)) ?? 0)) return false;
  try {
    const connection = await driver.open(path, keyHex);
    await connection.transaction(readSchemaVersion).finally(() => connection.close());
    return true;
  } catch (error) {
    if (error instanceof SqlError && error.kind === 'unreadable') return false;
    throw error;
  }
}

/**
 * Puts the verified backup in place of a damaged or missing database. The
 * damaged bytes are kept beside it (`.unreadable-<n>`), as Recovery needed
 * keeps them. The database file goes first and its log after, so an old log
 * is never applied to the backup; the backup arrives by rename, whole.
 */
async function restoreBackup(files: MigrationFiles, path: string): Promise<void> {
  const backup = backupOf(path);
  if (!((await files.size(backup)) ?? 0)) return;
  let kept = 1;
  while ((await files.size(`${path}.unreadable-${kept}`)) !== null || (await files.size(`${path}.unreadable-${kept}-wal`)) !== null) kept++;
  for (const suffix of ['', '-wal']) {
    if ((await files.size(`${path}${suffix}`)) !== null) await files.copy(`${path}${suffix}`, `${path}.unreadable-${kept}${suffix}`);
  }
  for (const suffix of ['', ...SIDECARS]) await files.remove(`${path}${suffix}`);
  await files.remove(`${path}.restoring`);
  await files.copy(backup, `${path}.restoring`);
  await files.move(`${path}.restoring`, path);
}

/** Removes the backup, its logs and the manifest: the manifest last, so a backup never outlives it unnoticed. */
async function discardBackup(files: MigrationFiles, path: string): Promise<void> {
  const backup = backupOf(path);
  for (const file of [`${path}.restoring`, backup, ...SIDECARS.map((suffix) => `${backup}${suffix}`), manifestOf(path)]) await files.remove(file);
}

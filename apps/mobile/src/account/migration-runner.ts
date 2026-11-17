// Spec 2 Local storage › Migrations

import { sha256Hex } from '@tableside/engine';

import { classifySqlError, SqlError, type SqlConnection, type SqlDriver, type SqlErrorKind, type SqlExecutor } from './sql';
import { migrate, readSchemaVersion, schemaVersionOf, type StoreMigration } from './store-schema';

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
  readonly migrations: readonly StoreMigration[];
}

export type DatabaseOpening =
  | { readonly status: 'open'; readonly connection: SqlConnection }
  | { readonly status: 'missing' }
  | { readonly status: 'needs-update'; readonly schema: number | null }
  | { readonly status: 'migration-failed'; readonly reason: SqlErrorKind };

interface Manifest {
  readonly v: 1;
  readonly to: number;
}

const backupOf = (path: string) => `${path}.migration-backup`;
const manifestOf = (path: string) => `${path}.migration`;
const SIDECARS = ['-wal', '-shm'];

export async function openMigrated(ports: MigrationPorts, path: string, keyHex: string, existing: boolean): Promise<DatabaseOpening> {
  const { driver, files } = ports;
  const target = schemaVersionOf(ports.migrations);

  const manifest = parseManifest(await files.readText(manifestOf(path)));
  if (manifest === 'later') return { status: 'needs-update', schema: null };
  if (manifest && manifest.to > target) return { status: 'needs-update', schema: manifest.to };
  if (manifest && !(await readable(driver, files, path, keyHex))) await restoreBackup(files, path);
  if (existing && !((await files.size(path)) ?? 0)) return { status: 'missing' };

  const connection = await driver.open(path, keyHex);
  let version: number | null;
  try {
    version = await connection.transaction(readSchemaVersion);
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
    const record: Manifest = { v: 1, to: target };
    await files.writeText(manifestOf(path), JSON.stringify(record));
    await connection.transaction((tx) => migrate(tx, version, ports.migrations));
  } catch (error) {
    await connection.close().catch(() => undefined);
    await discardBackup(files, path).catch(() => undefined);
    return { status: 'migration-failed', reason: classifySqlError(error).kind };
  }
  try {
    await discardBackup(files, path);
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw error;
  }
  return { status: 'open', connection };
}

function parseManifest(text: string | null): Manifest | 'later' | null {
  if (text === null) return null;
  let value: Partial<Manifest>;
  try {
    value = JSON.parse(text) as Partial<Manifest>;
  } catch {
    return null;
  }
  return value.v === 1 && Number.isInteger(value.to) ? { v: 1, to: value.to! } : 'later';
}

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

async function discardBackup(files: MigrationFiles, path: string): Promise<void> {
  const backup = backupOf(path);
  for (const file of [`${path}.restoring`, backup, ...SIDECARS.map((suffix) => `${backup}${suffix}`), manifestOf(path)]) await files.remove(file);
}

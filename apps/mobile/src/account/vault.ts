// Spec 2 Modules

import { ENVIRONMENT_NAMES, type EnvironmentName } from '@tableside/account/environment';
import { hex } from '@tableside/account/values';

import { openMigrated, type MigrationFiles } from './migration-runner';
import { SqliteActivityStore, StoreMismatchError, type StoreIdentity } from './sqlite-store';
import { isDatabaseKey, SqlError, type SqlDriver, type SqlErrorKind } from './sql';
import { STORE_MIGRATIONS, type StoreMigration } from './store-schema';

export type KeyRead = { readonly status: 'found'; readonly value: string } | { readonly status: 'missing' } | { readonly status: 'locked' };

export interface VaultKeyStore {
  read(name: string): Promise<KeyRead>;
  write(name: string, value: string): Promise<'written' | 'locked'>;
  remove(name: string): Promise<'removed' | 'locked'>;
}

export interface VaultFiles extends MigrationFiles {
  readonly root: string;
  ensureDirectory(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
  remove(path: string): Promise<void>;
}

export interface VaultPorts {
  // #39
  readonly environment: EnvironmentName;
  readonly keys: VaultKeyStore;
  readonly files: VaultFiles;
  readonly driver: SqlDriver;
  randomBytes(length: number): Uint8Array;
  newId(): string;
  unlocked(): Promise<void>;
  readonly migrations?: readonly StoreMigration[];
}

export interface AccountSession extends StoreIdentity {
  readonly generation: number;
  readonly store: SqliteActivityStore;
}

export type RecoveryReason = 'key-missing' | 'key-corrupt' | 'database-missing' | 'database-unreadable';

export type VaultOpening =
  | { readonly status: 'open'; readonly session: AccountSession }
  | { readonly status: 'recovery-needed'; readonly accountId: string; readonly generation: number; readonly reason: RecoveryReason }
  | { readonly status: 'needs-update'; readonly accountId: string; readonly generation: number; readonly schema: number | null }
  | { readonly status: 'migration-failed'; readonly accountId: string; readonly generation: number; readonly reason: SqlErrorKind }
  | { readonly status: 'superseded' };

interface KeyRecord {
  readonly v: 1;
  readonly key: string;
  readonly created: boolean;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const namespace = {
  directory: (root: string, environment: EnvironmentName) => `${root}/${environment}`,
  installationKey: (environment: EnvironmentName) => `tableside.${environment}.installation`,
  accountKey: (environment: EnvironmentName, installationId: string, accountId: string) => `tableside.${environment}.${installationId}.${accountId}.key`,
  recoveredKey: (environment: EnvironmentName, accountId: string) => `tableside.${environment}.recovered.${accountId}.key`,
  keyIndex: (environment: EnvironmentName) => `tableside.${environment}.keys`,
};
const KEY_BYTES = 32;

export class AccountVault {
  private currentGeneration = 0;
  private openSession: AccountSession | null = null;
  private cachedInstallationId: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly ports: VaultPorts) {
    if (!ENVIRONMENT_NAMES.includes(ports.environment)) throw new Error(`invalid environment ${ports.environment}`);
  }

  get generation(): number {
    return this.currentGeneration;
  }

  async open(accountId: string): Promise<VaultOpening> {
    if (!ID_PATTERN.test(accountId)) throw new Error('invalid account id');
    const generation = ++this.currentGeneration;
    for (;;) {
      const outcome = await this.serial(async () => {
        await this.closeOpen();
        return generation === this.currentGeneration ? this.attempt(accountId, generation) : SUPERSEDED;
      });
      if (outcome !== 'locked') return outcome;
      await this.ports.unlocked();
      if (generation !== this.currentGeneration) return SUPERSEDED;
    }
  }

  async close(): Promise<void> {
    this.currentGeneration++;
    await this.serial(() => this.closeOpen());
  }

  async erase(accountId: string): Promise<void> {
    if (!ID_PATTERN.test(accountId)) throw new Error('invalid account id');
    this.currentGeneration++;
    while ((await this.serial(() => this.eraseAccount(accountId))) === 'locked') await this.ports.unlocked();
  }

  async removeEnvironment(environment: EnvironmentName): Promise<void> {
    if (!ENVIRONMENT_NAMES.includes(environment)) throw new Error(`invalid environment ${environment}`);
    if (environment === this.ports.environment) throw new Error('a vault never removes its own environment');
    while ((await this.serial(() => this.removeNamespace(environment))) === 'locked') await this.ports.unlocked();
  }

  // Spec 2 Key states
  async recover(accountId: string): Promise<{ readonly installationId: string }> {
    if (!ID_PATTERN.test(accountId)) throw new Error('invalid account id');
    this.currentGeneration++;
    for (;;) {
      const outcome = await this.serial(() => this.recoverAccount(accountId));
      if (outcome !== 'locked') return outcome;
      await this.ports.unlocked();
    }
  }

  ifCurrent<T>(generation: number, apply: () => T): { readonly applied: true; readonly value: T } | { readonly applied: false } {
    return generation === this.currentGeneration ? { applied: true, value: apply() } : { applied: false };
  }

  private async attempt(accountId: string, generation: number): Promise<VaultOpening | 'locked'> {
    const { environment, files, keys } = this.ports;
    const installationId = await this.installationFor(accountId);
    if (installationId === 'locked') return 'locked';
    const directory = `${namespace.directory(files.root, environment)}/${installationId}`;
    await files.ensureDirectory(directory);
    const path = `${directory}/${accountId}.db`;
    const keyName = namespace.accountKey(environment, installationId, accountId);
    const recovery = (reason: RecoveryReason): VaultOpening => ({ status: 'recovery-needed', accountId, generation, reason });

    const read = await keys.read(keyName);
    if (read.status === 'locked') return 'locked';

    let record: KeyRecord;
    if (read.status === 'missing') {
      if (((await files.size(path)) ?? 0) > 0 || (await files.size(`${path}-wal`)) !== null || (await this.earlierDatabase(installationId, accountId))) return recovery('key-missing');
      record = { v: 1, key: hex(this.ports.randomBytes(KEY_BYTES)), created: false };
      if ((await this.recordKeyName(keyName)) === 'locked') return 'locked';
      if ((await keys.write(keyName, JSON.stringify(record))) === 'locked') return 'locked';
    } else {
      const parsed = parseKeyRecord(read.value);
      if (!parsed) return recovery('key-corrupt');
      record = parsed;
    }

    const identity: StoreIdentity = { environment, accountId, installationId };
    const migrations = this.ports.migrations ?? STORE_MIGRATIONS;
    let store: SqliteActivityStore;
    try {
      const database = await openMigrated({ driver: this.ports.driver, files, migrations }, path, record.key, record.created);
      if (database.status === 'missing') return recovery('database-missing');
      if (database.status === 'needs-update') return { status: 'needs-update', accountId, generation, schema: database.schema };
      if (database.status === 'migration-failed') return { status: 'migration-failed', accountId, generation, reason: database.reason };
      store = await SqliteActivityStore.open(database.connection, identity, { isCurrent: () => this.currentGeneration === generation, migrations });
    } catch (error) {
      if ((error instanceof SqlError && error.kind === 'unreadable') || error instanceof StoreMismatchError) return recovery('database-unreadable');
      throw error;
    }
    if (!record.created) await keys.write(keyName, JSON.stringify({ ...record, created: true }));
    if (generation !== this.currentGeneration) {
      await store.close();
      return SUPERSEDED;
    }
    const session: AccountSession = { ...identity, generation, store };
    this.openSession = session;
    return { status: 'open', session };
  }

  private async installationFor(accountId: string): Promise<string | 'locked'> {
    const recovered = await this.ports.keys.read(namespace.recoveredKey(this.ports.environment, accountId));
    if (recovered.status === 'locked') return 'locked';
    if (recovered.status === 'found' && ID_PATTERN.test(recovered.value)) return recovered.value;
    return this.installationId();
  }

  private async recoverAccount(accountId: string): Promise<{ readonly installationId: string } | 'locked'> {
    const { environment, files, keys } = this.ports;
    if (this.openSession?.accountId === accountId) await this.closeOpen();
    const installationId = this.ports.newId();
    if (!ID_PATTERN.test(installationId)) throw new Error('invalid installation id');
    await files.ensureDirectory(`${namespace.directory(files.root, environment)}/${installationId}`);
    const keyName = namespace.accountKey(environment, installationId, accountId);
    const record: KeyRecord = { v: 1, key: hex(this.ports.randomBytes(KEY_BYTES)), created: false };
    const recoveredName = namespace.recoveredKey(environment, accountId);
    for (const name of [keyName, recoveredName]) if ((await this.recordKeyName(name)) === 'locked') return 'locked';
    if ((await keys.write(keyName, JSON.stringify(record))) === 'locked') return 'locked';
    if ((await keys.write(recoveredName, installationId)) === 'locked') return 'locked';
    return { installationId };
  }

  private async removeNamespace(environment: EnvironmentName): Promise<'removed' | 'locked'> {
    const { files, keys } = this.ports;
    const directory = namespace.directory(files.root, environment);
    const index = await this.readKeyIndex(environment);
    if (index === 'locked') return 'locked';
    const names = new Set(index);
    for (const installation of (await files.list(directory)).filter((name) => name !== 'installation' && ID_PATTERN.test(name))) {
      for (const file of await files.list(`${directory}/${installation}`)) {
        if (file.endsWith('.db')) names.add(namespace.accountKey(environment, installation, file.slice(0, -'.db'.length)));
      }
    }
    for (const name of [...names, namespace.installationKey(environment), namespace.keyIndex(environment)]) {
      if ((await keys.remove(name)) === 'locked') return 'locked';
    }
    await files.remove(directory);
    return 'removed';
  }

  private async eraseAccount(accountId: string): Promise<'erased' | 'locked'> {
    const { environment, files, keys } = this.ports;
    if (this.openSession?.accountId === accountId) await this.closeOpen();
    const directory = namespace.directory(files.root, environment);
    const index = await this.readKeyIndex(environment);
    if (index === 'locked') return 'locked';
    const suffix = `.${accountId}.key`;
    const names = new Set(index.filter((name) => name.endsWith(suffix)));
    const database = `${accountId}.db`;
    for (const installation of (await files.list(directory)).filter((name) => name !== 'installation' && ID_PATTERN.test(name))) {
      names.add(namespace.accountKey(environment, installation, accountId));
      for (const file of await files.list(`${directory}/${installation}`)) {
        if (file.startsWith(database)) await files.remove(`${directory}/${installation}/${file}`);
      }
    }
    for (const name of names) if ((await keys.remove(name)) === 'locked') return 'locked';
    const remaining = index.filter((name) => !names.has(name));
    if (remaining.length !== index.length && (await keys.write(namespace.keyIndex(environment), JSON.stringify(remaining))) === 'locked') return 'locked';
    return 'erased';
  }

  private async recordKeyName(name: string): Promise<'recorded' | 'locked'> {
    const index = await this.readKeyIndex(this.ports.environment);
    if (index === 'locked') return 'locked';
    if (index.includes(name)) return 'recorded';
    return (await this.ports.keys.write(namespace.keyIndex(this.ports.environment), JSON.stringify([...index, name]))) === 'locked' ? 'locked' : 'recorded';
  }

  private async readKeyIndex(environment: EnvironmentName): Promise<string[] | 'locked'> {
    const read = await this.ports.keys.read(namespace.keyIndex(environment));
    if (read.status === 'locked') return 'locked';
    if (read.status === 'missing') return [];
    try {
      const names: unknown = JSON.parse(read.value);
      return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string' && name.startsWith(`tableside.${environment}.`)) : [];
    } catch {
      return [];
    }
  }

  private async earlierDatabase(installationId: string, accountId: string): Promise<boolean> {
    const directory = namespace.directory(this.ports.files.root, this.ports.environment);
    for (const name of await this.ports.files.list(directory)) {
      if (name !== installationId && ID_PATTERN.test(name) && ((await this.ports.files.size(`${directory}/${name}/${accountId}.db`)) ?? 0) > 0) return true;
    }
    return false;
  }

  private async installationId(): Promise<string | 'locked'> {
    if (this.cachedInstallationId) return this.cachedInstallationId;
    const { environment, files, keys } = this.ports;
    const directory = namespace.directory(files.root, environment);
    await files.ensureDirectory(directory);
    const path = `${directory}/installation`;
    const name = namespace.installationKey(environment);
    const entry = await keys.read(name);
    if (entry.status === 'locked') return 'locked';
    const file = await files.readText(path);
    if (entry.status === 'found' && file === entry.value && ID_PATTERN.test(file)) return (this.cachedInstallationId = file);
    const id = this.ports.newId();
    if (!ID_PATTERN.test(id)) throw new Error('invalid installation id');
    if ((await keys.write(name, id)) === 'locked') return 'locked';
    await files.writeText(path, id);
    return (this.cachedInstallationId = id);
  }

  private async closeOpen(): Promise<void> {
    const session = this.openSession;
    this.openSession = null;
    await session?.store.close();
  }

  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

const SUPERSEDED: VaultOpening = { status: 'superseded' };

function parseKeyRecord(text: string): KeyRecord | null {
  try {
    const value = JSON.parse(text) as Partial<KeyRecord>;
    if (value.v === 1 && typeof value.key === 'string' && isDatabaseKey(value.key) && typeof value.created === 'boolean') {
      return { v: 1, key: value.key, created: value.created };
    }
  } catch {
    return null;
  }
  return null;
}

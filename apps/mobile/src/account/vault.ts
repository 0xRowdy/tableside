// The account vault (spec 2, *Modules*): one encrypted database and one random
// key per (environment, account, installation), the account-session
// generation, locked-versus-lost key handling and backup exclusion. The
// account service (packages/account) drives it through its vault port: `open`
// on sign-in and account switch, `close` on sign-out, `erase` once the server
// confirmed the account's permanent deletion; nothing else opens an account
// database.
//
// Layout, all under `files.root`, in directories excluded from backup and
// device transfer:
//   <environment>/installation                     this installation's ID
//   <environment>/<installation>/<account>.db      the account's database (+ -wal, -shm)
// Secure storage (device-only entries), keyed the same way:
//   tableside.<environment>.installation           the installation ID, again
//   tableside.<environment>.<installation>.<account>.key
//   tableside.<environment>.keys                   every key name above, recorded before it is written
//
// The installation ID counts only when the file and the device-only keychain
// entry agree, so neither restored files nor keychain entries that outlive a
// reinstall can bring an identity back: a new installation registers afresh,
// and an earlier installation's keys are never used. An account database left
// by an earlier installation on these files is never opened or replaced: that
// account is Recovery needed here.
//
// Another environment's namespace (a beta build's, under a production build
// installed over it) is never opened; `removeEnvironment` erases it: its keys,
// installation identity, databases and sidecars. Secure storage can't list its
// entries, so the vault records each key name before writing the key, and
// removal finds every key that way, even one whose files are gone.
//
// Key states: a locked device means wait for the unlock. A lost or unreadable
// key or database means Recovery needed: the original bytes stay exactly as
// they are and no empty replacement is ever created.

import { ENVIRONMENT_NAMES, type EnvironmentName } from '@tableside/account/environment';
import { hex } from '@tableside/account/values';

import { openMigrated, type MigrationFiles } from './migration-runner';
import { SqliteActivityStore, StoreMismatchError, type StoreIdentity } from './sqlite-store';
import { isDatabaseKey, SqlError, type SqlDriver, type SqlErrorKind } from './sql';
import { STORE_MIGRATIONS, type StoreMigration } from './store-schema';

export type KeyRead = { readonly status: 'found'; readonly value: string } | { readonly status: 'missing' } | { readonly status: 'locked' };

/**
 * Secure storage for key material: device-only entries, never in a backup or
 * device transfer (SecureStore in the app). "locked" when the device is locked
 * and the entry can't be read or written yet.
 */
export interface VaultKeyStore {
  read(name: string): Promise<KeyRead>;
  write(name: string, value: string): Promise<'written' | 'locked'>;
  /** Removes the entry, if there is one. */
  remove(name: string): Promise<'removed' | 'locked'>;
}

/** The vault's files. Paths are `root` joined with "/" segments. */
export interface VaultFiles extends MigrationFiles {
  readonly root: string;
  /** Creates the directory (and its parents) when absent, excluded from backup and device transfer. */
  ensureDirectory(path: string): Promise<void>;
  /** The names of the entries in a directory; none when it doesn't exist. */
  list(path: string): Promise<string[]>;
  /** Removes the file or directory (with everything in it), if there is one. */
  remove(path: string): Promise<void>;
}

export interface VaultPorts {
  /** The backend environment this build talks to (#39): data and keys are namespaced by it. */
  readonly environment: EnvironmentName;
  readonly keys: VaultKeyStore;
  readonly files: VaultFiles;
  readonly driver: SqlDriver;
  /** Secure random bytes, for keys. */
  randomBytes(length: number): Uint8Array;
  /** A fresh random identifier, for a new installation. */
  newId(): string;
  /** Resolves when the device may have been unlocked (the app came to the foreground); the vault then tries again. */
  unlocked(): Promise<void>;
  /** This build's store migrations (store-schema.ts); tests stand in a later build's. */
  readonly migrations?: readonly StoreMigration[];
}

/** An account's database, open for the current account session. */
export interface AccountSession extends StoreIdentity {
  readonly generation: number;
  /** The account's store: spec 1's store port. It stops working when the generation moves on. */
  readonly store: SqliteActivityStore;
}

/**
 * key-missing: the database exists but its key is gone (on this installation,
 * or the database was left by an earlier installation). key-corrupt: the key
 * entry can't be read as a key. database-missing: the key says a database was
 * created, but there is none. database-unreadable: the database can't be opened
 * with its key, or isn't this account's.
 */
export type RecoveryReason = 'key-missing' | 'key-corrupt' | 'database-missing' | 'database-unreadable';

export type VaultOpening =
  | { readonly status: 'open'; readonly session: AccountSession }
  /** The account gate's Recovery needed: nothing was opened, changed or created. */
  | { readonly status: 'recovery-needed'; readonly accountId: string; readonly generation: number; readonly reason: RecoveryReason }
  /**
   * The database has a later build's schema (a rollback): this build can't read
   * it, so nothing was opened or changed. The app needs updating.
   */
  | { readonly status: 'needs-update'; readonly accountId: string; readonly generation: number; readonly schema: number | null }
  /**
   * Bringing the database to this build's schema failed (for example a full
   * disk): it is exactly as the earlier build left it, and the next open tries again.
   */
  | { readonly status: 'migration-failed'; readonly accountId: string; readonly generation: number; readonly reason: SqlErrorKind }
  /** A later sign-in or sign-out replaced this one while it waited. */
  | { readonly status: 'superseded' };

/** The key entry: the database key, and whether its database was created. */
interface KeyRecord {
  readonly v: 1;
  readonly key: string;
  readonly created: boolean;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Where an environment's files and secure-storage entries live. */
const namespace = {
  directory: (root: string, environment: EnvironmentName) => `${root}/${environment}`,
  installationKey: (environment: EnvironmentName) => `tableside.${environment}.installation`,
  accountKey: (environment: EnvironmentName, installationId: string, accountId: string) => `tableside.${environment}.${installationId}.${accountId}.key`,
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

  /** The account-session generation: it moves on at every sign-in, sign-out and account switch. */
  get generation(): number {
    return this.currentGeneration;
  }

  /**
   * Starts a new account session (a sign-in, or an account switch when another
   * account is open): closes any open database, then opens this account's.
   * Waits while the device is locked.
   */
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

  /** Ends the account session (a sign-out): closes the database and keeps it, with its key, for the next sign-in. */
  async close(): Promise<void> {
    this.currentGeneration++;
    await this.serial(() => this.closeOpen());
  }

  /**
   * Erases one account's data in this environment, once the server confirmed
   * its permanent deletion: closes its database if it is open, removes every
   * installation's database for it with its sidecars, migration backup and
   * manifest (pending uploads and staged files live in the database), then its
   * keys. Every other account's database and key stay, and so does the
   * installation identity. An interrupted erase finishes the next time. Waits
   * while the device is locked.
   */
  async erase(accountId: string): Promise<void> {
    if (!ID_PATTERN.test(accountId)) throw new Error('invalid account id');
    this.currentGeneration++;
    while ((await this.serial(() => this.eraseAccount(accountId))) === 'locked') await this.ports.unlocked();
  }

  /**
   * Erases everything another environment left on this device: every account
   * key, the installation identity, then the databases and their sidecars.
   * Keys go first, because the files are how their names are found; an
   * interrupted removal finishes the next time. Waits while the device is
   * locked.
   */
  async removeEnvironment(environment: EnvironmentName): Promise<void> {
    if (!ENVIRONMENT_NAMES.includes(environment)) throw new Error(`invalid environment ${environment}`);
    if (environment === this.ports.environment) throw new Error('a vault never removes its own environment');
    while ((await this.serial(() => this.removeNamespace(environment))) === 'locked') await this.ports.unlocked();
  }

  /**
   * For an asynchronous completion (a response, callback, job or timer): runs
   * `apply` only if the generation it started under is still current, and
   * otherwise drops it.
   */
  ifCurrent<T>(generation: number, apply: () => T): { readonly applied: true; readonly value: T } | { readonly applied: false } {
    return generation === this.currentGeneration ? { applied: true, value: apply() } : { applied: false };
  }

  private async attempt(accountId: string, generation: number): Promise<VaultOpening | 'locked'> {
    const { environment, files, keys } = this.ports;
    const installationId = await this.installationId();
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
      // A database without its key, here or left by an earlier installation: keep it as it is.
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
      // The key says whether its database was made: then a missing one is never replaced by an empty one.
      const database = await openMigrated({ driver: this.ports.driver, files, migrations }, path, record.key, record.created);
      if (database.status === 'missing') return recovery('database-missing');
      if (database.status === 'needs-update') return { status: 'needs-update', accountId, generation, schema: database.schema };
      if (database.status === 'migration-failed') return { status: 'migration-failed', accountId, generation, reason: database.reason };
      store = await SqliteActivityStore.open(database.connection, identity, { isCurrent: () => this.currentGeneration === generation, migrations });
    } catch (error) {
      if ((error instanceof SqlError && error.kind === 'unreadable') || error instanceof StoreMismatchError) return recovery('database-unreadable');
      throw error;
    }
    // A write the lock refuses is retried at the next open, which finds the database and opens it.
    if (!record.created) await keys.write(keyName, JSON.stringify({ ...record, created: true }));
    // A sign-out or another sign-in overtook this one while it opened: close what it opened.
    if (generation !== this.currentGeneration) {
      await store.close();
      return SUPERSEDED;
    }
    const session: AccountSession = { ...identity, generation, store };
    this.openSession = session;
    return { status: 'open', session };
  }

  private async removeNamespace(environment: EnvironmentName): Promise<'removed' | 'locked'> {
    const { files, keys } = this.ports;
    const directory = namespace.directory(files.root, environment);
    const index = await this.readKeyIndex(environment);
    if (index === 'locked') return 'locked';
    // The index names every key; the files are a fallback for keys written before it existed.
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
      // The database, -wal, -shm, .migration, .migration-backup (and its logs), .restoring.
      for (const file of await files.list(`${directory}/${installation}`)) {
        if (file.startsWith(database)) await files.remove(`${directory}/${installation}/${file}`);
      }
    }
    // The files first: a key outliving its database is harmless, the reverse would be Recovery needed.
    for (const name of names) if ((await keys.remove(name)) === 'locked') return 'locked';
    const remaining = index.filter((name) => !names.has(name));
    if (remaining.length !== index.length && (await keys.write(namespace.keyIndex(environment), JSON.stringify(remaining))) === 'locked') return 'locked';
    return 'erased';
  }

  /** Records a key name in this environment's index before the key is written, so removal can always find it. */
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

  /** Whether an earlier installation's directory on these files holds a database for the account. */
  private async earlierDatabase(installationId: string, accountId: string): Promise<boolean> {
    const directory = namespace.directory(this.ports.files.root, this.ports.environment);
    for (const name of await this.ports.files.list(directory)) {
      if (name !== installationId && ID_PATTERN.test(name) && ((await this.ports.files.size(`${directory}/${name}/${accountId}.db`)) ?? 0) > 0) return true;
    }
    return false;
  }

  /** This installation's ID: valid only when the file and the device-only keychain entry agree; otherwise a new one. */
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
    // Not a key record.
  }
  return null;
}

// The account vault (spec 2, *Modules*): one encrypted database and one random
// key per (environment, account, installation), the account-session
// generation, locked-versus-lost key handling and backup exclusion. The
// account service drives it on sign-in, sign-out and account switch; nothing
// else opens an account database.
//
// Layout, all under `files.root`, in directories excluded from backup and
// device transfer:
//   <environment>/installation                     this installation's ID
//   <environment>/<installation>/<account>.db      the account's database (+ -wal, -shm)
// Secure storage (device-only entries), keyed the same way:
//   tableside.<environment>.installation           the installation ID, again
//   tableside.<environment>.<installation>.<account>.key
//
// The installation ID counts only when the file and the device-only keychain
// entry agree, so neither restored files nor keychain entries that outlive a
// reinstall can bring an identity back: a new installation registers afresh,
// and an earlier installation's databases and keys are never looked at.
//
// Key states: a locked device means wait for the unlock. A lost or unreadable
// key or database means Recovery needed: the original bytes stay exactly as
// they are and no empty replacement is ever created.

import { SqliteActivityStore, StoreMismatchError } from './sqlite-store';
import { SqlError, type SqlDriver } from './sql';

export type KeyRead = { readonly status: 'found'; readonly value: string } | { readonly status: 'missing' } | { readonly status: 'locked' };

/**
 * Secure storage for key material: device-only entries, never in a backup or
 * device transfer (SecureStore in the app). "locked" when the device is locked
 * and the entry can't be read or written yet.
 */
export interface VaultKeyStore {
  read(name: string): Promise<KeyRead>;
  write(name: string, value: string): Promise<'written' | 'locked'>;
}

/** The vault's files. Paths are `root` joined with "/" segments. */
export interface VaultFiles {
  readonly root: string;
  /** Creates the directory (and its parents) when absent, excluded from backup and device transfer. */
  ensureDirectory(path: string): Promise<void>;
  /** The file's size in bytes, or null when there is no file. */
  size(path: string): Promise<number | null>;
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
}

export interface VaultPorts {
  /** The backend environment this build talks to (#39): data and keys are namespaced by it. */
  readonly environment: string;
  readonly keys: VaultKeyStore;
  readonly files: VaultFiles;
  readonly driver: SqlDriver;
  /** Secure random bytes, for keys. */
  randomBytes(length: number): Uint8Array;
  /** A fresh random identifier, for a new installation. */
  newId(): string;
  /** Resolves when the device may have been unlocked (the app came to the foreground); the vault then tries again. */
  unlocked(): Promise<void>;
}

/** An account's database, open for the current account session. */
export interface AccountSession {
  readonly environment: string;
  readonly accountId: string;
  readonly installationId: string;
  readonly generation: number;
  /** The account's store: spec 1's store port. It stops working when the generation moves on. */
  readonly store: SqliteActivityStore;
}

/**
 * key-missing: the database exists but its key is gone. key-corrupt: the key
 * entry can't be read as a key. database-missing: the key says a database was
 * created, but there is none. database-unreadable: the database can't be opened
 * with its key, or isn't this account's.
 */
export type RecoveryReason = 'key-missing' | 'key-corrupt' | 'database-missing' | 'database-unreadable';

export type VaultOpening =
  | { readonly status: 'open'; readonly session: AccountSession }
  /** The account gate's Recovery needed: nothing was opened, changed or created. */
  | { readonly status: 'recovery-needed'; readonly accountId: string; readonly generation: number; readonly reason: RecoveryReason }
  /** A later sign-in or sign-out replaced this one while it waited. */
  | { readonly status: 'superseded' };

/** The key entry: the database key, and whether its database was created. */
interface KeyRecord {
  readonly v: 1;
  readonly key: string;
  readonly created: boolean;
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const ENVIRONMENT = /^[a-z0-9-]{1,32}$/;
const KEY_BYTES = 32;

export class AccountVault {
  private current = 0;
  private open: AccountSession | null = null;
  private installation: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly ports: VaultPorts) {
    if (!ENVIRONMENT.test(ports.environment)) throw new Error(`invalid environment ${ports.environment}`);
  }

  /** The account-session generation: it moves on at every sign-in, sign-out and account switch. */
  get generation(): number {
    return this.current;
  }

  /**
   * Opens the account's database for a new account session, closing any other
   * first: a sign-in, or an account switch when another account is open.
   * Waits while the device is locked.
   */
  async signIn(accountId: string): Promise<VaultOpening> {
    if (!ID.test(accountId)) throw new Error('invalid account id');
    const generation = ++this.current;
    for (;;) {
      const attempt = await this.serial(async () => {
        await this.closeOpen();
        return generation === this.current ? this.attempt(accountId, generation) : SUPERSEDED;
      });
      if (attempt !== 'locked') return attempt;
      await this.ports.unlocked();
      if (generation !== this.current) return SUPERSEDED;
    }
  }

  /** Ends the account session: closes the database and keeps it, with its key, for the next sign-in. */
  async signOut(): Promise<void> {
    this.current++;
    await this.serial(() => this.closeOpen());
  }

  /**
   * For an asynchronous completion (a response, callback, job or timer): runs
   * `apply` only if the generation it started under is still current, and
   * otherwise drops it.
   */
  ifCurrent<T>(generation: number, apply: () => T): { readonly applied: true; readonly value: T } | { readonly applied: false } {
    return generation === this.current ? { applied: true, value: apply() } : { applied: false };
  }

  private async attempt(accountId: string, generation: number): Promise<VaultOpening | 'locked'> {
    const { environment, files, keys } = this.ports;
    const installationId = await this.installationId();
    if (installationId === 'locked') return 'locked';
    const directory = `${files.root}/${environment}/${installationId}`;
    await files.ensureDirectory(directory);
    const path = `${directory}/${accountId}.db`;
    const keyName = `tableside.${environment}.${installationId}.${accountId}.key`;
    const recovery = (reason: RecoveryReason): VaultOpening => ({ status: 'recovery-needed', accountId, generation, reason });

    const read = await keys.read(keyName);
    if (read.status === 'locked') return 'locked';
    const exists = ((await files.size(path)) ?? 0) > 0;

    let record: KeyRecord;
    if (read.status === 'missing') {
      // A database without its key: keep it as it is.
      if (exists || (await files.size(`${path}-wal`)) !== null) return recovery('key-missing');
      record = { v: 1, key: hex(this.ports.randomBytes(KEY_BYTES)), created: false };
      if ((await keys.write(keyName, JSON.stringify(record))) === 'locked') return 'locked';
    } else {
      const parsed = parseKeyRecord(read.value);
      if (!parsed) return recovery('key-corrupt');
      record = parsed;
      // The key says its database was made: never make an empty one in its place.
      if (!exists && record.created) return recovery('database-missing');
    }

    let store: SqliteActivityStore;
    try {
      const identity = { environment, accountId, installationId };
      store = await SqliteActivityStore.open(await this.ports.driver.open(path, record.key), identity, { isCurrent: () => this.current === generation });
    } catch (error) {
      if ((error instanceof SqlError && error.kind === 'unreadable') || error instanceof StoreMismatchError) return recovery('database-unreadable');
      throw error;
    }
    // A write the lock refuses is retried at the next open, which finds the database and opens it.
    if (!record.created) await keys.write(keyName, JSON.stringify({ ...record, created: true }));
    const session: AccountSession = { environment, accountId, installationId, generation, store };
    this.open = session;
    return { status: 'open', session };
  }

  /** This installation's ID: valid only when the file and the device-only keychain entry agree; otherwise a new one. */
  private async installationId(): Promise<string | 'locked'> {
    if (this.installation) return this.installation;
    const { environment, files, keys } = this.ports;
    const directory = `${files.root}/${environment}`;
    await files.ensureDirectory(directory);
    const path = `${directory}/installation`;
    const name = `tableside.${environment}.installation`;
    const entry = await keys.read(name);
    if (entry.status === 'locked') return 'locked';
    const file = await files.readText(path);
    if (entry.status === 'found' && file === entry.value && ID.test(file)) return (this.installation = file);
    const id = this.ports.newId();
    if (!ID.test(id)) throw new Error('invalid installation id');
    if ((await keys.write(name, id)) === 'locked') return 'locked';
    await files.writeText(path, id);
    return (this.installation = id);
  }

  private async closeOpen(): Promise<void> {
    const open = this.open;
    this.open = null;
    await open?.store.close();
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
    if (value.v === 1 && typeof value.key === 'string' && /^[0-9a-f]{64}$/.test(value.key) && typeof value.created === 'boolean') {
      return { v: 1, key: value.key, created: value.created };
    }
  } catch {
    // Not a key record.
  }
  return null;
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

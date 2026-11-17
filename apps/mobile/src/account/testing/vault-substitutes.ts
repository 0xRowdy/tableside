import { randomBytes, randomUUID } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { EnvironmentName } from '@tableside/account/environment';

import { AccountVault, type KeyRead, type VaultFiles, type VaultKeyStore } from '../vault';
import type { SqlConnection, SqlDriver, SqlExecutor } from '../sql';
import type { StoreMigration } from '../store-schema';
import { nodeSqlCipherDriver } from './node-sqlcipher';

export class FakeKeychain implements VaultKeyStore {
  locked = false;
  private readonly values = new Map<string, string>();

  async read(name: string): Promise<KeyRead> {
    if (this.locked) return { status: 'locked' };
    const value = this.values.get(name);
    return value === undefined ? { status: 'missing' } : { status: 'found', value };
  }

  async write(name: string, value: string): Promise<'written' | 'locked'> {
    if (this.locked) return 'locked';
    this.values.set(name, value);
    return 'written';
  }

  async remove(name: string): Promise<'removed' | 'locked'> {
    if (this.locked) return 'locked';
    this.values.delete(name);
    return 'removed';
  }

  entries(): [string, string][] {
    return [...this.values.entries()];
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  set(name: string, value: string): void {
    this.values.set(name, value);
  }

  forget(name: string): void {
    this.values.delete(name);
  }
}

export interface NodeVaultFiles extends VaultFiles {
  written(): string[];
  excluded(): string[];
}

export function nodeVaultFiles(root: string): NodeVaultFiles {
  const excluded = new Set<string>();
  const walk = (directory: string): string[] =>
    existsSync(directory)
      ? readdirSync(directory).flatMap((name) => {
          const path = join(directory, name);
          return statSync(path).isDirectory() ? walk(path) : [path];
        })
      : [];
  return {
    root,
    async ensureDirectory(path) {
      mkdirSync(path, { recursive: true });
      excluded.add(path);
    },
    async list(path) {
      return existsSync(path) ? readdirSync(path) : [];
    },
    async size(path) {
      return existsSync(path) ? statSync(path).size : null;
    },
    async readText(path) {
      return existsSync(path) ? readFileSync(path, 'utf8') : null;
    },
    async writeText(path, text) {
      writeFileSync(path, text, { flush: true });
    },
    async copy(from, to) {
      copyFileSync(from, to);
      const descriptor = openSync(to, 'r+');
      fsyncSync(descriptor);
      closeSync(descriptor);
    },
    async move(from, to) {
      renameSync(from, to);
    },
    async remove(path) {
      rmSync(path, { recursive: true, force: true });
    },
    written: () => walk(root),
    excluded: () => [...excluded],
  };
}

export class DeviceKilled extends Error {
  constructor() {
    super('the device was killed');
    this.name = 'DeviceKilled';
  }
}

export class TestDevice {
  readonly root = mkdtempSync(join(tmpdir(), 'tableside-vault-'));
  keychain = new FakeKeychain();
  files: NodeVaultFiles = this.dying(nodeVaultFiles(this.root));
  private unlockWaiters: (() => void)[] = [];
  private operations = 0;
  private death: number | null = null;
  private refused = false;

  killAt(count: number): void {
    this.death = this.operations + count;
    this.refused = false;
  }

  get killed(): boolean {
    return this.refused;
  }

  revive(): void {
    this.death = null;
    this.refused = false;
  }

  private operation(): void {
    if (this.death !== null && this.operations >= this.death) {
      this.refused = true;
      throw new DeviceKilled();
    }
    this.operations++;
  }

  private dying(files: NodeVaultFiles): NodeVaultFiles {
    const step =
      <A extends unknown[], R>(run: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        this.operation();
        return run(...args);
      };
    return {
      ...files,
      ensureDirectory: step(files.ensureDirectory),
      list: step(files.list),
      size: step(files.size),
      readText: step(files.readText),
      writeText: step(files.writeText),
      copy: step(files.copy),
      move: step(files.move),
      remove: step(files.remove),
    };
  }

  private dyingDriver(driver: SqlDriver): SqlDriver {
    const statements = (tx: SqlExecutor): SqlExecutor => ({
      run: (sql, params) => Promise.resolve().then(() => this.operation()).then(() => tx.run(sql, params)),
      get: <T>(sql: string, params?: Parameters<SqlExecutor['get']>[1]) => Promise.resolve().then(() => this.operation()).then(() => tx.get<T>(sql, params)),
      all: <T>(sql: string, params?: Parameters<SqlExecutor['all']>[1]) => Promise.resolve().then(() => this.operation()).then(() => tx.all<T>(sql, params)),
    });
    return {
      open: async (path, keyHex) => {
        this.operation();
        const connection = await driver.open(path, keyHex);
        const dying: SqlConnection = {
          transaction: (work) =>
            connection.transaction(async (tx) => {
              const result = await work(statements(tx));
              this.operation();
              return result;
            }),
          checkpoint: async () => {
            this.operation();
            await connection.checkpoint();
          },
          close: () => connection.close(),
        };
        return dying;
      },
    };
  }

  vault(environment: EnvironmentName = 'production', driver: SqlDriver = nodeSqlCipherDriver(), migrations?: readonly StoreMigration[]): AccountVault {
    return new AccountVault({
      ...(migrations ? { migrations } : {}),
      environment,
      keys: this.keychain,
      files: this.files,
      driver: this.dyingDriver(driver),
      randomBytes: (length) => new Uint8Array(randomBytes(length)),
      newId: () => `installation-${randomUUID()}`,
      unlocked: () => new Promise((resolve) => this.unlockWaiters.push(resolve)),
    });
  }

  unlock(): void {
    this.keychain.locked = false;
    const waiters = this.unlockWaiters;
    this.unlockWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  get waitingForUnlock(): number {
    return this.unlockWaiters.length;
  }

  async leaveDatabase(
    identity: { readonly environment: string; readonly accountId: string; readonly installationId: string },
    fill: (connection: SqlConnection) => Promise<void>,
    driver: SqlDriver = nodeSqlCipherDriver(),
  ): Promise<void> {
    const { environment, accountId, installationId } = identity;
    const directory = join(this.root, environment, installationId);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(this.root, environment, 'installation'), installationId);
    this.keychain.set(`tableside.${environment}.installation`, installationId);
    const key = randomBytes(32).toString('hex');
    this.keychain.set(`tableside.${environment}.${installationId}.${accountId}.key`, JSON.stringify({ v: 1, key, created: true }));
    const connection = await driver.open(join(directory, `${accountId}.db`), key);
    try {
      await fill(connection);
    } finally {
      await connection.close();
    }
  }

  remove(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

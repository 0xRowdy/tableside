// Substitutes for the account vault's device ports in tests: a keychain that
// can be locked, real files under a temporary root that remember which
// directories were excluded from backup, and a test device putting them
// together with real SQLCipher (Node).

import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AccountVault, type KeyRead, type VaultFiles, type VaultKeyStore } from '../vault';
import type { SqlDriver } from '../sql';
import { nodeSqlCipherDriver } from './node-sqlcipher';

/** A device keychain. While `locked`, it answers nothing, as iOS does for a device-only entry on a locked device. */
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

  entries(): [string, string][] {
    return [...this.values.entries()];
  }

  get(name: string): string | undefined {
    return this.values.get(name);
  }

  set(name: string, value: string): void {
    this.values.set(name, value);
  }

  remove(name: string): void {
    this.values.delete(name);
  }
}

export interface NodeVaultFiles extends VaultFiles {
  /** Every file under the root, including the ones SQLite writes beside a database. */
  written(): string[];
  /** The directories the vault asked to exclude from backup and device transfer. */
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
    written: () => walk(root),
    excluded: () => [...excluded],
  };
}

/** One device: its keychain and files survive across vault instances (app restarts). */
export class TestDevice {
  readonly root = mkdtempSync(join(tmpdir(), 'tableside-vault-'));
  keychain = new FakeKeychain();
  files: NodeVaultFiles = nodeVaultFiles(this.root);
  private unlockWaiters: (() => void)[] = [];

  vault(environment = 'production', driver: SqlDriver = nodeSqlCipherDriver()): AccountVault {
    return new AccountVault({
      environment,
      keys: this.keychain,
      files: this.files,
      driver,
      randomBytes: (length) => new Uint8Array(randomBytes(length)),
      newId: () => `installation-${randomUUID()}`,
      unlocked: () => new Promise((resolve) => this.unlockWaiters.push(resolve)),
    });
  }

  /** The device unlocks: the keychain answers again and the vault hears about it. */
  unlock(): void {
    this.keychain.locked = false;
    const waiters = this.unlockWaiters;
    this.unlockWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  get waitingForUnlock(): number {
    return this.unlockWaiters.length;
  }

  /** Deletes the device's files. */
  remove(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

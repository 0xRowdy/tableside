// Substitutes for the account vault's device ports in tests: a keychain that
// can be locked, and real files under a temporary root that remember which
// directories were excluded from backup.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { KeyRead, VaultFiles, VaultKeyStore } from '../vault';

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

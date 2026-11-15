// A Node SQLite stand-in for the account vault (#85 builds the real one on
// Expo SQLite with SQLCipher): one database file per (environment, account,
// installation) in the simulated device's own directory.

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { EnvironmentName } from '../environment';
import type { AccountVault, VaultOpening } from '../service';

export class NodeSqliteVault implements AccountVault {
  private database: DatabaseSync | null = null;
  /** The account whose database is open, if any. */
  openAccount: string | null = null;
  /** The environments whose namespaces were removed, in order. */
  readonly removed: EnvironmentName[] = [];

  constructor(
    private readonly directory: string,
    private readonly environment: EnvironmentName,
    private readonly installationId: string,
  ) {}

  /** The directory holding an environment's databases on this device. */
  namespace(environment: EnvironmentName): string {
    return path.join(this.directory, environment);
  }

  async open(accountId: string): Promise<VaultOpening> {
    await this.close();
    const directory = path.join(this.namespace(this.environment), this.installationId);
    mkdirSync(directory, { recursive: true });
    this.database = new DatabaseSync(path.join(directory, `${accountId}.sqlite`));
    this.openAccount = accountId;
    return { status: 'open' };
  }

  async close(): Promise<void> {
    this.database?.close();
    this.database = null;
    this.openAccount = null;
  }

  async removeEnvironment(environment: EnvironmentName): Promise<void> {
    if (environment === this.environment) throw new Error('a vault never removes its own environment');
    rmSync(this.namespace(environment), { recursive: true, force: true });
    this.removed.push(environment);
  }

  /** Whether any of an environment's data is still on the device. */
  holds(environment: EnvironmentName): boolean {
    return existsSync(this.namespace(environment));
  }
}

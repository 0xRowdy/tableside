// A Node SQLite stand-in for the account vault (#85 builds the real one on
// Expo SQLite with SQLCipher): one database file per (account, installation)
// in the simulated device's own directory.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { AccountVault } from '../service';

export class NodeSqliteVault implements AccountVault {
  private database: DatabaseSync | null = null;
  /** The account whose database is open, if any. */
  openAccount: string | null = null;

  constructor(
    private readonly directory: string,
    private readonly installationId: string,
  ) {}

  async open(accountId: string): Promise<void> {
    await this.close();
    const directory = path.join(this.directory, this.installationId);
    mkdirSync(directory, { recursive: true });
    this.database = new DatabaseSync(path.join(directory, `${accountId}.sqlite`));
    this.openAccount = accountId;
  }

  async close(): Promise<void> {
    this.database?.close();
    this.database = null;
    this.openAccount = null;
  }
}

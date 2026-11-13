// A database as data, for recorded databases (testing/recorded): its schema
// statements in creation order and every table's rows in rowid order, read
// and written through the store's own verified connection.

import type { SqlConnection } from '../sql';
import type { RecordedValue } from './recorded';

export interface DatabaseDump {
  readonly schema: readonly string[];
  readonly rows: Readonly<Record<string, readonly Readonly<Record<string, RecordedValue>>[]>>;
}

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

export function dumpDatabase(connection: SqlConnection): Promise<DatabaseDump> {
  return connection.transaction(async (tx) => {
    const entries = await tx.all<{ type: string; name: string; sql: string }>(
      "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
    );
    const rows: Record<string, Record<string, RecordedValue>[]> = {};
    for (const { name } of entries.filter((entry) => entry.type === 'table')) {
      rows[name] = await tx.all<Record<string, RecordedValue>>(`SELECT * FROM ${quoted(name)} ORDER BY rowid`);
    }
    return { schema: entries.map((entry) => entry.sql), rows };
  });
}

/** Writes a dump into an empty database. */
export function restoreDatabase(connection: SqlConnection, dump: DatabaseDump): Promise<void> {
  return connection.transaction(async (tx) => {
    for (const statement of dump.schema) await tx.run(statement);
    for (const [table, rows] of Object.entries(dump.rows)) {
      for (const row of rows) {
        const columns = Object.keys(row);
        await tx.run(`INSERT INTO ${quoted(table)} (${columns.map(quoted).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, Object.values(row));
      }
    }
  });
}

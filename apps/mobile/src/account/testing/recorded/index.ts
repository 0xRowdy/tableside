// Account databases recorded by builds, one module per store schema (#86,
// launch gate 2), written by scripts/record-databases.ts. Like the engine's
// recorded checkpoints, a released schema's recording is never edited or
// removed afterwards (its SHA-256 is in released.json, checked by
// __tests__/recorded-databases.test.ts), so every later build must keep
// upgrading each one directly, skipped releases included. The build under
// development keeps its own recording, re-recorded with --replace while its
// schema is unreleased.
//
// A recording is each database's schema statements and rows, exactly as the
// recording build's store wrote them: the test restores them into a fresh
// encrypted database and opens it as an update would. The values are plain
// data, typed loosely on purpose: they are what an older build wrote.
import type { DatabaseDump } from '../database-dump';
import { RECORDED_STORE_SCHEMA_1 } from './store-schema-1';

/** One account database, as its schema and rows. */
export interface RecordedDatabase extends DatabaseDump {
  readonly name: string;
  readonly environment: string;
  readonly accountId: string;
  readonly installationId: string;
  /** The unfinished practice session the database holds, and its final cash-out when resumed and ended (from the engine recording). */
  readonly unfinished: { readonly activityId: string; readonly game: string; readonly phase: string; readonly finalCashOut: string } | null;
}

export interface RecordedStoreSchema {
  /** The store schema version: its own identity, separate from the engine and state schema the checkpoints inside carry. */
  readonly storeSchema: number;
  /** The engine version and state schema that wrote the checkpoints. */
  readonly engine: string;
  readonly stateSchema: number;
  readonly databases: readonly RecordedDatabase[];
}

/** Every store schema's recorded databases, oldest first. A release with a new schema appends its own. */
export const RECORDED_STORE_SCHEMAS: readonly RecordedStoreSchema[] = [RECORDED_STORE_SCHEMA_1];

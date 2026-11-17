// docs/development.md Releases: recorded checkpoints and the quarantine list
import type { DatabaseDump } from '../database-dump';
import { RECORDED_STORE_SCHEMA_3 } from './store-schema-3';

export interface RecordedDatabase extends DatabaseDump {
  readonly name: string;
  readonly environment: string;
  readonly accountId: string;
  readonly installationId: string;
  readonly unfinished: { readonly activityId: string; readonly game: string; readonly phase: string; readonly finalCashOut: string } | null;
  // #158
  readonly unfinishedAttempt?: { readonly attemptId: string; readonly phase: string; readonly position: number } | null;
}

export interface RecordedStoreSchema {
  readonly storeSchema: number;
  readonly engine: string;
  readonly stateSchema: number;
  readonly databases: readonly RecordedDatabase[];
}

export const RECORDED_STORE_SCHEMAS: readonly RecordedStoreSchema[] = [RECORDED_STORE_SCHEMA_3];

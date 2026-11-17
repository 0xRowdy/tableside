// docs/development.md Releases: recorded checkpoints and the quarantine list
import type { DatabaseDump } from '../database-dump';
import { RECORDED_STORE_SCHEMA_1 } from './store-schema-1';

export interface RecordedDatabase extends DatabaseDump {
  readonly name: string;
  readonly environment: string;
  readonly accountId: string;
  readonly installationId: string;
  readonly unfinished: { readonly activityId: string; readonly game: string; readonly phase: string; readonly finalCashOut: string } | null;
}

export interface RecordedStoreSchema {
  readonly storeSchema: number;
  readonly engine: string;
  readonly stateSchema: number;
  readonly databases: readonly RecordedDatabase[];
}

export const RECORDED_STORE_SCHEMAS: readonly RecordedStoreSchema[] = [RECORDED_STORE_SCHEMA_1];

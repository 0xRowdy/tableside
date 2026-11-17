// docs/development.md Releases: recorded checkpoints and the quarantine list
import { RECORDED_ENGINE_0_0_0_SCHEMA_7 } from './engine-0.0.0-schema-7';

export interface RecordedCheckpoint {
  readonly name: string;
  readonly game: string;
  readonly phase: string;
  readonly specification: unknown;
  readonly random: unknown;
  readonly checkpoint: string;
  readonly continuation: readonly unknown[];
  readonly facts: string;
  readonly finalBalance: string;
}

export interface RecordedBuild {
  readonly engine: string;
  readonly schema: number;
  readonly checkpoints: readonly RecordedCheckpoint[];
}

export const RECORDED_BUILDS: readonly RecordedBuild[] = [RECORDED_ENGINE_0_0_0_SCHEMA_7];

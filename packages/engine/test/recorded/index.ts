// docs/development.md Releases: recorded checkpoints and the quarantine list
import { RECORDED_ENGINE_0_0_0_SCHEMA_13 } from './engine-0.0.0-schema-13';

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

// #158
export interface RecordedChallenge {
  readonly name: string;
  readonly category: string;
  readonly phase: string;
  readonly specification: unknown;
  readonly random: unknown;
  readonly checkpoint: string;
  readonly continuation: readonly unknown[];
  readonly facts: string;
  readonly results: string;
}

export interface RecordedBuild {
  readonly engine: string;
  readonly schema: number;
  readonly checkpoints: readonly RecordedCheckpoint[];
  readonly challenges?: readonly RecordedChallenge[];
}

export const RECORDED_BUILDS: readonly RecordedBuild[] = [RECORDED_ENGINE_0_0_0_SCHEMA_13];

// Checkpoints recorded by builds (#80, launch gate 3), one module per build,
// written by scripts/record-checkpoints.ts. A released build's recording is
// never edited or removed afterwards (its hash is in released.json, checked by
// tests/recorded-checkpoints.test.ts): an unfinished activity is never aged out
// to drop compatibility code, so every later build must keep resuming all of
// them. The build under development keeps its own recording, re-recorded with
// --replace while it changes; no build has been released yet. The values are
// plain JSON, typed loosely on purpose: they are what an older build wrote, not
// what this build's types say.
import { RECORDED_ENGINE_0_0_0_SCHEMA_3 } from './engine-0.0.0-schema-3';

export interface RecordedCheckpoint {
  readonly name: string;
  readonly game: string;
  readonly phase: string;
  /** The activity's specification and random identity, as the store held them beside the checkpoint. */
  readonly specification: unknown;
  readonly random: unknown;
  /** The canonical checkpoint text the build wrote. */
  readonly checkpoint: string;
  /** Commands the recording build then committed, to completion. */
  readonly continuation: readonly unknown[];
  /** Canonical JSON of every fact the continuation produced on the recording build. */
  readonly facts: string;
  /** The balance at completion: the final cash-out. */
  readonly finalBalance: string;
}

export interface RecordedBuild {
  readonly engine: string;
  readonly schema: number;
  readonly checkpoints: readonly RecordedCheckpoint[];
}

/** Every build's recorded checkpoints, oldest first. A release appends its own. */
export const RECORDED_BUILDS: readonly RecordedBuild[] = [RECORDED_ENGINE_0_0_0_SCHEMA_3];

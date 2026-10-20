// The headless runner runs the engine on Node. Its real job, standardized
// simulation, arrives with spec 6; for now it proves the engine and definitions
// load and run outside the app.
import { DEFINITIONS_VERSION } from '@tableside/definitions';
import { ENGINE_VERSION } from '@tableside/engine';

export interface RunnerInfo {
  engine: string;
  definitions: string;
  node: string;
}

export function runnerInfo(): RunnerInfo {
  return { engine: ENGINE_VERSION, definitions: DEFINITIONS_VERSION, node: process.version };
}

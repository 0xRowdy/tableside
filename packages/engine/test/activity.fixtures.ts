// Shared inputs for the engine-interface cases: a single-zero roulette free-play
// activity (and its double-zero twin) with the launch default limits (#3: inside 1-100, outside 10-1,000).
import {
  advanceActivity,
  type ActivitySpecification,
  type ActivityState,
  type AdvanceResult,
  type Command,
  type DomainFact,
} from '../src';

import { PI } from './fixtures';

export const SPEC: ActivitySpecification = {
  activityId: 'activity-1',
  owner: 'local',
  device: 'device-1',
  game: 'roulette',
  rules: {
    id: 'roulette-single-zero',
    version: 1,
    wheel: 'single-zero',
    limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } },
  },
  strategy: null,
  reference: null,
  funding: '1000',
};

/** The double-zero rule set at the same launch default limits. */
export const DOUBLE_ZERO: ActivitySpecification['rules'] = { ...SPEC.rules, id: 'roulette-double-zero', wheel: 'double-zero' };

/** The Random123 "pi digits" stream: its first single-zero spins are 27, 0, 25, 31, 9 (draws.cases). */
export const STREAM = PI;

/** Advances with the state's expected sequence and a command id derived from it; throws unless committed. */
export function step(state: ActivityState, command: Command): { state: ActivityState; facts: readonly DomainFact[] } {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`expected a committed transition, got ${JSON.stringify(result)}`);
  return { state: result.state, facts: result.facts };
}

/** Folds commands through `step`, collecting every fact. */
export function run(state: ActivityState, commands: Command[]): { state: ActivityState; facts: readonly DomainFact[] } {
  const facts: DomainFact[] = [];
  for (const command of commands) {
    const next = step(state, command);
    state = next.state;
    facts.push(...next.facts);
  }
  return { state, facts };
}

export const status = (result: AdvanceResult) =>
  result.status === 'rejected' ? `rejected:${result.reason}` : result.status;

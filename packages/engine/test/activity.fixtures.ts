// #3
import {
  advanceActivity,
  type RouletteActivitySpecification,
  type ActivityState,
  type AdvanceResult,
  type Command,
  type DomainFact,
} from '../src';

import { PI } from './fixtures';

export const SPEC: RouletteActivitySpecification = {
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
  fundingSource: 'practice-funding',
  funding: '1000',
};

export const DOUBLE_ZERO: RouletteActivitySpecification['rules'] = { ...SPEC.rules, id: 'roulette-double-zero', wheel: 'double-zero' };

export const STREAM = PI;

export function step<S extends ActivityState>(state: S, command: Command): { state: S; facts: readonly DomainFact[] } {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`expected a committed transition, got ${JSON.stringify(result)}`);
  return { state: result.state, facts: result.facts };
}

export function run<S extends ActivityState>(state: S, commands: Command[]): { state: S; facts: readonly DomainFact[] } {
  const facts: DomainFact[] = [];
  for (const command of commands) {
    const next = step(state, command);
    state = next.state;
    facts.push(...next.facts);
  }
  return { state, facts };
}

export const status = (result: AdvanceResult<ActivityState>) =>
  result.status === 'rejected' ? `rejected:${result.reason}` : result.status;

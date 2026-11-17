// Spec 3 Challenge content (from #4); #158
import { advanceChallenge, createChallenge, RANDOM_PROTOCOL_VERSION, type ChallengeCommand, type ChallengeSpecification, type ChallengeState, type RandomStreamIdentity } from '../src';

export const CARD_VALUES_V1 = { category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' } as const;

export const LEARN: ChallengeSpecification = { attemptId: 'attempt-1', owner: 'owner-1', device: 'device-1', variant: 'learn', content: CARD_VALUES_V1 };

export const seed = (n: number): RandomStreamIdentity => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [n, 0x9e3779b9], session: [n * 7 + 1, 0] });

export function step(state: ChallengeState, command: ChallengeCommand): ChallengeState {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}: ${JSON.stringify(result)}`);
  return result.state;
}

export const run = (state: ChallengeState, commands: readonly ChallengeCommand[]) => commands.reduce(step, state);

export const begun = (spec: ChallengeSpecification = LEARN, random: RandomStreamIdentity = seed(1)) => step(createChallenge(spec, random), { kind: 'begin' });

export const ANSWER = (value: -1 | 0 | 1): ChallengeCommand => ({ kind: 'answer', value });
export const NEXT: ChallengeCommand = { kind: 'next-item' };
export const RETRY: ChallengeCommand = { kind: 'retry-item' };
export const SKIP: ChallengeCommand = { kind: 'skip' };

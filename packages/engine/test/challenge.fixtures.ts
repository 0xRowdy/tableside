// Spec 3 Challenge content (from #4); #158, #132
import {
  advanceChallenge,
  type CardValueItem,
  createChallenge,
  RANDOM_PROTOCOL_VERSION,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeSpecification,
  type ChallengeState,
  type CheckChallengeView,
  type LearnChallengeView,
  type RandomStreamIdentity,
} from '../src';

export const CARD_VALUES_V1 = { category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' } as const;

export const LEARN: ChallengeSpecification = { attemptId: 'attempt-1', owner: 'owner-1', device: 'device-1', variant: 'learn', content: CARD_VALUES_V1 };

export const CHECK: ChallengeSpecification = { ...LEARN, variant: 'check' };

export const RUNNING_COUNT_V1 = {
  category: 'running-count',
  id: 'running-count',
  version: 1,
  length: 52,
  decks: 6,
  checkpoints: [13, 26, 39, 52],
  reference: { id: 'blackjack-reference', version: 1 },
} as const;

export const COUNT_LEARN: ChallengeSpecification = { ...LEARN, content: RUNNING_COUNT_V1 };

export const COUNT_CHECK: ChallengeSpecification = { ...COUNT_LEARN, variant: 'check' };

// #134
export const CONVERSION_V1 = { category: 'conversion', id: 'conversion', version: 1, length: 10, maxRunningCount: 20, maxDecks: 6 } as const;

export const CONVERSION_LEARN: ChallengeSpecification = { ...LEARN, content: CONVERSION_V1 };

export const CONVERSION_CHECK: ChallengeSpecification = { ...CONVERSION_LEARN, variant: 'check' };

export const seed = (n: number): RandomStreamIdentity => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [n, 0x9e3779b9], session: [n * 7 + 1, 0] });

export function step(state: ChallengeState, command: ChallengeCommand): ChallengeState {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}: ${JSON.stringify(result)}`);
  return result.state;
}

export const run = (state: ChallengeState, commands: readonly ChallengeCommand[]) => commands.reduce(step, state);

export const begun = (spec: ChallengeSpecification = LEARN, random: RandomStreamIdentity = seed(1)) => step(createChallenge(spec, random), { kind: 'begin' });

export const ANSWER = (value: number): ChallengeCommand => ({ kind: 'answer', value });
export const NEXT: ChallengeCommand = { kind: 'next-item' };
export const RETRY: ChallengeCommand = { kind: 'retry-item' };
export const SKIP: ChallengeCommand = { kind: 'skip' };
export const REVEAL: ChallengeCommand = { kind: 'reveal-count' };

export function learnView(state: ChallengeState): LearnChallengeView {
  const view = readChallengeView(state);
  if (view.variant !== 'learn') throw new Error('expected a Learn view');
  return view;
}

export function checkView(state: ChallengeState): CheckChallengeView {
  const view = readChallengeView(state);
  if (view.variant !== 'check') throw new Error('expected a Check view');
  return view;
}

// #134
export const cardItems = (state: ChallengeState): CardValueItem[] =>
  state.items.map((item) => {
    if (!('card' in item)) throw new Error('expected card items');
    return item;
  });

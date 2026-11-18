// Spec 3 Challenge content › Table; #137
import type { BlackjackPlayPolicy, ChallengeSpecification, ObserveSetup, TableSetup } from '../src';

import { S17_LS, TEST_STRATEGY } from './blackjack.fixtures';
import { TEST_COUNTING_BASIC, TEST_COUNTING_DEVIATING } from './blackjack-strategy.fixtures';
import { LEARN } from './challenge.fixtures';

export const TABLE_V1 = { category: 'table', id: 'table', version: 1, rounds: 10, reference: { id: 'blackjack-reference', version: 1 } } as const;

export const OBSERVE: ObserveSetup = { seat: 'observe', rules: S17_LS, strategy: TEST_STRATEGY, interval: 1 };

export const tableSpec = (variant: 'learn' | 'check', setup: Partial<ObserveSetup> = {}): ChallengeSpecification => ({
  ...LEARN,
  variant,
  content: TABLE_V1,
  table: { ...OBSERVE, ...setup },
});

export const TABLE_LEARN = tableSpec('learn');

export const TABLE_CHECK = tableSpec('check');

// Spec 1 Game rules; Spec 3 Challenge content › Observe seats
export const withExtraPlayers = (count: number, penetration = S17_LS.penetration): Pick<TableSetup, 'rules'> => ({
  rules: {
    ...S17_LS,
    penetration,
    players: { learnerSeat: count, otherWagers: Array.from({ length: count }, () => S17_LS.limits.initial.min), strategy: count > 0 ? TEST_STRATEGY : null },
  },
});

// Spec 3 User stories 28; #138
export const PLAY_POLICY = { basic: TEST_COUNTING_BASIC.play, deviations: TEST_COUNTING_DEVIATING.play } as const;

// Spec 3 Play challenge funding (#20); #139
export const PLAY_FUNDING = { betSchedule: false, baseWager: '10', startingBalance: '1000' } as const;

export const playSetup = (mode: 'basic' | 'deviations', interval = 1): TableSetup => ({ seat: 'play', rules: S17_LS, policy: PLAY_POLICY[mode] as BlackjackPlayPolicy, interval, ...PLAY_FUNDING });

export const playSpec = (variant: 'learn' | 'check', mode: 'basic' | 'deviations', setup: Partial<TableSetup> = {}): ChallengeSpecification => ({
  ...LEARN,
  variant,
  content: TABLE_V1,
  table: { ...playSetup(mode), ...setup } as TableSetup,
});

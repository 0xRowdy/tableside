// Spec 3 Challenge content › Table; #137
import type { ChallengeSpecification, TableSetup } from '../src';

import { S17_LS, TEST_STRATEGY } from './blackjack.fixtures';
import { LEARN } from './challenge.fixtures';

export const TABLE_V1 = { category: 'table', id: 'table', version: 1, rounds: 10, reference: { id: 'blackjack-reference', version: 1 } } as const;

export const OBSERVE: TableSetup = { seat: 'observe', rules: S17_LS, strategy: TEST_STRATEGY, interval: 1 };

export const tableSpec = (variant: 'learn' | 'check', setup: Partial<TableSetup> = {}): ChallengeSpecification => ({
  ...LEARN,
  variant,
  content: TABLE_V1,
  table: { ...OBSERVE, ...setup },
});

export const TABLE_LEARN = tableSpec('learn');

export const TABLE_CHECK = tableSpec('check');

// Spec 1 Game rules: extra simulated players sit to the learner's right at the table minimum
export const withExtraPlayers = (count: number, penetration = S17_LS.penetration): Partial<TableSetup> => ({
  rules: {
    ...S17_LS,
    penetration,
    players: { learnerSeat: count, otherWagers: Array.from({ length: count }, () => S17_LS.limits.initial.min), strategy: count > 0 ? TEST_STRATEGY : null },
  },
});

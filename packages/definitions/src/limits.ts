// The launch table limits of every game (#3), in one place for setup.

import { BLACKJACK_LIMITS } from './blackjack/rules';
import { CRAPS_LIMITS } from './craps';
import { ROULETTE_LIMITS } from './roulette';

export const DEFAULT_LIMITS = {
  blackjack: BLACKJACK_LIMITS,
  craps: CRAPS_LIMITS,
  roulette: ROULETTE_LIMITS,
} as const;

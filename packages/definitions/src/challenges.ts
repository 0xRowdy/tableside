// Spec 3 Modules › Definitions package; Challenge content (from #4); #158, #133
import type { CardValuesContent, ChallengeCategory, ChallengeContent, RunningCountContent } from '@tableside/engine';

import { BLACKJACK_REFERENCE_IDENTITY } from './blackjack/strategies';

export const CARD_VALUES_CONTENT: CardValuesContent = { category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' };

// Spec 3 Challenge content › Running count
export const RUNNING_COUNT_CONTENT: RunningCountContent = {
  category: 'running-count',
  id: 'running-count',
  version: 1,
  length: 52,
  decks: 6,
  checkpoints: [13, 26, 39, 52],
  reference: BLACKJACK_REFERENCE_IDENTITY,
};

export const CHALLENGE_CONTENT: Readonly<Record<ChallengeCategory, ChallengeContent>> = { 'card-values': CARD_VALUES_CONTENT, 'running-count': RUNNING_COUNT_CONTENT };

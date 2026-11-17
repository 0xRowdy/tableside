// Spec 3 Modules › Definitions package; Challenge content (from #4); #158, #133, #134
import type { CardValuesContent, ChallengeCategory, ChallengeContent, ConversionContent, RunningCountContent } from '@tableside/engine';

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

// Spec 3 Challenge content › Conversion
export const CONVERSION_CONTENT: ConversionContent = { category: 'conversion', id: 'conversion', version: 1, length: 10, maxRunningCount: 20, maxDecks: 6 };

export const CHALLENGE_CONTENT: Readonly<Record<ChallengeCategory, ChallengeContent>> = {
  'card-values': CARD_VALUES_CONTENT,
  'running-count': RUNNING_COUNT_CONTENT,
  conversion: CONVERSION_CONTENT,
};
// Spec 3 Challenge content (from #4), Recommendations; #145
export const CATALOG_CATEGORIES = ['card-values', 'running-count', 'conversion', 'table'] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

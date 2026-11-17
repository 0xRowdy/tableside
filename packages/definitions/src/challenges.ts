// Spec 3 Modules › Definitions package; Challenge content (from #4); #158
import type { CardValuesContent, ChallengeCategory, ChallengeContent } from '@tableside/engine';

export const CARD_VALUES_CONTENT: CardValuesContent = { category: 'card-values', id: 'card-values', version: 1, length: 20, coverage: 'every-rank' };

export const CHALLENGE_CONTENT: Readonly<Record<ChallengeCategory, ChallengeContent>> = { 'card-values': CARD_VALUES_CONTENT };

// Spec 3 Challenge content (from #4), Recommendations (suggested order); #145
export const CHALLENGE_CATEGORIES = ['card-values', 'running-count', 'conversion', 'table'] as const;
export type ChallengeCategoryId = (typeof CHALLENGE_CATEGORIES)[number];

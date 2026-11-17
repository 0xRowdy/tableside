// Spec 3 Modules › Definitions package; Challenge content (from #4); #158, #133, #134, #137
import type { CardValuesContent, ChallengeCategory, ChallengeContent, ConversionContent, RunningCountContent, TableContent, TableSetup } from '@tableside/engine';

import type { BlackjackPreset } from './blackjack/reference';
import { blackjackRules, DEFAULT_BLACKJACK_PRESET, DEFAULT_PENETRATION } from './blackjack/rules';
import { seatStrategy } from './blackjack/seats';
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

// Spec 3 Challenge content › Table
export const TABLE_CONTENT: TableContent = { category: 'table', id: 'table', version: 1, rounds: 10, reference: BLACKJACK_REFERENCE_IDENTITY };

export const CHALLENGE_CONTENT: Readonly<Record<ChallengeCategory, ChallengeContent>> = {
  'card-values': CARD_VALUES_CONTENT,
  'running-count': RUNNING_COUNT_CONTENT,
  conversion: CONVERSION_CONTENT,
  table: TABLE_CONTENT,
};

// Spec 3 User stories 27; S3-02 ZreSb
export interface TableOptions {
  readonly seat: 'observe';
  readonly preset: BlackjackPreset;
  readonly penetration: number;
  readonly extraPlayers: number;
  readonly interval: number;
}

export const DEFAULT_TABLE_SETUP: TableOptions = { seat: 'observe', preset: DEFAULT_BLACKJACK_PRESET, penetration: DEFAULT_PENETRATION, extraPlayers: 0, interval: 1 };

// Spec 3 Challenge content › Observe seats
export const observeSetup = (options: TableOptions): TableSetup => ({
  seat: options.seat,
  rules: blackjackRules(options.preset, options.penetration, options.extraPlayers),
  strategy: seatStrategy(options.preset),
  interval: options.interval,
});
// Spec 3 Challenge content (from #4), Recommendations; #145
export const CATALOG_CATEGORIES = ['card-values', 'running-count', 'conversion', 'table'] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

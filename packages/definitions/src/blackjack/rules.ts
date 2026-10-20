// Blackjack rule presets (#3): six decks, S17 or H17 x late surrender on or
// off (default S17 + LS), penetration 50-80% in 5% steps (default 75%) and
// initial-wager limits 10/1,000 units. Editable limits arrive with #72.

import { BLACKJACK_RULES, type BlackjackRuleSet } from '@tableside/engine';

import type { BlackjackPreset } from './reference';

export const DEFAULT_BLACKJACK_PRESET: BlackjackPreset = 'S17_LS';
export const DEFAULT_PENETRATION = 75;

const PRESETS: Readonly<Record<BlackjackPreset, Pick<BlackjackRuleSet, 'dealer' | 'lateSurrender'>>> = {
  S17_LS: { dealer: 'S17', lateSurrender: true },
  S17_noLS: { dealer: 'S17', lateSurrender: false },
  H17_LS: { dealer: 'H17', lateSurrender: true },
  H17_noLS: { dealer: 'H17', lateSurrender: false },
};

/** The rule set a blackjack activity pins for a preset and penetration. */
export function blackjackRules(preset: BlackjackPreset = DEFAULT_BLACKJACK_PRESET, penetration = DEFAULT_PENETRATION): BlackjackRuleSet {
  return {
    id: BLACKJACK_RULES.id,
    version: BLACKJACK_RULES.version,
    decks: BLACKJACK_RULES.decks,
    ...PRESETS[preset],
    penetration,
    limits: { initial: { min: '10', max: '1000' } },
  };
}

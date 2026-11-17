// #3

import { BLACKJACK_RULES, type BlackjackRuleSet } from '@tableside/engine';

import type { BlackjackPreset } from './reference';
import { seatStrategy } from './seats';

export const DEFAULT_BLACKJACK_PRESET: BlackjackPreset = 'S17_LS';
export const DEFAULT_PENETRATION = 75;

const PRESETS: Readonly<Record<BlackjackPreset, Pick<BlackjackRuleSet, 'dealer' | 'lateSurrender'>>> = {
  S17_LS: { dealer: 'S17', lateSurrender: true },
  S17_noLS: { dealer: 'S17', lateSurrender: false },
  H17_LS: { dealer: 'H17', lateSurrender: true },
  H17_noLS: { dealer: 'H17', lateSurrender: false },
};

// Spec 1 Game rules
export const blackjackPreset = (dealer: 'S17' | 'H17', lateSurrender: boolean): BlackjackPreset => `${dealer}_${lateSurrender ? 'LS' : 'noLS'}`;

export const BLACKJACK_LIMITS: BlackjackRuleSet['limits'] = { initial: { min: '10', max: '1000' } };

export function blackjackRules(
  preset: BlackjackPreset = DEFAULT_BLACKJACK_PRESET,
  penetration = DEFAULT_PENETRATION,
  otherPlayers = 0,
  limits: BlackjackRuleSet['limits'] = BLACKJACK_LIMITS,
): BlackjackRuleSet {
  return {
    id: BLACKJACK_RULES.id,
    version: BLACKJACK_RULES.version,
    decks: BLACKJACK_RULES.decks,
    ...PRESETS[preset],
    penetration,
    limits: { initial: { ...limits.initial } },
    players: {
      learnerSeat: otherPlayers,
      otherWagers: Array.from({ length: otherPlayers }, () => limits.initial.min),
      strategy: otherPlayers > 0 ? seatStrategy(preset) : null,
    },
  };
}

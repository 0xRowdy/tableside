// Spec 1 Game rules, Counting (Hi-Lo); #132
import type { ChallengeCard, ChallengeItem } from '@tableside/engine';

export const HI_LO_BY_RANK: Readonly<Record<number, -1 | 0 | 1>> = { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: -1, 12: -1, 13: -1 };

// #134
export function cardOf(item: ChallengeItem | null | undefined): ChallengeCard {
  if (!item || !('card' in item)) throw new Error('expected a card item');
  return item.card;
}

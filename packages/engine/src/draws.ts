// docs/decisions/mobile-platform-shared-game-engine.md Reproducible random protocol

import { uniformInt, type RandomStream } from './random';

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  readonly deck: number;
  readonly suit: Suit;
  readonly rank: Rank;
}

const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

export function canonicalShoe(decks: number): Card[] {
  if (!Number.isInteger(decks) || decks < 1) throw new RangeError(`a shoe needs at least one whole deck, got ${decks}`);
  const shoe: Card[] = [];
  for (let deck = 0; deck < decks; deck++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) shoe.push({ deck, suit, rank: rank as Rank });
    }
  }
  return shoe;
}

export function shuffle<T>(stream: RandomStream, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = uniformInt(stream, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function rollDice(stream: RandomStream): [number, number] {
  const first = uniformInt(stream, 6) + 1;
  return [first, uniformInt(stream, 6) + 1];
}

export type RouletteWheel = 'single-zero' | 'double-zero';

export type RoulettePocket = number | '00';

export function roulettePockets(wheel: RouletteWheel): RoulettePocket[] {
  const numbers = Array.from({ length: 36 }, (_, i) => i + 1);
  return wheel === 'single-zero' ? [0, ...numbers] : [0, '00', ...numbers];
}

export function spinRoulette(stream: RandomStream, wheel: RouletteWheel): RoulettePocket {
  const pockets = roulettePockets(wheel);
  return pockets[uniformInt(stream, pockets.length)] as RoulettePocket;
}

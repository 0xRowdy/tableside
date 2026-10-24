// Game draws under random protocol v1. The draw order is part of the protocol:
// changing it changes every dealt outcome for a given stream.

import { uniformInt, type RandomStream } from './random';

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

/** 1 = ace, 2-10, 11 = jack, 12 = queen, 13 = king. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  /** Which deck of the shoe, from 0. */
  readonly deck: number;
  readonly suit: Suit;
  readonly rank: Rank;
}

const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

/** The canonical order: deck index ascending, then clubs, diamonds, hearts, spades, then ace to king. */
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

/**
 * Descending Fisher-Yates: for i from the last index down to 1, swap index i
 * with a uniform index in 0..i. Returns a new array; deal from index 0 upward.
 */
export function shuffle<T>(stream: RandomStream, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = uniformInt(stream, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Two bounded draws of six, plus one each. */
export function rollDice(stream: RandomStream): [number, number] {
  const first = uniformInt(stream, 6) + 1;
  return [first, uniformInt(stream, 6) + 1];
}

export type RouletteWheel = 'single-zero' | 'double-zero';

/** A wheel pocket. Double zero is its own pocket, never the number 0. */
export type RoulettePocket = number | '00';

/** The wheel's pockets in draw order: [0, 1..36] or [0, 00, 1..36]. */
export function roulettePockets(wheel: RouletteWheel): RoulettePocket[] {
  const numbers = Array.from({ length: 36 }, (_, i) => i + 1);
  return wheel === 'single-zero' ? [0, ...numbers] : [0, '00', ...numbers];
}

/** One spin: a uniform pocket of the wheel. */
export function spinRoulette(stream: RandomStream, wheel: RouletteWheel): RoulettePocket {
  const pockets = roulettePockets(wheel);
  return pockets[uniformInt(stream, pockets.length)] as RoulettePocket;
}

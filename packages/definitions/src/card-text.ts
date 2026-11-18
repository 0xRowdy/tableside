// Spec 3 Lessons › Content requirements
import type { Suit } from '@tableside/engine';

export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

export const SUIT_GLYPH: Readonly<Record<Suit, string>> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

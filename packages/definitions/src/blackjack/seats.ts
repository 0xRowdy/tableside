// Spec 1 Game rules
import type { SeatStrategy } from '@tableside/engine';

import { basicStrategy, continuation, type BlackjackPreset, type CardValue, type HandKind, type PlayAction } from './reference';

const LETTERS: Readonly<Record<PlayAction, string>> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const UP_CARDS: readonly CardValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const row = (cell: (up: CardValue) => PlayAction) => UP_CARDS.map((up) => LETTERS[cell(up)]).join('');

const dealerRule = (preset: BlackjackPreset) => (preset.startsWith('H17') ? 'H17' : 'S17');

export function seatStrategy(preset: BlackjackPreset): SeatStrategy {
  const basic = (kind: HandKind, hand: number) => (up: CardValue) => basicStrategy(preset, kind, hand, up);
  const first = (kind: HandKind, from: number, to: number) => range(from, to).map((hand) => row((up) => basic(kind, hand)(up).action));
  const pairs = range(1, 10);
  const withoutSurrender = (hand: number, up: CardValue): PlayAction => {
    const cell = basic('pair', hand)(up);
    return cell.action === 'surrender' ? cell.fallbacks.surrender : cell.action;
  };
  const atCap = (hand: number, up: CardValue): PlayAction => {
    const action = withoutSurrender(hand, up);
    if (action !== 'split') return action;
    const fallback = basic('pair', hand)(up).fallbacks.splitByRule;
    if (fallback === null) throw new Error(`no split-by-rule fallback for pair ${hand} vs ${up}`);
    return fallback;
  };
  const rule = dealerRule(preset);
  const later = (kind: 'hard' | 'soft', from: number, to: number, double: boolean) =>
    range(from, to).map((total) =>
      row((up) => {
        const cell = continuation(rule, kind, total, up);
        return double || cell.action !== 'double' ? cell.action : cell.fallback;
      }),
    );
  return {
    first: { hard: first('hard', 4, 20), soft: first('soft', 12, 20), pair: first('pair', 1, 10) },
    pairWithoutSurrender: pairs.map((hand) => row((up) => withoutSurrender(hand, up))),
    pairAtCap: pairs.map((hand) => row((up) => atCap(hand, up))),
    later: { hard: later('hard', 4, 21, true), soft: later('soft', 12, 21, true) },
    laterWithoutDouble: { hard: later('hard', 4, 21, false), soft: later('soft', 12, 21, false) },
  };
}

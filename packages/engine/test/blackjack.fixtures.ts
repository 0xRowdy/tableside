// Shared inputs for the blackjack engine-interface cases: a six-deck S17 +
// late-surrender free-play activity at the launch defaults (#3: initial wager
// 10-1,000, 75% penetration), and stacked shoes for situations a shuffle
// rarely deals.
import {
  canonicalShoe,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  type BlackjackActivitySpecification,
  type BlackjackActivityState,
  type BlackjackRuleSet,
  type Command,
  type Rank,
  type SeatStrategy,
} from '../src';

import { PI } from './fixtures';

export const S17_LS: BlackjackRuleSet = {
  id: 'blackjack-six-deck',
  version: 1,
  decks: 6,
  dealer: 'S17',
  lateSurrender: true,
  penetration: 75,
  limits: { initial: { min: '10', max: '1000' } },
  players: { learnerSeat: 0, others: [], strategy: null },
};

export const BJ_SPEC: BlackjackActivitySpecification = {
  activityId: 'blackjack-1',
  owner: 'local',
  device: 'device-1',
  game: 'blackjack',
  rules: S17_LS,
  strategy: null,
  reference: null,
  fundingSource: 'practice-funding',
  funding: '1000',
};

/**
 * The Random123 "pi digits" stream. Its six-deck shuffle starts 2♠T, 1♠T, 1♦J,
 * 3♠6, 1♦A, 0♥T, 4♥9, 5♦T, 3♠5, 2♥3 (deck index then suit, from the Python
 * reference in draws.cases).
 */
export const BJ_STREAM = PI;

export const bet = (amount: string): Command => ({ kind: 'place-wager', target: 'hand-1', amount });
export const DEAL: Command = { kind: 'begin-turn' };
export const HIT: Command = { kind: 'play', action: 'hit' };
export const STAND: Command = { kind: 'play', action: 'stand' };
export const DOUBLE: Command = { kind: 'play', action: 'double' };
export const SPLIT: Command = { kind: 'play', action: 'split' };
export const SURRENDER: Command = { kind: 'play', action: 'surrender' };
export const NO_INSURANCE: Command = { kind: 'play', action: 'decline-insurance' };
export const insure = (amount: string): Command => ({ kind: 'place-wager', target: 'insurance', amount });
export const SETTLE: Command = { kind: 'settle-turn' };
export const STOP: Command = { kind: 'request-stop' };
export const FINAL: Command = { kind: 'advance-final-settlement' };

/** Cards dealt before the cut card, floor(312 x penetration), worked by hand: 312 x 0.55 = 171.6 and so on. */
export const CUT: Record<number, number> = { 50: 156, 55: 171, 60: 187, 65: 202, 70: 218, 75: 234, 80: 249 };

/** "A", "2".."9", "T", "J", "Q", "K" to a rank. */
const RANK_OF: Record<string, Rank> = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
const rankOf = (label: string): Rank => RANK_OF[label] ?? (Number(label) as Rank);

/**
 * A fresh activity whose shoe is already in place, stacked so the given ranks
 * come off in order (any suit) from position `at`, where dealing resumes; the
 * rest are in canonical order. The state
 * passes checkpoint validation, so it is one the engine could hold.
 */
export function stacked(ranks: string, spec: BlackjackActivitySpecification = BJ_SPEC, at = 0): BlackjackActivityState {
  const shoe = canonicalShoe(6);
  const used = new Set<number>();
  const top = ranks.split(' ').filter(Boolean).map((label) => {
    const index = shoe.findIndex((card, i) => !used.has(i) && card.rank === rankOf(label));
    if (index < 0) throw new Error(`no ${label} left to stack`);
    used.add(index);
    return index;
  });
  const rest = shoe.map((_, i) => i).filter((i) => !used.has(i));
  const order = [...rest.slice(0, at), ...top, ...rest.slice(at)];
  const state = createActivity(spec, BJ_STREAM);
  const text = encodeCheckpoint({ ...state, shoe: { order, next: at, cut: CUT[spec.rules.penetration] as number } });
  const decoded = decodeCheckpoint(text);
  if (!decoded.ok) throw new Error(`stacked shoe is not a valid state: ${decoded.error.message}`);
  return decoded.state as BlackjackActivityState;
}

/**
 * A small hand-written chart for the simulated players in engine cases (the
 * certified tables are checked against the engine in the definitions
 * package). Up cards A, 2..9, 10. Hard: hit to 9; double 10 against 2-9 and 11
 * against 2-10; stand 12-16 against 2-6, else hit, except surrender 16 against
 * 10; stand 17+. Soft: hit to 17, stand 18+. Pairs: always split aces and
 * eights, stand on tens, else play the hard total. At four hands a pair of
 * aces stands and eights play hard 16.
 */
const HIT_ROW = 'HHHHHHHHHH';
const STAND_ROW = 'SSSSSSSSSS';
const TEN_ROW = 'HDDDDDDDDH';
const ELEVEN_ROW = 'HDDDDDDDDD';
const STIFF_ROW = 'HSSSSSHHHH';
const hardRows = (from: number, to: number, sixteen: string, double: boolean) =>
  Array.from({ length: to - from + 1 }, (_, i) => {
    const total = from + i;
    if (total <= 9) return HIT_ROW;
    if (total === 10) return double ? TEN_ROW : HIT_ROW;
    if (total === 11) return double ? ELEVEN_ROW : HIT_ROW;
    if (total === 16) return sixteen;
    return total <= 16 ? STIFF_ROW : STAND_ROW;
  });
const softRows = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => (from + i <= 17 ? HIT_ROW : STAND_ROW));
/** Pair rows A, 2..10: 2,2 to 7,7 and 9,9 play their hard total. */
const pairs = (aces: string, eights: string) => [aces, HIT_ROW, HIT_ROW, HIT_ROW, TEN_ROW, STIFF_ROW, STIFF_ROW, eights, STAND_ROW, STAND_ROW];
const SPLIT_ROW = 'PPPPPPPPPP';
export const TEST_STRATEGY: SeatStrategy = {
  first: { hard: hardRows(4, 20, 'HSSSSSHHHR', true), soft: softRows(12, 20), pair: pairs(SPLIT_ROW, SPLIT_ROW) },
  pairWithoutSurrender: pairs(SPLIT_ROW, SPLIT_ROW),
  pairAtCap: pairs(STAND_ROW, STIFF_ROW),
  later: { hard: hardRows(4, 21, STIFF_ROW, true), soft: softRows(12, 21) },
  laterWithoutDouble: { hard: hardRows(4, 21, STIFF_ROW, false), soft: softRows(12, 21) },
};

/** The launch table with simulated players: their fixed wagers in seat order, and the learner's seat from first base (from 0). */
export const withPlayers = (learnerSeat: number, others: string[], spec: BlackjackActivitySpecification = BJ_SPEC): BlackjackActivitySpecification => ({
  ...spec,
  rules: { ...spec.rules, players: { learnerSeat, others, strategy: others.length > 0 ? TEST_STRATEGY : null } },
});

// Simulated players use the rule-specific basic strategy (spec #51): the
// packed rows match the frozen research files cell by cell, and through the
// engine a player seated ahead of the learner makes the reference play on
// every reachable first decision of every preset.
import {
  advanceActivity,
  canonicalShoe,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  RANDOM_PROTOCOL_VERSION,
  type BlackjackActivityState,
  type Command,
  type DomainFact,
} from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { blackjackRules, seatStrategy } from '../src/index';
import { frozenRows, LETTER, PRESETS } from './frozen-files';

const UP = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const up = (value: string) => (value === 'A' || value === '1' ? 1 : Number(value));
const letterAt = (rows: readonly string[], index: number, upCard: number) => rows[index]?.[upCard - 1];

describe('simulated players: packed basic strategy', () => {
  for (const preset of PRESETS) {
    const strategy = seatStrategy(preset);
    const rule = preset.slice(0, 3);

    it(`${preset}: first decisions, pair fallbacks and later decisions match the frozen files`, () => {
      let cells = 0;
      for (const row of frozenRows(`basic_${preset}.csv`)) {
        const hand = Number(row['hand']);
        const u = up(row['up'] ?? '');
        const action = row['action'] ?? '';
        if (row['kind'] === 'hard') expect(letterAt(strategy.first.hard, hand - 4, u)).toBe(action);
        if (row['kind'] === 'soft') expect(letterAt(strategy.first.soft, hand - 12, u)).toBe(action);
        if (row['kind'] === 'pair') {
          expect(letterAt(strategy.first.pair, hand - 1, u)).toBe(action);
          const noSurrender = action === 'R' ? row['fallback_surrender'] : action;
          expect(letterAt(strategy.pairWithoutSurrender, hand - 1, u)).toBe(noSurrender);
          expect(letterAt(strategy.pairAtCap, hand - 1, u)).toBe(noSurrender === 'P' ? row['fallback_split_rule'] : noSurrender);
        }
        cells++;
      }
      expect(cells).toBe(360);
      let later = 0;
      for (const row of frozenRows(`continuation_${rule}.csv`)) {
        const total = Number(row['total']);
        const u = up(row['up'] ?? '');
        const hard = row['kind'] === 'hard';
        const index = total - (hard ? 4 : 12);
        expect(letterAt(hard ? strategy.later.hard : strategy.later.soft, index, u)).toBe(row['action']);
        expect(letterAt(hard ? strategy.laterWithoutDouble.hard : strategy.laterWithoutDouble.soft, index, u)).toBe(
          row['action'] === 'D' ? row['fallback'] : row['action'],
        );
        later++;
      }
      expect(later).toBe(280);
    });
  }
});

const rankOf = (label: string) => (label === 'A' ? 1 : Number(label));

/** A blackjack activity with one simulated player ahead of the learner, the shoe stacked with `ranks` on top. */
function stacked(preset: (typeof PRESETS)[number], ranks: string[]): BlackjackActivityState {
  const shoe = canonicalShoe(6);
  const used = new Set<number>();
  const top = ranks.map((label) => {
    const index = shoe.findIndex((card, i) => !used.has(i) && card.rank === rankOf(label));
    used.add(index);
    return index;
  });
  const order = [...top, ...shoe.map((_, i) => i).filter((i) => !used.has(i))];
  const state = createActivity(
    {
      activityId: 'a',
      owner: 'o',
      device: 'd',
      game: 'blackjack',
      rules: blackjackRules(preset, 75, 1),
      strategy: null,
      reference: null,
      fundingSource: 'practice-funding',
      funding: '1000',
    },
    { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 2], session: [3, 4] },
  );
  const decoded = decodeCheckpoint(encodeCheckpoint({ ...state, shoe: { order, next: 0, cut: 234 } }));
  if (!decoded.ok) throw new Error(decoded.error.message);
  return decoded.state as BlackjackActivityState;
}

function run(state: BlackjackActivityState, commands: Command[]): DomainFact[] {
  const facts: DomainFact[] = [];
  for (const command of commands) {
    const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error(JSON.stringify(result));
    state = result.state;
    facts.push(...result.facts);
  }
  return facts;
}

/** Two cards making a first-decision cell: hard totals as two different values, soft as an ace and a card, pairs as two of a value. */
function composition(kind: string, hand: number): [string, string] | null {
  if (kind === 'pair') return hand === 1 ? ['A', 'A'] : [String(hand), String(hand)];
  if (kind === 'soft') return hand === 12 ? null : ['A', String(hand - 11)];
  const high = Math.min(10, hand - 2);
  const low = hand - high;
  return low < 2 || low === high ? null : [String(high), String(low)];
}

describe('simulated players: through the engine', () => {
  for (const preset of PRESETS) {
    it(`${preset}: a player ahead of the learner makes the reference first play in every reachable cell`, () => {
      let checked = 0;
      for (const row of frozenRows(`basic_${preset}.csv`)) {
        const cards = composition(row['kind'] ?? '', Number(row['hand']));
        if (cards === null) continue;
        const upCard = UP[up(row['up'] ?? '') - 1] as string;
        // Seat 1, the learner (2 then 3), the up card, seat 1, the learner, hole 2 (never a dealer blackjack).
        const facts = run(stacked(preset, [cards[0], '2', upCard, cards[1], '3', '2']), [
          { kind: 'place-wager', target: 'hand-1', amount: '10' },
          { kind: 'begin-turn' },
          ...(upCard === 'A' ? [{ kind: 'play', action: 'decline-insurance' } as const] : []),
        ]);
        const first = facts.find((fact) => fact.kind === 'played' && fact.target === 'seat-1-hand-1');
        expect(first?.kind === 'played' && first.action, `${row['kind']} ${row['hand']} v ${row['up']}`).toBe(LETTER[row['action'] ?? '']);
        checked++;
      }
      // Every cell but hard 4 and 20 and soft 12 (only pairs make them), against ten up cards.
      expect(checked).toBe(360 - 30);
    });
  }

  it('players bet the table minimum, sit ahead of the learner and carry the preset strategy', () => {
    const rules = blackjackRules('H17_noLS', 75, 3);
    expect([rules.players.learnerSeat, rules.players.others]).toEqual([3, ['10', '10', '10']]);
    expect(rules.players.strategy).toEqual(seatStrategy('H17_noLS'));
    expect(blackjackRules().players).toEqual({ learnerSeat: 0, others: [], strategy: null });
  });
});

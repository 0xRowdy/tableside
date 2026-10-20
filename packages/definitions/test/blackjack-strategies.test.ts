// The blackjack built-in strategies against the frozen research files (spec
// #51, Blackjack reference; launch gate 2). The packed policy holds every
// basic, fallback, continuation and index cell exactly as frozen, and through
// the engine's Explain play (the same answer a guided activity assesses) every
// reachable first decision, legal and funding fallback, later decision and
// certified index plays as the files say.
import { explainPlay, validateStrategy, type BlackjackPlayPolicy, type BlackjackPlaySituation, type Card, type PlayExplanation } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { BLACKJACK_MODES, blackjackStrategy } from '../src/index';
import { frozenRows, LETTER, orNull, PRESETS, RULES } from './frozen-files';

const up = (value: string) => (value === 'A' ? 1 : Number(value));
const letterAt = (rows: readonly string[], index: number, upCard: number) => rows[index]?.[upCard - 1];
const card = (rank: number): Card => ({ deck: 0, suit: 'hearts', rank: rank as Card['rank'] });

/** Two different cards totalling a hard `total` (5-19), or undefined. */
const hardTwo = (total: number): number[] | undefined => (total >= 5 && total <= 11 ? [2, total - 2] : total >= 12 && total <= 19 ? [10, total - 10] : undefined);
/** Three cards totalling a hard `total` (6-21). */
const hardThree = (total: number): number[] | undefined => (total >= 6 && total <= 14 ? [2, 2, total - 4] : total >= 15 && total <= 21 ? [10, 2, total - 12] : undefined);
/** Cards with an ace totalling a soft `total`: x,A on two cards (13-20; a split hand starts with x), A,2,x on three (15-21). */
const softTwo = (total: number): number[] | undefined => (total >= 13 && total <= 20 ? [total - 11, 1] : undefined);
const softThree = (total: number): number[] | undefined => (total >= 15 && total <= 21 ? [1, 2, total - 13] : undefined);

function play(preset: (typeof PRESETS)[number], mode: (typeof BLACKJACK_MODES)[number], cards: number[], upCard: number, extra: Partial<BlackjackPlaySituation> = {}): PlayExplanation {
  const situation: BlackjackPlaySituation = {
    game: 'blackjack',
    rules: { dealer: preset.startsWith('H17') ? 'H17' : 'S17', lateSurrender: preset.endsWith('_LS') },
    decision: 'hand',
    cards: cards.map(card),
    hands: 1,
    up: card(upCard),
    balance: '1000',
    stake: '10',
    shoe: { running: 0, remaining: 300 },
    ...extra,
  };
  const result = explainPlay(blackjackStrategy(preset, mode), situation);
  if (!result.ok) throw new Error(result.error);
  return result.explanation;
}
const prescribed = (explanation: PlayExplanation) => explanation.prescribed.action;

describe('blackjack built-in strategies', () => {
  it('every preset has basic and basic-with-deviations, runnable, with the bets left to the player', () => {
    for (const preset of PRESETS) {
      for (const mode of BLACKJACK_MODES) {
        const definition = blackjackStrategy(preset, mode);
        expect(validateStrategy(definition), `${preset} ${mode}`).toEqual({ diagnostics: [], runnable: true });
        expect([definition.instructions, (definition.play as BlackjackPlayPolicy).countShown]).toEqual([[], mode === 'basic-with-deviations']);
      }
    }
  });

  for (const preset of PRESETS) {
    const basic = blackjackStrategy(preset, 'basic').play as BlackjackPlayPolicy;
    const rows = frozenRows(`basic_${preset}.csv`);
    const ls = preset.endsWith('_LS');

    it(`${preset}: every basic and fallback cell is packed as frozen`, () => {
      for (const row of rows) {
        const kind = row['kind'] as 'hard' | 'soft' | 'pair';
        const hand = Number(row['hand']);
        const index = kind === 'pair' ? hand - 1 : kind === 'soft' ? hand - 12 : hand - 4;
        const u = up(row['up'] ?? '');
        const at = (grid: { hard: readonly string[]; soft: readonly string[]; pair: readonly string[] }) => letterAt(grid[kind], index, u);
        expect(at(basic.first), JSON.stringify(row)).toBe(row['action']);
        expect(at(basic.fallbacks.double)).toBe(row['fallback_double']);
        expect(at(basic.fallbacks.doubleOnOriginalLateSurrender)).toBe(row['fallback_double_ls_original']);
        expect(at(basic.fallbacks.surrender)).toBe(row['fallback_surrender']);
        if (kind === 'pair') {
          expect(letterAt(basic.fallbacks.splitByRule, index, u)).toBe(row['fallback_split_rule']);
          expect(letterAt(basic.fallbacks.splitByBalance, index, u)).toBe(row['fallback_split_balance']);
        }
      }
      expect(rows).toHaveLength(360);
    });

    it(`${preset}: every reachable first decision plays the frozen action, and each fallback the frozen fallback for its cause`, () => {
      let checked = 0;
      for (const row of rows) {
        const kind = row['kind'] ?? '';
        const hand = Number(row['hand']);
        const u = up(row['up'] ?? '');
        const action = LETTER[row['action'] ?? ''];
        const cards = kind === 'pair' ? [hand, hand] : kind === 'soft' ? softTwo(hand) : hardTwo(hand);
        if (!cards) continue; // hard 4 and 20 and soft 12 are only ever pairs.
        const context = `${preset} ${kind} ${hand} v ${u}`;
        expect(prescribed(play(preset, 'basic', cards, u)), context).toBe(action);
        checked++;
        if (action === 'double') {
          // Unaffordable on the original two cards.
          const fallback = ls ? row['fallback_double_ls_original'] : row['fallback_double'];
          expect(prescribed(play(preset, 'basic', cards, u, { balance: '5' })), `${context} short`).toBe(LETTER[fallback ?? '']);
          if (kind === 'pair') expect(prescribed(play(preset, 'basic', cards, u, { hands: 2, balance: '5' })), `${context} split short`).toBe(LETTER[row['fallback_double'] ?? '']);
        }
        if (action === 'split') {
          // Unaffordable: the double is too; at four hands split is off by rule (a split hand, no surrender, double allowed).
          expect(prescribed(play(preset, 'basic', cards, u, { balance: '5' })), `${context} short`).toBe(LETTER[row['fallback_split_balance'] ?? '']);
          if (hand !== 1) expect(prescribed(play(preset, 'basic', cards, u, { hands: 4 })), `${context} four hands`).toBe(LETTER[row['fallback_split_rule'] ?? '']);
        }
        if (action === 'surrender' && kind === 'pair') {
          // On a split hand surrender is off.
          expect(prescribed(play(preset, 'basic', cards, u, { hands: 2 })), `${context} split`).toBe(LETTER[row['fallback_surrender'] ?? '']);
        }
      }
      expect(checked).toBe(330);
    });
  }

  for (const rule of RULES) {
    const rows = frozenRows(`continuation_${rule}.csv`);
    const policy = blackjackStrategy(`${rule}_LS`, 'basic').play as BlackjackPlayPolicy;

    it(`${rule}: every continuation cell is packed as frozen and later decisions play it`, () => {
      let played = 0;
      for (const row of rows) {
        const kind = row['kind'] as 'hard' | 'soft';
        const total = Number(row['total']);
        const u = up(row['up'] ?? '');
        const index = kind === 'soft' ? total - 12 : total - 4;
        const action = row['action'] ?? '';
        expect(letterAt(policy.later[kind], index, u), JSON.stringify(row)).toBe(action);
        expect(letterAt(policy.laterWithoutDouble[kind], index, u)).toBe(action === 'D' ? row['fallback'] : action);
        if (total === 21) continue; // 21 takes no decision.
        // Three cards can't double: the fallback. A split hand's two cards can.
        const three = kind === 'soft' ? softThree(total) : hardThree(total);
        if (three) {
          expect(prescribed(play(`${rule}_LS`, 'basic', three, u)), `${kind} ${total} v ${u} three cards`).toBe(LETTER[action === 'D' ? (row['fallback'] ?? '') : action]);
          played++;
        }
        const two = kind === 'soft' ? softTwo(total) : hardTwo(total);
        if (two) {
          expect(prescribed(play(`${rule}_LS`, 'basic', two, u, { hands: 2 })), `${kind} ${total} v ${u} split hand`).toBe(LETTER[action]);
          // An unaffordable double on a split hand falls back too.
          if (action === 'D') expect(prescribed(play(`${rule}_LS`, 'basic', two, u, { hands: 2, balance: '5' }))).toBe(LETTER[row['fallback'] ?? '']);
        }
      }
      expect(played).toBeGreaterThan(200);
    });

    it(`${rule}: every certified index plays its deviation at the threshold and the other play one count below, at every penetration's divisor`, () => {
      const indices = frozenRows(`indices_${rule}_final.csv`);
      for (const preset of [`${rule}_LS`, `${rule}_noLS`] as const) {
        const deviations = (blackjackStrategy(preset, 'basic-with-deviations').play as BlackjackPlayPolicy).deviations;
        const applicable = indices.filter((row) => preset.endsWith('_LS') || row['set'] !== 'F4');
        expect(deviations.map((d) => d.situation)).toEqual(applicable.map((row) => row['situation']));
        for (const [i, row] of applicable.entries()) {
          const d = deviations[i];
          expect([d?.threshold, d?.published.schlesinger.value, d?.published.schlesinger.difference, d?.published.bja.difference]).toEqual([
            Number(row['taught_threshold']),
            row['schlesinger'],
            orNull(row['diff_vs_schlesinger']),
            orNull(row['diff_vs_bja']),
          ]);
          const threshold = Number(row['taught_threshold']);
          const u = up(row['up'] ?? '');
          const set = row['set'];
          const atOrAbove = row['deviation_action'] ?? '';
          const below = row['alternative_action'] ?? '';
          // 260 cards (5 decks), 208 (4), 156 (3): running = decks x true count gives that true count exactly.
          for (const remaining of [260, 208, 156]) {
            const decks = remaining / 52;
            const at = (count: number) => ({ shoe: { running: count * decks, remaining } });
            const context = `${preset} ${row['situation']} at ${remaining}`;
            if (set === 'insurance') {
              const insurance = { decision: 'insurance' as const };
              expect(prescribed(play(preset, 'basic-with-deviations', [9, 7], 1, { ...insurance, ...at(threshold) })), context).toBe('insure');
              expect(prescribed(play(preset, 'basic-with-deviations', [9, 7], 1, { ...insurance, ...at(threshold - 1) })), context).toBe('decline-insurance');
              continue;
            }
            if (row['hand_kind'] === 'pair') {
              expect(prescribed(play(preset, 'basic-with-deviations', [10, 10], u, at(threshold))), context).toBe(atOrAbove);
              expect(prescribed(play(preset, 'basic-with-deviations', [10, 10], u, at(threshold - 1))), context).toBe(below);
              continue;
            }
            const total = Number(row['hand']);
            if (set === 'F4') {
              // On the original two cards, where surrender is offered; below, the basic play with surrender set aside.
              const cell = frozenRows(`basic_${preset}.csv`).find((c) => c['kind'] === 'hard' && Number(c['hand']) === total && up(c['up'] ?? '') === u);
              const basicPlay = cell?.['action'] === 'R' ? cell['fallback_surrender'] : cell?.['action'];
              expect(prescribed(play(preset, 'basic-with-deviations', hardTwo(total) as number[], u, at(threshold))), context).toBe('surrender');
              expect(prescribed(play(preset, 'basic-with-deviations', hardTwo(total) as number[], u, at(threshold - 1))), context).toBe(LETTER[basicPlay ?? '']);
              continue;
            }
            // Doubles on a split hand's two cards (DAS); stand/hit on three cards, where surrender is never offered.
            const doubling = atOrAbove === 'double' || below === 'double';
            const cards = doubling ? (hardTwo(total) as number[]) : (hardThree(total) as number[]);
            const hands = doubling ? 2 : 1;
            expect(prescribed(play(preset, 'basic-with-deviations', cards, u, { hands, ...at(threshold) })), context).toBe(atOrAbove);
            expect(prescribed(play(preset, 'basic-with-deviations', cards, u, { hands, ...at(threshold - 1) })), context).toBe(below);
          }
        }
      }
    });
  }

  it('basic strategy ignores the count; a builder copy of the same data is the same strategy', () => {
    expect(prescribed(play('S17_LS', 'basic', [10, 2, 4], 10, { shoe: { running: 40, remaining: 260 } }))).toBe('hit');
    const copy = JSON.parse(JSON.stringify(blackjackStrategy('S17_LS', 'basic-with-deviations')));
    expect(explainPlay(copy, { game: 'blackjack', rules: { dealer: 'S17', lateSurrender: true }, decision: 'hand', cards: [card(10), card(2), card(4)], hands: 1, up: card(10), balance: '10', stake: '10', shoe: { running: 5, remaining: 260 } })).toEqual(
      explainPlay(blackjackStrategy('S17_LS', 'basic-with-deviations'), { game: 'blackjack', rules: { dealer: 'S17', lateSurrender: true }, decision: 'hand', cards: [card(10), card(2), card(4)], hands: 1, up: card(10), balance: '10', stake: '10', shoe: { running: 5, remaining: 260 } }),
    );
  });
});

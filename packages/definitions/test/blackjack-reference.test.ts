import { describe, expect, it } from 'vitest';

import {
  basicStrategy,
  type BlackjackPreset,
  type CardValue,
  continuation,
  deviationAction,
  type HandKind,
  playingDeviations,
} from '../src/index';
import { frozenRows, LETTER, orNull, PRESETS, RULES } from './frozen-files';

const action = (letter: string | undefined) => (letter ? LETTER[letter] : null);

describe('Hi-Lo playing deviations', () => {
  const words: Record<string, string> = {
    'basic action (stand/hit/double per table)': 'basicWithoutSurrender',
  };
  const cost = (value: string | undefined) =>
    (value ? value.split(';') : []).map((bin) => {
      const match = /^\s*([+-]\d+):([+-]\d\.\d+)±(\d\.\d+)$/.exec(bin);
      if (!match) throw new Error(`unexpected cost ${value}`);
      return { trueCount: Number(match[1]), perBet: Number(match[2]), standardError: Number(match[3]) };
    });

  for (const rule of RULES) {
    const rows = frozenRows(`indices_${rule}_final.csv`);

    it(`${rule}: every index row matches the frozen file, with its published values, difference and cost`, () => {
      const deviations = playingDeviations(`${rule}_LS`);
      expect(deviations).toHaveLength(rows.length);
      rows.forEach((row, i) => {
        const deviation = deviations[i];
        expect(deviation, row['situation']).toEqual({
          rule,
          set: { I18: 'illustrious18', F4: 'fab4', insurance: 'insurance' }[row['set'] ?? ''],
          situation: row['situation'],
          handKind: row['hand_kind'],
          hand: row['hand'] === 'any' ? null : row['hand'] === 'T,T' ? 10 : Number(row['hand']),
          up: row['up'] === 'A' ? 1 : Number(row['up']),
          threshold: Number(row['taught_threshold']),
          direction: { deviate_at_or_above: 'deviateAtOrAbove', basic_at_or_above: 'basicAtOrAbove' }[row['direction'] ?? ''],
          atOrAbove: row['deviation_action'],
          below: words[row['alternative_action'] ?? ''] ?? row['alternative_action'],
          instruction: row['rule'],
          postSplit: row['post_split_note'],
          published: {
            schlesinger: row['schlesinger'],
            bjaS17: row['bja_S17'],
            bjaH17: row['bja_H17'],
            bjaRuleSpecific: orNull(row['bja_rule_specific_tc']),
          },
          difference: { schlesinger: orNull(row['diff_vs_schlesinger']), bja: orNull(row['diff_vs_bja']) },
          costPerBet: { schlesinger: cost(row['cost_per_bet_at_schlesinger']), bja: cost(row['cost_per_bet_at_bja']) },
        });
        // The basic action sits on the side the direction names.
        const basicSide = deviation?.direction === 'deviateAtOrAbove' ? deviation.below : deviation?.atOrAbove;
        const basic = row['basic_action'] ?? '';
        expect(basicSide).toBe(LETTER[basic] ?? (basic === 'basic' ? 'basicWithoutSurrender' : basic));
      });
    });
  }

  // The certified curriculum as written in spec #51 ("Blackjack reference (certified)").
  const S17: Record<string, number> = {
    '16 vs 10': 1, '15 vs 10': 4, 'T,T vs 5': 5, 'T,T vs 6': 5, '10 vs 10': 4, '12 vs 3': 2, '12 vs 2': 4, '11 vs A': 1,
    '9 vs 2': 1, '10 vs A': 4, '9 vs 7': 4, '16 vs 9': 5, '13 vs 2': 0, '12 vs 4': 1, '12 vs 5': -1, '12 vs 6': 0,
    '13 vs 3': -2, '14 vs 10 surrender': 4, '15 vs 10 surrender': 0, '15 vs 9 surrender': 3, '15 vs A surrender': 2,
    Insurance: 3,
  };
  const H17 = { ...S17, 'T,T vs 6': 4, '12 vs 2': 3, '11 vs A': 0, '10 vs A': 3, '13 vs 2': -1, '12 vs 4': 0, '12 vs 6': -3, '15 vs A surrender': 0 };
  const thresholds = (preset: BlackjackPreset) =>
    Object.fromEntries(playingDeviations(preset).map((d) => [d.situation, d.threshold]));

  it('teaches the certified S17 and H17 curricula', () => {
    expect(thresholds('S17_LS')).toEqual(S17);
    expect(thresholds('H17_LS')).toEqual(H17);
  });

  it('keeps the Fab 4 surrender plays to late-surrender presets', () => {
    const fab4 = (preset: BlackjackPreset) => playingDeviations(preset).filter((d) => d.set === 'fab4').length;
    expect([fab4('S17_LS'), fab4('H17_LS'), fab4('S17_noLS'), fab4('H17_noLS')]).toEqual([4, 4, 0, 0]);
    expect(playingDeviations('S17_noLS')).toHaveLength(18);
  });

  it('prescribes by true count on either side of the index', () => {
    const find = (preset: BlackjackPreset, situation: string) => {
      const found = playingDeviations(preset).find((d) => d.situation === situation);
      if (!found) throw new Error(situation);
      return found;
    };
    // Spec: "16 vs T stand ≥ 1"; "H17 … 11 vs A basic double, hit at ≤ −1"; "12 vs 5 stand ≥ −1"; insurance ≥ 3.
    expect([0, 1].map((tc) => deviationAction(find('S17_LS', '16 vs 10'), tc))).toEqual(['hit', 'stand']);
    expect([-1, 0].map((tc) => deviationAction(find('H17_LS', '11 vs A'), tc))).toEqual(['hit', 'double']);
    expect([-2, -1].map((tc) => deviationAction(find('S17_noLS', '12 vs 5'), tc))).toEqual(['hit', 'stand']);
    expect([2, 3].map((tc) => deviationAction(find('H17_noLS', 'Insurance'), tc))).toEqual(['decline', 'insure']);
    expect([3, 4].map((tc) => deviationAction(find('S17_LS', '14 vs 10 surrender'), tc))).toEqual(['basicWithoutSurrender', 'surrender']);
  });

  it('states the difference from the published index and its cost for corrections', () => {
    const tens = playingDeviations('S17_LS').find((d) => d.situation === 'T,T vs 6');
    // Report: Schlesinger +4, generated +5; teaching +4 costs 0.0188 ± 0.0026 per bet in the +4 bin.
    expect(tens?.published.schlesinger).toBe('+4');
    expect(tens?.difference.schlesinger).toBe(1);
    expect(tens?.costPerBet.schlesinger).toEqual([{ trueCount: 4, perBet: 0.0188, standardError: 0.0026 }]);
    const agreeing = playingDeviations('S17_LS').find((d) => d.situation === '15 vs 10');
    expect(agreeing?.difference.schlesinger).toBe(0);
    expect(agreeing?.costPerBet.schlesinger).toEqual([]);
  });

  it('lists one cost bin per count of difference', () => {
    // H17 12 vs 6: taught −3 against Schlesinger's −1, so the −3 and −2 bins both differ.
    const twelveSix = playingDeviations('H17_LS').find((d) => d.situation === '12 vs 6');
    expect(twelveSix?.difference.schlesinger).toBe(-2);
    expect(twelveSix?.costPerBet.schlesinger.map((bin) => bin.trueCount)).toEqual([-3, -2]);
  });
});

describe('continuation tables', () => {
  for (const rule of RULES) {
    const rows = frozenRows(`continuation_${rule}.csv`);

    it(`${rule}: covers hard 4–21 and soft 12–21 against every up card`, () => {
      expect(rows).toHaveLength(280);
    });

    it(`${rule}: every cell matches the frozen table`, () => {
      for (const row of rows) {
        const cell = continuation(rule, row['kind'] as 'hard' | 'soft', Number(row['total']), Number(row['up']) as CardValue);
        expect(cell, `${row['kind']} ${row['total']} vs ${row['up']}`).toEqual({
          action: action(row['action']),
          fallback: action(row['fallback']),
        });
      }
    });
  }

  it('teaches the later decisions of a hand, such as a three-card soft 18 vs 9', () => {
    // Standard total-dependent play: soft 18 hits against 9, hard 21 stands.
    expect(continuation('S17', 'soft', 18, 9).action).toBe('hit');
    expect(continuation('H17', 'hard', 21, 1)).toEqual({ action: 'stand', fallback: 'stand' });
    expect(() => continuation('S17', 'soft', 11, 2)).toThrow(RangeError);
  });
});

describe('basic strategy and legal fallbacks', () => {
  for (const preset of PRESETS) {
    const rows = frozenRows(`basic_${preset}.csv`);

    it(`${preset}: covers hard 4–20, soft 13–20 and every pair against every up card`, () => {
      expect(rows).toHaveLength(360);
    });

    it(`${preset}: every cell matches the frozen table`, () => {
      for (const row of rows) {
        const cell = basicStrategy(preset, row['kind'] as HandKind, Number(row['hand']), Number(row['up']) as CardValue);
        expect(cell, `${row['kind']} ${row['hand']} vs ${row['up']}`).toEqual({
          action: action(row['action']),
          margin: Number(row['margin']),
          fallbacks: {
            double: action(row['fallback_double']),
            doubleOnOriginalLateSurrenderHand: action(row['fallback_double_ls_original']),
            splitByRule: action(row['fallback_split_rule']),
            splitByBalance: action(row['fallback_split_balance']),
            surrender: action(row['fallback_surrender']),
          },
          values: {
            stand: Number(row['ev_stand']),
            hit: Number(row['ev_hit']),
            double: orNull(row['ev_double']),
            split: orNull(row['ev_split']),
            surrender: orNull(row['ev_surrender']),
          },
        });
      }
    });
  }

  it('reads the ace as up card 1 and pairs by card value', () => {
    // Independently from the S17_LS grid (tables_S17_LS.md): A,A splits against an ace; 8,8 vs A splits.
    expect(basicStrategy('S17_LS', 'pair', 1, 1).action).toBe('split');
    expect(basicStrategy('S17_LS', 'hard', 16, 10).action).toBe('surrender');
    expect(basicStrategy('S17_noLS', 'hard', 16, 10).action).toBe('hit');
    expect(basicStrategy('H17_LS', 'hard', 11, 1).action).toBe('double');
  });

  it('rejects a hand the tables do not cover', () => {
    expect(() => basicStrategy('S17_LS', 'soft', 21, 5)).toThrow(RangeError);
    expect(() => basicStrategy('S17_LS', 'hard', 12, 11 as CardValue)).toThrow(RangeError);
  });
});

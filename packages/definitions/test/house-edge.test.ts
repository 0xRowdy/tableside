// docs/development.md House-edge sources
import { describe, expect, it } from 'vitest';

import { BLACKJACK_HOUSE_EDGE_SOURCE, BLACKJACK_REFERENCE, blackjackHouseEdge, type BlackjackPreset } from '../src/index';
import { frozenRows, LETTER, PRESETS } from './frozen-files';

function derivedHouseEdge(preset: BlackjackPreset): number {
  const cells = new Map(frozenRows(`basic_${preset}.csv`).map((row) => [`${row['kind']}|${row['hand']}|${row['up']}`, row]));
  const shoe = (value: number) => (value === 10 ? 96 : 24);
  let expected = 0;
  for (let up = 1; up <= 10; up++) {
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        const left = (value: number) => shoe(value) - (value === up ? 1 : 0) - (value === a ? 1 : 0);
        const p = (shoe(up) / 312) * ((shoe(a) - (a === up ? 1 : 0)) / 311) * (left(b) / 310);
        const remaining = (value: number) => left(value) - (value === b ? 1 : 0);
        const dealerBlackjack = up === 1 ? remaining(10) / 309 : up === 10 ? remaining(1) / 309 : 0;
        const [low, high] = a <= b ? [a, b] : [b, a];
        if (low === 1 && high === 10) {
          expected += p * (1 - dealerBlackjack) * 1.5;
          continue;
        }
        const key = low === high ? `pair|${low}|${up}` : low === 1 ? `soft|${11 + high}|${up}` : `hard|${low + high}|${up}`;
        const row = cells.get(key);
        if (!row) throw new Error(`no cell ${key}`);
        const value = Number(row[`ev_${LETTER[row['action'] ?? '']}`]);
        expected += p * (dealerBlackjack * -1 + (1 - dealerBlackjack) * value);
      }
    }
  }
  return -expected * 100;
}

describe('blackjack house edge', () => {
  it.each(PRESETS)('%s matches the value derived from the certified basic table', (preset) => {
    const { percent } = blackjackHouseEdge(preset);
    expect(percent).toMatch(/^\d+\.\d\d$/);
    expect(percent).toBe(derivedHouseEdge(preset).toFixed(2));
  });

  // Spec 1 Amendment 9 §1; docs/research/blackjack-lessons.md House edge per preset
  it.each([
    ['S17_LS', 0.33361],
    ['S17_noLS', 0.40622],
    ['H17_LS', 0.53051],
    ['H17_noLS', 0.61873],
  ] as const)('%s is within 0.05 points of Wizard of Odds’ six-deck figure for the same rules (%s%%)', (preset, published) => {
    expect(BLACKJACK_HOUSE_EDGE_SOURCE.percent[preset]).toBe(published);
    expect(Math.abs(Number(blackjackHouseEdge(preset).percent) - published)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(derivedHouseEdge(preset) - published)).toBeLessThanOrEqual(0.05);
  });

  it('orders the presets as their rules do (late surrender helps the player, H17 the house), each within the published 0.3% to 0.7%', () => {
    const edge = (preset: BlackjackPreset) => Number(blackjackHouseEdge(preset).percent);
    expect(edge('S17_LS')).toBeLessThan(edge('S17_noLS'));
    expect(edge('H17_LS')).toBeLessThan(edge('H17_noLS'));
    expect(edge('S17_LS')).toBeLessThan(edge('H17_LS'));
    for (const preset of PRESETS) {
      expect(edge(preset)).toBeGreaterThan(0.3);
      expect(edge(preset)).toBeLessThan(0.7);
    }
  });

  it('is versioned with the certified reference', () => {
    expect(blackjackHouseEdge('S17_LS').reference).toBe(BLACKJACK_REFERENCE.version);
  });
});

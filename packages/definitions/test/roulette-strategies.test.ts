import { explainPrescription, strategyTableCompatibility, validateStrategy, type RouletteSituation } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { FIXED_TWO_DOZENS, FLAT_EVEN_MONEY, ROULETTE_PRESETS, ROULETTE_STRATEGIES, strategyDefaults } from '../src/index';

// Spec #51, Built-in strategies: "Flat even-money: 1 unit on the selected
// even-money target (default red)"; "Fixed two-dozen coverage: 1 unit on each
// selected dozen (default 1-12 and 13-24)". Amounts are on the default
// 10-minimum table (#3: outside bets 10-1,000), so 1 unit is 10.
const situation = (wheel: 'single-zero' | 'double-zero'): RouletteSituation => ({
  game: 'roulette',
  rules: { wheel, limits: ROULETTE_PRESETS[wheel].limits },
  balance: '1000',
  lastPocket: null,
});
const START = { counters: {}, lastResult: 'none' as const, cycleTurn: 0 };

describe('roulette built-in strategies', () => {
  it('are runnable and fit both launch presets with their defaults', () => {
    expect(ROULETTE_STRATEGIES.map((s) => s.name)).toEqual(['Flat even-money', 'Fixed two-dozen coverage']);
    for (const definition of ROULETTE_STRATEGIES) {
      expect(validateStrategy(definition)).toEqual({ diagnostics: [], runnable: true });
      for (const preset of Object.values(ROULETTE_PRESETS)) {
        expect(strategyTableCompatibility(definition, strategyDefaults(definition), preset).compatible).toBe(true);
      }
    }
  });

  it('flat even-money bets 10 on red by default, and on any of the six even-money targets', () => {
    expect(strategyDefaults(FLAT_EVEN_MONEY)).toEqual({ target: 'red' });
    const explained = explainPrescription(FLAT_EVEN_MONEY, { target: 'red' }, situation('single-zero'), START);
    expect(explained.ok && explained.explanation.prescription).toEqual({ status: 'prescribed', bets: [{ target: 'red', amount: '10' }] });
    expect(FLAT_EVEN_MONEY.parameters[0]?.choices).toEqual(['red', 'black', 'odd', 'even', 'low', 'high']);
  });

  it('two-dozen coverage bets 10 on each of 1-12 and 13-24 by default, and two different dozens only', () => {
    expect(strategyDefaults(FIXED_TWO_DOZENS)).toEqual({ first: 'dozen-1', second: 'dozen-2' });
    const explained = explainPrescription(FIXED_TWO_DOZENS, { first: 'dozen-1', second: 'dozen-2' }, situation('double-zero'), START);
    expect(explained.ok && explained.explanation.prescription).toEqual({
      status: 'prescribed',
      bets: [
        { target: 'dozen-1', amount: '10' },
        { target: 'dozen-2', amount: '10' },
      ],
    });
    expect(explainPrescription(FIXED_TWO_DOZENS, { first: 'dozen-2', second: 'dozen-2' }, situation('double-zero'), START).ok).toBe(false);
  });

  it('a table whose outside minimum is above 10 is incompatible, naming the requirement', () => {
    const strict = { ...ROULETTE_PRESETS['single-zero'], limits: { inside: { min: '1', max: '100' }, outside: { min: '25', max: '1000' } } };
    expect(strategyTableCompatibility(FLAT_EVEN_MONEY, { target: 'red' }, strict).requirements).toEqual([
      { path: '/instructions/0/bets/0/amount', target: 'red', amount: '10', requirement: 'below-minimum', limit: '25' },
    ]);
  });
});

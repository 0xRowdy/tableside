// Summing contributions into totals. Expected figures are worked by hand.

import { describe, expect, it } from 'vitest';

import { sumContributions } from './totals';

describe('totals', () => {
  it('add exact fractions without rounding', () => {
    // 1/3 + 1/6 = 2/6 + 1/6 = 3/6 = 1/2; then 1/2 - 1/2 = 0.
    expect(
      sumContributions([
        { total: 'casino', game: 'blackjack', currency: 'USD', amount: '1/3' },
        { total: 'casino', game: 'blackjack', currency: 'USD', amount: '1/6' },
      ]),
    ).toEqual([{ total: 'casino', game: 'blackjack', currency: 'USD', records: 2, net: '1/2' }]);
    expect(
      sumContributions([
        { total: 'casino', game: 'craps', currency: 'USD', amount: '1/2' },
        { total: 'casino', game: 'craps', currency: 'USD', amount: '-1/2' },
      ]),
    ).toEqual([{ total: 'casino', game: 'craps', currency: 'USD', records: 2, net: '0' }]);
  });

  it('never add across currencies, games, or practice and casino', () => {
    expect(
      sumContributions([
        { total: 'casino', game: 'roulette', currency: 'USD', amount: '100' },
        { total: 'casino', game: 'roulette', currency: 'EUR', amount: '-40' },
        { total: 'practice', game: 'roulette', currency: 'simulated', amount: '10' },
        { total: 'casino', game: 'craps', currency: 'USD', amount: '5' },
        { total: 'practice', game: 'roulette', currency: 'simulated', amount: '-25' },
      ]),
    ).toEqual([
      { total: 'casino', game: 'craps', currency: 'USD', records: 1, net: '5' },
      { total: 'casino', game: 'roulette', currency: 'EUR', records: 1, net: '-40' },
      { total: 'casino', game: 'roulette', currency: 'USD', records: 1, net: '100' },
      { total: 'practice', game: 'roulette', currency: 'simulated', records: 2, net: '-15' },
    ]);
  });

  it('refuse an amount that is not canonical money', () => {
    expect(() => sumContributions([{ total: 'casino', game: 'craps', currency: 'USD', amount: '2/4' }])).toThrow();
  });
});

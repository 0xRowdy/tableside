// Amount arithmetic for the tables and setup: exact canonical money, never raw
// BigInt on ledger text. A 3:2 blackjack payout on an odd bet leaves a
// fractional balance ("2045/2" is 1,022.5), and every sum the screens show must
// take it. Expected values are worked by hand.

import { decimalUnits, differenceUnits, formatUnits, halfUnits, smallerUnits, sumUnits, totalStake, wholeUnits } from '@/play/units';

describe('amount arithmetic', () => {
  it('adds fractional balances exactly', () => {
    expect(sumUnits('2045/2', '10')).toBe('2065/2');
    expect(formatUnits(sumUnits('2045/2', '25', '75/2'))).toBe('1,085');
    expect(sumUnits()).toBe('0');
  });

  it('totals the stakes of a list of bets', () => {
    expect(totalStake([{ target: 'hand-1', amount: '25' }, { target: 'insurance', amount: '25/2' }])).toBe('75/2');
  });

  it('halves a stake to canonical money, read as an exact decimal', () => {
    expect(halfUnits('25')).toBe('25/2');
    expect(formatUnits(halfUnits('25'))).toBe('12.5');
    expect(halfUnits('40')).toBe('20');
  });

  it('picks the smaller of two amounts, fractions included', () => {
    expect(smallerUnits('2045/2', '1023')).toBe('2045/2');
    expect(smallerUnits('10', '5')).toBe('5');
  });

  it('reads typed digits as canonical money', () => {
    expect(wholeUnits('0042')).toBe('42');
    expect(wholeUnits('000')).toBe('0');
    expect(decimalUnits('12', '50')).toBe('25/2');
    expect(decimalUnits('7', '')).toBe('7');
  });

  it('subtracts exactly, below zero included', () => {
    expect(differenceUnits('2045/2', '10')).toBe('2025/2');
    expect(differenceUnits('10', '25')).toBe('-15');
  });
});

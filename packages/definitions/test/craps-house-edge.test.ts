import { ODDS_CAPS, STANDARD_CRAPS, type OddsCap } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { crapsHouseEdge, standardCraps } from '../src/index';

// Published figures (Wizard of Odds, "Craps — house edge" and "Odds in craps"
// tables; Shackleford): pass/come 1.414%, don't pass/don't come 1.364% per bet
// made (bar 12), odds 0%. Combined edge of a line bet with full odds, per total
// amount bet: pass 1x 0.848%, 2x 0.606%, 3-4-5x 0.374%, 5x 0.326%, 10x 0.184%;
// don't pass 1x 0.682%, 2x 0.455%, 3-4-5x 0.273%, 5x 0.227%, 10x 0.124%.
const PUBLISHED_COMBINED: Record<OddsCap, { pass: number; dont: number }> = {
  '1x': { pass: 0.848, dont: 0.682 },
  '2x': { pass: 0.606, dont: 0.455 },
  '3-4-5x': { pass: 0.374, dont: 0.273 },
  '5x': { pass: 0.326, dont: 0.227 },
  '10x': { pass: 0.184, dont: 0.124 },
};

describe('standard craps house edge', () => {
  it.each(ODDS_CAPS)('line bets under %s odds match the published per-bet edges', (odds) => {
    const rules = standardCraps(odds);
    expect(crapsHouseEdge('pass', rules).percent).toBe('1.41');
    expect(crapsHouseEdge('come', rules).percent).toBe('1.41');
    expect(crapsHouseEdge('dont-pass', rules).percent).toBe('1.36');
    expect(crapsHouseEdge('dont-come', rules).percent).toBe('1.36');
    expect(crapsHouseEdge('odds', rules).percent).toBe('0.00');
  });

  it.each(ODDS_CAPS)('a line bet with full %s odds matches the published combined edge', (odds) => {
    const rules = standardCraps(odds);
    const published = PUBLISHED_COMBINED[odds];
    for (const [wager, value] of [['pass', published.pass], ['come', published.pass], ['dont-pass', published.dont], ['dont-come', published.dont]] as const) {
      const combined = crapsHouseEdge(wager, rules).withFullOdds;
      expect(combined).toMatch(/^\d+\.\d\d$/);
      expect(Math.abs(Number(combined) - value)).toBeLessThan(0.006);
    }
    expect(crapsHouseEdge('odds', rules).withFullOdds).toBeNull();
  });

  it('is a property of the pinned rules, versioned with them', () => {
    const edge = crapsHouseEdge('pass', standardCraps('3-4-5x'));
    expect(edge.rules).toEqual({ id: STANDARD_CRAPS.id, version: STANDARD_CRAPS.version });
    expect(edge.odds).toBe('3-4-5x');
  });
});

describe('standard craps preset', () => {
  it('defaults to 3-4-5x odds and line limits of 10 to 1,000 per wager', () => {
    expect(standardCraps()).toEqual({ id: 'standard-craps', version: 1, odds: '3-4-5x', limits: { line: { min: '10', max: '1000' } } });
    expect(standardCraps('10x').odds).toBe('10x');
  });
});

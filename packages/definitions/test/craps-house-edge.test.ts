import { ODDS_CAPS, STANDARD_CRAPS, type OddsCap } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { CRAPS_EDGE_WAGERS, CRAPS_HOUSE_EDGE_VERSION, crapsEdgeWager, crapsHouseEdge, standardCraps, type CrapsWager } from '../src/index';

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
    expect(edge.version).toBe(CRAPS_HOUSE_EDGE_VERSION);
    expect(edge.odds).toBe('3-4-5x');
  });
});

// Published per-bet-resolved figures for the rest of the menu (Wizard of Odds,
// "Craps — house edge" table; Shackleford): place 4·10 6.67%, 5·9 4.00%,
// 6·8 1.52%; buy and lay with 5% commission on wins only 4·10 1.67%, 5·9
// 2.00%, 6·8 2.27%; field with 12 triple 2.78%, with 12 double 5.56%; hard
// 4·10 11.11%, hard 6·8 9.09%; 2 or 12 at 30:1 13.89%; 3 or 11 at 15:1
// 11.11%; any craps 7:1 11.11%; any seven 4:1 16.67%; horn at 30:1 and 15:1
// 12.50%.
const PUBLISHED: Record<Exclude<CrapsWager, 'pass' | 'dont-pass' | 'come' | 'dont-come' | 'odds' | 'field'>, string> = {
  'place-4': '6.67', 'place-10': '6.67', 'place-5': '4.00', 'place-9': '4.00', 'place-6': '1.52', 'place-8': '1.52',
  'buy-4': '1.67', 'buy-10': '1.67', 'buy-5': '2.00', 'buy-9': '2.00', 'buy-6': '2.27', 'buy-8': '2.27',
  'lay-4': '1.67', 'lay-10': '1.67', 'lay-5': '2.00', 'lay-9': '2.00', 'lay-6': '2.27', 'lay-8': '2.27',
  'hard-4': '11.11', 'hard-10': '11.11', 'hard-6': '9.09', 'hard-8': '9.09',
  'prop-2': '13.89', 'prop-12': '13.89', 'prop-3': '11.11', 'prop-11': '11.11', 'any-craps': '11.11', 'any-seven': '16.67', horn: '12.50',
};

describe('standard craps house edge beyond the line game', () => {
  it.each(Object.entries(PUBLISHED))('%s matches the published edge of %s%%', (wager, published) => {
    expect(crapsHouseEdge(wager as CrapsWager, standardCraps()).percent).toBe(published);
    expect(crapsHouseEdge(wager as CrapsWager, standardCraps()).withFullOdds).toBeNull();
  });

  it('gives the field edge for the selected field payout', () => {
    expect(crapsHouseEdge('field', standardCraps('3-4-5x', 'triple-12'))).toMatchObject({ percent: '2.78', field: 'triple-12' });
    expect(crapsHouseEdge('field', standardCraps('3-4-5x', 'double-12'))).toMatchObject({ percent: '5.56', field: 'double-12' });
  });

  it('includes the commission rounded up at a given buy or lay stake', () => {
    // Buy 6 for 10: wins 12 less a 1-unit commission (5% of 10 rounded up), 11 with chance 5/11, else loses 10: (60 - 55) / 110 = 4.55%.
    expect(crapsHouseEdge('buy-6', standardCraps(), '10')).toMatchObject({ percent: '4.55', stake: '10' });
    // Buy 4 for 20: the commission is exactly 1, so the published edge holds.
    expect(crapsHouseEdge('buy-4', standardCraps(), '20').percent).toBe('1.67');
    // Lay 4 for 10 wins 5 less 1 (5% of 5 rounded up to the minimum): 4 with chance 2/3, else loses 10: (10 - 8) / 30 = 6.67%.
    expect(crapsHouseEdge('lay-4', standardCraps(), '10').percent).toBe('6.67');
    // A stake doesn't change wagers without commission.
    expect(crapsHouseEdge('place-6', standardCraps(), '12')).toMatchObject({ percent: '1.52', stake: null });
  });

  it('covers every wager on the table, and maps engine targets to their wager', () => {
    expect(CRAPS_EDGE_WAGERS).toHaveLength(5 + 18 + 1 + 4 + 7);
    expect(['come-6', 'dont-come-4', 'come-6-odds', 'pass-odds', 'place-8', 'horn'].map(crapsEdgeWager)).toEqual(['come', 'dont-come', 'odds', 'odds', 'place-8', 'horn']);
  });
});

describe('standard craps preset', () => {
  it('defaults to 3-4-5x odds, 12 triple in the field, 10 to 1,000 per wager and 1 to 100 per proposition component', () => {
    expect(standardCraps()).toEqual({
      id: 'standard-craps',
      version: 2,
      odds: '3-4-5x',
      field: 'triple-12',
      limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } },
    });
    expect(standardCraps('10x').odds).toBe('10x');
    expect(standardCraps('2x', 'double-12').field).toBe('double-12');
  });
});

import { createActivity, RANDOM_PROTOCOL_VERSION, type ActivitySpecification } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import { BLACKJACK_LIMITS, blackjackRules, CRAPS_LIMITS, ROULETTE_LIMITS, rouletteRules, standardCraps } from '../src/index';

// Default limits (#3 / spec #51 "Default table limits"): blackjack initial wager
// 10/1,000; craps line/come, place/buy/lay and field 10/1,000, hardways and
// propositions 1/100; roulette inside 1/100, outside 10/1,000. Limits are
// editable before a session; the edited ones are what the activity pins.
const random = { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 2], session: [3, 4] } as const;
const base = { activityId: 'a', owner: 'o', device: 'd', strategy: null, reference: null, fundingSource: 'practice-funding', funding: '1000' } as const;

describe('table limits', () => {
  it('defaults to the launch limits for every game', () => {
    expect(BLACKJACK_LIMITS).toEqual({ initial: { min: '10', max: '1000' } });
    expect(CRAPS_LIMITS).toEqual({ flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } });
    expect(ROULETTE_LIMITS).toEqual({ inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } });
    expect(blackjackRules().limits).toEqual(BLACKJACK_LIMITS);
    expect(standardCraps().limits).toEqual(CRAPS_LIMITS);
    expect(rouletteRules('double-zero').limits).toEqual(ROULETTE_LIMITS);
  });

  it('pins edited limits, and other blackjack players bet the edited minimum', () => {
    const limits = { initial: { min: '25', max: '500' } };
    const rules = blackjackRules('H17_LS', 75, 2, limits);
    expect(rules.limits).toEqual(limits);
    expect(rules.players.otherWagers).toEqual(['25', '25']);
    expect(standardCraps('5x', 'double-12', { flat: { min: '5', max: '2000' }, props: { min: '1', max: '50' } }).limits).toEqual({
      flat: { min: '5', max: '2000' },
      props: { min: '1', max: '50' },
    });
    expect(rouletteRules('single-zero', { inside: { min: '2', max: '50' }, outside: { min: '25', max: '5000' } })).toMatchObject({
      wheel: 'single-zero',
      limits: { inside: { min: '2', max: '50' }, outside: { min: '25', max: '5000' } },
    });
  });

  it('edited rule sets are ones the engine runs', () => {
    const specifications: ActivitySpecification[] = [
      { ...base, game: 'blackjack', rules: blackjackRules('S17_LS', 60, 1, { initial: { min: '5', max: '1000000' } }) },
      { ...base, game: 'craps', rules: standardCraps('2x', 'triple-12', { flat: { min: '25', max: '25' }, props: { min: '1', max: '1' } }) },
      { ...base, game: 'roulette', rules: rouletteRules('double-zero', { inside: { min: '5', max: '5' }, outside: { min: '1', max: '1000000' } }) },
    ];
    for (const specification of specifications) expect(createActivity(specification, random).rules.limits).toEqual(specification.rules.limits);
  });
});

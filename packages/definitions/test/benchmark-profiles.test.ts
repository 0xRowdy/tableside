// The seven benchmark profiles (spec 6, Amendment 6 §1): the shared
// protocol, the launch presets and default limits, the blackjack benchmark
// seat, a validated exposure bound each, and compatibility through Validate.
import { exposureBoundProblems, strategyTableCompatibility, type BenchmarkProfile, type StrategyDefinition } from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_PROFILES,
  blackjackStrategy,
  CRAPS_STRATEGIES,
  ROULETTE_STRATEGIES,
  seatStrategy,
  standardCraps,
  strategyDefaults,
  type BlackjackPreset,
} from '../src/index';

const fits = (definition: StrategyDefinition) =>
  BENCHMARK_PROFILES.filter((profile) => profile.game === definition.game && strategyTableCompatibility(definition, strategyDefaults(definition), profile.rules).compatible).map(
    (profile) => profile.id,
  );

describe('benchmark profiles', () => {
  it('are the seven profiles, each versioned, on the shared protocol', () => {
    expect(BENCHMARK_PROFILES.map((profile) => profile.id)).toEqual([
      'benchmark-blackjack-H17_LS',
      'benchmark-blackjack-H17_noLS',
      'benchmark-blackjack-S17_LS',
      'benchmark-blackjack-S17_noLS',
      'benchmark-craps-standard',
      'benchmark-roulette-single-zero',
      'benchmark-roulette-double-zero',
    ]);
    for (const profile of BENCHMARK_PROFILES) {
      expect(profile).toMatchObject({ version: 1, funding: '1000', base: '10', opportunities: 200, finalSettlement: 'complete' });
    }
  });

  it('each carry a finite exposure bound that matches their rules and stays exact through 100,000 sessions', () => {
    for (const profile of BENCHMARK_PROFILES) expect(exposureBoundProblems(profile)).toEqual([]);
    const tampered: BenchmarkProfile = { ...(BENCHMARK_PROFILES[4] as BenchmarkProfile), exposureBound: '1' };
    expect(exposureBoundProblems(tampered)).toHaveLength(1);
  });

  it('blackjack: six decks, 75% penetration, launch limits, one minimum-bet basic-strategy seat ahead of the evaluated player', () => {
    for (const profile of BENCHMARK_PROFILES) {
      if (profile.game !== 'blackjack') continue;
      const preset = profile.id.replace('benchmark-blackjack-', '') as BlackjackPreset;
      expect(profile.rules).toMatchObject({ decks: 6, penetration: 75, dealer: preset.slice(0, 3), lateSurrender: preset.endsWith('_LS'), limits: { initial: { min: '10', max: '1000' } } });
      expect(profile.rules.players).toEqual({ learnerSeat: 1, otherWagers: ['10'], strategy: seatStrategy(preset) });
      expect(profile.reference).toEqual({ id: 'blackjack-coaching-reference', version: 1 });
    }
  });

  it('craps and roulette: default odds and field, launch limits, nothing at stake at the start', () => {
    expect(BENCHMARK_PROFILES.find((p) => p.game === 'craps')?.rules).toEqual(standardCraps('3-4-5x', 'triple-12'));
    const wheels = BENCHMARK_PROFILES.flatMap((p) => (p.game === 'roulette' ? [p.rules.wheel] : []));
    expect(wheels).toEqual(['single-zero', 'double-zero']);
  });

  it('compatibility follows Validate: surrender-dependent blackjack strategies fit only their own preset', () => {
    expect(fits(blackjackStrategy('S17_LS', 'basic'))).toEqual(['benchmark-blackjack-S17_LS']);
    expect(fits(blackjackStrategy('H17_noLS', 'counting-with-deviations', true))).toEqual(['benchmark-blackjack-H17_noLS']);
    for (const definition of CRAPS_STRATEGIES) expect(fits(definition)).toEqual(['benchmark-craps-standard']);
    for (const definition of ROULETTE_STRATEGIES) expect(fits(definition)).toEqual(['benchmark-roulette-single-zero', 'benchmark-roulette-double-zero']);
  });

  it('craps compatibility depends on the odds the strategy needs', () => {
    const craps = BENCHMARK_PROFILES.find((p) => p.game === 'craps') as BenchmarkProfile;
    const passWithOdds = CRAPS_STRATEGIES[0] as StrategyDefinition;
    expect(strategyTableCompatibility(passWithOdds, {}, craps.rules).compatible).toBe(true);
    expect(strategyTableCompatibility(passWithOdds, {}, standardCraps('1x')).compatible).toBe(true);
    // Declared for 10x tables only, it doesn't fit the 3-4-5x profile.
    const tenX = { ...passWithOdds, table: { ...(passWithOdds.table as Record<string, unknown>), odds: ['10x'] } } as StrategyDefinition;
    expect(strategyTableCompatibility(tenX, {}, craps.rules).compatible).toBe(false);
  });
});

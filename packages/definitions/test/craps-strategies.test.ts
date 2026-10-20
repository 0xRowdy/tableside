import {
  advanceActivity,
  checkpointHash,
  createActivity,
  explainPrescription,
  ODDS_CAPS,
  RANDOM_PROTOCOL_VERSION,
  strategyTableCompatibility,
  validateStrategy,
  type ActivityState,
  type CrapsSituation,
  type StrategyDefinition,
} from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import {
  CRAPS_STRATEGIES,
  DONT_PASS_WITH_LAY_ODDS,
  FLAT_PLACE_6_8,
  PASS_WITH_ODDS,
  PRESS_AND_COLLECT_6_8,
  standardCraps,
  strategyDefaults,
  THREE_POINT_MOLLY,
} from '../src/index';

// Spec #51, Built-in strategies (craps rows), on the default 10-minimum table:
// pass 10 with 10 odds; place 6 and 8 at 12 each after the point; don't pass
// 10 laying 20 / 15 / 12 to win 10 against 4-10 / 5-9 / 6-8; Three-point Molly
// with at most two 10 come bases and 10 odds on each; press-and-collect from 12
// to a 48 cap.
const rules = standardCraps();
const situation = (point: CrapsSituation['point'], bases: [string, string][] = []): CrapsSituation => ({
  game: 'craps',
  rules: { odds: rules.odds, field: rules.field, limits: rules.limits },
  balance: '1000',
  point,
  bases: bases.map(([target, amount]) => ({ target, amount })),
});

function bets(definition: StrategyDefinition, at: CrapsSituation, counters: Record<string, string> = {}) {
  const progress = { counters: { ...Object.fromEntries(definition.counters.map((c) => [c.id, c.initial])), ...counters }, lists: {}, lastResult: 'none' as const, cycleTurn: 0 };
  const result = explainPrescription(definition, {}, at, progress);
  if (!result.ok) throw new Error(result.error);
  const prescription = result.explanation.prescription;
  return prescription.status === 'prescribed' ? prescription.bets.map((b) => `${b.target} ${b.amount}`) : prescription.status;
}

describe('craps built-in strategies', () => {
  it('are runnable and fit standard craps at every odds cap', () => {
    expect(CRAPS_STRATEGIES.map((s) => s.name)).toEqual([
      'Pass with odds',
      'Flat place 6 and 8',
      "Don't pass with lay odds",
      'Three-point Molly',
      'Press-and-collect 6 and 8',
    ]);
    for (const definition of CRAPS_STRATEGIES) {
      expect(validateStrategy(definition)).toEqual({ diagnostics: [], runnable: true });
      for (const odds of ODDS_CAPS) expect(strategyTableCompatibility(definition, strategyDefaults(definition), standardCraps(odds)).compatible).toBe(true);
    }
  });

  it('prescribe exactly the accepted amounts', () => {
    expect(bets(PASS_WITH_ODDS, situation(null))).toEqual(['pass 10']);
    expect(bets(PASS_WITH_ODDS, situation(9, [['pass', '10']]))).toEqual(['pass 10', 'pass-odds 10']);
    expect(bets(FLAT_PLACE_6_8, situation(null))).toBe('uncovered');
    expect(bets(FLAT_PLACE_6_8, situation(8))).toEqual(['place-6 12', 'place-8 12']);
    expect(bets(FLAT_PLACE_6_8, situation(null), { up: '1' })).toEqual(['place-6 12', 'place-8 12']);
    expect([4, 5, 6, 8, 9, 10].map((n) => bets(DONT_PASS_WITH_LAY_ODDS, situation(n as CrapsSituation['point'], [['dont-pass', '10']]))[1])).toEqual([
      'dont-pass-odds 20', 'dont-pass-odds 15', 'dont-pass-odds 12', 'dont-pass-odds 12', 'dont-pass-odds 15', 'dont-pass-odds 20',
    ]);
    expect(bets(THREE_POINT_MOLLY, situation(4, [['pass', '10'], ['come-5', '10']]))).toEqual(['come 10', 'come-5 10', 'come-5-odds 10', 'pass 10', 'pass-odds 10']);
    expect(bets(THREE_POINT_MOLLY, situation(4, [['pass', '10'], ['come-5', '10'], ['come-8', '10']]))).not.toContain('come 10');
    expect(bets(PRESS_AND_COLLECT_6_8, situation(5))).toEqual(['place-6 12', 'place-8 12']);
    expect(bets(PRESS_AND_COLLECT_6_8, situation(5), { 'stake-6': '48', 'stake-8': '24' })).toEqual(['place-6 48', 'place-8 24']);
  });

  it('a builder copy of the same data runs to an identical trace and checkpoint hash (Amendment 2 A3)', () => {
    const play = (definition: StrategyDefinition) => {
      let state: ActivityState = createActivity(
        {
          activityId: 'a',
          owner: 'local',
          device: 'd',
          game: 'craps',
          rules,
          strategy: { definition, parameters: {} },
          reference: null,
          fundingSource: 'practice-funding',
          funding: '1000',
        },
        { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] },
      );
      const hashes: string[] = [];
      for (let roll = 0; roll < 12 && state.phase !== 'correction'; roll++) {
        const send = (command: Parameters<typeof advanceActivity>[1]['command']) => {
          const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
          if (result.status !== 'committed') throw new Error(result.status);
          state = result.state;
        };
        const run = state.strategy as NonNullable<ActivityState['strategy']>;
        const onTable = state.wagers.reduce((sum, w) => sum + BigInt(w.amount), 0n);
        const view = state as Extract<ActivityState, { point: unknown }>;
        const established = (t: string) => /^(dont-)?come-\d+$/.test(t) || (view.point !== null && (t === 'pass' || t === 'dont-pass'));
        const explained = explainPrescription(
          run.definition,
          {},
          { ...situation(view.point), balance: (BigInt(state.balance) + onTable).toString(), bases: state.wagers.filter((w) => established(w.target)) },
          run.deferred?.progress ?? run.progress,
        );
        if (!explained.ok) throw new Error(explained.error);
        const p = explained.explanation.prescription;
        const wanted = p.status === 'prescribed' ? p.bets : [];
        for (const w of state.wagers) if (!wanted.some((b) => b.target === w.target)) send({ kind: 'place-wager', target: w.target, amount: '0' });
        for (const b of wanted) if (state.wagers.find((w) => w.target === b.target)?.amount !== b.amount) send({ kind: 'place-wager', target: b.target, amount: b.amount });
        send({ kind: 'begin-turn' });
        send({ kind: 'settle-turn' });
        hashes.push(checkpointHash(state));
      }
      return hashes;
    };
    for (const definition of CRAPS_STRATEGIES) {
      const copy = JSON.parse(JSON.stringify(definition)) as StrategyDefinition;
      expect(play(copy)).toEqual(play(definition));
    }
  });
});

import {
  advanceActivity,
  createActivity,
  explainPrescription,
  RANDOM_PROTOCOL_VERSION,
  readPermittedView,
  strategyTableCompatibility,
  validateStrategy,
  type ActivityState,
  type Command,
  type RouletteSituation,
  type StrategyDefinition,
} from '@tableside/engine';
import { describe, expect, it } from 'vitest';

import {
  BOUNDED_LABOUCHERE,
  CAPPED_MARTINGALE,
  FIXED_TWO_DOZENS,
  FLAT_EVEN_MONEY,
  ROULETTE_PRESETS,
  ROULETTE_STRATEGIES,
  strategyDefaults,
  THREE_WIN_PARLAY,
} from '../src/index';

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
const START = { counters: {}, lists: {}, lastResult: 'none' as const, cycleTurn: 0 };

describe('roulette built-in strategies', () => {
  it('are runnable and fit both launch presets with their defaults', () => {
    expect(ROULETTE_STRATEGIES.map((s) => s.name)).toEqual(['Flat even-money', 'Fixed two-dozen coverage', 'Capped Martingale', 'Three-win parlay', 'Bounded Labouchere']);
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
    expect(explained.ok && explained.explanation.prescription).toEqual({ status: 'prescribed', bets: [{ target: 'red', amount: '10' }] , held: []});
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
      held: [],
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

// Spec #51, Built-in strategies: "Capped Martingale: 1/2/4/8/16/32 after
// successive losses; a win completes and resets; a loss at 32 terminates at
// cap"; "Three-win parlay: 1/2/4 after consecutive wins; a loss or third win
// completes and resets"; "Bounded Labouchere: start [1,2,3]; bet first+last
// (or sole); win removes endpoints; loss appends stake; empty completes; max
// required stake 32 units". Each coached spin bets exactly what Explain
// prescribes; the all-zero Random123 stream spins 0, 7, 3, 36, 14, 3 on single
// zero (7 3 36 14 red), so black loses six times running and red wins after 0.
describe('roulette built-in progressions', () => {
  const ZERO_STREAM = { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] } as const;
  type Step = { stake: string; phase: string };

  /** Follows the strategy for `spins` spins on target, recording each stake and the phase after it settles. */
  function follow(definition: StrategyDefinition, target: string, spins: number): { steps: Step[]; state: ActivityState } {
    let state: ActivityState = createActivity(
      {
        activityId: 'a',
        owner: 'local',
        device: 'd',
        game: 'roulette',
        rules: ROULETTE_PRESETS['single-zero'],
        strategy: { definition, parameters: { target } },
        reference: null,
        fundingSource: 'practice-funding',
        funding: '1000',
      },
      ZERO_STREAM,
    );
    const steps: Step[] = [];
    const send = (command: Command) => {
      const result = advanceActivity(state, { sequence: state.sequence, commandId: `c${state.sequence}`, command });
      if (result.status !== 'committed') throw new Error(result.status);
      state = result.state;
    };
    for (let i = 0; i < spins && state.phase !== 'cycle-completion'; i++) {
      const stake = amountFor(definition, target, state);
      send({ kind: 'place-wager', target, amount: stake });
      send({ kind: 'begin-turn' });
      send({ kind: 'settle-turn' });
      steps.push({ stake, phase: state.phase });
    }
    return { steps, state };
  }

  function amountFor(definition: StrategyDefinition, target: string, state: ActivityState): string {
    const explained = explainPrescription(
      definition,
      { target },
      { game: 'roulette', rules: { wheel: 'single-zero', limits: ROULETTE_PRESETS['single-zero'].limits }, balance: state.balance, lastPocket: null },
      (state.strategy as NonNullable<ActivityState['strategy']>).progress,
    );
    if (!explained.ok || explained.explanation.prescription.status !== 'prescribed') throw new Error('no prescription');
    return (explained.explanation.prescription.bets[0] as { amount: string }).amount;
  }

  it('Martingale doubles 10, 20, 40, 80, 160, 320 and ends at its cap after the sixth loss', () => {
    const { steps, state } = follow(CAPPED_MARTINGALE, 'black', 10);
    expect(steps.map((s) => s.stake)).toEqual(['10', '20', '40', '80', '160', '320']);
    expect([state.phase, state.balance, readPermittedView(state).strategy?.cycleEnd]).toEqual(['cycle-completion', '370', 'cap']);
  });

  it('a Martingale win completes the cycle', () => {
    // Red: 0 loses 10, 7 wins 20.
    const { steps, state } = follow(CAPPED_MARTINGALE, 'red', 10);
    expect(steps.map((s) => s.stake)).toEqual(['10', '20']);
    expect([state.balance, readPermittedView(state).strategy?.cycleEnd]).toEqual(['1010', 'completed']);
  });

  it('the parlay completes on a loss', () => {
    const { steps, state } = follow(THREE_WIN_PARLAY, 'red', 10);
    expect(steps.map((s) => s.stake)).toEqual(['10']);
    expect(readPermittedView(state).strategy?.cycleEnd).toBe('completed');
  });

  it('Labouchere bets 40 from 1, 2, 3, adds a loss, crosses off wins and completes on an empty line', () => {
    // Red: 0 loses 40 (line 1,2,3,4); 7 wins 50 (2,3); 3 wins 50 (empty).
    const { steps, state } = follow(BOUNDED_LABOUCHERE, 'red', 10);
    expect(steps.map((s) => s.stake)).toEqual(['40', '50', '50']);
    expect([state.balance, readPermittedView(state).strategy?.cycleEnd]).toEqual(['1060', 'completed']);
  });
});

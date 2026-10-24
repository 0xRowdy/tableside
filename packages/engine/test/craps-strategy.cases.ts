// Craps built-in strategies and the craps strategy vocabulary at the engine
// interface (spec #51, Built-in strategies and Strategy execution semantics;
// Amendment 2 A1 Explain prescription, A3 standard craps vocabulary). Expected
// amounts come from the spec's built-in table (craps-strategy.fixtures.ts);
// payouts from the launch rules (#3): line 1:1, place 6/8 7:6, odds 6:5, 3:2
// and 2:1 taken. Dice totals come from the protocol's Python reference
// (craps.cases):
//   "pi digits": 8 11 6 4 12 8 6 7 3 6 4 8 11 7 8 7 ...
//   key [0, 0]:  8 8 9 6 11 5 3 5 2 6 7 7 7 4 8 2 ...
//   key [2, 0]:  12 5 12 9 9 8 10 4 5 5 ...
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  explainPrescription,
  strategyTableCompatibility,
  validateStrategy,
  type ActivityState,
  type CrapsSituation,
  type DomainFact,
  type StrategyDefinition,
  type StrategyProgress,
} from '../src';

import { CRAPS_SPEC } from './craps.cases';
import { CRAPS_BUILT_INS, DONT_PASS_LAY, FLAT_PLACE, PASS_WITH_ODDS, PRESS_AND_COLLECT, THREE_POINT_MOLLY } from './craps-strategy.fixtures';
import { crapsView, follow, guidedCraps, keyed, place, prescriptionNow, ROLL, send, SETTLE } from './craps-strategy.helpers';
import { PI } from './fixtures';

const kinds = (facts: readonly DomainFact[]) => facts.map((fact) => fact.kind);
const found = (definition: unknown) => validateStrategy(definition).diagnostics.map((d) => `${d.category} ${d.path}`);
const START: StrategyProgress = { counters: {}, lists: {}, lastResult: 'none', cycleTurn: 0 };

const situation = (point: CrapsSituation['point'], bases: [string, string][] = [], balance = '1000'): CrapsSituation => ({
  game: 'craps',
  rules: { odds: '3-4-5x', field: 'triple-12', limits: CRAPS_SPEC.rules.limits },
  balance,
  point,
  bases: bases.map(([target, amount]) => ({ target, amount })),
});

function prescribed(definition: StrategyDefinition, at: CrapsSituation, progress: StrategyProgress = START) {
  const result = explainPrescription(definition, {}, at, progress);
  if (!result.ok) throw new Error(result.error);
  return result.explanation.prescription;
}

const bets = (...pairs: [string, string][]) => pairs.map(([target, amount]) => ({ target, amount }));
const pressAt = (counters: Record<string, string>): StrategyProgress => ({
  counters: { 'stake-6': '12', 'press-6': '0', 'stake-8': '12', 'press-8': '0', up: '0', ...counters },
  lists: {},
  lastResult: 'win',
  cycleTurn: 1,
});

/** One decision of a trace: the bets the roll began with, its total and the balance after it settled. */
const trace = (decisions: ReturnType<typeof follow>['decisions']) => decisions.map((d) => [d.bets, d.total, d.balance]);

export const crapsStrategyCases: TestCase[] = [
  {
    name: 'craps strategy: the five craps built-ins are runnable and fit the default table',
    run: (t) => {
      for (const definition of CRAPS_BUILT_INS) {
        t.equal(validateStrategy(definition), { diagnostics: [], runnable: true });
        t.equal(strategyTableCompatibility(definition, {}, CRAPS_SPEC.rules).compatible, true);
      }
    },
  },
  {
    name: 'craps strategy: the vocabulary judges tables, targets, increments and per-wager adjustments by path',
    run: (t) => {
      t.equal(found({ ...PASS_WITH_ODDS, table: { odds: [], limits: CRAPS_SPEC.rules.limits } }), ['incomplete /table/odds']);
      const instruction = PASS_WITH_ODDS.instructions[0] as StrategyDefinition['instructions'][number];
      const withBet = (target: string, amount: string) => ({ ...PASS_WITH_ODDS, instructions: [{ ...instruction, bets: [{ target: { target }, amount: { lit: amount } }] }] });
      t.equal(found(withBet('come-11', '10')), ['incompatible /instructions/0/bets/0/target']);
      // Place 6 goes in multiples of 6.
      t.equal(found(withBet('place-6', '10')), ['incompatible /instructions/0/bets/0/amount']);
      t.equal(found({ ...FLAT_PLACE, adjustments: [{ id: 'x', on: 'win', wager: 'place-7', counter: 'up', to: { lit: '1' } }] }), ['incompatible /adjustments/0/wager']);
      // A table outside the declared odds caps is a different table; a lower maximum fails the 12s by name.
      t.equal(strategyTableCompatibility({ ...FLAT_PLACE, table: { ...(FLAT_PLACE.table as object), odds: ['10x'] } }, {}, CRAPS_SPEC.rules).requirements, [{ path: '/table/odds', requirement: 'odds' }]);
      const tight = { ...CRAPS_SPEC.rules, limits: { ...CRAPS_SPEC.rules.limits, flat: { min: '15', max: '1000' } } };
      t.equal(strategyTableCompatibility(FLAT_PLACE, {}, tight).requirements.map((r) => [r.target, r.requirement, r.limit]), [
        ['place-6', 'below-minimum', '15'],
        ['place-8', 'below-minimum', '15'],
        ['place-6', 'below-minimum', '15'],
        ['place-8', 'below-minimum', '15'],
      ]);
    },
  },
  {
    name: 'craps strategy: Explain prescription gives each built-in\'s accepted amounts',
    run: (t) => {
      // Pass with odds: pass 10, then 10 odds behind it.
      t.equal(prescribed(PASS_WITH_ODDS, situation(null)), { status: 'prescribed', bets: bets(['pass', '10']), held: [] });
      t.equal(prescribed(PASS_WITH_ODDS, situation(6, [['pass', '10']])), { status: 'prescribed', bets: bets(['pass', '10'], ['pass-odds', '10']), held: [] });
      // Flat place: 12 each once a point is on, including when 6 or 8 is the point; nothing on a first come-out.
      for (const point of [4, 6, 8] as const) {
        t.equal(prescribed(FLAT_PLACE, situation(point), { ...START, counters: { up: '0' } }), { status: 'prescribed', bets: bets(['place-6', '12'], ['place-8', '12']), held: [] });
      }
      t.equal(prescribed(FLAT_PLACE, situation(null), { ...START, counters: { up: '0' } }), { status: 'uncovered' });
      // Don't pass: lay to win 10 — 20 against 4 or 10, 15 against 5 or 9, 12 against 6 or 8.
      t.equal(prescribed(DONT_PASS_LAY, situation(null)), { status: 'prescribed', bets: bets(['dont-pass', '10']), held: [] });
      for (const [point, lay] of [[4, '20'], [10, '20'], [5, '15'], [9, '15'], [6, '12'], [8, '12']] as const) {
        t.equal(prescribed(DONT_PASS_LAY, situation(point, [['dont-pass', '10']])), { status: 'prescribed', bets: bets(['dont-pass', '10'], ['dont-pass-odds', lay]), held: [] });
      }
      // Three-point Molly: one more come base while fewer than two have traveled, 10 odds on each.
      t.equal(prescribed(THREE_POINT_MOLLY, situation(5, [['pass', '10'], ['come-6', '10']])), {
        status: 'prescribed',
        bets: bets(['come', '10'], ['come-6', '10'], ['come-6-odds', '10'], ['pass', '10'], ['pass-odds', '10']),
        held: [],
      });
      t.equal(prescribed(THREE_POINT_MOLLY, situation(5, [['pass', '10'], ['come-6', '10'], ['come-9', '10']])), {
        status: 'prescribed',
        bets: bets(['come-6', '10'], ['come-6-odds', '10'], ['come-9', '10'], ['come-9-odds', '10'], ['pass', '10'], ['pass-odds', '10']),
        held: [],
      });
      // On the come-out, established come bases keep their odds (off) and a new pass line goes down.
      t.equal(prescribed(THREE_POINT_MOLLY, situation(null, [['come-6', '10']])), { status: 'prescribed', bets: bets(['come-6', '10'], ['come-6-odds', '10'], ['pass', '10']), held: [] });
      // Press-and-collect: each number at its own stake.
      t.equal(prescribed(PRESS_AND_COLLECT, situation(9), pressAt({ 'stake-6': '36', 'stake-8': '12' })), { status: 'prescribed', bets: bets(['place-6', '36'], ['place-8', '12']), held: [] });
    },
  },
  {
    name: 'craps strategy: a prescription is judged against the table now — bases stay as they are and odds fit their base',
    run: (t) => {
      // A pass line can't be made with the puck on; an established base is restated, never changed.
      t.equal(prescribed(PASS_WITH_ODDS, situation(6)), { status: 'uncovered' });
      const tenOdds = { ...PASS_WITH_ODDS, instructions: [{ id: 'odds', label: 'odds', when: { subject: 'puck', is: 'on' }, bets: [{ target: { target: 'pass-odds' }, amount: { lit: '60' } }] }] };
      // 60 odds behind a 10 pass line on 6 is past 5x (3-4-5x); without a pass line there is nothing to take odds on.
      t.equal(prescribed(tenOdds, situation(6, [['pass', '10']])), { status: 'paused', reason: 'limit', unavailable: bets(['pass-odds', '60']) });
      t.equal(prescribed(tenOdds, situation(6)), { status: 'paused', reason: 'limit', unavailable: bets(['pass-odds', '60']) });
      // Situations that can't happen are refused.
      const refused = (value: unknown) => explainPrescription(PASS_WITH_ODDS, {}, value, START).ok;
      t.equal(refused(situation(null, [['pass', '10']])), false);
      t.equal(refused(situation(6, [['come-6', '10']], '5')), false);
      t.equal(refused({ ...situation(6), point: 7 }), false);
    },
  },
  {
    name: 'craps strategy: an atomic group places completely or not at all — 20 places neither 12',
    run: (t) => {
      t.equal(prescribed(FLAT_PLACE, situation(6, [], '20'), { ...START, counters: { up: '0' } }), {
        status: 'paused',
        reason: 'unfunded-group',
        unavailable: bets(['place-6', '12'], ['place-8', '12']),
      });
      // In play: the first come-out (8) sets the point with nothing at stake, then 20 can't place 24.
      const { state } = follow(guidedCraps(FLAT_PLACE, PI, { funding: '20' }), 3);
      t.equal([state.phase, state.wagers, state.balance], ['settled-outcome', [], '20']);
      t.equal(crapsView(state).strategy?.pending, { reason: 'unfunded-group', unavailable: bets(['place-6', '12'], ['place-8', '12']), turn: 1 });
    },
  },
  {
    name: 'craps strategy: pass with odds follows the pi stream — 8 sets the point, 8 makes it and pays 10 plus 12 odds',
    run: (t) => {
      const { decisions } = follow(guidedCraps(PASS_WITH_ODDS, PI), 8);
      t.equal(trace(decisions), [
        ['pass 10', 8, '990'],
        ['pass 10, pass-odds 10', 11, '980'],
        ['pass 10, pass-odds 10', 6, '980'],
        ['pass 10, pass-odds 10', 4, '980'],
        ['pass 10, pass-odds 10', 12, '980'],
        ['pass 10, pass-odds 10', 8, '1022'],
        ['pass 10', 6, '1012'],
        ['pass 10, pass-odds 10', 7, '1002'],
      ]);
    },
  },
  {
    name: "craps strategy: don't pass keeps its base through a bar-12 push and lays to win 10",
    run: (t) => {
      let state: ActivityState = guidedCraps(DONT_PASS_LAY, keyed(2));
      const first = follow(state, 1);
      state = first.state;
      t.equal(first.facts.find((fact) => fact.kind === 'wager-pushed'), { kind: 'wager-pushed', turn: 1, target: 'dont-pass', stake: '10' });
      t.equal(state.wagers, bets(['dont-pass', '10']));
      // The base already on the table is exactly the next come-out's prescription.
      t.equal(prescriptionNow(state), { status: 'prescribed', bets: bets(['dont-pass', '10']), held: [] });
      t.equal(trace(follow(state, 3).decisions), [
        ['dont-pass 10', 5, '990'],
        ['dont-pass 10, dont-pass-odds 15', 12, '975'],
        ['dont-pass 10, dont-pass-odds 15', 9, '975'],
      ]);
      // Key [0, 0]: 8 then 9 then 4 are points: 12, 15 and 20 laid.
      const laid = follow(guidedCraps(DONT_PASS_LAY, keyed(0)), 15).decisions.map((d) => d.bets);
      t.equal([laid[1], laid[3], laid[14]], ['dont-pass 10, dont-pass-odds 12', 'dont-pass 10, dont-pass-odds 15', 'dont-pass 10, dont-pass-odds 20']);
    },
  },
  {
    name: 'craps strategy: flat place 6 and 8 waits for a point, keeps its stakes up (off) through a made point and loses them on a seven-out',
    run: (t) => {
      const { decisions, facts } = follow(guidedCraps(FLAT_PLACE, PI), 10);
      t.equal(trace(decisions), [
        // A roll with nothing at stake: the strategy places nothing before the point.
        ['', 8, '1000'],
        ['place-6 12, place-8 12', 11, '976'],
        // Place 6 wins 14 and stays up.
        ['place-6 12, place-8 12', 6, '990'],
        ['place-6 12, place-8 12', 4, '990'],
        ['place-6 12, place-8 12', 12, '990'],
        // 8 is the point and place 8 wins 14 with it.
        ['place-6 12, place-8 12', 8, '1004'],
        // Off on the come-out: the 6 that sets the point pays nothing.
        ['place-6 12, place-8 12', 6, '1004'],
        // Seven-out: both lose, and the next come-out places nothing again.
        ['place-6 12, place-8 12', 7, '1004'],
        ['', 3, '1004'],
        ['', 6, '1004'],
      ]);
      const settled = facts.filter((fact) => fact.kind === 'wager-settled').map((fact) => fact.kind === 'wager-settled' && [fact.turn, fact.target, fact.net, fact.returned]);
      t.equal(settled, [[3, 'place-6', '14', '14'], [6, 'place-8', '14', '14'], [8, 'place-6', '-12', '0'], [8, 'place-8', '-12', '0']]);
    },
  },
  {
    name: 'craps strategy: three-point Molly keeps at most two come bases, odds on each, and settles the whole roll before replacing',
    run: (t) => {
      t.equal(trace(follow(guidedCraps(THREE_POINT_MOLLY, PI), 8).decisions), [
        ['pass 10', 8, '990'],
        // The come bet wins on 11.
        ['pass 10, pass-odds 10, come 10', 11, '990'],
        ['pass 10, pass-odds 10, come 10', 6, '980'],
        ['pass 10, pass-odds 10, come 10, come-6 10, come-6-odds 10', 4, '960'],
        // Two come bases and the pass line: no more come bets.
        ['pass 10, pass-odds 10, come-4 10, come-4-odds 10, come-6 10, come-6-odds 10', 12, '950'],
        ['pass 10, pass-odds 10, come-4 10, come-4-odds 10, come-6 10, come-6-odds 10', 8, '992'],
        // Come-out: the come bases stay with their odds off; 6 pays come 6 even money and returns its odds, then sets the point.
        ['pass 10, come-4 10, come-4-odds 10, come-6 10, come-6-odds 10', 6, '1012'],
        // One come base left, so one more come bet.
        ['pass 10, pass-odds 10, come 10, come-4 10, come-4-odds 10', 7, '1012'],
      ]);
    },
  },
  {
    name: 'craps strategy: press-and-collect collects the first hit, presses 12 on the second, per number, and a seven-out resets it',
    run: (t) => {
      const { decisions } = follow(guidedCraps(PRESS_AND_COLLECT, keyed(0)), 15);
      t.equal(trace(decisions).slice(0, 12), [
        ['', 8, '1000'],
        // Place 8 wins with the point of 8: first hit, collected.
        ['place-6 12, place-8 12', 8, '990'],
        ['place-6 12, place-8 12', 9, '990'],
        // Place 6, first hit: collected.
        ['place-6 12, place-8 12', 6, '1004'],
        ['place-6 12, place-8 12', 11, '1004'],
        ['place-6 12, place-8 12', 5, '1004'],
        ['place-6 12, place-8 12', 3, '1004'],
        ['place-6 12, place-8 12', 5, '1004'],
        ['place-6 12, place-8 12', 2, '1004'],
        // Place 6, second hit: paid 14, then pressed to 24 (12 of the 14 go up).
        ['place-6 12, place-8 12', 6, '1018'],
        ['place-6 24, place-8 12', 7, '1006'],
        // The seven-out reset both numbers.
        ['', 7, '1006'],
      ]);
      t.equal(follow(guidedCraps(PRESS_AND_COLLECT, keyed(0)), 15).state.strategy?.progress.counters, { 'stake-6': '12', 'press-6': '0', 'stake-8': '12', 'press-8': '1', up: '1' });
      // The rest of the ladder, from the counters: 24 collects, 36 presses on the 4th hit, 48 on the 6th, and then every hit collects.
      const ladder: string[] = [];
      let progress = pressAt({});
      for (let hit = 1; hit <= 8; hit++) {
        const before = (prescribed(PRESS_AND_COLLECT, situation(9), progress) as unknown as { bets: { amount: string }[] }).bets[0]?.amount as string;
        ladder.push(before);
        const press = progress.counters['press-6'] === '1';
        const stake = Math.min(48, Number(before) + (press ? 12 : 0));
        progress = pressAt({ 'stake-6': String(stake), 'press-6': press ? '0' : '1' });
      }
      t.equal(ladder, ['12', '12', '24', '24', '36', '36', '48', '48']);
    },
  },
  {
    name: 'craps strategy: a blocked press keeps the paid win, the stake and the pre-press counters, and waits as a pending action',
    run: (t) => {
      // Place maximum 20: the second place 6 hit pays 14, and the press to 24 is over the maximum.
      let { state } = follow(guidedCraps(PRESS_AND_COLLECT, keyed(0), { flatMax: '20' }), 9);
      const settled = send(send(state, ROLL).state, SETTLE);
      state = settled.state;
      t.equal(settled.facts.filter((fact) => fact.kind === 'wager-settled'), [
        { kind: 'wager-settled', turn: 10, target: 'place-6', stake: '12', result: 'win', net: '14', returned: '14' },
      ]);
      t.equal(settled.facts.at(-1), { kind: 'strategy-paused', reason: 'limit', unavailable: bets(['place-6', '24']), turn: 10 });
      t.equal([state.phase, state.balance, state.wagers], ['settled-outcome', '1018', bets(['place-6', '12'], ['place-8', '12'])]);
      const run = state.strategy as NonNullable<ActivityState['strategy']>;
      t.equal([run.progress.counters['stake-6'], run.progress.counters['press-6']], ['12', '1']);
      t.equal([run.deferred?.turn, run.deferred?.progress.counters['stake-6']], [10, '24']);
      // Explain prescription matches it from the same state (with the adjustment that waits).
      t.equal(prescriptionNow(state), { status: 'prescribed', bets: bets(['place-8', '12']), held: [{ instruction: 'place-6', reason: 'limit', unavailable: bets(['place-6', '24']) }] });
      // No further roll while it is pending: rolling is a departure, held before anything is drawn.
      const held = send(state, ROLL).state;
      t.equal([held.phase, held.random, held.turn], ['correction', state.random, 10]);
      // A rebuy can't lift a table maximum; the pending action stays and nothing is paid again.
      const rebought = send(state, { kind: 'rebuy', amount: '100' });
      t.equal([kinds(rebought.facts), crapsView(rebought.state).strategy?.pending?.reason], [['funding-added'], 'limit']);
      t.equal(crapsView(state).legalCommands, ['place-wager', 'set-working', 'begin-turn', 'collect-instead', 'stop-strategy', 'request-stop', 'rebuy']);
    },
  },
  {
    name: 'craps strategy: "Collect instead" ends the cycle, takes the place bets down, pays nothing again and waits for an explicit restart',
    run: (t) => {
      let { state } = follow(guidedCraps(PRESS_AND_COLLECT, keyed(0), { flatMax: '20' }), 9);
      state = send(send(state, ROLL).state, SETTLE).state;
      const collected = send(state, { kind: 'collect-instead' });
      t.equal(collected.facts, [
        { kind: 'cycle-ended', reason: 'collected' },
        { kind: 'wager-returned', target: 'place-6', amount: '12' },
        { kind: 'wager-returned', target: 'place-8', amount: '12' },
      ]);
      state = collected.state;
      const view = crapsView(state);
      t.equal([state.phase, state.balance, state.wagers, view.strategy?.cycleEnd, view.strategy?.pending], ['cycle-completion', '1042', [], 'collected', null]);
      t.equal(view.legalCommands, ['restart-cycle', 'stop-strategy', 'request-stop', 'rebuy']);
      // The cycle's record: 10 rolls followed, net +42 (14 + 14 + 14 kept from the place bets).
      t.equal([view.strategy?.cycle.turns.length, view.strategy?.cycle.net], [10, '42']);
      const restarted = send(state, { kind: 'restart-cycle' }).state;
      t.equal([restarted.phase, restarted.strategy?.progress.counters, restarted.strategy?.deferred], ['open-decision', { 'stake-6': '12', 'press-6': '0', 'stake-8': '12', 'press-8': '0', up: '0' }, null]);
      // Collect instead is offered only at a pending strategy action.
      t.equal(crapsView(restarted).legalCommands.includes('collect-instead'), false);
    },
  },
  {
    name: 'craps strategy: an override ends the cycle; removable wagers come back, the pass line contract stays, and a restart picks it up',
    run: (t) => {
      // Point 8; the player sets 30 odds instead of 10.
      let state = follow(guidedCraps(PASS_WITH_ODDS, PI), 1).state;
      state = send(send(state, place('pass-odds', '30')).state, ROLL).state;
      const held = state.strategy?.correction?.explanation;
      t.equal([state.phase, held && 'prescription' in held ? held.prescription : null], ['correction', { status: 'prescribed', bets: bets(['pass', '10'], ['pass-odds', '10']), held: [] }]);
      state = send(state, { kind: 'override-correction' }).state;
      // 11: nothing resolves; the cycle ends and the 30 odds come back.
      const settled = send(state, SETTLE);
      t.equal(kinds(settled.facts), ['wager-returned']);
      state = settled.state;
      t.equal([state.phase, state.balance, state.wagers, crapsView(state).strategy?.cycleEnd], ['cycle-completion', '990', bets(['pass', '10']), 'override']);
      const decoded = decodeCheckpoint(encodeCheckpoint(state));
      t.equal(decoded.ok, true);
      state = send(state, { kind: 'restart-cycle' }).state;
      t.equal(prescriptionNow(state), { status: 'prescribed', bets: bets(['pass', '10'], ['pass-odds', '10']), held: [] });
    },
  },
  {
    name: 'craps strategy: Stop strategy never refunds a committed pass or come base; removable wagers come back',
    run: (t) => {
      const state = follow(guidedCraps(THREE_POINT_MOLLY, PI), 4).state;
      // The 4 just carried the come bet to its number.
      t.equal(state.wagers, bets(['pass', '10'], ['pass-odds', '10'], ['come-4', '10'], ['come-6', '10'], ['come-6-odds', '10']));
      const stopped = send(state, { kind: 'stop-strategy' });
      t.equal(stopped.facts, [
        { kind: 'strategy-stopped' },
        { kind: 'wager-returned', target: 'pass-odds', amount: '10' },
        { kind: 'wager-returned', target: 'come-6-odds', amount: '10' },
      ]);
      t.equal([stopped.state.balance, stopped.state.wagers], ['980', bets(['pass', '10'], ['come-4', '10'], ['come-6', '10'])]);
      // The contracts play on uncoached: 12 then 8 makes the point and pays the pass line.
      const after = send(send(send(send(stopped.state, ROLL).state, SETTLE).state, ROLL).state, SETTLE).state;
      t.equal([after.balance, after.wagers], ['1000', bets(['come-4', '10'], ['come-6', '10'])]);
    },
  },
  {
    name: 'craps strategy: a waiting adjustment survives a checkpoint round trip; a tampered one, or a removable wager at a cycle result, is damage',
    run: (t) => {
      let { state } = follow(guidedCraps(PRESS_AND_COLLECT, keyed(0), { flatMax: '20' }), 9);
      state = send(send(state, ROLL).state, SETTLE).state;
      const decoded = decodeCheckpoint(encodeCheckpoint(state));
      t.equal(decoded.ok && decoded.state, state);
      type Deferred = { strategy: { deferred: { turn: number; progress: { counters: Record<string, string> } } } };
      const kind = (edit: (value: Deferred) => void) => {
        const value = JSON.parse(encodeCheckpoint(state));
        edit(value);
        const result = decodeCheckpoint(encodeCheckpoint(value));
        return result.ok ? 'ok' : result.error.message;
      };
      t.equal(kind((v) => (v.strategy.deferred.turn = 99)), 'damaged strategy adjustment');
      t.equal(kind((v) => (v.strategy.deferred.progress.counters['stake-6'] = 'x')), 'damaged strategy adjustment');
      // A cycle result with a place bet still up: the cycle's removable wagers resolved when it ended.
      const ended = send(state, { kind: 'collect-instead' }).state;
      const tampered = JSON.parse(encodeCheckpoint(ended));
      tampered.wagers = [{ target: 'place-6', amount: '12' }];
      tampered.balance = '1030';
      const result = decodeCheckpoint(encodeCheckpoint(tampered));
      t.equal(result.ok ? 'ok' : result.error.message, 'damaged cycle completion');
    },
  },
  {
    name: 'craps strategy: a roll with nothing at stake is taken only while the strategy places nothing; free play still needs a wager',
    run: (t) => {
      const guided = send(guidedCraps(FLAT_PLACE, PI), ROLL);
      t.equal([guided.state.phase, kinds(guided.facts)], ['revealing-outcome', ['turn-began', 'dice-rolled']]);
      // Pass with odds prescribes a pass line on the come-out: an empty roll is not what it says.
      const pass = advanceActivity(guidedCraps(PASS_WITH_ODDS, PI), { sequence: 0, commandId: 'x', command: ROLL });
      t.equal(pass.status === 'committed' && pass.facts[0], { kind: 'illegal-action', command: ROLL, reason: 'no-wager' });
    },
  },
];

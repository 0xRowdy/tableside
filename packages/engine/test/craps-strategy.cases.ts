// Spec 1 Built-in strategies, Strategy execution semantics
// Spec 1 Amendment 2 A1 Explain prescription, A3 standard craps vocabulary
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
      t.equal(found(withBet('place-6', '10')), ['incompatible /instructions/0/bets/0/amount']);
      t.equal(found({ ...FLAT_PLACE, adjustments: [{ id: 'x', on: 'win', wager: 'place-7', counter: 'up', to: { lit: '1' } }] }), ['incompatible /adjustments/0/wager']);
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
      t.equal(prescribed(PASS_WITH_ODDS, situation(null)), { status: 'prescribed', bets: bets(['pass', '10']), held: [] });
      t.equal(prescribed(PASS_WITH_ODDS, situation(6, [['pass', '10']])), { status: 'prescribed', bets: bets(['pass', '10'], ['pass-odds', '10']), held: [] });
      for (const point of [4, 6, 8] as const) {
        t.equal(prescribed(FLAT_PLACE, situation(point), { ...START, counters: { up: '0' } }), { status: 'prescribed', bets: bets(['place-6', '12'], ['place-8', '12']), held: [] });
      }
      t.equal(prescribed(FLAT_PLACE, situation(null), { ...START, counters: { up: '0' } }), { status: 'uncovered' });
      t.equal(prescribed(DONT_PASS_LAY, situation(null)), { status: 'prescribed', bets: bets(['dont-pass', '10']), held: [] });
      for (const [point, lay] of [[4, '20'], [10, '20'], [5, '15'], [9, '15'], [6, '12'], [8, '12']] as const) {
        t.equal(prescribed(DONT_PASS_LAY, situation(point, [['dont-pass', '10']])), { status: 'prescribed', bets: bets(['dont-pass', '10'], ['dont-pass-odds', lay]), held: [] });
      }
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
      t.equal(prescribed(THREE_POINT_MOLLY, situation(null, [['come-6', '10']])), { status: 'prescribed', bets: bets(['come-6', '10'], ['come-6-odds', '10'], ['pass', '10']), held: [] });
      t.equal(prescribed(PRESS_AND_COLLECT, situation(9), pressAt({ 'stake-6': '36', 'stake-8': '12' })), { status: 'prescribed', bets: bets(['place-6', '36'], ['place-8', '12']), held: [] });
    },
  },
  {
    name: 'craps strategy: a prescription is judged against the table now — bases stay as they are and odds fit their base',
    run: (t) => {
      t.equal(prescribed(PASS_WITH_ODDS, situation(6)), { status: 'uncovered' });
      const tenOdds = { ...PASS_WITH_ODDS, instructions: [{ id: 'odds', label: 'odds', when: { subject: 'puck', is: 'on' }, bets: [{ target: { target: 'pass-odds' }, amount: { lit: '60' } }] }] };
      t.equal(prescribed(tenOdds, situation(6, [['pass', '10']])), { status: 'paused', reason: 'limit', unavailable: bets(['pass-odds', '60']) });
      t.equal(prescribed(tenOdds, situation(6)), { status: 'paused', reason: 'limit', unavailable: bets(['pass-odds', '60']) });
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
      t.equal(prescriptionNow(state), { status: 'prescribed', bets: bets(['dont-pass', '10']), held: [] });
      t.equal(trace(follow(state, 3).decisions), [
        ['dont-pass 10', 5, '990'],
        ['dont-pass 10, dont-pass-odds 15', 12, '975'],
        ['dont-pass 10, dont-pass-odds 15', 9, '975'],
      ]);
      const laid = follow(guidedCraps(DONT_PASS_LAY, keyed(0)), 15).decisions.map((d) => d.bets);
      t.equal([laid[1], laid[3], laid[14]], ['dont-pass 10, dont-pass-odds 12', 'dont-pass 10, dont-pass-odds 15', 'dont-pass 10, dont-pass-odds 20']);
    },
  },
  {
    name: 'craps strategy: flat place 6 and 8 waits for a point, keeps its stakes up (off) through a made point and loses them on a seven-out',
    run: (t) => {
      const { decisions, facts } = follow(guidedCraps(FLAT_PLACE, PI), 10);
      t.equal(trace(decisions), [
        ['', 8, '1000'],
        ['place-6 12, place-8 12', 11, '976'],
        ['place-6 12, place-8 12', 6, '990'],
        ['place-6 12, place-8 12', 4, '990'],
        ['place-6 12, place-8 12', 12, '990'],
        ['place-6 12, place-8 12', 8, '1004'],
        ['place-6 12, place-8 12', 6, '1004'],
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
        ['pass 10, pass-odds 10, come 10', 11, '990'],
        ['pass 10, pass-odds 10, come 10', 6, '980'],
        ['pass 10, pass-odds 10, come 10, come-6 10, come-6-odds 10', 4, '960'],
        ['pass 10, pass-odds 10, come-4 10, come-4-odds 10, come-6 10, come-6-odds 10', 12, '950'],
        ['pass 10, pass-odds 10, come-4 10, come-4-odds 10, come-6 10, come-6-odds 10', 8, '992'],
        ['pass 10, come-4 10, come-4-odds 10, come-6 10, come-6-odds 10', 6, '1012'],
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
        ['place-6 12, place-8 12', 8, '990'],
        ['place-6 12, place-8 12', 9, '990'],
        ['place-6 12, place-8 12', 6, '1004'],
        ['place-6 12, place-8 12', 11, '1004'],
        ['place-6 12, place-8 12', 5, '1004'],
        ['place-6 12, place-8 12', 3, '1004'],
        ['place-6 12, place-8 12', 5, '1004'],
        ['place-6 12, place-8 12', 2, '1004'],
        ['place-6 12, place-8 12', 6, '1018'],
        ['place-6 24, place-8 12', 7, '1006'],
        ['', 7, '1006'],
      ]);
      t.equal(follow(guidedCraps(PRESS_AND_COLLECT, keyed(0)), 15).state.strategy?.progress.counters, { 'stake-6': '12', 'press-6': '0', 'stake-8': '12', 'press-8': '1', up: '1' });
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
      t.equal(prescriptionNow(state), { status: 'prescribed', bets: bets(['place-8', '12']), held: [{ instruction: 'place-6', reason: 'limit', unavailable: bets(['place-6', '24']) }] });
      const held = send(state, ROLL).state;
      t.equal([held.phase, held.random, held.turn], ['correction', state.random, 10]);
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
      t.equal(crapsView(state).strategy?.overrideAffected, false);
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
      t.equal([view.strategy?.cycle.turns.length, view.strategy?.cycle.net], [10, '42']);
      // Spec 1 user story 51
      t.equal([view.strategy?.overrideAffected, view.strategy?.departures], [true, []]);
      const restarted = send(state, { kind: 'restart-cycle' }).state;
      t.equal([restarted.phase, restarted.strategy?.progress.counters, restarted.strategy?.deferred], ['open-decision', { 'stake-6': '12', 'press-6': '0', 'stake-8': '12', 'press-8': '0', up: '0' }, null]);
      t.equal([crapsView(restarted).legalCommands.includes('collect-instead'), crapsView(restarted).strategy?.overrideAffected], [false, true]);
    },
  },
  {
    name: 'craps strategy: an override ends the cycle; removable wagers come back and the pass line contract settles by automatic rolls before the cycle result',
    run: (t) => {
      let state = follow(guidedCraps(PASS_WITH_ODDS, PI), 1).state;
      state = send(send(state, place('pass-odds', '30')).state, ROLL).state;
      const held = state.strategy?.correction?.explanation;
      t.equal([state.phase, held && 'prescription' in held ? held.prescription : null], ['correction', { status: 'prescribed', bets: bets(['pass', '10'], ['pass-odds', '10']), held: [] }]);
      state = send(state, { kind: 'override-correction' }).state;
      const settled = send(state, SETTLE);
      t.equal(kinds(settled.facts), ['wager-returned']);
      state = settled.state;
      const settling = crapsView(state);
      t.equal(
        [state.phase, state.balance, state.wagers, settling.strategy?.cycleEnd, settling.legalCommands, settling.wagersCommitted],
        ['strategy-settlement', '990', bets(['pass', '10']), 'override', ['advance-strategy-settlement', 'request-stop'], true],
      );
      t.equal(decodeCheckpoint(encodeCheckpoint(state)).ok, true);
      const rolls: (readonly DomainFact[])[] = [];
      while (state.phase === 'strategy-settlement') {
        const next = send(state, { kind: 'advance-strategy-settlement' });
        rolls.push(next.facts);
        state = next.state;
      }
      t.equal(rolls.map((facts) => facts.flatMap((fact) => (fact.kind === 'wager-settled' ? [[fact.target, fact.result]] : []))), [[], [], [], [['pass', 'win']]]);
      t.equal(rolls.flat().some((fact) => fact.kind === 'wager-changed'), false);
      const view = crapsView(state);
      t.equal([state.phase, state.balance, state.wagers, view.table.point], ['cycle-completion', '1010', [], null]);
      const total = (outcome: string) => outcome.split('+').reduce((sum, die) => sum + Number(die), 0);
      t.equal(
        view.strategy?.cycle.turns.map((turn) => [total(turn.outcome), turn.net, turn.followed]),
        [[8, '0', true], [11, '0', false], [6, '0', true], [4, '0', true], [12, '0', true], [8, '10', true]],
      );
      t.equal(view.strategy?.cycle.net, '10');
      state = send(state, { kind: 'restart-cycle' }).state;
      t.equal([state.wagers, prescriptionNow(state)], [[], { status: 'prescribed', bets: bets(['pass', '10']), held: [] }]);
    },
  },
  {
    name: 'craps strategy: Stop strategy never refunds a committed pass or come base: removable wagers come back and the contracts settle automatically',
    run: (t) => {
      let state = follow(guidedCraps(THREE_POINT_MOLLY, PI), 4).state;
      t.equal(state.wagers, bets(['pass', '10'], ['pass-odds', '10'], ['come-4', '10'], ['come-6', '10'], ['come-6-odds', '10']));
      const stopped = send(state, { kind: 'stop-strategy' });
      t.equal(stopped.facts, [
        { kind: 'strategy-stopped' },
        { kind: 'wager-returned', target: 'pass-odds', amount: '10' },
        { kind: 'wager-returned', target: 'come-6-odds', amount: '10' },
      ]);
      state = stopped.state;
      t.equal([state.phase, state.balance, state.wagers], ['strategy-settlement', '980', bets(['pass', '10'], ['come-4', '10'], ['come-6', '10'])]);
      const settled: [string, string][] = [];
      while (state.phase === 'strategy-settlement') {
        const next = send(state, { kind: 'advance-strategy-settlement' });
        for (const fact of next.facts) if (fact.kind === 'wager-settled') settled.push([fact.target, fact.result]);
        state = next.state;
      }
      t.equal(settled, [['pass', 'win'], ['come-6', 'win'], ['come-4', 'loss']]);
      const view = crapsView(state);
      t.equal([state.phase, state.balance, state.wagers, view.strategy?.status, view.strategy?.cycle.turns.length], ['settled-outcome', '1020', [], 'stopped', 4]);
      t.equal(view.legalCommands.includes('stop-strategy') || !view.legalCommands.includes('begin-turn'), false);
    },
  },
  {
    name: 'craps strategy: Stop strategy during a revealed roll settles the roll, then returns the place bets left up',
    run: (t) => {
      let state = follow(guidedCraps(FLAT_PLACE, PI), 1).state;
      state = send(send(send(state, place('place-6', '12')).state, place('place-8', '12')).state, ROLL).state;
      t.equal(state.phase, 'revealing-outcome');
      const stopped = send(state, { kind: 'stop-strategy' });
      t.equal(kinds(stopped.facts), ['strategy-stopped', 'wager-returned', 'wager-returned']);
      t.equal([stopped.state.phase, stopped.state.balance, stopped.state.wagers, stopped.state.strategy?.progress], ['settled-outcome', '1000', [], state.strategy?.progress]);
    },
  },
  {
    name: 'craps strategy: ending the practice session during strategy settlement hands the contracts to final settlement',
    run: (t) => {
      const state = send(follow(guidedCraps(THREE_POINT_MOLLY, PI), 4).state, { kind: 'stop-strategy' }).state;
      const ending = send(state, { kind: 'request-stop' });
      t.equal([kinds(ending.facts), ending.state.phase, ending.state.wagers], [['stop-requested'], 'final-settlement', state.wagers]);
    },
  },
  {
    name: 'craps strategy: strategy settlement holds only contracts, for a strategy that no longer runs; anything else is damage',
    run: (t) => {
      const state = send(follow(guidedCraps(THREE_POINT_MOLLY, PI), 4).state, { kind: 'stop-strategy' }).state;
      const damage = (edit: (value: Record<string, unknown> & { strategy: Record<string, unknown> }) => void) => {
        const value = JSON.parse(encodeCheckpoint(state));
        edit(value);
        const result = decodeCheckpoint(encodeCheckpoint(value));
        return result.ok ? 'ok' : result.error.message;
      };
      t.equal(damage(() => undefined), 'ok');
      t.equal(damage((v) => (v.strategy.status = 'active')), 'damaged strategy settlement');
      t.equal(damage((v) => ((v.wagers = []), (v.balance = '1010'))), 'damaged strategy settlement');
      t.equal(
        damage((v) => ((v.wagers = [...(v.wagers as unknown[]), { target: 'come-6-odds', amount: '10' }]), (v.balance = '970'))),
        'damaged strategy settlement',
      );
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
      const pass = advanceActivity(guidedCraps(PASS_WITH_ODDS, PI), { sequence: 0, commandId: 'x', command: ROLL });
      t.equal(pass.status === 'committed' && pass.facts[0], { kind: 'illegal-action', command: ROLL, reason: 'no-wager' });
    },
  },
];

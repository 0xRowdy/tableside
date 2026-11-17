// Spec 1 Built-in strategies, Strategy execution semantics
// Spec 1 Amendment 2 A2, Amendment 4 B
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  explainPrescription,
  readPermittedView,
  validateStrategy,
  type ActivityState,
  type Command,
  type DomainFact,
  type RouletteActivitySpecification,
  type RouletteSituation,
  type StrategyDefinition,
  type StrategyProgress,
  type Explanation,
} from '../src';

import { run, SPEC, status, step } from './activity.fixtures';
import { PI, ZERO } from './fixtures';
import { LABOUCHERE, MARTINGALE, PARLAY } from './strategy.fixtures';

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const RESTART: Command = { kind: 'restart-cycle' };
const spin = (target: string, amount: string): Command[] => [place(target, amount), BEGIN, SETTLE];

const guided = (definition: StrategyDefinition, target: string, extra: Partial<RouletteActivitySpecification> = {}) =>
  createActivity({ ...SPEC, strategy: { definition, parameters: { target } }, ...extra }, extra.activityId === 'pi' ? PI : ZERO);
const kinds = (facts: readonly DomainFact[]) => facts.map((fact) => fact.kind);
const strategyOf = (state: ActivityState) => readPermittedView(state).strategy;
const found = (definition: unknown) => validateStrategy(definition).diagnostics.map((d) => `${d.category} ${d.path}`);

const situation = (balance: string): RouletteSituation => ({ game: 'roulette', rules: { wheel: 'single-zero', limits: SPEC.rules.limits }, balance, lastPocket: null });
const lineAt = (line: string[]): StrategyProgress => ({ counters: {}, lists: { line }, lastResult: 'loss', cycleTurn: 1 });
const prescribed = (definition: StrategyDefinition, progress: StrategyProgress, balance = '1000') => {
  const result = explainPrescription(definition, { target: 'red' }, situation(balance), progress);
  if (!result.ok) throw new Error(result.error);
  return result.explanation.prescription;
};

export const progressionCases: TestCase[] = [
  {
    name: 'progression: capped Martingale, three-win parlay and bounded Labouchere are runnable',
    run: (t) => {
      for (const definition of [MARTINGALE, PARLAY, LABOUCHERE]) t.equal(validateStrategy(definition), { diagnostics: [], runnable: true });
    },
  },
  {
    name: 'progression: a list or progression with no declared cap or stop is unbounded (Amendment 2 A2)',
    run: (t) => {
      const uncappedBets = (definition: StrategyDefinition): StrategyDefinition => ({
        ...definition,
        instructions: definition.instructions.map((instruction) => ({ ...instruction, bets: instruction.bets.map(({ target, amount }) => ({ target, amount })) })),
      });
      t.equal(found(uncappedBets(LABOUCHERE)), ['unbounded /lists/0']);
      t.equal(found(uncappedBets(MARTINGALE)), ['unbounded /counters/0']);
      t.equal(found({ ...uncappedBets(LABOUCHERE), stopWhen: { compare: { length: 'line' }, op: 'gt', to: { lit: '10' } } }), []);
      t.equal(validateStrategy(uncappedBets(LABOUCHERE)).runnable, false);
    },
  },
  {
    name: 'progression: list expressions and the staked amount are checked by path',
    run: (t) => {
      const bet = LABOUCHERE.instructions[0] as StrategyDefinition['instructions'][number];
      const withBet = (amount: unknown) => ({ ...LABOUCHERE, instructions: [{ ...bet, bets: [{ ...bet.bets[0], amount }] }, LABOUCHERE.instructions[1]] });
      t.equal(found(withBet({ first: 'nope' })), ['incomplete /instructions/0/bets/0/amount']);
      t.equal(found(withBet({ staked: true })), ['incomplete /instructions/0/bets/0/amount']);
      t.equal(found({ ...LABOUCHERE, lists: [{ id: 'line', initial: ['10', 'x'] }] }), ['incomplete /lists/0/initial/1']);
      t.equal(found({ ...LABOUCHERE, adjustments: [{ id: 'a', on: 'win', list: 'nope', drop: 'ends' }] }), ['incomplete /adjustments/0/list']);
      t.equal(found({ ...MARTINGALE, completeWhen: { subject: 'nope', is: 'x' } }), ['incomplete /completeWhen']);
    },
  },
  {
    name: 'progression: Labouchere bets first plus last, or the sole number, and stops at its 32-unit cap',
    run: (t) => {
      t.equal(prescribed(LABOUCHERE, lineAt(['10', '20', '30'])), { status: 'prescribed', bets: [{ target: 'red', amount: '40' }], held: [] });
      t.equal(prescribed(LABOUCHERE, lineAt(['20'])), { status: 'prescribed', bets: [{ target: 'red', amount: '20' }], held: [] });
      t.equal(prescribed(LABOUCHERE, lineAt(['10', '320'])), { status: 'paused', reason: 'cap', unavailable: [{ target: 'red', amount: '330' }], cap: '320' });
      t.equal(prescribed(MARTINGALE, { counters: { stake: '640' }, lists: {}, lastResult: 'loss', cycleTurn: 6 }), {
        status: 'paused',
        reason: 'cap',
        unavailable: [{ target: 'red', amount: '640' }],
        cap: '320',
      });
    },
  },
  {
    name: 'progression: Martingale doubles 10 to 320 through six losses, then the cycle ends at its cap',
    run: (t) => {
      const stakes = ['10', '20', '40', '80', '160', '320'];
      let state = guided(MARTINGALE, 'black');
      for (const stake of stakes.slice(0, 5)) state = run(state, spin('black', stake)).state;
      t.equal([state.phase, state.balance, state.strategy?.progress.counters], ['settled-outcome', '690', { stake: '320' }]);
      const last = run(state, spin('black', '320'));
      state = last.state;
      t.equal(last.facts.find((fact) => fact.kind === 'cycle-ended'), { kind: 'cycle-ended', reason: 'cap' });
      t.equal([state.phase, state.balance, state.wagers], ['cycle-completion', '370', []]);
      const view = strategyOf(state);
      t.equal([view?.status, view?.cycleEnd, view?.pending], ['cycle-ended', 'cap', null]);
      t.equal(view?.exhaustion, { reason: 'cap', unavailable: [{ target: 'black', amount: '640' }], cap: '320' });
      t.equal(view?.cycle.number, 1);
      t.equal(view?.cycle.net, '-630');
      t.equal(
        view?.cycle.turns.map((turn) => [turn.turn, turn.wagers, turn.outcome, turn.net, turn.followed]),
        stakes.map((stake, index) => [index + 1, [{ target: 'black', amount: stake }], ['0', '7', '3', '36', '14', '3'][index], `-${stake}`, true]),
      );
      t.equal(readPermittedView(state).legalCommands, ['restart-cycle', 'stop-strategy', 'request-stop', 'rebuy']);
    },
  },
  {
    name: 'progression: another cycle starts only explicitly, from the remaining balance, with no refill',
    run: (t) => {
      let state = guided(MARTINGALE, 'black');
      for (const stake of ['10', '20', '40', '80', '160', '320']) state = run(state, spin('black', stake)).state;
      t.equal(status(advanceActivity(state, { sequence: state.sequence, commandId: 'x', command: place('black', '10') })), 'rejected:not-legal-in-phase');
      const restarted = step(state, RESTART);
      t.equal(kinds(restarted.facts), ['cycle-restarted']);
      state = restarted.state;
      t.equal([state.phase, state.balance, state.funding.rebuys], ['open-decision', '370', []]);
      t.equal([strategyOf(state)?.cycle, state.strategy?.progress.counters], [{ number: 2, net: '0', turns: [] }, { stake: '10' }]);
      t.equal(state.identities.strategy, { id: 'test-martingale', version: 1 });
      state = run(state, spin('black', '10')).state;
      t.equal([state.balance, state.strategy?.progress.counters, strategyOf(state)?.cycle.net], ['360', { stake: '20' }, '-10']);
    },
  },
  {
    name: 'progression: a Martingale win completes the cycle; the restart begins again at 1 unit',
    run: (t) => {
      let state = guided(MARTINGALE, 'black', { activityId: 'pi' });
      for (const stake of ['10', '20', '40']) state = run(state, spin('black', stake)).state;
      const won = run(state, spin('black', '80'));
      state = won.state;
      t.equal(won.facts.at(-1), { kind: 'cycle-ended', reason: 'completed' });
      t.equal([state.phase, state.balance, strategyOf(state)?.cycleEnd, strategyOf(state)?.cycle.net], ['cycle-completion', '1010', 'completed', '10']);
      state = step(state, RESTART).state;
      t.equal(state.strategy?.progress, { counters: { stake: '10' }, lists: {}, lastResult: 'none', cycleTurn: 0 });
    },
  },
  {
    name: 'progression: the parlay lets wins ride 10, 20, 40; a loss or the third win completes the cycle',
    run: (t) => {
      let state = run(guided(PARLAY, 'red'), spin('red', '10')).state;
      t.equal([state.phase, state.balance, strategyOf(state)?.cycleEnd, strategyOf(state)?.cycle.net], ['cycle-completion', '990', 'completed', '-10']);
      state = step(state, RESTART).state;
      state = run(state, [...spin('red', '10'), ...spin('red', '20')]).state;
      t.equal([state.phase, state.strategy?.progress.counters], ['settled-outcome', { stake: '40', wins: '2' }]);
      state = run(state, spin('red', '40')).state;
      t.equal([state.phase, state.balance, strategyOf(state)?.cycle.net, strategyOf(state)?.cycle.number], ['cycle-completion', '1060', '70', 2]);
    },
  },
  {
    name: 'progression: Labouchere crosses off a win, adds a loss, and completes when the line is empty',
    run: (t) => {
      let state = run(guided(LABOUCHERE, 'red'), spin('red', '40')).state;
      t.equal(state.strategy?.progress.lists, { line: ['10', '20', '30', '40'] });
      state = run(state, spin('red', '50')).state;
      t.equal(state.strategy?.progress.lists, { line: ['20', '30'] });
      state = run(state, spin('red', '50')).state;
      t.equal([state.phase, state.balance, state.strategy?.progress.lists, strategyOf(state)?.cycleEnd], ['cycle-completion', '1060', { line: [] }, 'completed']);
      t.equal(strategyOf(state)?.cycle.net, '60');
    },
  },
  {
    name: 'progression: a stake past the balance stops new bets; rebuy, then the pending action is checked again',
    run: (t) => {
      let state = guided(MARTINGALE, 'black', { funding: '100' });
      const settled = run(state, [...spin('black', '10'), ...spin('black', '20'), ...spin('black', '40')]);
      state = settled.state;
      t.equal(settled.facts.at(-1), { kind: 'strategy-paused', reason: 'unfunded-group', unavailable: [{ target: 'black', amount: '80' }], turn: 3 });
      t.equal([state.strategy?.progress.counters, state.strategy?.deferred?.progress.counters], [{ stake: '40' }, { stake: '80' }]);
      t.equal([state.phase, strategyOf(state)?.status, readPermittedView(state).legalCommands.includes('rebuy')], ['settled-outcome', 'active', true]);
      t.equal(kinds(step(state, { kind: 'rebuy', amount: '20' }).facts), ['funding-added']);
      const covered = step(state, { kind: 'rebuy', amount: '50' });
      t.equal(kinds(covered.facts), ['funding-added', 'strategy-resumed']);
      t.equal([covered.state.wagers, covered.state.balance, strategyOf(covered.state)?.pending], [[], '80', null]);
      t.equal(covered.state.strategy?.progress.counters, { stake: '80' });
    },
  },
  {
    name: 'progression: under a training bankroll a shortfall offers only a legal override or stop, never a rebuy',
    run: (t) => {
      let state = guided(MARTINGALE, 'black', { funding: '100', fundingSource: 'training-bankroll' });
      state = run(state, [...spin('black', '10'), ...spin('black', '20'), ...spin('black', '40')]).state;
      t.equal([strategyOf(state)?.pending?.reason, readPermittedView(state).legalCommands], ['unfunded-group', ['place-wager', 'begin-turn', 'collect-instead', 'stop-strategy', 'request-stop']]);
      state = run(state, [place('black', '30'), BEGIN]).state;
      t.equal([state.phase, (state.strategy?.correction?.explanation as Explanation | undefined)?.prescription.status], ['correction', 'paused']);
      const overridden = run(state, [{ kind: 'override-correction' }, SETTLE]);
      t.equal(kinds(overridden.facts), ['departure-recorded', 'cycle-ended', 'turn-began', 'outcome-generated', 'wager-settled']);
      state = overridden.state;
      t.equal([state.phase, state.balance, strategyOf(state)?.cycleEnd], ['cycle-completion', '0', 'override']);
      t.equal(strategyOf(state)?.cycle.turns.map((turn) => [turn.net, turn.followed]), [['-10', true], ['-20', true], ['-40', true], ['-30', false]]);
    },
  },
  {
    name: 'progression: a stake past the table maximum stops new bets with the limit it fails',
    run: (t) => {
      const small = { ...SPEC.rules, limits: { inside: { min: '1', max: '100' }, outside: { min: '10', max: '50' } } };
      let state = guided(MARTINGALE, 'black', { rules: small });
      state = run(state, [...spin('black', '10'), ...spin('black', '20'), ...spin('black', '40')]).state;
      t.equal(strategyOf(state)?.pending, { reason: 'limit', unavailable: [{ target: 'black', amount: '80' }], turn: 3 });
    },
  },
  {
    name: 'progression: a cycle result survives a checkpoint round trip; a tampered cycle log is damage',
    run: (t) => {
      let state = guided(MARTINGALE, 'black', { activityId: 'pi' });
      for (const stake of ['10', '20', '40', '80']) state = run(state, spin('black', stake)).state;
      const decoded = decodeCheckpoint(encodeCheckpoint(state));
      t.equal(decoded.ok && decoded.state, state);
      const tampered = JSON.parse(encodeCheckpoint(state));
      tampered.strategy.cycle.turns[0].turn = 99;
      const result = decodeCheckpoint(encodeCheckpoint(tampered));
      t.equal(result.ok ? 'ok' : result.error.kind, 'damaged');
      const unparsable = JSON.parse(encodeCheckpoint(state));
      unparsable.strategy.cycle.turns[0].net = 'ten';
      const second = decodeCheckpoint(encodeCheckpoint(unparsable));
      t.equal(second.ok ? 'ok' : second.error.kind, 'damaged');
    },
  },
];

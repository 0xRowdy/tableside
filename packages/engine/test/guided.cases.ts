// Guided practice at the engine interface: a roulette activity pinned to a
// strategy revision. Before a departing spin executes, the activity pauses in
// a correction; retry or override records one strategy departure; an override
// ends the cycle until an explicit restart; Stop strategy ends the strategy's
// bets but not the practice session. Spins come from the Random123 "pi
// digits" stream: 27 (red), 0, 25 (red), 31 (black), 9 (red) on single zero.
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  checkpointHash,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  explainPrescription,
  RandomStream,
  readPermittedView,
  uniformInt,
  type ActivitySpecification,
  type ActivityState,
  type Command,
  type DomainFact,
  type StrategyDefinition,
} from '../src';

import { run, SPEC, status, step, STREAM } from './activity.fixtures';
import { PI, throws, ZERO } from './fixtures';
import { DOUBLING, FLAT_EVEN_MONEY, TWO_DOZENS } from './strategy.fixtures';

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const RETRY: Command = { kind: 'retry-correction' };
const OVERRIDE: Command = { kind: 'override-correction' };
const RESTART: Command = { kind: 'restart-cycle' };
const STOP_STRATEGY: Command = { kind: 'stop-strategy' };

const guided = (definition: StrategyDefinition, parameters: Record<string, string>, extra: Partial<ActivitySpecification> = {}): ActivitySpecification => ({
  ...SPEC,
  strategy: { definition, parameters },
  ...extra,
});
const flat = (target = 'red') => createActivity(guided(FLAT_EVEN_MONEY, { target }), STREAM);
const kinds = (facts: readonly DomainFact[]) => facts.map((fact) => fact.kind);
const strategyOf = (state: ActivityState) => readPermittedView(state).strategy;

export const guidedCases: TestCase[] = [
  {
    name: 'guided: create pins the full strategy revision and its parameters, recording its identity',
    run: (t) => {
      const state = flat('black');
      t.equal(state.identities.strategy, { id: 'test-flat-even-money', version: 1 });
      t.equal(state.strategy?.definition, FLAT_EVEN_MONEY);
      t.equal(state.strategy?.parameters, { target: 'black' });
      t.equal(strategyOf(state), {
        id: 'test-flat-even-money',
        revision: 1,
        name: 'Flat even-money',
        parameters: [{ id: 'target', label: 'Target', value: 'black' }],
        status: 'active',
        cycleEnd: null,
        pending: null,
        correction: null,
        departures: [],
        adherence: { decisions: 0, followed: 0, departures: 0 },
        overrideAffected: false,
      });
      t.equal(readPermittedView(createActivity(SPEC, STREAM)).strategy, null);
    },
  },
  {
    name: 'guided: create refuses a strategy that is not runnable, has invalid choices or does not fit the table',
    run: (t) => {
      t.equal(throws(() => createActivity(guided({ ...FLAT_EVEN_MONEY, instructions: [] }, { target: 'red' }), STREAM)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity(guided(FLAT_EVEN_MONEY, { target: 'dozen-1' }), STREAM)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity(guided(TWO_DOZENS, { first: 'dozen-1', second: 'dozen-1' }), STREAM)), 'ActivitySpecificationError');
      const strict = { ...SPEC.rules, limits: { inside: { min: '1', max: '100' }, outside: { min: '25', max: '1000' } } };
      t.equal(throws(() => createActivity(guided(FLAT_EVEN_MONEY, { target: 'red' }, { rules: strict }), STREAM)), 'ActivitySpecificationError');
    },
  },
  {
    name: 'guided: a spin that follows the strategy runs as usual and counts as a followed decision',
    run: (t) => {
      const { state, facts } = run(flat(), [place('red', '10'), BEGIN, SETTLE]);
      t.equal(kinds(facts), ['wager-changed', 'turn-began', 'outcome-generated', 'wager-settled']);
      t.equal([state.phase, state.balance], ['settled-outcome', '1010']);
      t.equal(strategyOf(state)?.adherence, { decisions: 1, followed: 1, departures: 0 });
    },
  },
  {
    name: 'guided: a departing spin pauses in a correction before it executes: nothing drawn, wagers unchanged',
    run: (t) => {
      const before = run(flat(), [place('red', '50')]).state;
      const result = advanceActivity(before, { sequence: before.sequence, commandId: 'spin', command: BEGIN });
      if (result.status !== 'committed') throw new Error(status(result));
      const after = result.state;
      t.equal([after.phase, after.wagers, after.balance, after.turn], ['correction', [{ target: 'red', amount: '50' }], '950', 0]);
      t.equal(after.random, before.random);
      t.equal(result.receipt.disposition, 'assessed');
      const situation = { game: 'roulette' as const, rules: { wheel: 'single-zero' as const, limits: SPEC.rules.limits }, balance: '1000', lastPocket: null };
      const explained = explainPrescription(FLAT_EVEN_MONEY, { target: 'red' }, situation, { counters: {}, lastResult: 'none', cycleTurn: 0 });
      t.equal(result.facts, [
        {
          kind: 'correction-offered',
          departureId: 'activity-1/departure/1',
          turn: 1,
          explanation: explained.ok ? explained.explanation : null,
          actual: [{ target: 'red', amount: '50' }],
        },
      ]);
      t.equal(readPermittedView(after).legalCommands, ['retry-correction', 'override-correction']);
      t.equal(strategyOf(after)?.correction?.id, 'activity-1/departure/1');
      // Resending the tap is the same command: no second attempt, no second departure.
      t.equal(status(advanceActivity(after, { sequence: before.sequence, commandId: 'spin', command: BEGIN })), 'duplicate');
    },
  },
  {
    name: 'guided: retry records the departure once as retried and sets the prescribed bet in place of the player\'s',
    run: (t) => {
      const corrected = run(flat(), [place('red', '50'), place('straight-17', '5'), BEGIN]).state;
      const { state, facts } = step(corrected, RETRY);
      t.equal([state.phase, state.wagers, state.balance], ['open-decision', [{ target: 'red', amount: '10' }], '990']);
      t.equal(kinds(facts), ['departure-recorded', 'wager-changed', 'wager-changed']);
      t.equal(facts.slice(1), [
        { kind: 'wager-changed', target: 'straight-17', amount: '0', previous: '5' },
        { kind: 'wager-changed', target: 'red', amount: '10', previous: '50' },
      ]);
      const departure = strategyOf(state)?.departures[0];
      t.equal([departure?.id, departure?.turn, departure?.resolution, departure?.actual], [
        'activity-1/departure/2',
        1,
        'retried',
        [{ target: 'straight-17', amount: '5' }, { target: 'red', amount: '50' }],
      ]);
      // Then the spin follows the strategy; the decision counts once and is not "followed".
      const spun = run(state, [BEGIN, SETTLE]).state;
      t.equal(strategyOf(spun)?.adherence, { decisions: 1, followed: 0, departures: 1 });
      t.equal(strategyOf(spun)?.overrideAffected, false);
    },
  },
  {
    name: 'guided: override records the departure, spins the player\'s bets, and pauses the cycle until an explicit restart',
    run: (t) => {
      const corrected = run(flat(), [place('red', '50'), BEGIN]).state;
      const overridden = step(corrected, OVERRIDE);
      t.equal(kinds(overridden.facts), ['departure-recorded', 'cycle-ended', 'turn-began', 'outcome-generated']);
      t.equal(overridden.state.wagers, [{ target: 'red', amount: '50' }]);
      const settled = step(overridden.state, SETTLE).state;
      t.equal([settled.phase, settled.balance], ['cycle-completion', '1050']);
      t.equal(readPermittedView(settled).legalCommands, ['restart-cycle', 'stop-strategy', 'request-stop', 'rebuy']);
      t.equal(strategyOf(settled)?.status, 'cycle-ended');
      t.equal(strategyOf(settled)?.cycleEnd, 'override');
      t.equal(strategyOf(settled)?.overrideAffected, true);
      const restarted = step(settled, RESTART);
      t.equal(kinds(restarted.facts), ['cycle-restarted']);
      t.equal([restarted.state.phase, strategyOf(restarted.state)?.status, restarted.state.strategy?.definition.revision], ['open-decision', 'active', 1]);
      // A restart never refills the balance and keeps the override marking.
      t.equal([restarted.state.balance, strategyOf(restarted.state)?.overrideAffected], ['1050', true]);
    },
  },
  {
    name: 'guided: Stop strategy returns removable wagers, leaves the session open, and ends coaching',
    run: (t) => {
      const { state, facts } = run(flat(), [place('red', '50'), STOP_STRATEGY]);
      t.equal(kinds(facts), ['wager-changed', 'strategy-stopped', 'wager-returned']);
      t.equal([state.phase, state.balance, state.wagers], ['open-decision', '1000', []]);
      t.equal(strategyOf(state)?.status, 'stopped');
      // Play continues on the player's own: no further assessment, and no Stop strategy offered again.
      const free = run(state, [place('black', '100'), BEGIN]).state;
      t.equal(free.phase, 'revealing-outcome');
      t.equal(readPermittedView(state).legalCommands.includes('stop-strategy'), false);
    },
  },
  {
    name: 'guided: Stop strategy during a spin lets the committed wagers settle and adjusts nothing',
    run: (t) => {
      const spinning = run(createActivity(guided(DOUBLING, {}), STREAM), [place('red', '10'), BEGIN]).state;
      const { state, facts } = step(spinning, STOP_STRATEGY);
      t.equal([kinds(facts), state.phase, state.wagers], [['strategy-stopped'], 'revealing-outcome', [{ target: 'red', amount: '10' }]]);
      const settled = step(state, SETTLE).state;
      t.equal([settled.phase, settled.balance, settled.strategy?.progress], ['settled-outcome', '1010', { counters: { stake: '10' }, lastResult: 'none', cycleTurn: 0 }]);
    },
  },
  {
    name: 'guided: outcome adjustments move the counters after each coached spin (doubling after a loss)',
    run: (t) => {
      let state = createActivity(guided(DOUBLING, {}), STREAM);
      // 27 red wins (stake back to 10); 0 loses (stake 20); 25 red wins with 20 (stake 10).
      state = run(state, [place('red', '10'), BEGIN, SETTLE, place('red', '10'), BEGIN, SETTLE]).state;
      t.equal(state.strategy?.progress, { counters: { stake: '20' }, lastResult: 'loss', cycleTurn: 2 });
      const wrong = step(run(state, [place('red', '10')]).state, BEGIN);
      t.equal(wrong.state.phase, 'correction');
      state = run(state, [place('red', '20'), BEGIN, SETTLE]).state;
      t.equal([state.balance, state.strategy?.progress.counters], ['1020', { stake: '10' }]);
      t.equal(strategyOf(state)?.adherence, { decisions: 3, followed: 3, departures: 0 });
    },
  },
  {
    name: 'guided: an uncovered situation prescribes no new bets; retry takes the player\'s bets back',
    run: (t) => {
      const afterLoss: StrategyDefinition = {
        ...FLAT_EVEN_MONEY,
        instructions: [{ ...(FLAT_EVEN_MONEY.instructions[0] as StrategyDefinition['instructions'][number]), when: { subject: 'last-result', is: 'loss' } }],
      };
      const corrected = run(createActivity(guided(afterLoss, { target: 'red' }), STREAM), [place('red', '10'), BEGIN]).state;
      t.equal(corrected.strategy?.correction?.explanation.prescription, { status: 'uncovered' });
      const { state, facts } = step(corrected, RETRY);
      t.equal([state.phase, state.wagers, state.balance], ['open-decision', [], '1000']);
      t.equal(kinds(facts), ['departure-recorded', 'wager-changed']);
    },
  },
  {
    name: 'guided: a pending strategy action is explicit in the view; the next prescription stays hidden until a correction',
    run: (t) => {
      const poor = createActivity(guided(TWO_DOZENS, { first: 'dozen-1', second: 'dozen-2' }, { funding: '15' }), STREAM);
      t.equal(strategyOf(poor)?.pending, { reason: 'unfunded-group', unavailable: [{ target: 'dozen-1', amount: '10' }, { target: 'dozen-2', amount: '10' }] });
      const view = readPermittedView(flat());
      t.equal(view.strategy?.pending, null);
      t.equal(JSON.stringify(view).includes('prescription'), false);
    },
  },
  {
    name: 'guided: a correction survives a checkpoint round trip, and a tampered correction is damage',
    run: (t) => {
      const corrected = run(flat(), [place('red', '50'), BEGIN]).state;
      const decoded = decodeCheckpoint(encodeCheckpoint(corrected));
      t.equal(decoded.ok && decoded.state, corrected);
      const tampered = JSON.parse(encodeCheckpoint(corrected));
      tampered.strategy.correction.actual = [{ target: 'red', amount: '10' }];
      const result = decodeCheckpoint(encodeCheckpoint(tampered));
      t.equal(result.ok ? 'ok' : result.error.kind, 'damaged');
      // The recorded identity must name the pinned revision.
      const swapped = JSON.parse(encodeCheckpoint(flat()));
      swapped.identities.strategy.version = 2;
      const mismatch = decodeCheckpoint(encodeCheckpoint(swapped));
      t.equal(mismatch.ok ? 'ok' : mismatch.error.kind, 'damaged');
    },
  },
  {
    name: 'guided (property): Explain prescription matches what Advance prescribes for the same situation and state',
    run: (t) => {
      // A seeded walk through guided sessions: at every decision the player either follows
      // what Explain prescribes or bets something else, then retries, overrides, restarts or stops.
      const chooser = RandomStream.create(ZERO);
      const pick = (n: number) => uniformInt(chooser, n);
      const strategies: [StrategyDefinition, Record<string, string>][] = [
        [FLAT_EVEN_MONEY, { target: 'odd' }],
        [TWO_DOZENS, { first: 'dozen-3', second: 'dozen-2' }],
        [DOUBLING, {}],
      ];
      const others = ['red', 'black', 'dozen-1', 'straight-0', 'high'];
      const hashes: string[] = [];
      let checked = 0;
      let mismatches = 0;
      let corrections = 0;
      for (let session = 0; session < 12; session++) {
        const [definition, parameters] = strategies[session % 3] as [StrategyDefinition, Record<string, string>];
        let state = createActivity(guided(definition, parameters, { activityId: `walk-${session}`, funding: String(15 + pick(80)) }), session % 2 ? PI : ZERO);
        for (let move = 0; move < 40 && state.phase !== 'completed'; move++) {
          const view = readPermittedView(state);
          if (state.phase === 'revealing-outcome') {
            state = step(state, SETTLE).state;
          } else if (state.phase === 'correction') {
            state = step(state, pick(3) === 0 ? OVERRIDE : RETRY).state;
          } else if (state.phase === 'cycle-completion') {
            state = step(state, pick(4) === 0 ? STOP_STRATEGY : RESTART).state;
          } else if (view.strategy?.status !== 'active' || view.balance === '0' && view.wagers.length === 0) {
            break;
          } else {
            // Clear the table, then decide what to bet.
            for (const wager of view.wagers) state = step(state, place(wager.target, '0')).state;
            const situation = {
              game: 'roulette' as const,
              rules: { wheel: 'single-zero' as const, limits: SPEC.rules.limits },
              balance: readPermittedView(state).balance,
              lastPocket: view.outcome?.pocket ?? null,
            };
            const explained = explainPrescription(definition, parameters, situation, (state.strategy as NonNullable<ActivityState['strategy']>).progress);
            if (!explained.ok) throw new Error(explained.error);
            const prescription = explained.explanation.prescription;
            const follow = prescription.status === 'prescribed' && pick(3) > 0;
            const bets = follow ? prescription.bets : [{ target: others[pick(others.length)] as string, amount: String(10 + 10 * pick(3)) }];
            let placed = true;
            for (const bet of bets) {
              const result = advanceActivity(state, { sequence: state.sequence, commandId: `p${state.sequence}`, command: place(bet.target, bet.amount) });
              if (result.status !== 'committed') throw new Error(status(result));
              state = result.state;
              placed = placed && result.receipt.disposition === 'applied';
            }
            if (!placed || state.wagers.length === 0) break;
            const begun = step(state, BEGIN);
            const offered = begun.facts.find((fact) => fact.kind === 'correction-offered');
            const followedExactly =
              prescription.status === 'prescribed' && state.wagers.length === prescription.bets.length && prescription.bets.every((bet) => state.wagers.some((w) => w.target === bet.target && w.amount === bet.amount));
            checked++;
            if (offered) {
              corrections++;
              if (followedExactly || JSON.stringify(offered.explanation) !== JSON.stringify(explained.explanation)) mismatches++;
            } else if (!followedExactly) {
              mismatches++;
            }
            state = begun.state;
          }
        }
        hashes.push(checkpointHash(state));
      }
      t.equal(mismatches, 0);
      t.record('decisions checked', checked);
      t.record('corrections', corrections);
      // The whole walk's checkpoints, compared across runtimes by the harness.
      t.record('final checkpoint hashes', hashes);
      t.equal(checked > 100 && corrections > 20, true);
    },
  },
];

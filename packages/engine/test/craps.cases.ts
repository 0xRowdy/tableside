// Standard craps, the line game, through the engine interface (seam 1).
// Expected payouts and resolutions come from the launch rules (#3, spec #51
// "Standard craps"): line bets 1:1, don'ts push on 12, true odds 2:1, 3:2,
// 6:5 taken and 1:2, 2:3, 5:6 laid, odds caps 1x/2x/3-4-5x/5x/10x with the
// don't cap as an amount to win, come odds off on the come-out. Dice come
// from the protocol's Python reference (test/reference/philox_reference.py):
//   "pi digits" stream totals: 8 11 6 4 12 8 6 7 3 6 4 8 11 7 8 7 4 7 4 11
//   key [2, 0] totals:        12 5 12 9 9 8 10 4 5 5
//   key [3, 0] totals:        7 7 6 6 9 10 6 7
// and the first roll of key [k, 0] (session [0, 0]) is 2 for k = 9, 3 for 5,
// 4 for 30, 5 for 6, 6 for 1, 7 for 3, 8 for 4, 9 for 7, 10 for 11, 11 for 31, 12 for 2.
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  checkpointHash,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  readPermittedView,
  RandomStream,
  STANDARD_CRAPS,
  uniformInt,
  type ActivityState,
  type Command,
  type CrapsActivitySpecification,
  type CrapsPermittedView,
  type DomainFact,
  type OddsCap,
  type RandomStreamIdentity,
} from '../src';

import { run, status, step } from './activity.fixtures';
import { PI, throws, ZERO } from './fixtures';

export const CRAPS_SPEC: CrapsActivitySpecification = {
  activityId: 'craps-1',
  owner: 'local',
  device: 'device-1',
  game: 'craps',
  rules: { id: 'standard-craps', version: 2, odds: '3-4-5x', field: 'triple-12', limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } } },
  strategy: null,
  reference: null,
  fundingSource: 'practice-funding',
  funding: '1000',
};

const keyed = (k: number): RandomStreamIdentity => ({ ...ZERO, key: [k, 0] });
/** A stream whose first roll has this total. */
const FIRST: Record<number, RandomStreamIdentity> = {
  2: keyed(9), 3: keyed(5), 4: keyed(30), 5: keyed(6), 6: keyed(1), 7: keyed(3), 8: keyed(4), 9: keyed(7), 10: keyed(11), 11: keyed(31), 12: keyed(2),
};

const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const ROLL: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const STOP: Command = { kind: 'request-stop' };
const FINAL: Command = { kind: 'advance-final-settlement' };
const craps = (stream: RandomStreamIdentity = PI, odds: OddsCap = '3-4-5x') =>
  createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, odds } }, stream);
const view = (state: ActivityState) => readPermittedView(state) as CrapsPermittedView;
const settled = (facts: readonly DomainFact[]) =>
  facts.filter((fact) => fact.kind === 'wager-settled').map((fact) => [fact.target, fact.result, fact.net, fact.returned]);
const illegal = (state: ActivityState, command: Command) => {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: 'probe', command });
  if (result.status !== 'committed') return `rejected:${result.status === 'rejected' ? result.reason : 'duplicate'}`;
  const fact = result.facts[0];
  return fact?.kind === 'illegal-action' ? fact.reason : 'legal';
};
const point = (state: ActivityState) => view(state).table.point;
const total = (state: ActivityState) => {
  const dice = view(state).outcome?.dice;
  return dice ? dice[0] + dice[1] : null;
};

export const crapsCases: TestCase[] = [
  // ---- variant identity --------------------------------------------------
  {
    name: 'craps: standard craps is its own variant identity, pinned with the activity, with a versioned capability description',
    run: (t) => {
      const state = craps();
      t.equal([state.identities.game, state.identities.rules], ['craps', { id: 'standard-craps', version: 2 }]);
      t.equal(state.rules, { odds: '3-4-5x', field: 'triple-12', limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } } });
      t.equal([STANDARD_CRAPS.id, STANDARD_CRAPS.version, STANDARD_CRAPS.oddsCaps, STANDARD_CRAPS.fieldPayouts], ['standard-craps', 2, ['1x', '2x', '3-4-5x', '5x', '10x'], ['triple-12', 'double-12']]);
      t.equal(view(state).table.variant, { id: 'standard-craps', version: 2 });
      t.equal([state.phase, state.balance, state.wagers, view(state).table.point], ['open-decision', '1000', [], null]);
      t.equal(throws(() => createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, id: 'crapless-craps' } }, PI)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, odds: '4x' as OddsCap } }, PI)), 'ActivitySpecificationError');
      t.equal(
        throws(() => createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, limits: { ...CRAPS_SPEC.rules.limits, flat: { min: '20', max: '10' } } } }, PI)),
        'ActivitySpecificationError',
      );
    },
  },
  {
    name: 'craps: on the come-out the table offers pass and don\'t pass at the line limits, paying 1:1',
    run: (t) => {
      t.equal(view(craps()).table.placements.filter((p) => p.kind === 'line'), [
        { target: 'pass', kind: 'line', min: '10', max: '1000', increment: '1', payout: '1:1' },
        { target: 'dont-pass', kind: 'line', min: '10', max: '1000', increment: '1', payout: '1:1' },
      ]);
    },
  },

  // ---- line bets ---------------------------------------------------------
  {
    name: 'craps: a come-out 7 or 11 pays pass 1:1 and loses don\'t pass; the puck stays off',
    run: (t) => {
      for (const roll of [7, 11]) {
        const { state, facts } = run(craps(FIRST[roll]), [place('pass', '10'), place('dont-pass', '25'), ROLL, SETTLE]);
        t.equal(total(state), roll);
        t.equal(settled(facts), [['pass', 'win', '10', '20'], ['dont-pass', 'loss', '-25', '0']]);
        t.equal([state.balance, state.wagers, point(state)], ['985', [], null]);
      }
    },
  },
  {
    name: 'craps: a come-out 2 or 3 loses pass and pays don\'t pass 1:1',
    run: (t) => {
      for (const roll of [2, 3]) {
        const { state, facts } = run(craps(FIRST[roll]), [place('pass', '10'), place('dont-pass', '25'), ROLL, SETTLE]);
        t.equal(total(state), roll);
        t.equal(settled(facts), [['pass', 'loss', '-10', '0'], ['dont-pass', 'win', '25', '50']]);
        t.equal(state.balance, '1015');
      }
    },
  },
  {
    name: 'craps: a come-out 12 loses pass while don\'t pass pushes and stays on the table',
    run: (t) => {
      const { state, facts } = run(craps(FIRST[12]), [place('pass', '10'), place('dont-pass', '25'), ROLL, SETTLE]);
      t.equal(settled(facts), [['pass', 'loss', '-10', '0']]);
      t.equal(facts.filter((fact) => fact.kind === 'wager-pushed'), [{ kind: 'wager-pushed', turn: 1, target: 'dont-pass', stake: '25' }]);
      t.equal([state.balance, state.wagers, point(state)], ['965', [{ target: 'dont-pass', amount: '25' }], null]);
    },
  },
  {
    name: 'craps: a point number sets the puck; pass wins when the point repeats, don\'t pass when a 7 comes first',
    run: (t) => {
      // Pi stream: 8 sets the point, then 11 6 4 12 leave it, then 8 makes it.
      let { state, facts } = run(craps(PI), [place('pass', '10'), ROLL, SETTLE]);
      t.equal(facts.filter((fact) => fact.kind === 'point-changed'), [{ kind: 'point-changed', turn: 1, point: 8 }]);
      t.equal([point(state), state.wagers], [8, [{ target: 'pass', amount: '10' }]]);
      ({ state, facts } = run(state, [ROLL, SETTLE, ROLL, SETTLE, ROLL, SETTLE, ROLL, SETTLE]));
      t.equal([settled(facts), point(state)], [[], 8]);
      ({ state, facts } = run(state, [ROLL, SETTLE]));
      t.equal(settled(facts), [['pass', 'win', '10', '20']]);
      t.equal(facts.at(-1), { kind: 'point-changed', turn: 6, point: null });
      // Key [3, 0]: 7 7 on the come-out, 6 sets the point, 6 makes it; don't pass then loses.
      const dont = run(craps(keyed(3)), [place('dont-pass', '10'), ROLL, SETTLE]).state;
      t.equal(dont.balance, '990');
      const made = run(dont, [place('dont-pass', '10'), ROLL, SETTLE, place('dont-pass', '10'), ROLL, SETTLE, ROLL, SETTLE]);
      // The second come-out 7 loses again; 6 sets the point; 6 repeats and the don't loses.
      t.equal(settled(made.facts), [['dont-pass', 'loss', '-10', '0'], ['dont-pass', 'loss', '-10', '0']]);
      t.equal(made.state.balance, '970');
    },
  },
  {
    name: 'craps: a full line-game trace pays bases 1:1 and odds at true odds, with come odds off on the come-out',
    run: (t) => {
      let state = craps(PI);
      const turns: unknown[] = [];
      const go = (commands: Command[]) => {
        const next = run(state, commands);
        state = next.state;
        turns.push(settled(next.facts));
        return next.facts;
      };
      go([place('pass', '10'), ROLL, SETTLE]); // 8: point
      go([place('pass-odds', '50'), place('come', '10'), ROLL, SETTLE]); // 11: come wins
      go([place('come', '10'), ROLL, SETTLE]); // 6: come travels to 6
      t.equal(state.wagers, [{ target: 'pass', amount: '10' }, { target: 'pass-odds', amount: '50' }, { target: 'come-6', amount: '10' }]);
      go([place('come-6-odds', '50'), place('come', '10'), ROLL, SETTLE]); // 4: come travels to 4
      go([place('come-4-odds', '30'), ROLL, SETTLE]); // 12: nothing on the table acts
      t.equal(state.balance, '850');
      go([ROLL, SETTLE]); // 8: point made
      t.equal([point(state), state.balance], [null, '980']);
      t.equal(
        view(state).table.wagers,
        [
          { target: 'come-4', working: true, instruction: null, switchable: false, removable: false },
          { target: 'come-4-odds', working: false, instruction: null, switchable: true, removable: true },
          { target: 'come-6', working: true, instruction: null, switchable: false, removable: false },
          { target: 'come-6-odds', working: false, instruction: null, switchable: true, removable: true },
        ],
      );
      go([ROLL, SETTLE]); // 6 on the come-out: come 6 wins, its odds are off and come back
      go([ROLL, SETTLE]); // 7: seven-out, come 4 and its working odds lose
      t.equal(turns, [
        [],
        [['come', 'win', '10', '20']],
        [],
        [],
        [],
        [['pass', 'win', '10', '20'], ['pass-odds', 'win', '60', '110']],
        [['come-6', 'win', '10', '20'], ['come-6-odds', 'push', '0', '50']],
        [['come-4', 'loss', '-10', '0'], ['come-4-odds', 'loss', '-30', '0']],
      ]);
      t.equal([state.balance, state.wagers, point(state)], ['1050', [], null]);

      // The don't side on the same stream: 3 6 4 8 11 7.
      go([place('dont-pass', '10'), ROLL, SETTLE]); // 3: don't pass wins
      go([place('dont-pass', '10'), ROLL, SETTLE]); // 6: point
      go([place('dont-pass-odds', '60'), place('dont-come', '10'), ROLL, SETTLE]); // 4: don't come travels to 4
      go([place('dont-come-4-odds', '60'), ROLL, SETTLE, ROLL, SETTLE]); // 8, 11: nothing acts
      t.equal(state.balance, '920');
      go([ROLL, SETTLE]); // 7: every don't wins
      t.equal(turns.slice(8), [
        [['dont-pass', 'win', '10', '20']],
        [],
        [],
        [],
        [
          ['dont-pass', 'win', '10', '20'],
          ['dont-pass-odds', 'win', '50', '110'],
          ['dont-come-4', 'win', '10', '20'],
          ['dont-come-4-odds', 'win', '30', '90'],
        ],
      ]);
      t.equal([state.balance, state.turn], ['1160', 14]);
    },
  },
  {
    name: 'craps: a don\'t come bet pushes on 12 in the come area, travels to its number and loses when it repeats',
    run: (t) => {
      // Key [2, 0]: 12 (bar), 5 point, 12 (bar for the don't come), 9 travels, 9 repeats.
      let { state, facts } = run(craps(keyed(2)), [place('dont-pass', '10'), ROLL, SETTLE, ROLL, SETTLE]);
      t.equal(point(state), 5);
      ({ state, facts } = run(state, [place('dont-come', '10'), ROLL, SETTLE]));
      t.equal(facts.filter((fact) => fact.kind === 'wager-pushed'), [{ kind: 'wager-pushed', turn: 3, target: 'dont-come', stake: '10' }]);
      ({ state, facts } = run(state, [ROLL, SETTLE]));
      t.equal(facts.filter((fact) => fact.kind === 'wager-moved'), [{ kind: 'wager-moved', turn: 4, from: 'dont-come', to: 'dont-come-9', amount: '10' }]);
      ({ state, facts } = run(state, [ROLL, SETTLE]));
      t.equal(settled(facts), [['dont-come-9', 'loss', '-10', '0']]);
      t.equal([state.balance, state.wagers], ['980', [{ target: 'dont-pass', amount: '10' }]]);
    },
  },

  // ---- odds --------------------------------------------------------------
  {
    name: 'craps: odds caps by rule, with don\'t caps as an amount to win (laid ≤ 6× base under 3-4-5x)',
    run: (t) => {
      // Max odds behind a 10 pass and a 10 don't pass, per point 4, 5, 6, 8, 9, 10.
      const expected: Record<OddsCap, { take: string[]; lay: string[] }> = {
        '1x': { take: ['10', '10', '10', '10', '10', '10'], lay: ['20', '15', '12', '12', '15', '20'] },
        '2x': { take: ['20', '20', '20', '20', '20', '20'], lay: ['40', '30', '24', '24', '30', '40'] },
        '3-4-5x': { take: ['30', '40', '50', '50', '40', '30'], lay: ['60', '60', '60', '60', '60', '60'] },
        '5x': { take: ['50', '50', '50', '50', '50', '50'], lay: ['100', '75', '60', '60', '75', '100'] },
        '10x': { take: ['100', '100', '100', '100', '100', '100'], lay: ['200', '150', '120', '120', '150', '200'] },
      };
      for (const [cap, { take, lay }] of Object.entries(expected) as [OddsCap, { take: string[]; lay: string[] }][]) {
        const maxima = [4, 5, 6, 8, 9, 10].map((n) => {
          const state = run(craps(FIRST[n], cap), [place('pass', '10'), place('dont-pass', '10'), ROLL, SETTLE]).state;
          const placements = view(state).table.placements;
          return ['pass-odds', 'dont-pass-odds'].map((target) => placements.find((p) => p.target === target)?.max);
        });
        t.equal([cap, maxima.map(([taken]) => taken), maxima.map(([, laid]) => laid)], [cap, take, lay]);
      }
    },
  },
  {
    name: 'craps: odds go in increments that pay whole units, up to the cap and no further',
    run: (t) => {
      // Taking odds: 2:1 any whole stake, 3:2 even stakes, 6:5 multiples of 5. Laying: 1:2 even, 2:3 multiples of 3, 5:6 multiples of 6.
      const cases: [number, string, string, string][] = [
        [4, 'pass-odds', '1', 'legal'], [4, 'dont-pass-odds', '3', 'odds-increment'], [4, 'dont-pass-odds', '2', 'legal'],
        [5, 'pass-odds', '3', 'odds-increment'], [5, 'pass-odds', '4', 'legal'], [5, 'dont-pass-odds', '4', 'odds-increment'], [5, 'dont-pass-odds', '3', 'legal'],
        [6, 'pass-odds', '4', 'odds-increment'], [6, 'pass-odds', '5', 'legal'], [6, 'dont-pass-odds', '5', 'odds-increment'], [6, 'dont-pass-odds', '6', 'legal'],
        [6, 'pass-odds', '50', 'legal'], [6, 'pass-odds', '55', 'above-odds-cap'], [6, 'dont-pass-odds', '60', 'legal'], [6, 'dont-pass-odds', '66', 'above-odds-cap'],
        [6, 'pass-odds', '5/2', 'not-whole-units'],
      ];
      t.equal(
        cases.map(([n, target, amount]) => {
          const state = run(craps(FIRST[n]), [place('pass', '10'), place('dont-pass', '10'), ROLL, SETTLE]).state;
          return [n, target, amount, illegal(state, place(target, amount))];
        }),
        cases,
      );
      const four = view(run(craps(FIRST[6]), [place('pass', '10'), place('dont-pass', '10'), ROLL, SETTLE]).state).table.placements;
      t.equal(four.filter((p) => p.kind === 'odds'), [
        { target: 'pass-odds', kind: 'odds', min: '5', max: '50', increment: '5', payout: '6:5' },
        { target: 'dont-pass-odds', kind: 'odds', min: '6', max: '60', increment: '6', payout: '5:6' },
      ]);
    },
  },
  {
    name: 'craps: attached odds are commission-free: a winning odds bet returns stake plus exact true odds',
    run: (t) => {
      // Point 5 (key [6, 0]); the stream's next totals decide. Pays 3:2 taken and 2:3 laid, nothing withheld.
      const state = run(craps(FIRST[5]), [place('pass', '10'), ROLL, SETTLE, place('pass-odds', '40')]).state;
      let current = state;
      let facts: readonly DomainFact[] = [];
      while (point(current) === 5) ({ state: current, facts } = run(current, [ROLL, SETTLE]));
      const odds = settled(facts).find(([target]) => target === 'pass-odds');
      t.equal(odds, total(current) === 5 ? ['pass-odds', 'win', '60', '100'] : ['pass-odds', 'loss', '-40', '0']);
      t.record('point 5 resolved by', total(current));
    },
  },

  // ---- availability and contracts ----------------------------------------
  {
    name: 'craps: pass bets are made on the come-out, come bets once a point is on, odds only behind an established base',
    run: (t) => {
      const comeOut = craps(FIRST[6]);
      t.equal(
        [place('come', '10'), place('dont-come', '10'), place('pass-odds', '10'), place('come-6', '10'), place('big-6', '10'), place('pass', '5'), place('pass', '1001')].map((command) => illegal(comeOut, command)),
        ['not-available-now', 'not-available-now', 'not-available-now', 'not-available-now', 'unknown-target', 'below-minimum', 'above-maximum'],
      );
      const pointOn = run(comeOut, [place('dont-pass', '10'), ROLL, SETTLE]).state;
      t.equal(
        [place('pass', '10'), place('pass-odds', '10'), place('come', '10'), place('come-6-odds', '5')].map((command) => illegal(pointOn, command)),
        ['not-available-now', 'not-available-now', 'legal', 'not-available-now'],
      );
      // Before the come-out roll a pass bet can still change or come down.
      const before = step(comeOut, place('pass', '10')).state;
      t.equal([illegal(before, place('pass', '20')), illegal(before, place('pass', '0'))], ['legal', 'legal']);
    },
  },
  {
    name: 'craps: committed pass and come bases can\'t be changed or removed; an established don\'t comes down with its odds',
    run: (t) => {
      // Pi stream: 8 point, 11, 6 (come to 6).
      const state = run(craps(PI), [place('pass', '10'), place('dont-pass', '10'), ROLL, SETTLE, place('dont-pass-odds', '12'), ROLL, SETTLE, place('come', '10'), ROLL, SETTLE]).state;
      t.equal(state.wagers.map((wager) => wager.target), ['pass', 'dont-pass', 'dont-pass-odds', 'come-6']);
      t.equal(
        [place('pass', '0'), place('pass', '20'), place('come-6', '0'), place('come-6', '20'), place('dont-pass', '20')].map((command) => illegal(state, command)),
        ['committed-wager', 'committed-wager', 'committed-wager', 'committed-wager', 'committed-wager'],
      );
      t.equal(view(state).table.wagers, [
        { target: 'pass', working: true, instruction: null, switchable: false, removable: false },
        { target: 'dont-pass', working: true, instruction: null, switchable: false, removable: true },
        { target: 'dont-pass-odds', working: true, instruction: null, switchable: false, removable: true },
        { target: 'come-6', working: true, instruction: null, switchable: false, removable: false },
      ]);
      const { state: down, facts } = step(state, place('dont-pass', '0'));
      t.equal(facts, [
        { kind: 'wager-changed', target: 'dont-pass', amount: '0', previous: '10' },
        { kind: 'wager-changed', target: 'dont-pass-odds', amount: '0', previous: '12' },
      ]);
      t.equal([down.balance, down.wagers.map((wager) => wager.target)], [String(BigInt(state.balance) + 22n), ['pass', 'come-6']]);
    },
  },

  // ---- turns, stop and final settlement ----------------------------------
  {
    name: 'craps: one roll is one turn of two dice draws from the random protocol',
    run: (t) => {
      const { state, facts } = run(craps(PI), [place('pass', '10'), ROLL]);
      t.equal(facts.filter((fact) => fact.kind === 'dice-rolled'), [{ kind: 'dice-rolled', turn: 1, dice: [5, 3] }]);
      t.equal([state.turn, state.phase, state.random.block, state.random.lane], [1, 'revealing-outcome', [0, 0], 2]);
      t.equal(illegal(craps(PI), ROLL), 'no-wager');
    },
  },
  {
    name: 'craps: stopping returns removable wagers and rolls on automatically to settle only the contracts',
    run: (t) => {
      // Pi stream: 8 point; stop; then 11 6 4 12 leave the pass line and 8 pays it.
      const before = run(craps(PI), [place('pass', '10'), ROLL, SETTLE, place('pass-odds', '50'), place('come', '10')]).state;
      let { state, facts } = step(before, STOP);
      t.equal(facts, [
        { kind: 'stop-requested', phase: 'open-decision' },
        { kind: 'wager-returned', target: 'pass-odds', amount: '50' },
        { kind: 'wager-returned', target: 'come', amount: '10' },
      ]);
      t.equal([state.phase, state.wagers, state.balance], ['final-settlement', [{ target: 'pass', amount: '10' }], '990']);
      for (const command of [place('come', '10'), place('pass-odds', '10'), ROLL, STOP]) t.equal(status(advanceActivity(state, { sequence: state.sequence, commandId: 'x', command })), 'rejected:not-legal-in-phase');
      const rolls: (number | null)[] = [];
      while (state.phase === 'final-settlement') {
        ({ state, facts } = step(state, FINAL));
        rolls.push(total(state));
      }
      t.equal(rolls, [11, 6, 4, 12, 8]);
      t.equal(settled(facts), [['pass', 'win', '10', '20']]);
      t.equal(facts.at(-1), { kind: 'activity-completed', balance: '1010' });
      t.equal([state.phase, state.turn, state.wagers], ['completed', 6, []]);
    },
  },
  {
    name: 'craps: stopping with no contracts completes without a roll; stopping mid-roll settles that roll first',
    run: (t) => {
      const idle = run(craps(PI), [place('dont-pass', '10'), ROLL, SETTLE, STOP, FINAL]);
      t.equal(idle.facts.filter((fact) => fact.kind === 'dice-rolled').length, 1);
      t.equal([idle.state.phase, idle.state.balance], ['completed', '1000']);
      const mid = run(craps(FIRST[7]), [place('pass', '10'), ROLL, STOP]);
      t.equal(settled(mid.facts), [['pass', 'win', '10', '20']]);
      t.equal([mid.state.phase, mid.state.wagers], ['final-settlement', []]);
      t.equal(step(mid.state, FINAL).facts, [{ kind: 'activity-completed', balance: '1010' }]);
    },
  },
  {
    name: 'craps: money is conserved, every settlement has a committed wager and each turn is one roll (property)',
    run: (t) => {
      const driver = RandomStream.create({ ...ZERO, key: [0x63726170, 0x73000000] });
      const targets = ['pass', 'dont-pass', 'come', 'dont-come', 'pass-odds', 'dont-pass-odds', ...[4, 5, 6, 8, 9, 10].flatMap((n) => [`come-${n}`, `come-${n}-odds`, `dont-come-${n}-odds`]), 'field', 'place-6', 'place-4', 'buy-4', 'buy-9', 'lay-10', 'lay-6', 'hard-8', 'hard-4', 'any-seven', 'any-craps', 'prop-12', 'horn'];
      let state = createActivity({ ...CRAPS_SPEC, funding: '20000' }, PI);
      let net = 0n;
      let rolls = 0;
      let committed = new Map<string, string>();
      for (let i = 0; state.phase !== 'completed'; i++) {
        const roll = uniformInt(driver, 10);
        const command: Command =
          state.phase === 'final-settlement'
            ? FINAL
            : i >= 2000 && roll === 0
              ? STOP
              : state.phase === 'revealing-outcome'
                ? SETTLE
                : roll < 6
                  ? place(targets[uniformInt(driver, targets.length)] as string, String(uniformInt(driver, 13) * 12))
                  : roll === 6
                    ? { kind: 'set-working', target: targets[uniformInt(driver, targets.length)] as string, working: uniformInt(driver, 2) === 0 }
                    : ROLL;
        const next = step(state, command);
        for (const fact of next.facts) {
          if (fact.kind === 'turn-began') committed = new Map(fact.wagers.map((wager) => [wager.target, wager.amount]));
          if (fact.kind === 'dice-rolled') rolls++;
          if (fact.kind === 'wager-settled') {
            // A horn part settles a quarter of the committed horn.
            t.equal(committed.get(fact.target), fact.component === undefined ? fact.stake : String(BigInt(fact.stake) * 4n));
            net += BigInt(fact.net);
          }
        }
        state = next.state;
        const staked = state.wagers.reduce((sum, wager) => sum + BigInt(wager.amount), 0n);
        t.equal(BigInt(state.balance) + staked, 20000n + net);
        t.equal(state.turn, rolls);
      }
      t.equal(rolls > 200, true);
      t.record('final', { balance: state.balance, rolls, hash: checkpointHash(state) });
    },
  },

  // ---- checkpoints -------------------------------------------------------
  {
    name: 'craps: checkpoints round-trip in every phase and continue exactly',
    run: (t) => {
      const states = [craps(PI)];
      for (const command of [place('pass', '10'), ROLL, SETTLE, place('pass-odds', '50'), place('come', '10'), ROLL, SETTLE, STOP, FINAL, FINAL]) {
        states.push(step(states.at(-1) as ActivityState, command).state);
      }
      for (const state of states) {
        const decoded = decodeCheckpoint(encodeCheckpoint(state));
        if (!decoded.ok) throw new Error(decoded.error.message);
        t.equal(decoded.state, state);
      }
      const middle = states[4] as ActivityState;
      const resumed = decodeCheckpoint(encodeCheckpoint(middle));
      if (!resumed.ok) throw new Error('round trip failed');
      t.equal(checkpointHash(step(resumed.state, place('come', '10')).state), checkpointHash(states[5] as ActivityState));
    },
  },
  {
    name: 'craps: damaged craps checkpoints return a damaged recovery error',
    run: (t) => {
      const state = run(craps(PI), [place('pass', '10'), ROLL, SETTLE, place('pass-odds', '50')]).state;
      const text = encodeCheckpoint(state);
      const edit = (change: (value: Record<string, unknown>) => void) => {
        const value = JSON.parse(text) as Record<string, unknown>;
        change(value);
        return JSON.stringify(value);
      };
      const damaged = [
        edit((v) => (v.point = 7)),
        edit((v) => delete v.point),
        edit((v) => (v.outcome = { turn: 1, dice: [7, 1] })),
        edit((v) => ((v.rules as Record<string, unknown>).odds = '4x')),
        edit((v) => (v.wagers = [{ target: 'pass-odds', amount: '50' }])),
        edit((v) => (v.wagers = [{ target: 'big-6', amount: '10' }])),
        edit((v) => ((v.wagers as unknown[]).reverse())),
        edit((v) => ((v.point = null), (v.wagers = [{ target: 'come', amount: '10' }]))),
      ];
      t.equal(
        damaged.map((input) => {
          const result = decodeCheckpoint(input);
          return result.ok ? 'ok' : result.error.kind;
        }),
        damaged.map(() => 'damaged'),
      );
      t.equal(decodeCheckpoint(edit((v) => (((v.identities as Record<string, unknown>).rules = { id: 'standard-craps', version: 3 })))).ok, false);
    },
  },
  {
    name: 'craps: a full transition trace with checkpoint hashes (compared across runtimes)',
    run: (t) => {
      let state = craps(PI);
      const trace: unknown[] = [checkpointHash(state)];
      const commands = [
        place('pass', '10'), ROLL, SETTLE, place('pass-odds', '50'), place('come', '10'), ROLL, SETTLE,
        place('come', '10'), ROLL, SETTLE, place('come-6-odds', '25'), ROLL, SETTLE, ROLL, SETTLE, ROLL, SETTLE, ROLL, SETTLE,
        place('come', '10'), ROLL, STOP, FINAL,
      ];
      for (const command of commands) {
        const next = step(state, command);
        state = next.state;
        trace.push({ facts: next.facts, view: readPermittedView(state), hash: checkpointHash(state) });
      }
      t.equal(state.phase, 'completed');
      t.record('trace', trace);
      t.record('checkpoint', encodeCheckpoint(state));
    },
  },
];

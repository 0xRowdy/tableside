// Standard craps beyond the line game, through the engine interface (seam 1):
// place, buy, standalone lay, field, hardways, the one-roll propositions and
// the horn, with per-bet working instructions. Expected payouts come from the
// launch rules (#3, spec #51 "Standard craps" payout table), not from the
// module: place 9:5, 7:5, 7:6; buy at true odds 2:1, 3:2, 6:5 less 5% of the
// stake; lay at 1:2, 2:3, 5:6 less 5% of the gross win (commission only on a
// win, rounded up to a whole unit, minimum 1); field 1:1 with 2 double and 12
// triple or double; hard 4·10 7:1, 6·8 9:1; 2·12 30:1, 3·11 15:1; any craps
// 7:1; any seven 4:1; horn = four equal parts. A winning place, buy, lay or
// hardway bet is paid and stays up. Dice come from the protocol's Python
// reference (test/reference/philox_reference.py), streams keyed [k, 0] with
// session [0, 0]:
//   k = 4:  (6,2) (4,2) (4,6) (3,6) (2,5)          totals 8 6 10 9 7
//   k = 9:  (1,1) (5,4) (5,1) (4,3)                totals 2 9 6 7
//   k = 2:  (6,6) ...                              12 first
//   k = 3:  (2,5) ...                              7 first
//   k = 40: (5,6) ...                              11 first
//   k = 51: (2,2) (2,2) (4,4) (1,1) (3,1) (1,2) (3,3)
//   k = 44: (1,3) (5,3) ...
//   k = 93: (3,3) (5,2) ...
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  createActivity,
  decodeCheckpoint,
  encodeCheckpoint,
  readPermittedView,
  type ActivityState,
  type Command,
  type CrapsActivityState,
  type CrapsPermittedView,
  type DomainFact,
  type FieldPayout,
  type RandomStreamIdentity,
} from '../src';

import { run, SPEC, status, step } from './activity.fixtures';
import { CRAPS_SPEC } from './craps.cases';
import { throws, ZERO } from './fixtures';

const keyed = (k: number): RandomStreamIdentity => ({ ...ZERO, key: [k, 0] });
const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const working = (target: string, on: boolean): Command => ({ kind: 'set-working', target, working: on });
const ROLL: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const STOP: Command = { kind: 'request-stop' };
const roll = (times = 1): Command[] => Array.from({ length: times }, () => [ROLL, SETTLE]).flat();
const craps = (k: number, field: FieldPayout = 'triple-12', funding = '1000') =>
  createActivity({ ...CRAPS_SPEC, funding, rules: { ...CRAPS_SPEC.rules, field } }, keyed(k)) as CrapsActivityState;
const view = (state: ActivityState) => readPermittedView(state) as CrapsPermittedView;
/** [target, result, net, returned] plus the commission and horn part when present. */
const settled = (facts: readonly DomainFact[]) =>
  facts
    .filter((fact) => fact.kind === 'wager-settled')
    .map((fact) => [fact.target, fact.result, fact.net, fact.returned, ...(fact.commission === undefined ? [] : [`commission ${fact.commission}`]), ...(fact.component === undefined ? [] : [`part ${fact.component}`])]);
const illegal = (state: ActivityState, command: Command) => {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: 'probe', command });
  if (result.status !== 'committed') return `rejected:${result.status === 'rejected' ? result.reason : 'duplicate'}`;
  const fact = result.facts[0];
  return fact?.kind === 'illegal-action' ? fact.reason : 'legal';
};
const targets = (state: ActivityState) => state.wagers.map((wager) => `${wager.target} ${wager.amount}`);

export const crapsMenuCases: TestCase[] = [
  // ---- the menu ------------------------------------------------------------
  {
    name: 'craps menu: the table offers every launch wager with its limits, increments and payouts',
    run: (t) => {
      const placements = view(craps(4)).table.placements;
      t.equal(
        placements.map((p) => p.target),
        [
          'pass', 'dont-pass',
          'place-4', 'place-5', 'place-6', 'place-8', 'place-9', 'place-10',
          'buy-4', 'buy-5', 'buy-6', 'buy-8', 'buy-9', 'buy-10',
          'lay-4', 'lay-5', 'lay-6', 'lay-8', 'lay-9', 'lay-10',
          'field', 'hard-4', 'hard-6', 'hard-8', 'hard-10',
          'any-seven', 'any-craps', 'prop-2', 'prop-3', 'prop-11', 'prop-12', 'horn',
        ],
      );
      const terms = (target: string) => {
        const p = placements.find((item) => item.target === target);
        return p && [p.kind, p.min, p.max, p.increment, p.payout, p.commission ?? 'no commission'];
      };
      t.equal(
        ['place-4', 'place-5', 'place-6', 'buy-4', 'buy-5', 'buy-6', 'lay-4', 'lay-5', 'lay-6', 'field', 'hard-4', 'hard-6', 'any-seven', 'any-craps', 'prop-2', 'prop-3', 'horn'].map(terms),
        [
          ['place', '10', '1000', '5', '9:5', 'no commission'],
          ['place', '10', '1000', '5', '7:5', 'no commission'],
          ['place', '12', '996', '6', '7:6', 'no commission'],
          ['buy', '10', '1000', '1', '2:1', 'stake'],
          ['buy', '10', '1000', '2', '3:2', 'stake'],
          ['buy', '10', '1000', '5', '6:5', 'stake'],
          ['lay', '10', '1000', '2', '1:2', 'win'],
          ['lay', '12', '999', '3', '2:3', 'win'],
          ['lay', '12', '996', '6', '5:6', 'win'],
          ['field', '10', '1000', '1', '1:1', 'no commission'],
          ['hardway', '1', '100', '1', '7:1', 'no commission'],
          ['hardway', '1', '100', '1', '9:1', 'no commission'],
          ['proposition', '1', '100', '1', '4:1', 'no commission'],
          ['proposition', '1', '100', '1', '7:1', 'no commission'],
          ['proposition', '1', '100', '1', '30:1', 'no commission'],
          ['proposition', '1', '100', '1', '15:1', 'no commission'],
          ['horn', '4', '400', '4', '30:1/15:1', 'no commission'],
        ],
      );
      // Once a point is on, come bets replace pass bets and every other wager stays open.
      const pointOn = view(run(craps(4), [place('pass', '10'), ...roll()]).state).table.placements.map((p) => p.target);
      t.equal([pointOn.slice(0, 3), pointOn.length], [['pass-odds', 'come', 'dont-come'], 33]);
    },
  },
  {
    name: 'craps menu: the field payout is a pinned rule option, and the rule set is version 2',
    run: (t) => {
      t.equal([craps(4).rules.field, craps(4, 'double-12').rules.field, view(craps(4, 'double-12')).table.field], ['triple-12', 'double-12', 'double-12']);
      t.equal(throws(() => createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, field: 'quadruple-12' as FieldPayout } }, ZERO)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, version: 1 } }, ZERO)), 'ActivitySpecificationError');
      t.equal(
        throws(() => createActivity({ ...CRAPS_SPEC, rules: { ...CRAPS_SPEC.rules, limits: { ...CRAPS_SPEC.rules.limits, props: { min: '0', max: '100' } } } }, ZERO)),
        'ActivitySpecificationError',
      );
    },
  },

  // ---- place -----------------------------------------------------------------
  {
    name: 'craps menu: place bets pay 9:5, 7:5 and 7:6, are off on the come-out, stay up when they win and lose on 7',
    run: (t) => {
      const bets = [place('place-4', '10'), place('place-5', '10'), place('place-6', '12'), place('place-8', '12'), place('place-9', '10'), place('place-10', '10')];
      let { state, facts } = run(craps(4), [...bets, ...roll()]); // 8 on the come-out: place 8 is off
      t.equal([settled(facts), state.balance, view(state).table.point], [[], '936', 8]);
      const turns: unknown[] = [];
      for (let i = 0; i < 4; i++) {
        ({ state, facts } = run(state, roll()));
        turns.push(settled(facts));
      }
      t.equal(turns, [
        [['place-6', 'win', '14', '14']],
        [['place-10', 'win', '18', '18']],
        [['place-9', 'win', '14', '14']],
        [
          ['place-4', 'loss', '-10', '0'],
          ['place-5', 'loss', '-10', '0'],
          ['place-6', 'loss', '-12', '0'],
          ['place-8', 'loss', '-12', '0'],
          ['place-9', 'loss', '-10', '0'],
          ['place-10', 'loss', '-10', '0'],
        ],
      ]);
      t.equal([state.balance, state.wagers], ['982', []]);
    },
  },
  {
    name: 'craps menu: place 6 and 8 go in multiples of 6, other place numbers in 5s, within the flat limits',
    run: (t) => {
      const state = craps(4);
      const cases: [string, string, string][] = [
        ['place-6', '10', 'stake-increment'], ['place-6', '6', 'below-minimum'], ['place-6', '12', 'legal'], ['place-8', '996', 'legal'], ['place-8', '1002', 'above-maximum'],
        ['place-5', '12', 'stake-increment'], ['place-5', '5', 'below-minimum'], ['place-4', '1000', 'legal'], ['place-10', '1005', 'above-maximum'], ['place-9', '15', 'legal'],
      ];
      t.equal(cases.map(([target, amount]) => [target, amount, illegal(state, place(target, amount))]), cases);
    },
  },

  // ---- buy and lay -------------------------------------------------------------
  {
    name: 'craps menu: buy pays true odds less 5% of the stake and lay pays true odds less 5% of the win, rounded up, minimum 1, only on wins',
    run: (t) => {
      // Buys are off on the come-out 8; lays work. Then 6, 10, 9 and 7.
      const bets = [place('buy-6', '10'), place('buy-9', '20'), place('buy-10', '25'), place('lay-4', '40'), place('lay-5', '30'), place('lay-6', '12')];
      let { state, facts } = run(craps(4), [...bets, ...roll()]);
      t.equal([settled(facts), state.balance], [[], '863']);
      const turns: unknown[] = [];
      for (let i = 0; i < 4; i++) {
        ({ state, facts } = run(state, roll()));
        turns.push(settled(facts));
      }
      t.equal(turns, [
        // 12 at 6:5, commission 5% of 10 = 0.5, rounded up to the minimum 1.
        [['buy-6', 'win', '11', '11', 'commission 1'], ['lay-6', 'loss', '-12', '0']],
        // 50 at 2:1, commission 5% of 25 = 1.25, rounded up to 2.
        [['buy-10', 'win', '48', '48', 'commission 2']],
        // 30 at 3:2, commission exactly 1.
        [['buy-9', 'win', '29', '29', 'commission 1']],
        // Losing buys pay no commission. Lay 4 wins 20 (1:2), lay 5 wins 20 (2:3): commission 5% of 20 = 1 each.
        [
          ['buy-6', 'loss', '-10', '0'],
          ['buy-9', 'loss', '-20', '0'],
          ['buy-10', 'loss', '-25', '0'],
          ['lay-4', 'win', '19', '19', 'commission 1'],
          ['lay-5', 'win', '19', '19', 'commission 1'],
        ],
      ]);
      t.equal([state.balance, targets(state)], ['989', ['lay-4 40', 'lay-5 30']]);
    },
  },
  {
    name: 'craps menu: buy and lay stakes pay whole units, and the commission must be fundable on top of the stake',
    run: (t) => {
      const table = craps(4);
      t.equal(
        [place('buy-6', '12'), place('buy-5', '11'), place('buy-4', '11'), place('lay-4', '11'), place('lay-9', '20'), place('lay-8', '32'), place('lay-8', '36')].map((c) => illegal(table, c)),
        ['stake-increment', 'stake-increment', 'legal', 'stake-increment', 'stake-increment', 'stake-increment', 'legal'],
      );
      // 30 units: buy 6 of 30 would leave nothing for its commission of 2; 25 leaves 5.
      const poor = craps(4, 'triple-12', '30');
      t.equal(
        [place('buy-6', '30'), place('buy-6', '25'), place('lay-4', '30'), place('lay-4', '28'), place('place-6', '30')].map((c) => illegal(poor, c)),
        ['commission-unfunded', 'legal', 'commission-unfunded', 'legal', 'legal'],
      );
      // Nothing changes on a refusal.
      const refused = step(poor, place('buy-6', '30'));
      t.equal([refused.state.balance, refused.state.wagers], ['30', []]);
    },
  },
  {
    name: 'craps menu: there is no automatic place-to-buy: a place 4 pays 9:5 where a buy 4 would pay 2:1',
    run: (t) => {
      // k = 4 rolls 8 (point), 6, then 10: the place 10 pays 18 on 10, never 20 less commission.
      const { facts } = run(craps(4), [place('place-10', '10'), ...roll(3)]);
      t.equal(settled(facts), [['place-10', 'win', '18', '18']]);
    },
  },

  // ---- field ----------------------------------------------------------------
  {
    name: 'craps menu: the field is one roll: 2 pays double, 12 triple or double by rule, 3 4 9 10 11 even money, 5 6 7 8 lose',
    run: (t) => {
      // k = 9: 2, 9, 6.
      let { state, facts } = run(craps(9), [place('field', '10'), ...roll()]);
      t.equal([settled(facts), state.wagers], [[['field', 'win', '20', '30']], []]);
      ({ state, facts } = run(state, [place('field', '10'), ...roll(), place('field', '10'), ...roll()]));
      t.equal(settled(facts), [['field', 'win', '10', '20'], ['field', 'loss', '-10', '0']]);
      // k = 2 rolls 12 first.
      t.equal(settled(run(craps(2), [place('field', '10'), ...roll()]).facts), [['field', 'win', '30', '40']]);
      t.equal(settled(run(craps(2, 'double-12'), [place('field', '10'), ...roll()]).facts), [['field', 'win', '20', '30']]);
      t.equal([illegal(craps(9), place('field', '9')), illegal(craps(9), place('field', '1001'))], ['below-minimum', 'above-maximum']);
    },
  },

  // ---- hardways ---------------------------------------------------------------
  {
    name: 'craps menu: hardways pay 7:1 on 4 and 10 and 9:1 on 6 and 8, work on the come-out, stay up when they win and lose on 7 or easy',
    run: (t) => {
      // k = 51: (2,2) (2,2) (4,4) (1,1) (3,1).
      let { state, facts } = run(craps(51), [place('hard-4', '10'), place('hard-8', '5'), ...roll()]);
      t.equal(settled(facts), [['hard-4', 'win', '70', '70']]);
      ({ state, facts } = run(state, roll(4)));
      t.equal(settled(facts), [['hard-4', 'win', '70', '70'], ['hard-8', 'win', '45', '45'], ['hard-4', 'loss', '-10', '0']]);
      t.equal(targets(state), ['hard-8 5']);
      // k = 44: easy 4 (1,3), then easy 8 (5,3).
      t.equal(settled(run(craps(44), [place('hard-4', '1'), place('hard-8', '1'), ...roll(2)]).facts), [['hard-4', 'loss', '-1', '0'], ['hard-8', 'loss', '-1', '0']]);
      // k = 93: hard 6 (3,3), then 7.
      t.equal(settled(run(craps(93), [place('hard-6', '2'), place('hard-10', '3'), ...roll(2)]).facts), [
        ['hard-6', 'win', '18', '18'],
        ['hard-6', 'loss', '-2', '0'],
        ['hard-10', 'loss', '-3', '0'],
      ]);
      t.equal([illegal(craps(4), place('hard-6', '101')), illegal(craps(4), place('hard-6', '100'))], ['above-maximum', 'legal']);
    },
  },

  // ---- propositions and the horn ----------------------------------------------
  {
    name: 'craps menu: one-roll propositions pay 30:1, 15:1, 7:1 and 4:1, and the horn settles as four parts',
    run: (t) => {
      const props = [place('any-seven', '5'), place('any-craps', '2'), place('prop-2', '1'), place('prop-3', '1'), place('prop-11', '1'), place('prop-12', '1'), place('horn', '4')];
      // k = 9 rolls 2.
      const { state, facts: first } = run(craps(9), [...props, ...roll()]);
      t.equal(settled(first), [
        ['any-seven', 'loss', '-5', '0'],
        ['any-craps', 'win', '14', '16'],
        ['prop-2', 'win', '30', '31'],
        ['prop-3', 'loss', '-1', '0'],
        ['prop-11', 'loss', '-1', '0'],
        ['prop-12', 'loss', '-1', '0'],
        ['horn', 'win', '30', '31', 'part 2'],
        ['horn', 'loss', '-1', '0', 'part 3'],
        ['horn', 'loss', '-1', '0', 'part 11'],
        ['horn', 'loss', '-1', '0', 'part 12'],
      ]);
      t.equal([state.wagers, state.balance], [[], '1063']);
      // k = 40 rolls 11: the horn's 11 part pays 15 and the others lose, net 12.
      const { facts } = run(craps(40), [place('horn', '4'), place('prop-11', '2'), ...roll()]);
      t.equal(settled(facts), [
        ['prop-11', 'win', '30', '32'],
        ['horn', 'loss', '-1', '0', 'part 2'],
        ['horn', 'loss', '-1', '0', 'part 3'],
        ['horn', 'win', '15', '16', 'part 11'],
        ['horn', 'loss', '-1', '0', 'part 12'],
      ]);
      // k = 3 rolls 7.
      t.equal(settled(run(craps(3), [place('any-seven', '5'), ...roll()]).facts), [['any-seven', 'win', '20', '25']]);
      t.equal(
        [place('horn', '5'), place('horn', '400'), place('horn', '404'), place('prop-12', '101')].map((c) => illegal(craps(3), c)),
        ['stake-increment', 'legal', 'above-maximum', 'above-maximum'],
      );
    },
  },

  // ---- working instructions -----------------------------------------------------
  {
    name: 'craps menu: place, buy, lay, hardways and come odds take legal per-bet working instructions; line bets and one-roll bets always work',
    run: (t) => {
      // k = 93 rolls 6 (3,3) on the come-out.
      const table = run(craps(93), [place('place-6', '12'), place('hard-6', '1'), place('lay-4', '20')]).state;
      t.equal(view(table).table.wagers, [
        { target: 'place-6', working: false, instruction: null, switchable: true, removable: true },
        { target: 'lay-4', working: true, instruction: null, switchable: true, removable: true },
        { target: 'hard-6', working: true, instruction: null, switchable: true, removable: true },
      ]);
      const told = run(table, [working('place-6', true), working('hard-6', false)]);
      t.equal(told.facts, [
        { kind: 'working-changed', target: 'place-6', working: true },
        { kind: 'working-changed', target: 'hard-6', working: false },
      ]);
      t.equal(view(told.state).table.wagers.map((w) => [w.target, w.working, w.instruction]), [['place-6', true, true], ['lay-4', true, null], ['hard-6', false, false]]);
      // Without instructions the come-out 6 pays the hard 6 and leaves place 6 alone; with them, the reverse.
      t.equal(settled(run(table, roll()).facts), [['hard-6', 'win', '9', '9']]);
      t.equal(settled(run(told.state, roll()).facts), [['place-6', 'win', '14', '14']]);
      t.equal(
        [working('pass', false), working('field', false), working('place-8', true), working('big-8', true)].map((c) => illegal(run(table, [place('pass', '10'), place('field', '10')]).state, c)),
        ['working-fixed', 'working-fixed', 'not-available-now', 'unknown-target'],
      );
      // Giving the default status clears the instruction; taking the wager down drops it.
      const cleared = run(told.state, [working('place-6', false), place('hard-6', '0')]).state;
      t.equal([(cleared as CrapsActivityState).instructions, targets(cleared)], [[], ['place-6 12', 'lay-4 20']]);
    },
  },
  {
    name: 'craps menu: come odds told to work on the come-out win with their base instead of coming back',
    run: (t) => {
      // Pi digits stream: 8 (point), 11, 6 (come to 6), 4, 12, 8 (point made), then 6 on the come-out.
      const pi = createActivity(CRAPS_SPEC, { ...ZERO, key: [0xa4093822, 0x299f31d0], session: [0x13198a2e, 0x03707344] });
      const before = run(pi, [place('pass', '10'), ...roll(), place('come', '10'), ...roll(), place('come', '10'), ...roll(), place('come-6-odds', '50'), ...roll(3)]).state;
      t.equal(view(before).table.wagers.map((w) => [w.target, w.working]), [['come-6', true], ['come-6-odds', false]]);
      t.equal(settled(run(before, roll()).facts), [['come-6', 'win', '10', '20'], ['come-6-odds', 'push', '0', '50']]);
      t.equal(settled(run(before, [working('come-6-odds', true), ...roll()]).facts), [['come-6', 'win', '10', '20'], ['come-6-odds', 'win', '60', '110']]);
    },
  },
  {
    name: 'craps menu: roulette offers no working instructions',
    run: (t) => {
      const roulette = createActivity(SPEC, ZERO);
      t.equal(readPermittedView(roulette).legalCommands.includes('set-working'), false);
      t.equal(status(advanceActivity(roulette, { sequence: 0, commandId: 'w', command: working('red', false) })), 'rejected:not-legal-in-phase');
    },
  },

  // ---- stop and checkpoints -------------------------------------------------------
  {
    name: 'craps menu: stopping returns every place, buy, lay, field, hardway and proposition wager',
    run: (t) => {
      const { state, facts } = run(craps(4), [place('pass', '10'), ...roll(), place('place-6', '12'), place('lay-4', '20'), place('hard-8', '1'), place('horn', '4'), working('lay-4', false), STOP]);
      t.equal(
        facts.filter((fact) => fact.kind === 'wager-returned').map((fact) => fact.kind === 'wager-returned' && fact.target),
        ['place-6', 'lay-4', 'hard-8', 'horn'],
      );
      t.equal([state.phase, targets(state), (state as CrapsActivityState).instructions], ['final-settlement', ['pass 10'], []]);
    },
  },
  {
    name: 'craps menu: checkpoints keep working instructions, and damaged menu checkpoints are refused',
    run: (t) => {
      const state = run(craps(4), [place('place-6', '12'), place('horn', '8'), working('place-6', true)]).state;
      const decoded = decodeCheckpoint(encodeCheckpoint(state));
      t.equal(decoded.ok && decoded.state, state);
      const text = encodeCheckpoint(state);
      const edit = (change: (value: Record<string, unknown>) => void) => {
        const value = JSON.parse(text) as Record<string, unknown>;
        change(value);
        return JSON.stringify(value);
      };
      const damaged = [
        edit((v) => (v.wagers = [{ target: 'place-6', amount: '10' }])),
        edit((v) => (v.wagers = [{ target: 'horn', amount: '6' }])),
        edit((v) => (v.instructions = [{ target: 'horn', working: false }])),
        edit((v) => (v.instructions = [{ target: 'place-8', working: true }])),
        edit((v) => (v.instructions = [{ target: 'place-6', working: 'yes' }])),
        edit((v) => delete v.instructions),
        edit((v) => ((v.rules as Record<string, unknown>).field = 'quadruple-12')),
      ];
      t.equal(damaged.map((input) => {
        const result = decodeCheckpoint(input);
        return result.ok ? 'ok' : result.error.kind;
      }), damaged.map(() => 'damaged'));
    },
  },
];

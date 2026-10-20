// The strategy interpreter at the engine interface: Validate (five diagnostic
// categories with instruction paths, conservative conflicts, "runnable" per
// Amendment 7), the strategy envelope, and table compatibility at setup.
// Expected diagnostics follow spec #51 Amendments 2 and 7; limits are the launch
// defaults (#3: inside 1-100, outside 10-1,000).
import type { TestCase } from '@tableside/harness';

import {
  explainPrescription,
  strategyTableCompatibility,
  validateStrategy,
  type RouletteSituation,
  type StrategyDefinition,
  type StrategyProgress,
} from '../src';

import { DOUBLING, FLAT_EVEN_MONEY, TWO_DOZENS } from './strategy.fixtures';

/** "category path" for each diagnostic, in order. */
const found = (definition: unknown) => validateStrategy(definition).diagnostics.map((d) => `${d.category} ${d.path}`);
const found2 = (definition: unknown, parameters: unknown) => validateStrategy(definition, parameters).diagnostics.map((d) => `${d.category} ${d.path}`);

const instruction = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: id,
  when: { always: true },
  bets: [{ target: { target: 'red' }, amount: { lit: '10' } }],
  ...extra,
});

const withInstructions = (instructions: unknown[]): Record<string, unknown> => ({ ...FLAT_EVEN_MONEY, instructions });

const LIMITS = { inside: { min: '1', max: '100' }, outside: { min: '10', max: '1000' } };
const situation = (balance: string, extra: Partial<RouletteSituation> = {}): RouletteSituation => ({
  game: 'roulette',
  rules: { wheel: 'single-zero', limits: LIMITS },
  balance,
  lastPocket: null,
  ...extra,
});
const START: StrategyProgress = { counters: {}, lists: {}, lastResult: 'none', cycleTurn: 0 };
const explained = (...args: Parameters<typeof explainPrescription>) => {
  const result = explainPrescription(...args);
  if (!result.ok) throw new Error(result.error);
  return result.explanation;
};

export const strategyCases: TestCase[] = [
  {
    name: 'strategy: the flat even-money, two-dozen and doubling definitions are runnable with no diagnostics',
    run: (t) => {
      for (const definition of [FLAT_EVEN_MONEY, TWO_DOZENS, DOUBLING]) {
        t.equal(validateStrategy(definition), { diagnostics: [], runnable: true });
      }
    },
  },
  {
    name: 'strategy: incomplete definitions name the missing part by path',
    run: (t) => {
      t.equal(found({ ...FLAT_EVEN_MONEY, instructions: [] }), ['incomplete /instructions']);
      t.equal(found(withInstructions([{ ...instruction('a'), bets: [] }])), ['incomplete /instructions/0/bets']);
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { param: 'nope' }, amount: { lit: '10' } }] })])), [
        'incomplete /instructions/0/bets/0/target',
      ]);
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { target: 'red' }, amount: { counter: 'nope' } }] })])), [
        'incomplete /instructions/0/bets/0/amount',
      ]);
      t.equal(found({ ...FLAT_EVEN_MONEY, parameters: [{ ...FLAT_EVEN_MONEY.parameters[0], default: 'green' }] }), ['incomplete /parameters/0/default']);
      t.equal(found({ ...FLAT_EVEN_MONEY, name: '' }), ['incomplete /name']);
      t.equal(validateStrategy(null).diagnostics.map((d) => d.category), ['incomplete']);
      t.equal(validateStrategy({ ...FLAT_EVEN_MONEY, instructions: [] }).runnable, false);
    },
  },
  {
    name: 'strategy: two instructions that can both bet the same target conflict; display order is never a priority',
    run: (t) => {
      const both = [instruction('a'), instruction('b', { bets: [{ target: { target: 'red' }, amount: { lit: '20' } }] })];
      t.equal(found(withInstructions(both)), ['conflict /instructions/1']);
      // Reversing the order still conflicts: neither wins by position.
      t.equal(found(withInstructions([...both].reverse())), ['conflict /instructions/1']);
      // Equal priorities decide nothing either.
      t.equal(found(withInstructions(both.map((i) => ({ ...i, priority: 1 })))), ['conflict /instructions/1']);
      t.equal(validateStrategy(withInstructions(both)).runnable, false);
    },
  },
  {
    name: 'strategy: an explicit priority or exception resolves a conflict',
    run: (t) => {
      t.equal(found(withInstructions([instruction('a', { priority: 2 }), instruction('b', { priority: 1 })])), []);
      t.equal(found(withInstructions([instruction('a'), instruction('b', { overrides: ['a'] })])), []);
      // An explicit priority ranks over an instruction with none.
      // A subject the vocabulary doesn't declare is incomplete, inherited object properties included.
      t.equal(found(withInstructions([instruction('a', { when: { subject: 'constructor', is: 'x' } })])), ['incomplete /instructions/0/when']);
      t.equal(found(withInstructions([instruction('a'), instruction('b', { priority: 0 })])), []);
      t.equal(found(withInstructions([instruction('a'), instruction('b', { overrides: ['missing'] })])), [
        'incomplete /instructions/1/overrides/0',
        'conflict /instructions/1',
      ]);
    },
  },
  {
    name: 'strategy: provably disjoint conditions do not conflict; overlapping or unknown ones do',
    run: (t) => {
      const afterLoss = { subject: 'last-result', is: 'loss' };
      const afterWin = { subject: 'last-result', is: 'win' };
      t.equal(found(withInstructions([instruction('a', { when: afterLoss }), instruction('b', { when: afterWin })])), []);
      t.equal(found(withInstructions([instruction('a', { when: { all: [afterLoss] } }), instruction('b', { when: { all: [{ always: true }, afterWin] } })])), []);
      // "any" of a disjoint and an overlapping clause can still overlap.
      t.equal(found(withInstructions([instruction('a', { when: afterLoss }), instruction('b', { when: { any: [afterWin, { always: true }] } })])), [
        'conflict /instructions/1',
      ]);
      // A numeric comparison is never treated as provably disjoint.
      const cheap = { compare: { counter: 'n' }, op: 'lt', to: { lit: '5' } };
      const dear = { compare: { counter: 'n' }, op: 'ge', to: { lit: '5' } };
      const counted = { ...FLAT_EVEN_MONEY, counters: [{ id: 'n', initial: '0', cap: '10' }] };
      t.equal(found({ ...counted, instructions: [instruction('a', { when: cheap }), instruction('b', { when: dear })] }), ['conflict /instructions/1']);
    },
  },
  {
    name: 'strategy: bets on different targets never conflict, but a parameter that may name the same target does',
    run: (t) => {
      const black = instruction('b', { bets: [{ target: { target: 'black' }, amount: { lit: '10' } }] });
      t.equal(found(withInstructions([instruction('a'), black])), []);
      // The target parameter may be red, so it may meet the fixed red bet.
      const param = instruction('b', { bets: [{ target: { param: 'target' }, amount: { lit: '10' } }] });
      t.equal(found(withInstructions([instruction('a'), param])), ['conflict /instructions/1']);
      // Two parameters on one instruction need a declared "distinct from" to be two bets.
      const sameDozen = { ...TWO_DOZENS, parameters: TWO_DOZENS.parameters.map(({ id, label, choices, default: d }) => ({ id, label, choices, default: d })) };
      t.equal(found(sameDozen), ['conflict /instructions/0/bets/1']);
    },
  },
  {
    name: 'strategy: amounts that fail the declared table conditions are incompatible, and block running (Amendment 7)',
    run: (t) => {
      const twelve = withInstructions([instruction('a', { bets: [{ target: { target: 'red' }, amount: { lit: '5' } }] })]);
      t.equal(found(twelve), ['incompatible /instructions/0/bets/0/amount']);
      t.equal(validateStrategy(twelve).runnable, false);
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { target: 'red' }, amount: { lit: '2000' } }] })])), [
        'incompatible /instructions/0/bets/0/amount',
      ]);
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { target: 'red' }, amount: { lit: '21/2' } }] })])), [
        'incompatible /instructions/0/bets/0/amount',
      ]);
      // The basket is a double-zero bet; a strategy declared for both wheels can't use it.
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { target: 'basket-0-00-1-2-3' }, amount: { lit: '10' } }] })])), [
        'incompatible /instructions/0/bets/0/target',
      ]);
      t.equal(
        found({ ...withInstructions([instruction('a', { bets: [{ target: { target: 'basket-0-00-1-2-3' }, amount: { lit: '10' } }] })]), table: { ...(FLAT_EVEN_MONEY.table as object), wheels: ['double-zero'] } }),
        [],
      );
    },
  },
  {
    name: 'strategy: a counter that grows from itself with no declared cap or stop is unbounded',
    run: (t) => {
      const { cap: _cap, ...uncapped } = DOUBLING.counters[0] as { id: string; initial: string; cap: string };
      void _cap;
      const unbounded = { ...DOUBLING, counters: [uncapped] };
      t.equal(found(unbounded), ['unbounded /counters/0']);
      t.equal(validateStrategy(unbounded).runnable, false);
      // A declared stop bounds it.
      t.equal(found({ ...unbounded, stopWhen: { compare: { counter: 'stake' }, op: 'gt', to: { lit: '320' } } }), []);
    },
  },
  {
    name: 'strategy: the envelope (256 instructions, depth 8, 4,096 expression nodes, 40-digit literals) is reported',
    run: (t) => {
      const many = Array.from({ length: 257 }, (_, i) => instruction(`i${i}`, { priority: i }));
      t.equal(found(withInstructions(many)), ['envelope /instructions']);
      let deep: unknown = { always: true };
      for (let i = 0; i < 9; i++) deep = { all: [deep] };
      t.equal(found(withInstructions([instruction('a', { when: deep })])), [`envelope /instructions/0/when${'/all/0'.repeat(8)}`]);
      let eight: unknown = { always: true };
      for (let i = 0; i < 8; i++) eight = { all: [eight] };
      t.equal(found(withInstructions([instruction('a', { when: eight })])), []);
      const wide = Array.from({ length: 1400 }, () => ({ add: [{ lit: '0' }, { lit: '0' }] }));
      const sum = { max: [{ lit: '10' }, ...wide] };
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { target: 'red' }, amount: sum }] })])), ['envelope /']);
      t.equal(found(withInstructions([instruction('a', { bets: [{ target: { target: 'red' }, amount: { lit: '1'.repeat(41) } }] })])), [
        'envelope /instructions/0/bets/0/amount',
      ]);
      t.equal(validateStrategy(withInstructions(many)).runnable, false);
    },
  },
  {
    name: 'strategy: a definition over 1 MiB of UTF-8 is an envelope diagnostic, counted in bytes rather than characters',
    run: (t) => {
      // 349,526 three-byte characters are just over 1 MiB as UTF-8 but far under it in UTF-16 code units.
      const note = '€'.repeat(349_526);
      t.equal(found({ ...FLAT_EVEN_MONEY, note }), ['envelope /']);
      t.equal(found({ ...FLAT_EVEN_MONEY, note: '€'.repeat(1000) }), []);
    },
  },
  {
    name: 'strategy: setup compatibility names each requirement a different table fails',
    run: (t) => {
      const rules = (outsideMin: string, wheel: 'single-zero' | 'double-zero' = 'single-zero') => ({
        wheel,
        limits: { inside: { min: '1', max: '100' }, outside: { min: outsideMin, max: '1000' } },
      });
      t.equal(strategyTableCompatibility(FLAT_EVEN_MONEY, { target: 'red' }, rules('10')), { compatible: true, requirements: [] });
      t.equal(strategyTableCompatibility(FLAT_EVEN_MONEY, { target: 'black' }, rules('25')), {
        compatible: false,
        requirements: [{ path: '/instructions/0/bets/0/amount', target: 'black', amount: '10', requirement: 'below-minimum', limit: '25' }],
      });
      t.equal(strategyTableCompatibility(TWO_DOZENS, { first: 'dozen-1', second: 'dozen-3' }, rules('25')).requirements.map((r) => r.target), ['dozen-1', 'dozen-3']);
      // Parameters must be chosen from the declared choices, and distinct where declared.
      t.equal(strategyTableCompatibility(TWO_DOZENS, { first: 'dozen-2', second: 'dozen-2' }, rules('10')).requirements.map((r) => r.requirement), ['invalid-parameter']);
      t.equal(strategyTableCompatibility(FLAT_EVEN_MONEY, {}, rules('10')).requirements.map((r) => r.requirement), ['invalid-parameter']);
      const strict: StrategyDefinition = { ...FLAT_EVEN_MONEY, table: { ...(FLAT_EVEN_MONEY.table as object), wheels: ['double-zero'] } };
      t.equal(strategyTableCompatibility(strict, { target: 'red' }, rules('10')).requirements.map((r) => r.requirement), ['wheel']);
    },
  },
  {
    name: 'explain: flat even-money prescribes 10 on the chosen target, with structured explanation facts',
    run: (t) => {
      t.equal(explained(FLAT_EVEN_MONEY, { target: 'black' }, situation('1000'), START), {
        situation: { available: '1000', subjects: { 'last-result': 'none', 'last-pocket-color': 'none' } },
        instructions: [{ id: 'flat', label: '1 unit on the target, every spin' }],
        prescription: { status: 'prescribed', bets: [{ target: 'black', amount: '10' }] , held: []},
        fallback: null,
        state: START,
      });
      t.equal(explained(FLAT_EVEN_MONEY, { target: 'red' }, situation('10', { lastPocket: 0 }), START).situation.subjects['last-pocket-color'], 'green');
    },
  },
  {
    name: 'explain: two dozens is one atomic group, placed completely or paused entirely',
    run: (t) => {
      const both = [{ target: 'dozen-1', amount: '10' }, { target: 'dozen-3', amount: '10' }];
      t.equal(explained(TWO_DOZENS, { first: 'dozen-3', second: 'dozen-1' }, situation('20'), START).prescription, { status: 'prescribed', bets: both , held: []});
      // 15 covers one dozen but not both: neither is placed, and nothing is resized.
      const short = explained(TWO_DOZENS, { first: 'dozen-3', second: 'dozen-1' }, situation('15'), START);
      t.equal([short.prescription, short.fallback], [{ status: 'paused', reason: 'unfunded-group', unavailable: both }, 'no-new-bets']);
    },
  },
  {
    name: 'explain: counters drive amounts; a stake past its cap or past the table maximum pauses',
    run: (t) => {
      const at = (stake: string) => ({ counters: { stake }, lists: {}, lastResult: 'loss' as const, cycleTurn: 3 });
      t.equal(explained(DOUBLING, {}, situation('1000'), at('80')).prescription, { status: 'prescribed', bets: [{ target: 'red', amount: '80' }] , held: []});
      t.equal(explained(DOUBLING, {}, situation('1000'), at('640')).prescription, { status: 'paused', reason: 'cap', unavailable: [] });
      const roomy = { ...DOUBLING, counters: [{ id: 'stake', initial: '10', cap: '5000' }] };
      t.equal(explained(roomy, {}, situation('9000'), at('2560')).prescription, { status: 'paused', reason: 'limit', unavailable: [{ target: 'red', amount: '2560' }] });
      t.equal(explained(DOUBLING, {}, situation('70'), at('80')).prescription.status, 'paused');
    },
  },
  {
    name: 'explain: an uncovered situation places no new bets; a declared stop pauses',
    run: (t) => {
      const afterLoss: StrategyDefinition = {
        ...FLAT_EVEN_MONEY,
        instructions: [{ ...(FLAT_EVEN_MONEY.instructions[0] as StrategyDefinition['instructions'][number]), when: { subject: 'last-result', is: 'loss' } }],
      };
      const uncovered = explained(afterLoss, { target: 'red' }, situation('100'), START);
      t.equal([uncovered.prescription, uncovered.fallback, uncovered.instructions], [{ status: 'uncovered' }, 'no-new-bets', []]);
      const stopping: StrategyDefinition = { ...FLAT_EVEN_MONEY, stopWhen: { subject: 'last-pocket-color', is: 'green' } };
      t.equal(explained(stopping, { target: 'red' }, situation('100', { lastPocket: 0 }), START).prescription, { status: 'paused', reason: 'stop', unavailable: [] });
      t.equal(explained(stopping, { target: 'red' }, situation('100', { lastPocket: 1 }), START).prescription.status, 'prescribed');
    },
  },
  {
    name: 'explain: a higher priority or an exception prescribes where both instructions match',
    run: (t) => {
      const base = FLAT_EVEN_MONEY.instructions[0] as StrategyDefinition['instructions'][number];
      const pair = (extra: object): StrategyDefinition => ({
        ...FLAT_EVEN_MONEY,
        parameters: [],
        instructions: [
          { ...base, id: 'low', bets: [{ target: { target: 'red' }, amount: { lit: '10' } }] },
          { ...base, id: 'high', label: 'Twenty after a green', when: { subject: 'last-pocket-color', is: 'green' }, bets: [{ target: { target: 'red' }, amount: { lit: '20' } }], ...extra },
        ],
      });
      const green = situation('100', { lastPocket: 0 });
      t.equal(explained(pair({ priority: 1 }), {}, green, START).prescription, { status: 'prescribed', bets: [{ target: 'red', amount: '20' }] , held: []});
      t.equal(explained(pair({ overrides: ['low'] }), {}, green, START).instructions, [{ id: 'high', label: 'Twenty after a green' }]);
      t.equal(explained(pair({ overrides: ['low'] }), {}, situation('100', { lastPocket: 1 }), START).prescription, { status: 'prescribed', bets: [{ target: 'red', amount: '10' }] , held: []});
    },
  },
  {
    name: 'explain: rejects situations and states the game cannot represent or that contradict the rules',
    run: (t) => {
      const error = (...args: Parameters<typeof explainPrescription>) => {
        const result = explainPrescription(...args);
        return result.ok ? 'ok' : 'rejected';
      };
      t.equal(error(FLAT_EVEN_MONEY, { target: 'red' }, situation('100', { lastPocket: '00' }), START), 'rejected');
      t.equal(error(FLAT_EVEN_MONEY, { target: 'red' }, situation('-5'), START), 'rejected');
      t.equal(error(FLAT_EVEN_MONEY, { target: 'red' }, situation('100', { rules: { wheel: 'single-zero', limits: { ...LIMITS, inside: { min: '5', max: '1' } } } }), START), 'rejected');
      t.equal(error(FLAT_EVEN_MONEY, { target: 'green' }, situation('100'), START), 'rejected');
      t.equal(error(DOUBLING, {}, situation('100'), START), 'rejected');
      t.equal(error({ ...FLAT_EVEN_MONEY, instructions: [] }, { target: 'red' }, situation('100'), START), 'rejected');
      const doubleOnly: StrategyDefinition = { ...FLAT_EVEN_MONEY, table: { ...(FLAT_EVEN_MONEY.table as object), wheels: ['double-zero'] } };
      t.equal(error(doubleOnly, { target: 'red' }, situation('100'), START), 'rejected');
      t.equal(error(FLAT_EVEN_MONEY, { target: 'red' }, situation('100'), START), 'ok');
    },
  },
  {
    name: 'explain: is pure and read-only (inputs unchanged, same answer every time)',
    run: (t) => {
      const inputs = [DOUBLING, {}, situation('1000'), { counters: { stake: '40' }, lists: {}, lastResult: 'loss', cycleTurn: 2 }] as const;
      const before = JSON.stringify(inputs);
      const first = explainPrescription(...inputs);
      t.equal(explainPrescription(...inputs), first);
      t.equal(JSON.stringify(inputs), before);
    },
  },
  {
    name: 'strategy: Validate checks a configuration (the chosen targets) when given one',
    run: (t) => {
      t.equal(validateStrategy(FLAT_EVEN_MONEY, { target: 'black' }), { diagnostics: [], runnable: true });
      t.equal(found2(FLAT_EVEN_MONEY, { target: 'dozen-1' }), ['incomplete /parameters']);
      t.equal(found2(TWO_DOZENS, { first: 'dozen-2', second: 'dozen-2' }), ['incomplete /parameters']);
    },
  },
  {
    name: 'explain: each instruction is its own atomic group; one that can\'t be funded is held whole while another executes',
    run: (t) => {
      const two: StrategyDefinition = {
        ...FLAT_EVEN_MONEY,
        parameters: [],
        instructions: [
          { id: 'red', label: 'Red', priority: 2, when: { always: true }, bets: [{ target: { target: 'red' }, amount: { lit: '10' } }] },
          {
            id: 'dozens',
            label: 'Two dozens',
            priority: 1,
            when: { always: true },
            bets: [
              { target: { target: 'dozen-1' }, amount: { lit: '10' } },
              { target: { target: 'dozen-2' }, amount: { lit: '10' } },
            ],
          },
        ],
      };
      const explanation = explained(two, {}, situation('25'), START);
      t.equal(explanation.prescription, {
        status: 'prescribed',
        bets: [{ target: 'red', amount: '10' }],
        held: [{ instruction: 'dozens', reason: 'unfunded-group', unavailable: [{ target: 'dozen-1', amount: '10' }, { target: 'dozen-2', amount: '10' }] }],
      });
      t.equal(explanation.fallback, 'no-new-bets');
      t.equal(explained(two, {}, situation('30'), START).prescription, {
        status: 'prescribed',
        bets: [{ target: 'dozen-1', amount: '10' }, { target: 'dozen-2', amount: '10' }, { target: 'red', amount: '10' }],
        held: [],
      });
    },
  },
];

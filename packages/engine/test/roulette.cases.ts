// The roulette game module: both wheels' layouts and the one-spin outcome
// table. Expected values come from independent sources, not the module:
// - placements and payouts: the launch rules (#3) and the Wizard of Odds
//   payout table (straight 35, split 17, street/trio 11, corner/first four 8,
//   six line 5, dozen/column 2, even money 1, five-number basket 6);
// - zero-adjacent placements: Wikipedia "Roulette", inside bets (trio 0-1-2 on
//   either layout, 0-2-3 single-zero only, 0-00-2 and 00-2-3 double-zero only;
//   first four 0-1-2-3 single-zero only; top line 0-00-1-2-3 double-zero only),
//   with zero splits to each number the zero pocket borders (0 spans 1-2-3 on
//   the single-zero layout; 0 borders 1-2 and 00 borders 2-3 on the double-zero
//   layout, with the 0-00 split between them);
// - the published placement counts of the 36-number grid: 57 number splits,
//   12 streets, 22 corners, 11 six lines;
// - the red numbers of the standard layout.
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  createActivity,
  oneSpinOutcomeTable,
  rouletteLayout,
  type ActivitySpecification,
  checkpointHash,
  decodeCheckpoint,
  encodeCheckpoint,
  type Command,
  type DomainFact,
  type RoulettePlacement,
  type RouletteWheel,
} from '../src';

import { DOUBLE_ZERO, run, SPEC, step, STREAM } from './activity.fixtures';
import { throws } from './fixtures';

const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const NUMBERS = Array.from({ length: 36 }, (_, i) => i + 1);

type Pocket = number | '00';
interface Expected {
  readonly target: string;
  readonly covers: readonly Pocket[];
  readonly payout: string;
  readonly limitClass: 'inside' | 'outside';
}

const inside = (kind: string, covers: readonly Pocket[], payout: string): Expected => ({
  target: `${kind}-${covers.join('-')}`,
  covers,
  payout,
  limitClass: 'inside',
});
const outside = (target: string, covers: readonly number[], payout: string): Expected => ({ target, covers, payout, limitClass: 'outside' });

// The 36-number grid's placements, written out from the standard layout
// (three columns, 1-2-3 in the first row, 34-35-36 in the last).
const literal = (text: string) => text.split(' ').map((set) => set.split(/[-,]/).map(Number));
const NUMBER_SPLITS = literal(
  '1-2 1-4 2-3 2-5 3-6 4-5 4-7 5-6 5-8 6-9 7-8 7-10 8-9 8-11 9-12 10-11 10-13 11-12 11-14 12-15 13-14 13-16 14-15 ' +
    '14-17 15-18 16-17 16-19 17-18 17-20 18-21 19-20 19-22 20-21 20-23 21-24 22-23 22-25 23-24 23-26 24-27 25-26 25-28 ' +
    '26-27 26-29 27-30 28-29 28-31 29-30 29-32 30-33 31-32 31-34 32-33 32-35 33-36 34-35 35-36',
);
const STREETS = literal('1-2-3 4-5-6 7-8-9 10-11-12 13-14-15 16-17-18 19-20-21 22-23-24 25-26-27 28-29-30 31-32-33 34-35-36');
const CORNERS = literal(
  '1-2-4-5 2-3-5-6 4-5-7-8 5-6-8-9 7-8-10-11 8-9-11-12 10-11-13-14 11-12-14-15 13-14-16-17 14-15-17-18 16-17-19-20 ' +
    '17-18-20-21 19-20-22-23 20-21-23-24 22-23-25-26 23-24-26-27 25-26-28-29 26-27-29-30 28-29-31-32 29-30-32-33 ' +
    '31-32-34-35 32-33-35-36',
);
const SIX_LINES = literal(
  '1-2-3-4-5-6 4-5-6-7-8-9 7-8-9-10-11-12 10-11-12-13-14-15 13-14-15-16-17-18 16-17-18-19-20-21 19-20-21-22-23-24 ' +
    '22-23-24-25-26-27 25-26-27-28-29-30 28-29-30-31-32-33 31-32-33-34-35-36',
);
const DOZENS = literal('1,2,3,4,5,6,7,8,9,10,11,12 13,14,15,16,17,18,19,20,21,22,23,24 25,26,27,28,29,30,31,32,33,34,35,36');
const COLUMNS = literal('1,4,7,10,13,16,19,22,25,28,31,34 2,5,8,11,14,17,20,23,26,29,32,35 3,6,9,12,15,18,21,24,27,30,33,36');

/** Each layout's legal placements, from the literal grid above and the zero rules in the header. */
function expectedLayout(wheel: RouletteWheel): Expected[] {
  const zeros: Pocket[] = wheel === 'single-zero' ? [0] : [0, '00'];
  const zeroSplits: Pocket[][] = wheel === 'single-zero' ? [[0, 1], [0, 2], [0, 3]] : [[0, '00'], [0, 1], [0, 2], ['00', 2], ['00', 3]];
  const trios: Pocket[][] = wheel === 'single-zero' ? [[0, 1, 2], [0, 2, 3]] : [[0, '00', 2], [0, 1, 2], ['00', 2, 3]];
  return [
    ...[...zeros, ...NUMBERS].map((pocket) => inside('straight', [pocket], '35:1')),
    ...[...zeroSplits, ...NUMBER_SPLITS].map((covers) => inside('split', covers, '17:1')),
    ...STREETS.map((covers) => inside('street', covers, '11:1')),
    ...trios.map((covers) => inside('trio', covers, '11:1')),
    ...CORNERS.map((covers) => inside('corner', covers, '8:1')),
    ...(wheel === 'single-zero' ? [inside('first-four', [0, 1, 2, 3], '8:1')] : []),
    ...SIX_LINES.map((covers) => inside('six-line', covers, '5:1')),
    ...(wheel === 'double-zero' ? [inside('basket', [0, '00', 1, 2, 3], '6:1')] : []),
    outside('red', RED, '1:1'),
    outside('black', NUMBERS.filter((n) => !RED.includes(n)), '1:1'),
    outside('odd', NUMBERS.filter((n) => n % 2 === 1), '1:1'),
    outside('even', NUMBERS.filter((n) => n % 2 === 0), '1:1'),
    outside('low', NUMBERS.filter((n) => n <= 18), '1:1'),
    outside('high', NUMBERS.filter((n) => n >= 19), '1:1'),
    ...DOZENS.map((covers, d) => outside(`dozen-${d + 1}`, covers, '2:1')),
    ...COLUMNS.map((covers, c) => outside(`column-${c + 1}`, covers, '2:1')),
  ];
}

const shape = (placement: RoulettePlacement): Expected => ({
  target: placement.target,
  covers: placement.covers,
  payout: `${placement.payout}:1`,
  limitClass: placement.limitClass,
});

const RULES: Record<RouletteWheel, ActivitySpecification['rules']> = { 'single-zero': SPEC.rules, 'double-zero': DOUBLE_ZERO };
const place = (target: string, amount: string): Command => ({ kind: 'place-wager', target, amount });
const BEGIN: Command = { kind: 'begin-turn' };
const SETTLE: Command = { kind: 'settle-turn' };
const settledOf = (facts: readonly DomainFact[]) =>
  facts.flatMap((fact) => (fact.kind === 'wager-settled' ? [[fact.target, fact.result, fact.net, fact.returned]] : []));
const illegalReason = (state: ReturnType<typeof createActivity>, command: Command) => {
  const result = advanceActivity(state, { sequence: state.sequence, commandId: 'probe', command });
  if (result.status !== 'committed') return result.status;
  const fact = result.facts[0];
  return fact?.kind === 'illegal-action' ? fact.reason : 'legal';
};

const countKinds = (layout: readonly RoulettePlacement[]) => {
  const counts: Record<string, number> = {};
  for (const placement of layout) counts[placement.kind] = (counts[placement.kind] ?? 0) + 1;
  return counts;
};

export const rouletteCases: TestCase[] = [
  {
    name: 'roulette: the single-zero layout enumerates every legal placement with its coverage, payout and limit class',
    run: (t) => {
      const layout = rouletteLayout('single-zero');
      t.equal(layout.map(shape), expectedLayout('single-zero'));
      t.equal(countKinds(layout), {
        straight: 37, split: 60, street: 12, trio: 2, corner: 22, 'first-four': 1, 'six-line': 11,
        red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1, dozen: 3, column: 3,
      });
      t.record('targets', layout.map((placement) => placement.target));
    },
  },
  {
    name: 'roulette: the double-zero layout adds 00, its zero splits and trios and the five-number basket, and has no first four',
    run: (t) => {
      const layout = rouletteLayout('double-zero');
      t.equal(layout.map(shape), expectedLayout('double-zero'));
      t.equal(countKinds(layout), {
        straight: 38, split: 62, street: 12, trio: 3, corner: 22, 'six-line': 11, basket: 1,
        red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1, dozen: 3, column: 3,
      });
      t.record('targets', layout.map((placement) => placement.target));
    },
  },
  {
    name: 'roulette: every placement pays its fixed payout on each pocket it covers and loses its stake everywhere else, on both wheels',
    run: (t) => {
      for (const wheel of ['single-zero', 'double-zero'] as const) {
        const pockets: Pocket[] = wheel === 'single-zero' ? [0, ...NUMBERS] : [0, '00', ...NUMBERS];
        for (const expected of expectedLayout(wheel)) {
          const table = oneSpinOutcomeTable([{ target: expected.target, amount: '1' }], wheel);
          const payout = expected.payout.split(':')[0] as string;
          const losers = pockets.filter((pocket) => !expected.covers.includes(pocket));
          t.equal(
            table.map((group) => [group.net, group.pockets]),
            // Groups are ordered by their first pocket in wheel order.
            pockets.indexOf(expected.covers[0] as Pocket) < pockets.indexOf(losers[0] as Pocket)
              ? [[payout, expected.covers], ['-1', losers]]
              : [['-1', losers], [payout, expected.covers]],
          );
        }
      }
    },
  },
  {
    name: 'roulette: even-money bets lose in full on 0 and 00',
    run: (t) => {
      for (const wheel of ['single-zero', 'double-zero'] as const) {
        const table = oneSpinOutcomeTable(
          ['red', 'black', 'odd', 'even', 'low', 'high'].map((target) => ({ target, amount: '10' })),
          wheel,
        );
        const zeroGroup = table.find((group) => group.pockets.includes(0));
        t.equal([zeroGroup?.pockets, zeroGroup?.net], [wheel === 'single-zero' ? [0] : [0, '00'], '-60']);
      }
    },
  },
  {
    name: 'roulette: the one-spin outcome table for a single-zero layout (red 10, straight 17 5) gives exact probabilities and nets',
    run: (t) => {
      const table = oneSpinOutcomeTable([{ target: 'red', amount: '10' }, { target: 'straight-17', amount: '5' }], 'single-zero');
      // Worked by hand: 17 is black. Red wins on its 18 pockets (+10 - 5 = +5);
      // 17 wins the straight and loses red (+175 - 10 = +165); the other 18 pockets lose both (-15).
      const black = NUMBERS.filter((n) => !RED.includes(n));
      t.equal(table, [
        { pockets: [0, ...black.filter((n) => n !== 17)], probability: '18/37', net: '-15' },
        { pockets: RED, probability: '18/37', net: '5' },
        { pockets: [17], probability: '1/37', net: '165' },
      ]);
    },
  },
  {
    name: 'roulette: the one-spin outcome table for a double-zero layout (basket 10, dozen 1 10, 00 straight 1) gives exact probabilities and nets',
    run: (t) => {
      const table = oneSpinOutcomeTable(
        [{ target: 'basket-0-00-1-2-3', amount: '10' }, { target: 'dozen-1', amount: '10' }, { target: 'straight-00', amount: '1' }],
        'double-zero',
      );
      // Worked by hand over 38 pockets:
      // 0: basket +60, dozen -10, 00 -1 = +49.   00: +60 - 10 + 35 = +85.
      // 1-3: +60 + 20 - 1 = +79.   4-12: -10 + 20 - 1 = +9.   13-36: -21.
      t.equal(table, [
        { pockets: [0], probability: '1/38', net: '49' },
        { pockets: ['00'], probability: '1/38', net: '85' },
        { pockets: [1, 2, 3], probability: '3/38', net: '79' },
        { pockets: [4, 5, 6, 7, 8, 9, 10, 11, 12], probability: '9/38', net: '9' },
        { pockets: NUMBERS.slice(12), probability: '12/19', net: '-21' },
      ]);
    },
  },
  {
    name: 'roulette: the one-spin outcome table of an empty layout is one no-change group, and unknown targets are refused',
    run: (t) => {
      t.equal(oneSpinOutcomeTable([], 'single-zero'), [{ pockets: [0, ...NUMBERS], probability: '1', net: '0' }]);
      const refused = (wagers: { target: string; amount: string }[], wheel: RouletteWheel) => {
        try {
          oneSpinOutcomeTable(wagers, wheel);
          return 'accepted';
        } catch (error) {
          return error instanceof RangeError ? 'RangeError' : 'other';
        }
      };
      t.equal(
        [
          refused([{ target: 'basket-0-00-1-2-3', amount: '1' }], 'single-zero'),
          refused([{ target: 'first-four-0-1-2-3', amount: '1' }], 'double-zero'),
          refused([{ target: 'straight-00', amount: '1' }], 'single-zero'),
          refused([{ target: 'split-1-3', amount: '1' }], 'single-zero'),
          refused([{ target: 'red', amount: '0' }], 'single-zero'),
          refused([{ target: 'red', amount: '1' }, { target: 'red', amount: '1' }], 'single-zero'),
        ],
        ['RangeError', 'RangeError', 'RangeError', 'RangeError', 'RangeError', 'RangeError'],
      );
    },
  },

  // ---- through the engine interface --------------------------------------
  {
    name: 'roulette: an activity runs either wheel, and refuses rules whose id, version and wheel disagree',
    run: (t) => {
      t.equal(createActivity({ ...SPEC, rules: DOUBLE_ZERO }, STREAM).identities.rules, { id: 'roulette-double-zero', version: 1 });
      t.equal(throws(() => createActivity({ ...SPEC, rules: { ...DOUBLE_ZERO, id: 'roulette-single-zero' } }, STREAM)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity({ ...SPEC, rules: { ...SPEC.rules, wheel: 'double-zero' } }, STREAM)), 'ActivitySpecificationError');
      t.equal(throws(() => createActivity({ ...SPEC, rules: { ...DOUBLE_ZERO, version: 2 } }, STREAM)), 'ActivitySpecificationError');
    },
  },
  {
    name: 'roulette: every placement on both wheels settles through the engine at its payout against the spun pocket',
    run: (t) => {
      const outcomes: Record<string, number> = { win: 0, loss: 0 };
      for (const wheel of ['single-zero', 'double-zero'] as const) {
        for (const [index, expected] of expectedLayout(wheel).entries()) {
          // A different stream per placement, so the spun pockets vary.
          const stream = { ...STREAM, session: [index, wheel === 'single-zero' ? 1 : 2] as [number, number] };
          const stake = expected.limitClass === 'inside' ? 3n : 10n;
          const { state, facts } = run(createActivity({ ...SPEC, rules: RULES[wheel], funding: '100' }, stream), [
            place(expected.target, String(stake)),
            BEGIN,
            SETTLE,
          ]);
          const pocket = (state.outcome as { pocket: Pocket }).pocket;
          const won = expected.covers.includes(pocket);
          const net = won ? stake * BigInt(expected.payout.split(':')[0] as string) : -stake;
          t.equal(settledOf(facts), [[expected.target, won ? 'win' : 'loss', String(net), String(won ? stake + net : 0n)]]);
          t.equal(state.balance, String(100n + net));
          outcomes[won ? 'win' : 'loss'] = (outcomes[won ? 'win' : 'loss'] ?? 0) + 1;
        }
      }
      // Both branches are exercised across the layouts.
      t.equal([(outcomes.win ?? 0) > 20, (outcomes.loss ?? 0) > 20], [true, true]);
      t.record('outcomes', outcomes);
    },
  },
  {
    name: 'roulette: on a double-zero spin of 00, the 00 straight and the basket win and even-money bets lose in full',
    run: (t) => {
      // The pi-digits stream's double-zero spins are 3, 29, 0, 26, 18, 4, 29, 35, 24, 00 (draws.cases).
      let state = createActivity({ ...SPEC, rules: DOUBLE_ZERO }, STREAM);
      for (let turn = 1; turn <= 9; turn++) state = run(state, [place('red', '10'), BEGIN, SETTLE]).state;
      const { facts } = run(state, [
        place('straight-00', '2'), place('split-0-00', '1'), place('basket-0-00-1-2-3', '5'), place('red', '10'), place('even', '10'), BEGIN, SETTLE,
      ]);
      t.equal(facts.find((fact) => fact.kind === 'outcome-generated'), { kind: 'outcome-generated', turn: 10, pocket: '00' });
      t.equal(settledOf(facts), [
        ['straight-00', 'win', '70', '72'],
        ['split-0-00', 'win', '17', '18'],
        ['basket-0-00-1-2-3', 'win', '30', '35'],
        ['red', 'loss', '-10', '0'],
        ['even', 'loss', '-10', '0'],
      ]);
    },
  },
  {
    name: 'roulette: inside placements take 1 to 100 and outside placements 10 to 1,000 per placement, in whole units',
    run: (t) => {
      for (const wheel of ['single-zero', 'double-zero'] as const) {
        const state = createActivity({ ...SPEC, rules: RULES[wheel], funding: '5000' }, STREAM);
        for (const expected of expectedLayout(wheel)) {
          const [min, max] = expected.limitClass === 'inside' ? [1n, 100n] : [10n, 1000n];
          t.equal(
            [String(min - 1n), String(min), '37', String(max), String(max + 1n), '21/2'].map((amount) =>
              amount === '0' ? 'n/a' : illegalReason(state, place(expected.target, amount)),
            ),
            [min - 1n === 0n ? 'n/a' : 'below-minimum', 'legal', 'legal', 'legal', 'above-maximum', 'not-whole-units'],
          );
        }
      }
    },
  },
  {
    name: 'roulette: there is no aggregate table cap: every placement can hold its maximum at once',
    run: (t) => {
      for (const wheel of ['single-zero', 'double-zero'] as const) {
        let state = createActivity({ ...SPEC, rules: RULES[wheel], funding: '1000000' }, STREAM);
        let total = 0n;
        for (const expected of expectedLayout(wheel)) {
          const max = expected.limitClass === 'inside' ? 100n : 1000n;
          state = step(state, place(expected.target, String(max))).state;
          total += max;
        }
        t.equal([state.wagers.length, state.balance], [expectedLayout(wheel).length, String(1000000n - total)]);
        t.equal(step(state, BEGIN).state.phase, 'revealing-outcome');
      }
    },
  },
  {
    name: 'roulette: a double-zero trace round-trips through checkpoints in every state, 00 outcome included (hashes compared across runtimes)',
    run: (t) => {
      let state = createActivity({ ...SPEC, rules: DOUBLE_ZERO }, STREAM);
      const hashes: string[] = [];
      for (let turn = 1; turn <= 10; turn++) {
        for (const command of [place('split-00-3', '1'), place('column-3', '10'), BEGIN, SETTLE]) {
          state = step(state, command).state;
          const decoded = decodeCheckpoint(encodeCheckpoint(state));
          if (!decoded.ok) throw new Error(decoded.error.message);
          t.equal(decoded.state, state);
          hashes.push(checkpointHash(state));
        }
      }
      t.equal(state.outcome, { turn: 10, pocket: '00' });
      t.record('hashes', hashes);
      t.record('balance', state.balance);
    },
  },
];

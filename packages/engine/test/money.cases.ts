// Exact money: normalized rationals with a canonical "numerator[/denominator]"
// decimal encoding. Worked examples come from the launch rules (#3): blackjack
// 3:2, craps 6:5 and 2:3, buy commission 5% of stake and standalone lay
// commission 5% of the potential gross win, rounded up to a whole unit with a
// minimum of 1. Property cases draw operands from a fixed Philox stream, so
// every runtime checks the same values.
import type { TestCase } from '@tableside/harness';

import {
  add,
  commission,
  compare,
  decodeMoney,
  decodeStrategyLiteral,
  div,
  encodeMoney,
  money,
  mul,
  neg,
  RandomStream,
  sub,
  uniformInt,
  withinStrategyBits,
  type Money,
} from '../src';

function throws(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.name : 'non-error';
  }
  return 'no error';
}

const m = (text: string) => decodeMoney(text);
const e = encodeMoney;

/** Random rationals: numerators up to ~200 bits either sign, denominators up to ~100 bits. */
function operands(count: number): Money[] {
  const stream = RandomStream.create({ protocol: 1, key: [0x6d6f6e65, 0x79000001], session: [0, 0] });
  const big = (words: number) => {
    let value = 0n;
    const length = uniformInt(stream, words) + 1;
    for (let i = 0; i < length; i++) value = (value << 32n) | BigInt(stream.nextUint32());
    return value >> BigInt(uniformInt(stream, 32));
  };
  return Array.from({ length: count }, () => {
    const n = big(7) * (uniformInt(stream, 2) === 0 ? 1n : -1n);
    return money(n, big(4) + 1n);
  });
}

const gcd = (a: bigint, b: bigint): bigint => {
  // Euclid's algorithm, independent of the engine's normalization.
  let [x, y] = [a < 0n ? -a : a, b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};

export const moneyCases: TestCase[] = [
  {
    name: 'money: worked payouts are exact fractions',
    run: (t) => {
      t.equal(e(mul(m('15'), m('3/2'))), '45/2'); // blackjack 3:2 on 15
      t.equal(e(mul(m('7'), m('6/5'))), '42/5'); // taking odds 6:5 on 7
      t.equal(e(mul(m('10'), m('2/3'))), '20/3'); // laying 10 against 5 or 9 at 2:3
      t.equal(e(add(m('1/3'), m('1/6'))), '1/2');
      t.equal(e(sub(m('1/2'), m('1/2'))), '0');
      t.equal(e(div(m('-7'), m('2'))), '-7/2');
      t.equal(e(neg(m('0'))), '0');
    },
  },
  {
    name: 'money: construction normalizes sign and common factors',
    run: (t) => {
      t.equal(e(money(6n, 4n)), '3/2');
      t.equal(e(money(6n, -4n)), '-3/2');
      t.equal(e(money(-6n, -4n)), '3/2');
      t.equal(e(money(0n, -5n)), '0');
      t.equal(e(money(12n)), '12');
      t.equal(money(10n, 5n), { n: 2n, d: 1n });
      t.equal(throws(() => money(1n, 0n)), 'RangeError');
      t.equal(throws(() => div(m('1'), m('0'))), 'RangeError');
    },
  },
  {
    name: 'money: the canonical form decodes only canonical text',
    run: (t) => {
      const good = ['0', '7', '-7', '45/2', '-1/3', '123456789012345678901234567890123456789012345678901234567890/11'];
      t.equal(good.map((text) => e(m(text))), good);
      const bad = ['', '-0', '01', '+1', ' 1', '1 ', '1.5', '2/4', '3/1', '1/-2', '1/0', '0/5', '1/', '/2', '-', '1//2', '١'];
      t.equal(
        bad.map((text) => throws(() => m(text))),
        bad.map(() => 'MoneyFormatError'),
      );
    },
  },
  {
    name: 'money: values are normalized and round-trip through their canonical form (property)',
    run: (t) => {
      const values = operands(200);
      for (const value of values) {
        t.equal({ reduced: gcd(value.n, value.d) === 1n, positiveDenominator: value.d > 0n }, {
          reduced: true,
          positiveDenominator: true,
        });
        t.equal(decodeMoney(encodeMoney(value)), value);
        // Scaling numerator and denominator by any factor, of either sign, normalizes back.
        t.equal(money(value.n * -97n, value.d * -97n), value);
      }
      t.record('sample', values.slice(0, 5).map(encodeMoney));
    },
  },
  {
    name: 'money: arithmetic obeys the field laws (property)',
    run: (t) => {
      const values = operands(300);
      const zero = money(0n);
      for (let i = 0; i + 2 < values.length; i += 3) {
        const [a, b, c] = [values[i]!, values[i + 1]!, values[i + 2]!];
        t.equal(add(a, b), add(b, a));
        t.equal(mul(a, b), mul(b, a));
        t.equal(add(add(a, b), c), add(a, add(b, c)));
        t.equal(mul(mul(a, b), c), mul(a, mul(b, c)));
        t.equal(mul(a, add(b, c)), add(mul(a, b), mul(a, c)));
        t.equal(sub(a, a), zero);
        t.equal(add(a, neg(a)), zero);
        t.equal(sub(add(a, b), b), a);
        if (b.n !== 0n) t.equal(mul(div(a, b), b), a);
        // Ordering agrees with the sign of the difference and is antisymmetric.
        const difference = sub(a, b);
        t.equal(compare(a, b), difference.n > 0n ? 1 : difference.n < 0n ? -1 : 0);
        t.equal(compare(b, a), -compare(a, b));
      }
    },
  },
  {
    name: 'money: payouts and balances are never capped by the strategy guards',
    run: (t) => {
      const huge = mul(money(2n ** 300n), m('3/2'));
      t.equal(withinStrategyBits(huge), false);
      t.equal(encodeMoney(huge), (3n * 2n ** 299n).toString());
      t.equal(decodeMoney(encodeMoney(huge)), huge);
    },
  },
  {
    name: 'money: commission rounds up to a whole unit with a minimum of 1',
    run: (t) => {
      const five = m('1/20');
      // Buy: 5% of the stake.
      t.equal(['20', '25', '100', '101', '10', '1'].map((stake) => e(commission(m(stake), five))), [
        '1',
        '2',
        '5',
        '6',
        '1',
        '1',
      ]);
      // Standalone lay against 4/10: 5% of the potential gross win (1:2).
      t.equal(['40', '41', '200', '205'].map((lay) => e(commission(mul(m(lay), m('1/2')), five))), [
        '1',
        '2',
        '5',
        '6',
      ]);
      t.equal(throws(() => commission(m('0'), five)), 'RangeError');
      t.equal(throws(() => commission(m('20'), m('0'))), 'RangeError');
    },
  },
  {
    name: 'money: strategy literals are size-checked before decoding (40 digits per component)',
    run: (t) => {
      const forty = '9'.repeat(40);
      t.equal(e(decodeStrategyLiteral(forty)), forty);
      t.equal(e(decodeStrategyLiteral(`-${forty}`)), `-${forty}`);
      t.equal(e(decodeStrategyLiteral(`1/${'7'.repeat(40)}`)), `1/${'7'.repeat(40)}`);
      t.equal(throws(() => decodeStrategyLiteral('9'.repeat(41))), 'StrategyEnvelopeError');
      t.equal(throws(() => decodeStrategyLiteral(`1/${'7'.repeat(41)}`)), 'StrategyEnvelopeError');
      t.equal(throws(() => decodeStrategyLiteral('9'.repeat(1_000_000))), 'StrategyEnvelopeError');
      t.equal(throws(() => decodeStrategyLiteral('2/4')), 'MoneyFormatError');
    },
  },
  {
    name: 'money: strategy intermediates are limited to 256 bits per component',
    run: (t) => {
      const max = 2n ** 256n - 1n;
      t.equal(
        [money(max), money(-max), money(1n, max), money(2n ** 256n), money(-(2n ** 256n)), money(1n, 2n ** 256n + 1n)].map(
          withinStrategyBits,
        ),
        [true, true, true, false, false, false],
      );
    },
  },
];

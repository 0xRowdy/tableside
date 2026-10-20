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

import { throws, ZERO } from './fixtures';

const decode = decodeMoney;
const encode = encodeMoney;

/** Random rationals: numerators up to ~200 bits either sign, denominators up to ~100 bits. */
function operands(count: number): Money[] {
  const stream = RandomStream.create({ ...ZERO, key: [0x6d6f6e65, 0x79000001] });
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

/** Stein's binary GCD: a different algorithm from the engine's, so normalization is checked independently. */
function binaryGcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a < 0n ? -a : a, b < 0n ? -b : b];
  if (x === 0n) return y;
  if (y === 0n) return x;
  let shift = 0n;
  while (((x | y) & 1n) === 0n) [x, y, shift] = [x >> 1n, y >> 1n, shift + 1n];
  while ((x & 1n) === 0n) x >>= 1n;
  while (y !== 0n) {
    while ((y & 1n) === 0n) y >>= 1n;
    if (x > y) [x, y] = [y, x];
    y -= x;
  }
  return x << shift;
}

export const moneyCases: TestCase[] = [
  {
    name: 'money: worked payouts are exact fractions',
    run: (t) => {
      t.equal(encode(mul(decode('15'), decode('3/2'))), '45/2'); // blackjack 3:2 on 15
      t.equal(encode(mul(decode('7'), decode('6/5'))), '42/5'); // taking odds 6:5 on 7
      t.equal(encode(mul(decode('10'), decode('2/3'))), '20/3'); // laying 10 against 5 or 9 at 2:3
      t.equal(encode(add(decode('1/3'), decode('1/6'))), '1/2');
      t.equal(encode(sub(decode('1/2'), decode('1/2'))), '0');
      t.equal(encode(div(decode('-7'), decode('2'))), '-7/2');
      t.equal(encode(neg(decode('0'))), '0');
    },
  },
  {
    name: 'money: construction normalizes sign and common factors',
    run: (t) => {
      t.equal(encode(money(6n, 4n)), '3/2');
      t.equal(encode(money(6n, -4n)), '-3/2');
      t.equal(encode(money(-6n, -4n)), '3/2');
      t.equal(encode(money(0n, -5n)), '0');
      t.equal(encode(money(12n)), '12');
      t.equal(money(10n, 5n), { n: 2n, d: 1n });
      t.equal(throws(() => money(1n, 0n)), 'RangeError');
      t.equal(throws(() => div(decode('1'), decode('0'))), 'RangeError');
    },
  },
  {
    name: 'money: the canonical form decodes only canonical text',
    run: (t) => {
      const good = ['0', '7', '-7', '45/2', '-1/3', '123456789012345678901234567890123456789012345678901234567890/11'];
      t.equal(good.map((text) => encode(decode(text))), good);
      const bad = ['', '-0', '01', '+1', ' 1', '1 ', '1.5', '2/4', '3/1', '1/-2', '1/0', '0/5', '1/', '/2', '-', '1//2', '١'];
      t.equal(
        bad.map((text) => throws(() => decode(text))),
        bad.map(() => 'MoneyFormatError'),
      );
    },
  },
  {
    name: 'money: values are normalized and round-trip through their canonical form (property)',
    run: (t) => {
      const values = operands(200);
      for (const value of values) {
        t.equal({ reduced: binaryGcd(value.n, value.d) === 1n, positiveDenominator: value.d > 0n }, {
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
      const huge = mul(money(2n ** 300n), decode('3/2'));
      t.equal(withinStrategyBits(huge), false);
      t.equal(encodeMoney(huge), (3n * 2n ** 299n).toString());
      t.equal(decodeMoney(encodeMoney(huge)), huge);
    },
  },
  {
    name: 'money: commission rounds up to a whole unit with a minimum of 1',
    run: (t) => {
      const five = decode('1/20');
      // Buy: 5% of the stake.
      t.equal(['20', '25', '100', '101', '10', '1'].map((stake) => encode(commission(decode(stake), five))), [
        '1',
        '2',
        '5',
        '6',
        '1',
        '1',
      ]);
      // Standalone lay against 4/10: 5% of the potential gross win (1:2).
      t.equal(['40', '41', '200', '205'].map((lay) => encode(commission(mul(decode(lay), decode('1/2')), five))), [
        '1',
        '2',
        '5',
        '6',
      ]);
      t.equal(throws(() => commission(decode('0'), five)), 'RangeError');
      t.equal(throws(() => commission(decode('20'), decode('0'))), 'RangeError');
    },
  },
  {
    name: 'money: strategy literals are size-checked before decoding (40 digits per component)',
    run: (t) => {
      const forty = '9'.repeat(40);
      t.equal(encode(decodeStrategyLiteral(forty)), forty);
      t.equal(encode(decodeStrategyLiteral(`-${forty}`)), `-${forty}`);
      t.equal(encode(decodeStrategyLiteral(`1/${'7'.repeat(40)}`)), `1/${'7'.repeat(40)}`);
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

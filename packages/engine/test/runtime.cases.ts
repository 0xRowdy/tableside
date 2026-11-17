import type { TestCase } from '@tableside/harness';

export const runtimeCases: TestCase[] = [
  {
    name: 'runtime: BigInt arithmetic is exact beyond 2^53',
    run: (t) => {
      const product = 9007199254740993n * 1000000007n;
      t.equal(product, 9007199317791387783186951n);
      t.record('product', product);
      t.record('power', 2n ** 256n - 1n);
    },
  },
  {
    name: 'runtime: BigInt division truncates toward zero',
    run: (t) => {
      // Spec 1 Game rules, Counting (Hi-Lo)
      t.equal([7n / 2n, -7n / 2n, 7n % 2n, -7n % 2n], [3n, -3n, 1n, -1n]);
    },
  },
  {
    name: 'runtime: BigInt wraps to unsigned widths',
    run: (t) => {
      t.equal(BigInt.asUintN(64, -1n), 18446744073709551615n);
      t.equal(BigInt.asUintN(32, 2n ** 32n + 5n), 5n);
      t.equal(BigInt('0xD2511F53'), 3528531795n);
    },
  },
  {
    name: 'runtime: 32-bit unsigned multiply gives exact high and low words',
    run: (t) => {
      const philoxM0 = 0xd2511f53;
      const maxWord = 0xffffffff;
      t.equal(Math.imul(philoxM0, maxWord) >>> 0, 0x2daee0ad);
      const wide = BigInt(philoxM0) * BigInt(maxWord);
      t.equal([Number(wide >> 32n), Number(wide & 0xffffffffn)], [0xd2511f52, 0x2daee0ad]);
      t.record('lo', Math.imul(philoxM0, maxWord) >>> 0);
    },
  },
  {
    name: 'runtime: bytes read as little-endian unsigned 32-bit words',
    run: (t) => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff]);
      const view = new DataView(bytes.buffer);
      t.equal([view.getUint32(0, true), view.getUint32(4, true)], [0x04030201, 0xffffffff]);
    },
  },
  {
    name: 'runtime: sorting is stable and strings compare by code unit',
    run: (t) => {
      t.equal(['b', 'B', 'a', 'é', 'Z', '10', '9'].sort(), ['10', '9', 'B', 'Z', 'a', 'b', 'é']);
      const pairs = [[2, 'a'], [1, 'b'], [2, 'c'], [1, 'd']] as const;
      t.equal([...pairs].sort((x, y) => x[0] - y[0]).map((p) => p[1]), ['b', 'd', 'a', 'c']);
    },
  },
  {
    name: 'runtime: number to string conversion is shortest round-trip',
    run: (t) => {
      t.equal([String(0.1 + 0.2), String(1e21), String(2 ** 53), String(-0), String(1 / 3)], [
        '0.30000000000000004',
        '1e+21',
        '9007199254740992',
        '0',
        '0.3333333333333333',
      ]);
    },
  },
  {
    name: 'runtime: object keys enumerate integers first, then insertion order',
    run: (t) => {
      t.equal(Object.keys({ b: 1, 2: 1, a: 1, 1: 1 }), ['1', '2', 'b', 'a']);
    },
  },
];

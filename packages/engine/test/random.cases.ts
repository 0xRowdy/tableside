// Philox4x32-10 random protocol v1. Generator vectors are the Random123
// known-answer tests (tests/kat_vectors, "philox4x32 10" rows). Application
// vectors were produced by an independent Python implementation of the
// protocol (checked against the same known answers) or derived by hand from
// the known-answer outputs, as noted per case.
import type { TestCase } from '@tableside/harness';

import {
  philox4x32,
  RandomStream,
  streamIdentityFromEntropy,
  uniformInt,
  type EntropySource,
  type RandomStreamState,
} from '../src';

const ZERO = { protocol: 1, key: [0, 0], session: [0, 0] } as const;
const PI = { protocol: 1, key: [0xa4093822, 0x299f31d0], session: [0x13198a2e, 0x03707344] } as const;

function throws(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.name : 'non-error';
  }
  return 'no error';
}

const hex = (words: readonly number[]) => words.map((w) => w.toString(16).padStart(8, '0'));

export const randomCases: TestCase[] = [
  {
    name: 'random: Philox4x32-10 matches the Random123 known-answer vectors',
    run: (t) => {
      const kat: [number[], number[], string[]][] = [
        [[0, 0, 0, 0], [0, 0], ['6627e8d5', 'e169c58d', 'bc57ac4c', '9b00dbd8']],
        [
          [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff],
          [0xffffffff, 0xffffffff],
          ['408f276d', '41c83b0e', 'a20bc7c6', '6d5451fd'],
        ],
        [
          [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344],
          [0xa4093822, 0x299f31d0],
          ['d16cfe09', '94fdcceb', '5001e420', '24126ea1'],
        ],
      ];
      for (const [counter, key, expected] of kat) {
        const out = philox4x32(counter as [number, number, number, number], key as [number, number]);
        t.equal(hex(out), expected);
        t.record('out', hex(out));
      }
    },
  },
  {
    name: 'random: the stream reads counter [blockLow, blockHigh, sessionLow, sessionHigh] and key [keyLow, keyHigh]',
    run: (t) => {
      // The pi known-answer counter is block 0x85a308d3_243f6a88 of session 0x03707344_13198a2e.
      const stream = RandomStream.restore({ ...PI, block: [0x243f6a88, 0x85a308d3], lane: 0, exhausted: false });
      const draws = [stream.nextUint32(), stream.nextUint32(), stream.nextUint32(), stream.nextUint32()];
      t.equal(hex(draws), ['d16cfe09', '94fdcceb', '5001e420', '24126ea1']);
    },
  },
  {
    name: 'random: lanes 0-3 are consumed before the block advances, starting at block 0 lane 0',
    run: (t) => {
      const stream = RandomStream.create(ZERO);
      t.equal(stream.state(), { ...ZERO, block: [0, 0], lane: 0, exhausted: false });
      const draws = Array.from({ length: 8 }, () => stream.nextUint32());
      // Lanes 0-3 are the all-zero known answer; block 1 from the Python reference.
      t.equal(draws, [1713891541, 3781805453, 3159862348, 2600524760, 4175744164, 1555169499, 2980410603, 159317863]);
      t.equal(stream.state(), { ...ZERO, block: [2, 0], lane: 0, exhausted: false });
      t.record('draws', draws);
    },
  },
  {
    name: 'random: the 64-bit block carries into its high word',
    run: (t) => {
      const stream = RandomStream.restore({ ...ZERO, block: [0xffffffff, 0], lane: 3, exhausted: false });
      t.equal(stream.nextUint32(), 706672549);
      t.equal(stream.state(), { ...ZERO, block: [0, 1], lane: 0, exhausted: false });
      t.equal(stream.nextUint32(), 1792067052);
      t.equal(stream.state().lane, 1);
    },
  },
  {
    name: 'random: a restored position continues the same draws',
    run: (t) => {
      const first = RandomStream.create(PI);
      first.nextUint32();
      first.nextUint32();
      first.nextUint32();
      const saved: RandomStreamState = JSON.parse(JSON.stringify(first.state()));
      const resumed = RandomStream.restore(saved);
      const expected = [first.nextUint32(), first.nextUint32(), first.nextUint32()];
      t.equal([resumed.nextUint32(), resumed.nextUint32(), resumed.nextUint32()], expected);
      t.record('continued', expected);
    },
  },
  {
    name: 'random: the last tuple of the stream is drawn once, then the stream is exhausted rather than wrapping',
    run: (t) => {
      const stream = RandomStream.restore({ ...ZERO, block: [0xffffffff, 0xffffffff], lane: 3, exhausted: false });
      // Lane 3 of counter [ffffffff, ffffffff, 0, 0], key [0, 0], from the Python reference.
      t.equal(stream.nextUint32(), 634470994);
      t.equal(stream.state(), { ...ZERO, block: [0xffffffff, 0xffffffff], lane: 3, exhausted: true });
      t.equal(throws(() => stream.nextUint32()), 'RandomStreamExhaustedError');
      const restored = RandomStream.restore(stream.state());
      t.equal(throws(() => restored.nextUint32()), 'RandomStreamExhaustedError');
    },
  },
  {
    name: 'random: damaged or unsupported stream states are rejected',
    run: (t) => {
      const good: RandomStreamState = { ...ZERO, block: [0, 0], lane: 0, exhausted: false };
      const bad: unknown[] = [
        { ...good, protocol: 2 },
        { ...good, lane: 4 },
        { ...good, lane: 1.5 },
        { ...good, key: [0, 2 ** 32] },
        { ...good, session: [-1, 0] },
        { ...good, block: [0] },
        { ...good, exhausted: 'no' },
        null,
      ];
      t.equal(
        bad.map((state) => throws(() => RandomStream.restore(state as RandomStreamState))),
        bad.map(() => 'RandomStreamStateError'),
      );
    },
  },
  {
    name: 'random: bounded sampling rejects draws at or above floor(2^32/n)*n and the rejected draws still advance',
    run: (t) => {
      // Hand-derived from the pi known answer: n = 2^31 + 1 accepts only draws below 2^31 + 1.
      // d16cfe09 and 94fdcceb are rejected; 5001e420 = 1342301216 is accepted and returned as is.
      const stream = RandomStream.restore({ ...PI, block: [0x243f6a88, 0x85a308d3], lane: 0, exhausted: false });
      t.equal(uniformInt(stream, 2 ** 31 + 1), 1342301216);
      t.equal(stream.state().lane, 3);
    },
  },
  {
    name: 'random: bounded sampling maps accepted draws by remainder for 1 <= n <= 2^32',
    run: (t) => {
      // Four draws per n from a fresh all-zero stream, then the stream position; Python reference.
      const expected: Record<string, [number[], number[]]> = {
        '1': [[0, 0, 0, 0], [1, 0]],
        '2': [[1, 1, 0, 0], [1, 0]],
        '3': [[1, 2, 1, 2], [1, 0]],
        '10': [[1, 3, 8, 0], [1, 0]],
        '52': [[37, 49, 32, 28], [1, 0]],
        '2147483649': [[1713891541, 1555169499, 159317863, 83534633], [2, 1]],
        '3221225472': [[1713891541, 3159862348, 2600524760, 1555169499], [1, 2]],
        '4294967295': [[1713891541, 3781805453, 3159862348, 2600524760], [1, 0]],
        '4294967296': [[1713891541, 3781805453, 3159862348, 2600524760], [1, 0]],
      };
      for (const [n, [draws, [block, lane]]] of Object.entries(expected)) {
        const stream = RandomStream.create(ZERO);
        const actual = draws.map(() => uniformInt(stream, Number(n)));
        t.equal({ n, draws: actual, block: stream.state().block[0], lane: stream.state().lane }, { n, draws, block, lane });
        t.record(n, actual);
      }
    },
  },
  {
    name: 'random: bounded sampling refuses n outside 1..2^32 without drawing',
    run: (t) => {
      const stream = RandomStream.create(ZERO);
      t.equal(
        [0, -1, 1.5, 2 ** 32 + 1, Number.NaN].map((n) => throws(() => uniformInt(stream, n))),
        ['RangeError', 'RangeError', 'RangeError', 'RangeError', 'RangeError'],
      );
      t.equal(stream.state().lane, 0);
    },
  },
  {
    name: 'random: 16 entropy bytes become little-endian key words then session words',
    run: (t) => {
      const bytes = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xfc, 0xfd, 0xfe, 0xff];
      const requested: number[] = [];
      const source: EntropySource = {
        randomBytes(length) {
          requested.push(length);
          return new Uint8Array(bytes);
        },
      };
      t.equal(streamIdentityFromEntropy(source), {
        protocol: 1,
        key: [0x03020100, 0x07060504],
        session: [0x0b0a0908, 0xfffefdfc],
      });
      t.equal(requested, [16]);
    },
  },
  {
    name: 'random: an entropy source that returns other than 16 bytes is refused',
    run: (t) => {
      const sized = (length: number): EntropySource => ({ randomBytes: () => new Uint8Array(length) });
      t.equal([15, 17, 0].map((length) => throws(() => streamIdentityFromEntropy(sized(length)))), [
        'RangeError',
        'RangeError',
        'RangeError',
      ]);
    },
  },
];

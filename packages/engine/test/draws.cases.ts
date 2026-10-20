// Application vectors for random protocol v1: shuffle, dice and roulette. The
// expected draws come from an independent Python implementation of the
// protocol, itself checked against the Random123 known-answer vectors.
import type { TestCase } from '@tableside/harness';

import { canonicalShoe, rollDice, RandomStream, shuffle, spinRoulette, type Card } from '../src';

const PI = { protocol: 1, key: [0xa4093822, 0x299f31d0], session: [0x13198a2e, 0x03707344] } as const;

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const label = (card: Card) => `${card.deck}${card.suit[0]!.toUpperCase()}${RANKS[card.rank - 1]}`;

export const drawCases: TestCase[] = [
  {
    name: 'draws: the canonical shoe is deck index ascending, clubs, diamonds, hearts, spades, ace to king',
    run: (t) => {
      const shoe = canonicalShoe(2).map(label);
      t.equal(shoe.length, 104);
      t.equal(shoe.slice(0, 14), ['0CA', '0C2', '0C3', '0C4', '0C5', '0C6', '0C7', '0C8', '0C9', '0CT', '0CJ', '0CQ', '0CK', '0DA']);
      t.equal([shoe[26], shoe[39], shoe[51], shoe[52], shoe[103]], ['0HA', '0SA', '0SK', '1CA', '1SK']);
    },
  },
  {
    name: 'draws: a one-deck shuffle is descending Fisher-Yates and deals from index 0',
    run: (t) => {
      const stream = RandomStream.create(PI);
      const shuffled = shuffle(stream, canonicalShoe(1)).map(label);
      t.equal(shuffled, [
        '0C9', '0S4', '0HT', '0S6', '0H3', '0H6', '0SQ', '0C4', '0C6', '0D3', '0S9', '0DK', '0SK',
        '0H7', '0H5', '0HQ', '0DA', '0D9', '0D5', '0DT', '0CA', '0C5', '0H9', '0CT', '0C3', '0C7',
        '0D2', '0S2', '0S3', '0HA', '0D8', '0SJ', '0D4', '0H4', '0SA', '0CK', '0CJ', '0S8', '0ST',
        '0DQ', '0H8', '0C8', '0CQ', '0S5', '0S7', '0HJ', '0D7', '0H2', '0C2', '0HK', '0DJ', '0D6',
      ]);
      // 51 bounded draws (i = 51 down to 1), no rejections: block 12, lane 3.
      t.equal([stream.state().block, stream.state().lane], [[12, 0], 3]);
      t.record('shuffled', shuffled);
    },
  },
  {
    name: 'draws: a six-deck shoe shuffles to the reference order',
    run: (t) => {
      const stream = RandomStream.create(PI);
      const shuffled = shuffle(stream, canonicalShoe(6)).map(label);
      t.equal(shuffled.slice(0, 10), ['2ST', '1ST', '1DJ', '3S6', '1DA', '0HT', '4H9', '5DT', '3S5', '2H3']);
      t.equal(shuffled[311], '1D6');
      t.equal([stream.state().block, stream.state().lane], [[77, 0], 3]);
      t.record('shuffled', shuffled);
    },
  },
  {
    name: 'draws: shuffling leaves its input untouched',
    run: (t) => {
      const shoe = canonicalShoe(1);
      shuffle(RandomStream.create(PI), shoe);
      t.equal(shoe.map(label), canonicalShoe(1).map(label));
    },
  },
  {
    name: 'draws: dice are two bounded draws of six, plus one each',
    run: (t) => {
      const stream = RandomStream.create(PI);
      const rolls = Array.from({ length: 5 }, () => rollDice(stream));
      t.equal(rolls, [[5, 3], [5, 6], [4, 2], [3, 1], [6, 6]]);
      t.equal([stream.state().block, stream.state().lane], [[2, 0], 2]);
      t.record('rolls', rolls);
    },
  },
  {
    name: 'draws: a single-zero wheel is uniform over 0..36',
    run: (t) => {
      const stream = RandomStream.create(PI);
      const spins = Array.from({ length: 10 }, () => spinRoulette(stream, 'single-zero'));
      t.equal(spins, [27, 0, 25, 31, 9, 8, 6, 35, 35, 16]);
      t.record('spins', spins);
    },
  },
  {
    name: 'draws: a double-zero wheel is uniform over [0, 00, 1..36] with 00 a distinct pocket',
    run: (t) => {
      const stream = RandomStream.create(PI);
      const spins = Array.from({ length: 10 }, () => spinRoulette(stream, 'double-zero'));
      // Reference indices into [0, 00, 1..36]: 4, 30, 0, 27, 19, 5, 30, 36, 25, 1.
      t.equal(spins, [3, 29, 0, 26, 18, 4, 29, 35, 24, '00']);
      t.record('spins', spins);
    },
  },
];

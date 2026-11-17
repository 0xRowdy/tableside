// Spec 1 Game rules
// docs/development.md Blackjack reference
import type { BlackjackDeviation, BlackjackPlayPolicy, StrategyDefinition, StrategyInstruction } from '../src';

const H = 'HHHHHHHHHH';
const S = 'SSSSSSSSSS';
const P = 'PPPPPPPPPP';

const HARD = [H, H, H, H, H, 'HHDDDDHHHH', 'HDDDDDDDDH', 'HDDDDDDDDD', 'HHHSSSHHHH', 'HSSSSSHHHH', 'HSSSSSHHHH', 'HSSSSSHHHR', 'RSSSSSHHRR', S, S, S, S];
const SOFT = [H, 'HHHHDDHHHH', 'HHHHDDHHHH', 'HHHDDDHHHH', 'HHHDDDHHHH', 'HHDDDDHHHH', 'HSDDDDSSHH', S, S];
const PAIR = [P, 'HPPPPPPHHH', 'HPPPPPPHHH', 'HHHHPPHHHH', 'HDDDDDDDDH', 'HPPPPPHHHH', 'HPPPPPPHHH', P, 'SPPPPPSPPS', S];

const swap = (row: string, map: Record<string, string>) => [...row].map((c) => map[c] ?? c).join('');
const rows = (list: readonly string[], map: Record<string, string>) => list.map((row) => swap(row, map));

const withoutDouble = (list: readonly string[], soft18?: number) => list.map((row, i) => swap(row, i === soft18 ? { D: 'S' } : { D: 'H', P: 'H', R: 'H' }));

const SPLIT_BY_RULE = ['SSSSSSSSSS', H, H, H, 'HDDDDDDDDH', 'HSSSSSHHHH', 'HSSSSSHHHH', 'HSSSSSHHHH', 'SSSSSSSSSS', S];
const SPLIT_BY_BALANCE = [H, H, H, H, H, 'HSSSSSHHHH', 'HSSSSSHHHH', 'RSSSSSHHRR', 'SSSSSSSSSS', S];

const LATER_HARD = [...rows(HARD, { R: 'H' }), S];
const LATER_SOFT = [...SOFT, S];

const published = (schlesinger: string, difference: number | null, cost: { trueCount: number; perBet: string }[] = []) => ({
  schlesinger: { value: schlesinger, difference, cost },
  bja: { value: schlesinger, difference, cost },
});

const hard = (total: number, up: number, threshold: number, atOrAbove: 'stand' | 'double' | 'hit', below: 'stand' | 'double' | 'hit', direction: BlackjackDeviation['direction'] = 'deviate-at-or-above') => ({
  id: `${total}v${up}`,
  set: 'illustrious18' as const,
  situation: `${total} vs ${up === 1 ? 'A' : up}`,
  hand: { kind: 'hard' as const, total },
  up,
  threshold,
  direction,
  atOrAbove,
  below,
  published: published(`+${threshold}`, 0),
});

export const TEST_DEVIATIONS: readonly BlackjackDeviation[] = [
  { ...hard(16, 10, 1, 'stand', 'hit'), published: published('+0', 1, [{ trueCount: 0, perBet: '+0.0000' }]) },
  { ...hard(10, 10, 4, 'double', 'hit') },
  { ...hard(12, 3, 2, 'stand', 'hit') },
  { ...hard(13, 2, 0, 'stand', 'hit', 'basic-at-or-above'), published: published('-1', 1, [{ trueCount: -1, perBet: '+0.0072' }]) },
  {
    id: 'TTv5',
    set: 'illustrious18',
    situation: 'T,T vs 5',
    hand: { kind: 'pair', value: 10 },
    up: 5,
    threshold: 5,
    direction: 'deviate-at-or-above',
    atOrAbove: 'split',
    below: 'stand',
    published: published('+5', 0),
  },
  {
    id: 'TTv6',
    set: 'illustrious18',
    situation: 'T,T vs 6',
    hand: { kind: 'pair', value: 10 },
    up: 6,
    threshold: 5,
    direction: 'deviate-at-or-above',
    atOrAbove: 'split',
    below: 'stand',
    published: published('+4', 1, [{ trueCount: 4, perBet: '+0.0188' }]),
  },
  { id: '14v10R', set: 'fab4', situation: '14 vs 10 surrender', hand: { kind: 'hard', total: 14 }, up: 10, threshold: 4, direction: 'deviate-at-or-above', atOrAbove: 'surrender', below: 'basic', published: published('+3', 1) },
  { id: '15v10R', set: 'fab4', situation: '15 vs 10 surrender', hand: { kind: 'hard', total: 15 }, up: 10, threshold: 0, direction: 'basic-at-or-above', atOrAbove: 'surrender', below: 'basic', published: published('+0', 0) },
  { id: 'insurance', set: 'insurance', situation: 'Insurance', hand: { kind: 'insurance' }, up: 1, threshold: 3, direction: 'deviate-at-or-above', atOrAbove: 'insure', below: 'decline', published: published('+3', 0) },
];

export const TEST_POLICY: BlackjackPlayPolicy = {
  count: 'none',
  first: { hard: HARD, soft: SOFT, pair: PAIR },
  fallbacks: {
    double: { hard: withoutDouble(HARD), soft: withoutDouble(SOFT, 6), pair: withoutDouble(PAIR) },
    doubleOnOriginalLateSurrender: { hard: rows(HARD, { D: 'H', P: 'H' }), soft: withoutDouble(SOFT, 6), pair: rows(PAIR, { D: 'H', P: 'H' }) },
    splitByRule: SPLIT_BY_RULE,
    splitByBalance: SPLIT_BY_BALANCE,
    surrender: { hard: rows(HARD, { R: 'H' }), soft: SOFT, pair: rows(PAIR, { R: 'H' }) },
  },
  later: { hard: LATER_HARD, soft: LATER_SOFT },
  laterWithoutDouble: { hard: withoutDouble(LATER_HARD), soft: withoutDouble(LATER_SOFT, 6) },
  deviations: [],
};

const definition = (id: string, name: string, play: BlackjackPlayPolicy, instructions: readonly StrategyInstruction[] = []): StrategyDefinition => ({
  format: 1,
  id,
  revision: 1,
  name,
  game: 'blackjack',
  table: { dealer: 'S17', lateSurrender: true, limits: { initial: { min: '10', max: '1000' } } },
  parameters: [],
  counters: [],
  instructions,
  adjustments: [],
  stopWhen: null,
  play,
});

export const TEST_BASIC = definition('test-blackjack-basic', 'Basic strategy', TEST_POLICY);
export const TEST_DEVIATING = definition('test-blackjack-deviations', 'Basic with deviations', { ...TEST_POLICY, count: 'supplied', deviations: TEST_DEVIATIONS });
export const TEST_COUNTING_BASIC = definition('test-blackjack-counting-basic', 'Counting with basic', { ...TEST_POLICY, count: 'player' });
export const TEST_COUNTING_DEVIATING = definition('test-blackjack-counting-deviations', 'Counting with deviations', { ...TEST_POLICY, count: 'player', deviations: TEST_DEVIATIONS });

// Spec 1 Game rules
const band = (from: number | null, units: number): StrategyInstruction => ({
  id: from === null ? 'below-1' : `from-${from}`,
  label: from === null ? `Below +1: ${units} unit` : `+${from}${from === 4 ? ' or more' : ''}: ${units} units`,
  when: from === null ? { always: true } : { compare: { value: 'true-count' }, op: 'ge', to: { lit: String(from) } },
  priority: from ?? 0,
  bets: [{ target: { target: 'hand-1' }, amount: { lit: String(units * 10) } }],
});
export const TEST_SCHEDULE: readonly StrategyInstruction[] = [band(null, 1), band(1, 2), band(2, 4), band(3, 6), band(4, 8)];
export const TEST_COUNTING_SCHEDULE = definition('test-blackjack-counting-schedule', 'Counting with basic', { ...TEST_POLICY, count: 'player' }, TEST_SCHEDULE);

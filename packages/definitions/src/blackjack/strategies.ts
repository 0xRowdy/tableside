// Spec 1 Built-in strategies
import { HAND_TARGET, type BlackjackDeviation, type BlackjackMode, type BlackjackPlayPolicy, type DeviationPlay, type PublishedIndex, type StrategyDefinition, type StrategyInstruction } from '@tableside/engine';

import {
  BLACKJACK_REFERENCE,
  basicStrategy,
  continuation,
  playingDeviations,
  type BasicStrategyCell,
  type BlackjackPreset,
  type CardValue,
  type DeviationAction,
  type PlayingDeviation,
  type PublishedCost,
} from './reference';

export const BLACKJACK_MODES: readonly BlackjackMode[] = ['basic', 'basic-with-deviations', 'counting-with-basic', 'counting-with-deviations'];
export type { BlackjackMode };

const MODE_NAMES: Readonly<Record<BlackjackMode, string>> = {
  basic: 'Basic strategy',
  'basic-with-deviations': 'Basic with deviations',
  'counting-with-basic': 'Counting with basic',
  'counting-with-deviations': 'Counting with deviations',
};

export const countingMode = (mode: BlackjackMode) => mode === 'counting-with-basic' || mode === 'counting-with-deviations';

// Spec 3 Lessons › Check protection
export const blackjackModeOf = (strategyId: string): BlackjackMode | null =>
  BLACKJACK_MODES.find((mode) => new RegExp(`^blackjack-${mode}(-bet-schedule)?-[A-Za-z0-9_]+$`).test(strategyId)) ?? null;
const deviating = (mode: BlackjackMode) => mode === 'basic-with-deviations' || mode === 'counting-with-deviations';

// Spec 1 Game rules, Counting (Hi-Lo), Amendment 9 §7
export const BET_SCHEDULE: readonly { readonly from: number | null; readonly amount: string }[] = [
  { from: null, amount: '10' },
  { from: 1, amount: '20' },
  { from: 2, amount: '40' },
  { from: 3, amount: '60' },
  { from: 4, amount: '80' },
];

const scheduleInstructions = (): StrategyInstruction[] =>
  BET_SCHEDULE.map(({ from, amount }) => ({
    id: from === null ? 'true-count-below-1' : `true-count-${from}`,
    label: from === null ? `True count below +1: ${amount}` : `True count +${from}${from === 4 ? ' or more' : ''}: ${amount}`,
    when: from === null ? { always: true } : { compare: { value: 'true-count' }, op: 'ge', to: { lit: String(from) } },
    priority: from ?? 0,
    bets: [{ target: { target: HAND_TARGET }, amount: { lit: amount } }],
  }));

const LETTERS: Readonly<Record<string, string>> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const UP_CARDS: readonly CardValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const row = (cell: (up: CardValue) => string | null) => UP_CARDS.map((up) => LETTERS[cell(up) ?? ''] ?? '-').join('');

const dealerRule = (preset: BlackjackPreset) => (preset.startsWith('H17') ? 'H17' : 'S17');
const lateSurrender = (preset: BlackjackPreset) => preset.endsWith('_LS');

function policy(preset: BlackjackPreset, mode: BlackjackMode): BlackjackPlayPolicy {
  const first = (pick: (cell: BasicStrategyCell) => string | null) => ({
    hard: range(4, 20).map((hand) => row((up) => pick(basicStrategy(preset, 'hard', hand, up)))),
    soft: range(12, 20).map((hand) => row((up) => pick(basicStrategy(preset, 'soft', hand, up)))),
    pair: range(1, 10).map((hand) => row((up) => pick(basicStrategy(preset, 'pair', hand, up)))),
  });
  const pairs = (pick: (cell: BasicStrategyCell) => string | null) => range(1, 10).map((hand) => row((up) => pick(basicStrategy(preset, 'pair', hand, up))));
  const rule = dealerRule(preset);
  const later = (double: boolean) => {
    const cells = (kind: 'hard' | 'soft', from: number, to: number) =>
      range(from, to).map((total) =>
        row((up) => {
          const cell = continuation(rule, kind, total, up);
          return double || cell.action !== 'double' ? cell.action : cell.fallback;
        }),
      );
    return { hard: cells('hard', 4, 21), soft: cells('soft', 12, 21) };
  };
  return {
    count: countingMode(mode) ? 'player' : deviating(mode) ? 'supplied' : 'none',
    first: first((cell) => cell.action),
    fallbacks: {
      double: first((cell) => cell.fallbacks.double),
      doubleOnOriginalLateSurrender: first((cell) => cell.fallbacks.doubleOnOriginalLateSurrenderHand),
      splitByRule: pairs((cell) => cell.fallbacks.splitByRule),
      splitByBalance: pairs((cell) => cell.fallbacks.splitByBalance),
      surrender: first((cell) => cell.fallbacks.surrender),
    },
    later: later(true),
    laterWithoutDouble: later(false),
    deviations: deviating(mode) ? playingDeviations(preset).map(deviation) : [],
  };
}

const PLAYS: Readonly<Record<DeviationAction, DeviationPlay>> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
  insure: 'insure',
  decline: 'decline',
  basicWithoutSurrender: 'basic',
};

const perBet = (cost: PublishedCost) => `${cost.perBet < 0 ? '-' : '+'}${Math.abs(cost.perBet).toFixed(4)}`;
const published = (value: string, difference: number | null, costs: readonly PublishedCost[]): PublishedIndex => ({
  value,
  difference,
  cost: costs.map((cost) => ({ trueCount: cost.trueCount, perBet: perBet(cost) })),
});

function deviation(d: PlayingDeviation): BlackjackDeviation {
  return {
    id: `${d.dealerRule} ${d.situation}`,
    set: d.set,
    situation: d.situation,
    hand: d.handKind === 'insurance' ? { kind: 'insurance' } : d.handKind === 'pair' ? { kind: 'pair', value: d.hand as number } : { kind: 'hard', total: d.hand as number },
    up: d.up,
    threshold: d.threshold,
    direction: d.direction === 'deviateAtOrAbove' ? 'deviate-at-or-above' : 'basic-at-or-above',
    atOrAbove: PLAYS[d.atOrAbove],
    below: PLAYS[d.below],
    published: {
      schlesinger: published(d.published.schlesinger, d.difference.schlesinger, d.costPerBet.schlesinger),
      bja: published(d.dealerRule === 'S17' ? d.published.bjaS17 : d.published.bjaH17, d.difference.bja, d.costPerBet.bja),
    },
  };
}

const cache = new Map<string, StrategyDefinition>();

export function blackjackStrategy(preset: BlackjackPreset, mode: BlackjackMode, betSchedule = false): StrategyDefinition {
  if (betSchedule && !countingMode(mode)) throw new Error('the bet schedule goes with a counting mode');
  const key = `${preset} ${mode} ${betSchedule}`;
  let definition = cache.get(key);
  if (!definition) {
    definition = {
      format: 1,
      id: `blackjack-${mode}${betSchedule ? '-bet-schedule' : ''}-${preset}`,
      revision: 1,
      name: betSchedule ? `${MODE_NAMES[mode]} · bet schedule` : MODE_NAMES[mode],
      game: 'blackjack',
      table: { dealer: dealerRule(preset), lateSurrender: lateSurrender(preset), limits: { initial: { min: '10', max: '1000' } } },
      parameters: [],
      counters: [],
      instructions: betSchedule ? scheduleInstructions() : [],
      adjustments: [],
      stopWhen: null,
      play: policy(preset, mode),
      note: `Certified blackjack reference ${BLACKJACK_REFERENCE.version}.`,
    };
    cache.set(key, definition);
  }
  return definition;
}

export const BLACKJACK_REFERENCE_IDENTITY = {
  id: `blackjack-coaching-reference@${BLACKJACK_REFERENCE.manifest.slice(0, 16)}`,
  version: Number(BLACKJACK_REFERENCE.version.split('.')[0]),
} as const;

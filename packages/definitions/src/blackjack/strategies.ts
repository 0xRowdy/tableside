// The blackjack built-in strategies (spec #51): each preset's rule-specific
// basic strategy, and basic with the certified deviation curriculum (the S17
// or H17 index file; the Fab 4 surrenders only in late-surrender presets),
// where Tableside supplies the count. Each is plain strategy data in the
// engine's blackjack vocabulary, packed from the certified reference: the
// basic table with its validated legal fallbacks, the continuation table for
// later decisions, and the index plays with their published comparisons.
// Bets are the player's own (the bet schedule arrives with the counting modes).
import type { BlackjackDeviation, BlackjackPlayPolicy, DeviationPlay, PublishedIndex, StrategyDefinition } from '@tableside/engine';

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

/** The guided modes this release offers; the counting modes arrive with #78. */
export const BLACKJACK_MODES = ['basic', 'basic-with-deviations'] as const;
export type BlackjackMode = (typeof BLACKJACK_MODES)[number];

const MODE_NAMES: Readonly<Record<BlackjackMode, string>> = { basic: 'Basic strategy', 'basic-with-deviations': 'Basic with deviations' };

const LETTERS: Readonly<Record<string, string>> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const UP_CARDS: readonly CardValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** One row: a letter per up card, ace first. */
const row = (cell: (up: CardValue) => string | null) => UP_CARDS.map((up) => LETTERS[cell(up) ?? ''] ?? '-').join('');

const dealerRule = (preset: BlackjackPreset) => (preset.startsWith('H17') ? 'H17' : 'S17');
const lateSurrender = (preset: BlackjackPreset) => preset.endsWith('_LS');

function policy(preset: BlackjackPreset, mode: BlackjackMode): BlackjackPlayPolicy {
  /** Hard 4-20, soft 12-20 and pairs A-10, each cell read through `pick`. */
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
    countShown: mode === 'basic-with-deviations',
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
    deviations: mode === 'basic' ? [] : playingDeviations(preset).map(deviation),
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

/** "+0.0188": four decimals, as the research prints a per-bet cost. */
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

/**
 * The built-in strategy for a preset and mode: pure strategy data the engine
 * validates and pins. Its identity names the reference version it was packed from.
 */
export function blackjackStrategy(preset: BlackjackPreset, mode: BlackjackMode): StrategyDefinition {
  const key = `${preset} ${mode}`;
  let definition = cache.get(key);
  if (!definition) {
    definition = {
      format: 1,
      id: `blackjack-${mode}-${preset}`,
      revision: 1,
      name: MODE_NAMES[mode],
      game: 'blackjack',
      table: { dealer: dealerRule(preset), lateSurrender: lateSurrender(preset), limits: { initial: { min: '10', max: '1000' } } },
      parameters: [],
      counters: [],
      instructions: [],
      adjustments: [],
      stopWhen: null,
      play: policy(preset, mode),
      note: `Certified blackjack reference ${BLACKJACK_REFERENCE.version}.`,
    };
    cache.set(key, definition);
  }
  return definition;
}

/** The reference identity a guided blackjack activity pins alongside its strategy. */
export const BLACKJACK_REFERENCE_IDENTITY = { id: 'blackjack-coaching-reference', version: 1 } as const;

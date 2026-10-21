// The certified blackjack coaching reference (spec #51, launch gate 2): the
// frozen research output of issue true-count#15 at
// research/blackjack-coaching-validation@ae3776d, embedded verbatim and read
// through typed lookups. Objective: highest expected net return per original
// bet; ties resolve toward the no-extra-wager action.
import { parseCsv, type CsvRow } from './csv';
import { REFERENCE_FILES, REFERENCE_MANIFEST_SHA256 } from './reference-files.generated';

/** Identity of this reference; activities pin it alongside rule and strategy identities. */
export const BLACKJACK_REFERENCE = {
  version: '1.0.0',
  source: 'research/blackjack-coaching-validation@ae3776d151f5ebf35432abb4ce7ae1b0bd9b69c3',
  /** SHA-256 of the frozen reference-manifest.json, which hashes every file. */
  manifest: REFERENCE_MANIFEST_SHA256,
  files: Object.fromEntries(Object.entries(REFERENCE_FILES).map(([file, { sha256 }]) => [file, sha256])) as Readonly<
    Record<keyof typeof REFERENCE_FILES, string>
  >,
} as const;

/** The blackjack rule presets: dealer rule × late surrender. Default S17_LS. */
export const BLACKJACK_PRESETS = ['S17_LS', 'S17_noLS', 'H17_LS', 'H17_noLS'] as const;
export type BlackjackPreset = (typeof BLACKJACK_PRESETS)[number];
export type DealerRule = 'S17' | 'H17';

const PRESET_RULES: Readonly<Record<BlackjackPreset, { readonly dealerRule: DealerRule; readonly lateSurrender: boolean }>> = {
  S17_LS: { dealerRule: 'S17', lateSurrender: true },
  S17_noLS: { dealerRule: 'S17', lateSurrender: false },
  H17_LS: { dealerRule: 'H17', lateSurrender: true },
  H17_noLS: { dealerRule: 'H17', lateSurrender: false },
};

/** A card's blackjack value: the ace is 1 and every ten-valued card is 10. */
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type HandKind = 'hard' | 'soft' | 'pair';
export type PlayAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface BasicStrategyCell {
  /** The prescribed action when every option is available. */
  readonly action: PlayAction;
  /** Expected-return advantage of the prescribed action over the runner-up, per original bet. */
  readonly margin: number;
  /** The validated next-best legal action for each way the prescribed one can be unavailable. */
  readonly fallbacks: {
    /** Double unavailable on a post-split hand, or for balance where surrender is not legal. */
    readonly double: 'hit' | 'stand';
    /** Double unaffordable on an original two-card hand in a late-surrender preset. */
    readonly doubleOnOriginalLateSurrenderHand: 'hit' | 'stand' | 'surrender';
    /** Split unavailable by rule (four hands reached, or aces): A,A must stand. Null for non-pairs. */
    readonly splitByRule: 'hit' | 'stand' | 'double' | null;
    /** Split unaffordable (so is the double). Null for non-pairs. */
    readonly splitByBalance: 'hit' | 'stand' | 'surrender' | null;
    /** Surrender unavailable (post-split hand, or after a hit). */
    readonly surrender: 'hit' | 'stand' | 'double' | 'split';
  };
  /** Fresh-shoe expected net return per original bet, given no dealer blackjack; null where the action does not apply. */
  readonly values: {
    readonly stand: number;
    readonly hit: number;
    readonly double: number | null;
    readonly split: number | null;
    readonly surrender: number | null;
  };
}

const LETTERS: Readonly<Record<string, PlayAction>> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };

/** The research's single-letter action, which must be one of `allowed`. */
function letter<A extends PlayAction>(value: string, allowed: readonly A[]): A {
  const action = allowed.find((candidate) => candidate === LETTERS[value]);
  if (action === undefined) throw new Error(`reference action ${JSON.stringify(value)} is not one of ${allowed.join('/')}`);
  return action;
}

const optionalLetter = <A extends PlayAction>(value: string, allowed: readonly A[]) => (value === '' ? null : letter(value, allowed));
const field = (row: CsvRow, name: string): string => row[name] ?? '';
const optionalNumber = (value: string) => (value === '' ? null : Number(value));

function lazy<K, V>(load: () => Map<K, V>): () => Map<K, V> {
  let cache: Map<K, V> | undefined;
  return () => (cache ??= load());
}

const cellKey = (kind: string, hand: number | string, up: number | string) => `${kind}|${hand}|${up}`;

const basicTables = lazy(() => {
  const tables = new Map<BlackjackPreset, Map<string, BasicStrategyCell>>();
  for (const preset of BLACKJACK_PRESETS) {
    const cells = new Map<string, BasicStrategyCell>();
    for (const row of parseCsv(REFERENCE_FILES[`basic_${preset}.csv`].text)) {
      cells.set(cellKey(field(row, 'kind'), field(row, 'hand'), field(row, 'up')), {
        action: letter(field(row, 'action'), ['hit', 'stand', 'double', 'split', 'surrender']),
        margin: Number(row['margin']),
        fallbacks: {
          double: letter(field(row, 'fallback_double'), ['hit', 'stand']),
          doubleOnOriginalLateSurrenderHand: letter(field(row, 'fallback_double_ls_original'), ['hit', 'stand', 'surrender']),
          splitByRule: optionalLetter(field(row, 'fallback_split_rule'), ['hit', 'stand', 'double']),
          splitByBalance: optionalLetter(field(row, 'fallback_split_balance'), ['hit', 'stand', 'surrender']),
          surrender: letter(field(row, 'fallback_surrender'), ['hit', 'stand', 'double', 'split']),
        },
        values: {
          stand: Number(row['ev_stand']),
          hit: Number(row['ev_hit']),
          double: optionalNumber(field(row, 'ev_double')),
          split: optionalNumber(field(row, 'ev_split')),
          surrender: optionalNumber(field(row, 'ev_surrender')),
        },
      });
    }
    tables.set(preset, cells);
  }
  return tables;
});

/**
 * The preset's total-dependent basic strategy for a two-card decision: hard
 * totals 4–20, soft totals 13–20 (A,2–A,9) and pairs by card value (A,A is 1).
 */
export function basicStrategy(preset: BlackjackPreset, kind: HandKind, hand: number, up: CardValue): BasicStrategyCell {
  const cell = basicTables().get(preset)?.get(cellKey(kind, hand, up));
  if (cell === undefined) throw new RangeError(`no ${preset} basic-strategy cell for ${kind} ${hand} vs ${up}`);
  return cell;
}

/**
 * What a playing deviation prescribes on one side of its index.
 * `basicWithoutSurrender` is the basic table's play once surrender is set
 * aside: the cell's surrender fallback.
 */
export type DeviationAction = PlayAction | 'insure' | 'decline' | 'basicWithoutSurrender';

/** A published comparison bin: the per-bet cost of playing the published index there instead of the taught one. */
export interface PublishedCost {
  readonly trueCount: number;
  readonly perBet: number;
  readonly standardError: number;
}

/** One certified Hi-Lo index play (Illustrious 18, Fab 4 surrender, or insurance). */
export interface PlayingDeviation {
  readonly dealerRule: DealerRule;
  readonly set: 'illustrious18' | 'fab4' | 'insurance';
  /** The research's name for the situation, e.g. "16 vs 10" or "T,T vs 6". */
  readonly situation: string;
  readonly handKind: 'hard' | 'pair' | 'insurance';
  /** Hard total or pair card value; null for insurance. */
  readonly hand: number | null;
  readonly up: CardValue;
  /** True count (Hi-Lo, truncated toward zero) at which the at-or-above action applies. */
  readonly threshold: number;
  /** Which side is basic strategy: below the index, or at and above it (negative indices). */
  readonly direction: 'deviateAtOrAbove' | 'basicAtOrAbove';
  readonly atOrAbove: DeviationAction;
  readonly below: DeviationAction;
  /** The research's one-line statement of the play. */
  readonly instruction: string;
  /** How the play applies to split hands. */
  readonly postSplit: string;
  /** Published values as the sources print them (Schlesinger; BJA 2018 S17 and H17 charts). */
  readonly published: {
    readonly schlesinger: string;
    readonly bjaS17: string;
    readonly bjaH17: string;
    readonly bjaRuleSpecific: number | null;
  };
  /** Taught index minus published index; null where the source has no comparable value. */
  readonly difference: { readonly schlesinger: number | null; readonly bja: number | null };
  /** Cost of the published index where it differs; one bin per count of difference; empty where it agrees or is not comparable. */
  readonly costPerBet: { readonly schlesinger: readonly PublishedCost[]; readonly bja: readonly PublishedCost[] };
}

const SETS: Readonly<Record<string, PlayingDeviation['set']>> = { I18: 'illustrious18', F4: 'fab4', insurance: 'insurance' };
const DIRECTIONS: Readonly<Record<string, PlayingDeviation['direction']>> = {
  deviate_at_or_above: 'deviateAtOrAbove',
  basic_at_or_above: 'basicAtOrAbove',
};
const DEVIATION_ACTIONS: Readonly<Record<string, DeviationAction>> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
  insure: 'insure',
  decline: 'decline',
  'basic action (stand/hit/double per table)': 'basicWithoutSurrender',
};

function known<T>(table: Readonly<Record<string, T>>, value: string): T {
  const found = table[value];
  if (found === undefined) throw new Error(`unknown reference value ${JSON.stringify(value)}`);
  return found;
}

function cardValue(value: string): CardValue {
  const n = value === 'A' ? 1 : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error(`unknown up card ${JSON.stringify(value)}`);
  return n as CardValue;
}

/** "+4:+0.0188±0.0026", or several bins joined by "; " when the indices differ by more than one count. */
function publishedCosts(cell: string): PublishedCost[] {
  if (cell === '') return [];
  return cell.split('; ').map((bin) => {
    const match = /^([+-]\d+):([+-]\d+\.\d+)±(\d+\.\d+)$/.exec(bin);
    if (match === null) throw new Error(`unknown cost ${JSON.stringify(bin)}`);
    return { trueCount: Number(match[1]), perBet: Number(match[2]), standardError: Number(match[3]) };
  });
}

const deviationTables = lazy(() => {
  const tables = new Map<DealerRule, readonly PlayingDeviation[]>();
  for (const rule of ['S17', 'H17'] as const) {
    const rows = parseCsv(REFERENCE_FILES[`indices_${rule}_final.csv`].text);
    tables.set(
      rule,
      rows.map((row): PlayingDeviation => {
        const hand = field(row, 'hand');
        return {
          dealerRule: rule,
          set: known(SETS, field(row, 'set')),
          situation: field(row, 'situation'),
          handKind: known({ hard: 'hard', pair: 'pair', insurance: 'insurance' } as const, field(row, 'hand_kind')),
          hand: hand === 'any' ? null : hand === 'T,T' ? 10 : Number(hand),
          up: cardValue(field(row, 'up')),
          threshold: Number(field(row, 'taught_threshold')),
          direction: known(DIRECTIONS, field(row, 'direction')),
          atOrAbove: known(DEVIATION_ACTIONS, field(row, 'deviation_action')),
          below: known(DEVIATION_ACTIONS, field(row, 'alternative_action')),
          instruction: field(row, 'rule'),
          postSplit: field(row, 'post_split_note'),
          published: {
            schlesinger: field(row, 'schlesinger'),
            bjaS17: field(row, 'bja_S17'),
            bjaH17: field(row, 'bja_H17'),
            bjaRuleSpecific: optionalNumber(field(row, 'bja_rule_specific_tc')),
          },
          difference: {
            schlesinger: optionalNumber(field(row, 'diff_vs_schlesinger')),
            bja: optionalNumber(field(row, 'diff_vs_bja')),
          },
          costPerBet: {
            schlesinger: publishedCosts(field(row, 'cost_per_bet_at_schlesinger')),
            bja: publishedCosts(field(row, 'cost_per_bet_at_bja')),
          },
        };
      }),
    );
  }
  return tables;
});

/**
 * The certified deviation curriculum for a preset, in the research's order.
 * Index files are per dealer rule; the Fab 4 surrender plays apply only in
 * late-surrender presets.
 */
export function playingDeviations(preset: BlackjackPreset): readonly PlayingDeviation[] {
  const { dealerRule, lateSurrender } = PRESET_RULES[preset];
  const all = deviationTables().get(dealerRule) ?? [];
  return lateSurrender ? all : all.filter((deviation) => deviation.set !== 'fab4');
}

/** The play a deviation prescribes at an integer true count. */
export function deviationAction(deviation: PlayingDeviation, trueCount: number): DeviationAction {
  return trueCount >= deviation.threshold ? deviation.atOrAbove : deviation.below;
}

export interface BlackjackHouseEdge {
  /** Percent of the initial wager, two decimals, as displayed ("0.33"). */
  readonly percent: string;
  /** The reference version the value derives from. */
  readonly reference: string;
}

// The edge of each preset's rules off the top of a fresh six-deck shoe, computed
// under the certified basic-strategy play from the certified basic tables'
// values (see test/house-edge.test.ts). A property of the rules, never a
// prediction of a session's results.
const HOUSE_EDGE_PERCENT: Readonly<Record<BlackjackPreset, string>> = {
  S17_LS: '0.33',
  S17_noLS: '0.40',
  H17_LS: '0.53',
  H17_noLS: '0.62',
};

export function blackjackHouseEdge(preset: BlackjackPreset): BlackjackHouseEdge {
  return { percent: HOUSE_EDGE_PERCENT[preset], reference: BLACKJACK_REFERENCE.version };
}

export interface ContinuationCell {
  readonly action: 'hit' | 'stand' | 'double';
  /** When the double is unavailable. */
  readonly fallback: 'hit' | 'stand';
}

const continuationTables = lazy(() => {
  const tables = new Map<DealerRule, Map<string, ContinuationCell>>();
  for (const rule of ['S17', 'H17'] as const) {
    const cells = new Map<string, ContinuationCell>();
    for (const row of parseCsv(REFERENCE_FILES[`continuation_${rule}.csv`].text)) {
      cells.set(cellKey(field(row, 'kind'), field(row, 'total'), field(row, 'up')), {
        action: letter(field(row, 'action'), ['hit', 'stand', 'double']),
        fallback: letter(field(row, 'fallback'), ['hit', 'stand']),
      });
    }
    tables.set(rule, cells);
  }
  return tables;
});

/**
 * The taught total-dependent table for later decisions: multi-card hands and
 * split hands, hard totals 4–21 and soft totals 12–21. Shared by both
 * surrender variants of a dealer rule.
 */
export function continuation(rule: DealerRule, kind: 'hard' | 'soft', total: number, up: CardValue): ContinuationCell {
  const cell = continuationTables().get(rule)?.get(cellKey(kind, total, up));
  if (cell === undefined) throw new RangeError(`no ${rule} continuation cell for ${kind} ${total} vs ${up}`);
  return cell;
}

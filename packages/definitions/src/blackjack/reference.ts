// Spec 1 Game rules, Blackjack reference (certified)
import { parseCsv, type CsvRow } from './csv';
import { REFERENCE_FILES, REFERENCE_MANIFEST_SHA256 } from './reference-files.generated';

export const BLACKJACK_REFERENCE = {
  version: '1.0.0',
  source: 'research/blackjack-coaching-validation@ae3776d151f5ebf35432abb4ce7ae1b0bd9b69c3',
  manifest: REFERENCE_MANIFEST_SHA256,
  files: Object.fromEntries(Object.entries(REFERENCE_FILES).map(([file, { sha256 }]) => [file, sha256])) as Readonly<
    Record<keyof typeof REFERENCE_FILES, string>
  >,
} as const;

export const BLACKJACK_PRESETS = ['S17_LS', 'S17_noLS', 'H17_LS', 'H17_noLS'] as const;
export type BlackjackPreset = (typeof BLACKJACK_PRESETS)[number];
export type DealerRule = 'S17' | 'H17';

const PRESET_RULES: Readonly<Record<BlackjackPreset, { readonly dealerRule: DealerRule; readonly lateSurrender: boolean }>> = {
  S17_LS: { dealerRule: 'S17', lateSurrender: true },
  S17_noLS: { dealerRule: 'S17', lateSurrender: false },
  H17_LS: { dealerRule: 'H17', lateSurrender: true },
  H17_noLS: { dealerRule: 'H17', lateSurrender: false },
};

export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type HandKind = 'hard' | 'soft' | 'pair';
export type PlayAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export interface BasicStrategyCell {
  readonly action: PlayAction;
  readonly margin: number;
  readonly fallbacks: {
    readonly double: 'hit' | 'stand';
    readonly doubleOnOriginalLateSurrenderHand: 'hit' | 'stand' | 'surrender';
    readonly splitByRule: 'hit' | 'stand' | 'double' | null;
    readonly splitByBalance: 'hit' | 'stand' | 'surrender' | null;
    readonly surrender: 'hit' | 'stand' | 'double' | 'split';
  };
  readonly values: {
    readonly stand: number;
    readonly hit: number;
    readonly double: number | null;
    readonly split: number | null;
    readonly surrender: number | null;
  };
}

const LETTERS: Readonly<Record<string, PlayAction>> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };

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

export function basicStrategy(preset: BlackjackPreset, kind: HandKind, hand: number, up: CardValue): BasicStrategyCell {
  const cell = basicTables().get(preset)?.get(cellKey(kind, hand, up));
  if (cell === undefined) throw new RangeError(`no ${preset} basic-strategy cell for ${kind} ${hand} vs ${up}`);
  return cell;
}

export type DeviationAction = PlayAction | 'insure' | 'decline' | 'basicWithoutSurrender';

export interface PublishedCost {
  readonly trueCount: number;
  readonly perBet: number;
  readonly standardError: number;
}

export interface PlayingDeviation {
  readonly dealerRule: DealerRule;
  readonly set: 'illustrious18' | 'fab4' | 'insurance';
  readonly situation: string;
  readonly handKind: 'hard' | 'pair' | 'insurance';
  readonly hand: number | null;
  readonly up: CardValue;
  readonly threshold: number;
  readonly direction: 'deviateAtOrAbove' | 'basicAtOrAbove';
  readonly atOrAbove: DeviationAction;
  readonly below: DeviationAction;
  readonly instruction: string;
  readonly postSplit: string;
  readonly published: {
    readonly schlesinger: string;
    readonly bjaS17: string;
    readonly bjaH17: string;
    readonly bjaRuleSpecific: number | null;
  };
  readonly difference: { readonly schlesinger: number | null; readonly bja: number | null };
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

export function playingDeviations(preset: BlackjackPreset): readonly PlayingDeviation[] {
  const { dealerRule, lateSurrender } = PRESET_RULES[preset];
  const all = deviationTables().get(dealerRule) ?? [];
  return lateSurrender ? all : all.filter((deviation) => deviation.set !== 'fab4');
}

export function deviationAction(deviation: PlayingDeviation, trueCount: number): DeviationAction {
  return trueCount >= deviation.threshold ? deviation.atOrAbove : deviation.below;
}

export interface BlackjackHouseEdge {
  readonly percent: string;
  readonly reference: string;
}

// Spec 1 Amendment 1 §B, Amendment 9 §1
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

export function continuation(rule: DealerRule, kind: 'hard' | 'soft', total: number, up: CardValue): ContinuationCell {
  const cell = continuationTables().get(rule)?.get(cellKey(kind, total, up));
  if (cell === undefined) throw new RangeError(`no ${rule} continuation cell for ${kind} ${total} vs ${up}`);
  return cell;
}

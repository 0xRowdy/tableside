// The blackjack module's strategy vocabulary. A blackjack strategy has two
// parts. Its betting instructions (the common interpreter's bets on the
// learner's box) may be empty: the initial wager is then the player's own
// choice and is not assessed. Its playing policy is pure data the module
// owns: the first-decision table with its validated legal fallbacks, the
// later-decision (continuation) table, and the playing deviations with their
// Hi-Lo true-count thresholds and published comparisons. Built-in strategies
// are this data (the certified reference, packed in the definitions package),
// so a builder-authored copy of the same data plays identically.
//
// A playing decision is assessed before it executes: the policy gives the
// preferred play for the hand, the up card and (with deviations) the integer
// true count at the decision, then replaces an unavailable or unaffordable
// play by the cell's validated fallback for that cause. Hands play in order,
// so the last affordable double or split goes to the earliest live hand that
// prescribes it. Everything here is pure.

import type { Command } from './activity';
import {
  handTotal,
  HAND_TARGET,
  INSURANCE_TARGET,
  MAX_SPLIT_HANDS,
  rulesOffer,
  countOf,
  decisionShoe,
  shoeCount,
  type BlackjackAction,
  type BlackjackCount,
  type BlackjackActivityState,
  type BlackjackRound,
  type HandTotal,
} from './blackjack';
import type { Card } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, type Money } from './money';
import { BASE_WAGER_CEILING, hasExactKeys, isRecord, isText, parseMoney } from './shape';
import type { BetRequirement, PlayAssessment, StrategyDefinition, StrategyGame, StrategyVocabulary } from './strategy';

/** Ten letters per row, one per dealer up card in the order A, 2, 3, ..., 9, 10. */
export type PlayRows = readonly string[];

/** A grid of first-decision rows: hard 4-20, soft 12-20 and pairs by card value A (1) to 10. */
export interface FirstRows {
  readonly hard: PlayRows;
  readonly soft: PlayRows;
  readonly pair: PlayRows;
}

/** A grid of later-decision rows: hard 4-21 and soft 12-21. */
export interface LaterRows {
  readonly hard: PlayRows;
  readonly soft: PlayRows;
}

/** What a deviation plays on one side of its index. "basic" is the table's play with surrender set aside. */
export type DeviationPlay = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insure' | 'decline' | 'basic';

/** A published index the taught one is compared with, and the per-bet cost of playing it here. */
export interface PublishedIndex {
  /** The published value as its source prints it ("+0", "4+", "0-"), or "" where the source has none. */
  readonly value: string;
  /** Taught index minus published index; null where the source has no comparable value. */
  readonly difference: number | null;
  /** Expected loss per original bet of the published value, per true-count bin where they differ (decimal text). */
  readonly cost: readonly { readonly trueCount: number; readonly perBet: string }[];
}

/** One playing deviation: a hand against an up card, played one way at or above its index and another below. */
export interface BlackjackDeviation {
  readonly id: string;
  readonly set: 'illustrious18' | 'fab4' | 'insurance';
  /** The situation's name, e.g. "16 vs 10" or "T,T vs 6". */
  readonly situation: string;
  readonly hand: { readonly kind: 'hard'; readonly total: number } | { readonly kind: 'pair'; readonly value: number } | { readonly kind: 'insurance' };
  /** Up-card value: 1 for an ace, 10 for any ten. */
  readonly up: number;
  /** Integer Hi-Lo true count (truncated toward zero) at which the at-or-above play applies. */
  readonly threshold: number;
  /** Which side keeps the basic play: below the index, or at and above it (negative indices). */
  readonly direction: 'deviate-at-or-above' | 'basic-at-or-above';
  readonly atOrAbove: DeviationPlay;
  readonly below: DeviationPlay;
  /** Teaching only: the published Illustrious 18 / Fab 4 (Schlesinger) and rule-specific BJA values. */
  readonly published: { readonly schlesinger: PublishedIndex; readonly bja: PublishedIndex };
}

/**
 * Who keeps the Hi-Lo count: nobody ("none", basic strategy), Tableside, which
 * shows it ("supplied", basic with deviations), or the player, from whom it
 * is hidden while play is assessed against the actual count ("player", the
 * counting modes).
 */
export type CountResponsibility = 'none' | 'supplied' | 'player';

export const COUNT_RESPONSIBILITIES: readonly CountResponsibility[] = ['none', 'supplied', 'player'];

/** The four guided blackjack modes (spec #51, Counting). */
export type BlackjackMode = 'basic' | 'basic-with-deviations' | 'counting-with-basic' | 'counting-with-deviations';

/** A blackjack strategy's playing policy. */
export interface BlackjackPlayPolicy {
  /** Who keeps the count. Deviations need someone to; Tableside supplies it only for deviations. */
  readonly count: CountResponsibility;
  /** The preferred first play on the original two cards, and on any pair: H S D P R. */
  readonly first: FirstRows;
  /** Each first-decision cell's validated fallbacks. */
  readonly fallbacks: {
    /** Double unaffordable on a split hand, or where surrender isn't available: H S. */
    readonly double: FirstRows;
    /** Double unaffordable on the original two cards at a late-surrender table: H S R. */
    readonly doubleOnOriginalLateSurrender: FirstRows;
    /** Split unavailable by rule (four hands): H S D. Pairs only. */
    readonly splitByRule: PlayRows;
    /** Split unaffordable (so is the double): H S R. Pairs only. */
    readonly splitByBalance: PlayRows;
    /** Surrender unavailable (a split hand, or the table has none): H S D P. */
    readonly surrender: FirstRows;
  };
  /** Later decisions: three or more cards, and split hands that aren't a pair: H S D. */
  readonly later: LaterRows;
  /** The later play where the double is unavailable or unaffordable: H S. */
  readonly laterWithoutDouble: LaterRows;
  /** The deviation curriculum; empty for basic strategy. */
  readonly deviations: readonly BlackjackDeviation[];
}

/** The two rule choices a blackjack playing policy depends on. */
export interface BlackjackPlayRules {
  readonly dealer: 'S17' | 'H17';
  readonly lateSurrender: boolean;
}

/** A blackjack strategy's declared table conditions. */
export interface BlackjackStrategyTable extends BlackjackPlayRules {
  readonly limits: { readonly initial: { readonly min: string; readonly max: string } };
}

/** One blackjack betting decision, as Explain prescription takes it. */
export interface BlackjackSituation {
  readonly game: 'blackjack';
  readonly rules: BlackjackStrategyTable;
  /** Funds the player can commit: the balance plus the removable initial wager. Canonical money. */
  readonly balance: string;
  /** The exposed-card running count and the cards physically left in the shoe, as the next deal sees them. */
  readonly shoe: { readonly running: number; readonly remaining: number };
}

/** A playing choice: an action, insuring (with its amount) or declining insurance. */
export type PlayChoice = Exclude<BlackjackAction, 'decline-insurance'> | 'insure' | 'decline-insurance';

/** The move the player made at a playing decision. */
export interface PlayMove {
  readonly action: PlayChoice;
  /** The insurance amount; null for every other choice. */
  readonly amount: string | null;
}


/** One playing decision, as Explain play takes it. */
export interface BlackjackPlaySituation {
  readonly game: 'blackjack';
  readonly rules: BlackjackPlayRules;
  /** The insurance (or even-money) offer, or the hand's own play. */
  readonly decision: 'insurance' | 'hand';
  /** The hand deciding (the first hand for insurance). */
  readonly cards: readonly Card[];
  /** Hands the learner holds; more than one after a split. */
  readonly hands: number;
  readonly up: Card;
  /** Funds not on the table. Canonical money. */
  readonly balance: string;
  /** The hand's stake (the initial wager for insurance). Canonical money. */
  readonly stake: string;
  /** The exposed-card running count and the cards physically left in the shoe. */
  readonly shoe: { readonly running: number; readonly remaining: number };
}

/** Why a preferred play can't be made here. */
export type UnavailableReason = 'rule' | 'balance';

/** Structured explanation facts for one playing decision; the app renders them as prose. */
export interface PlayExplanation {
  readonly kind: 'play';
  readonly situation: {
    readonly decision: 'insurance' | 'hand';
    /** The hand's target and its place in play order. */
    readonly target: string;
    readonly hand: number;
    readonly hands: number;
    readonly cards: readonly Card[];
    readonly total: HandTotal;
    readonly pair: boolean;
    /** True on the original two cards before any split. */
    readonly original: boolean;
    readonly up: Card;
    readonly available: string;
    readonly stake: string;
    /** Null when the policy has no deviations (the count doesn't matter). */
    readonly count: BlackjackCount | null;
  };
  /** The table cell that applies; null for insurance. */
  readonly cell: { readonly table: 'first' | 'later'; readonly kind: 'hard' | 'soft' | 'pair'; readonly hand: number; readonly up: number; readonly play: PlayChoice } | null;
  /** The deviation that decided the play at this count, if one applies. */
  readonly deviation: (BlackjackDeviation & { readonly side: 'at-or-above' | 'below'; readonly play: DeviationPlay }) | null;
  /** The play with every option available. */
  readonly preferred: PlayChoice;
  /** Each preferred play that is unavailable here, and why, in the order the fallbacks replaced them. */
  readonly unavailable: readonly { readonly play: PlayChoice; readonly reason: UnavailableReason }[];
  /** The play the strategy prescribes. */
  readonly prescribed: PlayMove;
  /** What replaces the prescribed play if it can't be funded ("if you can't double: hit"). */
  readonly ifUnaffordable: { readonly play: PlayChoice; readonly fallback: PlayChoice } | null;
}

// ---- shape ------------------------------------------------------------------

const UP_ORDER = 10;
const ROWS = { firstHard: 17, firstSoft: 9, pairs: 10, laterHard: 18, laterSoft: 10 } as const;
const LETTER: Readonly<Record<string, PlayChoice>> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
const DEVIATION_PLAYS: readonly DeviationPlay[] = ['hit', 'stand', 'double', 'split', 'surrender', 'insure', 'decline', 'basic'];
/** True counts this vocabulary can express as an index. */
const MAX_INDEX = 20;

type Problem = { readonly path: string; readonly message: string; readonly category?: 'incomplete' | 'conflict' | 'incompatible' };

function rowsProblems(value: unknown, count: number, letters: string, path: string): Problem[] {
  if (!Array.isArray(value) || value.length !== count) return [{ path, message: `${count} rows are required` }];
  const problems: Problem[] = [];
  value.forEach((row, index) => {
    if (typeof row !== 'string' || row.length !== UP_ORDER || ![...row].every((c) => letters.includes(c))) {
      problems.push({ path: `${path}/${index}`, message: `a row is ${UP_ORDER} of ${letters.split('').join(' ')}, one per up card A to 10` });
    }
  });
  return problems;
}

function firstProblems(value: unknown, letters: string, pairLetters: string, path: string): Problem[] {
  if (!hasExactKeys(value, ['hard', 'soft', 'pair'])) return [{ path, message: 'hard, soft and pair rows are required' }];
  return [
    ...rowsProblems(value.hard, ROWS.firstHard, letters, `${path}/hard`),
    ...rowsProblems(value.soft, ROWS.firstSoft, letters, `${path}/soft`),
    ...rowsProblems(value.pair, ROWS.pairs, pairLetters, `${path}/pair`),
  ];
}

function laterProblems(value: unknown, letters: string, path: string): Problem[] {
  if (!hasExactKeys(value, ['hard', 'soft'])) return [{ path, message: 'hard and soft rows are required' }];
  return [...rowsProblems(value.hard, ROWS.laterHard, letters, `${path}/hard`), ...rowsProblems(value.soft, ROWS.laterSoft, letters, `${path}/soft`)];
}

const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_INDEX;

function publishedProblem(value: unknown): boolean {
  return !(
    hasExactKeys(value, ['value', 'difference', 'cost']) &&
    typeof value.value === 'string' &&
    value.value.length <= 16 &&
    (value.difference === null || isIndex(value.difference)) &&
    Array.isArray(value.cost) &&
    value.cost.length <= 8 &&
    value.cost.every((bin) => hasExactKeys(bin, ['trueCount', 'perBet']) && isIndex(bin.trueCount) && typeof bin.perBet === 'string' && /^[+-]?\d+\.\d+$/.test(bin.perBet))
  );
}

/** Which deviations may not both apply to one decision: one per play kind, hand and up card. */
const deviationKey = (d: BlackjackDeviation) => `${d.set === 'fab4' ? 'surrender' : d.set}|${JSON.stringify(d.hand)}|${d.up}`;

function deviationProblems(value: unknown, lateSurrender: boolean): Problem[] {
  if (!Array.isArray(value)) return [{ path: '/play/deviations', message: 'deviations are a list' }];
  if (value.length > 64) return [{ path: '/play/deviations', message: 'at most 64 deviations' }];
  const problems: Problem[] = [];
  const seen = new Map<string, number>();
  const ids = new Set<string>();
  value.forEach((item, index) => {
    const path = `/play/deviations/${index}`;
    const fail = (message: string) => problems.push({ path, message });
    if (!hasExactKeys(item, ['id', 'set', 'situation', 'hand', 'up', 'threshold', 'direction', 'atOrAbove', 'below', 'published'])) return fail('a deviation needs its id, set, situation, hand, up card, index, direction, plays and published values');
    if (!isText(item.id) || ids.has(item.id)) return fail('a deviation needs a distinct id');
    ids.add(item.id);
    if (!isText(item.situation)) return fail('a deviation needs a situation name');
    const hand = item.hand;
    const set = item.set;
    const handOk =
      (set === 'insurance' && hasExactKeys(hand, ['kind']) && hand.kind === 'insurance') ||
      ((set === 'illustrious18' || set === 'fab4') && hasExactKeys(hand, ['kind', 'total']) && hand.kind === 'hard' && isIndex(hand.total) && hand.total >= 4 && hand.total <= 21) ||
      (set === 'illustrious18' && hasExactKeys(hand, ['kind', 'value']) && hand.kind === 'pair' && isIndex(hand.value) && hand.value >= 1 && hand.value <= 10);
    if (!handOk) return fail('the hand must be a hard total, a pair or insurance, matching the set');
    if (!isIndex(item.up) || item.up < 1 || item.up > 10 || (set === 'insurance' && item.up !== 1)) return fail('the up card is a value from 1 (ace) to 10; insurance is against an ace');
    if (!isIndex(item.threshold)) return fail(`the index is a whole true count from -${MAX_INDEX} to ${MAX_INDEX}`);
    if (item.direction !== 'deviate-at-or-above' && item.direction !== 'basic-at-or-above') return fail('unknown direction');
    const plays = [item.atOrAbove, item.below];
    if (!plays.every((play) => DEVIATION_PLAYS.includes(play as DeviationPlay))) return fail('unknown play');
    const allowed: readonly DeviationPlay[] =
      set === 'insurance' ? ['insure', 'decline'] : set === 'fab4' ? ['surrender', 'basic'] : (hand as { kind: string }).kind === 'pair' ? ['split', 'stand', 'hit', 'double'] : ['hit', 'stand', 'double'];
    if (!plays.every((play) => allowed.includes(play as DeviationPlay))) return fail(`a ${String(set)} deviation plays ${allowed.join(' or ')}`);
    if (!isRecord(item.published) || !hasExactKeys(item.published, ['schlesinger', 'bja']) || publishedProblem(item.published.schlesinger) || publishedProblem(item.published.bja)) {
      return fail('published values need their value, difference and per-bet costs');
    }
    if (set === 'fab4' && !lateSurrender) problems.push({ path, message: 'Fab 4 surrender plays need late surrender', category: 'incompatible' });
    const key = deviationKey(item as unknown as BlackjackDeviation);
    const other = seen.get(key);
    if (other !== undefined) problems.push({ path, message: `deviations ${other} and ${index} decide the same play`, category: 'conflict' });
    else seen.set(key, index);
  });
  return problems;
}

/** Problems with a playing policy under its declared table; incompatible where it needs late surrender the table doesn't declare. */
function playProblems(play: unknown, table: unknown): Problem[] {
  if (!hasExactKeys(play, ['count', 'first', 'fallbacks', 'later', 'laterWithoutDouble', 'deviations'])) {
    return [{ path: '/play', message: 'a playing policy has count, first, fallbacks, later, laterWithoutDouble and deviations' }];
  }
  const lateSurrender = isRecord(table) && table.lateSurrender === true;
  const surrenderLetter = lateSurrender ? 'R' : '';
  const problems: Problem[] = [];
  const deviating = Array.isArray(play.deviations) && play.deviations.length > 0;
  if (!COUNT_RESPONSIBILITIES.includes(play.count as CountResponsibility)) problems.push({ path: '/play/count', message: 'the count is kept by none, supplied by Tableside, or kept by the player' });
  else if (play.count === 'none' && deviating) problems.push({ path: '/play/count', message: 'deviations need the count: Tableside supplies it, or the player keeps it' });
  else if (play.count === 'supplied' && !deviating) problems.push({ path: '/play/count', message: 'Tableside supplies the count only for deviations' });
  problems.push(...firstProblems(play.first, `HSD${surrenderLetter}`, `HSDP${surrenderLetter}`, '/play/first'));
  const fallbacks = play.fallbacks;
  if (!hasExactKeys(fallbacks, ['double', 'doubleOnOriginalLateSurrender', 'splitByRule', 'splitByBalance', 'surrender'])) {
    problems.push({ path: '/play/fallbacks', message: 'fallbacks for double, double on the original late-surrender hand, split by rule and by balance, and surrender are required' });
  } else {
    problems.push(
      ...firstProblems(fallbacks.double, 'HS', 'HS', '/play/fallbacks/double'),
      ...firstProblems(fallbacks.doubleOnOriginalLateSurrender, `HS${surrenderLetter}`, `HS${surrenderLetter}`, '/play/fallbacks/doubleOnOriginalLateSurrender'),
      ...rowsProblems(fallbacks.splitByRule, ROWS.pairs, 'HSD', '/play/fallbacks/splitByRule'),
      ...rowsProblems(fallbacks.splitByBalance, ROWS.pairs, `HS${surrenderLetter}`, '/play/fallbacks/splitByBalance'),
      ...firstProblems(fallbacks.surrender, 'HSDP', 'HSDP', '/play/fallbacks/surrender'),
    );
  }
  problems.push(...laterProblems(play.later, 'HSD', '/play/later'), ...laterProblems(play.laterWithoutDouble, 'HS', '/play/laterWithoutDouble'));
  problems.push(...deviationProblems(play.deviations, lateSurrender));
  // A surrender letter at a table without late surrender is caught by the letter sets; name it as incompatible too.
  if (!lateSurrender && isRecord(table)) {
    const text = JSON.stringify([play.first, isRecord(fallbacks) ? fallbacks.doubleOnOriginalLateSurrender : null, isRecord(fallbacks) ? fallbacks.splitByBalance : null]);
    if (text.includes('R')) problems.push({ path: '/play', message: 'the policy surrenders, but the declared table has no late surrender', category: 'incompatible' });
  }
  return problems;
}

// ---- table conditions -------------------------------------------------------

const whole = (value: unknown) => {
  const amount = parseMoney(value);
  return amount !== undefined && amount.d === 1n && amount.n >= 1n && amount.n <= BASE_WAGER_CEILING ? amount : undefined;
};

function tableProblems(table: unknown): { path: string; message: string }[] {
  if (!hasExactKeys(table, ['dealer', 'lateSurrender', 'limits'])) return [{ path: '', message: 'declare the dealer rule, late surrender and initial-wager limits the strategy is written for' }];
  const problems: { path: string; message: string }[] = [];
  if (table.dealer !== 'S17' && table.dealer !== 'H17') problems.push({ path: '/dealer', message: 'the dealer rule is S17 or H17' });
  if (typeof table.lateSurrender !== 'boolean') problems.push({ path: '/lateSurrender', message: 'late surrender is true or false' });
  const initial = hasExactKeys(table.limits, ['initial']) ? table.limits.initial : undefined;
  const min = hasExactKeys(initial, ['min', 'max']) ? whole(initial.min) : undefined;
  const max = hasExactKeys(initial, ['min', 'max']) ? whole(initial.max) : undefined;
  if (!min || !max || compare(min, max) > 0) problems.push({ path: '/limits', message: `initial-wager limits are whole units from 1 to ${BASE_WAGER_CEILING} with min <= max` });
  return problems;
}

/** True for a shoe's exposed running count and its 0 to 312 cards left. */
const isShoe = (shoe: unknown) =>
  hasExactKeys(shoe, ['running', 'remaining']) &&
  Number.isSafeInteger(shoe.running) &&
  Number.isSafeInteger(shoe.remaining) &&
  (shoe.remaining as number) >= 0 &&
  (shoe.remaining as number) <= 312 &&
  Math.abs(shoe.running as number) <= 312;

function situationProblem(situation: unknown): string | undefined {
  if (!hasExactKeys(situation, ['game', 'rules', 'balance', 'shoe'])) return 'a blackjack situation has game, rules, balance and shoe';
  if (situation.game !== 'blackjack') return 'not a blackjack situation';
  if (tableProblems(situation.rules).length > 0) return 'the rules contradict the table';
  const balance = parseMoney(situation.balance);
  if (!balance || balance.n < 0n) return 'the balance must be canonical money, not negative';
  if (!isShoe(situation.shoe)) return 'the shoe has a whole running count and 0 to 312 cards left';
  return undefined;
}

export const BLACKJACK_VOCABULARY: StrategyVocabulary<BlackjackSituation> = {
  game: 'blackjack',
  subjects: {},
  // The integer Hi-Lo true count the next deal sees: what a bet schedule reads.
  values: ['true-count'],
  value: (situation) => money(BigInt(countOf(situation.shoe).trueCount)),
  tableProblems,
  betRequirement(table, target, amount) {
    const { min, max } = (table as BlackjackStrategyTable).limits.initial;
    if (target !== HAND_TARGET) return { requirement: 'not-on-layout' as BetRequirement };
    if (amount.d !== 1n) return { requirement: 'not-whole-units' };
    if (compare(amount, decodeMoney(min)) < 0) return { requirement: 'below-minimum', limit: min };
    if (compare(amount, decodeMoney(max)) > 0) return { requirement: 'above-maximum', limit: max };
    return undefined;
  },
  tableMismatch(declared, actual) {
    const declaredTable = declared as BlackjackStrategyTable;
    const actualTable = actual as BlackjackStrategyTable;
    return [
      ...(declaredTable.dealer === actualTable.dealer ? [] : [{ path: '/table/dealer', requirement: 'dealer' }]),
      ...(declaredTable.lateSurrender === actualTable.lateSurrender ? [] : [{ path: '/table/lateSurrender', requirement: 'late-surrender' }]),
    ];
  },
  situationProblem,
  tableOf: (situation) => situation.rules,
  available: (situation) => decodeMoney(situation.balance),
  subject: () => 'none',
  playProblems,
};

// ---- the playing decision ---------------------------------------------------

const cardValue = (card: Card) => (card.rank >= 10 ? 10 : card.rank);
/** Columns run A, 2..9, then any ten: an up-card value's column is one less. */
const letterAt = (rows: PlayRows, row: number, up: number) => LETTER[(rows[row] as string)[up - 1] as string] as PlayChoice;

/** A first-decision grid's cell. */
function firstCell(rows: FirstRows, kind: 'hard' | 'soft' | 'pair', hand: number, up: number): PlayChoice {
  const row = kind === 'pair' ? hand - 1 : kind === 'soft' ? hand - 12 : hand - 4;
  return letterAt(rows[kind], row, up);
}

const laterCell = (rows: LaterRows, kind: 'hard' | 'soft', total: number, up: number): PlayChoice =>
  letterAt(rows[kind], kind === 'soft' ? total - 12 : total - 4, up);

const atCount = (deviation: BlackjackDeviation, count: number) =>
  count >= deviation.threshold ? { side: 'at-or-above' as const, play: deviation.atOrAbove } : { side: 'below' as const, play: deviation.below };

/**
 * The play the policy prescribes for one decision, with its explanation facts.
 * The situation must already be valid. Pure; draws nothing.
 */
export function prescribePlay(policy: BlackjackPlayPolicy, situation: BlackjackPlaySituation, target = HAND_TARGET, hand = 0): PlayExplanation {
  const { cards, hands, rules } = situation;
  const up = cardValue(situation.up);
  const balance = decodeMoney(situation.balance);
  const stake = decodeMoney(situation.stake);
  const count = policy.deviations.length > 0 ? countOf(situation.shoe) : null;
  const total = handTotal(cards);
  const two = cards.length === 2;
  const pair = two && cardValue(cards[0] as Card) === cardValue(cards[1] as Card);
  const original = two && hands === 1;
  const facts = {
    decision: situation.decision,
    target,
    hand,
    hands,
    cards: cards.map((card) => ({ ...card })),
    total,
    pair,
    original,
    up: { ...situation.up },
    available: situation.balance,
    stake: situation.stake,
    count,
  };

  if (situation.decision === 'insurance') {
    const max = mul(stake, money(1n, 2n));
    const row = count ? policy.deviations.find((d) => d.set === 'insurance' && d.up === up) : undefined;
    const decided = row && count ? atCount(row, count.trueCount) : null;
    const preferred: PlayChoice = decided?.play === 'insure' ? 'insure' : 'decline-insurance';
    const affordable = compare(balance, max) >= 0;
    const insure = preferred === 'insure' && affordable;
    return {
      kind: 'play',
      situation: facts,
      cell: null,
      deviation: row && decided ? { ...row, ...decided } : null,
      preferred,
      unavailable: preferred === 'insure' && !affordable ? [{ play: 'insure', reason: 'balance' }] : [],
      prescribed: insure ? { action: 'insure', amount: encodeMoney(max) } : { action: 'decline-insurance', amount: null },
      ifUnaffordable: insure ? { play: 'insure', fallback: 'decline-insurance' } : null,
    };
  }

  // The table cell: the first-decision table for the original two cards and any pair, else the later table.
  const kind: 'hard' | 'soft' | 'pair' = pair ? 'pair' : total.soft ? 'soft' : 'hard';
  const fromFirst = pair || original;
  const cellHand = pair ? cardValue(cards[0] as Card) : total.value;
  const cellPlay = fromFirst ? firstCell(policy.first, kind, cellHand, up) : laterCell(policy.later, kind as 'hard' | 'soft', total.value, up);
  const cell = { table: fromFirst ? ('first' as const) : ('later' as const), kind, hand: cellHand, up, play: cellPlay };
  const offered = rulesOffer(cards, hands, rules.lateSurrender);
  const surrenderFallback = () => (fromFirst ? firstCell(policy.fallbacks.surrender, kind, cellHand, up) : 'hit');

  // Why a play can't be made here; `short` judges it as if the balance couldn't fund another stake.
  const why = (play: PlayChoice, short = false): UnavailableReason | null => {
    const unfunded = short || compare(balance, stake) < 0;
    switch (play) {
      case 'double':
        return !two ? 'rule' : unfunded ? 'balance' : null;
      case 'split':
        return !pair || hands >= MAX_SPLIT_HANDS ? 'rule' : unfunded ? 'balance' : null;
      case 'surrender':
        return offered.includes('surrender') ? null : 'rule';
      default:
        return null;
    }
  };
  const fallback = (play: PlayChoice, reason: UnavailableReason): PlayChoice => {
    switch (play) {
      case 'double':
        if (!fromFirst || !two) return laterCell(policy.laterWithoutDouble, kind === 'soft' ? 'soft' : 'hard', total.value, up);
        return firstCell(original && rules.lateSurrender && reason === 'balance' ? policy.fallbacks.doubleOnOriginalLateSurrender : policy.fallbacks.double, kind, cellHand, up);
      case 'split':
        return letterAt(reason === 'rule' ? policy.fallbacks.splitByRule : policy.fallbacks.splitByBalance, cellHand - 1, up);
      default:
        return surrenderFallback();
    }
  };
  /** The first available play from `start`, replacing each unavailable one by the cell's fallback for that cause (recorded in `ruledOut`). */
  const resolve = (start: PlayChoice, ruledOut: { play: PlayChoice; reason: UnavailableReason }[], short = false): PlayChoice => {
    let play = start;
    for (let reason = why(play, short); reason !== null; reason = why(play, short)) {
      ruledOut.push({ play, reason });
      let next = fallback(play, reason);
      // A fallback that leads back to a play already ruled out (a split hand's surrender fallback is split): split by rule, else hit.
      if (ruledOut.some((u) => u.play === next)) next = pair && !ruledOut.some((u) => u.play === 'split' && u.reason === 'rule') ? letterAt(policy.fallbacks.splitByRule, cellHand - 1, up) : 'hit';
      if (ruledOut.some((u) => u.play === next)) next = 'hit';
      play = next;
    }
    return play;
  };

  let preferred = cellPlay;
  let deviation: PlayExplanation['deviation'] = null;
  const decide = (row: BlackjackDeviation | undefined): DeviationPlay | null => {
    if (!row || !count) return null;
    const decided = atCount(row, count.trueCount);
    deviation = { ...row, ...decided };
    return decided.play;
  };
  /** A hard total's indices from a starting play: Fab 4 first, where surrender is offered, then the Illustrious 18. */
  const hardIndex = (from: PlayChoice): PlayChoice => {
    let play = from;
    const hard = (set: BlackjackDeviation['set']) => policy.deviations.find((d) => d.set === set && d.hand.kind === 'hard' && d.hand.total === total.value && d.up === up);
    if (offered.includes('surrender')) {
      const decided = decide(hard('fab4'));
      if (decided === 'surrender') play = 'surrender';
      else if (decided === 'basic' && play === 'surrender') play = surrenderFallback();
    }
    if (play !== 'surrender' || !offered.includes('surrender')) {
      const row = hard('illustrious18');
      // Doubling indices apply only where a double is possible: two cards.
      const decided = row && (two || (row.atOrAbove !== 'double' && row.below !== 'double')) ? decide(row) : null;
      if (decided) play = decided as PlayChoice;
    }
    return play;
  };

  const unavailable: { play: PlayChoice; reason: UnavailableReason }[] = [];
  let start: PlayChoice = preferred;
  if (count) {
    if (pair && (cellPlay === 'split' || cellHand === 10)) {
      // The pair decision takes precedence; T,T has its own index, applied at each (re)split decision.
      const decided = decide(policy.deviations.find((d) => d.hand.kind === 'pair' && d.hand.value === cellHand && d.up === up));
      if (decided) preferred = start = decided as PlayChoice;
      // A pair that can't split here (four hands, or no funds) plays its split fallback as a hard total, with that total's index.
      const reason = preferred === 'split' && cellHand !== 1 ? why('split') : null;
      if (reason) {
        unavailable.push({ play: 'split', reason });
        start = hardIndex(fallback('split', reason));
      }
    } else if (!total.soft) {
      // A hard total, or a pair the table plays as one (5,5; 7,7 against a ten).
      preferred = start = hardIndex(preferred);
    }
  }
  const play = resolve(start, unavailable);
  // What replaces a prescribed double or split if it couldn't be funded: the same fallbacks, judged short.
  const unaffordable = play === 'double' || play === 'split' ? resolve(fallback(play, 'balance'), [{ play, reason: 'balance' }], true) : null;
  return {
    kind: 'play',
    situation: facts,
    cell,
    deviation,
    preferred,
    unavailable,
    prescribed: { action: play, amount: null },
    ifUnaffordable: unaffordable ? { play, fallback: unaffordable } : null,
  };
}

// ---- the situation of a state ----------------------------------------------

/** The playing decision the state waits on, or undefined when no learner hand awaits one. */
export function playSituation(state: BlackjackActivityState): { situation: BlackjackPlaySituation; target: string; hand: number } | undefined {
  const round = state.outcome as BlackjackRound | null;
  if (round === null || round.active === null || (state.phase !== 'open-decision' && state.phase !== 'correction')) return undefined;
  const index = round.active;
  const hand = round.hands[index];
  if (!hand) return undefined;
  const wager = state.wagers.find((w) => w.target === hand.target) ?? state.wagers[0];
  return {
    situation: {
      game: 'blackjack',
      rules: { dealer: state.rules.dealer, lateSurrender: state.rules.lateSurrender },
      decision: round.insurance === 'offered' ? 'insurance' : 'hand',
      cards: hand.cards,
      hands: round.hands.length,
      up: round.dealer[0] as Card,
      balance: state.balance,
      stake: wager ? wager.amount : '0',
      shoe: shoeCount(state),
    },
    target: hand.target,
    hand: index,
  };
}

/** The move a command makes at a playing decision, or undefined when it is not one. */
function moveOf(state: BlackjackActivityState, command: unknown): PlayMove | undefined {
  if (!isRecord(command)) return undefined;
  const offer = state.outcome?.insurance === 'offered';
  if (command.kind === 'play') {
    const action = command.action as BlackjackAction;
    if (offer !== (action === 'decline-insurance')) return undefined;
    return { action, amount: null };
  }
  if (command.kind === 'place-wager' && offer && command.target === INSURANCE_TARGET) return { action: 'insure', amount: command.amount as string };
  return undefined;
}

/** The command that makes a move. */
export const moveCommand = (move: PlayMove): Command =>
  move.action === 'insure'
    ? { kind: 'place-wager', target: INSURANCE_TARGET, amount: move.amount as string }
    : { kind: 'play', action: move.action };

const sameMove = (a: PlayMove, b: PlayMove) =>
  a.action === b.action && (a.amount === b.amount || (a.amount !== null && b.amount !== null && compare(decodeMoney(a.amount), decodeMoney(b.amount)) === 0));

/** The playing policy a valid blackjack definition pins. */
export const policyOf = (definition: StrategyDefinition) => definition.play as BlackjackPlayPolicy | undefined;

/** The mode a playing policy plays: who keeps the count, and whether it deviates. */
export function blackjackModeOf(policy: BlackjackPlayPolicy): BlackjackMode {
  const deviating = policy.deviations.length > 0;
  if (policy.count === 'player') return deviating ? 'counting-with-deviations' : 'counting-with-basic';
  return deviating ? 'basic-with-deviations' : 'basic';
}

/** A playing move assessed against the pinned policy: the explanation, whether it follows, and the prescribed command. */
export function assessPlay(state: BlackjackActivityState, definition: StrategyDefinition, command: unknown): PlayAssessment<PlayExplanation, PlayMove, Command> | undefined {
  const policy = policyOf(definition);
  const decision = policy && playSituation(state);
  const actual = decision && moveOf(state, command);
  if (!policy || !decision || !actual) return undefined;
  const explanation = prescribePlay(policy, decision.situation, decision.target, decision.hand);
  return { explanation, actual, follows: sameMove(actual, explanation.prescribed), prescribed: moveCommand(explanation.prescribed) };
}

/** Blackjack's part of guided practice: its vocabulary, its table conditions, its betting situation and its playing decisions. */
export const BLACKJACK_STRATEGY: StrategyGame<BlackjackActivityState> = {
  vocabulary: BLACKJACK_VOCABULARY as StrategyVocabulary,
  tableForRules: (rules) => {
    const { dealer, lateSurrender, limits } = rules as BlackjackStrategyTable;
    return { dealer, lateSurrender, limits: { initial: { min: limits.initial.min, max: limits.initial.max } } };
  },
  // Between rounds the initial wager is still removable, so all of it is available.
  situation: (state): BlackjackSituation => ({
    game: 'blackjack',
    rules: { dealer: state.rules.dealer, lateSurrender: state.rules.lateSurrender, limits: { initial: { ...state.rules.limits.initial } } },
    balance: encodeMoney(state.wagers.reduce((sum: Money, wager) => add(sum, decodeMoney(wager.amount)), decodeMoney(state.balance))),
    shoe: decisionShoe(state),
  }),
  // A schedule's next bet would tell the player the count it reads, so it stays hidden unless Tableside shows the count.
  hidesPending: (state) => {
    const definition = state.strategy?.definition;
    return definition !== undefined && policyOf(definition)?.count !== 'supplied' && JSON.stringify(definition.instructions).includes('"value":"true-count"');
  },
  assessPlay,
  // "19 v 20": the learner's hand totals against the dealer's.
  outcome: (state) => {
    const round = state.outcome;
    if (!round) return 'none';
    return `${round.hands.map((hand) => handTotal(hand.cards).value).join(', ')} v ${handTotal(round.dealer).value}`;
  },
};

// ---- Explain play -----------------------------------------------------------

const isCardLike = (value: unknown): value is Card =>
  hasExactKeys(value, ['deck', 'suit', 'rank']) && typeof value.rank === 'number' && Number.isInteger(value.rank) && value.rank >= 1 && value.rank <= 13;

/** Why a playing situation can't be represented or contradicts the rules, if it can't. */
export function playSituationProblem(situation: unknown): string | undefined {
  if (!hasExactKeys(situation, ['game', 'rules', 'decision', 'cards', 'hands', 'up', 'balance', 'stake', 'shoe'])) return 'a playing situation has game, rules, decision, cards, hands, up, balance, stake and shoe';
  if (situation.game !== 'blackjack') return 'not a blackjack situation';
  const rules = situation.rules;
  if (!hasExactKeys(rules, ['dealer', 'lateSurrender']) || (rules.dealer !== 'S17' && rules.dealer !== 'H17') || typeof rules.lateSurrender !== 'boolean') return 'unknown rules';
  const cards = situation.cards;
  if (!Array.isArray(cards) || cards.length < 2 || cards.length > 21 || !cards.every(isCardLike)) return 'a decision is on a hand of two or more cards';
  const total = handTotal(cards as Card[]);
  if (total.value > 21 || (total.value === 21 && situation.decision !== 'insurance')) return 'a hand of 21 or more takes no decision';
  const hands = situation.hands;
  if (typeof hands !== 'number' || !Number.isInteger(hands) || hands < 1 || hands > MAX_SPLIT_HANDS) return `hands are 1 to ${MAX_SPLIT_HANDS}`;
  if (!isCardLike(situation.up)) return 'the up card is a card';
  if (situation.decision !== 'insurance' && situation.decision !== 'hand') return 'the decision is insurance or the hand';
  if (situation.decision === 'insurance' && (situation.up.rank !== 1 || hands !== 1 || cards.length !== 2)) return 'insurance is offered only on the first two cards against an ace';
  if (hands > 1 && (cards as Card[])[0]?.rank === 1) return 'split aces take no decision';
  const balance = parseMoney(situation.balance);
  const stake = parseMoney(situation.stake);
  if (!balance || balance.n < 0n || !stake || stake.n <= 0n) return 'the balance and stake must be canonical money';
  if (!isShoe(situation.shoe)) return 'the shoe has a whole running count and 0 to 312 cards left';
  return undefined;
}

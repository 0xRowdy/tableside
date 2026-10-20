// The game-agnostic side of the bet selector: what a game module hands it (a
// wager catalog and the wagers on the table) and the unsubmitted draft it
// keeps. Each game builds its catalog from the engine's permitted view; the
// selector itself knows nothing about roulette, craps or blackjack.

import { decodeMoney, encodeMoney, money } from '@tableside/engine';

import { formatUnits } from '../units';

/** One placeable wager: a target with its terms, as the permitted view gives them. */
export interface WagerChoice {
  /** The engine's target id. */
  readonly target: string;
  /** Short label in a chooser: "17", "Red". */
  readonly label: string;
  /** Full name, spoken and shown everywhere else: "Straight 17", "Red". */
  readonly name: string;
  /** Canonical whole-unit amounts. */
  readonly min: string;
  readonly max: string;
  /** Stakes are multiples of this many units. */
  readonly step: string;
  /** "35:1". */
  readonly payout: string;
}

/** A kind of wager (straight up, place bet), with the choices it covers. */
export interface WagerKind {
  readonly id: string;
  readonly name: string;
  /** One line under the name: "1 number · pays 35:1". */
  readonly detail: string;
  /** What choosing among its choices means: "Number", "Color". */
  readonly choiceLabel: string;
  readonly choices: readonly WagerChoice[];
}

export interface WagerSection {
  /** "Inside bets · 1 to 100". */
  readonly title: string;
  readonly kinds: readonly WagerKind[];
}

export interface WagerCatalog {
  readonly sections: readonly WagerSection[];
}

/** A wager on the table as the selector shows it. */
export interface PlacedWager {
  readonly target: string;
  readonly amount: string;
  /** Committed wagers can't be changed or taken down until they settle. */
  readonly committed: boolean;
  /** Why it is committed, in the game's own words. */
  readonly committedReason?: string;
}

/**
 * The unsubmitted draft: the chosen kind and target and the typed total stake.
 * `submittedAt` is the view sequence a submission was sent at, so feedback is
 * shown only for that submission and cleared when the draft changes.
 */
export interface BetDraft {
  readonly kind: string | null;
  readonly target: string | null;
  readonly text: string;
  readonly submittedAt: number | null;
}

export const EMPTY_DRAFT: BetDraft = { kind: null, target: null, text: '', submittedAt: null };

export function findKind(catalog: WagerCatalog, id: string | null): WagerKind | undefined {
  for (const section of catalog.sections) for (const kind of section.kinds) if (kind.id === id) return kind;
  return undefined;
}

export function findChoice(catalog: WagerCatalog, target: string | null): { kind: WagerKind; choice: WagerChoice } | undefined {
  for (const section of catalog.sections) {
    for (const kind of section.kinds) {
      const choice = kind.choices.find((c) => c.target === target);
      if (choice) return { kind, choice };
    }
  }
  return undefined;
}

/** Longest stake text the editor accepts; anything longer can't be a sensible stake. */
const MAX_STAKE_DIGITS = 40;
const STAKE = /^(\d+)(?:\.(\d+))?$/;

/**
 * The typed stake as canonical money text, or null when it isn't a plain
 * decimal number. Thousands separators and spaces are ignored. Legality
 * (increments, limits, funds) is the engine's to judge, not this function's.
 */
export function parseStake(text: string): string | null {
  const match = STAKE.exec(text.replace(/[,\s]/g, ''));
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  if (whole.length + fraction.length > MAX_STAKE_DIGITS) return null;
  return encodeMoney(money(BigInt(whole + fraction), 10n ** BigInt(fraction.length)));
}

/** The typed stake for display: grouped when it is whole units, as typed otherwise. */
export function draftAmountText(text: string): string {
  const amount = parseStake(text);
  return amount !== null && decodeMoney(amount).d === 1n ? formatUnits(amount) : text;
}

/** True when the draft holds a stake that differs from what is on its target. */
export function isDraftPending(draft: BetDraft, wagers: readonly PlacedWager[]): boolean {
  if (draft.target === null || draft.text === '') return false;
  const onTarget = wagers.find((w) => w.target === draft.target)?.amount ?? null;
  return parseStake(draft.text) !== onTarget;
}

/** Steps the typed stake by one increment, never below zero; a stake that isn't a number starts from zero. */
export function stepStake(text: string, step: string, direction: 1 | -1): string {
  const current = parseStake(text);
  const whole = current !== null && decodeMoney(current).d === 1n ? BigInt(current) : 0n;
  const next = whole + BigInt(step) * BigInt(direction);
  return (next < 0n ? 0n : next).toString();
}

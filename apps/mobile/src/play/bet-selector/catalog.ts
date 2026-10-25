// The game-agnostic side of the bet selector: what a game module hands it (a
// wager catalog and the wagers on the table) and the unsubmitted draft it
// keeps. Each game builds its catalog from the engine's permitted view; the
// selector itself knows nothing about roulette, craps or blackjack.

import { decodeMoney } from '@tableside/engine';

import { decimalUnits, differenceUnits, formatUnits, lessUnits, sumUnits } from '../units';

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
  /** An on/off option set with the stake, in the game's words. */
  readonly toggle?: WagerToggle;
}

export interface WagerToggle {
  readonly title: string;
  readonly detail: string;
  /** Its value when the player hasn't changed it. */
  readonly usual: boolean;
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

/** One key of a finder ("17") and the targets it finds, in catalog order. */
export interface FinderKey {
  readonly id: string;
  readonly label: string;
  /** Heading of its results: "Wagers on 17". */
  readonly title: string;
  readonly targets: readonly string[];
}

/** Another way into the catalog: pick a key, see every wager it covers ("Find by number"). */
export interface WagerFinder {
  readonly name: string;
  readonly detail: string;
  /** What choosing a key means: "Number". */
  readonly keyLabel: string;
  readonly keys: readonly FinderKey[];
}

export interface WagerCatalog {
  readonly sections: readonly WagerSection[];
  readonly finder?: WagerFinder;
}

/** A wager on the table as the selector shows it. */
export interface PlacedWager {
  readonly target: string;
  readonly amount: string;
  /** Its name when the catalog no longer offers it (a craps contract on its number). */
  readonly name?: string;
  /** Committed wagers can't be changed or taken down until they settle. */
  readonly committed: boolean;
  /** Why it is committed, in the game's own words. */
  readonly committedReason?: string;
  /** The current value of its choice's toggle, when it has one. */
  readonly toggled?: boolean;
  /** A short state shown and spoken with it, in the game's words ("Working"). */
  readonly status?: string;
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
  /** The toggle as the player set it in this draft; absent while untouched. */
  readonly toggled?: boolean;
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
  return decimalUnits(whole, fraction);
}

/** The typed stake for display: grouped when it is whole units, as typed otherwise. */
export function draftAmountText(text: string): string {
  const amount = parseStake(text);
  return amount !== null && decodeMoney(amount).d === 1n ? formatUnits(amount) : text;
}

/** True when the draft holds a stake, or a toggle setting, that differs from what is on its target. */
export function isDraftPending(draft: BetDraft, wagers: readonly PlacedWager[]): boolean {
  if (draft.target === null || draft.text === '') return false;
  const placed = wagers.find((w) => w.target === draft.target);
  if (parseStake(draft.text) !== (placed?.amount ?? null)) return true;
  return draft.toggled !== undefined && placed?.toggled !== undefined && draft.toggled !== placed.toggled;
}

/** The toggle value a draft would set: as the player set it, else what the placed wager has, else the usual value. */
export const draftToggle = (draft: BetDraft, choice: WagerChoice, wagers: readonly PlacedWager[]): boolean | undefined =>
  choice.toggle && (draft.toggled ?? wagers.find((w) => w.target === choice.target)?.toggled ?? choice.toggle.usual);

/** Steps the typed stake by one increment, never below zero; a stake that isn't a number starts from zero. */
export function stepStake(text: string, step: string, direction: 1 | -1): string {
  const current = parseStake(text);
  const whole = current !== null && decodeMoney(current).d === 1n ? current : '0';
  const next = direction === 1 ? sumUnits(whole, step) : differenceUnits(whole, step);
  return lessUnits(next, '0') ? '0' : next;
}

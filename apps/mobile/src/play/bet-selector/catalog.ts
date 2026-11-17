import { decodeMoney } from '@tableside/engine';

import { decimalUnits, differenceUnits, formatUnits, lessUnits, sumUnits } from '../units';

export interface WagerChoice {
  readonly target: string;
  readonly label: string;
  readonly name: string;
  readonly min: string;
  readonly max: string;
  readonly step: string;
  readonly payout: string;
  readonly toggle?: WagerToggle;
}

export interface WagerToggle {
  readonly title: string;
  readonly detail: string;
  readonly usual: boolean;
}

export interface WagerKind {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly choiceLabel: string;
  readonly choices: readonly WagerChoice[];
}

export interface WagerSection {
  readonly title: string;
  readonly kinds: readonly WagerKind[];
}

export interface FinderKey {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly targets: readonly string[];
}

export interface WagerFinder {
  readonly name: string;
  readonly detail: string;
  readonly keyLabel: string;
  readonly keys: readonly FinderKey[];
}

export interface WagerCatalog {
  readonly sections: readonly WagerSection[];
  readonly finder?: WagerFinder;
}

export interface PlacedWager {
  readonly target: string;
  readonly amount: string;
  readonly name?: string;
  readonly committed: boolean;
  readonly committedReason?: string;
  readonly toggled?: boolean;
  readonly status?: string;
}

export interface BetDraft {
  readonly kind: string | null;
  readonly target: string | null;
  readonly text: string;
  readonly submittedAt: number | null;
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

const MAX_STAKE_DIGITS = 40;
const STAKE = /^(\d+)(?:\.(\d+))?$/;

export function parseStake(text: string): string | null {
  const match = STAKE.exec(text.replace(/[,\s]/g, ''));
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  if (whole.length + fraction.length > MAX_STAKE_DIGITS) return null;
  return decimalUnits(whole, fraction);
}

export function draftAmountText(text: string): string {
  const amount = parseStake(text);
  return amount !== null && decodeMoney(amount).d === 1n ? formatUnits(amount) : text;
}

export function isDraftPending(draft: BetDraft, wagers: readonly PlacedWager[]): boolean {
  if (draft.target === null || draft.text === '') return false;
  const placed = wagers.find((w) => w.target === draft.target);
  if (parseStake(draft.text) !== (placed?.amount ?? null)) return true;
  return draft.toggled !== undefined && placed?.toggled !== undefined && draft.toggled !== placed.toggled;
}

export const draftToggle = (draft: BetDraft, choice: WagerChoice, wagers: readonly PlacedWager[]): boolean | undefined =>
  choice.toggle && (draft.toggled ?? wagers.find((w) => w.target === choice.target)?.toggled ?? choice.toggle.usual);

export function stepStake(text: string, step: string, direction: 1 | -1): string {
  const current = parseStake(text);
  const whole = current !== null && decodeMoney(current).d === 1n ? current : '0';
  const next = direction === 1 ? sumUnits(whole, step) : differenceUnits(whole, step);
  return lessUnits(next, '0') ? '0' : next;
}

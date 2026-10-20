// How roulette sessions read on screen and aloud. Amounts are plain units (no
// currency symbol); formatting never changes a ledger value.

import type { DomainFact, IllegalActionReason, PermittedView, Phase, PlacementKind, RoulettePocket } from '@tableside/engine';

/** Pocket colors on the layout. Presentation only: the engine owns what each placement covers. */
const RED_POCKETS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = 'red' | 'black' | 'green';

export const pocketColor = (pocket: RoulettePocket): PocketColor =>
  typeof pocket !== 'number' || pocket === 0 ? 'green' : RED_POCKETS.has(pocket) ? 'red' : 'black';

/** "27 red", "0 green". */
export const describePocket = (pocket: RoulettePocket) => `${pocket} ${pocketColor(pocket)}`;

/** Canonical money text with thousands separators: "1000" → "1,000", "-2.5" → "-2.5". */
export function formatUnits(amount: string): string {
  const negative = amount.startsWith('-');
  const [whole = '0', fraction] = (negative ? amount.slice(1) : amount).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** "+120", "−85" (minus sign), "0". */
export function formatSigned(amount: string): string {
  if (amount.startsWith('-')) return `−${formatUnits(amount.slice(1))}`;
  return amount === '0' ? '0' : `+${formatUnits(amount)}`;
}

/** "plus 120", "minus 85", "0": for screen readers, which may skip a sign. */
export function speakSigned(amount: string): string {
  if (amount.startsWith('-')) return `minus ${formatUnits(amount.slice(1))}`;
  return amount === '0' ? '0' : `plus ${formatUnits(amount)}`;
}

const ORDINAL = ['1st', '2nd', '3rd'];

/** "a, b and c". */
const listed = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

const OUTSIDE_NAMES: Readonly<Record<string, string>> = { red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1 to 18', high: '19 to 36' };

/**
 * A placement's name for the screen and for screen readers: "Red", "Straight 17",
 * "Split 16 and 17", "Corner 13, 14, 16 and 17", "Six line 1 to 6", "2nd dozen".
 * Built from the target id alone; the engine owns what each placement covers.
 */
export function targetName(target: string): string {
  const outside = OUTSIDE_NAMES[target];
  if (outside) return outside;
  const group = /^(dozen|column)-([123])$/.exec(target);
  if (group) return `${ORDINAL[Number(group[2]) - 1]} ${group[1]}`;
  const inside = /^(straight|split|street|trio|corner|first-four|six-line|basket)-(.+)$/.exec(target);
  if (!inside) return target;
  const [, kind = '', rest = ''] = inside;
  const pockets = rest.split('-');
  switch (kind) {
    case 'first-four':
      return `First four ${listed(pockets)}`;
    case 'basket':
      return `Five-number basket ${listed(pockets)}`;
    case 'six-line':
      return `Six line ${pockets[0]} to ${pockets.at(-1)}`;
    default:
      return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} ${listed(pockets)}`;
  }
}

const KIND_NAMES: Partial<Record<PlacementKind, string>> = {
  'first-four': 'First four',
  'six-line': 'Six line',
  basket: 'Five-number basket',
  low: '1 to 18',
  high: '19 to 36',
};

/** A kind's name alone: "Split", "Six line", "Five-number basket". */
export const kindName = (kind: PlacementKind): string => KIND_NAMES[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;

/** "35:1" → "35 to 1", as screen readers should say it. */
export const spokenPayout = (payout: string) => payout.replace(':', ' to ');

export const totalOnTable = (view: PermittedView): string =>
  // Roulette stakes are whole units, so a plain integer sum is exact.
  view.wagers.reduce((sum, wager) => sum + BigInt(wager.amount), 0n).toString();

export const STATUS: Record<Phase, string> = {
  'open-decision': 'Betting',
  'revealing-outcome': 'Spinning',
  'settled-outcome': 'Settled',
  'final-settlement': 'Final settlement',
  completed: 'Ended',
};

function illegalMessage(reason: IllegalActionReason, target: string | null, view: PermittedView): string {
  const placement = target ? view.table.placements.find((p) => p.target === target) : undefined;
  const name = target ? targetName(target) : 'That wager';
  switch (reason) {
    case 'below-minimum':
      return `${name} needs at least ${formatUnits(placement?.min ?? '1')}. Nothing was placed.`;
    case 'above-maximum':
      return `${name} allows at most ${formatUnits(placement?.max ?? '0')}. Nothing was placed.`;
    case 'insufficient-funds':
      return `Your balance can't cover that. Nothing was placed.`;
    case 'no-wager':
      return 'Place a wager before you spin.';
    case 'not-whole-units':
      return 'Stakes are whole units. Nothing was placed.';
    case 'no-wager-to-remove':
    case 'unknown-target':
      return `${name} can't be changed. Nothing was placed.`;
  }
}

/**
 * What the latest committed transition changed, in one message for the screen
 * and for screen readers. Built only from committed facts and the permitted view.
 */
export function describeFacts(facts: readonly DomainFact[], view: PermittedView): string | null {
  const parts: string[] = [];
  let balanceChanged = false;
  for (const fact of facts) {
    switch (fact.kind) {
      case 'wager-changed':
        parts.push(fact.amount === '0' ? `${targetName(fact.target)} taken down.` : `${targetName(fact.target)} ${formatUnits(fact.amount)} on the table.`);
        balanceChanged = true;
        break;
      case 'illegal-action':
        parts.push(illegalMessage(fact.reason, fact.command.kind === 'place-wager' ? fact.command.target : null, view));
        break;
      case 'outcome-generated':
        parts.push(`The ball landed on ${describePocket(fact.pocket)}.`);
        break;
      case 'wager-settled':
        parts.push(
          fact.result === 'win'
            ? `${targetName(fact.target)} ${formatUnits(fact.stake)} wins ${formatUnits(fact.net)}.`
            : `${targetName(fact.target)} ${formatUnits(fact.stake)} loses.`,
        );
        balanceChanged = true;
        break;
      case 'stop-requested':
        parts.push('Ending your session.');
        break;
      case 'wager-returned':
        parts.push(`${targetName(fact.target)} ${formatUnits(fact.amount)} returned to your balance.`);
        balanceChanged = true;
        break;
      case 'turn-began':
      case 'activity-completed':
        break;
    }
  }
  if (parts.length === 0) return null;
  if (balanceChanged) parts.push(`Balance ${formatUnits(view.balance)}.`);
  return parts.join(' ');
}

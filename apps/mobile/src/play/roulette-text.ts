// How roulette sessions read on screen and aloud. Amounts are plain units (no
// currency symbol); formatting never changes a ledger value.

import type { DomainFact, IllegalActionReason, PermittedView, Phase, RoulettePocket } from '@tableside/engine';

import { formatUnits } from './units';

/** Pocket colors on the layout. Presentation only: the engine owns what each placement covers. */
const RED_POCKETS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = 'red' | 'black' | 'green';

export const pocketColor = (pocket: RoulettePocket): PocketColor =>
  typeof pocket !== 'number' || pocket === 0 ? 'green' : RED_POCKETS.has(pocket) ? 'red' : 'black';

/** "27 red", "0 green". */
export const describePocket = (pocket: RoulettePocket) => `${pocket} ${pocketColor(pocket)}`;

export { formatUnits };

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

/** "Red", "Straight 17". */
export function targetName(target: string): string {
  const straight = /^straight-(\d+)$/.exec(target);
  if (straight) return `Straight ${straight[1]}`;
  return target.charAt(0).toUpperCase() + target.slice(1);
}

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

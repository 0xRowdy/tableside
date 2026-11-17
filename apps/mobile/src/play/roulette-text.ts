import {
  FUNDING_CEILING,
  type DomainFact,
  type IllegalActionReason,
  type Phase,
  type PlacementKind,
  type RoulettePermittedView as PermittedView,
  type RoulettePocket,
  type RouletteWheel,
} from '@tableside/engine';

import { strategyFactSentence } from './strategy-text';
import { formatUnits } from './units';

const RED_POCKETS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = 'red' | 'black' | 'green';

export const pocketColor = (pocket: RoulettePocket): PocketColor =>
  typeof pocket !== 'number' || pocket === 0 ? 'green' : RED_POCKETS.has(pocket) ? 'red' : 'black';

export const POCKET_TOKEN = { red: 'pocketRed', black: 'pocketBlack', green: 'pocketGreen' } as const;

export const wheelZeros = (wheel: RouletteWheel): RoulettePocket[] => (wheel === 'double-zero' ? [0, '00'] : [0]);

export const describePocket = (pocket: RoulettePocket) => `${pocket} ${pocketColor(pocket)}`;

export const lastSpinLine = (color: string) => `The last spin landed on ${color}.`;

export { formatSigned, formatUnits, speakSigned, totalOnTable } from './units';

export const ORDINAL = ['1st', '2nd', '3rd'] as const;

const listed = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

const KIND_NAMES: Partial<Record<PlacementKind, string>> = {
  'first-four': 'First four',
  'six-line': 'Six line',
  basket: 'Five-number basket',
  low: '1 to 18',
  high: '19 to 36',
};

const kindName = (kind: PlacementKind): string => KIND_NAMES[kind] ?? `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;

const OUTSIDE = /^(red|black|odd|even|low|high)$/;
const GROUP = /^(dozen|column)-([123])$/;
const INSIDE = /^(straight|split|street|trio|corner|first-four|six-line|basket)-(.+)$/;

export function targetName(target: string): string {
  if (OUTSIDE.test(target)) return kindName(target as PlacementKind);
  const group = GROUP.exec(target);
  if (group) return `${ORDINAL[Number(group[2]) - 1]} ${group[1]}`;
  const inside = INSIDE.exec(target);
  if (!inside) return target;
  const kind = inside[1] as PlacementKind;
  const pockets = (inside[2] ?? '').split('-');
  return kind === 'six-line' ? `${kindName(kind)} ${pockets[0]} to ${pockets.at(-1)}` : `${kindName(kind)} ${listed(pockets)}`;
}

export const spokenPayout = (payout: string) => payout.replace(':', ' to ');

export const STATUS: Record<Phase, string> = {
  'open-decision': 'Betting',
  'revealing-outcome': 'Spinning',
  'settled-outcome': 'Settled',
  correction: 'Strategy check',
  'cycle-completion': 'Cycle ended',
  'strategy-settlement': "Settling the strategy's contracts",
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
      return view.legalCommands.includes('rebuy')
        ? `Your balance can't cover that. Nothing was placed. You can rebuy to add chips.`
        : `Your balance can't cover that. Nothing was placed.`;
    case 'over-funding-ceiling':
      return `That rebuy would take total funding past the ${formatUnits(FUNDING_CEILING.toString())} limit. You can add up to ${formatUnits(view.funding.headroom)}. Nothing was added.`;
    case 'no-wager':
      return 'Place a wager before you spin.';
    case 'not-whole-units':
      return target ? 'Stakes are whole units. Nothing was placed.' : 'Rebuys are whole units. Nothing was added.';
    default:
      return `${name} can't be changed. Nothing was placed.`;
  }
}

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
      case 'funding-added':
        parts.push(`Rebuy ${formatUnits(fact.amount)} added. Total funding ${formatUnits(fact.cumulative)}.`);
        balanceChanged = true;
        break;
      default: {
        const sentence = strategyFactSentence(fact, 'spin');
        if (sentence) parts.push(sentence);
        break;
      }
      case 'turn-began':
      case 'activity-completed':
        break;
    }
  }
  if (parts.length === 0) return null;
  if (balanceChanged) parts.push(`Balance ${formatUnits(view.balance)}.`);
  return parts.join(' ');
}

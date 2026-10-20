// How craps sessions read on screen and aloud. Amounts are plain units (no
// currency symbol). Everything here is built from committed facts and the
// engine's permitted view: the next roll is never known until it is committed.

import { FUNDING_CEILING, type CrapsPermittedView, type DomainFact, type IllegalActionReason, type Phase } from '@tableside/engine';

import { formatUnits } from './units';

const BASE_NAMES: Record<string, string> = { pass: 'Pass line', 'dont-pass': "Don't pass", come: 'Come', 'dont-come': "Don't come" };

/** "Pass line", "Come 6", "Don't come 4 odds". */
export function crapsTargetName(target: string): string {
  const odds = target.endsWith('-odds');
  const base = odds ? target.slice(0, -'-odds'.length) : target;
  const traveled = /^(dont-come|come)-(\d+)$/.exec(base);
  const name = traveled ? `${BASE_NAMES[traveled[1] as string]} ${traveled[2]}` : (BASE_NAMES[base] ?? target);
  return odds ? `${name} odds` : name;
}

/** The puck, in words: never color alone. */
export const puckText = (point: number | null) => (point === null ? 'Puck OFF · no point yet' : `Puck ON · point ${point}`);

export function crapsStatus(view: CrapsPermittedView): string {
  const phase: Record<Phase, string> = {
    'open-decision': view.table.point === null ? 'Come-out roll' : `Point ${view.table.point} · betting`,
    'revealing-outcome': 'Rolling',
    'settled-outcome': 'Settled',
    correction: 'Strategy check',
    'cycle-completion': 'Cycle ended',
    'final-settlement': 'Final settlement',
    completed: 'Ended',
  };
  return phase[view.phase];
}

/** "ON" or "OFF" for a wager on the table. */
export function workingText(view: CrapsPermittedView, target: string): 'ON' | 'OFF' {
  return view.table.wagers.find((wager) => wager.target === target)?.working === false ? 'OFF' : 'ON';
}

/** Why a committed wager's controls can't take it down or change it. */
export function commitmentText(target: string, point: number | null): string {
  const traveled = /^come-(\d+)$/.exec(target);
  const number = traveled ? traveled[1] : point;
  const name = crapsTargetName(target);
  return `${name} is a contract now: it stays on the table until it wins on ${number} or loses on 7. You can't lower it or take it down. You can add odds behind it.`;
}

function illegalMessage(reason: IllegalActionReason, target: string | null, view: CrapsPermittedView): string {
  const name = target ? crapsTargetName(target) : 'That wager';
  const placement = target ? view.table.placements.find((p) => p.target === target) : undefined;
  const { line } = view.table.limits;
  switch (reason) {
    case 'below-minimum':
      return `${name} needs at least ${formatUnits(line.min)}. Nothing was placed.`;
    case 'above-maximum':
      return `${name} allows at most ${formatUnits(line.max)}. Nothing was placed.`;
    case 'above-odds-cap':
      return `${name} allows at most ${formatUnits(placement?.max ?? '0')} at ${view.table.odds} odds. Nothing was placed.`;
    case 'odds-increment':
      return `${name} goes in multiples of ${formatUnits(placement?.increment ?? '1')}, so it pays whole units. Nothing was placed.`;
    case 'committed-wager':
      return target?.startsWith('dont')
        ? `${name} can only come down now, not change. Nothing changed.`
        : `${name} is a contract once its number is set. It can't be lowered or taken down.`;
    case 'not-available-now':
      if (target?.endsWith('-odds')) return `${name} needs its bet established on a number first. Nothing was placed.`;
      if (target === 'pass' || target === 'dont-pass') return `${name} bets are made before a come-out roll. Nothing was placed.`;
      if (target === 'come' || target === 'dont-come') return `${name} bets open once a point is set. Nothing was placed.`;
      return `${name} can't be placed directly. Nothing was placed.`;
    case 'insufficient-funds':
      return view.legalCommands.includes('rebuy')
        ? `Your balance can't cover that. Nothing was placed. You can rebuy to add chips.`
        : `Your balance can't cover that. Nothing was placed.`;
    case 'over-funding-ceiling':
      return `That rebuy would take total funding past the ${formatUnits(FUNDING_CEILING.toString())} limit. You can add up to ${formatUnits(view.funding.headroom)}. Nothing was added.`;
    case 'no-wager':
      return 'Place a wager before you roll.';
    case 'not-whole-units':
      return target ? 'Stakes are whole units. Nothing was placed.' : 'Rebuys are whole units. Nothing was added.';
    // no-wager-to-remove, unknown-target, and reasons only other games produce.
    default:
      return `${name} can't be changed. Nothing was placed.`;
  }
}

/**
 * What the latest committed transition changed, in one message for the screen
 * and for screen readers: every wager with its working status, the roll, the
 * puck, each result and the balance.
 */
export function describeCrapsFacts(facts: readonly DomainFact[], view: CrapsPermittedView): string | null {
  const parts: string[] = [];
  let balanceChanged = false;
  for (const fact of facts) {
    switch (fact.kind) {
      case 'wager-changed':
        parts.push(
          fact.amount === '0'
            ? `${crapsTargetName(fact.target)} taken down.`
            : `${crapsTargetName(fact.target)} ${formatUnits(fact.amount)} on the table, ${workingText(view, fact.target)}.`,
        );
        balanceChanged = true;
        break;
      case 'illegal-action':
        parts.push(illegalMessage(fact.reason, fact.command.kind === 'place-wager' ? fact.command.target : null, view));
        break;
      case 'dice-rolled':
        parts.push(`Rolled ${fact.dice[0]} and ${fact.dice[1]}: ${fact.dice[0] + fact.dice[1]}.`);
        break;
      case 'point-changed':
        parts.push(fact.point === null ? 'Puck OFF. The next roll is a come-out roll.' : `The point is ${fact.point}. Puck ON.`);
        break;
      case 'wager-moved':
        parts.push(`${crapsTargetName(fact.from)} ${formatUnits(fact.amount)} moves to ${crapsTargetName(fact.to)}.`);
        break;
      case 'wager-pushed':
        parts.push(`${crapsTargetName(fact.target)} ${formatUnits(fact.stake)} pushes on 12 and stays.`);
        break;
      case 'wager-settled':
        parts.push(
          fact.result === 'win'
            ? `${crapsTargetName(fact.target)} ${formatUnits(fact.stake)} wins ${formatUnits(fact.net)}.`
            : fact.result === 'push'
              ? `${crapsTargetName(fact.target)} ${formatUnits(fact.stake)} was off and comes back.`
              : `${crapsTargetName(fact.target)} ${formatUnits(fact.stake)} loses.`,
        );
        balanceChanged = true;
        break;
      case 'stop-requested':
        parts.push('Ending your session.');
        break;
      case 'wager-returned':
        parts.push(`${crapsTargetName(fact.target)} ${formatUnits(fact.amount)} returned to your balance.`);
        balanceChanged = true;
        break;
      case 'funding-added':
        parts.push(`Rebuy ${formatUnits(fact.amount)} added. Total funding ${formatUnits(fact.cumulative)}.`);
        balanceChanged = true;
        break;
      case 'turn-began':
      case 'activity-completed':
      case 'outcome-generated':
        break;
    }
  }
  // Come odds go off for a come-out roll and back on with the next point: say so when the puck moves.
  const puck = facts.find((fact) => fact.kind === 'point-changed');
  if (puck && view.table.wagers.some((wager) => /^come-\d+-odds$/.test(wager.target))) {
    parts.push(puck.point === null ? 'Come odds are OFF for the come-out roll.' : 'Come odds are ON again.');
  }
  if (parts.length === 0) return null;
  if (balanceChanged) parts.push(`Balance ${formatUnits(view.balance)}.`);
  return parts.join(' ');
}

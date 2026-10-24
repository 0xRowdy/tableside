// How craps sessions read on screen and aloud. Amounts are plain units (no
// currency symbol). Everything here is built from committed facts and the
// engine's permitted view: the next roll is never known until it is committed.

import { FUNDING_CEILING, type CrapsPermittedView, type DomainFact, type IllegalActionReason, type Phase } from '@tableside/engine';

import { strategyFactSentence } from './strategy-text';
import { capitalize, formatUnits } from './units';

const BASE_NAMES: Record<string, string> = { pass: 'Pass line', 'dont-pass': "Don't pass", come: 'Come', 'dont-come': "Don't come" };

const MENU_NAMES: Record<string, string> = {
  field: 'Field',
  'any-seven': 'Any seven',
  'any-craps': 'Any craps',
  'prop-2': 'Two (aces)',
  'prop-3': 'Three (ace-deuce)',
  'prop-11': 'Eleven (yo)',
  'prop-12': 'Twelve (boxcars)',
  horn: 'Horn',
};

const NUMBER_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve' };

/** "Pass line", "Come 6", "Don't come 4 odds", "Place 6", "Buy 4", "Lay 10", "Hard 8", "Eleven (yo)". */
export function crapsTargetName(target: string): string {
  const menu = MENU_NAMES[target];
  if (menu) return menu;
  const box = /^(place|buy|lay|hard)-(\d+)$/.exec(target);
  if (box) return `${capitalize(box[1] as string)} ${box[2]}`;
  const odds = target.endsWith('-odds');
  const base = odds ? target.slice(0, -'-odds'.length) : target;
  const traveled = /^(dont-come|come)-(\d+)$/.exec(base);
  const name = traveled ? `${BASE_NAMES[traveled[1] as string]} ${traveled[2]}` : (BASE_NAMES[base] ?? target);
  return odds ? `${name} odds` : name;
}


/** "Rolled 3 and 3: 6, the hard way." Pairs of 2 to 5 make the hardway numbers. */
export function rollSentence(dice: readonly [number, number]): string {
  const total = dice[0] + dice[1];
  const hard = dice[0] === dice[1] && total >= 4 && total <= 10 ? ', the hard way' : '';
  return `Rolled ${dice[0]} and ${dice[1]}: ${total}${hard}.`;
}

/** "six the hard way", for a hardway's long name. */
export const hardwayWords = (n: number) => `${NUMBER_WORDS[n] ?? n} the hard way`;

/** Wagers whose working status follows the puck unless the player gives an instruction. */
const followsPuck = (target: string) => /^(place|buy)-\d+$/.test(target);

/** How each switchable family's option reads: what works on the come-out, or what an off wager does. */
const TOGGLE_DETAIL: Record<string, string> = {
  place: 'Off by default. Place bets act only while a point is on.',
  buy: 'Off by default. Buy bets act only while a point is on.',
  come: 'Off by default. Come odds act only while a point is on.',
  lay: 'On by default, on every roll. A lay that is off stays on the table and takes no action.',
  hard: 'On by default, on every roll. A hardway that is off stays on the table and takes no action.',
  dont: "On by default, on every roll. Don't come odds that are off stay on the table and take no action.",
};

/**
 * The working option a wager's stake editor offers (design frame "Craps stake
 * editor"): place, buy and come odds can be told to work on the come-out;
 * lays, hardways and don't come odds can be told to be off. Other wagers
 * always work and offer none.
 */
export function workingToggle(view: CrapsPermittedView, target: string): { title: string; detail: string; usual: boolean } | undefined {
  const usual = view.table.placements.find((p) => p.target === target)?.usualOnComeOut;
  if (usual === undefined) return undefined;
  // The engine says which wagers take an instruction; the family only picks the words.
  const family = /^(place|buy|lay|hard|dont|come)-/.exec(target)?.[1] ?? '';
  const detail = TOGGLE_DETAIL[family] ?? (usual ? 'On by default, on every roll.' : 'Off by default on the come-out roll.');
  return usual ? { title: 'Working', detail, usual } : { title: 'Working on the come-out', detail, usual };
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
  const { flat } = view.table.limits;
  switch (reason) {
    case 'below-minimum':
      return `${name} needs at least ${formatUnits(placement?.min ?? flat.min)}. Nothing was placed.`;
    case 'above-maximum':
      return `${name} allows at most ${formatUnits(placement?.max ?? flat.max)}. Nothing was placed.`;
    case 'stake-increment':
      return `${name} goes in multiples of ${formatUnits(placement?.increment ?? '1')}. Nothing was placed.`;
    case 'commission-unfunded':
      return `${name} charges a commission when it wins, and your balance after the stake can't cover it. Nothing was placed.`;
    case 'working-fixed':
      return `${name} always works. It can't be turned off.`;
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

/** A working instruction, in words, with the stake: what changed against the wager's usual come-out status. */
function workingSentence(target: string, working: boolean, view: CrapsPermittedView): string {
  const stake = view.wagers.find((wager) => wager.target === target)?.amount;
  const name = stake === undefined ? crapsTargetName(target) : `${crapsTargetName(target)} ${formatUnits(stake)}`;
  const status = view.table.wagers.find((wager) => wager.target === target);
  // An instruction is the opposite of the usual status; none means this is the usual status.
  const usual = status?.instruction === null || status?.instruction === undefined ? working : !status.instruction;
  if (!usual) return working ? `${name} now works on the come-out roll too.` : `${name} is off on the come-out roll again, as usual.`;
  return working ? `${name} is working again.` : `${name} is now OFF until you turn it on.`;
}

/** One settled wager: its result, any commission, a horn part, and whether a winning standing bet stays up. */
function settledSentence(fact: Extract<DomainFact, { kind: 'wager-settled' }>): string {
  const name = fact.component === undefined ? crapsTargetName(fact.target) : `Horn ${fact.component} part`;
  const stake = formatUnits(fact.stake);
  if (fact.result === 'returned') return `${name} ${stake} was off and comes back.`;
  if (fact.result === 'loss') return `${name} ${stake} loses.`;
  const commission = fact.commission === undefined ? '' : `, after commission ${formatUnits(fact.commission)}`;
  // A standing bet that wins is paid and stays up: only the win came back.
  const staysUp = fact.returned === fact.net ? ' It stays up.' : '';
  return `${name} ${stake} wins ${formatUnits(fact.net)}${commission}.${staysUp}`;
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
        parts.push(illegalMessage(fact.reason, 'target' in fact.command ? fact.command.target : null, view));
        break;
      case 'dice-rolled':
        parts.push(rollSentence(fact.dice));
        break;
      case 'working-changed':
        parts.push(workingSentence(fact.target, fact.working, view));
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
        parts.push(settledSentence(fact));
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
      default: {
        // Guided practice: corrections, departures, pending actions, cycles.
        const sentence = strategyFactSentence(fact, 'roll');
        if (sentence) parts.push(sentence);
        break;
      }
    }
  }
  // Come odds, place and buy bets go off for a come-out roll and back on with the next point: say so when the puck moves.
  const puck = facts.find((fact) => fact.kind === 'point-changed');
  const following = (pattern: (target: string) => boolean) => view.table.wagers.some((wager) => pattern(wager.target) && wager.instruction === null);
  if (puck && following((target) => /^come-\d+-odds$/.test(target))) {
    parts.push(puck.point === null ? 'Come odds are OFF for the come-out roll.' : 'Come odds are ON again.');
  }
  if (puck && following(followsPuck)) {
    parts.push(puck.point === null ? 'Place and buy bets are OFF for the come-out roll.' : 'Place and buy bets are ON again.');
  }
  if (parts.length === 0) return null;
  if (balanceChanged) parts.push(`Balance ${formatUnits(view.balance)}.`);
  return parts.join(' ');
}

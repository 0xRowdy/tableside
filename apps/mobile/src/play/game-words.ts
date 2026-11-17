import type { ScriptedOutcome } from '@tableside/definitions';
import { BLACKJACK_RULES, countOf, hiLoTag, INSURANCE_TARGET, type BlackjackPermittedView, type CrapsPermittedView, type GameId, type PermittedView, type RoulettePermittedView, type StrategyView } from '@tableside/engine';

import { signed, statusText } from './blackjack-text';
import { crapsStatus, crapsTargetName } from './craps-text';
import { describePocket, STATUS, targetName } from './roulette-text';
import type { TurnWord } from './strategy-text';

export interface GameWords {
  readonly title: string;
  readonly name: GameId;
  readonly turn: TurnWord;
  readonly Turn: string;
  readonly drawn: string;
  readonly same: string;
  readonly targetName: (target: string) => string;
  readonly wagerName: (target: string) => string;
  readonly contracts: boolean;
  readonly noneCommitted: string;
  readonly noWagers: string;
  readonly status: (view: PermittedView) => string;
  readonly scriptedOutcome: (outcome: ScriptedOutcome, open: boolean) => string;
}

const blackjackTarget = (target: string) => (target === INSURANCE_TARGET ? 'insurance' : 'your hand');

// Spec 3 Lessons › Structure (worked examples); Spec 1 Counting (Hi-Lo); #152
const RANK_SHORT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SHOE_CARDS = BLACKJACK_RULES.decks * 52;

function blackjackOutcome(outcome: ScriptedOutcome, open: boolean): string {
  if (!('dealt' in outcome)) return '';
  const rank = (value: number) => RANK_SHORT[value - 1] ?? String(value);
  const [first, up, second] = outcome.dealt;
  const visible = open ? [first, up, second] : outcome.dealt;
  const parts = outcome.shown.length > 0 ? [`Already out of the shoe: ${outcome.shown.map(rank).join(', ')}.`] : [];
  parts.push(open ? `You have ${rank(first ?? 0)} and ${rank(second ?? 0)}; the dealer shows ${up === 1 ? 'an ace' : up === 8 ? 'an 8' : `a ${rank(up ?? 0)}`}.` : `Dealt in order: ${outcome.dealt.map(rank).join(', ')}.`);
  const running = [...outcome.shown, ...visible].reduce<number>((sum, value) => (value === undefined ? sum : sum + hiLoTag({ deck: 0, rank: value, suit: 'spades' })), 0);
  const count = countOf({ running, remaining: SHOE_CARDS - outcome.shown.length - outcome.dealt.length });
  parts.push(`Running count ${signed(count.running)}, ${count.decks} decks left: true count ${signed(count.trueCount)}.`);
  return parts.join(' ');
}

export const GAME_WORDS: Readonly<Record<GameId, GameWords>> = {
  roulette: {
    title: 'Roulette',
    name: 'roulette',
    turn: 'spin',
    Turn: 'Spin',
    drawn: 'spun',
    same: 'Same rules, wheel and spins as before.',
    targetName,
    wagerName: targetName,
    contracts: false,
    noneCommitted: 'None between spins',
    noWagers: 'No wagers yet. Choose one above, set its stake, then spin.',
    status: (view) => STATUS[(view as RoulettePermittedView).phase],
    scriptedOutcome: (outcome) => ('pocket' in outcome ? `The ball lands on ${describePocket(outcome.pocket)}.` : ''),
  },
  craps: {
    title: 'Craps',
    name: 'craps',
    turn: 'roll',
    Turn: 'Roll',
    drawn: 'rolled',
    same: 'Same rules, point and dice as before.',
    targetName: crapsTargetName,
    wagerName: crapsTargetName,
    contracts: true,
    noneCommitted: 'No contracts on the table',
    // TODO(spec 1 craps bet selector frame copy)
    noWagers: 'No wagers yet. Choose one above, set its stake, then roll.',
    status: (view) => crapsStatus(view as CrapsPermittedView),
    // TODO(#154)
    scriptedOutcome: () => '',
  },
  blackjack: {
    title: 'Blackjack',
    name: 'blackjack',
    turn: 'round',
    Turn: 'Round',
    drawn: 'dealt',
    same: 'Same rules, shoe and cards as before.',
    targetName: blackjackTarget,
    wagerName: (target) => (target === INSURANCE_TARGET ? 'Insurance' : 'Initial wager'),
    contracts: false,
    noneCommitted: 'None between rounds',
    noWagers: 'No wagers yet. Set a stake above, then deal.',
    status: (view) => statusText(view as BlackjackPermittedView),
    scriptedOutcome: blackjackOutcome,
  },
};

export const modeText = (strategy: Pick<StrategyView, 'name'> | null): string => (strategy ? `guided · ${strategy.name}` : 'free play');

// How each game is worded, in one place: its name, its turn (CONTEXT.md: one
// blackjack round, one craps roll, one roulette spin), its wagers' names and
// its status line. Every screen that words a game reads it from here.

import { INSURANCE_TARGET, type BlackjackPermittedView, type CrapsPermittedView, type GameId, type PermittedView, type RoulettePermittedView, type StrategyView } from '@tableside/engine';

import { statusText } from './blackjack-text';
import { crapsStatus, crapsTargetName } from './craps-text';
import { STATUS, targetName } from './roulette-text';
import type { TurnWord } from './strategy-text';

export interface GameWords {
  /** The game's name as a title: "Roulette". */
  readonly title: string;
  /** The game's name in a sentence: "roulette". */
  readonly name: GameId;
  /** One turn: "spin", "roll", "round". */
  readonly turn: TurnWord;
  /** The turn as a title: "Spin", "Roll", "Round". */
  readonly Turn: string;
  /** What a turn does to the game's random content: "spun", "rolled", "dealt". */
  readonly drawn: string;
  /** What resuming keeps, for the resume screen. */
  readonly same: string;
  /** A wager's target inside a sentence: "10 on Red", "10 on your hand". */
  readonly targetName: (target: string) => string;
  /** A wager's name heading a list entry: "Red 10", "Initial wager 25". */
  readonly wagerName: (target: string) => string;
  /** True where some wagers are contracts that stay until the game settles them (craps line bets). */
  readonly contracts: boolean;
  /** The committed wagers between turns when there are none. */
  readonly noneCommitted: string;
  /** Where the table is, in a few words: "Betting", "Come-out roll", "Your turn". */
  readonly status: (view: PermittedView) => string;
}

const blackjackTarget = (target: string) => (target === INSURANCE_TARGET ? 'insurance' : 'your hand');

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
    status: (view) => STATUS[(view as RoulettePermittedView).phase],
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
    status: (view) => crapsStatus(view as CrapsPermittedView),
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
    status: (view) => statusText(view as BlackjackPermittedView),
  },
};

/** "free play", or "guided · Pass with odds": how a practice session is being played. */
export const modeText = (strategy: Pick<StrategyView, 'name'> | null): string => (strategy ? `guided · ${strategy.name}` : 'free play');

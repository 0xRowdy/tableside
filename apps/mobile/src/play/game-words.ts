import { INSURANCE_TARGET, type BlackjackPermittedView, type CrapsPermittedView, type GameId, type PermittedView, type RoulettePermittedView, type StrategyView } from '@tableside/engine';

import { statusText } from './blackjack-text';
import { crapsStatus, crapsTargetName } from './craps-text';
import { STATUS, targetName } from './roulette-text';
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
    noWagers: 'No wagers yet. Choose one above, set its stake, then spin.',
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
    // TODO(spec 1 craps bet selector frame copy)
    noWagers: 'No wagers yet. Choose one above, set its stake, then roll.',
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
    noWagers: 'No wagers yet. Set a stake above, then deal.',
    status: (view) => statusText(view as BlackjackPermittedView),
  },
};

export const modeText = (strategy: Pick<StrategyView, 'name'> | null): string => (strategy ? `guided · ${strategy.name}` : 'free play');

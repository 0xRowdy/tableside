// How guided practice's facts are announced, the same at every table: a
// correction, a departure, a pending strategy action, a cycle's end and the
// strategy stopping. A table passes its word for a turn ("spin" or "roll").

import type { CycleEnd, DomainFact, PauseReason } from '@tableside/engine';

export type TurnWord = 'spin' | 'roll' | 'round';

/** How a cycle-end fact is announced. */
const CYCLE_END_ANNOUNCEMENT: Record<CycleEnd, (turn: TurnWord) => string> = {
  completed: () => 'The strategy cycle is complete.',
  cap: () => 'The strategy cycle ended at its cap.',
  stop: () => 'The strategy cycle ended at its stop rule.',
  override: (turn) => `The strategy cycle ends once this ${turn} settles.`,
  collected: () => 'You collected instead. The strategy cycle ended.',
  envelope: () => 'The strategy cycle ended: its next stake is too large to compute.',
};

/** A pending strategy action, announced when it begins. The pending panel shows the amounts. */
const PAUSED: Record<PauseReason, string> = {
  'unfunded-group': "Strategy paused: your balance can't cover its next bets. No new strategy bets.",
  limit: 'Strategy paused: its next bets are outside the table limits. No new strategy bets.',
  cap: 'Strategy paused at its cap. No new strategy bets.',
  stop: 'Strategy paused by its stop rule. No new strategy bets.',
};

/** A guided-practice fact in one sentence, or null for a fact the table words itself. */
export function strategyFactSentence(fact: DomainFact, turn: TurnWord): string | null {
  switch (fact.kind) {
    case 'correction-offered':
      return `Strategy check before your ${turn}. Nothing has been placed yet.`;
    case 'departure-recorded':
      return fact.departure.resolution === 'retried' ? 'Departure recorded: you took it back.' : 'Departure recorded: you overrode the strategy.';
    case 'cycle-ended':
      return CYCLE_END_ANNOUNCEMENT[fact.reason](turn);
    case 'strategy-resumed':
      return 'The strategy can place its next bet again.';
    case 'strategy-paused':
      return PAUSED[fact.reason];
    case 'cycle-restarted':
      return 'Strategy restarted with your current balance.';
    case 'strategy-stopped':
      return 'Strategy stopped. You play on your own now.';
    default:
      return null;
  }
}

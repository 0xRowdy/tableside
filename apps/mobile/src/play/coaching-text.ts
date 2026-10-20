// Coaching prose for guided practice. Every line the coach (Marcus) says is
// rendered here from the engine's structured explanation facts: the
// situation, the matching instruction, the prescription and the fallback.
// Nothing here judges or praises, and nothing is added that the facts don't hold.
// A table passes its own words (wager names, and "spin" or "roll").

import type { BetCorrection, CycleEnd, Explanation, PendingStrategyAction, StrategyView, Wager } from '@tableside/engine';

import { crapsTargetName } from './craps-text';
import { targetName } from './roulette-text';
import type { TurnWord } from './strategy-text';
import { formatUnits } from './units';

/** How a game words its wagers and its turns. */
export interface CoachWords {
  readonly targetName: (target: string) => string;
  readonly turn: TurnWord;
  /** The turn as a title: "Spin", "Roll". */
  readonly Turn: string;
  /** True where some wagers are contracts that stay until the game settles them (craps line bets). */
  readonly contracts: boolean;
}

export const ROULETTE_WORDS: CoachWords = { targetName, turn: 'spin', Turn: 'Spin', contracts: false };
export const CRAPS_WORDS: CoachWords = { targetName: crapsTargetName, turn: 'roll', Turn: 'Roll', contracts: true };

/** "a, b and c". */
const listed = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** "10 on Red and 10 on 1st dozen". */
export const betsText = (bets: readonly Wager[], words: CoachWords = ROULETTE_WORDS) =>
  listed(bets.map((bet) => `${formatUnits(bet.amount)} on ${words.targetName(bet.target)}`));

const total = (bets: readonly Wager[]) => bets.reduce((sum, bet) => sum + BigInt(bet.amount), 0n).toString();

/** The prescription in one sentence: what the strategy does now, or why it places nothing. */
export function prescriptionLine(strategyName: string, explanation: Explanation, words: CoachWords = ROULETTE_WORDS): string {
  const prescription = explanation.prescription;
  const bets = (list: readonly Wager[]) => betsText(list, words);
  switch (prescription.status) {
    case 'prescribed':
      return `${strategyName} bets ${bets(prescription.bets)}.`;
    case 'uncovered':
      return `No instruction in ${strategyName} covers this ${words.turn}, so it places no new bets.`;
    case 'paused':
      switch (prescription.reason) {
        case 'unfunded-group':
          return `${strategyName} places no new bets: its ${bets(prescription.unavailable)} needs ${formatUnits(total(prescription.unavailable))}, and ${formatUnits(explanation.situation.available)} is available.`;
        case 'limit':
          return `${strategyName} places no new bets: ${bets(prescription.unavailable)} is outside the table limits.`;
        case 'cap':
          return `${strategyName} places no new bets: its next stake is past the strategy's cap.`;
        case 'stop':
          return `${strategyName} places no new bets: its stop rule applies.`;
      }
  }
}

const RESULT_WORDS = { win: 'won', loss: 'lost', push: 'broke even' } as const;

/** The situation, the matching instruction and what the player submitted, as the correction's body. */
export function correctionLines(correction: BetCorrection, words: CoachWords = ROULETTE_WORDS): string[] {
  const { explanation, actual } = correction;
  const lines: string[] = [];
  const { available, subjects } = explanation.situation;
  const color = subjects['last-pocket-color'];
  if (color !== undefined && color !== 'none') lines.push(`The last spin landed on ${color}.`);
  const point = subjects.point;
  if (point !== undefined) lines.push(point === 'none' ? 'The puck is off: the next roll is a come-out roll.' : `The point is ${point}.`);
  const last = explanation.state.lastResult;
  if (last !== 'none') lines.push(`The strategy's last ${words.turn} ${RESULT_WORDS[last]}.`);
  lines.push(`Available for this ${words.turn}: ${formatUnits(available)}.`);
  for (const instruction of explanation.instructions) lines.push(`Matching instruction: "${instruction.label}".`);
  if (explanation.fallback === 'no-new-bets') lines.push('Fallback: no new bets.');
  lines.push(`You've set ${actual.length === 0 ? 'no bets' : betsText(actual, words)}. Nothing has been placed yet.`);
  return lines;
}

/** The retry button: what taking the move back does. */
export function retryLabel(correction: BetCorrection, words: CoachWords = ROULETTE_WORDS): string {
  const prescription = correction.explanation.prescription;
  return prescription.status === 'prescribed' ? `Take it back & bet ${betsText(prescription.bets, words)}` : 'Take my bets back';
}

/** What an override means, before the player chooses it. */
export function overrideNote(progression: boolean, words: CoachWords = ROULETTE_WORDS): string {
  return progression
    ? `"Keep my bets" is an override, recorded once. The ${words.turn} goes ahead, the strategy cycle ends, and you restart the strategy yourself.`
    : `"Keep my bets" is an override, recorded once. The ${words.turn} goes ahead, and the strategy coaches your next ${words.turn}.`;
}

/** What a strategy decision is in each game: a spin, or a blackjack playing decision. */
export type DecisionUnit = 'spin' | 'roll' | 'decision';

/** Adherence in words, kept apart from winnings. */
export function adherenceText(adherence: StrategyView['adherence'], unit: DecisionUnit = 'spin'): string {
  if (adherence.decisions === 0) return `No strategy ${unit}s yet`;
  return `Followed ${adherence.followed} of ${adherence.decisions} ${adherence.decisions === 1 ? unit : `${unit}s`}`;
}

/** The words a correction pause shows, whatever the game. */
export interface CorrectionCopy {
  /** "Marcus · guided practice, basic strategy". */
  readonly coach: string;
  /** "Before your spin", "Before your stand". */
  readonly kicker: string;
  readonly headline: string;
  readonly lines: readonly string[];
  /** A short fallback line set apart: "If you can't double: hit." */
  readonly fallback: string | null;
  readonly retry: string;
  readonly override: string;
  readonly note: string;
  /** Why the taught index differs from published charts, when it does. */
  readonly why: readonly string[];
}

/** A betting correction's copy (roulette, craps). */
export function betCorrectionCopy(strategyName: string, correction: BetCorrection, overrideEndsCycle: boolean, words: CoachWords = ROULETTE_WORDS): CorrectionCopy {
  return {
    coach: `Marcus · guided practice, ${strategyName}`,
    kicker: `Before your ${words.turn}`,
    headline: prescriptionLine(strategyName, correction.explanation, words),
    lines: correctionLines(correction, words),
    fallback: null,
    retry: retryLabel(correction, words),
    override: 'Keep my bets',
    note: overrideNote(overrideEndsCycle, words),
    why: [],
  };
}

/** The strategy's choices: "Black", "1st dozen and 2nd dozen". */
export const parametersText = (strategy: Pick<StrategyView, 'parameters'>, words: CoachWords = ROULETTE_WORDS) =>
  listed(strategy.parameters.map((param) => words.targetName(param.value)));

/** "Capped Martingale · cycle 2": a strategy with cycles names the one under way. */
export const cycleBadge = (strategy: Pick<StrategyView, 'name' | 'cycle'>) => `${strategy.name} · cycle ${strategy.cycle.number}`;

/** A pending strategy action: what the strategy waits to place. */
export const pendingWaiting = (pending: PendingStrategyAction, words: CoachWords = ROULETTE_WORDS) =>
  pending.unavailable.length > 0 ? `Waiting: ${betsText(pending.unavailable, words)}` : 'Waiting: no strategy bet can be placed';

/** Why a pending strategy action can't execute, against the funds available for it. */
export function pendingBlocked(pending: PendingStrategyAction, available: string): string {
  switch (pending.reason) {
    case 'unfunded-group':
      return `Blocked: not enough chips (${formatUnits(available)} of ${formatUnits(total(pending.unavailable))})`;
    case 'limit':
      return 'Blocked: outside the table limits';
    case 'cap':
      return pending.cap === undefined ? "Blocked: past the strategy's cap" : `Blocked: past the strategy's cap of ${formatUnits(pending.cap)}`;
    case 'stop':
      return "Blocked: the strategy's stop rule applies";
  }
}

/** For a pending action that follows a settled outcome: that outcome stays as it was paid. */
export const pendingPaidNote = (pending: PendingStrategyAction, words: CoachWords = ROULETTE_WORDS) =>
  pending.turn === undefined ? null : `${words.Turn} ${pending.turn} is settled and stays paid. Nothing is paid again.`;

/** What an override from a pending strategy action means, before the player chooses it. */
export const pendingOverrideNote = (progression: boolean, words: CoachWords = ROULETTE_WORDS) =>
  progression
    ? `An override ends this cycle: your ${words.turn} settles, and you restart the strategy yourself.`
    : `An override is recorded once, and the strategy coaches your next ${words.turn}.`;

/** The cycle result's headline. */
export const CYCLE_HEADLINE: Record<CycleEnd, string> = {
  completed: 'Cycle complete',
  cap: "This cycle ended at the strategy's cap",
  stop: "This cycle ended at the strategy's stop rule",
  override: 'This cycle ended with your override',
  collected: 'Cycle ended: you chose Collect instead',
  envelope: 'This cycle ended: its next stake is too large to compute',
};

/** Why a cycle ended, in one or two sentences from the engine's facts. */
export function cycleEndText(strategy: Pick<StrategyView, 'name' | 'cycleEnd' | 'exhaustion'>, words: CoachWords = ROULETTE_WORDS): string {
  const exhaustion = strategy.exhaustion;
  switch (strategy.cycleEnd) {
    case 'completed':
      return `${strategy.name} completed its cycle. Another cycle starts again from its first bet.`;
    case 'cap':
      return exhaustion && exhaustion.unavailable.length > 0 && exhaustion.cap !== undefined
        ? `The next stake would be ${betsText(exhaustion.unavailable, words)}, past the strategy's cap of ${formatUnits(exhaustion.cap)}, so no new bet was placed.`
        : "The strategy's next stake is past its cap, so no new bet was placed.";
    case 'stop':
      return "The strategy's stop rule applies, so no new bet was placed.";
    case 'override':
      return `You overrode the strategy, so its cycle ended once the ${words.turn} settled.${
        words.contracts ? ' Its removable bets came down; committed line bets stay until the dice settle them.' : ''
      } Restart it to follow it again, or play on your own.`;
    case 'collected':
      return 'You kept what was paid instead of the strategy\'s next step. That ends the cycle: removable bets came down, committed line bets stay until the dice settle them, and nothing is pending. The strategy waits until you restart it.';
    case 'envelope':
      return "The strategy's next stake grew past the largest amount a strategy may compute, so its cycle ended. Restart it to begin again from its first bet.";
    case null:
      return '';
  }
}

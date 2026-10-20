// Coaching prose for guided practice. Every line the coach (Marcus) says is
// rendered here from the engine's structured explanation facts: the
// situation, the matching instruction, the prescription and the fallback.
// Nothing here judges or praises, and nothing is added that the facts don't hold.

import type { Explanation, PendingCorrection, StrategyView, Wager } from '@tableside/engine';

import { targetName } from './roulette-text';
import { formatUnits } from './units';

/** "a, b and c". */
const listed = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/** "10 on Red and 10 on 1st dozen". */
export const betsText = (bets: readonly Wager[]) => listed(bets.map((bet) => `${formatUnits(bet.amount)} on ${targetName(bet.target)}`));

const total = (bets: readonly Wager[]) => bets.reduce((sum, bet) => sum + BigInt(bet.amount), 0n).toString();

/** The prescription in one sentence: what the strategy does now, or why it places nothing. */
export function prescriptionLine(strategyName: string, explanation: Explanation): string {
  const prescription = explanation.prescription;
  switch (prescription.status) {
    case 'prescribed':
      return `${strategyName} bets ${betsText(prescription.bets)}.`;
    case 'uncovered':
      return `No instruction in ${strategyName} covers this spin, so it places no new bets.`;
    case 'paused':
      switch (prescription.reason) {
        case 'unfunded-group':
          return `${strategyName} places no new bets: its ${betsText(prescription.unavailable)} needs ${formatUnits(total(prescription.unavailable))}, and ${formatUnits(explanation.situation.available)} is available.`;
        case 'limit':
          return `${strategyName} places no new bets: ${betsText(prescription.unavailable)} is outside the table limits.`;
        case 'cap':
          return `${strategyName} places no new bets: its next stake is past the strategy's cap.`;
        case 'stop':
          return `${strategyName} places no new bets: its stop rule applies.`;
      }
  }
}

const RESULT_WORDS = { win: 'won', loss: 'lost', push: 'broke even' } as const;

/** The situation, the matching instruction and what the player submitted, as the correction's body. */
export function correctionLines(correction: PendingCorrection): string[] {
  const { explanation, actual } = correction;
  const lines: string[] = [];
  const last = explanation.state.lastResult;
  if (last !== 'none') lines.push(`The strategy's last spin ${RESULT_WORDS[last]}.`);
  for (const instruction of explanation.instructions) lines.push(`Matching instruction: "${instruction.label}".`);
  if (explanation.fallback === 'no-new-bets') lines.push('Fallback: no new bets.');
  lines.push(`You've set ${betsText(actual)}. Nothing has been placed yet.`);
  return lines;
}

/** The retry button: what taking the move back does. */
export function retryLabel(correction: PendingCorrection): string {
  const prescription = correction.explanation.prescription;
  return prescription.status === 'prescribed' ? `Take it back & bet ${betsText(prescription.bets)}` : 'Take my bets back';
}

/** What an override means, before the player chooses it. */
export const OVERRIDE_NOTE =
  '"Keep my bets" is an override, recorded once. The spin goes ahead, the strategy cycle ends, and you restart the strategy yourself.';

/** Adherence in words, kept apart from winnings. */
export function adherenceText(adherence: StrategyView['adherence']): string {
  if (adherence.decisions === 0) return 'No strategy spins yet';
  return `Followed ${adherence.followed} of ${adherence.decisions} ${adherence.decisions === 1 ? 'spin' : 'spins'}`;
}

/** The strategy's choices: "Black", "1st dozen and 2nd dozen". */
export const parametersText = (strategy: Pick<StrategyView, 'parameters'>) => listed(strategy.parameters.map((param) => targetName(param.value)));

/** A pending strategy action, in words, or null. */
export function pendingLine(strategy: StrategyView): string | null {
  const pending = strategy.pending;
  if (!pending) return null;
  switch (pending.reason) {
    case 'unfunded-group':
      return `Strategy paused: ${betsText(pending.unavailable)} needs ${formatUnits(total(pending.unavailable))}, more than your balance. No new strategy bets until it's covered.`;
    case 'limit':
      return `Strategy paused: ${betsText(pending.unavailable)} is outside the table limits. No new strategy bets.`;
    case 'cap':
      return "Strategy paused at its cap. No new strategy bets.";
    case 'stop':
      return 'Strategy paused by its stop rule. No new strategy bets.';
  }
}

/** Why a cycle ended. */
export const CYCLE_END_TEXT: Record<NonNullable<StrategyView['cycleEnd']>, string> = {
  override: 'You overrode the strategy, so its cycle ended once the spin settled. Restart it to follow it again, or play on your own.',
  cap: "The strategy's next stake went past its limits, so its cycle ended. Restart it to begin again from its first bet.",
};

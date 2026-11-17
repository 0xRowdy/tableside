import type { AdherenceMeasure, BetCorrection, CycleEnd, Explanation, PendingStrategyAction, StrategyView, Wager } from '@tableside/engine';

import { pointLine } from './craps-text';
import { GAME_WORDS, type GameWords } from './game-words';
import { lastSpinLine } from './roulette-text';
import { capitalize, formatUnits, totalStake } from './units';

export type CoachWords = Pick<GameWords, 'targetName' | 'turn' | 'Turn' | 'contracts'>;

export const ROULETTE_WORDS: CoachWords = GAME_WORDS.roulette;
export const CRAPS_WORDS: CoachWords = GAME_WORDS.craps;
export const BLACKJACK_WORDS: CoachWords = GAME_WORDS.blackjack;

const listed = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export const betsText = (bets: readonly Wager[], words: CoachWords = ROULETTE_WORDS) =>
  listed(bets.map((bet) => `${formatUnits(bet.amount)} on ${words.targetName(bet.target)}`));


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
          return `${strategyName} places no new bets: its ${bets(prescription.unavailable)} needs ${formatUnits(totalStake(prescription.unavailable))}, and ${formatUnits(explanation.situation.available)} is available.`;
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

export function correctionLines(correction: BetCorrection, words: CoachWords = ROULETTE_WORDS, countKept = false): string[] {
  const { explanation, actual } = correction;
  const lines: string[] = [];
  const { available, subjects } = explanation.situation;
  const color = subjects['last-pocket-color'];
  if (color !== undefined && color !== 'none') lines.push(lastSpinLine(color));
  const point = subjects.point;
  if (point !== undefined) lines.push(pointLine(point));
  const trueCount = explanation.situation.values['true-count'];
  if (countKept) lines.push('Checked against the actual true count, which you keep in this mode.');
  else if (trueCount !== undefined) lines.push(`The true count is ${Number(trueCount) > 0 ? '+' : ''}${trueCount}, supplied by Tableside in this mode.`);
  const last = explanation.state.lastResult;
  if (last !== 'none' && trueCount === undefined && !countKept) lines.push(`The strategy's last ${words.turn} ${RESULT_WORDS[last]}.`);
  lines.push(`Available for this ${words.turn}: ${formatUnits(available)}.`);
  for (const instruction of explanation.instructions) lines.push(`Matching instruction: "${instruction.label}".`);
  if (explanation.fallback === 'no-new-bets') lines.push('Fallback: no new bets.');
  lines.push(`You've set ${actual.length === 0 ? 'no bets' : betsText(actual, words)}. Nothing has been placed yet.`);
  return lines;
}

export function retryLabel(correction: BetCorrection, words: CoachWords = ROULETTE_WORDS): string {
  const prescription = correction.explanation.prescription;
  return prescription.status === 'prescribed' ? `Take it back & bet ${betsText(prescription.bets, words)}` : 'Take my bets back';
}

export function overrideNote(progression: boolean, words: CoachWords = ROULETTE_WORDS): string {
  return progression
    ? `"Keep my bets" is an override, recorded once. The ${words.turn} goes ahead, the strategy cycle ends, and you restart the strategy yourself.`
    : `"Keep my bets" is an override, recorded once. The ${words.turn} goes ahead, and the strategy coaches your next ${words.turn}.`;
}

export type DecisionUnit = 'spin' | 'roll' | 'decision' | 'round';

const measureText = (measure: AdherenceMeasure, unit: DecisionUnit) =>
  measure.decisions === 0 ? `no strategy ${unit}s yet` : `followed ${measure.followed} of ${measure.decisions} ${measure.decisions === 1 ? unit : `${unit}s`}`;

export function adherenceText(adherence: StrategyView['adherence'], unit: DecisionUnit = 'spin'): string {
  const { betting, playing } = adherence;
  if (betting && playing) return `Playing: ${measureText(playing, 'decision')} · Betting: ${measureText(betting, 'round')}`;
  const only = playing ?? betting;
  return only ? capitalize(measureText(only, unit)) : 'Nothing assessed yet';
}

export interface CorrectionCopy {
  readonly coach: string;
  readonly kicker: string;
  readonly headline: string;
  readonly lines: readonly string[];
  readonly fallback: string | null;
  readonly retry: string;
  readonly override: string;
  readonly note: string;
  readonly why: readonly string[];
}

export function betCorrectionCopy(strategyName: string, correction: BetCorrection, overrideEndsCycle: boolean, words: CoachWords = ROULETTE_WORDS, countKept = false): CorrectionCopy {
  return {
    coach: `Marcus · guided practice, ${strategyName}`,
    kicker: `Before your ${words.turn}`,
    headline: prescriptionLine(strategyName, correction.explanation, words),
    lines: correctionLines(correction, words, countKept),
    fallback: null,
    retry: retryLabel(correction, words),
    override: 'Keep my bets',
    note: overrideNote(overrideEndsCycle, words),
    why: [],
  };
}

export const parametersText = (strategy: Pick<StrategyView, 'parameters'>, words: CoachWords = ROULETTE_WORDS) =>
  listed(strategy.parameters.map((param) => words.targetName(param.value)));

export const cycleBadge = (strategy: Pick<StrategyView, 'name' | 'cycle'>) => `${strategy.name} · cycle ${strategy.cycle.number}`;

export const pendingWaiting = (pending: PendingStrategyAction, words: CoachWords = ROULETTE_WORDS) =>
  pending.unavailable.length > 0 ? `Waiting: ${betsText(pending.unavailable, words)}` : 'Waiting: no strategy bet can be placed';

export function pendingBlocked(pending: PendingStrategyAction, available: string): string {
  switch (pending.reason) {
    case 'unfunded-group':
      return `Blocked: not enough chips (${formatUnits(available)} of ${formatUnits(totalStake(pending.unavailable))})`;
    case 'limit':
      return 'Blocked: outside the table limits';
    case 'cap':
      return pending.cap === undefined ? "Blocked: past the strategy's cap" : `Blocked: past the strategy's cap of ${formatUnits(pending.cap)}`;
    case 'stop':
      return "Blocked: the strategy's stop rule applies";
  }
}

export const pendingPaidNote = (pending: PendingStrategyAction, words: CoachWords = ROULETTE_WORDS) =>
  pending.turn === undefined ? null : `${words.Turn} ${pending.turn} is settled and stays paid. Nothing is paid again.`;

export const pendingOverrideNote = (progression: boolean, words: CoachWords = ROULETTE_WORDS) =>
  progression
    ? `An override ends this cycle: your ${words.turn} settles, and you restart the strategy yourself.`
    : `An override is recorded once, and the strategy coaches your next ${words.turn}.`;

export const CYCLE_HEADLINE: Record<CycleEnd, string> = {
  completed: 'Cycle complete',
  cap: "This cycle ended at the strategy's cap",
  stop: "This cycle ended at the strategy's stop rule",
  override: 'This cycle ended with your override',
  collected: 'Cycle ended: you chose Collect instead',
  envelope: 'This cycle ended: its next stake is too large to compute',
};

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

// Spec 3 S3-12 aJV2y; Lessons › Structure (worked examples); Amendment 2 §3; #153
import type { ConversionExplanation, RunningCountExplanation } from '@tableside/engine';

import { rankName, signed } from '@/play/blackjack-text';

import { decksText } from './blackjack-conversion-text';

export const GIVEN_RUNNING_COUNT = 'Running count';
export const GIVEN_DECKS = 'Decks remaining';
export const TRUE_COUNT_PROMPT = "What's the true count?";
export const RUNNING_COUNT_PROMPT = "What's the running count now?";
export const ROUND_PROMPT = "What's the running count after the round?";
export const roundLead = (round: number, before: number) => `Round ${round} has just finished, with the dealer’s hole card turned over. The count was ${signed(before)} before the round.`;

const plain = (value: number) => (value < 0 ? `−${-value}` : String(value));

// Spec 3 S3-12 aJV2y; Amendment 2 §3
export function conversionExampleText({ running, decks, trueCount, exact }: ConversionExplanation): string {
  const division = `${plain(running)} ÷ ${decksText(decks)}`;
  if (exact) return `${division} = ${plain(trueCount)} exactly: ${signed(trueCount)}.`;
  const quotient = Math.round((running / decks) * 100) / 100;
  return `${division} ${quotient === running / decks ? '=' : '≈'} ${plain(quotient)}. Truncate toward zero: ${signed(trueCount)}.`;
}

export const runningCountExampleText = ({ rank, value, before, count }: RunningCountExplanation) =>
  `${signed(before)}, and ${rankName(rank)} counts ${signed(value)}: the running count is ${signed(count)}.`;

// Spec 3 Challenge content › Conversion; Lessons › Content requirements; #134
import type { ConversionExplanation } from '@tableside/engine';

import { signed } from '@/play/blackjack-text';

// Spec 3 Challenge content › Conversion; S3-06 zAatf
export const decksText = (decks: number) => String(decks);

const TWO_PLACES = 100;

// Spec 3 Lessons › Content requirements; S3-06 Qv1An
export function conversionText(explanation: ConversionExplanation): string {
  const { running, decks, trueCount, exact } = explanation;
  const division = `${signed(running)} ÷ ${decksText(decks)}`;
  if (running === 0) return `${division} = 0, so the true count is 0.`;
  if (exact) return `${division} = ${signed(trueCount)} exactly, so the true count is ${signed(trueCount)}.`;
  const quotient = running / decks;
  const shown = Math.round(quotient * TWO_PLACES) / TWO_PLACES;
  const away = trueCount + Math.sign(running);
  return (
    `${division} ${shown === quotient ? '=' : '≈'} ${signed(shown)}. Tableside truncates toward zero, so ${signed(trueCount)}. ` +
    `Rounding ${running > 0 ? 'up' : 'down'} to ${signed(away)} is the common slip; some charts online round differently.`
  );
}

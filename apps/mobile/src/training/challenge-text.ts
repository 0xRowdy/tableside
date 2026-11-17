// Spec 3 S3-01 PDCaD, RqPCB, S3-02 buD2R, S3-03, S3-08, S3-09 h0MsKr; S5-17 j3UhJ; #158, #132, #150

import type { CardValueReview, ChallengeEntry, ChallengeMetric, ChallengeVariant, HiLoExplanation, HiLoValue, LearnFeedback, MetricResult } from '@tableside/engine';

import { cardName, rankName, signed } from '@/play/blackjack-text';
import { GAME_WORDS } from '@/play/game-words';

import type { ChallengeAllowance } from './allowance';
import type { CatalogCategory, StartProblem } from './service';

export const CATEGORY_TEXT: Record<CatalogCategory, { readonly title: string; readonly description: string }> = {
  'card-values': { title: 'Card values', description: '20 cards covering every rank. Answer +1, 0 or −1 for each.' },
  'running-count': { title: 'Running count', description: '52 cards from a shuffled six-deck shoe, starting at zero. Keep the Hi-Lo count as they appear.' },
  conversion: { title: 'True-count conversion', description: "10 questions. You're given a running count and decks remaining; enter the true count." },
  table: { title: 'Table counting', description: `10 ${GAME_WORDS.blackjack.turn}s at a simulated blackjack table. Observe the players, or play and count yourself.` },
};

export const COUNTING_TITLE = 'Counting';
export const SUGGESTED_ORDER_LABEL = 'SUGGESTED ORDER · ALL FOUR AVAILABLE NOW';
export const RECOMMENDATIONS_NOTE = 'Recommendations use your accuracy only, never speed or winnings. Nothing here is locked.';
export const NOT_READY_HINT = 'Not available in this version yet.';

export const VARIANT_LABEL = 'VARIANT';
export const WHAT_YOU_DO_LABEL = 'WHAT YOU’LL DO';
export const startLabel = (variant: ChallengeVariant) => `Start ${variantLabel(variant)} attempt`;
export const FINDING_ATTEMPT = 'Finding your counting attempt…';

export const VARIANT_HELP = "Check holds all feedback until the end. Learn tells you after each answer whether it's right, explains it and lets you retry.";
export const WHAT_YOU_DO: Partial<Record<CatalogCategory, string>> = {
  'card-values': '20 cards covering every rank, one at a time. Choose +1, 0 or −1 for each. Only your first answer to each card is scored.',
};

// Spec 3 Amendment 4 §2–3; spec 5 Amendment 1 E, Amendment 7 §4
export type AllowanceAction = 'see-premium' | 'offline-and-allowance';

export interface AllowanceCopy {
  readonly standing: 'premium' | 'available' | 'used-up' | 'elsewhere';
  readonly banner: { readonly title: string; readonly detail: string | null; readonly action: AllowanceAction | null };
  readonly setup: { readonly text: string; readonly action: AllowanceAction | null };
  readonly results: string;
}

// Spec 3 Training service interface › Start attempt
export const startWaits = (copy: AllowanceCopy | undefined) => copy?.standing === 'used-up' || copy?.standing === 'elsewhere';

export const ALLOWANCE_ACTION_LABEL: Record<AllowanceAction, string> = { 'see-premium': 'See premium', 'offline-and-allowance': 'Offline & allowance' };
export const ARRIVES_LATER: Record<AllowanceAction, string> = {
  'see-premium': 'Plans arrive in a later update.',
  'offline-and-allowance': 'Offline & allowance arrives in a later update.',
};

const UNLIMITED = 'Unlimited challenges (premium)';
const RETRY_STARTS_FRESH = 'Retry starts a fresh attempt.';
const attempts = (count: number) => (count === 1 ? 'attempt' : 'attempts');

// Spec 5 Allowance device, transfer, replacement and timezone
export function resetTimeText(instant: number, timeZone: string): string {
  const parts = (timeZoneName: 'longGeneric' | 'long') =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone, timeZoneName }).formatToParts(instant);
  let found: Intl.DateTimeFormatPart[];
  try {
    found = parts('longGeneric');
  } catch {
    found = parts('long').map((item) => (item.type === 'timeZoneName' ? { ...item, value: item.value.replace(/ (Standard|Daylight) Time$/, ' Time') } : item));
  }
  const part = (type: Intl.DateTimeFormatPartTypes) => found.find((item) => item.type === type)?.value ?? '';
  return `${part('hour')}:${part('minute')} ${part('dayPeriod')} ${part('timeZoneName')}`;
}

export function allowanceCopy(allowance: ChallengeAllowance): AllowanceCopy {
  if (allowance.kind === 'premium') {
    return { standing: 'premium', banner: { title: UNLIMITED, detail: null, action: null }, setup: { text: UNLIMITED, action: null }, results: `${UNLIMITED}. ${RETRY_STARTS_FRESH}` };
  }
  const { amount, left, resetsAt, timeZone, allowanceDevice } = allowance;
  if (!allowanceDevice.here) {
    const where = `Today's challenge attempts are on ${allowanceDevice.name}.`;
    const moveHere = 'Move them here in More › Settings › Offline & allowance.';
    return {
      standing: 'elsewhere',
      banner: { title: where, detail: moveHere, action: 'offline-and-allowance' },
      setup: { text: `${where} ${moveHere}`, action: null },
      results: `${where} ${moveHere}`,
    };
  }
  const reset = resetTimeText(resetsAt, timeZone);
  if (left === 0) {
    const usedUp = `You've used today's ${amount} challenge ${attempts(amount)}. They reset at ${reset}.`;
    return {
      standing: 'used-up',
      banner: { title: 'No challenge attempts left today', detail: `${usedUp} Lessons, worked examples and your records stay open.`, action: 'see-premium' },
      setup: { text: usedUp, action: 'see-premium' },
      results: usedUp,
    };
  }
  return {
    standing: 'available',
    banner: {
      title: `${left} of ${amount} challenge ${attempts(amount)} left today · resets at ${reset}`,
      detail: "Starting an attempt uses one. Resuming one, showing the count and lessons don't.",
      action: 'see-premium',
    },
    setup: { text: `Starting uses 1 of your ${left} ${attempts(left)} left today. Resuming doesn't use another.`, action: null },
    results: `${left} ${attempts(left)} left today. ${RETRY_STARTS_FRESH}`,
  };
}

export const START_PROBLEM: Record<StartProblem, string> = {
  'invalid-setup': 'This setup can’t start. Nothing was used.',
  'access-denied': 'This attempt can’t start right now. Nothing was used.',
  'access-uncertain': 'This attempt can’t start right now: reconnect to verify access. Nothing was used.',
  'save-failed': 'Couldn’t save the attempt, so it didn’t start. Nothing was used. Try again.',
};

export const variantLabel = (variant: ChallengeVariant) => (variant === 'learn' ? 'Learn' : 'Check');

// TODO(#136)
export const PACING_LABEL = 'self-paced';

export const progressText = (position: number, length: number) => `Card ${position} of ${length}`;

export const spokenValue = (value: HiLoValue) => (value > 0 ? `plus ${value}` : value < 0 ? `minus ${-value}` : '0');

// Spec 3 Learn, Check and assistance; Lessons › Structure (worked examples); #144
export const hiLoText = (explanation: HiLoExplanation) => `${rankName(explanation.rank)} counts ${signed(explanation.value)} in Hi-Lo.`;

export function feedbackText(feedback: LearnFeedback): { readonly kicker: string; readonly headline: string; readonly detail: string } {
  const { explanation } = feedback;
  const kicker = feedback.correct ? (feedback.scored ? 'CORRECT' : 'CORRECT ON RETRY · YOUR FIRST ANSWER IS SCORED') : 'NOT QUITE · YOUR FIRST ANSWER IS SCORED';
  return {
    kicker,
    headline: hiLoText(explanation),
    detail: 'Hi-Lo values: 2 to 6 are +1. 7, 8 and 9 are 0. 10, J, Q, K and A are −1.',
  };
}

export const COACH_NAME = 'Marcus · Learn';
export const NEXT_CARD = 'Next card';
export const TRY_AGAIN = 'Try this card again';

export type ChoiceState = 'your-answer' | 'your-pick' | 'correct' | 'recorded' | null;

export const choiceState = (value: HiLoValue, feedback: LearnFeedback | null, entered: ChallengeEntry | null): ChoiceState => {
  if (entered !== null) return value === entered ? 'recorded' : null;
  if (!feedback) return null;
  if (value === feedback.reference) return 'correct';
  return value === feedback.entered ? 'your-answer' : null;
};

export const CHOICE_TAG = { 'your-answer': 'Your answer', 'your-pick': 'Your pick', correct: 'Correct', recorded: 'Recorded' } as const;

export const CARD_PROMPT = "What's this card's Hi-Lo value?";
export const SKIP_LABEL = 'Skip (counts as incorrect)';

// Spec 3 Learn, Check and assistance › Answer accepted
export const recordedText = (entered: ChallengeEntry) => `${entered === 'skip' ? 'Skip' : 'Answer'} recorded. Next card in a moment.`;

export const enteredText = (entry: ChallengeEntry) => (entry === 'skip' ? 'skipped' : signed(entry));

// Spec 3 S3-08 liAfT
export const RESULTS_TITLE = 'Results';
export const COMPLETED: Record<ChallengeVariant, { readonly title: string; readonly detail: string | null; readonly note: string | null }> = {
  learn: {
    title: 'Completed · Learn',
    detail: 'Learn scores your first answer to each card, even when you corrected it afterwards. Learn attempts never count toward a readiness milestone.',
    note: "When you're ready, try Check: it holds every answer until the end.",
  },
  // Spec 3 S3-08 CEb6T; TODO(#135)
  check: { title: 'Completed · unassisted', detail: null, note: null },
};

export const resultsNote = (variant: ChallengeVariant, allowance: AllowanceCopy | undefined) => [COMPLETED[variant].note, allowance?.results].filter(Boolean).join(' ');
export const SCORES_LABEL = 'SKILL SCORES · FIRST ANSWERS';
export const REVIEW_CARDS = 'Review cards';
// TODO(#135)
export const RETRY_LABEL = 'Retry with new cards';

export const RESULT_ROWS: readonly { readonly metric: ChallengeMetric; readonly title: string; readonly tested: (length: number) => string }[] = [
  { metric: 'card-values', title: 'Card values', tested: (length) => `${length} cards` },
  { metric: 'running-count', title: 'Running count', tested: (length) => `${length} cards` },
  { metric: 'true-count', title: 'True count', tested: (length) => `${length} questions` },
];

export const NOT_TESTED = 'Not tested';

export const scoreText = (result: MetricResult | null) => (result ? `${result.correct} / ${result.total}` : 'N/A');

export const spokenScore = (result: MetricResult | null) => (result ? `${result.correct} of ${result.total}` : 'N/A');

// Spec 3 S3-09 h0MsKr, BjuKf; Scoring and review › Review facts
export const CARD_REVIEW_TITLE = 'Card review';
export const YOU_LABEL = 'You';
export const CORRECT_LABEL = 'Correct';
export const SKIPPED = 'Skipped';

export type ReviewOutcome = 'match' | 'off' | 'skipped';

const REVIEW_OUTCOME: Record<ReviewOutcome, { readonly status: (off: number) => string; readonly spoken: (off: number) => string }> = {
  match: { status: () => 'Match', spoken: () => 'match' },
  off: { status: (off) => `Off by ${off}`, spoken: (off) => `off by ${off}` },
  skipped: { status: () => 'Skipped · incorrect', spoken: () => 'counts as incorrect' },
};

export function reviewText(fact: CardValueReview) {
  const { entered, reference } = fact;
  const outcome: ReviewOutcome = entered === 'skip' ? 'skipped' : entered === reference ? 'match' : 'off';
  const off = entered === 'skip' ? 0 : Math.abs(entered - reference);
  const { status, spoken } = REVIEW_OUTCOME[outcome];
  const spokenEntry = entered === 'skip' ? 'skipped' : `you entered ${spokenValue(entered)}`;
  return {
    outcome,
    title: `Card ${fact.position} · ${cardName(fact.card)}`,
    status: status(off),
    entered: entered === 'skip' ? SKIPPED : signed(entered),
    reference: signed(reference),
    label: `Card ${fact.position}, ${cardName(fact.card)}: ${spokenEntry}, correct ${spokenValue(reference)}, ${spoken(off)}`,
  };
}

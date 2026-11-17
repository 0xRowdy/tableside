// Spec 3 S3-01 to S3-09; S5-17 j3UhJ; #158, #132, #150, #133, #134, #137

import { runningCountDrift, type AssistanceClass, type ChallengeCategory, type ChallengeEntry, type ChallengeMetric, type ChallengeVariant, type ChallengeView, type ConversionReview, type CountRange, type HiLoExplanation, type HiLoValue, type LearnFeedback, type MetricResult, type ReviewFact, type RunningCountReview } from '@tableside/engine';

import { cardName, rankName, signed } from '@/play/blackjack-text';
import { conversionText, decksText } from '@/training/blackjack-conversion-text';
import { completedRounds, RETRY_WITH_NEW_SHOE, runningHeadline, tableCheckpointTitle, tableRunningText } from '@/training/blackjack-table-text';
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
  'running-count':
    '52 cards from a shuffled six-deck shoe, starting at zero. Learn asks for the count after every card; Check asks after cards 13, 26, 39 and 52. Only your first answer at each point is scored.',
  conversion: '10 questions. Each gives a running count and the decks remaining; enter the true count. Only your first answer to each question is scored.',
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

// Spec 3 S3-06 zAatf
export const questionProgress = (position: number, length: number) => `Question ${position} of ${length}`;

// Spec 3 S3-04 qdnQm
export const checkpointOf = (view: Pick<ChallengeView, 'checkpoints' | 'position'>) => {
  const index = view.checkpoints?.findIndex((card) => card >= view.position) ?? -1;
  return view.checkpoints && index >= 0 ? { number: index + 1, of: view.checkpoints.length, card: view.checkpoints[index] as number } : null;
};

export function exerciseProgress(view: ChallengeView): string {
  if (view.category === 'conversion') return questionProgress(view.position, view.length);
  const checkpoint = checkpointOf(view);
  const cards = progressText(view.position, view.length);
  return checkpoint && view.position > 0 ? `${cards} · checkpoint ${checkpoint.number} of ${checkpoint.of}` : cards;
}

export const spokenValue = (value: number) => (value > 0 ? `plus ${value}` : value < 0 ? `minus ${-value}` : '0');

// Spec 3 Learn, Check and assistance; Lessons › Structure (worked examples); #144
export const hiLoText = (explanation: Pick<HiLoExplanation, 'rank' | 'value'>) => `${rankName(explanation.rank)} counts ${signed(explanation.value)} in Hi-Lo.`;

export function feedbackText(feedback: LearnFeedback, position: number): { readonly kicker: string; readonly headline: string; readonly detail: string } {
  const { explanation } = feedback;
  const kicker = feedback.correct ? (feedback.scored ? 'CORRECT' : 'CORRECT ON RETRY · YOUR FIRST ANSWER IS SCORED') : 'NOT QUITE · YOUR FIRST ANSWER IS SCORED';
  if (explanation.kind === 'conversion') {
    const answer = signed(explanation.trueCount);
    return { kicker: CONVERSION_KICKER, headline: feedback.correct ? `${answer} is right.` : `The true count is ${answer}.`, detail: conversionText(explanation) };
  }
  if (explanation.kind === 'table-running') return { kicker, headline: runningHeadline(explanation.count), detail: tableRunningText(explanation, 'block') };
  if (explanation.kind === 'running-count') {
    return {
      kicker,
      headline: `The count after card ${position} is ${signed(explanation.count)}.`,
      detail: `It was ${signed(explanation.before)}, and ${hiLoText(explanation)}`,
    };
  }
  return {
    kicker,
    headline: hiLoText(explanation),
    detail: 'Hi-Lo values: 2 to 6 are +1. 7, 8 and 9 are 0. 10, J, Q, K and A are −1.',
  };
}

export const COACH_NAME = 'Marcus · Learn';
export const NEXT_CARD = 'Next card';
export const TRY_AGAIN = 'Try this card again';
// Spec 3 S3-06 Qv1An
export const NEXT_QUESTION = 'Next question';
export const TRY_QUESTION_AGAIN = 'Try this question again';
export const CONVERSION_KICKER = 'TRUE COUNT';
export const CONVERSION_LESSON_ACTION = 'Read the conversion lesson';

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

// Spec 3 S3-04 qdnQm
export const COUNT_LABEL = 'Running count';
export const COUNT_SKIP = 'Skip';
export const COUNT_SKIP_HINT = 'Counts as incorrect';
export const SUBMIT = 'Submit';
export const CHANGE_SIGN = 'Change sign';
export const DELETE_DIGIT = 'Delete';
export const countPrompt = (position: number) => `Enter the running count after ${position} ${position === 1 ? 'card' : 'cards'}`;
export const checkpointKicker = (checkpoint: { readonly number: number; readonly of: number }) => `Checkpoint ${checkpoint.number} of ${checkpoint.of}`;
// Spec 3 S3-06 zAatf
export const GIVEN_RUNNING_COUNT = 'Running count';
export const GIVEN_DECKS = 'Decks remaining';
export const TRUE_COUNT_LABEL = 'True count';
export const TRUE_COUNT_PROMPT = 'Enter the true count';
export const keepCounting = (checkpoint: { readonly number: number; readonly card: number }) => `Keep the count. Checkpoint ${checkpoint.number} comes after card ${checkpoint.card}.`;

// Spec 3 Learn, Check and assistance › Malformed input; S3-06 C53yTW
export type CountProblem = 'empty' | 'sign-only' | 'not-whole' | 'out-of-range';

export type ParsedCount = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly problem: CountProblem };

export function parseCount(text: string, range: CountRange): ParsedCount {
  const trimmed = text.trim().replace(/[−–]/g, '-');
  if (trimmed === '') return { ok: false, problem: 'empty' };
  if (trimmed === '-' || trimmed === '+') return { ok: false, problem: 'sign-only' };
  if (!/^[+-]?\d+$/.test(trimmed)) return { ok: false, problem: 'not-whole' };
  const value = Number(trimmed);
  if (value < range.min || value > range.max) return { ok: false, problem: 'out-of-range' };
  return { ok: true, value: value === 0 ? 0 : value };
}

const NOTHING_SUBMITTED = "Nothing was submitted, and it doesn't count against you.";

export const countProblemText = (problem: CountProblem, range: CountRange) =>
  ({
    empty: `Enter a count first. ${NOTHING_SUBMITTED}`,
    'sign-only': `Add a number after the sign. ${NOTHING_SUBMITTED}`,
    'not-whole': `Enter a whole number. ${NOTHING_SUBMITTED}`,
    'out-of-range': `Enter a count from ${signed(range.min)} to ${signed(range.max)}. ${NOTHING_SUBMITTED}`,
  })[problem];

export const toggleSign = (text: string) => (text.startsWith('−') ? `+${text.slice(1)}` : text.startsWith('+') ? text.slice(1) : `−${text}`);

// Spec 3 Learn, Check and assistance › Show/hide running count; S3-04 qdnQm, S3-05 EDnGd
export const SHOW_COUNT = 'Show running count';
export function countAidDetail(variant: ChallengeVariant, revealed: boolean, showing: boolean): string {
  if (showing) return variant === 'check' ? 'Showing. This attempt is marked assisted.' : 'Showing. Learn notes that you showed it.';
  if (variant === 'learn') return 'Hidden. Learn notes whether you showed it.';
  return revealed ? 'Hidden. This attempt is already marked assisted; showing it again changes nothing.' : 'Hidden. Showing it marks this whole attempt assisted, permanently.';
}
export const REVEAL_WARNING = {
  title: 'Show the running count?',
  lead: "Showing it marks this whole attempt as assisted, permanently. Hiding it again won't undo that.",
  detail:
    "Assisted attempts still get full results, but they're kept apart from unassisted records and can't count toward a readiness milestone. Showing the count doesn't use another attempt.",
  keep: 'Keep it hidden',
  show: 'Show count and mark assisted',
} as const;

// Spec 3 Learn, Check and assistance › Answer accepted
export const recordedText = (entered: ChallengeEntry, category: ChallengeCategory) => {
  const next = category === 'conversion' ? 'Next question in a moment.' : 'Next card in a moment.';
  if (entered === 'skip') return `Skip recorded. ${next}`;
  if (category === 'conversion') return `True count ${signed(entered)} recorded. ${next}`;
  return category === 'running-count' ? `Count ${signed(entered)} recorded. ${next}` : `Answer recorded. ${next}`;
};

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

// Spec 3 S3-08 cX5Gc
export function completedText(
  groupKey: { readonly variant: ChallengeVariant; readonly assistanceClass: AssistanceClass; readonly category?: ChallengeCategory; readonly length?: number },
  assistanceStep: number | null,
) {
  // Spec 3 S3-08 e5MASr
  const table = groupKey.category === 'table' && groupKey.length !== undefined;
  const rounds = (title: string) => (table ? title.replace('Completed · ', `Completed · ${completedRounds(groupKey.length as number)} · `) : title);
  if (groupKey.assistanceClass !== 'assisted-check') {
    const completed = COMPLETED[groupKey.variant];
    return { ...completed, title: rounds(completed.title) };
  }
  const when = assistanceStep === null || table ? '' : ` at card ${assistanceStep}`;
  return {
    title: rounds('Completed · assisted'),
    detail: `You showed the running count${when}, which marks the whole attempt assisted. It's compared only with other assisted attempts at these settings.`,
    note: null,
  };
}

export const ASSISTED_NOTE = {
  title: 'No milestone or personal best for unassisted Check',
  detail: "Assisted attempts don't advance the readiness streak, and they don't break it either.",
} as const;

export const resultsNote = (variant: ChallengeVariant, allowance: AllowanceCopy | undefined) => [COMPLETED[variant].note, allowance?.results].filter(Boolean).join(' ');
export const SCORES_LABEL = 'SKILL SCORES · FIRST ANSWERS';
export const REVIEW_LABEL: Record<ChallengeCategory, string> = { 'card-values': 'Review cards', 'running-count': 'Review checkpoints', conversion: 'Review questions', table: 'Review checkpoints' };
// TODO(#135)
export const RETRY_LABEL: Record<ChallengeCategory, string> = {
  'card-values': 'Retry with new cards',
  'running-count': 'Retry with a new shuffle',
  conversion: 'Retry with new questions',
  table: RETRY_WITH_NEW_SHOE,
};

const checkpoints = (total: number) => `${total} ${total === 1 ? 'checkpoint' : 'checkpoints'}`;

export const RESULT_ROWS: readonly { readonly metric: ChallengeMetric; readonly title: string; readonly tested: (total: number, variant: ChallengeVariant, category: ChallengeCategory) => string }[] = [
  { metric: 'card-values', title: 'Card values', tested: (total) => `${total} cards` },
  { metric: 'running-count', title: 'Running count', tested: (total, variant, category) => (variant === 'check' || category === 'table' ? checkpoints(total) : `${total} cards`) },
  // Spec 3 S3-08 e5MASr, Amendment 2 §3
  { metric: 'true-count', title: 'True count', tested: (total, _variant, category) => (category === 'table' ? checkpoints(total) : `${total} questions`) },
];

// Spec 3 S3-08 cX5Gc
export const resultRows = (metrics: Readonly<Record<ChallengeMetric, MetricResult | null>>) => [...RESULT_ROWS].sort((a, b) => Number(metrics[b.metric] !== null) - Number(metrics[a.metric] !== null));

export const NOT_TESTED = 'Not tested';

export const scoreText = (result: MetricResult | null) => (result ? `${result.correct} / ${result.total}` : 'N/A');

export const spokenScore = (result: MetricResult | null) => (result ? `${result.correct} of ${result.total}` : 'N/A');

// Spec 3 S3-09 h0MsKr, BjuKf; Scoring and review › Review facts
export const REVIEW_TITLE: Record<ChallengeCategory, string> = { 'card-values': 'Card review', 'running-count': 'Checkpoint review', conversion: 'Question review', table: 'Checkpoint review' };
export const YOU_LABEL = 'You';
export const CORRECT_LABEL = 'Correct';
export const ERROR_LABEL = 'Error';
export const SUGGESTED_LESSON = 'Suggested after this attempt';
export const SKIPPED = 'Skipped';

export type ReviewOutcome = 'match' | 'off' | 'skipped';

const REVIEW_OUTCOME: Record<ReviewOutcome, { readonly status: (off: number) => string; readonly spoken: (off: number) => string }> = {
  match: { status: () => 'Match', spoken: () => 'match' },
  off: { status: (off) => `Off by ${off}`, spoken: (off) => `off by ${off}` },
  skipped: { status: () => 'Skipped · incorrect', spoken: () => 'counts as incorrect' },
};

export interface ReviewRowText {
  readonly outcome: ReviewOutcome;
  readonly title: string;
  readonly status: string;
  readonly entered: string;
  readonly reference: string;
  readonly error: string | null;
  readonly label: string;
}

export function reviewText(fact: ReviewFact, variant: ChallengeVariant): ReviewRowText {
  const { entered, reference } = fact;
  const outcome: ReviewOutcome = entered === 'skip' ? 'skipped' : entered === reference ? 'match' : 'off';
  const off = entered === 'skip' ? 0 : Math.abs(entered - reference);
  const { status, spoken } = REVIEW_OUTCOME[outcome];
  const spokenEntry = entered === 'skip' ? 'skipped' : `you entered ${spokenValue(entered)}`;
  const shared = { outcome, status: status(off), entered: entered === 'skip' ? SKIPPED : signed(entered), reference: signed(reference) };
  if (fact.kind === 'card-value') {
    return { ...shared, title: `Card ${fact.position} · ${cardName(fact.card)}`, error: null, label: `Card ${fact.position}, ${cardName(fact.card)}: ${spokenEntry}, correct ${spokenValue(reference)}, ${spoken(off)}` };
  }
  if (fact.kind === 'conversion') return questionText(fact, shared, `${spokenEntry}, correct ${spokenValue(reference)}`, spoken(off));
  if (fact.kind === 'table') {
    const title = tableCheckpointTitle(fact);
    const error = fact.error === null ? '—' : signed(fact.error);
    return { ...shared, title, error, label: `${title}: ${spokenEntry}, correct ${spokenValue(reference)}${fact.error === null ? '' : `, error ${spokenValue(fact.error)}`}, ${spoken(off)}` };
  }
  return checkpointText(fact, variant, shared, `${spokenEntry}, correct ${spokenValue(reference)}`, spoken(off));
}

// Spec 3 Scoring and review › Review facts (conversion)
function questionText(fact: ConversionReview, shared: Omit<ReviewRowText, 'title' | 'error' | 'label'>, said: string, outcome: string): ReviewRowText {
  const title = `Question ${fact.position} · ${signed(fact.running)} ÷ ${decksText(fact.decks)}`;
  const spokenTitle = `Question ${fact.position}, ${spokenValue(fact.running)} divided by ${decksText(fact.decks)}`;
  const error = fact.error === null ? '—' : signed(fact.error);
  const spokenError = fact.error === null ? '' : `, error ${spokenValue(fact.error)}`;
  return { ...shared, title, error, label: `${spokenTitle}: ${said}${spokenError}, ${outcome}` };
}

function checkpointText(fact: RunningCountReview, variant: ChallengeVariant, shared: Omit<ReviewRowText, 'title' | 'error' | 'label'>, said: string, outcome: string): ReviewRowText {
  const title = variant === 'check' ? `Checkpoint ${fact.checkpoint} · after card ${fact.position}` : `After card ${fact.position}`;
  const spokenTitle = variant === 'check' ? `Checkpoint ${fact.checkpoint}, after card ${fact.position}` : `After card ${fact.position}`;
  const error = fact.error === null ? '—' : signed(fact.error);
  const spokenError = fact.error === null ? '' : `, error ${spokenValue(fact.error)}`;
  return { ...shared, title, error, label: `${spokenTitle}: ${said}${spokenError}, ${outcome}` };
}

// Spec 3 Scoring and review › Attribution
export function driftText(review: readonly ReviewFact[], variant: ChallengeVariant): string | null {
  const drift = variant === 'check' ? runningCountDrift(review) : null;
  if (!drift) return null;
  const amount = Math.abs(drift.error);
  return `From checkpoint ${drift.from} on, your count ran ${amount} ${drift.error > 0 ? 'above' : 'below'} the reference. One early miss likely carried through. Each checkpoint still counts as its own error.`;
}

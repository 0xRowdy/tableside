// Spec 3 S3-07, S3-02 ZreSb, FkMDw, S3-09 VToCp; #137, #138

import { blackjackHouseEdge, blackjackPreset, type BlackjackPreset } from '@tableside/definitions';
import {
  scheduleUnits,
  tableCheckpointRounds,
  type BlackjackAction,
  type ChallengeFinances,
  type ChallengeEntry,
  type ChallengeVariant,
  type PlayChoice,
  type PlayCorrection,
  type PlayFundingProblem,
  type TableBetCorrection,
  type TableBetReview,
  type TableCountReview,
  type TableDecisionReview,
  type TableGroupKey,
  type TableHandView,
  type TableRunningExplanation,
  type TableView,
} from '@tableside/engine';

import { playAdvice, playCorrectionCopy, upName } from '../play/blackjack-coaching';
import type { CorrectionCopy } from '../play/coaching-text';

import { cardRank, signed, SUIT_GLYPH } from '../play/blackjack-text';
import { formatSigned, formatUnits, halfUnits } from '../play/units';

const presetText = (dealer: 'S17' | 'H17', lateSurrender: boolean) => `${dealer} ${lateSurrender ? 'LS' : 'no LS'}`;
const players = (count: number) => `${count} ${count === 1 ? 'player' : 'players'}`;

// Spec 3 S3-10 OVKkc
export const tableGroupTitle = (table: TableGroupKey) => `Table counting · ${table.seat === 'observe' ? 'Observe' : 'Play'}`;
export const tableSettingsText = (table: TableGroupKey) =>
  [
    ...(table.countingMode ? [MODE_TEXT[table.countingMode]] : []),
    presetText(table.dealer, table.lateSurrender),
    `${table.penetration}%`,
    players(table.extraPlayers),
    `N = ${table.checkpointInterval}`,
    // Spec 3 Comparison groups; #139
    ...(table.betSchedule ? ['bet schedule'] : []),
    ...(table.baseWager === null ? [] : [`base ${formatUnits(table.baseWager)}`]),
    ...(table.startingBalance === null ? [] : [`balance ${formatUnits(table.startingBalance)}`]),
  ].join(' · ');

// Spec 3 S3-02 FkMDw, S3-07 qRHlC
const MODE_TEXT = { basic: 'with basic', deviations: 'with deviations' } as const;
const SEAT_TEXT = { observe: 'Observe', play: 'Play' } as const;

// Spec 3 S3-08 e5MASr
export const resultsSubtitle = (variant: ChallengeVariant, seat: TableGroupKey['seat'] = 'observe') => `Table counting · ${variant === 'learn' ? 'Learn' : 'Check'} · ${SEAT_TEXT[seat]}`;
export const TABLE_LEARN_DETAIL =
  'Learn scores your first answer at each checkpoint, even when you corrected it afterwards. Learn attempts never count toward a readiness milestone.';

export function tableSubtitle(variant: ChallengeVariant, table: Pick<TableView, 'rules' | 'interval' | 'seat' | 'countingMode'>): string {
  const variantText = variant === 'learn' ? 'Learn' : 'Check';
  // Spec 3 S3-07 qRHlC
  if (table.countingMode === 'deviations') return [variantText, SEAT_TEXT[table.seat], MODE_TEXT.deviations, `N = ${table.interval}`].join(' · ');
  return [variantText, SEAT_TEXT[table.seat], presetText(table.rules.dealer, table.rules.lateSurrender), `${table.rules.penetration}%`, ...(table.rules.extraPlayers > 0 ? [players(table.rules.extraPlayers)] : []), `N = ${table.interval}`].join(' · ');
}

export const edgeText = (rules: TableView['rules']) => `Edge with basic strategy: ${blackjackHouseEdge(blackjackPreset(rules.dealer, rules.lateSurrender)).percent}% (this preset)`;

export const YOUR_SEAT = 'YOUR SEAT';
export const SIMULATED = 'Simulated';
export const YOU_PLAY = 'You';
export const ROUND_LABEL = 'ROUND';
export const ROUND_SPOKEN = 'Round';
export const YOUR_SEAT_SPOKEN = 'Your seat';
export const roundOf = (table: Pick<TableView, 'round' | 'rounds'>) => `${table.round} of ${table.rounds}`;
export const PHASES = ['Bet', 'Deal', 'Play', 'Settle'] as const;

export type TableStatus = 'observing' | 'checkpoint' | 'shuffled' | 'feedback' | 'dealing' | 'deciding' | 'check-deciding' | 'count-first' | 'correction' | 'betting';
export const STATUS_TEXT: Record<TableStatus, string> = {
  observing: 'Observing',
  checkpoint: 'Count checkpoint',
  shuffled: 'Shoe reshuffled',
  feedback: 'Learn feedback',
  dealing: 'Dealing',
  deciding: 'Your move',
  // Spec 3 S3-07 kLgWV
  'check-deciding': 'Check · your move',
  'count-first': 'Count before your move',
  correction: 'Correction',
  // Spec 3 S3-07 fiCRg, qvatd; #139
  betting: 'Choose your bet',
};

export const decksText = (table: Pick<TableView, 'decks' | 'step'>) => (table.step === 'shuffle' ? `Decks remaining: ${table.decks}` : `${table.decks} decks left`);
export const DEALER = 'DEALER';
export const seatName = (seat: number) => `Seat ${seat}`;

const ACTION_TEXT: Record<BlackjackAction | 'insure', string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender', 'decline-insurance': 'No insurance', insure: 'Insured' };
export const seatActionText = (action: BlackjackAction | 'insure', seat: TableView['seat'] = 'observe') => `${seat === 'play' ? 'You' : 'Seat'}: ${ACTION_TEXT[action]}`;

const RESULT_TEXT = { win: 'won', loss: 'lost', push: 'push' } as const;
export function handText(hand: TableHandView): string {
  const total = hand.total.value > 21 ? 'Bust' : hand.surrendered ? 'Surrendered' : hand.result ? String(hand.total.value) : `${hand.total.soft ? 'Soft' : 'Hard'} ${hand.total.value}`;
  return hand.result && !hand.surrendered && hand.total.value <= 21 ? `${total} · ${RESULT_TEXT[hand.result]}` : total;
}

// Spec 3 S3-07 v82z3
export const OBSERVE_KICKER = 'OBSERVE · NO DECISIONS';
export const KEEP_THE_COUNT = 'Keep the count';
export const observeText = (table: Pick<TableView, 'rules' | 'interval' | 'nextCheckpointRound'>) =>
  `A simulated player sits in your seat, betting the table minimum of ${table.rules.minimum} and playing basic strategy. Cards appear one at a time; the next waits for you. With N = ${table.interval} your next checkpoint is after round ${table.nextCheckpointRound}.`;

// Spec 3 Count checkpoints (table); S3-07 bh8oE, xjtSW
const listText = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export function checkpointTitle(prompt: NonNullable<TableView['prompt']>, round: number): string {
  if (prompt.timing === 'decision') return 'Before your decision: true count';
  if (prompt.timing === 'before-bet') return `Checkpoint before round ${round}’s bet`;
  return prompt.timing === 'after-round' ? `Checkpoint after round ${round}` : `Block checkpoint after round ${round}`;
}

export function checkpointText(table: Pick<TableView, 'prompt' | 'interval' | 'rounds'>): string {
  const prompt = table.prompt as NonNullable<TableView['prompt']>;
  if (prompt.timing === 'decision') return 'Enter the true count, then choose your move.';
  if (prompt.timing === 'before-bet') return 'Enter the running and true count before this round’s bet. The round waits until you submit or skip.';
  if (prompt.timing === 'after-round') return 'Enter the running count, including the dealer’s last card. The next round waits until you submit or skip.';
  return `N = ${table.interval}: enter the running and true count after rounds ${listText(tableCheckpointRounds(table.interval, table.rounds).map(String))}. Other count prompts are off. The next round waits until you submit or skip.`;
}

export const RUNNING_COUNT = 'Running count';
export const TRUE_COUNT = 'True count';
export const NEXT_TRUE_COUNT = 'Next: true count';

// Spec 3 S3-07 qRHlC; Amendment 1 A3
export const DECISION_PROMPT_NOTE = 'This prompt means the decision depends on the count. It never shows the right move, the index or the reference count.';

export function tableRecordedText(entered: ChallengeEntry, count: 'running' | 'true', trueCountNext: boolean, moveNext = false): string {
  const next = trueCountNext ? 'The true count is next.' : moveNext ? 'Your move is next.' : 'The table carries on in a moment.';
  return entered === 'skip' ? `Skip recorded. ${next}` : `${count === 'running' ? RUNNING_COUNT : TRUE_COUNT} ${signed(entered)} recorded. ${next}`;
}

// Spec 3 S3-07 heGUV
export const NEW_SHOE = 'NEW SHOE';
export const SHUFFLED_TITLE = 'The shoe was reshuffled';
export const shuffledText = (round: number) =>
  `The cut card came out in round ${round - 1}. That round finished, then the shoe was shuffled. The running count starts again at 0 and decks remaining is back to 6. Checkpoints carry on as before.`;
export const continueText = (round: number, interval: number) => (interval === 1 ? `Continue to round ${round}’s checkpoint` : `Continue to round ${round}`);

// Spec 3 S3-07 AcmMa
export const enteredLine = (entered: ChallengeEntry, count: 'running' | 'true', reference: number) =>
  `${entered === 'skip' ? 'YOU SKIPPED' : `YOU ENTERED ${signed(entered)}`} · ${count === 'running' ? 'RUNNING' : 'TRUE'} COUNT IS ${signed(reference)}`;
export const RUNNING_KICKER = 'RUNNING COUNT';
export const runningHeadline = (count: number) => `The running count is ${signed(count)}.`;
export const ONLY_FIRST_SCORED = 'Only your first answer is scored. The next card waits until the count is right.';
export const TRY_AGAIN = 'Try again';
export const SHOW_ANSWER = 'Show answer';
export const CONTINUE = 'Continue';

export function tableRunningText(explanation: TableRunningExplanation, timing: NonNullable<TableView['prompt']>['timing']): string {
  const { cards, values, before, count, shuffled, round } = explanation;
  const afterRound = timing !== 'before-bet';
  const start = shuffled ? 'The shoe was reshuffled, so the count started again at 0' : `The count was ${signed(before)} before ${afterRound ? 'the round' : 'that'}`;
  if (cards.length === 0) return `No cards have been exposed since then. ${start}, so it’s still ${signed(count)}.`;
  const which = afterRound ? `Round ${round}’s exposed cards were` : 'The cards exposed since your last running count were';
  const sum = values.reduce((total: number, value) => total + value, 0);
  return `${which} ${listText(cards.map((card) => `${cardRank(card)}${SUIT_GLYPH[card.suit]}`))}: ${values.map(signed).join(', ')} adds up to ${signed(sum)}. ${start}, so it’s ${signed(count)} now.`;
}

// Spec 3 Scoring and review › Review facts (table); S3-09
const TIMING_TEXT = {
  'before-bet': (round: number) => `before round ${round}’s bet`,
  'after-round': (round: number) => `after round ${round}`,
  block: (round: number) => `after round ${round}`,
  decision: (round: number) => `round ${round}, before the decision`,
} as const;
export const tableCheckpointTitle = (fact: TableCountReview) =>
  // Spec 3 S3-09 VToCp
  fact.timing === 'decision' ? `Round ${fact.round} · true count before the decision` : `Checkpoint ${fact.checkpoint} · ${TIMING_TEXT[fact.timing](fact.round)} · ${fact.count === 'running' ? 'running' : 'true'} count`;
export const RETRY_WITH_NEW_SHOE = 'Retry with a new shoe';

// Spec 3 S3-08 e5MASr
export const completedRounds = (rounds: number) => `${rounds} of ${rounds} rounds`;

// Spec 3 S3-02 FkMDw; #138
export const COUNTING_MODE = 'COUNTING MODE';
export const WITH_BASIC = 'With basic';
export const WITH_DEVIATIONS = 'With deviations';
export const MODE_HELP = 'With deviations also asks for the true count at each count-dependent decision.';
export const CHECK_PLAY_HELP = 'Check holds all feedback until the end. Illegal moves are still refused straight away.';
export const PLAY_NOTICE = {
  title: 'A balance just for this attempt',
  detail: 'You bet from this attempt’s own balance and make every playing decision. Your scores are counting, playing and, with the bet schedule, betting accuracy; winnings never count.',
} as const;

// Spec 3 Play challenge funding (#20); S3-02 FkMDw, Al6Pw; #139
export const BETTING = 'BETTING';
export const BET_SCHEDULE_TITLE = 'Hi-Lo bet schedule';
export const BET_SCHEDULE_DETAIL = '1 / 2 / 4 / 6 / 8 units by true count. Scored separately from play and counting.';
export const BASE_WAGER = 'Base wager';
export const STARTING_BALANCE = 'Starting balance';
export const tableLimitsHelp = (min: string, max: string) => `Table limits ${formatUnits(min)}–${formatUnits(max)}.`;
export const STARTING_BALANCE_HELP = 'Just for this attempt. No rebuys. Never added to your practice totals.';
export const FIX_ONE_SETTING = 'Fix one setting to start';
export const NOTHING_STARTED = 'Nothing has started and no attempt has been used.';
export function fundingProblemText(problem: PlayFundingProblem, startingBalance: string): string {
  switch (problem.problem) {
    case 'short':
      return `${formatUnits(startingBalance)} can’t cover the opening wager of ${formatUnits(problem.opening)}. Enter at least ${formatUnits(problem.opening)}.`;
    case 'not-whole':
      return 'Enter a whole number of units, at least 1.';
    case 'over-ceiling':
      return `Enter at most ${formatUnits(problem.most)}.`;
    case 'outside-limits':
      return `Enter a whole number from ${formatUnits(problem.min)} to ${formatUnits(problem.max)}.`;
    case 'schedule-over-maximum':
      return `The schedule’s top wager would be ${formatUnits(problem.top)}, over the table maximum of ${formatUnits(problem.max)}. Enter at most ${formatUnits(problem.most)}.`;
  }
}
export const START_UNAVAILABLE_SHORT = 'Start is unavailable until the starting balance covers the opening wager.';
export const START_UNAVAILABLE = 'Start is unavailable until the settings above are fixed.';

// Spec 3 Play challenge funding; S3-07 fiCRg, qvatd; Amendment 2 §3; #139
export const ATTEMPT_BALANCE = 'ATTEMPT BALANCE';
export const ATTEMPT_BALANCE_SPOKEN = 'Attempt balance';
export const betLabel = (amount: string) => `Bet ${formatUnits(amount)}`;
export const BET_KICKER = 'PLAY · YOUR BET';
export const OPENING_WAGER = 'Your opening wager';
export const betText = (round: number) => `Choose round ${round}’s opening wager. The bet schedule sizes it by the true count, and betting adherence scores your first choice.`;
export const CHECK_BET_NOTE = 'During Check, Tableside won’t say which amount the strategy would choose, or whether yours matches it.';
export const FUNDING_KICKER = 'FUNDING';
export const FUNDING_TITLE = 'Your balance can’t cover every opening wager';
const orList = (items: readonly string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);
export const fundingText = (balance: string, amounts: readonly string[]) => `Balance ${formatUnits(balance)}. Legal opening wagers you can afford: ${orList(amounts.map(formatUnits))}. Choose one to keep playing.`;
// Spec 3 Information hiding (funding notices and override dialogs); S3-07 qvatd; #139
export const overrideTitle = (amount: string, betSchedule: boolean) => (betSchedule ? `Place ${formatUnits(amount)} from a short balance?` : `Place ${formatUnits(amount)} as a betting override?`);
export const overrideText = (betSchedule: boolean) =>
  betSchedule
    ? 'Your balance can’t cover every opening wager. Whenever the bet schedule’s amount is more than your balance, whatever you place is recorded as a betting override, which betting adherence counts as a miss. Your counting and playing scores aren’t affected.'
    : 'Your balance can’t cover the base wager, so whatever you place now is recorded as a betting override. With no bet schedule, betting isn’t scored, and your counting and playing scores aren’t affected.';
export const placeLabel = (amount: string) => `Place ${formatUnits(amount)}`;
export const CHOOSE_ANOTHER = 'Choose another amount';
export const betBadge = (wager: string) => `Bet ${formatUnits(wager)}`;

// Spec 3 Play challenge funding › Mid-round shortfalls; S3-07 RDS5F; #139
export const FUNDS_KICKER = 'NOT ENOUGH IN THIS ATTEMPT’S BALANCE';
export const fundsRefusedText = (move: PlayChoice, needs: string, balance: string) =>
  `${MOVE_LABEL[move]} isn’t affordable: it needs ${move === 'insure' ? '' : 'another '}${formatUnits(needs)} and your balance is ${formatUnits(balance)}. Choose another move. Not having the funds is never counted against you; your play is scored against the legal fallback.`;
export const FUNDS_NOTE = 'The same applies to split and insurance. Tableside never doubles or insures for less.';

// Spec 3 Learn, Check and assistance › Learn (correction pause on a wager); #139
export function betCorrectionCopy(correction: TableBetCorrection): CorrectionCopy {
  const units = scheduleUnits(correction.trueCount);
  const chosen = formatUnits(correction.chosen);
  const prescribed = formatUnits(correction.prescribed);
  return {
    coach: 'Marcus · Learn, bet schedule',
    kicker: `Before your bet of ${chosen}`,
    headline: `At a true count of ${signed(correction.trueCount)} the schedule bets ${units} ${units === 1 ? 'unit' : 'units'}: ${prescribed}.`,
    lines: [`Your bet of ${chosen} hasn’t been placed yet.`],
    fallback: null,
    retry: `Take it back & bet ${prescribed}`,
    override: `Keep my ${chosen}`,
    note: `“Keep my ${chosen}” is recorded once as an override and scored as a betting miss.`,
    why: [],
  };
}

// Spec 3 Play challenge funding › Insufficient funds ending, Results; S3-08 ValDZ, e5MASr; #139
export const abandonedTableTitle = (round: number, rounds: number) => `Abandoned after round ${round} of ${rounds}`;
export const INSUFFICIENT_FUNDS_TITLE = 'Ended early — insufficient funds';
export const insufficientFundsText = (round: number, rounds: number) => `After round ${round} of ${rounds}, no legal opening wager was affordable. Your partial results are kept.`;
export const insufficientFundsNote = (check: boolean) =>
  check
    ? 'An ended-early attempt can’t set a personal best or earn a milestone. It also restarts progress toward the readiness milestone for these settings.'
    : 'An ended-early attempt can’t set a personal best.';
export const SKILL_FIRST = 'Your skill scores come first. Challenge finances are shown beside them, never inside them.';
export const FINANCES_LABEL = 'CHALLENGE FINANCES · NOT A SKILL SCORE';
export const FINANCES_NOTE = 'Kept in this challenge’s history only. Never added to your practice totals or training bankroll.';
export const financeValues = (finances: ChallengeFinances) => [
  { label: 'Starting', value: formatUnits(finances.startingBalance) },
  { label: 'Finishing', value: formatUnits(finances.finishingBalance) },
  { label: 'Net', value: formatSigned(finances.net) },
];
export const BETTING_ADHERENCE = 'Betting adherence';
export const bettingTested = (total: number) => `Hi-Lo bet schedule · ${total} ${total === 1 ? 'bet' : 'bets'}`;
export const NO_BET_SCHEDULE = 'No bet schedule selected';

// Spec 3 S3-09; Scoring and review › Review facts (betting, legal betting override); #139
export function betReviewText(fact: TableBetReview): { readonly outcome: 'match' | 'miss' | 'override'; readonly title: string; readonly status: string; readonly values: readonly { readonly label: string; readonly value: string }[]; readonly label: string } {
  const outcome = fact.override ? 'override' : fact.chosen === fact.prescribed ? 'match' : 'miss';
  const status = outcome === 'override' ? 'Betting override · miss' : outcome === 'match' ? 'Match' : 'Betting miss';
  const title = `Round ${fact.round} · opening wager`;
  const values = [
    { label: 'You', value: formatUnits(fact.chosen) },
    { label: REFERENCE_LABEL, value: formatUnits(fact.prescribed) },
    { label: AT_LABEL, value: `TC ${signed(fact.trueCount)}` },
  ];
  const label = `${title}: you bet ${formatUnits(fact.chosen)}, reference ${formatUnits(fact.prescribed)}${fact.override ? ', which the balance couldn’t cover' : ''}, ${status.toLowerCase()}`;
  return { outcome, title, status, values, label };
}

// Spec 3 S3-07 E3Gbeh
export const PLAY_DEAL_KICKER = 'PLAY · DEALING';
export const PLAY_DEAL_TEXT = 'Cards appear one at a time in dealing order; the next waits for you. Keep the count as they land.';

// Spec 3 S3-07 E3Gbeh, kLgWV; User stories 37, 38
export const PLAY_KICKER = 'PLAY · YOUR MOVE';
export const YOUR_MOVE = 'Your move';
export function moveText(table: TableView): string {
  const decision = table.decision as NonNullable<TableView['decision']>;
  const up = table.dealer.cards[0];
  const hands = table.seats.find((seat) => seat.learner)?.hands ?? [];
  const index = hands.findIndex((hand) => hand.target === decision.target);
  const hand = hands[index];
  const which = hands.length > 1 ? `Hand ${index + 1} of ${hands.length}: ` : 'You have ';
  const against = up ? ` against ${upName(up)}` : '';
  if (decision.kind === 'insurance') return `The dealer shows an ace. Insurance costs half your bet and pays 2:1 if the dealer has blackjack. Decide before anything else.`;
  return `${which}${hand ? `${hand.total.soft ? 'soft' : 'hard'} ${hand.total.value}` : 'your hand'}${against}. Choose a move; the next card waits for you.`;
}
export const MOVE_LABEL: Record<PlayChoice, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender', insure: 'Insure', 'decline-insurance': 'No insurance' };
export const insureLabel = (bet: string) => `Insure ${formatUnits(halfUnits(bet))}`;
export const HAND_MOVES: readonly PlayChoice[] = ['hit', 'stand', 'double', 'split', 'surrender'];
export const INSURANCE_MOVES: readonly PlayChoice[] = ['insure', 'decline-insurance'];

// Spec 3 S3-07 kLgWV
export const REFUSED_KICKER = 'THAT MOVE ISN’T AVAILABLE';
export const CHOOSE_AGAIN = 'Choose again';
export function refusedText(table: TableView, move: PlayChoice, variant: ChallengeVariant): { readonly title: string; readonly detail: string } {
  const decision = table.decision as NonNullable<TableView['decision']>;
  const hands = table.seats.find((seat) => seat.learner)?.hands ?? [];
  const hand = hands.find((candidate) => candidate.target === decision.target);
  const cards = hand?.cards.map((card) => `${cardRank(card)}${SUIT_GLYPH[card.suit]}`).join(' ') ?? '';
  const name = MOVE_LABEL[move];
  const check = variant === 'check' ? ' During a Check attempt Tableside only tells you what’s allowed. It won’t say which move is right, before or after you choose.' : '';
  if (decision.kind === 'insurance') return { title: 'Decide on insurance first.', detail: `The dealer shows an ace, so insurance comes before any other move.${check}` };
  if (move === 'insure' || move === 'decline-insurance') return { title: 'Insurance is only offered when the dealer shows an ace.', detail: `${name} isn’t a legal move here.${check}` };
  if (move === 'split') {
    if (hands.length >= 4) return { title: 'Four hands is the maximum.', detail: `You already have four hands, so Split isn’t a legal move.${check}` };
    return { title: 'You can only split two cards of the same value.', detail: `${cards} isn’t a pair, so Split isn’t a legal move.${check}` };
  }
  if (move === 'double') return { title: 'You can only double on your first two cards.', detail: `${cards} has ${hand?.cards.length ?? 0} cards, so Double isn’t a legal move.${check}` };
  if (!table.rules.lateSurrender) return { title: 'This table doesn’t offer surrender.', detail: `The rules are ${presetText(table.rules.dealer, false)}, so Surrender isn’t a legal move.${check}` };
  return { title: 'Surrender is only on your first two cards, before any split.', detail: `Surrender isn’t a legal move on this hand.${check}` };
}

// Spec 3 S3-07 j4X6V; Learn, Check and assistance › Learn; Amendment 1 B2, B4
const MODE_NAME = { basic: 'Counting with basic', deviations: 'Counting with deviations' } as const;
export function tableCorrectionCopy(correction: PlayCorrection, table: TableView): CorrectionCopy {
  const mode = table.countingMode ?? 'basic';
  const copy = playCorrectionCopy(MODE_NAME[mode], correction, { dealer: table.rules.dealer, lateSurrender: table.rules.lateSurrender }, 'kept-shown');
  return {
    ...copy,
    coach: `Marcus · Learn, ${MODE_NAME[mode].toLowerCase()}`,
    headline: playAdvice(correction.explanation),
    note: `“${copy.override}” is recorded once as an override and scored as a playing miss.`,
  };
}

// Spec 3 S3-09 VToCp, aEdMd
export const DECISION_REVIEW_TITLE = 'Decision review';
export const REFERENCE_LABEL = 'Reference';
export const AT_LABEL = 'At';
export const RESULT_LABEL = 'Result';
const handName = (fact: TableDecisionReview) => {
  if (fact.decision === 'insurance') return 'insurance';
  const total = `${fact.pair ? 'pair of ' : fact.total.soft ? 'soft ' : 'hard '}${fact.pair ? `${fact.cards[0]?.rank === 1 ? 'aces' : fact.cards[0] && fact.cards[0].rank >= 10 ? '10s' : `${fact.cards[0]?.rank}s`}` : fact.total.value}`;
  return `${total} vs ${fact.up.rank === 1 ? 'A' : Math.min(fact.up.rank, 10)}`;
};
export function decisionReviewText(fact: TableDecisionReview): { readonly outcome: 'match' | 'miss' | 'fallback'; readonly title: string; readonly status: string; readonly values: readonly { readonly label: string; readonly value: string }[]; readonly label: string } {
  const match = fact.chosen === fact.prescribed;
  const outcome = !match ? 'miss' : fact.fallback ? 'fallback' : 'match';
  const status = outcome === 'miss' ? 'Playing miss' : outcome === 'fallback' ? 'Fallback applied' : 'Match';
  const title = `Round ${fact.round} · ${handName(fact)}${fact.hands > 1 ? ` · hand ${fact.hand + 1}` : ''}${fact.fallback ? ' · fallback' : ''}`;
  const you = MOVE_LABEL[fact.chosen] + (fact.refused.length > 0 ? ' (refused)' : '');
  const values = [
    { label: 'You', value: you },
    { label: REFERENCE_LABEL, value: MOVE_LABEL[fact.prescribed] },
    fact.fallback ? { label: RESULT_LABEL, value: match ? 'Match' : 'Miss' } : { label: AT_LABEL, value: `TC ${signed(fact.trueCount)}` },
  ];
  const label = `${title}: you chose ${MOVE_LABEL[fact.chosen].toLowerCase()}${fact.refused.length > 0 ? ', which was refused as not allowed' : ''}, reference ${MOVE_LABEL[fact.prescribed].toLowerCase()}, ${status.toLowerCase()}`;
  return { outcome, title, status, values, label };
}

// Spec 3 Scoring and review › Attribution; S3-09 VToCp
export function attributionText(fact: TableDecisionReview): string | null {
  if (typeof fact.entered !== 'number' || fact.atEntered === null || fact.chosen === fact.prescribed || fact.chosen !== fact.atEntered) return null;
  const doing = { hit: 'hitting', stand: 'standing on', double: 'doubling', split: 'splitting', surrender: 'surrendering', insure: 'taking insurance', 'decline-insurance': 'declining insurance' }[fact.chosen];
  const what = fact.decision === 'insurance' ? doing : `${doing} ${handName(fact).replace(' vs ', ' against ').replace(/^hard /, '')}`;
  return `Right policy, wrong count: in round ${fact.round} you entered a true count of ${signed(fact.entered)}, and at ${signed(fact.entered)} ${what} is the right play. The miss came from the count, not the strategy. Both still count as errors.`;
}

// Spec 3 S3-02 ZreSb
export const WHO_PLAYS = 'WHO PLAYS YOUR SEAT';
export const OBSERVE = 'Observe';
export const PLAY = 'Play';
export const SEAT_HELP = 'Observe: a simulated player plays your seat at the table minimum and you keep the count. Play: you also make the playing decisions.';
export const RULE_PRESET = 'RULE PRESET';
export const PRESET_TEXT: Record<BlackjackPreset, string> = { S17_LS: 'S17 · late surrender', S17_noLS: 'S17 · no surrender', H17_LS: 'H17 · late surrender', H17_noLS: 'H17 · no surrender' };
export const DEFAULT_PRESET_DETAIL = 'Default · six decks · 3:2';
export const SHOE_AND_TABLE = 'SHOE AND TABLE';
export const PENETRATION_DETAIL = 'dealt before the shuffle · 50–80% in steps of 5';
export const playersText = (count: number) => players(count);
export const PLAYERS_DETAIL = 'extra simulated players · 0–4';
export const COUNT_CHECKPOINTS = 'COUNT CHECKPOINTS';
export const intervalText = (interval: number) => (interval === 1 ? 'Every round' : `Every ${interval} rounds`);
export const INTERVAL_DETAIL = 'N = 1 to 10';
export const INTERVAL_HELP = 'At 1 you enter the running and true count before each bet and the running count after each round. Above 1, only after every N rounds and the last partial block.';
export const OBSERVE_NOTICE = {
  title: 'No balance or decisions in Observe',
  detail: 'A simulated player sits in your seat with a fixed table-minimum wager and always has enough to play. You only keep the count.',
} as const;

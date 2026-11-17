// Spec 3 S3-07 v82z3, AcmMa, bh8oE, xjtSW, heGUV; S3-02 ZreSb; #137

import { blackjackHouseEdge, blackjackPreset, type BlackjackPreset } from '@tableside/definitions';
import { tableCheckpointRounds, type BlackjackAction, type ChallengeEntry, ChallengeVariant, TableCountReview, TableHandView, TableRunningExplanation, TableView } from '@tableside/engine';

import { cardRank, signed, SUIT_GLYPH } from '@/play/blackjack-text';

const presetText = (dealer: 'S17' | 'H17', lateSurrender: boolean) => `${dealer} ${lateSurrender ? 'LS' : 'no LS'}`;
const players = (count: number) => `${count} ${count === 1 ? 'player' : 'players'}`;

// Spec 3 S3-08 e5MASr
export const resultsSubtitle = (variant: ChallengeVariant) => `Table counting · ${variant === 'learn' ? 'Learn' : 'Check'} · Observe`;
export const TABLE_LEARN_DETAIL =
  'Learn scores your first answer at each checkpoint, even when you corrected it afterwards. Learn attempts never count toward a readiness milestone.';

export const tableSubtitle = (variant: ChallengeVariant, table: Pick<TableView, 'rules' | 'interval'>) =>
  [variant === 'learn' ? 'Learn' : 'Check', 'Observe', presetText(table.rules.dealer, table.rules.lateSurrender), `${table.rules.penetration}%`, ...(table.rules.extraPlayers > 0 ? [players(table.rules.extraPlayers)] : []), `N = ${table.interval}`].join(' · ');

export const edgeText = (rules: TableView['rules']) => `Edge with basic strategy: ${blackjackHouseEdge(blackjackPreset(rules.dealer, rules.lateSurrender)).percent}% (this preset)`;

export const YOUR_SEAT = 'YOUR SEAT';
export const SIMULATED = 'Simulated';
export const ROUND_LABEL = 'ROUND';
export const ROUND_SPOKEN = 'Round';
export const YOUR_SEAT_SPOKEN = 'Your seat';
export const roundOf = (table: Pick<TableView, 'round' | 'rounds'>) => `${table.round} of ${table.rounds}`;
export const PHASES = ['Bet', 'Deal', 'Play', 'Settle'] as const;

export type TableStatus = 'observing' | 'checkpoint' | 'shuffled' | 'feedback';
export const STATUS_TEXT: Record<TableStatus, string> = { observing: 'Observing', checkpoint: 'Count checkpoint', shuffled: 'Shoe reshuffled', feedback: 'Learn feedback' };

export const decksText = (table: Pick<TableView, 'decks' | 'step'>) => (table.step === 'shuffle' ? `Decks remaining: ${table.decks}` : `${table.decks} decks left`);
export const DEALER = 'DEALER';
export const seatName = (seat: number) => `Seat ${seat}`;

const ACTION_TEXT: Record<BlackjackAction, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender', 'decline-insurance': 'No insurance' };
export const seatActionText = (action: BlackjackAction) => `Seat: ${ACTION_TEXT[action]}`;

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
  if (prompt.timing === 'before-bet') return `Checkpoint before round ${round}’s bet`;
  return prompt.timing === 'after-round' ? `Checkpoint after round ${round}` : `Block checkpoint after round ${round}`;
}

export function checkpointText(table: Pick<TableView, 'prompt' | 'interval' | 'rounds'>): string {
  const prompt = table.prompt as NonNullable<TableView['prompt']>;
  if (prompt.timing === 'before-bet') return 'Enter the running and true count before this round’s bet. The round waits until you submit or skip.';
  if (prompt.timing === 'after-round') return 'Enter the running count, including the dealer’s last card. The next round waits until you submit or skip.';
  return `N = ${table.interval}: enter the running and true count after rounds ${listText(tableCheckpointRounds(table.interval, table.rounds).map(String))}. Other count prompts are off. The next round waits until you submit or skip.`;
}

export const RUNNING_COUNT = 'Running count';
export const TRUE_COUNT = 'True count';
export const NEXT_TRUE_COUNT = 'Next: true count';

export function tableRecordedText(entered: ChallengeEntry, count: 'running' | 'true', trueCountNext: boolean): string {
  const next = trueCountNext ? 'The true count is next.' : 'The table carries on in a moment.';
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
  const start = shuffled ? 'The shoe was reshuffled, so the count started again at 0' : `The count was ${signed(before)} before ${timing === 'after-round' ? 'the round' : 'that'}`;
  if (cards.length === 0) return `No cards have been exposed since then. ${start}, so it’s still ${signed(count)}.`;
  const which = timing === 'after-round' ? `Round ${round}’s exposed cards were` : 'The cards exposed since your last running count were';
  const sum = values.reduce((total: number, value) => total + value, 0);
  return `${which} ${listText(cards.map((card) => `${cardRank(card)}${SUIT_GLYPH[card.suit]}`))}: ${values.map(signed).join(', ')} adds up to ${signed(sum)}. ${start}, so it’s ${signed(count)} now.`;
}

// Spec 3 Scoring and review › Review facts (table); S3-09
const TIMING_TEXT = { 'before-bet': (round: number) => `before round ${round}’s bet`, 'after-round': (round: number) => `after round ${round}`, block: (round: number) => `after round ${round}` } as const;
export const tableCheckpointTitle = (fact: TableCountReview) => `Checkpoint ${fact.checkpoint} · ${TIMING_TEXT[fact.timing](fact.round)} · ${fact.count === 'running' ? 'running' : 'true'} count`;
export const RETRY_WITH_NEW_SHOE = 'Retry with a new shoe';

// Spec 3 S3-08 e5MASr
export const completedRounds = (rounds: number) => `${rounds} of ${rounds} rounds`;

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

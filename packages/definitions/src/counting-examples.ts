// Spec 3 Lessons › Structure (worked examples); Testing Decisions › Build-time check; #153
import {
  advanceChallenge,
  canonicalJson,
  canonicalShoe,
  createChallenge,
  RANDOM_PROTOCOL_VERSION,
  readChallengeView,
  type ChallengeCard,
  type ChallengeCommand,
  type ChallengeContent,
  type ChallengeState,
  type ChallengeView,
  type ConversionExplanation,
  type LearnFeedback,
  type RunningCountExplanation,
  type TableRunningExplanation,
  type TableSetup,
} from '@tableside/engine';

import { CONVERSION_CONTENT, DEFAULT_TABLE_SETUP, tableSetup, RUNNING_COUNT_CONTENT, TABLE_CONTENT } from './challenges';
import type { ScriptedChoice } from './worked-examples';

// Spec 3 S3-12 aJV2y; #144
export interface ConversionExample {
  readonly kind: 'conversion';
  readonly step: number;
  readonly running: number;
  readonly decks: number;
  readonly choices: readonly ScriptedChoice<number, ConversionExplanation>[];
}

// Spec 3 Challenge content › Running count
export interface RunningCountExample {
  readonly kind: 'running-count';
  readonly step: number;
  readonly before: number;
  readonly card: ChallengeCard;
  readonly choices: readonly ScriptedChoice<number, RunningCountExplanation>[];
}

// Spec 3 Challenge content › Table, Count checkpoints (table)
export interface TableCountExample {
  readonly kind: 'table-count';
  readonly step: number;
  readonly seat: readonly ChallengeCard[];
  readonly dealer: readonly ChallengeCard[];
  readonly choices: readonly ScriptedChoice<number, TableRunningExplanation>[];
}

export type CountingExample = ConversionExample | RunningCountExample | TableCountExample;

const SUITS: readonly string[] = ['clubs', 'diamonds', 'hearts', 'spades'];
export const isPlayingCard = (card: ChallengeCard) => Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13 && SUITS.includes(card.suit);
export const answerText = (answer: number) => (answer > 0 ? `+${answer}` : String(answer));
const SUIT_GLYPH: Readonly<Record<string, string>> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const RANK_GLYPH: Readonly<Record<number, string>> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const cardText = (card: ChallengeCard) => `${RANK_GLYPH[card.rank] ?? String(card.rank)}${SUIT_GLYPH[card.suit] ?? '?'}`;
const cardsText = (cards: readonly ChallengeCard[]) => cards.map(cardText).join(' ');
const sameCards = (a: readonly ChallengeCard[], b: readonly ChallengeCard[]) => canonicalJson(a.map(({ rank, suit }) => ({ rank, suit }))) === canonicalJson(b.map(({ rank, suit }) => ({ rank, suit })));

class UndealtRound extends Error {}

// Spec 3 Challenge content › Conversion
const RUNNING_LIMIT = CONVERSION_CONTENT.maxRunningCount;
const isRunning = (value: number) => Number.isInteger(value) && Math.abs(value) <= RUNNING_LIMIT;
const isHalfDecks = (value: number) => Number.isInteger(value * 2) && value >= 0.5 && value <= CONVERSION_CONTENT.maxDecks;

// Spec 1 Testing Decisions (fixed-scenario fixtures)
const REPLAY_STREAM = { protocol: RANDOM_PROTOCOL_VERSION, key: [0, 0], session: [0, 0] } as const;
const SHOE = canonicalShoe(6);

function commit(state: ChallengeState, command: ChallengeCommand): ChallengeState {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `replay-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`${command.kind} was not committed`);
  return result.state;
}

const start = (content: ChallengeContent, table?: TableSetup): ChallengeState =>
  createChallenge({ attemptId: 'worked-example', owner: 'worked-example', device: 'build', variant: 'learn', content, ...(table ? { table } : {}) }, REPLAY_STREAM);

function feedbackOf(view: ChallengeView): LearnFeedback {
  if (view.variant !== 'learn' || !view.feedback) throw new Error('the replay gave no Learn feedback');
  return view.feedback;
}

function answerAndMove(state: ChallengeState, value: number): ChallengeState {
  const answered = commit(state, { kind: 'answer', value });
  if (!feedbackOf(readChallengeView(answered)).correct) throw new Error(`the replay's own answer ${answerText(value)} was marked wrong`);
  return commit(answered, { kind: 'next-item' });
}

function replayConversion(example: ConversionExample, answer: number): LearnFeedback {
  const begun = commit(start(CONVERSION_CONTENT), { kind: 'begin' });
  const stacked: ChallengeState = { ...begun, items: [{ running: example.running, decks: example.decks }, ...begun.items.slice(1)] };
  return feedbackOf(readChallengeView(commit(stacked, { kind: 'answer', value: answer })));
}

function replayRunningCount(example: RunningCountExample, answer: number): LearnFeedback {
  const begun = commit(start(RUNNING_COUNT_CONTENT), { kind: 'begin' });
  const step = Math.sign(example.before);
  const earlier = Array.from({ length: Math.abs(example.before) }, (): ChallengeCard => ({ rank: step > 0 ? 2 : 13, suit: 'clubs' }));
  const scripted = [...earlier, example.card].map((card) => ({ card }));
  let state: ChallengeState = { ...begun, items: [...scripted, ...begun.items.slice(scripted.length)] };
  earlier.forEach((_, index) => {
    state = answerAndMove(state, step * (index + 1));
  });
  return feedbackOf(readChallengeView(commit(state, { kind: 'answer', value: answer })));
}

// Spec 3 Challenge content › Table; #153
function stackedTable(example: TableCountExample): ChallengeState {
  const [seatFirst, seatSecond, ...seatDraws] = example.seat;
  const [up, hole, ...dealerDraws] = example.dealer;
  const top = [seatFirst, up, seatSecond, hole, ...seatDraws, ...dealerDraws] as ChallengeCard[];
  const remaining = SHOE.map((_, index) => index);
  const order = top.map((card) => {
    const at = remaining.findIndex((index) => SHOE[index]!.rank === card.rank && SHOE[index]!.suit === card.suit);
    if (at < 0) throw new Error(`no ${cardText(card)} left to stack`);
    return remaining.splice(at, 1)[0]!;
  });
  const setup = tableSetup(DEFAULT_TABLE_SETUP);
  const created = start(TABLE_CONTENT, setup);
  const cut = Math.floor((SHOE.length * setup.rules.penetration) / 100);
  return { ...created, table: { ...created.table!, shoe: { order: [...order, ...remaining], next: 0, cut } } };
}

function replayTable(example: TableCountExample, answer: number): LearnFeedback {
  let state = commit(stackedTable(example), { kind: 'begin' });
  for (;;) {
    const view = readChallengeView(state);
    const prompt = view.table?.prompt;
    if (view.phase === 'ended' || view.table?.round !== 1) throw new Error('the replay finished the round without asking the running count');
    if (prompt?.timing === 'after-round') {
      const seat = view.table.seats.find((candidate) => candidate.learner)?.hands.flatMap((hand) => hand.cards) ?? [];
      const dealer = view.table.dealer.cards.flatMap((card) => (card ? [card] : []));
      if (!sameCards(seat, example.seat) || !sameCards(dealer, example.dealer)) {
        throw new UndealtRound(`the table deals the seat ${cardsText(seat)} and the dealer ${cardsText(dealer)}, not the seat ${cardsText(example.seat)} and the dealer ${cardsText(example.dealer)}`);
      }
      return feedbackOf(readChallengeView(commit(state, { kind: 'answer', value: answer })));
    }
    state = view.phase === 'question' ? answerAndMove(state, 0) : commit(state, { kind: 'next-item' });
  }
}

function scriptProblems(example: CountingExample): readonly string[] {
  if (example.kind === 'conversion') {
    return [
      ...(isRunning(example.running) ? [] : [`the worked example’s running count is not a whole number from −${RUNNING_LIMIT} to +${RUNNING_LIMIT}`]),
      ...(isHalfDecks(example.decks) ? [] : [`the worked example’s decks remaining is not a half-deck value from 0.5 to ${CONVERSION_CONTENT.maxDecks}`]),
    ];
  }
  if (example.kind === 'running-count') {
    return [
      ...(isRunning(example.before) ? [] : [`the worked example’s running count before the card is not a whole number from −${RUNNING_LIMIT} to +${RUNNING_LIMIT}`]),
      ...(isPlayingCard(example.card) ? [] : ["the worked example's card is not a playing card"]),
    ];
  }
  const cards = [...example.seat, ...example.dealer];
  return [
    ...(example.seat.length < 2 || example.dealer.length < 2 ? ['the worked example deals the seat and the dealer two cards each'] : []),
    ...(cards.every(isPlayingCard) ? [] : ["the worked example's cards are not all playing cards"]),
  ];
}

const REPLAY = {
  conversion: replayConversion,
  'running-count': replayRunningCount,
  'table-count': replayTable,
} as const satisfies Record<CountingExample['kind'], (example: never, answer: number) => LearnFeedback>;

// Spec 3 Testing Decisions › Build-time check
export function countingExampleProblems(example: CountingExample): readonly string[] {
  const problems: string[] = [];
  const seen = new Set<number>();
  for (const { answer } of example.choices) {
    if (!Number.isInteger(answer)) problems.push(`worked example choice ${answerText(answer)} is not a whole number`);
    else if (seen.has(answer)) problems.push(`worked example choice ${answerText(answer)} is offered twice`);
    seen.add(answer);
  }
  if (example.choices.filter((choice) => choice.response.correct).length !== 1) problems.push('a worked example has exactly one correct choice');
  problems.push(...scriptProblems(example));
  if (problems.length > 0) return problems;

  const replay = REPLAY[example.kind] as (example: CountingExample, answer: number) => LearnFeedback;
  for (const { answer, response } of example.choices) {
    const label = `worked example, choice ${answerText(answer)}`;
    let engine: LearnFeedback;
    try {
      engine = replay(example, answer);
    } catch (error) {
      if (error instanceof UndealtRound) return [`worked example: ${error.message}`];
      problems.push(`${label}: does not replay through the engine: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (response.correct !== engine.correct) {
      problems.push(`${label}: scripted as ${response.correct ? 'correct' : 'incorrect'}, but the engine marks it ${engine.correct ? 'correct' : 'incorrect'}`);
    }
    const scripted = canonicalJson(response.explanation);
    const replayed = canonicalJson(engine.explanation);
    if (scripted !== replayed) problems.push(`${label}: the scripted explanation ${scripted} differs from the engine's ${replayed}`);
    if (response.note !== null && !response.note.trim()) problems.push(`${label}: an empty note is written as null`);
  }
  return problems;
}

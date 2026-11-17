// Spec 3 Challenge content › Table, Reshuffle, Observe seats, Information; Count checkpoints; #137

import type { DomainFact } from './activity';
import {
  BLACKJACK_RULES,
  blackjackTable,
  countOf,
  dealerFinished,
  freshShoe,
  handResult,
  handTotal,
  hiLoTag,
  isBlackjackRuleSet,
  isSeatStrategy,
  seatPositions,
  simulateRound,
  type BlackjackAction,
  type BlackjackDomainFact,
  type BlackjackHand,
  type BlackjackRuleSet,
  type HandTotal,
  type SeatStrategy,
  type Shoe,
} from './blackjack';
import type { Card, Rank, Suit } from './draws';
import { RandomStream, type RandomStreamState } from './random';
import { hasExactKeys, isCount, isText, type VersionedIdentity } from './shape';

export interface TableContent {
  readonly category: 'table';
  readonly id: string;
  readonly version: number;
  readonly rounds: number;
  readonly reference: VersionedIdentity;
}

// Spec 3 S3-02 ZreSb
export interface TableSetup {
  readonly seat: 'observe';
  readonly rules: BlackjackRuleSet;
  readonly strategy: SeatStrategy;
  readonly interval: number;
}

export interface TableProgress {
  readonly setup: TableSetup;
  readonly shoe: Shoe | null;
  readonly round: number;
}

export type CheckpointTiming = 'before-bet' | 'after-round' | 'block';

export type TableCount = 'running' | 'true';

interface TableCard {
  readonly rank: Rank;
  readonly suit: Suit;
}

export type TableEvent =
  | { readonly kind: 'played'; readonly target: string; readonly action: BlackjackAction }
  | { readonly kind: 'split'; readonly target: string; readonly into: string }
  | { readonly kind: 'peeked'; readonly result: 'no-blackjack' | 'blackjack' };

export type TableStep =
  | { readonly step: 'shuffle'; readonly round: number }
  | { readonly step: 'deal'; readonly round: number; readonly to: string; readonly face: TableCard | null; readonly events: readonly TableEvent[] }
  | { readonly step: 'reveal'; readonly round: number; readonly face: TableCard; readonly events: readonly TableEvent[] }
  | { readonly step: 'prompt'; readonly round: number; readonly checkpoint: number; readonly timing: CheckpointTiming; readonly count: TableCount };

export type TablePrompt = Extract<TableStep, { readonly step: 'prompt' }>;

export const MAX_TABLE_ROUNDS = 20;
export const MAX_CHECKPOINT_INTERVAL = 10;

// Spec 3 Learn, Check and assistance › Malformed input
const RUNNING_LIMIT = BLACKJACK_RULES.decks * 20;
export const tableCountRange = (count: TableCount) => {
  const limit = count === 'running' ? RUNNING_LIMIT : 2 * RUNNING_LIMIT;
  return { min: -limit, max: limit };
};

export function tableContentProblem(content: Record<string, unknown>): string | undefined {
  if (!hasExactKeys(content, ['category', 'id', 'version', 'rounds', 'reference'])) return 'a table content definition has a category, id, version, rounds and reference';
  if (!isText(content.id) || !isCount(content.version) || content.version < 1) return 'the content definition needs an id and a version from 1';
  const { reference, rounds } = content;
  if (!hasExactKeys(reference, ['id', 'version']) || !isText(reference.id) || !isCount(reference.version)) return 'table counting needs a blackjack reference identity';
  if (!isCount(rounds) || rounds < 1 || rounds > MAX_TABLE_ROUNDS) return `a table challenge has 1 to ${MAX_TABLE_ROUNDS} rounds`;
  return undefined;
}

export function tableSetupProblem(setup: unknown): string | undefined {
  if (!hasExactKeys(setup, ['seat', 'rules', 'strategy', 'interval'])) return 'a table setup has a seat, rules, strategy and interval';
  if (setup.seat !== 'observe') return `unsupported seat ${String(setup.seat)}`;
  if (!isBlackjackRuleSet(setup.rules)) return 'the table needs spec 1 blackjack rules';
  if (!isSeatStrategy(setup.strategy, setup.rules.lateSurrender)) return "the simulated seat needs a basic strategy for the table's rules";
  if (!isCount(setup.interval) || setup.interval < 1 || setup.interval > MAX_CHECKPOINT_INTERVAL) return `the checkpoint interval is 1 to ${MAX_CHECKPOINT_INTERVAL} rounds`;
  return undefined;
}

const cardOf = (card: Card): TableCard => ({ rank: card.rank, suit: card.suit });
const asCard = (card: TableCard): Card => ({ deck: 0, ...card });
const hiLo = (card: TableCard) => hiLoTag(asCard(card));

function stepsOf(facts: readonly DomainFact[], round: number): TableStep[] {
  const steps: TableStep[] = [];
  let events: TableEvent[] = [];
  for (const fact of facts as readonly BlackjackDomainFact[]) {
    switch (fact.kind) {
      case 'played':
        events.push({ kind: 'played', target: fact.target, action: fact.action });
        break;
      case 'hand-split':
        events.push({ kind: 'split', target: fact.target, into: fact.into });
        break;
      case 'peeked':
        events.push({ kind: 'peeked', result: fact.result });
        break;
      case 'card-dealt':
        steps.push({ step: 'deal', round, to: fact.to, face: fact.card && cardOf(fact.card), events });
        events = [];
        break;
      case 'hole-card-revealed':
        steps.push({ step: 'reveal', round, face: cardOf(fact.card), events });
        events = [];
        break;
      default:
        break;
    }
  }
  if (events.length > 0) throw new Error(`round ${round} ended with plays after its last card`);
  return steps;
}

// Spec 3 Count checkpoints (table)
export const tableCheckpointRounds = (interval: number, rounds: number): number[] =>
  Array.from({ length: rounds }, (_, index) => index + 1).filter((round) => round % interval === 0 || round === rounds);

const lastCheckpoint = (steps: readonly TableStep[]) => steps.reduce((last, step) => (step.step === 'prompt' ? step.checkpoint : last), 0);

// Spec 3 Count checkpoints (table), Reshuffle, Observe seats
export function dealTableRound(
  progress: TableProgress,
  content: TableContent,
  steps: readonly TableStep[],
  random: RandomStreamState,
): { readonly steps: TableStep[]; readonly progress: TableProgress; readonly random: RandomStreamState } {
  const { setup } = progress;
  const round = progress.round + 1;
  const rules = blackjackTable(setup.rules);
  const dealt: TableStep[] = [];
  let shoe = progress.shoe;
  if (shoe === null || shoe.next >= shoe.cut) {
    const stream = RandomStream.restore(random);
    shoe = freshShoe(stream, rules);
    random = stream.state();
    if (progress.shoe !== null) dealt.push({ step: 'shuffle', round });
  }
  let checkpoint = lastCheckpoint(steps);
  const prompts = (timing: CheckpointTiming, counts: readonly TableCount[]) => {
    checkpoint++;
    for (const count of counts) dealt.push({ step: 'prompt', round, checkpoint, timing, count });
  };
  if (setup.interval === 1) prompts('before-bet', ['running', 'true']);
  const simulated = simulateRound(rules, setup.strategy, shoe, round);
  dealt.push(...stepsOf(simulated.facts, round));
  if (setup.interval === 1) prompts('after-round', ['running']);
  else if (tableCheckpointRounds(setup.interval, content.rounds).includes(round)) prompts('block', ['running', 'true']);
  return { steps: dealt, progress: { ...progress, shoe: simulated.shoe, round }, random };
}

// Spec 3 Scoring and review › Reference; Challenge content › Divisor, Information
export interface TableCountAt {
  readonly running: number;
  readonly decks: number;
  readonly trueCount: number;
}

export function tableCountAt(steps: readonly TableStep[], position: number): TableCountAt {
  let running = 0;
  let dealt = 0;
  for (let index = position; index >= 0; index--) {
    const step = steps[index] as TableStep;
    if (step.step === 'shuffle') break;
    if (step.step === 'deal') dealt++;
    if ((step.step === 'deal' || step.step === 'reveal') && step.face) running += hiLo(step.face);
  }
  const count = countOf({ running, remaining: SHOE_CARDS - dealt });
  return { running, decks: Number(count.decks), trueCount: count.trueCount };
}

const SHOE_CARDS = BLACKJACK_RULES.decks * 52;

// Spec 3 Learn, Check and assistance › Learn; S3-07 AcmMa
export interface TableRunningExplanation {
  readonly kind: 'table-running';
  readonly round: number;
  readonly cards: readonly TableCard[];
  readonly values: readonly (-1 | 0 | 1)[];
  readonly before: number;
  readonly shuffled: boolean;
  readonly count: number;
}

export function tableRunningExplanation(steps: readonly TableStep[], position: number): TableRunningExplanation {
  let start = position - 1;
  while (start >= 0) {
    const step = steps[start] as TableStep;
    if (step.step === 'shuffle' || (step.step === 'prompt' && step.count === 'running')) break;
    start--;
  }
  const from = steps[start];
  const shuffled = from?.step === 'shuffle';
  const cards = steps.slice(start + 1, position).flatMap((step) => ((step.step === 'deal' || step.step === 'reveal') && step.face ? [{ ...step.face }] : []));
  return {
    kind: 'table-running',
    round: (steps[position] as TableStep).round,
    cards,
    values: cards.map((card) => hiLo(card) as -1 | 0 | 1),
    before: from === undefined || shuffled ? 0 : tableCountAt(steps, start).running,
    shuffled,
    count: tableCountAt(steps, position).running,
  };
}

// Spec 3 Screens › Exercise (table on the 04a–04d layout); S3-07 v82z3, bh8oE, xjtSW, heGUV
export interface TableHandView {
  readonly target: string;
  readonly cards: readonly TableCard[];
  readonly total: HandTotal;
  readonly doubled: boolean;
  readonly surrendered: boolean;
  readonly action: BlackjackAction | null;
  readonly result: 'win' | 'loss' | 'push' | null;
}

export interface TableSeatView {
  readonly seat: number;
  readonly learner: boolean;
  readonly hands: readonly TableHandView[];
}

export interface TableView {
  readonly seat: 'observe';
  readonly round: number;
  readonly rounds: number;
  readonly interval: number;
  readonly nextCheckpointRound: number;
  readonly rules: { readonly dealer: 'S17' | 'H17'; readonly lateSurrender: boolean; readonly penetration: number; readonly extraPlayers: number; readonly minimum: string };
  readonly step: TableStep['step'];
  readonly prompt: { readonly checkpoint: number; readonly timing: CheckpointTiming; readonly count: TableCount } | null;
  readonly decks: number;
  readonly dealer: { readonly cards: readonly (TableCard | null)[]; readonly total: HandTotal | null; readonly peek: 'no-blackjack' | 'blackjack' | null };
  readonly seats: readonly TableSeatView[];
  readonly settled: boolean;
}

interface WorkHand {
  target: string;
  cards: TableCard[];
  doubled: boolean;
  surrendered: boolean;
  action: BlackjackAction | null;
}

// Spec 3 Information hiding (end to end)
export function tableView(progress: TableProgress, content: TableContent, steps: readonly TableStep[], position: number): TableView {
  const { setup } = progress;
  const rules = blackjackTable(setup.rules);
  const current = steps[position] as TableStep;
  const round = current.round;
  const places = seatPositions(rules);
  const hand = (target: string): WorkHand => ({ target, cards: [], doubled: false, surrendered: false, action: null });
  const seats = [...places.others.map((seat) => ({ seat, learner: false, hands: [hand(`seat-${seat}-hand-1`)] })), { seat: places.learner, learner: true, hands: [hand('hand-1')] }].sort(
    (a, b) => a.seat - b.seat,
  );
  const handOf = (target: string) => seats.flatMap((seat) => seat.hands).find((candidate) => candidate.target === target) as WorkHand;
  const dealer: (TableCard | null)[] = [];
  let peek: 'no-blackjack' | 'blackjack' | null = null;
  let revealed = false;
  for (let index = 0; index <= position; index++) {
    const step = steps[index] as TableStep;
    if (step.round !== round || (step.step !== 'deal' && step.step !== 'reveal')) continue;
    for (const event of step.events) {
      if (event.kind === 'peeked') peek = event.result;
      else if (event.kind === 'played') {
        const played = handOf(event.target);
        played.action = event.action;
        if (event.action === 'double') played.doubled = true;
        if (event.action === 'surrender') played.surrendered = true;
      } else {
        const seat = seats.find((candidate) => candidate.hands.some((h) => h.target === event.target)) as (typeof seats)[number];
        const at = seat.hands.findIndex((h) => h.target === event.target);
        const split = seat.hands[at] as WorkHand;
        seat.hands.splice(at + 1, 0, { ...hand(event.into), cards: [split.cards.pop() as TableCard] });
      }
    }
    if (step.step === 'reveal') {
      dealer[1] = { ...step.face };
      revealed = true;
    } else if (step.to === 'dealer') dealer.push(step.face && { ...step.face });
    else handOf(step.to).cards.push({ ...(step.face as TableCard) });
  }
  const visible = dealer.flatMap((card) => (card ? [asCard(card)] : []));
  const asHands = (hands: readonly WorkHand[]): BlackjackHand[] => hands.map((h) => ({ target: h.target, cards: h.cards.map(asCard), doubled: h.doubled, surrendered: h.surrendered, done: true }));
  const settled = revealed && dealerFinished(visible, seats.map((seat) => asHands(seat.hands)), rules.dealer);
  const prompt = current.step === 'prompt' ? { checkpoint: current.checkpoint, timing: current.timing, count: current.count } : null;
  return {
    seat: setup.seat,
    round,
    rounds: content.rounds,
    interval: setup.interval,
    nextCheckpointRound: setup.interval === 1 ? round : Math.min(Math.ceil(round / setup.interval) * setup.interval, content.rounds),
    rules: { dealer: rules.dealer, lateSurrender: rules.lateSurrender, penetration: rules.penetration, extraPlayers: rules.players.otherWagers.length, minimum: rules.limits.initial.min },
    step: current.step,
    prompt,
    decks: tableCountAt(steps, position).decks,
    dealer: { cards: dealer, total: visible.length > 0 ? handTotal(visible) : null, peek },
    seats: seats.map((seat) => {
      const hands = asHands(seat.hands);
      return {
        seat: seat.seat,
        learner: seat.learner,
        hands: seat.hands.map((h, index) => ({
          target: h.target,
          cards: h.cards,
          total: handTotal(h.cards.map(asCard)),
          doubled: h.doubled,
          surrendered: h.surrendered,
          action: h.action,
          result: settled ? handResult(hands[index] as BlackjackHand, hands, visible) : null,
        })),
      };
    }),
    settled,
  };
}

export const copyTableSetup = (setup: TableSetup): TableSetup => JSON.parse(JSON.stringify(setup)) as TableSetup;

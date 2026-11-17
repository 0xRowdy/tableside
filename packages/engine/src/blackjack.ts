// docs/development.md Game rules spec 1 leaves open
import type { ActivityStateBase, BlackjackPermittedView, Command, CommandKind, DomainFact, GameCommand, GameModule, PendingCorrection, PermittedViewBase, Step, StrategyView, Wager } from './activity';
import { canonicalShoe, shuffle, type Card, type Rank, type Suit } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import type { BlackjackPlayPolicy } from './blackjack-strategy';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, parseMoney, type Limit, type VersionedIdentity } from './shape';

export const BLACKJACK_RULES = { id: 'blackjack-six-deck', version: 1, decks: 6 } as const;

export const PENETRATIONS: readonly number[] = [50, 55, 60, 65, 70, 75, 80];

export const MAX_OTHER_PLAYERS = 4;

export const MAX_SPLIT_HANDS = 4;

const SHOE: readonly Card[] = canonicalShoe(BLACKJACK_RULES.decks);

export interface SeatStrategy {
  readonly first: { readonly hard: readonly string[]; readonly soft: readonly string[]; readonly pair: readonly string[] };
  readonly pairWithoutSurrender: readonly string[];
  readonly pairAtCap: readonly string[];
  readonly later: { readonly hard: readonly string[]; readonly soft: readonly string[] };
  readonly laterWithoutDouble: { readonly hard: readonly string[]; readonly soft: readonly string[] };
}

export interface BlackjackPlayers {
  readonly learnerSeat: number;
  readonly otherWagers: readonly string[];
  readonly strategy: SeatStrategy | null;
}

export interface BlackjackTable {
  readonly decks: typeof BLACKJACK_RULES.decks;
  readonly dealer: 'S17' | 'H17';
  readonly lateSurrender: boolean;
  readonly penetration: number;
  readonly limits: { readonly initial: Limit };
  readonly players: BlackjackPlayers;
}

export interface BlackjackRuleSet extends VersionedIdentity, BlackjackTable {}

export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'decline-insurance';
const ACTIONS: readonly BlackjackAction[] = ['hit', 'stand', 'double', 'split', 'surrender', 'decline-insurance'];

export type BlackjackCommand = GameCommand | Extract<Command, { readonly kind: 'play' }>;

export type BlackjackIllegalActionReason =
  'action-not-available';

export type BlackjackDomainFact =
  | { readonly kind: 'shoe-shuffled'; readonly cards: number; readonly cut: number }
  | { readonly kind: 'card-dealt'; readonly turn: number; readonly to: string; readonly card: Card | null }
  | { readonly kind: 'insurance-offered'; readonly turn: number; readonly max: string; readonly evenMoney: boolean }
  | { readonly kind: 'peeked'; readonly turn: number; readonly result: 'no-blackjack' | 'blackjack' }
  | { readonly kind: 'hole-card-revealed'; readonly turn: number; readonly card: Card }
  | { readonly kind: 'played'; readonly turn: number; readonly target: string; readonly action: BlackjackAction }
  | { readonly kind: 'hand-split'; readonly turn: number; readonly target: string; readonly into: string }
  | {
      readonly kind: 'seat-settled';
      readonly turn: number;
      readonly target: string;
      readonly stake: string;
      readonly result: 'win' | 'loss' | 'push';
      readonly net: string;
    };

export interface Shoe {
  readonly order: readonly number[];
  readonly next: number;
  readonly cut: number;
}

export interface BlackjackHand {
  readonly target: string;
  readonly cards: readonly Card[];
  readonly doubled: boolean;
  readonly surrendered: boolean;
  readonly done: boolean;
}

export type Peek = 'not-needed' | 'pending' | 'no-blackjack' | 'blackjack';

export type Insurance = 'not-offered' | 'offered' | 'declined' | 'insured';

export interface BlackjackSeat {
  readonly seat: number;
  readonly hands: readonly BlackjackHand[];
}

export interface BlackjackRound {
  readonly dealer: readonly Card[];
  readonly holeRevealed: boolean;
  readonly peek: Peek;
  readonly insurance: Insurance;
  readonly hands: readonly BlackjackHand[];
  readonly active: number | null;
  readonly others: readonly BlackjackSeat[];
}

export interface BlackjackActivityState extends ActivityStateBase<'blackjack'> {
  readonly rules: BlackjackTable;
  readonly outcome: BlackjackRound | null;
  readonly shoe: Shoe | null;
}

export interface HandTotal {
  readonly value: number;
  readonly soft: boolean;
}

export interface BlackjackHandView {
  readonly target: string;
  readonly cards: readonly Card[];
  readonly total: HandTotal;
  readonly doubled: boolean;
  readonly surrendered: boolean;
  readonly natural: boolean;
  readonly busted: boolean;
  readonly done: boolean;
}

export interface BlackjackRoundView {
  readonly turn: number;
  readonly dealer: {
    readonly cards: readonly (Card | null)[];
    readonly total: HandTotal;
    readonly peek: Peek;
  };
  readonly insurance: Insurance;
  readonly hands: readonly BlackjackHandView[];
  readonly active: number | null;
  readonly others: readonly { readonly seat: number; readonly wager: string; readonly hands: readonly BlackjackHandView[] }[];
}

export interface BlackjackShoeView {
  readonly cards: number;
  readonly remaining: number;
  readonly shuffleBeforeNextRound: boolean;
}

export interface BlackjackTableView {
  readonly decks: number;
  readonly dealer: 'S17' | 'H17';
  readonly lateSurrender: boolean;
  readonly penetration: number;
  readonly initial: Limit;
  readonly blackjackPays: '3:2';
  readonly players: { readonly learnerSeat: number; readonly otherWagers: readonly string[] };
}

export interface BlackjackInsuranceOffer {
  readonly max: string;
  readonly evenMoney: boolean;
}

const TABLE_KEYS = ['decks', 'dealer', 'lateSurrender', 'penetration', 'limits', 'players'];
const STRATEGY_ROWS = {
  firstHard: 17,
  firstSoft: 9,
  pairs: 10,
  laterHard: 18,
  laterSoft: 10,
} as const;

const isRows = (value: unknown, count: number, letters: string): value is string[] =>
  Array.isArray(value) && value.length === count && value.every((row) => typeof row === 'string' && row.length === 10 && [...row].every((c) => letters.includes(c)));

export function isSeatStrategy(value: unknown, lateSurrender: boolean): value is SeatStrategy {
  const surrender = lateSurrender ? 'R' : '';
  if (!hasExactKeys(value, ['first', 'pairWithoutSurrender', 'pairAtCap', 'later', 'laterWithoutDouble'])) return false;
  const { first, later, laterWithoutDouble } = value;
  return (
    hasExactKeys(first, ['hard', 'soft', 'pair']) &&
    isRows(first.hard, STRATEGY_ROWS.firstHard, `HSD${surrender}`) &&
    isRows(first.soft, STRATEGY_ROWS.firstSoft, `HSD${surrender}`) &&
    isRows(first.pair, STRATEGY_ROWS.pairs, `HSDP${surrender}`) &&
    isRows(value.pairWithoutSurrender, STRATEGY_ROWS.pairs, 'HSDP') &&
    isRows(value.pairAtCap, STRATEGY_ROWS.pairs, 'HSD') &&
    hasExactKeys(later, ['hard', 'soft']) &&
    isRows(later.hard, STRATEGY_ROWS.laterHard, 'HSD') &&
    isRows(later.soft, STRATEGY_ROWS.laterSoft, 'HSD') &&
    hasExactKeys(laterWithoutDouble, ['hard', 'soft']) &&
    isRows(laterWithoutDouble.hard, STRATEGY_ROWS.laterHard, 'HS') &&
    isRows(laterWithoutDouble.soft, STRATEGY_ROWS.laterSoft, 'HS')
  );
}

function withinInitial(text: unknown, limit: Limit): boolean {
  const amount = parseMoney(text);
  return amount !== undefined && amount.d === 1n && compare(amount, decodeMoney(limit.min)) >= 0 && compare(amount, decodeMoney(limit.max)) <= 0;
}

function isPlayers(value: unknown, limit: Limit, lateSurrender: boolean): value is BlackjackPlayers {
  if (!hasExactKeys(value, ['learnerSeat', 'otherWagers', 'strategy']) || !Array.isArray(value.otherWagers)) return false;
  const others = value.otherWagers as unknown[];
  if (others.length > MAX_OTHER_PLAYERS || !others.every((wager) => withinInitial(wager, limit))) return false;
  if (!isCount(value.learnerSeat) || value.learnerSeat > others.length) return false;
  return others.length === 0 ? value.strategy === null : isSeatStrategy(value.strategy, lateSurrender);
}

const isTable = (value: unknown, extra: readonly string[]): value is BlackjackTable =>
  hasExactKeys(value, [...TABLE_KEYS, ...extra]) &&
  value.decks === BLACKJACK_RULES.decks &&
  (value.dealer === 'S17' || value.dealer === 'H17') &&
  typeof value.lateSurrender === 'boolean' &&
  PENETRATIONS.includes(value.penetration as number) &&
  hasExactKeys(value.limits, ['initial']) &&
  isLimit(value.limits.initial) &&
  isPlayers(value.players, value.limits.initial, value.lateSurrender);

export const isBlackjackTable = (value: unknown): value is BlackjackTable => isTable(value, []);

export const isBlackjackRuleSet = (value: unknown): value is BlackjackRuleSet =>
  isTable(value, ['id', 'version']) &&
  (value as BlackjackRuleSet).id === BLACKJACK_RULES.id &&
  (value as BlackjackRuleSet).version === BLACKJACK_RULES.version;

const copyStrategy = (s: SeatStrategy): SeatStrategy => ({
  first: { hard: [...s.first.hard], soft: [...s.first.soft], pair: [...s.first.pair] },
  pairWithoutSurrender: [...s.pairWithoutSurrender],
  pairAtCap: [...s.pairAtCap],
  later: { hard: [...s.later.hard], soft: [...s.later.soft] },
  laterWithoutDouble: { hard: [...s.laterWithoutDouble.hard], soft: [...s.laterWithoutDouble.soft] },
});

export const blackjackTable = (rules: BlackjackRuleSet): BlackjackTable => ({
  decks: rules.decks,
  dealer: rules.dealer,
  lateSurrender: rules.lateSurrender,
  penetration: rules.penetration,
  limits: { initial: { min: rules.limits.initial.min, max: rules.limits.initial.max } },
  players: {
    learnerSeat: rules.players.learnerSeat,
    otherWagers: [...rules.players.otherWagers],
    strategy: rules.players.strategy && copyStrategy(rules.players.strategy),
  },
});

const cutIndex = (table: Pick<BlackjackTable, 'penetration'>) => Math.floor((SHOE.length * table.penetration) / 100);

const learnerPosition = (rules: BlackjackTable) => rules.players.learnerSeat + 1;
const otherPositions = (rules: BlackjackTable) => rules.players.otherWagers.map((_, k) => (k < rules.players.learnerSeat ? k + 1 : k + 2));

export const cardValue = (card: Card): number => (card.rank >= 10 ? 10 : card.rank);

export function handTotal(cards: readonly Card[]): HandTotal {
  const hard = cards.reduce((sum, card) => sum + cardValue(card), 0);
  const soft = cards.some((card) => card.rank === 1) && hard + 10 <= 21;
  return { value: soft ? hard + 10 : hard, soft };
}

const isNatural = (cards: readonly Card[]) => cards.length === 2 && handTotal(cards).value === 21;
const busted = (cards: readonly Card[]) => handTotal(cards).value > 21;
const isPair = (cards: readonly Card[]) => cards.length === 2 && cardValue(cards[0] as Card) === cardValue(cards[1] as Card);
const naturalIn = (hand: { readonly cards: readonly Card[] }, hands: readonly unknown[]) => hands.length === 1 && isNatural(hand.cards);
const splitAce = (hand: { readonly cards: readonly Card[] }, hands: readonly unknown[]) => hands.length > 1 && hand.cards[0]?.rank === 1;

const playing = (state: BlackjackActivityState) => state.phase === 'open-decision' && state.outcome?.active != null;

function legal(state: BlackjackActivityState): CommandKind[] {
  switch (state.phase) {
    case 'open-decision':
      if (!playing(state)) return ['place-wager', 'begin-turn', 'stop-strategy', 'request-stop', 'rebuy'];
      return state.outcome?.insurance === 'offered' ? ['play', 'place-wager', 'rebuy'] : ['play', 'rebuy'];
    case 'revealing-outcome':
      return ['settle-turn', 'stop-strategy', 'request-stop'];
    case 'settled-outcome':
      return ['place-wager', 'begin-turn', 'stop-strategy', 'request-stop', 'rebuy'];
    case 'final-settlement':
      return ['advance-final-settlement'];
    case 'completed':
    case 'correction':
    case 'cycle-completion':
    case 'strategy-settlement':
      return [];
  }
}

export const isBlackjackAction = (value: unknown): value is BlackjackAction => ACTIONS.includes(value as BlackjackAction);

export function rulesOffer(cards: readonly Card[], hands: number, lateSurrender: boolean): BlackjackAction[] {
  const two = cards.length === 2;
  const actions: BlackjackAction[] = ['hit', 'stand'];
  if (two) actions.push('double');
  if (isPair(cards) && hands < MAX_SPLIT_HANDS) actions.push('split');
  if (lateSurrender && two && hands === 1) actions.push('surrender');
  return actions;
}

function offeredActions(round: BlackjackRound, rules: BlackjackTable): BlackjackAction[] {
  if (round.active === null) return [];
  if (round.insurance === 'offered') return ['decline-insurance'];
  return rulesOffer((round.hands[round.active] as BlackjackHand).cards, round.hands.length, rules.lateSurrender);
}

export const hiLoTag = (card: Card) => (card.rank >= 2 && card.rank <= 6 ? 1 : card.rank >= 7 && card.rank <= 9 ? 0 : -1);

export function shoeCount(state: Pick<BlackjackActivityState, 'shoe' | 'outcome'>): { running: number; remaining: number } {
  const { shoe, outcome } = state;
  if (shoe === null) return { running: 0, remaining: SHOE.length };
  let running = 0;
  for (let i = 0; i < shoe.next; i++) running += hiLoTag(SHOE[shoe.order[i] as number] as Card);
  if (outcome !== null && !outcome.holeRevealed) running -= hiLoTag(outcome.dealer[1] as Card);
  return { running, remaining: SHOE.length - shoe.next };
}

const halfDecksLeft = (remaining: number) => Math.max(1, Math.floor((remaining + 13) / 26));

// Spec 3 Challenge content › Conversion; Amendment 1 B3
export function truncatedTrueCount(running: number, halfDecks: number): number {
  const quotient = Math.floor(Math.abs(2 * running) / halfDecks);
  return running < 0 && quotient > 0 ? -quotient : quotient;
}

export const trueCount = (running: number, remaining: number): number => truncatedTrueCount(running, halfDecksLeft(remaining));

export interface BlackjackCount {
  readonly running: number;
  readonly decks: string;
  readonly trueCount: number;
}

export const countOf = (shoe: { readonly running: number; readonly remaining: number }): BlackjackCount => ({
  running: shoe.running,
  decks: String(halfDecksLeft(shoe.remaining) / 2),
  trueCount: trueCount(shoe.running, shoe.remaining),
});

export function decisionShoe(state: Pick<BlackjackActivityState, 'shoe' | 'outcome'>): { running: number; remaining: number } {
  const { shoe, outcome } = state;
  return outcome?.active == null && (shoe === null || shoe.next >= shoe.cut) ? { running: 0, remaining: SHOE.length } : shoeCount(state);
}

// Spec 1 Counting
export const referenceCount = (state: Pick<BlackjackActivityState, 'shoe' | 'outcome'>): BlackjackCount => countOf(decisionShoe(state));

const countSupplied = (state: BlackjackActivityState) =>
  state.strategy !== null && state.strategy.status !== 'stopped' && (state.strategy.definition.play as { count?: unknown } | undefined)?.count === 'supplied';

type BlackjackStep = Step<BlackjackActivityState>;

export const HAND_TARGET = 'hand-1';
export const INSURANCE_TARGET = 'insurance';

class Dealer {
  next: number;
  constructor(readonly shoe: Shoe) {
    this.next = shoe.next;
  }
  card(): Card {
    const index = this.shoe.order[this.next];
    if (index === undefined) throw new RangeError('the shoe ran out mid-round');
    this.next++;
    return SHOE[index] as Card;
  }
  done(): Shoe {
    return { ...this.shoe, next: this.next };
  }
}

interface WorkHand {
  target: string;
  cards: Card[];
  doubled: boolean;
  surrendered: boolean;
  done: boolean;
}

interface WorkRound {
  dealer: Card[];
  holeRevealed: boolean;
  peek: Peek;
  insurance: Insurance;
  hands: WorkHand[];
  active: number | null;
  others: { seat: number; hands: WorkHand[] }[];
}

const thawHand = (hand: BlackjackHand): WorkHand => ({ ...hand, cards: [...hand.cards] });
const thaw = (round: BlackjackRound): WorkRound => ({
  ...round,
  dealer: [...round.dealer],
  hands: round.hands.map(thawHand),
  others: round.others.map((seat) => ({ seat: seat.seat, hands: seat.hands.map(thawHand) })),
});

class Table {
  readonly facts: DomainFact[] = [];
  constructor(
    readonly round: WorkRound,
    readonly dealer: Dealer,
    readonly turn: number,
    readonly rules: BlackjackTable,
  ) {}

  deal(hand: WorkHand): Card {
    const card = this.dealer.card();
    hand.cards.push(card);
    this.facts.push({ kind: 'card-dealt', turn: this.turn, to: hand.target, card });
    return card;
  }

  played(target: string, action: BlackjackAction) {
    this.facts.push({ kind: 'played', turn: this.turn, target, action });
  }

  peek() {
    const up = this.round.dealer[0] as Card;
    if (up.rank !== 1 && up.rank < 10) {
      this.round.peek = 'not-needed';
      return;
    }
    const result = isNatural(this.round.dealer.slice(0, 2)) ? 'blackjack' : 'no-blackjack';
    this.round.peek = result;
    this.facts.push({ kind: 'peeked', turn: this.turn, result });
  }

  nextHand(hands: WorkHand[]): number | null {
    for (const [index, hand] of hands.entries()) {
      if (hand.done) continue;
      if (hand.cards.length === 1) {
        this.deal(hand);
        if (splitAce(hand, hands) || handTotal(hand.cards).value >= 21) hand.done = true;
        if (hand.done) continue;
      }
      return index;
    }
    return null;
  }

  split(hands: WorkHand[], index: number, into: string) {
    const hand = hands[index] as WorkHand;
    const second = hand.cards.pop() as Card;
    hands.splice(index + 1, 0, { target: into, cards: [second], doubled: false, surrendered: false, done: false });
    this.facts.push({ kind: 'hand-split', turn: this.turn, target: hand.target, into });
  }

  proceed() {
    const round = this.round;
    if (round.insurance === 'offered') {
      round.active = 0;
      return;
    }
    if (round.peek === 'blackjack') return this.finish();
    const me = learnerPosition(this.rules);
    for (const seat of round.others) if (seat.seat < me) this.playSeat(seat);
    const next = this.nextHand(round.hands);
    if (next !== null) {
      round.active = next;
      return;
    }
    for (const seat of round.others) if (seat.seat > me) this.playSeat(seat);
    this.finish();
  }

  playSeat(seat: { seat: number; hands: WorkHand[] }, strategy = this.rules.players.strategy as SeatStrategy, target = (n: number) => `seat-${seat.seat}-hand-${n}`) {
    const up = cardValue(this.round.dealer[0] as Card);
    for (let index = this.nextHand(seat.hands); index !== null; index = this.nextHand(seat.hands)) {
      const hand = seat.hands[index] as WorkHand;
      const action = seatAction(strategy, hand.cards, seat.hands.length, up);
      this.played(hand.target, action);
      switch (action) {
        case 'stand':
          hand.done = true;
          break;
        case 'hit':
          this.deal(hand);
          hand.done = handTotal(hand.cards).value >= 21;
          break;
        case 'double':
          hand.doubled = true;
          this.deal(hand);
          hand.done = true;
          break;
        case 'surrender':
          hand.surrendered = true;
          hand.done = true;
          break;
        case 'split':
          this.split(seat.hands, index, target(seat.hands.length + 1));
          this.deal(hand);
          if (splitAce(hand, seat.hands) || handTotal(hand.cards).value >= 21) hand.done = true;
          break;
        case 'decline-insurance':
          break;
      }
    }
  }

  finish() {
    const round = this.round;
    round.active = null;
    round.holeRevealed = true;
    this.facts.push({ kind: 'hole-card-revealed', turn: this.turn, card: round.dealer[1] as Card });
    const players = [round.hands, ...round.others.map((seat) => seat.hands)];
    const live =
      round.peek !== 'blackjack' &&
      players.some((hands) => hands.some((hand) => !busted(hand.cards) && !hand.surrendered && !naturalIn(hand, hands)));
    if (!live) return;
    for (;;) {
      const total = handTotal(round.dealer);
      if (total.value > 17 || (total.value === 17 && !(total.soft && this.rules.dealer === 'H17'))) break;
      const card = this.dealer.card();
      round.dealer.push(card);
      this.facts.push({ kind: 'card-dealt', turn: this.turn, to: 'dealer', card });
    }
  }
}

const LETTER_ACTIONS: Readonly<Record<string, BlackjackAction>> = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' };
const letterAt = (rows: readonly string[], row: number, up: number) => LETTER_ACTIONS[(rows[row] as string)[up - 1] as string] as BlackjackAction;

function seatAction(strategy: SeatStrategy, cards: readonly Card[], count: number, up: number): BlackjackAction {
  const two = cards.length === 2;
  const total = handTotal(cards);
  if (isPair(cards)) {
    const value = cardValue(cards[0] as Card) - 1;
    let action = letterAt(strategy.first.pair, value, up);
    if (action === 'surrender' && count > 1) action = letterAt(strategy.pairWithoutSurrender, value, up);
    if (action === 'split' && count >= MAX_SPLIT_HANDS) action = letterAt(strategy.pairAtCap, value, up);
    return action;
  }
  if (two && count === 1) return total.soft ? letterAt(strategy.first.soft, total.value - 12, up) : letterAt(strategy.first.hard, total.value - 4, up);
  const later = total.soft ? letterAt(strategy.later.soft, total.value - 12, up) : letterAt(strategy.later.hard, total.value - 4, up);
  if (later !== 'double' || two) return later;
  return total.soft ? letterAt(strategy.laterWithoutDouble.soft, total.value - 12, up) : letterAt(strategy.laterWithoutDouble.hard, total.value - 4, up);
}

function apply(state: BlackjackActivityState, command: BlackjackCommand): BlackjackStep {
  switch (command.kind) {
    case 'place-wager':
      return playing(state) ? insure(state, command.target, decodeMoney(command.amount)) : placeWager(state, command.target, decodeMoney(command.amount));
    case 'begin-turn':
      return beginRound(state);
    case 'play':
      return play(state, command.action);
    case 'settle-turn': {
      const { balance, facts } = settle(state);
      return { change: { phase: 'settled-outcome', balance, wagers: [] }, facts };
    }
    case 'request-stop': {
      const facts: DomainFact[] = [{ kind: 'stop-requested', phase: state.phase }];
      if (state.phase === 'revealing-outcome') return { change: { phase: 'final-settlement' }, facts };
      let balance = decodeMoney(state.balance);
      for (const wager of state.wagers) {
        balance = add(balance, decodeMoney(wager.amount));
        facts.push({ kind: 'wager-returned', target: wager.target, amount: wager.amount });
      }
      return { change: { phase: 'final-settlement', balance: encodeMoney(balance), wagers: [] }, facts };
    }
    case 'advance-final-settlement': {
      const { balance, facts } = settle(state);
      facts.push({ kind: 'activity-completed', balance });
      return { change: { phase: 'completed', balance, wagers: [] }, facts };
    }
  }
}

function placeWager(state: BlackjackActivityState, target: string, amount: Money): BlackjackStep {
  if (target !== HAND_TARGET) return { illegal: 'unknown-target' };
  const existing = state.wagers.find((wager) => wager.target === target);
  const previous = existing ? decodeMoney(existing.amount) : money(0n);
  if (amount.n === 0n && !existing) return { illegal: 'no-wager-to-remove' };
  if (amount.n !== 0n) {
    const limit = state.rules.limits.initial;
    if (amount.d !== 1n) return { illegal: 'not-whole-units' };
    if (compare(amount, decodeMoney(limit.min)) < 0) return { illegal: 'below-minimum' };
    if (compare(amount, decodeMoney(limit.max)) > 0) return { illegal: 'above-maximum' };
  }
  const balance = sub(decodeMoney(state.balance), sub(amount, previous));
  if (balance.n < 0n) return { illegal: 'insufficient-funds' };
  return {
    change: { phase: 'open-decision', balance: encodeMoney(balance), wagers: amount.n === 0n ? [] : [{ target, amount: encodeMoney(amount) }] },
    facts: [{ kind: 'wager-changed', target, amount: encodeMoney(amount), previous: encodeMoney(previous) }],
  };
}

const HALF = money(1n, 2n);
const TWO = money(2n);

const insuranceMax = (wagers: readonly Wager[]) => mul(decodeMoney((wagers[0] as Wager).amount), HALF);

// Spec 3 Challenge content › Reshuffle; Spec 1 Game rules
export const freshShoe = (stream: RandomStream, rules: Pick<BlackjackTable, 'penetration'>): Shoe => ({
  order: shuffle(stream, SHOE.map((_, index) => index)),
  next: 0,
  cut: cutIndex(rules),
});

function openRound(rules: BlackjackTable, shoe: Shoe, turn: number): Table {
  const empty = (target: string): WorkHand => ({ target, cards: [], doubled: false, surrendered: false, done: false });
  const round: WorkRound = {
    dealer: [],
    holeRevealed: false,
    peek: 'not-needed',
    insurance: 'not-offered',
    hands: [empty(HAND_TARGET)],
    active: null,
    others: otherPositions(rules).map((seat) => ({ seat, hands: [empty(`seat-${seat}-hand-1`)] })),
  };
  const table = new Table(round, new Dealer(shoe), turn, rules);
  const seated = [...round.others.map((seat) => ({ position: seat.seat, hand: seat.hands[0] as WorkHand })), { position: learnerPosition(rules), hand: round.hands[0] as WorkHand }].sort(
    (a, b) => a.position - b.position,
  );
  for (const { hand } of seated) table.deal(hand);
  round.dealer.push(table.dealer.card());
  table.facts.push({ kind: 'card-dealt', turn, to: 'dealer', card: round.dealer[0] as Card });
  for (const { hand } of seated) table.deal(hand);
  round.dealer.push(table.dealer.card());
  table.facts.push({ kind: 'card-dealt', turn, to: 'dealer', card: null });
  for (const { hand } of seated) hand.done = isNatural(hand.cards);
  return table;
}

export interface SimulatedRound {
  readonly outcome: BlackjackRound;
  readonly shoe: Shoe;
  readonly facts: readonly DomainFact[];
}

// Spec 3 Challenge content › Observe seats
export function simulateRound(rules: BlackjackTable, strategy: SeatStrategy, shoe: Shoe, turn: number): SimulatedRound {
  const table = openRound(rules, shoe, turn);
  const round = table.round;
  table.peek();
  if (round.peek !== 'blackjack') {
    const me = learnerPosition(rules);
    const seats = [...round.others, { seat: me, hands: round.hands }].sort((a, b) => a.seat - b.seat);
    for (const seat of seats) {
      if (seat.seat === me) table.playSeat(seat, strategy, (n) => `hand-${n}`);
      else table.playSeat(seat);
    }
  }
  table.finish();
  return { outcome: round, shoe: table.dealer.done(), facts: table.facts };
}

// Spec 1 Game rules
export const seatPositions = (rules: BlackjackTable): { readonly learner: number; readonly others: readonly number[] } => ({ learner: learnerPosition(rules), others: otherPositions(rules) });

// Spec 1 Game rules
export function dealerFinished(dealer: readonly Card[], players: readonly (readonly { readonly cards: readonly Card[]; readonly surrendered: boolean }[])[], rule: BlackjackTable['dealer']): boolean {
  const live = players.some((hands) => hands.some((hand) => !busted(hand.cards) && !hand.surrendered && !naturalIn(hand, hands)));
  const total = handTotal(dealer);
  return !live || isNatural(dealer.slice(0, 2)) || total.value > 17 || (total.value === 17 && !(total.soft && rule === 'H17'));
}

// Spec 1 Game rules
export const handResult = (hand: BlackjackHand, hands: readonly BlackjackHand[], dealer: readonly Card[]): 'win' | 'loss' | 'push' =>
  resultOf(handNet(hand, hands, { dealer } as BlackjackRound, money(1n)));

function beginRound(state: BlackjackActivityState): BlackjackStep {
  if (state.wagers.length === 0) return { illegal: 'no-wager' };
  const facts: DomainFact[] = [];
  let shoe = state.shoe;
  let random = state.random;
  if (shoe === null || shoe.next >= shoe.cut) {
    const stream = RandomStream.restore(state.random);
    shoe = freshShoe(stream, state.rules);
    random = stream.state();
    facts.push({ kind: 'shoe-shuffled', cards: SHOE.length, cut: shoe.cut });
  }
  const turn = state.turn + 1;
  facts.push({ kind: 'turn-began', turn, wagers: state.wagers });
  const table = openRound(state.rules, shoe, turn);
  const round = table.round;
  facts.push(...table.facts.splice(0));

  if ((round.dealer[0] as Card).rank === 1) {
    round.insurance = 'offered';
    round.peek = 'pending';
    facts.push({ kind: 'insurance-offered', turn, max: encodeMoney(insuranceMax(state.wagers)), evenMoney: (round.hands[0] as WorkHand).done });
  } else {
    table.peek();
  }
  table.proceed();
  facts.push(...table.facts);
  return {
    change: { phase: round.active === null ? 'revealing-outcome' : 'open-decision', turn, shoe: table.dealer.done(), outcome: round, random },
    facts,
  };
}

function insure(state: BlackjackActivityState, target: string, amount: Money): BlackjackStep {
  if (target !== INSURANCE_TARGET) return { illegal: 'unknown-target' };
  if (amount.n === 0n) return { illegal: 'no-wager-to-remove' };
  const max = insuranceMax(state.wagers);
  if (compare(amount, max) > 0) return { illegal: 'above-maximum' };
  if (amount.d !== 1n && compare(amount, max) !== 0) return { illegal: 'not-whole-units' };
  let balance = sub(decodeMoney(state.balance), amount);
  if (balance.n < 0n) return { illegal: 'insufficient-funds' };
  const table = new Table(thaw(state.outcome as BlackjackRound), new Dealer(state.shoe as Shoe), state.turn, state.rules);
  const stake = encodeMoney(amount);
  table.facts.push({ kind: 'wager-changed', target, amount: stake, previous: '0' });
  table.round.insurance = 'insured';
  table.peek();
  const won = table.round.peek === 'blackjack';
  const net = won ? mul(amount, TWO) : neg(amount);
  const returned = won ? add(amount, net) : money(0n);
  balance = add(balance, returned);
  table.facts.push({
    kind: 'wager-settled',
    turn: state.turn,
    target,
    stake,
    result: won ? 'win' : 'loss',
    net: encodeMoney(net),
    returned: encodeMoney(returned),
  });
  return carryOn(state, table, encodeMoney(balance), state.wagers);
}

function carryOn(state: BlackjackActivityState, table: Table, balance: string, wagers: readonly Wager[]): BlackjackStep {
  table.proceed();
  const round = table.round;
  const ordered = round.hands.map((hand) => wagers.find((w) => w.target === hand.target) as Wager);
  return {
    change: {
      phase: round.active === null ? 'revealing-outcome' : 'open-decision',
      outcome: round,
      shoe: table.dealer.done(),
      balance,
      wagers: ordered,
    },
    facts: table.facts,
  };
}

function play(state: BlackjackActivityState, action: BlackjackAction): BlackjackStep {
  const round = state.outcome as BlackjackRound;
  if (!offeredActions(round, state.rules).includes(action)) return { illegal: 'action-not-available' };
  const table = new Table(thaw(round), new Dealer(state.shoe as Shoe), state.turn, state.rules);
  const work = table.round;
  if (action === 'decline-insurance') {
    table.played(HAND_TARGET, action);
    work.insurance = 'declined';
    work.active = null;
    table.peek();
    return carryOn(state, table, state.balance, state.wagers);
  }
  const index = work.active as number;
  const hand = work.hands[index] as WorkHand;
  const wager = state.wagers.find((w) => w.target === hand.target) as Wager;
  const stake = decodeMoney(wager.amount);
  let balance = decodeMoney(state.balance);
  let wagers: Wager[] = [...state.wagers];
  if (action === 'double' || action === 'split') {
    balance = sub(balance, stake);
    if (balance.n < 0n) return { illegal: 'insufficient-funds' };
  }
  table.played(hand.target, action);
  work.active = null;
  switch (action) {
    case 'stand':
      hand.done = true;
      break;
    case 'hit':
      table.deal(hand);
      hand.done = handTotal(hand.cards).value >= 21;
      break;
    case 'double': {
      const doubled = encodeMoney(add(stake, stake));
      table.facts.push({ kind: 'wager-changed', target: hand.target, amount: doubled, previous: wager.amount });
      wagers = wagers.map((w) => (w.target === hand.target ? { target: w.target, amount: doubled } : w));
      hand.doubled = true;
      table.deal(hand);
      hand.done = true;
      break;
    }
    case 'surrender':
      hand.surrendered = true;
      hand.done = true;
      break;
    case 'split': {
      const into = `hand-${work.hands.length + 1}`;
      table.split(work.hands, index, into);
      table.facts.push({ kind: 'wager-changed', target: into, amount: wager.amount, previous: '0' });
      wagers.push({ target: into, amount: wager.amount });
      table.deal(hand);
      if (splitAce(hand, work.hands) || handTotal(hand.cards).value >= 21) hand.done = true;
      break;
    }
  }
  return carryOn(state, table, encodeMoney(balance), wagers);
}

const THREE_TO_TWO = money(3n, 2n);

function handNet(hand: BlackjackHand, hands: readonly BlackjackHand[], round: BlackjackRound, stake: Money): Money {
  const dealerTotal = handTotal(round.dealer).value;
  const dealerNatural = isNatural(round.dealer.slice(0, 2));
  const total = handTotal(hand.cards).value;
  if (hand.surrendered) return neg(mul(stake, HALF));
  if (naturalIn(hand, hands)) return dealerNatural ? money(0n) : mul(stake, THREE_TO_TWO);
  if (dealerNatural || total > 21) return neg(stake);
  if (dealerTotal > 21 || total > dealerTotal) return stake;
  return total === dealerTotal ? money(0n) : neg(stake);
}

const resultOf = (net: Money) => (net.n > 0n ? 'win' : net.n < 0n ? 'loss' : 'push');

function settle(state: BlackjackActivityState): { balance: string; facts: DomainFact[] } {
  const facts: DomainFact[] = [];
  if (state.wagers.length === 0) return { balance: state.balance, facts };
  const round = state.outcome as BlackjackRound;
  let balance = decodeMoney(state.balance);
  for (const wager of state.wagers) {
    const hand = round.hands.find((h) => h.target === wager.target) as BlackjackHand;
    const stake = decodeMoney(wager.amount);
    const net = handNet(hand, round.hands, round, stake);
    const returned = hand.surrendered ? add(stake, net) : net.n < 0n ? money(0n) : add(stake, net);
    balance = add(balance, returned);
    facts.push({
      kind: 'wager-settled',
      turn: state.turn,
      target: wager.target,
      stake: wager.amount,
      result: resultOf(net),
      net: encodeMoney(net),
      returned: encodeMoney(returned),
    });
  }
  round.others.forEach((seat, k) => {
    const initial = decodeMoney(state.rules.players.otherWagers[k] as string);
    for (const hand of seat.hands) {
      const stake = hand.doubled ? add(initial, initial) : initial;
      const net = handNet(hand, seat.hands, round, stake);
      facts.push({ kind: 'seat-settled', turn: state.turn, target: hand.target, stake: encodeMoney(stake), result: resultOf(net), net: encodeMoney(net) });
    }
  });
  return { balance: encodeMoney(balance), facts };
}

const handView = (hand: BlackjackHand, hands: readonly BlackjackHand[]): BlackjackHandView => ({
  target: hand.target,
  cards: hand.cards.map((card) => ({ ...card })),
  total: handTotal(hand.cards),
  doubled: hand.doubled,
  surrendered: hand.surrendered,
  natural: naturalIn(hand, hands),
  busted: busted(hand.cards),
  done: hand.done,
});

function view(
  state: BlackjackActivityState,
): Omit<BlackjackPermittedView, keyof PermittedViewBase> & Pick<BlackjackPermittedView, 'wagersCommitted'> {
  const { outcome: round, shoe, rules } = state;
  const deciding = round !== null && state.phase === 'open-decision';
  const offer = deciding && round.insurance === 'offered' && round.active !== null;
  return {
    game: 'blackjack',
    wagersCommitted:
      state.wagers.length > 0 && (playing(state) || (state.phase === 'correction' && round?.active != null) || state.phase === 'revealing-outcome' || state.phase === 'final-settlement'),
    playActions: deciding ? offeredActions(round, rules) : [],
    insuranceOffer: offer
      ? { max: encodeMoney(insuranceMax(state.wagers)), evenMoney: naturalIn(round.hands[0] as BlackjackHand, round.hands) }
      : null,
    outcome: round && {
      turn: state.turn,
      dealer: {
        cards: round.dealer.map((card, index) => (index === 1 && !round.holeRevealed ? null : { ...card })),
        total: handTotal(round.holeRevealed ? round.dealer : round.dealer.slice(0, 1)),
        peek: round.peek,
      },
      insurance: round.insurance,
      hands: round.hands.map((hand) => handView(hand, round.hands)),
      active: round.active,
      others: round.others.map((seat, k) => ({
        seat: seat.seat,
        wager: rules.players.otherWagers[k] as string,
        hands: seat.hands.map((hand) => handView(hand, seat.hands)),
      })),
    },
    count: countSupplied(state) ? referenceCount(state) : null,
    deviations: countSupplied(state) ? [...((state.strategy?.definition.play as BlackjackPlayPolicy | undefined)?.deviations ?? [])] : [],
    shoe: {
      cards: SHOE.length,
      remaining: shoe === null ? SHOE.length : SHOE.length - shoe.next,
      shuffleBeforeNextRound: shoe === null || shoe.next >= shoe.cut,
    },
    table: {
      decks: rules.decks,
      dealer: rules.dealer,
      lateSurrender: rules.lateSurrender,
      penetration: rules.penetration,
      initial: { min: rules.limits.initial.min, max: rules.limits.initial.max },
      blackjackPays: '3:2',
      players: { learnerSeat: rules.players.learnerSeat, otherWagers: [...rules.players.otherWagers] },
    },
  };
}

const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

const isCard = (value: unknown): value is Card =>
  hasExactKeys(value, ['deck', 'suit', 'rank']) &&
  isCount(value.deck) &&
  value.deck < BLACKJACK_RULES.decks &&
  SUITS.includes(value.suit as Suit) &&
  isCount(value.rank) &&
  (value.rank as Rank) >= 1 &&
  (value.rank as number) <= 13;

const isCards = (value: unknown, min: number): value is Card[] => Array.isArray(value) && value.length >= min && value.every(isCard);

function shoeDamage(value: unknown, rules: BlackjackTable): string | undefined {
  if (value === null) return undefined;
  if (!hasExactKeys(value, ['order', 'next', 'cut']) || !Array.isArray(value.order)) return 'damaged shoe';
  const seen = new Set<unknown>(value.order);
  const permutation = value.order.length === SHOE.length && seen.size === SHOE.length && value.order.every((i) => isCount(i) && i < SHOE.length);
  if (!permutation) return 'the shoe is not one whole six-deck shoe';
  if (!isCount(value.next) || value.next > SHOE.length || value.cut !== cutIndex(rules)) return 'damaged shoe position';
  return undefined;
}

function handsDamage(value: unknown, target: (n: number) => string): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SPLIT_HANDS) return true;
  const allowed = new Set(Array.from({ length: value.length }, (_, n) => target(n + 1)));
  const seen = new Set<unknown>();
  for (const hand of value as unknown[]) {
    if (!hasExactKeys(hand, ['target', 'cards', 'doubled', 'surrendered', 'done']) || !allowed.has(hand.target as string) || seen.has(hand.target)) return true;
    seen.add(hand.target);
    if (!isCards(hand.cards, value.length > 1 && hand.done === false ? 1 : 2)) return true;
    if (typeof hand.doubled !== 'boolean' || typeof hand.surrendered !== 'boolean' || typeof hand.done !== 'boolean') return true;
  }
  return false;
}

function roundDamage(value: unknown, rules: BlackjackTable): string | undefined {
  if (value === null) return undefined;
  if (!hasExactKeys(value, ['dealer', 'holeRevealed', 'peek', 'insurance', 'hands', 'active', 'others'])) return 'damaged round';
  if (!isCards(value.dealer, 2) || typeof value.holeRevealed !== 'boolean') return 'damaged dealer hand';
  if (!(['not-needed', 'pending', 'no-blackjack', 'blackjack'] as unknown[]).includes(value.peek)) return 'damaged peek';
  if (!(['not-offered', 'offered', 'declined', 'insured'] as unknown[]).includes(value.insurance)) return 'damaged insurance';
  if ((value.insurance === 'offered') !== (value.peek === 'pending')) return 'the peek does not match the insurance offer';
  if ((value.insurance !== 'not-offered') !== ((value.dealer[0] as Card).rank === 1)) return 'insurance does not match the up card';
  if (handsDamage(value.hands, (n) => `hand-${n}`)) return 'damaged hands';
  const positions = otherPositions(rules);
  const others = value.others;
  if (!Array.isArray(others) || others.length !== positions.length) return 'damaged seats';
  for (const [k, seat] of (others as unknown[]).entries()) {
    if (!hasExactKeys(seat, ['seat', 'hands']) || seat.seat !== positions[k]) return 'damaged seats';
    if (handsDamage(seat.hands, (n) => `seat-${positions[k]}-hand-${n}`)) return 'damaged seat hands';
  }
  const hands = value.hands as BlackjackHand[];
  if (value.insurance === 'offered' ? value.active !== 0 : value.active !== null && !(isCount(value.active) && value.active < hands.length && !hands[value.active]?.done)) {
    return 'damaged active hand';
  }
  if ((value.active === null) !== value.holeRevealed) return 'the hole card does not match the round';
  return undefined;
}

function damage(value: Record<string, unknown>): string | undefined {
  const identities = value.identities as Record<string, unknown>;
  const identity = identities.rules as VersionedIdentity;
  if (identity.id !== BLACKJACK_RULES.id || identity.version !== BLACKJACK_RULES.version) return 'the rules do not match their recorded identity';
  if (!isBlackjackTable(value.rules)) return 'damaged rules';
  const shoe = shoeDamage(value.shoe, value.rules);
  if (shoe) return shoe;
  const round = roundDamage(value.outcome, value.rules);
  if (round) return round;
  const { phase, wagers } = value;
  const r = value.outcome as BlackjackRound | null;
  const targets = r === null ? [HAND_TARGET] : r.hands.map((hand) => hand.target);
  if (!isWagerList(wagers, (target) => targets.indexOf(target))) return 'damaged wagers';
  if (value.outcome !== null && value.shoe === null) return 'a round dealt from no shoe';
  const inPlay = phase === 'open-decision' && r !== null && r.active !== null;
  const unsettled = inPlay || phase === 'revealing-outcome' || (phase === 'final-settlement' && wagers.length > 0);
  if (unsettled && r !== null && wagers.length !== r.hands.length) return 'a hand in play has no wager';
  if (!unsettled && wagers.some((wager) => wager.target !== HAND_TARGET)) return 'a split wager outside its round';
  if (phase === 'revealing-outcome' && (r === null || r.active !== null || wagers.length === 0)) return 'damaged revealing round';
  if (phase === 'final-settlement' && wagers.length > 0 && (r === null || r.active !== null)) return 'damaged final settlement';
  if ((phase === 'settled-outcome' || phase === 'completed') && wagers.length > 0) return 'wagers remain after settlement';
  return undefined;
}

// Spec 1 Counting, Amendment 9 §3
function strategyView(state: BlackjackActivityState, view: StrategyView): StrategyView {
  if (countSupplied(state)) return view;
  const hidden = <C extends PendingCorrection>(correction: C): C => {
    if ('decision' in correction) return { ...correction, explanation: { ...correction.explanation, situation: { ...correction.explanation.situation, count: null } } };
    const values = Object.fromEntries(Object.entries(correction.explanation.situation.values).filter(([name]) => name !== 'true-count'));
    return { ...correction, explanation: { ...correction.explanation, situation: { ...correction.explanation.situation, values } } };
  };
  return { ...view, correction: view.correction && hidden(view.correction), departures: view.departures.map(hidden) };
}

export const BLACKJACK: GameModule<BlackjackActivityState, BlackjackPermittedView, BlackjackCommand> = {
  ruleSets: [{ id: BLACKJACK_RULES.id, version: BLACKJACK_RULES.version }],
  extra: { shoe: null },
  pinRules: (rules) =>
    isBlackjackRuleSet(rules)
      ? blackjackTable(rules)
      : `blackjack rules need six decks, S17 or H17, a penetration of 50-80% in 5% steps, whole-unit limits from 1 to ${BASE_WAGER_CEILING} and up to ${MAX_OTHER_PLAYERS} other players with fixed wagers and a basic strategy`,
  legal,
  apply,
  view,
  strategyView,
  damage,
  turnExposure: (rules) => {
    const initial = decodeMoney(rules.limits.initial.max);
    return { stake: add(mul(initial, money(BigInt(MAX_SPLIT_HANDS * 2))), mul(initial, money(1n, 2n))), payout: money(2n) };
  },
  ownBetTarget: HAND_TARGET,
};

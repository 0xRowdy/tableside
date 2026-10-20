// The blackjack game module: six decks, 3:2 naturals, U.S. hole card with
// peek, S17 or H17 dealer, double on any first two cards including after a
// split (no double-for-less), splits of equal values (mixed tens included) up
// to four hands with non-aces resplit and split aces taking one card each,
// insurance before the peek, late surrender in LS presets, and zero to four
// simulated players. Cut card after floor(312 x penetration) cards with the
// round that reaches it finished and no burn card.
//
// Dealing order. Initial cards go round the seats from first base (the seat
// that acts first), then the dealer's up card, a second round, then the hole
// card face down. A split hand takes its second card only when its play
// begins: the hand being split takes it at once, and each hand split off waits
// until play reaches it. Hands play in seat order and, within a seat, left to
// right (a hand split off sits just right of the hand it came from).
//
// Simulated players play the pinned rule-specific basic strategy with a fixed
// initial wager and unlimited funds. They never insure. Their results are
// facts of their own, outside the learner's balance and every metric.
//
// The state keeps the whole shoe order and the hole card. The permitted view
// shows only exposed cards: the hole card is face down until the round ends,
// and a negative peek reveals no rank.

import type { ActivityStateBase, BlackjackPermittedView, Command, CommandKind, DomainFact, GameCommand, GameModule, PermittedViewBase, Step, Wager } from './activity';
import { canonicalShoe, shuffle, type Card, type Rank, type Suit } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, parseMoney, type Limit, type VersionedIdentity } from './shape';

/** The rule identity this engine can run. Dealer rule, surrender, penetration, players and limits are pinned table content. */
export const BLACKJACK_RULES = { id: 'blackjack-six-deck', version: 1, decks: 6 } as const;

/** Penetration choices, in percent of the shoe dealt before the cut card. */
export const PENETRATIONS: readonly number[] = [50, 55, 60, 65, 70, 75, 80];

/** Simulated players a table may seat besides the learner. */
export const MAX_OTHER_PLAYERS = 4;

/** Most hands one player may hold after splitting. */
export const MAX_SPLIT_HANDS = 4;

const SHOE: readonly Card[] = canonicalShoe(BLACKJACK_RULES.decks);

/**
 * A simulated player's rule-specific basic strategy, pinned as data. Each row
 * holds ten letters, one per dealer up card in the order A, 2, 3, ..., 9, 10:
 * H hit, S stand, D double, P split, R surrender.
 */
export interface SeatStrategy {
  /** The first decision on an unsplit two-card hand: hard 4-20, soft 12-20, pairs by card value A (1) to 10. */
  readonly first: { readonly hard: readonly string[]; readonly soft: readonly string[]; readonly pair: readonly string[] };
  /** A pair on a split hand, where surrender is not available. */
  readonly pairWithoutSurrender: readonly string[];
  /** A pair once four hands are reached (split unavailable by rule). */
  readonly pairAtCap: readonly string[];
  /** Later decisions (three or more cards, and split hands): hard 4-21, soft 12-21. */
  readonly later: { readonly hard: readonly string[]; readonly soft: readonly string[] };
  /** The later play when a prescribed double is unavailable (three or more cards). */
  readonly laterWithoutDouble: { readonly hard: readonly string[]; readonly soft: readonly string[] };
}

/** Who sits at the table. */
export interface BlackjackPlayers {
  /** The learner's seat counted from first base, from 0: 0 acts first, `otherWagers.length` acts last. */
  readonly learnerSeat: number;
  /** Each simulated player's fixed initial wager, in seat order without the learner. */
  readonly otherWagers: readonly string[];
  /** The basic strategy the simulated players use; null when there are none. */
  readonly strategy: SeatStrategy | null;
}

export interface BlackjackTable {
  readonly decks: typeof BLACKJACK_RULES.decks;
  /** S17: the dealer stands on all 17s. H17: the dealer hits soft 17. */
  readonly dealer: 'S17' | 'H17';
  readonly lateSurrender: boolean;
  readonly penetration: number;
  readonly limits: { readonly initial: Limit };
  readonly players: BlackjackPlayers;
}

export interface BlackjackRuleSet extends VersionedIdentity, BlackjackTable {}

/** Playing actions: the learner's, and the simulated players' (who never take decline-insurance). */
export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'decline-insurance';
const ACTIONS: readonly BlackjackAction[] = ['hit', 'stand', 'double', 'split', 'surrender', 'decline-insurance'];

/** The commands the blackjack module applies: every game command plus the playing action. */
export type BlackjackCommand = GameCommand | Extract<Command, { readonly kind: 'play' }>;

/** Why a blackjack action fails legality beyond the common reasons. */
export type BlackjackIllegalActionReason =
  /** The rules don't offer that action here (e.g. a double after the first two cards). */
  'action-not-available';

/** Blackjack's own facts. A face-down card is dealt as null: facts never carry a concealed card. */
export type BlackjackDomainFact =
  | { readonly kind: 'shoe-shuffled'; readonly cards: number; readonly cut: number }
  /** `to` is "dealer", a learner hand ("hand-2") or a simulated player's hand ("seat-1-hand-1"). */
  | { readonly kind: 'card-dealt'; readonly turn: number; readonly to: string; readonly card: Card | null }
  | { readonly kind: 'insurance-offered'; readonly turn: number; readonly max: string; readonly evenMoney: boolean }
  | { readonly kind: 'peeked'; readonly turn: number; readonly result: 'no-blackjack' | 'blackjack' }
  | { readonly kind: 'hole-card-revealed'; readonly turn: number; readonly card: Card }
  | { readonly kind: 'played'; readonly turn: number; readonly target: string; readonly action: BlackjackAction }
  /** A split: `into` is the new hand, just right of `target`. */
  | { readonly kind: 'hand-split'; readonly turn: number; readonly target: string; readonly into: string }
  /** A simulated player's hand settled: outside the learner's balance and every metric. */
  | {
      readonly kind: 'seat-settled';
      readonly turn: number;
      readonly target: string;
      readonly stake: string;
      readonly result: 'win' | 'loss' | 'push';
      readonly net: string;
    };

export interface Shoe {
  /** Canonical-shoe indices in dealing order. */
  readonly order: readonly number[];
  /** Index of the next card to deal; cards before it have left the shoe. */
  readonly next: number;
  /** The cut card sits before this index. */
  readonly cut: number;
}

export interface BlackjackHand {
  /** "hand-1" for the learner's box (later learner hands number in split order); "seat-2-hand-1" for a simulated player. */
  readonly target: string;
  /** A hand split off holds one card until its play begins. */
  readonly cards: readonly Card[];
  readonly doubled: boolean;
  readonly surrendered: boolean;
  /** No more actions: stood, doubled, surrendered, busted, a natural, 21 or a split ace. */
  readonly done: boolean;
}

/** Peek "pending": an ace is up and the insurance decision comes first. */
export type Peek = 'not-needed' | 'pending' | 'no-blackjack' | 'blackjack';

/** Insurance is offered only against an ace up, before the peek. */
export type Insurance = 'not-offered' | 'offered' | 'declined' | 'insured';

export interface BlackjackSeat {
  /** Table position from first base, from 1. */
  readonly seat: number;
  readonly hands: readonly BlackjackHand[];
}

export interface BlackjackRound {
  /** Up card, hole card, then the dealer's draws. */
  readonly dealer: readonly Card[];
  readonly holeRevealed: boolean;
  readonly peek: Peek;
  readonly insurance: Insurance;
  /** The learner's hands in play order. */
  readonly hands: readonly BlackjackHand[];
  /** The learner hand awaiting a decision (the first hand while insurance is offered), or null once the learner is done. */
  readonly active: number | null;
  /** The simulated players, in seat order. */
  readonly others: readonly BlackjackSeat[];
}

export interface BlackjackActivityState extends ActivityStateBase<'blackjack'> {
  /** The pinned table rules, not a pointer to current definitions. */
  readonly rules: BlackjackTable;
  /** The current or latest round: the turn's dealt outcome. */
  readonly outcome: BlackjackRound | null;
  /** Null until the first round shuffles. */
  readonly shoe: Shoe | null;
}

export interface HandTotal {
  readonly value: number;
  /** True when an ace counts 11. */
  readonly soft: boolean;
}

export interface BlackjackHandView {
  readonly target: string;
  readonly cards: readonly Card[];
  readonly total: HandTotal;
  readonly doubled: boolean;
  readonly surrendered: boolean;
  /** A two-card 21 on an unsplit hand; a split 21 is not blackjack. */
  readonly natural: boolean;
  readonly busted: boolean;
  readonly done: boolean;
}

/** The round as the view shows it: exposed cards only. */
export interface BlackjackRoundView {
  readonly turn: number;
  readonly dealer: {
    /** Null is the face-down hole card. */
    readonly cards: readonly (Card | null)[];
    /** Total of the exposed cards. */
    readonly total: HandTotal;
    readonly peek: Peek;
  };
  readonly insurance: Insurance;
  readonly hands: readonly BlackjackHandView[];
  readonly active: number | null;
  /** Simulated players' exposed cards, in seat order. */
  readonly others: readonly { readonly seat: number; readonly wager: string; readonly hands: readonly BlackjackHandView[] }[];
}

export interface BlackjackShoeView {
  readonly cards: number;
  /** Cards physically left in the shoe. */
  readonly remaining: number;
  /** The cut card has come out (or no shoe is shuffled yet): a fresh shoe starts the next round. */
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

/** The open insurance (or even-money) offer: insure up to `max`, whole units or exactly half the initial wager. */
export interface BlackjackInsuranceOffer {
  readonly max: string;
  /** The learner holds a natural: insuring exactly half is even money. */
  readonly evenMoney: boolean;
}

// ---- rules ----------------------------------------------------------------

const TABLE_KEYS = ['decks', 'dealer', 'lateSurrender', 'penetration', 'limits', 'players'];
const STRATEGY_ROWS = {
  firstHard: 17, // 4-20
  firstSoft: 9, // 12-20
  pairs: 10, // A-10
  laterHard: 18, // 4-21
  laterSoft: 10, // 12-21
} as const;

const isRows = (value: unknown, count: number, letters: string): value is string[] =>
  Array.isArray(value) && value.length === count && value.every((row) => typeof row === 'string' && row.length === 10 && [...row].every((c) => letters.includes(c)));

/** A well-formed seat strategy. Without late surrender it never prescribes surrender. */
function isSeatStrategy(value: unknown, lateSurrender: boolean): value is SeatStrategy {
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

/** Whole units within the initial-wager limit. */
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

/** Valid table fields; `extra` names the other keys the value may carry. */
const isTable = (value: unknown, extra: readonly string[]): value is BlackjackTable =>
  hasExactKeys(value, [...TABLE_KEYS, ...extra]) &&
  value.decks === BLACKJACK_RULES.decks &&
  (value.dealer === 'S17' || value.dealer === 'H17') &&
  typeof value.lateSurrender === 'boolean' &&
  PENETRATIONS.includes(value.penetration as number) &&
  hasExactKeys(value.limits, ['initial']) &&
  isLimit(value.limits.initial) &&
  isPlayers(value.players, value.limits.initial, value.lateSurrender);

/** Pinned table content, exactly: no missing, malformed or extra fields. */
export const isBlackjackTable = (value: unknown): value is BlackjackTable => isTable(value, []);

/** A whole rule set this engine runs: its identity plus valid table fields and nothing else. */
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

/** The pinned table content of a rule set. */
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

/** Cards dealt before the cut card: floor(312 x penetration). */
const cutIndex = (table: BlackjackTable) => Math.floor((SHOE.length * table.penetration) / 100);

/** Table positions from first base: the learner's, and each simulated player's in seat order. */
const learnerPosition = (rules: BlackjackTable) => rules.players.learnerSeat + 1;
const otherPositions = (rules: BlackjackTable) => rules.players.otherWagers.map((_, k) => (k < rules.players.learnerSeat ? k + 1 : k + 2));

// ---- totals ---------------------------------------------------------------

const cardValue = (card: Card) => (card.rank >= 10 ? 10 : card.rank);

export function handTotal(cards: readonly Card[]): HandTotal {
  const hard = cards.reduce((sum, card) => sum + cardValue(card), 0);
  const soft = cards.some((card) => card.rank === 1) && hard + 10 <= 21;
  return { value: soft ? hard + 10 : hard, soft };
}

const isNatural = (cards: readonly Card[]) => cards.length === 2 && handTotal(cards).value === 21;
const busted = (cards: readonly Card[]) => handTotal(cards).value > 21;
/** Two cards of equal value: any two ten-valued cards are a pair. */
const isPair = (cards: readonly Card[]) => cards.length === 2 && cardValue(cards[0] as Card) === cardValue(cards[1] as Card);
/** A natural counts only on a player's one unsplit hand. */
const naturalIn = (hand: { readonly cards: readonly Card[] }, hands: readonly unknown[]) => hands.length === 1 && isNatural(hand.cards);
/** A split ace takes one card and no further action. */
const splitAce = (hand: { readonly cards: readonly Card[] }, hands: readonly unknown[]) => hands.length > 1 && hand.cards[0]?.rank === 1;

// ---- phases ---------------------------------------------------------------

const playing = (state: BlackjackActivityState) => state.phase === 'open-decision' && state.outcome?.active != null;

/** A hand in play takes only playing actions (and rebuys, while the table waits for input); the insurance offer also takes the insurance wager. */
function legal(state: BlackjackActivityState): CommandKind[] {
  switch (state.phase) {
    case 'open-decision':
      // Rebuys while waiting for input, including before an unaffordable insurance, split or double.
      if (!playing(state)) return ['place-wager', 'begin-turn', 'stop-strategy', 'request-stop', 'rebuy'];
      return state.outcome?.insurance === 'offered' ? ['play', 'place-wager', 'rebuy'] : ['play', 'rebuy'];
    case 'revealing-outcome':
      return ['settle-turn', 'stop-strategy', 'request-stop'];
    case 'settled-outcome':
      return ['place-wager', 'begin-turn', 'stop-strategy', 'request-stop', 'rebuy'];
    case 'final-settlement':
      return ['advance-final-settlement'];
    case 'completed':
    // Guided phases are the protocol's to decide.
    case 'correction':
    case 'cycle-completion':
      return [];
  }
}

export const isBlackjackAction = (value: unknown): value is BlackjackAction => ACTIONS.includes(value as BlackjackAction);

/** The actions the rules offer a hand once insurance is settled (`hands` is how many the learner holds); funding is judged when one is submitted. */
export function rulesOffer(cards: readonly Card[], hands: number, lateSurrender: boolean): BlackjackAction[] {
  const two = cards.length === 2;
  const actions: BlackjackAction[] = ['hit', 'stand'];
  if (two) actions.push('double');
  if (isPair(cards) && hands < MAX_SPLIT_HANDS) actions.push('split');
  // Late surrender: the original unsplit two cards, after the peek.
  if (lateSurrender && two && hands === 1) actions.push('surrender');
  return actions;
}

/** What the rules offer the learner's hand awaiting a decision; funding is judged when an action is submitted. */
function offeredActions(round: BlackjackRound, rules: BlackjackTable): BlackjackAction[] {
  if (round.active === null) return [];
  if (round.insurance === 'offered') return ['decline-insurance'];
  return rulesOffer((round.hands[round.active] as BlackjackHand).cards, round.hands.length, rules.lateSurrender);
}

// ---- the count ------------------------------------------------------------

/** The Hi-Lo tag: 2-6 count +1, 7-9 count 0, tens and aces count -1. */
export const hiLoTag = (card: Card) => (card.rank >= 2 && card.rank <= 6 ? 1 : card.rank >= 7 && card.rank <= 9 ? 0 : -1);

/**
 * The running count of every card exposed since the shuffle and the cards
 * physically left in the shoe. A face-down hole card has left the shoe but
 * never counts until it is turned over.
 */
export function shoeCount(state: Pick<BlackjackActivityState, 'shoe' | 'outcome'>): { running: number; remaining: number } {
  const { shoe, outcome } = state;
  if (shoe === null) return { running: 0, remaining: SHOE.length };
  let running = 0;
  for (let i = 0; i < shoe.next; i++) running += hiLoTag(SHOE[shoe.order[i] as number] as Card);
  if (outcome !== null && !outcome.holeRevealed) running -= hiLoTag(outcome.dealer[1] as Card);
  return { running, remaining: SHOE.length - shoe.next };
}

/**
 * The integer true count: the running count over the decks remaining to the
 * nearest half deck (ties up, at least half a deck), truncated toward zero.
 */
export function trueCount(running: number, remaining: number): number {
  const halfDecks = Math.max(1, Math.floor((remaining + 13) / 26));
  const quotient = Math.floor(Math.abs(2 * running) / halfDecks);
  return running < 0 && quotient > 0 ? -quotient : quotient;
}

/** The count at a decision, as the player may be shown it. */
export interface BlackjackCount {
  readonly running: number;
  /** The divisor: decks remaining to the nearest half deck, e.g. "4.5". */
  readonly decks: string;
  readonly trueCount: number;
}

export const countOf = (shoe: { readonly running: number; readonly remaining: number }): BlackjackCount => ({
  running: shoe.running,
  decks: String(Math.max(1, Math.floor((shoe.remaining + 13) / 26)) / 2),
  trueCount: trueCount(shoe.running, shoe.remaining),
});

/** True when the pinned strategy is still running and its policy has Tableside show the count. */
const countSupplied = (state: BlackjackActivityState) =>
  state.strategy !== null && state.strategy.status !== 'stopped' && (state.strategy.definition.play as { countShown?: unknown } | undefined)?.countShown === true;

// ---- advance --------------------------------------------------------------

type BlackjackStep = Step<BlackjackActivityState>;

/** The learner's box: the one target for an initial wager. */
export const HAND_TARGET = 'hand-1';
/** The insurance wager's target, placed only while insurance is offered. */
export const INSURANCE_TARGET = 'insurance';

/** Deals from the shoe in order. */
class Dealer {
  next: number;
  constructor(readonly shoe: Shoe) {
    this.next = shoe.next;
  }
  card(): Card {
    const index = this.shoe.order[this.next];
    // Five seats with splits need far fewer cards than the 63 behind an 80% cut.
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

/** One transition's working round: the dealer, the facts and the money it moves. */
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

  /** Looks for a dealer blackjack under an ace or ten up. */
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

  /**
   * Readies the next hand of `hands` for a decision: a hand split off takes its
   * second card now; a split ace or a 21 is done. Returns its index, or null
   * when every hand is done.
   */
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

  /** Splits hands[index]: the new hand takes the second card and sits right of it; the split hand takes its next card now. */
  split(hands: WorkHand[], index: number, into: string) {
    const hand = hands[index] as WorkHand;
    const second = hand.cards.pop() as Card;
    hands.splice(index + 1, 0, { target: into, cards: [second], doubled: false, surrendered: false, done: false });
    this.facts.push({ kind: 'hand-split', turn: this.turn, target: hand.target, into });
  }

  /** Carries the round on until the learner must decide or every hand is done. */
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
      // A split hand that became 21 or a split ace is done; play moves on.
      round.active = next;
      return;
    }
    for (const seat of round.others) if (seat.seat > me) this.playSeat(seat);
    this.finish();
  }

  /** A simulated player plays every hand by the pinned basic strategy, with unlimited funds. */
  playSeat(seat: { seat: number; hands: WorkHand[] }) {
    const strategy = this.rules.players.strategy as SeatStrategy;
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
          this.split(seat.hands, index, `seat-${seat.seat}-hand-${seat.hands.length + 1}`);
          this.deal(hand);
          if (splitAce(hand, seat.hands) || handTotal(hand.cards).value >= 21) hand.done = true;
          break;
        case 'decline-insurance':
          break;
      }
    }
  }

  /** Every player is done: reveal the hole card, then the dealer draws while any hand at the table is live. */
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

/** The basic-strategy play for a simulated player's hand (`count` is how many hands the player holds). */
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
      // A finished round keeps its committed wagers for final settlement.
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

/** Insurance is up to half the initial wager (the learner's box carries the round's first wager). */
const insuranceMax = (wagers: readonly Wager[]) => mul(decodeMoney((wagers[0] as Wager).amount), HALF);

function beginRound(state: BlackjackActivityState): BlackjackStep {
  if (state.wagers.length === 0) return { illegal: 'no-wager' };
  const facts: DomainFact[] = [];
  let shoe = state.shoe;
  let random = state.random;
  // The round that reached the cut card was finished; a fresh shoe starts this one.
  if (shoe === null || shoe.next >= shoe.cut) {
    const stream = RandomStream.restore(state.random);
    const order = shuffle(stream, SHOE.map((_, index) => index));
    random = stream.state();
    shoe = { order, next: 0, cut: cutIndex(state.rules) };
    facts.push({ kind: 'shoe-shuffled', cards: SHOE.length, cut: shoe.cut });
  }
  const turn = state.turn + 1;
  facts.push({ kind: 'turn-began', turn, wagers: state.wagers });
  const rules = state.rules;
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
  const me = learnerPosition(rules);
  // Seats from first base; each seat's one hand.
  const seated = [...round.others.map((seat) => ({ position: seat.seat, hand: seat.hands[0] as WorkHand })), { position: me, hand: round.hands[0] as WorkHand }].sort(
    (a, b) => a.position - b.position,
  );
  // U.S. order: a card to every seat, the dealer's up card, a second round, then the hole card face down.
  for (const { hand } of seated) table.deal(hand);
  round.dealer.push(table.dealer.card());
  facts.push(...table.facts.splice(0), { kind: 'card-dealt', turn, to: 'dealer', card: round.dealer[0] as Card });
  for (const { hand } of seated) table.deal(hand);
  round.dealer.push(table.dealer.card());
  facts.push(...table.facts.splice(0), { kind: 'card-dealt', turn, to: 'dealer', card: null });
  for (const { hand } of seated) hand.done = isNatural(hand.cards);

  if ((round.dealer[0] as Card).rank === 1) {
    // Insurance (even money on a natural) comes before the peek.
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

/** An insurance wager while it is offered: up to half the initial wager, in whole units or exactly half. It settles at the peek. */
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
  // Insurance pays 2:1 on a dealer blackjack and settles on its own, before play goes on.
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

/** Ends a learner transition: the round carries on, then the phase follows from whether the learner must decide again. */
function carryOn(state: BlackjackActivityState, table: Table, balance: string, wagers: readonly Wager[]): BlackjackStep {
  table.proceed();
  const round = table.round;
  // Wagers follow the learner's hands in play order.
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
  // Doubles and splits need the whole stake again (no double-for-less), judged in play order.
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
      // The split hand takes its second card now; a hand split off waits for its turn.
      table.deal(hand);
      if (splitAce(hand, work.hands) || handTotal(hand.cards).value >= 21) hand.done = true;
      break;
    }
  }
  return carryOn(state, table, encodeMoney(balance), wagers);
}

const THREE_TO_TWO = money(3n, 2n);

/** A hand's net against the finished dealer hand. */
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

/** Settles every committed hand against the finished dealer hand, then the simulated players'. With no wagers, nothing is settled. */
function settle(state: BlackjackActivityState): { balance: string; facts: DomainFact[] } {
  const facts: DomainFact[] = [];
  if (state.wagers.length === 0) return { balance: state.balance, facts };
  // Wagers exist outside a decision only once a round has finished dealing.
  const round = state.outcome as BlackjackRound;
  let balance = decodeMoney(state.balance);
  for (const wager of state.wagers) {
    const hand = round.hands.find((h) => h.target === wager.target) as BlackjackHand;
    const stake = decodeMoney(wager.amount);
    const net = handNet(hand, round.hands, round, stake);
    // A surrender returns half the stake.
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

// ---- permitted view ---------------------------------------------------------

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
    // A dealt hand awaiting a decision is committed too, not only a revealed round.
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
    // Supplied in "basic with deviations": the count the next decision or deal sees; a fresh shoe once the cut card is out between rounds.
    count: countSupplied(state)
      ? countOf(round?.active == null && (shoe === null || shoe.next >= shoe.cut) ? { running: 0, remaining: SHOE.length } : shoeCount(state))
      : null,
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

// ---- checkpoints ------------------------------------------------------------

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

/** One player's hands: 1-4 hands with distinct targets of the player's form; only a split hand awaiting its turn holds one card. */
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
  // While insurance is offered the first hand waits for that decision, even a natural (even money).
  if (value.insurance === 'offered' ? value.active !== 0 : value.active !== null && !(isCount(value.active) && value.active < hands.length && !hands[value.active]?.done)) {
    return 'damaged active hand';
  }
  if ((value.active === null) !== value.holeRevealed) return 'the hole card does not match the round';
  return undefined;
}

/** The first blackjack-specific structural or invariant problem in a checkpoint, if any. */
function damage(value: Record<string, unknown>): string | undefined {
  const identities = value.identities as Record<string, unknown>;
  const identity = identities.rules as VersionedIdentity;
  if (identity.id !== BLACKJACK_RULES.id || identity.version !== BLACKJACK_RULES.version) return 'the rules do not match their recorded identity';
  if (!isBlackjackTable(value.rules)) return 'damaged rules';
  const shoe = shoeDamage(value.shoe, value.rules);
  if (shoe) return shoe;
  const round = roundDamage(value.outcome, value.rules);
  if (round) return round;
  const { phase, wagers, turn } = value;
  const r = value.outcome as BlackjackRound | null;
  const targets = r === null ? [HAND_TARGET] : r.hands.map((hand) => hand.target);
  if (!isWagerList(wagers, (target) => targets.indexOf(target))) return 'damaged wagers';
  if ((value.outcome === null) !== (turn === 0) || (value.outcome !== null && value.shoe === null)) return 'the round does not match the turn count';
  const inPlay = phase === 'open-decision' && r !== null && r.active !== null;
  const unsettled = inPlay || phase === 'revealing-outcome' || (phase === 'final-settlement' && wagers.length > 0);
  // A dealt round stakes every learner hand; between rounds only the initial wager sits on the box.
  if (unsettled && r !== null && wagers.length !== r.hands.length) return 'a hand in play has no wager';
  if (!unsettled && wagers.some((wager) => wager.target !== HAND_TARGET)) return 'a split wager outside its round';
  if (phase === 'revealing-outcome' && (r === null || r.active !== null || wagers.length === 0)) return 'damaged revealing round';
  if (phase === 'final-settlement' && wagers.length > 0 && (r === null || r.active !== null)) return 'damaged final settlement';
  if ((phase === 'settled-outcome' || phase === 'completed') && wagers.length > 0) return 'wagers remain after settlement';
  return undefined;
}

/** Six-deck blackjack behind the session protocol. */
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
  damage,
};

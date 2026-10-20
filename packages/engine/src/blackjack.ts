// The blackjack game module: six decks, 3:2 naturals, U.S. hole card with
// peek, S17 or H17 dealer, double on any first two cards (no double-for-less),
// cut card after floor(312 x penetration) cards with the round that reaches it
// finished and no burn card. One learner hand per round; splits, insurance,
// surrender and extra players arrive with #70.
//
// The state keeps the whole shoe order and the hole card. The permitted view
// shows only exposed cards: the hole card is face down until the round ends,
// and a negative peek reveals no rank.

import type { ActivityStateBase, BlackjackPermittedView, Command, CommandKind, DomainFact, GameModule, PermittedViewBase, Step, Wager } from './activity';
import { canonicalShoe, shuffle, type Card, type Rank, type Suit } from './draws';
import { add, compare, decodeMoney, encodeMoney, money, mul, neg, sub, type Money } from './money';
import { RandomStream } from './random';
import { BASE_WAGER_CEILING, hasExactKeys, isCount, isLimit, isWagerList, type Limit, type VersionedIdentity } from './shape';

/** The rule identity this engine can run. Dealer rule, surrender, penetration and limits are pinned table content. */
export const BLACKJACK_RULES = { id: 'blackjack-six-deck', version: 1, decks: 6 } as const;

/** Penetration choices, in percent of the shoe dealt before the cut card. */
export const PENETRATIONS: readonly number[] = [50, 55, 60, 65, 70, 75, 80];

const SHOE: readonly Card[] = canonicalShoe(BLACKJACK_RULES.decks);

export interface BlackjackTable {
  readonly decks: typeof BLACKJACK_RULES.decks;
  /** S17: the dealer stands on all 17s. H17: the dealer hits soft 17. */
  readonly dealer: 'S17' | 'H17';
  readonly lateSurrender: boolean;
  readonly penetration: number;
  readonly limits: { readonly initial: Limit };
}

export interface BlackjackRuleSet extends VersionedIdentity, BlackjackTable {}

/** The player's playing actions in this module. Split, surrender and insurance arrive with #70. */
export type BlackjackAction = 'hit' | 'stand' | 'double';
const ACTIONS: readonly BlackjackAction[] = ['hit', 'stand', 'double'];

/** The commands the blackjack module applies: every game command plus the playing action. */
export type BlackjackCommand = Exclude<Command, { readonly kind: 'rebuy' }>;

/** Why a blackjack action fails legality beyond the common reasons. */
export type BlackjackIllegalActionReason =
  /** The rules don't offer that action here (e.g. a double after the first two cards). */
  'action-not-available';

/** Blackjack's own facts. A face-down card is dealt as null: facts never carry a concealed card. */
export type BlackjackDomainFact =
  | { readonly kind: 'shoe-shuffled'; readonly cards: number; readonly cut: number }
  | { readonly kind: 'card-dealt'; readonly turn: number; readonly to: string; readonly card: Card | null }
  | { readonly kind: 'peeked'; readonly turn: number; readonly result: 'no-blackjack' | 'blackjack' }
  | { readonly kind: 'hole-card-revealed'; readonly turn: number; readonly card: Card }
  | { readonly kind: 'played'; readonly turn: number; readonly target: string; readonly action: BlackjackAction };

export interface Shoe {
  /** Canonical-shoe indices in dealing order. */
  readonly order: readonly number[];
  /** Index of the next card to deal; cards before it have left the shoe. */
  readonly next: number;
  /** The cut card sits before this index. */
  readonly cut: number;
}

export interface BlackjackHand {
  /** The wager target this hand is played for: "hand-1". */
  readonly target: string;
  readonly cards: readonly Card[];
  readonly doubled: boolean;
  /** No more actions: stood, doubled, busted, a natural or 21. */
  readonly done: boolean;
}

export type Peek = 'not-needed' | 'no-blackjack' | 'blackjack';

export interface BlackjackRound {
  /** Up card, hole card, then the dealer's draws. */
  readonly dealer: readonly Card[];
  readonly holeRevealed: boolean;
  readonly peek: Peek;
  readonly hands: readonly BlackjackHand[];
  /** The hand awaiting a decision, or null once the player is done. */
  readonly active: number | null;
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
  readonly hands: readonly {
    readonly target: string;
    readonly cards: readonly Card[];
    readonly total: HandTotal;
    readonly doubled: boolean;
    readonly natural: boolean;
    readonly busted: boolean;
  }[];
  readonly active: number | null;
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
}

// ---- rules ----------------------------------------------------------------

const TABLE_KEYS = ['decks', 'dealer', 'lateSurrender', 'penetration', 'limits'];

/** Valid table fields; `extra` names the other keys the value may carry. */
const isTable = (value: unknown, extra: readonly string[]): value is BlackjackTable =>
  hasExactKeys(value, [...TABLE_KEYS, ...extra]) &&
  value.decks === BLACKJACK_RULES.decks &&
  (value.dealer === 'S17' || value.dealer === 'H17') &&
  typeof value.lateSurrender === 'boolean' &&
  PENETRATIONS.includes(value.penetration as number) &&
  hasExactKeys(value.limits, ['initial']) &&
  isLimit(value.limits.initial);

/** Pinned table content, exactly: no missing, malformed or extra fields. */
export const isBlackjackTable = (value: unknown): value is BlackjackTable => isTable(value, []);

/** A whole rule set this engine runs: its identity plus valid table fields and nothing else. */
export const isBlackjackRuleSet = (value: unknown): value is BlackjackRuleSet =>
  isTable(value, ['id', 'version']) &&
  (value as BlackjackRuleSet).id === BLACKJACK_RULES.id &&
  (value as BlackjackRuleSet).version === BLACKJACK_RULES.version;

/** The pinned table content of a rule set. */
export const blackjackTable = (rules: BlackjackRuleSet): BlackjackTable => ({
  decks: rules.decks,
  dealer: rules.dealer,
  lateSurrender: rules.lateSurrender,
  penetration: rules.penetration,
  limits: { initial: { min: rules.limits.initial.min, max: rules.limits.initial.max } },
});

/** Cards dealt before the cut card: floor(312 x penetration). */
const cutIndex = (table: BlackjackTable) => Math.floor((SHOE.length * table.penetration) / 100);

// ---- totals ---------------------------------------------------------------

const cardValue = (card: Card) => (card.rank >= 10 ? 10 : card.rank);

export function handTotal(cards: readonly Card[]): HandTotal {
  const hard = cards.reduce((sum, card) => sum + cardValue(card), 0);
  const soft = cards.some((card) => card.rank === 1) && hard + 10 <= 21;
  return { value: soft ? hard + 10 : hard, soft };
}

const isNatural = (cards: readonly Card[]) => cards.length === 2 && handTotal(cards).value === 21;
const busted = (cards: readonly Card[]) => handTotal(cards).value > 21;

// ---- phases ---------------------------------------------------------------

const playing = (state: BlackjackActivityState) => state.phase === 'open-decision' && state.outcome?.active != null;

/** A hand in play takes only playing actions (and rebuys, while the table waits for input). */
function legal(state: BlackjackActivityState): CommandKind[] {
  switch (state.phase) {
    case 'open-decision':
      // Rebuys while waiting for input, including before an unaffordable double.
      return playing(state) ? ['play', 'rebuy'] : ['place-wager', 'begin-turn', 'request-stop', 'rebuy'];
    case 'revealing-outcome':
      return ['settle-turn', 'request-stop'];
    case 'settled-outcome':
      return ['place-wager', 'begin-turn', 'request-stop', 'rebuy'];
    case 'final-settlement':
      return ['advance-final-settlement'];
    case 'completed':
      return [];
  }
}

export const isBlackjackAction = (value: unknown): value is BlackjackAction => ACTIONS.includes(value as BlackjackAction);

// ---- advance --------------------------------------------------------------

type BlackjackStep = Step<BlackjackActivityState>;

/** The one wager target in this module: the learner's box. */
export const HAND_TARGET = 'hand-1';

/** Deals from the shoe in order. */
class Dealer {
  next: number;
  constructor(readonly shoe: Shoe) {
    this.next = shoe.next;
  }
  card(): Card {
    const index = this.shoe.order[this.next];
    // A one-hand round needs far fewer than the cards behind an 80% cut.
    if (index === undefined) throw new RangeError('the shoe ran out mid-round');
    this.next++;
    return SHOE[index] as Card;
  }
  done(): Shoe {
    return { ...this.shoe, next: this.next };
  }
}

function apply(state: BlackjackActivityState, command: BlackjackCommand): BlackjackStep {
  switch (command.kind) {
    case 'place-wager':
      return placeWager(state, command.target, decodeMoney(command.amount));
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
      // A finished round keeps its committed wager for final settlement.
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
  const dealer = new Dealer(shoe);
  // U.S. order: player, dealer up, player, dealer hole (face down).
  const first = dealer.card();
  const up = dealer.card();
  const second = dealer.card();
  const hole = dealer.card();
  facts.push(
    { kind: 'card-dealt', turn, to: HAND_TARGET, card: first },
    { kind: 'card-dealt', turn, to: 'dealer', card: up },
    { kind: 'card-dealt', turn, to: HAND_TARGET, card: second },
    { kind: 'card-dealt', turn, to: 'dealer', card: null },
  );
  const dealerCards = [up, hole];
  let peek: Peek = 'not-needed';
  if (up.rank === 1 || up.rank >= 10) {
    peek = isNatural(dealerCards) ? 'blackjack' : 'no-blackjack';
    facts.push({ kind: 'peeked', turn, result: peek });
  }
  const hand: BlackjackHand = { target: HAND_TARGET, cards: [first, second], doubled: false, done: isNatural([first, second]) };
  let round: BlackjackRound = { dealer: dealerCards, holeRevealed: false, peek, hands: [hand], active: 0 };
  // A dealer natural ends the round at the peek; a player natural needs no decision.
  if (peek === 'blackjack' || hand.done) round = finishRound(round, dealer, turn, facts, state.rules);
  return {
    change: { phase: round.active === null ? 'revealing-outcome' : 'open-decision', turn, shoe: dealer.done(), outcome: round, random },
    facts,
  };
}

function play(state: BlackjackActivityState, action: BlackjackAction): BlackjackStep {
  const round = state.outcome as BlackjackRound;
  const index = round.active as number;
  const hand = round.hands[index] as BlackjackHand;
  const turn = state.turn;
  const facts: DomainFact[] = [];
  const dealer = new Dealer(state.shoe as Shoe);
  let wagers = state.wagers;
  let balance = state.balance;
  let next: BlackjackHand;
  switch (action) {
    case 'stand':
      facts.push({ kind: 'played', turn, target: hand.target, action });
      next = { ...hand, done: true };
      break;
    case 'hit': {
      facts.push({ kind: 'played', turn, target: hand.target, action });
      const card = dealer.card();
      facts.push({ kind: 'card-dealt', turn, to: hand.target, card });
      const cards = [...hand.cards, card];
      next = { ...hand, cards, done: handTotal(cards).value >= 21 };
      break;
    }
    case 'double': {
      if (hand.cards.length !== 2) return { illegal: 'action-not-available' };
      const wager = state.wagers.find((w) => w.target === hand.target) as Wager;
      const stake = decodeMoney(wager.amount);
      const remaining = sub(decodeMoney(state.balance), stake);
      // No double-for-less: the whole stake again, or nothing.
      if (remaining.n < 0n) return { illegal: 'insufficient-funds' };
      const doubled = encodeMoney(add(stake, stake));
      facts.push(
        { kind: 'played', turn, target: hand.target, action },
        { kind: 'wager-changed', target: hand.target, amount: doubled, previous: wager.amount },
      );
      balance = encodeMoney(remaining);
      wagers = state.wagers.map((w) => (w.target === hand.target ? { target: w.target, amount: doubled } : w));
      const card = dealer.card();
      facts.push({ kind: 'card-dealt', turn, to: hand.target, card });
      next = { ...hand, cards: [...hand.cards, card], doubled: true, done: true };
      break;
    }
  }
  const hands = round.hands.map((h, i) => (i === index ? next : h));
  let after: BlackjackRound = { ...round, hands };
  if (next.done) after = finishRound(after, dealer, turn, facts, state.rules);
  return {
    change: { phase: after.active === null ? 'revealing-outcome' : 'open-decision', outcome: after, shoe: dealer.done(), balance, wagers },
    facts,
  };
}

/** The player is done: reveal the hole card, then the dealer draws while any hand is live. */
function finishRound(round: BlackjackRound, dealer: Dealer, turn: number, facts: DomainFact[], rules: BlackjackTable): BlackjackRound {
  const hole = round.dealer[1] as Card;
  facts.push({ kind: 'hole-card-revealed', turn, card: hole });
  const cards = [...round.dealer];
  const live = round.peek !== 'blackjack' && round.hands.some((hand) => !busted(hand.cards) && !isNatural(hand.cards));
  if (live) {
    for (;;) {
      const total = handTotal(cards);
      if (total.value > 17 || (total.value === 17 && !(total.soft && rules.dealer === 'H17'))) break;
      const card = dealer.card();
      cards.push(card);
      facts.push({ kind: 'card-dealt', turn, to: 'dealer', card });
    }
  }
  return { ...round, dealer: cards, holeRevealed: true, active: null };
}

const THREE_TO_TWO = money(3n, 2n);

/** Settles every committed hand against the finished dealer hand. With no wagers, nothing is settled. */
function settle(state: BlackjackActivityState): { balance: string; facts: DomainFact[] } {
  const facts: DomainFact[] = [];
  if (state.wagers.length === 0) return { balance: state.balance, facts };
  // Wagers exist outside a decision only once a round has finished dealing.
  const round = state.outcome as BlackjackRound;
  let balance = decodeMoney(state.balance);
  const dealerTotal = handTotal(round.dealer).value;
  const dealerNatural = isNatural(round.dealer.slice(0, 2));
  for (const wager of state.wagers) {
    const hand = round.hands.find((h) => h.target === wager.target) as BlackjackHand;
    const stake = decodeMoney(wager.amount);
    const total = handTotal(hand.cards).value;
    const natural = isNatural(hand.cards) && round.hands.length === 1;
    let net: Money;
    if (natural) net = dealerNatural ? money(0n) : mul(stake, THREE_TO_TWO);
    else if (dealerNatural || total > 21) net = neg(stake);
    else if (dealerTotal > 21 || total > dealerTotal) net = stake;
    else net = total === dealerTotal ? money(0n) : neg(stake);
    const returned = net.n < 0n ? money(0n) : add(stake, net);
    balance = add(balance, returned);
    facts.push({
      kind: 'wager-settled',
      turn: state.turn,
      target: wager.target,
      stake: wager.amount,
      result: net.n > 0n ? 'win' : net.n < 0n ? 'loss' : 'push',
      net: encodeMoney(net),
      returned: encodeMoney(returned),
    });
  }
  return { balance: encodeMoney(balance), facts };
}

// ---- permitted view ---------------------------------------------------------

function view(state: BlackjackActivityState): Omit<BlackjackPermittedView, keyof PermittedViewBase> & Pick<BlackjackPermittedView, 'wagersCommitted'> {
  const { outcome: round, shoe, rules } = state;
  const active = round?.active ?? null;
  const activeHand = active === null ? undefined : round?.hands[active];
  return {
    game: 'blackjack',
    // A dealt hand awaiting a decision is committed too, not only a revealed round.
    wagersCommitted: state.wagers.length > 0 && (playing(state) || state.phase === 'revealing-outcome' || state.phase === 'final-settlement'),
    playActions: activeHand && state.phase === 'open-decision' ? ACTIONS.filter((action) => action !== 'double' || activeHand.cards.length === 2) : [],
    outcome: round && {
      turn: state.turn,
      dealer: {
        cards: round.dealer.map((card, index) => (index === 1 && !round.holeRevealed ? null : { ...card })),
        total: handTotal(round.holeRevealed ? round.dealer : round.dealer.slice(0, 1)),
        peek: round.peek,
      },
      hands: round.hands.map((hand) => ({
        target: hand.target,
        cards: hand.cards.map((card) => ({ ...card })),
        total: handTotal(hand.cards),
        doubled: hand.doubled,
        natural: isNatural(hand.cards) && round.hands.length === 1,
        busted: busted(hand.cards),
      })),
      active,
    },
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

function roundDamage(value: unknown): string | undefined {
  if (value === null) return undefined;
  if (!hasExactKeys(value, ['dealer', 'holeRevealed', 'peek', 'hands', 'active'])) return 'damaged round';
  if (!isCards(value.dealer, 2) || typeof value.holeRevealed !== 'boolean') return 'damaged dealer hand';
  if (!(['not-needed', 'no-blackjack', 'blackjack'] as unknown[]).includes(value.peek)) return 'damaged peek';
  if (!Array.isArray(value.hands) || value.hands.length !== 1) return 'damaged hands';
  for (const hand of value.hands as unknown[]) {
    if (!hasExactKeys(hand, ['target', 'cards', 'doubled', 'done']) || hand.target !== HAND_TARGET || !isCards(hand.cards, 2)) return 'damaged hand';
    if (typeof hand.doubled !== 'boolean' || typeof hand.done !== 'boolean') return 'damaged hand';
  }
  if (value.active !== null && !(isCount(value.active) && value.active < value.hands.length)) return 'damaged active hand';
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
  const round = roundDamage(value.outcome);
  if (round) return round;
  const { phase, wagers, turn } = value;
  if (!isWagerList(wagers, (target) => (target === HAND_TARGET ? 0 : -1))) return 'damaged wagers';
  if ((value.outcome === null) !== (turn === 0) || (value.outcome !== null && value.shoe === null)) return 'the round does not match the turn count';
  const r = value.outcome as BlackjackRound | null;
  const inPlay = phase === 'open-decision' && r !== null && r.active !== null;
  if (inPlay && wagers.length === 0) return 'a hand in play has no wager';
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
      : `blackjack rules need six decks, S17 or H17, a penetration of 50-80% in 5% steps and whole-unit limits from 1 to ${BASE_WAGER_CEILING}`,
  legal,
  apply,
  view,
  damage,
};

// How blackjack sessions read on screen and aloud. Built only from committed
// facts and the permitted view, so a face-down card is only ever "face down".
// Amounts are plain units; formatting never changes a ledger value.

import type { BlackjackAction, BlackjackPermittedView, Card, DomainFact, HandTotal, IllegalActionReason, Suit } from '@tableside/engine';

import { formatUnits } from './units';

const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
const RANK_SHORT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_GLYPH: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

/** "Ace of hearts", "10 of spades". */
export const cardName = (card: Card) => `${RANK_NAMES[card.rank - 1]} of ${card.suit}`;
/** "A", "10", "K": the card corner. */
export const cardRank = (card: Card) => RANK_SHORT[card.rank - 1] as string;

/** "soft 17", "20", "bust 24". */
export const totalText = (total: HandTotal) => (total.value > 21 ? `bust ${total.value}` : total.soft ? `soft ${total.value}` : String(total.value));

/** A hand's total, with a natural read as "blackjack" rather than "soft 21". */
export const handTotalText = (hand: { readonly total: HandTotal; readonly natural: boolean }) => (hand.natural ? 'blackjack' : totalText(hand.total));

const ACTION_WORD: Record<BlackjackAction, string> = { hit: 'hit', stand: 'stand', double: 'double' };

/** The table's rules line: "6 decks · S17 · LS · 10–1,000". */
export function rulesText(view: BlackjackPermittedView): string {
  const { table } = view;
  return `${table.decks} decks · ${table.dealer} · ${table.lateSurrender ? 'LS' : 'no LS'} · ${formatUnits(table.initial.min)}–${formatUnits(table.initial.max)}`;
}

/** The definitions preset name for the table's rules. */
export const presetOf = (view: BlackjackPermittedView) => `${view.table.dealer}_${view.table.lateSurrender ? 'LS' : 'noLS'}` as const;

export const isPlaying = (view: BlackjackPermittedView) => view.playActions.length > 0;

/** The status tag: what the table is waiting for. */
export function statusText(view: BlackjackPermittedView): string {
  switch (view.phase) {
    case 'open-decision':
      return isPlaying(view) ? 'Your turn' : view.wagers.length === 0 ? 'Waiting for your bet' : 'Betting';
    case 'revealing-outcome':
      return "Dealer's turn";
    case 'settled-outcome':
      return 'Settled automatically';
    case 'final-settlement':
      return 'Final settlement';
    case 'completed':
      return 'Ended';
  }
}

/** The dealer's cards for screen readers: "Dealer: 5 of spades and a face-down card, showing 5". */
export function dealerSummary(view: BlackjackPermittedView): string {
  const dealer = view.round?.dealer;
  if (!dealer) return 'Dealer: no cards yet';
  const names = dealer.cards.map((card) => (card ? cardName(card) : 'a face-down card'));
  const faceDown = dealer.cards.includes(null);
  return `Dealer: ${names.join(' and ')}, ${faceDown ? 'showing' : 'total'} ${totalText(dealer.total)}`;
}

/** True while the table shows the previous round's cards: between rounds, before the next deal. */
export const showingLastRound = (view: BlackjackPermittedView) =>
  view.round !== null && (view.phase === 'settled-outcome' || (view.phase === 'open-decision' && !isPlaying(view)));

/** The learner's hand: "Your hand: Ace of hearts, 6 of clubs. Soft 17, doubled". */
export function handSummary(view: BlackjackPermittedView): string {
  const hand = view.round?.hands[0];
  const owner = showingLastRound(view) ? 'Last hand' : 'Your hand';
  if (!hand) return 'Your hand: no cards yet';
  return `${owner}: ${hand.cards.map(cardName).join(', ')}. ${capitalize(handTotalText(hand))}${hand.doubled ? ', doubled' : ''}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function illegalMessage(reason: IllegalActionReason, command: DomainFact & { kind: 'illegal-action' }, view: BlackjackPermittedView): string {
  const { initial } = view.table;
  const doubling = command.command.kind === 'play' && command.command.action === 'double';
  switch (reason) {
    case 'below-minimum':
      return `The initial wager needs at least ${formatUnits(initial.min)}. Nothing was placed.`;
    case 'above-maximum':
      return `The initial wager allows at most ${formatUnits(initial.max)}. Nothing was placed.`;
    case 'insufficient-funds':
      return doubling
        ? `Doubling needs the whole stake again, and your balance is ${formatUnits(view.balance)}. Nothing changed.`
        : `Your balance can't cover that. Nothing was placed.`;
    case 'no-wager':
      return 'Place your initial wager before the deal.';
    case 'not-whole-units':
      return 'Stakes are whole units. Nothing was placed.';
    case 'action-not-available':
      return 'You can double only on your first two cards. Nothing changed.';
    case 'no-wager-to-remove':
    case 'unknown-target':
      return "That wager can't be changed. Nothing was placed.";
  }
}

/**
 * What the latest committed transition changed, in one message for the screen
 * and for screen readers: every new wager, card, result and balance.
 */
export function describeFacts(facts: readonly DomainFact[], view: BlackjackPermittedView): string | null {
  const parts: string[] = [];
  let balanceChanged = false;
  let dealt = false;
  for (const fact of facts) {
    switch (fact.kind) {
      case 'wager-changed':
        parts.push(fact.amount === '0' ? 'Initial wager taken down.' : `Wager ${formatUnits(fact.amount)} on the table.`);
        balanceChanged = true;
        break;
      case 'shoe-shuffled':
        parts.push('A fresh shoe is shuffled.');
        break;
      case 'card-dealt':
        dealt = true;
        parts.push(fact.card === null ? 'Dealer: a face-down card.' : `${fact.to === 'dealer' ? 'Dealer' : 'You'}: ${cardName(fact.card)}.`);
        break;
      case 'peeked':
        parts.push(fact.result === 'blackjack' ? 'The dealer checked and has blackjack.' : 'The dealer checked for blackjack: none.');
        break;
      case 'hole-card-revealed':
        parts.push(`The dealer turns over the ${cardName(fact.card)}.`);
        break;
      case 'played':
        parts.push(`You ${ACTION_WORD[fact.action]}.`);
        break;
      case 'illegal-action':
        parts.push(illegalMessage(fact.reason, fact, view));
        break;
      case 'wager-settled': {
        const natural = view.round?.hands.find((hand) => hand.target === fact.target)?.natural && fact.result === 'win';
        parts.push(
          fact.result === 'win'
            ? `${natural ? 'Blackjack! ' : ''}You win ${formatUnits(fact.net)}.`
            : fact.result === 'push'
              ? `Push: your ${formatUnits(fact.stake)} comes back.`
              : `You lose ${formatUnits(fact.stake)}.`,
        );
        balanceChanged = true;
        break;
      }
      case 'stop-requested':
        parts.push('Ending your session.');
        break;
      case 'wager-returned':
        parts.push(`Wager ${formatUnits(fact.amount)} returned to your balance.`);
        balanceChanged = true;
        break;
      case 'turn-began':
        // Working status: the stake is committed to the round and can't be taken down.
        for (const wager of fact.wagers) parts.push(`Wager ${formatUnits(wager.amount)} in play.`);
        break;
      case 'outcome-generated':
      case 'activity-completed':
        break;
    }
  }
  if (parts.length === 0) return null;
  const round = view.round;
  if (dealt && round) {
    const hand = round.hands[0];
    if (hand) parts.push(`You have ${handTotalText(hand)}; the dealer ${round.dealer.cards.includes(null) ? 'shows' : 'has'} ${totalText(round.dealer.total)}.`);
    if (isPlaying(view)) parts.push('Your turn.');
  }
  if (balanceChanged) parts.push(`Balance ${formatUnits(view.balance)}.`);
  return parts.join(' ');
}

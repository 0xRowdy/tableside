import {
  FUNDING_CEILING,
  INSURANCE_TARGET,
  type BlackjackAction,
  type BlackjackHandView,
  type BlackjackPermittedView,
  type Card,
  type DomainFact,
  type HandTotal,
  type IllegalActionReason,
  type PlayChoice,
  type PlayMove,
  type Suit,
} from '@tableside/engine';

import { capitalize, formatUnits } from './units';

export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

export const PLAY_NOUN: Record<PlayChoice, string> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
  insure: 'insurance',
  'decline-insurance': 'no-insurance',
};

export const moveText = (move: PlayMove) =>
  move.action === 'insure' && move.amount ? `insure ${formatUnits(move.amount)}` : move.action === 'decline-insurance' ? 'decline insurance' : move.action;

const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
const RANK_SHORT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_GLYPH: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

export const rankName = (rank: Card['rank']) => RANK_NAMES[rank - 1] as string;

export const cardName = (card: Pick<Card, 'rank' | 'suit'>) => `${rankName(card.rank)} of ${card.suit}`;
export const cardRank = (card: Pick<Card, 'rank' | 'suit'>) => RANK_SHORT[card.rank - 1] as string;

export const totalText = (total: HandTotal) => (total.value > 21 ? `bust ${total.value}` : total.soft ? `soft ${total.value}` : String(total.value));

export const handTotalText = (hand: { readonly total: HandTotal; readonly natural: boolean }) => (hand.natural ? 'blackjack' : totalText(hand.total));

const ACTION_WORD: Record<BlackjackAction, string> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
  'decline-insurance': 'decline insurance',
};
const ACTION_VERB: Record<BlackjackAction, string> = {
  hit: 'hits',
  stand: 'stands',
  double: 'doubles',
  split: 'splits',
  surrender: 'surrenders',
  'decline-insurance': 'declines insurance',
};

export function rulesText(view: BlackjackPermittedView): string {
  const { table } = view;
  return `${table.decks} decks · ${table.dealer} · ${table.lateSurrender ? 'LS' : 'no LS'} · ${formatUnits(table.initial.min)}–${formatUnits(table.initial.max)}`;
}

export const presetOf = (view: BlackjackPermittedView) => `${view.table.dealer}_${view.table.lateSurrender ? 'LS' : 'noLS'}` as const;

export const isPlaying = (view: BlackjackPermittedView) => view.playActions.length > 0;

export const inHand = (view: BlackjackPermittedView) => isPlaying(view) || (view.phase === 'correction' && view.outcome?.active != null);

export const otherPlayersText = (count: number) => (count === 0 ? 'No other players' : `${count} other player${count === 1 ? '' : 's'}`);

export function statusText(view: BlackjackPermittedView): string {
  switch (view.phase) {
    case 'open-decision': {
      if (view.insuranceOffer) return view.insuranceOffer.evenMoney ? 'Even money offered' : 'Insurance offered';
      if (!isPlaying(view)) return view.wagers.length === 0 ? 'Waiting for your bet' : 'Betting';
      const round = view.outcome;
      const count = round?.hands.length ?? 1;
      return count > 1 && round?.active != null ? `Your turn · hand ${round.active + 1} of ${count}` : 'Your turn';
    }
    case 'revealing-outcome':
      return "Dealer's turn";
    case 'settled-outcome':
      return 'Settled automatically';
    case 'final-settlement':
      return 'Final settlement';
    case 'strategy-settlement':
      return 'Settling the strategy\'s contracts';
    case 'completed':
      return 'Ended';
    case 'correction':
      return 'Paused · your move';
    case 'cycle-completion':
      return 'Cycle ended';
  }
}

export function dealerSummary(view: BlackjackPermittedView): string {
  const dealer = view.outcome?.dealer;
  if (!dealer) return 'Dealer: no cards yet';
  const names = dealer.cards.map((card) => (card ? cardName(card) : 'a face-down card'));
  const faceDown = dealer.cards.includes(null);
  return `Dealer: ${names.join(' and ')}, ${faceDown ? 'showing' : 'total'} ${totalText(dealer.total)}`;
}

export const showingLastRound = (view: BlackjackPermittedView) =>
  view.outcome !== null && (view.phase === 'settled-outcome' || (view.phase === 'open-decision' && !isPlaying(view)));

function settledState(hand: BlackjackHandView, done: string): string {
  if (hand.surrendered) return 'surrendered';
  if (hand.busted) return 'bust';
  if (hand.natural) return 'blackjack';
  if (hand.doubled) return 'doubled';
  return hand.done ? done : 'waiting';
}

export function handState(hand: BlackjackHandView, index: number, view: BlackjackPermittedView): string {
  return inHand(view) && view.outcome?.active === index ? 'your turn' : settledState(hand, 'stood');
}

export function handSummary(view: BlackjackPermittedView, index = 0): string {
  const round = view.outcome;
  const hand = round?.hands[index];
  const last = showingLastRound(view);
  if (!round || !hand) return 'Your hand: no cards yet';
  const cards = `${hand.cards.map(cardName).join(', ')}. ${capitalize(handTotalText(hand))}`;
  if (round.hands.length === 1) return `${last ? 'Last hand' : 'Your hand'}: ${cards}${hand.doubled ? ', doubled' : ''}${hand.surrendered ? ', surrendered' : ''}`;
  return `${last ? 'Last hand' : 'Hand'} ${index + 1} of ${round.hands.length}: ${cards}, ${handState(hand, index, view)}`;
}

export function seatSummary(seat: number, hand: BlackjackHandView, index: number, count: number, view: BlackjackPermittedView): string {
  const name = count > 1 ? `Seat ${seat}, hand ${index + 1} of ${count}` : `Seat ${seat}`;
  const state = settledState(inHand(view) ? hand : { ...hand, done: true }, 'done');
  return `${name}: ${hand.cards.map(cardName).join(', ')}. ${capitalize(handTotalText(hand))}, ${state}`;
}


const seatOf = (target: string) => /^seat-(\d+)-/.exec(target)?.[1] ?? null;

function handName(target: string, view: BlackjackPermittedView): string {
  const hands = view.outcome?.hands ?? [];
  const index = hands.findIndex((hand) => hand.target === target);
  return hands.length > 1 && index >= 0 ? `hand ${index + 1}` : 'your hand';
}

function who(target: string, view: BlackjackPermittedView): string {
  if (target === 'dealer') return 'Dealer';
  const seat = seatOf(target);
  if (seat !== null) return `Seat ${seat}`;
  const name = handName(target, view);
  return name === 'your hand' ? 'You' : capitalize(name);
}

function illegalMessage(reason: IllegalActionReason, fact: DomainFact & { kind: 'illegal-action' }, view: BlackjackPermittedView): string {
  const { initial } = view.table;
  const { command } = fact;
  const action = command.kind === 'play' ? command.action : null;
  const insurance = command.kind === 'place-wager' && command.target === INSURANCE_TARGET;
  switch (reason) {
    case 'below-minimum':
      return `The initial wager needs at least ${formatUnits(initial.min)}. Nothing was placed.`;
    case 'above-maximum':
      return insurance
        ? `Insurance allows at most ${formatUnits(view.insuranceOffer?.max ?? '0')}, half your bet. Nothing was placed.`
        : `The initial wager allows at most ${formatUnits(initial.max)}. Nothing was placed.`;
    case 'insufficient-funds': {
      const rebuy = view.legalCommands.includes('rebuy') ? ' You can rebuy to add chips.' : '';
      if (action === 'double') return `Doubling needs the whole stake again, and your balance is ${formatUnits(view.balance)}. Nothing changed.${rebuy}`;
      if (action === 'split') return `Splitting needs the whole stake again, and your balance is ${formatUnits(view.balance)}. Nothing changed.${rebuy}`;
      return `Your balance can't cover that. Nothing was placed.${rebuy}`;
    }
    case 'over-funding-ceiling':
      return `That rebuy would take total funding past the ${formatUnits(FUNDING_CEILING.toString())} limit. You can add up to ${formatUnits(view.funding.headroom)}. Nothing was added.`;
    case 'no-wager':
      return 'Place your initial wager before the deal.';
    case 'not-whole-units':
      return insurance ? 'Insurance is whole units, or exactly half your bet. Nothing was placed.' : 'Stakes are whole units. Nothing was placed.';
    case 'action-not-available':
      if (action === 'split') return 'You can split only two cards of the same value, up to four hands. Nothing changed.';
      if (action === 'surrender') return 'Late surrender is only on your first two cards, after the dealer checks for blackjack. Nothing changed.';
      return 'You can double only on your first two cards. Nothing changed.';
    default:
      return "That wager can't be changed. Nothing was placed.";
  }
}

function settledMessage(fact: DomainFact & { kind: 'wager-settled' }, view: BlackjackPermittedView): string {
  if (fact.target === INSURANCE_TARGET) {
    return fact.result === 'win' ? `Insurance wins ${formatUnits(fact.net)}.` : `Insurance loses ${formatUnits(fact.stake)}.`;
  }
  const hand = view.outcome?.hands.find((h) => h.target === fact.target);
  const name = handName(fact.target, view);
  if (hand?.surrendered) return `Surrendered: ${formatUnits(fact.returned)} of your ${formatUnits(fact.stake)} comes back.`;
  if (name !== 'your hand') {
    const subject = capitalize(name);
    if (fact.result === 'win') return `${subject} wins ${formatUnits(fact.net)}.`;
    return fact.result === 'push' ? `${subject} pushes: ${formatUnits(fact.stake)} comes back.` : `${subject} loses ${formatUnits(fact.stake)}.`;
  }
  if (fact.result === 'win') return `${hand?.natural ? 'Blackjack! ' : ''}You win ${formatUnits(fact.net)}.`;
  return fact.result === 'push' ? `Push: your ${formatUnits(fact.stake)} comes back.` : `You lose ${formatUnits(fact.stake)}.`;
}

export function describeFacts(facts: readonly DomainFact[], view: BlackjackPermittedView): string | null {
  const parts: string[] = [];
  let balanceChanged = false;
  let dealt = false;
  for (const fact of facts) {
    switch (fact.kind) {
      case 'wager-changed':
        if (fact.target === INSURANCE_TARGET) parts.push(`Insurance ${formatUnits(fact.amount)} on the table.`);
        else if (fact.amount === '0') parts.push('Initial wager taken down.');
        else {
          const name = handName(fact.target, view);
          parts.push(name === 'your hand' ? `Wager ${formatUnits(fact.amount)} on the table.` : `Wager ${formatUnits(fact.amount)} on ${name}.`);
        }
        balanceChanged = true;
        break;
      case 'shoe-shuffled':
        parts.push('A fresh shoe is shuffled.');
        break;
      case 'card-dealt':
        dealt = true;
        parts.push(fact.card === null ? 'Dealer: a face-down card.' : `${who(fact.to, view)}: ${cardName(fact.card)}.`);
        break;
      case 'insurance-offered':
        parts.push(
          fact.evenMoney
            ? `You have blackjack and the dealer shows an ace: even money is offered before the dealer checks.`
            : `The dealer shows an ace: insurance up to ${formatUnits(fact.max)} is offered before the dealer checks.`,
        );
        break;
      case 'peeked':
        parts.push(fact.result === 'blackjack' ? 'The dealer checked and has blackjack.' : 'The dealer checked for blackjack: none.');
        break;
      case 'hole-card-revealed':
        parts.push(`The dealer turns over the ${cardName(fact.card)}.`);
        break;
      case 'played': {
        const seat = seatOf(fact.target);
        if (seat !== null) parts.push(`Seat ${seat} ${ACTION_VERB[fact.action]}.`);
        else parts.push(`You ${ACTION_WORD[fact.action]}.`);
        break;
      }
      case 'illegal-action':
        parts.push(illegalMessage(fact.reason, fact, view));
        break;
      case 'wager-settled':
        parts.push(settledMessage(fact, view));
        balanceChanged = true;
        break;
      case 'seat-settled': {
        const seat = seatOf(fact.target);
        const net = fact.net.replace(/^-/, '');
        parts.push(fact.result === 'win' ? `Seat ${seat} wins ${formatUnits(net)}.` : fact.result === 'push' ? `Seat ${seat} pushes.` : `Seat ${seat} loses ${formatUnits(net)}.`);
        break;
      }
      case 'stop-requested':
        parts.push('Ending your session.');
        break;
      case 'wager-returned':
        parts.push(`Wager ${formatUnits(fact.amount)} returned to your balance.`);
        balanceChanged = true;
        break;
      case 'funding-added':
        parts.push(`Rebuy ${formatUnits(fact.amount)} added. Total funding ${formatUnits(fact.cumulative)}.`);
        balanceChanged = true;
        break;
      case 'turn-began':
        for (const wager of fact.wagers) parts.push(`Wager ${formatUnits(wager.amount)} in play.`);
        break;
      case 'correction-offered':
        parts.push('decision' in fact ? `Paused before your ${PLAY_NOUN[fact.actual.action]}: nothing has been played yet.` : 'Paused before the deal: nothing has been dealt yet.');
        break;
      case 'departure-recorded':
        parts.push(`Recorded once in Departures as ${fact.departure.resolution === 'retried' ? 'taken back' : 'an override'}.`);
        break;
      case 'strategy-stopped':
        parts.push('Strategy stopped. You play on your own; the practice session stays open.');
        break;
      case 'hand-split':
      case 'outcome-generated':
      case 'activity-completed':
        break;
    }
  }
  if (parts.length === 0) return null;
  const round = view.outcome;
  if (dealt && round && round.hands.length > 0) {
    const totals = round.hands.map(handTotalText);
    const yours = totals.length > 1 ? `Your hands have ${totals.slice(0, -1).join(', ')} and ${totals.at(-1)}` : `You have ${totals[0]}`;
    parts.push(`${yours}; the dealer ${round.dealer.cards.includes(null) ? 'shows' : 'has'} ${totalText(round.dealer.total)}.`);
  }
  if (view.count && (dealt || facts.some((fact) => fact.kind === 'played' || fact.kind === 'wager-settled'))) {
    parts.push(`${isPlaying(view) ? 'True count' : 'True count for the next deal'} ${signed(view.count.trueCount)}.`);
  }
  if (isPlaying(view)) {
    if (view.insuranceOffer) parts.push(view.insuranceOffer.evenMoney ? 'Even money?' : 'Insurance?');
    else if (dealt || facts.some((fact) => fact.kind === 'played' || fact.kind === 'peeked')) parts.push(`${statusText(view)}.`);
  }
  if (balanceChanged) parts.push(`Balance ${formatUnits(view.balance)}.`);
  return parts.join(' ');
}

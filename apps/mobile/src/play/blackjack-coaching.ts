// Blackjack coaching prose (design frames 04b, S1-05 "BJ guided, before
// move", its largest-text panel, and S1-04 "basic with deviations, count
// supplied"). Every line is rendered from the engine's explanation facts for
// one playing decision: the hand and up card, the table cell, the deviation and
// the count it was decided at, the unavailable plays and their fallbacks, and
// the published index comparison. Nothing is judged and nothing added that the
// facts don't hold.

import type { BlackjackCount, BlackjackDeviation, Card, DeviationPlay, PlayChoice, PlayCorrection, PlayExplanation, PublishedIndex } from '@tableside/engine';

import { cardRank, PLAY_NOUN, signed, SUIT_GLYPH, totalText } from './blackjack-text';
import type { CorrectionCopy } from './coaching-text';
import { formatUnits } from './units';

/** "A♥": a card as the table shows it. */
export const cardShort = (card: Card) => `${cardRank(card)}${SUIT_GLYPH[card.suit]}`;


/** The up card by value: "a 5", "an ace", "a 10". */
const upName = (card: Card) => (card.rank === 1 ? 'an ace' : card.rank === 8 ? 'an 8' : `a ${card.rank >= 10 ? 10 : card.rank}`);
/** An up-card value: "A" or "10". */
const upValue = (value: number) => (value === 1 ? 'A' : String(value));

/** The imperative for each play: "If you can't double: hit." */
const IMPERATIVE: Record<PlayChoice, string> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
  insure: 'take insurance',
  'decline-insurance': 'decline insurance',
};

/** A hand in words: "soft 17", "16", "a pair of 8s". */
function handWords(explanation: PlayExplanation): string {
  const { situation } = explanation;
  if (situation.pair) {
    const value = situation.cards[0]?.rank ?? 0;
    return `${value === 1 ? 'a pair of aces' : `a pair of ${value >= 10 ? 'tens' : `${value}s`}`} (${totalText(situation.total)})`;
  }
  return totalText(situation.total);
}

/** "doubles soft 17", "stands on 16", "splits a pair of 8s", "takes insurance". */
function verbPhrase(play: PlayChoice, hand: string): string {
  switch (play) {
    case 'hit':
      return `hits ${hand}`;
    case 'stand':
      return `stands on ${hand}`;
    case 'double':
      return `doubles ${hand}`;
    case 'split':
      return `splits ${hand}`;
    case 'surrender':
      return `surrenders ${hand}`;
    case 'insure':
      return 'takes insurance';
    case 'decline-insurance':
      return 'declines insurance';
  }
}

/** A deviation's play in words, with the basic play named where it is "basic". */
const deviationPlay = (play: DeviationPlay) => (play === 'basic' ? 'play basic strategy' : play === 'decline' ? 'decline insurance' : play === 'insure' ? 'take insurance' : play);

const SOURCE: Record<'schlesinger' | 'bja', string> = { schlesinger: 'Illustrious 18 / Fab 4 (Schlesinger)', bja: 'Blackjack Apprenticeship chart' };

/** Why a taught index differs from the published ones, when it does; empty when they agree or aren't comparable. */
export function indexDifferenceLines(deviation: BlackjackDeviation, rules: { dealer: 'S17' | 'H17'; lateSurrender: boolean }): string[] {
  const taught = signed(deviation.threshold);
  const differing = (['schlesinger', 'bja'] as const).filter((source) => {
    const difference = deviation.published[source].difference;
    return difference !== null && difference !== 0;
  });
  if (differing.length === 0) return [];
  const lines: string[] = [];
  for (const source of differing) {
    const published: PublishedIndex = deviation.published[source];
    const difference = published.difference as number;
    lines.push(
      `${SOURCE[source]} prints ${published.value} for ${deviation.situation}; Tableside teaches ${taught}, ${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'count' : 'counts'} ${difference > 0 ? 'higher' : 'lower'}.`,
    );
    for (const bin of published.cost) {
      const perBet = Number(bin.perBet);
      lines.push(
        perBet < 0
          ? `At a true count of ${signed(bin.trueCount)} the published play gains ${bin.perBet.replace(/^[+-]/, '')} per unit bet, inside the margin Tableside treats as a tie; ties go to the basic play.`
          : perBet === 0
            ? `At a true count of ${signed(bin.trueCount)} the published play makes no measurable difference at this table; ties go to the basic play.`
            : `At a true count of ${signed(bin.trueCount)} the published play costs ${bin.perBet.replace(/^[+-]/, '')} per unit bet at this table.`,
      );
    }
  }
  if (rules.dealer === 'H17' && differing.includes('schlesinger')) lines.push("Schlesinger's list is for dealers who stand on soft 17, so under H17 part of the difference is the rule itself.");
  lines.push(
    `Tableside's indices are certified for this game: six decks, ${rules.dealer === 'S17' ? 'dealer stands on soft 17' : 'dealer hits soft 17'}, the true count over the decks left to the nearest half deck and truncated toward zero, weighted by the hands you actually meet. Published charts use other conventions, so a few sit a count away.`,
  );
  return lines;
}

/** The count line as the table shows it: "Running +9 · 4.5 decks left · +9 ÷ 4.5 = +2". */
export const countWorking = (count: BlackjackCount) =>
  `Running ${signed(count.running)} · ${count.decks} decks left · ${signed(count.running)} ÷ ${count.decks} = ${signed(count.trueCount)}`;

/** "16 vs 10: stand at +1 or more (basic hits)": one deviation as a short rule. */
export function deviationRule(deviation: BlackjackDeviation): string {
  const basicSide = deviation.direction === 'deviate-at-or-above' ? deviation.below : deviation.atOrAbove;
  const deviating = deviation.direction === 'deviate-at-or-above' ? deviation.atOrAbove : deviation.below;
  if (deviation.direction === 'deviate-at-or-above') {
    return `${deviation.situation}: ${deviationPlay(deviating)} at ${signed(deviation.threshold)} or more (basic: ${deviationPlay(basicSide)})`;
  }
  return `${deviation.situation}: ${deviationPlay(basicSide)} at ${signed(deviation.threshold)} or more, ${deviationPlay(deviating)} below`;
}

/**
 * Before the deal (never during a decision): the deviation whose index is the
 * current true count, and the next index above it.
 */
export function deviationsAtCount(deviations: readonly BlackjackDeviation[], trueCount: number): { at: BlackjackDeviation | null; next: BlackjackDeviation | null } {
  const sorted = [...deviations].sort((a, b) => a.threshold - b.threshold);
  return { at: sorted.find((d) => d.threshold === trueCount) ?? null, next: sorted.find((d) => d.threshold > trueCount) ?? null };
}

function unavailableLine(play: PlayChoice, reason: 'rule' | 'balance', explanation: PlayExplanation): string {
  const { situation } = explanation;
  if (reason === 'balance') {
    if (play === 'insure') return `Insurance needs ${formatUnits(halfOf(situation.stake))} and your balance is ${formatUnits(situation.available)}, so you can't take it.`;
    return `${play === 'split' ? 'Splitting' : 'Doubling'} needs another ${formatUnits(situation.stake)} and your balance is ${formatUnits(situation.available)}, so you can't ${play}.`;
  }
  switch (play) {
    case 'split':
      return 'Split is off: four hands is the maximum.';
    case 'surrender':
      return situation.hands > 1 ? "Surrender isn't offered on a split hand." : 'Surrender is only on your first two cards, at tables that offer it.';
    default:
      return "Double is only on two cards, so you can't double this hand.";
  }
}

/** Half a whole-unit stake, exactly: "12.5" for 25. */
const halfOf = (stake: string) => (BigInt(stake) % 2n === 0n ? (BigInt(stake) / 2n).toString() : `${(BigInt(stake) / 2n).toString()}.5`);

/** The moves as words: "your stand", "your insurance of 5". */
const moveName = (correction: PlayCorrection) =>
  correction.actual.action === 'insure' && correction.actual.amount ? `insurance of ${formatUnits(correction.actual.amount)}` : PLAY_NOUN[correction.actual.action];

/**
 * The correction pause for one blackjack decision. `countSupplied` is false in
 * the counting modes, where the player keeps the count and play is assessed
 * against the actual one.
 */
export function playCorrectionCopy(strategyName: string, correction: PlayCorrection, rules: { dealer: 'S17' | 'H17'; lateSurrender: boolean }, countSupplied = true): CorrectionCopy {
  const { explanation } = correction;
  const { situation, deviation, cell } = explanation;
  const play = explanation.prescribed.action;
  const hand = handWords(explanation);
  const insurance = situation.decision === 'insurance';
  const rulesName = `${rules.dealer}, ${rules.lateSurrender ? 'LS' : 'no LS'}`;
  const count = situation.count;

  const headline = insurance
    ? `${strategyName} ${play === 'insure' ? 'takes insurance' : 'declines insurance'}${deviation ? ' at this count' : ''}.`
    : `${strategyName} ${verbPhrase(play, hand)} against ${upName(situation.up)}${deviation && deviation.side === (deviation.direction === 'deviate-at-or-above' ? 'at-or-above' : 'below') ? ' at this count' : ''}.`;

  const lines: string[] = [];
  const cards = situation.cards.map(cardShort).join(' ');
  if (insurance) lines.push(`You have ${cards} (${situation.total.value === 21 ? 'blackjack' : totalText(situation.total)}). The dealer shows ${cardShort(situation.up)}, before checking for blackjack.`);
  else {
    const which = situation.hands > 1 ? `Hand ${situation.hand + 1} of ${situation.hands}: ` : 'You have ';
    lines.push(`${which}${cards} (${totalText(situation.total)}${situation.cards.length > 2 ? `, ${situation.cards.length} cards` : ''}). The dealer shows ${cardShort(situation.up)}.`);
  }
  if (cell) {
    const source = cell.table === 'first' ? `Basic strategy (${rulesName})` : `For later decisions (after a hit or a split), Tableside's table (${rules.dealer})`;
    lines.push(`${source} ${verbPhrase(cell.play, hand)} against ${upValue(cell.up)}.`);
  } else if (!deviation) lines.push('Basic strategy never takes insurance.');
  if (deviation && count) {
    lines.push(
      countSupplied
        ? `The true count is ${signed(count.trueCount)}, supplied by Tableside in this mode (${countWorking(count)}).`
        : 'You keep the count in this mode; your play was checked against the actual count, which Tableside doesn\'t show.',
    );
    lines.push(`${deviation.situation}: at ${signed(deviation.threshold)} or more, ${deviationPlay(deviation.atOrAbove)}; below ${signed(deviation.threshold)}, ${deviationPlay(deviation.below)}.`);
  }
  for (const missing of explanation.unavailable) lines.push(unavailableLine(missing.play, missing.reason, explanation));
  if (explanation.unavailable.length > 0) lines.push(`So the strategy's validated fallback is to ${IMPERATIVE[play]}. Following it isn't a departure: it's the legal play here.`);
  lines.push(`Your ${moveName(correction)} hasn't been played yet.`);

  const fallback = explanation.ifUnaffordable ? `If you can't ${explanation.ifUnaffordable.play === 'insure' ? 'cover insurance' : IMPERATIVE[explanation.ifUnaffordable.play]}: ${IMPERATIVE[explanation.ifUnaffordable.fallback]}.` : null;
  const retry = play === 'insure' && explanation.prescribed.amount ? `Take it back & insure ${formatUnits(explanation.prescribed.amount)}` : `Take it back & ${IMPERATIVE[play]}`;
  const override = correction.actual.action === 'decline-insurance' ? 'Keep declining' : `Keep my ${PLAY_NOUN[correction.actual.action]}`;
  return {
    coach: `Marcus · guided practice, ${strategyName.toLowerCase()}`,
    kicker: correction.actual.action === 'decline-insurance' ? 'Before you decline insurance' : `Before your ${PLAY_NOUN[correction.actual.action]}`,
    headline,
    lines,
    fallback,
    retry,
    override,
    note: `"${override}" is recorded once in your Departures as an override. The strategy picks up again at your next decision.`,
    why: deviation ? indexDifferenceLines(deviation, rules) : [],
  };
}

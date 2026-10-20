// The blackjack table (design frames "04a-04d Blackjack" and S1-04 "Table
// chrome — Blackjack", incl. insurance, even money, four split hands and late
// surrender): dealer area, shoe, other players' hands, the learner's hands and
// bet spot, and the actions or insurance decision, with the bet selector over
// the same session (S1-03). It
// renders only the engine's permitted view and forwards taps to the practice
// controller; it never advances the game or decides what is legal. A face-down
// card is drawn as a card back and read as "Face-down card".

import { blackjackHouseEdge } from '@tableside/definitions';
import { decodeMoney, encodeMoney, INSURANCE_TARGET, money, mul, type BlackjackAction, type BlackjackHandView, type BlackjackPermittedView, type Card } from '@tableside/engine';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { SAVE_RETRY_MS, type ActiveSnapshot as Active } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';

import { BetSelector } from './bet-selector/BetSelector';
import { draftAmountText, EMPTY_DRAFT, findChoice, isDraftPending, type BetDraft } from './bet-selector/catalog';
import { DraftBar, PresentationSwitch, type Presentation } from './bet-selector/Presentation';
import { blackjackCatalog, blackjackPlacedWagers } from './blackjack-catalog';
import {
  cardName,
  cardRank,
  dealerSummary,
  describeFacts,
  handState,
  handSummary,
  handTotalText,
  isPlaying,
  presetOf,
  rulesText,
  seatSummary,
  showingLastRound,
  statusText,
  SUIT_GLYPH,
  totalText,
} from './blackjack-text';
import { EndSessionDialog } from './EndSessionDialog';
import { RebuySheet } from './RebuySheet';
import { ACCESS_ENDED } from './RouletteTable';
import { PhaseStepper, SessionStrip, TableTopBar, type PhaseStep } from './TableChrome';
import { formatSigned, formatUnits, totalOnTable } from './units';

type ActiveSnapshot = Active<BlackjackPermittedView>;

/** Above this text scale, a wide window stacks the felt and the controls so text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;
const HAND = 'hand-1';
const SAVE_FAILED_ANNOUNCEMENT = "Couldn't save. Play is paused and will retry automatically.";

const CHIPS: readonly { value: string; label: string; color: ColorToken; ink: ColorToken }[] = [
  { value: '5', label: '5', color: 'chip5', ink: 'onImage' },
  { value: '25', label: '25', color: 'chip25', ink: 'onImage' },
  { value: '100', label: '100', color: 'chip100', ink: 'onImage' },
  { value: '500', label: '500', color: 'chip500', ink: 'onImage' },
  { value: '1000', label: '1K', color: 'chip1k', ink: 'ink' },
];

const SUIT_TOKEN = { spades: 'suitSpade', hearts: 'suitHeart', diamonds: 'suitDiamond', clubs: 'suitClub' } as const;

const ACTION_LABEL: Record<Exclude<BlackjackAction, 'decline-insurance'>, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};

function phaseSteps(view: BlackjackPermittedView): PhaseStep[] {
  const reached = view.phase === 'open-decision' ? (isPlaying(view) ? 2 : 0) : view.phase === 'completed' ? 4 : 3;
  return ['Bet', 'Deal', 'Play', 'Settle'].map((label, index) => ({
    label,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }));
}

export function BlackjackTable({ snapshot }: { snapshot: ActiveSnapshot }) {
  const { controller } = usePractice();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const [chip, setChip] = useState('25');
  const [lastBet, setLastBet] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rebuying, setRebuying] = useState(false);
  // Held here, above both presentations, so rotation, resizing and switching keep the draft.
  const [presentation, setPresentation] = useState<Presentation>('table');
  const [draft, setDraft] = useState<BetDraft>(EMPTY_DRAFT);
  const { view, facts, busy, save } = snapshot;
  const catalog = useMemo(() => blackjackCatalog(view), [view]);
  const placed = useMemo(() => blackjackPlacedWagers(view), [view]);
  const drafted = isDraftPending(draft, placed) ? findChoice(catalog, draft.target) : undefined;

  const ready = !busy && save === 'saved';
  const legal = (kind: BlackjackPermittedView['legalCommands'][number]) => ready && view.legalCommands.includes(kind);
  const message = useMemo(() => describeFacts(facts, view), [facts, view]);
  const wager = view.wagers.find((w) => w.target === HAND)?.amount;
  const playing = isPlaying(view);
  // The insurance decision takes a wager, so the bet list stays open for a lower amount.
  const offer = view.insuranceOffer;
  // The sheet shows only while a rebuy is offered (the table waits for input).
  const rebuyOpen = rebuying && view.legalCommands.includes('rebuy');
  const addRebuy = async (amount: string) => {
    await controller.rebuy(amount);
    const latest = controller.snapshot();
    // Committed: close. Refused or not saved: keep the sheet and its draft.
    if (latest.status !== 'active' || latest.facts.some((fact) => fact.kind === 'funding-added')) setRebuying(false);
  };

  // Announce every committed transition as it is published, including the
  // automatic settle right after a reveal, and a save failure that pauses play.
  useEffect(() => {
    const initial = controller.snapshot();
    let announced = initial.status === 'active' ? initial.view.sequence : -1;
    let failed = initial.status === 'active' && initial.save === 'failed';
    return controller.subscribe(() => {
      const latest = controller.snapshot();
      if (latest.status !== 'active' || latest.view.game !== 'blackjack') return;
      const nowFailed = latest.save === 'failed';
      if (nowFailed && !failed) AccessibilityInfo.announceForAccessibility(SAVE_FAILED_ANNOUNCEMENT);
      failed = nowFailed;
      if (latest.view.sequence === announced) return;
      announced = latest.view.sequence;
      // A state adopted from the store carries no facts of its own: restate where things stand.
      const text = describeFacts(latest.facts, latest.view) ?? `${statusText(latest.view)}. Balance ${formatUnits(latest.view.balance)}.`;
      AccessibilityInfo.announceForAccessibility(text);
    });
  }, [controller]);

  const addChip = () => void controller.placeWager(HAND, (BigInt(wager ?? '0') + BigInt(chip)).toString());
  const deal = () => {
    if (wager) setLastBet(wager);
    void controller.beginTurn();
  };
  const betting = (!playing || offer !== null) && view.phase !== 'final-settlement';
  const selector = presentation === 'selector' && betting;
  const setWager = (target: string, amount: string) => void (target === INSURANCE_TARGET ? controller.insure(amount) : controller.placeWager(target, amount));

  return (
    <View style={styles.screen}>
      <ScrollView testID="table-scroll" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space[6] }}>
        <TableTopBar title="Blackjack" subtitle={rulesText(view)} canEnd={legal('request-stop')} onEnd={() => setConfirming(true)} />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.edge}>
          Edge with basic strategy: {blackjackHouseEdge(presetOf(view)).percent}% (this preset) · Penetration {view.table.penetration}%
        </Text>
        <PhaseStepper steps={phaseSteps(view)} />
        <SessionStrip
          balance={formatUnits(view.balance)}
          onTable={formatUnits(totalOnTable(view))}
          status={save === 'failed' ? 'Paused · not saved' : statusText(view)}
        />
        {betting && <PresentationSwitch value={presentation} onChange={setPresentation} />}

        {save === 'failed' && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Couldn&apos;t save · play is paused</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              {busy
                ? 'Saving your last move…'
                : `Your last move hasn't been saved, so nothing has been revealed. Nothing is lost. Retrying automatically every ${SAVE_RETRY_MS / 1000} s.`}
            </Text>
            <Button label="Retry now" variant="secondary" disabled={busy} onPress={() => void controller.retrySave()} />
          </View>
        )}
        {snapshot.ending === 'access-ended' && (
          <View style={styles.banner} testID="access-ended">
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>{ACCESS_ENDED}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              {playing ? 'Finish this hand; then it settles automatically' : 'Your bets settle automatically'}, then you&apos;ll see the session result.
            </Text>
          </View>
        )}
        {snapshot.suspension?.kind === 'turn-boundary' && !snapshot.suspension.reached && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Suspending after this round</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              {snapshot.suspension.reason ?? 'This round finishes normally. No new round starts until the session resumes.'}
            </Text>
          </View>
        )}

        <View testID="table-columns" style={[styles.columns, sideBySide && styles.columnsSideBySide]}>
          <View style={styles.column}>
            {selector ? (
              <BetSelector
                catalog={catalog}
                wagers={placed}
                balance={view.balance}
                canRebuy={view.legalCommands.includes('rebuy')}
                facts={facts}
                sequence={view.sequence}
                canPlace={legal('place-wager')}
                draft={draft}
                onDraftChange={setDraft}
                onSet={setWager}
                onRemove={(target) => void controller.placeWager(target, '0')}
              />
            ) : (
              <View style={styles.tableView}>
                {drafted && !playing && (
                  <DraftBar
                    name={drafted.choice.name}
                    amount={draftAmountText(draft.text)}
                    onEdit={() => {
                      setDraft({ ...draft, kind: drafted.kind.id });
                      setPresentation('selector');
                    }}
                  />
                )}
                <Felt view={view} result={lastResult(view, facts)} canBet={legal('place-wager')} chip={chip} wager={wager} onSpot={addChip} />
              </View>
            )}
          </View>
          <View style={[styles.column, styles.controls]}>
            {message && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.message} testID="latest-event">
                {message}
              </Text>
            )}
            {offer ? (
              <InsurancePanel
                view={view}
                enabled={legal('play')}
                onInsure={() => void controller.insure(offer.max)}
                onDecline={() => void controller.play('decline-insurance')}
              />
            ) : playing ? (
              <PlayActions view={view} enabled={legal('play')} onPlay={(action) => void controller.play(action)} />
            ) : (
              <BettingActions
                view={view}
                wager={wager}
                lastBet={lastBet}
                canBet={legal('place-wager')}
                canDeal={legal('begin-turn')}
                onClear={() => void controller.placeWager(HAND, '0')}
                onRebet={(amount) => void controller.placeWager(HAND, amount)}
                onDeal={deal}
              />
            )}
            {view.legalCommands.includes('rebuy') && (
              <Button
                label="Rebuy"
                variant="secondary"
                stretch
                hint="Adds chips to this session. It counts as funding, not as a win."
                disabled={!legal('rebuy')}
                onPress={() => setRebuying(true)}
              />
            )}
            {!playing && !selector && view.phase !== 'final-settlement' && <ChipRack chip={chip} onChoose={setChip} />}
            {playing && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
                Finish this hand before ending the session.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {rebuyOpen && (
        <RebuySheet
          funding={view.funding}
          sequence={view.sequence}
          facts={facts}
          busy={!ready}
          onAdd={(amount) => void addRebuy(amount)}
          onClose={() => setRebuying(false)}
        />
      )}

      <EndSessionDialog
        visible={confirming}
        view={view}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void controller.endSession();
        }}
      />
    </View>
  );
}

function Felt({
  view,
  result: settledNet,
  canBet,
  chip,
  wager,
  onSpot,
}: {
  view: BlackjackPermittedView;
  result: string | null;
  canBet: boolean;
  chip: string;
  wager: string | undefined;
  onSpot: () => void;
}) {
  const round = view.outcome;
  const hands = round?.hands ?? [];
  const last = showingLastRound(view);
  return (
    <View style={styles.felt} testID="felt">
      <View style={styles.feltTop}>
        <View style={styles.flex} />
        <View
          accessible
          accessibilityLabel={`Shoe: ${view.shoe.remaining} cards left${view.shoe.shuffleBeforeNextRound && round ? '. The cut card is out: a fresh shoe next round' : ''}`}
          style={styles.shoe}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.shoeLabel}>SHOE</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.shoeCount}>{view.shoe.remaining}</Text>
        </View>
      </View>

      <Text maxFontSizeMultiplier={textScale.body} style={styles.feltLabel}>DEALER</Text>
      <View accessible accessibilityLabel={dealerSummary(view)} style={styles.handRow}>
        {round ? round.dealer.cards.map((card, index) => <PlayingCard key={index} card={card} />) : <EmptyCards />}
        {round && <TotalBadge text={totalText(round.dealer.total)} />}
      </View>

      <View style={styles.rules}>
        <Text maxFontSizeMultiplier={textScale.display} style={styles.pays}>BLACKJACK PAYS 3 TO 2</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.dealerRule}>
          {view.table.dealer === 'S17' ? 'DEALER STANDS ON ALL 17s' : 'DEALER HITS SOFT 17'}
        </Text>
      </View>

      {round && round.others.length > 0 && (
        <View style={styles.others} testID="other-players">
          <Text maxFontSizeMultiplier={textScale.body} style={styles.feltLabel}>OTHER PLAYERS</Text>
          {round.others.map((seat) =>
            seat.hands.map((hand, index) => (
              <View
                key={hand.target}
                accessible
                accessibilityLabel={seatSummary(seat.seat, hand, index, seat.hands.length, view)}
                style={[styles.handRow, last && styles.lastRound]}
              >
                <Text maxFontSizeMultiplier={textScale.body} style={styles.seatLabel}>
                  {seat.hands.length > 1 ? `Seat ${seat.seat} · ${index + 1}` : `Seat ${seat.seat}`}
                </Text>
                {hand.cards.map((card, i) => (
                  <PlayingCard key={i} card={card} small />
                ))}
                <TotalBadge text={capitalize(handTotalText(hand))} />
              </View>
            )),
          )}
        </View>
      )}

      {hands.length > 1 ? (
        <View style={styles.splitHands} testID="split-hands">
          {hands.map((hand, index) => (
            <SplitHand key={hand.target} view={view} hand={hand} index={index} last={last} />
          ))}
        </View>
      ) : (
        <View accessible accessibilityLabel={handSummary(view)} style={[styles.handRow, last && styles.lastRound]}>
          {hands[0] ? hands[0].cards.map((card, index) => <PlayingCard key={index} card={card} />) : <EmptyCards />}
          {hands[0] && <TotalBadge text={`${capitalize(handTotalText(hands[0]))}${handNote(hands[0])}`} />}
        </View>
      )}
      {settledNet && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.result}>
          {settledNet}
        </Text>
      )}

      <BetSpot wager={wager} chip={chip} disabled={!canBet} onPress={onSpot} committed={view.wagersCommitted} />
    </View>
  );
}

/**
 * "Win +25", "Push 0", "Loss −25", or per hand after a split ("Hand 1 win +20 ·
 * Hand 2 loss −10"): the latest settled result, in words as well as colour.
 */
function lastResult(view: BlackjackPermittedView, facts: ActiveSnapshot['facts']): string | null {
  if (view.phase !== 'settled-outcome') return null;
  const results = facts.flatMap((fact) => (fact.kind === 'wager-settled' && fact.target !== INSURANCE_TARGET ? [fact] : []));
  const word = (result: string) => (result === 'win' ? 'Win' : result === 'push' ? 'Push' : 'Loss');
  const [only] = results;
  if (results.length === 1 && only) return `${word(only.result)} ${formatSigned(only.net)}`;
  return results.length === 0 ? null : results.map((fact, i) => `Hand ${i + 1} ${word(fact.result).toLowerCase()} ${formatSigned(fact.net)}`).join(' · ');
}

/** " · doubled", " · surrendered": a hand's state beyond its total. */
const handNote = (hand: BlackjackHandView) => (hand.surrendered ? ' · surrendered' : hand.doubled ? ' · doubled' : '');

/** One of up to four split hands: its cards, "2 · soft 19 · 10" and its state in words. */
function SplitHand({ view, hand, index, last }: { view: BlackjackPermittedView; hand: BlackjackHandView; index: number; last: boolean }) {
  const active = isPlaying(view) && view.outcome?.active === index;
  const stake = view.wagers.find((wager) => wager.target === hand.target)?.amount;
  return (
    <View
      accessible
      accessibilityLabel={handSummary(view, index)}
      style={[styles.splitHand, active && styles.splitHandActive, last && styles.lastRound]}
    >
      <View style={styles.handRow}>
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} small />
        ))}
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.splitLabel}>
        {`${index + 1} · ${handTotalText(hand)}${stake ? ` · ${formatUnits(stake)}` : ''}`}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.splitState, active && styles.splitStateActive]}>
        {capitalize(handState(hand, index, view))}
      </Text>
    </View>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function PlayingCard({ card, small = false }: { card: Card | null; small?: boolean }) {
  if (card === null) {
    return (
      <View accessible accessibilityLabel="Face-down card" style={[styles.card, styles.cardBack]}>
        <View style={styles.cardBackField} />
      </View>
    );
  }
  const color = palette[SUIT_TOKEN[card.suit]];
  return (
    <View accessible accessibilityLabel={cardName(card)} style={[styles.card, small && styles.cardSmall]}>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.cardRank, small && styles.cardRankSmall, { color }]}>{cardRank(card)}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.cardPip, small && styles.cardPipSmall, { color }]}>{SUIT_GLYPH[card.suit]}</Text>
    </View>
  );
}

function EmptyCards() {
  return <View style={[styles.card, styles.cardEmpty]} />;
}

function TotalBadge({ text }: { text: string }) {
  return (
    <View style={styles.totalBadge}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.totalText}>{text}</Text>
    </View>
  );
}

function BetSpot({ wager, chip, disabled, onPress, committed }: { wager: string | undefined; chip: string; disabled: boolean; onPress: () => void; committed: boolean }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Initial wager, blackjack pays 3 to 2"
      accessibilityHint={disabled ? (committed ? 'In play until the hand settles.' : undefined) : `Adds ${formatUnits(chip)}.`}
      accessibilityValue={{ text: wager ? `${formatUnits(wager)} on it${committed ? ', in play' : ''}` : 'no wager' }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.betSpot, wager !== undefined && styles.betSpotWagered, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.betSpotText}>{wager ? formatUnits(wager) : 'BET'}</Text>
      {committed && <Text maxFontSizeMultiplier={textScale.body} style={styles.betSpotState}>IN PLAY</Text>}
    </Pressable>
  );
}

type TableAction = keyof typeof ACTION_LABEL;

/** Why a playing action the table shows is unavailable, in words; null when it is offered. */
function unavailable(action: TableAction, view: BlackjackPermittedView): string | null {
  if (view.playActions.includes(action)) return null;
  const round = view.outcome;
  const hand = round?.active != null ? round.hands[round.active] : undefined;
  const [a, b] = hand?.cards ?? [];
  switch (action) {
    case 'double':
      return 'Double isn’t available: you can double only on your first two cards.';
    case 'split':
      return hand?.cards.length === 2 && a && b && Math.min(a.rank, 10) === Math.min(b.rank, 10)
        ? 'Split is off: four hands is the maximum.'
        : 'Split isn’t available: your cards aren’t a pair.';
    case 'surrender':
      return 'Surrender is only on your first two cards.';
    default:
      return null;
  }
}

/** Half of a canonical amount, exactly. */
const half = (amount: string) => encodeMoney(mul(decodeMoney(amount), money(1n, 2n)));

function PlayActions({ view, enabled, onPlay }: { view: BlackjackPermittedView; enabled: boolean; onPlay: (action: BlackjackAction) => void }) {
  const offered = (action: BlackjackAction) => view.playActions.includes(action);
  // Surrender shows only at tables that offer it.
  const rows: TableAction[][] = [['hit', 'stand', 'double'], view.table.lateSurrender ? ['split', 'surrender'] : ['split']];
  const reasons = rows.flat().flatMap((action) => unavailable(action, view) ?? []);
  const round = view.outcome;
  const active = round?.active != null ? round.hands[round.active] : undefined;
  const stake = view.wagers.find((wager) => wager.target === active?.target)?.amount;
  return (
    <View style={styles.actions}>
      {rows.map((row, i) => (
        <View key={i} style={styles.actionRow}>
          {row.map((action) => (
            <View key={action} style={styles.action}>
              <Button label={ACTION_LABEL[action]} variant="secondary" stretch disabled={!enabled || !offered(action)} onPress={() => onPlay(action)} />
            </View>
          ))}
        </View>
      ))}
      {reasons.length > 0 && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
          {reasons.join(' ')}
          {(round?.hands.length ?? 1) > 1 ? ' Hands play left to right; split aces get one card each and can’t be resplit.' : ''}
        </Text>
      )}
      {offered('surrender') && stake && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
          {round?.dealer.peek === 'no-blackjack' ? 'The dealer checked for blackjack and has none. ' : ''}
          Late surrender is only on your first two cards. Surrendering returns half your bet ({formatUnits(half(stake))}) and ends the hand.
        </Text>
      )}
    </View>
  );
}

/** Insurance or even money, before the peek (design frames "insurance offered" and "even money offered"). */
function InsurancePanel({
  view,
  enabled,
  onInsure,
  onDecline,
}: {
  view: BlackjackPermittedView;
  enabled: boolean;
  onInsure: () => void;
  onDecline: () => void;
}) {
  const offer = view.insuranceOffer;
  const bet = view.wagers[0]?.amount;
  if (!offer || !bet) return null;
  const max = formatUnits(offer.max);
  const natural = formatUnits(encodeMoney(mul(decodeMoney(bet), money(3n, 2n))));
  return (
    <View style={styles.decision} testID="insurance-decision">
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.decisionTitle}>
        {offer.evenMoney ? 'Even money?' : 'Insurance?'}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.decisionText}>
        {offer.evenMoney
          ? `You have blackjack and the dealer shows an ace. Even money pays ${formatUnits(bet)} now (1:1), whatever the dealer has. It’s the same as insuring your blackjack for ${max}.`
          : `The dealer shows an ace. Before checking for blackjack, you can insure up to half your bet, so up to ${max}. Insurance pays 2:1 and settles separately from your hand.`}
      </Text>
      <View style={styles.actionRow}>
        <View style={styles.action}>
          <Button label={offer.evenMoney ? `Take even money (${formatUnits(bet)})` : `Insure ${max}`} stretch disabled={!enabled} onPress={onInsure} />
        </View>
        <View style={styles.action}>
          <Button label={offer.evenMoney ? 'No, play it out' : 'No insurance'} variant="secondary" stretch disabled={!enabled} onPress={onDecline} />
        </View>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
        {offer.evenMoney
          ? `If you decline and the dealer also has blackjack, your hand pushes. Otherwise it pays 3:2 (${natural}).`
          : `${view.table.lateSurrender ? 'Late surrender is still available after the peek. ' : ''}The amount can be lower: choose it in the bet list.`}
      </Text>
    </View>
  );
}

function BettingActions({
  view,
  wager,
  lastBet,
  canBet,
  canDeal,
  onClear,
  onRebet,
  onDeal,
}: {
  view: BlackjackPermittedView;
  wager: string | undefined;
  lastBet: string | null;
  canBet: boolean;
  canDeal: boolean;
  onClear: () => void;
  onRebet: (amount: string) => void;
  onDeal: () => void;
}) {
  if (view.phase === 'final-settlement' || view.phase === 'revealing-outcome') return null;
  return (
    <View style={styles.actions}>
      <View style={styles.actionRow}>
        <View style={styles.action}>
          <Button label="Clear" variant="secondary" stretch disabled={!canBet || wager === undefined} onPress={onClear} />
        </View>
        {lastBet && wager === undefined && (
          <View style={styles.action}>
            <Button label={`Rebet ${formatUnits(lastBet)}`} variant="secondary" stretch disabled={!canBet} onPress={() => onRebet(lastBet)} />
          </View>
        )}
      </View>
      <Button label="Deal" stretch disabled={!canDeal} onPress={onDeal} />
    </View>
  );
}

function ChipRack({ chip, onChoose }: { chip: string; onChoose: (value: string) => void }) {
  return (
    <View style={styles.rack}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Chip value" style={styles.chips}>
        {CHIPS.map((option) => (
          <Chip key={option.value} option={option} selected={option.value === chip} onPress={() => onChoose(option.value)} />
        ))}
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rackCaption}>
        {formatUnits(chip)} selected · tap the bet spot to add it
      </Text>
    </View>
  );
}

function Chip({ option, selected, onPress }: { option: (typeof CHIPS)[number]; selected: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${formatUnits(option.value)} chip`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.chipSlot, selected && styles.chipSelected, focused && styles.focused]}
    >
      <View style={[styles.chip, { backgroundColor: palette[option.color] }]}>
        <Text maxFontSizeMultiplier={textScale.display} style={[styles.chipText, { color: palette[option.ink] }]}>{option.label}</Text>
      </View>
      {selected && <Text maxFontSizeMultiplier={textScale.display} style={styles.chipCheck}>{'✓'}</Text>}
    </Pressable>
  );
}

const CARD_WIDTH = 56;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  edge: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground, paddingHorizontal: space[4] },
  banner: { margin: space[4], padding: space[4], gap: space[2], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.destructive },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  bannerText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  columns: { gap: space[3], paddingTop: space[2] },
  columnsSideBySide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  tableView: { gap: space[2] },
  controls: { gap: space[3], paddingHorizontal: space[4] },
  message: { fontFamily: fonts.uiMedium, fontSize: 15, lineHeight: 21, color: palette.foreground },
  hint: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  felt: { gap: space[3], padding: space[4], marginHorizontal: space[2], borderRadius: radius.lg, backgroundColor: palette.felt, alignItems: 'center' },
  feltTop: { flexDirection: 'row', alignSelf: 'stretch' },
  shoe: { minWidth: 52, paddingVertical: space[1], paddingHorizontal: space[2], borderRadius: radius.sm, backgroundColor: palette.feltDeep, alignItems: 'center' },
  shoeLabel: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 0.5, color: palette.feltText },
  shoeCount: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.feltText },
  feltLabel: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 0.5, color: palette.feltText },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  lastRound: { opacity: 0.85 },
  rules: { alignItems: 'center', gap: 2 },
  pays: { fontFamily: fonts.display, fontSize: 18, color: palette.feltText, textAlign: 'center' },
  dealerRule: { fontFamily: fonts.uiMedium, fontSize: 10, letterSpacing: 0.5, color: palette.feltText, textAlign: 'center' },
  card: {
    width: CARD_WIDTH,
    minHeight: 80,
    padding: space[1],
    borderRadius: radius.sm,
    backgroundColor: palette.cardFace,
    justifyContent: 'space-between',
  },
  cardBack: { padding: 4, backgroundColor: palette.cardFace },
  cardBackField: { flex: 1, borderRadius: 4, backgroundColor: palette.chip5 },
  cardEmpty: { backgroundColor: palette.transparent, borderWidth: 1, borderColor: palette.feltText, borderStyle: 'dashed' },
  cardRank: { fontFamily: fonts.uiBold, fontSize: 20 },
  cardPip: { fontSize: 26, alignSelf: 'flex-end' },
  cardSmall: { width: 40, minHeight: 58 },
  cardRankSmall: { fontSize: 15 },
  cardPipSmall: { fontSize: 18 },
  others: { alignSelf: 'stretch', gap: space[2], alignItems: 'center' },
  seatLabel: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.feltText },
  splitHands: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] },
  splitHand: { alignItems: 'center', gap: space[1], padding: space[1], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  splitHandActive: { borderColor: palette.primary },
  splitLabel: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.feltText },
  splitState: { fontFamily: fonts.uiMedium, fontSize: 11, color: palette.feltText },
  splitStateActive: { fontFamily: fonts.uiBold, textDecorationLine: 'underline' },
  decision: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary },
  decisionTitle: { fontFamily: fonts.display, fontSize: 22, color: palette.foreground },
  decisionText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: palette.foreground },
  totalBadge: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.pill, backgroundColor: palette.feltDeep },
  totalText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.feltText },
  result: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.feltText },
  betSpot: {
    minWidth: 88,
    minHeight: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: palette.feltText,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.feltDeep,
  },
  betSpotWagered: { borderColor: palette.cardFace, borderWidth: 3 },
  betSpotText: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.feltText },
  betSpotState: { fontFamily: fonts.uiBold, fontSize: 9, letterSpacing: 0.5, color: palette.feltText },
  focused: { borderColor: palette.ring, borderWidth: 3 },
  actions: { gap: space[2] },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  action: { flexGrow: 1, flexBasis: 96 },
  rack: { gap: space[2], padding: space[3], borderRadius: radius.lg, backgroundColor: palette.rail },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  chipSlot: {
    minWidth: MIN_TOUCH_TARGET + 8,
    minHeight: MIN_TOUCH_TARGET + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  chipSelected: { borderColor: palette.primary },
  chip: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.uiBold, fontSize: 15 },
  chipCheck: { position: 'absolute', top: -2, right: -2, fontFamily: fonts.uiBold, fontSize: 12, color: palette.primary },
  rackCaption: { fontFamily: fonts.ui, fontSize: 12, color: palette.foreground },
});

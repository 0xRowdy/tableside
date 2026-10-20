// The blackjack table (design frames "04a-04d Blackjack" and S1-04 "Table
// chrome — Blackjack"): dealer area, shoe, the learner's hand and bet spot, and
// the actions row. It renders only the engine's permitted view and forwards
// taps to the practice controller; it never advances the game or decides what
// is legal. A face-down card is drawn as a card back and read as "Face-down card".

import { blackjackHouseEdge } from '@tableside/definitions';
import type { BlackjackAction, BlackjackPermittedView, Card } from '@tableside/engine';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import type { ActiveSnapshot as Active } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';

import {
  cardName,
  cardRank,
  dealerSummary,
  describeFacts,
  handSummary,
  isPlaying,

  presetOf,
  rulesText,
  showingLastRound,
  statusText,
  SUIT_GLYPH,
  totalText,
  handTotalText,
} from './blackjack-text';
import { formatSigned, formatUnits, totalOnTable } from './units';
import { PhaseStepper, SessionStrip, TableTopBar, type PhaseStep } from './TableChrome';

type ActiveSnapshot = Active<BlackjackPermittedView>;

/** Above this text scale, a wide window stacks the felt and the controls so text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;
const HAND = 'hand-1';
const NOT_SAVED = 'Not saved yet. Play is paused.';

const CHIPS: readonly { value: string; label: string; color: ColorToken; ink: ColorToken }[] = [
  { value: '5', label: '5', color: 'chip5', ink: 'onImage' },
  { value: '25', label: '25', color: 'chip25', ink: 'onImage' },
  { value: '100', label: '100', color: 'chip100', ink: 'onImage' },
  { value: '500', label: '500', color: 'chip500', ink: 'onImage' },
  { value: '1000', label: '1K', color: 'chip1k', ink: 'ink' },
];

const SUIT_TOKEN = { spades: 'suitSpade', hearts: 'suitHeart', diamonds: 'suitDiamond', clubs: 'suitClub' } as const;

const ACTION_LABEL: Record<BlackjackAction, string> = { hit: 'Hit', stand: 'Stand', double: 'Double' };

function phaseSteps(view: BlackjackPermittedView): PhaseStep[] {
  const reached =
    view.phase === 'open-decision' ? (isPlaying(view) ? 2 : 0) : view.phase === 'completed' ? 4 : 3;
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
  const { view, facts, busy, save } = snapshot;

  const ready = !busy && save === 'saved';
  const legal = (kind: BlackjackPermittedView['legalCommands'][number]) => ready && view.legalCommands.includes(kind);
  const message = useMemo(() => describeFacts(facts, view), [facts, view]);
  const wager = view.wagers.find((w) => w.target === HAND)?.amount;
  const playing = isPlaying(view);

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
      if (nowFailed && !failed) AccessibilityInfo.announceForAccessibility(NOT_SAVED);
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

  return (
    <View style={styles.screen}>
      <ScrollView testID="table-scroll" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space[6] }}>
        <TableTopBar title="Blackjack" subtitle={rulesText(view)} canEnd={legal('request-stop')} onEnd={() => setConfirming(true)} />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.edge}>
          Edge with basic strategy: {blackjackHouseEdge(presetOf(view)).percent}% (this preset) · Penetration {view.table.penetration}%
        </Text>
        <PhaseStepper steps={phaseSteps(view)} />
        <SessionStrip balance={formatUnits(view.balance)} onTable={formatUnits(totalOnTable(view))} status={statusText(view)} />

        {save === 'failed' && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>{NOT_SAVED}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              Your last move hasn&apos;t been saved, so nothing has been revealed. Try saving again.
            </Text>
            <Button label="Try again" variant="secondary" disabled={busy} onPress={() => void controller.retrySave()} />
          </View>
        )}
        {snapshot.accessNotAllowed && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>This round can&apos;t start right now.</Text>
          </View>
        )}

        <View testID="table-columns" style={[styles.columns, sideBySide && styles.columnsSideBySide]}>
          <View style={styles.column}>
            <Felt view={view} result={lastResult(view, facts)} canBet={legal('place-wager')} chip={chip} wager={wager} onSpot={addChip} />
          </View>
          <View style={[styles.column, styles.controls]}>
            {message && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.message} testID="latest-event">
                {message}
              </Text>
            )}
            {playing ? (
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
            {!playing && view.phase !== 'final-settlement' && <ChipRack chip={chip} onChoose={setChip} />}
            {playing && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
                Finish this hand before ending the session.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

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
  const round = view.round;
  const hand = round?.hands[0];
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

      <View accessible accessibilityLabel={handSummary(view)} style={[styles.handRow, last && styles.lastRound]}>
        {hand ? hand.cards.map((card, index) => <PlayingCard key={index} card={card} />) : <EmptyCards />}
        {hand && (
          <TotalBadge
            text={`${capitalize(handTotalText(hand))}${hand.doubled ? ' · doubled' : ''}`}
          />
        )}
      </View>
      {settledNet && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.result}>
          {settledNet}
        </Text>
      )}

      <BetSpot wager={wager} chip={chip} disabled={!canBet} onPress={onSpot} committed={view.wagersCommitted} />
    </View>
  );
}

/** "Win +25", "Push 0", "Loss −25": the latest settled result, in words as well as colour. */
function lastResult(view: BlackjackPermittedView, facts: ActiveSnapshot['facts']): string | null {
  if (view.phase !== 'settled-outcome') return null;
  const fact = facts.find((f) => f.kind === 'wager-settled');
  if (!fact || fact.kind !== 'wager-settled') return null;
  const word = fact.result === 'win' ? 'Win' : fact.result === 'push' ? 'Push' : 'Loss';
  return `${word} ${formatSigned(fact.net)}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function PlayingCard({ card }: { card: Card | null }) {
  if (card === null) {
    return (
      <View accessible accessibilityLabel="Face-down card" style={[styles.card, styles.cardBack]}>
        <View style={styles.cardBackField} />
      </View>
    );
  }
  const color = palette[SUIT_TOKEN[card.suit]];
  return (
    <View accessible accessibilityLabel={cardName(card)} style={styles.card}>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.cardRank, { color }]}>{cardRank(card)}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.cardPip, { color }]}>{SUIT_GLYPH[card.suit]}</Text>
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

function PlayActions({ view, enabled, onPlay }: { view: BlackjackPermittedView; enabled: boolean; onPlay: (action: BlackjackAction) => void }) {
  const offered = (action: BlackjackAction) => view.playActions.includes(action);
  return (
    <View style={styles.actions}>
      <View style={styles.actionRow}>
        {(['hit', 'stand', 'double'] as const).map((action) => (
          <View key={action} style={styles.action}>
            <Button label={ACTION_LABEL[action]} variant="secondary" stretch disabled={!enabled || !offered(action)} onPress={() => onPlay(action)} />
          </View>
        ))}
      </View>
      {!offered('double') && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
          Double isn&apos;t available: you can double only on your first two cards.
        </Text>
      )}
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

function EndSessionDialog({ visible, view, onCancel, onConfirm }: { visible: boolean; view: BlackjackPermittedView; onCancel: () => void; onConfirm: () => void }) {
  const removable = view.wagersCommitted ? [] : view.wagers;
  const steps = [
    { title: 'Removable wagers come back', detail: removable.length === 0 ? 'Nothing on the table' : removable.map((w) => `Initial wager ${formatUnits(w.amount)}`).join(' · ') },
    { title: 'Committed wagers settle automatically', detail: view.wagersCommitted ? 'This round settles on its own' : 'None between rounds' },
    { title: 'You see the session result', detail: 'Buy-in, final cash-out and net result' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.scrim}>
        <ScrollView contentContainerStyle={styles.dialogScroll}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.dialogTitle}>
              End this session?
            </Text>
            {steps.map((step, index) => (
              <View key={step.title} accessible accessibilityLabel={`${index + 1}. ${step.title}. ${step.detail}`} style={styles.dialogStep}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogStepTitle}>{index + 1}  {step.title}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogText}>{step.detail}</Text>
              </View>
            ))}
            <Button label="End session" stretch onPress={onConfirm} />
            <Button label="Keep playing" variant="secondary" stretch onPress={onCancel} />
          </View>
        </ScrollView>
      </View>
    </Modal>
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
  scrim: { flex: 1, backgroundColor: palette.scrim },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: space[4] },
  dialog: { gap: space[3], padding: space[6], borderRadius: radius.lg, backgroundColor: palette.popover },
  dialogTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  dialogText: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  dialogStep: { gap: 2 },
  dialogStepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
});

// Spec 3 Screens › Exercise (table); S3-07 v82z3, AcmMa, bh8oE, xjtSW, heGUV, j4tjKT; #137

import type { ChallengeCard, ChallengeEntry, ChallengeView, LearnFeedback, TableHandView, TableView } from '@tableside/engine';
import { ArrowRight, ChevronsRight, CircleDot, Hand, Info, Layers, Shuffle } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PlayingCard } from '@/counting/CardChoices';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { signed } from '@/play/blackjack-text';
import { FirstUseHint, HelpButton } from '@/lessons/FirstUseHints';
import { PhaseStepper, SaveFailedBanner, StatStrip, type PhaseStep } from '@/play/TableChrome';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { conversionText } from '@/training/blackjack-conversion-text';
import {
  checkpointText,
  checkpointTitle,
  CONTINUE,
  continueText,
  DEALER,
  dealerRuleText,
  decksText,
  edgeText,
  enteredLine,
  handText,
  KEEP_THE_COUNT,
  NEW_SHOE,
  NEXT_TRUE_COUNT,
  OBSERVE_KICKER,
  observeText,
  ONLY_FIRST_SCORED,
  PAYS,
  PHASES,
  ROUND_LABEL,
  ROUND_SPOKEN,
  roundOf,
  RUNNING_COUNT,
  RUNNING_KICKER,
  runningHeadline,
  seatActionText,
  seatName,
  SHOW_ANSWER,
  SHUFFLED_TITLE,
  shuffledText,
  SIMULATED,
  STATUS_TEXT,
  tableRecordedText,
  tableRunningText,
  tableSubtitle,
  TRUE_COUNT,
  TRY_AGAIN,
  YOUR_SEAT,
  YOUR_SEAT_SPOKEN,
  type TableStatus,
} from '@/training/blackjack-table-text';
import { COACH_NAME, CONVERSION_KICKER, NEXT_CARD } from '@/training/challenge-text';
import type { LearnerCommand } from '@/training/service';

import { CountAid } from './CountAid';
import { CountEntry } from './CountEntry';

function status(view: ChallengeView, table: TableView): TableStatus {
  if (view.variant === 'learn' && view.feedback) return 'feedback';
  if (table.step === 'shuffle') return 'shuffled';
  return table.prompt ? 'checkpoint' : 'observing';
}

// Spec 3 S3-07 v82z3, bh8oE, heGUV
function phaseSteps(table: TableView): PhaseStep[] {
  const dealt = table.dealer.cards.length;
  let reached = 3;
  if (table.step === 'shuffle' || (table.prompt?.timing === 'before-bet' && dealt === 0)) reached = 0;
  else if (dealt < 2) reached = 1;
  else if (!table.settled) reached = 2;
  return PHASES.map((label, index) => ({ label, state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming' }));
}

export function TableExercise({
  view,
  table,
  busy,
  saveFailed,
  onCommand,
  onInputRejected,
  onRetrySave,
}: {
  view: ChallengeView;
  table: TableView;
  busy: boolean;
  saveFailed: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
  onRetrySave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const ready = !busy && !saveFailed;
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            Table counting
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
            {tableSubtitle(view.variant, table)}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
            {edgeText(table.rules)}
          </Text>
        </View>
        <HelpButton />
      </View>
      <PhaseStepper steps={phaseSteps(table)} />
      <StatStrip
        stats={[
          { label: YOUR_SEAT, spoken: YOUR_SEAT_SPOKEN, value: SIMULATED },
          { label: ROUND_LABEL, spoken: ROUND_SPOKEN, value: roundOf(table) },
        ]}
        status={STATUS_TEXT[status(view, table)]}
      />
      <Felt table={table} />
      <View style={styles.panel}>
        {saveFailed && <SaveFailedBanner busy={busy} onRetry={onRetrySave} />}
        {table.step === 'shuffle' && <ShufflePanel table={table} enabled={ready} onContinue={() => onCommand({ kind: 'next-item' })} />}
        {(table.step === 'deal' || table.step === 'reveal') && (
          <>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
              {OBSERVE_KICKER}
            </Text>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.panelTitle}>
              {KEEP_THE_COUNT}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
              {observeText(table)}
            </Text>
            <Button label={NEXT_CARD} icon={ChevronsRight} stretch disabled={!ready} onPress={() => onCommand({ kind: 'next-item' })} />
          </>
        )}
        {table.prompt && (
          <CheckpointPanel view={view} table={table} feedback={feedback} entered={entered} ready={ready} onCommand={onCommand} onInputRejected={onInputRejected} />
        )}
        {view.countAid && <FirstUseHint id="show-count" />}
        {view.countAid && <CountAid key={view.attemptId} variant={view.variant} aid={view.countAid} enabled={ready && view.legalCommands.includes('reveal-count')} onReveal={() => onCommand({ kind: 'reveal-count' })} />}
      </View>
    </ScrollView>
  );
}

function CheckpointPanel({
  view,
  table,
  feedback,
  entered,
  ready,
  onCommand,
  onInputRejected,
}: {
  view: ChallengeView;
  table: TableView;
  feedback: LearnFeedback | null;
  entered: ChallengeEntry | null;
  ready: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
}) {
  const prompt = table.prompt as NonNullable<TableView['prompt']>;
  const answering = ready && view.legalCommands.includes('answer');
  const pairs = prompt.timing !== 'after-round';
  return (
    <>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.checkpointTitle}>
        {checkpointTitle(prompt, table.round)}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
        {checkpointText(table)}
      </Text>
      {view.phase === 'question' && <FirstUseHint id="count-entry" />}
      {view.phase === 'question' && (
        <CountEntry
          key={view.sequence}
          label={prompt.count === 'running' ? RUNNING_COUNT : TRUE_COUNT}
          range={view.countRange ?? { min: 0, max: 0 }}
          enabled={answering}
          submitLabel={prompt.count === 'running' && pairs ? NEXT_TRUE_COUNT : undefined}
          onSubmit={(value) => onCommand({ kind: 'answer', value })}
          onSkip={() => onCommand({ kind: 'skip' })}
          onRejected={onInputRejected}
        />
      )}
      {view.phase === 'recorded' && entered !== null && (
        <View style={styles.recorded} accessibilityLiveRegion="polite" testID="recorded-notice">
          <CircleDot color={palette.foreground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.recordedText}>
            {tableRecordedText(entered, prompt.count)}
          </Text>
        </View>
      )}
      {feedback && <TableCoach feedback={feedback} timing={prompt.timing} count={prompt.count} canRetry={view.legalCommands.includes('retry-item')} enabled={ready} onCommand={onCommand} />}
    </>
  );
}

// Spec 3 S3-07 AcmMa
function TableCoach({
  feedback,
  timing,
  count,
  canRetry,
  enabled,
  onCommand,
}: {
  feedback: LearnFeedback;
  timing: NonNullable<TableView['prompt']>['timing'];
  count: 'running' | 'true';
  canRetry: boolean;
  enabled: boolean;
  onCommand: (command: LearnerCommand) => void;
}) {
  const { explanation } = feedback;
  const running = explanation.kind === 'table-running';
  const headline = running ? runningHeadline(explanation.count) : `The true count is ${signed(feedback.reference)}.`;
  const detail = running ? tableRunningText(explanation, timing) : explanation.kind === 'conversion' ? conversionText(explanation) : '';
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {enteredLine(feedback.entered, count, feedback.reference)}
      </Text>
      <View style={styles.coach} accessibilityLiveRegion="polite" testID="coach-note">
        <View style={styles.coachHead}>
          <View style={styles.who}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.coachName}>
              {COACH_NAME}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.coachKicker}>
              {running ? RUNNING_KICKER : CONVERSION_KICKER}
            </Text>
          </View>
          <Info color={palette.coachAccent} size={18} />
        </View>
        <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>
          {headline}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {detail}
        </Text>
        <View style={styles.coachActions}>
          {canRetry ? (
            <>
              <CoachButton label={TRY_AGAIN} primary enabled={enabled} onPress={() => onCommand({ kind: 'retry-item' })} />
              <CoachButton label={SHOW_ANSWER} enabled={enabled} onPress={() => onCommand({ kind: 'next-item' })} />
            </>
          ) : (
            <CoachButton label={CONTINUE} primary enabled={enabled} onPress={() => onCommand({ kind: 'next-item' })} />
          )}
        </View>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
        {ONLY_FIRST_SCORED}
      </Text>
    </>
  );
}

function ShufflePanel({ table, enabled, onContinue }: { table: TableView; enabled: boolean; onContinue: () => void }) {
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {NEW_SHOE}
      </Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.panelTitle}>
        {SHUFFLED_TITLE}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText} accessibilityLiveRegion="polite">
        {shuffledText(table.round)}
      </Text>
      <Button label={continueText(table.round, table.interval)} icon={ArrowRight} stretch disabled={!enabled} onPress={onContinue} />
    </>
  );
}

// Spec 3 Screens › Exercise (table on the 04a–04d layout)
function Felt({ table }: { table: TableView }) {
  const others = table.seats.filter((seat) => !seat.learner);
  const learner = table.seats.find((seat) => seat.learner);
  return (
    <View style={styles.felt} testID="table-felt">
      <View accessible accessibilityLabel={decksText(table)} style={styles.decks}>
        {table.step === 'shuffle' ? <Shuffle color={palette.feltText} size={16} /> : <Layers color={palette.feltText} size={16} />}
        <Text maxFontSizeMultiplier={textScale.body} style={styles.decksText}>
          {decksText(table)}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.feltLabel}>
        {DEALER}
      </Text>
      <View style={styles.handRow}>
        {table.dealer.cards.map((card, index) => (
          <TableCard key={index} card={card} />
        ))}
      </View>
      <View style={styles.rules}>
        <Text maxFontSizeMultiplier={textScale.display} style={styles.pays}>
          {PAYS}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.dealerRule}>
          {dealerRuleText(table.rules.dealer)}
        </Text>
      </View>
      {others.map((seat) =>
        seat.hands.map((hand, index) => (
          <View key={hand.target} style={styles.handRow}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.seatLabel}>
              {seat.hands.length > 1 ? `${seatName(seat.seat)} · ${index + 1}` : seatName(seat.seat)}
            </Text>
            {hand.cards.map((card, i) => (
              <PlayingCard key={i} card={card} small />
            ))}
            {hand.cards.length > 0 && <Badge text={handText(hand)} />}
          </View>
        )),
      )}
      {learner?.hands.map((hand) => <SeatHand key={hand.target} hand={hand} />)}
    </View>
  );
}

function SeatHand({ hand }: { hand: TableHandView }) {
  return (
    <View style={styles.handRow}>
      {hand.action && (
        <View style={styles.action}>
          <Hand color={palette.foreground} size={16} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.actionText}>
            {seatActionText(hand.action)}
          </Text>
        </View>
      )}
      {hand.cards.map((card, index) => (
        <PlayingCard key={index} card={card} />
      ))}
      {hand.cards.length > 0 && <Badge text={handText(hand)} />}
    </View>
  );
}

function TableCard({ card }: { card: ChallengeCard | null }) {
  if (card) return <PlayingCard card={card} />;
  return (
    <View accessible accessibilityLabel="Face-down card" style={styles.cardBack}>
      <View style={styles.cardBackField} />
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.badgeText}>
        {text}
      </Text>
    </View>
  );
}

function CoachButton({ label, primary = false, enabled, onPress }: { label: string; primary?: boolean; enabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.coachButton, primary ? styles.coachPrimary : styles.coachSecondary, pressed && styles.pressed, focused && styles.coachFocused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.coachButtonText, primary && styles.coachPrimaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 60, paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[1] },
  titles: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  felt: { gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.felt, alignItems: 'center', minHeight: 280 },
  decks: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[1], paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: palette.feltDeep },
  decksText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.feltText },
  feltLabel: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 0.5, color: palette.feltText },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  rules: { alignItems: 'center', gap: 2 },
  pays: { fontFamily: fonts.display, fontSize: 18, color: palette.feltText, textAlign: 'center' },
  dealerRule: { fontFamily: fonts.uiMedium, fontSize: 10, letterSpacing: 0.5, color: palette.feltText, textAlign: 'center' },
  seatLabel: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.feltText },
  action: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[1], paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: palette.primary },
  actionText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.primaryForeground },
  badge: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.pill, backgroundColor: palette.feltDeep },
  badgeText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.feltText },
  cardBack: { width: 56, minHeight: 80, padding: 4, borderRadius: radius.sm, backgroundColor: palette.cardFace },
  cardBackField: { flex: 1, borderRadius: 4, backgroundColor: palette.chip5 },
  panel: { gap: space[3], paddingHorizontal: space[4], paddingTop: space[4] },
  kicker: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  panelTitle: { fontFamily: fonts.display, fontSize: 22, color: palette.foreground },
  checkpointTitle: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  panelText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: palette.mutedForeground },
  recorded: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3], paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  recordedText: { flex: 1, fontFamily: fonts.ui, fontSize: 14, color: palette.foreground },
  coach: { gap: space[3] - 2, paddingTop: 14, paddingHorizontal: space[4], paddingBottom: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.coachAccent, backgroundColor: palette.coach },
  coachHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] - 2 },
  who: { flex: 1 },
  coachName: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.ink },
  coachKicker: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.5, color: palette.coachAccent },
  headline: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.ink },
  detail: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.inkMuted },
  coachActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  coachButton: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 2 },
  coachPrimary: { backgroundColor: palette.ink, borderColor: palette.ink },
  coachSecondary: { borderColor: palette.inkMuted },
  coachButtonText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.ink },
  coachPrimaryText: { color: palette.coach },
  coachFocused: { borderColor: palette.coachAccent },
  pressed: { opacity: 0.8 },
});

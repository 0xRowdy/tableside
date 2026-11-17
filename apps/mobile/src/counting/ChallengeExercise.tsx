// Spec 3 S3-03 P4WjR; #158

import type { ChallengeCard, ChallengeView, HiLoValue, LearnFeedback } from '@tableside/engine';
import { Check, CircleCheck, CircleX, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { cardName, cardRank, signed, SUIT_GLYPH } from '@/play/blackjack-text';
import { SaveFailedBanner } from '@/play/TableChrome';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import {
  CATEGORY_TEXT,
  CHOICE_TAG,
  choiceState,
  COACH_NAME,
  feedbackText,
  NEXT_CARD,
  PACING_LABEL,
  progressText,
  spokenValue,
  TRY_AGAIN,
  variantLabel,
} from '@/training/challenge-text';
import type { LearnerCommand } from '@/training/service';

const SUIT_TOKEN = { spades: 'suitSpade', hearts: 'suitHeart', diamonds: 'suitDiamond', clubs: 'suitClub' } as const;

export function ChallengeExercise({
  view,
  busy,
  saveFailed,
  onCommand,
  onRetrySave,
}: {
  view: ChallengeView;
  busy: boolean;
  saveFailed: boolean;
  onCommand: (command: LearnerCommand) => void;
  onRetrySave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const answering = view.legalCommands.includes('answer') && !busy && !saveFailed;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {CATEGORY_TEXT[view.category].title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
          {`${variantLabel(view.variant)} · ${PACING_LABEL}`}
        </Text>
      </View>
      <View style={styles.progress}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.progressText}>
          {progressText(view.position, view.length)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(view.position / view.length) * 100}%` }]} />
        </View>
      </View>
      <View style={styles.body}>
        {saveFailed && <SaveFailedBanner busy={busy} onRetry={onRetrySave} />}
        {view.item && <PlayingCard card={view.item.card} />}
        <View style={styles.choices}>
          {view.choices.map((value) => (
            <Choice key={value} value={value} feedback={view.feedback} enabled={answering} onPress={() => onCommand({ kind: 'answer', value })} />
          ))}
        </View>
        {view.feedback && <CoachNote feedback={view.feedback} canRetry={view.legalCommands.includes('retry-item')} enabled={!busy && !saveFailed} onCommand={onCommand} />}
      </View>
    </ScrollView>
  );
}

function PlayingCard({ card }: { card: ChallengeCard }) {
  const color = palette[SUIT_TOKEN[card.suit]];
  const glyph = SUIT_GLYPH[card.suit];
  return (
    <View accessible accessibilityLabel={cardName(card)} testID="challenge-card" style={styles.card}>
      <View style={styles.corner}>
        <Text maxFontSizeMultiplier={1} style={[styles.rank, { color }]}>
          {cardRank(card)}
        </Text>
        <Text maxFontSizeMultiplier={1} style={[styles.cornerSuit, { color }]}>
          {glyph}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1} style={[styles.pip, { color }]}>
        {glyph}
      </Text>
    </View>
  );
}

function Choice({ value, feedback, enabled, onPress }: { value: HiLoValue; feedback: LearnFeedback | null; enabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  const state = choiceState(value, feedback);
  const tone = state === 'correct' ? palette.correct : state === 'your-answer' ? palette.mistake : palette.controlBorder;
  const Icon = state === 'correct' ? Check : X;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenValue(value)}
      accessibilityValue={state ? { text: CHOICE_TAG[state] } : undefined}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.choice, { borderColor: tone }, state !== null && styles.choiceMarked, pressed && styles.pressed, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.choiceValue}>
        {signed(value)}
      </Text>
      {state && (
        <View style={styles.tag}>
          <Icon color={tone} size={14} />
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.tagText, { color: tone }]}>
            {CHOICE_TAG[state]}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function CoachNote({ feedback, canRetry, enabled, onCommand }: { feedback: LearnFeedback; canRetry: boolean; enabled: boolean; onCommand: (command: LearnerCommand) => void }) {
  const text = feedbackText(feedback);
  const KindIcon = feedback.correct ? CircleCheck : CircleX;
  const kindColor = feedback.correct ? palette.ink : palette.mistakeInk;
  return (
    <View style={styles.coach} accessibilityLiveRegion="polite" testID="coach-note">
      <View style={styles.coachHead}>
        <View style={styles.who}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.coachName}>
            {COACH_NAME}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.kicker, { color: kindColor }]}>
            {text.kicker}
          </Text>
        </View>
        <KindIcon color={kindColor} size={18} />
      </View>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>
        {text.headline}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
        {text.detail}
      </Text>
      <View style={styles.coachActions}>
        <CoachButton label={NEXT_CARD} primary enabled={enabled} onPress={() => onCommand({ kind: 'next-item' })} />
        {canRetry && <CoachButton label={TRY_AGAIN} enabled={enabled} onPress={() => onCommand({ kind: 'retry-item' })} />}
      </View>
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
  header: { gap: 2, minHeight: 60, justifyContent: 'center', paddingHorizontal: space[4], paddingVertical: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  progress: { gap: space[1] + 2, paddingHorizontal: space[4], paddingTop: space[1] + 2, paddingBottom: space[3] - 2 },
  progressText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.foreground },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.primary },
  body: { gap: space[4], paddingHorizontal: space[4], paddingTop: space[3] },
  card: { alignSelf: 'center', width: 120, height: 168, paddingVertical: space[3] - 2, paddingHorizontal: space[3], borderRadius: 12, backgroundColor: palette.cardFace, justifyContent: 'space-between' },
  corner: { alignItems: 'center', alignSelf: 'flex-start' },
  rank: { fontFamily: fonts.uiBold, fontSize: 40, lineHeight: 44 },
  cornerSuit: { fontSize: 28, lineHeight: 30 },
  pip: { alignSelf: 'flex-end', fontSize: 60, lineHeight: 64 },
  choices: { flexDirection: 'row', gap: space[3] - 2 },
  choice: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingVertical: space[3],
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: palette.secondary,
  },
  choiceMarked: { borderWidth: 2, minHeight: 96 },
  choiceValue: { fontFamily: fonts.uiBold, fontSize: 30, color: palette.foreground },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  tagText: { fontFamily: fonts.uiBold, fontSize: 12 },
  coach: { gap: space[3] - 2, paddingTop: 14, paddingHorizontal: space[4], paddingBottom: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.coachAccent, backgroundColor: palette.coach },
  coachHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] - 2 },
  who: { flex: 1 },
  coachName: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.ink },
  kicker: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.5 },
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
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

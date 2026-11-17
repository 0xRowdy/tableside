// Spec 3 S3-03 P4WjR, drVnR, BFdJT, S3-04 qdnQm, S3-05 EDnGd, S3-06 C53yTW; #158, #132, #133

import type { ChallengeCard, ChallengeCategory, ChallengeEntry, ChallengeView, HiLoValue, LearnFeedback } from '@tableside/engine';
import { Check, CircleCheck, CircleDot, CircleX, SkipForward, X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { cardName, cardRank, signed, SUIT_GLYPH } from '@/play/blackjack-text';
import { SaveFailedBanner } from '@/play/TableChrome';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { CountAid } from './CountAid';
import { CountEntry } from './CountEntry';
import {
  CARD_PROMPT,
  CATEGORY_TEXT,
  checkpointKicker,
  checkpointOf,
  COUNT_LABEL,
  countPrompt,
  exerciseProgress,
  keepCounting,
  CHOICE_TAG,
  choiceState,
  COACH_NAME,
  feedbackText,
  NEXT_CARD,
  PACING_LABEL,
  recordedText,
  SKIP_LABEL,
  spokenValue,
  TRY_AGAIN,
  variantLabel,
  type ChoiceState,
} from '@/training/challenge-text';
import type { LearnerCommand } from '@/training/service';

const SUIT_TOKEN = { spades: 'suitSpade', hearts: 'suitHeart', diamonds: 'suitDiamond', clubs: 'suitClub' } as const;

export function ChallengeExercise({
  view,
  busy,
  saveFailed,
  onCommand,
  onInputRejected,
  onRetrySave,
}: {
  view: ChallengeView;
  busy: boolean;
  saveFailed: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
  onRetrySave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const ready = !busy && !saveFailed;
  const answering = view.legalCommands.includes('answer') && ready;
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  const checkpoint = checkpointOf(view);
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
          {exerciseProgress(view)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(view.position / view.length) * 100}%` }]} />
        </View>
      </View>
      <View style={styles.body}>
        {saveFailed && <SaveFailedBanner busy={busy} onRetry={onRetrySave} />}
        {view.item && <PlayingCard card={view.item.card} />}
        {view.item && !feedback && view.countRange === null && (
          <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
            {CARD_PROMPT}
          </Text>
        )}
        {view.phase === 'question' && view.countRange !== null && (
          <View style={styles.countPrompt}>
            {checkpoint && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.checkpointKicker}>
                {checkpointKicker(checkpoint)}
              </Text>
            )}
            <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
              {countPrompt(view.position)}
            </Text>
          </View>
        )}
        {view.phase === 'card' && checkpoint && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.keep}>
            {keepCounting(checkpoint)}
          </Text>
        )}
        {view.countAid && <CountAid key={view.attemptId} variant={view.variant} aid={view.countAid} enabled={ready && view.legalCommands.includes('reveal-count')} onReveal={() => onCommand({ kind: 'reveal-count' })} />}
        {view.countRange === null ? (
          <>
            <View style={styles.choices}>
              {view.choices.map((value) => (
                <Choice key={value} value={value} state={choiceState(value, feedback, entered)} enabled={answering} onPress={() => onCommand({ kind: 'answer', value })} />
              ))}
            </View>
            {view.legalCommands.includes('skip') && <Button label={SKIP_LABEL} icon={SkipForward} variant="outline" stretch disabled={!answering} onPress={() => onCommand({ kind: 'skip' })} />}
          </>
        ) : (
          view.phase === 'question' && (
            <CountEntry
              key={view.position}
              label={COUNT_LABEL}
              range={view.countRange}
              enabled={answering}
              onSubmit={(value) => onCommand({ kind: 'answer', value })}
              onSkip={() => onCommand({ kind: 'skip' })}
              onRejected={onInputRejected}
            />
          )
        )}
        {view.phase === 'card' && <Button label={NEXT_CARD} stretch disabled={!ready} onPress={() => onCommand({ kind: 'next-item' })} />}
        {view.phase === 'recorded' && entered !== null && <RecordedNotice entered={entered} category={view.category} />}
        {feedback && <CoachNote feedback={feedback} position={view.position} canRetry={view.legalCommands.includes('retry-item')} enabled={ready} onCommand={onCommand} />}
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

const CHOICE_TONE = { correct: palette.correct, 'your-answer': palette.mistake, recorded: palette.foreground } as const;
const CHOICE_ICON = { correct: Check, 'your-answer': X, recorded: CircleDot } as const;

function Choice({ value, state, enabled, onPress }: { value: HiLoValue; state: ChoiceState; enabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  const tone = state ? CHOICE_TONE[state] : palette.controlBorder;
  const Icon = state ? CHOICE_ICON[state] : X;
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

// Spec 3 Learn, Check and assistance › Answer accepted
function RecordedNotice({ entered, category }: { entered: ChallengeEntry; category: ChallengeCategory }) {
  return (
    <View style={styles.recorded} accessibilityLiveRegion="polite" testID="recorded-notice">
      <CircleDot color={palette.foreground} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.recordedText}>
        {recordedText(entered, category)}
      </Text>
    </View>
  );
}

function CoachNote({
  feedback,
  position,
  canRetry,
  enabled,
  onCommand,
}: {
  feedback: LearnFeedback;
  position: number;
  canRetry: boolean;
  enabled: boolean;
  onCommand: (command: LearnerCommand) => void;
}) {
  const text = feedbackText(feedback, position);
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
  prompt: { fontFamily: fonts.uiBold, fontSize: 18, color: palette.foreground, textAlign: 'center' },
  countPrompt: { gap: space[1] },
  checkpointKicker: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.mutedForeground, textAlign: 'center' },
  keep: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: palette.mutedForeground, textAlign: 'center' },
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
  recorded: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3], paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  recordedText: { flex: 1, fontFamily: fonts.ui, fontSize: 14, color: palette.foreground },
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

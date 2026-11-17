// Spec 3 S3-04 qdnQm, S3-05 EDnGd, S3-06 C53yTW, zAatf, Qv1An, S3-07; #132, #133, #134, #146, #137

import type { HintId } from '@tableside/definitions';
import type { ChallengeCategory, ChallengeEntry, ChallengeView, ConversionItem, CountRange, LearnFeedback } from '@tableside/engine';
import { CircleCheck, CircleDot, CircleX, Info, SkipForward } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Choice, PlayingCard } from '@/counting/CardChoices';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { FirstUseHint, HelpButton } from '@/lessons/FirstUseHints';
import { signed } from '@/play/blackjack-text';
import { SaveFailedBanner } from '@/play/TableChrome';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { CountAid } from './CountAid';
import { CountEntry } from './CountEntry';
import { TableExercise } from './TableExercise';
import { decksText } from '@/training/blackjack-conversion-text';
import {
  CARD_PROMPT,
  CATEGORY_TEXT,
  checkpointKicker,
  checkpointOf,
  COUNT_LABEL,
  countPrompt,
  GIVEN_DECKS,
  GIVEN_RUNNING_COUNT,
  NEXT_QUESTION,
  spokenValue,
  TRUE_COUNT_LABEL,
  TRUE_COUNT_PROMPT,
  TRY_AGAIN,
  TRY_QUESTION_AGAIN,
  exerciseProgress,
  keepCounting,
  choiceState,
  COACH_NAME,
  CONVERSION_LESSON_ACTION,
  feedbackText,
  NEXT_CARD,
  PACING_LABEL,
  recordedText,
  SKIP_LABEL,
  variantLabel,
} from '@/training/challenge-text';
import type { LearnerCommand, LessonEntry } from '@/training/service';

const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;

// Spec 3 Lessons › Structure (First-use hints); #146
export function exerciseHints(view: ChallengeView): readonly HintId[] {
  if (view.countRange === null) return [];
  return view.countAid ? ['count-entry', 'show-count'] : ['count-entry'];
}

export function ChallengeExercise({
  view,
  busy,
  saveFailed,
  onCommand,
  onInputRejected,
  onRetrySave,
  lesson,
  onOpenLesson,
}: {
  view: ChallengeView;
  busy: boolean;
  saveFailed: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
  onRetrySave: () => void;
  lesson?: LessonEntry;
  onOpenLesson?: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const ready = !busy && !saveFailed;
  const answering = view.legalCommands.includes('answer') && ready;
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  if (view.table) return <TableExercise view={view} table={view.table} busy={busy} saveFailed={saveFailed} onCommand={onCommand} onInputRejected={onInputRejected} onRetrySave={onRetrySave} />;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            {CATEGORY_TEXT[view.category].title}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
            {`${variantLabel(view.variant)} · ${PACING_LABEL}`}
          </Text>
        </View>
        <HelpButton />
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
        {view.category === 'conversion' && view.countRange ? (
          <ConversionBody
            view={view}
            range={view.countRange}
            ready={ready}
            answering={answering}
            onCommand={onCommand}
            onInputRejected={onInputRejected}
            onLesson={lesson?.steps != null && onOpenLesson ? () => onOpenLesson(lesson.id) : null}
          />
        ) : view.countRange === null ? (
          <>
            {view.item && 'card' in view.item && <PlayingCard card={view.item.card} />}
            {view.item && !feedback && (
              <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
                {CARD_PROMPT}
              </Text>
            )}
            <View style={styles.choices}>
              {view.choices.map((value) => (
                <Choice key={value} label={signed(value)} spoken={spokenValue(value)} state={choiceState(value, feedback, entered)} enabled={answering} onPress={() => onCommand({ kind: 'answer', value })} />
              ))}
            </View>
            {view.legalCommands.includes('skip') && <Button label={SKIP_LABEL} icon={SkipForward} variant="outline" stretch disabled={!answering} onPress={() => onCommand({ kind: 'skip' })} />}
            {view.phase === 'recorded' && entered !== null && <RecordedNotice entered={entered} category={view.category} />}
            {feedback && <CoachNote feedback={feedback} position={view.position} canRetry={view.legalCommands.includes('retry-item')} enabled={ready} onCommand={onCommand} />}
          </>
        ) : (
          <CountingBody view={view} range={view.countRange} ready={ready} answering={answering} onCommand={onCommand} onInputRejected={onInputRejected} />
        )}
      </View>
    </ScrollView>
  );
}

// Spec 3 S3-04 qdnQm, uGcdq, l3UjHq
function CountingBody({
  view,
  range,
  ready,
  answering,
  onCommand,
  onInputRejected,
}: {
  view: ChallengeView;
  range: CountRange;
  ready: boolean;
  answering: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  const checkpoint = checkpointOf(view);
  return (
    <View testID="count-columns" style={[styles.columns, { flexDirection: sideBySide ? 'row' : 'column' }]}>
      <View style={[styles.column, sideBySide && styles.side]}>
        <View style={[styles.cardRow, sideBySide && styles.cardStack]}>
          {view.item && 'card' in view.item && <PlayingCard card={view.item.card} small={!sideBySide} />}
          {view.phase === 'question' && (
            <View style={[styles.countPrompt, !sideBySide && styles.promptBeside]}>
              {checkpoint && (
                <Text maxFontSizeMultiplier={textScale.body} style={[styles.checkpointKicker, !sideBySide && styles.start]}>
                  {checkpointKicker(checkpoint)}
                </Text>
              )}
              <Text maxFontSizeMultiplier={textScale.display} style={[styles.prompt, !sideBySide && styles.start]}>
                {countPrompt(view.position)}
              </Text>
            </View>
          )}
          {view.phase === 'card' && checkpoint && (
            <Text maxFontSizeMultiplier={textScale.body} style={[styles.keep, !sideBySide && styles.promptBeside, !sideBySide && styles.start]}>
              {keepCounting(checkpoint)}
            </Text>
          )}
        </View>
        {view.countAid && <FirstUseHint id="show-count" />}
        {view.countAid && <CountAid key={view.attemptId} variant={view.variant} aid={view.countAid} enabled={ready && view.legalCommands.includes('reveal-count')} onReveal={() => onCommand({ kind: 'reveal-count' })} />}
      </View>
      <View style={[styles.column, sideBySide && styles.side]}>
        {view.phase === 'question' && <FirstUseHint id="count-entry" />}
        {view.phase === 'question' && (
          <CountEntry
            key={view.position}
            label={COUNT_LABEL}
            range={range}
            enabled={answering}
            onSubmit={(value) => onCommand({ kind: 'answer', value })}
            onSkip={() => onCommand({ kind: 'skip' })}
            onRejected={onInputRejected}
          />
        )}
        {view.phase === 'card' && <Button label={NEXT_CARD} stretch disabled={!ready} onPress={() => onCommand({ kind: 'next-item' })} />}
        {view.phase === 'recorded' && entered !== null && <RecordedNotice entered={entered} category={view.category} />}
        {feedback && <CoachNote feedback={feedback} position={view.position} canRetry={view.legalCommands.includes('retry-item')} enabled={ready} onCommand={onCommand} />}
      </View>
    </View>
  );
}

// Spec 3 Challenge content › Conversion; S3-06 zAatf, BFM4l, Qv1An
function ConversionBody({
  view,
  range,
  ready,
  answering,
  onCommand,
  onInputRejected,
  onLesson,
}: {
  view: ChallengeView;
  range: CountRange;
  ready: boolean;
  answering: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
  onLesson: (() => void) | null;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  const question = view.item && 'running' in view.item ? view.item : null;
  return (
    <View testID="count-columns" style={[styles.columns, { flexDirection: sideBySide ? 'row' : 'column' }]}>
      <View style={[styles.column, sideBySide && styles.side]}>
        {question && <GivenValues question={question} />}
        {feedback && <ConversionNote feedback={feedback} canRetry={view.legalCommands.includes('retry-item')} enabled={ready} onCommand={onCommand} onLesson={onLesson} />}
      </View>
      <View style={[styles.column, sideBySide && styles.side]}>
        {view.phase === 'question' && <FirstUseHint id="count-entry" />}
        {(view.phase === 'question' || feedback) && (
          <>
            <Text maxFontSizeMultiplier={textScale.display} style={[styles.prompt, styles.start]}>
              {TRUE_COUNT_PROMPT}
            </Text>
            <CountEntry
              key={view.position}
              label={TRUE_COUNT_LABEL}
              range={range}
              enabled={answering}
              onSubmit={(value) => onCommand({ kind: 'answer', value })}
              onSkip={() => onCommand({ kind: 'skip' })}
              onRejected={onInputRejected}
              next={feedback ? { label: NEXT_QUESTION, enabled: ready, onPress: () => onCommand({ kind: 'next-item' }) } : undefined}
            />
          </>
        )}
        {view.phase === 'recorded' && entered !== null && <RecordedNotice entered={entered} category={view.category} />}
      </View>
    </View>
  );
}

// Spec 3 S3-06 Qv1An
function ConversionNote({
  feedback,
  canRetry,
  enabled,
  onCommand,
  onLesson,
}: {
  feedback: LearnFeedback;
  canRetry: boolean;
  enabled: boolean;
  onCommand: (command: LearnerCommand) => void;
  onLesson: (() => void) | null;
}) {
  const text = feedbackText(feedback, 0);
  return (
    <View style={styles.coach} accessibilityLiveRegion="polite" testID="coach-note">
      <View style={styles.coachHead}>
        <View style={styles.who}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.coachName}>
            {COACH_NAME}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.kicker, { color: palette.coachAccent }]}>
            {text.kicker}
          </Text>
        </View>
        <Info color={palette.coachAccent} size={18} />
      </View>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>
        {text.headline}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
        {text.detail}
      </Text>
      <View style={styles.coachActions}>
        <CoachButton label={CONVERSION_LESSON_ACTION} primary enabled={enabled && onLesson !== null} onPress={() => onLesson?.()} />
        {canRetry && <CoachButton label={TRY_QUESTION_AGAIN} enabled={enabled} onPress={() => onCommand({ kind: 'retry-item' })} />}
      </View>
    </View>
  );
}

function GivenValues({ question }: { question: ConversionItem }) {
  return (
    <View style={styles.given} testID="given-values">
      <Given label={GIVEN_RUNNING_COUNT} value={signed(question.running)} spoken={spokenValue(question.running)} />
      <Given label={GIVEN_DECKS} value={decksText(question.decks)} spoken={decksText(question.decks)} />
    </View>
  );
}

function Given({ label, value, spoken }: { label: string; value: string; spoken: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${spoken}`} style={styles.givenTile}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.givenLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.givenValue}>
        {value}
      </Text>
    </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 60, paddingLeft: space[4], paddingRight: space[2], paddingVertical: space[1] },
  titles: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  progress: { gap: space[1] + 2, paddingHorizontal: space[4], paddingTop: space[1] + 2, paddingBottom: space[3] - 2 },
  progressText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.foreground },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.primary },
  body: { gap: space[4], paddingHorizontal: space[4], paddingTop: space[3] },
  prompt: { fontFamily: fonts.uiBold, fontSize: 18, color: palette.foreground, textAlign: 'center' },
  countPrompt: { gap: space[1] },
  columns: { gap: space[4] },
  column: { gap: space[4] },
  side: { flex: 1, justifyContent: 'center' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  cardStack: { flexDirection: 'column' },
  promptBeside: { flex: 1 },
  start: { textAlign: 'left' },
  checkpointKicker: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.mutedForeground, textAlign: 'center' },
  keep: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: palette.mutedForeground, textAlign: 'center' },
  choices: { flexDirection: 'row', gap: space[3] - 2 },
  given: { flexDirection: 'row', gap: space[3] - 2 },
  givenTile: { flex: 1, gap: space[1], paddingVertical: 14, paddingHorizontal: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  givenLabel: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  givenValue: { fontFamily: fonts.uiBold, fontSize: 34, color: palette.foreground },
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

// Spec 3 S3-03 P4WjR, drVnR, BFdJT, S3-04 qdnQm, S3-05 EDnGd, r5pCx, T9sCI, S3-06 C53yTW; #158, #132, #133, #135

import type { ChallengeCategory, ChallengeEntry, ChallengeView, CountRange, LearnFeedback } from '@tableside/engine';
import { CircleAlert, CircleCheck, CircleDot, CircleHelp, CircleX, Pause, SkipForward, Timer, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Choice, PlayingCard } from '@/counting/CardChoices';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { usePolling } from '@/hooks/use-polling';
import { SaveFailedBanner } from '@/play/TableChrome';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { HelpSheet, HoldSheet } from './AttemptSheets';
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
  choiceState,
  COACH_NAME,
  exerciseSubtitle,
  feedbackText,
  HELP_LABEL,
  NEXT_CARD,
  PAUSE_LABEL,
  recordedText,
  SKIP_LABEL,
  spokenTimer,
  timerText,
  TRY_AGAIN,
  turnBoundaryText,
} from '@/training/challenge-text';
import type { AttemptHold, PerformanceTimer } from '@/training/controller';
import type { LearnerCommand } from '@/training/service';

const TIMER_TICK_MS = 1000;

const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;

export function ChallengeExercise({
  view,
  busy,
  saveFailed,
  hold,
  timer,
  performanceMs,
  onCommand,
  onInputRejected,
  onRetrySave,
  onPause,
  onResume,
  onEnd,
  onLeave,
}: {
  view: ChallengeView;
  busy: boolean;
  saveFailed: boolean;
  hold: AttemptHold | null;
  timer: PerformanceTimer | null;
  performanceMs: () => number | null;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
  onRetrySave: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [helping, setHelping] = useState(false);
  const held = hold?.reached ?? false;
  const ready = !busy && !saveFailed && !held;
  const answering = view.legalCommands.includes('answer') && ready;
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            {CATEGORY_TEXT[view.category].title}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
            {exerciseSubtitle(view.variant, timer !== null, hold)}
          </Text>
        </View>
        <HeaderButton label={HELP_LABEL} icon={CircleHelp} enabled onPress={() => setHelping(true)} />
        <HeaderButton label={PAUSE_LABEL} icon={Pause} enabled={!held} onPress={onPause} />
      </View>
      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.progressText}>
            {exerciseProgress(view)}
          </Text>
          {timer && <PerformanceTime timer={timer} performanceMs={performanceMs} />}
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(view.position / view.length) * 100}%` }]} />
        </View>
      </View>
      <View style={styles.body}>
        {saveFailed && <SaveFailedBanner busy={busy} onRetry={onRetrySave} />}
        {hold && !hold.reached && (
          <View style={styles.boundary}>
            <CircleAlert color={palette.warning} size={20} />
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.boundaryText}>
              {turnBoundaryText(hold)}
            </Text>
          </View>
        )}
        {view.countRange === null ? (
          <>
            {view.item && <PlayingCard card={view.item.card} />}
            {view.item && !feedback && (
              <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
                {CARD_PROMPT}
              </Text>
            )}
            <View style={styles.choices}>
              {view.choices.map((value) => (
                <Choice key={value} value={value} state={choiceState(value, feedback, entered)} enabled={answering} onPress={() => onCommand({ kind: 'answer', value })} />
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
      {hold?.reached && !helping && <HoldSheet hold={hold} variant={view.variant} busy={busy} onResume={onResume} onEnd={onEnd} onClose={onLeave} />}
      {helping && <HelpSheet view={view} onClose={() => setHelping(false)} />}
    </ScrollView>
  );
}

function HeaderButton({ label, icon: Icon, enabled, onPress }: { label: string; icon: LucideIcon; enabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed, focused && styles.focused, !enabled && styles.disabled]}
    >
      <Icon color={palette.foreground} size={24} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.headerButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

// Spec 3 Attempt lifecycle › Performance timer; S3-04 qdnQm
function PerformanceTime({ timer, performanceMs }: { timer: PerformanceTimer; performanceMs: () => number | null }) {
  const [, setTick] = useState(0);
  usePolling(() => setTick((tick) => tick + 1), TIMER_TICK_MS, timer.since !== null);
  const ms = performanceMs() ?? timer.ms;
  return (
    <View accessible accessibilityLabel={spokenTimer(ms)} style={styles.timer}>
      <Timer color={palette.mutedForeground} size={16} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.timerText}>
        {timerText(ms)}
      </Text>
    </View>
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
          {view.item && <PlayingCard card={view.item.card} small={!sideBySide} />}
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
        {view.countAid && <CountAid key={view.attemptId} variant={view.variant} aid={view.countAid} enabled={ready && view.legalCommands.includes('reveal-count')} onReveal={() => onCommand({ kind: 'reveal-count' })} />}
      </View>
      <View style={[styles.column, sideBySide && styles.side]}>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 60, paddingHorizontal: space[4], paddingVertical: space[1] },
  titles: { flex: 1, gap: 2 },
  headerButton: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: space[1], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  headerButtonText: { fontFamily: fonts.uiBold, fontSize: 11, color: palette.mutedForeground },
  disabled: { opacity: 0.4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  timerText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.mutedForeground, fontVariant: ['tabular-nums'] },
  boundary: { flexDirection: 'row', gap: space[3], padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.warning, backgroundColor: palette.card },
  boundaryText: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, lineHeight: 20, color: palette.foreground },
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

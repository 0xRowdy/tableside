// Spec 3 S3-12 l8pMS, pX6CV, hGHha, S3-13 JJl51, Fvlgc, ZBpF3; Amendment 1 B2, B4, C10, C11
// Spec 3 Amendment 2 §3; #143, #152

import type { LessonHandoff, LessonSource, PublishedNote } from '@tableside/definitions';
import { ArrowLeft, ArrowRight, ChevronRight, GraduationCap, Play, RefreshCcw, RotateCcw, Shuffle, Spade, SquarePlay, type LucideIcon } from 'lucide-react-native';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet, SheetText } from '@/components/Sheet';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { TextLink } from '@/lessons/LessonEntries';
import { NavButton } from '@/lessons/LessonParts';
import { BackButton } from '@/settings/SettingsParts';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import type { AllowanceCopy } from '@/training/challenge-text';
import {
  BACK,
  backTo,
  CREDITS_HEADING,
  CREDITS_NOTE,
  FINISH,
  HANDOFF_INTRO,
  HANDOFF_TITLE,
  handoffDetail,
  handoffLabel,
  lessonKind,
  NEXT,
  noticeText,
  PUBLISHED_NOTE_TITLE,
  RESTART_FROM_START,
  RESTART_LESSON,
  RESTART_NOTE,
  resumeAt,
  SAVE_FAILED,
  sourceText,
  SOURCES_HEADING,
  SOURCES_INTRO,
  sourcesStepText,
  stepText,
  stoppedAt,
  TRY_EXAMPLE,
} from '@/training/lesson-text';
import { stepCount, type LessonView } from '@/training/service';

export interface LessonActions {
  readonly onLeave: () => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onFinish: () => void;
  readonly onRestart: () => void;
  readonly onResume: () => void;
  readonly onExample: () => void;
  readonly onHandoff: (handoff: LessonHandoff) => void;
}

// Spec 3 S3-13 ZBpF3
export interface HandoffSheet {
  readonly allowance: AllowanceCopy | undefined;
}

export function LessonPlayer({
  view,
  back,
  busy,
  saveFailed,
  handoffSheet,
  actions,
}: {
  view: LessonView;
  back: string;
  busy: boolean;
  saveFailed: boolean;
  handoffSheet: HandoffSheet | null;
  actions: LessonActions;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const steps = stepCount(view);
  const authored = view.steps[view.step - 1];
  const page = authored
    ? { label: stepText(view.step, steps), heading: authored.heading, paragraphs: authored.paragraphs }
    : { label: sourcesStepText(view.step, steps), heading: SOURCES_HEADING, paragraphs: [SOURCES_INTRO] };
  const last = view.step === steps;
  return (
    <>
      <ScrollView
        testID="lesson-scroll"
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}
      >
        <View style={styles.header}>
          <BackButton label={back} onPress={actions.onLeave} />
          <View style={styles.titles}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
              {view.title}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kind}>
              {lessonKind(view.section)}
            </Text>
          </View>
          <IconButton icon={RotateCcw} label={RESTART_LESSON} disabled={busy} onPress={actions.onRestart} />
        </View>
        <View style={styles.body}>
          {view.notice && <ChangeNotice notice={view.notice} />}
          <View style={styles.progress}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.stepText}>
              {page.label}
            </Text>
            <View style={styles.segments} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {Array.from({ length: steps }, (_, index) => (
                <View key={index} style={[styles.segment, index < view.step && styles.segmentDone]} />
              ))}
            </View>
          </View>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.heading}>
            {page.heading}
          </Text>
          {page.paragraphs.map((paragraph, index) => (
            <Text key={index} maxFontSizeMultiplier={textScale.body} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {authored?.publishedNote ? <PublishedNoteBox note={authored.publishedNote} /> : authored?.source && <StepSource source={authored.source} />}
          {!authored && <Credits sources={view.sources} />}
          {view.example?.step === view.step && <ExampleLink disabled={busy} onPress={actions.onExample} />}
          {view.step === view.steps.length &&
            view.handoffs.map((handoff) => (
              <HandoffLink key={handoffLabel(handoff)} handoff={handoff} disabled={busy} onPress={() => actions.onHandoff(handoff)} />
            ))}
          {saveFailed && (
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.alert}>
              {SAVE_FAILED}
            </Text>
          )}
          <View style={styles.nav}>
            <NavButton icon={ArrowLeft} label={BACK} disabled={busy} onPress={view.step === 1 ? actions.onLeave : actions.onBack} />
            {last ? (
              <NavButton icon={ArrowRight} label={FINISH} primary disabled={busy} onPress={actions.onFinish} />
            ) : (
              <NavButton icon={ArrowRight} label={NEXT} primary disabled={busy} onPress={actions.onNext} />
            )}
          </View>
        </View>
      </ScrollView>
      {view.prompt && (
        <Sheet title={view.title} onClose={actions.onLeave} testID="lesson-resume-scroll">
          <SheetText>{stoppedAt(view.prompt.step, steps)}</SheetText>
          <NavButton icon={Play} label={resumeAt(view.prompt.step)} primary block disabled={false} onPress={actions.onResume} />
          <NavButton icon={RotateCcw} label={RESTART_FROM_START} block disabled={busy} onPress={actions.onRestart} />
          <SheetText small>{RESTART_NOTE}</SheetText>
        </Sheet>
      )}
      {handoffSheet && (
        <Sheet title={HANDOFF_TITLE} onClose={actions.onLeave} testID="lesson-handoff-scroll">
          <SheetText>{HANDOFF_INTRO}</SheetText>
          {view.handoffs.map((handoff) => (
            <HandoffOption key={handoffLabel(handoff)} handoff={handoff} detail={handoffDetail(handoff, handoffSheet.allowance)} disabled={busy} onPress={() => actions.onHandoff(handoff)} />
          ))}
          <NavButton label={backTo(back)} quiet block disabled={false} onPress={actions.onLeave} />
        </Sheet>
      )}
    </>
  );
}

const SHEET_ICON: Record<LessonHandoff['kind'], LucideIcon> = { 'learn-challenge': GraduationCap, 'guided-practice': Spade, 'free-play': Shuffle };

// Spec 3 S3-12 pX6CV
function HandoffLink({ handoff, disabled, onPress }: { handoff: LessonHandoff; disabled: boolean; onPress: () => void }) {
  const accent = handoff.kind !== 'free-play';
  return <TextLink icon={accent ? GraduationCap : Play} label={handoffLabel(handoff)} accent={accent} disabled={disabled} onPress={onPress} />;
}

// Spec 3 S3-13 ZBpF3
function HandoffOption({ handoff, detail, disabled, onPress }: { handoff: LessonHandoff; detail: string; disabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const label = handoffLabel(handoff);
  const Icon = SHEET_ICON[handoff.kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.option, pressed && pressStyle.row, disabled && styles.disabled, focused && styles.focused]}
    >
      <Icon color={palette.foreground} size={22} />
      <View style={styles.optionText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.optionTitle}>
          {label}
        </Text>
        {detail ? (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.optionDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={palette.mutedForeground} size={20} />
    </Pressable>
  );
}

function ChangeNotice({ notice }: { notice: NonNullable<LessonView['notice']> }) {
  const styles = useStyles();
  const text = noticeText(notice);
  return (
    <View style={styles.notice}>
      <RefreshCcw color={palette.info} size={22} />
      <View style={styles.noticeText}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.noticeTitle}>
          {text.title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.noticeBody}>
          {text.text}
        </Text>
      </View>
    </View>
  );
}

// Spec 3 S3-12 l8pMS; Amendment 1 B2; Amendment 2 §3 (lesson player); #152
function PublishedNoteBox({ note }: { note: PublishedNote }) {
  const styles = useStyles();
  return (
    <View style={styles.publishedNote}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.publishedTitle}>
        {PUBLISHED_NOTE_TITLE}
      </Text>
      {note.paragraphs.map((paragraph, index) => (
        <Text key={index} maxFontSizeMultiplier={textScale.body} style={styles.publishedText}>
          {paragraph}
        </Text>
      ))}
      <StepSource source={note.source} />
    </View>
  );
}

// Spec 3 Amendment 1 C11
function StepSource({ source }: { source: LessonSource }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const label = sourceText(source.citation);
  const { url } = source;
  if (url === null) {
    return (
      <Text maxFontSizeMultiplier={textScale.body} style={styles.source}>
        {label}
      </Text>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      {...focusProps}
      style={({ pressed }) => [styles.sourceLink, pressed && pressStyle.row, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.source}>
        {label}
      </Text>
    </Pressable>
  );
}

// Spec 3 S3-12 l8pMS; #144
function ExampleLink({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={TRY_EXAMPLE}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.exampleLink, pressed && pressStyle.row, focused && styles.focused]}
    >
      <SquarePlay color={palette.primary} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.exampleLabel}>
        {TRY_EXAMPLE}
      </Text>
    </Pressable>
  );
}

// Spec 3 S3-12 hGHha; Amendment 1 C11
function Credits({ sources }: { sources: readonly LessonSource[] }) {
  const styles = useStyles();
  return (
    <View style={styles.credits}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.creditsHeading}>
        {CREDITS_HEADING}
      </Text>
      {sources.map(({ citation, url }) =>
        url ? (
          <CreditLink key={citation} citation={citation} url={url} />
        ) : (
          <Text key={citation} maxFontSizeMultiplier={textScale.body} style={styles.credit}>
            {citation}
          </Text>
        ),
      )}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.creditsNote}>
        {CREDITS_NOTE}
      </Text>
    </View>
  );
}

function CreditLink({ citation, url }: { citation: string; url: string }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={citation}
      onPress={() => void Linking.openURL(url)}
      {...focusProps}
      style={({ pressed }) => [styles.creditLink, pressed && pressStyle.row, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.credit, styles.creditLinked]}>
        {citation}
      </Text>
    </Pressable>
  );
}

function IconButton({ icon: Icon, label, disabled, onPress }: { icon: LucideIcon; label: string; disabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.iconButton, focused && styles.focused]}
    >
      <Icon color={palette.foreground} size={22} />
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  kind: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  iconButton: { width: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[6] - space[1] },
  notice: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: palette.info,
    backgroundColor: palette.card,
  },
  noticeText: { flex: 1, gap: space[1] },
  noticeTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  noticeBody: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  progress: { gap: space[2] - 2 },
  stepText: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  segments: { flexDirection: 'row', gap: space[1] },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.muted },
  segmentDone: { backgroundColor: palette.primary },
  heading: { fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  paragraph: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  publishedNote: { gap: space[2] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  publishedTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  publishedText: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  source: { fontFamily: fonts.ui, ...type.secondary, color: palette.primary },
  sourceLink: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 2, borderColor: palette.transparent },
  exampleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[2],
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[1],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  optionDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  credits: { gap: space[2] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  creditsHeading: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  creditLink: { justifyContent: 'center', minHeight: MIN_TOUCH_TARGET, borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  credit: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  creditLinked: { color: palette.primary, textDecorationLine: 'underline' },
  creditsNote: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  exampleLabel: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.primary },
  alert: { fontFamily: fonts.ui, ...type.body, color: palette.destructive },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] + 2, paddingTop: space[2] },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
}));

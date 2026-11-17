// Spec 3 S3-12 l8pMS, pX6CV, S3-13 JJl51, Fvlgc and ZBpF3; Amendment 1 B4, C10; #143, #145

import type { LessonHandoff } from '@tableside/definitions';
import { ArrowLeft, ArrowRight, ChevronRight, GraduationCap, Play, RefreshCcw, RotateCcw, Shuffle, Spade, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet, SheetText } from '@/components/Sheet';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { BackButton } from '@/settings/SettingsParts';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import type { AllowanceCopy } from '@/training/challenge-text';
import {
  BACK,
  BACK_TO_LESSONS,
  FINISH,
  HANDOFF_INTRO,
  HANDOFF_TITLE,
  handoffDetail,
  handoffLabel,
  lessonKind,
  NEXT,
  noticeText,
  RESTART_FROM_START,
  RESTART_LESSON,
  RESTART_NOTE,
  resumeAt,
  SAVE_FAILED,
  stepText,
  stoppedAt,
} from '@/training/lesson-text';
import type { LessonView } from '@/training/service';

export interface LessonActions {
  readonly onLeave: () => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
  readonly onFinish: () => void;
  readonly onRestart: () => void;
  readonly onResume: () => void;
  readonly onHandoff: (handoff: LessonHandoff) => void;
}

// Spec 3 S3-13 ZBpF3: shown after Finish when the lesson offers handoffs
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
  const insets = useSafeAreaInsets();
  const step = view.steps[view.step - 1]!;
  const last = view.step === view.steps.length;
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
              {stepText(view.step, view.steps.length)}
            </Text>
            <View style={styles.segments} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {view.steps.map((_, index) => (
                <View key={index} style={[styles.segment, index < view.step && styles.segmentDone]} />
              ))}
            </View>
          </View>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.heading}>
            {step.heading}
          </Text>
          {step.paragraphs.map((paragraph, index) => (
            <Text key={index} maxFontSizeMultiplier={textScale.body} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {last &&
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
          <SheetText>{stoppedAt(view.prompt.step, view.steps.length)}</SheetText>
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
          <NavButton label={BACK_TO_LESSONS} quiet block disabled={false} onPress={actions.onLeave} />
        </Sheet>
      )}
    </>
  );
}

const SHEET_ICON: Record<LessonHandoff['kind'], LucideIcon> = { 'learn-challenge': GraduationCap, 'guided-practice': Spade, 'free-play': Shuffle };

// Spec 3 S3-12 pX6CV
function HandoffLink({ handoff, disabled, onPress }: { handoff: LessonHandoff; disabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  const label = handoffLabel(handoff);
  const accent = handoff.kind !== 'free-play';
  const Icon = accent ? GraduationCap : Play;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
    >
      <Icon color={accent ? palette.primary : palette.foreground} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.linkText, accent && styles.linkAccent]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Spec 3 S3-13 ZBpF3
function HandoffOption({ handoff, detail, disabled, onPress }: { handoff: LessonHandoff; detail: string; disabled: boolean; onPress: () => void }) {
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
      style={({ pressed }) => [styles.option, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
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

function IconButton({ icon: Icon, label, disabled, onPress }: { icon: LucideIcon; label: string; disabled: boolean; onPress: () => void }) {
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

function NavButton({
  icon: Icon,
  label,
  primary = false,
  quiet = false,
  block = false,
  disabled,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  primary?: boolean;
  quiet?: boolean;
  block?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.navButton, block && styles.block, primary && styles.navPrimary, quiet && styles.navQuiet, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
    >
      {Icon && <Icon color={primary ? palette.primaryForeground : palette.foreground} size={18} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.navLabel, primary && styles.navPrimaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  kind: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  iconButton: { width: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[6] - space[1] },
  notice: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.lg - 2,
    borderLeftWidth: 4,
    borderLeftColor: palette.info,
    backgroundColor: palette.card,
  },
  noticeText: { flex: 1, gap: space[1] },
  noticeTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  noticeBody: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  progress: { gap: space[2] - 2 },
  stepText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.mutedForeground },
  segments: { flexDirection: 'row', gap: space[1] },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.muted },
  segmentDone: { backgroundColor: palette.primary },
  heading: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: palette.foreground },
  paragraph: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 25, color: palette.foreground },
  alert: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.destructive },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] + 2, paddingTop: space[2] },
  navButton: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[6] - space[1],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  block: { flexGrow: 0, flexBasis: 'auto', alignSelf: 'stretch' },
  navPrimary: { borderColor: palette.primary, backgroundColor: palette.primary },
  navLabel: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground, textAlign: 'center' },
  navPrimaryLabel: { color: palette.primaryForeground },
  navQuiet: { borderColor: palette.transparent, backgroundColor: palette.transparent },
  link: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48, paddingHorizontal: space[1], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  linkText: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  linkAccent: { color: palette.primary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: fonts.uiBold, fontSize: 16, lineHeight: 24, color: palette.foreground },
  optionDetail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

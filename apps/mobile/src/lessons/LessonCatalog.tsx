// Spec 3 S3-11 sVqX1, LDmev; #143, #149

import { ChevronRight, Circle, CircleCheckBig, CircleDotDashed, CircleHelp, Clock, RefreshCcw, WifiOff, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { Group, GroupLabel, Note, SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { NOT_READY_HINT } from '@/training/challenge-text';
import type { LessonStatus } from '@/training/lesson-progress';
import { CATALOG_INTRO, CHECK_BANNER, FINDING_LESSONS, lessonDetail, LESSONS_TITLE, RETURN_TO_ATTEMPT, sectionHeading } from '@/training/lesson-text';
import type { LessonAccess, LessonEntry } from '@/training/service';

import { TextLink } from './LessonEntries';

const STATUS_ICON: Record<LessonStatus['kind'], LucideIcon> = {
  'not-started': Circle,
  'in-progress': CircleDotDashed,
  completed: CircleCheckBig,
  'completed-earlier-version': RefreshCcw,
};

// Spec 3 Lessons › Access, Check protection; #149
const ACCESS_ICON: Record<Exclude<LessonAccess['kind'], 'available'>, LucideIcon> = { 'after-check': CircleHelp, 'needs-connection': WifiOff };

export function LessonCatalog({
  lessons,
  back,
  onOpen,
  onReturnToAttempt,
}: {
  lessons: readonly LessonEntry[] | undefined;
  back: { label: string; onPress: () => void };
  onOpen: (id: string) => void;
  onReturnToAttempt: () => void;
}) {
  return (
    <SettingsScreen title={LESSONS_TITLE} back={back}>
      {lessons?.some((lesson) => lesson.access.kind === 'after-check') && <CheckBanner onReturn={onReturnToAttempt} />}
      <Note>{lessons ? CATALOG_INTRO : FINDING_LESSONS}</Note>
      {lessons &&
        [...new Set(lessons.map((lesson) => lesson.section))].map((section) => {
          const inSection = lessons.filter((lesson) => lesson.section === section);
          return (
            <View key={section} style={styles.section}>
              <GroupLabel>{sectionHeading(section, inSection.length)}</GroupLabel>
              <Group>
                {inSection.map((lesson, index) => (
                  <LessonRow key={lesson.id} lesson={lesson} first={index === 0} onOpen={onOpen} />
                ))}
              </Group>
            </View>
          );
        })}
    </SettingsScreen>
  );
}

function LessonRow({ lesson, first, onOpen }: { lesson: LessonEntry; first: boolean; onOpen: (id: string) => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  const ready = lesson.steps !== null;
  const held = lesson.access.kind !== 'available';
  const Icon = lesson.access.kind === 'available' ? STATUS_ICON[lesson.status.kind] : ACCESS_ICON[lesson.access.kind];
  const detail = lessonDetail(lesson);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}. ${detail}`}
      accessibilityHint={ready ? undefined : NOT_READY_HINT}
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={() => onOpen(lesson.id)}
      {...focusProps}
      style={({ pressed }) => [styles.row, !first && styles.divided, pressed && styles.pressed, focused && styles.focused]}
    >
      <View style={[styles.lead, held && styles.held]}>
        <Icon color={lesson.status.kind === 'not-started' || held ? palette.mutedForeground : palette.foreground} size={18} />
      </View>
      <View style={[styles.text, held && styles.held]}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
          {lesson.title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {detail}
        </Text>
      </View>
      {ready && <ChevronRight color={palette.mutedForeground} size={18} />}
    </Pressable>
  );
}

// Spec 3 S3-11 LDmev
function CheckBanner({ onReturn }: { onReturn: () => void }) {
  return (
    <View style={styles.banner}>
      <Clock color={palette.info} size={20} />
      <View style={styles.bannerText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>
          {CHECK_BANNER.title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {CHECK_BANNER.text}
        </Text>
        <TextLink label={RETURN_TO_ATTEMPT} onPress={onReturn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: space[3], padding: 14, borderRadius: radius.lg - 4, borderWidth: 1, borderColor: palette.info, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, lineHeight: 20, color: palette.foreground },
  held: { opacity: 0.6 },
  section: { gap: space[6] - 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 60, paddingVertical: space[2] + 2, paddingHorizontal: space[4], borderWidth: 2, borderColor: palette.transparent },
  divided: { borderTopWidth: 1, borderTopColor: palette.border },
  pressed: { backgroundColor: palette.secondary },
  focused: { borderColor: palette.ring },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 20, color: palette.foreground },
  detail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
});

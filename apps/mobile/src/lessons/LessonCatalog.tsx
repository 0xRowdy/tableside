// Spec 3 S3-11 sVqX1; #143

import { ChevronRight, Circle, CircleCheckBig, CircleDotDashed, RefreshCcw, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { Group, GroupLabel, Note, SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { NOT_READY_HINT } from '@/training/challenge-text';
import type { LessonStatus } from '@/training/lesson-progress';
import { CATALOG_INTRO, FINDING_LESSONS, lessonDetail, LESSONS_TITLE, sectionHeading } from '@/training/lesson-text';
import type { LessonEntry } from '@/training/service';

const STATUS_ICON: Record<LessonStatus['kind'], LucideIcon> = {
  'not-started': Circle,
  'in-progress': CircleDotDashed,
  completed: CircleCheckBig,
  'completed-earlier-version': RefreshCcw,
};

export function LessonCatalog({
  lessons,
  back,
  onOpen,
}: {
  lessons: readonly LessonEntry[] | undefined;
  back: { label: string; onPress: () => void };
  onOpen: (id: string) => void;
}) {
  return (
    <SettingsScreen title={LESSONS_TITLE} back={back}>
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
  const Icon = STATUS_ICON[lesson.status.kind];
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
      <View style={styles.lead}>
        <Icon color={lesson.status.kind === 'not-started' ? palette.mutedForeground : palette.foreground} size={18} />
      </View>
      <View style={styles.text}>
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

const styles = StyleSheet.create({
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

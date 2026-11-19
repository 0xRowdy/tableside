// Spec 3 S3-11 sVqX1, LDmev; #143, #149

import { ChevronRight, Circle, CircleCheckBig, CircleDotDashed, Clock, RefreshCcw, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { Group, GroupLabel, Note, SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { NOT_READY_HINT } from '@/training/challenge-text';
import type { LessonStatus } from '@/training/lesson-progress';
import { CATALOG_INTRO, CHECK_BANNER, FINDING_LESSONS, lessonDetail, LESSONS_TITLE, RETURN_TO_ATTEMPT, sectionHeading } from '@/training/lesson-text';
import type { LessonEntry } from '@/training/service';

import { TextLink } from './LessonEntries';

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
  checkUnfinished,
  onReturnToAttempt,
}: {
  lessons: readonly LessonEntry[] | undefined;
  back: { label: string; onPress: () => void };
  onOpen: (id: string) => void;
  checkUnfinished: boolean;
  onReturnToAttempt: () => void;
}) {
  const styles = useStyles();
  return (
    <SettingsScreen title={LESSONS_TITLE} back={back}>
      {checkUnfinished && <CheckBanner onReturn={onReturnToAttempt} />}
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
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const ready = lesson.steps !== null;
  const held = lesson.access.kind !== 'available';
  const Icon = held ? Clock : STATUS_ICON[lesson.status.kind];
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
        <Icon color={lesson.status.kind === 'not-started' && !held ? palette.mutedForeground : palette.foreground} size={18} />
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
  const styles = useStyles();
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

const useStyles = makeStyles((type) => ({
  banner: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1, borderColor: palette.info, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  held: { opacity: 0.6 },
  section: { gap: space[6] - 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 60, paddingVertical: space[2] + 2, paddingHorizontal: space[4], borderWidth: 2, borderColor: palette.transparent },
  divided: { borderTopWidth: 1, borderTopColor: palette.border },
  pressed: { backgroundColor: palette.secondary },
  focused: { borderColor: palette.ring },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  detail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}));

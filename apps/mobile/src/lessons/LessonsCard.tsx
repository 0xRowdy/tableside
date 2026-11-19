// docs/decisions/lessons-entry-points.md; S3-01 u8a0o, rwwOU, cplrc

import { BookOpen, ChevronRight, Library, Play, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { countingLessonOffer, type LessonOffer } from '@/training/lesson-offer';
import {
  allLessons,
  completedCount,
  COUNTING_AFTER_CHECK,
  FINDING_LESSONS,
  LESSONS_SECTION,
  LESSONS_SECTION_NOTE,
  offerAction,
  offerKicker,
  RETURN_TO_ATTEMPT,
  shortSteps,
} from '@/training/lesson-text';
import type { LessonEntry } from '@/training/service';

import { TextLink } from './LessonEntries';

// docs/decisions/table-chrome-summary-row.md rule 5
const STACKED_VALUE_FONT_SCALE = 1.35;

export function SectionHead({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.head}>
      <Icon color={palette.foreground} size={22} />
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.headTitle}>
        {title}
      </Text>
    </View>
  );
}

export function LessonsSection({
  lessons,
  onOpenLesson,
  onOpenCatalog,
  onReturnToAttempt,
}: {
  lessons: readonly LessonEntry[] | undefined;
  onOpenLesson: (lesson: string) => void;
  onOpenCatalog: () => void;
  onReturnToAttempt: () => void;
}) {
  const styles = useStyles();
  const offer = lessons ? countingLessonOffer(lessons) : null;
  const completed = lessons?.filter((lesson) => lesson.status.kind === 'completed' || lesson.status.kind === 'completed-earlier-version').length ?? 0;
  return (
    <View style={styles.section}>
      <SectionHead icon={BookOpen} title={LESSONS_SECTION} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
        {lessons ? LESSONS_SECTION_NOTE : FINDING_LESSONS}
      </Text>
      {lessons && (
        <View style={styles.card} testID="lessons-card">
          {offer?.kind === 'after-check' && (
            <View style={styles.offer}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
                {COUNTING_AFTER_CHECK}
              </Text>
              <TextLink label={RETURN_TO_ATTEMPT} onPress={onReturnToAttempt} />
            </View>
          )}
          {offer && offer.kind !== 'after-check' && <Offer offer={offer} onOpen={() => onOpenLesson(offer.lesson.id)} />}
          {offer !== null && <View style={styles.divider} />}
          <AllLessons count={lessons.length} completed={completed} onPress={onOpenCatalog} />
        </View>
      )}
    </View>
  );
}

function Offer({ offer, onOpen }: { offer: Exclude<LessonOffer, { kind: 'after-check' }>; onOpen: () => void }) {
  const styles = useStyles();
  const { lesson } = offer;
  const detail = offer.kind === 'continue' ? lesson.summary : [lesson.summary, shortSteps(lesson.steps)].filter((part) => part !== null).join(' · ');
  return (
    <View style={styles.offer}>
      <View style={styles.offerText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
          {offerKicker(offer, lesson.steps)}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
          {lesson.title}
        </Text>
        {detail ? (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
            {detail}
          </Text>
        ) : null}
        {offer.kind === 'continue' && lesson.steps !== null && (
          <View style={styles.bars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {Array.from({ length: lesson.steps }, (_, index) => (
              <View key={index} style={[styles.bar, index < offer.step && styles.barDone]} />
            ))}
          </View>
        )}
      </View>
      <Button label={offerAction(offer)} icon={offer.kind === 'continue' ? Play : BookOpen} variant="secondary" stretch onPress={onOpen} />
    </View>
  );
}

function AllLessons({ count, completed, onPress }: { count: number; completed: number; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const stacked = useWindowDimensions().fontScale > STACKED_VALUE_FONT_SCALE;
  const label = allLessons(count);
  const value = completed > 0 ? completedCount(completed) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}. ${value}` : label}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.all, pressed && styles.pressed, focused && styles.focused]}
    >
      <Library color={palette.foreground} size={20} />
      <View style={[styles.allText, !stacked && styles.allTextRow]}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.allLabel}>
          {label}
        </Text>
        {value && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
            {value}
          </Text>
        )}
      </View>
      <ChevronRight color={palette.mutedForeground} size={18} />
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  section: { gap: space[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] + 2 },
  headTitle: { flexShrink: 1, fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  note: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  card: { paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[1], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  offer: { gap: space[3], paddingBottom: space[3] },
  offerText: { gap: space[1] },
  kicker: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  title: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  detail: { fontFamily: fonts.ui, ...type.secondary, color: palette.foreground },
  bars: { flexDirection: 'row', gap: space[1] + 2, paddingTop: space[1] + 2 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.muted },
  barDone: { backgroundColor: palette.primary },
  all: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, marginVertical: space[1], paddingVertical: space[2], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  divider: { height: 1, backgroundColor: palette.border },
  allText: { flex: 1, gap: 2 },
  allTextRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: space[3] },
  allLabel: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  value: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  pressed: { opacity: 0.8 },
  focused: { borderColor: palette.ring },
}));

// Spec 3 S3-01 GV4tz, h9v8xG, j0xoWQ, RqPCB; spec 5 S5-17 j3UhJ; #158, #150, #145, #140, #141

import { CHALLENGE_LESSONS } from '@tableside/definitions';
import { CHALLENGE_VARIANTS, type ChallengeCategory, type ChallengeVariant } from '@tableside/engine';
import { CircleDashed, ClipboardCheck, Compass, Flag, GraduationCap, Target, Trophy, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { LessonLink } from '@/lessons/LessonEntries';
import { LessonsSection, SectionHead } from '@/lessons/LessonsCard';
import { Group, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles, useStackedLayout } from '@/theme/type';
import { CATEGORY_TEXT, COUNTING_TITLE, NOT_READY_HINT, RECOMMENDATIONS_NOTE, SUGGESTED_ORDER_LABEL, VARIANT_DETAIL, variantLabel, type AllowanceCopy } from '@/training/challenge-text';
import { CHALLENGES_SECTION, lessonLinkLabel } from '@/training/lesson-text';
import type { Progress } from '@/training/progress';
import { categoryStatus, RECOMMENDED_BADGE, recommendationText, recommendedLabel } from '@/training/readiness-text';
import { RECORDS_ROW } from '@/training/records-text';
import type { CatalogEntry, ChallengeSetup, LessonEntry } from '@/training/service';

import { AllowanceBanner } from './AllowanceBanner';

const VARIANT_ICON: Record<ChallengeVariant, LucideIcon> = { learn: GraduationCap, check: ClipboardCheck };
export function CountingHome({
  catalog,
  allowance,
  progress,
  lessons,
  onOpenLesson,
  onOpenCatalog,
  onReturnToAttempt,
  onChoose,
  onOpenRecords,
}: {
  catalog: readonly CatalogEntry[];
  allowance: AllowanceCopy | undefined;
  // Spec 3 Comparison groups (Recommendations); Information hiding
  progress: Progress | undefined;
  lessons: readonly LessonEntry[] | undefined;
  onOpenLesson: (lesson: string) => void;
  onOpenCatalog: () => void;
  onReturnToAttempt: () => void;
  onChoose: (setup: ChallengeSetup) => void;
  onOpenRecords: () => void;
}) {
  const styles = useStyles();
  // Spec 5 S5-17 j3UhJ
  const elsewhere = allowance?.standing === 'elsewhere' ? allowance.setup.text : null;
  return (
    <SettingsScreen title={COUNTING_TITLE}>
      <View style={styles.sections}>
        <LessonsSection lessons={lessons} onOpenLesson={onOpenLesson} onOpenCatalog={onOpenCatalog} onReturnToAttempt={onReturnToAttempt} />
        <View style={styles.challenges}>
          <View style={styles.challengesHead}>
            <SectionHead icon={Target} title={CHALLENGES_SECTION} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
              {SUGGESTED_ORDER_LABEL}
            </Text>
          </View>
          {allowance && <AllowanceBanner standing={allowance.standing} {...allowance.banner} />}
          {catalog.map((entry, index) => (
            <CategoryCard
              key={entry.category}
              step={index + 1}
              entry={entry}
              progress={progress}
              elsewhere={elsewhere}
              lesson={lessons?.find((lesson) => lesson.id === CHALLENGE_LESSONS[entry.category])}
              onOpenLesson={onOpenLesson}
              onChoose={onChoose}
            />
          ))}
        </View>
        <View style={styles.records}>
          <Group>
            <ListRow icon={Trophy} title={RECORDS_ROW.title} detail={RECORDS_ROW.detail} onPress={onOpenRecords} />
          </Group>
          <Note>{RECOMMENDATIONS_NOTE}</Note>
        </View>
      </View>
    </SettingsScreen>
  );
}

function CategoryCard({
  step,
  entry,
  progress,
  elsewhere,
  lesson,
  onOpenLesson,
  onChoose,
}: {
  step: number;
  entry: CatalogEntry;
  progress: Progress | undefined;
  elsewhere: string | null;
  lesson: LessonEntry | undefined;
  onOpenLesson: (lesson: string) => void;
  onChoose: (setup: ChallengeSetup) => void;
}) {
  const styles = useStyles();
  const text = CATEGORY_TEXT[entry.category];
  const recommendation = progress?.recommendation.category === entry.category ? progress.recommendation : null;
  const status = categoryStatus(entry.category, progress);
  const StatusIcon = status.earned ? Flag : CircleDashed;
  // Spec 3 S3-01 j0xoWQ
  const stacked = useStackedLayout();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.step}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.stepText}>
            {step}
          </Text>
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {text.title}
        </Text>
      </View>
      {recommendation && (
        <View accessible accessibilityLabel={recommendedLabel(recommendation)} style={styles.recommended}>
          <View style={styles.badge}>
            <Compass color={palette.primary} size={16} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.badgeText}>
              {RECOMMENDED_BADGE}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.reason}>
            {recommendationText(recommendation)}
          </Text>
        </View>
      )}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.description}>
        {text.description}
      </Text>
      {progress && (
        <View style={styles.status}>
          <StatusIcon color={status.earned ? palette.primary : palette.mutedForeground} size={16} />
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.statusText, status.earned && styles.statusEarned]}>
            {status.text}
          </Text>
        </View>
      )}
      <View style={styles.actions}>
        {CHALLENGE_VARIANTS.map((variant) => (
          <VariantButton
            key={variant}
            category={entry.category}
            variant={variant}
            icon={VARIANT_ICON[variant]}
            ready={entry.ready.includes(variant)}
            elsewhere={variant === 'check' ? elsewhere : null}
            stacked={stacked}
            onChoose={onChoose}
          />
        ))}
      </View>
      <LessonLink accent={false} label={lessonLinkLabel(entry.category)} ready={lesson !== undefined && lesson.steps !== null} onPress={() => onOpenLesson(CHALLENGE_LESSONS[entry.category])} />
    </View>
  );
}

function VariantButton({
  category,
  variant,
  icon: Icon,
  ready,
  elsewhere,
  stacked,
  onChoose,
}: {
  category: ChallengeCategory;
  variant: ChallengeSetup['variant'];
  icon: LucideIcon;
  ready: boolean;
  elsewhere: string | null;
  stacked: boolean;
  onChoose: (setup: ChallengeSetup) => void;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const label = variantLabel(variant);
  const enabled = ready && !elsewhere;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${CATEGORY_TEXT[category].title}`}
      accessibilityHint={elsewhere ?? (ready ? VARIANT_DETAIL[variant] : NOT_READY_HINT)}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChoose({ category, variant })}
      {...focusProps}
      style={({ pressed }) => [styles.variant, (elsewhere !== null || stacked) && styles.variantFull, pressed && pressStyle.feltShadow, !ready && elsewhere === null && styles.disabled, focused && styles.focused]}
    >
      {elsewhere ? (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.elsewhereText}>
          {elsewhere}
        </Text>
      ) : (
        <>
          <View style={styles.variantName}>
            <Icon color={palette.foreground} size={18} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.variantText}>
              {label}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.variantDetail}>
            {stacked ? VARIANT_DETAIL[variant] : VARIANT_DETAIL[variant].replace(' ', '\n')}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  sections: { gap: space[8] },
  challenges: { gap: space[4] },
  challengesHead: { gap: space[1] },
  records: { gap: space[3] },
  label: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  card: { gap: space[3] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary, borderWidth: 1, borderColor: palette.controlBorder },
  stepText: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  title: { flex: 1, fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  description: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  recommended: { gap: space[1], paddingVertical: space[3] - 2, paddingHorizontal: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.secondary },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 },
  badgeText: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.primary },
  reason: { fontFamily: fonts.ui, ...type.secondary, color: palette.foreground },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1] + 2 },
  statusText: { flex: 1, fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  statusEarned: { color: palette.foreground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] - 2 },
  variant: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[3] - 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  variantName: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  variantText: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  variantDetail: { fontFamily: fonts.ui, ...type.secondary, textAlign: 'center', color: palette.foreground },
  variantFull: { flexBasis: '100%' },
  elsewhereText: { flex: 1, fontFamily: fonts.uiSemiBold, ...type.label, textAlign: 'center', color: palette.foreground },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
}));

// Spec 3 S3-01 PDCaD, RqPCB; spec 5 S5-17 j3UhJ; Lessons › Entry points; #158, #150, #145, #140, #141

import { CHALLENGE_LESSONS } from '@tableside/definitions';
import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { CircleDashed, ClipboardCheck, Compass, Flag, GraduationCap, Trophy, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { LessonLink } from '@/lessons/LessonEntries';
import { Group, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { CATEGORY_TEXT, COUNTING_TITLE, NOT_READY_HINT, RECOMMENDATIONS_NOTE, SUGGESTED_ORDER_LABEL, variantLabel, type AllowanceCopy } from '@/training/challenge-text';
import { lessonLinkLabel } from '@/training/lesson-text';
import type { Progress } from '@/training/progress';
import { categoryStatus, RECOMMENDED_BADGE, recommendationText, recommendedLabel } from '@/training/readiness-text';
import { RECORDS_ROW } from '@/training/records-text';
import type { CatalogCategory, CatalogEntry, ChallengeSetup, LessonEntry } from '@/training/service';

import { AllowanceBanner } from './AllowanceBanner';

const VARIANT_ICON: Record<ChallengeVariant, LucideIcon> = { learn: GraduationCap, check: ClipboardCheck };

export function CountingHome({
  catalog,
  allowance,
  progress,
  lessons,
  onOpenLesson,
  onChoose,
  onOpenRecords,
}: {
  catalog: readonly CatalogEntry[];
  allowance: AllowanceCopy | undefined;
  // Spec 3 Comparison groups (Recommendations); from ended attempts only (Information hiding)
  progress: Progress | undefined;
  lessons: readonly LessonEntry[] | undefined;
  onOpenLesson: (lesson: string) => void;
  onChoose: (setup: ChallengeSetup) => void;
  onOpenRecords: () => void;
}) {
  // Spec 5 S5-17 j3UhJ
  const elsewhere = allowance?.standing === 'elsewhere' ? allowance.setup.text : null;
  return (
    <SettingsScreen title={COUNTING_TITLE}>
      {allowance && <AllowanceBanner standing={allowance.standing} {...allowance.banner} />}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
        {SUGGESTED_ORDER_LABEL}
      </Text>
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
      <Group>
        <ListRow icon={Trophy} title={RECORDS_ROW.title} detail={RECORDS_ROW.detail} onPress={onOpenRecords} />
      </Group>
      <Note>{RECOMMENDATIONS_NOTE}</Note>
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
  const text = CATEGORY_TEXT[entry.category];
  const recommendation = progress?.recommendation.category === entry.category ? progress.recommendation : null;
  const status = categoryStatus(entry.category, progress);
  const StatusIcon = status.earned ? Flag : CircleDashed;
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
            onChoose={onChoose}
          />
        ))}
      </View>
      <LessonLink label={lessonLinkLabel(entry.category)} ready={lesson !== undefined && lesson.steps !== null} onPress={() => onOpenLesson(CHALLENGE_LESSONS[entry.category])} />
    </View>
  );
}

function VariantButton({
  category,
  variant,
  icon: Icon,
  ready,
  elsewhere,
  onChoose,
}: {
  category: CatalogCategory;
  variant: ChallengeSetup['variant'];
  icon: LucideIcon;
  ready: boolean;
  elsewhere: string | null;
  onChoose: (setup: ChallengeSetup) => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  const label = variantLabel(variant);
  const enabled = ready && !elsewhere;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${CATEGORY_TEXT[category].title}`}
      accessibilityHint={elsewhere ?? (ready ? undefined : NOT_READY_HINT)}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => onChoose({ category, variant })}
      {...focusProps}
      style={({ pressed }) => [styles.variant, elsewhere !== null && styles.variantElsewhere, pressed && styles.pressed, !ready && elsewhere === null && styles.disabled, focused && styles.focused]}
    >
      {elsewhere ? (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.elsewhereText}>
          {elsewhere}
        </Text>
      ) : (
        <>
          <Icon color={palette.foreground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.variantText}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  card: { gap: space[3] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary, borderWidth: 1, borderColor: palette.controlBorder },
  stepText: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  title: { flex: 1, fontFamily: fonts.uiBold, fontSize: 18, color: palette.foreground },
  description: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  recommended: { gap: space[1], paddingVertical: space[3] - 2, paddingHorizontal: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.secondary },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space[1] + 2 },
  badgeText: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.primary },
  reason: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.foreground },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1] + 2 },
  statusText: { flex: 1, fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  statusEarned: { color: palette.foreground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] - 2 },
  variant: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  variantText: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  variantElsewhere: { flexBasis: '100%' },
  elsewhereText: { flex: 1, fontFamily: fonts.uiBold, fontSize: 12, lineHeight: 16, textAlign: 'center', color: palette.foreground },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

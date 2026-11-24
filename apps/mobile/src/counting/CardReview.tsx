// Spec 3 S3-09 h0MsKr, VToCp, S3-10 Yy2He; Scoring and review; #132, #133, #134, #140, #138, #139

import { CATEGORY_METRIC, type ChallengeAttemptRecord } from '@tableside/engine';
import { BookOpen, CircleCheckBig, CircleX, Lightbulb, Shuffle, SkipForward, TrendingUp } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LearnRow } from '@/lessons/LessonEntries';
import { SetupHeader } from '@/play/setup/SetupParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import {
  CATEGORY_TEXT,
  CORRECT_LABEL,
  driftText,
  ERROR_LABEL,
  RESULTS_TITLE,
  REVIEW_TITLE,
  reviewText,
  scoreText,
  variantLabel,
  YOU_LABEL,
  SUGGESTED_LESSON,
  type ReviewOutcome,
} from '@/training/challenge-text';
import { attributionText, betReviewText, decisionReviewText, DECISION_REVIEW_TITLE } from '@/training/blackjack-table-text';
import type { LessonEntry } from '@/training/service';

const OUTCOME_ICON: Record<ReviewOutcome | 'miss' | 'fallback' | 'override', { readonly Icon: typeof CircleX; readonly color: string }> = {
  match: { Icon: CircleCheckBig, color: palette.correct },
  off: { Icon: CircleX, color: palette.mistake },
  skipped: { Icon: SkipForward, color: palette.mistake },
  miss: { Icon: CircleX, color: palette.mistake },
  fallback: { Icon: Shuffle, color: palette.foreground },
  // Spec 3 Amendment 1 C4; #139
  override: { Icon: CircleX, color: palette.mistake },
};

interface Row {
  readonly outcome: keyof typeof OUTCOME_ICON;
  readonly title: string;
  readonly status: string;
  readonly values: readonly { readonly label: string; readonly value: string }[];
  readonly label: string;
}

function rowOf(fact: ChallengeAttemptRecord['review'][number], variant: ChallengeAttemptRecord['groupKey']['variant']): Row {
  if (fact.kind === 'table-decision') return decisionReviewText(fact);
  if (fact.kind === 'table-bet') return betReviewText(fact);
  const text = reviewText(fact, variant);
  const values = [{ label: YOU_LABEL, value: text.entered }, { label: CORRECT_LABEL, value: text.reference }, ...(text.error !== null ? [{ label: ERROR_LABEL, value: text.error }] : [])];
  return { outcome: text.outcome, title: text.title, status: text.status, values, label: text.label };
}

export function CardReview({
  record,
  lesson,
  onOpenLesson,
  backTo = RESULTS_TITLE,
  onBack,
}: {
  record: ChallengeAttemptRecord;
  lesson: LessonEntry | undefined;
  onOpenLesson: (id: string) => void;
  backTo?: string;
  onBack: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { groupKey } = record;
  const drift = driftText(record.review, groupKey.variant);
  const attributions = record.review.flatMap((fact) => (fact.kind === 'table-decision' ? (attributionText(fact) ?? []) : []));
  const play = groupKey.table?.seat === 'play';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <SetupHeader
        title={play ? DECISION_REVIEW_TITLE : REVIEW_TITLE[groupKey.category]}
        subtitle={play ? `${CATEGORY_TEXT[groupKey.category].title} · ${variantLabel(groupKey.variant)} · Play` : `${CATEGORY_TEXT[groupKey.category].title} · ${variantLabel(groupKey.variant)} · ${scoreText(record.metrics[CATEGORY_METRIC[groupKey.category]])}`}
        backTo={backTo}
        onBack={onBack}
      />
      <View style={styles.body}>
        <View style={styles.group}>
          {record.review.map((fact, index) => {
            const text = rowOf(fact, groupKey.variant);
            const { Icon, color } = OUTCOME_ICON[text.outcome];
            return (
              <View key={fact.position} accessible accessibilityLabel={text.label} style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={styles.head}>
                  <Icon color={color} size={18} />
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>
                    {text.title}
                  </Text>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.status}>
                    {text.status}
                  </Text>
                </View>
                <View style={styles.values}>
                  {text.values.map((value) => (
                    <Value key={value.label} label={value.label} value={value.value} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        {drift && (
          <View style={styles.drift} testID="drift-note">
            <TrendingUp color={palette.foreground} size={20} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.driftText}>
              {drift}
            </Text>
          </View>
        )}
        {attributions.map((line) => (
          <View key={line} style={styles.drift} testID="attribution-note">
            <Lightbulb color={palette.foreground} size={20} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.driftText}>
              {line}
            </Text>
          </View>
        ))}
        {lesson && <LearnRow icon={BookOpen} title={`${lesson.title} lesson`} detail={SUGGESTED_LESSON} disabled={lesson.steps === null} onPress={() => onOpenLesson(lesson.id)} />}
      </View>
    </ScrollView>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.value}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.valueLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.valueText}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[4] },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  row: { gap: space[2], paddingVertical: space[3], paddingHorizontal: space[4] },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowTitle: { flex: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  status: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  values: { flexDirection: 'row', gap: space[2] },
  value: { flex: 1, gap: 2 },
  valueLabel: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  valueText: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  drift: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  driftText: { flex: 1, fontFamily: fonts.ui, ...type.body, color: palette.foreground },
}));

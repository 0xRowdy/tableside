// Spec 3 S3-08 liAfT, CEb6T, nXGFk, cX5Gc, UXrpw, ValDZ, e5MASr; #158, #132, #135, #140, #141, #139

import type { ChallengeAttemptRecord } from '@tableside/engine';
import { BookOpen, CircleAlert, CircleCheckBig, Coins, Divide, Flag, GraduationCap, Hash, Info, ListChecks, RotateCcw, Spade, Square, Trophy, type LucideIcon } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { BETTING_ADHERENCE, bettingTested, financeValues, FINANCES_LABEL, FINANCES_NOTE, NO_BET_SCHEDULE, resultsSubtitle } from '@/training/blackjack-table-text';
import {
  ASSISTED_NOTE,
  CATEGORY_TEXT,
  endingText,
  NOT_TESTED,
  pacingLabel,
  RESULT_ROWS,
  resultRows,
  RESULTS_TITLE,
  RETRY_LABEL,
  resultsNote,
  REVIEW_LABEL,
  REVIEW_DECISIONS_LABEL,
  SCORES_LABEL,
  scoreText,
  spokenScore,
  startWaits,
  variantLabel,
  type AllowanceCopy,
} from '@/training/challenge-text';
import { belowReadinessThreshold, setsPersonalBest, type AttemptEarned } from '@/training/progress';
import {
  BELOW_THRESHOLD,
  keptDetail,
  MILESTONE_EARNED,
  MILESTONE_KEPT,
  milestoneDetail,
  milestonePill,
  nextOnPath,
  openLessonLabel,
  practiceNote,
  PRACTICE_IN_LEARN,
} from '@/training/readiness-text';
import { personalBestText } from '@/training/records-text';
import type { LessonEntry } from '@/training/service';

const ROW_ICON: Record<(typeof RESULT_ROWS)[number]['metric'] | 'betting-adherence', LucideIcon> = {
  'card-values': Square,
  'running-count': Hash,
  'true-count': Divide,
  'playing-adherence': Spade,
  'betting-adherence': Coins,
};

// Spec 3 Scoring and review › Metrics (betting adherence, Play only); S3-08 e5MASr, ValDZ; #139
const BETTING_ROW = { metric: 'betting-adherence', title: BETTING_ADHERENCE, tested: bettingTested } as const;

const rowsFor = (record: ChallengeAttemptRecord) => (record.groupKey.table?.seat === 'play' ? [...resultRows(record.metrics), BETTING_ROW] : resultRows(record.metrics));

export function ChallengeResults({
  record,
  position,
  explanation,
  earned,
  allowance,
  onRetry,
  onReview,
  lesson,
  onOpenLesson,
  onPracticeLearn,
}: {
  record: ChallengeAttemptRecord;
  position: number;
  explanation: string | null;
  earned: AttemptEarned;
  allowance: AllowanceCopy | undefined;
  onRetry: () => void;
  onReview: () => void;
  // Spec 3 S3-08 nXGFk
  lesson: LessonEntry | undefined;
  onOpenLesson: (id: string) => void;
  onPracticeLearn: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { groupKey } = record;
  const ending = endingText(record, position, explanation);
  const completed = record.endingReason === 'completed';
  const assisted = completed && groupKey.assistanceClass === 'assisted-check';
  // Spec 3 Comparison groups (Milestones); #141
  const { readiness } = earned;
  const reviewSuggested = readiness?.kind === 'kept';
  const detail = [ending.detail, belowReadinessThreshold(record) ? BELOW_THRESHOLD : null].filter(Boolean).join(' ');
  const note = reviewSuggested
    ? practiceNote(allowance)
    : [completed ? resultsNote(groupKey.variant, allowance) : (allowance?.results ?? ''), readiness?.kind === 'earned' && readiness.next ? nextOnPath(readiness.next) : null]
        .filter(Boolean)
        .join(' ');
  const EndingIcon = ending.kind === 'alert' ? CircleAlert : CircleCheckBig;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {RESULTS_TITLE}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
          {groupKey.table ? resultsSubtitle(groupKey.variant, groupKey.table.seat) : `${CATEGORY_TEXT[groupKey.category].title} · ${variantLabel(groupKey.variant)} · ${pacingLabel(groupKey.pacing)}`}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={[styles.box, ending.kind === 'alert' && styles.alert]}>
          <EndingIcon color={ending.kind === 'alert' ? palette.warning : palette.foreground} size={24} />
          <View style={styles.boxText}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.boxTitle}>
              {ending.title}
            </Text>
            {detail.length > 0 && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.boxDetail}>
                {detail}
              </Text>
            )}
          </View>
        </View>
        {assisted && (
          <View style={styles.box}>
            <Info color={palette.foreground} size={24} />
            <View style={styles.boxText}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.boxTitle}>
                {ASSISTED_NOTE.title}
              </Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.boxDetail}>
                {ASSISTED_NOTE.detail}
              </Text>
            </View>
          </View>
        )}
        {readiness?.kind === 'earned' ? (
          <ReadinessBox title={MILESTONE_EARNED} detail={milestoneDetail(groupKey)} pill={milestonePill(earned)} />
        ) : (
          setsPersonalBest(earned) && <PersonalBestBox {...personalBestText(groupKey, earned)} />
        )}
        {readiness?.kind === 'kept' && <ReadinessBox title={MILESTONE_KEPT} detail={keptDetail(groupKey, readiness.earnedAt)} pill={null} />}
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
          {SCORES_LABEL}
        </Text>
        <View style={styles.group}>
          {rowsFor(record).map((row, index) => {
            const result = record.metrics[row.metric];
            const detail = result ? row.tested(result.total, groupKey.variant, groupKey.category) : row.metric === 'betting-adherence' ? NO_BET_SCHEDULE : NOT_TESTED;
            const Icon = ROW_ICON[row.metric];
            return (
              <View key={row.metric} accessible accessibilityLabel={`${row.title}, ${detail}: ${spokenScore(result)}`} style={[styles.row, index > 0 && styles.rowDivider]}>
                <View style={styles.lead}>
                  <Icon color={palette.foreground} size={18} />
                </View>
                <View style={styles.rowText}>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>
                    {row.title}
                  </Text>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>
                    {detail}
                  </Text>
                </View>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.score}>
                  {scoreText(result)}
                </Text>
              </View>
            );
          })}
        </View>
        {record.finances && (
          <>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
              {FINANCES_LABEL}
            </Text>
            <View style={[styles.group, styles.finances]} testID="challenge-finances">
              <View style={styles.financeRow}>
                {financeValues(record.finances).map(({ label, value }) => (
                  <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={styles.financeItem}>
                    <Text maxFontSizeMultiplier={textScale.body} style={styles.financeLabel}>
                      {label}
                    </Text>
                    <Text maxFontSizeMultiplier={textScale.display} style={styles.financeValue}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.boxDetail}>
                {FINANCES_NOTE}
              </Text>
            </View>
          </>
        )}
        {ending.note && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
            {ending.note}
          </Text>
        )}
        {record.review.length > 0 && <Button label={groupKey.table?.seat === 'play' ? REVIEW_DECISIONS_LABEL : REVIEW_LABEL[groupKey.category]} icon={ListChecks} variant="outline" stretch onPress={onReview} />}
        {reviewSuggested ? (
          <>
            <Button
              label={openLessonLabel(groupKey)}
              icon={BookOpen}
              variant="outline"
              stretch
              disabled={!lesson || lesson.steps === null}
              onPress={() => lesson && onOpenLesson(lesson.id)}
            />
            <Button label={PRACTICE_IN_LEARN} icon={GraduationCap} stretch disabled={startWaits(allowance)} onPress={onPracticeLearn} />
          </>
        ) : (
          <Button label={RETRY_LABEL[groupKey.category]} icon={RotateCcw} stretch disabled={startWaits(allowance)} onPress={onRetry} />
        )}
        {note.length > 0 && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
            {note}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

// Spec 3 S3-08 CEb6T, nXGFk
function ReadinessBox({ title, detail, pill }: { title: string; detail: string; pill: string | null }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={[`${title}.`, detail, pill && `${pill}.`].filter(Boolean).join(' ')} style={[styles.box, styles.earned]}>
      <Flag color={palette.primary} size={24} />
      <View style={styles.boxText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.boxTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.boxDetail}>
          {detail}
        </Text>
        {pill && (
          <View style={styles.badge}>
            <Trophy color={palette.primary} size={14} />
            <Text maxFontSizeMultiplier={textScale.body} style={styles.badgeText}>
              {pill}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Spec 3 S3-08 liAfT, CEb6T
function PersonalBestBox({ title, detail, fastest }: { title: string; detail: string; fastest: string | null }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={[`${title}.`, detail, fastest && `${fastest}.`].filter(Boolean).join(' ')} style={[styles.box, styles.earned]}>
      <Flag color={palette.primary} size={24} />
      <View style={styles.boxText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.boxTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.boxDetail}>
          {detail}
        </Text>
        <View style={styles.badge}>
          <Trophy color={palette.primary} size={14} />
          {fastest && (
            <Text maxFontSizeMultiplier={textScale.body} style={styles.badgeText}>
              {fastest}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { gap: 1, minHeight: 56, justifyContent: 'center', paddingHorizontal: space[6] - space[1], paddingVertical: space[1] },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[4] },
  box: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  alert: { borderWidth: 2, borderColor: palette.warning },
  earned: { borderColor: palette.primary },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2,
    marginTop: space[1],
    paddingVertical: space[1],
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.secondary,
  },
  badgeText: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  boxText: { flex: 1, gap: space[1] },
  boxTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  boxDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  label: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3], paddingHorizontal: space[4] },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  score: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.mutedForeground },
  note: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  finances: { gap: space[3], padding: space[4] },
  financeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  financeItem: { flexGrow: 1, flexBasis: 80, gap: 2 },
  financeLabel: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  financeValue: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
}));

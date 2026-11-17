// Spec 3 S3-08 liAfT, CEb6T, cX5Gc; #158, #132, #150, #133

import type { ChallengeAttemptRecord } from '@tableside/engine';
import { CircleCheckBig, Divide, Hash, Info, ListChecks, RotateCcw, Square, type LucideIcon } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import {
  ASSISTED_NOTE,
  CATEGORY_TEXT,
  completedText,
  NOT_TESTED,
  PACING_LABEL,
  RESULT_ROWS,
  resultRows,
  RESULTS_TITLE,
  RETRY_LABEL,
  resultsNote,
  REVIEW_LABEL,
  SCORES_LABEL,
  scoreText,
  spokenScore,
  startWaits,
  variantLabel,
  type AllowanceCopy,
} from '@/training/challenge-text';

const ROW_ICON: Record<(typeof RESULT_ROWS)[number]['metric'], LucideIcon> = {
  'card-values': Square,
  'running-count': Hash,
  'true-count': Divide,
  'playing-adherence': Square,
  'betting-adherence': Square,
};

export function ChallengeResults({ record, allowance, onRetry, onReview }: { record: ChallengeAttemptRecord; allowance: AllowanceCopy | undefined; onRetry: () => void; onReview: () => void }) {
  const insets = useSafeAreaInsets();
  const { groupKey } = record;
  const completed = completedText(groupKey, record.assistanceStep);
  const assisted = groupKey.assistanceClass === 'assisted-check';
  const note = resultsNote(groupKey.variant, allowance);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {RESULTS_TITLE}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
          {`${CATEGORY_TEXT[groupKey.category].title} · ${variantLabel(groupKey.variant)} · ${PACING_LABEL}`}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.box}>
          <CircleCheckBig color={palette.foreground} size={24} />
          <View style={styles.boxText}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.boxTitle}>
              {completed.title}
            </Text>
            {completed.detail && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.boxDetail}>
                {completed.detail}
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
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
          {SCORES_LABEL}
        </Text>
        <View style={styles.group}>
          {resultRows(record.metrics).map((row, index) => {
            const result = record.metrics[row.metric];
            const detail = result ? row.tested(result.total, groupKey.variant, groupKey.category) : NOT_TESTED;
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
        {record.review.length > 0 && <Button label={REVIEW_LABEL[groupKey.category]} icon={ListChecks} variant="outline" stretch onPress={onReview} />}
        <Button label={RETRY_LABEL[groupKey.category]} icon={RotateCcw} stretch disabled={startWaits(allowance)} onPress={onRetry} />
        {note.length > 0 && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
            {note}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { gap: 1, minHeight: 56, justifyContent: 'center', paddingHorizontal: space[6] - space[1], paddingVertical: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[4] },
  box: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  boxText: { flex: 1, gap: space[1] },
  boxTitle: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  boxDetail: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3], paddingHorizontal: space[4] },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  score: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.mutedForeground },
  note: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
});

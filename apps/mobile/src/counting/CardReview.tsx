// Spec 3 S3-09 h0MsKr, BjuKf; Scoring and review › Review facts; #132

import type { ChallengeAttemptRecord } from '@tableside/engine';
import { ChevronLeft, CircleCheckBig, CircleX, SkipForward } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { CARD_REVIEW_TITLE, CATEGORY_TEXT, CORRECT_LABEL, RESULTS_TITLE, reviewOutcome, reviewText, scoreText, variantLabel, YOU_LABEL } from '@/training/challenge-text';

const OUTCOME_ICON = {
  match: { Icon: CircleCheckBig, color: palette.correct },
  off: { Icon: CircleX, color: palette.mistake },
  skipped: { Icon: SkipForward, color: palette.mistake },
} as const;

export function CardReview({ record, onBack }: { record: ChallengeAttemptRecord; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { groupKey } = record;
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${RESULTS_TITLE}`} onPress={onBack} {...focusProps} style={[styles.back, focused && styles.focused]}>
          <ChevronLeft color={palette.foreground} size={24} />
        </Pressable>
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            {CARD_REVIEW_TITLE}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
            {`${CATEGORY_TEXT[groupKey.category].title} · ${variantLabel(groupKey.variant)} · ${scoreText(record.metrics['card-values'])}`}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.group}>
          {record.review.map((fact, index) => {
            const text = reviewText(fact);
            const { Icon, color } = OUTCOME_ICON[reviewOutcome(fact)];
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
                  <Value label={YOU_LABEL} value={text.entered} />
                  <Value label={CORRECT_LABEL} value={text.reference} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function Value({ label, value }: { label: string; value: string }) {
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  back: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  focused: { borderColor: palette.ring },
  titles: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  body: { paddingTop: space[2], paddingHorizontal: space[4] },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, overflow: 'hidden' },
  row: { gap: space[2], paddingVertical: space[3], paddingHorizontal: space[4] },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  rowTitle: { flex: 1, fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  status: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.foreground },
  values: { flexDirection: 'row', gap: space[2] },
  value: { flex: 1, gap: 2 },
  valueLabel: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  valueText: { fontFamily: fonts.uiBold, fontSize: 18, color: palette.foreground },
});

// The session result (design frame S1-10, free play): net result, maximum
// drawdown and the funding lines. The full record arrives with #79.

import { CircleCheck, Info } from 'lucide-react-native';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { CompletedPracticeSession } from '@/practice/store';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { formatSigned, formatUnits, speakSigned } from './roulette-text';

const outcomeWord = (net: string) => (net.startsWith('-') ? 'Loss' : net === '0' ? 'Even' : 'Win');

export function SessionResult({
  result,
  subtitle,
  onNewSession,
  onHome,
}: {
  result: CompletedPracticeSession;
  subtitle: string;
  onNewSession: () => void;
  onHome: () => void;
}) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Session result. ${outcomeWord(result.netResult)}, net result ${speakSigned(result.netResult)}. Final cash-out ${formatUnits(result.finalCashOut)}. Max drawdown ${formatUnits(result.maxDrawdown)}.`,
    );
  }, [result]);

  // A training-bankroll session has its allocation instead of a buy-in, and never any rebuys.
  const funding =
    result.fundingSource === 'training-bankroll'
      ? [{ label: 'From training bankroll', value: formatUnits(result.buyIn) }]
      : [
          { label: 'Buy-in', value: formatUnits(result.buyIn) },
          result.rebuys.length === 0
            ? { label: 'Rebuys', value: 'none' }
            : { label: `Rebuys (${result.rebuys.length})`, value: result.rebuys.map(formatUnits).join(' + ') },
          { label: 'Total funding', value: formatUnits(result.cumulativeFunding) },
        ];
  const rows = [...funding, { label: 'Final cash-out', value: formatUnits(result.finalCashOut) }];

  return (
    <Screen>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Session result
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.banner} accessible accessibilityLabel="Saved. This session is in Saved, Practice.">
        <CircleCheck color={palette.correct} size={20} />
        <View style={styles.bannerText}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Saved</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>This session is in Saved › Practice.</Text>
        </View>
      </View>

      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>MONEY</Text>
      <View style={styles.stats}>
        <View
          style={styles.stat}
          accessible
          accessibilityLabel={`Net result ${speakSigned(result.netResult)}, ${outcomeWord(result.netResult)}`}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Net result</Text>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.statValue}>{formatSigned(result.netResult)}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{outcomeWord(result.netResult)}</Text>
        </View>
        <View
          style={styles.stat}
          accessible
          accessibilityLabel={`Max drawdown ${formatUnits(result.maxDrawdown)}, includes final settlement`}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Max drawdown</Text>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.statValue}>{formatUnits(result.maxDrawdown)}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Includes final settlement</Text>
        </View>
      </View>

      <View style={styles.ledger}>
        {rows.map((row) => (
          <View key={row.label} style={styles.kv} accessible accessibilityLabel={`${row.label} ${row.value}`}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{row.label}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kvValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.kv} accessible accessibilityLabel={`Net result, cash-out minus funding, ${speakSigned(result.netResult)}`}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Net result = cash-out − funding</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.kvTotal}>{formatSigned(result.netResult)}</Text>
        </View>
      </View>

      <View style={styles.note}>
        <Info color={palette.mutedForeground} size={18} />
        <Text maxFontSizeMultiplier={textScale.body} style={[styles.muted, styles.noteText]}>
          Free play has no strategy, so there&apos;s no adherence score and no Departures.
        </Text>
      </View>

      <Button label="New session" stretch onPress={onNewSession} />
      <Button label="Back to Home" variant="secondary" stretch onPress={onHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 30, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.mutedForeground },
  muted: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  stat: { flexGrow: 1, flexBasis: 140, gap: space[1], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  statValue: { fontFamily: fonts.display, fontSize: 28, color: palette.foreground },
  ledger: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  kv: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  kvValue: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  kvTotal: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  divider: { height: 1, backgroundColor: palette.border },
  note: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  noteText: { flex: 1 },
});

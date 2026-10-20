// Minimal roulette session setup (design frame S1-02, free play only): the
// single-zero wheel at the launch limits and a fresh buy-in. Guided practice,
// the double-zero wheel and editable limits arrive with #62, #72 and #74.

import { SINGLE_ZERO_ROULETTE } from '@tableside/definitions';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { RECONNECT_TO_VERIFY, type StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { formatUnits } from './roulette-text';

const DEFAULT_BUY_IN = '1000';
/** Longest buy-in text accepted before the engine judges the amount (the ceiling has 10 digits). */
const MAX_BUY_IN_DIGITS = 13;

const PROBLEMS: Record<StartProblem, string> = {
  'invalid-buy-in': 'Enter whole units from 1 to 1,000,000,000.',
  'save-failed': "The session couldn't be saved, so it hasn't started. Try again.",
  'access-denied': "This session can't start right now.",
  'access-uncertain': `${RECONNECT_TO_VERIFY}. Nothing has started and nothing was used.`,
};

export function RouletteSetup({ problem, problemReason = null, busy }: { problem: StartProblem | null; problemReason?: string | null; busy: boolean }) {
  const { controller } = usePractice();
  const [draft, setDraft] = useState(formatUnits(DEFAULT_BUY_IN));
  const [notWhole, setNotWhole] = useState(false);
  const { limits } = SINGLE_ZERO_ROULETTE;

  const start = () => {
    const digits = draft.replace(/[,\s]/g, '');
    const whole = /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;
    setNotWhole(!whole);
    if (whole) void controller.start({ game: 'roulette', buyIn: BigInt(digits).toString() });
  };
  const error = notWhole ? PROBLEMS['invalid-buy-in'] : problem && (problem === 'access-denied' && problemReason ? problemReason : PROBLEMS[problem]);

  return (
    <Screen>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Roulette
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>New session · free play</Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>WHEEL</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>Single zero (0)</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Even-money bets lose in full when the ball lands on zero.</Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>TABLE LIMITS</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Inside bets {formatUnits(limits.inside.min)}–{formatUnits(limits.inside.max)} units
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Outside bets {formatUnits(limits.outside.min)}–{formatUnits(limits.outside.max)} units
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Per placement.</Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>BUY-IN</Text>
        <Text nativeID="buy-in-label" maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel}>
          Starting chips for this session
        </Text>
        <View style={[styles.field, error && styles.fieldError]}>
          <TextInput
            accessibilityLabel="Starting chips for this session, in units"
            value={draft}
            onChangeText={setDraft}
            keyboardType="number-pad"
            maxFontSizeMultiplier={textScale.body}
            style={styles.input}
          />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.unit}>units</Text>
        </View>
        {error ? (
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.error}>
            {error}
          </Text>
        ) : (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Each session starts fresh.</Text>
        )}
      </View>

      <Button label="Start free play" stretch disabled={busy} onPress={start} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titles: { gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 30, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  section: { gap: space[1] },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.mutedForeground },
  value: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  help: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  fieldLabel: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.foreground },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  fieldError: { borderColor: palette.destructive, borderWidth: 2 },
  input: { flex: 1, minHeight: MIN_TOUCH_TARGET, fontFamily: fonts.uiMedium, fontSize: 17, color: palette.foreground },
  unit: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  error: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.destructive },
});

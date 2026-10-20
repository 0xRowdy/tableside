// Craps session setup (design frame S1-02 "Craps", free play only): standard
// craps with a choice of maximum odds, the launch line limits and a fresh
// buy-in. The field option, editable limits and guided practice arrive with
// #71, #72 and #76.

import { crapsHouseEdge, standardCraps } from '@tableside/definitions';
import { ODDS_CAPS, type OddsCap } from '@tableside/engine';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import type { StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { formatUnits } from './roulette-text';

const DEFAULT_BUY_IN = '1000';
/** Longest buy-in text accepted before the engine judges the amount (the ceiling has 10 digits). */
const MAX_BUY_IN_DIGITS = 13;

const PROBLEMS: Record<StartProblem, string> = {
  'invalid-buy-in': 'Enter whole units from 1 to 1,000,000,000.',
  'save-failed': "The session couldn't be saved, so it hasn't started. Try again.",
  'access-not-allowed': "This session can't start right now.",
};

export function CrapsSetup({ problem, busy }: { problem: StartProblem | null; busy: boolean }) {
  const { controller } = usePractice();
  const [draft, setDraft] = useState(formatUnits(DEFAULT_BUY_IN));
  const [odds, setOdds] = useState<OddsCap>('3-4-5x');
  const [notWhole, setNotWhole] = useState(false);
  const rules = standardCraps(odds);
  const { line } = rules.limits;
  const edge = (wager: 'pass' | 'dont-pass') => crapsHouseEdge(wager, rules);

  const start = () => {
    const digits = draft.replace(/[,\s]/g, '');
    const whole = /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;
    setNotWhole(!whole);
    if (whole) void controller.start({ game: 'craps', odds, buyIn: BigInt(digits).toString() });
  };
  const error = notWhole ? PROBLEMS['invalid-buy-in'] : problem && PROBLEMS[problem];

  return (
    <Screen>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Craps
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>New session · free play · standard craps</Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>TABLE RULES</Text>
        <Text nativeID="odds-label" maxFontSizeMultiplier={textScale.body} style={styles.value}>Maximum odds</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Maximum odds" style={styles.options}>
          {ODDS_CAPS.map((cap) => (
            <OddsOption key={cap} cap={cap} selected={cap === odds} onPress={() => setOdds(cap)} />
          ))}
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          Odds behind a line bet pay true odds with no commission. Laid odds are capped by the amount they win.
        </Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>HOUSE EDGE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Pass and come {edge('pass').percent}% · Don&apos;t pass and don&apos;t come {edge('dont-pass').percent}% · Odds 0%
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          With full {odds} odds: pass {edge('pass').withFullOdds}%, don&apos;t pass {edge('dont-pass').withFullOdds}% of all money bet. A property of
          these rules, not of how you play.
        </Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>TABLE LIMITS</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Pass, don&apos;t pass, come and don&apos;t come {formatUnits(line.min)}–{formatUnits(line.max)} units
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Per wager. Odds follow the maximum odds instead.</Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>BUY-IN</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel}>Starting chips for this session</Text>
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

function OddsOption({ cap, selected, onPress }: { cap: OddsCap; selected: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${cap} odds`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.option, selected && styles.optionSelected, focused && styles.optionFocused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.optionText, selected && styles.optionTextSelected]}>
        {selected ? `✓ ${cap}` : cap}
      </Text>
    </Pressable>
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
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  optionSelected: { borderColor: palette.primary, borderWidth: 2, backgroundColor: palette.secondary },
  optionFocused: { borderColor: palette.ring, borderWidth: 2 },
  optionText: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  optionTextSelected: { fontFamily: fonts.uiBold },
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

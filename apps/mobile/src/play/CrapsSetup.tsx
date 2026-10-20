// Craps session setup (design frame S1-02 "Craps", free play only): standard
// craps with a choice of maximum odds and field payout, the launch limits and
// a fresh buy-in. Editable limits and guided practice arrive with #72 and #76.

import { crapsHouseEdge, standardCraps, type CrapsWager } from '@tableside/definitions';
import { FIELD_PAYOUTS, ODDS_CAPS, STANDARD_CRAPS, type FieldPayout, type OddsCap } from '@tableside/engine';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { RECONNECT_TO_VERIFY, type StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { formatUnits } from './units';

const DEFAULT_BUY_IN = '1000';
/** Longest buy-in text accepted before the engine judges the amount (the ceiling has 10 digits). */
const MAX_BUY_IN_DIGITS = 13;

const PROBLEMS: Record<StartProblem, string> = {
  'invalid-buy-in': 'Enter whole units from 1 to 1,000,000,000.',
  'save-failed': "The session couldn't be saved, so it hasn't started. Try again.",
  'access-denied': "This session can't start right now.",
  'access-uncertain': `${RECONNECT_TO_VERIFY}. Nothing has started and nothing was used.`,
};

export function CrapsSetup({ problem, problemReason = null, busy }: { problem: StartProblem | null; problemReason?: string | null; busy: boolean }) {
  const { controller } = usePractice();
  const feedback = useFeedback();
  const [draft, setDraft] = useState(formatUnits(DEFAULT_BUY_IN));
  const [odds, setOdds] = useState<OddsCap>('3-4-5x');
  const [field, setField] = useState<FieldPayout>(STANDARD_CRAPS.defaults.field);
  const [notWhole, setNotWhole] = useState(false);
  const rules = standardCraps(odds, field);
  const { flat, props } = rules.limits;
  const edge = (wager: CrapsWager) => crapsHouseEdge(wager, rules);
  const pct = (wager: CrapsWager) => `${edge(wager).percent}%`;

  const start = () => {
    const digits = draft.replace(/[,\s]/g, '');
    const whole = /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;
    setNotWhole(!whole);
    if (whole) void controller.start({ game: 'craps', odds, field, buyIn: BigInt(digits).toString() });
    else feedback.cue('input-rejected');
  };
  const error = notWhole ? PROBLEMS['invalid-buy-in'] : problem && (problem === 'access-denied' && problemReason ? problemReason : PROBLEMS[problem]);

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
            <Option key={cap} label={`${cap} odds`} text={cap} selected={cap === odds} onPress={() => setOdds(cap)} />
          ))}
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          Odds behind a line bet pay true odds with no commission. Laid odds are capped by the amount they win.
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>Field payout</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Field payout" style={styles.options}>
          {FIELD_PAYOUTS.map((option) => (
            <Option key={option} label={FIELD_LABELS[option]} selected={option === field} onPress={() => setField(option)} />
          ))}
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          The field is one roll: 3, 4, 9, 10 and 11 pay even money and 5, 6, 7 and 8 lose.
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
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Place 6 and 8 {pct('place-6')} · 5 and 9 {pct('place-5')} · 4 and 10 {pct('place-4')}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Buy and lay 6 and 8 {pct('buy-6')} · 5 and 9 {pct('buy-5')} · 4 and 10 {pct('buy-4')}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Field {pct('field')} · Hard 6 and 8 {pct('hard-6')} · Hard 4 and 10 {pct('hard-4')}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Two and twelve {pct('prop-2')} · Three and eleven {pct('prop-3')} · Any craps {pct('any-craps')} · Any seven {pct('any-seven')} · Horn {pct('horn')}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          Per bet decided, with commission at exactly 5%. Rounding it up to a whole unit costs more on small stakes: a buy at the{' '}
          {formatUnits(flat.min)}-unit minimum is 6 and 8 {crapsHouseEdge('buy-6', rules, flat.min).percent}% · 5 and 9{' '}
          {crapsHouseEdge('buy-5', rules, flat.min).percent}% · 4 and 10 {crapsHouseEdge('buy-4', rules, flat.min).percent}%.
        </Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>TABLE LIMITS</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Pass, come, place, buy, lay and field {formatUnits(flat.min)}–{formatUnits(flat.max)} units
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          Per wager or number. Place 6 and 8 go in multiples of 6, other place numbers in multiples of 5. Odds follow the maximum odds instead.
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Hardways and propositions {formatUnits(props.min)}–{formatUnits(props.max)} units
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Per component. The horn is split equally across 2, 3, 11 and 12.</Text>
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

const FIELD_LABELS: Record<FieldPayout, string> = { 'triple-12': '2 double, 12 triple', 'double-12': '2 and 12 double' };

function Option({ label, text = label, selected, onPress }: { label: string; text?: string; selected: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.option, selected && styles.optionSelected, focused && styles.optionFocused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.optionText, selected && styles.optionTextSelected]}>
        {selected ? `✓ ${text}` : text}
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

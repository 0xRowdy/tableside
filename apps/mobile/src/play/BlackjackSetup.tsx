// Minimal blackjack session setup (design frame S1-02, free play only): the
// four rule presets, penetration and a fresh buy-in. Guided modes, editable
// limits and extra players arrive with #70, #72, #77 and #78.

import { blackjackHouseEdge, blackjackRules, DEFAULT_PENETRATION, type BlackjackPreset } from '@tableside/definitions';
import { PENETRATIONS } from '@tableside/engine';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
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

export function BlackjackSetup({ problem, problemReason = null, busy }: { problem: StartProblem | null; problemReason?: string | null; busy: boolean }) {
  const { controller } = usePractice();
  const feedback = useFeedback();
  const [dealer, setDealer] = useState<'S17' | 'H17'>('S17');
  const [surrender, setSurrender] = useState(true);
  const [penetration, setPenetration] = useState(DEFAULT_PENETRATION);
  const [draft, setDraft] = useState(formatUnits(DEFAULT_BUY_IN));
  const [notWhole, setNotWhole] = useState(false);
  const preset: BlackjackPreset = `${dealer}_${surrender ? 'LS' : 'noLS'}`;
  const rules = blackjackRules(preset, penetration);

  const start = () => {
    const digits = draft.replace(/[,\s]/g, '');
    const whole = /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;
    setNotWhole(!whole);
    if (whole) void controller.start({ game: 'blackjack', buyIn: BigInt(digits).toString(), rules });
    else feedback.cue('input-rejected');
  };
  const error = notWhole ? PROBLEMS['invalid-buy-in'] : problem && (problem === 'access-denied' && problemReason ? problemReason : PROBLEMS[problem]);

  return (
    <Screen>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Blackjack
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>New session · free play · 6 decks · 3:2</Text>
      </View>

      <Choices
        label="DEALER"
        options={[
          { label: 'Stands on all 17s (S17)', selected: dealer === 'S17', onPress: () => setDealer('S17') },
          { label: 'Hits soft 17 (H17)', selected: dealer === 'H17', onPress: () => setDealer('H17') },
        ]}
      />
      <Choices
        label="LATE SURRENDER"
        help="Surrender plays arrive in a later update; the preset still sets the rules."
        options={[
          { label: 'Late surrender on', short: 'On', selected: surrender, onPress: () => setSurrender(true) },
          { label: 'Late surrender off', short: 'Off', selected: !surrender, onPress: () => setSurrender(false) },
        ]}
      />
      <Choices
        label="PENETRATION"
        help="How much of the shoe is dealt before the cut card. The round that reaches it is finished; then a fresh shoe."
        options={PENETRATIONS.map((value) => ({
          label: `Penetration ${value}%`,
          short: `${value}%`,
          selected: value === penetration,
          onPress: () => setPenetration(value),
        }))}
      />

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>TABLE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
          Initial wager {formatUnits(rules.limits.initial.min)}–{formatUnits(rules.limits.initial.max)} units
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          Edge with basic strategy: {blackjackHouseEdge(preset).percent}% (this preset)
        </Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>BUY-IN</Text>
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

interface Choice {
  label: string;
  short?: string;
  selected: boolean;
  onPress: () => void;
}

function Choices({ label, help, options }: { label: string; help?: string; options: readonly Choice[] }) {
  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label.toLowerCase()} style={styles.choices}>
        {options.map((option) => (
          <ChoiceButton key={option.label} choice={option} />
        ))}
      </View>
      {help && <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>{help}</Text>}
    </View>
  );
}

function ChoiceButton({ choice }: { choice: Choice }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={choice.label}
      accessibilityState={{ checked: choice.selected }}
      onPress={choice.onPress}
      {...focusProps}
      style={[styles.choice, choice.selected && styles.choiceSelected, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.choiceText, choice.selected && styles.choiceTextSelected]}>
        {choice.selected ? '✓ ' : ''}
        {choice.short ?? choice.label}
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
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  choice: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  choiceSelected: { borderColor: palette.primary, borderWidth: 2, backgroundColor: palette.secondary },
  focused: { borderColor: palette.ring, borderWidth: 2 },
  choiceText: { fontFamily: fonts.uiMedium, fontSize: 14, color: palette.foreground },
  choiceTextSelected: { fontFamily: fonts.uiBold },
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

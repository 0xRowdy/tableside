// Roulette session setup (design frame S1-02): free play or guided practice,
// either wheel at the launch limits, and a fresh buy-in. Guided practice picks
// a built-in strategy (or, from spec 4, one of My strategies) and fixes its
// targets before the start. The engine judges whether the strategy fits the
// table; an incompatible pairing is refused naming the requirement, never
// adjusted. Editable limits and the house-edge line arrive with #72.

import { strategyTableCompatibility, type ActivitySpecification, type RouletteWheel, type StrategyDefinition, type TableRequirement } from '@tableside/engine';
import { ROULETTE_PRESETS, ROULETTE_STRATEGIES, strategyDefaults } from '@tableside/definitions';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import type { StartProblem } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { betsText } from './coaching-text';
import { formatUnits, targetName } from './roulette-text';

const DEFAULT_BUY_IN = '1000';
/** Longest buy-in text accepted before the engine judges the amount (the ceiling has 10 digits). */
const MAX_BUY_IN_DIGITS = 13;

const PROBLEMS: Record<StartProblem, string> = {
  'invalid-buy-in': 'Enter whole units from 1 to 1,000,000,000.',
  'strategy-incompatible': "This strategy doesn't fit your table.",
  'save-failed': "The session couldn't be saved, so it hasn't started. Try again.",
  'access-not-allowed': "This session can't start right now.",
};

type Mode = 'free-play' | 'guided';

export function RouletteSetup({
  problem,
  busy,
  presets = ROULETTE_PRESETS,
  myStrategies = [],
}: {
  problem: StartProblem | null;
  busy: boolean;
  /** The table each wheel offers (editable limits arrive with #72). */
  presets?: Readonly<Record<RouletteWheel, ActivitySpecification['rules']>>;
  /** The latest saved revision of each runnable private roulette strategy (spec 4). */
  myStrategies?: readonly StrategyDefinition[];
}) {
  const { controller } = usePractice();
  const feedback = useFeedback();
  const [draft, setDraft] = useState(formatUnits(DEFAULT_BUY_IN));
  const [notWhole, setNotWhole] = useState(false);
  const [wheel, setWheel] = useState<RouletteWheel>('single-zero');
  const [mode, setMode] = useState<Mode>('free-play');
  const [strategy, setStrategy] = useState<StrategyDefinition>(ROULETTE_STRATEGIES[0] as StrategyDefinition);
  const [choices, setChoices] = useState<Record<string, string>>(strategyDefaults(strategy));
  const [customizeNote, setCustomizeNote] = useState(false);
  const rules = presets[wheel];
  const { limits } = rules;
  const guided = mode === 'guided';
  const fit = guided ? strategyTableCompatibility(strategy, choices, rules) : null;
  const chooseStrategy = (next: StrategyDefinition) => {
    setStrategy(next);
    setChoices(strategyDefaults(next));
    setCustomizeNote(false);
  };

  const start = () => {
    const digits = draft.replace(/[,\s]/g, '');
    const whole = /^\d+$/.test(digits) && digits.length <= MAX_BUY_IN_DIGITS;
    setNotWhole(!whole);
    if (!whole) return feedback.cue('input-rejected');
    void controller.start({
      game: 'roulette',
      buyIn: BigInt(digits).toString(),
      wheel,
      ...(guided ? { strategy: { definition: strategy, parameters: choices } } : {}),
    });
  };
  const error = notWhole ? PROBLEMS['invalid-buy-in'] : problem && PROBLEMS[problem];

  return (
    <Screen>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Roulette
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>New session · {guided ? 'guided practice' : 'free play'}</Text>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>HOW DO YOU WANT TO PLAY?</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="How do you want to play?" style={styles.choices}>
          <Choice label="Free play" selected={!guided} onPress={() => setMode('free-play')} />
          <Choice label="Guided practice" selected={guided} onPress={() => setMode('guided')} />
        </View>
      </View>

      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>WHEEL</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Wheel" style={styles.choices}>
          {WHEELS.map((option) => (
            <Choice key={option.wheel} label={option.label} selected={wheel === option.wheel} onPress={() => setWheel(option.wheel)} />
          ))}
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          {wheel === 'single-zero'
            ? 'Even-money bets lose in full when the ball lands on zero.'
            : 'Even-money bets lose in full on 0 or 00. Adds the five-number basket.'}
        </Text>
      </View>

      {guided && (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>STRATEGY</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Strategy" style={styles.strategies}>
            {ROULETTE_STRATEGIES.map((option) => (
              <StrategyChoice key={option.id} definition={option} selected={strategy.id === option.id} onPress={() => chooseStrategy(option)} />
            ))}
          </View>
          <StrategyParameters definition={strategy} choices={choices} onChange={setChoices} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.label}>MY STRATEGIES</Text>
          {myStrategies.length === 0 ? (
            <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Strategies you save in the builder appear here.</Text>
          ) : (
            <View accessibilityRole="radiogroup" accessibilityLabel="My strategies" style={styles.strategies}>
              {myStrategies.map((option) => (
                <StrategyChoice key={option.id} definition={option} selected={strategy.id === option.id} onPress={() => chooseStrategy(option)} />
              ))}
            </View>
          )}
          {fit && !fit.compatible && (
            <Incompatible
              strategy={strategy}
              requirements={fit.requirements}
              customizeNote={customizeNote}
              onCustomize={() => setCustomizeNote(true)}
            />
          )}
        </View>
      )}

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

      <Button label={guided ? 'Start guided practice' : 'Start free play'} stretch disabled={busy || (fit !== null && !fit.compatible)} onPress={start} />
    </Screen>
  );
}

/** The plain-language requirement a table fails. */
function requirementText(strategy: StrategyDefinition, requirement: TableRequirement): string {
  const bet = requirement.target && requirement.amount ? betsText([{ target: requirement.target, amount: requirement.amount }]) : '';
  switch (requirement.requirement) {
    case 'below-minimum':
      return `${strategy.name} bets ${bet}. This table's minimum for that bet is ${formatUnits(requirement.limit ?? '0')}, so a ${formatUnits(requirement.amount ?? '0')} bet isn't allowed.`;
    case 'above-maximum':
      return `${strategy.name} bets ${bet}. This table's maximum for that bet is ${formatUnits(requirement.limit ?? '0')}.`;
    case 'not-on-layout':
      return `${strategy.name} bets on ${targetName(requirement.target ?? '')}, which this wheel doesn't have.`;
    case 'wheel':
      return `${strategy.name} is written for a different wheel.`;
    case 'invalid-parameter':
      return 'Choose its targets first.';
    default:
      return `${strategy.name} needs ${requirement.requirement}.`;
  }
}

function Incompatible({
  strategy,
  requirements,
  customizeNote,
  onCustomize,
}: {
  strategy: StrategyDefinition;
  requirements: readonly TableRequirement[];
  customizeNote: boolean;
  onCustomize: () => void;
}) {
  return (
    <View style={styles.incompatible} testID="strategy-incompatible">
      <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.value}>
        This strategy doesn&apos;t fit your table
      </Text>
      {requirements.map((requirement) => (
        <Text key={requirement.path} maxFontSizeMultiplier={textScale.body} style={styles.help}>
          {requirementText(strategy, requirement)}
        </Text>
      ))}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Tableside won&apos;t change a strategy&apos;s amounts for you.</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Choose a compatible table or another strategy above, or:</Text>
      <Button label="Customize a copy for this table" variant="secondary" stretch onPress={onCustomize} />
      {customizeNote && (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.help}>
          The strategy builder arrives in a later update. It will make your own private copy declared for this table, with the same amounts until you choose new ones.
        </Text>
      )}
    </View>
  );
}

function StrategyChoice({ definition, selected, onPress }: { definition: StrategyDefinition; selected: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={definition.name}
      accessibilityHint={definition.note}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.choice, styles.strategy, selected && styles.choiceSelected, focused && styles.choiceFocused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
        {selected ? '✓ ' : ''}
        {definition.name}
      </Text>
      {definition.note !== undefined && <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>{definition.note}</Text>}
    </Pressable>
  );
}

/**
 * The strategy's targets, fixed for the cycle once play starts. A parameter
 * that must differ from another can't take that one's choice.
 */
function StrategyParameters({
  definition,
  choices,
  onChange,
}: {
  definition: StrategyDefinition;
  choices: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <>
      {definition.parameters.map((param) => {
        const taken = definition.parameters.filter((other) => other.distinctFrom === param.id || param.distinctFrom === other.id).map((other) => choices[other.id]);
        return (
          <View key={param.id} style={styles.section}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel}>{param.label}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={param.label} style={styles.choices}>
              {param.choices.map((choice) => (
                <Choice
                  key={choice}
                  label={targetName(choice)}
                  selected={choices[param.id] === choice}
                  disabled={taken.includes(choice)}
                  onPress={() => onChange({ ...choices, [param.id]: choice })}
                />
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}

const WHEELS: readonly { wheel: RouletteWheel; label: string }[] = [
  { wheel: 'single-zero', label: 'Single zero (0)' },
  { wheel: 'double-zero', label: 'Double zero (0, 00)' },
];

function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={disabled ? 'Already chosen for the other target' : undefined}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.choice, selected && styles.choiceSelected, focused && styles.choiceFocused, disabled && styles.choiceDisabled]}
    >
      {/* Selection is marked by the check as well as the outline. */}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  choice: {
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  choiceSelected: { borderColor: palette.primary, borderWidth: 2 },
  choiceDisabled: { opacity: 0.5 },
  strategies: { gap: space[2] },
  strategy: { paddingVertical: space[2], gap: 2, justifyContent: 'flex-start' },
  incompatible: { gap: space[2], padding: space[4], borderRadius: radius.lg, borderWidth: 2, borderColor: palette.destructive, backgroundColor: palette.card },
  choiceFocused: { borderColor: palette.ring, borderWidth: 2 },
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

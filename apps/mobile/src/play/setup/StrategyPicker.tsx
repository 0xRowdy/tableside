// The strategy picker of guided-practice setup (S1-02 XQukd and GAXET, with
// "My strategies" and S4-13's "Customize a copy for this table"), shared by
// every game that runs strategies. A table passes its built-ins, how it words
// a requirement its table fails, and any choices the strategy takes.

import type { StrategyDefinition, TableCompatibility, TableRequirement } from '@tableside/engine';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { betsText, type CoachWords } from '../coaching-text';
import { formatUnits } from '../units';

/** A table limit the strategy's bet falls outside, in words every game shares; null for any other requirement. */
export function limitRequirementText(strategy: StrategyDefinition, requirement: TableRequirement, words: CoachWords): string | null {
  const bet = requirement.target && requirement.amount ? betsText([{ target: requirement.target, amount: requirement.amount }], words) : '';
  switch (requirement.requirement) {
    case 'below-minimum':
      return `${strategy.name} bets ${bet}. This table's minimum for that bet is ${formatUnits(requirement.limit ?? '0')}, so a ${formatUnits(requirement.amount ?? '0')} bet isn't allowed.`;
    case 'above-maximum':
      return `${strategy.name} bets ${bet}. This table's maximum for that bet is ${formatUnits(requirement.limit ?? '0')}.`;
    default:
      return null;
  }
}

export function StrategyPicker({
  builtIns,
  myStrategies,
  selected,
  onChoose,
  fit,
  describe,
  tableParts,
  children,
}: {
  builtIns: readonly StrategyDefinition[];
  /** The latest saved revision of each runnable private strategy for this game (spec 4). */
  myStrategies: readonly StrategyDefinition[];
  selected: StrategyDefinition;
  onChoose: (next: StrategyDefinition) => void;
  /** The engine's judgement of the strategy at the table as edited; null until the limits are good. */
  fit: TableCompatibility | null;
  describe: (requirement: TableRequirement) => string;
  /** What of the table can be changed to fit: "the wheel or limits". */
  tableParts: string;
  /** The strategy's own choices, under the list. */
  children?: ReactNode;
}) {
  const [customizeNote, setCustomizeNote] = useState<string | null>(null);
  const choose = (next: StrategyDefinition) => {
    onChoose(next);
    setCustomizeNote(null);
  };
  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>STRATEGY</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Strategy" style={styles.strategies}>
        {builtIns.map((option) => (
          <StrategyChoice key={option.id} definition={option} selected={selected.id === option.id} onPress={() => choose(option)} />
        ))}
      </View>
      {children}
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.label}>MY STRATEGIES</Text>
      {myStrategies.length === 0 ? (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Strategies you save in the builder appear here.</Text>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel="My strategies" style={styles.strategies}>
          {myStrategies.map((option) => (
            <StrategyChoice key={option.id} definition={option} selected={selected.id === option.id} onPress={() => choose(option)} />
          ))}
        </View>
      )}
      {fit && !fit.compatible && (
        <View style={styles.incompatible} testID="strategy-incompatible">
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.value}>
            This strategy doesn&apos;t fit your table
          </Text>
          {/* One line per requirement, however many instructions share the bet. */}
          {[...new Set(fit.requirements.map(describe))].map((text) => (
            <Text key={text} maxFontSizeMultiplier={textScale.body} style={styles.help}>
              {text}
            </Text>
          ))}
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Tableside won&apos;t change a strategy&apos;s amounts for you.</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Choose a compatible table ({tableParts}) or another strategy, or:</Text>
          <Button label="Customize a copy for this table" variant="secondary" stretch onPress={() => setCustomizeNote(selected.id)} />
          {customizeNote === selected.id && (
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.help}>
              The strategy builder arrives in a later update. It will make your own private copy declared for this table, with the same amounts until you choose new ones.
            </Text>
          )}
        </View>
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
      style={[styles.choice, selected && styles.choiceSelected, focused && styles.choiceFocused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
        {selected ? '✓ ' : ''}
        {definition.name}
      </Text>
      {definition.note !== undefined && <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>{definition.note}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[2] },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.mutedForeground },
  value: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  help: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  strategies: { gap: space[2] },
  choice: {
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'flex-start',
    gap: 2,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  choiceSelected: { borderColor: palette.primary, borderWidth: 2 },
  choiceFocused: { borderColor: palette.ring, borderWidth: 2 },
  incompatible: { gap: space[2], padding: space[4], borderRadius: radius.lg, borderWidth: 2, borderColor: palette.destructive, backgroundColor: palette.card },
});

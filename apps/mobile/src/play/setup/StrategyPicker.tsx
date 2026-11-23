// Spec 1 S1-02, Spec 4 S4-13

import type { StrategyDefinition, TableCompatibility, TableRequirement } from '@tableside/engine';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import { betsText, type CoachWords } from '../coaching-text';
import { formatUnits } from '../units';

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
  myStrategies: readonly StrategyDefinition[];
  selected: StrategyDefinition;
  onChoose: (next: StrategyDefinition) => void;
  fit: TableCompatibility | null;
  describe: (requirement: TableRequirement) => string;
  tableParts: string;
  children?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>STRATEGY</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Strategy" style={styles.strategies}>
        {builtIns.map((option) => (
          <StrategyChoice key={option.id} definition={option} selected={selected.id === option.id} onPress={() => onChoose(option)} />
        ))}
      </View>
      {children}
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.label}>MY STRATEGIES</Text>
      {myStrategies.length === 0 ? (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Strategies you save in the builder appear here.</Text>
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel="My strategies" style={styles.strategies}>
          {myStrategies.map((option) => (
            <StrategyChoice key={option.id} definition={option} selected={selected.id === option.id} onPress={() => onChoose(option)} />
          ))}
        </View>
      )}
      {fit && !fit.compatible && (
        <View style={styles.incompatible} testID="strategy-incompatible">
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.value}>
            This strategy doesn&apos;t fit your table
          </Text>
          {[...new Set(fit.requirements.map(describe))].map((text) => (
            <Text key={text} maxFontSizeMultiplier={textScale.body} style={styles.help}>
              {text}
            </Text>
          ))}
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Tableside won&apos;t change a strategy&apos;s amounts for you.</Text>
          {/* docs/decisions/clarify-challenge-vocabulary.md; #54 */}
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>Choose a compatible table ({tableParts}) or another strategy.</Text>
        </View>
      )}
    </View>
  );
}

function StrategyChoice({ definition, selected, onPress }: { definition: StrategyDefinition; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
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

const useStyles = makeStyles((type) => ({
  section: { gap: space[2] },
  label: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  value: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  help: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
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
}));

import type { HintId } from '@tableside/definitions';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { FirstUseHint } from '@/lessons/FirstUseHints';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export type Presentation = 'table' | 'selector';

// Spec 3 Lessons › Structure (First-use hints); S1-04 XjwQc; #146
export const TABLE_HINTS: readonly HintId[] = ['bet-selector'];

const OPTIONS: readonly { value: Presentation; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'selector', label: 'Bet list' },
];

export function PresentationSwitch({ value, onChange }: { value: Presentation; onChange: (value: Presentation) => void }) {
  const styles = useStyles();
  return (
    <>
      <View accessibilityRole="tablist" accessibilityLabel="Presentation" style={styles.switch}>
        {OPTIONS.map((option) => (
          <Option key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
        ))}
      </View>
      <View style={styles.hint}>
        <FirstUseHint id="bet-selector" />
      </View>
    </>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityHint="Same session and draft in either view."
      accessibilityState={{ selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.option, selected && styles.selected, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.label, selected && styles.labelSelected]}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

export function DraftBar({ name, amount, onEdit }: { name: string; amount: string; onEdit: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.draft}>
      <View accessible accessibilityLabel={`Draft, ${name}, ${amount}, not placed`}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.draftTitle}>Draft · {name} · {amount}</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.draftText}>Not placed. Open it in the bet list to set it.</Text>
      </View>
      <Button label="Edit in bet list" variant="secondary" onPress={onEdit} />
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  hint: { marginHorizontal: space[4] },
  switch: { flexDirection: 'row', gap: space[1], marginHorizontal: space[4], padding: space[1], borderRadius: radius.pill, backgroundColor: palette.card },
  option: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  selected: { backgroundColor: palette.secondary, borderColor: palette.primary },
  focused: { borderColor: palette.ring },
  label: { fontFamily: fonts.uiMedium, ...type.secondary, color: palette.mutedForeground, textAlign: 'center' },
  labelSelected: { fontFamily: fonts.uiBold, color: palette.foreground },
  draft: { gap: space[2], marginHorizontal: space[4], padding: space[3], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.card },
  draftTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  draftText: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}));

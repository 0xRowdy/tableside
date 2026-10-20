// Switching one table between its two presentations, the graphical table and
// the bet list, and the draft bar the table shows while a bet-list draft is
// unsubmitted. Both control the same session; switching never changes it.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

export type Presentation = 'table' | 'selector';

const OPTIONS: readonly { value: Presentation; label: string }[] = [
  { value: 'table', label: 'Table' },
  // "Bet list" is the design's tab copy for the bet selector.
  { value: 'selector', label: 'Bet list' },
];

export function PresentationSwitch({ value, onChange }: { value: Presentation; onChange: (value: Presentation) => void }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Presentation" style={styles.switch}>
      {OPTIONS.map((option) => (
        <Option key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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

/** Shown on the table while the bet list holds an unsubmitted draft. */
export function DraftBar({ name, amount, onEdit }: { name: string; amount: string; onEdit: () => void }) {
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

const styles = StyleSheet.create({
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
  label: { fontFamily: fonts.uiMedium, fontSize: 14, color: palette.mutedForeground, textAlign: 'center' },
  labelSelected: { fontFamily: fonts.uiBold, color: palette.foreground },
  draft: { gap: space[2], marginHorizontal: space[4], padding: space[3], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.card },
  draftTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  draftText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
});

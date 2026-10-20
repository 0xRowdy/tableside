// A labelled on/off switch filling its row (design component "Toggle Row"),
// used by Settings and by the bet selector's stake editor.

import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, space, textScale } from '@/theme/tokens';

/** On and off differ by knob position and a check mark, not only color. */
export function SwitchRow({
  title,
  detail,
  value,
  onChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      {...focusProps}
      style={[styles.switchRow, disabled && styles.disabled, focused && styles.focused]}
    >
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{title}</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{detail}</Text>
      </View>
      <View style={[styles.switch, value ? styles.switchOn : styles.switchOff]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]}>{value && <Check color={palette.primary} size={14} />}</View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space[4], minHeight: MIN_TOUCH_TARGET + 16, paddingVertical: space[3], paddingHorizontal: space[4], borderWidth: 2, borderColor: palette.transparent },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 21, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: palette.primary, alignItems: 'flex-end' },
  switchOff: { backgroundColor: palette.muted, borderWidth: 1.5, borderColor: palette.controlBorder, alignItems: 'flex-start' },
  knob: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  knobOn: { backgroundColor: palette.primaryForeground },
  knobOff: { width: 23, height: 23, backgroundColor: palette.mutedForeground },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring },
});

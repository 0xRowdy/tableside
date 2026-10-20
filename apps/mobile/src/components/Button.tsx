import { Pressable, StyleSheet, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

export function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: palette.primary,
  },
  pressed: { opacity: 0.8 },
  focused: { borderColor: palette.foreground },
  label: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.primaryForeground },
});

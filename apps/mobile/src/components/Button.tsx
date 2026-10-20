import { Pressable, StyleSheet, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  stretch = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Fill the container's width instead of hugging the label. */
  stretch?: boolean;
  hint?: string;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        stretch && styles.stretch,
        pressed && styles.pressed,
        disabled && styles.disabled,
        focused && styles.focused,
      ]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.label, secondary && styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
    paddingVertical: space[3],
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: palette.primary,
  },
  secondary: { backgroundColor: palette.secondary, borderColor: palette.secondary },
  stretch: { alignSelf: 'stretch' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.foreground },
  label: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.primaryForeground, textAlign: 'center' },
  secondaryLabel: { color: palette.foreground },
});

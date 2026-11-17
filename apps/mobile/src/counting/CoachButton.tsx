// Spec 3 S3-04 qdnQm, S3-06 Qv1An, S3-07 AcmMa; #137

import { Pressable, StyleSheet, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, textScale } from '@/theme/tokens';

export function CoachButton({ label, primary = false, enabled, onPress }: { label: string; primary?: boolean; enabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, pressed && styles.pressed, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.text, primary && styles.primaryText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 2 },
  primary: { backgroundColor: palette.ink, borderColor: palette.ink },
  secondary: { borderColor: palette.inkMuted },
  text: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.ink },
  primaryText: { color: palette.coach },
  focused: { borderColor: palette.coachAccent },
  pressed: { opacity: 0.8 },
});

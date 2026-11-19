// Spec 3 S3-04 qdnQm, S3-06 Qv1An, S3-07 AcmMa; #137

import { Pressable, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export function CoachButton({ label, primary = false, enabled, onPress }: { label: string; primary?: boolean; enabled: boolean; onPress: () => void }) {
  const styles = useStyles();
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

const useStyles = makeStyles((type) => ({
  button: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radius.md, borderWidth: 2 },
  primary: { backgroundColor: palette.ink, borderColor: palette.ink },
  secondary: { borderColor: palette.inkMuted },
  text: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.ink },
  primaryText: { color: palette.coach },
  focused: { borderColor: palette.coachAccent },
  pressed: { opacity: 0.8 },
}));

import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  stretch = false,
  hint,
  icon: Icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  disabled?: boolean;
  stretch?: boolean;
  hint?: string;
  icon?: LucideIcon;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const secondary = variant !== 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'outline' && styles.outline,
        stretch && styles.stretch,
        pressed && styles.pressed,
        disabled && styles.disabled,
        focused && styles.focused,
      ]}
    >
      {Icon && <Icon color={secondary ? palette.foreground : palette.primaryForeground} size={18} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.label, secondary && styles.secondaryLabel, variant === 'outline' && styles.outlineLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: space[2],
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
  ghost: { backgroundColor: palette.transparent, borderColor: palette.transparent },
  // Spec 3 S3-03 drVnR, S3-08 liAfT
  outline: { minHeight: 52, paddingHorizontal: space[6] - space[1], borderRadius: radius.md, borderWidth: 1, borderColor: palette.controlBorder },
  stretch: { alignSelf: 'stretch' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.foreground },
  label: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.primaryForeground, textAlign: 'center' },
  secondaryLabel: { color: palette.foreground },
  outlineLabel: { ...type.body },
}));

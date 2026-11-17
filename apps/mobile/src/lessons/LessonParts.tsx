// Spec 3 S3-12 l8pMS and aJV2y, S3-13 JJl51; #143, #144

import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

export function NavButton({
  icon: Icon,
  label,
  primary = false,
  block = false,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  block?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.navButton, block && styles.block, primary && styles.navPrimary, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
    >
      <Icon color={primary ? palette.primaryForeground : palette.foreground} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.navLabel, primary && styles.navPrimaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  navButton: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[6] - space[1],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  block: { flexGrow: 0, flexBasis: 'auto', alignSelf: 'stretch' },
  navPrimary: { borderColor: palette.primary, backgroundColor: palette.primary },
  navLabel: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground, textAlign: 'center' },
  navPrimaryLabel: { color: palette.primaryForeground },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

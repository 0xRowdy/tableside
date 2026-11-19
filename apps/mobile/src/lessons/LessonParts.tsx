// Spec 3 S3-12 l8pMS and aJV2y, S3-13 JJl51 and ZBpF3; #143, #144, #145

import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export function NavButton({
  icon: Icon,
  label,
  primary = false,
  quiet = false,
  block = false,
  disabled,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  primary?: boolean;
  quiet?: boolean;
  block?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.navButton, block && styles.block, primary && styles.navPrimary, quiet && styles.navQuiet, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
    >
      {Icon && <Icon color={primary ? palette.primaryForeground : palette.foreground} size={18} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.navLabel, primary && styles.navPrimaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
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
  navLabel: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground, textAlign: 'center' },
  navPrimaryLabel: { color: palette.primaryForeground },
  navQuiet: { borderColor: palette.transparent, backgroundColor: palette.transparent },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
}));

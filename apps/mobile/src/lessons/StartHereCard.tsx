// Spec 3 Lessons › Entry points, user stories 2–4; S1-01 olGG6; #146
import { ArrowRight, GraduationCap, X } from 'lucide-react-native';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { START_HERE } from '@/training/lesson-text';

export function StartHereCard({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  const open = useKeyboardFocus();
  const dismiss = useKeyboardFocus();
  return (
    <View style={styles.card} testID="start-here">
      <View style={styles.icon}>
        <GraduationCap color={palette.primary} size={22} />
      </View>
      <View style={styles.text}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.title}>
          {START_HERE.title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
          {START_HERE.text}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={START_HERE.open}
          onPress={onOpen}
          {...open.focusProps}
          style={({ pressed }) => [styles.open, pressed && styles.pressed, open.focused && styles.focused]}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.openText}>
            {START_HERE.open}
          </Text>
          <ArrowRight color={palette.primary} size={18} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={START_HERE.dismiss}
        onPress={() => {
          onDismiss();
          AccessibilityInfo.announceForAccessibility(START_HERE.dismissed);
        }}
        {...dismiss.focusProps}
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed, dismiss.focused && styles.focused]}
      >
        <X color={palette.foreground} size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingTop: space[4],
    paddingBottom: space[4],
    paddingLeft: space[4],
    paddingRight: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.card,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, gap: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  open: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: MIN_TOUCH_TARGET, borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  openText: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.primary },
  dismiss: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  pressed: { opacity: 0.8 },
  focused: { borderColor: palette.ring },
});

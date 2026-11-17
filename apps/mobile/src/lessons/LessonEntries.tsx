// Spec 3 Lessons › Entry points; S1-02 FxxAj, S3-02 buD2R, S3-01 PDCaD; #145

import type { GameId } from '@tableside/engine';
import { router } from 'expo-router';
import { BookOpen, ChevronRight, GraduationCap, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { NOT_READY_HINT } from '@/training/challenge-text';
import { LEARN_THIS_GAME, LEARN_THIS_GAME_DETAIL } from '@/training/lesson-text';

import { lessonsHref } from './routes';

export function LearnThisGame({ game }: { game: GameId }) {
  return <LearnRow icon={GraduationCap} title={LEARN_THIS_GAME} detail={LEARN_THIS_GAME_DETAIL[game]} onPress={() => router.navigate(lessonsHref(game))} />;
}

export function LearnRow({ icon: Icon, title, detail, disabled = false, onPress }: { icon: LucideIcon; title: string; detail: string; disabled?: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityHint={disabled ? NOT_READY_HINT : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled, focused && styles.focused]}
    >
      <View style={styles.lead}>
        <Icon color={palette.foreground} size={18} />
      </View>
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {detail}
        </Text>
      </View>
      {!disabled && <ChevronRight color={palette.mutedForeground} size={18} />}
    </Pressable>
  );
}

export function LessonLink({ label, ready, onPress }: { label: string; ready: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={ready ? undefined : NOT_READY_HINT}
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.link, pressed && styles.pressed, !ready && styles.disabled, focused && styles.focused]}
    >
      <BookOpen color={palette.primary} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.linkText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  lead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 21, color: palette.foreground },
  detail: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, color: palette.mutedForeground },
  link: { flexDirection: 'row', alignItems: 'center', gap: space[2] + 2, minHeight: MIN_TOUCH_TARGET, borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  linkText: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 15, color: palette.primary },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

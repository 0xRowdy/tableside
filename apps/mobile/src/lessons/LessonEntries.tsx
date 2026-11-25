// Spec 3 Lessons › Entry points; S1-02 FxxAj, S3-02 Ufuiu, S3-01 PDCaD; #145

import type { GameId } from '@tableside/engine';
import { router } from 'expo-router';
import { BookOpen, ChevronRight, GraduationCap, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { NOT_READY_HINT } from '@/training/challenge-text';
import { LEARN_THIS_GAME, LEARN_THIS_GAME_DETAIL, lessonCount } from '@/training/lesson-text';
import { useLessons } from '@/training/TrainingProvider';

import { lessonsHref } from './routes';

export function LearnThisGame({ game }: { game: GameId }) {
  const { lessons } = useLessons();
  const count = lessons?.filter((lesson) => lesson.section === game).length;
  return (
    <LearnRow
      icon={GraduationCap}
      title={LEARN_THIS_GAME}
      detail={LEARN_THIS_GAME_DETAIL[game]}
      count={count}
      onPress={() => router.navigate(lessonsHref({ section: game, from: 'setup' }))}
    />
  );
}

export function LearnRow({
  icon: Icon,
  title,
  detail,
  count,
  disabled = false,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  count?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}${count === undefined ? '' : ` ${lessonCount(count)}`}`}
      accessibilityHint={disabled ? NOT_READY_HINT : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.row, pressed && pressStyle.row, disabled && styles.disabled, focused && styles.focused]}
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
      {count !== undefined && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.count}>
          {count}
        </Text>
      )}
      {!disabled && <ChevronRight color={palette.mutedForeground} size={18} />}
    </Pressable>
  );
}

export function LessonLink({ label, ready, accent = true, onPress }: { label: string; ready: boolean; accent?: boolean; onPress: () => void }) {
  return <TextLink icon={BookOpen} label={label} accent={accent} disabled={!ready} hint={ready ? undefined : NOT_READY_HINT} onPress={onPress} />;
}

export function TextLink({
  icon: Icon,
  label,
  accent = true,
  disabled = false,
  hint,
  onPress,
}: {
  icon?: LucideIcon;
  label: string;
  accent?: boolean;
  disabled?: boolean;
  hint?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.link, pressed && pressStyle.row, disabled && styles.disabled, focused && styles.focused]}
    >
      {Icon && <Icon color={accent ? palette.primary : palette.foreground} size={18} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.linkText, !accent && styles.linkPlain]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
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
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  detail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  link: { flexDirection: 'row', alignItems: 'center', gap: space[2] + 2, minHeight: MIN_TOUCH_TARGET, borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  linkText: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.primary },
  linkPlain: { color: palette.foreground },
  count: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
}));

// Table chrome shared by every game table: the top bar, the Phase Stepper and
// the session strip (balance, outstanding wagers and status, always visible).

import { CircleStop } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

export function TableTopBar({
  title,
  subtitle,
  canEnd,
  onEnd,
}: {
  title: string;
  subtitle: string;
  canEnd: boolean;
  onEnd: () => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <View style={styles.topBar}>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End session"
        accessibilityHint="Asks before ending. Ending returns removable wagers and settles the rest."
        accessibilityState={{ disabled: !canEnd }}
        disabled={!canEnd}
        onPress={onEnd}
        {...focusProps}
        style={[styles.iconButton, focused && styles.focused, !canEnd && styles.disabled]}
      >
        <CircleStop color={palette.foreground} size={22} />
      </Pressable>
    </View>
  );
}

export interface PhaseStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

/** The turn's steps. Automatic steps (Settle) show here too; none of them waits for a tap. */
export function PhaseStepper({ steps }: { steps: readonly PhaseStep[] }) {
  return (
    <View style={styles.stepper} testID="phase-stepper">
      {steps.map((step, index) => (
        <View
          key={step.label}
          accessible
          accessibilityLabel={`Step ${index + 1} of ${steps.length}, ${step.label}, ${step.state}`}
          style={styles.step}
        >
          <View style={[styles.stepBar, step.state !== 'upcoming' && styles.stepBarReached]} />
          <Text
            maxFontSizeMultiplier={textScale.body}
            style={[styles.stepText, step.state === 'current' && styles.stepTextCurrent]}
          >
            {step.state === 'done' ? `✓ ${step.label}` : `${index + 1}  ${step.label}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SessionStrip({ balance, onTable, status }: { balance: string; onTable: string; status: string }) {
  return (
    <View style={styles.strip}>
      <View accessible accessibilityLabel={`Session balance ${balance}`} style={styles.stat}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>SESSION BALANCE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>{balance}</Text>
      </View>
      <View accessible accessibilityLabel={`On table ${onTable}`} style={styles.stat}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>ON TABLE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>{onTable}</Text>
      </View>
      <View accessible accessibilityLabel={`Status ${status}`} style={styles.statusTag}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingLeft: space[4], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  focused: { borderColor: palette.ring },
  disabled: { opacity: 0.4 },
  stepper: { flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[2] },
  step: { flex: 1, gap: 5 },
  stepBar: { height: 3, borderRadius: 2, backgroundColor: palette.border },
  stepBarReached: { backgroundColor: palette.primary },
  stepText: { fontFamily: fonts.uiMedium, fontSize: 11, color: palette.mutedForeground },
  stepTextCurrent: { fontFamily: fonts.uiBold, color: palette.foreground },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: palette.card,
  },
  stat: { gap: 1 },
  statLabel: { fontFamily: fonts.uiBold, fontSize: 10, color: palette.mutedForeground, letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  statusTag: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.secondary,
  },
  statusText: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.foreground },
});

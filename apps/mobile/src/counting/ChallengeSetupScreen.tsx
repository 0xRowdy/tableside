// Spec 3 S3-02 buD2R, ZreSb, Amendment 4 §2–3; #158, #150

import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { Check, CircleAlert, Play } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import {
  CATEGORY_TEXT,
  COUNTING_TITLE,
  NOT_READY_HINT,
  START_PROBLEM,
  startLabel,
  startWaits,
  VARIANT_LABEL,
  VARIANT_HELP,
  variantLabel,
  WHAT_YOU_DO,
  WHAT_YOU_DO_LABEL,
  type AllowanceCopy,
} from '@/training/challenge-text';
import type { CatalogEntry, ChallengeSetup, StartProblem } from '@/training/service';

import { AllowanceBanner } from './AllowanceBanner';

export function ChallengeSetupScreen({
  entry,
  setup,
  allowance,
  problem,
  busy,
  onChange,
  onStart,
  onBack,
}: {
  entry: CatalogEntry;
  setup: ChallengeSetup;
  allowance: AllowanceCopy | undefined;
  problem: StartProblem | null;
  busy: boolean;
  onChange: (setup: ChallengeSetup) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const text = CATEGORY_TEXT[entry.category];
  return (
    <SettingsScreen title={text.title} back={{ label: COUNTING_TITLE, onPress: onBack }}>
      <View style={styles.section}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
          {VARIANT_LABEL}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Variant" style={styles.segmented}>
          {CHALLENGE_VARIANTS.map((variant: ChallengeVariant) => (
            <Segment
              key={variant}
              label={variantLabel(variant)}
              selected={setup.variant === variant}
              disabled={!entry.ready.includes(variant)}
              onPress={() => onChange({ ...setup, variant })}
            />
          ))}
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
          {VARIANT_HELP}
        </Text>
      </View>
      {WHAT_YOU_DO[entry.category] && (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
            {WHAT_YOU_DO_LABEL}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
            {WHAT_YOU_DO[entry.category]}
          </Text>
        </View>
      )}
      {allowance && <AllowanceBanner standing={allowance.standing} title={allowance.setup.text} action={allowance.setup.action} />}
      {problem && (
        <View style={[styles.banner, styles.problem]}>
          <CircleAlert color={palette.destructive} size={20} />
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
            {START_PROBLEM[problem]}
          </Text>
        </View>
      )}
      <Button label={startLabel(setup.variant)} icon={Play} stretch disabled={busy || startWaits(allowance)} onPress={onStart} />
    </SettingsScreen>
  );
}

function Segment({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={disabled ? NOT_READY_HINT : undefined}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.segment, selected && styles.segmentSelected, disabled && styles.disabled, focused && styles.focused]}
    >
      {selected && <Check color={palette.primaryForeground} size={16} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.segmentText, selected && styles.segmentTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] - 2 },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  help: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
  segmented: { flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.muted },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1] + 2,
    paddingHorizontal: space[2],
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  segmentSelected: { backgroundColor: palette.primary },
  segmentText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  segmentTextSelected: { color: palette.primaryForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  problem: { borderColor: palette.destructive },
  bannerText: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, lineHeight: 20, color: palette.foreground },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring },
});

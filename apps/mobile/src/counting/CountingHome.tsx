// Spec 3 S3-01 PDCaD; #158

import { CHALLENGE_VARIANTS, type ChallengeVariant } from '@tableside/engine';
import { ClipboardCheck, GraduationCap, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { Note, SettingsScreen } from '@/settings/SettingsParts';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { CATEGORY_TEXT, COUNTING_TITLE, NOT_READY_HINT, RECOMMENDATIONS_NOTE, SUGGESTED_ORDER_LABEL, variantLabel } from '@/training/challenge-text';
import type { CatalogCategory, CatalogEntry, ChallengeSetup } from '@/training/service';

const VARIANT_ICON: Record<ChallengeVariant, LucideIcon> = { learn: GraduationCap, check: ClipboardCheck };

export function CountingHome({ catalog, onChoose }: { catalog: readonly CatalogEntry[]; onChoose: (setup: ChallengeSetup) => void }) {
  return (
    <SettingsScreen title={COUNTING_TITLE}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
        {SUGGESTED_ORDER_LABEL}
      </Text>
      {catalog.map((entry, index) => (
        <CategoryCard key={entry.category} step={index + 1} entry={entry} onChoose={onChoose} />
      ))}
      <Note>{RECOMMENDATIONS_NOTE}</Note>
    </SettingsScreen>
  );
}

function CategoryCard({ step, entry, onChoose }: { step: number; entry: CatalogEntry; onChoose: (setup: ChallengeSetup) => void }) {
  const text = CATEGORY_TEXT[entry.category];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.step}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.stepText}>
            {step}
          </Text>
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {text.title}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.description}>
        {text.description}
      </Text>
      <View style={styles.actions}>
        {CHALLENGE_VARIANTS.map((variant) => (
          <VariantButton key={variant} category={entry.category} variant={variant} icon={VARIANT_ICON[variant]} ready={entry.ready.includes(variant)} onChoose={onChoose} />
        ))}
      </View>
    </View>
  );
}

function VariantButton({
  category,
  variant,
  icon: Icon,
  ready,
  onChoose,
}: {
  category: CatalogCategory;
  variant: ChallengeSetup['variant'];
  icon: LucideIcon;
  ready: boolean;
  onChoose: (setup: ChallengeSetup) => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  const label = variantLabel(variant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${CATEGORY_TEXT[category].title}`}
      accessibilityHint={ready ? undefined : NOT_READY_HINT}
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={() => onChoose({ category, variant })}
      {...focusProps}
      style={({ pressed }) => [styles.variant, pressed && styles.pressed, !ready && styles.disabled, focused && styles.focused]}
    >
      <Icon color={palette.foreground} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.variantText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  card: { gap: space[3] - 2, padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  step: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary, borderWidth: 1, borderColor: palette.controlBorder },
  stepText: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  title: { flex: 1, fontFamily: fonts.uiBold, fontSize: 18, color: palette.foreground },
  description: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] - 2 },
  variant: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  variantText: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

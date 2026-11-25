// Spec 1 Amendment 12 §3; spec 2 Amendment 10 §2; S1-12 I886X, S2-16 Np7f0
import { Circle, CircleCheckBig, Play } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { PlayingCard } from '@/counting/CardChoices';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { pressStyle } from '@/theme/press';
import { fonts, palette, radius, space, textScale, TEXT_STEPS, type TextStep } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export const TEXT_STEP_TEXT: Readonly<Record<TextStep, { readonly title: string; readonly detail: string }>> = {
  standard: { title: 'Standard', detail: 'The default size.' },
  large: { title: 'Large', detail: 'Bigger text everywhere in Tableside.' },
  larger: { title: 'Larger', detail: 'The biggest. Tables and long lists scroll more.' },
};

const PREVIEW = {
  card: { rank: 9, suit: 'hearts' },
  kicker: 'Checkpoint 1 of 4',
  prompt: 'Enter the running count after 13 cards',
  body: 'Check holds all feedback until the end.',
} as const;

export function TextSizePreview() {
  const styles = useStyles();
  return (
    <View style={styles.previewGroup}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.groupLabel}>
        Preview
      </Text>
      <View accessible accessibilityLabel={`Preview. ${PREVIEW.kicker}. ${PREVIEW.prompt}. ${PREVIEW.body}`} style={styles.preview}>
        <View style={styles.prompt}>
          <PlayingCard card={PREVIEW.card} small />
          <View style={styles.promptText}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
              {PREVIEW.kicker}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.promptTitle}>
              {PREVIEW.prompt}
            </Text>
          </View>
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
          {PREVIEW.body}
        </Text>
        <View style={styles.sample}>
          <Play color={palette.foreground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.sampleLabel}>
            Submit
          </Text>
        </View>
      </View>
    </View>
  );
}

export function TextSizeOptions({ selected, onSelect }: { selected: TextStep; onSelect: (step: TextStep) => void }) {
  const styles = useStyles();
  return (
    <View testID="text-size-options" accessibilityRole="radiogroup" accessibilityLabel="Text size" style={styles.options}>
      {TEXT_STEPS.map((step) => (
        <Option key={step} step={step} selected={step === selected} onPress={() => onSelect(step)} />
      ))}
    </View>
  );
}

function Option({ step, selected, onPress }: { step: TextStep; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const { title, detail } = TEXT_STEP_TEXT[step];
  const Icon = selected ? CircleCheckBig : Circle;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && (selected ? pressStyle.feltShadow : pressStyle.row), focused && styles.focused]}
    >
      <Icon color={selected ? palette.primary : palette.mutedForeground} size={24} />
      <View style={styles.optionText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.optionTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.optionDetail}>
          {detail}
        </Text>
      </View>
      {selected && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.selected}>
          Selected
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  previewGroup: { gap: space[2] },
  groupLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  preview: { gap: 14, padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  promptText: { flex: 1, gap: 2 },
  kicker: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  promptTitle: { fontFamily: fonts.uiSemiBold, ...type.heading, color: palette.foreground },
  body: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  sample: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  sampleLabel: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  options: { gap: 10 },
  option: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 14,
    paddingHorizontal: space[4],
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.transparent,
    backgroundColor: palette.card,
  },
  optionSelected: { backgroundColor: palette.secondary, borderColor: palette.primary },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  optionDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  selected: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  focused: { borderColor: palette.foreground },
}));

// Spec 3 S3-02 buD2R, S3-10 OVKkc; #158, #140, #136

import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly spoken?: string;
  readonly disabled?: boolean;
  readonly hint?: string;
}

export function Segmented<T extends string>({ label, options, selected, onSelect }: { label: string; options: readonly SegmentOption<T>[]; selected: T; onSelect: (value: T) => void }) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {options.map((option) => (
        <Segment key={option.value} option={option} selected={selected === option.value} onPress={() => onSelect(option.value)} />
      ))}
    </View>
  );
}

function Segment<T extends string>({ option, selected, onPress }: { option: SegmentOption<T>; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const disabled = option.disabled === true;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.spoken ?? option.label}
      accessibilityHint={option.hint}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.segment, selected && styles.segmentSelected, disabled && styles.disabled, focused && styles.focused]}
    >
      {selected && <Check color={palette.primaryForeground} size={16} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.segmentText, selected && styles.segmentTextSelected]}>
        {option.label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  segmented: { flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: radius.md, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.muted },
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
  segmentText: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  segmentTextSelected: { color: palette.primaryForeground },
  disabled: { opacity: 0.4 },
  focused: { borderColor: palette.ring },
}))

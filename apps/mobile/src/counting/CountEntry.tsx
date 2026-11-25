// Spec 3 S3-04 Y8m0IQ, S3-05 UKfJA, S3-06 C53yTW, Qv1An, S3-07 xjtSW; Malformed input
// #133, #134, #137; docs/decisions/clarify-challenge-vocabulary.md

import { CornerDownLeft, Delete, Info, SkipForward } from 'lucide-react-native';
import type { CountRange } from '@tableside/engine';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { CHANGE_SIGN, COUNT_SKIP, COUNT_SKIP_HINT, countProblemText, DELETE_DIGIT, parseCount, SUBMIT, toggleSign, type CountProblem, type SkipItem } from '@/training/challenge-text';

import { useSkipConfirm } from './SkipConfirm';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function CountEntry({
  label,
  range,
  enabled,
  onSubmit,
  onSkip,
  onRejected,
  next,
  submitLabel = SUBMIT,
  item = 'count',
}: {
  label: string;
  range: CountRange;
  enabled: boolean;
  onSubmit: (value: number) => void;
  onSkip: () => void;
  onRejected: () => void;
  next?: { readonly label: string; readonly enabled: boolean; readonly onPress: () => void };
  submitLabel?: string;
  item?: Exclude<SkipItem, 'card'>;
}) {
  const styles = useStyles();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<CountProblem | null>(null);
  const { focused, focusProps } = useKeyboardFocus();
  const skip = useSkipConfirm(item, enabled, onSkip);
  const edit = (next: string) => {
    setText(next.replace(/-/g, '−'));
    setProblem(null);
  };
  const submit = () => {
    if (!enabled) return;
    const parsed = parseCount(text, range);
    if (parsed.ok) return onSubmit(parsed.value);
    setProblem(parsed.problem);
    onRejected();
  };
  return (
    <View style={styles.entry}>
      {problem && (
        <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.problem}>
          <Info color={palette.foreground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.problemText}>
            {countProblemText(problem, range)}
          </Text>
        </View>
      )}
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel} importantForAccessibility="no">
          {label}
        </Text>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={edit}
          onSubmitEditing={submit}
          editable={enabled}
          showSoftInputOnFocus={false}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          submitBehavior="submit"
          maxLength={6}
          {...focusProps}
          maxFontSizeMultiplier={textScale.display}
          style={styles.fieldValue}
        />
      </View>
      <View style={styles.keypad}>
        {DIGITS.map((digit) => (
          <Key key={digit} label={digit} enabled={enabled} onPress={() => edit(`${text}${digit}`)} />
        ))}
        <Key label="+ / −" accessibilityLabel={CHANGE_SIGN} enabled={enabled} onPress={() => edit(toggleSign(text))} />
        <Key label="0" enabled={enabled} onPress={() => edit(`${text}0`)} />
        <Key label={<Delete color={palette.foreground} size={24} />} accessibilityLabel={DELETE_DIGIT} enabled={enabled} onPress={() => edit(text.slice(0, -1))} />
      </View>
      <View style={styles.actions}>
        <Button label={COUNT_SKIP} hint={COUNT_SKIP_HINT} icon={SkipForward} variant="outline" disabled={!enabled} onPress={skip.ask} />
        <View style={styles.action}>
          {next ? (
            <Button label={next.label} icon={CornerDownLeft} stretch disabled={!next.enabled} onPress={next.onPress} />
          ) : (
            <Button label={submitLabel} icon={CornerDownLeft} stretch disabled={!enabled} onPress={submit} />
          )}
        </View>
      </View>
      {skip.sheet}
    </View>
  );
}

function Key({ label, accessibilityLabel, enabled, onPress }: { label: ReactNode; accessibilityLabel?: string; enabled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.key, pressed && pressStyle.feltShadow, focused && styles.keyFocused]}
    >
      {typeof label === 'string' ? (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.keyText}>
          {label}
        </Text>
      ) : (
        label
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  entry: { gap: space[3] },
  problem: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  problemText: { flex: 1, fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 64,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: palette.primary,
    backgroundColor: palette.card,
  },
  fieldFocused: { borderColor: palette.ring },
  fieldLabel: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  fieldValue: { flex: 1, textAlign: 'right', fontFamily: fonts.uiBold, ...type.figure, color: palette.foreground },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] - 2 },
  key: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  keyFocused: { borderColor: palette.ring, borderWidth: 2 },
  keyText: { fontFamily: fonts.uiSemiBold, ...type.key, color: palette.foreground },
  actions: { flexDirection: 'row', gap: space[3] - 2 },
  action: { flex: 1 },
}));

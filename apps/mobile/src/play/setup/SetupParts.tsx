// The pieces every session setup screen (design frames S1-02, S5-10) is built
// from: the screen header, choice groups, steppers, the min/max limit fields,
// the buy-in or training-bankroll funding, the allowance line and the banners
// that explain what must change before play. Selection is marked by a check as
// well as the outline, and errors by an icon and text as well as colour.

import { CircleAlert, ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { forwardRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type AccessibilityActionEvent } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import type { LimitDraft, LimitEnd, LimitGroup, LimitProblem } from './limit-drafts';

export function SetupHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Home"
        onPress={onBack}
        {...focusProps}
        style={[styles.iconButton, focused && styles.focused]}
      >
        <ChevronLeft color={palette.foreground} size={24} />
      </Pressable>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel}>
      {children}
    </Text>
  );
}

export function Help({ children }: { children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.help}>
      {children}
    </Text>
  );
}

export interface ChoiceOption {
  /** The accessible name. */
  readonly label: string;
  /** The visible text, when shorter than the name. */
  readonly short?: string;
  readonly detail?: string;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly disabledHint?: string;
  readonly onPress: () => void;
}

/** A radio group: a segmented row or chips that wrap, becoming a list when the text is large. */
export function ChoiceGroup({ label, options, stacked = false }: { label: string; options: readonly ChoiceOption[]; stacked?: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={stacked ? styles.stack : styles.choices}>
      {options.map((option) => (
        <Choice key={option.label} option={option} />
      ))}
    </View>
  );
}

function Choice({ option }: { option: ChoiceOption }) {
  const { focused, focusProps } = useKeyboardFocus();
  const disabled = option.disabled ?? false;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityHint={disabled ? option.disabledHint : option.detail}
      accessibilityState={{ checked: option.selected, disabled }}
      disabled={disabled}
      onPress={option.onPress}
      {...focusProps}
      style={[styles.choice, option.detail !== undefined && styles.choiceWithDetail, option.selected && styles.choiceSelected, focused && styles.focused, disabled && styles.disabled]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.choiceText, option.selected && styles.choiceTextSelected]}>
        {option.selected ? '✓ ' : ''}
        {option.short ?? option.label}
      </Text>
      {option.detail !== undefined && <Help>{option.detail}</Help>}
    </Pressable>
  );
}

/**
 * A value stepped between ends: − and + buttons for touch, keyboard and switch
 * control, and an adjustable value screen readers swipe.
 */
export function Stepper({
  label,
  value,
  spoken,
  detail,
  decrementLabel,
  incrementLabel,
  onDecrement,
  onIncrement,
}: {
  label: string;
  value: string;
  /** The value as read aloud, when it differs from the text shown. */
  spoken?: string;
  detail: string;
  decrementLabel: string;
  incrementLabel: string;
  /** Null at the lower end. */
  onDecrement: (() => void) | null;
  /** Null at the upper end. */
  onIncrement: (() => void) | null;
}) {
  const act = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onIncrement?.();
    if (event.nativeEvent.actionName === 'decrement') onDecrement?.();
  };
  return (
    <View style={styles.section}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.stepper}>
        <StepButton label={decrementLabel} onPress={onDecrement} icon={<Minus color={palette.foreground} size={20} />} />
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: spoken ?? value }}
          accessibilityHint={detail}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={act}
          style={styles.stepperValue}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.stepperText}>
            {value}
          </Text>
          <Help>{detail}</Help>
        </View>
        <StepButton label={incrementLabel} onPress={onIncrement} icon={<Plus color={palette.foreground} size={20} />} />
      </View>
    </View>
  );
}

function StepButton({ label, onPress, icon }: { label: string; onPress: (() => void) | null; icon: ReactNode }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: onPress === null }}
      disabled={onPress === null}
      onPress={onPress ?? undefined}
      {...focusProps}
      style={[styles.stepButton, focused && styles.focused, onPress === null && styles.disabled]}
    >
      {icon}
    </Pressable>
  );
}

/** The text input behind an amount field, for moving focus to it. */
export type AmountInput = ComponentRef<typeof TextInput>;

/** A whole-units amount field with its label, inline problem (or help) and "units" suffix. */
export const AmountField = forwardRef<
  AmountInput,
  { label: string; accessibilityLabel: string; value: string; onChange: (text: string) => void; problem?: string | null; help?: string }
>(function AmountField({ label, accessibilityLabel, value, onChange, problem = null, help }, ref) {
  return (
    <View style={styles.amount}>
      <FieldLabel>{label}</FieldLabel>
      <View style={[styles.field, problem !== null && styles.fieldError]}>
        <TextInput
          ref={ref}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={problem ?? undefined}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxFontSizeMultiplier={textScale.body}
          style={styles.input}
        />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.unit}>
          units
        </Text>
      </View>
      {problem !== null ? <InlineProblem alert>{problem}</InlineProblem> : help !== undefined && <Help>{help}</Help>}
    </View>
  );
});

/** A problem in words with an icon, so it isn't marked by colour alone. An alert is announced when it appears. */
export function InlineProblem({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <View style={styles.inlineProblem}>
      <CircleAlert color={palette.destructive} size={16} />
      <Text accessibilityRole={alert ? 'alert' : undefined} maxFontSizeMultiplier={textScale.body} style={styles.error}>
        {children}
      </Text>
    </View>
  );
}

/** Refs to every limit field, so a banner's "Go to" can move focus there. */
export type LimitRefs<K extends string> = Partial<Record<`${K}-${LimitEnd}`, AmountInput | null>>;

/** One group's minimum and maximum, side by side (stacked at large text). */
export function LimitFields<K extends string>({
  group,
  draft,
  problems,
  onChange,
  refs,
  stacked,
  showHelp = true,
}: {
  group: LimitGroup<K>;
  draft: LimitDraft;
  problems: readonly LimitProblem<K>[];
  onChange: (next: LimitDraft) => void;
  refs: LimitRefs<K>;
  stacked: boolean;
  /** False when the section shows the group's help itself. */
  showHelp?: boolean;
}) {
  const problemAt = (end: LimitEnd) => problems.find((p) => p.group === group.key && p.end === end)?.inline ?? null;
  return (
    <View style={styles.section}>
      <View style={[styles.pair, stacked && styles.pairStacked]}>
        {(['min', 'max'] as const).map((end) => (
          <View key={end} style={stacked ? undefined : styles.pairItem}>
            <AmountField
              ref={(input) => {
                refs[`${group.key}-${end}`] = input;
              }}
              label={end === 'min' ? 'Minimum' : 'Maximum'}
              accessibilityLabel={`${group.label} ${end === 'min' ? 'minimum' : 'maximum'}, in units`}
              value={draft[end]}
              onChange={(text) => onChange({ ...draft, [end]: text })}
              problem={problemAt(end)}
            />
          </View>
        ))}
      </View>
      {showHelp && <Help>{group.help}</Help>}
    </View>
  );
}

/** The problems that keep Start disabled, each with a way to reach it. */
export function ProblemBanner({ title, items, testID, children }: { title: string; items: readonly { text: string; action?: { label: string; onPress: () => void } }[]; testID: string; children?: ReactNode }) {
  return (
    <View style={styles.banner} testID={testID}>
      <View style={styles.bannerTitleRow}>
        <CircleAlert color={palette.destructive} size={18} />
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>
          {title}
        </Text>
      </View>
      {items.map((item) => (
        <View key={item.text} style={styles.bannerItem}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
            {item.text}
          </Text>
          {item.action && <LinkButton label={item.action.label} onPress={item.action.onPress} />}
        </View>
      ))}
      {children}
    </View>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} {...focusProps} style={[styles.link, focused && styles.focused]}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.linkText}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Spec 5's allowance line (or the training bankroll that funds the session), with the optional See premium link. */
export function AllowanceCard({ title, text, detail, seePremium }: { title: string; text: string; detail?: string; seePremium: boolean }) {
  const [premiumNote, setPremiumNote] = useState(false);
  return (
    <View style={styles.allowance} testID="allowance-line">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.value}>
        {text}
      </Text>
      {detail !== undefined && <Help>{detail}</Help>}
      {seePremium && <LinkButton label="See premium" onPress={() => setPremiumNote(true)} />}
      {premiumNote && (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.help}>
          Plans arrive in a later update.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginLeft: -space[3] },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  titles: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  section: { gap: space[2] },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.mutedForeground },
  fieldLabel: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.foreground },
  value: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  help: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  stack: { gap: space[2] },
  choice: {
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  choiceWithDetail: { paddingVertical: space[2], gap: 2, justifyContent: 'flex-start' },
  choiceSelected: { borderColor: palette.primary, borderWidth: 2, backgroundColor: palette.secondary },
  choiceText: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  choiceTextSelected: { fontFamily: fonts.uiBold },
  focused: { borderColor: palette.ring, borderWidth: 2 },
  disabled: { opacity: 0.4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stepButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  stepperValue: { flex: 1, alignItems: 'center', gap: 2 },
  stepperText: { fontFamily: fonts.uiBold, fontSize: 20, color: palette.foreground },
  amount: { gap: space[1] },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.card,
  },
  fieldError: { borderColor: palette.destructive, borderWidth: 2 },
  input: { flex: 1, minHeight: MIN_TOUCH_TARGET, fontFamily: fonts.uiMedium, fontSize: 17, color: palette.foreground },
  unit: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  inlineProblem: { flexDirection: 'row', gap: space[1], alignItems: 'flex-start' },
  error: { flex: 1, fontFamily: fonts.uiMedium, fontSize: 13, color: palette.destructive },
  pair: { flexDirection: 'row', gap: space[3] },
  pairStacked: { flexDirection: 'column' },
  pairItem: { flex: 1 },
  banner: { gap: space[2], padding: space[4], borderRadius: radius.lg, borderWidth: 2, borderColor: palette.destructive, backgroundColor: palette.card },
  bannerTitleRow: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
  bannerTitle: { flex: 1, fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  bannerItem: { gap: space[1] },
  bannerText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: radius.sm, borderWidth: 2, borderColor: palette.transparent },
  linkText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.primary, textDecorationLine: 'underline' },
  allowance: { gap: space[1], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
});

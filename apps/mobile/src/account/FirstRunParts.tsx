// TODO(spec 2 S2-14–S2-16)

import { Check, ChevronLeft, CircleAlert, ExternalLink, type LucideProps } from 'lucide-react-native';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import { WEB_PAGES } from './web-pages';

type Glyph = (props: LucideProps) => ReactNode;

export function FirstRunScreen({
  title,
  intro,
  back,
  bar,
  above,
  lead,
  children,
}: {
  title: string;
  above?: ReactNode;
  intro?: ReactNode;
  back?: () => void;
  bar?: { readonly title: string; readonly detail?: string };
  lead?: ReactNode;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID="first-run-scroll"
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[8], paddingLeft: insets.left + space[6], paddingRight: insets.right + space[6] },
      ]}
    >
      {(back || bar) && (
        <View style={styles.bar}>
          {back && <BackButton onPress={back} />}
          {bar && (
            <View style={styles.barTitles}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.barTitle}>
                {bar.title}
              </Text>
              {bar.detail && (
                <Text maxFontSizeMultiplier={textScale.body} style={styles.barDetail}>
                  {bar.detail}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
      {lead}
      {above}
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
        {title}
      </Text>
      {intro !== undefined && <Body>{intro}</Body>}
      {children}
    </ScrollView>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} {...focusProps} style={[styles.back, focused && styles.focused]}>
      <ChevronLeft color={palette.foreground} size={24} />
    </Pressable>
  );
}

export function Body({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
      {children}
    </Text>
  );
}

export function Status({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={textScale.body} style={styles.body}>
      {children}
    </Text>
  );
}

export const Field = forwardRef<ComponentRef<typeof TextInput>, { label: string; problem?: boolean } & Omit<TextInputProps, 'accessibilityLabel' | 'style'>>(
  function Field({ label, problem = false, ...input }, ref) {
  const styles = useStyles();
    const { focused, focusProps } = useKeyboardFocus(input);
    return (
      <View style={styles.fieldBlock}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.fieldLabel} importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={palette.mutedForeground}
          maxFontSizeMultiplier={textScale.body}
          {...input}
          {...focusProps}
          style={[styles.field, problem && styles.fieldProblem, focused && styles.focused]}
        />
      </View>
    );
  },
);

export function enteredCode(text: string): string | null {
  const code = text.replace(/\s/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

export function CodeField({
  label = 'Code',
  value,
  onChangeText,
  problem = false,
  onSubmit,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  problem?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChangeText}
      problem={problem}
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      maxLength={6}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
    />
  );
}

export function InlineMessage({ children, testID }: { children: ReactNode; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.message} testID={testID}>
      <CircleAlert color={palette.destructive} size={16} />
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" maxFontSizeMultiplier={textScale.body} style={styles.messageText}>
        {children}
      </Text>
    </View>
  );
}

export function ChoiceRow({
  label,
  detail,
  spokenDetail = detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  spokenDetail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={spokenDetail ? `${label}. ${spokenDetail}` : label}
      onPress={onPress}
      {...focusProps}
      style={[styles.choice, selected && styles.choiceSelected, focused && styles.focused]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={styles.choiceText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.choiceLabel}>
          {label}
        </Text>
        {detail && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.choiceDetail}>
            {detail}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function ChoiceGroup({ label, testID, children }: { label: string; testID?: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID} style={styles.choices}>
      {children}
    </View>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={styles.actions}>{children}</View>;
}

// Spec 2 Amendment 9 §1
export function SupportLinks() {
  const styles = useStyles();
  return (
    <View style={styles.supportLinks}>
      <View style={styles.supportRow}>
        <WebLink label="Contact support" url={WEB_PAGES.contactSupport} />
        <WebLink label="Make a privacy request" url={WEB_PAGES.privacyRequest} />
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.supportNote}>
        These open tableside.app and work without signing in.
      </Text>
    </View>
  );
}

// Spec 2 S2-13
export function MethodButton({
  label,
  icon: Icon,
  onPress,
  variant = 'secondary',
  disabled = false,
}: {
  label: string;
  icon?: Glyph;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  const color = variant === 'primary' ? palette.primaryForeground : palette.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [
        styles.method,
        variant === 'primary' && styles.methodPrimary,
        variant === 'ghost' && styles.methodGhost,
        pressed && (variant === 'primary' ? pressStyle.brass : variant === 'ghost' ? pressStyle.edgeless : pressStyle.feltShadow),
        disabled && styles.disabled,
        focused && styles.focused,
      ]}
    >
      {Icon && <Icon color={color} size={20} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.methodLabel, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Footnote({ icon: Icon, children }: { icon?: Glyph; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.footnote}>
      {Icon && <Icon color={palette.mutedForeground} size={16} />}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.footnoteText}>
        {children}
      </Text>
    </View>
  );
}

function WebLink({ label, url }: { label: string; url: string }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      {...focusProps}
      style={[styles.link, styles.webLink, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.webLinkText}>
        {label}
      </Text>
      <ExternalLink color={palette.primary} size={14} />
    </Pressable>
  );
}

// Spec 2 S2-13
export function IntentSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { readonly value: T; readonly label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.3;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} testID="intent-switch" style={[styles.switch, stacked && styles.switchStacked]}>
      {options.map((option) => (
        <IntentSegment key={option.value} label={option.label} selected={option.value === value} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

function IntentSegment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.segment, selected && styles.segmentSelected, focused && styles.focused]}
    >
      {selected && <Check color={palette.primaryForeground} size={16} />}
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} {...focusProps} style={[styles.link, focused && styles.focused]}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.linkText}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, gap: space[4] },
  back: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, marginLeft: -space[3], alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: palette.transparent },
  title: { fontFamily: fonts.display, ...type.display, color: palette.foreground },
  body: { fontFamily: fonts.ui, ...type.body, color: palette.mutedForeground },
  fieldBlock: { gap: space[2] },
  fieldLabel: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  field: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.controlBorder,
    backgroundColor: palette.background,
    fontFamily: fonts.ui,
    ...type.body,
    color: palette.foreground,
  },
  fieldProblem: { borderColor: palette.destructive },
  focused: { borderColor: palette.ring },
  message: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  messageText: { flex: 1, fontFamily: fonts.ui, ...type.body, color: palette.destructive },
  choices: { gap: space[2] },
  choice: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  choiceSelected: { borderColor: palette.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: palette.controlBorder, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: palette.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  choiceDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  actions: { gap: space[3], marginTop: space[2] },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: radius.sm, borderWidth: 2, borderColor: palette.transparent, paddingHorizontal: space[1] },
  linkText: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.primary },
  supportLinks: { gap: space[1], paddingTop: space[2] },
  supportRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4] + space[1], rowGap: space[1] },
  webLink: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  webLinkText: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.primary },
  supportNote: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  barTitles: { flex: 1, gap: 1 },
  barTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  barDetail: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  method: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: 20,
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  methodPrimary: { backgroundColor: palette.primary, borderColor: palette.primary },
  methodGhost: { backgroundColor: palette.transparent, borderColor: palette.transparent },
  methodLabel: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, textAlign: 'center' },
  disabled: { opacity: 0.4 },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  footnoteText: { flex: 1, fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  switch: { flexDirection: 'row', gap: space[1], padding: space[1], borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.muted },
  switchStacked: { flexDirection: 'column' },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: space[2],
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  segmentSelected: { backgroundColor: palette.primary },
  segmentLabel: { flexShrink: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground, textAlign: 'center' },
  segmentLabelSelected: { color: palette.primaryForeground },
}));

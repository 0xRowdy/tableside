// Building blocks of the first-run screens (welcome, age, sign-in method,
// email, code, offline game): a full-screen layout with no tab bar, a labeled
// field, choice rows, sign-in method buttons, the welcome's intent switch and
// inline messages. The method buttons, intent switch, header bar and
// footnote follow S2-13's frames (#89); the rest is #88's.
// TODO(frames): FirstRunScreen, Field, ChoiceRow and InlineMessage unverified against S2-14–S2-16 (#88).

import { Check, ChevronLeft, CircleAlert, ExternalLink, type LucideProps } from 'lucide-react-native';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { WEB_PAGES } from './web-pages';

/** An icon: a lucide icon, or a glyph drawn with the same props. */
type Glyph = (props: LucideProps) => ReactNode;

/**
 * A pre-account screen: a title, optional Back (with the header bar's title
 * and step beside it), and content that reflows and scrolls at any text size.
 */
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
  /** Shown above the title, such as the welcome's hero image. */
  above?: ReactNode;
  intro?: ReactNode;
  back?: () => void;
  /** The header bar beside Back: where the player is, such as "Create your account" and "Step 2 of 2". */
  bar?: { readonly title: string; readonly detail?: string };
  /** Drawn above the title, such as a locked state's icon. */
  lead?: ReactNode;
  children?: ReactNode;
}) {
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
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} {...focusProps} style={[styles.back, focused && styles.focused]}>
      <ChevronLeft color={palette.foreground} size={24} />
    </Pressable>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
      {children}
    </Text>
  );
}

/** A status line that screen readers announce when it appears. */
export function Status({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={textScale.body} style={styles.body}>
      {children}
    </Text>
  );
}

/** A labeled text field. Its label is its accessible name. */
export const Field = forwardRef<ComponentRef<typeof TextInput>, { label: string; problem?: boolean } & Omit<TextInputProps, 'accessibilityLabel' | 'style'>>(
  function Field({ label, problem = false, ...input }, ref) {
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

/** The 6-digit code typed from an email, without spaces; null when it isn't one. */
export function enteredCode(text: string): string | null {
  const code = text.replace(/\s/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

/** A field for a 6-digit emailed code, offering the one the system read from the email. */
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

/** A problem or notice in words with an icon, so it isn't marked by color alone. Announced when it appears. */
export function InlineMessage({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View style={styles.message} testID={testID}>
      <CircleAlert color={palette.destructive} size={16} />
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" maxFontSizeMultiplier={textScale.body} style={styles.messageText}>
        {children}
      </Text>
    </View>
  );
}

/** One choice of a single-choice group (a radio button). */
export function ChoiceRow({
  label,
  detail,
  spokenDetail = detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  /** The detail as a screen reader should speak it. */
  spokenDetail?: string;
  selected: boolean;
  onPress: () => void;
}) {
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

/** A group of ChoiceRows, announced as a radio group with its question. */
export function ChoiceGroup({ label, testID, children }: { label: string; testID?: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} testID={testID} style={styles.choices}>
      {children}
    </View>
  );
}

/** Actions, stacked at the bottom of the content. */
export function Actions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

/**
 * Contact support and Make a privacy request, on every locked and restricted
 * screen (spec 2 Amendment 9 §1): the tab bar is hidden there, so More isn't
 * reachable. Both open web pages that work without signing in.
 */
export function SupportLinks() {
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

/**
 * A sign-in method or path (S2-13): an icon and label on a full-width
 * button. Secondary for each method, primary for Continue, ghost (no fill)
 * for a way back.
 */
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
        pressed && styles.pressed,
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

/** Small print under a screen's actions. */
export function Footnote({ icon: Icon, children }: { icon?: Glyph; children: ReactNode }) {
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

/**
 * The welcome's two-part switch (S2-13): one choice of two, as a radio group.
 * At large text sizes it becomes a list of choices, one per row.
 */
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

/** A text link-style button (for a secondary path such as "Create an account"). */
export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} {...focusProps} style={[styles.link, focused && styles.focused]}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.linkText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, gap: space[4] },
  back: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, marginLeft: -space[3], alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: palette.transparent },
  title: { fontFamily: fonts.display, fontSize: 30, color: palette.foreground },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24, color: palette.mutedForeground },
  fieldBlock: { gap: space[2] },
  fieldLabel: { fontFamily: fonts.uiMedium, fontSize: 14, color: palette.foreground },
  field: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.controlBorder,
    backgroundColor: palette.background,
    fontFamily: fonts.ui,
    fontSize: 16,
    color: palette.foreground,
  },
  fieldProblem: { borderColor: palette.destructive },
  focused: { borderColor: palette.ring },
  message: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  messageText: { flex: 1, fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.destructive },
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
  choiceLabel: { fontFamily: fonts.uiMedium, fontSize: 16, color: palette.foreground },
  choiceDetail: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  actions: { gap: space[3], marginTop: space[2] },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: radius.sm, borderWidth: 2, borderColor: palette.transparent, paddingHorizontal: space[1] },
  linkText: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.primary },
  supportLinks: { gap: space[1], paddingTop: space[2] },
  supportRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4] + space[1], rowGap: space[1] },
  webLink: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  webLinkText: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 14, color: palette.primary },
  supportNote: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 17, color: palette.mutedForeground },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  barTitles: { flex: 1, gap: 1 },
  barTitle: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  barDetail: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
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
  methodLabel: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 15, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  footnoteText: { flex: 1, fontFamily: fonts.ui, fontSize: 12.5, lineHeight: 18, color: palette.mutedForeground },
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
  segmentLabel: { flexShrink: 1, fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground, textAlign: 'center' },
  segmentLabelSelected: { color: palette.primaryForeground },
});

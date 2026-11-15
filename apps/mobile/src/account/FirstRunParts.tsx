// Building blocks of the first-run screens (welcome, age, email, code, offline
// game): a full-screen layout with no tab bar, a labeled field, choice rows
// and inline messages. Built from spec 2's copy and the app's tokens.
// TODO(frames): unverified against S2-13–S2-16 (Pencil couldn't open Tableside.pen for #88).

import { ChevronLeft, CircleAlert } from 'lucide-react-native';
import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

/**
 * A pre-account (or locked) screen: an optional header line with a step, a
 * title, optional Back, and content that reflows and scrolls at any text size.
 */
export function FirstRunScreen({
  title,
  intro,
  back,
  context,
  children,
}: {
  title: string;
  intro?: ReactNode;
  back?: () => void;
  /** The screen's header line, as the frames draw it above the title ("Before you start · Step 1 of 2 · age"). */
  context?: { readonly title: string; readonly detail?: string };
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
      {(back || context) && (
        <View style={styles.headerLine}>
          {back && <BackButton onPress={back} />}
          {context && (
            <View style={styles.context}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.contextTitle}>
                {context.title}
              </Text>
              {context.detail && (
                <Text maxFontSizeMultiplier={textScale.body} style={styles.contextDetail}>
                  {context.detail}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
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

/** A small capitalized label above a group ("YOU CAN STILL"). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>
      {children.toUpperCase()}
    </Text>
  );
}

/** Actions, stacked at the bottom of the content. */
export function Actions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
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
  headerLine: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  context: { flex: 1, gap: 1 },
  contextTitle: { fontFamily: fonts.uiMedium, fontSize: 17, color: palette.foreground },
  contextDetail: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  sectionLabel: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.mutedForeground, marginTop: space[2] },
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
});

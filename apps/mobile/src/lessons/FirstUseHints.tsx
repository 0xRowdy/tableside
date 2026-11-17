// Spec 3 Lessons › Structure (First-use hints), Information hiding (hint content); S1-04 XjwQc; #146
import { HINTS, type HintId } from '@tableside/definitions';
import { CircleHelp } from 'lucide-react-native';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { gotItLabel, HELP_HINT, HELP_LABEL, hintKicker, GOT_IT, REREAD_FROM_HELP } from '@/training/lesson-text';
import type { TrainingService } from '@/training/service';
import { useLearningOf } from '@/training/TrainingProvider';

interface ScreenHintState {
  readonly any: boolean;
  shows(id: HintId): boolean;
  dismiss(id: HintId): void;
  reopen(): void;
}

const ScreenHintContext = createContext<ScreenHintState | null>(null);

export function ScreenHints({ service, ids, children }: { service: TrainingService; ids: readonly HintId[]; children: ReactNode }) {
  const learning = useLearningOf(service);
  const [reopened, setReopened] = useState<ReadonlySet<HintId>>(new Set());
  const [closed, setClosed] = useState<ReadonlySet<HintId>>(new Set());
  const state: ScreenHintState = {
    any: ids.length > 0,
    shows: (id) => ids.includes(id) && (reopened.has(id) || (learning !== undefined && learning.unseenHints.includes(id) && !closed.has(id))),
    dismiss: (id) => {
      setReopened((open) => new Set([...open].filter((other) => other !== id)));
      setClosed((done) => new Set([...done, id]));
      void service.hintSeen(id);
    },
    reopen: () => {
      setReopened(new Set(ids));
      setClosed(new Set());
    },
  };
  return <ScreenHintContext.Provider value={state}>{children}</ScreenHintContext.Provider>;
}

export function FirstUseHint({ id }: { id: HintId }) {
  const hints = useContext(ScreenHintContext);
  const { focused, focusProps } = useKeyboardFocus();
  if (!hints?.shows(id)) return null;
  const hint = HINTS[id];
  return (
    <View style={styles.hint} testID={`first-use-hint-${id}`}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {hintKicker(hint.name)}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
        {hint.text}
      </Text>
      <View style={styles.footer}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.reread}>
          {REREAD_FROM_HELP}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={gotItLabel(hint.name)}
          onPress={() => hints.dismiss(id)}
          {...focusProps}
          style={({ pressed }) => [styles.gotIt, pressed && styles.pressed, focused && styles.focused]}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.gotItText}>
            {GOT_IT}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function HelpButton() {
  const hints = useContext(ScreenHintContext);
  const { focused, focusProps } = useKeyboardFocus();
  if (!hints?.any) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={HELP_LABEL}
      accessibilityHint={HELP_HINT}
      onPress={hints.reopen}
      {...focusProps}
      style={({ pressed }) => [styles.help, pressed && styles.pressed, focused && styles.focused]}
    >
      <CircleHelp color={palette.foreground} size={22} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.helpText}>
        {HELP_LABEL}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { gap: 6, paddingVertical: space[3], paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.popover },
  kicker: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 1, color: palette.primary },
  text: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.foreground },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  reread: { flexShrink: 1, fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  gotIt: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  gotItText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  help: { minWidth: 56, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: space[1], borderRadius: 10, borderWidth: 2, borderColor: palette.transparent },
  helpText: { fontFamily: fonts.uiBold, fontSize: 11, color: palette.foreground },
  pressed: { opacity: 0.8 },
  focused: { borderColor: palette.ring },
});

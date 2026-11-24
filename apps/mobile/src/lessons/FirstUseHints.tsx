// Spec 3 Lessons › Structure (First-use hints), Information hiding; S1-04 XjwQc, qylNY; #146
import { HINTS, type HintId } from '@tableside/definitions';
import type { GameId } from '@tableside/engine';
import { CircleHelp } from 'lucide-react-native';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { gotItLabel, HELP_HINT, HELP_LABEL, hintKicker, GOT_IT, REREAD_FROM_HELP } from '@/training/lesson-text';
import type { TrainingService } from '@/training/service';
import { useLearningOf } from '@/training/TrainingProvider';

import { TableHelpSheet } from './HelpSheet';

interface ScreenHintState {
  readonly service: TrainingService;
  readonly ids: readonly HintId[];
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
    service,
    ids,
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
  const styles = useStyles();
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

// docs/decisions/lessons-entry-points.md; #135
export function useScreenHints(): { readonly ids: readonly HintId[]; readonly reopen: () => void } {
  const hints = useContext(ScreenHintContext);
  return { ids: hints?.ids ?? [], reopen: () => hints?.reopen() };
}

// Spec 1 S1-04 qylNY; docs/decisions/lessons-entry-points.md
export function HelpButton({ game }: { game: GameId }) {
  const styles = useStyles();
  const hints = useContext(ScreenHintContext);
  const [open, setOpen] = useState(false);
  const { focused, focusProps } = useKeyboardFocus();
  if (!hints) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={HELP_LABEL}
        accessibilityHint={HELP_HINT}
        onPress={() => setOpen(true)}
        {...focusProps}
        style={({ pressed }) => [styles.help, pressed && styles.pressed, focused && styles.focused]}
      >
        <CircleHelp color={palette.foreground} size={22} />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.helpText}>
          {HELP_LABEL}
        </Text>
      </Pressable>
      {open && <TableHelpSheet game={game} service={hints.service} hints={hints.ids} onShowHints={hints.reopen} onClose={() => setOpen(false)} />}
    </>
  );
}

const useStyles = makeStyles((type) => ({
  hint: { gap: 6, paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.popover },
  kicker: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.primary },
  text: { fontFamily: fonts.ui, ...type.secondary, color: palette.foreground },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  reread: { flexShrink: 1, fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  gotIt: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  gotItText: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  help: { minWidth: 56, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: space[1], borderRadius: 10, borderWidth: 2, borderColor: palette.transparent },
  helpText: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  pressed: { opacity: 0.8 },
  focused: { borderColor: palette.ring },
}));

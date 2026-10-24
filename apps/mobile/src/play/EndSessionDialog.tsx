// The End session confirmation (design frame S1-09 "End session — confirm"):
// the three ending steps, shown before anything is returned or settled. Its
// switch variant (S1-09 egZUB) asks before another game's setup opens: the
// current session ends first, its result is saved, then that setup opens.

import type { GameId, PermittedView, Wager } from '@tableside/engine';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { GAME_WORDS } from './game-words';
import { formatUnits } from './units';

/**
 * What ending would do with each wager. Roulette: every wager comes back
 * between spins. Craps: contracts on their number stay and roll on to settle.
 * Blackjack: the initial wager comes back between rounds; a dealt round settles.
 */
function endingWagers(view: PermittedView): { removable: readonly Wager[]; committed: readonly Wager[] } {
  if (view.wagersCommitted) return { removable: [], committed: view.wagers };
  if (view.game !== 'craps') return { removable: view.wagers, committed: [] };
  const contract = (wager: Wager) => view.table.wagers.find((item) => item.target === wager.target)?.removable === false;
  return { removable: view.wagers.filter((w) => !contract(w)), committed: view.wagers.filter(contract) };
}

export function EndSessionDialog({
  visible,
  view,
  onCancel,
  onConfirm,
  cancelLabel = 'Keep playing',
  switchTo,
}: {
  visible: boolean;
  view: PermittedView;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  /** The game whose setup opens once this session has ended. */
  switchTo?: GameId;
}) {
  // Game ids are the lower-case game names used in sentences.
  const from = view.game;
  const to = switchTo;
  const words = GAME_WORDS[view.game];
  const { removable, committed } = endingWagers(view);
  const list = (wagers: readonly Wager[], none: string) =>
    wagers.length === 0 ? none : wagers.map((w) => `${words.wagerName(w.target)} ${formatUnits(w.amount)}`).join(' · ');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.scrim}>
        <ScrollView contentContainerStyle={styles.dialogScroll}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.dialogTitle}>
              {to ? `Switch to ${to}?` : 'End this session?'}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogText}>
              {to
                ? `Starting ${to} ends this ${from} session first. Resetting the table does the same.`
                : "Ending works in three steps, and it can't be undone once settlement starts."}
            </Text>
            {[
              {
                title: 'Removable wagers come back',
                detail: list(removable, 'Nothing on the table'),
              },
              {
                title: 'Committed wagers settle automatically',
                detail: list(committed, words.noneCommitted),
              },
              to
                ? { title: `Your ${from} result is saved, then ${to} setup opens`, detail: 'Results and departures in Saved › Practice' }
                : { title: 'You see the session result', detail: 'Buy-in, rebuys, final cash-out, net result and maximum drawdown' },
            ].map((step, index) => (
              <View key={step.title} accessible accessibilityLabel={`${index + 1}. ${step.title}. ${step.detail}`} style={styles.dialogStep}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogStepTitle}>{index + 1}  {step.title}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogText}>{step.detail}</Text>
              </View>
            ))}
            <Button label={to ? `End ${from} session and switch` : 'End session'} stretch onPress={onConfirm} />
            <Button label={cancelLabel} variant="secondary" stretch onPress={onCancel} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: palette.scrim },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: space[4] },
  dialog: { gap: space[3], padding: space[6], borderRadius: radius.lg, backgroundColor: palette.popover },
  dialogTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  dialogText: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  dialogStep: { gap: 2 },
  dialogStepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
});

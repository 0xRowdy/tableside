// The End session confirmation (design frame S1-09 "End session — confirm"):
// the three ending steps, shown before anything is returned or settled.

import type { PermittedView } from '@tableside/engine';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { formatUnits, targetName } from './roulette-text';

/** A wager's name in the game's own words. */
const wagerName = (view: PermittedView, target: string) => (view.game === 'blackjack' ? 'Initial wager' : targetName(target));

export function EndSessionDialog({
  visible,
  view,
  onCancel,
  onConfirm,
  cancelLabel = 'Keep playing',
}: {
  visible: boolean;
  view: PermittedView;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
}) {
  const removable = view.wagersCommitted ? [] : view.wagers;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.scrim}>
        <ScrollView contentContainerStyle={styles.dialogScroll}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.dialogTitle}>
              End this session?
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogText}>
              Ending works in three steps, and it can&apos;t be undone once settlement starts.
            </Text>
            {[
              {
                title: 'Removable wagers come back',
                detail: removable.length === 0 ? 'Nothing on the table' : removable.map((w) => `${wagerName(view, w.target)} ${formatUnits(w.amount)}`).join(' · '),
              },
              {
                title: 'Committed wagers settle automatically',
                detail: view.wagersCommitted ? 'They settle on their own' : `None between ${view.game === 'blackjack' ? 'rounds' : 'spins'}`,
              },
              { title: 'You see the session result', detail: 'Buy-in, rebuys, final cash-out, net result and maximum drawdown' },
            ].map((step, index) => (
              <View key={step.title} accessible accessibilityLabel={`${index + 1}. ${step.title}. ${step.detail}`} style={styles.dialogStep}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogStepTitle}>{index + 1}  {step.title}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogText}>{step.detail}</Text>
              </View>
            ))}
            <Button label="End session" stretch onPress={onConfirm} />
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

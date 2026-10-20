// Guided practice on any table (design frames S1-05 Correction pause, S1-07
// Cycle, S1-09 Stop strategy): the strategy strip with adherence kept apart
// from winnings, the correction pause before a departing move, the cycle
// result and the Stop strategy confirmation. Every coaching line comes from
// the engine's explanation facts (coaching-text.ts). Game-agnostic: a table
// passes what it shows of itself ("the table right now"), including cards for
// blackjack, so the full-screen correction can restate it.

import type { PendingCorrection, StrategyView } from '@tableside/engine';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import {
  adherenceText,
  correctionLines,
  CYCLE_END_TEXT,
  overrideNote,
  parametersText,
  pendingLine,
  prescriptionLine,
  retryLabel,
} from './coaching-text';

/** What the table shows right now, restated as text by the full-screen correction. */
export interface TableNow {
  readonly phase: string;
  readonly balance: string;
  /** Outstanding wagers, in words. */
  readonly wagers: string;
  /** Exposed cards, for card games (blackjack). */
  readonly cards?: readonly string[];
}

/** The strategy, its choices and adherence; separate from the session balance. */
export function GuidedStrip({ strategy, canStop, onStop }: { strategy: StrategyView; canStop: boolean; onStop: () => void }) {
  const pending = pendingLine(strategy);
  const status = strategy.status === 'stopped' ? 'Strategy stopped · playing on your own' : `Guided · ${strategy.name} · ${parametersText(strategy)}`;
  return (
    <View style={styles.strip} testID="guided-strip">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.stripTitle}>{status}</Text>
      <View
        accessible
        accessibilityLabel={`Strategy adherence: ${adherenceText(strategy.adherence)}. Departures ${strategy.adherence.departures}.`}
        style={styles.adherence}
      >
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripLabel}>ADHERENCE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripText}>
          {adherenceText(strategy.adherence)} · Departures {strategy.adherence.departures}
        </Text>
      </View>
      {pending && (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.stripText}>
          {pending}
        </Text>
      )}
      {strategy.status !== 'stopped' && (
        <Button label="Stop strategy" variant="secondary" hint="Asks first. Your practice session stays open." disabled={!canStop} onPress={onStop} />
      )}
    </View>
  );
}

function CorrectionBody({
  strategyName,
  correction,
  overrideEndsCycle,
  busy,
  onRetry,
  onOverride,
}: {
  strategyName: string;
  correction: PendingCorrection;
  overrideEndsCycle: boolean;
  busy: boolean;
  onRetry: () => void;
  onOverride: () => void;
}) {
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.coach}>Marcus · guided practice, {strategyName}</Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.kicker}>
        Before your spin
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>{prescriptionLine(strategyName, correction.explanation)}</Text>
      {correctionLines(correction).map((line) => (
        <Text key={line} maxFontSizeMultiplier={textScale.body} style={styles.body}>{line}</Text>
      ))}
      <Button label={retryLabel(correction)} stretch disabled={busy} onPress={onRetry} />
      <Button label="Keep my bets" variant="secondary" stretch disabled={busy} onPress={onOverride} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>{overrideNote(overrideEndsCycle)}</Text>
    </>
  );
}

/**
 * The correction pause, before the move executes. At the largest text sizes it
 * opens as a full-screen panel that restates the table as text first.
 */
export function CorrectionPanel(props: {
  strategyName: string;
  correction: PendingCorrection;
  overrideEndsCycle: boolean;
  table: TableNow;
  fullScreen: boolean;
  busy: boolean;
  onRetry: () => void;
  onOverride: () => void;
}) {
  const { table, fullScreen } = props;
  if (!fullScreen) {
    return (
      <View style={styles.panel} testID="correction-panel">
        <CorrectionBody {...props} />
      </View>
    );
  }
  return (
    <Modal visible animationType="none" onRequestClose={() => undefined} supportedOrientations={['portrait', 'landscape']}>
      <ScrollView style={styles.fullScreen} contentContainerStyle={styles.fullScreenContent} testID="correction-panel">
        <View accessibilityViewIsModal style={styles.fullScreenInner}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.kicker}>
            The table right now
          </Text>
          {[`Phase: ${table.phase}`, ...(table.cards ?? []), `Balance: ${table.balance}`, `On the table: ${table.wagers}`].map((line) => (
            <Text key={line} maxFontSizeMultiplier={textScale.body} style={styles.body}>{line}</Text>
          ))}
          <View style={styles.divider} />
          <CorrectionBody {...props} />
        </View>
      </ScrollView>
    </Modal>
  );
}

/** A strategy cycle ended: restart explicitly, or stop the strategy. */
export function CycleEndPanel({
  strategy,
  busy,
  onRestart,
  onStopStrategy,
}: {
  strategy: StrategyView;
  busy: boolean;
  onRestart: () => void;
  onStopStrategy: () => void;
}) {
  return (
    <View style={styles.panel} testID="cycle-panel">
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.headline}>
        Strategy cycle ended
      </Text>
      {strategy.cycleEnd && <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{CYCLE_END_TEXT[strategy.cycleEnd]}</Text>}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>Restarting uses your remaining balance. It never adds chips.</Text>
      <Button label="Restart the strategy" stretch disabled={busy} onPress={onRestart} />
      <Button label="Stop strategy" variant="secondary" stretch disabled={busy} onPress={onStopStrategy} />
    </View>
  );
}

/** Stop strategy, confirmed in three steps. It doesn't end the practice session. */
export function StopStrategyDialog({
  visible,
  removable,
  committed,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  removable: string;
  committed: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const steps = [
    { title: 'No new strategy bets', detail: 'Nothing more is placed for you' },
    { title: 'Removable wagers come back', detail: removable },
    { title: 'Committed wagers settle automatically', detail: `${committed} Then you play on your own or end the session.` },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.scrim}>
        <ScrollView contentContainerStyle={styles.dialogScroll}>
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.headline}>
              Stop the strategy?
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
              Your session stays open. Stopping only ends the strategy&apos;s bets, in three steps.
            </Text>
            {steps.map((step, index) => (
              <View key={step.title} accessible accessibilityLabel={`${index + 1}. ${step.title}. ${step.detail}`} style={styles.step}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.stepTitle}>{index + 1}  {step.title}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{step.detail}</Text>
              </View>
            ))}
            <Button label="Stop strategy" stretch onPress={onConfirm} />
            <Button label="Keep the strategy" variant="secondary" stretch onPress={onCancel} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space[2], marginHorizontal: space[4], marginTop: space[2], padding: space[3], borderRadius: radius.lg, backgroundColor: palette.card },
  stripTitle: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.foreground },
  stripLabel: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.5, color: palette.mutedForeground },
  stripText: { fontFamily: fonts.ui, fontSize: 13, color: palette.foreground },
  adherence: { gap: 1 },
  panel: { gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.popover, borderWidth: 1, borderColor: palette.primary },
  coach: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.mutedForeground },
  kicker: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.primary },
  headline: { fontFamily: fonts.display, fontSize: 22, color: palette.foreground },
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.foreground },
  note: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  fullScreen: { flex: 1, backgroundColor: palette.background },
  fullScreenContent: { flexGrow: 1, padding: space[4] },
  fullScreenInner: { gap: space[3] },
  divider: { height: 1, backgroundColor: palette.border },
  scrim: { flex: 1, backgroundColor: palette.scrim },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: space[4] },
  dialog: { gap: space[3], padding: space[6], borderRadius: radius.lg, backgroundColor: palette.popover },
  step: { gap: 2 },
  stepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
});

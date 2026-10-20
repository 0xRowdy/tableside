// Guided practice on any table (design frames S1-05 Correction pause, S1-07
// Cycle, S1-09 Stop strategy): the strategy strip with adherence kept apart
// from winnings, the correction pause before a departing move, the cycle
// result and the Stop strategy confirmation. Every coaching line comes from
// the engine's explanation facts (coaching-text.ts). Game-agnostic: a table
// passes what it shows of itself ("the table right now"), including cards for
// blackjack, so the full-screen correction can restate it.

import type { StrategyView } from '@tableside/engine';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { adherenceText, CYCLE_END_TEXT, parametersText, pendingLine, type CorrectionCopy, type DecisionUnit } from './coaching-text';

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
export function GuidedStrip({
  strategy,
  canStop,
  onStop,
  detail = parametersText(strategy),
  unit = 'spin',
}: {
  strategy: StrategyView;
  canStop: boolean;
  onStop: () => void;
  /** What the strategy is set to: its chosen targets, or a blackjack table's rules. */
  detail?: string;
  unit?: DecisionUnit;
}) {
  const pending = pendingLine(strategy);
  const status = strategy.status === 'stopped' ? 'Strategy stopped · playing on your own' : `Guided · ${strategy.name}${detail ? ` · ${detail}` : ''}`;
  return (
    <View style={styles.strip} testID="guided-strip">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.stripTitle}>{status}</Text>
      <View
        accessible
        accessibilityLabel={`Strategy adherence: ${adherenceText(strategy.adherence, unit)}. Departures ${strategy.adherence.departures}.`}
        style={styles.adherence}
      >
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripLabel}>ADHERENCE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripText}>
          {adherenceText(strategy.adherence, unit)} · Departures {strategy.adherence.departures}
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

function CorrectionBody({ copy, busy, onRetry, onOverride }: { copy: CorrectionCopy; busy: boolean; onRetry: () => void; onOverride: () => void }) {
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.coach}>{copy.coach}</Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.kicker}>
        {copy.kicker}
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>{copy.headline}</Text>
      {copy.lines.map((line) => (
        <Text key={line} maxFontSizeMultiplier={textScale.body} style={styles.body}>{line}</Text>
      ))}
      {copy.fallback && (
        <View style={styles.fallback}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{copy.fallback}</Text>
        </View>
      )}
      <Button label={copy.retry} stretch disabled={busy} onPress={onRetry} />
      <Button label={copy.override} variant="secondary" stretch disabled={busy} onPress={onOverride} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>{copy.note}</Text>
      {copy.why.length > 0 && (
        <View style={styles.why} testID="index-difference">
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.whyTitle}>
            Why Tableside&apos;s index can differ from published charts
          </Text>
          {copy.why.map((line) => (
            <Text key={line} maxFontSizeMultiplier={textScale.body} style={styles.note}>{line}</Text>
          ))}
        </View>
      )}
    </>
  );
}

/**
 * The correction pause, before the move executes. At the largest text sizes it
 * opens as a full-screen panel that restates the table as text first.
 */
export function CorrectionPanel(props: {
  copy: CorrectionCopy;
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
  fallback: { padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  why: { gap: space[1], paddingTop: space[2], borderTopWidth: 1, borderTopColor: palette.border },
  whyTitle: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.foreground },
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

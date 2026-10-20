// Guided practice on any table (design frames S1-05 Correction pause, S1-07
// Cycle, S1-09 Stop strategy): the strategy strip with adherence kept apart
// from winnings, the correction pause before a departing move, the cycle
// result and the Stop strategy confirmation. Every coaching line comes from
// the engine's explanation facts (coaching-text.ts). Game-agnostic: a table
// passes what it shows of itself ("the table right now"), including cards for
// blackjack, so the full-screen correction can restate it.

import type { CycleTurn, PendingCorrection, PendingStrategyAction, StrategyView } from '@tableside/engine';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import {
  adherenceText,
  correctionLines,
  CYCLE_HEADLINE,
  cycleBadge,
  cycleEndText,
  overrideNote,
  parametersText,
  pendingBlocked,
  pendingOverrideNote,
  pendingPaidNote,
  pendingWaiting,
  prescriptionLine,
  retryLabel,
  ROULETTE_WORDS,
  type CoachWords,
} from './coaching-text';
import { formatSigned, formatUnits, speakSigned } from './units';

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
  words = ROULETTE_WORDS,
}: {
  strategy: StrategyView;
  canStop: boolean;
  onStop: () => void;
  words?: CoachWords;
}) {
  const cycle = strategy.overrideEndsCycle ? ` · cycle ${strategy.cycle.number}` : '';
  const parameters = parametersText(strategy, words);
  const status = strategy.status === 'stopped' ? 'Strategy stopped · playing on your own' : `Guided · ${strategy.name}${parameters ? ` · ${parameters}` : ''}${cycle}`;
  return (
    <View style={styles.strip} testID="guided-strip">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.stripTitle}>{status}</Text>
      <View
        accessible
        accessibilityLabel={`Strategy adherence: ${adherenceText(strategy.adherence, words)}. Departures ${strategy.adherence.departures}.`}
        style={styles.adherence}
      >
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripLabel}>ADHERENCE</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripText}>
          {adherenceText(strategy.adherence, words)} · Departures {strategy.adherence.departures}
        </Text>
      </View>
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
  words = ROULETTE_WORDS,
}: {
  strategyName: string;
  correction: PendingCorrection;
  overrideEndsCycle: boolean;
  busy: boolean;
  onRetry: () => void;
  onOverride: () => void;
  words?: CoachWords;
}) {
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.coach}>Marcus · guided practice, {strategyName}</Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.kicker}>
        Before your {words.turn}
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>{prescriptionLine(strategyName, correction.explanation, words)}</Text>
      {correctionLines(correction, words).map((line) => (
        <Text key={line} maxFontSizeMultiplier={textScale.body} style={styles.body}>{line}</Text>
      ))}
      <Button label={retryLabel(correction, words)} stretch disabled={busy} onPress={onRetry} />
      <Button label="Keep my bets" variant="secondary" stretch disabled={busy} onPress={onOverride} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>{overrideNote(overrideEndsCycle, words)}</Text>
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
  words?: CoachWords;
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

/** A cycle turn as the table words it: "Spin 1 · 10 on Black" and "Lost · 0 green". */
export interface TurnWords {
  readonly title: string;
  readonly detail: string;
}

const outcomeWord = (net: string) => (net.startsWith('-') ? 'Loss' : net === '0' ? 'Even' : 'Win');

/**
 * The cycle result (S1-07), once a cycle completes or is exhausted: its net
 * result, the balance it leaves (never refilled), and its turns. Another cycle
 * starts only from here, explicitly, or the session ends.
 */
export function CycleResultPanel({
  strategy,
  balance,
  rebought,
  describeTurn,
  canRestart,
  canEnd,
  onRestart,
  onEnd,
  words = ROULETTE_WORDS,
}: {
  strategy: StrategyView;
  balance: string;
  /** True when the session has had a rebuy, so "no chips added" would mislead. */
  rebought: boolean;
  describeTurn: (turn: CycleTurn, index: number) => TurnWords;
  canRestart: boolean;
  canEnd: boolean;
  onRestart: () => void;
  onEnd: () => void;
  words?: CoachWords;
}) {
  const { cycle } = strategy;
  return (
    <View style={styles.panel} testID="cycle-panel">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.badge}>{cycleBadge(strategy)}</Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.headline}>
        {strategy.cycleEnd ? CYCLE_HEADLINE[strategy.cycleEnd] : 'Strategy cycle ended'}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{cycleEndText(strategy, words)}</Text>
      <View style={styles.stats}>
        <View accessible accessibilityLabel={`Cycle result ${speakSigned(cycle.net)}, ${outcomeWord(cycle.net)}`} style={styles.stat}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>Cycle result</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>{formatSigned(cycle.net)}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>{outcomeWord(cycle.net)}</Text>
        </View>
        <View accessible accessibilityLabel={`Balance now ${formatUnits(balance)}${rebought ? '' : '. No chips added'}`} style={styles.stat}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>Balance now</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>{formatUnits(balance)}</Text>
          {!rebought && <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>No chips added</Text>}
        </View>
      </View>
      {cycle.turns.length > 0 && (
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.stripLabel}>THIS CYCLE</Text>
      )}
      {cycle.turns.map((turn, index) => {
        const words = describeTurn(turn, index);
        return (
          <View key={turn.turn} accessible accessibilityLabel={`${words.title}. ${words.detail}. ${speakSigned(turn.net)}`} style={styles.turn}>
            <View style={styles.turnText}>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.stepTitle}>{words.title}</Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>{words.detail}</Text>
            </View>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{formatSigned(turn.net)}</Text>
          </View>
        );
      })}
      <Button label={`Start another cycle with ${formatUnits(balance)}`} stretch disabled={!canRestart} onPress={onRestart} />
      <Button label="End session" variant="secondary" stretch disabled={!canEnd} onPress={onEnd} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
        Starting another cycle uses the balance you have now. It never adds chips, and the session keeps the strategy revision you started with.
      </Text>
    </View>
  );
}

/**
 * A pending strategy action (S1-06): the strategy's next bets can't be placed,
 * so it places none. The player resolves it by rebuying (practice funding
 * only), by an override, or by stopping the strategy; Tableside never resizes it.
 */
export function PendingPanel({
  strategy,
  pending,
  available,
  canRebuy,
  canOverride,
  canCollect = null,
  canStop,
  onRebuy,
  onOverride,
  onCollect,
  onStop,
  words = ROULETTE_WORDS,
}: {
  strategy: StrategyView;
  pending: PendingStrategyAction;
  /** Funds available for the strategy's bets. */
  available: string;
  /** Null when no rebuy is offered (a training bankroll); otherwise whether one can be made now. */
  canRebuy: boolean | null;
  canOverride: boolean;
  /** Null when the table doesn't offer Collect instead; otherwise whether it can be chosen now. */
  canCollect?: boolean | null;
  canStop: boolean;
  onRebuy: () => void;
  /** Opens the bets, so the player can place their own instead (an override, judged when they spin). */
  onOverride: () => void;
  /** Keeps what was paid and ends the cycle instead of the pending step. */
  onCollect?: () => void;
  onStop: () => void;
  words?: CoachWords;
}) {
  const paid = pendingPaidNote(pending, words);
  return (
    <View style={styles.panel} testID="pending-panel">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.badge}>{strategy.overrideEndsCycle ? cycleBadge(strategy) : strategy.name}</Text>
      {paid && <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{paid}</Text>}
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.stepTitle}>{pendingWaiting(pending, words)}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>{pendingBlocked(pending, available)}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
        No new strategy bets until this is resolved. Tableside never makes a stake smaller or places part of a bet.
      </Text>
      {canRebuy !== null && <Button label="Resolve: rebuy" stretch disabled={!canRebuy} onPress={onRebuy} />}
      <Button label="Place my own bets (override)" variant="secondary" stretch disabled={!canOverride} onPress={onOverride} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>{pendingOverrideNote(strategy.overrideEndsCycle, words)}</Text>
      {canCollect !== null && (
        <Button
          label="Collect instead and end the cycle"
          variant="secondary"
          stretch
          hint="Keeps what has been paid. Removable bets come back, nothing pending is placed, and you restart the strategy yourself."
          disabled={!canCollect}
          onPress={() => onCollect?.()}
        />
      )}
      <Button label="Stop strategy" variant="secondary" stretch disabled={!canStop} onPress={onStop} />
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
  badge: { alignSelf: 'flex-start', paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: palette.secondary, fontFamily: fonts.uiMedium, fontSize: 12, color: palette.foreground },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  stat: { flexGrow: 1, flexBasis: 140, gap: 2, padding: space[3], borderRadius: radius.md, backgroundColor: palette.card },
  statLabel: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.mutedForeground },
  statValue: { fontFamily: fonts.uiBold, fontSize: 24, color: palette.foreground },
  turn: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingVertical: space[1] },
  turnText: { flexShrink: 1, gap: 2 },
});

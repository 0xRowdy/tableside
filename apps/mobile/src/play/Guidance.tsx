// Spec 1 S1-05

import type { CycleTurn, PendingStrategyAction, StrategyView } from '@tableside/engine';
import { Modal, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import {
  adherenceText,
  CYCLE_HEADLINE,
  cycleBadge,
  cycleEndText,
  parametersText,
  pendingBlocked,
  pendingOverrideNote,
  pendingPaidNote,
  pendingWaiting,
  ROULETTE_WORDS,
  type CoachWords,
  type CorrectionCopy,
  type DecisionUnit,
} from './coaching-text';
import { formatSigned, formatUnits, speakSigned } from './units';

export interface TableNow {
  readonly phase: string;
  readonly balance: string;
  readonly wagers: string;
  readonly cards?: readonly string[];
}

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
  detail?: string | null;
  unit?: DecisionUnit;
}) {
  const styles = useStyles();
  const cycle = strategy.overrideEndsCycle ? ` · cycle ${strategy.cycle.number}` : '';
  const status = strategy.status === 'stopped' ? 'Strategy stopped · playing on your own' : `Guided · ${strategy.name}${detail === null ? '' : ` · ${detail}`}${cycle}`;
  return (
    <View style={styles.strip} testID="guided-strip">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.stripTitle}>{status}</Text>
      <View
        accessible
        accessibilityLabel={`Strategy adherence: ${adherenceText(strategy.adherence, unit)}. Departures ${strategy.adherence.departures}.`}
        style={styles.adherence}
      >
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripLabel}>Adherence</Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.stripText}>
          {adherenceText(strategy.adherence, unit)} · Departures {strategy.adherence.departures}
        </Text>
      </View>
      {strategy.status !== 'stopped' && (
        <Button label="Stop strategy" variant="secondary" hint="Asks first. Your practice session stays open." disabled={!canStop} onPress={onStop} />
      )}
    </View>
  );
}

function CorrectionBody({ copy, busy, onRetry, onOverride }: { copy: CorrectionCopy; busy: boolean; onRetry: () => void; onOverride: () => void }) {
  const styles = useStyles();
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

export function CorrectionPanel(props: {
  copy: CorrectionCopy;
  // Spec 3 Amendment 2 §3 (no practice balance in a challenge); #138
  table: TableNow | null;
  fullScreen: boolean;
  busy: boolean;
  onRetry: () => void;
  onOverride: () => void;
}) {
  const styles = useStyles();
  const { table, fullScreen } = props;
  if (!fullScreen || table === null) {
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

export interface TurnWords {
  readonly title: string;
  readonly detail: string;
}

const outcomeWord = (net: string) => (net.startsWith('-') ? 'Loss' : net === '0' ? 'Even' : 'Win');

// Spec 1 S1-07
export function CycleResultPanel({
  strategy,
  balance,
  rebought,
  describeTurn,
  canRestart,
  canEnd,
  onRestart,
  onEnd,
  onPlayOn,
  words = ROULETTE_WORDS,
}: {
  strategy: StrategyView;
  balance: string;
  rebought: boolean;
  describeTurn: (turn: CycleTurn, index: number) => TurnWords;
  canRestart: boolean;
  canEnd: boolean;
  onRestart: () => void;
  onEnd: () => void;
  onPlayOn?: () => void;
  words?: CoachWords;
}) {
  const styles = useStyles();
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
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.stripLabel}>This cycle</Text>
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
      {onPlayOn && <Button label="Keep playing without the strategy" variant="secondary" stretch disabled={!canRestart} onPress={onPlayOn} />}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
        Starting another cycle uses the balance you have now. It never adds chips, and the session keeps the strategy revision you started with.
      </Text>
    </View>
  );
}

// Spec 1 S1-06
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
  available: string;
  canRebuy: boolean | null;
  canOverride: boolean;
  canCollect?: boolean | null;
  canStop: boolean;
  onRebuy: () => void;
  onOverride: () => void;
  onCollect?: () => void;
  onStop: () => void;
  words?: CoachWords;
}) {
  const styles = useStyles();
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
  const styles = useStyles();
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

const useStyles = makeStyles((type) => ({
  strip: { gap: space[2], marginHorizontal: space[4], marginTop: space[2], padding: space[3], borderRadius: radius.lg, backgroundColor: palette.card },
  stripTitle: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  stripLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  stripText: { fontFamily: fonts.ui, ...type.secondary, color: palette.foreground },
  adherence: { gap: 1 },
  panel: { gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.popover, borderWidth: 1, borderColor: palette.primary },
  coach: { fontFamily: fonts.uiMedium, ...type.secondary, color: palette.mutedForeground },
  kicker: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.primary },
  headline: { fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  body: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  note: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  fallback: { padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  why: { gap: space[1], paddingTop: space[2], borderTopWidth: 1, borderTopColor: palette.border },
  whyTitle: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  fullScreen: { flex: 1, backgroundColor: palette.background },
  fullScreenContent: { flexGrow: 1, padding: space[4] },
  fullScreenInner: { gap: space[3] },
  divider: { height: 1, backgroundColor: palette.border },
  scrim: { flex: 1, backgroundColor: palette.scrim },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: space[4] },
  dialog: { gap: space[3], padding: space[6], borderRadius: radius.lg, backgroundColor: palette.popover },
  step: { gap: 2 },
  stepTitle: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: palette.secondary, fontFamily: fonts.uiMedium, ...type.caption, color: palette.foreground },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  stat: { flexGrow: 1, flexBasis: 140, gap: 2, padding: space[3], borderRadius: radius.md, backgroundColor: palette.card },
  statLabel: { fontFamily: fonts.uiMedium, ...type.secondary, color: palette.mutedForeground },
  statValue: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  turn: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingVertical: space[1] },
  turnText: { flexShrink: 1, gap: 2 },
}));

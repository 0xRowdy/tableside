// The standard craps table, line game (design frames "06 Craps — Roll result",
// S1-04 "Craps come-out" and "Craps, table + bet list"). It renders only the
// engine's permitted view and forwards taps to the practice controller; it
// never advances the game or decides what is legal. Every wager states its
// working status in text, and committed contracts explain why they stay.

import { crapsHouseEdge } from '@tableside/definitions';
import { CRAPS_POINTS, type CrapsPermittedView as PermittedView } from '@tableside/engine';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import type { PracticeSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { commitmentText, crapsStatus, crapsTargetName, describeCrapsFacts, puckText, workingText } from './craps-text';
import { ChipRack } from './RouletteTable';
import { formatUnits, totalOnTable } from './roulette-text';
import { PhaseStepper, SessionStrip, TableTopBar, type PhaseStep } from './TableChrome';

type ActiveSnapshot = Extract<PracticeSnapshot, { status: 'active' }> & { readonly view: PermittedView };

/** Above this text scale, a wide window stacks the felt and the controls so text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;

const NOT_SAVED = 'Not saved yet. Play is paused.';

function phaseSteps(view: PermittedView): PhaseStep[] {
  const reached = { 'open-decision': 0, 'revealing-outcome': 1, 'settled-outcome': 2, 'final-settlement': 2, completed: 3 }[view.phase];
  return [view.table.point === null ? 'Come-out' : 'Betting', 'Roll', 'Settle'].map((label, index) => ({
    label,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }));
}

const rollText = (dice: readonly [number, number]) => `${dice[0]} and ${dice[1]}, total ${dice[0] + dice[1]}`;

export function CrapsTable({ snapshot }: { snapshot: ActiveSnapshot }) {
  const { controller } = usePractice();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const [chip, setChip] = useState('25');
  const [confirming, setConfirming] = useState(false);
  const { view, facts, busy, save } = snapshot;
  const { table } = view;

  const ready = !busy && save === 'saved';
  const legal = (kind: PermittedView['legalCommands'][number]) => ready && view.legalCommands.includes(kind);
  const message = useMemo(() => describeCrapsFacts(facts, view), [facts, view]);
  const edge = (wager: 'pass' | 'dont-pass') => crapsHouseEdge(wager, { ...table.variant, odds: table.odds }).percent;

  // Announce every committed transition as it is published, including ones
  // that pass before the next render, and a save failure that pauses play.
  useEffect(() => {
    const initial = controller.snapshot();
    let announced = initial.status === 'active' ? initial.view.sequence : -1;
    let failed = initial.status === 'active' && initial.save === 'failed';
    return controller.subscribe(() => {
      const latest = controller.snapshot();
      if (latest.status !== 'active' || latest.view.game !== 'craps') return;
      const nowFailed = latest.save === 'failed';
      if (nowFailed && !failed) AccessibilityInfo.announceForAccessibility(NOT_SAVED);
      failed = nowFailed;
      if (latest.view.sequence === announced) return;
      announced = latest.view.sequence;
      // A state adopted from the store carries no facts of its own: restate where things stand.
      const text = describeCrapsFacts(latest.facts, latest.view) ?? `${crapsStatus(latest.view)}. Balance ${formatUnits(latest.view.balance)}.`;
      AccessibilityInfo.announceForAccessibility(text);
    });
  }, [controller]);

  const stakeOn = (target: string) => view.wagers.find((wager) => wager.target === target)?.amount;
  const placeable = (target: string) => table.placements.some((placement) => placement.target === target);
  const addChip = (target: string) => {
    const total = BigInt(stakeOn(target) ?? '0') + BigInt(chip);
    void controller.placeWager(target, total.toString());
  };
  const canPlace = legal('place-wager');

  return (
    <View style={styles.screen}>
      <ScrollView testID="table-scroll" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space[6] }}>
        <TableTopBar
          title="Craps"
          subtitle={`${table.odds} odds · line ${formatUnits(table.limits.line.min)}–${formatUnits(table.limits.line.max)}`}
          canEnd={legal('request-stop')}
          onEnd={() => setConfirming(true)}
        />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.edge}>
          House edge: pass and come {edge('pass')}% · don&apos;t pass and don&apos;t come {edge('dont-pass')}% · odds 0%
        </Text>
        <PhaseStepper steps={phaseSteps(view)} />
        <SessionStrip balance={formatUnits(view.balance)} onTable={formatUnits(totalOnTable(view))} status={crapsStatus(view)} />

        {save === 'failed' && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>{NOT_SAVED}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              Your last move hasn&apos;t been saved, so nothing has been revealed. Try saving again.
            </Text>
            <Button label="Try again" variant="secondary" disabled={busy} onPress={() => void controller.retrySave()} />
          </View>
        )}
        {snapshot.accessNotAllowed && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>This roll can&apos;t start right now.</Text>
          </View>
        )}

        {view.phase === 'final-settlement' ? (
          <EndingSteps snapshot={snapshot} />
        ) : (
          <View testID="table-columns" style={[styles.columns, sideBySide && styles.columnsSideBySide]}>
            <View style={styles.column}>
              <Felt view={view} canPlace={canPlace} chip={chip} placeable={placeable} stakeOn={stakeOn} onSpot={addChip} />
            </View>
            <View style={[styles.column, styles.controls]}>
              {message && (
                <Text maxFontSizeMultiplier={textScale.body} style={styles.message} testID="latest-event">
                  {message}
                </Text>
              )}
              <WagerList view={view} canPlace={canPlace} chip={chip} placeable={placeable} onAddOdds={addChip} onRemove={(target) => void controller.placeWager(target, '0')} />
              <Button label="Roll" stretch disabled={!legal('begin-turn')} onPress={() => void controller.beginTurn()} />
              <ChipRack chip={chip} onChoose={setChip} />
            </View>
          </View>
        )}
      </ScrollView>

      <EndSessionDialog
        visible={confirming}
        view={view}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void controller.endSession();
        }}
      />
    </View>
  );
}

/** The table spots, in felt order. Line spots open and close with the puck. */
const LINE_SPOTS: readonly { target: string; label: string; closed: string }[] = [
  { target: 'come', label: 'COME', closed: 'Come bets open once a point is set.' },
  { target: 'dont-come', label: "DON'T COME · BAR 12", closed: "Don't come bets open once a point is set." },
  { target: 'pass', label: 'PASS LINE', closed: 'Pass line bets are made before a come-out roll.' },
  { target: 'pass-odds', label: 'PASS ODDS', closed: 'Odds go behind the pass line once a point is set.' },
  { target: 'dont-pass', label: "DON'T PASS BAR 12", closed: "Don't pass bets are made before a come-out roll." },
  { target: 'dont-pass-odds', label: "DON'T PASS ODDS", closed: "Odds go behind don't pass once a point is set." },
];

function Felt({
  view,
  canPlace,
  chip,
  placeable,
  stakeOn,
  onSpot,
}: {
  view: PermittedView;
  canPlace: boolean;
  chip: string;
  placeable: (target: string) => boolean;
  stakeOn: (target: string) => string | undefined;
  onSpot: (target: string) => void;
}) {
  const { point } = view.table;
  const payout = (target: string) => view.table.placements.find((p) => p.target === target)?.payout.replace(':', ' to ');
  return (
    <View style={styles.felt} testID="felt">
      <View accessible accessibilityLabel={view.outcome ? `${puckText(point)}. Last roll: ${rollText(view.outcome.dice)}` : puckText(point)} style={styles.rollRow}>
        <View style={[styles.puck, point !== null && styles.puckOn]}>
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.puckText, point !== null && styles.puckTextOn]}>
            {point === null ? 'OFF' : 'ON'}
          </Text>
        </View>
        <View style={styles.rollText}>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.rollTitle}>
            {view.outcome ? `Rolled ${view.outcome.dice[0] + view.outcome.dice[1]}` : 'Come-out roll'}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.rollDetail}>
            {view.outcome ? `${view.outcome.dice[0]} and ${view.outcome.dice[1]} · ${puckText(point)}` : puckText(point)}
          </Text>
        </View>
      </View>

      <View style={styles.boxes}>
        {CRAPS_POINTS.map((n) => {
          const bets = view.wagers.filter((wager) => wager.target.startsWith(`come-${n}`) || wager.target.startsWith(`dont-come-${n}`));
          const spoken = bets.map((wager) => `${crapsTargetName(wager.target)} ${formatUnits(wager.amount)} ${workingText(view, wager.target)}`);
          return (
            <View
              key={n}
              accessible
              accessibilityLabel={[`Box ${n}`, point === n ? 'puck ON, the point' : null, ...spoken].filter(Boolean).join(', ')}
              style={[styles.box, point === n && styles.boxPoint]}
            >
              <Text maxFontSizeMultiplier={textScale.body} style={styles.boxText}>{n}</Text>
              {point === n && <Text maxFontSizeMultiplier={textScale.body} style={styles.boxPuck}>ON</Text>}
              {bets.map((wager) => (
                <Text key={wager.target} maxFontSizeMultiplier={textScale.body} style={styles.boxBet}>
                  {wager.target.endsWith('-odds') ? 'odds' : wager.target.startsWith('dont') ? "don't" : 'come'} {formatUnits(wager.amount)} · {workingText(view, wager.target)}
                </Text>
              ))}
            </View>
          );
        })}
      </View>

      {LINE_SPOTS.map((spot) => {
        const open = placeable(spot.target);
        const stake = stakeOn(spot.target);
        // An odds spot shows only once it can be used or holds a wager.
        if (spot.target.endsWith('-odds') && !open && stake === undefined) return null;
        const pays = payout(spot.target) ?? '1 to 1';
        return (
          <Spot
            key={spot.target}
            label={spot.label}
            spoken={`${crapsTargetName(spot.target)}, pays ${pays}`}
            hint={open ? `Adds ${formatUnits(chip)}.` : stake !== undefined ? heldHint(view, spot.target) : spot.closed}
            wager={stake === undefined ? undefined : `${formatUnits(stake)} · ${workingText(view, spot.target)}`}
            disabled={!canPlace || !open}
            onPress={() => onSpot(spot.target)}
          />
        );
      })}
    </View>
  );
}

/** Why a spot holding a wager takes no more: a contract can't change; anything else can still come down. */
function heldHint(view: PermittedView, target: string): string {
  const removable = view.table.wagers.find((wager) => wager.target === target)?.removable !== false;
  if (!removable) return commitmentText(target, view.table.point);
  return `${crapsTargetName(target)} can't be raised now. You can remove it from your wagers.`;
}

function Spot({
  label,
  spoken,
  hint,
  wager,
  disabled,
  onPress,
}: {
  label: string;
  spoken: string;
  hint: string;
  wager: string | undefined;
  disabled: boolean;
  onPress: () => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={hint}
      accessibilityValue={{ text: wager ? `${wager.replace(' · ', ' on it, ')}` : 'no wager' }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.spot, wager !== undefined && styles.spotWagered, focused && styles.spotFocused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.spotText}>{label}</Text>
      {wager !== undefined && (
        <View style={styles.marker}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.markerText}>{wager}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** The bet list: every wager with its working status and what can be done with it. */
function WagerList({
  view,
  canPlace,
  chip,
  placeable,
  onAddOdds,
  onRemove,
}: {
  view: PermittedView;
  canPlace: boolean;
  chip: string;
  placeable: (target: string) => boolean;
  onAddOdds: (target: string) => void;
  onRemove: (target: string) => void;
}) {
  return (
    <View style={styles.list}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>
        YOUR WAGERS · {view.wagers.length}
      </Text>
      {view.wagers.length === 0 && <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>No wagers yet</Text>}
      {view.wagers.map((wager) => {
        const status = view.table.wagers.find((item) => item.target === wager.target);
        const name = crapsTargetName(wager.target);
        const removable = status?.removable !== false;
        const odds = `${wager.target}-odds`;
        return (
          <View key={wager.target} style={styles.row} testID={`wager-${wager.target}`}>
            <View
              accessible
              accessibilityLabel={`${name} ${formatUnits(wager.amount)}, ${workingText(view, wager.target)}, ${removable ? 'removable' : 'committed'}`}
              style={styles.rowHeader}
            >
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{name}</Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>{formatUnits(wager.amount)}</Text>
            </View>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>
              {removable ? 'Removable' : 'Committed'} · {workingText(view, wager.target)}
            </Text>
            {!removable && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>
                {commitmentText(wager.target, view.table.point)}
              </Text>
            )}
            {placeable(odds) && (
              <Button label={`Add ${formatUnits(chip)} odds behind ${name}`} variant="secondary" disabled={!canPlace} onPress={() => onAddOdds(odds)} />
            )}
            <Button
              label={`Remove ${name}`}
              variant="secondary"
              disabled={!canPlace || !removable}
              hint={removable ? 'Returns it to your balance.' : "Remove isn't available: committed bet."}
              onPress={() => onRemove(wager.target)}
            />
            {!removable && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Remove isn&apos;t available: committed bet.</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function EndingSteps({ snapshot }: { snapshot: ActiveSnapshot }) {
  const { view } = snapshot;
  let returned = 0n;
  for (const fact of snapshot.facts) if (fact.kind === 'wager-returned') returned += BigInt(fact.amount);
  const contracts = view.wagers.map((wager) => `${crapsTargetName(wager.target)} ${formatUnits(wager.amount)}`).join(' · ');
  const steps = [
    { title: 'Removable wagers returned', detail: returned > 0n ? `+${formatUnits(returned.toString())} to your balance` : 'Nothing removable was on the table', state: 'done' },
    {
      title: 'Contracts settle automatically',
      detail: contracts ? `Rolling on for ${contracts}. No new bets, odds or presses.` : 'Nothing left to settle.',
      state: 'current',
    },
    { title: 'Session result', detail: '', state: 'upcoming' },
  ] as const;
  return (
    <View style={styles.ending}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.endingTitle}>
        Ending your session
      </Text>
      {view.outcome && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepDetail}>
          Last roll: {rollText(view.outcome.dice)} · {puckText(view.table.point)}
        </Text>
      )}
      {steps.map((step, index) => (
        <View key={step.title} accessible accessibilityLabel={`Step ${index + 1}, ${step.title}, ${step.state}. ${step.detail}`} style={styles.endingStep}>
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.endingStepTitle, step.state === 'upcoming' && styles.muted]}>
            {step.state === 'done' ? '✓' : index + 1}  {step.title}
          </Text>
          {step.detail !== '' && <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepDetail}>{step.detail}</Text>}
        </View>
      ))}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepTitle}>
        The dice roll on their own until every contract is settled. There&apos;s nothing to tap.
      </Text>
    </View>
  );
}

function EndSessionDialog({ visible, view, onCancel, onConfirm }: { visible: boolean; view: PermittedView; onCancel: () => void; onConfirm: () => void }) {
  const removable = view.wagers.filter((wager) => view.table.wagers.find((item) => item.target === wager.target)?.removable !== false);
  const contracts = view.wagers.filter((wager) => !removable.includes(wager));
  const list = (wagers: typeof view.wagers, none: string) =>
    wagers.length === 0 ? none : wagers.map((w) => `${crapsTargetName(w.target)} ${formatUnits(w.amount)}`).join(' · ');
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
              { title: 'Removable wagers come back', detail: list(removable, 'Nothing removable on the table') },
              { title: 'Contracts settle automatically', detail: list(contracts, 'No contracts on the table') },
              { title: 'You see the session result', detail: 'Buy-in, final cash-out and net result' },
            ].map((step, index) => (
              <View key={step.title} accessible accessibilityLabel={`${index + 1}. ${step.title}. ${step.detail}`} style={styles.dialogStep}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogStepTitle}>{index + 1}  {step.title}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.dialogText}>{step.detail}</Text>
              </View>
            ))}
            <Button label="End session" stretch onPress={onConfirm} />
            <Button label="Keep playing" variant="secondary" stretch onPress={onCancel} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  edge: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground, paddingHorizontal: space[4] },
  banner: { margin: space[4], padding: space[4], gap: space[2], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.destructive },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  bannerText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  columns: { gap: space[3], paddingTop: space[2] },
  columnsSideBySide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  controls: { gap: space[3], paddingHorizontal: space[4] },
  message: { fontFamily: fonts.uiMedium, fontSize: 15, lineHeight: 21, color: palette.foreground },
  sectionLabel: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.5, color: palette.mutedForeground },
  muted: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  felt: { gap: space[2], padding: space[3], marginHorizontal: space[2], borderRadius: radius.lg, backgroundColor: palette.feltDeep },
  rollRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  puck: { minWidth: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.pocketBlack, borderWidth: 2, borderColor: palette.foreground },
  puckOn: { backgroundColor: palette.chip1 },
  puckText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.onImage },
  puckTextOn: { color: palette.ink },
  rollText: { flex: 1, gap: 2 },
  rollTitle: { fontFamily: fonts.display, fontSize: 22, color: palette.onImage },
  rollDetail: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.onImage },
  boxes: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  box: { flexGrow: 1, flexBasis: 48, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', padding: space[1], borderRadius: radius.sm, borderWidth: 2, borderColor: palette.transparent, backgroundColor: palette.felt },
  boxPoint: { borderColor: palette.foreground },
  boxText: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.onImage },
  boxPuck: { fontFamily: fonts.uiBold, fontSize: 11, color: palette.ink, backgroundColor: palette.chip1, paddingHorizontal: 4, borderRadius: radius.pill },
  boxBet: { fontFamily: fonts.uiMedium, fontSize: 11, color: palette.onImage },
  spot: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: palette.transparent,
    backgroundColor: palette.felt,
  },
  spotWagered: { borderColor: palette.foreground },
  spotFocused: { borderColor: palette.ring },
  spotText: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.onImage },
  marker: { minWidth: 26, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: palette.chip1, alignItems: 'center' },
  markerText: { fontFamily: fonts.uiBold, fontSize: 11, color: palette.ink },
  list: { gap: space[2] },
  row: { gap: space[1], padding: space[3], borderRadius: radius.lg, backgroundColor: palette.card },
  rowHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  ending: { gap: space[3], padding: space[4] },
  endingTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  endingStep: { gap: 2 },
  endingStepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  endingStepDetail: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  scrim: { flex: 1, backgroundColor: palette.scrim },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: space[4] },
  dialog: { gap: space[3], padding: space[6], borderRadius: radius.lg, backgroundColor: palette.popover },
  dialogTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  dialogText: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  dialogStep: { gap: 2 },
  dialogStepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
});

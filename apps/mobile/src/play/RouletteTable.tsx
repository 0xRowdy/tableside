// The roulette table (design frame "05 Roulette — Betting"). It renders only
// the engine's permitted view and forwards taps to the practice controller;
// it never advances the game or decides what is legal.

import type { PermittedView } from '@tableside/engine';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { SAVE_RETRY_MS, type PracticeSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';

import { BetSelector } from './bet-selector/BetSelector';
import { CorrectionPanel, CycleEndPanel, GuidedStrip, StopStrategyDialog } from './Guidance';
import { draftAmountText, EMPTY_DRAFT, findChoice, isDraftPending, type BetDraft } from './bet-selector/catalog';
import { DraftBar, PresentationSwitch, type Presentation } from './bet-selector/Presentation';
import { RebuySheet } from './RebuySheet';
import { rouletteCatalog, roulettePlacedWagers } from './roulette-catalog';
import { describeFacts, describePocket, formatUnits, POCKET_TOKEN, pocketColor, STATUS, targetName, totalOnTable } from './roulette-text';
import { RouletteFelt } from './RouletteFelt';
import { PhaseStepper, SessionStrip, TableTopBar, type PhaseStep } from './TableChrome';

type ActiveSnapshot = Extract<PracticeSnapshot, { status: 'active' }>;

/** Above this text scale, a wide window stacks the felt and the controls so text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;

const CHIPS: readonly { value: string; label: string; color: ColorToken; ink: ColorToken }[] = [
  { value: '1', label: '1', color: 'chip1', ink: 'ink' },
  { value: '5', label: '5', color: 'chip5', ink: 'onImage' },
  { value: '25', label: '25', color: 'chip25', ink: 'onImage' },
  { value: '100', label: '100', color: 'chip100', ink: 'onImage' },
  { value: '500', label: '500', color: 'chip500', ink: 'onImage' },
  { value: '1000', label: '1K', color: 'chip1k', ink: 'ink' },
];


function phaseSteps(view: PermittedView): PhaseStep[] {
  const reached = { 'open-decision': 0, correction: 0, 'revealing-outcome': 1, 'settled-outcome': 2, 'cycle-completion': 2, 'final-settlement': 2, completed: 3 }[view.phase];
  return ['Betting', 'Spin', 'Settle'].map((label, index) => ({
    label,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }));
}

function limitsText(view: PermittedView): string {
  const limit = (limitClass: 'inside' | 'outside') => {
    const placement = view.table.placements.find((p) => p.limitClass === limitClass);
    return placement ? `${formatUnits(placement.min)}–${formatUnits(placement.max)}` : '';
  };
  const guided = view.strategy ? ` · guided practice, ${view.strategy.name}` : '';
  return `${WHEEL_NAMES[view.table.wheel]} · inside ${limit('inside')} · outside ${limit('outside')}${guided}`;
}

export function RouletteTable({ snapshot }: { snapshot: ActiveSnapshot }) {
  const { controller } = usePractice();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const [chip, setChip] = useState('5');
  const [confirming, setConfirming] = useState(false);
  const [rebuying, setRebuying] = useState(false);
  const [stoppingStrategy, setStoppingStrategy] = useState(false);
  // Held here, above both presentations, so rotation, resizing and switching keep the draft.
  const [presentation, setPresentation] = useState<Presentation>('table');
  const [draft, setDraft] = useState<BetDraft>(EMPTY_DRAFT);
  const { view, facts, busy, save } = snapshot;
  const catalog = useMemo(() => rouletteCatalog(view), [view]);
  const placed = useMemo(() => roulettePlacedWagers(view), [view]);
  const drafted = isDraftPending(draft, placed) ? findChoice(catalog, draft.target) : undefined;
  // The sheet shows only while a rebuy is offered (the table waits for input).
  const rebuyOpen = rebuying && view.legalCommands.includes('rebuy');
  const addRebuy = async (amount: string) => {
    await controller.rebuy(amount);
    const latest = controller.snapshot();
    // Committed: close. Refused or not saved: keep the sheet and the draft.
    if (latest.status !== 'active' || latest.facts.some((fact) => fact.kind === 'funding-added')) setRebuying(false);
  };

  const ready = !busy && save === 'saved';
  const legal = (kind: PermittedView['legalCommands'][number]) => ready && view.legalCommands.includes(kind);
  const message = useMemo(() => describeFacts(facts, view), [facts, view]);

  // Announce every committed transition as it is published, including ones
  // that pass before the next render (an automatic settle right after a reveal),
  // and a save failure that pauses play.
  useEffect(() => {
    const initial = controller.snapshot();
    let announced = initial.status === 'active' ? initial.view.sequence : -1;
    let failed = initial.status === 'active' && initial.save === 'failed';
    return controller.subscribe(() => {
      const latest = controller.snapshot();
      if (latest.status !== 'active') return;
      const nowFailed = latest.save === 'failed';
      if (nowFailed && !failed) AccessibilityInfo.announceForAccessibility(SAVE_FAILED_ANNOUNCEMENT);
      failed = nowFailed;
      if (latest.view.sequence === announced) return;
      announced = latest.view.sequence;
      // A state adopted from the store carries no facts of its own: restate where things stand.
      const text = describeFacts(latest.facts, latest.view) ?? `${STATUS[latest.view.phase]}. Balance ${formatUnits(latest.view.balance)}.`;
      AccessibilityInfo.announceForAccessibility(text);
    });
  }, [controller]);

  const wagerOn = (target: string) => view.wagers.find((wager) => wager.target === target)?.amount;
  const addChip = (target: string) => {
    const total = BigInt(wagerOn(target) ?? '0') + BigInt(chip);
    void controller.placeWager(target, total.toString());
  };
  const canPlace = legal('place-wager');
  const wagersText = view.wagers.length === 0 ? 'nothing' : view.wagers.map((wager) => `${targetName(wager.target)} ${formatUnits(wager.amount)}`).join(' · ');
  const strategy = view.strategy;

  return (
    <View style={styles.screen}>
      <ScrollView testID="table-scroll" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space[6] }}>
        <TableTopBar title="Roulette" subtitle={limitsText(view)} canEnd={legal('request-stop')} onEnd={() => setConfirming(true)} />
        <PhaseStepper steps={phaseSteps(view)} />
        <SessionStrip balance={formatUnits(view.balance)} onTable={formatUnits(totalOnTable(view))} status={save === 'failed' ? 'Paused · not saved' : STATUS[view.phase]} />
        {strategy && <GuidedStrip strategy={strategy} canStop={legal('stop-strategy')} onStop={() => setStoppingStrategy(true)} />}
        {view.phase !== 'final-settlement' && <PresentationSwitch value={presentation} onChange={setPresentation} />}

        {save === 'failed' && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Couldn&apos;t save · play is paused</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              {busy
                ? 'Saving your last move…'
                : `Your last move hasn't been saved, so nothing has been revealed. Nothing is lost. Retrying automatically every ${SAVE_RETRY_MS / 1000} s.`}
            </Text>
            <Button label="Retry now" variant="secondary" disabled={busy} onPress={() => void controller.retrySave()} />
          </View>
        )}
        {snapshot.accessNotAllowed && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>This spin can&apos;t start right now.</Text>
          </View>
        )}

        {view.phase === 'final-settlement' ? (
          <EndingSteps snapshot={snapshot} />
        ) : (
          <View testID="table-columns" style={[styles.columns, sideBySide && styles.columnsSideBySide]}>
            <View style={styles.column}>
              {presentation === 'table' ? (
                <View style={styles.tableView}>
                  {drafted && (
                    <DraftBar
                      name={drafted.choice.name}
                      amount={draftAmountText(draft.text)}
                      onEdit={() => {
                        setDraft({ ...draft, kind: drafted.kind.id });
                        setPresentation('selector');
                      }}
                    />
                  )}
                  <RouletteFelt view={view} canPlace={canPlace} chip={chip} wagerOn={wagerOn} onSpot={addChip} />
                </View>
              ) : (
                <BetSelector
                  catalog={catalog}
                  wagers={placed}
                  balance={view.balance}
                  canRebuy={view.legalCommands.includes('rebuy')}
                  facts={facts}
                  sequence={view.sequence}
                  canPlace={canPlace}
                  draft={draft}
                  onDraftChange={setDraft}
                  onSet={(target, amount) => void controller.placeWager(target, amount)}
                  onRemove={(target) => void controller.placeWager(target, '0')}
                />
              )}
            </View>
            <View style={[styles.column, styles.controls]}>
              {strategy?.correction && view.phase === 'correction' && (
                <CorrectionPanel
                  strategyName={strategy.name}
                  correction={strategy.correction}
                  table={{ phase: 'Strategy check before your spin', balance: formatUnits(view.balance), wagers: wagersText }}
                  fullScreen={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE}
                  busy={!ready}
                  onRetry={() => void controller.retryCorrection()}
                  onOverride={() => void controller.overrideCorrection()}
                />
              )}
              {strategy && view.phase === 'cycle-completion' && (
                <CycleEndPanel
                  strategy={strategy}
                  busy={!ready}
                  onRestart={() => void controller.restartCycle()}
                  onStopStrategy={() => setStoppingStrategy(true)}
                />
              )}
              {message && (
                <Text maxFontSizeMultiplier={textScale.body} style={styles.message} testID="latest-event">
                  {message}
                </Text>
              )}
              {view.outcome && (
                <View accessible accessibilityLabel={`Last spin: ${describePocket(view.outcome.pocket)}`} style={styles.lastSpin}>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>LAST SPIN</Text>
                  <View style={styles.lastSpinRow}>
                    <View style={[styles.pocketBadge, { backgroundColor: palette[POCKET_TOKEN[pocketColor(view.outcome.pocket)]] }]}>
                      <Text maxFontSizeMultiplier={textScale.body} style={styles.pocketBadgeText}>{String(view.outcome.pocket)}</Text>
                    </View>
                    <Text maxFontSizeMultiplier={textScale.body} style={styles.lastSpinText}>
                      {capitalize(pocketColor(view.outcome.pocket))}
                    </Text>
                  </View>
                </View>
              )}
              <View style={styles.summary}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.summaryTitle}>On table {formatUnits(totalOnTable(view))}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.summaryText}>
                  {view.wagers.length === 0 ? 'No wagers yet' : wagersText}
                </Text>
              </View>
              <Button label="Spin" stretch disabled={!legal('begin-turn')} onPress={() => void controller.spin()} />
              {view.legalCommands.includes('rebuy') && (
                <Button
                  label="Rebuy"
                  variant="secondary"
                  stretch
                  hint="Adds chips to this session. It counts as funding, not as a win."
                  disabled={!legal('rebuy')}
                  onPress={() => setRebuying(true)}
                />
              )}
              {presentation === 'table' && <ChipRack chip={chip} onChoose={setChip} />}
            </View>
          </View>
        )}
      </ScrollView>

      {rebuyOpen && (
        <RebuySheet
          funding={view.funding}
          sequence={view.sequence}
          facts={facts}
          busy={!ready}
          onAdd={(amount) => void addRebuy(amount)}
          onClose={() => setRebuying(false)}
        />
      )}

      <StopStrategyDialog
        visible={stoppingStrategy}
        removable={view.wagersCommitted || view.wagers.length === 0 ? 'Nothing removable on the table' : wagersText}
        committed={view.wagersCommitted ? `${wagersText} settle with this spin.` : 'None between spins.'}
        onCancel={() => setStoppingStrategy(false)}
        onConfirm={() => {
          setStoppingStrategy(false);
          void controller.stopStrategy();
        }}
      />

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

const WHEEL_NAMES: Record<PermittedView['table']['wheel'], string> = { 'single-zero': 'Single zero', 'double-zero': 'Double zero' };

const SAVE_FAILED_ANNOUNCEMENT = "Couldn't save. Play is paused and will retry automatically.";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function ChipRack({ chip, onChoose }: { chip: string; onChoose: (value: string) => void }) {
  return (
    <View style={styles.rack}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Chip value" style={styles.chips}>
        {CHIPS.map((option) => (
          <Chip key={option.value} option={option} selected={option.value === chip} onPress={() => onChoose(option.value)} />
        ))}
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rackCaption}>
        {formatUnits(chip)} selected · tap a spot to add it
      </Text>
    </View>
  );
}

function Chip({ option, selected, onPress }: { option: (typeof CHIPS)[number]; selected: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${formatUnits(option.value)} chip`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      {...focusProps}
      style={[styles.chipSlot, selected && styles.chipSelected, focused && styles.chipFocused]}
    >
      <View style={[styles.chip, { backgroundColor: palette[option.color] }]}>
        <Text maxFontSizeMultiplier={textScale.display} style={[styles.chipText, { color: palette[option.ink] }]}>{option.label}</Text>
      </View>
      {selected && <Text maxFontSizeMultiplier={textScale.display} style={styles.chipCheck}>{'✓'}</Text>}
    </Pressable>
  );
}

function EndingSteps({ snapshot }: { snapshot: ActiveSnapshot }) {
  let returned = 0n;
  for (const fact of snapshot.facts) if (fact.kind === 'wager-returned') returned += BigInt(fact.amount);
  const steps = [
    { title: 'Removable wagers returned', detail: returned > 0n ? `+${formatUnits(returned.toString())} to your balance` : 'Nothing was on the table', state: 'done' },
    { title: 'Final settlement', detail: 'Runs on its own. No more bets.', state: 'current' },
    { title: 'Session result', detail: '', state: 'upcoming' },
  ] as const;
  return (
    <View style={styles.ending}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.endingTitle}>
        Ending your session
      </Text>
      {steps.map((step, index) => (
        <View key={step.title} accessible accessibilityLabel={`Step ${index + 1}, ${step.title}, ${step.state}. ${step.detail}`} style={styles.endingStep}>
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.endingStepTitle, step.state === 'upcoming' && styles.muted]}>
            {step.state === 'done' ? '✓' : index + 1}  {step.title}
          </Text>
          {step.detail !== '' && <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepDetail}>{step.detail}</Text>}
        </View>
      ))}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepTitle}>
        Final settlement starts on its own. There&apos;s nothing to tap.
      </Text>
    </View>
  );
}

function EndSessionDialog({
  visible,
  view,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  view: PermittedView;
  onCancel: () => void;
  onConfirm: () => void;
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
                detail: removable.length === 0 ? 'Nothing on the table' : removable.map((w) => `${targetName(w.target)} ${formatUnits(w.amount)}`).join(' · '),
              },
              { title: 'Committed wagers settle automatically', detail: 'None between spins' },
              { title: 'You see the session result', detail: 'Buy-in, rebuys, final cash-out, net result and maximum drawdown' },
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
  banner: { margin: space[4], padding: space[4], gap: space[2], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.destructive },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  bannerText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  columns: { gap: space[3], paddingTop: space[2] },
  columnsSideBySide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  tableView: { gap: space[3] },
  controls: { gap: space[3], paddingHorizontal: space[4] },
  message: { fontFamily: fonts.uiMedium, fontSize: 15, lineHeight: 21, color: palette.foreground },
  sectionLabel: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.5, color: palette.mutedForeground },
  lastSpin: { gap: space[1] },
  lastSpinRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  pocketBadge: { minWidth: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2] },
  pocketBadgeText: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.onImage },
  lastSpinText: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  summary: { gap: 2 },
  summaryTitle: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  summaryText: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  chipFocused: { borderColor: palette.ring },
  rack: { gap: space[2], padding: space[3], borderRadius: radius.lg, backgroundColor: palette.rail },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  chipSlot: {
    minWidth: MIN_TOUCH_TARGET + 8,
    minHeight: MIN_TOUCH_TARGET + 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  chipSelected: { borderColor: palette.primary },
  chip: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.uiBold, fontSize: 15 },
  chipCheck: { position: 'absolute', top: -2, right: -2, fontFamily: fonts.uiBold, fontSize: 12, color: palette.primary },
  rackCaption: { fontFamily: fonts.ui, fontSize: 12, color: palette.foreground },
  ending: { gap: space[3], padding: space[4] },
  endingTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  endingStep: { gap: 2 },
  endingStepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  endingStepDetail: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  muted: { color: palette.mutedForeground },
  scrim: { flex: 1, backgroundColor: palette.scrim },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: space[4] },
  dialog: { gap: space[3], padding: space[6], borderRadius: radius.lg, backgroundColor: palette.popover },
  dialogTitle: { fontFamily: fonts.display, fontSize: 24, color: palette.foreground },
  dialogText: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  dialogStep: { gap: 2 },
  dialogStepTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
});

// The roulette table (design frame "05 Roulette — Betting"). It renders only
// the engine's permitted view and forwards taps to the practice controller;
// it never advances the game or decides what is legal.

import { isPlayCorrection, type CycleTurn, type RoulettePermittedView as PermittedView, type RoulettePocket } from '@tableside/engine';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import type { ActivePracticeSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, palette, space, textScale } from '@/theme/tokens';

import { BetSelector } from './bet-selector/BetSelector';
import { betCorrectionCopy, betsText } from './coaching-text';
import { CorrectionPanel, CycleResultPanel, GuidedStrip, PendingPanel, type TurnWords } from './Guidance';
import { draftAmountText, EMPTY_DRAFT, findChoice, isDraftPending, type BetDraft } from './bet-selector/catalog';
import { DraftBar, PresentationSwitch, type Presentation } from './bet-selector/Presentation';
import { RebuySheet } from './RebuySheet';
import { rouletteCatalog, roulettePlacedWagers } from './roulette-catalog';
import { describeFacts, describePocket, POCKET_TOKEN, pocketColor, STATUS, targetName } from './roulette-text';
import { capitalize, formatUnits, sumUnits, totalOnTable } from './units';
import { RouletteFelt } from './RouletteFelt';
import { AccessStopBanner, AllowanceLine, ChipRack, EndingSteps, PhaseStepper, SaveFailedBanner, SessionStrip, TableDialogs, TableTopBar, TurnBoundaryBanner, type PhaseStep } from './TableChrome';

type ActiveSnapshot = ActivePracticeSnapshot & { readonly view: PermittedView };

/** Above this text scale, a wide window stacks the felt and the controls so text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;


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
      if (latest.status !== 'active' || latest.view.game !== 'roulette') return;
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
    void controller.placeWager(target, sumUnits(wagerOn(target) ?? '0', chip));
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
        <AllowanceLine game="roulette" />
        {strategy && <GuidedStrip strategy={strategy} canStop={legal('stop-strategy')} onStop={() => setStoppingStrategy(true)} />}
        {view.phase !== 'final-settlement' && <PresentationSwitch value={presentation} onChange={setPresentation} />}

        {save === 'failed' && <SaveFailedBanner busy={busy} onRetry={() => void controller.retrySave()} />}
        <AccessStopBanner ending={snapshot.ending} detail="Your bets settle automatically, then you'll see the session result." />
        <TurnBoundaryBanner suspension={snapshot.suspension} turn="spin" />

        {view.phase === 'final-settlement' ? (
          <EndingSteps
            facts={snapshot.facts}
            noneReturned="Nothing was on the table"
            settle={{ title: 'Final settlement', detail: 'Runs on its own. No more bets.' }}
            footer="Final settlement starts on its own. There's nothing to tap."
          />
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
              {strategy?.correction && !isPlayCorrection(strategy.correction) && view.phase === 'correction' && (
                <CorrectionPanel
                  copy={betCorrectionCopy(strategy.name, strategy.correction, strategy.overrideEndsCycle)}
                  table={{ phase: 'Strategy check before your spin', balance: formatUnits(view.balance), wagers: wagersText }}
                  fullScreen={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE}
                  busy={!ready}
                  onRetry={() => void controller.retryCorrection()}
                  onOverride={() => void controller.overrideCorrection()}
                />
              )}
              {strategy && view.phase === 'cycle-completion' && (
                <CycleResultPanel
                  strategy={strategy}
                  balance={view.balance}
                  rebought={view.funding.rebuys.length > 0}
                  describeTurn={describeTurn}
                  canRestart={legal('restart-cycle')}
                  canEnd={legal('request-stop')}
                  onRestart={() => void controller.restartCycle()}
                  onEnd={() => setConfirming(true)}
                />
              )}
              {strategy?.pending && (
                <PendingPanel
                  strategy={strategy}
                  pending={strategy.pending}
                  available={sumUnits(view.balance, totalOnTable(view))}
                  canRebuy={view.legalCommands.includes('rebuy') ? legal('rebuy') : null}
                  canOverride={legal('place-wager')}
                  canStop={legal('stop-strategy')}
                  onRebuy={() => setRebuying(true)}
                  onOverride={() => setPresentation('selector')}
                  onStop={() => setStoppingStrategy(true)}
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

      <TableDialogs
        view={view}
        ending={confirming}
        onCloseEnding={() => setConfirming(false)}
        stoppingStrategy={stoppingStrategy}
        onCloseStopping={() => setStoppingStrategy(false)}
        removable={view.wagersCommitted || view.wagers.length === 0 ? 'Nothing removable on the table' : wagersText}
        committed={view.wagersCommitted ? `${wagersText} settle with this spin.` : 'None between spins.'}
      />
    </View>
  );
}

/** A cycle's spin for the cycle result: "Spin 1 · 10 on Black", "Lost · 0 green". */
function describeTurn(turn: CycleTurn, index: number): TurnWords {
  const pocket: RoulettePocket = turn.outcome === '00' ? '00' : Number(turn.outcome);
  const result = turn.net.startsWith('-') ? 'Lost' : turn.net === '0' ? 'Even' : 'Won';
  return {
    title: `Spin ${index + 1} · ${betsText(turn.wagers)}${turn.followed ? '' : ' (override)'}`,
    detail: `${result} · ${describePocket(pocket)}`,
  };
}

const WHEEL_NAMES: Record<PermittedView['table']['wheel'], string> = { 'single-zero': 'Single zero', 'double-zero': 'Double zero' };

const SAVE_FAILED_ANNOUNCEMENT = "Couldn't save. Play is paused and will retry automatically.";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
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
});

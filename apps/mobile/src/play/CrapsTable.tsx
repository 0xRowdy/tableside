// The standard craps table (design frames "06 Craps — Roll result", S1-04
// "Craps come-out", "Craps, table + bet list", "Horn settled as four parts"
// and "Buy/lay commission on win only"). It renders only the engine's
// permitted view and forwards taps to the practice controller; it never
// advances the game or decides what is legal. Every wager states its working
// status in text, the stake editor gives working instructions, and committed
// contracts explain why they stay. The felt carries the line bets and the
// field; place, buy, lay, hardways and propositions are in the bet list.

import { crapsHouseEdge } from '@tableside/definitions';
import { CRAPS_POINTS, type CrapsPermittedView as PermittedView, type CycleTurn, type DomainFact } from '@tableside/engine';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { SAVE_RETRY_MS, type ActivePracticeSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { BetSelector } from './bet-selector/BetSelector';
import { draftAmountText, EMPTY_DRAFT, findChoice, isDraftPending, type BetDraft } from './bet-selector/catalog';
import { DraftBar, PresentationSwitch, type Presentation } from './bet-selector/Presentation';
import { betsText, CRAPS_WORDS, strategyFactSentence } from './coaching-text';
import { crapsCatalog, crapsPlacedWagers, placedToggle } from './craps-catalog';
import { EndSessionDialog } from './EndSessionDialog';
import { CorrectionPanel, CycleResultPanel, GuidedStrip, PendingPanel, StopStrategyDialog, type TurnWords } from './Guidance';
import { RebuySheet } from './RebuySheet';
import { commitmentText, crapsStatus, crapsTargetName, describeCrapsFacts, puckText, workingText } from './craps-text';
import { ACCESS_ENDED, ChipRack } from './RouletteTable';
import { totalOnTable } from './roulette-text';
import { formatUnits } from './units';
import { PhaseStepper, SessionStrip, TableTopBar, type PhaseStep } from './TableChrome';

type ActiveSnapshot = ActivePracticeSnapshot & { readonly view: PermittedView };

/** Above this text scale, a wide window stacks the felt and the controls so text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;

const SAVE_FAILED_ANNOUNCEMENT = "Couldn't save. Play is paused and will retry automatically.";

function phaseSteps(view: PermittedView): PhaseStep[] {
  const reached = { 'open-decision': 0, correction: 0, 'revealing-outcome': 1, 'settled-outcome': 2, 'cycle-completion': 2, 'final-settlement': 2, completed: 3 }[view.phase];
  return [view.table.point === null ? 'Come-out' : 'Betting', 'Roll', 'Settle'].map((label, index) => ({
    label,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }));
}

const rollText = (dice: readonly [number, number]) => `${dice[0]} and ${dice[1]}, total ${dice[0] + dice[1]}`;

/** The table's own words for a transition, then guided practice's (corrections, pending actions, cycles). */
function describe(facts: readonly DomainFact[], view: PermittedView): string | null {
  const parts = [describeCrapsFacts(facts, view), ...facts.map((fact) => strategyFactSentence(fact, CRAPS_WORDS))].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' ');
}

/** A cycle's roll for the cycle result: "Roll 3 · 12 on Place 6 and 12 on Place 8", "Rolled 4 and 2". */
function describeTurn(turn: CycleTurn, index: number): TurnWords {
  const [a, b] = turn.outcome.split('+');
  const result = turn.net.startsWith('-') ? 'Lost' : turn.net === '0' ? 'Even' : 'Won';
  const bets = turn.wagers.length === 0 ? 'nothing at stake' : betsText(turn.wagers, CRAPS_WORDS);
  return {
    title: `Roll ${index + 1} · ${bets}${turn.followed ? '' : ' (override)'}`,
    detail: `${result} · rolled ${a} and ${b}, total ${Number(a) + Number(b)}`,
  };
}

export function CrapsTable({ snapshot }: { snapshot: ActiveSnapshot }) {
  const { controller } = usePractice();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const [chip, setChip] = useState('25');
  const [confirming, setConfirming] = useState(false);
  const [rebuying, setRebuying] = useState(false);
  const [stoppingStrategy, setStoppingStrategy] = useState(false);
  // Held here, above both presentations, so rotation, resizing and switching keep the draft.
  const [presentation, setPresentation] = useState<Presentation>('table');
  const [draft, setDraft] = useState<BetDraft>(EMPTY_DRAFT);
  const { view, facts, busy, save } = snapshot;
  const { table } = view;
  const catalog = useMemo(() => crapsCatalog(view), [view]);
  const placed = useMemo(() => crapsPlacedWagers(view), [view]);
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
  const message = useMemo(() => describe(facts, view), [facts, view]);
  const strategy = view.strategy;
  const wagersText = view.wagers.length === 0 ? 'nothing' : view.wagers.map((wager) => `${crapsTargetName(wager.target)} ${formatUnits(wager.amount)}`).join(' · ');
  const contracts = view.wagers.filter((wager) => table.wagers.find((status) => status.target === wager.target)?.removable === false);
  const removable = view.wagers.filter((wager) => !contracts.includes(wager));
  const listText = (list: typeof view.wagers) => list.map((wager) => `${crapsTargetName(wager.target)} ${formatUnits(wager.amount)}`).join(' · ');
  const edge = (wager: 'pass' | 'dont-pass') => crapsHouseEdge(wager, { ...table.variant, odds: table.odds, field: table.field }).percent;

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
      if (nowFailed && !failed) AccessibilityInfo.announceForAccessibility(SAVE_FAILED_ANNOUNCEMENT);
      failed = nowFailed;
      if (latest.view.sequence === announced) return;
      announced = latest.view.sequence;
      // A state adopted from the store carries no facts of its own: restate where things stand.
      const text = describe(latest.facts, latest.view) ?? `${crapsStatus(latest.view)}. Balance ${formatUnits(latest.view.balance)}.`;
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
  // The stake editor sets the stake, then the working option (design frame
  // "Craps stake editor"); the option is given only once the stake is on the table.
  const setWager = async (target: string, amount: string, toggled: boolean | undefined) => {
    if (stakeOn(target) !== amount) {
      await controller.placeWager(target, amount);
      const placedNow = controller.snapshot();
      if (placedNow.status !== 'active' || !placedNow.facts.some((fact) => fact.kind === 'wager-changed' && fact.target === target)) return;
    }
    const latest = controller.snapshot();
    if (toggled === undefined || latest.status !== 'active' || latest.view.game !== 'craps') return;
    if (placedToggle(latest.view, target) !== toggled) await controller.setWorking(target, toggled);
  };

  return (
    <View style={styles.screen}>
      <ScrollView testID="table-scroll" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: space[6] }}>
        <TableTopBar
          title="Craps"
          subtitle={`${table.odds} odds · field 12 pays ${table.field === 'triple-12' ? '3:1' : '2:1'} · ${formatUnits(table.limits.flat.min)}–${formatUnits(table.limits.flat.max)} · props ${formatUnits(table.limits.props.min)}–${formatUnits(table.limits.props.max)}`}
          canEnd={legal('request-stop')}
          onEnd={() => setConfirming(true)}
        />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.edge}>
          House edge: pass and come {edge('pass')}% · don&apos;t pass and don&apos;t come {edge('dont-pass')}% · odds 0% · every other wager shows its edge where you choose it
        </Text>
        <PhaseStepper steps={phaseSteps(view)} />
        <SessionStrip
          balance={formatUnits(view.balance)}
          onTable={formatUnits(totalOnTable(view))}
          status={save === 'failed' ? 'Paused · not saved' : crapsStatus(view)}
        />
        {strategy && <GuidedStrip strategy={strategy} canStop={legal('stop-strategy')} onStop={() => setStoppingStrategy(true)} words={CRAPS_WORDS} />}
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
        {snapshot.ending === 'access-ended' && (
          <View style={styles.banner} testID="access-ended">
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>{ACCESS_ENDED}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              The dice roll on to settle only the bets already working. No new bets, odds or rolls of your own.
            </Text>
          </View>
        )}
        {snapshot.suspension?.kind === 'turn-boundary' && !snapshot.suspension.reached && (
          <View style={styles.banner}>
            <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Suspending after this roll</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>
              {snapshot.suspension.reason ?? 'This roll finishes normally. No new roll starts until the session resumes.'}
            </Text>
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
                  <Felt view={view} canPlace={canPlace} chip={chip} placeable={placeable} stakeOn={stakeOn} onSpot={addChip} />
                  <Button
                    label="Numbers and center bets"
                    variant="secondary"
                    hint="Opens the bet selector for place, buy, lay, hardways and propositions."
                    onPress={() => setPresentation('selector')}
                  />
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
                  onSet={(target, amount, toggled) => void setWager(target, amount, toggled)}
                  onRemove={(target) => void controller.placeWager(target, '0')}
                />
              )}
            </View>
            <View style={[styles.column, styles.controls]}>
              {strategy?.correction && view.phase === 'correction' && (
                <CorrectionPanel
                  strategyName={strategy.name}
                  correction={strategy.correction}
                  overrideEndsCycle={strategy.overrideEndsCycle}
                  table={{ phase: `Strategy check before your roll · ${puckText(table.point)}`, balance: formatUnits(view.balance), wagers: wagersText }}
                  fullScreen={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE}
                  busy={!ready}
                  onRetry={() => void controller.retryCorrection()}
                  onOverride={() => void controller.overrideCorrection()}
                  words={CRAPS_WORDS}
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
                  words={CRAPS_WORDS}
                />
              )}
              {strategy?.pending && (
                <PendingPanel
                  strategy={strategy}
                  pending={strategy.pending}
                  available={(BigInt(view.balance) + BigInt(totalOnTable(view))).toString()}
                  canRebuy={view.legalCommands.includes('rebuy') ? legal('rebuy') : null}
                  canOverride={legal('place-wager')}
                  canCollect={legal('collect-instead')}
                  canStop={legal('stop-strategy')}
                  onRebuy={() => setRebuying(true)}
                  onOverride={() => setPresentation('selector')}
                  onCollect={() => void controller.collectInstead()}
                  onStop={() => setStoppingStrategy(true)}
                  words={CRAPS_WORDS}
                />
              )}
              {message && (
                <Text maxFontSizeMultiplier={textScale.body} style={styles.message} testID="latest-event">
                  {message}
                </Text>
              )}
              <WagerList
                view={view}
                canPlace={canPlace}
                chip={chip}
                placeable={placeable}
                onAddOdds={addChip}
                onRemove={(target) => void controller.placeWager(target, '0')}
              />
              <Button label="Roll" stretch disabled={!legal('begin-turn')} onPress={() => void controller.beginTurn()} />
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
        removable={view.wagersCommitted || removable.length === 0 ? 'Nothing removable on the table' : listText(removable)}
        committed={
          view.wagersCommitted
            ? `${wagersText} settle with this roll.`
            : contracts.length === 0
              ? 'None between rolls.'
              : `${listText(contracts)} can't be taken down or refunded. The dice settle them as you play on.`
        }
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

/** The table spots, in felt order. Line spots open and close with the puck. */
const LINE_SPOTS: readonly { target: string; label: string; closed: string }[] = [
  { target: 'come', label: 'COME', closed: 'Come bets open once a point is set.' },
  { target: 'dont-come', label: "DON'T COME · BAR 12", closed: "Don't come bets open once a point is set." },
  { target: 'pass', label: 'PASS LINE', closed: 'Pass line bets are made before a come-out roll.' },
  { target: 'pass-odds', label: 'PASS ODDS', closed: 'Odds go behind the pass line once a point is set.' },
  { target: 'dont-pass', label: "DON'T PASS BAR 12", closed: "Don't pass bets are made before a come-out roll." },
  { target: 'dont-pass-odds', label: "DON'T PASS ODDS", closed: "Odds go behind don't pass once a point is set." },
  { target: 'field', label: 'FIELD · 2 3 4 9 10 11 12', closed: 'The field opens between rolls.' },
];

/** Every wager acting on box number n: come and don't come bets with their odds, place, buy and lay. */
const onNumber = (target: string, n: number) => new RegExp(`^((dont-)?come-${n}(-odds)?|(place|buy|lay)-${n})$`).test(target);

/** The short felt label of a wager in a number box: "come", "odds", "don't", "place". */
function boxLabel(target: string): string {
  if (target.endsWith('-odds')) return 'odds';
  if (target.startsWith('dont')) return "don't";
  return target.split('-')[0] as string;
}

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
          const bets = view.wagers.filter((wager) => onNumber(wager.target, n));
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
                  {boxLabel(wager.target)} {formatUnits(wager.amount)} · {workingText(view, wager.target)}
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
        const pays = spot.target === 'field' ? `1 to 1, 2 pays double, 12 pays ${view.table.field === 'triple-12' ? 'triple' : 'double'}` : (payout(spot.target) ?? '1 to 1');
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  edge: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground, paddingHorizontal: space[4] },
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
});

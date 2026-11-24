import { rouletteHouseEdge } from '@tableside/definitions';
import { isPlayCorrection, type CycleTurn, type RoulettePermittedView as PermittedView, type RoulettePocket } from '@tableside/engine';
import { useMemo, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import type { ActivePracticeSnapshot } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import { BetSelector } from './bet-selector/BetSelector';
import { betCorrectionCopy, betsText } from './coaching-text';
import { CorrectionPanel, CycleResultPanel, GuidedDetails, PendingPanel, type TurnWords } from './Guidance';
import { draftAmountText, EMPTY_DRAFT, findChoice, isDraftPending, type BetDraft } from './bet-selector/catalog';
import { DraftBar, PresentationSwitch, type Presentation } from './bet-selector/Presentation';
import { RebuySheet } from './RebuySheet';
import { rouletteCatalog, roulettePlacedWagers } from './roulette-catalog';
import { describeFacts, describePocket, STATUS, targetName } from './roulette-text';
import { formatUnits, sumUnits, totalOnTable } from './units';
import { RouletteFelt } from './RouletteFelt';
import {
  AccessStopBanner,
  ChipRack,
  DetailsRow,
  DetailsSection,
  RebuyDetails,
  EndingSteps,
  SaveFailedBanner,
  TableButtons,
  TableDialogs,
  TableHeader,
  TableLayout,
  TurnBoundaryBanner,
  useTableAllowance,
  useTableAnnouncements,
  type PhaseStep,
} from './TableChrome';

type ActiveSnapshot = ActivePracticeSnapshot & { readonly view: PermittedView };

const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;


function phaseSteps(view: PermittedView): PhaseStep[] {
  const reached = { 'open-decision': 0, correction: 0, 'revealing-outcome': 1, 'settled-outcome': 2, 'cycle-completion': 2, 'strategy-settlement': 2, 'final-settlement': 2, completed: 3 }[view.phase];
  return ['Betting', 'Spin', 'Settle'].map((label, index) => ({
    label,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }));
}

// Spec 1 S1-04 dbUaa
function limitRows(view: PermittedView): readonly (readonly [string, string])[] {
  const limit = (limitClass: 'inside' | 'outside') => {
    const placement = view.table.placements.find((p) => p.limitClass === limitClass);
    return placement ? `${formatUnits(placement.min)}–${formatUnits(placement.max)}` : '';
  };
  return [
    ['Wheel', WHEEL_NAMES[view.table.wheel]],
    ['Inside bets', limit('inside')],
    ['Outside bets', limit('outside')],
  ];
}

export function RouletteTable({ snapshot }: { snapshot: ActiveSnapshot }) {
  const styles = useStyles();
  const { controller } = usePractice();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const [chip, setChip] = useState('5');
  const [confirming, setConfirming] = useState(false);
  const [rebuying, setRebuying] = useState(false);
  const [stoppingStrategy, setStoppingStrategy] = useState(false);
  // docs/decisions/mobile-device-support-accessibility.md
  const [presentation, setPresentation] = useState<Presentation>('table');
  const [draft, setDraft] = useState<BetDraft>(EMPTY_DRAFT);
  const { view, facts, busy, save } = snapshot;
  const allowance = useTableAllowance('roulette');
  const catalog = useMemo(() => rouletteCatalog(view), [view]);
  const placed = useMemo(() => roulettePlacedWagers(view), [view]);
  const drafted = isDraftPending(draft, placed) ? findChoice(catalog, draft.target) : undefined;
  const rebuyOpen = rebuying && view.legalCommands.includes('rebuy');
  const addRebuy = async (amount: string) => {
    await controller.rebuy(amount);
    const latest = controller.snapshot();
    if (latest.status !== 'active' || latest.facts.some((fact) => fact.kind === 'funding-added')) setRebuying(false);
  };

  const ready = !busy && save === 'saved';
  const legal = (kind: PermittedView['legalCommands'][number]) => ready && view.legalCommands.includes(kind);
  const message = useMemo(() => describeFacts(facts, view), [facts, view]);

  useTableAnnouncements('roulette', announcement);

  const wagerOn = (target: string) => view.wagers.find((wager) => wager.target === target)?.amount;
  const addChip = (target: string) => {
    void controller.placeWager(target, sumUnits(wagerOn(target) ?? '0', chip));
  };
  const canPlace = legal('place-wager');
  const wagersText = view.wagers.length === 0 ? 'nothing' : view.wagers.map((wager) => `${targetName(wager.target)} ${formatUnits(wager.amount)}`).join(' · ');
  const strategy = view.strategy;

  const settling = view.phase === 'final-settlement';
  const wheel = view.table.wheel;
  const header = (
    <TableHeader
      title={strategy && strategy.status !== 'stopped' ? 'Roulette · Guided' : 'Roulette'}
      status={save === 'failed' ? 'Paused · not saved' : STATUS[view.phase]}
      steps={phaseSteps(view)}
      stats={[
        { label: 'Session balance', spoken: 'Session balance', value: formatUnits(view.balance) },
        { label: 'On table', spoken: 'On table', value: formatUnits(totalOnTable(view)) },
        ...(view.outcome ? [{ label: 'Last spin', spoken: 'Last spin:', value: describePocket(view.outcome.pocket) }] : []),
      ]}
      buttons={<TableButtons game="roulette" canEnd={legal('request-stop')} onEnd={() => setConfirming(true)} />}
      allowance={allowance}
      details={(close) => (
        <>
          {strategy && <GuidedDetails strategy={strategy} canStop={legal('stop-strategy')} onStop={() => { close(); setStoppingStrategy(true); }} />}
          <RebuyDetails shown={view.legalCommands.includes('rebuy')} enabled={legal('rebuy')} onRebuy={() => { close(); setRebuying(true); }} />
          <DetailsSection label="House edge">
            <DetailsRow label="Every bet" value={`${rouletteHouseEdge(wheel, 'straight')?.percent}%`} />
            {wheel === 'double-zero' && <DetailsRow label="Five-number basket" value={`${rouletteHouseEdge(wheel, 'basket')?.percent}%`} detail="0, 00, 1, 2, 3 · pays 6 to 1" />}
          </DetailsSection>
          <DetailsSection label="Rules">
            {limitRows(view).map(([label, value]) => (
              <DetailsRow key={label} label={label} value={value} />
            ))}
          </DetailsSection>
        </>
      )}
    >
      {save === 'failed' && <SaveFailedBanner busy={busy} onRetry={() => void controller.retrySave()} />}
      <AccessStopBanner ending={snapshot.ending} detail="Your bets settle automatically, then you'll see the session result." />
      <TurnBoundaryBanner suspension={snapshot.suspension} turn="spin" />
    </TableHeader>
  );

  return (
    <View style={styles.screen}>
      <TableLayout
        columns={sideBySide && !settling}
        header={header}
        body={
          settling ? (
            <EndingSteps
              facts={snapshot.facts}
              noneReturned="Nothing was on the table"
              settle={{ title: 'Final settlement', detail: 'Runs on its own. No more bets.' }}
              footer="Final settlement starts on its own. There's nothing to tap."
            />
          ) : (
            <>
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
                  game="roulette"
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
            </>
          )
        }
        footer={
          settling ? null : (
            <>
              <PresentationSwitch value={presentation} onChange={setPresentation} />
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
              <View style={styles.summary}>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.summaryTitle}>On table {formatUnits(totalOnTable(view))}</Text>
                <Text maxFontSizeMultiplier={textScale.body} style={styles.summaryText}>
                  {view.wagers.length === 0 ? 'No wagers yet' : wagersText}
                </Text>
              </View>
              <Button label="Spin" stretch disabled={!legal('begin-turn')} onPress={() => void controller.spin()} />
              {presentation === 'table' && <ChipRack chip={chip} onChoose={setChip} />}
            </>
          )
        }
      />

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

function describeTurn(turn: CycleTurn, index: number): TurnWords {
  const pocket: RoulettePocket = turn.outcome === '00' ? '00' : Number(turn.outcome);
  const result = turn.net.startsWith('-') ? 'Lost' : turn.net === '0' ? 'Even' : 'Won';
  return {
    title: `Spin ${index + 1} · ${betsText(turn.wagers)}${turn.followed ? '' : ' (override)'}`,
    detail: `${result} · ${describePocket(pocket)}`,
  };
}

const WHEEL_NAMES: Record<PermittedView['table']['wheel'], string> = { 'single-zero': 'Single zero', 'double-zero': 'Double zero' };

const announcement = ({ facts, view }: ActiveSnapshot) => describeFacts(facts, view) ?? `${STATUS[view.phase]}. Balance ${formatUnits(view.balance)}.`;

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  tableView: { gap: space[3] },
  message: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  sectionLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  summary: { gap: 2 },
  summaryTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  summaryText: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
}));

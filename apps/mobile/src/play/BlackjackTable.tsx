// Spec 1 S1-04

import { blackjackHouseEdge } from '@tableside/definitions';
import {
  decodeMoney,
  encodeMoney,
  INSURANCE_TARGET,
  isPlayCorrection,
  MAX_SPLIT_HANDS,
  money,
  mul,
  type BlackjackAction,
  type BlackjackCount,
  type BlackjackHandView,
  type BlackjackPermittedView,
  type Card,
} from '@tableside/engine';
import { useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import type { ActiveSnapshot as Active } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, objectType, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles, useTextStep } from '@/theme/type';

import { BetSelector } from './bet-selector/BetSelector';
import { draftAmountText, EMPTY_DRAFT, findChoice, isDraftPending, type BetDraft } from './bet-selector/catalog';
import { DraftBar, PresentationSwitch, type Presentation } from './bet-selector/Presentation';
import { blackjackCatalog, blackjackPlacedWagers } from './blackjack-catalog';
import { cardShort, countWorking, deviationRule, deviationsAtCount, playCorrectionCopy } from './blackjack-coaching';
import {
  cardName,
  cardRank,
  dealerSummary,
  describeFacts,
  handState,
  handSummary,
  handTotalText,
  inHand,
  isPlaying,
  presetOf,
  seatSummary,
  showingLastRound,
  signed,
  statusText,
  SUIT_GLYPH,
  totalText,
} from './blackjack-text';
import { betCorrectionCopy, BLACKJACK_WORDS } from './coaching-text';
import { CorrectionPanel, GuidedDetails, type TableNow } from './Guidance';
import { RebuySheet } from './RebuySheet';
import {
  AccessStopBanner,
  BlackjackFeltRules,
  ChipRack,
  DetailsRow,
  DetailsSection,
  RebuyDetails,
  FaceDownCard,
  FeltBadge,
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
import { capitalize, formatSigned, formatUnits, halfUnits, sumUnits, totalOnTable } from './units';

type ActiveSnapshot = Active<BlackjackPermittedView>;

const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;
const HAND = 'hand-1';
const announcement = ({ facts, view }: ActiveSnapshot) => describeFacts(facts, view) ?? `${statusText(view)}. Balance ${formatUnits(view.balance)}.`;


const SUIT_TOKEN = { spades: 'suitSpade', hearts: 'suitHeart', diamonds: 'suitDiamond', clubs: 'suitClub' } as const;

const ACTION_LABEL: Record<Exclude<BlackjackAction, 'decline-insurance'>, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};

function phaseSteps(view: BlackjackPermittedView): PhaseStep[] {
  const reached = view.phase === 'open-decision' || view.phase === 'correction' ? (inHand(view) ? 2 : 0) : view.phase === 'completed' ? 4 : 3;
  return ['Bet', 'Deal', 'Play', 'Settle'].map((label, index) => ({
    label,
    state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }));
}

// Spec 1 S1-04 iIMaW
function blackjackRules(view: BlackjackPermittedView): readonly (readonly [string, string])[] {
  const { table } = view;
  return [
    ['Decks', String(table.decks)],
    ['Dealer', table.dealer === 'S17' ? 'Stands on all 17s' : 'Hits soft 17'],
    ['Late surrender', table.lateSurrender ? 'Offered' : 'Not offered'],
    ['Blackjack pays', '3 to 2'],
    ['Bets', `${formatUnits(table.initial.min)}–${formatUnits(table.initial.max)}`],
    ['Penetration', `${table.penetration}%`],
  ];
}

const presetWords = ({ table }: BlackjackPermittedView) =>
  `${table.decks} decks, ${table.dealer === 'S17' ? 'dealer stands on all 17s' : 'dealer hits soft 17'}, ${table.lateSurrender ? 'late surrender' : 'no surrender'}`;

export function BlackjackTable({ snapshot }: { snapshot: ActiveSnapshot }) {
  const styles = useStyles();
  const { controller } = usePractice();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const [chip, setChip] = useState('25');
  const [lastBet, setLastBet] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rebuying, setRebuying] = useState(false);
  const [stoppingStrategy, setStoppingStrategy] = useState(false);
  // docs/decisions/mobile-device-support-accessibility.md
  const [presentation, setPresentation] = useState<Presentation>('table');
  const [draft, setDraft] = useState<BetDraft>(EMPTY_DRAFT);
  const { view, facts, busy, save } = snapshot;
  const allowance = useTableAllowance('blackjack');
  const catalog = useMemo(() => blackjackCatalog(view), [view]);
  const placed = useMemo(() => blackjackPlacedWagers(view), [view]);
  const drafted = isDraftPending(draft, placed) ? findChoice(catalog, draft.target) : undefined;

  const ready = !busy && save === 'saved';
  const legal = (kind: BlackjackPermittedView['legalCommands'][number]) => ready && view.legalCommands.includes(kind);
  const message = useMemo(() => describeFacts(facts, view), [facts, view]);
  const wager = view.wagers.find((w) => w.target === HAND)?.amount;
  const playing = isPlaying(view);
  const offer = view.insuranceOffer;
  const rebuyOpen = rebuying && view.legalCommands.includes('rebuy');
  const addRebuy = async (amount: string) => {
    await controller.rebuy(amount);
    const latest = controller.snapshot();
    if (latest.status !== 'active' || latest.facts.some((fact) => fact.kind === 'funding-added')) setRebuying(false);
  };

  useTableAnnouncements('blackjack', announcement);

  const addChip = () => void controller.placeWager(HAND, sumUnits(wager ?? '0', chip));
  const deal = () => {
    if (wager) setLastBet(wager);
    void controller.beginTurn();
  };
  const strategy = view.strategy;
  const correction = view.phase === 'correction' ? (strategy?.correction ?? null) : null;
  const held = correction && isPlayCorrection(correction) ? correction : null;
  const heldBet = correction && !isPlayCorrection(correction) ? correction : null;
  const betting = !correction && (!playing || offer !== null) && view.phase !== 'final-settlement';
  const rules = { dealer: view.table.dealer, lateSurrender: view.table.lateSurrender };
  const handsText = view.wagers.length === 0 ? 'nothing' : `${formatUnits(totalOnTable(view))} (${view.wagers.length === 1 ? 'one hand' : `${view.wagers.length} hands`})`;
  const selector = presentation === 'selector' && betting;
  const setWager = (target: string, amount: string) => void (target === INSURANCE_TARGET ? controller.insure(amount) : controller.placeWager(target, amount));

  const rulesRows = blackjackRules(view);
  const header = (
    <TableHeader
      title={strategy && strategy.status !== 'stopped' ? 'Blackjack · Guided' : 'Blackjack'}
      status={save === 'failed' ? 'Paused · not saved' : statusText(view)}
      steps={phaseSteps(view)}
      stats={[
        { label: 'Session balance', spoken: 'Session balance', value: formatUnits(view.balance) },
        { label: 'On table', spoken: 'On table', value: formatUnits(totalOnTable(view)) },
        ...(view.count ? [{ label: 'True count', spoken: 'True count', value: signed(view.count.trueCount) }] : []),
      ]}
      buttons={<TableButtons game="blackjack" canEnd={legal('request-stop')} onEnd={() => setConfirming(true)} />}
      allowance={allowance}
      details={(close) => (
        <>
          {strategy && <GuidedDetails strategy={strategy} detail={null} unit="decision" canStop={legal('stop-strategy')} onStop={() => { close(); setStoppingStrategy(true); }} />}
          {view.count && (
            <DetailsSection label="Count">
              <DetailsRow label="Supplied in this mode" value={`True count ${signed(view.count.trueCount)}`} detail={`${countWorking(view.count)}. Tableside recomputes it before every deal and decision.`} />
            </DetailsSection>
          )}
          <RebuyDetails shown={view.legalCommands.includes('rebuy')} enabled={legal('rebuy')} onRebuy={() => { close(); setRebuying(true); }} />
          <DetailsSection label="House edge">
            <DetailsRow label="With basic strategy" value={`${blackjackHouseEdge(presetOf(view)).percent}%`} detail={`For this preset: ${presetWords(view)}.`} />
          </DetailsSection>
          <DetailsSection label="Rules">
            {rulesRows.map(([label, value]) => (
              <DetailsRow key={label} label={label} value={value} />
            ))}
          </DetailsSection>
        </>
      )}
    >
      {save === 'failed' && <SaveFailedBanner busy={busy} onRetry={() => void controller.retrySave()} />}
      <AccessStopBanner
        ending={snapshot.ending}
        detail={`${playing ? 'Finish this hand; then it settles automatically' : 'Your bets settle automatically'}, then you'll see the session result.`}
      />
      <TurnBoundaryBanner suspension={snapshot.suspension} turn="round" />
    </TableHeader>
  );

  return (
    <View style={styles.screen}>
      <TableLayout
        columns={sideBySide}
        header={header}
        body={
          <>
            {view.count && <CountPanel view={view} count={view.count} betweenRounds={!inHand(view) && view.phase !== 'revealing-outcome'} />}
            {selector ? (
              <BetSelector
                game="blackjack"
                catalog={catalog}
                wagers={placed}
                balance={view.balance}
                canRebuy={view.legalCommands.includes('rebuy')}
                facts={facts}
                sequence={view.sequence}
                canPlace={legal('place-wager')}
                draft={draft}
                onDraftChange={setDraft}
                onSet={setWager}
                onRemove={(target) => void controller.placeWager(target, '0')}
              />
            ) : (
              <View style={styles.tableView}>
                {drafted && !playing && (
                  <DraftBar
                    name={drafted.choice.name}
                    amount={draftAmountText(draft.text)}
                    onEdit={() => {
                      setDraft({ ...draft, kind: drafted.kind.id });
                      setPresentation('selector');
                    }}
                  />
                )}
                <Felt view={view} result={lastResult(view, facts)} canBet={legal('place-wager')} chip={chip} wager={wager} onSpot={addChip} />
              </View>
            )}
          </>
        }
        footer={
          <>
            {betting && <PresentationSwitch value={presentation} onChange={setPresentation} />}
            {message && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.message} testID="latest-event">
                {message}
              </Text>
            )}
            {held && strategy ? (
              <CorrectionPanel
                copy={playCorrectionCopy(strategy.name, held, rules, view.count !== null ? 'supplied' : 'kept')}
                table={tableNow(view, handsText)}
                fullScreen={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE}
                busy={!ready}
                onRetry={() => void controller.retryCorrection()}
                onOverride={() => void controller.overrideCorrection()}
              />
            ) : heldBet && strategy ? (
              <CorrectionPanel
                copy={betCorrectionCopy(strategy.name, heldBet, strategy.overrideEndsCycle, BLACKJACK_WORDS, view.count === null)}
                table={tableNow(view, handsText)}
                fullScreen={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE}
                busy={!ready}
                onRetry={() => void controller.retryCorrection()}
                onOverride={() => void controller.overrideCorrection()}
              />
            ) : offer ? (
              <InsurancePanel
                view={view}
                enabled={legal('play')}
                onInsure={() => void controller.insure(offer.max)}
                onDecline={() => void controller.play('decline-insurance')}
              />
            ) : playing ? (
              <PlayActions view={view} enabled={legal('play')} explain={fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE} onPlay={(action) => void controller.play(action)} />
            ) : (
              <BettingActions
                view={view}
                wager={wager}
                lastBet={lastBet}
                canBet={legal('place-wager')}
                canDeal={legal('begin-turn')}
                onClear={() => void controller.placeWager(HAND, '0')}
                onRebet={(amount) => void controller.placeWager(HAND, amount)}
                onDeal={deal}
              />
            )}
            {betting && !playing && !selector && <ChipRack chip={chip} onChoose={setChip} from="5" spot="the bet spot" />}
            {inHand(view) && fontScale > SIDE_BY_SIDE_MAX_FONT_SCALE && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
                Finish this hand before ending the session.
              </Text>
            )}
          </>
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
        removable={view.wagersCommitted || view.wagers.length === 0 ? 'Nothing removable on the table' : `Your ${handsText} wager comes back`}
        committed={view.wagersCommitted ? `Your ${handsText} in play settles with this round.` : 'None between rounds.'}
      />
    </View>
  );
}

function tableNow(view: BlackjackPermittedView, handsText: string): TableNow {
  const round = view.outcome;
  const hands = round?.hands ?? [];
  const handLine = (hand: BlackjackHandView, index: number) =>
    `${hands.length > 1 ? `Hand ${index + 1} of ${hands.length}` : 'Your hand'}: ${hand.cards.map(cardShort).join(' ')}, ${handTotalText(hand)}${round?.active === index ? ' (deciding)' : ''}`;
  const dealer = round?.dealer.cards ?? [];
  const up = dealer[0];
  const others = (round?.others ?? []).flatMap((seat) => seat.hands.map((hand) => `Seat ${seat.seat}: ${hand.cards.map(cardShort).join(' ')}, ${handTotalText(hand)}`));
  return {
    phase: '3 Play · your decision',
    cards: [...hands.map(handLine), `Dealer: ${up ? cardShort(up) : 'no card'} showing${dealer.includes(null) ? ', one card face down' : ''}`, ...others],
    balance: formatUnits(view.balance),
    wagers: handsText,
  };
}

function CountPanel({ view, count, betweenRounds }: { view: BlackjackPermittedView; count: BlackjackCount; betweenRounds: boolean }) {
  const styles = useStyles();
  const { at, next } = deviationsAtCount(view.deviations, count.trueCount);
  return (
    <View
      style={styles.countPanel}
      testID="count-panel"
      accessible
      accessibilityLabel={`Count supplied in this mode: true count ${signed(count.trueCount)}. Running count ${signed(count.running)}, ${count.decks} decks left.${betweenRounds && at ? ` Deviation at this count: ${deviationRule(at)}.` : ''}${betweenRounds && next ? ` Next index: ${next.situation} at ${signed(next.threshold)}.` : ''}`}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>{countWorking(count)}</Text>
      {betweenRounds && at && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.countHint}>Deviation at this count: {deviationRule(at)}</Text>
      )}
      {betweenRounds && next && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
          Next: {next.situation} at {signed(next.threshold)}
        </Text>
      )}
    </View>
  );
}

function Felt({
  view,
  result: settledNet,
  canBet,
  chip,
  wager,
  onSpot,
}: {
  view: BlackjackPermittedView;
  result: string | null;
  canBet: boolean;
  chip: string;
  wager: string | undefined;
  onSpot: () => void;
}) {
  const styles = useStyles();
  const round = view.outcome;
  const hands = round?.hands ?? [];
  const last = showingLastRound(view);
  return (
    <View style={styles.felt} testID="felt">
      <View style={styles.feltTop}>
        <View style={styles.flex} />
        <View
          accessible
          accessibilityLabel={`Shoe: ${view.shoe.remaining} cards left${view.shoe.shuffleBeforeNextRound && round ? '. The cut card is out: a fresh shoe next round' : ''}`}
          style={styles.shoe}
        >
          <Text maxFontSizeMultiplier={textScale.body} style={styles.shoeLabel}>SHOE</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.shoeCount}>{view.shoe.remaining}</Text>
        </View>
      </View>

      <Text maxFontSizeMultiplier={textScale.body} style={styles.feltLabel}>DEALER</Text>
      <View accessible accessibilityLabel={dealerSummary(view)} style={styles.handRow}>
        {round ? round.dealer.cards.map((card, index) => <PlayingCard key={index} card={card} />) : <EmptyCards />}
        {round && <FeltBadge text={totalText(round.dealer.total)} />}
      </View>

      <BlackjackFeltRules dealer={view.table.dealer} />

      {round && round.others.length > 0 && (
        <View style={styles.others} testID="other-players">
          <Text maxFontSizeMultiplier={textScale.body} style={styles.feltLabel}>OTHER PLAYERS</Text>
          {round.others.map((seat) =>
            seat.hands.map((hand, index) => (
              <View
                key={hand.target}
                accessible
                accessibilityLabel={seatSummary(seat.seat, hand, index, seat.hands.length, view)}
                style={[styles.handRow, last && styles.lastRound]}
              >
                <Text maxFontSizeMultiplier={textScale.body} style={styles.seatLabel}>
                  {seat.hands.length > 1 ? `Seat ${seat.seat} · ${index + 1}` : `Seat ${seat.seat}`}
                </Text>
                {hand.cards.map((card, i) => (
                  <PlayingCard key={i} card={card} small />
                ))}
                <FeltBadge text={capitalize(handTotalText(hand))} />
              </View>
            )),
          )}
        </View>
      )}

      {hands.length > 1 ? (
        <View style={styles.splitHands} testID="split-hands">
          {hands.map((hand, index) => (
            <SplitHand key={hand.target} view={view} hand={hand} index={index} last={last} />
          ))}
        </View>
      ) : (
        <View accessible accessibilityLabel={handSummary(view)} style={[styles.handRow, last && styles.lastRound]}>
          {hands[0] ? hands[0].cards.map((card, index) => <PlayingCard key={index} card={card} />) : <EmptyCards />}
          {hands[0] && <FeltBadge text={`${capitalize(handTotalText(hands[0]))}${handNote(hands[0])}`} />}
        </View>
      )}
      {settledNet && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.result}>
          {settledNet}
        </Text>
      )}

      <BetSpot wager={wager} chip={chip} disabled={!canBet} onPress={onSpot} committed={view.wagersCommitted} />
    </View>
  );
}

function lastResult(view: BlackjackPermittedView, facts: ActiveSnapshot['facts']): string | null {
  if (view.phase !== 'settled-outcome') return null;
  const results = facts.flatMap((fact) => (fact.kind === 'wager-settled' && fact.target !== INSURANCE_TARGET ? [fact] : []));
  const word = (result: string) => (result === 'win' ? 'Win' : result === 'push' ? 'Push' : 'Loss');
  const [only] = results;
  if (results.length === 1 && only) return `${word(only.result)} ${formatSigned(only.net)}`;
  return results.length === 0 ? null : results.map((fact, i) => `Hand ${i + 1} ${word(fact.result).toLowerCase()} ${formatSigned(fact.net)}`).join(' · ');
}

const handNote = (hand: BlackjackHandView) => (hand.surrendered ? ' · surrendered' : hand.doubled ? ' · doubled' : '');

function SplitHand({ view, hand, index, last }: { view: BlackjackPermittedView; hand: BlackjackHandView; index: number; last: boolean }) {
  const styles = useStyles();
  const active = inHand(view) && view.outcome?.active === index;
  const stake = view.wagers.find((wager) => wager.target === hand.target)?.amount;
  return (
    <View
      accessible
      accessibilityLabel={handSummary(view, index)}
      style={[styles.splitHand, active && styles.splitHandActive, last && styles.lastRound]}
    >
      <View style={styles.handRow}>
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} small />
        ))}
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.splitLabel}>
        {`${index + 1} · ${handTotalText(hand)}${stake ? ` · ${formatUnits(stake)}` : ''}`}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.splitState, active && styles.splitStateActive]}>
        {capitalize(handState(hand, index, view))}
      </Text>
    </View>
  );
}

function PlayingCard({ card, small = false }: { card: Card | null; small?: boolean }) {
  const styles = useStyles();
  if (card === null) return <FaceDownCard />;
  const color = palette[SUIT_TOKEN[card.suit]];
  return (
    <View accessible accessibilityLabel={cardName(card)} style={[styles.card, small && styles.cardSmall]}>
      <Text maxFontSizeMultiplier={1} style={[styles.cardRank, small && styles.cardRankSmall, { color }]}>{cardRank(card)}</Text>
      <Text maxFontSizeMultiplier={1} style={[styles.cardPip, small && styles.cardPipSmall, { color }]}>{SUIT_GLYPH[card.suit]}</Text>
    </View>
  );
}

function EmptyCards() {
  const styles = useStyles();
  return <View style={[styles.card, styles.cardEmpty]} />;
}

function BetSpot({ wager, chip, disabled, onPress, committed }: { wager: string | undefined; chip: string; disabled: boolean; onPress: () => void; committed: boolean }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Initial wager, blackjack pays 3 to 2"
      accessibilityHint={disabled ? (committed ? 'In play until the hand settles.' : undefined) : `Adds ${formatUnits(chip)}.`}
      accessibilityValue={{ text: wager ? `${formatUnits(wager)} on it${committed ? ', in play' : ''}` : 'no wager' }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      style={[styles.betSpot, wager !== undefined && styles.betSpotWagered, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.betSpotText}>{wager ? formatUnits(wager) : 'BET'}</Text>
      {committed && <Text maxFontSizeMultiplier={textScale.body} style={styles.betSpotState}>IN PLAY</Text>}
    </Pressable>
  );
}

type TableAction = keyof typeof ACTION_LABEL;

function unavailable(action: TableAction, view: BlackjackPermittedView): string | null {
  if (view.playActions.includes(action)) return null;
  switch (action) {
    case 'double':
      return 'Double isn’t available: you can double only on your first two cards.';
    case 'split':
      return (view.outcome?.hands.length ?? 1) >= MAX_SPLIT_HANDS ? 'Split is off: four hands is the maximum.' : 'Split isn’t available: your cards aren’t a pair.';
    case 'surrender':
      return 'Surrender is only on your first two cards.';
    default:
      return null;
  }
}

// Spec 1 Amendment 12 §5
const actionRows = <T,>(actions: readonly T[], perRow: number): T[][] =>
  Array.from({ length: Math.ceil(actions.length / perRow) }, (_, i) => actions.slice(i * perRow, i * perRow + perRow));

function PlayActions({ view, enabled, explain, onPlay }: { view: BlackjackPermittedView; enabled: boolean; explain: boolean; onPlay: (action: BlackjackAction) => void }) {
  const styles = useStyles();
  const offered = (action: BlackjackAction) => view.playActions.includes(action);
  const actions: TableAction[] = ['hit', 'stand', 'double', 'split', ...(view.table.lateSurrender ? (['surrender'] as const) : [])];
  const rows = actionRows(actions, useTextStep() === 'larger' ? 2 : 3);
  const reasons = rows.flat().flatMap((action) => unavailable(action, view) ?? []);
  const round = view.outcome;
  const active = round?.active != null ? round.hands[round.active] : undefined;
  const stake = view.wagers.find((wager) => wager.target === active?.target)?.amount;
  const surrender =
    offered('surrender') && stake
      ? `${round?.dealer.peek === 'no-blackjack' ? 'The dealer checked for blackjack and has none. ' : ''}Late surrender is only on your first two cards. Surrendering returns half your bet (${formatUnits(halfUnits(stake))}) and ends the hand.`
      : null;
  const hint = (action: TableAction) => unavailable(action, view) ?? (action === 'surrender' ? surrender : null) ?? undefined;
  return (
    <View style={styles.actions}>
      {rows.map((row, i) => (
        <View key={i} style={styles.actionRow}>
          {row.map((action) => (
            <View key={action} style={styles.action}>
              <Button label={ACTION_LABEL[action]} variant="secondary" stretch hint={hint(action)} disabled={!enabled || !offered(action)} onPress={() => onPlay(action)} />
            </View>
          ))}
        </View>
      ))}
      {explain && reasons.length > 0 && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
          {reasons.join(' ')}
          {(round?.hands.length ?? 1) > 1 ? ' Hands play left to right; split aces get one card each and can’t be resplit.' : ''}
        </Text>
      )}
      {explain && surrender && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
          {surrender}
        </Text>
      )}
    </View>
  );
}

function InsurancePanel({
  view,
  enabled,
  onInsure,
  onDecline,
}: {
  view: BlackjackPermittedView;
  enabled: boolean;
  onInsure: () => void;
  onDecline: () => void;
}) {
  const styles = useStyles();
  const offer = view.insuranceOffer;
  const bet = view.wagers[0]?.amount;
  if (!offer || !bet) return null;
  const max = formatUnits(offer.max);
  const natural = formatUnits(encodeMoney(mul(decodeMoney(bet), money(3n, 2n))));
  return (
    <View style={styles.decision} testID="insurance-decision">
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.decisionTitle}>
        {offer.evenMoney ? 'Even money?' : 'Insurance?'}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.decisionText}>
        {offer.evenMoney
          ? `You have blackjack and the dealer shows an ace. Even money pays ${formatUnits(bet)} now (1:1), whatever the dealer has. It’s the same as insuring your blackjack for ${max}.`
          : `The dealer shows an ace. Before checking for blackjack, you can insure up to half your bet, so up to ${max}. Insurance pays 2:1 and settles separately from your hand.`}
      </Text>
      <View style={styles.actionRow}>
        <View style={styles.action}>
          <Button label={offer.evenMoney ? `Take even money (${formatUnits(bet)})` : `Insure ${max}`} stretch disabled={!enabled} onPress={onInsure} />
        </View>
        <View style={styles.action}>
          <Button label={offer.evenMoney ? 'No, play it out' : 'No insurance'} variant="secondary" stretch disabled={!enabled} onPress={onDecline} />
        </View>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.hint}>
        {offer.evenMoney
          ? `If you decline and the dealer also has blackjack, your hand pushes. Otherwise it pays 3:2 (${natural}).`
          : `${view.table.lateSurrender ? 'Late surrender is still available after the peek. ' : ''}The amount can be lower: choose it in the bet list.`}
      </Text>
    </View>
  );
}

function BettingActions({
  view,
  wager,
  lastBet,
  canBet,
  canDeal,
  onClear,
  onRebet,
  onDeal,
}: {
  view: BlackjackPermittedView;
  wager: string | undefined;
  lastBet: string | null;
  canBet: boolean;
  canDeal: boolean;
  onClear: () => void;
  onRebet: (amount: string) => void;
  onDeal: () => void;
}) {
  const styles = useStyles();
  if (view.phase === 'final-settlement' || view.phase === 'revealing-outcome' || view.phase === 'correction') return null;
  return (
    <View style={styles.actions}>
      <View style={styles.actionRow}>
        <View style={styles.action}>
          <Button label="Clear" variant="secondary" stretch disabled={!canBet || wager === undefined} onPress={onClear} />
        </View>
        {lastBet && wager === undefined && (
          <View style={styles.action}>
            <Button label={`Rebet ${formatUnits(lastBet)}`} variant="secondary" stretch disabled={!canBet} onPress={() => onRebet(lastBet)} />
          </View>
        )}
      </View>
      <Button label="Deal" stretch disabled={!canDeal} onPress={onDeal} />
    </View>
  );
}

const CARD_WIDTH = 56;

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  tableView: { gap: space[2] },
  message: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  hint: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  countPanel: { gap: 2, marginHorizontal: space[4], marginTop: space[2], padding: space[3], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  countHint: { fontFamily: fonts.uiMedium, ...type.secondary, color: palette.foreground },
  felt: { gap: space[3], padding: space[4], marginHorizontal: space[2], borderRadius: radius.lg, backgroundColor: palette.felt, alignItems: 'center' },
  feltTop: { flexDirection: 'row', alignSelf: 'stretch' },
  shoe: { minWidth: 52, paddingVertical: space[1], paddingHorizontal: space[2], borderRadius: radius.sm, backgroundColor: palette.feltDeep, alignItems: 'center' },
  shoeLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  shoeCount: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  feltLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  lastRound: { opacity: 0.85 },
  card: {
    width: CARD_WIDTH,
    minHeight: 80,
    padding: space[1],
    borderRadius: radius.sm,
    backgroundColor: palette.cardFace,
    justifyContent: 'space-between',
  },
  cardEmpty: { backgroundColor: palette.transparent, borderWidth: 1, borderColor: palette.feltText, borderStyle: 'dashed' },
  cardRank: { fontFamily: fonts.uiBold, fontSize: objectType.card.rank },
  cardPip: { fontSize: objectType.card.pip, alignSelf: 'flex-end' },
  cardSmall: { width: 40, minHeight: 58 },
  cardRankSmall: { fontSize: objectType.splitCard.rank },
  cardPipSmall: { fontSize: objectType.splitCard.pip },
  others: { alignSelf: 'stretch', gap: space[2], alignItems: 'center' },
  seatLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  splitHands: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] },
  splitHand: { alignItems: 'center', gap: space[1], padding: space[1], borderRadius: radius.md, borderWidth: 2, borderColor: palette.transparent },
  splitHandActive: { borderColor: palette.primary },
  splitLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  splitState: { fontFamily: fonts.uiMedium, ...type.caption, color: palette.feltText },
  splitStateActive: { fontFamily: fonts.uiBold, textDecorationLine: 'underline' },
  decision: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary },
  decisionTitle: { fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  decisionText: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  result: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.feltText },
  betSpot: {
    minWidth: 88,
    minHeight: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: palette.feltText,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.feltDeep,
  },
  betSpotWagered: { borderColor: palette.cardFace, borderWidth: 3 },
  betSpotText: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.feltText },
  betSpotState: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  focused: { borderColor: palette.ring, borderWidth: 3 },
  actions: { gap: space[2] },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  action: { flexGrow: 1, flexBasis: 96 },
}));

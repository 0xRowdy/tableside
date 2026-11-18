// Spec 3 Screens › Exercise (table); S3-07 v82z3, AcmMa, E3Gbeh, kLgWV, qRHlC, j4X6V, fiCRg; #137–#139

import type { ChallengeEntry, ChallengeView, LearnFeedback, PlayChoice, TableHandView, TableView } from '@tableside/engine';
import { ArrowRight, Ban, ChevronsRight, CircleDot, Coins, Hand, Info, Layers, Shuffle, Wallet } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { PlayingCard } from '@/counting/CardChoices';
import { signed } from '@/play/blackjack-text';
import { FirstUseHint } from '@/lessons/FirstUseHints';
import { CorrectionPanel } from '@/play/Guidance';
import { formatUnits } from '@/play/units';
import { BlackjackFeltRules, FaceDownCard, FeltBadge, PhaseStepper, StatStrip, type PhaseStep } from '@/play/TableChrome';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { conversionText } from '@/training/blackjack-conversion-text';
import {
  ATTEMPT_BALANCE,
  ATTEMPT_BALANCE_SPOKEN,
  BET_KICKER,
  betBadge,
  betCorrectionCopy,
  betLabel,
  betText,
  CHECK_BET_NOTE,
  CHOOSE_ANOTHER,
  FUNDING_KICKER,
  FUNDING_TITLE,
  fundingText,
  FUNDS_KICKER,
  FUNDS_NOTE,
  fundsRefusedText,
  OPENING_WAGER,
  overrideText,
  overrideTitle,
  placeLabel,
  checkpointText,
  checkpointTitle,
  CHOOSE_AGAIN,
  CONTINUE,
  DECISION_PROMPT_NOTE,
  HAND_MOVES,
  INSURANCE_MOVES,
  insureLabel,
  MOVE_LABEL,
  moveText,
  PLAY_DEAL_KICKER,
  PLAY_DEAL_TEXT,
  PLAY_KICKER,
  REFUSED_KICKER,
  refusedText,
  tableCorrectionCopy,
  YOU_PLAY,
  YOUR_MOVE,
  continueText,
  DEALER,
  decksText,
  enteredLine,
  handText,
  KEEP_THE_COUNT,
  NEW_SHOE,
  NEXT_TRUE_COUNT,
  OBSERVE_KICKER,
  observeText,
  ONLY_FIRST_SCORED,
  PHASES,
  ROUND_LABEL,
  ROUND_SPOKEN,
  roundOf,
  RUNNING_COUNT,
  RUNNING_KICKER,
  runningHeadline,
  seatActionText,
  seatName,
  SHOW_ANSWER,
  SHUFFLED_TITLE,
  shuffledText,
  SIMULATED,
  STATUS_TEXT,
  tableRecordedText,
  tableRunningText,
  TRUE_COUNT,
  TRY_AGAIN,
  YOUR_SEAT,
  YOUR_SEAT_SPOKEN,
  type TableStatus,
} from '@/training/blackjack-table-text';
import { COACH_NAME, CONVERSION_KICKER, NEXT_CARD } from '@/training/challenge-text';
import type { LearnerCommand } from '@/training/service';

import { CountAid } from './CountAid';
import { CoachButton } from './CoachButton';
import { CountEntry } from './CountEntry';

function status(view: ChallengeView, table: TableView): TableStatus {
  if (view.variant === 'learn' && view.feedback) return 'feedback';
  if (view.phase === 'correction') return 'correction';
  if (table.bet) return 'betting';
  if (table.step === 'shuffle') return 'shuffled';
  if (table.decision) return view.variant === 'check' ? 'check-deciding' : 'deciding';
  if (table.prompt?.timing === 'decision') return 'count-first';
  if (table.prompt) return 'checkpoint';
  return table.seat === 'play' ? 'dealing' : 'observing';
}

// Spec 3 S3-07 v82z3, bh8oE, heGUV
function phaseSteps(table: TableView): PhaseStep[] {
  const dealt = table.dealer.cards.length;
  let reached = 3;
  if (table.step === 'shuffle' || (table.prompt?.timing === 'before-bet' && dealt === 0)) reached = 0;
  else if (dealt < 2) reached = 1;
  else if (!table.settled) reached = 2;
  return PHASES.map((label, index) => ({ label, state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming' }));
}

// Spec 3 S3-07 v82z3, heGUV
export function TableProgress({ view, table, timer }: { view: ChallengeView; table: TableView; timer: ReactNode }) {
  return (
    <>
      <PhaseStepper steps={phaseSteps(table)} />
      {timer && <View style={styles.timer}>{timer}</View>}
      <StatStrip
        stats={[
          // Spec 3 S3-07 fiCRg; Amendment 2 §3; #139
          table.challengeBalance
            ? { label: ATTEMPT_BALANCE, spoken: ATTEMPT_BALANCE_SPOKEN, value: formatUnits(table.challengeBalance.balance) }
            : { label: YOUR_SEAT, spoken: YOUR_SEAT_SPOKEN, value: table.seat === 'play' ? YOU_PLAY : SIMULATED },
          { label: ROUND_LABEL, spoken: ROUND_SPOKEN, value: roundOf(table) },
        ]}
        status={STATUS_TEXT[status(view, table)]}
      />
    </>
  );
}

export function TableBody({
  view,
  table,
  ready,
  onCommand,
  onInputRejected,
}: {
  view: ChallengeView;
  table: TableView;
  ready: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
}) {
  const feedback = view.variant === 'learn' ? view.feedback : null;
  const entered = view.variant === 'check' ? view.entered : null;
  return (
    <>
      <Felt table={table} />
      <View style={styles.panel}>
        {table.step === 'shuffle' && <ShufflePanel table={table} enabled={ready} onContinue={() => onCommand({ kind: 'next-item' })} />}
        {(table.step === 'deal' || table.step === 'reveal') && (
          <>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
              {table.seat === 'play' ? PLAY_DEAL_KICKER : OBSERVE_KICKER}
            </Text>
            <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.panelTitle}>
              {KEEP_THE_COUNT}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
              {table.seat === 'play' ? PLAY_DEAL_TEXT : observeText(table)}
            </Text>
            <Button label={NEXT_CARD} icon={ChevronsRight} stretch disabled={!ready} onPress={() => onCommand({ kind: 'next-item' })} />
          </>
        )}
        {table.bet && view.phase === 'bet' && <BetPanel key={view.sequence} view={view} table={table} ready={ready} onCommand={onCommand} />}
        {table.decision && view.phase === 'decision' && <DecisionPanel key={view.sequence} view={view} table={table} ready={ready} onCommand={onCommand} />}
        {view.variant === 'learn' && view.betCorrection && (
          <CorrectionPanel
            copy={betCorrectionCopy(view.betCorrection)}
            table={null}
            fullScreen={false}
            busy={!ready}
            onRetry={() => onCommand({ kind: 'retry-correction' })}
            onOverride={() => onCommand({ kind: 'override-correction' })}
          />
        )}
        {view.variant === 'learn' && view.correction && (
          <CorrectionPanel
            copy={tableCorrectionCopy(view.correction, table)}
            table={null}
            fullScreen={false}
            busy={!ready}
            onRetry={() => onCommand({ kind: 'retry-correction' })}
            onOverride={() => onCommand({ kind: 'override-correction' })}
          />
        )}
        {table.prompt && <CheckpointPanel view={view} table={table} feedback={feedback} entered={entered} ready={ready} onCommand={onCommand} onInputRejected={onInputRejected} />}
        {view.countAid && <FirstUseHint id="show-count" />}
        {view.countAid && <CountAid key={view.attemptId} variant={view.variant} aid={view.countAid} enabled={ready && view.legalCommands.includes('reveal-count')} onReveal={() => onCommand({ kind: 'reveal-count' })} />}
      </View>
    </>
  );
}

function CheckpointPanel({
  view,
  table,
  feedback,
  entered,
  ready,
  onCommand,
  onInputRejected,
}: {
  view: ChallengeView;
  table: TableView;
  feedback: LearnFeedback | null;
  entered: ChallengeEntry | null;
  ready: boolean;
  onCommand: (command: LearnerCommand) => void;
  onInputRejected: () => void;
}) {
  const prompt = table.prompt as NonNullable<TableView['prompt']>;
  const answering = ready && view.legalCommands.includes('answer');
  const pairs = prompt.timing !== 'after-round';
  return (
    <>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.checkpointTitle}>
        {checkpointTitle(prompt, table.round)}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
        {checkpointText(table)}
      </Text>
      {view.phase === 'question' && <FirstUseHint id="count-entry" />}
      {view.phase === 'question' && (
        <CountEntry
          key={view.sequence}
          label={prompt.count === 'running' ? RUNNING_COUNT : TRUE_COUNT}
          range={view.countRange ?? { min: 0, max: 0 }}
          enabled={answering}
          submitLabel={prompt.count === 'running' && pairs ? NEXT_TRUE_COUNT : undefined}
          onSubmit={(value) => onCommand({ kind: 'answer', value })}
          onSkip={() => onCommand({ kind: 'skip' })}
          onRejected={onInputRejected}
        />
      )}
      {view.phase === 'recorded' && entered !== null && (
        <View style={styles.recorded} accessibilityLiveRegion="polite" testID="recorded-notice">
          <CircleDot color={palette.foreground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.recordedText}>
            {tableRecordedText(entered, prompt.count, prompt.count === 'running' && pairs, prompt.timing === 'decision')}
          </Text>
        </View>
      )}
      {prompt.timing === 'decision' && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText} testID="decision-prompt-note">
          {DECISION_PROMPT_NOTE}
        </Text>
      )}
      {feedback && <TableCoach feedback={feedback} timing={prompt.timing} count={prompt.count} canRetry={view.legalCommands.includes('retry-item')} enabled={ready} onCommand={onCommand} />}
    </>
  );
}

// Spec 3 S3-07 E3Gbeh, kLgWV; User stories 37, 38
function DecisionPanel({ view, table, ready, onCommand }: { view: ChallengeView; table: TableView; ready: boolean; onCommand: (command: LearnerCommand) => void }) {
  const decision = table.decision as NonNullable<TableView['decision']>;
  const [dismissed, setDismissed] = useState(false);
  const enabled = ready && view.legalCommands.includes('play');
  const moves = decision.kind === 'insurance' ? INSURANCE_MOVES : HAND_MOVES.filter((move) => move !== 'surrender' || table.rules.lateSurrender);
  const label = (move: PlayChoice) => (move === 'insure' ? insureLabel(table.rules.minimum) : MOVE_LABEL[move]);
  const shortfall = decision.refusal === 'funds' ? decision.unaffordable.find((item) => item.action === decision.refused) : undefined;
  if (shortfall && !dismissed) {
    // Spec 3 Play challenge funding › Mid-round shortfalls; S3-07 RDS5F; #139
    return (
      <View style={styles.refused} accessibilityLiveRegion="polite" testID="move-unaffordable">
        <View style={styles.refusedHead}>
          <Wallet color={palette.foreground} size={18} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
            {FUNDS_KICKER}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.refusedText}>
          {fundsRefusedText(shortfall.action, shortfall.amount, table.challengeBalance?.balance ?? '0')}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
          {FUNDS_NOTE}
        </Text>
        <Button label={CHOOSE_AGAIN} stretch disabled={!enabled} onPress={() => setDismissed(true)} />
      </View>
    );
  }
  if (decision.refused && !dismissed) {
    const refused = refusedText(table, decision.refused, view.variant);
    return (
      <View style={styles.refused} accessibilityLiveRegion="polite" testID="move-refused">
        <View style={styles.refusedHead}>
          <Ban color={palette.foreground} size={18} />
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
            {REFUSED_KICKER}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={textScale.display} style={styles.checkpointTitle}>
          {refused.title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
          {refused.detail}
        </Text>
        <Button label={CHOOSE_AGAIN} stretch disabled={!enabled} onPress={() => setDismissed(true)} />
      </View>
    );
  }
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {PLAY_KICKER}
      </Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.panelTitle}>
        {YOUR_MOVE}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
        {moveText(table)}
      </Text>
      <View style={styles.moves}>
        {moves.map((move) => (
          <View key={move} style={styles.move}>
            <Button label={label(move)} variant="secondary" stretch disabled={!enabled} onPress={() => onCommand({ kind: 'play', action: move })} />
          </View>
        ))}
      </View>
    </>
  );
}

// Spec 3 Play challenge funding; S3-07 fiCRg, qvatd; Amendment 1 C4; #139
function BetPanel({ view, table, ready, onCommand }: { view: ChallengeView; table: TableView; ready: boolean; onCommand: (command: LearnerCommand) => void }) {
  const bet = table.bet as NonNullable<TableView['bet']>;
  const [confirming, setConfirming] = useState<string | null>(null);
  const enabled = ready && view.legalCommands.includes('bet');
  if (confirming !== null) {
    return (
      <View style={styles.refused} testID="betting-override">
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.checkpointTitle}>
          {overrideTitle(confirming, table.betSchedule)}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
          {overrideText(table.betSchedule)}
        </Text>
        <Button label={placeLabel(confirming)} stretch disabled={!enabled} onPress={() => onCommand({ kind: 'bet', amount: confirming })} />
        <Button label={CHOOSE_ANOTHER} variant="secondary" stretch disabled={!enabled} onPress={() => setConfirming(null)} />
      </View>
    );
  }
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {bet.notice ? FUNDING_KICKER : BET_KICKER}
      </Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.panelTitle}>
        {bet.notice ? FUNDING_TITLE : OPENING_WAGER}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
        {bet.notice ? fundingText(table.challengeBalance?.balance ?? '0', bet.amounts) : betText(table.round)}
      </Text>
      <View style={styles.moves}>
        {bet.amounts.map((amount) => (
          <View key={amount} style={styles.move}>
            <Button
              label={betLabel(amount)}
              icon={Coins}
              variant="secondary"
              stretch
              disabled={!enabled}
              onPress={() => (bet.notice ? setConfirming(amount) : onCommand({ kind: 'bet', amount }))}
            />
          </View>
        ))}
      </View>
      {view.variant === 'check' && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
          {CHECK_BET_NOTE}
        </Text>
      )}
    </>
  );
}

// Spec 3 S3-07 AcmMa
function TableCoach({
  feedback,
  timing,
  count,
  canRetry,
  enabled,
  onCommand,
}: {
  feedback: LearnFeedback;
  timing: NonNullable<TableView['prompt']>['timing'];
  count: 'running' | 'true';
  canRetry: boolean;
  enabled: boolean;
  onCommand: (command: LearnerCommand) => void;
}) {
  const { explanation } = feedback;
  const running = explanation.kind === 'table-running';
  const headline = running ? runningHeadline(explanation.count) : `The true count is ${signed(feedback.reference)}.`;
  const detail = running ? tableRunningText(explanation, timing) : explanation.kind === 'conversion' ? conversionText(explanation) : '';
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {enteredLine(feedback.entered, count, feedback.reference)}
      </Text>
      <View style={styles.coach} accessibilityLiveRegion="polite" testID="coach-note">
        <View style={styles.coachHead}>
          <View style={styles.who}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.coachName}>
              {COACH_NAME}
            </Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.coachKicker}>
              {running ? RUNNING_KICKER : CONVERSION_KICKER}
            </Text>
          </View>
          <Info color={palette.coachAccent} size={18} />
        </View>
        <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>
          {headline}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {detail}
        </Text>
        <View style={styles.coachActions}>
          {canRetry ? (
            <>
              <CoachButton label={TRY_AGAIN} primary enabled={enabled} onPress={() => onCommand({ kind: 'retry-item' })} />
              <CoachButton label={SHOW_ANSWER} enabled={enabled} onPress={() => onCommand({ kind: 'next-item' })} />
            </>
          ) : (
            <CoachButton label={CONTINUE} primary enabled={enabled} onPress={() => onCommand({ kind: 'next-item' })} />
          )}
        </View>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText}>
        {ONLY_FIRST_SCORED}
      </Text>
    </>
  );
}

function ShufflePanel({ table, enabled, onContinue }: { table: TableView; enabled: boolean; onContinue: () => void }) {
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.kicker}>
        {NEW_SHOE}
      </Text>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.panelTitle}>
        {SHUFFLED_TITLE}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.panelText} accessibilityLiveRegion="polite">
        {shuffledText(table.round)}
      </Text>
      <Button label={continueText(table.round, table.interval)} icon={ArrowRight} stretch disabled={!enabled} onPress={onContinue} />
    </>
  );
}

// Spec 3 Screens › Exercise (table on the 04a–04d layout)
function Felt({ table }: { table: TableView }) {
  const others = table.seats.filter((seat) => !seat.learner);
  const learner = table.seats.find((seat) => seat.learner);
  return (
    <View style={styles.felt} testID="table-felt">
      <View accessible accessibilityLabel={decksText(table)} style={styles.decks}>
        {table.step === 'shuffle' ? <Shuffle color={palette.feltText} size={16} /> : <Layers color={palette.feltText} size={16} />}
        <Text maxFontSizeMultiplier={textScale.body} style={styles.decksText}>
          {decksText(table)}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.feltLabel}>
        {DEALER}
      </Text>
      <View style={styles.handRow}>
        {table.dealer.cards.map((card, index) => (
          card ? <PlayingCard key={index} card={card} /> : <FaceDownCard key={index} />
        ))}
      </View>
      <BlackjackFeltRules dealer={table.rules.dealer} />
      {others.map((seat) =>
        seat.hands.map((hand, index) => (
          <View key={hand.target} style={styles.handRow}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.seatLabel}>
              {seat.hands.length > 1 ? `${seatName(seat.seat)} · ${index + 1}` : seatName(seat.seat)}
            </Text>
            {hand.cards.map((card, i) => (
              <PlayingCard key={i} card={card} small />
            ))}
            {hand.cards.length > 0 && <FeltBadge text={handText(hand)} />}
          </View>
        )),
      )}
      {learner?.hands.map((hand) => <SeatHand key={hand.target} hand={hand} seat={table.seat} />)}
      {table.challengeBalance?.stake && <FeltBadge text={betBadge(table.challengeBalance.stake)} />}
    </View>
  );
}

function SeatHand({ hand, seat }: { hand: TableHandView; seat: TableView['seat'] }) {
  return (
    <View style={styles.handRow}>
      {hand.action && (
        <View style={styles.action}>
          <Hand color={palette.foreground} size={16} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.actionText}>
            {seatActionText(hand.action, seat)}
          </Text>
        </View>
      )}
      {hand.cards.map((card, index) => (
        <PlayingCard key={index} card={card} />
      ))}
      {hand.cards.length > 0 && <FeltBadge text={handText(hand)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  timer: { paddingHorizontal: space[4], paddingTop: space[1], alignItems: 'flex-end' },
  felt: { gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.felt, alignItems: 'center', minHeight: 280 },
  decks: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[1], paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: palette.feltDeep },
  decksText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.feltText },
  feltLabel: { fontFamily: fonts.uiBold, fontSize: 11, letterSpacing: 0.5, color: palette.feltText },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space[2] },
  seatLabel: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.feltText },
  action: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[1], paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: palette.primary },
  actionText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.primaryForeground },
  panel: { gap: space[3] },
  kicker: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.6, color: palette.mutedForeground },
  panelTitle: { fontFamily: fonts.display, fontSize: 22, color: palette.foreground },
  checkpointTitle: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  panelText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: palette.mutedForeground },
  recorded: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3], paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  recordedText: { flex: 1, fontFamily: fonts.ui, fontSize: 14, color: palette.foreground },
  coach: { gap: space[3] - 2, paddingTop: 14, paddingHorizontal: space[4], paddingBottom: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.coachAccent, backgroundColor: palette.coach },
  coachHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] - 2 },
  who: { flex: 1 },
  coachName: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.ink },
  coachKicker: { fontFamily: fonts.uiBold, fontSize: 10, letterSpacing: 0.5, color: palette.coachAccent },
  headline: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.ink },
  detail: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.inkMuted },
  coachActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pressed: { opacity: 0.8 },
  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  move: { flexGrow: 1, flexBasis: '30%' },
  refused: { gap: space[2], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  refusedHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  refusedText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 21, color: palette.foreground },
});

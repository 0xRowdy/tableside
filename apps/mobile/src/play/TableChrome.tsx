import type { DomainFact, PermittedView } from '@tableside/engine';
import { CircleStop } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';
import { HelpButton } from '@/lessons/FirstUseHints';
import type { SetupTerms } from '@/practice/adapters';
import { SAVE_RETRY_MS, type AccessStop, type ActiveSnapshot, type PracticeController, type PracticeSnapshot, type Suspension } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';

import { EndSessionDialog } from './EndSessionDialog';
import { StopStrategyDialog } from './Guidance';
import type { TurnWord } from './strategy-text';
import { formatUnits, sumUnits } from './units';

export function TableTopBar({
  title,
  subtitle,
  canEnd,
  onEnd,
}: {
  title: string;
  subtitle: string;
  canEnd: boolean;
  onEnd: () => void;
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <View style={styles.topBar}>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      <HelpButton />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End session"
        accessibilityHint="Asks before ending. Ending returns removable wagers and settles the rest."
        accessibilityState={{ disabled: !canEnd }}
        disabled={!canEnd}
        onPress={onEnd}
        {...focusProps}
        style={[styles.iconButton, focused && styles.focused, !canEnd && styles.disabled]}
      >
        <CircleStop color={palette.foreground} size={22} />
      </Pressable>
    </View>
  );
}

export interface PhaseStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

export function PhaseStepper({ steps }: { steps: readonly PhaseStep[] }) {
  return (
    <View style={styles.stepper} testID="phase-stepper">
      {steps.map((step, index) => (
        <View
          key={step.label}
          accessible
          accessibilityLabel={`Step ${index + 1} of ${steps.length}, ${step.label}, ${step.state}`}
          style={styles.step}
        >
          <View style={[styles.stepBar, step.state !== 'upcoming' && styles.stepBarReached]} />
          <Text
            maxFontSizeMultiplier={textScale.body}
            style={[styles.stepText, step.state === 'current' && styles.stepTextCurrent]}
          >
            {step.state === 'done' ? `✓ ${step.label}` : `${index + 1}  ${step.label}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function SessionStrip({ balance, onTable, status }: { balance: string; onTable: string; status: string }) {
  return (
    <StatStrip
      stats={[
        { label: 'SESSION BALANCE', spoken: 'Session balance', value: balance },
        { label: 'ON TABLE', spoken: 'On table', value: onTable },
      ]}
      status={status}
    />
  );
}

// Spec 3 S3-07 v82z3
export function StatStrip({ stats, status }: { stats: readonly { readonly label: string; readonly spoken: string; readonly value: string }[]; status: string }) {
  return (
    <View style={styles.strip}>
      {stats.map((stat) => (
        <View key={stat.label} accessible accessibilityLabel={`${stat.spoken} ${stat.value}`} style={styles.stat}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>{stat.label}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>{stat.value}</Text>
        </View>
      ))}
      <View accessible accessibilityLabel={`Status ${status}`} style={styles.statusTag}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

// Spec 1 Amendment 4 D
export function AllowanceLine({ game }: { game: string }) {
  const { controller } = usePractice();
  const allowance: SetupTerms['allowance'] = useLoaded((practice, id) => practice.setupTerms(id), controller, game)?.allowance ?? null;
  if (!allowance) return null;
  return (
    <View accessible accessibilityLabel={`${allowance.title}: ${allowance.text}`} style={styles.allowance} testID="allowance-line">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>{allowance.title}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.allowanceText}>{allowance.text}</Text>
    </View>
  );
}

// Spec 1 Amendment 4 D
export const ACCESS_ENDED = 'Training ended — settling existing bets; no further allowance used';
// Spec 1 Amendment 6 §5
export const CONTENT_REMOVED = 'Strategy removed — settling existing bets';
const CONTENT_REMOVED_REASON = 'Removed after a validated legal or privacy request.';

export function TableBanner({ title, text, testID, children }: { title: string; text: string; testID?: string; children?: ReactNode }) {
  return (
    <View style={styles.banner} testID={testID}>
      <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>{title}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerText}>{text}</Text>
      {children}
    </View>
  );
}

export function AccessStopBanner({ ending, detail }: { ending: AccessStop | null; detail: string }) {
  if (ending === null) return null;
  return ending === 'content-removed' ? (
    <TableBanner title={CONTENT_REMOVED} text={`${CONTENT_REMOVED_REASON} ${detail}`} testID="content-removed" />
  ) : (
    <TableBanner title={ACCESS_ENDED} text={detail} testID="access-ended" />
  );
}

const SAVE_FAILED_ANNOUNCEMENT = "Couldn't save. Play is paused and will retry automatically.";

type GameView<G extends PermittedView['game']> = Extract<PermittedView, { readonly game: G }>;
type Describe<G extends PermittedView['game']> = (snapshot: ActiveSnapshot<GameView<G>>) => string;

function followTableAnnouncements<G extends PermittedView['game']>(controller: PracticeController, game: G, describe: Describe<G>): () => void {
  const atTable = (snapshot: PracticeSnapshot): snapshot is ActiveSnapshot<GameView<G>> => snapshot.status === 'active' && snapshot.view.game === game;
  const initial = controller.snapshot();
  let announced = initial.status === 'active' ? initial.view.sequence : -1;
  let failed = initial.status === 'active' && initial.save === 'failed';
  return controller.subscribe(() => {
    const latest = controller.snapshot();
    if (!atTable(latest)) return;
    const nowFailed = latest.save === 'failed';
    if (nowFailed && !failed) AccessibilityInfo.announceForAccessibility(SAVE_FAILED_ANNOUNCEMENT);
    failed = nowFailed;
    if (latest.view.sequence === announced) return;
    announced = latest.view.sequence;
    AccessibilityInfo.announceForAccessibility(describe(latest));
  });
}

export function useTableAnnouncements<G extends PermittedView['game']>(game: G, describe: Describe<G>): void {
  const { controller } = usePractice();
  useFollow(followTableAnnouncements<G>, controller, game, describe);
}

export function SaveFailedBanner({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <TableBanner
      title="Couldn't save · play is paused"
      text={busy ? 'Saving your last move…' : `Your last move hasn't been saved, so nothing has been revealed. Nothing is lost. Retrying automatically every ${SAVE_RETRY_MS / 1000} s.`}
    >
      <Button label="Retry now" variant="secondary" disabled={busy} onPress={onRetry} />
    </TableBanner>
  );
}

export function TurnBoundaryBanner({ suspension, turn }: { suspension: Suspension | null; turn: TurnWord }) {
  if (suspension?.kind !== 'turn-boundary' || suspension.reached) return null;
  return (
    <TableBanner title={`Suspending after this ${turn}`} text={suspension.reason ?? `This ${turn} finishes normally. No new ${turn} starts until the session resumes.`} />
  );
}

export const CHIPS: readonly { value: string; label: string; color: ColorToken; ink: ColorToken }[] = [
  { value: '1', label: '1', color: 'chip1', ink: 'ink' },
  { value: '5', label: '5', color: 'chip5', ink: 'onImage' },
  { value: '25', label: '25', color: 'chip25', ink: 'onImage' },
  { value: '100', label: '100', color: 'chip100', ink: 'onImage' },
  { value: '500', label: '500', color: 'chip500', ink: 'onImage' },
  { value: '1000', label: '1K', color: 'chip1k', ink: 'ink' },
];

export function ChipRack({ chip, onChoose, from = '1', spot = 'a spot' }: { chip: string; onChoose: (value: string) => void; from?: string; spot?: string }) {
  const chips = CHIPS.slice(CHIPS.findIndex((option) => option.value === from));
  return (
    <View style={styles.rack}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Chip value" style={styles.chips}>
        {chips.map((option) => (
          <Chip key={option.value} option={option} selected={option.value === chip} onPress={() => onChoose(option.value)} />
        ))}
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rackCaption}>
        {formatUnits(chip)} selected · tap {spot} to add it
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
      style={[styles.chipSlot, selected && styles.chipSelected, focused && styles.focused]}
    >
      <View style={[styles.chip, { backgroundColor: palette[option.color] }]}>
        <Text maxFontSizeMultiplier={textScale.display} style={[styles.chipText, { color: palette[option.ink] }]}>{option.label}</Text>
      </View>
      {selected && <Text maxFontSizeMultiplier={textScale.display} style={styles.chipCheck}>{'✓'}</Text>}
    </Pressable>
  );
}

export function EndingSteps({
  facts,
  noneReturned,
  settle,
  lead = null,
  footer,
}: {
  facts: readonly DomainFact[];
  noneReturned: string;
  settle: { title: string; detail: string };
  lead?: string | null;
  footer: string;
}) {
  const returned = sumUnits(...facts.flatMap((fact) => (fact.kind === 'wager-returned' ? [fact.amount] : [])));
  const steps = [
    { title: 'Removable wagers returned', detail: returned !== '0' ? `+${formatUnits(returned)} to your balance` : noneReturned, state: 'done' },
    { ...settle, state: 'current' },
    { title: 'Session result', detail: '', state: 'upcoming' },
  ] as const;
  return (
    <View style={styles.ending}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.endingTitle}>
        Ending your session
      </Text>
      {lead && <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepDetail}>{lead}</Text>}
      {steps.map((step, index) => (
        <View key={step.title} accessible accessibilityLabel={`Step ${index + 1}, ${step.title}, ${step.state}. ${step.detail}`} style={styles.endingStep}>
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.endingStepTitle, step.state === 'upcoming' && styles.muted]}>
            {step.state === 'done' ? '✓' : index + 1}  {step.title}
          </Text>
          {step.detail !== '' && <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepDetail}>{step.detail}</Text>}
        </View>
      ))}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.endingStepTitle}>{footer}</Text>
    </View>
  );
}

export function TableDialogs({
  view,
  ending,
  onCloseEnding,
  stoppingStrategy,
  onCloseStopping,
  removable,
  committed,
}: {
  view: PermittedView;
  ending: boolean;
  onCloseEnding: () => void;
  stoppingStrategy: boolean;
  onCloseStopping: () => void;
  removable: string;
  committed: string;
}) {
  const { controller } = usePractice();
  return (
    <>
      <StopStrategyDialog
        visible={stoppingStrategy}
        removable={removable}
        committed={committed}
        onCancel={onCloseStopping}
        onConfirm={() => {
          onCloseStopping();
          void controller.stopStrategy();
        }}
      />
      <EndSessionDialog
        visible={ending}
        view={view}
        onCancel={onCloseEnding}
        onConfirm={() => {
          onCloseEnding();
          void controller.endSession();
        }}
      />
    </>
  );
}

// Spec 1 S1-04; Spec 3 S3-07 v82z3
export function BlackjackFeltRules({ dealer }: { dealer: 'S17' | 'H17' }) {
  return (
    <View style={styles.feltRules}>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.pays}>BLACKJACK PAYS 3 TO 2</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.dealerRule}>
        {dealer === 'S17' ? 'DEALER STANDS ON ALL 17s' : 'DEALER HITS SOFT 17'}
      </Text>
    </View>
  );
}

export function FeltBadge({ text }: { text: string }) {
  return (
    <View style={styles.feltBadge}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.feltBadgeText}>{text}</Text>
    </View>
  );
}

export function FaceDownCard() {
  return (
    <View accessible accessibilityLabel="Face-down card" style={styles.cardBack}>
      <View style={styles.cardBackField} />
    </View>
  );
}

const styles = StyleSheet.create({
  feltRules: { alignItems: 'center', gap: 2 },
  pays: { fontFamily: fonts.display, fontSize: 18, color: palette.feltText, textAlign: 'center' },
  dealerRule: { fontFamily: fonts.uiMedium, fontSize: 10, letterSpacing: 0.5, color: palette.feltText, textAlign: 'center' },
  feltBadge: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.pill, backgroundColor: palette.feltDeep },
  feltBadgeText: { fontFamily: fonts.uiBold, fontSize: 13, color: palette.feltText },
  cardBack: { width: 56, minHeight: 80, padding: 4, borderRadius: radius.sm, backgroundColor: palette.cardFace },
  cardBackField: { flex: 1, borderRadius: 4, backgroundColor: palette.chip5 },
  banner: { margin: space[4], padding: space[4], gap: space[2], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.destructive },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  bannerText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingLeft: space[4], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  focused: { borderColor: palette.ring },
  disabled: { opacity: 0.4 },
  stepper: { flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingVertical: space[2] },
  step: { flex: 1, gap: 5 },
  stepBar: { height: 3, borderRadius: 2, backgroundColor: palette.border },
  stepBarReached: { backgroundColor: palette.primary },
  stepText: { fontFamily: fonts.uiMedium, fontSize: 11, color: palette.mutedForeground },
  stepTextCurrent: { fontFamily: fonts.uiBold, color: palette.foreground },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: palette.card,
  },
  stat: { gap: 1 },
  statLabel: { fontFamily: fonts.uiBold, fontSize: 10, color: palette.mutedForeground, letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  statusTag: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.secondary,
  },
  statusText: { fontFamily: fonts.uiBold, fontSize: 12, color: palette.foreground },
  allowance: { gap: 1, paddingHorizontal: space[4], paddingVertical: space[1], backgroundColor: palette.card },
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
  allowanceText: { fontFamily: fonts.uiMedium, fontSize: 13, color: palette.foreground },
});

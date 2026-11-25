import type { DomainFact, GameId, PermittedView } from '@tableside/engine';
import { ChevronDown, CircleStop } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { useFollow } from '@/hooks/use-follow';
import { useLoaded } from '@/hooks/use-loaded';
import { HelpButton } from '@/lessons/FirstUseHints';
import type { SetupTerms } from '@/practice/adapters';
import { SAVE_RETRY_MS, type AccessStop, type ActiveSnapshot, type PracticeController, type PracticeSnapshot, type Suspension } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, objectType, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

import { EndSessionDialog } from './EndSessionDialog';
import { StopStrategyDialog } from './Guidance';
import type { TurnWord } from './strategy-text';
import { formatUnits, sumUnits } from './units';

export interface PhaseStep {
  label: string;
  state: 'done' | 'current' | 'upcoming';
}

export interface TableStat {
  readonly label: string;
  readonly spoken: string;
  readonly value: string;
}

// docs/decisions/table-chrome-summary-row.md
const MAX_STATS = 3;
const SUMMARY_ROWS_FONT_SCALE = 1.35;
const MIN_PINNED_FELT = 120;

// Spec 1 S1-04 jvB3q, iIMaW, S2tO2R; S5-11 xIl3L, p44ug; S3-07 J1nPeT, dFfnT
export function TableHeader({
  title,
  status,
  steps,
  stats,
  buttons,
  allowance = null,
  details,
  children,
}: {
  title: string;
  status: string;
  steps: readonly PhaseStep[];
  stats: readonly TableStat[];
  buttons: ReactNode;
  allowance?: SetupTerms['allowance'];
  details: (close: () => void) => ReactNode;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const shown = allowance?.figure && stats.length < MAX_STATS ? [...stats, { label: allowance.figure.label, spoken: allowance.figure.label, value: allowance.figure.value }] : stats;
  return (
    <View>
      <View style={styles.topBar}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            {title}
          </Text>
          <Text accessibilityLabel={`Status ${status}`} maxFontSizeMultiplier={textScale.body} style={styles.status} testID="table-status">
            {status}
          </Text>
        </View>
        {buttons}
      </View>
      <PhaseBars steps={steps} />
      <SummaryRow stats={shown} onOpen={() => setOpen(true)} />
      {children}
      {open && (
        <Sheet title="Table details" testID="table-details" onClose={close}>
          {allowance && (
            <DetailsSection label="Today's training">
              <DetailsRow label={allowance.title} detail={allowance.text} />
            </DetailsSection>
          )}
          {details(close)}
        </Sheet>
      )}
    </View>
  );
}

export function TableButtons({ game, canEnd, onEnd }: { game: GameId; canEnd: boolean; onEnd: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <>
      <HelpButton game={game} />
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
    </>
  );
}

function PhaseBars({ steps }: { steps: readonly PhaseStep[] }) {
  const styles = useStyles();
  return (
    <View style={styles.bars} testID="phase-stepper">
      {steps.map((step, index) => (
        <View
          key={step.label}
          accessible
          accessibilityLabel={`Step ${index + 1} of ${steps.length}, ${step.label}, ${step.state}`}
          style={[styles.bar, step.state !== 'upcoming' && styles.barReached]}
        />
      ))}
    </View>
  );
}

// Spec 1 Amendment 12 §5; docs/decisions/table-chrome-summary-row.md
export function SummaryRow({ stats, onOpen }: { stats: readonly TableStat[]; onOpen: () => void }) {
  const styles = useStyles();
  const rows = useWindowDimensions().fontScale > SUMMARY_ROWS_FONT_SCALE;
  return (
    <Pressable accessible={false} onPress={onOpen} testID="stat-strip" style={[styles.strip, rows && styles.stripRows]}>
      {stats.map((stat) => (
        <View key={stat.label} accessible accessibilityLabel={`${stat.spoken} ${stat.value}`} style={rows ? styles.statRow : styles.stat}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>{stat.label}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>{stat.value}</Text>
        </View>
      ))}
      <DetailsButton labelled={rows} onPress={onOpen} />
    </Pressable>
  );
}

function DetailsButton({ labelled, onPress }: { labelled: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Table details"
      accessibilityHint="Rules, house edge and the rest of this table's details."
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [labelled ? styles.detailsRow : styles.detailsButton, pressed && pressStyle.row, focused && styles.focused]}
    >
      {labelled && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detailsText}>
          Table details
        </Text>
      )}
      <View style={labelled ? undefined : styles.chevron}>
        <ChevronDown color={palette.foreground} size={20} />
      </View>
    </Pressable>
  );
}

export function DetailsSection({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.sectionLabel}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export function DetailsRow({ label, value, detail }: { label: string; value?: string; detail?: string }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={[value === undefined ? label : `${label}: ${value}`, detail].filter(Boolean).join('. ')} style={styles.detailsLine}>
      <View style={styles.flex}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowLabel}>{label}</Text>
        {detail && <Text maxFontSizeMultiplier={textScale.body} style={styles.rowDetail}>{detail}</Text>}
      </View>
      {value !== undefined && <Text maxFontSizeMultiplier={textScale.body} style={styles.rowValue}>{value}</Text>}
    </View>
  );
}

// Spec 1 S1-08; docs/decisions/table-chrome-summary-row.md
export function RebuyDetails({ shown, enabled, onRebuy }: { shown: boolean; enabled: boolean; onRebuy: () => void }) {
  const styles = useStyles();
  if (!shown) return null;
  return (
    <DetailsSection label="Session">
      <View style={styles.detailsAction}>
        <Button label="Rebuy" variant="secondary" stretch hint="Adds chips to this session. It counts as funding, not as a win." disabled={!enabled} onPress={onRebuy} />
      </View>
    </DetailsSection>
  );
}

// Spec 1 Amendment 4 D; S5-11 xIl3L
export function useTableAllowance(game: string): SetupTerms['allowance'] {
  const { controller } = usePractice();
  return useLoaded((practice, id) => practice.setupTerms(id), controller, game)?.allowance ?? null;
}

// docs/decisions/table-chrome-summary-row.md
export function TableLayout({ header, body, footer, columns }: { header: ReactNode; body: ReactNode; footer: ReactNode; columns: boolean }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ screen: 0, header: 0, footer: 0 });
  const measure = (key: keyof typeof size) => (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setSize((current) => (current[key] === height ? current : { ...current, [key]: height }));
  };
  const pinned = !columns && size.screen > 0 && size.screen - size.header - size.footer >= MIN_PINNED_FELT;
  return (
    <ScrollView
      testID="table-scroll"
      onLayout={measure('screen')}
      scrollEnabled={!pinned}
      contentContainerStyle={[{ paddingTop: insets.top }, pinned ? { height: size.screen } : { paddingBottom: space[6] }]}
    >
      <View onLayout={measure('header')}>{header}</View>
      <View testID="table-columns" style={[styles.columns, columns && styles.columnsSideBySide, pinned && styles.fill]}>
        <ScrollView scrollEnabled={pinned} style={[styles.column, !pinned && styles.unbounded]} contentContainerStyle={styles.bodyContent}>
          {body}
        </ScrollView>
        <View onLayout={measure('footer')} testID="table-footer" style={[styles.column, styles.controls, pinned && styles.pinned]}>
          {footer}
        </View>
      </View>
    </ScrollView>
  );
}

// Spec 1 Amendment 4 D
export const ACCESS_ENDED = 'Training ended — settling existing bets; no further allowance used';
// Spec 1 Amendment 6 §5
export const CONTENT_REMOVED = 'Strategy removed — settling existing bets';
const CONTENT_REMOVED_REASON = 'Removed after a validated legal or privacy request.';

export function TableBanner({ title, text, testID, children }: { title: string; text: string; testID?: string; children?: ReactNode }) {
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
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
      {({ pressed }) => (
        <>
          <PressShade pressed={pressed} corner={radius.pill} />
          <View style={[styles.chip, { backgroundColor: palette[option.color] }]}>
            <Text maxFontSizeMultiplier={textScale.display} style={[styles.chipText, { color: palette[option.ink] }]}>{option.label}</Text>
          </View>
          {selected && <Text maxFontSizeMultiplier={textScale.display} style={styles.chipCheck}>{'✓'}</Text>}
        </>
      )}
    </Pressable>
  );
}

// docs/decisions/press-feedback.md; design/Tableside.pen RsrEO
export function PressShade({ pressed, corner }: { pressed: boolean; corner: number }) {
  return pressed ? <View testID="press-shade" style={[StyleSheet.absoluteFill, { pointerEvents: 'none', borderRadius: corner, backgroundColor: palette.pressShade }]} /> : null;
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
  const styles = useStyles();
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
  const styles = useStyles();
  return (
    <View style={styles.feltRules}>
      <Text maxFontSizeMultiplier={1} style={styles.pays}>BLACKJACK PAYS 3 TO 2</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.dealerRule}>
        {dealer === 'S17' ? 'DEALER STANDS ON ALL 17s' : 'DEALER HITS SOFT 17'}
      </Text>
    </View>
  );
}

export function FeltBadge({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.feltBadge}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.feltBadgeText}>{text}</Text>
    </View>
  );
}

export function FaceDownCard() {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel="Face-down card" style={styles.cardBack}>
      <View style={styles.cardBackField} />
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  feltRules: { alignItems: 'center', gap: 2 },
  pays: { fontFamily: fonts.display, fontSize: objectType.feltPrint, letterSpacing: 2.5, color: palette.feltText, textAlign: 'center' },
  dealerRule: { fontFamily: fonts.uiMedium, ...type.caption, letterSpacing: 0.5, color: palette.feltText, textAlign: 'center' },
  feltBadge: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.pill, backgroundColor: palette.feltDeep },
  feltBadgeText: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.feltText },
  cardBack: { width: 56, minHeight: 80, padding: 4, borderRadius: radius.sm, backgroundColor: palette.cardFace },
  cardBackField: { flex: 1, borderRadius: 4, backgroundColor: palette.chip5 },
  banner: { margin: space[4], padding: space[4], gap: space[2], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.destructive },
  bannerTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  bannerText: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingLeft: space[4], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  status: { fontFamily: fonts.ui, ...type.secondary, color: palette.foreground },
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
  flex: { flex: 1 },
  fill: { flex: 1 },
  bars: { flexDirection: 'row', gap: space[2], paddingHorizontal: space[4], paddingTop: space[1], paddingBottom: space[2] },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: palette.border },
  barReached: { backgroundColor: palette.primary },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[4],
    paddingLeft: space[4],
    paddingRight: space[2],
    paddingVertical: space[2],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  stat: { gap: 1 },
  statLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  statValue: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  stripRows: { flexDirection: 'column', alignItems: 'stretch', gap: space[2], paddingRight: space[4] },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[3] },
  detailsButton: {
    marginLeft: 'auto',
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  chevron: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.secondary },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: MIN_TOUCH_TARGET,
    paddingTop: space[2],
    borderTopWidth: 1,
    borderTopColor: palette.border,
    borderWidth: 2,
    borderColor: palette.transparent,
  },
  detailsText: { flex: 1, fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  sectionLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  detailsAction: { paddingTop: space[2] },
  detailsLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: palette.border },
  rowLabel: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  rowDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  rowValue: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground, textAlign: 'right', flexShrink: 1 },
  columns: { gap: space[3], paddingTop: space[2] },
  columnsSideBySide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1 },
  unbounded: { flexGrow: 0 },
  bodyContent: { gap: space[2] },
  controls: { gap: space[3], paddingHorizontal: space[4] },
  pinned: { flex: 0, paddingTop: space[3], paddingBottom: space[3], borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.background },
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
  chipText: { fontFamily: fonts.uiBold, fontSize: objectType.chipValue },
  chipCheck: { position: 'absolute', top: -2, right: -2, fontFamily: fonts.uiSemiBold, ...type.label, color: palette.primary },
  rackCaption: { fontFamily: fonts.ui, ...type.caption, color: palette.foreground },
  ending: { gap: space[3], padding: space[4] },
  endingTitle: { fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  endingStep: { gap: 2 },
  endingStepTitle: { fontFamily: fonts.uiMedium, ...type.body, color: palette.foreground },
  endingStepDetail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  muted: { color: palette.mutedForeground },
}));

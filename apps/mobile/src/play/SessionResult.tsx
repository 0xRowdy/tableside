// The session result (design frame S1-10: duWab guided, hcQ2u free play,
// cpZG1 largest text): net result, maximum drawdown and the funding lines,
// with guided practice's adherence and Departures kept apart from the money.
// It renders from the completed record alone, so spec 4 reopens the same
// layout from Saved (S4-17) with its own actions. Quarantine is derived from
// the shipped list on every render, never read from the record.

import { QUARANTINE_LIST } from '@tableside/definitions';
import { isPlayCorrection, quarantineStatus, type QuarantineList, type StrategyDeparture } from '@tableside/engine';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { CompletedPracticeSession } from '@/practice/store';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { cardShort } from './blackjack-coaching';
import { moveText } from './blackjack-text';
import { GAME_WORDS } from './game-words';
import { formatSigned, formatUnits, speakSigned } from './units';

/** How many departures show before "Show all". */
const FIRST_DEPARTURES = 4;

const outcomeWord = (net: string) => (net.startsWith('-') ? 'Loss' : net === '0' ? 'Even' : 'Win');

/** "Roulette · guided · Flat even-money · single zero", from the record's pinned rules and strategy. */
export function resultSubtitle(record: CompletedPracticeSession): string {
  const mode = record.strategy ? `guided · ${record.strategy.name}` : 'free play';
  const { content } = record.rules;
  if ('wheel' in content) return `Roulette · ${mode} · ${content.wheel === 'double-zero' ? 'double zero' : 'single zero'}`;
  if ('odds' in content) return `Craps · ${mode} · standard craps · ${content.odds} odds`;
  return `Blackjack · ${mode} · ${content.dealer} · ${content.lateSurrender ? 'LS' : 'no LS'}`;
}

/** "10 on Red and 10 on 1st dozen", in the game's own target names. */
function betsText(game: CompletedPracticeSession['game'], bets: readonly { readonly target: string; readonly amount: string }[]): string {
  if (bets.length === 0) return 'no new bets';
  const items = bets.map((bet) => `${formatUnits(bet.amount)} on ${GAME_WORDS[game].targetName(bet.target)}`);
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** One departure's lines: what the strategy prescribed and what the player did. */
function departureLines(game: CompletedPracticeSession['game'], departure: StrategyDeparture) {
  const resolution = departure.resolution === 'retried' ? 'Retried' : 'Overridden';
  if (isPlayCorrection(departure)) {
    // A blackjack playing decision: the hand and up card, the strategy's play and the player's.
    const { situation, prescribed } = departure.explanation;
    return {
      title: `${GAME_WORDS[game].Turn} ${departure.turn} · ${situation.cards.map(cardShort).join(' ')} v ${cardShort(situation.up)}`,
      strategy: `Strategy: ${moveText(prescribed)}`,
      you: `You: ${moveText(departure.actual)}`,
      resolution,
    };
  }
  const { prescription, situation } = departure.explanation;
  // The situation the strategy read, where the game names one (roulette: the last pocket's colour).
  const color = situation.subjects['last-pocket-color'];
  const after = color !== undefined && color !== 'none' ? ` · after ${color}` : '';
  return {
    title: `${GAME_WORDS[game].Turn} ${departure.turn}${after}`,
    strategy: `Strategy: ${betsText(game, prescription.status === 'prescribed' ? prescription.bets : [])}`,
    you: `You: ${betsText(game, departure.actual)}`,
    resolution,
  };
}

export function SessionResult({
  record,
  actions,
  quarantine = QUARANTINE_LIST,
}: {
  record: CompletedPracticeSession;
  /** The screen's buttons: New session and Back to Home after play; spec 4 passes its own when reopening from Saved. */
  actions: ReactNode;
  /** The shipped quarantine list; tests may pass another. */
  quarantine?: QuarantineList;
}) {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Session result. ${outcomeWord(record.netResult)}, net result ${speakSigned(record.netResult)}. Final cash-out ${formatUnits(record.finalCashOut)}. Max drawdown ${formatUnits(record.maxDrawdown)}.`,
    );
  }, [record]);

  const status = quarantineStatus(record, quarantine);

  // A training-bankroll session has its allocation instead of a buy-in, and never any rebuys.
  const funding =
    record.fundingSource === 'training-bankroll'
      ? [{ label: 'From training bankroll', value: formatUnits(record.buyIn) }]
      : [
          { label: 'Buy-in', value: formatUnits(record.buyIn) },
          record.rebuys.length === 0
            ? { label: 'Rebuys', value: 'none' }
            : { label: `Rebuys (${record.rebuys.length})`, value: record.rebuys.map(formatUnits).join(' + ') },
          { label: 'Total funding', value: formatUnits(record.cumulativeFunding) },
        ];
  const rows = [...funding, { label: 'Final cash-out', value: formatUnits(record.finalCashOut) }];

  return (
    <Screen>
      <View style={styles.titles}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Session result
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>{resultSubtitle(record)}</Text>
      </View>

      {status.quarantined ? (
        <View
          style={styles.banner}
          accessible
          accessibilityLabel={`Quarantined. ${status.explanation} This practice session is left out of your totals and adherence.`}
        >
          <TriangleAlert color={palette.destructive} size={20} />
          <View style={styles.bannerText}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Quarantined</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{status.explanation} This practice session is left out of your totals and adherence.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.banner} accessible accessibilityLabel="Saved. This session is in Saved, Practice. Its result won't change.">
          <CircleCheck color={palette.correct} size={20} />
          <View style={styles.bannerText}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>Saved</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>This session is in Saved › Practice. Its result won&apos;t change.</Text>
          </View>
        </View>
      )}

      <Text maxFontSizeMultiplier={textScale.body} style={styles.label}>MONEY</Text>
      <View style={styles.stats}>
        <View style={styles.stat} accessible accessibilityLabel={`Net result ${speakSigned(record.netResult)}, ${outcomeWord(record.netResult)}`}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Net result</Text>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.statValue}>{formatSigned(record.netResult)}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{outcomeWord(record.netResult)}</Text>
        </View>
        <View style={styles.stat} accessible accessibilityLabel={`Max drawdown ${formatUnits(record.maxDrawdown)}, includes final settlement`}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Max drawdown</Text>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.statValue}>{formatUnits(record.maxDrawdown)}</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Includes final settlement</Text>
        </View>
      </View>

      <View style={styles.ledger}>
        {rows.map((row) => (
          <View key={row.label} style={styles.kv} accessible accessibilityLabel={`${row.label} ${row.value}`}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{row.label}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kvValue}>{row.value}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.kv} accessible accessibilityLabel={`Net result, cash-out minus funding, ${speakSigned(record.netResult)}`}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Net result = cash-out − funding</Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.kvTotal}>{formatSigned(record.netResult)}</Text>
        </View>
      </View>

      {record.guidance ? (
        <Guidance record={record} guidance={record.guidance} />
      ) : (
        <View style={styles.note}>
          <Info color={palette.mutedForeground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.muted, styles.noteText]}>
            Free play has no strategy, so there&apos;s no adherence score or Departures.
          </Text>
        </View>
      )}

      {actions}
    </Screen>
  );
}

const MEASURES = [
  { kind: 'playing', label: 'Playing decisions' },
  { kind: 'counting', label: 'Counting' },
  { kind: 'betting', label: 'Betting decisions' },
] as const;

/** Adherence (each kind on its own) and the departure log, shown apart from the money. */
function Guidance({ record, guidance }: { record: CompletedPracticeSession; guidance: NonNullable<CompletedPracticeSession['guidance']> }) {
  const [showAll, setShowAll] = useState(false);
  const { departures } = guidance;
  const shown = showAll ? departures : departures.slice(0, FIRST_DEPARTURES);
  return (
    <>
      <View style={styles.titles}>
        <Text accessibilityRole="header" accessibilityLabel="How closely you followed the strategy" maxFontSizeMultiplier={textScale.body} style={styles.label}>
          HOW CLOSELY YOU FOLLOWED THE STRATEGY
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Scored apart from money, so a lucky session can&apos;t hide a missed play.</Text>
      </View>
      <View style={styles.stats}>
        {MEASURES.map(({ kind, label }) => {
          const measure = guidance.adherence[kind];
          if (!measure) return null;
          const percent = measure.decisions === 0 ? null : Math.round((measure.followed / measure.decisions) * 100);
          return (
            <View
              key={kind}
              style={styles.stat}
              accessible
              accessibilityLabel={percent === null ? `${label}: none assessed` : `${label}: ${measure.followed} of ${measure.decisions} followed, ${percent}%`}
            >
              <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{label}</Text>
              <Text maxFontSizeMultiplier={textScale.display} style={styles.statValue}>
                {percent === null ? '—' : `${measure.followed} / ${measure.decisions}`}
              </Text>
              <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{percent === null ? 'None assessed' : `${percent}% followed`}</Text>
            </View>
          );
        })}
      </View>
      {record.overrideAffected && <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>This session includes an override.</Text>}

      <Text accessibilityRole="header" accessibilityLabel={`Departures, ${departures.length}`} maxFontSizeMultiplier={textScale.body} style={styles.label}>
        DEPARTURES · {departures.length}
      </Text>
      {departures.length === 0 ? (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>No departures: every assessed bet followed the strategy.</Text>
      ) : (
        <View style={styles.ledger}>
          {shown.map((departure, index) => {
            const lines = departureLines(record.game, departure);
            return (
              <View key={departure.id}>
                {index > 0 && <View style={[styles.divider, styles.entryDivider]} />}
                <View style={styles.entry} accessible accessibilityLabel={`${lines.title}. ${lines.strategy}. ${lines.you}. ${lines.resolution}.`}>
                  <View style={styles.entryText}>
                    <Text maxFontSizeMultiplier={textScale.body} style={styles.kvValue}>{lines.title}</Text>
                    <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{lines.strategy} · {lines.you}</Text>
                  </View>
                  <Text maxFontSizeMultiplier={textScale.body} style={styles.tag}>{lines.resolution}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
      {!showAll && departures.length > FIRST_DEPARTURES && (
        <Button label={`Show all ${departures.length} entries`} variant="secondary" stretch onPress={() => setShowAll(true)} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  titles: { gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 30, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  banner: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 0.5, color: palette.mutedForeground },
  muted: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  stat: { flexGrow: 1, flexBasis: 140, gap: space[1], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  statValue: { fontFamily: fonts.display, fontSize: 28, color: palette.foreground },
  ledger: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  kv: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  kvValue: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
  kvTotal: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  divider: { height: 1, backgroundColor: palette.border },
  entryDivider: { marginBottom: space[2] },
  entry: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  entryText: { flexGrow: 1, flexShrink: 1, flexBasis: 180, gap: 2 },
  tag: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: palette.foreground,
    backgroundColor: palette.secondary,
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  note: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  noteText: { flex: 1 },
});

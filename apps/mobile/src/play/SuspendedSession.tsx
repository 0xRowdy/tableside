// A suspended practice session that waits for the player (design frame S1-11
// "Resume an interrupted session"): where it stopped, Resume session, and End
// session when the session is between turns. Nothing here advances the game;
// a blocked resume changes nothing and End session stays available.
// Copy says "suspended", not "paused": a pause is the player's own (CONTEXT.md).

import type { PermittedView } from '@tableside/engine';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice, NoticeText } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import type { ActivePracticeSnapshot, Suspension } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { EndSessionDialog } from './EndSessionDialog';
import { statusText } from './blackjack-text';
import { formatUnits, STATUS, totalOnTable } from './roulette-text';

/** Each game's words for a suspended session. */
const WORDS: Record<PermittedView['game'], { game: string; title: string; turn: string; happened: string; same: string }> = {
  roulette: { game: 'roulette', title: 'Roulette', turn: 'spin', happened: 'spun', same: 'Same rules, wheel and spins as before.' },
  blackjack: { game: 'blackjack', title: 'Blackjack', turn: 'round', happened: 'dealt', same: 'Same rules, shoe and cards as before.' },
};

const why = (cause: Suspension['cause'], { game, happened }: (typeof WORDS)[keyof typeof WORDS]): string => {
  switch (cause) {
    case 'interrupted':
      return `Tableside closed during your ${game} session. It's saved exactly as it was. Nothing was ${happened} or settled while you were away.`;
    case 'navigation':
      return `Your ${game} session is suspended. It's saved exactly as it was.`;
    case 'app-lifecycle':
      return `Your ${game} session was suspended when Tableside went to the background. It's saved exactly as it was.`;
    case 'sign-out':
      return `Your ${game} session was suspended when you signed out. It's saved exactly as it was.`;
    case 'access':
      return `Your ${game} session is suspended. It's saved exactly as it was, and nothing was ${happened} or settled since.`;
  }
};

/** Where the session stopped: "Settled, spin 3", "Your turn, round 2". */
const whereText = (view: PermittedView): string => {
  const status = view.game === 'blackjack' ? statusText(view) : STATUS[view.phase];
  return `${status}${view.turn > 0 && view.phase !== 'final-settlement' ? `, ${WORDS[view.game].turn} ${view.turn}` : ''}`;
};

export function SuspendedSession({ snapshot, suspension }: { snapshot: ActivePracticeSnapshot; suspension: Suspension }) {
  const { controller } = usePractice();
  const [confirming, setConfirming] = useState(false);
  const { view, busy } = snapshot;
  const words = WORDS[view.game];

  return (
    <Screen>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
        Pick up where you left off
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
        {suspension.reason ?? why(suspension.cause, words)}
      </Text>

      {suspension.resumeBlocked && (
        <Notice role="alert" title={`Can't resume · ${suspension.resumeBlocked}`}>
          <NoticeText>Nothing has changed. {suspension.canEnd ? 'You can still end the session.' : 'Try again once access is confirmed.'}</NoticeText>
        </Notice>
      )}
      {suspension.endBlocked && <Notice role="alert" title={`Can't end yet · ${suspension.endBlocked}`} />}

      <View style={styles.card} testID="suspended-session">
        <View style={styles.cardHead}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.cardTitle}>{words.title} · free play</Text>
          <View style={styles.tag}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.tagText}>Suspended</Text>
          </View>
        </View>
        <Row label="Where you were" value={whereText(view)} />
        <Row label="Session balance" value={formatUnits(view.balance)} />
        <Row label="On table" value={formatUnits(totalOnTable(view))} />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>{words.same}</Text>
      </View>

      <Button label="Resume session" stretch disabled={busy} onPress={() => void controller.resume()} />
      {suspension.canEnd ? (
        <Button label="End session" variant="secondary" stretch disabled={busy} onPress={() => setConfirming(true)} />
      ) : (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>
          A {words.turn} is under way. Resume to finish it before ending the session.
        </Text>
      )}
      <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>
        Resuming isn&apos;t a new buy-in. Ending returns removable wagers and settles the rest.
      </Text>

      <EndSessionDialog
        visible={confirming}
        view={view}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void controller.endSession();
        }}
        cancelLabel="Not now"
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rowLabel}>{label}</Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, color: palette.foreground },
  body: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, color: palette.mutedForeground },
  card: { gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  cardTitle: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: palette.secondary },
  tagText: { fontFamily: fonts.uiMedium, fontSize: 12, color: palette.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  rowLabel: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  rowValue: { fontFamily: fonts.uiBold, fontSize: 15, color: palette.foreground },
  caption: { fontFamily: fonts.ui, fontSize: 12.5, color: palette.mutedForeground },
});

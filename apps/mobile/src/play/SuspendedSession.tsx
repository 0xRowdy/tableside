// A suspended practice session that waits for the player (design frame S1-11
// "Resume an interrupted session"): where it stopped, Resume session, and End
// session when the session is between turns. Nothing here advances the game;
// a blocked resume changes nothing and End session stays available.

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import type { PracticeSnapshot, Suspension } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';

import { EndSessionDialog } from './RouletteTable';
import { formatUnits, STATUS, totalOnTable } from './roulette-text';

type ActiveSnapshot = Extract<PracticeSnapshot, { status: 'active' }>;

const WHY: Record<Suspension['cause'], string> = {
  interrupted: "Tableside closed during your roulette session. It's saved exactly as it was. Nothing was spun or settled while you were away.",
  navigation: "Your roulette session is paused. It's saved exactly as it was.",
  'app-lifecycle': "Your roulette session paused when Tableside went to the background. It's saved exactly as it was.",
  'sign-out': "Your roulette session paused when you signed out. It's saved exactly as it was.",
  access: "Your roulette session is paused. It's saved exactly as it was, and nothing was spun or settled since.",
};

export function SuspendedSession({ snapshot, suspension }: { snapshot: ActiveSnapshot; suspension: Suspension }) {
  const { controller } = usePractice();
  const [confirming, setConfirming] = useState(false);
  const { view, busy } = snapshot;
  const ending = view.phase === 'final-settlement';

  return (
    <Screen>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
        Pick up where you left off
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.body}>
        {suspension.reason ?? WHY[suspension.cause]}
      </Text>

      {suspension.resumeBlocked && (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.noticeTitle}>
            Can&apos;t resume · {suspension.resumeBlocked}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.noticeText}>
            Nothing has changed. {suspension.canEnd ? 'You can still end the session.' : 'Try again once access is confirmed.'}
          </Text>
        </View>
      )}
      {suspension.endBlocked && (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.noticeTitle}>
            Can&apos;t end yet · {suspension.endBlocked}
          </Text>
        </View>
      )}

      <View style={styles.card} testID="suspended-session">
        <View style={styles.cardHead}>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.cardTitle}>Roulette · free play</Text>
          <View style={styles.tag}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.tagText}>Paused</Text>
          </View>
        </View>
        <Row label="Where you were" value={ending ? 'Final settlement' : `${STATUS[view.phase]}${view.turn > 0 ? `, spin ${view.turn}` : ''}`} />
        <Row label="Session balance" value={formatUnits(view.balance)} />
        <Row label="On table" value={formatUnits(totalOnTable(view))} />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>Same rules, wheel and spins as before.</Text>
      </View>

      <Button label="Resume session" stretch disabled={busy} onPress={() => void controller.resume()} />
      {suspension.canEnd ? (
        <Button label="End session" variant="secondary" stretch disabled={busy} onPress={() => setConfirming(true)} />
      ) : (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.caption}>
          A spin is under way. Resume to finish it before ending the session.
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
        cancelLabel="Keep it paused"
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
  notice: { gap: space[1], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary },
  noticeTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  noticeText: { fontFamily: fonts.ui, fontSize: 13, color: palette.mutedForeground },
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

// An unfinished practice session found unusable (#80; design frame S1-11
// "Quarantined session — explained", j8O6k): a proven engine defect named by
// the shipped quarantine list, or a checkpoint that can't be read. It was
// marked incomplete, so it has no result; this screen says why and what was
// recorded. The frame's "View recorded rolls" is spec 4's Saved detail.

import { router } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { findGame } from '@/games';
import type { IncompleteSession as Session } from '@/practice/controller';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';

import { formatUnits } from './units';

const TURNS = { roulette: 'Spins', craps: 'Rolls', blackjack: 'Rounds' } as const;

const SET_ASIDE = "We won't invent a result, so it's set aside and doesn't count toward your totals or adherence.";

export function IncompleteSession({ session }: { session: Session }) {
  const { controller } = usePractice();
  const [explained, setExplained] = useState(false);
  const title = `${findGame(session.game)?.title ?? session.game} session`;
  const { reason } = session;
  const banner =
    reason.kind === 'quarantined'
      ? { title: 'This session is quarantined', text: `We found a defect in the game engine that affected this session. ${SET_ASIDE}` }
      : { title: "This session can't be recovered", text: `Its saved state is damaged. ${SET_ASIDE}` };
  const rows = [
    { label: 'Buy-in', value: formatUnits(session.buyIn) },
    ...(session.turnsRecorded === null
      ? []
      : [{ label: `${TURNS[session.game]} recorded`, value: reason.kind === 'quarantined' ? `${session.turnsRecorded} before the defect` : `${session.turnsRecorded}` }]),
    { label: 'Result', value: 'Not available' },
    ...(session.engine === null ? [] : [{ label: 'Engine', value: reason.kind === 'quarantined' ? `${session.engine} (affected)` : session.engine }]),
  ];

  return (
    <Screen>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
        {title}
      </Text>

      <View style={styles.banner} testID="incomplete-session">
        <TriangleAlert color={palette.primary} size={20} />
        <View style={styles.bannerText}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>
            {banner.title}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{banner.text}</Text>
          {reason.kind === 'quarantined' &&
            (explained ? (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.explanation}>{reason.explanation}</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="What happened?"
                hitSlop={space[2]}
                onPress={() => setExplained(true)}
                style={styles.action}
              >
                <Text maxFontSizeMultiplier={textScale.body} style={styles.actionText}>What happened?</Text>
              </Pressable>
            ))}
        </View>
      </View>

      <View style={styles.details}>
        {rows.map((row) => (
          <View key={row.label} style={styles.kv} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>{row.label}</Text>
            <Text maxFontSizeMultiplier={textScale.body} style={styles.kvValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>Your other sessions aren&apos;t affected.</Text>
      <Button
        label="Back to Home"
        stretch
        onPress={() => {
          controller.dismissIncomplete();
          router.navigate('/');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, color: palette.foreground },
  banner: { flexDirection: 'row', gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.foreground },
  muted: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  explanation: { fontFamily: fonts.ui, fontSize: 14, color: palette.foreground },
  action: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center', alignSelf: 'flex-start' },
  actionText: { fontFamily: fonts.uiBold, fontSize: 14, color: palette.primary },
  details: { gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  kv: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  kvValue: { fontFamily: fonts.uiMedium, fontSize: 15, color: palette.foreground },
});

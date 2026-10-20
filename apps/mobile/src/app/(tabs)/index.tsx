import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameCard } from '@/components/GameCard';
import { Notice, NoticeText } from '@/components/Notice';
import { LAUNCH_GAMES } from '@/games';
import { STATUS } from '@/play/roulette-text';
import { usePractice } from '@/practice/PracticeProvider';
import { fonts, palette, space, textScale } from '@/theme/tokens';

/** Above this text scale, landscape also stacks the cards so their text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;
const MIN_CARD_HEIGHT = 188;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const { snapshot } = usePractice();
  const suspended = snapshot.status === 'active' && snapshot.suspension?.reached ? snapshot : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.header, { paddingTop: insets.top + space[2], paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Tableside
        </Text>
        {!sideBySide && <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>Pick a table to practice.</Text>}
      </View>
      {suspended && (
        // Design frame S1-01 "Home — session paused" (a suspension, in the glossary). Balances stay in the session (Amendment 1 A6).
        <View style={[styles.suspended, { marginLeft: insets.left + space[4], marginRight: insets.right + space[4] }]}>
          <Notice title="Roulette session suspended" testID="session-suspended">
            <NoticeText>Free play · {STATUS[suspended.view.phase].toLowerCase()}. Nothing has been spun or settled since you left.</NoticeText>
            <Button label="Resume session" onPress={() => router.navigate('/play')} />
          </Notice>
        </View>
      )}
      <View style={[styles.cards, sideBySide && styles.cardsSideBySide]}>
        {LAUNCH_GAMES.map((game, i) => (
          <GameCard
            key={game.id}
            game={game}
            style={styles.card}
            // Side by side, only the outer cards meet the screen edges.
            contentInset={{
              left: !sideBySide || i === 0 ? insets.left : 0,
              right: !sideBySide || i === LAUNCH_GAMES.length - 1 ? insets.right : 0,
            }}
            onPress={() => router.navigate({ pathname: '/play', params: { game: game.id } })}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1 },
  header: { paddingBottom: space[3], gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 30, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 14, color: palette.mutedForeground },
  cards: { flex: 1, gap: 2 },
  cardsSideBySide: { flexDirection: 'row' },
  card: { flex: 1, minHeight: MIN_CARD_HEIGHT },
  suspended: { marginBottom: space[3] },
});

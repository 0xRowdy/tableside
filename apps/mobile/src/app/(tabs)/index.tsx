import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameCard } from '@/components/GameCard';
import { LAUNCH_GAMES } from '@/games';
import { fonts, palette, space, textScale } from '@/theme/tokens';

/** Above this text scale, landscape also stacks the cards so their text has room. */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;
const MIN_CARD_HEIGHT = 188;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.header, { paddingTop: insets.top + space[2], paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
          Tableside
        </Text>
        {!sideBySide && <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>Pick a table to practice.</Text>}
      </View>
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
});

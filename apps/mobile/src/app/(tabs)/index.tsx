import { router } from 'expo-router';
import { Users } from 'lucide-react-native';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GameCard } from '@/components/GameCard';
import { useLaunchSample } from '@/hooks/use-launch-sample';
import { Notice, NoticeText } from '@/components/Notice';
import { LAUNCH_GAMES } from '@/games';
import { lessonsHref } from '@/lessons/routes';
import { StartHereCard } from '@/lessons/StartHereCard';
import { GAME_WORDS, modeText } from '@/play/game-words';
import { capitalize } from '@/play/units';
import { usePractice } from '@/practice/PracticeProvider';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles, useStackedLayout } from '@/theme/type';
import { useLearning } from '@/training/TrainingProvider';

const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.35;
const MIN_CARD_HEIGHT = 188;
function CommunityEntry() {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Community"
      onPress={() => router.navigate('/more/community')}
      {...focusProps}
      style={({ pressed }) => [styles.community, pressed && pressStyle.edgeless, focused && styles.focused]}
    >
      <Users color={palette.foreground} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.communityLabel}>
        Community
      </Text>
    </Pressable>
  );
}

export default function Home() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width > height && fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  const stacked = useStackedLayout();
  const { snapshot } = usePractice();
  const suspended = snapshot.status === 'active' && snapshot.suspension?.reached ? snapshot : null;
  const words = suspended ? GAME_WORDS[suspended.view.game] : null;
  const { service: training, learning } = useLearning();
  useLaunchSample(snapshot.status !== 'loading');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.header, stacked && styles.headerStacked, { paddingTop: insets.top + space[2], paddingLeft: insets.left + 20, paddingRight: insets.right + 20 }]}>
        <View style={styles.wordmark}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            Tableside
          </Text>
          {!sideBySide && <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>Pick a table to practice.</Text>}
        </View>
        {/* Spec 2 Amendment 10 §1; S1-01 MYB3r, i41k8 */}
        <CommunityEntry />
      </View>
      {suspended && words && (
        // Spec 1 S1-01, Amendment 1 A6
        <View style={[styles.suspended, { marginLeft: insets.left + space[4], marginRight: insets.right + space[4] }]}>
          <Notice title={`${words.title} session suspended`} testID="session-suspended">
            <NoticeText>
              {capitalize(modeText(suspended.view.strategy))} · {words.status(suspended.view).toLowerCase()}. Nothing has been {words.drawn} or settled since you left.
            </NoticeText>
            <Button label="Resume session" onPress={() => router.navigate('/play')} />
          </Notice>
        </View>
      )}
      {learning?.startHere && (
        // Spec 3 Lessons › Entry points; S1-01 olGG6; #146
        <View style={[styles.startHere, { marginLeft: insets.left + space[4], marginRight: insets.right + space[4] }]}>
          <StartHereCard onOpen={() => router.navigate(lessonsHref({ from: 'home' }))} onDismiss={() => void training.setStartHere(false)} />
        </View>
      )}
      <View style={[styles.cards, sideBySide && styles.cardsSideBySide]}>
        {LAUNCH_GAMES.map((game, i) => (
          <GameCard
            key={game.id}
            game={game}
            style={styles.card}
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

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1 },
  header: { paddingBottom: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] },
  headerStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  wordmark: { flexShrink: 1, flexGrow: 1, gap: 2 },
  community: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: palette.secondary,
    backgroundColor: palette.secondary,
  },
  communityLabel: { fontFamily: fonts.uiSemiBold, ...type.secondary, color: palette.foreground },
  focused: { borderColor: palette.foreground },
  title: { fontFamily: fonts.display, ...type.display, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  cards: { flex: 1, gap: 2 },
  cardsSideBySide: { flexDirection: 'row' },
  card: { flex: 1, minHeight: MIN_CARD_HEIGHT },
  suspended: { marginBottom: space[3] },
  startHere: { marginBottom: space[3] },
}));

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { LaunchGame } from '@/games';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { fonts, palette, space, textScale } from '@/theme/tokens';

/** `contentInset` keeps the text clear of notches and rounded corners while the photo runs edge to edge. */
export function GameCard({
  game,
  onPress,
  style,
  contentInset = { left: 0, right: 0 },
}: {
  game: LaunchGame;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  contentInset?: { left: number; right: number };
}) {
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}. ${game.spokenSummary}`}
      accessibilityHint="Opens game setup"
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      <Image source={game.image} contentFit="cover" accessible={false} style={StyleSheet.absoluteFill} />
      {/* Text sits on a solid scrim band, so it meets text contrast over any photo at any text size. */}
      <View style={[styles.content, { paddingLeft: CONTENT_PADDING + contentInset.left, paddingRight: CONTENT_PADDING + contentInset.right }]}>
        <LinearGradient colors={[palette.transparent, palette.scrim]} style={styles.fade} />
        <Text maxFontSizeMultiplier={textScale.body} style={styles.summary}>{game.summary}</Text>
        <View style={styles.titleRow}>
          <Text maxFontSizeMultiplier={textScale.display} style={styles.title}>{game.title}</Text>
          <View style={styles.go}>
            <ArrowRight size={22} color={palette.primaryForeground} />
          </View>
        </View>
      </View>
      {focused && <View pointerEvents="none" style={styles.focusRing} />}
    </Pressable>
  );
}

const CONTENT_PADDING = space[6] - 4;

const styles = StyleSheet.create({
  card: { overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: palette.card },
  pressed: { opacity: 0.85 },
  content: { padding: CONTENT_PADDING, gap: space[1], backgroundColor: palette.scrim },
  fade: { position: 'absolute', left: 0, right: 0, bottom: '100%', height: space[16] },
  summary: {
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.onImage,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: palette.onImage },
  go: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusRing: { position: 'absolute', inset: 0, borderWidth: 3, borderColor: palette.ring },
});

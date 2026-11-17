// Spec 3 S3-03 P4WjR, drVnR, BFdJT; S3-12 aJV2y; #158, #132, #144

import type { ChallengeCard, HiLoValue } from '@tableside/engine';
import { Check, CircleDot, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { cardName, cardRank, signed, SUIT_GLYPH } from '@/play/blackjack-text';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import { CHOICE_TAG, spokenValue, type ChoiceState } from '@/training/challenge-text';

const SUIT_TOKEN = { spades: 'suitSpade', hearts: 'suitHeart', diamonds: 'suitDiamond', clubs: 'suitClub' } as const;

export function PlayingCard({ card }: { card: ChallengeCard }) {
  const color = palette[SUIT_TOKEN[card.suit]];
  const glyph = SUIT_GLYPH[card.suit];
  return (
    <View accessible accessibilityLabel={cardName(card)} testID="challenge-card" style={styles.card}>
      <View style={styles.corner}>
        <Text maxFontSizeMultiplier={1} style={[styles.rank, { color }]}>
          {cardRank(card)}
        </Text>
        <Text maxFontSizeMultiplier={1} style={[styles.cornerSuit, { color }]}>
          {glyph}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={1} style={[styles.pip, { color }]}>
        {glyph}
      </Text>
    </View>
  );
}

const CHOICE_TONE = { correct: palette.correct, 'your-answer': palette.mistake, 'your-pick': palette.mistake, recorded: palette.foreground } as const;
const CHOICE_ICON = { correct: Check, 'your-answer': X, 'your-pick': X, recorded: CircleDot } as const;

export function Choice({ value, state, enabled, onPress }: { value: HiLoValue; state: ChoiceState; enabled: boolean; onPress: () => void }) {
  const { focused, focusProps } = useKeyboardFocus();
  const tone = state ? CHOICE_TONE[state] : palette.controlBorder;
  const Icon = state ? CHOICE_ICON[state] : X;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spokenValue(value)}
      accessibilityValue={state ? { text: CHOICE_TAG[state] } : undefined}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.choice, { borderColor: tone }, state !== null && styles.choiceMarked, pressed && styles.pressed, focused && styles.focused]}
    >
      <Text maxFontSizeMultiplier={textScale.body} style={styles.choiceValue}>
        {signed(value)}
      </Text>
      {state && (
        <View style={styles.tag}>
          <Icon color={tone} size={14} />
          <Text maxFontSizeMultiplier={textScale.body} style={[styles.tagText, { color: tone }]}>
            {CHOICE_TAG[state]}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', width: 120, height: 168, paddingVertical: space[3] - 2, paddingHorizontal: space[3], borderRadius: 12, backgroundColor: palette.cardFace, justifyContent: 'space-between' },
  corner: { alignItems: 'center', alignSelf: 'flex-start' },
  rank: { fontFamily: fonts.uiBold, fontSize: 40, lineHeight: 44 },
  cornerSuit: { fontSize: 28, lineHeight: 30 },
  pip: { alignSelf: 'flex-end', fontSize: 60, lineHeight: 64 },
  choice: {
    flex: 1,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingVertical: space[3],
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: palette.secondary,
  },
  choiceMarked: { borderWidth: 2, minHeight: 96 },
  choiceValue: { fontFamily: fonts.uiBold, fontSize: 30, color: palette.foreground },
  tag: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  tagText: { fontFamily: fonts.uiBold, fontSize: 12 },
  pressed: { opacity: 0.8 },
  focused: { borderColor: palette.ring, borderWidth: 2 },
});

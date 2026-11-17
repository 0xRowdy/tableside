// Spec 3 S3-12 aJV2y; Lessons › Structure (worked examples); Amendment 1 B4; #144

import type { WorkedExample as Script } from '@tableside/definitions';
import type { HiLoValue } from '@tableside/engine';
import { ArrowRight, RotateCcw, SkipForward } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Choice, PlayingCard } from '@/counting/CardChoices';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { learnAnswerCue } from '@/feedback/training-cues';
import { NavButton } from '@/lessons/LessonPlayer';
import { BackButton } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { CARD_PROMPT, hiLoText, type ChoiceState } from '@/training/challenge-text';
import { CONTINUE, EXAMPLE_NOTE, SKIP_EXAMPLE, TRY_IT_AGAIN, WORKED_EXAMPLE } from '@/training/lesson-text';

const choiceState = (answer: HiLoValue, correct: boolean, picked: HiLoValue | null): ChoiceState => {
  if (picked === null) return null;
  if (correct) return 'correct';
  return answer === picked ? 'your-pick' : null;
};

export function WorkedExample({ example, lesson, busy, onBack, onDone }: { example: Script; lesson: string; busy: boolean; onBack: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const [picked, setPicked] = useState<HiLoValue | null>(null);
  const response = example.choices.find((choice) => choice.answer === picked)?.response ?? null;
  const pick = (answer: HiLoValue, correct: boolean) => {
    setPicked(answer);
    feedback.cue(learnAnswerCue(correct));
  };
  return (
    <ScrollView
      testID="worked-example-scroll"
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }}
    >
      <View style={styles.header}>
        <BackButton label={lesson} onPress={onBack} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            {WORKED_EXAMPLE}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.subtitle}>
            {lesson}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.note}>
          {EXAMPLE_NOTE}
        </Text>
        <PlayingCard card={example.card} />
        <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
          {CARD_PROMPT}
        </Text>
        <View style={styles.choices}>
          {example.choices.map(({ answer, response: { correct } }) => (
            <Choice key={answer} value={answer} state={choiceState(answer, correct, picked)} enabled={picked === null} onPress={() => pick(answer, correct)} />
          ))}
        </View>
        {response && (
          <View style={styles.response} accessibilityLiveRegion="polite" testID="scripted-response">
            <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>
              {hiLoText(response.explanation)}
            </Text>
            {response.note && (
              <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
                {response.note}
              </Text>
            )}
          </View>
        )}
        <View style={styles.nav}>
          {picked === null ? (
            <NavButton icon={SkipForward} label={SKIP_EXAMPLE} disabled={busy} onPress={onDone} />
          ) : (
            <>
              <NavButton icon={RotateCcw} label={TRY_IT_AGAIN} disabled={busy} onPress={() => setPicked(null)} />
              <NavButton icon={ArrowRight} label={CONTINUE} primary disabled={busy} onPress={onDone} />
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiBold, fontSize: 17, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[6] - space[1] },
  note: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 20, color: palette.mutedForeground },
  prompt: { fontFamily: fonts.uiBold, fontSize: 18, color: palette.foreground },
  choices: { flexDirection: 'row', gap: space[3] - 2 },
  response: { gap: space[1], padding: 14, borderRadius: radius.lg - 2, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  headline: { fontFamily: fonts.uiBold, fontSize: 15, lineHeight: 23, color: palette.foreground },
  detail: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 22, color: palette.mutedForeground },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] + 2, paddingTop: space[2] },
});

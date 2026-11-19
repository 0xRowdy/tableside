// Spec 3 S3-12 aJV2y; Lessons › Structure (worked examples); Amendment 1 B4; #144, #152, #153, #155

import type { CardValueExample, WorkedExample as Script, StrategyStepExample } from '@tableside/definitions';
import { ArrowRight, RotateCcw, SkipForward } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Choice, PlayingCard } from '@/counting/CardChoices';
import { BlackjackCountingExample, countingAnswer } from '@/lessons/BlackjackCountingExample';
import { useFeedback } from '@/feedback/FeedbackProvider';
import { EXAMPLE_CUES } from '@/feedback/training-cues';
import { NavButton } from '@/lessons/LessonParts';
import { signed } from '@/play/blackjack-text';
import { BackButton } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { CARD_PROMPT, hiLoText, spokenValue, type ChoiceState } from '@/training/challenge-text';
import {
  CONTINUE,
  EXAMPLE_NOTE,
  exampleStrategyName,
  scriptedResponseLine,
  scriptedTurnLine,
  SKIP_EXAMPLE,
  SO_FAR,
  strategyChoiceText,
  strategyPrompt,
  TRY_IT_AGAIN,
  WORKED_EXAMPLE,
} from '@/training/lesson-text';

const scriptedChoiceState = (index: number, correct: boolean, picked: number | null): ChoiceState => {
  if (picked === null) return null;
  if (correct) return 'correct';
  return index === picked ? 'your-pick' : null;
};

interface Picking {
  readonly picked: number | null;
  readonly onPick: (index: number, correct: boolean) => void;
}

function Response({ headline, detail = null, note }: { headline: string; detail?: string | null; note: string | null }) {
  const styles = useStyles();
  return (
    <View style={styles.response} accessibilityLiveRegion="polite" testID="scripted-response">
      <Text maxFontSizeMultiplier={textScale.display} style={styles.headline}>
        {headline}
      </Text>
      {detail && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {detail}
        </Text>
      )}
      {note && (
        <Text maxFontSizeMultiplier={textScale.body} style={styles.detail}>
          {note}
        </Text>
      )}
    </View>
  );
}

export function WorkedExample({ example, lesson, busy, onBack, onDone }: { example: Script; lesson: string; busy: boolean; onBack: () => void; onDone: () => void }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const [picked, setPicked] = useState<number | null>(null);
  const onPick = (index: number, correct: boolean) => {
    setPicked(index);
    for (const cue of EXAMPLE_CUES[example.kind].answer(correct, example.kind === 'strategy-step' ? (example.choices[0]?.answer.kind ?? null) : null)) feedback.cue(cue);
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
        <Body example={example} picked={picked} onPick={onPick} />
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

function Body({ example, picked, onPick }: { example: Script } & Picking) {
  if (example.kind === 'card-value') return <CardValue example={example} picked={picked} onPick={onPick} />;
  if (example.kind === 'strategy-step') return <StrategyStep example={example} picked={picked} onPick={onPick} />;
  return (
    <>
      <BlackjackCountingExample example={example} picked={picked} onPick={onPick} choiceState={scriptedChoiceState} />
      {picked !== null && <Response {...countingAnswer(example, picked)} />}
    </>
  );
}

function CardValue({ example, picked, onPick }: { example: CardValueExample } & Picking) {
  const styles = useStyles();
  const response = picked === null ? null : example.choices[picked]!.response;
  return (
    <>
      <PlayingCard card={example.card} />
      <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
        {CARD_PROMPT}
      </Text>
      <View style={styles.choices}>
        {example.choices.map(({ answer, response: { correct } }, index) => (
          <Choice key={answer} label={signed(answer)} spoken={spokenValue(answer)} state={scriptedChoiceState(index, correct, picked)} enabled={picked === null} onPress={() => onPick(index, correct)} />
        ))}
      </View>
      {response && <Response headline={hiLoText(response.explanation)} note={response.note} />}
    </>
  );
}

// Spec 3 Lessons › Structure (worked examples); #155
function StrategyStep({ example, picked, onPick }: { example: StrategyStepExample } & Picking) {
  const styles = useStyles();
  const name = exampleStrategyName(example);
  const asks = example.choices[0]?.answer.kind ?? 'bets';
  const response = picked === null ? null : example.choices[picked]!.response;
  return (
    <>
      <View style={styles.history}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.historyTitle}>
          {SO_FAR}
        </Text>
        {example.turns.map((turn, index) => (
          <Text key={index} maxFontSizeMultiplier={textScale.body} style={styles.historyLine}>
            {scriptedTurnLine(example.game, turn, index, asks === 'play' && index === example.turns.length - 1)}
          </Text>
        ))}
      </View>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
        {strategyPrompt(name, asks)}
      </Text>
      <View style={styles.stacked}>
        {example.choices.map(({ answer, response: { correct } }, index) => {
          const text = strategyChoiceText(example.game, answer);
          return <Choice key={text} label={text} spoken={text} wide state={scriptedChoiceState(index, correct, picked)} enabled={picked === null} onPress={() => onPick(index, correct)} />;
        })}
      </View>
      {response && <Response headline={scriptedResponseLine(name, response.explanation, example.game)} note={response.note} />}
    </>
  );
}

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  subtitle: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  body: { gap: space[4], paddingTop: space[2], paddingHorizontal: space[6] - space[1] },
  note: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  prompt: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  choices: { flexDirection: 'row', gap: space[3] - 2 },
  stacked: { gap: space[2] + 2 },
  history: { gap: space[1], padding: space[4], borderRadius: radius.lg, backgroundColor: palette.card },
  historyTitle: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  historyLine: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  response: { gap: space[1], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.card },
  headline: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  detail: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] + 2, paddingTop: space[2] },
}))

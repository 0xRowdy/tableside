// Spec 3 S3-12 aJV2y; Lessons › Structure (worked examples); Amendment 2 §3; #153
import type { ConversionExample, CountingExample, RunningCountExample, ScriptedChoice, TableCountExample } from '@tableside/definitions';
import type { ChallengeCard } from '@tableside/engine';
import { Text, View } from 'react-native';

import { Choice, PlayingCard } from '@/counting/CardChoices';
import { signed } from '@/play/blackjack-text';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import {
  conversionExampleText,
  GIVEN_DECKS,
  GIVEN_RUNNING_COUNT,
  ROUND_PROMPT,
  roundLead,
  RUNNING_COUNT_PROMPT,
  runningCountExampleText,
  TRUE_COUNT_PROMPT,
} from '@/training/blackjack-counting-example-text';
import { decksText } from '@/training/blackjack-conversion-text';
import { DEALER, runningHeadline, tableRunningText, YOUR_SEAT } from '@/training/blackjack-table-text';
import { spokenValue, type ChoiceState } from '@/training/challenge-text';

export interface ScriptedAnswer {
  readonly headline: string;
  readonly detail: string | null;
  readonly note: string | null;
}

interface Props<Example> {
  readonly example: Example;
  readonly picked: number | null;
  readonly onPick: (index: number, correct: boolean) => void;
  readonly choiceState: (index: number, correct: boolean, picked: number | null) => ChoiceState;
}

function Given({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.given}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.givenLabel}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={textScale.display} style={styles.givenValue}>
        {value}
      </Text>
    </View>
  );
}

function Choices({ choices, picked, onPick, choiceState }: Omit<Props<unknown>, 'example'> & { choices: readonly ScriptedChoice<number, unknown>[] }) {
  const styles = useStyles();
  return (
    <View style={styles.choices}>
      {choices.map(({ answer, response: { correct } }, index) => (
        <Choice key={answer} label={signed(answer)} spoken={spokenValue(answer)} state={choiceState(index, correct, picked)} enabled={picked === null} onPress={() => onPick(index, correct)} />
      ))}
    </View>
  );
}

function Prompt({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <Text maxFontSizeMultiplier={textScale.display} style={styles.prompt}>
      {text}
    </Text>
  );
}

function Conversion(props: Props<ConversionExample>) {
  const styles = useStyles();
  const { example } = props;
  return (
    <>
      <View style={styles.givens}>
        <Given label={GIVEN_RUNNING_COUNT} value={signed(example.running)} />
        <Given label={GIVEN_DECKS} value={decksText(example.decks)} />
      </View>
      <Prompt text={TRUE_COUNT_PROMPT} />
      <Choices choices={example.choices} {...props} />
    </>
  );
}

function RunningCount(props: Props<RunningCountExample>) {
  const styles = useStyles();
  const { example } = props;
  return (
    <>
      <View style={styles.givens}>
        <Given label={GIVEN_RUNNING_COUNT} value={signed(example.before)} />
        <PlayingCard card={example.card} />
      </View>
      <Prompt text={RUNNING_COUNT_PROMPT} />
      <Choices choices={example.choices} {...props} />
    </>
  );
}

function Hand({ label, cards }: { label: string; cards: readonly ChallengeCard[] }) {
  const styles = useStyles();
  return (
    <View style={styles.hand}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.givenLabel}>
        {label}
      </Text>
      <View style={styles.cards}>
        {cards.map((card, index) => (
          <PlayingCard key={index} card={card} small />
        ))}
      </View>
    </View>
  );
}

function TableCount(props: Props<TableCountExample>) {
  const styles = useStyles();
  const { example } = props;
  const explanation = example.choices[0]!.response.explanation;
  return (
    <>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.lead}>
        {roundLead(explanation.round, explanation.before)}
      </Text>
      <View style={styles.table}>
        <Hand label={DEALER} cards={example.dealer} />
        <Hand label={YOUR_SEAT} cards={example.seat} />
      </View>
      <Prompt text={ROUND_PROMPT} />
      <Choices choices={example.choices} {...props} />
    </>
  );
}

export function BlackjackCountingExample(props: Props<CountingExample>) {
  const { example } = props;
  if (example.kind === 'conversion') return <Conversion {...props} example={example} />;
  if (example.kind === 'running-count') return <RunningCount {...props} example={example} />;
  return <TableCount {...props} example={example} />;
}

// Spec 3 Lessons › Structure (worked examples)
export function countingAnswer(example: CountingExample, picked: number): ScriptedAnswer {
  if (example.kind === 'conversion') {
    const { explanation, note } = example.choices[picked]!.response;
    return { headline: conversionExampleText(explanation), detail: null, note };
  }
  if (example.kind === 'running-count') {
    const { explanation, note } = example.choices[picked]!.response;
    return { headline: runningCountExampleText(explanation), detail: null, note };
  }
  const { explanation, note } = example.choices[picked]!.response;
  return { headline: runningHeadline(explanation.count), detail: tableRunningText(explanation, 'after-round'), note };
}

const useStyles = makeStyles((type) => ({
  givens: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] + 2 },
  given: { flexGrow: 1, flexBasis: 150, gap: space[1], paddingVertical: space[3], paddingHorizontal: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  givenLabel: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  givenValue: { fontFamily: fonts.uiBold, ...type.figure, color: palette.foreground },
  prompt: { fontFamily: fonts.uiBold, ...type.heading, color: palette.foreground },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] - 2 },
  lead: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
  table: { gap: space[3], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  hand: { gap: space[2] },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
}));

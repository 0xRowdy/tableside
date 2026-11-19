// Spec 3 Learn, Check and assistance, Seam 3; S3-06 zAatf, Qv1An, BFM4l, efGY7, g36fg; #134

import { CHALLENGE_CONTENT } from '@tableside/definitions';
import {
  advanceChallenge,
  createChallenge,
  RANDOM_PROTOCOL_VERSION,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeState,
  type ChallengeVariant,
  type ChallengeView,
  type ConversionItem,
} from '@tableside/engine';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChallengeExercise } from '@/counting/ChallengeExercise';
import type { LearnerCommand } from '@/training/service';
import {
  expectIndistinguishable,
  expectNoFeedbackColors,
  expectNotPresented,
  presentedScreen,
  watchAccessibilityEvents,
  type AccessibilityEvents,
} from '@/training/testing/information-hiding';

const seed = { protocol: RANDOM_PROTOCOL_VERSION, key: [1, 0x9e3779b9], session: [8, 0] } as const;

const NEXT: ChallengeCommand = { kind: 'next-item' };

// Spec 3 S3-06 zAatf, Qv1An
const QUESTIONS: ConversionItem[] = [
  { running: 0, decks: 3 },
  { running: 8, decks: 2 },
  { running: 11, decks: 3.5 },
  { running: -7, decks: 2 },
  { running: -5, decks: 6 },
  { running: 5, decks: 0.5 },
  { running: -9, decks: 1.5 },
  { running: 20, decks: 6 },
  { running: 1, decks: 4 },
  { running: -13, decks: 4.5 },
];

// docs/cross-runtime-harness.md Adding cases
const TRUE_COUNTS = [0, 4, 3, -3, 0, 10, -6, 3, 0, -2];

function attempt(variant: ChallengeVariant, commands: readonly ChallengeCommand[] = [], questions: readonly ConversionItem[] = QUESTIONS): ChallengeState {
  let state = createChallenge({ attemptId: 'attempt-1', owner: 'local', device: 'test-device', variant, content: CHALLENGE_CONTENT.conversion }, seed);
  for (const command of [{ kind: 'begin' } as const, ...commands]) {
    const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}`);
    state = command.kind === 'begin' ? { ...result.state, items: questions } : result.state;
  }
  return state;
}

const atQuestion4 = (variant: ChallengeVariant, then: readonly ChallengeCommand[] = []) =>
  attempt(variant, [...TRUE_COUNTS.slice(0, 3).flatMap((value): ChallengeCommand[] => [{ kind: 'answer', value }, NEXT]), ...then]);

let events: AccessibilityEvents;
let sent: LearnerCommand[];
let rejected: number;

beforeAll(() => {
  events = watchAccessibilityEvents();
});

async function present(view: ChallengeView) {
  await cleanup();
  events.clear();
  sent = [];
  rejected = 0;
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ChallengeExercise
        view={view}
        busy={view.phase === 'recorded'}
        saveFailed={false}
        hold={null}
        timer={null}
        pacing="self-paced"
        performanceMs={() => null}
        onPause={() => undefined}
        onResume={() => undefined}
        onEnd={() => undefined}
        onLeave={() => undefined}
        onCommand={(command) => void sent.push(command)}
        onInputRejected={() => void rejected++}
        onRetrySave={() => undefined}
      />
    </SafeAreaProvider>,
  );
  return presentedScreen(screen.toJSON() as never, events, { mask: ['given-values'] });
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('the true-count conversion exercise', () => {
  it('Check gives the running count and decks remaining and asks for the true count, with no rounding rule or count toggle (S3-06 zAatf, BFM4l)', async () => {
    await present(readChallengeView(atQuestion4('check')));
    expect(screen.getByRole('header', { name: 'True-count conversion' })).toBeOnTheScreen();
    expect(screen.getByText('Question 4 of 10')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, minus 7')).toHaveTextContent('Running count−7');
    expect(screen.getByLabelText('Decks remaining, 2')).toHaveTextContent('Decks remaining2');
    expect(screen.getByText('Enter the true count')).toBeOnTheScreen();
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Change sign', 'Delete', 'Skip', 'Submit']) expect(screen.getByRole('button', { name: key })).toBeEnabled();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/truncat|round|toward zero/i)).toBeNull();

    await press('3');
    await press('Change sign');
    expect(screen.getByLabelText('True count')).toHaveDisplayValue('−3');
    await press('Submit');
    expect(sent).toEqual([{ kind: 'answer', value: -3 }]);

    await present(readChallengeView(attempt('check', [], [{ running: 5, decks: 1.5 }, ...QUESTIONS.slice(1)])));
    expect(screen.getByLabelText('Running count, plus 5')).toHaveTextContent('Running count+5');
    expect(screen.getByLabelText('Decks remaining, 1.5')).toHaveTextContent('Decks remaining1.5');
    await press('Skip');
    expect(sent).toEqual([{ kind: 'skip' }]);
  });

  it('rejects a malformed or out-of-range true count locally with cue 9, submitting nothing (g36fg)', async () => {
    await present(readChallengeView(atQuestion4('check')));
    await fireEvent.changeText(screen.getByLabelText('True count'), '41');
    await press('Submit');
    expect([sent, rejected]).toEqual([[], 1]);
    expect(screen.getByRole('alert')).toHaveTextContent("Enter a count from −40 to +40. Nothing was submitted, and it doesn't count against you.");
    await fireEvent.changeText(screen.getByLabelText('True count'), '−3.5');
    await press('Submit');
    expect([sent, rejected]).toEqual([[], 2]);
    expect(screen.getByRole('alert')).toHaveTextContent("Enter a whole number. Nothing was submitted, and it doesn't count against you.");
  });

  it('Learn explains the arithmetic and truncation after the answer, before the next question (S3-06 Qv1An, efGY7)', async () => {
    await present(readChallengeView(atQuestion4('learn', [{ kind: 'answer', value: -3 }])));
    expect(screen.getByText('Learn · self-paced')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, minus 7')).toBeOnTheScreen();
    expect(screen.getByText('Marcus · Learn')).toBeOnTheScreen();
    expect(within(screen.getByTestId('coach-note')).getByText('True count')).toBeOnTheScreen();
    expect(screen.getByText('−3 is right.')).toBeOnTheScreen();
    expect(screen.getByText('−7 ÷ 2 = −3.5. Tableside truncates toward zero, so −3. Rounding down to −4 is the common slip; some charts online round differently.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try this question again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Read the conversion lesson' })).toBeDisabled();
    expect(screen.getByText('Enter the true count')).toBeOnTheScreen();
    expect(screen.getByLabelText('True count')).toHaveDisplayValue('');
    for (const key of ['1', '0', 'Change sign', 'Delete', 'Skip']) expect(screen.getByRole('button', { name: key })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
    await press('Next question');
    expect(sent).toEqual([{ kind: 'next-item' }]);

    await present(readChallengeView(atQuestion4('learn', [{ kind: 'answer', value: -4 }])));
    expect(screen.getByText('The true count is −3.')).toBeOnTheScreen();
    await press('Try this question again');
    expect(sent).toEqual([{ kind: 'retry-item' }]);

    await cleanup();
    let opened: string[] = [];
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ChallengeExercise
          view={readChallengeView(atQuestion4('learn', [{ kind: 'answer', value: -3 }]))}
          busy={false}
          saveFailed={false}
          hold={null}
          timer={null}
          pacing="self-paced"
          performanceMs={() => null}
          onPause={() => undefined}
          onResume={() => undefined}
          onEnd={() => undefined}
          onLeave={() => undefined}
          onCommand={() => undefined}
          onInputRejected={() => undefined}
          onRetrySave={() => undefined}
          lesson={{ id: 'true-count-conversion', title: 'True-count conversion', summary: null, section: 'blackjack', steps: 4, access: 'available', status: 'not-started' } as never}
          onOpenLesson={(id) => void (opened = [...opened, id])}
        />
      </SafeAreaProvider>,
    );
    await press('Read the conversion lesson');
    expect(opened).toEqual(['true-count-conversion']);

    const explained = async (index: number, value: number) => {
      await present(readChallengeView(attempt('learn', [...TRUE_COUNTS.slice(0, index).flatMap((answer): ChallengeCommand[] => [{ kind: 'answer', value: answer }, NEXT]), { kind: 'answer', value }])));
      return screen.getByTestId('coach-note');
    };
    expect(await explained(0, 0)).toHaveTextContent('0 ÷ 3 = 0, so the true count is 0.', { exact: false });
    expect(await explained(1, 4)).toHaveTextContent('+8 ÷ 2 = +4 exactly, so the true count is +4.', { exact: false });
    await explained(2, 3);
    expect(screen.getByText('+11 ÷ 3.5 ≈ +3.14. Tableside truncates toward zero, so +3.')).toBeOnTheScreen();
    await present(readChallengeView(attempt('learn', [{ kind: 'answer', value: 3 }], [{ running: 7, decks: 2 }, ...QUESTIONS.slice(1)])));
    expect(screen.getByText('+7 ÷ 2 = +3.5. Tableside truncates toward zero, so +3. Rounding up to +4 is the common slip; some charts online round differently.')).toBeOnTheScreen();
    expect(await explained(8, 0)).toHaveTextContent('+1 ÷ 4 = +0.25. Tableside truncates toward zero, so 0.', { exact: false });
    expect(await explained(4, 0)).toHaveTextContent('−5 ÷ 6 ≈ −0.83. Tableside truncates toward zero, so 0. Rounding down to −1 is the common slip; some charts online round differently.', { exact: false });
  });

  it('Check: a right and a wrong true count look the same while asked and once recorded, with no feedback color (Seam 3)', async () => {
    const asked = await present(readChallengeView(atQuestion4('check')));
    expectNoFeedbackColors(asked);
    expectIndistinguishable(await present(readChallengeView(attempt('check', [{ kind: 'answer', value: 0 }, NEXT, { kind: 'answer', value: 9 }, NEXT, { kind: 'answer', value: 9 }, NEXT]))), asked);

    const right = await present(readChallengeView(atQuestion4('check', [{ kind: 'answer', value: -3 }])));
    expect(screen.getByText('True count −3 recorded. Next question in a moment.')).toBeOnTheScreen();
    const wrong = await present(readChallengeView(attempt('check', [...[0, 4, 3].flatMap((value): ChallengeCommand[] => [{ kind: 'answer', value }, NEXT]), { kind: 'answer', value: -3 }], [...QUESTIONS.slice(0, 3), { running: -9, decks: 2 }, ...QUESTIONS.slice(4)])));
    expectIndistinguishable(wrong, right);
    expectNoFeedbackColors(right);
    expectNotPresented(right, ['Correct', 'Off by', 'Match', 'right', 'truncat']);
  });
});

// Spec 3 Learn, Check and assistance; Information hiding (end to end), Testing Decisions › Seam 3; S3-04 qdnQm, S3-05 EDnGd, S3-06 C53yTW; #133

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
} from '@tableside/engine';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChallengeExercise } from '@/counting/ChallengeExercise';
import type { LearnerCommand } from '@/training/service';
import { HI_LO_BY_RANK } from '@/training/testing/hi-lo';
import {
  expectIndistinguishable,
  expectNoFeedbackColors,
  expectNotPresented,
  presentedScreen,
  watchAccessibilityEvents,
  type AccessibilityEvents,
} from '@/training/testing/information-hiding';

const seed = (n: number) => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [n, 0x9e3779b9], session: [n * 7 + 1, 0] }) as const;

const NEXT: ChallengeCommand = { kind: 'next-item' };
const nexts = (count: number) => Array.from({ length: count }, () => NEXT);

function attempt(variant: ChallengeVariant, n: number, commands: readonly ChallengeCommand[] = []): ChallengeState {
  let state = createChallenge({ attemptId: 'attempt-1', owner: 'local', device: 'test-device', variant, content: CHALLENGE_CONTENT['running-count'] }, seed(n));
  for (const command of [{ kind: 'begin' } as const, ...commands]) {
    const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}`);
    state = result.state;
  }
  return state;
}

const countAfter = (state: ChallengeState, cards: number) => state.items.slice(0, cards).reduce((count, item) => count + HI_LO_BY_RANK[item.card.rank]!, 0);

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
        onCommand={(command) => void sent.push(command)}
        onInputRejected={() => void rejected++}
        onRetrySave={() => undefined}
      />
    </SafeAreaProvider>,
  );
  return presentedScreen(screen.toJSON() as never, events, { mask: ['challenge-card'] });
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('the running-count exercise', () => {
  it('shows cards between Check checkpoints with Next card and the hidden count, then asks at the checkpoint (S3-04 qdnQm)', async () => {
    await present(readChallengeView(attempt('check', 1, nexts(4))));
    expect(screen.getByText('Card 5 of 52 · checkpoint 1 of 4')).toBeOnTheScreen();
    expect(screen.getByText('Keep the count. Checkpoint 1 comes after card 13.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
    await press('Next card');
    expect(sent).toEqual([{ kind: 'next-item' }]);
    const toggle = screen.getByRole('switch', { name: 'Show running count' });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Hidden. Showing it marks this whole attempt assisted, permanently.')).toBeOnTheScreen();

    await present(readChallengeView(attempt('check', 1, nexts(12))));
    expect(screen.getByText('Card 13 of 52 · checkpoint 1 of 4')).toBeOnTheScreen();
    expect(screen.getByText('Checkpoint 1 of 4')).toBeOnTheScreen();
    expect(screen.getByText('Enter the running count after 13 cards')).toBeOnTheScreen();
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Change sign', 'Delete', 'Skip', 'Submit']) expect(screen.getByRole('button', { name: key })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Next card' })).toBeNull();
  });

  it('enters a signed count from the keypad or a keyboard and submits it', async () => {
    await present(readChallengeView(attempt('check', 1, nexts(12))));
    await press('1');
    await press('2');
    await press('Change sign');
    await press('Delete');
    await press('3');
    expect(screen.getByLabelText('Running count')).toHaveDisplayValue('−13');
    await press('Submit');
    expect(sent).toEqual([{ kind: 'answer', value: -13 }]);

    await present(readChallengeView(attempt('check', 1, nexts(12))));
    await fireEvent.changeText(screen.getByLabelText('Running count'), '+7');
    await fireEvent(screen.getByLabelText('Running count'), 'submitEditing');
    expect(sent).toEqual([{ kind: 'answer', value: 7 }]);

    await present(readChallengeView(attempt('check', 1, nexts(12))));
    await press('Skip');
    expect(sent).toEqual([{ kind: 'skip' }]);
  });

  it('rejects malformed counts locally with cue 9 and a neutral message, submitting nothing (S3-06 C53yTW)', async () => {
    const cases: [string, string][] = [
      ['', 'Enter a count first. Nothing was submitted, and it doesn’t count against you.'],
      ['−', "Add a number after the sign. Nothing was submitted, and it doesn't count against you."],
      ['2.5', 'Enter a whole number. Nothing was submitted, and it doesn’t count against you.'],
      ['abc', 'Enter a whole number. Nothing was submitted, and it doesn’t count against you.'],
      ['60', 'Enter a count from −52 to +52. Nothing was submitted, and it doesn’t count against you.'],
    ];
    for (const [typed, message] of cases) {
      const presented = await present(readChallengeView(attempt('check', 1, nexts(12))));
      await fireEvent.changeText(screen.getByLabelText('Running count'), typed);
      await press('Submit');
      expect([typed, sent, rejected]).toEqual([typed, [], 1]);
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expectNoFeedbackColors(presentedScreen(screen.toJSON() as never, events, { mask: ['challenge-card'] }));
      expect(presented).toBeDefined();
    }
    await press('4');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Check: the first reveal asks first, then is the reveal command; hiding and showing again send nothing and play no cue (S3-05 EDnGd)', async () => {
    await present(readChallengeView(attempt('check', 1, [...nexts(12), { kind: 'answer', value: 0 }, ...nexts(8)])));
    await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
    expect(screen.getByRole('header', { name: 'Show the running count?' })).toBeOnTheScreen();
    expect(screen.getByText("Showing it marks this whole attempt as assisted, permanently. Hiding it again won't undo that.")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Assisted attempts still get full results, but they're kept apart from unassisted records and can't count toward a readiness milestone. Showing the count doesn't use another attempt.",
      ),
    ).toBeOnTheScreen();
    await press('Keep it hidden');
    expect(screen.queryByRole('header', { name: 'Show the running count?' })).toBeNull();
    expect(sent).toEqual([]);
    await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
    await press('Show count and mark assisted');
    expect(sent).toEqual([{ kind: 'reveal-count' }]);

    const revealed = attempt('check', 1, [...nexts(12), { kind: 'answer', value: 0 }, ...nexts(8), { kind: 'reveal-count' }]);
    const count = countAfter(revealed, 21);
    await present(readChallengeView(revealed));
    await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
    expect(sent).toEqual([]);
    expect(within(screen.getByTestId('count-aid')).getByText(count > 0 ? `+${count}` : count < 0 ? `−${-count}` : '0')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Show running count' })).toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
    expect(screen.queryByTestId('count-aid')).toBeNull();
    expect(screen.getByText('Hidden. This attempt is already marked assisted; showing it again changes nothing.')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Show the running count?' })).toBeNull();
    expect(sent).toEqual([]);
    expect(events.announcements).toEqual([]);
  });

  it('Learn: revealing needs no warning and is the reveal command; an answer is explained with the count before the next card', async () => {
    await present(readChallengeView(attempt('learn', 1)));
    expect(screen.getByText('Enter the running count after 1 card')).toBeOnTheScreen();
    expect(screen.getByText('Hidden. Learn notes whether you showed it.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
    expect(screen.queryByRole('header', { name: 'Show the running count?' })).toBeNull();
    expect(sent).toEqual([{ kind: 'reveal-count' }]);

    const first = attempt('learn', 1);
    const card = first.items[0]!.card;
    const value = HI_LO_BY_RANK[card.rank]!;
    const wrong = value === 1 ? 0 : 1;
    await present(readChallengeView(attempt('learn', 1, [{ kind: 'answer', value: wrong }])));
    expect(screen.getByText('NOT QUITE · YOUR FIRST ANSWER IS SCORED')).toBeOnTheScreen();
    expect(screen.getByText(`The count after card 1 is ${value > 0 ? '+1' : value < 0 ? '−1' : '0'}.`)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try this card again' })).toBeEnabled();
    await press('Next card');
    expect(sent).toEqual([{ kind: 'next-item' }]);
  });

  it('Check: a right and a wrong count look the same at the checkpoint and once recorded, with no feedback color (Seam 3)', async () => {
    const right = countAfter(attempt('check', 1), 13);
    const other = [2, 3, 4, 5, 6, 7, 8].find((n) => countAfter(attempt('check', n), 13) !== right)!;
    const asked = await present(readChallengeView(attempt('check', 1, nexts(12))));
    expectNoFeedbackColors(asked);
    expectIndistinguishable(await present(readChallengeView(attempt('check', other, nexts(12)))), asked);

    const entry: ChallengeCommand = { kind: 'answer', value: right };
    const wrong = await present(readChallengeView(attempt('check', other, [...nexts(12), entry])));
    const recorded = await present(readChallengeView(attempt('check', 1, [...nexts(12), entry])));
    expectIndistinguishable(wrong, recorded);
    expectNoFeedbackColors(recorded);
    expect(screen.getByText(`Count ${right > 0 ? `+${right}` : right < 0 ? `−${-right}` : '0'} recorded. Next card in a moment.`)).toBeOnTheScreen();
    expectNotPresented(recorded, ['Correct', 'Off by', 'Match']);
  });
});

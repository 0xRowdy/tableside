// Spec 3 Lessons › Structure (First-use hints), Information hiding (hint content), Testing Decisions › Seam 3; S1-04 XjwQc; #146

import { CHALLENGE_CONTENT, HINTS, type HintId } from '@tableside/definitions';
import {
  advanceChallenge,
  createChallenge,
  RANDOM_PROTOCOL_VERSION,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeState,
  type ChallengeView,
} from '@tableside/engine';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChallengeExercise, exerciseHints } from '@/counting/ChallengeExercise';
import { ScreenHints } from '@/lessons/FirstUseHints';
import { PresentationSwitch, TABLE_HINTS } from '@/play/bet-selector/Presentation';
import { TableTopBar } from '@/play/TableChrome';
import { alwaysAllowed } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService, type LearnerCommand } from '@/training/service';
import { cardOf, HI_LO_BY_RANK } from '@/training/testing/hi-lo';
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

function attempt(commands: readonly ChallengeCommand[], n = 1, category: 'running-count' | 'conversion' = 'running-count', variant: 'learn' | 'check' = 'check'): ChallengeState {
  let state = createChallenge({ attemptId: 'attempt-1', owner: 'local', device: 'test-device', variant, content: CHALLENGE_CONTENT[category] }, seed(n));
  for (const command of [{ kind: 'begin' } as const, ...commands]) {
    const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}`);
    state = result.state;
  }
  return state;
}

function seedWhere(test: (n: number) => boolean): number {
  for (let n = 1; n < 500; n++) if (test(n)) return n;
  throw new Error('no seed');
}

const countAfter = (state: ChallengeState, cards: number) => state.items.slice(0, cards).reduce((count, item) => count + HI_LO_BY_RANK[cardOf(item).rank]!, 0);

let store: MemoryTrainingStore;
let events: AccessibilityEvents;
let sent: LearnerCommand[];

const newService = () =>
  new TrainingService({
    store: store.reopen(),
    access: alwaysAllowed,
    allowance: plentyAllowance(() => Date.now()),
    clock: new FakeClock(undefined, true),
    entropy: entropyFromWords(PI_WORDS),
    newId: () => 'unused',
    device: 'test-device',
    owner: 'local',
  });

beforeAll(() => {
  events = watchAccessibilityEvents();
});

beforeEach(() => {
  store = new MemoryTrainingStore();
});

async function mount(ids: readonly HintId[], children: ReactNode, service = newService()) {
  await cleanup();
  events.clear();
  sent = [];
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ScreenHints service={service} ids={ids}>
        {children}
      </ScreenHints>
    </SafeAreaProvider>,
  );
  await act(() => service.learningPreferences());
  return service;
}

const exercise = (view: ChallengeView) => (
  <ChallengeExercise view={view} busy={false} saveFailed={false} onCommand={(command) => void sent.push(command)} onInputRejected={() => undefined} onRetrySave={() => undefined} />
);

const EXERCISE_HINTS: readonly HintId[] = ['count-entry', 'show-count'];
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('first-use hints on the running-count exercise', () => {
  it('show the first time, beside their controls, without gating play', async () => {
    const atCheckpoint = readChallengeView(attempt(nexts(12)));
    await mount(EXERCISE_HINTS, exercise(atCheckpoint));
    expect(screen.getByTestId('first-use-hint-count-entry')).toHaveTextContent(
      `NEW HERE · COUNT ENTRY${HINTS['count-entry'].text}Reread from Help (?)Got it`,
    );
    expect(screen.getByTestId('first-use-hint-show-count')).toHaveTextContent(new RegExp(`^NEW HERE · SHOW RUNNING COUNT${HINTS['show-count'].text}`));

    for (const key of ['1', 'Submit', 'Skip']) expect(screen.getByRole('button', { name: key })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Show running count' })).toBeEnabled();
    await press('1');
    await press('Submit');
    expect(sent).toEqual([{ kind: 'answer', value: 1 }]);
  });

  it('are never modal: no alert, no focus move, no announcement, and dismissing sends no command', async () => {
    await mount(EXERCISE_HINTS, exercise(readChallengeView(attempt(nexts(12)))));
    const hint = screen.getByTestId('first-use-hint-count-entry');
    expect(hint).not.toHaveProp('accessibilityViewIsModal', true);
    expect(hint).not.toHaveProp('accessibilityRole', 'alert');
    expect(screen.queryByRole('alert')).toBeNull();
    await press('Got it, hide the Count entry hint');
    expect(sent).toEqual([]);
    expect(events.focusMoves).toEqual([]);
    expect(events.announcements).toEqual([]);
  });

  it('stay dismissed on this device, and Help shows the screen’s hints again', async () => {
    await mount(EXERCISE_HINTS, exercise(readChallengeView(attempt(nexts(12)))));
    await press('Got it, hide the Count entry hint');
    expect(screen.queryByTestId('first-use-hint-count-entry')).toBeNull();
    expect(screen.getByTestId('first-use-hint-show-count')).toBeOnTheScreen();

    await mount(EXERCISE_HINTS, exercise(readChallengeView(attempt(nexts(12)))));
    expect(screen.queryByTestId('first-use-hint-count-entry')).toBeNull();
    await press('Got it, hide the Show running count hint');
    expect(screen.queryByTestId('first-use-hint-show-count')).toBeNull();

    await press('Help');
    expect(screen.getByTestId('first-use-hint-count-entry')).toBeOnTheScreen();
    expect(screen.getByTestId('first-use-hint-show-count')).toBeOnTheScreen();
    expect(sent).toEqual([]);
  });

  it('offer Help labelled as in the frame, and none on a card-values exercise, which has no hints', async () => {
    const counting = readChallengeView(attempt(nexts(3)));
    await mount(exerciseHints(counting), exercise(counting));
    expect(screen.getByRole('button', { name: 'Help' })).toHaveTextContent('Help');

    const cardValues = readChallengeView(
      (() => {
        const created = createChallenge({ attemptId: 'attempt-2', owner: 'local', device: 'test-device', variant: 'check', content: CHALLENGE_CONTENT['card-values'] }, seed(1));
        const begun = advanceChallenge(created, { sequence: created.sequence, commandId: 'c-0', command: { kind: 'begin' } });
        if (begun.status !== 'committed') throw new Error('refused begin');
        return begun.state;
      })(),
    );
    expect(exerciseHints(cardValues)).toEqual([]);
    await mount(exerciseHints(cardValues), exercise(cardValues));
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull();
    expect(screen.queryAllByTestId(/^first-use-hint-/)).toEqual([]);
  });

  it('show the count-entry hint only where a count is asked for', async () => {
    await mount(EXERCISE_HINTS, exercise(readChallengeView(attempt(nexts(3)))));
    expect(screen.queryByTestId('first-use-hint-count-entry')).toBeNull();
    expect(screen.getByTestId('first-use-hint-show-count')).toBeOnTheScreen();
  });

  it('pass the Check information-hiding assertions: a right and a wrong count look and sound the same, with the hints showing', async () => {
    const zeroAt13 = seedWhere((n) => countAfter(attempt(nexts(12), n), 13) === 0);
    const otherAt13 = seedWhere((n) => countAfter(attempt(nexts(12), n), 13) !== 0);
    const enteredZero = async (n: number) => {
      await mount(EXERCISE_HINTS, exercise(readChallengeView(attempt([...nexts(12), { kind: 'answer', value: 0 }], n))));
      expect(screen.getByTestId('first-use-hint-show-count')).toBeOnTheScreen();
      return presentedScreen(screen.toJSON() as never, events, { mask: ['challenge-card'] });
    };
    const right = await enteredZero(zeroAt13);
    const wrong = await enteredZero(otherAt13);
    expectIndistinguishable(right, wrong);
    expectNoFeedbackColors(right);
    expectNotPresented(right, ['Correct', 'Wrong', 'reference', 'Reference']);

    await mount(EXERCISE_HINTS, exercise(readChallengeView(attempt(nexts(12), otherAt13))));
    expect(screen.getByTestId('first-use-hint-count-entry')).toBeOnTheScreen();
    const asking = presentedScreen(screen.toJSON() as never, events, { mask: ['challenge-card'] });
    expectNoFeedbackColors(asking);
    expectNotPresented(asking, ['Correct', 'Wrong', 'reference', 'Reference']);
  });
});

// #134
describe('the count-entry hint on the true-count exercise (S3-06 zAatf)', () => {
  it('is the screen’s only hint, shown above the true-count entry while a question is asked', async () => {
    const question = readChallengeView(attempt([], 1, 'conversion'));
    expect(exerciseHints(question)).toEqual(['count-entry']);
    await mount(exerciseHints(question), exercise(question));
    expect(screen.getByTestId('first-use-hint-count-entry')).toHaveTextContent(`NEW HERE · COUNT ENTRY${HINTS['count-entry'].text}Reread from Help (?)Got it`);
    expect(screen.queryByTestId('first-use-hint-show-count')).toBeNull();
    for (const key of ['1', 'Submit', 'Skip']) expect(screen.getByRole('button', { name: key })).toBeEnabled();
    await press('Got it, hide the Count entry hint');
    expect(screen.queryByTestId('first-use-hint-count-entry')).toBeNull();
    await press('Help');
    expect(screen.getByTestId('first-use-hint-count-entry')).toBeOnTheScreen();
  });

  it('is not shown while Learn explains the answer', async () => {
    const explained = readChallengeView(attempt([{ kind: 'answer', value: 0 }], 1, 'conversion', 'learn'));
    await mount(exerciseHints(explained), exercise(explained));
    expect(screen.getByTestId('coach-note')).toBeOnTheScreen();
    expect(screen.queryByTestId('first-use-hint-count-entry')).toBeNull();
  });
});

describe('the bet selector hint (S1-04 XjwQc)', () => {
  const table = (
    <>
      <TableTopBar title="Blackjack" subtitle="6 decks" canEnd onEnd={() => undefined} />
      <PresentationSwitch value="table" onChange={() => undefined} />
    </>
  );

  it('shows under the Table / Bet list switch, in the frame’s words, until Got it', async () => {
    await mount(TABLE_HINTS, table);
    expect(screen.getByTestId('first-use-hint-bet-selector')).toHaveTextContent(
      'NEW HERE · BET LIST' + 'Every wager on this table, as a list you can read. Choosing one opens its editor; nothing is placed until you confirm.' + 'Reread from Help (?)Got it',
    );
    expect(screen.getByRole('tab', { name: 'Bet list' })).toBeOnTheScreen();
    await press('Got it, hide the Bet list hint');
    expect(screen.queryByTestId('first-use-hint-bet-selector')).toBeNull();

    await press('Help');
    expect(screen.getByTestId('first-use-hint-bet-selector')).toBeOnTheScreen();
  });

  it('is absent, with no Help, where a screen offers no hints', async () => {
    await cleanup();
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{table}</SafeAreaProvider>,
    );
    expect(screen.queryByTestId('first-use-hint-bet-selector')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull();
  });
});

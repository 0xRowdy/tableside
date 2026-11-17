// Spec 3 Information hiding (end to end), Testing Decisions › Seam 3, Amendment 1 C5; S3-03 drVnR, BFdJT; #132

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
import { cleanup, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChallengeExercise } from '@/counting/ChallengeExercise';
import { cardName } from '@/play/blackjack-text';
import {
  expectIndistinguishable,
  expectNoFeedbackColors,
  expectNotPresented,
  feedbackColorsIn,
  presentedScreen,
  watchAccessibilityEvents,
  type AccessibilityEvents,
} from '@/training/testing/information-hiding';

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<number, -1 | 0 | 1> = { 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1, 11: -1, 12: -1, 13: -1 };

const seed = (n: number) => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [n, 0x9e3779b9], session: [n * 7 + 1, 0] }) as const;

function attempt(variant: ChallengeVariant, n: number, commands: readonly ChallengeCommand[] = []): ChallengeState {
  let state = createChallenge({ attemptId: 'attempt-1', owner: 'local', device: 'test-device', variant, content: CHALLENGE_CONTENT['card-values'] }, seed(n));
  for (const command of [{ kind: 'begin' } as const, ...commands]) {
    const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
    if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}`);
    state = result.state;
  }
  return state;
}

const shown = (state: ChallengeState) => readChallengeView(state).item!.card;

function seedWhere(test: (n: number) => boolean): number {
  for (let n = 1; n < 500; n++) if (test(n)) return n;
  throw new Error('no seed');
}

let events: AccessibilityEvents;

beforeAll(() => {
  events = watchAccessibilityEvents();
});

async function present(view: ChallengeView) {
  await cleanup();
  events.clear();
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ChallengeExercise view={view} busy={view.phase === 'recorded'} saveFailed={false} onCommand={() => undefined} onRetrySave={() => undefined} />
    </SafeAreaProvider>,
  );
  return presentedScreen(screen.toJSON() as never, events, { mask: ['challenge-card'] });
}

describe('Check information hiding on the card-values exercise', () => {
  it('presents a right and a wrong answer identically — labels, hints, values, order, colours, announcements and focus — apart from the card itself', async () => {
    const plusCard = seedWhere((n) => HI_LO[shown(attempt('check', n)).rank] === 1);
    const minusCard = seedWhere((n) => HI_LO[shown(attempt('check', n)).rank] === -1);
    const right = attempt('check', plusCard);
    const wrong = attempt('check', minusCard);
    expectIndistinguishable(await present(readChallengeView(wrong)), await present(readChallengeView(right)));

    const answer = { kind: 'answer', value: 1 } as const;
    expectIndistinguishable(await present(readChallengeView(attempt('check', minusCard, [answer]))), await present(readChallengeView(attempt('check', plusCard, [answer]))));
  });

  it('asks for the card’s value with Skip, then marks only the entry as Recorded (S3-03 drVnR, BFdJT)', async () => {
    await present(readChallengeView(attempt('check', 1)));
    expect(screen.getByText('Check · self-paced')).toBeOnTheScreen();
    expect(screen.getByText("What's this card's Hi-Lo value?")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Skip (counts as incorrect)' })).toBeEnabled();
    for (const value of ['plus 1', '0', 'minus 1']) expect(screen.getByRole('button', { name: value })).toBeEnabled();

    await present(readChallengeView(attempt('check', 1, [{ kind: 'answer', value: -1 }])));
    expect(screen.getByRole('button', { name: 'minus 1' })).toHaveAccessibilityValue({ text: 'Recorded' });
    expect(screen.getByRole('button', { name: 'plus 1' })).not.toHaveAccessibilityValue({ text: 'Recorded' });
    expect(screen.getByRole('button', { name: 'plus 1' })).toBeDisabled();
    expect(within(screen.getByTestId('recorded-notice')).getByText('Answer recorded. Next card in a moment.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Skip (counts as incorrect)' })).toBeNull();
    expect(screen.queryByTestId('coach-note')).toBeNull();

    await present(readChallengeView(attempt('check', 1, [{ kind: 'skip' }])));
    expect(screen.getByText('Skip recorded. Next card in a moment.')).toBeOnTheScreen();
    expect(screen.queryByText('Recorded')).toBeNull();
  });

  it('renders no Coach & feedback colour while a Check attempt is unfinished; a Learn explanation does', async () => {
    expectNoFeedbackColors(await present(readChallengeView(attempt('check', 1))));
    expectNoFeedbackColors(await present(readChallengeView(attempt('check', 1, [{ kind: 'answer', value: -1 }]))));
    expectNoFeedbackColors(await present(readChallengeView(attempt('check', 1, [{ kind: 'skip' }]))));
    expect(feedbackColorsIn(await present(readChallengeView(attempt('learn', 1, [{ kind: 'answer', value: -1 }]))))).not.toEqual([]);
  });

  it('never presents a card that has left the display, in Learn or Check (Amendment 1 C5)', async () => {
    const n = seedWhere((m) => {
      const state = attempt('learn', m);
      return cardName(shown(state)) !== cardName(shown(attempt('learn', m, [{ kind: 'skip' }, { kind: 'next-item' }])));
    });
    const departed = cardName(shown(attempt('check', n)));
    for (const variant of ['learn', 'check'] as const) {
      const moved = attempt(variant, n, [{ kind: 'answer', value: 1 }, { kind: 'next-item' }]);
      const presented = await present(readChallengeView(moved));
      expect(screen.getByTestId('challenge-card')).toHaveProp('accessibilityLabel', cardName(shown(moved)));
      expectNotPresented(presented, [departed]);
    }
  });
});

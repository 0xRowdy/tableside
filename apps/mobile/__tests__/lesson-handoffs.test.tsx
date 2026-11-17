// Spec 3 Seam 3; Lessons › Handoff, Entry points; Amendment 1 C12; pX6CV, ZBpF3, PDCaD, buD2R, FxxAj; #145

import type { Lesson, LessonContent, LessonHandoff } from '@tableside/definitions';
import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { ChallengeAllowance } from '@/training/allowance';

let mockStore: unknown = null;
let mockAllowance: ChallengeAllowance | null = null;

jest.mock('@tableside/definitions', () => {
  const actual = jest.requireActual('@tableside/definitions');
  return { ...actual, LESSONS: [...actual.LESSONS] };
});

const actualLessons = () => (jest.requireActual('@tableside/definitions') as typeof import('@tableside/definitions')).LESSONS;
const servedLessons = () => (jest.requireMock('@tableside/definitions') as { LESSONS: Lesson[] }).LESSONS;

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => create({ clock: new FakeClock(undefined, true) }) };
});

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  let next = 0;
  return {
    createTrainingAdapters: () => {
      mockStore = new MemoryTrainingStore();
      return {
        store: mockStore,
        access: alwaysAllowed,
        allowance: { challengeAllowance: async () => mockAllowance },
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `event-${++next}`,
        device: 'test-device',
        owner: 'local',
      };
    },
  };
});

const MIDNIGHT_IN_DENVER_MST = Date.UTC(2026, 10, 18, 7);
const FREE: ChallengeAllowance = { kind: 'free', amount: 5, left: 4, resetsAt: MIDNIGHT_IN_DENVER_MST, timeZone: 'America/Denver', allowanceDevice: { here: true } };

const content = (handoffs: readonly LessonHandoff[]): LessonContent => ({
  version: 1,
  materialVersion: 1,
  change: null,
  steps: [
    { heading: 'First idea', paragraphs: ['Something to learn.'] },
    { heading: 'Practice it', paragraphs: ['Open practice from here. Nothing starts until you press Start.'] },
  ],
  workedExample: null,
  handoffs,
  sources: [],
});

const CARD_VALUES_HANDOFFS: readonly LessonHandoff[] = [
  { kind: 'learn-challenge', category: 'card-values' },
  { kind: 'guided-practice', game: 'blackjack', strategy: 'counting-with-deviations' },
  { kind: 'free-play', game: 'blackjack' },
];

function authorLessons() {
  servedLessons().splice(
    0,
    Infinity,
    ...actualLessons().map((lesson) => {
      if (lesson.id === 'card-values') return { ...lesson, content: content(CARD_VALUES_HANDOFFS) };
      if (lesson.id === 'capped-martingale')
        return { ...lesson, content: content([{ kind: 'guided-practice', game: 'roulette', strategy: 'builtin-roulette-capped-martingale' }, { kind: 'free-play', game: 'roulette' }]) };
      if (lesson.id === 'running-count') return { ...lesson, content: content([]) };
      return lesson;
    }),
  );
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const radio = (name: string) => screen.getByRole('radio', { name });
const store = () => mockStore as import('@/training/memory-store').MemoryTrainingStore;

async function finalStep(lesson: string, title: string) {
  await renderRouter('./src/app', { initialUrl: `/more/settings/learning/lessons/${lesson}` });
  await header(title);
  await fireEvent.press(button('Next'));
  await header('Practice it');
}

async function expectNothingStarted() {
  expect(screen.queryByLabelText(/^Session balance/)).toBeNull();
  expect([await store().findUnfinishedAttempt(), await store().readAttemptRecords()]).toEqual([null, []]);
}

beforeEach(() => {
  mockAllowance = FREE;
  authorLessons();
});

describe('lesson handoffs', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('the final step offers each handoff after the explanation (pX6CV); earlier steps offer none', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings/learning/lessons/capped-martingale' });
    await header('Capped Martingale');
    expect(screen.queryByRole('link', { name: /^Guided practice/ })).toBeNull();
    await fireEvent.press(button('Next'));
    await header('Practice it');
    expect(screen.getAllByRole('link').map((link) => link.props.accessibilityLabel)).toEqual(['Guided practice · Roulette, capped Martingale', 'Free play · Roulette']);
    expect(button('Finish')).toBeEnabled();
  });

  it('guided practice opens roulette setup with the strategy prefilled, completes the lesson, and starts nothing', async () => {
    await finalStep('capped-martingale', 'Capped Martingale');
    await fireEvent.press(screen.getByRole('link', { name: 'Guided practice · Roulette, capped Martingale' }));
    expect(await header('Roulette')).toBeOnTheScreen();
    expect(radio('Guided practice')).toBeChecked();
    expect(radio('Capped Martingale')).toBeChecked();
    expect(button('Start guided practice')).toBeOnTheScreen();
    await expectNothingStarted();

    await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'More' }));
    expect(await screen.findByRole('button', { name: /^Capped Martingale\. Completed/ })).toBeOnTheScreen();
  });

  it('Finish opens "Practice what you learned" with each option and what starting it uses (ZBpF3); Back to lessons leaves', async () => {
    await finalStep('card-values', 'Card values');
    await fireEvent.press(button('Finish'));
    expect(await header('Practice what you learned')).toBeOnTheScreen();
    expect(screen.getByText('Each option opens its normal setup screen with this filled in. Nothing starts, and no allowance is used, until you press Start there.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Learn challenge · Card values. Starting uses 1 of your 4 attempts left today. Resuming doesn't use another." })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Guided practice · Blackjack, counting with deviations. Uses guided-practice allowance once you start.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Free play · Blackjack. Opens blackjack setup.' })).toBeOnTheScreen();

    await fireEvent.press(button('Back to lessons'));
    expect(await screen.findByRole('button', { name: /^Card values\. Completed/ })).toBeOnTheScreen();
    await expectNothingStarted();
  });

  it('a Learn challenge handoff opens Counting setup with the category and Learn prefilled; nothing is charged until Start', async () => {
    await finalStep('card-values', 'Card values');
    await fireEvent.press(button('Finish'));
    await fireEvent.press(await screen.findByRole('button', { name: /^Learn challenge · Card values\./ }));
    expect(await header('Card values')).toBeOnTheScreen();
    expect(radio('Learn')).toBeChecked();
    expect(screen.getByText("Starting uses 1 of your 4 attempts left today. Resuming doesn't use another.")).toBeOnTheScreen();
    expect(button('Start Learn attempt')).toBeEnabled();
    await expectNothingStarted();
    expect(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'Counting', selected: true })).toBeOnTheScreen();
  });

  // Spec 3 Amendment 1 C12
  it('guided practice opens blackjack setup with the mode prefilled, and the session begins only when the learner starts it', async () => {
    await finalStep('card-values', 'Card values');
    await fireEvent.press(button('Finish'));
    await fireEvent.press(await screen.findByRole('button', { name: /^Guided practice · Blackjack, counting with deviations\./ }));
    expect(await header('Blackjack')).toBeOnTheScreen();
    expect(screen.getByText('New session · guided practice')).toBeOnTheScreen();
    expect(radio('Counting with deviations')).toBeChecked();
    await expectNothingStarted();

    await fireEvent.press(button('Start guided practice'));
    expect(await screen.findByLabelText('Session balance 1,000')).toBeOnTheScreen();
  });

  it('free play opens blackjack setup in free play, even after a guided handoff', async () => {
    await finalStep('card-values', 'Card values');
    await fireEvent.press(screen.getByRole('link', { name: 'Guided practice · Blackjack, counting with deviations' }));
    await header('Blackjack');
    await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'More' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Card values\. Completed/ }));
    await header('Card values');
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('link', { name: 'Free play · Blackjack' }));
    expect(await screen.findByText('New session · free play')).toBeOnTheScreen();
    expect(radio('Free play')).toBeChecked();
    await expectNothingStarted();
  });

  it('for premium, the sheet says challenges are unlimited and setup opens without an allowance line', async () => {
    mockAllowance = { kind: 'premium' };
    await finalStep('card-values', 'Card values');
    await fireEvent.press(button('Finish'));
    expect(await screen.findByRole('button', { name: 'Learn challenge · Card values. Unlimited challenges (premium)' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Guided practice · Blackjack, counting with deviations. Opens blackjack setup.' })).toBeOnTheScreen();
  });
});

describe('lesson entry points', () => {
  it('the Counting tab offers the lesson beside each category (PDCaD), opening it by identity', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await header('Counting');
    expect(screen.getAllByRole('link').map((link) => [link.props.accessibilityLabel, link.props.accessibilityState?.disabled ?? false])).toEqual([
      ['Lesson: card values', false],
      ['Lesson: running count', false],
      ['Lesson: true-count conversion', true],
      ['Lesson: table counting', true],
    ]);
    expect(screen.getByRole('link', { name: 'Lesson: table counting' })).toHaveProp('accessibilityHint', 'Not available in this version yet.');
    await fireEvent.press(screen.getByRole('link', { name: 'Lesson: running count' }));
    expect(await header('Running count')).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 2')).toBeOnTheScreen();
  });

  it("challenge setup offers its category's lesson as Learn this skill (buD2R)", async () => {
    await renderRouter('./src/app', { initialUrl: '/counting?category=card-values' });
    await header('Card values');
    await fireEvent.press(await screen.findByRole('button', { name: 'Learn this skill. Card values lesson · 2 short steps' }));
    expect(await header('Card values')).toBeOnTheScreen();
    expect(screen.getByText('Lesson · Blackjack')).toBeOnTheScreen();
  });

  it.each([
    ['blackjack', 'Blackjack', 'Blackjack basics, the four strategy modes, counting and the bet schedule. Optional, and lessons never use allowance. 10 lessons', 'BLACKJACK · 10'],
    ['craps', 'Craps', 'Craps basics and the five strategy lessons. Optional, and lessons never use allowance. 6 lessons', 'STANDARD CRAPS · 6'],
    ['roulette', 'Roulette', 'Roulette basics and the five strategy lessons. Optional, and lessons never use allowance. 6 lessons', 'ROULETTE · 6'],
  ])('%s setup offers Learn this game (FxxAj), opening that game’s lessons', async (game, title, detail, section) => {
    await renderRouter('./src/app', { initialUrl: `/play?game=${game}` });
    await header(title);
    await fireEvent.press(await screen.findByRole('button', { name: `Learn this game. ${detail}` }));
    await header('Lessons');
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toEqual(['Lessons', section]);
    expect(button('Back to Learning')).toBeOnTheScreen();
  });

  it("a lesson opened from a game's lessons returns to them", async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
    await header('Blackjack');
    await fireEvent.press(await screen.findByRole('button', { name: /^Learn this game\./ }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Card values\. Not started/ }));
    await header('Card values');
    await fireEvent.press(button('Back to Lessons'));
    await header('Lessons');
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toEqual(['Lessons', 'BLACKJACK · 10']);
  });
});

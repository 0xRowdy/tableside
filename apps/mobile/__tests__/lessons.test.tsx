// Spec 3 Testing Decisions › Seam 3; S3-11 sVqX1, S3-12 l8pMS, S3-13 JJl51 and Fvlgc, Settings › Learning NvGyZ; Amendment 1 B4, D; #143

import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import type { Lesson } from '@tableside/definitions';

import type { substituteFeedbackPorts } from '@/feedback/testing/substitutes';

let mockStore: unknown = null;

jest.mock('@tableside/definitions', () => {
  const actual = jest.requireActual('@tableside/definitions');
  return { ...actual, LESSONS: [...actual.LESSONS] };
});

const actualLessons = () => (jest.requireActual('@tableside/definitions') as typeof import('@tableside/definitions')).LESSONS;
const servedLessons = () => (jest.requireMock('@tableside/definitions') as { LESSONS: Lesson[] }).LESSONS;

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  let next = 0;
  return {
    createTrainingAdapters: () => {
      mockStore ??= new MemoryTrainingStore();
      return {
        store: mockStore,
        access: alwaysAllowed,
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `event-${++next}`,
        device: 'test-device',
        owner: 'local',
      };
    },
  };
});

const device = jest.requireMock('@/feedback/device-ports') as { latest: ReturnType<typeof substituteFeedbackPorts> | null };

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function openCatalog() {
  await renderRouter('./src/app', { initialUrl: '/more/settings/learning' });
  await fireEvent.press(await screen.findByRole('button', { name: /^Lesson catalog\b/ }));
  await header('Lessons');
}

async function openOrientation() {
  await openCatalog();
  await fireEvent.press(button(/^App orientation\b/));
  await header('App orientation');
}

beforeEach(() => {
  mockStore = null;
  servedLessons().splice(0, Infinity, ...actualLessons());
});

afterEach(() => setWindow(390, 844));

describe('lessons', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('are reached from More → Settings → Learning, which summarizes the catalog, keeping the tab bar on More', async () => {
    await renderRouter('./src/app', { initialUrl: '/more' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Settings\b/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Learning. Lessons' }));
    expect(await header('Learning')).toBeOnTheScreen();
    expect(button('Back to Settings')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'LESSONS' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Lesson catalog. 24 lessons · 0 completed · 0 in progress' })).toBeOnTheScreen();
    expect(screen.getByText("Lessons never score you, award anything or lock anything. They're available to every account, including when today's challenge attempts are used up.")).toBeOnTheScreen();
    expect(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('list all 24 in their five groups, in any order, with App orientation open to start', async () => {
    await openCatalog();
    expect(screen.getByText('Open any lesson, in any order. Finishing one just marks it completed: no scores, badges or locks.')).toBeOnTheScreen();
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toEqual([
      'Lessons',
      'APP · 1',
      'BLACKJACK · 10',
      'STANDARD CRAPS · 6',
      'ROULETTE · 6',
      'STRATEGY BUILDER · 1',
    ]);
    expect(button('App orientation. Not started · Tabs, help, practice vs casino records')).toBeEnabled();
    expect(button('Blackjack basics. Not started')).toBeDisabled();
    expect(button('Blackjack basics. Not started')).toHaveProp('accessibilityHint', 'Not available in this version yet.');
    expect(button('Building a strategy. Not started')).toBeDisabled();
  });

  it('step through App orientation, keep the place for Resume or Restart, and finish without a score', async () => {
    await openOrientation();
    expect(screen.getByText('Lesson · App')).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 4')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Find your way around' })).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    expect(await header('Help when you need it')).toBeOnTheScreen();
    expect(screen.getByText('Step 2 of 4')).toBeOnTheScreen();

    await fireEvent.press(button('Back to Lessons'));
    expect(await screen.findByRole('button', { name: 'App orientation. In progress · Step 2 of 4 · Tabs, help, practice vs casino records' })).toBeOnTheScreen();

    await fireEvent.press(button(/^App orientation\b/));
    expect(await screen.findByText('You stopped at step 2 of 4.')).toBeOnTheScreen();
    await fireEvent.press(button('Resume at step 2'));
    expect(await header('Help when you need it')).toBeOnTheScreen();
    expect(screen.queryByText('You stopped at step 2 of 4.')).toBeNull();

    await fireEvent.press(button('Next'));
    await header('Practice records and casino records');
    await fireEvent.press(button('Back'));
    await header('Help when you need it');
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    await header('Lessons at your own pace');
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await fireEvent.press(button('Finish'));

    expect(await screen.findByRole('button', { name: 'App orientation. Completed · Tabs, help, practice vs casino records' })).toBeOnTheScreen();
    await fireEvent.press(button('Back to Learning'));
    expect(await screen.findByRole('button', { name: 'Lesson catalog. 24 lessons · 1 completed · 0 in progress' })).toBeOnTheScreen();
  });

  it('restart from step 1, from the resume sheet or the header, keeping the lesson', async () => {
    await openOrientation();
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    await header('Practice records and casino records');
    await fireEvent.press(button('Back to Lessons'));
    await fireEvent.press(await screen.findByRole('button', { name: /^App orientation\. In progress · Step 3 of 4/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Restart from step 1' }));
    expect(await header('Find your way around')).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 4')).toBeOnTheScreen();

    await fireEvent.press(button('Next'));
    await header('Help when you need it');
    await fireEvent.press(button('Restart lesson'));
    expect(await header('Find your way around')).toBeOnTheScreen();
  });

  it('show "Completed (earlier version)" with the reason after a material change, until the learner restarts or moves on in the new version', async () => {
    await openOrientation();
    for (const heading of ['Help when you need it', 'Practice records and casino records', 'Lessons at your own pace']) {
      await fireEvent.press(button('Next'));
      await header(heading);
    }
    await fireEvent.press(button('Finish'));
    await screen.findByRole('button', { name: /^App orientation\. Completed/ });
    await cleanup();

    const orientation = actualLessons()[0]!;
    servedLessons()[0] = { ...orientation, content: { ...orientation.content!, version: 2, materialVersion: 2, change: 'the Saved tab was described' } };
    await openCatalog();
    await fireEvent.press(await screen.findByRole('button', { name: 'App orientation. Completed (earlier version) · restart · Tabs, help, practice vs casino records' }));
    await header('App orientation');
    expect(screen.getByRole('header', { name: 'Completed (earlier version)' })).toBeOnTheScreen();
    expect(
      screen.getByText('This lesson changed after you finished it: the Saved tab was described. Restart from step 1 to see the new version. Your earlier completion stays in your history.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 4')).toBeOnTheScreen();
    await fireEvent.press(button('Restart lesson'));
    await screen.findByText('Step 1 of 4');
    expect(screen.queryByRole('header', { name: 'Completed (earlier version)' })).toBeNull();
  });

  it('are silent: the Learning screen, catalog and lesson text play no cue or haptic', async () => {
    await openOrientation();
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Restart lesson' }));
    await header('Find your way around');
    expect(device.latest?.sound.played).toEqual([]);
    expect(device.latest?.haptics.fired).toEqual([]);
  });

  describe.each([
    ['portrait at the largest text size', 390, 844, 3],
    ['landscape at the largest text size', 844, 390, 3],
  ])('in %s', (_, width, height, fontScale) => {
    it('the catalog, player and resume sheet are operable by role and label, and rotation keeps the step', async () => {
      await setWindow(width, height, fontScale);
      await openCatalog();
      expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
      await fireEvent.press(button(/^App orientation\b/));
      await header('App orientation');
      expect(screen.getByTestId('lesson-scroll')).toBeOnTheScreen();
      await fireEvent.press(button('Next'));
      await header('Help when you need it');

      await setWindow(height, width, fontScale);
      expect(screen.getByText('Step 2 of 4')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Help when you need it' })).toBeOnTheScreen();
      await fireEvent.press(button('Back to Lessons'));
      await fireEvent.press(await screen.findByRole('button', { name: /^App orientation\. In progress/ }));
      expect(await screen.findByTestId('lesson-resume-scroll')).toBeOnTheScreen();
      await fireEvent.press(button('Resume at step 2'));
      expect(await header('Help when you need it')).toBeOnTheScreen();
    });
  });
});

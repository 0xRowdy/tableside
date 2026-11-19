// docs/decisions/lessons-entry-points.md; S3-01 u8a0o, rwwOU; S3-11 klT0u, f6mxz; Settings › Learning OEkKV; S1-04 qylNY
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { redirectSystemPath } from '@/app/+native-intent';

let mockStore: unknown = null;

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => create({ clock: new FakeClock(undefined, true) }) };
});

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { plentyAllowance } = jest.requireActual('@/training/allowance');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  let next = 0;
  return {
    createTrainingAdapters: () => {
      mockStore ??= new MemoryTrainingStore();
      return {
        store: mockStore,
        access: alwaysAllowed,
        allowance: plentyAllowance(() => Date.now()),
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `event-${++next}`,
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
        speech: jest.requireActual('@/training/speech').NO_SCREEN_READER,
      };
    },
  };
});

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const tabSelected = (name: string) => within(screen.getByTestId('tab-bar')).getByRole('tab', { name, selected: true });

beforeEach(() => {
  mockStore = null;
});

describe('lesson entry points', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('put Lessons at the top of Counting, above the challenges and the allowance banner', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await header('Lessons');
    const headers = screen.getAllByRole('header').map((item) => item.props.children);
    expect(headers.slice(0, 4)).toEqual(['Counting', 'Lessons', 'Challenges', 'Card values']);
    expect(screen.getByText('First lesson · counting')).toBeOnTheScreen();
    expect(screen.getByText('The Hi-Lo value of every card · 5 short steps')).toBeOnTheScreen();
    expect(button('All 24 lessons')).toBeOnTheScreen();
    expect(tabSelected('Counting')).toBeOnTheScreen();
  });

  it('start a lesson from Counting and come back to it, then offer to continue where the learner stopped', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Start with Card values' }));
    await screen.findByText('Step 1 of 5');
    await fireEvent.press(button('Next'));
    await screen.findByText('Step 2 of 5');
    await fireEvent.press(button('Back to Counting'));
    expect(await screen.findByRole('button', { name: 'Continue Card values' })).toBeOnTheScreen();
    expect(screen.getByText('In progress · step 2 of 5')).toBeOnTheScreen();
    expect(tabSelected('Counting')).toBeOnTheScreen();
  });

  it('open the full catalog from Counting, whose lessons go back to it and whose Back returns to Counting', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await fireEvent.press(await screen.findByRole('button', { name: 'All 24 lessons' }));
    await header('Lessons');
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toEqual(['Lessons', 'App · 1', 'Blackjack · 10', 'Standard craps · 6', 'Roulette · 6', 'Strategy builder · 1']);
    await fireEvent.press(button(/^App orientation\b/));
    await header('App orientation');
    await fireEvent.press(button('Back to Lessons'));
    await header('Lessons');
    await fireEvent.press(button('Back to Counting'));
    expect(await header('Challenges')).toBeOnTheScreen();
  });

  it('rewrite old More › Settings › Learning links to the Counting tab before routing', async () => {
    expect(redirectSystemPath({ path: 'tableside:///more/settings/learning/lessons/app-orientation', initial: true })).toBe('tableside:///counting/lessons/app-orientation');
    expect(redirectSystemPath({ path: '/more/settings/learning/lessons?section=craps', initial: false })).toBe('/counting/lessons?section=craps');
    expect(redirectSystemPath({ path: '/more/settings/learning', initial: false })).toBe('/more/settings/learning');
    expect(redirectSystemPath({ path: '/more/settings/learning/lessonsx', initial: false })).toBe('/more/settings/learning/lessonsx');
    await renderRouter('./src/app', { initialUrl: '/counting/lessons/app-orientation' });
    expect(await header('App orientation')).toBeOnTheScreen();
    expect(tabSelected('Counting')).toBeOnTheScreen();
  });

  it('leave Settings › Learning with the switches only, and a row that opens Counting', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Learning. Start here card, first-use hints' }));
    await header('Learning');
    expect(screen.queryByRole('button', { name: /^Lesson catalog/ })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Show Start here on Home' })).toBeOnTheScreen();
    expect(screen.getByText('Start here and hint settings stay on this device.')).toBeOnTheScreen();
    await fireEvent.press(button('Lessons are on the Counting tab'));
    expect(await header('Lessons')).toBeOnTheScreen();
    expect(tabSelected('Counting')).toBeOnTheScreen();
  });

  it("open Home's Start here catalog on Counting and go back Home", async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('link', { name: 'Open lesson catalog' }));
    await header('Lessons');
    await fireEvent.press(button('Back to Home'));
    expect(await screen.findByText('Start here')).toBeOnTheScreen();
    expect(tabSelected('Home')).toBeOnTheScreen();
  });

  it("open a table's Help with its game's lessons and hints; a lesson suspends the session and Back resumes it", async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
    await header('Blackjack');
    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
    await screen.findByLabelText('Session balance 1,000');
    await fireEvent.press(button('Help'));
    const sheet = within(screen.getByTestId('table-help'));
    expect(sheet.getByRole('header', { name: 'Help' })).toBeOnTheScreen();
    expect(await sheet.findByRole('button', { name: /^Start with Blackjack basics\./ })).toBeOnTheScreen();
    expect(sheet.getByText("Opening a lesson suspends this session. It's saved exactly as it is and picks up where you left off when you come back to Play.")).toBeOnTheScreen();
    expect(sheet.getByRole('button', { name: "Show this screen's hints again. The bet list hint shows again here." })).toBeOnTheScreen();

    await fireEvent.press(sheet.getByRole('button', { name: 'All blackjack lessons. 10' }));
    await header('Lessons');
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toEqual(['Lessons', 'Blackjack · 10']);
    expect(screen.getByText('Showing blackjack · 10 of 24')).toBeOnTheScreen();
    await fireEvent.press(button('Back to Blackjack table'));
    expect(await screen.findByLabelText('Session balance 1,000')).toBeOnTheScreen();
    expect(tabSelected('Play')).toBeOnTheScreen();
  });

  it('show every lesson from the filtered catalog, keeping the way back to the table', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting/lessons?section=blackjack&from=table' });
    await header('Lessons');
    await fireEvent.press(button('Show all 24 lessons'));
    await act(async () => undefined);
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toHaveLength(6);
    expect(button('Back to Blackjack table')).toBeOnTheScreen();
  });
});

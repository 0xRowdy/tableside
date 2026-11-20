// Spec 3 Seam 3; Lessons › Structure (worked examples); S3-12 aJV2y, pX6CV; #154

import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

let mockStore: unknown = null;

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
      };
    },
  };
});

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  mockStore = null;
});

describe('craps lessons', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('press-and-collect: the worked example replays two hits on 6 and answers with the press', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting/lessons/press-and-collect-6-8' });
    await header('Press-and-collect 6 and 8 (capped)');
    expect(screen.getByText('Lesson · Craps')).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    await header('Collect, then press');
    await fireEvent.press(button('Try the worked example (optional)'));
    await header('Worked example');
    expect(screen.getByText('Roll 1: no bets. Rolled 1 and 3: 4.')).toBeOnTheScreen();
    expect(screen.getByText('Roll 2: 12 on Place 6 and 12 on Place 8. Rolled 3 and 3: 6, the hard way.')).toBeOnTheScreen();
    expect(screen.getByText('Roll 3: 12 on Place 6 and 12 on Place 8. Rolled 2 and 4: 6.')).toBeOnTheScreen();
    expect(screen.getByText('What does Press-and-collect 6 and 8 bet next?')).toBeOnTheScreen();

    await fireEvent.press(button('12 on Place 6 and 12 on Place 8'));
    expect(button('24 on Place 6 and 12 on Place 8')).toHaveProp('accessibilityValue', { text: 'Correct' });
    expect(screen.getByText('The first 6 was collected, so this one presses: the 6 goes up by 12.')).toBeOnTheScreen();
    await fireEvent.press(button('Continue'));
    expect(await header('The cap and the reset')).toBeOnTheScreen();
  });

  it('end each strategy lesson with practice handoffs, then the Sources step with its exact credits', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting/lessons/three-point-molly' });
    await header('Three-point Molly (bounded)');
    for (const heading of ['Add come bets, up to two', 'When numbers hit', 'Seven-out, limits and stopping', "Stakes change. The house edge doesn't."]) {
      await fireEvent.press(button('Next'));
      await header(heading);
    }
    expect(screen.getByText(/Changing stakes doesn't remove the house edge\.$/)).toBeOnTheScreen();
    expect(screen.getAllByRole('link').map((link) => link.props.accessibilityLabel)).toEqual(['Guided practice · Craps, three-point Molly', 'Free play · Craps']);
    await fireEvent.press(button('Next'));
    await header('Sources');
    expect(screen.getByText('Step 6 of 6 · Sources')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Michael Shackleford, Wizard of Odds, “Three Point Molly”, sections “Rules” and “Analysis”' })).toBeOnTheScreen();
    expect(screen.getByText("Tableside's own, not the sources': at most two come bets, 10 odds on each, and carrying on after a seven-out.")).toBeOnTheScreen();
  });
});

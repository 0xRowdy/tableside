// Spec 3 Testing Decisions › Seam 3; Lessons › Check protection; Amendment 1 A2, Amendment 3; #53 review
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { DEFAULT_TABLE_SETUP } from '@tableside/definitions';

import type { MemoryTrainingStore } from '@/training/memory-store';
import type { ChallengeSetup } from '@/training/service';

let mockStore: MemoryTrainingStore | null = null;
let mockPractice: unknown = null;

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => (mockPractice ??= create({ clock: new FakeClock(undefined, true) })) };
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
        access: { ...alwaysAllowed, gameAccess: async () => ({ status: 'playable' }) },
        allowance: plentyAllowance(() => Date.now()),
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `id-${++next}`,
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
        speech: jest.requireActual('@/training/speech').NO_SCREEN_READER,
      };
    },
  };
});

const PLAY_CHECK: ChallengeSetup = { category: 'table', variant: 'check', table: { ...DEFAULT_TABLE_SETUP, seat: 'play' } };

async function unfinished(setup: ChallengeSetup) {
  const { createTrainingAdapters } = jest.requireMock('@/training/app-adapters') as typeof import('@/training/app-adapters');
  const { TrainingService } = jest.requireActual('@/training/service') as typeof import('@/training/service');
  const service = new TrainingService(createTrainingAdapters());
  await service.load();
  await service.startAttempt(setup);
  if (service.snapshot().status !== 'active') throw new Error('the attempt did not start');
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const GATE = 'This practice mode is available after this attempt.';

async function openSetup() {
  await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
  await screen.findByRole('header', { name: 'Blackjack' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
}

beforeEach(() => {
  mockStore = null;
  mockPractice = null;
});

describe('blackjack guided practice during an unfinished Play Check', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
  }, 180_000);

  it('holds the counting and deviation modes, with Return to attempt and End attempt, and leaves basic strategy and free play open', async () => {
    await unfinished(PLAY_CHECK);
    await openSetup();
    for (const mode of ['Counting with deviations', 'Counting with basic', 'Basic with deviations']) {
      await fireEvent.press(screen.getByRole('radio', { name: mode }));
      expect(await screen.findByRole('header', { name: GATE })).toBeOnTheScreen();
      expect(button('Start guided practice')).toBeDisabled();
      expect(button('Return to attempt')).toBeOnTheScreen();
      expect(button('End attempt to practice this mode')).toBeEnabled();
    }
    await fireEvent.press(screen.getByRole('radio', { name: 'Basic strategy' }));
    expect(screen.queryByRole('header', { name: GATE })).toBeNull();
    expect(button('Start guided practice')).toBeEnabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Free play' }));
    expect(button('Start free play')).toBeEnabled();
  });

  it('opens the mode once the attempt is ended, which counts as abandoned', async () => {
    await unfinished(PLAY_CHECK);
    await openSetup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Counting with deviations' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'End attempt to practice this mode' }));
    expect(await screen.findByRole('button', { name: 'Start guided practice' })).toBeEnabled();
    expect(screen.queryByRole('header', { name: GATE })).toBeNull();
    expect((await mockStore!.readAttemptRecords()).map((record) => record.endingReason)).toEqual(['abandoned']);
  });

  it('holds a counting-mode session already under way instead of resuming its coaching', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Counting with deviations' }));
    await fireEvent.press(button('Start guided practice'));
    await screen.findByLabelText('Session balance 1,000');

    await unfinished(PLAY_CHECK);
    await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
    expect(await screen.findByRole('header', { name: GATE })).toBeOnTheScreen();
    expect(screen.queryByLabelText('Session balance 1,000')).toBeNull();
    await fireEvent.press(button('End attempt to practice this mode'));
    expect(await screen.findByRole('header', { name: 'Pick up where you left off' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: GATE })).toBeNull();
  });

  it('leaves every mode open during a Check that is not Play', async () => {
    await unfinished({ category: 'running-count', variant: 'check' });
    await openSetup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Counting with deviations' }));
    expect(screen.queryByRole('header', { name: GATE })).toBeNull();
    expect(button('Start guided practice')).toBeEnabled();
  });
});

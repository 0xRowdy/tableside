// Spec 3 Testing Decisions › Seam 3; Lessons › Access, Check protection; Amendment 1 A2, Amendment 2 §3, Amendment 4 §5
// S3-11 LDmev, S3-12 JsXMJ, S3-14 SUUN4; #149
import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { DEFAULT_TABLE_SETUP } from '@tableside/definitions';
import type { GameId } from '@tableside/engine';

import type { GameAccess } from '@/practice/adapters';
import type { MemoryTrainingStore } from '@/training/memory-store';
import type { ChallengeSetup } from '@/training/service';

let mockStore: MemoryTrainingStore | null = null;
let mockGameAccess: (game: GameId) => GameAccess = () => ({ status: 'playable' });

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
        access: { ...alwaysAllowed, gameAccess: async ({ game }: { game: GameId }) => mockGameAccess(game) },
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

// Spec 3 Lessons › Check protection (active, paused or suspended)
async function unfinished(setup: ChallengeSetup) {
  const { createTrainingAdapters } = jest.requireMock('@/training/app-adapters') as typeof import('@/training/app-adapters');
  const { TrainingService } = jest.requireActual('@/training/service') as typeof import('@/training/service');
  const service = new TrainingService(createTrainingAdapters());
  await service.load();
  await service.startAttempt(setup);
  if (service.snapshot().status !== 'active') throw new Error('the attempt did not start');
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function openCatalog() {
  await renderRouter('./src/app', { initialUrl: '/more/settings/learning/lessons' });
  await header('Lessons');
  await screen.findByRole('button', { name: /^App orientation\b/ });
}

const SUUN4_FOOTNOTE = "Ending counts as abandoned: today's attempt stays used, there's no record, and progress toward this setting's readiness milestone restarts.";

beforeEach(() => {
  mockStore = null;
  mockGameAccess = () => ({ status: 'playable' });
});

describe('lessons during an unfinished Check attempt', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
  }, 180_000);

  it('mark the four counting lessons in the catalog, under a banner that returns to the attempt (LDmev)', async () => {
    await unfinished({ category: 'running-count', variant: 'check' });
    await openCatalog();
    expect(await screen.findByText('A Check attempt is unfinished')).toBeOnTheScreen();
    expect(
      screen.getByText('The four counting lessons open after it ends. During a Play Check, the four blackjack mode lessons and the bet-schedule lesson wait too. Everything else is open.'),
    ).toBeOnTheScreen();
    for (const title of ['Card values', 'Running count', 'True-count conversion', 'Table counting']) {
      expect(button(`${title}. After your Check attempt`)).toBeEnabled();
    }
    expect(button(/^Basic strategy\. Not started/)).toBeEnabled();
    expect(button(/^Bet schedule\. Not started/)).toBeEnabled();

    await fireEvent.press(screen.getByRole('link', { name: 'Return to attempt' }));
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeOnTheScreen();
  });

  it('offer Return to attempt or End attempt to view this lesson; ending opens the lesson (SUUN4)', async () => {
    await unfinished({ category: 'running-count', variant: 'check' });
    await openCatalog();
    await fireEvent.press(await screen.findByRole('button', { name: 'Running count. After your Check attempt' }));
    expect(await header('This lesson is available after this attempt.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Running count' })).toBeOnTheScreen();
    expect(screen.getByText('Lesson · Blackjack')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'You have an unfinished Check attempt in Running count. The four counting lessons (card values, running count, true-count conversion, table counting) and their worked examples wait until it ends. Every other lesson is open now.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(SUUN4_FOOTNOTE)).toBeOnTheScreen();
    expect(screen.queryByText(/Step 1 of/)).toBeNull();

    await fireEvent.press(button('End attempt to view this lesson'));
    expect(await screen.findByText(/^Step 1 of \d+$/)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Running count' })).toBeOnTheScreen();
    expect((await mockStore!.readAttemptRecords()).map((record) => record.endingReason)).toEqual(['abandoned']);
  });

  it('also hold back the mode and bet-schedule lessons during a Play Check, and say so', async () => {
    await unfinished({ category: 'table', variant: 'check', table: { ...DEFAULT_TABLE_SETUP, seat: 'play' } });
    await openCatalog();
    expect(await screen.findByRole('button', { name: 'Bet schedule. After your Check attempt' })).toBeEnabled();
    expect(button('Counting with deviations. After your Check attempt')).toBeEnabled();
    expect(button(/^Blackjack basics\. Not started/)).toBeEnabled();
    expect(button(/^Craps basics\. Not started/)).toBeEnabled();

    await fireEvent.press(button('Bet schedule. After your Check attempt'));
    expect(
      await screen.findByText(
        'You have an unfinished Play Check attempt in Table counting. The four counting lessons, the four blackjack mode lessons, the bet-schedule lesson and their worked examples wait until it ends. Every other lesson is open now.',
      ),
    ).toBeOnTheScreen();
  });

  it('keep the banner when the counting lessons need a connection too, and say so rather than offering to end', async () => {
    mockGameAccess = (game) => (game === 'craps' ? { status: 'playable' } : { status: 'needs-connection', offlineGame: 'craps' });
    await unfinished({ category: 'card-values', variant: 'check' });
    await openCatalog();
    expect(await screen.findByText('A Check attempt is unfinished')).toBeOnTheScreen();
    await fireEvent.press(button('Card values. Needs a connection'));
    expect(await header('This lesson needs a connection')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'End attempt to view this lesson' })).toBeNull();
  });

  it("can't be ended from a lesson while the attempt waits for an app update", async () => {
    const { newAttempt, attemptTransition, chargeFor } = jest.requireActual('@/training/testing/store-contract') as typeof import('@/training/testing/store-contract');
    const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store') as typeof import('@/training/memory-store');
    const later = '{"schema":999,"identities":{},"attempt":{},"receipts":[]}';
    const store = new MemoryTrainingStore();
    const attempt = newAttempt('later', { checkpoint: later });
    await store.createAttempt({ ...attempt, specification: { ...attempt.specification, variant: 'check' } });
    await store.commitAttemptTransition({ ...attemptTransition('later', 0, { charge: chargeFor('later') }), checkpoint: later });
    mockStore = store;

    await openCatalog();
    await fireEvent.press(await screen.findByRole('button', { name: 'Card values. After your Check attempt' }));
    expect(await header('This lesson is available after this attempt.')).toBeOnTheScreen();
    expect(button('End attempt to view this lesson')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Update Tableside to continue your counting attempt. It was saved by a newer version, and it stays exactly as it was.');
  });

  it('leave every lesson open during a Learn attempt', async () => {
    await unfinished({ category: 'running-count', variant: 'learn' });
    await openCatalog();
    expect(screen.queryByText('A Check attempt is unfinished')).toBeNull();
    expect(button(/^Running count\. Not started/)).toBeEnabled();
  });
});

describe('lessons offline (JsXMJ)', () => {
  it("say a game's lesson needs a connection, keep the place, and go back to the lessons", async () => {
    mockGameAccess = (game) => (game === 'blackjack' ? { status: 'playable' } : { status: 'needs-connection', offlineGame: 'blackjack' });
    await openCatalog();
    expect(button(/^Running count\. Not started/)).toBeEnabled();
    expect(button(/^Building a strategy\. Not started/)).toBeEnabled();

    await fireEvent.press(button('Pass with odds. Needs a connection'));
    expect(await header('This lesson needs a connection')).toBeOnTheScreen();
    expect(screen.getByText('Lesson · Craps')).toBeOnTheScreen();
    expect(screen.getByText("You're offline, and blackjack is your offline game, so craps lessons wait until you reconnect. Your place in this lesson is kept.")).toBeOnTheScreen();
    expect(screen.getByText('Offline you can open the blackjack lessons, the app orientation lesson and the builder lesson.')).toBeOnTheScreen();

    await fireEvent.press(button('Back to lessons'));
    expect(await screen.findByRole('button', { name: 'Pass with odds. Needs a connection' })).toBeOnTheScreen();
  });

  it('name the Learn this skill lesson as needing a connection when blackjack is not playable', async () => {
    mockGameAccess = () => ({ status: 'needs-connection', offlineGame: 'craps' });
    await renderRouter('./src/app', { initialUrl: '/counting?category=card-values' });
    const row = await screen.findByRole('button', { name: /^Learn this skill\./ });
    expect(within(row).getByText('Card values lesson · Needs a connection')).toBeOnTheScreen();
  });
});

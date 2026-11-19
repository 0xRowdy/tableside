// Spec 3 Testing Decisions › Seam 3; S3-10 OVKkc (Amendment 2 §3), S3-01 PDCaD, S3-08 liAfT; #140, #137

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import type { ChallengeAttemptRecord } from '@tableside/engine';
import { renderRouter } from 'expo-router/testing-library';

import type { SubstituteFeedbackPorts } from '@/feedback/testing/substitutes';
import type { MemoryTrainingStore } from '@/training/memory-store';
import type { AttemptFixture } from '@/training/testing/attempt-records';

const MOCK_NOW = Date.UTC(2026, 9, 20, 18);
const DAY = 24 * 60 * 60 * 1000;

let mockStore: MemoryTrainingStore | null = null;
let mockSeed: readonly ChallengeAttemptRecord[] = [];
let mockAccepted: readonly ChallengeAttemptRecord[] = [];
let mockDetail: (attemptId: string) => Promise<ChallengeAttemptRecord | null> = async () => null;

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  const { plentyAllowance } = jest.requireActual('@/training/allowance');
  const { storeAttempts } = jest.requireActual('@/training/testing/attempt-records');
  return {
    createTrainingAdapters: () => {
      if (!mockStore) {
        mockStore = new MemoryTrainingStore();
        void storeAttempts(mockStore, mockSeed);
        void mockStore!.acceptAttempts(mockAccepted.map(({ review: _detail, ...summary }) => summary));
      }
      const clock = new FakeClock(MOCK_NOW, true);
      let next = 0;
      return {
        store: mockStore,
        access: alwaysAllowed,
        allowance: plentyAllowance(() => clock.now()),
        clock,
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `ui-attempt-${++next}`,
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
        speech: jest.requireActual('@/training/speech').NO_SCREEN_READER,
        attemptDetail: (attemptId: string) => mockDetail(attemptId),
      };
    },
  };
});

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<string, string> = { Ace: 'minus 1', '2': 'plus 1', '3': 'plus 1', '4': 'plus 1', '5': 'plus 1', '6': 'plus 1', '7': '0', '8': '0', '9': '0', '10': 'minus 1', Jack: 'minus 1', Queen: 'minus 1', King: 'minus 1' };
const answerFor = (card: string) => HI_LO[card.split(' of ')[0]!]!;
const cues = () => (jest.requireMock('@/feedback/device-ports') as { latest: SubstituteFeedbackPorts }).latest.sound.played.map((play) => play.cue);
const shownCard = () => screen.getByTestId('challenge-card').props.accessibilityLabel as string;

function seed(...fixtures: AttemptFixture[]) {
  const { attemptRecord } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
  mockSeed = fixtures.map(attemptRecord);
}

async function openRecords() {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
  await fireEvent.press(screen.getByRole('button', { name: 'Records & history. Personal bests, fastest times, milestones and every attempt' }));
  await screen.findByRole('header', { name: 'Records & history' });
}

beforeEach(() => {
  mockStore = null;
  mockSeed = [];
  mockAccepted = [];
  mockDetail = async () => null;
});

describe('Records & history', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('shows a table group by its seat and settings, with a best for each count it tests (S3-10 OVKkc)', async () => {
    const { TABLE_OBSERVE_CHECK } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    const table = TABLE_OBSERVE_CHECK.table as NonNullable<typeof TABLE_OBSERVE_CHECK.table>;
    seed({ id: 'observe', key: { ...TABLE_OBSERVE_CHECK, table: { ...table, dealer: 'H17', lateSurrender: false, penetration: 60, extraPlayers: 2, checkpointInterval: 3 } }, scores: { 'running-count': [3, 4], 'true-count': [4, 4] }, endedAt: MOCK_NOW - 60_000 });
    await openRecords();
    expect(await screen.findByText('Table counting · Observe')).toBeOnTheScreen();
    expect(screen.getByText('H17 no LS · 60% · 2 players · N = 3')).toBeOnTheScreen();
  });

  it('shows unassisted Check bests and fastest by settings, with no personal best from an insufficient-funds attempt', async () => {
    const { RUNNING_COUNT_CHECK } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    seed(
      { id: 'perfect', performanceMs: 221_000, endedAt: MOCK_NOW - 60_000 },
      { id: 'three', scores: { 'running-count': [3, 4] }, performanceMs: null, endedAt: MOCK_NOW - 120_000 },
      { id: 'paced', key: { ...RUNNING_COUNT_CHECK, pacing: '2s' }, scores: { 'running-count': [3, 4] }, endedAt: MOCK_NOW - 180_000 },
      { id: 'short', key: { ...RUNNING_COUNT_CHECK, pacing: '1s' }, ending: 'insufficient-funds', scores: { 'running-count': [4, 4] }, endedAt: MOCK_NOW - 240_000 },
    );
    await openRecords();

    expect(screen.getByRole('radio', { name: 'Check' })).toBeChecked();
    expect(screen.getByText('Personal bests · unassisted check, by settings')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Running count, 52 cards · self-paced. Best 4 of 4. Fastest 03:41')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, 52 cards · 2 s pace. Best 3 of 4. Fastest — (needs a perfect run)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, 52 cards · 1 s pace. Best — (no completed attempt yet). Fastest —')).toBeOnTheScreen();
    expect(screen.getByText('Records only compare attempts with identical settings. Speed counts only for perfect, unassisted, uninterrupted, timed Check attempts.')).toBeOnTheScreen();
  });

  it('switches to assisted Check and Learn bests, which have no fastest', async () => {
    const { RUNNING_COUNT_CHECK } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    seed(
      { id: 'assisted', key: { ...RUNNING_COUNT_CHECK, assistanceClass: 'assisted-check', countRevealed: true } },
      { id: 'learn', key: { ...RUNNING_COUNT_CHECK, category: 'card-values', variant: 'learn', assistanceClass: 'learn', content: { id: 'card-values', version: 1 }, reference: null, length: 20 }, scores: { 'card-values': [19, 20] } },
    );
    await openRecords();
    expect(await screen.findByText('No unassisted Check attempts yet.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Assisted Check' }));
    expect(screen.getByText('Personal bests · assisted check, by settings')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, 52 cards · self-paced. Best 4 of 4')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Learn' }));
    expect(screen.getByText('Personal bests · learn, by settings')).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values, 20 cards · self-paced. Best 19 of 20')).toBeOnTheScreen();
  });

  it('lists every attempt newest first with its ending reason, labelled local until synced', async () => {
    const { RUNNING_COUNT_CHECK } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    seed(
      { id: 'short', key: { ...RUNNING_COUNT_CHECK, pacing: '2s' }, ending: 'insufficient-funds', scores: { 'running-count': [2, 3] }, endedAt: MOCK_NOW - 60_000 },
      { id: 'abandoned', key: { ...RUNNING_COUNT_CHECK, category: 'conversion', content: { id: 'conversion', version: 1 }, reference: null, length: 10 }, ending: 'abandoned', endedAt: MOCK_NOW - DAY },
      { id: 'done', endedAt: MOCK_NOW - 3 * DAY },
    );
    await openRecords();
    await screen.findByText('Attempt history');
    const rows = screen.getAllByLabelText(/^(Running count|Conversion) · /).map((row) => row.props.accessibilityLabel as string);
    expect(rows).toEqual([
      'Running count · Check. Today · 2 s pace · ended early — insufficient funds · Local, not synced yet. Partial',
      'Conversion · Check. Yesterday · abandoned · Local, not synced yet. —',
      'Running count · Check. 17 Oct 2026 · unassisted · Local, not synced yet. 4 / 4',
    ]);
  });

  it('labels an earlier content or reference version on its group and its history', async () => {
    const { RUNNING_COUNT_CHECK } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    seed({ id: 'old', key: { ...RUNNING_COUNT_CHECK, content: { id: 'running-count', version: 0 } }, performanceMs: null, endedAt: MOCK_NOW - 60_000 });
    await openRecords();
    expect(await screen.findByLabelText('Running count, 52 cards · self-paced · content version 0. Best 4 of 4. Fastest — (needs a timed, uninterrupted run)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count · Check. Today · unassisted · content version 0 · Local, not synced yet. 4 / 4')).toBeOnTheScreen();
  });

  it('shows a new Learn personal best on results, then the attempt in Records, opening its review from history', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await screen.findByRole('header', { name: 'Counting' });
    await fireEvent.press(screen.getByRole('button', { name: 'Learn: Card values' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Start Learn attempt' }));
    for (let card = 1; card <= 20; card++) {
      await screen.findByText(`Card ${card} of 20`);
      await fireEvent.press(screen.getByRole('button', { name: answerFor(shownCard()) }));
      await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
    }
    await screen.findByRole('header', { name: 'Results' });
    const best = screen.getByLabelText('New Learn personal best. Compared only with Learn attempts at these settings.');
    expect(within(best).getByText('New Learn personal best')).toBeOnTheScreen();
    expect(screen.getByText('Completed · Learn')).toBeOnTheScreen();
    expect(cues().slice(-2)).toEqual(['attempt-ended', 'milestone']);
    await cleanup();

    await openRecords();
    await fireEvent.press(screen.getByRole('radio', { name: 'Learn' }));
    expect(await screen.findByLabelText('Card values, 20 cards · self-paced. Best 20 of 20')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Card values · Learn. Today · completed · Local, not synced yet. 20 / 20' }));
    await screen.findByRole('header', { name: 'Card review' });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Records & history' }));
    expect(await screen.findByRole('header', { name: 'Records & history' })).toBeOnTheScreen();
    // Spec 3 Comparison groups › Milestones (never on history views)
    expect(cues()).not.toContain('milestone');
  });

  // Spec 3 Amendment 1 C8; #142
  it('shows another device’s synced attempt from its summary, fetching its review only when opened', async () => {
    const { attemptRecord } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    const theirs: ChallengeAttemptRecord = {
      ...attemptRecord({ id: 'theirs', installation: 'device-b', endedAt: MOCK_NOW - 60_000 }),
      review: [
        { kind: 'running-count', checkpoint: 1, position: 13, entered: 2, reference: 2, error: 0 },
        { kind: 'running-count', checkpoint: 2, position: 26, entered: -1, reference: -1, error: 0 },
        { kind: 'running-count', checkpoint: 3, position: 39, entered: 0, reference: 0, error: 0 },
        { kind: 'running-count', checkpoint: 4, position: 52, entered: 1, reference: 1, error: 0 },
      ],
    };
    mockAccepted = [theirs];
    const asked: string[] = [];
    mockDetail = async (attemptId) => {
      asked.push(attemptId);
      return theirs;
    };
    await openRecords();

    const row = await screen.findByRole('button', { name: 'Running count · Check. Today · unassisted. 4 / 4' });
    expect(asked).toEqual([]);
    await fireEvent.press(row);
    expect(await screen.findByRole('header', { name: 'Checkpoint review' })).toBeOnTheScreen();
    expect(asked).toEqual(['theirs']);
  });

  it('says when a synced attempt’s review can’t be fetched yet', async () => {
    const { attemptRecord } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    mockAccepted = [attemptRecord({ id: 'theirs', installation: 'device-b', endedAt: MOCK_NOW - 60_000 })];
    await openRecords();
    await fireEvent.press(await screen.findByRole('button', { name: 'Running count · Check. Today · unassisted. 4 / 4' }));
    expect(await screen.findByText("This attempt's review isn't on this device yet. Try again when you're online.")).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Records & history' })).toBeOnTheScreen();
  });

  it('has nothing to show before any attempt', async () => {
    await openRecords();
    expect(await screen.findByText('No attempts yet.')).toBeOnTheScreen();
    expect(screen.getByText('No unassisted Check attempts yet.')).toBeOnTheScreen();
  });
});

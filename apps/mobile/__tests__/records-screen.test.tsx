// Spec 3 Testing Decisions › Seam 3; S3-10 OVKkc (Amendment 2 §3), S3-01 PDCaD, S3-08 liAfT; #140

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
});

describe('Records & history', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

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
    expect(screen.getByText('PERSONAL BESTS · UNASSISTED CHECK, BY SETTINGS')).toBeOnTheScreen();
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
    expect(screen.getByText('PERSONAL BESTS · ASSISTED CHECK, BY SETTINGS')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, 52 cards · self-paced. Best 4 of 4')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Learn' }));
    expect(screen.getByText('PERSONAL BESTS · LEARN, BY SETTINGS')).toBeOnTheScreen();
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
    await screen.findByText('ATTEMPT HISTORY');
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

  it('has nothing to show before any attempt', async () => {
    await openRecords();
    expect(await screen.findByText('No attempts yet.')).toBeOnTheScreen();
    expect(screen.getByText('No unassisted Check attempts yet.')).toBeOnTheScreen();
  });
});

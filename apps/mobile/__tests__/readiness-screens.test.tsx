// Spec 3 Testing Decisions › Seam 3; S3-01 PDCaD, S3-08 CEb6T, nXGFk (Amendment 2 §3), S3-10 OVKkc; #141

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import type { ChallengeAttemptRecord, ChallengeGroupKey } from '@tableside/engine';
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
        speech: jest.requireActual('@/training/speech').NO_SCREEN_READER,
      };
    },
  };
});

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<string, string> = { Ace: 'minus 1', '2': 'plus 1', '3': 'plus 1', '4': 'plus 1', '5': 'plus 1', '6': 'plus 1', '7': '0', '8': '0', '9': '0', '10': 'minus 1', Jack: 'minus 1', Queen: 'minus 1', King: 'minus 1' };
const answerFor = (card: string) => HI_LO[card.split(' of ')[0]!]!;
const wrongFor = (card: string) => (answerFor(card) === 'plus 1' ? 'minus 1' : 'plus 1');
const cues = () => (jest.requireMock('@/feedback/device-ports') as { latest: SubstituteFeedbackPorts }).latest.sound.played.map((play) => play.cue);
const shownCard = () => screen.getByTestId('challenge-card').props.accessibilityLabel as string;

const CARD_VALUES_CHECK: ChallengeGroupKey = {
  category: 'card-values',
  variant: 'check',
  assistanceClass: 'unassisted-check',
  countRevealed: false,
  content: { id: 'card-values', version: 1 },
  reference: null,
  length: 20,
  pacing: 'self-paced',
  table: null,
};
const perfectCardValues = (id: string, endedAt: number): AttemptFixture => ({ id, key: CARD_VALUES_CHECK, scores: { 'card-values': [20, 20] }, performanceMs: null, endedAt, installation: 'test-device' });

function seed(...fixtures: AttemptFixture[]) {
  const { attemptRecord } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
  mockSeed = fixtures.map(attemptRecord);
}

async function openCounting() {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
}

async function runCardValuesCheck(wrongCards: readonly number[]) {
  await fireEvent.press(screen.getByRole('button', { name: 'Check: Card values' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Start Check attempt' }));
  for (let card = 1; card <= 20; card++) {
    await screen.findByText(`Card ${card} of 20`);
    const shown = shownCard();
    await fireEvent.press(screen.getByRole('button', { name: wrongCards.includes(card) ? wrongFor(shown) : answerFor(shown) }));
  }
  await screen.findByRole('header', { name: 'Results' });
}

beforeEach(() => {
  mockStore = null;
  mockSeed = [];
});

describe('readiness on screen', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('Counting tab (PDCaD): recommends card values first, with its reason, and says what has not been tried', async () => {
    await openCounting();
    const card = await screen.findByLabelText('Recommended next. Card values is first on the suggested path.');
    expect(within(card).getByText('Recommended next')).toBeOnTheScreen();
    expect(screen.getAllByText('Not tried yet')).toHaveLength(4);
  });

  it('Counting tab (PDCaD): marks the earned milestone and recommends running count next, with Learn best status lines', async () => {
    const { RUNNING_COUNT_CHECK } = jest.requireActual('@/training/testing/attempt-records') as typeof import('@/training/testing/attempt-records');
    seed(perfectCardValues('first', MOCK_NOW - 2 * DAY), perfectCardValues('second', MOCK_NOW - DAY), {
      id: 'learn',
      key: { ...RUNNING_COUNT_CHECK, variant: 'learn', assistanceClass: 'learn' },
      scores: { 'running-count': [49, 52] },
      installation: 'test-device',
    });
    await openCounting();
    expect(await screen.findByText('Readiness milestone earned · Check, self-paced')).toBeOnTheScreen();
    expect(screen.getByLabelText('Recommended next. You earned the card-values readiness milestone. Running count is next on the suggested path.')).toBeOnTheScreen();
    expect(screen.getByText('Learn best 49 / 52 · not tried in Check yet')).toBeOnTheScreen();
    expect(screen.getAllByText('Not tried yet')).toHaveLength(2);
  });

  it('Results (CEb6T): the Check that earns the milestone shows it with cue 16, the next step on the path, and Records lists it', async () => {
    seed(perfectCardValues('first', MOCK_NOW - DAY));
    await openCounting();
    await runCardValuesCheck([]);
    const box = screen.getByLabelText(
      'Readiness milestone earned. Two unassisted Check attempts in a row at 95% or better, at these settings, on this device. It describes your card-value accuracy at these settings only.',
    );
    expect(within(box).getByText('Readiness milestone earned')).toBeOnTheScreen();
    expect(screen.queryByText('New personal best')).toBeNull();
    expect(cues().slice(-2)).toEqual(['attempt-ended', 'milestone']);
    expect(await screen.findByText('5 attempts left today. Retry starts a fresh attempt. Next on the suggested path: running count.')).toBeOnTheScreen();
    await cleanup();

    await openCounting();
    await fireEvent.press(screen.getByRole('button', { name: 'Records & history. Personal bests, fastest times, milestones and every attempt' }));
    expect(await screen.findByLabelText('Card values, 20 cards · self-paced. Best 20 of 20. Fastest — (needs a timed, uninterrupted run). Readiness milestone · earned 20 Oct 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values · Check. Today · unassisted · milestone earned (2 in a row) · Local, not synced yet. 20 / 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values · Check. Yesterday · unassisted · Local, not synced yet. 20 / 20')).toBeOnTheScreen();
  });

  it('Results (nXGFk): a later Check below 95% keeps the milestone and suggests Learn and the lesson', async () => {
    seed(perfectCardValues('first', Date.UTC(2026, 9, 17, 18)), perfectCardValues('second', Date.UTC(2026, 9, 18, 18)));
    await openCounting();
    await runCardValuesCheck([1, 2]);
    expect(screen.getByText('Below 95% this time. That restarts the streak for these settings.')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Your milestone stays earned. You earned the card-value readiness milestone at these settings on 18 Oct 2026. A slip never takes it away. To brush up: a Learn round, or the card values lesson.',
      ),
    ).toBeOnTheScreen();
    expect(cues()).not.toContain('milestone');
    expect(screen.getByRole('button', { name: 'Review cards' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open the card values lesson' })).toBeOnTheScreen();
    expect(await screen.findByText('Learn uses 1 of your 5 attempts left today. Lessons never use one.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Practice in Learn' }));
    await screen.findByRole('header', { name: 'Card values' });
    expect(within(screen.getByLabelText('Variant')).getByRole('radio', { name: 'Learn' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeOnTheScreen();
  });
});

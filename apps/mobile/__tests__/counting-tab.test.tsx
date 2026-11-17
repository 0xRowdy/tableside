// Spec 3 Testing Decisions › Seam 3; S3-01 PDCaD, S3-02 buD2R, S3-03 P4WjR, S3-08 liAfT; #158

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { AdmissionDecision } from '@/practice/adapters';

let mockAdmission: AdmissionDecision | null = null;
let mockStore: unknown = null;

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  return {
    createTrainingAdapters: () => {
      mockStore = new MemoryTrainingStore();
      return {
        store: mockStore,
        access: { ...alwaysAllowed, beforeChallenge: async () => mockAdmission ?? alwaysAllowed.beforeChallenge() },
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => 'attempt-1',
        device: 'test-device',
        owner: 'local',
      };
    },
  };
});

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<string, string> = { Ace: 'minus 1', '2': 'plus 1', '3': 'plus 1', '4': 'plus 1', '5': 'plus 1', '6': 'plus 1', '7': '0', '8': '0', '9': '0', '10': 'minus 1', Jack: 'minus 1', Queen: 'minus 1', King: 'minus 1' };

const shownCard = () => screen.getByTestId('challenge-card').props.accessibilityLabel as string;
const answerFor = (card: string) => HI_LO[card.split(' of ')[0]!]!;

async function openSetup() {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
  await fireEvent.press(screen.getByRole('button', { name: 'Learn: Card values' }));
  await screen.findByRole('header', { name: 'Card values' });
}

beforeEach(() => {
  mockAdmission = null;
});

describe('the Counting tab', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('shows the four challenge categories in the suggested order, all available', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await screen.findByRole('header', { name: 'Counting' });
    expect(screen.getByText('SUGGESTED ORDER · ALL FOUR AVAILABLE NOW')).toBeOnTheScreen();
    expect(screen.getAllByRole('header').map((header) => header.props.children)).toEqual(['Counting', 'Card values', 'Running count', 'True-count conversion', 'Table counting']);
    expect(screen.getByText('20 cards covering every rank. Answer +1, 0 or −1 for each.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Learn: Card values' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check: Card values' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Learn: Running count' })).toBeDisabled();
    expect(screen.getByText('Recommendations use your accuracy only, never speed or winnings. Nothing here is locked.')).toBeOnTheScreen();
  });

  it('sets up a card-values Learn attempt with the charge notice before anything starts', async () => {
    await openSetup();
    const variant = within(screen.getByLabelText('Variant'));
    expect(variant.getByRole('radio', { name: 'Learn', checked: true })).toBeOnTheScreen();
    expect(variant.getByRole('radio', { name: 'Check' })).toBeDisabled();
    expect(screen.getByText(/Learn tells you after each answer whether it's right/)).toBeOnTheScreen();
    expect(screen.getByText('Starting uses 1 challenge attempt. Resuming doesn’t use another.')).toBeOnTheScreen();
    expect(mockStore && (await (mockStore as { findUnfinishedAttempt(): Promise<unknown> }).findUnfinishedAttempt())).toBeNull();
    expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeEnabled();
  });

  it('shows no content when admission is denied', async () => {
    mockAdmission = { status: 'denied', provenance: 'test', disposition: 'stop', reason: 'No attempts left today.' };
    await openSetup();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Learn attempt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/This attempt can’t start right now/);
    expect(screen.queryByTestId('challenge-card')).toBeNull();
  });

  it('runs a Learn attempt: a wrong first answer is explained and retried, and results show the exact score with N/A for untested skills', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Learn attempt' }));
    await screen.findByText('Card 1 of 20');
    expect(screen.getByText('Learn · self-paced')).toBeOnTheScreen();

    const first = shownCard();
    const wrong = answerFor(first) === 'plus 1' ? 'minus 1' : 'plus 1';
    await fireEvent.press(screen.getByRole('button', { name: wrong }));
    expect(screen.getByText('NOT QUITE · YOUR FIRST ANSWER IS SCORED')).toBeOnTheScreen();
    expect(screen.getByText(/Hi-Lo values: 2 to 6 are \+1\. 7, 8 and 9 are 0\. 10, J, Q, K and A are −1\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: wrong })).toHaveAccessibilityValue({ text: 'Your answer' });
    expect(screen.getByRole('button', { name: answerFor(first) })).toHaveAccessibilityValue({ text: 'Correct' });
    await fireEvent.press(screen.getByRole('button', { name: 'Try this card again' }));
    expect(screen.queryByText('NOT QUITE · YOUR FIRST ANSWER IS SCORED')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: answerFor(first) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));

    for (let card = 2; card <= 20; card++) {
      await screen.findByText(`Card ${card} of 20`);
      await fireEvent.press(screen.getByRole('button', { name: answerFor(shownCard()) }));
      await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
    }

    await screen.findByRole('header', { name: 'Results' });
    expect(screen.getByText('Card values · Learn · self-paced')).toBeOnTheScreen();
    expect(screen.getByText('Completed · Learn')).toBeOnTheScreen();
    expect(screen.getByText('SKILL SCORES · FIRST ANSWERS')).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values, 20 cards: 19 of 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, Not tested: N/A')).toBeOnTheScreen();
    expect(screen.getByLabelText('True count, Not tested: N/A')).toBeOnTheScreen();
  });
});

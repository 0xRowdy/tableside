// Spec 3 Testing Decisions › Seam 3 (spoken pacing, information hiding); S3-02 Ufuiu, S3-04 qmDou, S3-05 qGARl; #136

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Platform } from 'react-native';

import { expectNotPresented, presentedScreen, watchAccessibilityEvents, type AccessibilityEvents } from '@/training/testing/information-hiding';

const mockSpeech = {
  busy: false,
  announce: (message: string) => AccessibilityInfo.announceForAccessibility(message),
  speaking: () => mockSpeech.busy,
};

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  return {
    createTrainingAdapters: () => {
      let next = 0;
      return {
        store: new MemoryTrainingStore(),
        access: alwaysAllowed,
        allowance: { challengeAllowance: async () => ({ kind: 'premium' }) },
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `attempt-${++next}`,
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
        speech: mockSpeech,
      };
    },
  };
});

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<string, number> = { Ace: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 0, '8': 0, '9': 0, '10': -1, Jack: -1, Queen: -1, King: -1 };
const READER = Platform.OS === 'ios' ? 'VoiceOver' : 'TalkBack';
const CARD_NAME = /^(Ace|[2-9]|10|Jack|Queen|King) of (clubs|diamonds|hearts|spades)$/;

async function openRunningCount(variant: 'Learn' | 'Check') {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
  await fireEvent.press(screen.getByRole('button', { name: `${variant}: Running count` }));
  await screen.findByRole('header', { name: 'Running count' });
}

async function startAt(variant: 'Learn' | 'Check', pace: string) {
  await openRunningCount(variant);
  await fireEvent.press(within(screen.getByLabelText('Card pace')).getByRole('radio', { name: pace }));
  await fireEvent.press(screen.getByRole('button', { name: `Start ${variant} attempt` }));
}

describe('automatic and spoken pacing on screen', () => {
  let events: AccessibilityEvents;

  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  beforeEach(() => {
    mockSpeech.busy = false;
    events = watchAccessibilityEvents();
  });

  afterEach(() => jest.restoreAllMocks());

  it('offers the card pace on running-count setup (Ufuiu), self-paced by default', async () => {
    await openRunningCount('Check');
    const pace = within(screen.getByLabelText('Card pace'));
    expect(pace.getAllByRole('radio').map((radio) => [radio.props.accessibilityLabel, radio.props.accessibilityState.checked])).toEqual([
      ['Self-paced', true],
      ['3 seconds', false],
      ['2 seconds', false],
      ['1 second', false],
    ]);
    expect(screen.queryByText("Cards advance on their own and pause whenever a count is due. There's no answer deadline.")).toBeNull();
    await fireEvent.press(pace.getByRole('radio', { name: '2 seconds' }));
    expect(screen.getByText("Cards advance on their own and pause whenever a count is due. There's no answer deadline.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Counting' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Learn: Card values' }));
    await screen.findByRole('header', { name: 'Card values' });
    expect(screen.queryByLabelText('Card pace')).toBeNull();
  });

  it('a self-paced attempt waits on Next card and announces each card as it appears', async () => {
    await openRunningCount('Check');
    await fireEvent.press(screen.getByRole('button', { name: 'Start Check attempt' }));
    await screen.findByText(/^Card 1 of 52/);
    mockSpeech.busy = true;
    expect(screen.getByText('Check · self-paced')).toBeOnTheScreen();
    const first = events.announcements.at(-1);
    expect(first).toMatch(CARD_NAME);
    await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
    await screen.findByText(/^Card 2 of 52/);
    expect(events.announcements.filter((said) => CARD_NAME.test(said))).toHaveLength(2);
    expect(screen.queryByTestId('attempt-hold')).toBeNull();
  });

  it('advances on its own at the chosen pace and waits, with no deadline, when a count is due (qmDou)', async () => {
    await startAt('Check', '1 second');
    expect(await screen.findByText('Card 13 of 52 · checkpoint 1 of 4')).toBeOnTheScreen();
    expect(screen.getByText('Check · 1 s pace')).toBeOnTheScreen();
    expect(screen.getByText('Paused for your answer · no deadline')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Next card' })).toBeNull();
    expect(events.announcements.filter((said) => CARD_NAME.test(said))).toHaveLength(13);
  });

  it('auto-pauses and explains when the screen reader is still reading the card (qGARl); Resume shows the next card first', async () => {
    mockSpeech.busy = true;
    await startAt('Check', '2 seconds');
    const sheet = within(await screen.findByTestId('attempt-hold'));
    expect(sheet.getByRole('header', { name: "Paused so you don't miss a card" })).toBeOnTheScreen();
    expect(sheet.getByText(`${READER} was still reading card 1 when card 2 was due, so the attempt paused. No card was skipped, and the 2-second pace won't change.`)).toBeOnTheScreen();
    expect(sheet.getByText("This counts as an interruption: accuracy still counts, but the attempt can't set a fastest time. Self-paced mode never pauses like this.")).toBeOnTheScreen();
    expect(sheet.getByText("Resume when you're ready. Card 2 appears first.")).toBeOnTheScreen();
    expect(screen.getByText('Check · 2 s pace · auto-paused')).toBeOnTheScreen();
    expect(screen.getByText(/^Card 1 of 52/)).toBeOnTheScreen();

    await fireEvent.press(sheet.getByRole('button', { name: 'Resume' }));
    expect(await screen.findByText(`${READER} was still reading card 2 when card 3 was due, so the attempt paused. No card was skipped, and the 2-second pace won't change.`)).toBeOnTheScreen();
    expect(screen.getByText(/^Card 2 of 52/)).toBeOnTheScreen();
  });

  // Spec 3 Information hiding (announcements); User story 66
  it('announces only the cards in Check: a right and a wrong count leave the same announcements', async () => {
    const afterCheckpoint = async (offset: number) => {
      await screen.findByText('Card 13 of 52 · checkpoint 1 of 4');
      const cards = events.announcements.filter((said) => CARD_NAME.test(said));
      const count = cards.reduce((sum, card) => sum + HI_LO[card.split(' of ')[0]!]!, 0) + offset;
      events.clear();
      await fireEvent.changeText(screen.getByLabelText('Running count'), count < 0 ? `−${-count}` : String(count));
      await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
      await screen.findByText('Card 26 of 52 · checkpoint 2 of 4');
      expectNotPresented(presentedScreen(screen.toJSON() as never, events), ['Correct', 'reference']);
      return { cards, after: [...events.announcements] };
    };
    await startAt('Check', '1 second');
    const right = await afterCheckpoint(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(within(await screen.findByTestId('attempt-hold')).getByRole('button', { name: 'End attempt' }));
    const retry = await screen.findByRole('button', { name: 'Retry with a new shuffle' });
    events.clear();
    await fireEvent.press(retry);
    const wrong = await afterCheckpoint(1);
    expect(wrong.cards).toEqual(right.cards);
    expect(right.after.every((said) => CARD_NAME.test(said))).toBe(true);
    expect(wrong.after).toEqual(right.after);
  });
});

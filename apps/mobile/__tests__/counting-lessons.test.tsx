// Spec 3 Testing Decisions › Seam 3; Lessons and worked examples (#48), Handoff, Entry points; S3-12 l8pMS, aJV2y, hGHha; Amendment 2 §3; #153

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { substituteFeedbackPorts } from '@/feedback/testing/substitutes';
import type { MemoryTrainingStore } from '@/training/memory-store';

let mockStore: unknown = null;

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { plentyAllowance } = jest.requireActual('@/training/allowance');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  let next = 0;
  return {
    createTrainingAdapters: () => {
      mockStore = new MemoryTrainingStore();
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

const device = jest.requireMock('@/feedback/device-ports') as { latest: ReturnType<typeof substituteFeedbackPorts> | null };
const cues = () => device.latest?.sound.played.map((play) => play.cue);
const store = () => mockStore as MemoryTrainingStore;
const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// Opens a lesson from its link on the Counting tab (PDCaD) and steps to the given step.
async function openLesson(link: string, title: string, step: number) {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await header('Counting');
  await fireEvent.press(screen.getByRole('link', { name: link }));
  await header(title);
  for (let at = 1; at < step; at++) await fireEvent.press(button('Next'));
}

async function openExample(link: string, title: string, step: number) {
  await openLesson(link, title, step);
  await fireEvent.press(await screen.findByRole('button', { name: 'Try the worked example (optional)' }));
  await header('Worked example');
}

describe('counting lessons', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  describe('worked examples', () => {
    // S3-12 aJV2y; Amendment 2 §3
    it('conversion gives the running count and decks remaining, and answers "truncate toward zero"', async () => {
      await openExample('Lesson: true-count conversion', 'True-count conversion', 3);
      expect(screen.getByLabelText('Running count: +7')).toBeOnTheScreen();
      expect(screen.getByLabelText('Decks remaining: 2')).toBeOnTheScreen();
      expect(screen.getByText("What's the true count?")).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt']);

      await fireEvent.press(button('plus 4'));
      expect(button('plus 4')).toHaveProp('accessibilityValue', { text: 'Your pick' });
      expect(button('plus 3')).toHaveProp('accessibilityValue', { text: 'Correct' });
      const response = within(screen.getByTestId('scripted-response'));
      expect(response.getByText('7 ÷ 2 = 3.5. Truncate toward zero: +3.')).toBeOnTheScreen();
      expect(
        response.getByText('Rounding 3.5 up gives +4, but Tableside drops the fraction. Truncation goes toward zero for negatives too: −7 ÷ 2 = −3.5 becomes −3, not −4.'),
      ).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt', 'incorrect']);

      await fireEvent.press(button('Try it again'));
      await fireEvent.press(button('plus 3'));
      expect(screen.getByText('Truncation goes toward zero for negatives too: −7 ÷ 2 = −3.5 becomes −3, not −4.')).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt', 'incorrect', 'correct']);
      await fireEvent.press(button('Continue'));
      expect(await header('Other sources round differently')).toBeOnTheScreen();
      expect(await store().readAttemptRecords()).toEqual([]);
      expect(await store().findUnfinishedAttempt()).toBeNull();
    });

    it('running count gives the count so far and the next card', async () => {
      await openExample('Lesson: running count', 'Running count', 2);
      expect(screen.getByLabelText('Running count: −2')).toBeOnTheScreen();
      expect(screen.getByLabelText('3 of diamonds')).toBeOnTheScreen();
      expect(screen.getByText("What's the running count now?")).toBeOnTheScreen();
      await fireEvent.press(button('minus 3'));
      expect(button('minus 1')).toHaveProp('accessibilityValue', { text: 'Correct' });
      expect(screen.getByText('−2, and 3 counts +1: the running count is −1.')).toBeOnTheScreen();
      expect(screen.getByText('A 3 counts +1, so the count moves up toward zero, not further below it.')).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt', 'incorrect']);
    });

    it('card values asks the Hi-Lo value of an ace', async () => {
      await openExample('Lesson: card values', 'Card values', 2);
      expect(screen.getByLabelText('Ace of spades')).toBeOnTheScreen();
      await fireEvent.press(button('plus 1'));
      expect(button('minus 1')).toHaveProp('accessibilityValue', { text: 'Correct' });
      expect(screen.getByText('Ace counts −1 in Hi-Lo.')).toBeOnTheScreen();
    });

    // Spec 3 Count checkpoints (table): the hole card counts once it's turned over
    it('table counting shows a finished round and asks the running count after it, with the checkpoint cue', async () => {
      await openExample('Lesson: table counting', 'Table counting', 3);
      expect(screen.getByText('Round 1 has just finished, with the dealer’s hole card turned over. The count was 0 before the round.')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Dealer' })).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Your seat (Observe)' })).toBeOnTheScreen();
      expect(screen.getAllByTestId('challenge-card').map((card) => card.props.accessibilityLabel)).toEqual(['5 of clubs', 'King of diamonds', '9 of spades', '10 of spades', '6 of hearts']);
      expect(screen.getByText("What's the running count after the round?")).toBeOnTheScreen();
      expect(cues()).toEqual(['checkpoint-due']);

      await fireEvent.press(button('plus 1'));
      expect(button('0')).toHaveProp('accessibilityValue', { text: 'Correct' });
      expect(screen.getByText('The running count is 0.')).toBeOnTheScreen();
      expect(screen.getByText('Round 1’s exposed cards were 10♠, 5♣, 6♥, K♦ and 9♠: −1, +1, +1, −1, 0 adds up to 0. The count was 0 before the round, so it’s 0 now.')).toBeOnTheScreen();
      expect(screen.getByText('That leaves out the dealer’s king. The hole card counts once it’s turned over.')).toBeOnTheScreen();
    });
  });

  // Spec 3 Lessons › Handoff; S3-12 ZBpF3
  it.each([
    ['Lesson: card values', 'Card values', 'Card values'],
    ['Lesson: running count', 'Running count', 'Running count'],
    ['Lesson: true-count conversion', 'True-count conversion', 'True-count conversion'],
    ['Lesson: table counting', 'Table counting', 'Table counting'],
  ])('%s hands off to its Learn challenge setup, prefilled, with nothing started', async (link, title, challenge) => {
    await openLesson(link, title, 1);
    for (;;) {
      const next = screen.queryByRole('button', { name: 'Next' });
      if (!next) break;
      await fireEvent.press(next);
    }
    expect(await header('Sources')).toBeOnTheScreen();
    await fireEvent.press(button('Finish'));
    await header('Practice what you learned');
    await fireEvent.press(button(new RegExp(`^Learn challenge · ${challenge}\\.`)));
    expect(await header(challenge)).toBeOnTheScreen();
    expect(within(screen.getByLabelText('Variant')).getByRole('radio', { name: 'Learn' })).toBeChecked();
    if (challenge === 'Table counting') expect(within(screen.getByLabelText('Who plays your seat')).getByRole('radio', { name: 'Observe' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeEnabled();
    expect([await store().findUnfinishedAttempt(), await store().readAttemptRecords()]).toEqual([null, []]);
  });

  // #134, #135: the lesson opens from a Learn question, and leaving the Counting tab suspends the attempt
  it('opens the conversion lesson from a Learn explanation and suspends the attempt until the learner returns', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await header('Counting');
    await fireEvent.press(button('Learn: True-count conversion'));
    await header('True-count conversion');
    await fireEvent.press(button('Start Learn attempt'));
    await screen.findByText('Question 1 of 10');
    await fireEvent.changeText(screen.getByLabelText('True count'), '0');
    await fireEvent.press(button('Submit'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Read the conversion lesson' }));
    expect(await header('Why convert')).toBeOnTheScreen();
    expect(screen.getByText('Lesson · Blackjack')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: /Counting/ }));
    const sheet = within(await screen.findByTestId('attempt-hold'));
    expect(sheet.getByRole('header', { name: 'Attempt paused' })).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Resume' }));
    expect(screen.getByText('Question 1 of 10')).toBeOnTheScreen();
  });
});

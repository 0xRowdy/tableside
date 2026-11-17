// Spec 3 Testing Decisions › Seam 3; S3-01 Uq05w, S3-02 buD2R, S3-05 r5pCx, T9sCI, S3-08 UXrpw; #135

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { ChallengeAllowance } from '@/training/allowance';

const MIDNIGHT_IN_DENVER_MST = Date.UTC(2026, 10, 18, 7);
const MOUNTAIN_FREE: ChallengeAllowance = { kind: 'free', amount: 5, left: 4, resetsAt: MIDNIGHT_IN_DENVER_MST, timeZone: 'America/Denver', allowanceDevice: { here: true } };

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
        allowance: { challengeAllowance: async () => MOUNTAIN_FREE },
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `attempt-${++next}`,
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
const shownCard = () => screen.getByTestId('challenge-card').props.accessibilityLabel as string;
const answerFor = (card: string) => HI_LO[card.split(' of ')[0]!]!;

async function startCardValues(variant: 'Learn' | 'Check', options: { timed?: boolean } = {}) {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
  await fireEvent.press(screen.getByRole('button', { name: `${variant}: Card values` }));
  await screen.findByRole('header', { name: 'Card values' });
  if (options.timed) await fireEvent.press(screen.getByRole('switch', { name: 'Time this attempt' }));
  await fireEvent.press(screen.getByRole('button', { name: `Start ${variant} attempt` }));
  await screen.findByText('Card 1 of 20');
}

async function answerCards(from: number, to: number, variant: 'Learn' | 'Check') {
  for (let card = from; card <= to; card++) {
    await screen.findByText(`Card ${card} of 20`);
    await fireEvent.press(screen.getByRole('button', { name: answerFor(shownCard()) }));
    if (variant === 'Learn') await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
  }
}

describe('the attempt lifecycle on screen', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('pauses from the header (r5pCx): answers and place are kept, and Resume picks up the same card', async () => {
    await startCardValues('Check');
    await answerCards(1, 2, 'Check');
    await screen.findByText('Card 3 of 20');
    const card = shownCard();
    expect(screen.getByRole('button', { name: 'Help' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));

    const sheet = within(await screen.findByTestId('attempt-hold'));
    expect(sheet.getByRole('header', { name: 'Attempt paused' })).toBeOnTheScreen();
    expect(sheet.getByText(/Your answers and place are saved\. Switching apps or tabs pauses an attempt too\./)).toBeOnTheScreen();
    expect(sheet.getByText("Ending keeps today's attempt used, earns no record and restarts progress toward the readiness milestone for these settings.")).toBeOnTheScreen();
    expect(sheet.getByText('The four counting lessons are available after this attempt. Other lessons are open now.')).toBeOnTheScreen();
    expect(screen.getByText('Check · self-paced · paused')).toBeOnTheScreen();

    await fireEvent.press(sheet.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByTestId('attempt-hold')).toBeNull();
    expect([screen.getByText('Card 3 of 20'), shownCard()]).toEqual([expect.anything(), card]);
  });

  it('ends a paused attempt as abandoned (UXrpw), and Retry starts a new attempt', async () => {
    await startCardValues('Check');
    await answerCards(1, 4, 'Check');
    await screen.findByText('Card 5 of 20');
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(within(await screen.findByTestId('attempt-hold')).getByRole('button', { name: 'End attempt' }));

    await screen.findByRole('header', { name: 'Results' });
    expect(screen.getByText('Abandoned after card 5 of 20')).toBeOnTheScreen();
    expect(screen.getByText(/You ended this attempt\. It keeps today's attempt used and earns no record\./)).toBeOnTheScreen();
    expect(screen.getByText("Abandoning a Check restarts progress toward the readiness milestone for these settings. It's only labeled abandoned, never as a failed skill.")).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values, 4 cards: 4 of 4')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry with new cards' }));
    expect(await screen.findByText('Card 1 of 20')).toBeOnTheScreen();
  });

  it('opens operational help only (T9sCI), and it never shows an answer', async () => {
    await startCardValues('Check');
    await fireEvent.press(screen.getByRole('button', { name: 'Help' }));
    const sheet = within(await screen.findByTestId('attempt-help'));
    expect(sheet.getByRole('header', { name: 'How this check works' })).toBeOnTheScreen();
    for (const title of ['Choosing a value', 'Skip', 'Pause']) expect(sheet.getByText(title)).toBeOnTheScreen();
    expect(sheet.getByText('Moves on and counts as incorrect.')).toBeOnTheScreen();
    expect(sheet.getByText('The four counting lessons wait until this attempt ends, so help never gives away an answer. Every other lesson stays open.')).toBeOnTheScreen();
    expect(sheet.queryByText(/[+−-]1|Hi-Lo|counts? (plus|minus)/)).toBeNull();
    await fireEvent.press(sheet.getByRole('button', { name: 'Back to the check' }));
    expect(screen.queryByTestId('attempt-help')).toBeNull();
  });

  it('keeps one unfinished attempt (Uq05w): starting another offers Resume or End, and ending opens the new setup', async () => {
    await startCardValues('Learn');
    await answerCards(1, 2, 'Learn');
    await screen.findByText('Card 3 of 20');
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(within(await screen.findByTestId('attempt-hold')).getByRole('button', { name: 'Close' }));

    await screen.findByRole('header', { name: 'Counting' });
    await fireEvent.press(screen.getByRole('button', { name: 'Check: Running count' }));
    let sheet = within(await screen.findByTestId('unfinished-attempt'));
    expect(sheet.getByRole('header', { name: 'You have an unfinished attempt' })).toBeOnTheScreen();
    expect(sheet.getByText('Card values · Learn is paused at card 3 of 20. This device keeps one unfinished attempt at a time, so resume it or end it before starting Running count.')).toBeOnTheScreen();
    expect(sheet.getByText("Resuming doesn't use another attempt.")).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Resume card values' }));
    expect(await screen.findByText('Card 3 of 20')).toBeOnTheScreen();
    expect(screen.queryByTestId('attempt-hold')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(within(await screen.findByTestId('attempt-hold')).getByRole('button', { name: 'Close' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Check: Running count' }));
    sheet = within(await screen.findByTestId('unfinished-attempt'));
    await fireEvent.press(sheet.getByRole('button', { name: 'End it, then set up Running count' }));
    await screen.findByRole('header', { name: 'Running count' });
    expect(within(screen.getByLabelText('Variant')).getByRole('radio', { name: 'Check', checked: true })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Results' })).toBeNull();
  });

  // Spec 3 Amendment 1 B5
  it('suspends the attempt when the learner leaves the Counting tab, and shows it held on return', async () => {
    await startCardValues('Learn');
    await answerCards(1, 1, 'Learn');
    await screen.findByText('Card 2 of 20');
    await fireEvent.press(screen.getByRole('tab', { name: /Home/ }));
    await fireEvent.press(await screen.findByRole('tab', { name: /Counting/ }));
    const sheet = within(await screen.findByTestId('attempt-hold'));
    expect(sheet.getByRole('header', { name: 'Attempt paused' })).toBeOnTheScreen();
    await fireEvent.press(sheet.getByRole('button', { name: 'Resume' }));
    expect(screen.getByText('Card 2 of 20')).toBeOnTheScreen();
  });

  it('times an attempt when timing is on (buD2R, CEb6T), leaving out pauses', async () => {
    await startCardValues('Check', { timed: true });
    expect(screen.getByText('Check · self-paced · timed')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Timed: 0 minutes/)).toBeOnTheScreen();
    await answerCards(1, 20, 'Check');
    await screen.findByRole('header', { name: 'Results' });
    expect(screen.getByText('Uninterrupted and timed: 00:15, not counting pauses.')).toBeOnTheScreen();
  });
});

// Seam 3: the blackjack free-play screens, rendered through the real routes on
// the in-memory adapters and driven only through the accessibility tree.
// The shoe is the Random123 "pi digits" six-deck shuffle (engine draws.cases):
// round 1 deals you the 10 of spades and Jack of diamonds against a dealer
// 10 of spades up with the 6 of spades face down; the next card is the Ace of diamonds.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import type { substituteAdapters } from '@/practice/testing/substitutes';

const mockAdapters: { latest: ReturnType<typeof substituteAdapters> | null } = { latest: null };
jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => (mockAdapters.latest = create({ clock: new FakeClock(undefined, true) })) };
});

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
});

async function openSetup() {
  await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
  await screen.findByRole('header', { name: 'Blackjack' });
}

async function startSession() {
  await openSetup();
  await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText('Session balance 1,000');
}

const betSpot = () => screen.getByRole('button', { name: /^Initial wager/ });

async function betAndDeal(chip = '25') {
  await fireEvent.press(screen.getByRole('radio', { name: `${chip} chip` }));
  await fireEvent.press(betSpot());
  await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
  await screen.findByLabelText('Status Your turn');
}

/** Every label, hint, value and text in the rendered tree, plus every announcement. */
function everythingSpoken(): string {
  return JSON.stringify(screen.toJSON()) + announcements.join(' ');
}

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

describe('blackjack free play', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('opens setup from Home with S17, late surrender and 75% penetration by default', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Blackjack\b/ }));
    await screen.findByRole('header', { name: 'Blackjack' });

    expect(screen.getByRole('radio', { name: 'Stands on all 17s (S17)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Late surrender on' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Penetration 75%' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /^Penetration/ }).map((radio) => radio.props.accessibilityLabel)).toEqual(
      [50, 55, 60, 65, 70, 75, 80].map((p) => `Penetration ${p}%`),
    );
    expect(screen.getByText('Initial wager 10–1,000 units')).toBeOnTheScreen();
    expect(screen.getByText('Edge with basic strategy: 0.33% (this preset)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Starting chips for this session, in units')).toHaveProp('value', '1,000');
  });

  it('changes the preset and penetration, and the table pins them', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hits soft 17 (H17)' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Late surrender off' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Penetration 60%' }));
    expect(screen.getByText('Edge with basic strategy: 0.62% (this preset)')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));

    expect(await screen.findByText('6 decks · H17 · no LS · 10–1,000')).toBeOnTheScreen();
    expect(screen.getByText('DEALER HITS SOFT 17')).toBeOnTheScreen();
    expect(screen.getByText(/Penetration 60%/)).toBeOnTheScreen();
  });

  it('shows the dealer area, shoe, hand and actions with balance, wagers and phase', async () => {
    await startSession();

    expect(screen.getByLabelText('Dealer: no cards yet')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Shoe: 312 cards/)).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Status Waiting for your bet')).toBeOnTheScreen();
    const steps = within(screen.getByTestId('phase-stepper'));
    expect(['Bet, current', 'Deal, upcoming', 'Play, upcoming', 'Settle, upcoming'].map((s, i) => steps.getByLabelText(`Step ${i + 1} of 4, ${s}`))).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Deal' })).toBeOnTheScreen();
  });

  it('announces the wager, then every dealt card, and never exposes the face-down card', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
    await fireEvent.press(betSpot());
    expect(announcements).toContain('Wager 25 on the table. Balance 975.');
    expect(betSpot()).toHaveAccessibilityValue({ text: '25 on it' });

    await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
    await screen.findByLabelText('Status Your turn');
    expect(betSpot()).toHaveAccessibilityValue({ text: '25 on it, in play' });

    expect(announcements).toContain(
      'A fresh shoe is shuffled. Wager 25 in play. You: 10 of spades. Dealer: 10 of spades. You: Jack of diamonds. Dealer: a face-down card. ' +
        'The dealer checked for blackjack: none. You have 20; the dealer shows 10. Your turn.',
    );
    expect(screen.getByLabelText('Dealer: 10 of spades and a face-down card, showing 10')).toBeOnTheScreen();
    expect(screen.getByLabelText('Your hand: 10 of spades, Jack of diamonds. 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Face-down card')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Shoe: 308 cards/)).toBeOnTheScreen();
    // Neither the hole card nor the next card appears in any label, text or announcement.
    expect(everythingSpoken()).not.toMatch(/6 of spades|Ace of diamonds/);
    for (const name of ['Hit', 'Stand', 'Double']) expect(screen.getByRole('button', { name })).toBeEnabled();
    // The wager is committed: no betting or ending mid-hand.
    expect(screen.getByRole('button', { name: 'End session' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Deal' })).toBeNull();
  });

  it('reveals the hole card when you stand, then settles automatically with no tap', async () => {
    await startSession();
    await betAndDeal();

    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));

    await waitFor(() => expect(screen.getByLabelText('Status Settled automatically')).toBeOnTheScreen());
    expect(announcements).toContain('You stand. The dealer turns over the 6 of spades. Dealer: Ace of diamonds. You have 20; the dealer has 17.');
    expect(announcements).toContain('You win 25. Balance 1,025.');
    expect(screen.getByLabelText('Dealer: 10 of spades and 6 of spades and Ace of diamonds, total 17')).toBeOnTheScreen();
    expect(screen.getByLabelText('Session balance 1,025')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    expect(within(screen.getByTestId('phase-stepper')).getByLabelText('Step 4 of 4, Settle, current')).toBeOnTheScreen();
    // The result is marked in words as well as colour.
    expect(screen.getByText('Win +25')).toBeOnTheScreen();
  });

  it('offers a rebet of the last wager for the next round', async () => {
    await startSession();
    await betAndDeal();
    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await screen.findByLabelText('Status Settled automatically');

    await fireEvent.press(screen.getByRole('button', { name: 'Rebet 25' }));

    expect(announcements).toContain('Wager 25 on the table. Balance 1,000.');
    expect(screen.getByLabelText('Last hand: 10 of spades, Jack of diamonds. 20')).toBeOnTheScreen();
  });

  it('hitting to 21 ends the hand and settles it, announcing the card and the result', async () => {
    await startSession();
    await betAndDeal();

    await fireEvent.press(screen.getByRole('button', { name: 'Hit' }));

    // 20 + the Ace of diamonds = 21; the dealer's 16 then draws the next card.
    await screen.findByLabelText('Status Settled automatically');
    expect(announcements.some((text) => text.startsWith('You hit. You: Ace of diamonds. The dealer turns over the 6 of spades.'))).toBe(true);
    expect(screen.getByLabelText(/^Last hand: 10 of spades, Jack of diamonds, Ace of diamonds\. 21/)).toBeOnTheScreen();
  });

  it('ends the session between rounds after confirming, and shows the result', async () => {
    await startSession();
    await betAndDeal();
    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await screen.findByLabelText('Status Settled automatically');

    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    expect(await screen.findByRole('header', { name: 'End this session?' })).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'End session' }).at(-1)!);

    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(screen.getByText('Blackjack · free play · S17 · LS')).toBeOnTheScreen();
    expect(screen.getByLabelText('Final cash-out 1,025')).toBeOnTheScreen();
  });

  it('gives every table control a touch target of at least 48 points', async () => {
    await startSession();
    await betAndDeal();

    const table = within(screen.getByTestId('table-scroll'));
    for (const control of [...table.getAllByRole('button')]) {
      const style = StyleSheet.flatten(control.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth ?? 48).toBeGreaterThanOrEqual(48);
    }
  });

  it('puts the felt beside the controls in a wide window and stacks them at large text sizes', async () => {
    await startSession();
    const { width, height, fontScale } = Dimensions.get('window');
    try {
      await setWindow(844, 390, 1);
      expect(StyleSheet.flatten(screen.getByTestId('table-columns').props.style).flexDirection).toBe('row');
      await setWindow(844, 390, 3.1);
      expect(StyleSheet.flatten(screen.getByTestId('table-columns').props.style).flexDirection).toBeUndefined();
    } finally {
      await setWindow(width, height, fontScale);
    }
  });
});

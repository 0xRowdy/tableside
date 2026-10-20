// Seam 3: the blackjack free-play screens, rendered through the real routes on
// the in-memory adapters and driven only through the accessibility tree.
// The shoe is the Random123 "pi digits" six-deck shuffle (engine draws.cases):
// round 1 deals you the 10 of spades and Jack of diamonds against a dealer
// 10 of spades up with the 6 of spades face down; the next card is the Ace of diamonds.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import type { substituteAdapters } from '@/practice/testing/substitutes';

// The stream each render's app adapters draw from; null is the "pi digits" stream.
const mockAdapters: { latest: ReturnType<typeof substituteAdapters> | null; words: readonly [number, number, number, number] | null } = {
  latest: null,
  words: null,
};
jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return {
    createAppAdapters: () =>
      (mockAdapters.latest = create({ clock: new FakeClock(undefined, true), ...(mockAdapters.words && { words: mockAdapters.words }) })),
  };
});

/**
 * Streams whose first shuffle (Python reference, test/reference/philox_reference.py)
 * deals: NATURAL — you Q♥ and A♦ against a 7♣ up, 2♠ face down;
 * ELEVEN — you 2♥ and 9♣ against a 4♥ up, Q♥ face down, then 8♥ and J♣.
 */
const NATURAL = [40, 0x5441424c, 0x45534944, 0x45] as const;
const ELEVEN = [47, 0x5441424c, 0x45534944, 0x45] as const;
/**
 * Streams found by dealing their first round through the engine (the cards are
 * named here, not computed by the test): INSURANCE — you 2♥ J♦ against an
 * A♥ up, 2♠ face down, then 5♥; EVEN_MONEY — you K♣ A♣ against an A♥ up, 9♣
 * face down; NINES — you 9♣ 9♠ against a 2♠ up, 5♠ face down, then Q♠, Q♥,
 * 6♥, J♣; PLAYERS — with two other players ahead: seat 1 6♦ Q♦, seat 2 A♦ 6♥,
 * you 5♦ 5♦ against a 5♠ up, 3♣ face down, then 6♦ and J♣.
 */
const INSURANCE = [3, 0x5441424c, 0x45534944, 0x45] as const;
const EVEN_MONEY = [245, 0x5441424c, 0x45534944, 0x45] as const;
const NINES = [29, 0x5441424c, 0x45534944, 0x45] as const;
const PLAYERS = [63, 0x5441424c, 0x45534944, 0x45] as const;

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
  mockAdapters.words = null;
});

async function openSetup() {
  await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
  await screen.findByRole('header', { name: 'Blackjack' });
}

async function startSession(otherPlayers?: string) {
  await openSetup();
  if (otherPlayers) await fireEvent.press(screen.getByRole('radio', { name: otherPlayers }));
  await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText('Session balance 1,000');
}

const betSpot = () => screen.getByRole('button', { name: /^Initial wager/ });

async function betAndDeal(chip = '25', status = 'Your turn') {
  await fireEvent.press(screen.getByRole('radio', { name: `${chip} chip` }));
  await fireEvent.press(betSpot());
  await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
  await screen.findByLabelText(`Status ${status}`);
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
    expect(screen.getByRole('radio', { name: 'No other players' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /other player/ }).map((radio) => radio.props.accessibilityLabel)).toEqual([
      'No other players',
      '1 other player',
      '2 other players',
      '3 other players',
      '4 other players',
    ]);
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

  it('pays a natural 3:2 in exact half units with no decision, announcing it', async () => {
    mockAdapters.words = NATURAL;
    await startSession();
    // A lone 5 is under the 10 minimum: refused and explained, nothing placed.
    await fireEvent.press(screen.getByRole('radio', { name: '5 chip' }));
    await fireEvent.press(betSpot());
    expect(announcements).toContain('The initial wager needs at least 10. Nothing was placed.');
    expect(betSpot()).toHaveAccessibilityValue({ text: 'no wager' });
    await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
    await fireEvent.press(betSpot());

    await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));

    // A 7 up is not peeked; the hole card is turned at once and the round settles on its own.
    await screen.findByLabelText('Status Settled automatically');
    expect(announcements).toContain(
      'A fresh shoe is shuffled. Wager 25 in play. You: Queen of hearts. Dealer: 7 of clubs. You: Ace of diamonds. Dealer: a face-down card. ' +
        'The dealer turns over the 2 of spades. You have blackjack; the dealer has 9.',
    );
    // 25 x 3/2 = 37.5; 1,000 - 25 + 62.5 = 1,037.5.
    expect(announcements).toContain('Blackjack! You win 37.5. Balance 1,037.5.');
    expect(screen.getByLabelText('Session balance 1,037.5')).toBeOnTheScreen();
    expect(screen.getByText('Win +37.5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Last hand: Queen of hearts, Ace of diamonds. Blackjack')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Hit' })).toBeNull();
  });

  it('doubles 11 for one card at the whole stake again, announcing the doubled wager', async () => {
    mockAdapters.words = ELEVEN;
    await startSession();
    await betAndDeal('25');
    expect(screen.getByLabelText('Your hand: 2 of hearts, 9 of clubs. 11')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Double' }));

    await screen.findByLabelText('Status Settled automatically');
    expect(announcements).toContain(
      'You double. Wager 50 on the table. You: 8 of hearts. The dealer turns over the Queen of hearts. Dealer: Jack of clubs. ' +
        'You have 19; the dealer has bust 24. Balance 950.',
    );
    expect(announcements).toContain('You win 50. Balance 1,050.');
    expect(screen.getByLabelText('Last hand: 2 of hearts, 9 of clubs, 8 of hearts. 19, doubled')).toBeOnTheScreen();
  });

  it('sets the initial wager from the bet list as well as the table, the same session either way', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    expect(screen.getByRole('header', { name: 'Initial wager · 10 to 1,000' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Initial wager\b/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Initial wager' }));
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '40');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));

    expect(announcements).toContain('Wager 40 on the table. Balance 960.');
    await fireEvent.press(screen.getByRole('tab', { name: 'Table' }));
    expect(betSpot()).toHaveAccessibilityValue({ text: '40 on it' });
    await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
    await screen.findByLabelText('Status Your turn');
    // Mid-hand the only choices are the hand's own; the bet list returns between rounds.
    expect(screen.queryByRole('tab', { name: 'Bet list' })).toBeNull();
  });

  it('offers a rebuy between rounds, counted as funding', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Add / }));

    expect(announcements).toContain('Rebuy 1,000 added. Total funding 2,000. Balance 2,000.');
    expect(screen.getByLabelText('Session balance 2,000')).toBeOnTheScreen();
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

  it('offers insurance against an ace before the peek; it settles on its own and surrender is still offered after it', async () => {
    mockAdapters.words = INSURANCE;
    await startSession();
    await betAndDeal('25', 'Insurance offered');

    expect(screen.getByRole('header', { name: 'Insurance?' })).toBeOnTheScreen();
    expect(announcements.some((text) => text.includes('The dealer shows an ace: insurance up to 12.5 is offered before the dealer checks.'))).toBe(true);
    expect(screen.getByRole('button', { name: 'No insurance' })).toBeEnabled();
    // No playing action before the insurance decision, and nothing names the hole card or the next card.
    expect(screen.queryByRole('button', { name: 'Hit' })).toBeNull();
    expect(everythingSpoken()).not.toMatch(/2 of spades|5 of hearts/);

    await fireEvent.press(screen.getByRole('button', { name: 'Insure 12.5' }));

    await screen.findByLabelText('Status Your turn');
    expect(announcements).toContain('Insurance 12.5 on the table. The dealer checked for blackjack: none. Insurance loses 12.5. Your turn. Balance 962.5.');
    expect(screen.getByText(/Surrendering returns half your bet \(12\.5\)/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Surrender' }));

    await screen.findByLabelText('Status Settled automatically');
    expect(announcements).toContain('You surrender. The dealer turns over the 2 of spades.');
    expect(announcements).toContain('Surrendered: 12.5 of your 25 comes back. Balance 975.');
    expect(screen.getByLabelText('Last hand: 2 of hearts, Jack of diamonds. 12, surrendered')).toBeOnTheScreen();
    expect(screen.getByText('Loss −12.5')).toBeOnTheScreen();
  });

  it('takes a lower insurance amount from the bet list', async () => {
    mockAdapters.words = INSURANCE;
    await startSession();
    await betAndDeal('25', 'Insurance offered');
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    expect(screen.getByRole('header', { name: 'Insurance · up to 12.5' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Insurance\b/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Insurance' }));
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '5');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));

    await screen.findByLabelText('Status Your turn');
    expect(announcements).toContain('Insurance 5 on the table. The dealer checked for blackjack: none. Insurance loses 5. Your turn. Balance 970.');
  });

  it('offers even money on a natural against an ace: the same as insuring it for half', async () => {
    mockAdapters.words = EVEN_MONEY;
    await startSession();
    await betAndDeal('25', 'Even money offered');
    expect(screen.getByRole('header', { name: 'Even money?' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'No, play it out' })).toBeEnabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Take even money (25)' }));

    await screen.findByLabelText('Status Settled automatically');
    // 12.5 insurance loses; the natural pays 37.5: +25 whatever the dealer had.
    expect(announcements).toContain('Blackjack! You win 37.5. Balance 1,025.');
    expect(screen.getByLabelText('Session balance 1,025')).toBeOnTheScreen();
  });

  it('splits a pair into two hands played left to right, the second taking its card when its turn comes', async () => {
    mockAdapters.words = NINES;
    await startSession();
    await betAndDeal();

    await fireEvent.press(screen.getByRole('button', { name: 'Split' }));

    await screen.findByLabelText('Status Your turn · hand 1 of 2');
    expect(announcements).toContain('You split. Wager 25 on hand 2. Hand 1: Queen of spades. Your hands have 19 and 9; the dealer shows 2. Your turn · hand 1 of 2. Balance 950.');
    expect(screen.getByLabelText('Hand 1 of 2: 9 of clubs, Queen of spades. 19, your turn')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hand 2 of 2: 9 of spades. 9, waiting')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 50')).toBeOnTheScreen();
    // The hand's state is in words as well as the highlight.
    expect(within(screen.getByTestId('split-hands')).getByText('Your turn')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Surrender' })).toBeDisabled();
    expect(everythingSpoken()).not.toMatch(/Queen of hearts|5 of spades/);

    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await screen.findByLabelText('Status Your turn · hand 2 of 2');
    expect(announcements).toContain('You stand. Hand 2: Queen of hearts. Your hands have 19 and 19; the dealer shows 2. Your turn · hand 2 of 2.');

    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await screen.findByLabelText('Status Settled automatically');
    expect(announcements).toContain('Hand 1 wins 25. Hand 2 wins 25. Balance 1,050.');
    expect(screen.getByText('Hand 1 win +25 · Hand 2 win +25')).toBeOnTheScreen();
  });

  it('seats other players ahead of you whose cards and plays are shown and announced; only your result moves your balance', async () => {
    mockAdapters.words = PLAYERS;
    await startSession('2 other players');
    await betAndDeal();

    expect(
      announcements.some((text) =>
        text.includes(
          'Seat 1: 6 of diamonds. Seat 2: Ace of diamonds. You: 5 of diamonds. Dealer: 5 of spades. Seat 1: Queen of diamonds. Seat 2: 6 of hearts. ' +
            'You: 5 of diamonds. Dealer: a face-down card. Seat 1 stands. Seat 2 doubles. Seat 2: 6 of diamonds. You have 10; the dealer shows 5. Your turn.',
        ),
      ),
    ).toBe(true);
    const others = within(screen.getByTestId('other-players'));
    expect(others.getByLabelText('Seat 1: 6 of diamonds, Queen of diamonds. 16, done')).toBeOnTheScreen();
    expect(others.getByLabelText('Seat 2: Ace of diamonds, 6 of hearts, 6 of diamonds. 13, doubled')).toBeOnTheScreen();
    expect(everythingSpoken()).not.toMatch(/3 of clubs/);

    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await screen.findByLabelText('Status Settled automatically');
    expect(announcements).toContain('You lose 25. Seat 1 loses 10. Seat 2 loses 20. Balance 975.');
  });

  it('reflows split hands and the insurance decision in a wide window and at the largest text size', async () => {
    const { width, height, fontScale } = Dimensions.get('window');
    try {
      mockAdapters.words = NINES;
      await startSession();
      await betAndDeal();
      await fireEvent.press(screen.getByRole('button', { name: 'Split' }));
      await screen.findByLabelText('Status Your turn · hand 1 of 2');
      for (const [w, h, scale] of [[844, 390, 1], [844, 390, 3.1], [320, 568, 3.1]] as const) {
        await setWindow(w, h, scale);
        // The hands wrap onto more rows instead of overflowing, inside the scrolling table.
        expect(StyleSheet.flatten(screen.getByTestId('split-hands').props.style).flexWrap).toBe('wrap');
        expect(within(screen.getByTestId('table-scroll')).getByLabelText('Hand 2 of 2: 9 of spades. 9, waiting')).toBeOnTheScreen();
      }
      expect(StyleSheet.flatten(screen.getByTestId('table-columns').props.style).flexDirection).toBeUndefined();
      await cleanup();

      mockAdapters.words = INSURANCE;
      await setWindow(320, 568, 3.1);
      await startSession();
      await betAndDeal('25', 'Insurance offered');
      expect(within(screen.getByTestId('table-scroll')).getByTestId('insurance-decision')).toBeOnTheScreen();
      expect(within(screen.getByTestId('insurance-decision')).getByRole('header', { name: 'Insurance?' })).toBeOnTheScreen();
    } finally {
      await setWindow(width, height, fontScale);
    }
  });

  it('gives the insurance decision and split hands touch targets of at least 48 points', async () => {
    mockAdapters.words = INSURANCE;
    await startSession();
    await betAndDeal('25', 'Insurance offered');
    for (const control of within(screen.getByTestId('insurance-decision')).getAllByRole('button')) {
      expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(48);
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

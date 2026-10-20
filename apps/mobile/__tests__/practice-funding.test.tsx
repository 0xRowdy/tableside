// Seam 3: rebuys and the funding lines of the session result (design frames
// S1-08 Rebuy and S1-10 Result), through the real routes on the in-memory
// adapters, driven only through the accessibility tree. Spins come from the
// Random123 "pi digits" stream: 27 (red), then 0, 25.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true) }) };
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

async function startSession(buyIn = '1,000') {
  await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
  await screen.findByRole('header', { name: 'Roulette' });
  await fireEvent.changeText(screen.getByLabelText('Starting chips for this session, in units'), buyIn);
  await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText(`Session balance ${buyIn}`);
}

async function tap(chip: string, target: RegExp, times = 1) {
  await fireEvent.press(screen.getByRole('radio', { name: `${chip} chip` }));
  for (let i = 0; i < times; i++) await fireEvent.press(screen.getByRole('button', { name: target }));
}

async function spin(balanceAfter: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
  await screen.findByLabelText(`Session balance ${balanceAfter}`);
  await waitFor(() => expect(screen.getByLabelText('Status Settled')).toBeOnTheScreen());
}

const amountField = () => screen.getByLabelText('Rebuy amount, in units');

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

describe('practice funding', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('offers a rebuy prefilled with the buy-in and adds it to the session, announcing the new balance', async () => {
    await startSession();

    await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));

    expect(await screen.findByRole('header', { name: 'Rebuy' })).toBeOnTheScreen();
    expect(amountField()).toHaveProp('value', '1,000');
    expect(screen.getByText(/A rebuy isn't a win/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Buy-in 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rebuys so far 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total funding after this 2,000')).toBeOnTheScreen();

    await fireEvent.changeText(amountField(), '500');
    expect(screen.getByLabelText('Total funding after this 1,500')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Add 500 to this session' }));

    expect(await screen.findByLabelText('Session balance 1,500')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Rebuy' })).toBeNull();
    expect(announcements).toContain('Rebuy 500 added. Total funding 1,500. Balance 1,500.');
  });

  it('cancels a rebuy without adding anything', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('header', { name: 'Rebuy' })).toBeNull();
    expect(screen.getByLabelText('Session balance 1,000')).toBeOnTheScreen();
  });

  it('refuses a rebuy past the funding limit, keeps the amount, and lets the player change it to the room left', async () => {
    await startSession('999,997,000');
    await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));
    await fireEvent.changeText(amountField(), '5000');

    await fireEvent.press(screen.getByRole('button', { name: 'Add 5,000 to this session' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That would take total funding past the 1,000,000,000 limit. You can add up to 3,000.',
    );
    expect(amountField()).toHaveProp('value', '5000');
    expect(screen.getByLabelText('Total funding so far 999,997,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Room left 3,000')).toBeOnTheScreen();
    expect(screen.getByText("Winnings don't count toward this limit and are never capped.")).toBeOnTheScreen();
    expect(screen.getByLabelText('Session balance 999,997,000')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Change amount to 3,000' }));
    expect(amountField()).toHaveProp('value', '3,000');
    await fireEvent.press(screen.getByRole('button', { name: 'Add 3,000 to this session' }));
    expect(await screen.findByLabelText('Session balance 1,000,000,000')).toBeOnTheScreen();
  });

  it('points to a rebuy when the balance cannot cover a wager, and never places it for the player', async () => {
    await startSession('20');

    await tap('25', /^Red,/);

    expect(announcements).toContain("Your balance can't cover that. Nothing was placed. You can rebuy to add chips.");
    await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add 20 to this session' }));
    expect(await screen.findByLabelText('Session balance 40')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
  });

  it('shows buy-in, each rebuy, final cash-out, net result and maximum drawdown on the result', async () => {
    // The worked example: 1,000 → 600 → rebuy 1,000 → win 100.
    await startSession();
    await tap('100', /^Black,/, 4);
    await spin('600');
    await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add 1,000 to this session' }));
    await screen.findByLabelText('Session balance 1,600');
    // Straight-up bets are among the bets a number opens on the felt.
    await fireEvent.press(screen.getByRole('button', { name: '0, green' }));
    await tap('1', /^Straight 0,/, 3);
    await fireEvent.press(screen.getByRole('button', { name: '1, red' }));
    await tap('5', /^Straight 1,/);
    await spin('1,700');

    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    await fireEvent.press((await screen.findAllByRole('button', { name: 'End session' })).at(-1)!);

    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Buy-in 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rebuys (1) 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total funding 2,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Final cash-out 1,700')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net result minus 300, Loss')).toBeOnTheScreen();
    expect(screen.getByLabelText('Max drawdown 400, includes final settlement')).toBeOnTheScreen();
    expect(announcements).toContain('Session result. Loss, net result minus 300. Final cash-out 1,700. Max drawdown 400.');
  });

  it('gives every rebuy control a 48-point target and fills the screen at the largest text size', async () => {
    await startSession();
    const { width, height, fontScale } = Dimensions.get('window');
    try {
      await setWindow(390, 844, 1);
      await fireEvent.press(screen.getByRole('button', { name: 'Rebuy' }));
      const sheet = within(await screen.findByTestId('rebuy-sheet'));
      for (const control of [...sheet.getAllByRole('button'), amountField()]) {
        expect(StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(48);
      }
      expect(StyleSheet.flatten(screen.getByTestId('rebuy-sheet').props.style).flexGrow).toBeUndefined();

      await setWindow(390, 844, 3.1);
      expect(StyleSheet.flatten(screen.getByTestId('rebuy-sheet').props.style).flexGrow).toBe(1);
      expect(screen.getByTestId('rebuy-scroll')).toBeOnTheScreen();
    } finally {
      await setWindow(width, height, fontScale);
    }
  });
});

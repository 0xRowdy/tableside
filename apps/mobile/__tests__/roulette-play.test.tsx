// Seam 3: the roulette free-play screens, rendered through the real routes on
// the in-memory adapters and driven only through the accessibility tree.
// Spins come from the Random123 "pi digits" stream: 27 (red), then 0, 25.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import type { substituteAdapters } from '@/practice/testing/substitutes';

// The app runs on the substitute adapters; the latest set is kept for failure injection.
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

async function openRouletteSetup() {
  await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
  await screen.findByRole('header', { name: 'Roulette' });
}

async function startSession() {
  await openRouletteSetup();
  await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText('Session balance 1,000');
}

const spot = (name: RegExp) => screen.getByRole('button', { name });
const chip = (value: string) => screen.getByRole('radio', { name: `${value} chip` });

async function chooseChipAndTap(value: string, target: RegExp) {
  await fireEvent.press(chip(value));
  await fireEvent.press(spot(target));
}

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

describe('roulette free play', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);


  it('opens setup from Home with a default buy-in of 1,000 and the launch limits', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Roulette\b/ }));
    await screen.findByRole('header', { name: 'Roulette' });

    expect(screen.getByLabelText('Starting chips for this session, in units')).toHaveProp('value', '1,000');
    expect(screen.getByText('Inside bets 1–100 units')).toBeOnTheScreen();
    expect(screen.getByText('Outside bets 10–1,000 units')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Play', selected: true })).toBeOnTheScreen();
  });

  it('keeps the draft and explains when the buy-in is not whole units in range', async () => {
    await openRouletteSetup();
    const field = screen.getByLabelText('Starting chips for this session, in units');

    await fireEvent.changeText(field, '12.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter whole units from 1 to 1,000,000,000.');
    expect(field).toHaveProp('value', '12.5');

    await fireEvent.changeText(field, '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter whole units from 1 to 1,000,000,000.');
    expect(screen.queryByLabelText(/^Session balance/)).toBeNull();
  });

  it('shows balance, outstanding wagers and phase on the table, with Settle as a step of the turn', async () => {
    await startSession();

    expect(screen.getByLabelText('Session balance 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Status Betting')).toBeOnTheScreen();
    const steps = within(screen.getByTestId('phase-stepper'));
    expect(steps.getByLabelText('Step 1 of 3, Betting, current')).toBeOnTheScreen();
    expect(steps.getByLabelText('Step 2 of 3, Spin, upcoming')).toBeOnTheScreen();
    expect(steps.getByLabelText('Step 3 of 3, Settle, upcoming')).toBeOnTheScreen();
  });

  it('places red and a straight-up bet by tapping the table, announcing each wager and the balance', async () => {
    await startSession();

    await chooseChipAndTap('25', /^Red, pays 1 to 1$/);
    expect(announcements).toContain('Red 25 on the table. Balance 975.');
    await chooseChipAndTap('5', /^Straight 17, black, pays 35 to 1$/);
    expect(announcements).toContain('Straight 17 5 on the table. Balance 970.');

    expect(spot(/^Red,/)).toHaveAccessibilityValue({ text: '25 on it' });
    expect(spot(/^Straight 17,/)).toHaveAccessibilityValue({ text: '5 on it' });
    expect(screen.getByLabelText('Session balance 970')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 30')).toBeOnTheScreen();
    // A wagered spot is marked by its stake text, not only by its outline color.
    expect(within(spot(/^Red,/)).getByText('25')).toBeOnTheScreen();
  });

  it('explains a stake the engine refuses and leaves the table unchanged', async () => {
    await startSession();

    await chooseChipAndTap('5', /^Red,/);

    expect(announcements).toContain('Red needs at least 10. Nothing was placed.');
    expect(screen.getByTestId('latest-event')).toHaveTextContent('Red needs at least 10. Nothing was placed.');
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
  });

  it('spins, then reveals and settles the committed outcome with no further tap', async () => {
    await startSession();
    await chooseChipAndTap('25', /^Red,/);
    await chooseChipAndTap('5', /^Straight 17,/);
    // Nothing about the coming spin is exposed before it is committed.
    expect(screen.queryByLabelText(/^Last spin/)).toBeNull();
    expect(announcements.join(' ')).not.toMatch(/landed/);

    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));

    expect(await screen.findByLabelText('Last spin: 27 red')).toBeOnTheScreen();
    expect(announcements).toContain('The ball landed on 27 red.');
    await waitFor(() => expect(screen.getByLabelText('Status Settled')).toBeOnTheScreen());
    expect(announcements).toContain('Straight 17 5 loses. Red 25 wins 25. Balance 1,020.');
    expect(screen.getByLabelText('Session balance 1,020')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    const steps = within(screen.getByTestId('phase-stepper'));
    expect(steps.getByLabelText('Step 1 of 3, Betting, done')).toBeOnTheScreen();
    expect(steps.getByLabelText('Step 2 of 3, Spin, done')).toBeOnTheScreen();
    expect(steps.getByLabelText('Step 3 of 3, Settle, current')).toBeOnTheScreen();
  });

  it('announces a failed save, reveals nothing, and reveals the spin once the retry saves it', async () => {
    await startSession();
    await chooseChipAndTap('25', /^Red,/);
    mockAdapters.latest?.store.failNext('commitTransition', 'before');

    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));

    expect(announcements).toContain('Not saved yet. Play is paused.');
    expect(screen.getByRole('alert')).toHaveTextContent(/Not saved yet/);
    expect(screen.queryByLabelText(/^Last spin/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Spin' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Last spin: 27 red')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks the engine before spinning with nothing on the table', async () => {
    await startSession();

    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));

    expect(announcements).toContain('Place a wager before you spin.');
    expect(screen.queryByLabelText(/^Last spin/)).toBeNull();
  });

  it('ends the session after confirming, returning removable wagers, and shows the result', async () => {
    await startSession();
    await chooseChipAndTap('25', /^Red,/);
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await screen.findByLabelText('Session balance 1,025');
    await chooseChipAndTap('5', /^Straight 17,/);

    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    expect(await screen.findByRole('header', { name: 'End this session?' })).toBeOnTheScreen();
    expect(screen.getByLabelText('1. Removable wagers come back. Straight 17 5')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'End session' }).at(-1)!);

    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(announcements).toContain('Ending your session. Straight 17 5 returned to your balance. Balance 1,025.');
    expect(announcements).toContain('Session result. Win, net result plus 25. Final cash-out 1,025.');
    expect(screen.getByLabelText('Buy-in 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rebuys none')).toBeOnTheScreen();
    expect(screen.getByLabelText('Final cash-out 1,025')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net result plus 25, Win')).toBeOnTheScreen();
  });

  it('keeps playing when the end-session dialog is dismissed', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Keep playing' }));

    expect(screen.queryByRole('header', { name: 'End this session?' })).toBeNull();
    expect(screen.getByLabelText('Status Betting')).toBeOnTheScreen();
  });

  it('shows the active session on the Play tab after visiting Home, and setup again after a result', async () => {
    await startSession();
    await chooseChipAndTap('25', /^Red,/);

    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));
    expect(await screen.findByLabelText('Session balance 975')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    await fireEvent.press((await screen.findAllByRole('button', { name: 'End session' })).at(-1)!);
    await fireEvent.press(await screen.findByRole('button', { name: 'New session' }));
    expect(await screen.findByRole('button', { name: 'Start free play' })).toBeOnTheScreen();
  });

  it('gives every table control a touch target of at least 48 points', async () => {
    await startSession();

    const table = within(screen.getByTestId('table-scroll'));
    const controls = [...table.getAllByRole('button'), ...table.getAllByRole('radio')];
    expect(controls.length).toBeGreaterThan(40);
    for (const control of controls) {
      const style = StyleSheet.flatten(control.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      if (style.alignSelf !== 'stretch' && style.flex === undefined) expect(style.minWidth ?? 48).toBeGreaterThanOrEqual(48);
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
      expect(screen.getByTestId('table-scroll')).toBeOnTheScreen();
    } finally {
      await setWindow(width, height, fontScale);
    }
  });
});

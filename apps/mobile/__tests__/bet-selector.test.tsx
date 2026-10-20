// Seam 3: the bet selector and wager editor on the roulette table, rendered
// through the real routes on the in-memory adapters and driven only through
// the accessibility tree. Spins come from the Random123 "pi digits" stream:
// 27 (red) first.

import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import type { substituteAdapters } from '@/practice/testing/substitutes';

// The app runs on the substitute adapters. The clock runs on its own unless a
// test holds it to keep a spin's committed wagers on screen.
const mockAdapters: { latest: ReturnType<typeof substituteAdapters> | null; autoClock: boolean } = { latest: null, autoClock: true };
jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => (mockAdapters.latest = create({ clock: new FakeClock(undefined, mockAdapters.autoClock) })) };
});

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
  mockAdapters.autoClock = true;
});

async function startSession() {
  await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText('Session balance 1,000');
}

/** The committed checkpoint and stored sequence, as the store holds them. */
async function storedSession() {
  const stored = await mockAdapters.latest?.store.load('activity-1');
  return { checkpoint: stored?.checkpoint, sequence: stored?.sequence };
}

const openBetList = () => fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
const openTable = () => fireEvent.press(screen.getByRole('tab', { name: 'Table' }));
const kind = (name: RegExp) => screen.getByRole('button', { name });
const choice = (name: string) => screen.getByRole('radio', { name });
const stakeField = () => screen.getByLabelText(/^Total stake for /);
const setButton = () => screen.getByRole('button', { name: /^Set / });

/** Chooses a wager and its numbers in the bet list and types a total stake, without setting it. */
async function draftWager(kindName: RegExp, choiceName: string, stake: string) {
  // An open editor goes back to the list first.
  const back = screen.queryByRole('button', { name: 'All wagers' });
  if (back) await fireEvent.press(back);
  await fireEvent.press(kind(kindName));
  await fireEvent.press(choice(choiceName));
  await fireEvent.changeText(stakeField(), stake);
}

async function setWager(kindName: RegExp, choiceName: string, stake: string) {
  await draftWager(kindName, choiceName, stake);
  await fireEvent.press(setButton());
}

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

describe('bet selector', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('produces the same session as the equivalent table taps', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Red,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: '5 chip' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Straight 17,/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await screen.findByLabelText('Session balance 1,020');
    const byTable = await storedSession();
    await cleanup();

    await startSession();
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '25');
    await setWager(/^Straight up\b/, 'Straight 17', '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await screen.findByLabelText('Session balance 1,020');
    const bySelector = await storedSession();

    expect(bySelector.sequence).toBe(4);
    expect(bySelector).toEqual(byTable);
  });

  it('lists every wager by name, grouped with its limits and payout', async () => {
    await startSession();
    await openBetList();

    expect(screen.getByRole('header', { name: 'Inside bets · 1 to 100' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Outside bets · 10 to 1,000' })).toBeOnTheScreen();
    expect(kind(/^Straight up, 1 number · pays 35:1$/)).toHaveAccessibilityValue({ text: 'no wager' });
    expect(kind(/^Red or black, Pays 1:1 · loses on 0$/)).toBeOnTheScreen();
  });

  it('opens an editor when a wager is selected, without placing anything', async () => {
    await startSession();
    await openBetList();

    await fireEvent.press(kind(/^Straight up\b/));
    expect(screen.getByRole('header', { name: 'Straight up' })).toBeOnTheScreen();
    await fireEvent.press(choice('Straight 17'));

    expect(choice('Straight 17')).toBeChecked();
    expect(announcements).toContain('Selected Straight 17. Nothing placed.');
    expect(stakeField()).toHaveProp('value', '1');
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    expect((await storedSession()).sequence).toBe(0);
  });

  it('sets the total stake explicitly rather than adding to it', async () => {
    await startSession();
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '25');
    expect(announcements).toContain('Red 25 on the table. Balance 975.');

    await fireEvent.changeText(stakeField(), '40');
    expect(setButton()).toBeEnabled();
    expect(setButton()).toHaveTextContent('Set Red to 40');
    await fireEvent.press(setButton());

    expect(screen.getByLabelText('On table 40')).toBeOnTheScreen();
    expect(screen.getByLabelText('Session balance 960')).toBeOnTheScreen();
    expect(announcements).toContain('Red 40 on the table. Balance 960.');
  });

  it('offers plus and minus buttons as an alternative to typing a stake', async () => {
    await startSession();
    await openBetList();
    await draftWager(/^Red or black\b/, 'Black', '10');

    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase by 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Decrease by 1' }));

    expect(stakeField()).toHaveProp('value', '11');
  });

  it.each([
    ['a fraction of a unit', '2.5', 'Use whole units, from 1 to 100. Your draft is kept and nothing on the table changed.'],
    ['over the table maximum', '150', "Over this table's maximum. Straight 17 can be at most 100. Your draft is kept."],
    ['something that is not a number', '12x', 'Enter the total stake as a number of units, from 1 to 100. Your draft is kept.'],
  ])('explains a stake that is %s and keeps the draft and existing wagers', async (_case, stake, explanation) => {
    await startSession();
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '25');

    await setWager(/^Straight up\b/, 'Straight 17', stake);

    expect(screen.getByRole('alert')).toHaveTextContent(explanation);
    expect(stakeField()).toHaveProp('value', stake);
    expect(choice('Straight 17')).toBeChecked();
    expect(screen.getByLabelText('On table 25')).toBeOnTheScreen();
    expect(screen.getByLabelText('Red, 25, removable')).toBeOnTheScreen();
  });

  it('explains a stake the balance cannot cover, saying how much it can', async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
    await fireEvent.changeText(await screen.findByLabelText('Starting chips for this session, in units'), '60');
    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
    await screen.findByLabelText('Session balance 60');
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '20');

    await setWager(/^Straight up\b/, 'Straight 17', '45');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'More than you have. With a balance of 40 you can set up to 40. Your draft is kept.',
    );
    expect(stakeField()).toHaveProp('value', '45');
    expect(screen.getByLabelText('On table 20')).toBeOnTheScreen();
  });

  it('clears the explanation once the draft is edited', async () => {
    await startSession();
    await openBetList();
    await setWager(/^Straight up\b/, 'Straight 17', '150');
    expect(screen.getByRole('alert')).toBeOnTheScreen();

    await fireEvent.changeText(stakeField(), '15');

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the unsubmitted draft through switching to the table and back', async () => {
    await startSession();
    await openBetList();
    await draftWager(/^Straight up\b/, 'Straight 17', '24');

    await openTable();
    expect(screen.getByLabelText('Draft, Straight 17, 24, not placed')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit in bet list' }));

    expect(choice('Straight 17')).toBeChecked();
    expect(stakeField()).toHaveProp('value', '24');
    expect(screen.getByRole('tab', { name: 'Bet list', selected: true })).toBeOnTheScreen();
  });

  it('keeps the unsubmitted draft through rotation, window resizing and the largest text', async () => {
    await startSession();
    await openBetList();
    await draftWager(/^Straight up\b/, 'Straight 17', '24');
    const { width, height, fontScale } = Dimensions.get('window');
    try {
      await setWindow(844, 390);
      await setWindow(1024, 700, 3.1);
      await setWindow(320, 700, 3.1);
      expect(stakeField()).toHaveProp('value', '24');
      expect(choice('Straight 17')).toBeChecked();
      expect(screen.getByText('Draft · not placed yet. It stays if you rotate, resize or switch to the table.')).toBeOnTheScreen();
    } finally {
      await setWindow(width, height, fontScale);
    }
  });

  it('loads an existing wager when it is selected', async () => {
    await startSession();
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '25');
    await setWager(/^Straight up\b/, 'Straight 17', '5');

    const wagers = within(screen.getByTestId('your-wagers'));
    await fireEvent.press(wagers.getByRole('button', { name: 'Edit Red' }));

    expect(screen.getByRole('header', { name: 'Red or black' })).toBeOnTheScreen();
    expect(choice('Red')).toBeChecked();
    expect(stakeField()).toHaveProp('value', '25');
  });

  it('removes a wager, returning its stake, and moves focus to the wager list', async () => {
    const focusEvents = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    await startSession();
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '25');
    focusEvents.mockClear();

    await fireEvent.press(within(screen.getByTestId('your-wagers')).getByRole('button', { name: 'Remove Red' }));

    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Session balance 1,000')).toBeOnTheScreen();
    expect(announcements).toContain('Red taken down. Balance 1,000.');
    expect(screen.getByText('No wagers yet. Choose one above, set its stake, then spin.')).toBeOnTheScreen();
    expect(focusEvents).toHaveBeenCalledWith(expect.anything(), 'focus');
    const focused = focusEvents.mock.calls.at(-1)?.[0] as unknown as { props?: { testID?: string } };
    expect(focused?.props?.testID).toBe('your-wagers-heading');
  });

  it('explains committed wagers while a spin is in progress instead of offering to change them', async () => {
    mockAdapters.autoClock = false;
    await startSession();
    await openBetList();
    await setWager(/^Red or black\b/, 'Red', '25');

    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await screen.findByLabelText('Status Spinning');

    const wagers = within(screen.getByTestId('your-wagers'));
    expect(wagers.getByLabelText('Red, 25, committed')).toBeOnTheScreen();
    expect(wagers.queryByRole('button', { name: 'Remove Red' })).toBeNull();
    await fireEvent.press(wagers.getByRole('button', { name: "Why can't I change Red?" }));
    expect(wagers.getByText('Committed to this spin until it settles. It can’t be changed or taken down.')).toBeOnTheScreen();
  });

  it('gives every selector control a touch target of at least 48 points and a non-color selection cue', async () => {
    await startSession();
    await openBetList();
    await draftWager(/^Straight up\b/, 'Straight 17', '5');

    const selector = within(screen.getByTestId('bet-selector'));
    const controls = [...selector.getAllByRole('button'), ...selector.getAllByRole('radio'), screen.getByRole('tab', { name: 'Table' }), screen.getByRole('tab', { name: 'Bet list' })];
    expect(controls.length).toBeGreaterThan(40);
    for (const control of controls) {
      const style = StyleSheet.flatten(control.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    expect(within(choice('Straight 17')).getByText('✓')).toBeOnTheScreen();
  });
});

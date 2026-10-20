// Seam 3: guided craps practice with the built-in strategies, rendered through
// the real routes on the in-memory adapters and driven only through the
// accessibility tree. Dice come from the all-zero Random123 stream (engine
// craps-strategy cases): totals 8 8 9 6 11 5 3 5 2 6 7 ...

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true), words: [0, 0, 0, 0] }) };
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

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const announced = (text: string) => expect(announcements.some((message) => message.includes(text))).toBe(true);

async function startGuided(strategy: string, flatMax?: string) {
  await renderRouter('./src/app', { initialUrl: '/play?game=craps' });
  await screen.findByRole('header', { name: 'Craps' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
  await fireEvent.press(screen.getByRole('radio', { name: strategy }));
  if (flatMax) await fireEvent.changeText(screen.getByLabelText('Pass, come, place, buy, lay, field maximum, in units'), flatMax);
  await fireEvent.press(screen.getByRole('button', { name: 'Start guided practice' }));
  await screen.findByLabelText('Session balance 1,000');
}

/** Sets one wager's total stake in the bet list. */
async function setBet(kind: RegExp, target: string, amount: string) {
  await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
  const back = screen.queryByRole('button', { name: 'All wagers' });
  if (back) await fireEvent.press(back);
  await fireEvent.press(screen.getByRole('button', { name: kind }));
  await fireEvent.press(screen.getByRole('radio', { name: target }));
  await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), amount);
  await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
}

/** Rolls and waits for the automatic settle; a departing move stops at the correction instead. */
async function roll() {
  const sequence = announcements.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Roll' }));
  await waitFor(() => expect(announcements.slice(sequence).some((message) => /Rolled|Strategy check/.test(message))).toBe(true));
  if (screen.queryByTestId('correction-panel')) return;
  await waitFor(() => expect(screen.getByRole('button', { name: 'Roll' })).toBeEnabled());
}

/** Every label, hint and text on screen, for information-hiding checks. */
function everything(): string {
  const texts: string[] = [];
  const visit = (node: unknown) => {
    if (typeof node === 'string') texts.push(node);
    if (!node || typeof node !== 'object') return;
    const { props, children } = node as { props?: Record<string, unknown>; children?: unknown[] };
    for (const key of ['accessibilityLabel', 'accessibilityHint', 'accessibilityValue']) if (props?.[key]) texts.push(JSON.stringify(props[key]));
    for (const child of children ?? []) visit(child);
  };
  visit(screen.toJSON());
  return [...texts, ...announcements].join('\n');
}

describe('guided craps practice', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(() => setWindow(390, 844, 1));

  it('offers the five craps built-ins and My strategies before the start', async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=craps' });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Guided practice' }));
    const strategies = within(screen.getByLabelText('Strategy'));
    expect(strategies.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual([
      'Pass with odds',
      'Flat place 6 and 8',
      "Don't pass with lay odds",
      'Three-point Molly',
      'Press-and-collect 6 and 8',
    ]);
    expect(strategies.getByRole('radio', { name: 'Pass with odds', checked: true })).toHaveProp('accessibilityHint', 'Pass 10, then 10 odds once a point is set.');
    expect(screen.getByRole('header', { name: 'MY STRATEGIES' })).toBeOnTheScreen();
    for (const radio of strategies.getAllByRole('radio')) expect(StyleSheet.flatten(radio.props.style)).toMatchObject({ minHeight: 48, minWidth: 48 });

    // A table the strategy doesn't fit is refused, naming the requirement; amounts are never changed.
    await fireEvent.press(screen.getByRole('radio', { name: 'Flat place 6 and 8' }));
    await fireEvent.changeText(screen.getByLabelText('Pass, come, place, buy, lay, field minimum, in units'), '15');
    expect(within(screen.getByTestId('strategy-incompatible')).getByText(/Flat place 6 and 8 bets 12 on Place 6\. This table's minimum for that bet is 15/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start guided practice' })).toBeDisabled();
  });

  it('holds a departing bet before the roll and restates the table at the largest text size', async () => {
    await startGuided('Pass with odds');
    expect(screen.getByText('Guided · Pass with odds · cycle 1')).toBeOnTheScreen();
    await setBet(/^Pass line and/, 'Pass line', '10');
    // The pass line 10, then 8 sets the point.
    await roll();
    announced('The point is 8. Puck ON.');

    // 30 odds instead of 10: the move waits, nothing is rolled.
    const rolled = announcements.filter((message) => /Rolled/.test(message)).length;
    await setBet(/^Odds\b/, 'Pass line odds', '30');
    await setWindow(390, 844, 2);
    await roll();
    announced('Strategy check before your roll. Nothing has been placed yet.');
    expect(announcements.filter((message) => /Rolled/.test(message)).length).toBe(rolled);

    const panel = within(screen.getByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'The table right now' })).toBeOnTheScreen();
    expect(panel.getByText('Phase: Strategy check before your roll · Puck ON · point 8')).toBeOnTheScreen();
    expect(panel.getByText('On the table: Pass line 10 · Pass line odds 30')).toBeOnTheScreen();
    expect(panel.getByText('Pass with odds bets 10 on Pass line and 10 on Pass line odds.')).toBeOnTheScreen();
    expect(panel.getByText('The point is 8.')).toBeOnTheScreen();
    expect(panel.getByText("You've set 10 on Pass line and 30 on Pass line odds. Nothing has been placed yet.")).toBeOnTheScreen();
    expect(panel.getByText(/the strategy cycle ends, and you restart the strategy yourself/)).toBeOnTheScreen();
    // The next roll isn't known yet, so nothing on screen can say it.
    expect(everything()).not.toMatch(/Rolled \d and \d: 8\.[\s\S]*Rolled/);

    await fireEvent.press(panel.getByRole('button', { name: 'Take it back & bet 10 on Pass line and 10 on Pass line odds' }));
    await waitFor(() => expect(screen.queryByTestId('correction-panel')).toBeNull());
    announced('Departure recorded: you took it back.');
    expect(screen.getByLabelText('Pass line odds 10, ON, removable')).toBeOnTheScreen();
  });

  it('a blocked press keeps the paid win and waits; Collect instead ends the cycle and takes the place bets down', async () => {
    await startGuided('Press-and-collect 6 and 8', '20');
    await roll(); // 8 with nothing at stake: the strategy waits for a point
    announced('The point is 8. Puck ON.');
    expect(screen.getByLabelText(/Strategy adherence: Followed 1 of 1 roll\./)).toBeOnTheScreen();

    // One place bet of the player's own: the strategy check sets both at 12.
    await setBet(/^Place,/, 'Place 6', '12');
    await roll();
    await fireEvent.press(within(screen.getByTestId('correction-panel')).getByRole('button', { name: 'Take it back & bet 12 on Place 6 and 12 on Place 8' }));
    await waitFor(() => expect(screen.queryByTestId('correction-panel')).toBeNull());

    // 8 9 6 11 5 3 5 2 6: the second place 6 hit pays 14, and its press to 24 is over the 20 maximum.
    for (let i = 0; i < 9; i++) await roll();
    announced('Place 6 12 wins 14. It stays up.');
    announced('Strategy paused: its next bets are outside the table limits. No new strategy bets.');
    expect(screen.getByLabelText('Session balance 1,018')).toBeOnTheScreen();
    const pending = within(screen.getByTestId('pending-panel'));
    expect(pending.getByText('Roll 10 is settled and stays paid. Nothing is paid again.')).toBeOnTheScreen();
    expect(pending.getByRole('header', { name: 'Waiting: 24 on Place 6' })).toBeOnTheScreen();
    expect(pending.getByText('Blocked: outside the table limits')).toBeOnTheScreen();
    const collect = pending.getByRole('button', { name: 'Collect instead and end the cycle' });
    expect(StyleSheet.flatten(collect.props.style)).toMatchObject({ minHeight: 48 });

    await fireEvent.press(collect);
    await waitFor(() => expect(screen.getByTestId('cycle-panel')).toBeOnTheScreen());
    announced('You collected instead. The strategy cycle ended.');
    announced('Place 6 12 returned to your balance.');
    const cycle = within(screen.getByTestId('cycle-panel'));
    expect(cycle.getByRole('header', { name: 'Cycle ended: you chose Collect instead' })).toBeOnTheScreen();
    expect(cycle.getByLabelText('Balance now 1,042. No chips added')).toBeOnTheScreen();
    expect(cycle.getByLabelText(/^Roll 1 · nothing at stake\. Even · rolled \d and \d, total 8/)).toBeOnTheScreen();
    expect(cycle.getByRole('button', { name: 'Start another cycle with 1,042' })).toBeEnabled();
    expect(screen.getByLabelText('On table 0')).toBeOnTheScreen();
  });

  it('Stop strategy says a committed pass line is never refunded', async () => {
    await startGuided('Pass with odds');
    await setBet(/^Pass line and/, 'Pass line', '10');
    await roll(); // 8: the point
    await fireEvent.press(screen.getByRole('button', { name: 'Stop strategy' }));
    expect(screen.getByLabelText(/^3\. Committed wagers settle automatically\. Pass line 10 can't be taken down or refunded/)).toBeOnTheScreen();
    // The dialog's own button comes after the strip's.
    const buttons = screen.getAllByRole('button', { name: 'Stop strategy' });
    await fireEvent.press(buttons[buttons.length - 1] as (typeof buttons)[number]);
    await waitFor(() => expect(screen.getByText('Strategy stopped · playing on your own')).toBeOnTheScreen());
    expect(screen.getByLabelText('Pass line 10, ON, committed')).toBeOnTheScreen();
  });
});

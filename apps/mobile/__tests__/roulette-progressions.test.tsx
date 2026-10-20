// Seam 3: roulette progressions and strategy cycles (design frames S1-06
// pending strategy action, S1-07 cycle result), through the real routes on the
// in-memory adapters, driven only through the accessibility tree. Spins come
// from the all-zero Random123 stream: 0, 7, 3, 36, 14, 3, 34 on single zero
// (7, 3, 36, 14 and 34 are red), so black loses every one of them.

import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions } from 'react-native';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => create({ clock: new FakeClock(undefined, true), words: [0, 0, 0, 0] }) };
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

async function startGuided(strategy: string, target: string, buyIn?: string) {
  await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
  await screen.findByRole('header', { name: 'Roulette' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
  await fireEvent.press(screen.getByRole('radio', { name: strategy }));
  await fireEvent.press(within(screen.getByLabelText('Target')).getByRole('radio', { name: target }));
  if (buyIn) await fireEvent.changeText(screen.getByLabelText('Starting chips for this session, in units'), buyIn);
  await fireEvent.press(screen.getByRole('button', { name: 'Start guided practice' }));
  await screen.findByLabelText(`Session balance ${buyIn ?? '1,000'}`);
}

/** Sets the total stake on Black in the bet list, then spins. */
async function spinBlack(stake: number) {
  const list = screen.queryByRole('tab', { name: 'Bet list', selected: false });
  if (list) await fireEvent.press(list);
  const back = screen.queryByRole('button', { name: 'All wagers' });
  if (back) await fireEvent.press(back);
  await fireEvent.press(screen.getByRole('button', { name: /^Red or black/ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Black' }));
  await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), String(stake));
  await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
  const turn = announcements.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
  await screen.findByLabelText(/^Last spin:/);
  // The spin settled (it was not held in a correction).
  expect(announcements.slice(turn).join(' ')).toMatch(/Black [\d,]+ (wins|loses)/);
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

describe('roulette progressions', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(() => setWindow(390, 844, 1));

  it('offers the three progressions with their targets before the start', async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Guided practice' }));
    for (const name of ['Capped Martingale', 'Three-win parlay', 'Bounded Labouchere']) expect(screen.getByRole('radio', { name })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Capped Martingale' }));
    expect(within(screen.getByLabelText('Target')).getByRole('radio', { name: 'Red', checked: true })).toBeOnTheScreen();
  });

  it('a Martingale exhausted at its cap shows the cycle result; another cycle starts only explicitly, with no refill', async () => {
    await startGuided('Capped Martingale', 'Black');
    for (const stake of [10, 20, 40, 80, 160]) {
      await spinBlack(stake);
      // The next stake stays the player's to work out: it never appears before they bet.
      expect(everything()).not.toMatch(new RegExp(`\\b${stake * 2} on Black`));
    }
    await spinBlack(320);

    const panel = within(await screen.findByTestId('cycle-panel'));
    expect(panel.getByText('Capped Martingale · cycle 1')).toBeOnTheScreen();
    expect(panel.getByRole('header', { name: "This cycle ended at the strategy's cap" })).toBeOnTheScreen();
    expect(panel.getByText("The next stake would be 640 on Black, past the strategy's cap of 320, so no new bet was placed.")).toBeOnTheScreen();
    expect(panel.getByLabelText('Cycle result minus 630, Loss')).toBeOnTheScreen();
    expect(panel.getByLabelText('Balance now 370. No chips added')).toBeOnTheScreen();
    expect(panel.getByLabelText('Spin 1 · 10 on Black. Lost · 0 green. minus 10')).toBeOnTheScreen();
    expect(panel.getByLabelText('Spin 6 · 320 on Black. Lost · 3 red. minus 320')).toBeOnTheScreen();
    expect(announcements.join(' ')).toMatch(/The strategy cycle ended at its cap\./);
    expect(screen.getByLabelText('Status Cycle ended')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Spin' })).toBeDisabled();

    // Rotating keeps the result: it lives in the committed state.
    await setWindow(844, 390);
    expect(within(screen.getByTestId('cycle-panel')).getByLabelText('Cycle result minus 630, Loss')).toBeOnTheScreen();

    await fireEvent.press(panel.getByRole('button', { name: 'Start another cycle with 370' }));
    expect(await screen.findByText('Guided · Capped Martingale · Black · cycle 2')).toBeOnTheScreen();
    expect(screen.queryByTestId('cycle-panel')).toBeNull();
    expect(screen.getByLabelText('Session balance 370')).toBeOnTheScreen();
    expect(announcements).toContain('Strategy restarted with your current balance.');
  });

  it('a stake the balance can\'t cover stops new bets, offering rebuy, an override or Stop strategy; a rebuy places nothing', async () => {
    await startGuided('Capped Martingale', 'Black', '50');
    await spinBlack(10);
    await spinBlack(20);

    const panel = within(await screen.findByTestId('pending-panel'));
    expect(panel.getByText('Capped Martingale · cycle 1')).toBeOnTheScreen();
    expect(panel.getByText('Waiting: 40 on Black')).toBeOnTheScreen();
    expect(panel.getByText('Blocked: not enough chips (20 of 40)')).toBeOnTheScreen();
    expect(panel.getByText(/Tableside never makes a stake smaller/)).toBeOnTheScreen();
    expect(panel.getByText(/An override ends this cycle/)).toBeOnTheScreen();
    expect(panel.getByRole('button', { name: 'Place my own bets (override)' })).toBeEnabled();
    expect(panel.getByRole('button', { name: 'Stop strategy' })).toBeOnTheScreen();

    await fireEvent.press(panel.getByRole('button', { name: 'Resolve: rebuy' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Add 50 to this session' }));
    expect(await screen.findByLabelText('Session balance 70')).toBeOnTheScreen();
    expect(announcements.join(' ')).toMatch(/Rebuy 50 added\. Total funding 100\. The strategy can place its next bet again\./);
    expect(screen.queryByTestId('pending-panel')).toBeNull();
    // The rebuy didn't bet for the player.
    expect(screen.getByText('No wagers yet')).toBeOnTheScreen();
  });

  it('at the largest text the cycle result reflows and keeps its actions', async () => {
    await startGuided('Three-win parlay', 'Black');
    await setWindow(390, 844, 3.1);
    // 0 loses: a parlay loss completes the cycle.
    await spinBlack(10);
    const panel = within(await screen.findByTestId('cycle-panel'));
    expect(panel.getByRole('header', { name: 'Cycle complete' })).toBeOnTheScreen();
    expect(panel.getByLabelText('Cycle result minus 10, Loss')).toBeOnTheScreen();
    expect(panel.getByRole('button', { name: 'Start another cycle with 990' })).toHaveStyle({ minHeight: 48 });
    expect(panel.getByRole('button', { name: 'End session' })).toBeOnTheScreen();
  });
});

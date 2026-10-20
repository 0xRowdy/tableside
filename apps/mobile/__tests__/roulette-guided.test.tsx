// Seam 3: guided roulette practice, rendered through the real routes on the
// in-memory adapters and driven only through the accessibility tree. Spins
// come from the Random123 "pi digits" stream: 27 (red), then 0, 25 (red).

import { ROULETTE_PRESETS } from '@tableside/definitions';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '@/feedback/FeedbackProvider';
import { RouletteSetup } from '@/play/RouletteSetup';
import { PracticeProvider } from '@/practice/PracticeProvider';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => create({ clock: new FakeClock(undefined, true) }) };
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

async function startGuided(strategy = 'Flat even-money', target?: string) {
  await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
  await screen.findByRole('header', { name: 'Roulette' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
  await fireEvent.press(screen.getByRole('radio', { name: strategy }));
  if (target) await fireEvent.press(within(screen.getByLabelText('Target')).getByRole('radio', { name: target }));
  await fireEvent.press(screen.getByRole('button', { name: 'Start guided practice' }));
  await screen.findByLabelText('Session balance 1,000');
}

const spot = (name: RegExp) => screen.getByRole('button', { name });

async function bet(value: string, target: RegExp) {
  await fireEvent.press(screen.getByRole('radio', { name: `${value} chip` }));
  await fireEvent.press(spot(target));
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

describe('guided roulette practice', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(() => setWindow(390, 844, 1));

  it('offers the built-in strategies, their targets and My strategies before the start', async () => {
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Guided practice' }));
    expect(screen.getByRole('radio', { name: 'Flat even-money', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Fixed two-dozen coverage' })).toBeOnTheScreen();
    const targets = within(screen.getByLabelText('Target'));
    expect(targets.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(['Red', 'Black', 'Odd', 'Even', '1 to 18', '19 to 36']);
    expect(targets.getByRole('radio', { name: 'Red', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'MY STRATEGIES' })).toBeOnTheScreen();
    expect(screen.getByText('Strategies you save in the builder appear here.')).toBeOnTheScreen();

    // Two dozens: two different dozens, 1st and 2nd by default; the taken one can't be chosen twice.
    await fireEvent.press(screen.getByRole('radio', { name: 'Fixed two-dozen coverage' }));
    expect(within(screen.getByLabelText('First dozen')).getByRole('radio', { name: '1st dozen', checked: true })).toBeOnTheScreen();
    const second = within(screen.getByLabelText('Second dozen'));
    expect(second.getByRole('radio', { name: '2nd dozen', checked: true })).toBeOnTheScreen();
    expect(second.getByRole('radio', { name: '1st dozen' })).toBeDisabled();
    await fireEvent.press(second.getByRole('radio', { name: '3rd dozen' }));
    expect(second.getByRole('radio', { name: '3rd dozen', checked: true })).toBeOnTheScreen();
  });

  it('shows the strategy and its adherence apart from the balance, and never the next prescription', async () => {
    await startGuided('Flat even-money', 'Black');
    expect(screen.getByText('Guided · Flat even-money · Black')).toBeOnTheScreen();
    expect(screen.getByLabelText('Strategy adherence: No strategy spins yet. Departures 0.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Session balance 1,000')).toBeOnTheScreen();
    expect(everything()).not.toMatch(/bets 10|10 on Black/);
  });

  it('pauses a departing spin before it executes, explains it from the facts, and records a retry once', async () => {
    await startGuided('Flat even-money', 'Black');
    await bet('25', /^Red, pays 1 to 1$/);
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));

    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'Before your spin' })).toBeOnTheScreen();
    expect(panel.getByText('Flat even-money bets 10 on Black.')).toBeOnTheScreen();
    expect(panel.getByText('Matching instruction: "1 unit on your even-money target, every spin".')).toBeOnTheScreen();
    expect(panel.getByText("You've set 25 on Red. Nothing has been placed yet.")).toBeOnTheScreen();
    expect(panel.getByText('Available for this spin: 1,000.')).toBeOnTheScreen();
    expect(announcements).toContain('Strategy check before your spin. Nothing has been placed yet.');
    // Nothing spun: no outcome was announced, and the stake is still the player's.
    expect(announcements.join(' ')).not.toMatch(/ball landed/);
    expect(screen.getByLabelText('Status Strategy check')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Spin' })).toBeDisabled();
    // Rotating keeps the held correction: it lives in the committed state, not the layout.
    await setWindow(844, 390);
    expect(within(screen.getByTestId('correction-panel')).getByText('Flat even-money bets 10 on Black.')).toBeOnTheScreen();

    await fireEvent.press(within(screen.getByTestId('correction-panel')).getByRole('button', { name: 'Take it back & bet 10 on Black' }));
    expect(announcements).toContain('Departure recorded: you took it back. Red taken down. Black 10 on the table. Balance 990.');
    expect(screen.queryByTestId('correction-panel')).toBeNull();
    expect(spot(/^Black,/)).toHaveAccessibilityValue({ text: '10 on it' });
    expect(screen.getByLabelText('Strategy adherence: No strategy spins yet. Departures 1.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    expect(await screen.findByLabelText('Strategy adherence: Followed 0 of 1 spin. Departures 1.')).toBeOnTheScreen();
    expect(announcements).toContain('The ball landed on 27 red.');
  });

  it('an override spins the player\'s bet, is recorded once, and coaching goes on', async () => {
    await startGuided();
    await bet('25', /^Red, pays 1 to 1$/);
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await fireEvent.press(within(await screen.findByTestId('correction-panel')).getByRole('button', { name: 'Keep my bets' }));

    expect(await screen.findByLabelText('Session balance 1,025')).toBeOnTheScreen();
    expect(announcements).toContain('Departure recorded: you overrode the strategy. The ball landed on 27 red.');
    expect(screen.getByLabelText('Strategy adherence: Followed 0 of 1 spin. Departures 1.')).toBeOnTheScreen();
    expect(screen.queryByTestId('cycle-panel')).toBeNull();
    expect(screen.getByRole('button', { name: 'Spin' })).toBeOnTheScreen();
  });

  it('Stop strategy asks first, returns removable wagers and keeps the session open', async () => {
    await startGuided();
    await bet('25', /^Red, pays 1 to 1$/);
    await fireEvent.press(screen.getByRole('button', { name: 'Stop strategy' }));
    expect(screen.getByRole('header', { name: 'Stop the strategy?' })).toBeOnTheScreen();
    expect(screen.getByLabelText('2. Removable wagers come back. Red 25')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Stop strategy' }).at(-1) as never);
    expect(await screen.findByText('Strategy stopped · playing on your own')).toBeOnTheScreen();
    expect(announcements).toContain('Strategy stopped. You play on your own now. Red 25 returned to your balance. Balance 1,000.');
    expect(screen.getByLabelText('Session balance 1,000')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Stop strategy' })).toBeNull();
  });

  it('at the largest text the correction is a full-screen panel restating the phase, balance and wagers', async () => {
    await startGuided();
    await bet('25', /^Red, pays 1 to 1$/);
    await setWindow(390, 844, 3.1);
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'The table right now' })).toBeOnTheScreen();
    expect(panel.getByText('Phase: Strategy check before your spin')).toBeOnTheScreen();
    expect(panel.getByText('Balance: 975')).toBeOnTheScreen();
    expect(panel.getByText('On the table: Red 25')).toBeOnTheScreen();
    expect(panel.getByRole('button', { name: 'Take it back & bet 10 on Red' })).toBeOnTheScreen();
  });

  it('the result shows adherence and Departures apart from the money', async () => {
    await startGuided();
    await bet('25', /^Red, pays 1 to 1$/);
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await fireEvent.press(within(await screen.findByTestId('correction-panel')).getByRole('button', { name: 'Take it back & bet 10 on Red' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));
    await screen.findByLabelText('Strategy adherence: Followed 0 of 1 spin. Departures 1.');
    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'End session' }).at(-1) as never);
    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Betting decisions: 0 of 1 followed, 0%')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Departures, 1' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Spin 1. Strategy: 10 on Red. You: 25 on Red. Retried.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net result plus 10, Win')).toBeOnTheScreen();
  });
});

describe('an incompatible strategy and table', () => {
  it('is refused naming the requirement, with "Customize a copy for this table" as a third choice', async () => {
    const strict = { ...ROULETTE_PRESETS, 'single-zero': { ...ROULETTE_PRESETS['single-zero'], limits: { inside: { min: '1', max: '100' }, outside: { min: '25', max: '1000' } } } };
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <PracticeProvider>
          <FeedbackProvider>
            <RouletteSetup problem={null} busy={false} presets={strict} />
          </FeedbackProvider>
        </PracticeProvider>
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
    expect(screen.getByRole('alert')).toHaveTextContent("This strategy doesn't fit your table");
    expect(screen.getByText("Flat even-money bets 10 on Red. This table's minimum for that bet is 25, so a 10 bet isn't allowed.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start guided practice' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Customize a copy for this table' }));
    expect(screen.getByText(/The strategy builder arrives in a later update/)).toBeOnTheScreen();
    // Choosing the compatible wheel clears it.
    await fireEvent.press(screen.getByRole('radio', { name: 'Double zero (0, 00)' }));
    expect(screen.queryByTestId('strategy-incompatible')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start guided practice' })).toBeEnabled();
  });
});

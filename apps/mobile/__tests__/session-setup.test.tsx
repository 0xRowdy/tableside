// Seam 3: session setup for all three games (design frames S1-02: blackjack
// i1tnq, craps GAXET, roulette XQukd, invalid limits T66Sqw, buy-in can't cover
// tUFpp, incompatible strategy S4-13 YwrCf; S5-10 allowance lines), through the
// real routes on the in-memory adapters, driven only through the accessibility
// tree. Expected values: spec #51 user stories 3-12 and Default table limits;
// house edges from the definitions package's published-source tests.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import type { SetupTerms } from '@/practice/adapters';

let mockTerms: SetupTerms | null = null;
let mockDenyStart = false;

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  return {
    createAppAdapters: () => ({
      ...substituteAdapters({ clock: new FakeClock(undefined, true) }),
      access: {
        ...alwaysAllowed,
        ...(mockTerms ? { setupTerms: async () => mockTerms } : {}),
        ...(mockDenyStart ? { beforeActivity: async () => ({ status: 'denied', provenance: 'test', disposition: 'stop', reason: 'Not today.' }) } : {}),
      },
    }),
  };
});

const storage = () => jest.requireMock('@/play/setup/device-storage') as { stored: string | null; latest: { text: string | null } | null };

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
  mockTerms = null;
  mockDenyStart = false;
  storage().stored = null;
});

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

async function open(game: 'blackjack' | 'craps' | 'roulette', title: string) {
  await renderRouter('./src/app', { initialUrl: `/play?game=${game}` });
  await screen.findByRole('header', { name: title });
}

const field = (name: string) => screen.getByLabelText(name);
const buyIn = () => field('Starting chips for this session, in units');
const start = (name = 'Start free play') => screen.getByRole('button', { name });

describe('session setup', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(() => setWindow(390, 844, 1));

  describe('blackjack', () => {
    it('offers the four named presets, which the dealer and surrender switches also set', async () => {
      await open('blackjack', 'Blackjack');
      const presets = within(screen.getByLabelText('Rule preset'));
      expect(presets.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(['S17 · surrender', 'S17', 'H17 · surrender', 'H17']);
      expect(presets.getByRole('radio', { name: 'S17 · surrender', checked: true })).toBeOnTheScreen();
      expect(screen.getByRole('switch', { name: 'Dealer hits soft 17' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Late surrender' })).toBeChecked();
      expect(screen.getByText(/House edge with basic strategy: 0\.33%/)).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('switch', { name: 'Dealer hits soft 17' }));
      expect(presets.getByRole('radio', { name: 'H17 · surrender', checked: true })).toBeOnTheScreen();
      expect(screen.getByText(/House edge with basic strategy: 0\.53%/)).toBeOnTheScreen();
      await fireEvent.press(presets.getByRole('radio', { name: 'S17' }));
      expect(screen.getByRole('switch', { name: 'Dealer hits soft 17' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Late surrender' })).not.toBeChecked();
      expect(screen.getByText(/House edge with basic strategy: 0\.40%/)).toBeOnTheScreen();
      // A property of the rules, never a prediction.
      expect(screen.getByText(/property of these rules, not a prediction/)).toBeOnTheScreen();
    });

    it('steps penetration 50-80% by 5 and other players 0-4, each stepper stopping at its ends', async () => {
      await open('blackjack', 'Blackjack');
      const penetration = screen.getByRole('adjustable', { name: 'Shoe penetration' });
      expect(penetration).toHaveAccessibilityValue({ text: '75%' });
      await fireEvent.press(screen.getByRole('button', { name: 'More shoe penetration' }));
      expect(penetration).toHaveAccessibilityValue({ text: '80%' });
      expect(screen.getByRole('button', { name: 'More shoe penetration' })).toBeDisabled();
      for (let i = 0; i < 6; i++) await fireEvent(penetration, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      expect(penetration).toHaveAccessibilityValue({ text: '50%' });
      expect(screen.getByRole('button', { name: 'Less shoe penetration' })).toBeDisabled();

      const others = screen.getByRole('adjustable', { name: 'Other players at the table' });
      expect(others).toHaveAccessibilityValue({ text: 'No other players' });
      expect(screen.getByRole('button', { name: 'Fewer other players' })).toBeDisabled();
      for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByRole('button', { name: 'More other players' }));
      expect(others).toHaveAccessibilityValue({ text: '4 other players' });
      expect(screen.getByRole('button', { name: 'More other players' })).toBeDisabled();
    });

    it('starts at the chosen rules and edited limits; other players bet the edited minimum', async () => {
      await open('blackjack', 'Blackjack');
      await fireEvent.changeText(field('Initial wager minimum, in units'), '25');
      await fireEvent.changeText(field('Initial wager maximum, in units'), '500');
      await fireEvent.press(screen.getByRole('button', { name: 'More other players' }));
      await fireEvent.press(start());
      expect(await screen.findByText(/25–500/)).toBeOnTheScreen();
    });
  });

  describe('limits', () => {
    it('explains a minimum above the maximum, never correcting it, and Go to the minimum focuses it', async () => {
      await open('blackjack', 'Blackjack');
      expect(field('Initial wager minimum, in units')).toHaveProp('value', '10');
      expect(field('Initial wager maximum, in units')).toHaveProp('value', '1,000');
      await fireEvent.changeText(field('Initial wager minimum, in units'), '1,500');

      expect(screen.getByText('More than the maximum. Lower it or raise the maximum.')).toBeOnTheScreen();
      const banner = within(screen.getByTestId('setup-problems'));
      expect(banner.getByRole('alert')).toHaveTextContent('Fix 1 problem to start');
      expect(banner.getByText("Table limits: the minimum (1,500) is more than the maximum (1,000). We won't change it for you.")).toBeOnTheScreen();
      expect(start()).toBeDisabled();
      expect(field('Initial wager minimum, in units')).toHaveProp('value', '1,500');

      await fireEvent.press(banner.getByRole('button', { name: 'Go to the minimum' }));
      await fireEvent.changeText(field('Initial wager minimum, in units'), '100');
      expect(screen.queryByTestId('setup-problems')).toBeNull();
      expect(start()).toBeEnabled();
    });

    it('explains non-positive, non-whole and over-ceiling limits for each wager group', async () => {
      await open('craps', 'Craps');
      await fireEvent.changeText(field('Pass, come, place, buy, lay, field minimum, in units'), '0');
      await fireEvent.changeText(field('Pass, come, place, buy, lay, field maximum, in units'), '10.5');
      await fireEvent.changeText(field('Hardways and propositions maximum, in units'), '1,000,001');

      expect(screen.getByText('Use 1 or more.')).toBeOnTheScreen();
      expect(screen.getByText('Whole units only.')).toBeOnTheScreen();
      expect(screen.getByText('At most 1,000,000 units.')).toBeOnTheScreen();
      const banner = within(screen.getByTestId('setup-problems'));
      expect(banner.getByRole('alert')).toHaveTextContent('Fix 3 problems to start');
      expect(banner.getByText("Pass, come, place, buy, lay, field minimum: use 1 or more (you entered 0). We won't change it for you.")).toBeOnTheScreen();
      expect(banner.getByText("Pass, come, place, buy, lay, field maximum: whole units only (you entered 10.5). We won't change it for you.")).toBeOnTheScreen();
      expect(banner.getByText("Hardways and propositions maximum: at most 1,000,000 units (you entered 1,000,001). We won't change it for you.")).toBeOnTheScreen();
      expect(banner.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
        'Go to the pass, come, place, buy, lay, field minimum',
        'Go to the pass, come, place, buy, lay, field maximum',
        'Go to the hardways and propositions maximum',
      ]);
      expect(start()).toBeDisabled();
    });

    it('reads only properly placed thousands separators; anything else is explained, not reinterpreted', async () => {
      await open('blackjack', 'Blackjack');
      await fireEvent.changeText(field('Initial wager maximum, in units'), '1,0,0');
      expect(screen.getByText('Digits only, in whole units.')).toBeOnTheScreen();
      await fireEvent.changeText(field('Initial wager maximum, in units'), '2,000');
      expect(screen.queryByTestId('setup-problems')).toBeNull();
    });

    it('starts craps and roulette at edited limits', async () => {
      await open('craps', 'Craps');
      await fireEvent.changeText(field('Pass, come, place, buy, lay, field minimum, in units'), '25');
      await fireEvent.changeText(field('Hardways and propositions maximum, in units'), '50');
      await fireEvent.press(start());
      expect(await screen.findByText(/25–1,000 · props 1–50/)).toBeOnTheScreen();
      await cleanup();

      await open('roulette', 'Roulette');
      await fireEvent.changeText(field('Outside bets minimum, in units'), '5');
      await fireEvent.press(start());
      await screen.findByLabelText('Session balance 1,000');
      expect(screen.getByText(/outside 5–1,000/)).toBeOnTheScreen();
    });
  });

  describe('craps and roulette rules', () => {
    it('craps chooses the maximum odds and field payout; roulette chooses the wheel', async () => {
      await open('craps', 'Craps');
      expect(within(screen.getByLabelText('Maximum odds')).getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual([
        '1x odds', '2x odds', '3-4-5x odds', '5x odds', '10x odds',
      ]);
      expect(within(screen.getByLabelText('Field payout')).getByRole('radio', { name: '2 double, 12 triple', checked: true })).toBeOnTheScreen();
      await cleanup();

      await open('roulette', 'Roulette');
      const wheel = within(screen.getByLabelText('Wheel'));
      expect(wheel.getByRole('radio', { name: 'Single zero (0)', checked: true })).toBeOnTheScreen();
      expect(screen.getByText(/House edge on every bet: 2\.70%/)).toBeOnTheScreen();
      await fireEvent.press(wheel.getByRole('radio', { name: 'Double zero (0, 00)' }));
      expect(screen.getByText(/House edge on every bet: 5\.26%, except the five-number basket: 7\.89%/)).toBeOnTheScreen();
    });
  });

  describe('buy-in', () => {
    it('remembers the last buy-in per game as a setup preference, across launches, never as a balance', async () => {
      await open('roulette', 'Roulette');
      expect(buyIn()).toHaveProp('value', '1,000');
      expect(screen.getByText('Each session starts fresh.')).toBeOnTheScreen();
      await fireEvent.changeText(buyIn(), '250');
      await fireEvent.press(start());
      await screen.findByLabelText('Session balance 250');
      await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
      await fireEvent.press(screen.getAllByRole('button', { name: 'End session' }).at(-1) as never);
      await fireEvent.press(await screen.findByRole('button', { name: 'New session' }));
      await screen.findByRole('header', { name: 'Roulette' });
      expect(buyIn()).toHaveProp('value', '250');
      expect(screen.getByText('Your last roulette buy-in. Each session starts fresh.')).toBeOnTheScreen();

      // Another launch: the preference is on the device; other games keep their own.
      storage().stored = storage().latest?.text ?? null;
      await cleanup();
      await open('roulette', 'Roulette');
      await waitFor(() => expect(buyIn()).toHaveProp('value', '250'));
      await cleanup();
      await open('craps', 'Craps');
      expect(buyIn()).toHaveProp('value', '1,000');
    });

    it('remembers a buy-in only once its session has started', async () => {
      mockDenyStart = true;
      await open('craps', 'Craps');
      await fireEvent.changeText(buyIn(), '300');
      await fireEvent.press(start());
      expect(await screen.findByText('Not today.')).toBeOnTheScreen();
      expect(storage().latest?.text ?? null).toBeNull();
    });

    it("explains when the buy-in can't cover the strategy's opening bets, and offers to raise it", async () => {
      await open('roulette', 'Roulette');
      await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Fixed two-dozen coverage' }));
      await fireEvent.changeText(buyIn(), '15');

      expect(screen.getByText("Too low for your strategy's opening bets (20).")).toBeOnTheScreen();
      const banner = within(screen.getByTestId('setup-shortfall'));
      expect(banner.getByRole('alert')).toHaveTextContent("Your buy-in can't cover the opening bets");
      expect(
        banner.getByText(
          'Fixed two-dozen coverage opens with 10 on 1st dozen and 10 on 2nd dozen, which is 20 in total. Raise the buy-in to at least 20, or pick a strategy with a smaller opening bet.',
        ),
      ).toBeOnTheScreen();
      expect(start('Start guided practice')).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Set buy-in to 20' }));
      expect(buyIn()).toHaveProp('value', '20');
      expect(screen.queryByTestId('setup-shortfall')).toBeNull();
      expect(start('Start guided practice')).toBeEnabled();
    });

    it("in free play, explains a buy-in below the table's smallest bet", async () => {
      await open('blackjack', 'Blackjack');
      await fireEvent.changeText(buyIn(), '5');
      expect(screen.getByText("Too low for the table's smallest bet (10).")).toBeOnTheScreen();
      expect(within(screen.getByTestId('setup-shortfall')).getByRole('alert')).toHaveTextContent("Your buy-in can't cover a bet at this table");
      expect(start()).toBeDisabled();
    });
  });

  describe('incompatible strategy', () => {
    it('is checked against the edited limits, naming the requirement, with a third choice to customize a copy', async () => {
      await open('roulette', 'Roulette');
      await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
      await fireEvent.changeText(field('Outside bets minimum, in units'), '25');

      expect(screen.getByTestId('strategy-incompatible')).toBeOnTheScreen();
      expect(screen.getByText("Flat even-money bets 10 on Red. This table's minimum for that bet is 25, so a 10 bet isn't allowed.")).toBeOnTheScreen();
      expect(screen.getByText("Above the strategy's 10 bets.")).toBeOnTheScreen();
      expect(start('Start guided practice')).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Customize a copy for this table' }));
      expect(screen.getByText(/The strategy builder arrives in a later update/)).toBeOnTheScreen();

      await fireEvent.changeText(field('Outside bets minimum, in units'), '10');
      expect(screen.queryByTestId('strategy-incompatible')).toBeNull();
      expect(start('Start guided practice')).toBeEnabled();
    });
  });

  describe('training bankroll and allowance lines (spec 5 slot)', () => {
    it('a training-bankroll session has no buy-in field; the whole bankroll funds it', async () => {
      mockTerms = {
        funding: { source: 'training-bankroll', available: '500' },
        allowance: { title: 'TRAINING BANKROLL', text: '500 training units available. Resets daily; no top-ups.' },
        seePremium: true,
      };
      await open('roulette', 'Roulette');
      await screen.findByText('500 training units available. Resets daily; no top-ups.');
      expect(screen.queryByLabelText('Starting chips for this session, in units')).toBeNull();
      expect(screen.getByText(/there's no buy-in and no rebuys/)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'See premium' })).toBeOnTheScreen();
      await fireEvent.press(start());
      expect(await screen.findByLabelText('Session balance 500')).toBeOnTheScreen();
    });

    it('a short training bankroll is explained with no offer to raise it', async () => {
      mockTerms = { funding: { source: 'training-bankroll', available: '5' }, allowance: { title: 'TRAINING BANKROLL', text: '5 training units available.' }, seePremium: false };
      await open('blackjack', 'Blackjack');
      await screen.findByText('5 training units available.');
      expect(screen.getByText("Too low for the table's smallest bet (10).")).toBeOnTheScreen();
      expect(within(screen.getByTestId('setup-shortfall')).getByRole('alert')).toHaveTextContent("Your training bankroll can't cover a bet at this table");
      expect(screen.queryByRole('button', { name: /Set buy-in/ })).toBeNull();
      expect(start()).toBeDisabled();
    });

    it('shows the allowance line beside the buy-in for other methods, and the premium line', async () => {
      mockTerms = { funding: { source: 'practice-funding' }, allowance: { title: 'PREMIUM', text: 'Unlimited training (premium)' }, seePremium: false };
      await open('blackjack', 'Blackjack');
      expect(await screen.findByText('Unlimited training (premium)')).toBeOnTheScreen();
      expect(buyIn()).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'See premium' })).toBeNull();
    });
  });

  describe('switching game (S1-09 egZUB)', () => {
    async function crapsThenRouletteCard() {
      await renderRouter('./src/app', { initialUrl: '/play?game=craps' });
      await screen.findByRole('header', { name: 'Craps' });
      await fireEvent.press(start());
      await screen.findByLabelText('Session balance 1,000');
      await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
      await fireEvent.press(await screen.findByRole('button', { name: /^Roulette\b/ }));
      return screen.findByRole('header', { name: 'Switch to roulette?' });
    }

    it('asks first, naming the ending steps; staying keeps the session as it was', async () => {
      await crapsThenRouletteCard();
      expect(screen.getByText('Starting roulette ends this craps session first. Resetting the table does the same.')).toBeOnTheScreen();
      expect(screen.getByLabelText('3. Your craps result is saved, then roulette setup opens. Results and departures in Saved › Practice')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Stay at craps' }));
      await waitFor(() => expect(screen.queryByRole('header', { name: 'Switch to roulette?' })).toBeNull());
      expect(screen.getByLabelText('Session balance 1,000')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Roll' })).toBeOnTheScreen();
    });

    it('ends the session (its result saved), then opens the other game’s setup', async () => {
      await crapsThenRouletteCard();
      await fireEvent.press(screen.getByRole('button', { name: 'End craps session and switch' }));
      expect(await screen.findByRole('header', { name: 'Roulette' })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: 'Session result' })).toBeNull();
      expect(buyIn()).toHaveProp('value', '1,000');
      expect(start()).toBeEnabled();
    });
  });

  describe('accessibility', () => {
    it('shows plain units, meets touch targets, and reflows at the largest text in landscape', async () => {
      await setWindow(844, 390, 3.1);
      await open('blackjack', 'Blackjack');
      expect(JSON.stringify(screen.toJSON())).not.toMatch(/\$/);
      for (const control of [...screen.getAllByRole('radio'), ...screen.getAllByRole('button'), ...screen.getAllByRole('switch')]) {
        const style = StyleSheet.flatten(control.props.style) ?? {};
        expect(Math.max(style.minHeight ?? 0, style.height ?? 0)).toBeGreaterThanOrEqual(44);
      }
      expect(screen.getByRole('button', { name: 'Back to Home' })).toBeOnTheScreen();
      expect(screen.getByRole('radio', { name: 'S17 · surrender', checked: true })).toHaveTextContent(/✓/);
    });
  });
});

// Seam 3: first-run sign-in (#88, S2-13 to S2-16) as the player meets it,
// through the real routes and the accessibility tree, over Account-service
// fakes: welcome → age (Create only) → email and code → offline game → Home.

import type { AccountGate } from '@tableside/account';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions } from 'react-native';

import { FAKE_ACCOUNT_ID, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
import type { GameId } from '@/games';

type Launch = { stored: AccountGate; offlineGame: GameId | null; latest: ReturnType<typeof fakeAppAccount> | null };
const launch = jest.requireMock<Launch>('@/account/app-account');
const account = () => launch.latest!;
const service = () => account().service;

const CODE = '482913';
const EMAIL = 'player@example.com';

let announcements: string[] = [];
let logged: unknown[][] = [];

beforeAll(async () => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((text) => void announcements.push(text));
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args));
  }
  // The first render transforms the route tree; pay that once.
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  launch.stored = { state: 'no-account' };
  launch.offlineGame = null;
  announcements = [];
  logged = [];
});

afterEach(async () => {
  await setWindow(390, 844);
});

afterAll(() => {
  launch.stored = SIGNED_IN;
  launch.offlineGame = 'blackjack';
});

async function openApp() {
  await renderRouter('./src/app', { initialUrl: '/' });
}

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const noTabBar = () => expect(screen.queryByTestId('tab-bar')).toBeNull();

/** Every accessibility label and text on screen, for checking what a screen reader could read out. */
function everythingSpoken(): string[] {
  const out: string[] = [];
  type Node = typeof screen.root;
  const walk = (node: Node | string) => {
    if (typeof node === 'string') return void out.push(node);
    if (!node) return;
    for (const prop of ['accessibilityLabel', 'accessibilityHint', 'aria-label']) {
      if (typeof node.props[prop] === 'string') out.push(node.props[prop]);
    }
    (node.children as (Node | string)[]).forEach(walk);
  };
  walk(screen.root);
  return out;
}

async function signInByEmail() {
  await fireEvent.press(button('Sign in'));
  await header('Sign in');
  await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
  await fireEvent.press(button('Send code'));
  await header('Enter your code');
}

async function enterCode(code = CODE) {
  await fireEvent.changeText(screen.getByLabelText('Code'), code);
  await fireEvent.press(button('Continue'));
}

describe('a new installation', () => {
  it('opens on Welcome with no tab bar, separating Sign in from Create and saying why a connection is needed', async () => {
    await openApp();

    expect(await header('Tableside')).toBeOnTheScreen();
    noTabBar();
    expect(button('Sign in')).toHaveProp('accessibilityHint', 'For an account you already have');
    expect(button('Create account')).toHaveProp('accessibilityHint', 'Start a new account');
    expect(screen.getByText('You need a connection to sign in or create an account. After that, Tableside works offline.')).toBeOnTheScreen();
  });
});

describe('Sign in', () => {
  it('never asks for age, and reaches Home through the code and the offline game choice', async () => {
    await openApp();
    await header('Tableside');
    await signInByEmail();

    expect(screen.getByText("If an account exists for this address, we've sent a code.")).toBeOnTheScreen();
    expect(screen.getByText('No code? Create an account, or use Apple or Google.')).toBeOnTheScreen();
    noTabBar();

    await enterCode();
    expect(await header('Choose your offline game')).toBeOnTheScreen();
    noTabBar();
    const choices = screen.getAllByRole('radio');
    expect(choices.map((choice) => choice.props.accessibilityLabel)).toEqual([
      'Blackjack. 6 decks, blackjack pays 3 to 2, basic strategy and Hi-Lo coaching',
      'Craps. Standard craps, 5 built-in strategies',
      'Roulette. Single or double zero, 5 strategies',
    ]);
    expect(button('Continue')).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: /^Roulette\b/ }));
    expect(screen.getByRole('radio', { name: /^Roulette\b/ })).toBeChecked();
    await fireEvent.press(button('Continue'));

    expect(await screen.findByTestId('tab-bar')).toBeOnTheScreen();
    expect(account().offlineGames.get(FAKE_ACCOUNT_ID)).toBe('roulette');
    expect(service().calls.map((call) => call.method)).toEqual(['resume', 'requestEmailCode', 'verifyEmailCode']);
    expect(service().calls[1]).toEqual({ method: 'requestEmailCode', email: EMAIL, intent: 'sign-in' });
  });

  it('offers Create from the code screen, which then asks for age', async () => {
    await openApp();
    await header('Tableside');
    await signInByEmail();

    await fireEvent.press(button('Create an account'));
    expect(await header('How old are you?')).toBeOnTheScreen();
  });

  it('says a wrong code didn’t work, and stays on the code screen', async () => {
    await openApp();
    await header('Tableside');
    await signInByEmail();
    service().next.verify.push({ status: 'invalid-code' });

    await enterCode('000000');
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work. Check it, or send a new code.");
    expect(screen.getByLabelText('Code')).toHaveProp('value', '000000');
    noTabBar();
  });

  it('asks for six digits before sending anything', async () => {
    await openApp();
    await header('Tableside');
    await signInByEmail();

    await enterCode('12');
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code from the email.');
    expect(service().calls.some((call) => call.method === 'verifyEmailCode')).toBe(false);
  });
});

describe('code requests', () => {
  it('shows the wait before another code can be requested', async () => {
    await openApp();
    await header('Tableside');
    service().next.code.push({ status: 'rate-limited', retryAfterSeconds: 30 });
    await fireEvent.press(button('Sign in'));
    await header('Sign in');
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wait 30 seconds before requesting another code.');
    expect(screen.getByLabelText('Email address')).toHaveProp('value', EMAIL);
  });

  it('shows the wait when a new code is requested too soon from the code screen', async () => {
    await openApp();
    await header('Tableside');
    await signInByEmail();
    service().next.code.push({ status: 'rate-limited', retryAfterSeconds: 120 });

    await fireEvent.press(button('Send a new code'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait 2 minutes before requesting another code.');
  });

  it('confirms a new code went out', async () => {
    await openApp();
    await header('Tableside');
    await signInByEmail();

    await fireEvent.press(button('Send a new code'));
    expect(await screen.findByText("We've sent a new code. Only the newest one works.")).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('reports a delivery failure at once, in words that say nothing about the account', async () => {
    await openApp();
    await header('Tableside');
    service().next.code.push({ status: 'failed' });
    await fireEvent.press(button('Sign in'));
    await header('Sign in');
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send the email. Check the address and your connection, then try again.");
  });
});

describe('Create', () => {
  it('asks a neutral age-range question, then the email and code, then the offline game', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Create account'));

    expect(await header('How old are you?')).toBeOnTheScreen();
    noTabBar();
    expect(screen.getByTestId('age-question')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByTestId('age-question')).toHaveProp('accessibilityLabel', 'How old are you?');
    expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(['Under 13', '13 to 15', '16 to 17', '18 or older']);
    expect(screen.queryByLabelText(/birth|ID/)).toBeNull();
    expect(button('Continue')).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: '16 to 17' }));
    await fireEvent.press(button('Continue'));
    expect(await header('Create your account')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    await header('Enter your code');
    expect(screen.queryByText('No code? Create an account, or use Apple or Google.')).toBeNull();
    await enterCode();

    expect(await header('Choose your offline game')).toBeOnTheScreen();
    expect(service().calls.slice(1, 3)).toEqual([
      { method: 'answerAgeQuestion', range: '16-17' },
      { method: 'requestEmailCode', email: EMAIL, intent: 'create' },
    ]);
  });

  it('ends at under 13 with no account and nothing further asked', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Create account'));
    await header('How old are you?');

    await fireEvent.press(screen.getByRole('radio', { name: 'Under 13' }));
    await fireEvent.press(button('Continue'));

    expect(await header("Tableside isn't available")).toBeOnTheScreen();
    expect(screen.getByText('Tableside is for people 13 and older. No account was created and nothing you entered was kept.')).toBeOnTheScreen();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByLabelText('Email address')).toBeNull();
    noTabBar();
    expect(service().calls.map((call) => call.method)).toEqual(['resume', 'answerAgeQuestion']);
    expect(service().gate).toEqual({ state: 'no-account' });
  });

  it('asks the age question again when the server says the answer has expired', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Create account'));
    await header('How old are you?');
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));
    await header('Create your account');
    service().next.code.push({ status: 'age-required' });

    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    expect(await header('How old are you?')).toBeOnTheScreen();
  });
});

describe('reopening', () => {
  it('reopens into the account, offline, straight to Home', async () => {
    launch.stored = SIGNED_IN;
    launch.offlineGame = 'craps';
    await openApp();

    expect(await screen.findByTestId('tab-bar')).toBeOnTheScreen();
    expect(service().calls.map((call) => call.method)).toEqual(['resume']);
  });

  it('keeps access while the token renews (Renewal pending), and tries to renew', async () => {
    launch.stored = { state: 'renewal-pending', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' };
    launch.offlineGame = 'craps';
    await openApp();

    expect(await screen.findByTestId('tab-bar')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^(Blackjack|Craps|Roulette)\b/ })).toHaveLength(3);
    await waitFor(() => expect(service().calls.map((call) => call.method)).toContain('renew'));
  });

  it('asks an account that hasn’t picked its offline game to pick one first', async () => {
    launch.stored = { state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '13-15' };
    await openApp();

    expect(await header('Choose your offline game')).toBeOnTheScreen();
    noTabBar();
  });
});

describe('accessibility', () => {
  it('never puts the code or the age band in a label, announcement or log', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Create account'));
    await header('How old are you?');
    await fireEvent.press(screen.getByRole('radio', { name: '13 to 15' }));
    await fireEvent.press(button('Continue'));
    await header('Create your account');
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    await header('Enter your code');
    await fireEvent.changeText(screen.getByLabelText('Code'), CODE);
    expect(everythingSpoken().filter((text) => text.includes(CODE))).toEqual([]);
    await fireEvent.press(button('Continue'));
    await header('Choose your offline game');

    const band = /13 to 15|13-15|13–15/;
    expect(everythingSpoken().filter((text) => band.test(text) || text.includes(CODE))).toEqual([]);
    expect(announcements.filter((text) => band.test(text) || text.includes(CODE))).toEqual([]);
    expect(logged.map((args) => args.map(String).join(' ')).filter((text) => band.test(text) || text.includes(CODE) || text.includes(EMAIL))).toEqual([]);
  });

  it('works from the keyboard: the return key sends the address and the code', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Sign in'));
    await header('Sign in');

    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent(screen.getByLabelText('Email address'), 'submitEditing');
    await header('Enter your code');
    await fireEvent.changeText(screen.getByLabelText('Code'), CODE);
    await fireEvent(screen.getByLabelText('Code'), 'submitEditing');
    expect(await header('Choose your offline game')).toBeOnTheScreen();
    expect(service().calls[2]).toEqual({ method: 'verifyEmailCode', email: EMAIL, code: CODE });
  });

  it('draws a focus ring on the field that has keyboard focus', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Sign in'));
    await header('Sign in');

    const field = screen.getByLabelText('Email address');
    await fireEvent(field, 'focus', { nativeEvent: {} });
    expect(field).toHaveStyle({ borderColor: '#D4AE62' });
    await fireEvent(field, 'blur', { nativeEvent: {} });
    expect(field).not.toHaveStyle({ borderColor: '#D4AE62' });
  });

  it.each([
    ['portrait at the largest text size', 390, 844, 3],
    ['landscape at the largest text size', 844, 390, 3],
    ['landscape', 844, 390, 1],
  ])('runs the whole Create flow in %s, every screen scrolling', async (_, width, height, fontScale) => {
    await setWindow(width, height, fontScale);
    await openApp();
    await header('Tableside');
    expect(screen.getByTestId('first-run-scroll')).toBeOnTheScreen();
    await fireEvent.press(button('Create account'));
    await header('How old are you?');
    expect(screen.getByTestId('first-run-scroll')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));
    await header('Create your account');
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    await header('Enter your code');
    await enterCode();
    await header('Choose your offline game');
    await fireEvent.press(screen.getByRole('radio', { name: /^Blackjack\b/ }));
    await fireEvent.press(button('Continue'));
    expect(await screen.findByTestId('tab-bar')).toBeOnTheScreen();
  });

  it('lets body text grow to twice its size and headings to one and a half', async () => {
    await openApp();
    await header('Tableside');
    expect(screen.getByRole('header', { name: 'Tableside' })).toHaveProp('maxFontSizeMultiplier', 1.5);
    expect(screen.getByText('You need a connection to sign in or create an account. After that, Tableside works offline.')).toHaveProp('maxFontSizeMultiplier', 2);
  });
});

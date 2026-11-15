// Seam 3: first-run sign-in (#88 and #89, S2-13 to S2-16) as the player meets
// it, through the real routes and the accessibility tree, over Account-service
// fakes: welcome → age (Create only) → sign-in method (Apple, Google or an
// email code) → offline game → Home.

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

/** Welcome → I'm new here → Continue: the age step. */
async function startCreate() {
  await fireEvent.press(screen.getByRole('radio', { name: "I'm new here" }));
  await fireEvent.press(button('Continue'));
  await header('How old are you?');
}

/** The age step's answer, then the method choice's email code. */
async function chooseEmailMethod() {
  await header('How do you want to sign in?');
  await fireEvent.press(button('Create with an email code'));
}

async function signInByEmail() {
  await fireEvent.press(button('Sign in with an email code'));
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
    expect(screen.getByTestId('intent-switch')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByTestId('intent-switch')).toHaveProp('accessibilityLabel', 'Do you have an account?');
    expect(screen.getByRole('radio', { name: 'I have an account' })).toBeChecked();
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Sign in with Apple',
      'Sign in with Google',
      'Sign in with an email code',
    ]);
    expect(
      screen.getByText('Signing in needs a connection the first time and after you sign out. After that, practice works offline.'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: "I'm new here" }));
    expect(screen.getByRole('radio', { name: "I'm new here" })).toBeChecked();
    expect(screen.getByText(/^Create a free account\. .*First, a quick age check, then you choose how to sign in\.$/)).toBeOnTheScreen();
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Continue']);
    expect(screen.getByText('Creating an account needs a connection. After that, practice works offline.')).toBeOnTheScreen();
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
    await fireEvent.press(button('Sign in with an email code'));
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
    await fireEvent.press(button('Sign in with an email code'));
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
    await startCreate();

    expect(await header('How old are you?')).toBeOnTheScreen();
    noTabBar();
    expect(screen.getByTestId('age-question')).toHaveProp('accessibilityRole', 'radiogroup');
    expect(screen.getByTestId('age-question')).toHaveProp('accessibilityLabel', 'How old are you?');
    expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(['Under 13', '13 to 15', '16 to 17', '18 or older']);
    expect(screen.queryByLabelText(/birth|ID/)).toBeNull();
    expect(button('Continue')).toBeDisabled();

    await fireEvent.press(screen.getByRole('radio', { name: '16 to 17' }));
    await fireEvent.press(button('Continue'));
    await chooseEmailMethod();
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
    await startCreate();

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
    await startCreate();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));
    await chooseEmailMethod();
    await header('Create your account');
    service().next.code.push({ status: 'age-required' });

    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    expect(await header('How old are you?')).toBeOnTheScreen();
  });
});

describe('Apple and Google', () => {
  it('Sign in with Apple never asks for age, and reaches Home through the offline game choice', async () => {
    await openApp();
    await header('Tableside');
    await fireEvent.press(button('Sign in with Apple'));

    expect(await header('Choose your offline game')).toBeOnTheScreen();
    expect(service().calls).toEqual([{ method: 'resume' }, { method: 'signInWithProvider', provider: 'apple' }]);
  });

  it('a Sign in that finds no account says so, and Create runs the age step, then creates it for that identity', async () => {
    await openApp();
    await header('Tableside');
    service().next.providerSignIn.push({ status: 'no-account' });
    await fireEvent.press(button('Sign in with Google'));

    expect(await header('No account for this Google account')).toBeOnTheScreen();
    noTabBar();
    expect(
      screen.getByText(
        "We couldn't find a Tableside account for this Google account, and we haven't created one. Create one now? You'll answer an age question first.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nothing about you is stored unless you create the account.')).toBeOnTheScreen();
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Back',
      'Create an account',
      'Sign in with Apple instead',
      'Sign in with an email code',
      'Back to welcome',
    ]);

    await fireEvent.press(button('Create an account'));
    await header('How old are you?');
    await fireEvent.press(screen.getByRole('radio', { name: '13 to 15' }));
    await fireEvent.press(button('Continue'));

    expect(await header('Choose your offline game')).toBeOnTheScreen();
    expect(service().calls).toEqual([
      { method: 'resume' },
      { method: 'signInWithProvider', provider: 'google' },
      { method: 'answerAgeQuestion', range: '13-15' },
      // The identity Sign in found, without asking Google again.
      { method: 'createWithProvider', provider: 'google', sameIdentity: true },
    ]);
  });

  it('names the Apple ID when Sign in with Apple finds no account, and offers Google instead', async () => {
    await openApp();
    await header('Tableside');
    service().next.providerSignIn.push({ status: 'no-account' });
    await fireEvent.press(button('Sign in with Apple'));

    expect(await header('No account for this Apple ID')).toBeOnTheScreen();
    await fireEvent.press(button('Sign in with Google instead'));
    expect(await header('Choose your offline game')).toBeOnTheScreen();
    expect(service().calls.at(-1)).toEqual({ method: 'signInWithProvider', provider: 'google' });
  });

  it('under 13, after a Sign in found no account, ends with nothing created', async () => {
    await openApp();
    await header('Tableside');
    service().next.providerSignIn.push({ status: 'no-account' });
    await fireEvent.press(button('Sign in with Apple'));
    await header('No account for this Apple ID');
    await fireEvent.press(button('Create an account'));
    await header('How old are you?');
    await fireEvent.press(screen.getByRole('radio', { name: 'Under 13' }));
    await fireEvent.press(button('Continue'));

    expect(await header("Tableside isn't available")).toBeOnTheScreen();
    expect(service().calls.map((call) => call.method)).not.toContain('createWithProvider');
    expect(service().gate).toEqual({ state: 'no-account' });
  });

  it('Create asks for age, then offers each method, saying it makes a new, empty account', async () => {
    await openApp();
    await header('Tableside');
    await startCreate();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));

    expect(await header('How do you want to sign in?')).toBeOnTheScreen();
    expect(screen.getByText('Create your account')).toBeOnTheScreen();
    expect(screen.getByText('Step 2 of 2')).toBeOnTheScreen();
    expect(
      screen.getByText('This creates a new, empty Tableside account. If you already have one, sign in instead so your history comes back.'),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Back',
      'Continue with Apple',
      'Continue with Google',
      'Create with an email code',
      'I already have an account',
    ]);

    await fireEvent.press(button('Continue with Apple'));
    expect(await header('Choose your offline game')).toBeOnTheScreen();
    // Nothing after Create reads as getting another account back.
    expect(everythingSpoken().filter((text) => /welcome back|recover|restor|your history/i.test(text))).toEqual([]);
    expect(service().calls.at(-1)).toEqual({ method: 'createWithProvider', provider: 'apple', sameIdentity: false });
  });

  it('a closed sheet changes nothing, and a failure says what to do', async () => {
    await openApp();
    await header('Tableside');
    service().next.providerSignIn.push({ status: 'cancelled' }, { status: 'failed' });

    await fireEvent.press(button('Sign in with Apple'));
    await waitFor(() => expect(button('Sign in with Apple')).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await header('Tableside')).toBeOnTheScreen();

    await fireEvent.press(button('Sign in with Google'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't continue with Google. Check your connection and try again, or use another way to sign in.",
    );
    noTabBar();
  });

  it('asks the age question again when Create finds the answer has expired', async () => {
    await openApp();
    await header('Tableside');
    await startCreate();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));
    await header('How do you want to sign in?');
    service().next.providerCreate.push({ status: 'age-required' });

    await fireEvent.press(button('Continue with Google'));
    expect(await header('How old are you?')).toBeOnTheScreen();
  });

  it('a fresh Create after a Sign in found no account asks the provider again', async () => {
    await openApp();
    await header('Tableside');
    service().next.providerSignIn.push({ status: 'no-account' });
    await fireEvent.press(button('Sign in with Apple'));
    await header('No account for this Apple ID');
    await fireEvent.press(button('Back to welcome'));
    await header('Tableside');
    await startCreate();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));
    await header('How do you want to sign in?');

    await fireEvent.press(button('Continue with Apple'));
    expect(await header('Choose your offline game')).toBeOnTheScreen();
    expect(service().calls.at(-1)).toEqual({ method: 'createWithProvider', provider: 'apple', sameIdentity: false });
  });

  it('turns the two-part switch into a list of choices at large text sizes', async () => {
    await setWindow(390, 844, 2);
    await openApp();
    await header('Tableside');
    expect(screen.getByTestId('intent-switch')).toHaveStyle({ flexDirection: 'column' });
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
    await startCreate();
    await fireEvent.press(screen.getByRole('radio', { name: '13 to 15' }));
    await fireEvent.press(button('Continue'));
    await chooseEmailMethod();
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
    await fireEvent.press(button('Sign in with an email code'));
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
    await fireEvent.press(button('Sign in with an email code'));
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
    await startCreate();
    expect(screen.getByTestId('first-run-scroll')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));
    await chooseEmailMethod();
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
    expect(screen.getByText('Sign in to get your history, strategies and purchases back.')).toHaveProp('maxFontSizeMultiplier', 2);
  });
});

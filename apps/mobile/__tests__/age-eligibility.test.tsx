// Seam 3: every age state (#90, S2-15) as the player meets it, through the real
// routes and the accessibility tree, over Account-service fakes: the platform
// age check and its fallback on Create, unresolved before any account exists,
// and the gate's restricted states with their paths and retry.

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

const UNRESOLVED: AccountGate = { state: 'age-unresolved', accountId: FAKE_ACCOUNT_ID, reason: 'not-established' };
const INELIGIBLE: AccountGate = { state: 'age-ineligible', accountId: FAKE_ACCOUNT_ID };

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
  launch.offlineGame = 'blackjack';
  announcements = [];
  logged = [];
});

afterEach(async () => {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, fontScale: 1 }, screen: { ...window, fontScale: 1 } }));
});

afterAll(() => {
  launch.stored = SIGNED_IN;
  launch.offlineGame = 'blackjack';
});

const openApp = () => renderRouter('./src/app', { initialUrl: '/' });
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

async function startCreate(platformAgeCheck: boolean) {
  await openApp();
  await header('Tableside');
  service().platformAgeCheck = platformAgeCheck;
  // Welcome → I'm new here → Continue: the age step.
  await fireEvent.press(screen.getByRole('radio', { name: "I'm new here" }));
  await fireEvent.press(button('Continue'));
}

describe('the Create path’s age step', () => {
  it('with a platform age check, explains it first, then continues to the sign-in method when the platform shares a range', async () => {
    await startCreate(true);
    expect(await header('First, your age range')).toBeOnTheScreen();
    expect(screen.getByText('Before you start')).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 2 · age')).toBeOnTheScreen();
    noTabBar();
    service().next.check.push({ status: 'eligible' });

    await fireEvent.press(button('Continue'));
    expect(await header('How do you want to sign in?')).toBeOnTheScreen();
    expect(service().calls.map((call) => call.method)).toEqual(['resume', 'checkAge']);
  });

  it('asks the fallback question when the platform can’t or won’t share a range', async () => {
    await startCreate(true);
    await header('First, your age range');
    await fireEvent.press(button('Continue'));
    expect(await header('How old are you?')).toBeOnTheScreen();
    expect(screen.getByText("Choose a range. We keep only the range, never a birth date, and don't use it for ads or show it to anyone.")).toBeOnTheScreen();
    expect(screen.getByText('Continue is available once you choose a range.')).toBeOnTheScreen();
  });

  it('goes straight to the fallback question on a device with no platform age check', async () => {
    await startCreate(false);
    expect(await header('How old are you?')).toBeOnTheScreen();
    expect(screen.queryByText('First, your age range')).toBeNull();
  });

  it('ends at under 13 from the platform, with nothing kept', async () => {
    await startCreate(true);
    await header('First, your age range');
    service().next.check.push({ status: 'ineligible' });
    await fireEvent.press(button('Continue'));
    expect(await header('Tableside is for people 13 and older')).toBeOnTheScreen();
  });

  it('when a required check stands in the way, creates nothing and offers support, a retry and the way back', async () => {
    await startCreate(true);
    await header('First, your age range');
    service().next.check.push({ status: 'unresolved' });
    await fireEvent.press(button('Continue'));

    expect(await header("We couldn't confirm your age")).toBeOnTheScreen();
    expect(screen.getByText(/No account was created and nothing was kept/)).toBeOnTheScreen();
    noTabBar();
    await fireEvent.press(button('Contact support. Ask about confirming your age'));
    expect(account().opened).toEqual(['contact-support']);
    expect(screen.queryByRole('button', { name: /Delete account|Export my data/ })).toBeNull();

    await fireEvent.press(button('Try the age check again'));
    expect(await header('First, your age range')).toBeOnTheScreen();
    service().next.check.push({ status: 'unresolved' });
    await fireEvent.press(button('Continue'));
    await header("We couldn't confirm your age");
    await fireEvent.press(button('Back to welcome'));
    expect(await header('Tableside')).toBeOnTheScreen();
    expect(service().gate).toEqual({ state: 'no-account' });
  });
});

describe('an account whose age is unresolved', () => {
  it('is paused with no tab bar, keeping support, privacy requests, billing help, export and deletion', async () => {
    launch.stored = UNRESOLVED;
    await openApp();

    expect(await header("We couldn't confirm your age")).toBeOnTheScreen();
    expect(screen.getByText('Account paused')).toBeOnTheScreen();
    expect(screen.getByText(/Your records are kept and nothing has been deleted/)).toBeOnTheScreen();
    noTabBar();
    const paths = [
      'Contact support. Ask about confirming your age',
      'Billing help. Subscriptions and refunds',
      "Export my data. Sign-in needed to confirm it's you",
      'Delete account',
      'Make a privacy request. See, correct, delete or get a copy of your data',
    ];
    for (const path of paths) await fireEvent.press(button(path));
    expect(account().opened).toEqual(['contact-support', 'billing-help', 'export', 'delete-account', 'privacy-request']);
    // Billing help, never a purchase.
    expect(screen.queryByText(/Premium|Subscribe|Buy|Upgrade/)).toBeNull();
  });

  it('retries the age check; when a declaration may decide, asks the question, and an established answer opens Home', async () => {
    launch.stored = UNRESOLVED;
    await openApp();
    await header("We couldn't confirm your age");

    await fireEvent.press(button('Try the age check again'));
    expect(await header('How old are you?')).toBeOnTheScreen();
    noTabBar();
    await fireEvent.press(screen.getByRole('radio', { name: '18 or older' }));
    await fireEvent.press(button('Continue'));

    await waitFor(() => expect(screen.getByTestId('tab-bar')).toBeOnTheScreen());
    // A restricted account renews its token first, for its restricted paths.
    expect(service().calls.map((call) => call.method).filter((method) => method !== 'renew')).toEqual(['resume', 'checkAge', 'answerAgeQuestion']);
    expect(service().calls[1]).toEqual({ method: 'renew' });
  });

  it('says so when a retry still can’t confirm it, and stays paused', async () => {
    launch.stored = UNRESOLVED;
    await openApp();
    await header("We couldn't confirm your age");
    service().next.check.push({ status: 'unresolved' });

    await fireEvent.press(button('Try the age check again'));
    expect(await screen.findByText("Your age still couldn't be confirmed.")).toBeOnTheScreen();
    noTabBar();
  });

  it('surfaces a required check that can’t be met', async () => {
    launch.stored = { state: 'age-unresolved', accountId: FAKE_ACCOUNT_ID, reason: 'check-unmet' };
    await openApp();
    await header("We couldn't confirm your age");
    expect(screen.getByText(/requires an age check that can't be completed here/)).toBeOnTheScreen();
  });

  it('works in landscape', async () => {
    launch.stored = UNRESOLVED;
    const window = Dimensions.get('window');
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390 }, screen: { ...window, width: 844, height: 390 } }));
    await openApp();
    await header("We couldn't confirm your age");
    expect(button('Try the age check again')).toBeOnTheScreen();
    expect(button('Make a privacy request. See, correct, delete or get a copy of your data')).toBeOnTheScreen();
    await act(() => Dimensions.set({ window, screen: window }));
  });

  it('reflows at the largest text size', async () => {
    launch.stored = UNRESOLVED;
    const window = Dimensions.get('window');
    await act(() => Dimensions.set({ window: { ...window, fontScale: 3.1 }, screen: { ...window, fontScale: 3.1 } }));
    await openApp();
    await header("We couldn't confirm your age");
    expect(screen.getByTestId('first-run-scroll')).toBeOnTheScreen();
    expect(button('Try the age check again')).toBeOnTheScreen();
  });
});

describe('an account found under 13', () => {
  it('is paused with the restricted paths and no retry', async () => {
    launch.stored = INELIGIBLE;
    await openApp();

    expect(await header('Tableside is for people 13 and older')).toBeOnTheScreen();
    noTabBar();
    expect(button('Contact support. Ask about confirming your age')).toBeOnTheScreen();
    expect(button('Make a privacy request. See, correct, delete or get a copy of your data')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try the age check again' })).toBeNull();
  });
});

describe('a gate change while the app is open', () => {
  it('replaces Home with the paused screen when ineligibility is learned, and returns once eligibility is established', async () => {
    launch.stored = SIGNED_IN;
    await openApp();
    await waitFor(() => expect(screen.getByTestId('tab-bar')).toBeOnTheScreen());

    await act(() => service().setGate(INELIGIBLE));
    expect(await header('Tableside is for people 13 and older')).toBeOnTheScreen();
    noTabBar();

    await act(() => service().setGate({ state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '16-17' }));
    await waitFor(() => expect(screen.getByTestId('tab-bar')).toBeOnTheScreen());
  });
});

describe('privacy', () => {
  it('never puts the age band in a label, announcement or log on the paused screens', async () => {
    launch.stored = { state: 'age-unresolved', accountId: FAKE_ACCOUNT_ID, reason: 'check-pending' };
    await openApp();
    await header("We couldn't confirm your age");
    await act(() => service().setGate(INELIGIBLE));
    await header('Tableside is for people 13 and older');

    const band = /13-15|16-17|18\+|under-13|13 to 15|16 to 17|18 or older/;
    expect(everythingSpoken().filter((text) => band.test(text))).toEqual([]);
    expect(announcements.filter((text) => band.test(text))).toEqual([]);
    expect(logged.map((args) => args.map(String).join(' ')).filter((text) => band.test(text))).toEqual([]);
  });
});

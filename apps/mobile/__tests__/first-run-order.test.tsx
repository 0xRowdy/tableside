// Spec 3 First-run order, Amendment 1 A1, Amendment 2 §1, Amendment 4 §4; Testing Decisions › Seam 3; Launch gate 1; S2-16 zJjsp; #146
// Amendment 2 §1 (no Auth user): packages/account/test/provider-sign-in.test.ts

import type { AccountGate } from '@tableside/account';
import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { FAKE_ACCOUNT_ID, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
import type { GameId } from '@/games';

type Launch = { stored: AccountGate; offlineGame: GameId | null; latest: ReturnType<typeof fakeAppAccount> | null };
const launch = jest.requireMock<Launch>('@/account/app-account');
const account = () => launch.latest!;
const calls = () => account().service.calls.map((call) => call.method);

const EMAIL = 'player@example.com';
const CODE = '482913';

let requests: unknown[];

beforeAll(async () => {
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  launch.stored = { state: 'no-account' };
  launch.offlineGame = null;
  requests = [];
  global.fetch = jest.fn(async (...args: unknown[]) => {
    requests.push(args);
    throw new Error('no network in the first run test');
  }) as unknown as typeof fetch;
});

afterAll(() => {
  launch.stored = SIGNED_IN;
  launch.offlineGame = 'blackjack';
});

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

// Spec 3 Launch gate 1
function expectNothingPastTheGate() {
  expect(screen.queryByTestId('tab-bar')).toBeNull();
  expect(screen.queryByTestId('start-here')).toBeNull();
  expect(screen.queryAllByTestId(/^first-use-hint-/)).toEqual([]);
  expect(screen.queryByRole('header', { name: /^(Lessons|App orientation|Learning)$/ })).toBeNull();
  expect(screen.queryByText(/goal|trip|coach level|skill level|Skip — just let me play/i)).toBeNull();
  expect(requests).toEqual([]);
}

async function step(name: string | RegExp) {
  expect(await header(name)).toBeOnTheScreen();
  expectNothingPastTheGate();
}

async function chooseOfflineGameThenHome() {
  await step('Choose your offline game');
  await fireEvent.press(screen.getByRole('radio', { name: /^Craps\b/ }));
  await fireEvent.press(button('Continue'));
  expect(await screen.findByTestId('tab-bar')).toBeOnTheScreen();
  expect(await screen.findByTestId('start-here')).toBeOnTheScreen();
  expect(account().offlineGames.get(FAKE_ACCOUNT_ID)).toBe('craps');
}

async function openWelcome(initialUrl = '/') {
  await renderRouter('./src/app', { initialUrl });
  await step('Tableside');
}

async function createAs(range: string) {
  await fireEvent.press(screen.getByRole('radio', { name: "I'm new here" }));
  await fireEvent.press(button('Continue'));
  await step('How old are you?');
  await fireEvent.press(screen.getByRole('radio', { name: range }));
  await fireEvent.press(button('Continue'));
}

describe('first-run order', () => {
  it('Create by email: welcome, age, method, code, offline game, then Home with Start here', async () => {
    await openWelcome();
    await createAs('18 or older');
    await step('How do you want to sign in?');
    await fireEvent.press(button('Create with an email code'));
    await step('Create your account');
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    await step('Enter your code');
    await fireEvent.changeText(screen.getByLabelText('Code'), CODE);
    await fireEvent.press(button('Continue'));
    await chooseOfflineGameThenHome();
    expect(calls()).toEqual(['resume', 'answerAgeQuestion', 'requestEmailCode', 'verifyEmailCode']);
  });

  it('Create with Apple: age before the method, then the offline game, then Home', async () => {
    await openWelcome();
    await createAs('16 to 17');
    await step('How do you want to sign in?');
    await fireEvent.press(button('Continue with Apple'));
    await chooseOfflineGameThenHome();
    expect(calls()).toEqual(['resume', 'answerAgeQuestion', 'createWithProvider']);
  });

  it('Sign in by email: the method only, never age, then the offline game, then Home', async () => {
    await openWelcome();
    await fireEvent.press(button('Sign in with an email code'));
    await step('Sign in');
    await fireEvent.changeText(screen.getByLabelText('Email address'), EMAIL);
    await fireEvent.press(button('Send code'));
    await step('Enter your code');
    await fireEvent.changeText(screen.getByLabelText('Code'), CODE);
    await fireEvent.press(button('Continue'));
    await chooseOfflineGameThenHome();
    expect(calls()).toEqual(['resume', 'requestEmailCode', 'verifyEmailCode']);
  });

  it('Sign in that finds no account offers Create, which runs the age step before anything is created', async () => {
    await openWelcome();
    account().service.next.providerSignIn.push({ status: 'no-account' });
    await fireEvent.press(button('Sign in with Google'));
    await step('No account for this Google account');
    expect(account().service.gate).toEqual({ state: 'no-account' });
    await fireEvent.press(button('Create an account'));
    await step('How old are you?');
    expect(calls()).toEqual(['resume', 'signInWithProvider']);
    await fireEvent.press(screen.getByRole('radio', { name: '13 to 15' }));
    await fireEvent.press(button('Continue'));
    await chooseOfflineGameThenHome();
    expect(calls()).toEqual(['resume', 'signInWithProvider', 'answerAgeQuestion', 'createWithProvider']);
  });

  it.each([
    ['on Create', async () => createAs('Under 13')],
    [
      'after a Sign in found no account',
      async () => {
        account().service.next.providerSignIn.push({ status: 'no-account' });
        await fireEvent.press(button('Sign in with Apple'));
        await step('No account for this Apple ID');
        await fireEvent.press(button('Create an account'));
        await step('How old are you?');
        await fireEvent.press(screen.getByRole('radio', { name: 'Under 13' }));
        await fireEvent.press(button('Continue'));
      },
    ],
  ])('under 13 %s ends with no account, no Home and no teaching', async (_, answerUnder13) => {
    await openWelcome();
    await answerUnder13();
    await step('Tableside is for people 13 and older');
    expect(account().service.gate).toEqual({ state: 'no-account' });
    expect(calls()).not.toContain('createWithProvider');
    expect(calls()).not.toContain('requestEmailCode');
  });
});

describe('teaching never bypasses the first run', () => {
  it.each(['/more/settings/learning', '/more/settings/learning/lessons', '/more/settings/learning/lessons/app-orientation', '/counting'])(
    'opening %s on a fresh installation lands on Welcome',
    async (initialUrl) => {
      await openWelcome(initialUrl);
    },
  );

  it('a signed-in account without its offline game is asked for it before any lesson', async () => {
    launch.stored = { state: 'active', accountId: FAKE_ACCOUNT_ID, eligibility: '18+' };
    await renderRouter('./src/app', { initialUrl: '/more/settings/learning/lessons/app-orientation' });
    await step('Choose your offline game');
  });

  it('dismissing Start here leaves the first run as it was: a reopened app still needs its steps after sign-out', async () => {
    launch.stored = SIGNED_IN;
    launch.offlineGame = 'blackjack';
    await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Dismiss Start here' }));
    expect(screen.queryByTestId('start-here')).toBeNull();

    await cleanup();
    launch.stored = { state: 'no-account' };
    launch.offlineGame = null;
    await openWelcome();
  });
});

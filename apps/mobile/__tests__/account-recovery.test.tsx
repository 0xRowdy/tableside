// Spec 2 Account gate, Amendment 9 §1

import type { AccountGate } from '@tableside/account';
import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { FAKE_ACCOUNT_ID, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
import type { GameId } from '@/games';

type Launch = { stored: AccountGate; offlineGame: GameId | null; latest: ReturnType<typeof fakeAppAccount> | null };
const launch = jest.requireMock<Launch>('@/account/app-account');
const service = () => launch.latest!.service;

beforeAll(async () => {
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  launch.offlineGame = 'blackjack';
});

afterAll(() => {
  launch.stored = SIGNED_IN;
});

const openApp = () => renderRouter('./src/app', { initialUrl: '/' });
const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

function supportLinks() {
  expect(screen.getByRole('link', { name: /Contact support/ })).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: /Make a privacy request/ })).toBeOnTheScreen();
  expect(screen.queryByTestId('tab-bar')).toBeNull();
}

describe('Recovery needed', () => {
  beforeEach(() => {
    launch.stored = { state: 'recovery-needed', accountId: FAKE_ACCOUNT_ID };
  });

  it('explains that the data is kept, and restores synced history through a new sign-in', async () => {
    await openApp();
    expect(await header("Your data can't be opened")).toBeOnTheScreen();
    expect(screen.getByText(/kept the data exactly as it was, and won't replace or delete it/)).toBeOnTheScreen();
    expect(screen.getByText(/Records that hadn't synced yet stay only in the kept copy/)).toBeOnTheScreen();
    supportLinks();

    await fireEvent.press(button('Restore synced history'));
    expect(service().calls).toContainEqual({ method: 'recover' });
    expect(await header("You're signed out")).toBeOnTheScreen();
    expect(button('Sign in')).toBeOnTheScreen();
  });

  it('can sign out, or go on to another account, without restoring', async () => {
    await openApp();
    await header("Your data can't be opened");
    await fireEvent.press(button('Use a different account'));
    expect(service().calls).toContainEqual({ method: 'signOut' });
    expect(service().calls).not.toContainEqual({ method: 'recover' });
    expect(service().gate).toEqual({ state: 'signed-out', accountId: FAKE_ACCOUNT_ID });
  });
});

describe('a database this build cannot open', () => {
  it('from a later build asks for the update, keeping everything', async () => {
    launch.stored = { state: 'database-unavailable', accountId: FAKE_ACCOUNT_ID, reason: 'needs-update' };
    await openApp();
    expect(await header('Update Tableside')).toBeOnTheScreen();
    expect(screen.getByText(/saved by a newer version of Tableside/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Restore synced history' })).toBeNull();
    supportLinks();
    await fireEvent.press(button('Sign out'));
    expect(await header("You're signed out")).toBeOnTheScreen();
  });

  it('after a failed migration says it was left as it was, and that reopening tries again', async () => {
    launch.stored = { state: 'database-unavailable', accountId: FAKE_ACCOUNT_ID, reason: 'migration-failed' };
    await openApp();
    expect(await header("Your data can't be opened yet")).toBeOnTheScreen();
    expect(screen.getByText(/left it exactly as it was\. Close and reopen the app to try again/)).toBeOnTheScreen();
    supportLinks();
  });
});

// Seam 3: Devices (#101, S2-19) and the locked state of a device that was
// signed out from another (S2-23), through the real routes and the
// accessibility tree, over Account-service fakes: the sign-ins with what each
// device calls itself and "this device", signing one or all others out after
// Confirm it's you, and the lock that keeps records until a fresh sign-in.

import type { AccountGate } from '@tableside/account';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Dimensions, Linking, Platform } from 'react-native';

import { FAKE_ACCOUNT_ID, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
import type { GameId } from '@/games';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true) }) };
});

type Launch = { stored: AccountGate; offlineGame: GameId | null; latest: ReturnType<typeof fakeAppAccount> | null };
const launch = jest.requireMock<Launch>('@/account/app-account');
const service = () => launch.latest!.service;

/** How the copy names this device. */
const DEVICE = Platform.OS === 'ios' ? 'iPhone' : 'device';

let logged: unknown[][] = [];

beforeAll(async () => {
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args));
  }
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  launch.stored = SIGNED_IN;
  launch.offlineGame = 'blackjack';
  logged = [];
});

afterEach(() => setWindow(390, 844));

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const sheet = (testID: string) => within(screen.getByTestId(testID));

/** Opens Devices from Account, after `prepare` scripts the fake. */
async function openDevices(prepare?: () => void) {
  await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
  prepare?.();
  await fireEvent.press(await screen.findByRole('button', { name: /^Devices\./ }));
  await header('Devices');
  await screen.findByLabelText(/^iPhone 15 · iOS 18\./);
}

describe('Devices', () => {
  it('lists each sign-in with what the device calls itself, when it was last active and which is this one', async () => {
    await openDevices();
    expect(screen.getByText("Devices signed in to your account. This shows sign-ins, not where a device is now. Labels come from the device; they're private to you.")).toBeOnTheScreen();
    expect(screen.getByLabelText('iPhone 15 · iOS 18. Last active now. This device')).toBeOnTheScreen();
    expect(screen.getByLabelText('iPad Air · iPadOS 18. Last active 2 days ago')).toBeOnTheScreen();
    expect(screen.getByLabelText('Pixel 8 · Android 15. Last active 3 months ago')).toBeOnTheScreen();
    // This device signs out with Sign out, on Account; every other one here.
    expect(button('Sign out iPad Air')).toBeOnTheScreen();
    expect(button('Sign out Pixel 8')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sign out iPhone 15' })).toBeNull();
    expect(button('Sign out all other devices')).toBeOnTheScreen();
  });

  it('signs another device out after Confirm it’s you, and says the security email went', async () => {
    await openDevices(() => service().devicesNext.signOut.push({ status: 'fresh-authentication-required' }));
    await fireEvent.press(button('Sign out Pixel 8'));
    expect(await header('Sign out Pixel 8?')).toBeOnTheScreen();
    const confirm = sheet('sign-out-devices');
    expect(
      confirm.getByText("It locks Tableside on that device and keeps its records until someone signs in to this account again. If it's offline, it'll find out the next time it connects."),
    ).toBeOnTheScreen();
    expect(confirm.getByText("You'll need to confirm it's you first. We'll send a security email.")).toBeOnTheScreen();
    await fireEvent.press(confirm.getByRole('button', { name: 'Sign out Pixel 8' }));

    // Confirm it's you, with one of the account's methods; then the sign-out goes through.
    const fresh = within(await screen.findByTestId('confirm-its-you'));
    await fireEvent.press(fresh.getByRole('button', { name: /Apple/ }));
    expect(await screen.findByText('Signed out Pixel 8')).toBeOnTheScreen();
    expect(screen.getByText("Pixel 8 can't open your account until someone signs in again. We've sent a security email to player@example.com.")).toBeOnTheScreen();
    expect(service().deviceCalls).toEqual(['sign-out device-pixel', 'sign-out device-pixel']);
    expect(service().methodCalls).toEqual(['fresh apple']);
    expect(screen.queryByLabelText(/^Pixel 8/)).toBeNull();
  });

  it('signs out all other devices, keeping this one', async () => {
    await openDevices();
    await fireEvent.press(button('Sign out all other devices'));
    expect(await header('Sign out 2 other devices?')).toBeOnTheScreen();
    const confirm = sheet('sign-out-devices');
    expect(
      confirm.getByText(
        `iPad Air and Pixel 8 lock Tableside and keep their records until someone signs in to this account again. Offline devices find out the next time they connect. This ${DEVICE} stays signed in.`,
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(confirm.getByRole('button', { name: 'Sign out 2 other devices' }));

    expect(await screen.findByText('Signed out 2 other devices')).toBeOnTheScreen();
    expect(screen.getByText("iPad Air and Pixel 8 can't open your account until someone signs in again. We've sent a security email to player@example.com.")).toBeOnTheScreen();
    expect(service().deviceCalls).toEqual(['sign-out-others']);
    expect(screen.getByLabelText('iPhone 15 · iOS 18. Last active now. This device')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sign out all other devices' })).toBeNull();
  });

  it('changes nothing when cancelled, and explains a failure', async () => {
    await openDevices(() => service().devicesNext.signOut.push({ status: 'failed' }));
    await fireEvent.press(button('Sign out iPad Air'));
    await fireEvent.press(sheet('sign-out-devices').getByRole('button', { name: 'Cancel' }));
    expect(service().deviceCalls).toEqual([]);

    await fireEvent.press(button('Sign out iPad Air'));
    await fireEvent.press(sheet('sign-out-devices').getByRole('button', { name: 'Sign out iPad Air' }));
    expect(await screen.findByText("Couldn't sign out. Check your connection and try again.")).toBeOnTheScreen();
    expect(screen.getByLabelText(/^iPad Air/)).toBeOnTheScreen();
  });

  it('needs a connection', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
    service().deviceEntries = null;
    await fireEvent.press(await screen.findByRole('button', { name: /^Devices\./ }));
    expect(await screen.findByText('Devices need a connection. Check it, then come back.')).toBeOnTheScreen();
  });

  it('scrolls at the largest text size, and its sheet stays operable', async () => {
    await setWindow(390, 844, 3);
    await openDevices();
    expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
    await fireEvent.press(button('Sign out all other devices'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out 2 other devices' }));
    expect(await screen.findByText('Signed out 2 other devices')).toBeOnTheScreen();
    // No device label or address reached a log.
    expect(JSON.stringify(logged)).not.toMatch(/iPad|Pixel|player@example\.com/);
  });
});

describe('a device signed out from another', () => {
  const revoked: AccountGate = { state: 'revoked', accountId: FAKE_ACCOUNT_ID, revokedAt: new Date(2026, 9, 17, 12).getTime(), by: 'device' };

  it('reopens locked, with its records kept, offering a fresh sign-in and the support links', async () => {
    launch.stored = revoked;
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await header(`This ${DEVICE} was signed out`)).toBeOnTheScreen();
    expect(
      screen.getByText(`Your account was signed out on this ${DEVICE} from another device on 17 Oct 2026. Your records here are kept. Sign in to the same account to open them.`),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact support' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Make a privacy request' })).toBeOnTheScreen();

    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await fireEvent.press(button("I didn't do this"));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/support/));

    await fireEvent.press(button('Sign in'));
    expect(await header('Sign in')).toBeOnTheScreen();
  });

  it('says when a sign-in method’s provider withdrew it rather than another device', async () => {
    launch.stored = { ...revoked, by: 'provider' } as AccountGate;
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(
      await screen.findByText(
        `Your account was signed out on this ${DEVICE} on 17 Oct 2026, when the Apple or Google sign-in it used stopped working with Tableside. Your records here are kept. Sign in to the same account to open them.`,
      ),
    ).toBeOnTheScreen();
  });

  it('locks the moment the gate learns it, from anywhere in the app', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
    await header('Account');
    await act(() => service().setGate(revoked));
    expect(await header(`This ${DEVICE} was signed out`)).toBeOnTheScreen();
  });
});

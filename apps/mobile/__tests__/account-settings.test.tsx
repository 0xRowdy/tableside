// Seam 3: More → Settings → Account and signing out of this device (#99,
// S2-17), and the signed-out locked state (S2-23), through the real routes and
// the accessibility tree, over Account-service fakes.

import type { AccountGate } from '@tableside/account';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, Linking, Platform } from 'react-native';

import { FAKE_ACCOUNT_ID, FAKE_SUMMARY, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
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
  launch.stored = SIGNED_IN;
  launch.offlineGame = 'blackjack';
  announcements = [];
  logged = [];
});

afterEach(() => setWindow(390, 844));

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function openAccount(prepare?: () => void) {
  await renderRouter('./src/app', { initialUrl: '/more/settings' });
  prepare?.();
  await fireEvent.press(await screen.findByRole('button', { name: /^Account\b/ }));
  await header('Account');
  await screen.findByRole('button', { name: /^Devices\. 3 signed in/ });
}

describe('Settings → Account', () => {
  it('is reached from More → Settings, with a summary on its row, keeping the tab bar on More', async () => {
    await renderRouter('./src/app', { initialUrl: '/more' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Settings\b/ }));
    await header('Settings');
    expect(await screen.findByRole('button', { name: 'Account. Apple and email · synced' })).toBeOnTheScreen();

    await fireEvent.press(button(/^Account\b/));
    expect(await header('Account')).toBeOnTheScreen();
    expect(button('Back to Settings')).toBeOnTheScreen();
    expect(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('shows identity with the email kept private, then security, your data, Delete account and Sign out', async () => {
    await openAccount();

    expect(button("Display name. Not set. You'll choose one the first time you publish or rate. Set")).toBeOnTheScreen();
    // The sign-in email is information, not a control, and says it stays private.
    expect(screen.getByText('player@example.com · private, never shown to other players')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Sign-in email/ })).toBeNull();
    expect(button('Currency. US dollar (USD) · used for casino records')).toBeOnTheScreen();
    expect(button('Sign-in methods. Apple, email code. 2')).toBeOnTheScreen();
    expect(button(`Devices. 3 signed in, including this ${DEVICE}. 3`)).toBeOnTheScreen();
    expect(button('Sync status. All synced')).toBeOnTheScreen();
    expect(button('Download all history. Keep everything on this device, for offline trips')).toBeOnTheScreen();
    expect(button('Export my data. Spreadsheet and data files, plus anything not yet synced')).toBeOnTheScreen();
    expect(button('Delete account. Choose a 30-day undo or permanent deletion')).toBeOnTheScreen();
    expect(button('Sign out of this device')).toBeOnTheScreen();
    expect(screen.getByText('Signs out only this device. Unsynced work stays here until you sign back in to this account.')).toBeOnTheScreen();
  });

  it('counts records waiting to sync, and opens each entry', async () => {
    await openAccount(() => {
      service().waitingCount = 4;
    });
    // The count is read when the screen opens.
    expect(await screen.findByRole('button', { name: 'Sync status. 4 records waiting to sync' })).toBeOnTheScreen();

    for (const [entry, title] of [
      ['Sign-in methods', 'Sign-in methods'],
      ['Devices', 'Devices'],
      ['Sync status', 'Sync status'],
      ['Download all history', 'Download all history'],
      ['Export my data', 'Export my data'],
      ['Delete account', 'Delete account'],
    ] as const) {
      await fireEvent.press(button(new RegExp(`^${entry}\\.`)));
      expect(await header(title)).toBeOnTheScreen();
      await fireEvent.press(button('Back to Account'));
      await header('Account');
    }
  });

  it('changes the account currency online, and explains when it needs a connection', async () => {
    await openAccount();
    await fireEvent.press(button(/^Currency\b/));
    await header('Currency');
    expect(screen.getByRole('radio', { name: 'US dollar (USD)', checked: true })).toBeOnTheScreen();

    service().next.currency.push({ status: 'failed' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Euro (EUR)' }));
    expect(await screen.findByText("Couldn't change the currency. Changing it needs a connection; try again when you're online.")).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'US dollar (USD)', checked: true })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Euro (EUR)' }));
    expect(await header('Account')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Currency. Euro (EUR) · used for casino records' })).toBeOnTheScreen();
    expect(service().calls.filter((call) => call.method === 'setAccountCurrency')).toEqual([
      { method: 'setAccountCurrency', currency: 'EUR' },
      { method: 'setAccountCurrency', currency: 'EUR' },
    ]);
  });

  it("can't change the currency while any casino session exists", async () => {
    await openAccount(() => {
      service().summary = { ...FAKE_SUMMARY, currencyChangeable: false };
    });
    expect(await screen.findByText("US dollar (USD) · can't change while you have casino sessions")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Currency\b/ })).toBeNull();
  });

  it('asks before signing out, saying unsynced records stay here, and Cancel changes nothing', async () => {
    await openAccount(() => {
      service().waitingCount = 4;
    });
    await screen.findByRole('button', { name: /4 records waiting/ });
    await fireEvent.press(button('Sign out of this device'));

    expect(await header(`Sign out of this ${DEVICE}?`)).toBeOnTheScreen();
    expect(
      screen.getByText(
        `Your session is saved and paused. 4 records haven't synced yet: they stay on this ${DEVICE}, locked, until you sign back in to this account. If you delete the app first, they're lost.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Export the local supplement first if you want a copy. Other devices stay signed in.')).toBeOnTheScreen();

    await fireEvent.press(button('Cancel'));
    await waitFor(() => expect(screen.queryByRole('header', { name: `Sign out of this ${DEVICE}?` })).toBeNull());
    expect(service().calls.some((call) => call.method === 'signOut')).toBe(false);
    expect(service().gate).toEqual(SIGNED_IN);
  });

  it('signs out to the locked state, which has no tab bar and links to support and privacy requests', async () => {
    const opened = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openAccount();
    await fireEvent.press(button('Sign out of this device'));
    await header(`Sign out of this ${DEVICE}?`);
    await fireEvent.press(button('Sign out'));

    expect(await header("You're signed out")).toBeOnTheScreen();
    expect(service().gate).toEqual({ state: 'signed-out', accountId: FAKE_ACCOUNT_ID });
    expect(
      screen.getByText(
        `Your records for this account are kept on this ${DEVICE}, locked. Sign in to the same account to open them. Signing in needs a connection.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Someone signing in with a different account won't see these records.")).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    // The sign-out never claims more than it did.
    expect(announcements.join(' ')).not.toMatch(/server|every device|all devices/i);

    await fireEvent.press(screen.getByRole('link', { name: 'Contact support' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Make a privacy request' }));
    expect(opened.mock.calls.map(([url]) => url)).toEqual(['https://tableside.app/support', 'https://tableside.app/privacy-request']);
    expect(screen.getByText('These open tableside.app and work without signing in.')).toBeOnTheScreen();
    opened.mockRestore();
  });

  it('suspends an open practice session before signing out', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
    await header('Account');
    const ending = jest.fn(async () => undefined);
    service().onSessionEnding(ending);
    await fireEvent.press(button('Sign out of this device'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    await header("You're signed out");
    // The app's practice provider's handler and this one both ran before the gate moved.
    expect(ending).toHaveBeenCalledTimes(1);
  });
});

describe('the signed-out locked state', () => {
  it('is where the app reopens after a sign-out, offering sign-in to the same account or another', async () => {
    launch.stored = { state: 'signed-out', accountId: FAKE_ACCOUNT_ID };
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await header("You're signed out")).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();

    await fireEvent.press(button('Sign in'));
    expect(await header('Sign in')).toBeOnTheScreen();
    await fireEvent.press(button('Back'));
    await header("You're signed out");

    await fireEvent.press(button('Use a different account'));
    expect(await header('Tableside')).toBeOnTheScreen();
  });

  it('never opens the signed-in app', async () => {
    launch.stored = { state: 'signed-out', accountId: FAKE_ACCOUNT_ID };
    await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
    expect(await header("You're signed out")).toBeOnTheScreen();
  });
});

describe.each([
  ['portrait at the largest text size', 390, 844, 3],
  ['landscape at the largest text size', 844, 390, 3],
  ['landscape', 844, 390, 1],
])('in %s', (_, width, height, fontScale) => {
  it('every screen scrolls, and the sheet stays operable', async () => {
    await setWindow(width, height, fontScale);
    await openAccount();
    expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
    expect(button('Sign out of this device')).toBeOnTheScreen();

    await fireEvent.press(button(/^Currency\b/));
    await header('Currency');
    expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
    await fireEvent.press(button('Back to Account'));
    await header('Account');

    await fireEvent.press(button('Sign out of this device'));
    expect(await screen.findByTestId('sign-out-scroll')).toBeOnTheScreen();
    await fireEvent.press(button('Sign out'));
    await header("You're signed out");
    expect(screen.getByTestId('first-run-scroll')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Contact support' })).toBeOnTheScreen();
    // Nothing private reached a log.
    expect(JSON.stringify(logged)).not.toContain('player@example.com');
  });
});

// #103, #104; spec 2 S2-22, S2-23

import type { AccountGate } from '@tableside/account';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Dimensions, Linking, Platform } from 'react-native';

import { dayText } from '@/account/account-text';
import { FAKE_ACCOUNT_ID, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
import type { GameId } from '@/games';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true) }) };
});

type Launch = { stored: AccountGate; offlineGame: GameId | null; latest: ReturnType<typeof fakeAppAccount> | null };
const launch = jest.requireMock<Launch>('@/account/app-account');
const account = () => launch.latest!;
const service = () => account().service;

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

const DAY = 86_400_000;
const STORE =
  Platform.OS === 'ios'
    ? { name: 'App Store', manage: 'https://apps.apple.com/account/subscriptions', refund: 'https://reportaproblem.apple.com' }
    : { name: 'Google Play', manage: 'https://play.google.com/store/account/subscriptions', refund: 'https://support.google.com/googleplay/answer/2479637' };
const DEADLINE = Date.UTC(2026, 11, 15, 12);
const SCHEDULED: AccountGate = { state: 'deletion-scheduled', accountId: FAKE_ACCOUNT_ID, deadline: DEADLINE };

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const noTabBar = () => expect(screen.queryByTestId('tab-bar')).toBeNull();

async function openDelete(prepare?: () => void) {
  await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
  prepare?.();
  await fireEvent.press(await screen.findByRole('button', { name: /^Delete account\./ }));
  const fresh = within(await screen.findByTestId('confirm-its-you'));
  expect(fresh.getByText("Deleting your account starts here, so sign in again first. Being signed in already isn't enough for this.")).toBeOnTheScreen();
  await fireEvent.press(fresh.getByRole('button', { name: /Apple/ }));
  await waitFor(() => expect(screen.queryByTestId('confirm-its-you')).toBeNull());
}

describe('Delete account', () => {
  it('confirms it’s you first, then offers the export, the store’s billing paths and the scheduling warnings', async () => {
    await openDelete();
    expect(await header('Delete account')).toBeOnTheScreen();
    expect(service().methodCalls).toEqual(['fresh apple']);
    expect(button("Export my data first. Get a copy of your data before you go. Deletion doesn't wait for it.")).toBeOnTheScreen();
    expect(button(`Manage subscription. In the ${STORE.name}. Deleting your account doesn't cancel it.`)).toBeOnTheScreen();
    expect(button(`Request a refund. Through the ${STORE.name}, which decides refunds.`)).toBeOnTheScreen();
    for (const warning of [
      'Access locks now. Practice and your account lock now, and on your other devices once they connect.',
      'Public content is hidden. Your profile, strategies, ratings and contributions are hidden at once.',
      'Your data is kept. Nothing is deleted for 30 days. Sign in and choose Cancel deletion to keep your account.',
      `Billing continues. Your subscription isn't canceled. Cancel it in the ${STORE.name} if you don't want to be charged.`,
    ]) {
      expect(screen.getByLabelText(warning)).toBeOnTheScreen();
    }
    expect(button('Schedule deletion')).toBeOnTheScreen();
    expect(button('Delete permanently now')).toBeOnTheScreen();
    expect(screen.queryByText(/Premium|Subscribe|Buy|Upgrade|was canceled|refunded/)).toBeNull();
  });

  it('opens Export my data from the export offer', async () => {
    await openDelete();
    await fireEvent.press(await screen.findByRole('button', { name: /^Export my data first\./ }));
    expect(await header('Export my data')).toBeOnTheScreen();
  });

  it('opens the store’s own subscription and refund pages', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openDelete();
    await fireEvent.press(await screen.findByRole('button', { name: /^Manage subscription\./ }));
    await fireEvent.press(button(/^Request a refund\./));
    expect(open.mock.calls.map(([url]) => url)).toEqual([STORE.manage, STORE.refund]);
    open.mockRestore();
  });

  it('schedules deletion, then locks to the scheduled screen with the date and no tab bar', async () => {
    await openDelete(() => service().deletionNext.schedule.push({ status: 'scheduled', deadline: DEADLINE }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Schedule deletion' }));

    expect(await header('Your account is scheduled for deletion')).toBeOnTheScreen();
    expect(service().deletionCalls).toContain('schedule');
    expect(screen.getByText(new RegExp(`^It will be deleted permanently on ${dayText(DEADLINE)}\\.`))).toBeOnTheScreen();
    noTabBar();
  });

  it('explains that deletion needs a connection, with nothing queued', async () => {
    await openDelete(() => service().deletionNext.schedule.push({ status: 'offline' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Schedule deletion' }));
    expect(await screen.findByText("Deleting your account needs a connection, and nothing is saved to send later. Connect, then try again.")).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Delete account' })).toBeOnTheScreen();
  });

  it('asks to try again when no answer came, and trying again shows what happened', async () => {
    await openDelete(() => service().deletionNext.schedule.push({ status: 'failed' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Schedule deletion' }));
    expect(
      await screen.findByText("Couldn't tell whether deletion was scheduled. Check your connection and try again; it won't be scheduled twice."),
    ).toBeOnTheScreen();
    await fireEvent.press(button('Schedule deletion'));
    expect(await header('Your account is scheduled for deletion')).toBeOnTheScreen();
    expect(service().deletionCalls.filter((call) => call === 'schedule')).toHaveLength(2);
  });

  it('confirms it’s you again when the confirmation ran out before scheduling', async () => {
    await openDelete(() => service().deletionNext.schedule.push({ status: 'fresh-authentication-required' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Schedule deletion' }));
    await fireEvent.press(within(await screen.findByTestId('confirm-its-you')).getByRole('button', { name: /Apple/ }));
    expect(await header('Your account is scheduled for deletion')).toBeOnTheScreen();
  });

  it('needs a connection to begin: Confirm it’s you can’t be offered offline', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
    service().methods = null;
    await fireEvent.press(await screen.findByRole('button', { name: /^Delete account\./ }));
    expect(await screen.findByText("Deleting your account needs a connection, and nothing is saved to send later. Connect, then try again.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Schedule deletion' })).toBeNull();
  });

  it('is reached from an age-restricted account’s paused screen too', async () => {
    launch.stored = { state: 'age-unresolved', accountId: FAKE_ACCOUNT_ID, reason: 'not-established' };
    await renderRouter('./src/app', { initialUrl: '/delete-account' });
    await fireEvent.press(within(await screen.findByTestId('confirm-its-you')).getByRole('button', { name: /Apple/ }));
    expect(await header('Delete account')).toBeOnTheScreen();
    await fireEvent.press(button('Schedule deletion'));
    expect(await header('Your account is scheduled for deletion')).toBeOnTheScreen();
  });
});

describe('Delete permanently now', () => {
  const PERMANENT_WARNINGS = [
    'Records that haven\'t synced are lost. 2 records on this device haven\'t reached your account. They\'re erased with it, and can\'t be recovered.',
    'Shown as "Deleted author". Your profile and strategy descriptions are removed. Strategies others saved or remixed keep working, credited to "Deleted author".',
    `Paid time is forfeited. Any subscription time left is lost. Deleting doesn't cancel the subscription: cancel it in the ${STORE.name} so you aren't charged again.`,
    "There's no undo. Your account and its data are erased within seven days, and the account can't come back.",
  ];
  const PROGRESS = {
    status: 'processing' as const,
    deletedAt: DEADLINE - 30 * DAY,
    cleanupBy: DEADLINE - 23 * DAY,
    completedAt: null,
    delayed: false,
    analytics: { requestedAt: DEADLINE - 30 * DAY, completedAt: null },
    providers: null,
  };

  async function openPermanent(prepare?: () => void) {
    await openDelete(() => {
      service().waitingCount = 2;
      prepare?.();
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete permanently now' }));
    expect(await screen.findByText('If you delete permanently now')).toBeOnTheScreen();
  }

  it('shows its own warnings and asks once more before anything is deleted', async () => {
    await openPermanent();
    for (const warning of PERMANENT_WARNINGS) expect(await screen.findByLabelText(warning)).toBeOnTheScreen();
    expect(service().deletionCalls).not.toContain('delete-permanently');
    await fireEvent.press(button('Keep my account'));
    expect(screen.queryByText('If you delete permanently now')).toBeNull();
    expect(service().deletionCalls).not.toContain('delete-permanently');
    expect(screen.queryByText(/was canceled|refunded/)).toBeNull();
  });

  it('deletes, then shows Deleted with its status and no tab bar; Done leaves for the welcome screen', async () => {
    await openPermanent(() => (service().deletionProgress = PROGRESS));
    await fireEvent.press(button('Delete permanently now'));
    expect(await header('Your account was deleted')).toBeOnTheScreen();
    noTabBar();
    expect(service().deletionCalls).toContain('delete-permanently');
    expect(
      await screen.findByText(`Its data is being erased from Tableside, by ${dayText(PROGRESS.cleanupBy)}. Nothing of it is left on this device.`),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(`Deletion. Processing · finished by ${dayText(PROGRESS.cleanupBy)}`)).toBeOnTheScreen();
    expect(screen.getByLabelText("Analytics data. Erasure requested · the analytics provider hasn't confirmed it yet")).toBeOnTheScreen();
    expect(screen.getByLabelText('Backups. Backups age out on their own schedule, set out in the privacy policy.')).toBeOnTheScreen();
    expect(button(`Manage subscription. In the ${STORE.name}. Deleting your account doesn't cancel it.`)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Contact support' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Make a privacy request' })).toBeOnTheScreen();

    await fireEvent.press(button('Done'));
    expect(service().deletionCalls).toContain('dismiss');
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Your account was deleted' })).toBeNull());
  });

  it('confirms it’s you again when the confirmation ran out, then deletes', async () => {
    await openPermanent(() => service().deletionNext.deletePermanently.push({ status: 'fresh-authentication-required' }));
    await fireEvent.press(button('Delete permanently now'));
    await fireEvent.press(within(await screen.findByTestId('confirm-its-you')).getByRole('button', { name: /Apple/ }));
    expect(await header('Your account was deleted')).toBeOnTheScreen();
  });

  it('needs a connection, and says so when no answer came, deleting nothing twice', async () => {
    await openPermanent(() => service().deletionNext.deletePermanently.push({ status: 'offline' }, { status: 'failed' }));
    await fireEvent.press(button('Delete permanently now'));
    expect(await screen.findByText("Deleting your account needs a connection, and nothing is saved to send later. Connect, then try again.")).toBeOnTheScreen();
    await fireEvent.press(button('Delete permanently now'));
    expect(
      await screen.findByText("Couldn't tell whether your account was deleted. Check your connection and try again; it won't be deleted twice."),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Delete account' })).toBeOnTheScreen();
  });
});

describe('a deleted account', () => {
  it('reopens on Deleted with no tab bar, and says when its status can’t be checked', async () => {
    launch.stored = { state: 'deleted' };
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await header('Your account was deleted')).toBeOnTheScreen();
    noTabBar();
    expect(await screen.findByLabelText("Deletion. Can't check right now. Connect to see how it's going.")).toBeOnTheScreen();
  });
});

describe('a deletion-scheduled account', () => {
  it('is locked with no tab bar, showing the deadline, Cancel deletion, its status and the restricted paths', async () => {
    launch.stored = SCHEDULED;
    service().deletionState = { status: 'scheduled', deadline: DEADLINE, scheduledAt: DEADLINE - 30 * DAY };
    await renderRouter('./src/app', { initialUrl: '/' });

    expect(await header('Your account is scheduled for deletion')).toBeOnTheScreen();
    noTabBar();
    expect(
      screen.getByText(
        `It will be deleted permanently on ${dayText(DEADLINE)}. Until then, practice and your account are locked, your public content is hidden, and your data is kept.`,
      ),
    ).toBeOnTheScreen();
    expect(button('Cancel deletion')).toBeOnTheScreen();
    expect(await screen.findByLabelText(`Deletion status. Scheduled · deleted permanently on ${dayText(DEADLINE)}`)).toBeOnTheScreen();
    const paths = [
      "Export my data. Sign-in needed to confirm it's you",
      'Billing help. Subscriptions and refunds',
      'Contact support. Ask about your account or its deletion',
      'Make a privacy request. See, correct, delete or get a copy of your data',
    ];
    for (const path of paths) await fireEvent.press(button(path));
    expect(account().opened).toEqual(['export', 'billing-help', 'contact-support', 'privacy-request']);
    expect(screen.queryByText(/Premium|Subscribe|Buy|Upgrade/)).toBeNull();
  });

  it('cancels deletion after Confirm it’s you, reopening the same account', async () => {
    launch.stored = SCHEDULED;
    await renderRouter('./src/app', { initialUrl: '/' });
    service().deletionNext.cancel.push({ status: 'fresh-authentication-required' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel deletion' }));
    const fresh = within(await screen.findByTestId('confirm-its-you'));
    expect(fresh.getByText("Canceling deletion reopens your account, so sign in again first. Being signed in already isn't enough for this.")).toBeOnTheScreen();
    await fireEvent.press(fresh.getByRole('button', { name: /Apple/ }));

    await waitFor(() => expect(service().gate).toEqual(SIGNED_IN));
    expect(await screen.findByTestId('tab-bar')).toBeOnTheScreen();
    expect(service().deletionCalls.filter((call) => call === 'cancel')).toHaveLength(2);
  });

  it('says when it’s too late to cancel, or when canceling needs a connection', async () => {
    launch.stored = SCHEDULED;
    await renderRouter('./src/app', { initialUrl: '/' });
    service().deletionNext.cancel.push({ status: 'offline' }, { status: 'too-late' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel deletion' }));
    expect(await screen.findByText('Canceling deletion needs a connection. Connect, then try again.')).toBeOnTheScreen();
    await fireEvent.press(button('Cancel deletion'));
    expect(await screen.findByText("It's too late to cancel: the deletion date has passed, so your account is being deleted.")).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your account is scheduled for deletion' })).toBeOnTheScreen();
  });

  it('opens billing help with the store’s subscription and refund pages', async () => {
    launch.stored = SCHEDULED;
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderRouter('./src/app', { initialUrl: '/billing-help' });
    expect(await header('Billing help')).toBeOnTheScreen();
    await fireEvent.press(button(/^Manage subscription\./));
    expect(open.mock.calls.map(([url]) => url)).toEqual([STORE.manage]);
    open.mockRestore();
  });

  it('reflows at the largest text size, in landscape too, and logs nothing private', async () => {
    launch.stored = SCHEDULED;
    await setWindow(390, 844, 3);
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await header('Your account is scheduled for deletion')).toBeOnTheScreen();
    expect(screen.getByTestId('first-run-scroll')).toBeOnTheScreen();
    await setWindow(844, 390, 3);
    expect(button('Cancel deletion')).toBeOnTheScreen();
    expect(JSON.stringify(logged)).not.toMatch(/player@example\.com|account-1|installation-1/);
  });
});

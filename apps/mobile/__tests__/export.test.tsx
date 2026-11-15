// Seam 3: Export my data (#102, S2-21), through the real routes and the
// accessibility tree, over Account-service fakes: the account archive asked
// for after Confirm it's you, its preparing, ready, expired and cancelled
// states, downloading it to the share sheet, the local supplement made on
// this device, and the note that records on other devices aren't included,
// which is there in every state. An account whose age isn't established
// reaches it from its paused screen.

import type { AccountGate, ServerExport } from '@tableside/account';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import { OTHER_DEVICES_NOTE } from '@/account/ExportScreen';
import { FAKE_ACCOUNT_ID, FAKE_SUPPLEMENT, SIGNED_IN, type fakeAppAccount } from '@/account/testing/fake-account';
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

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const archiveRow = () => screen.getByLabelText(/^Account archive\./);

const HOUR = 3_600_000;
const ready = (): ServerExport => ({ state: 'ready', requestedAt: Date.now() - HOUR, readyAt: Date.now() - HOUR, expiresAt: Date.now() + 23 * HOUR, bytes: 1_234_567 });

/** Opens Export my data from Account, after `prepare` scripts the fake. */
async function openExport(prepare?: () => void) {
  await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
  prepare?.();
  await fireEvent.press(await screen.findByRole('button', { name: /^Export my data\./ }));
  await header('Export my data');
  await waitFor(() => expect(archiveRow()).not.toHaveProp('accessibilityLabel', 'Account archive. Checking…'));
}

describe('Export my data', () => {
  it('offers the account archive and the local supplement, and says records on other devices aren’t included', async () => {
    await openExport();
    expect(archiveRow()).toHaveProp(
      'accessibilityLabel',
      "Account archive. A spreadsheet of your sessions and data files of everything your account holds. It's free, and we'll email you when it's ready.",
    );
    expect(await screen.findByLabelText(/^Local supplement\. 1 record not synced yet, each labeled so it isn't mistaken for a finished session/)).toBeOnTheScreen();
    expect(button('Prepare archive')).toBeOnTheScreen();
    expect(button('Save local supplement')).toBeOnTheScreen();
    expect(screen.getByText(OTHER_DEVICES_NOTE)).toBeOnTheScreen();
    expect(OTHER_DEVICES_NOTE).toMatch(/Records on your other devices that haven't synced aren't included/);
  });

  it('asks for the archive after Confirm it’s you, then shows it being prepared', async () => {
    await openExport(() => service().exportNext.request.push({ status: 'fresh-authentication-required' }));
    await fireEvent.press(button('Prepare archive'));

    const fresh = within(await screen.findByTestId('confirm-its-you'));
    expect(fresh.getByText("An export is a full copy of your data, so sign in again first. Being signed in already isn't enough for this.")).toBeOnTheScreen();
    await fireEvent.press(fresh.getByRole('button', { name: /Apple/ }));

    await waitFor(() => expect(archiveRow()).toHaveProp('accessibilityLabel', "Account archive. Preparing your archive. We'll email you when it's ready; you can leave this screen."));
    expect(service().exportCalls).toEqual(['supplement', 'request', 'request']);
    expect(service().methodCalls).toEqual(['fresh apple']);
    expect(screen.queryByRole('button', { name: 'Prepare archive' })).toBeNull();
    expect(screen.getByText(OTHER_DEVICES_NOTE)).toBeOnTheScreen();
  });

  it('downloads a ready archive to the share sheet, confirming first when its few minutes have passed', async () => {
    await openExport(() => {
      service().serverExportState = ready();
      service().exportNext.download.push({ status: 'fresh-authentication-required' });
    });
    expect(archiveRow().props.accessibilityLabel).toMatch(/^Account archive\. Ready · 1\.2 MB · available until /);
    await fireEvent.press(button('Download archive'));
    await fireEvent.press(within(await screen.findByTestId('confirm-its-you')).getByRole('button', { name: /Apple/ }));

    await waitFor(() => expect(account().shared).toHaveLength(1));
    expect(account().shared[0]).toMatchObject({ name: 'tableside-export-2026-11-15.zip', mimeType: 'application/zip' });
    expect(service().exportCalls.filter((call) => call === 'download')).toHaveLength(2);
    expect(button('Prepare a new archive')).toBeOnTheScreen();
  });

  it('saves the local supplement as labelled JSON, made on this device', async () => {
    await openExport();
    await fireEvent.press(button('Save local supplement'));
    expect(await screen.findByText('Local supplement made.')).toBeOnTheScreen();
    const [file] = account().shared;
    expect(file).toMatchObject({ name: 'tableside-local-supplement-2026-11-15.json', mimeType: 'application/json' });
    expect(JSON.parse(file!.contents as string)).toMatchObject({
      format: 'tableside-local-supplement',
      unsynced: [{ recordType: 'completed-practice-session', syncStatus: 'waiting', installation: 'installation-1' }],
    });
    // Nothing was asked of the server for it.
    expect(service().exportCalls).toEqual(['supplement', 'supplement']);
  });

  it('counts conflicts apart from records that haven’t synced', async () => {
    await renderRouter('./src/app', { initialUrl: '/more/settings/account' });
    service().supplement = {
      ...FAKE_SUPPLEMENT,
      conflicts: [{ recordType: 'casino-session', item: 'item-1', acceptedRevision: 2, accepted: {}, proposals: [] }],
    };
    await fireEvent.press(await screen.findByRole('button', { name: /^Export my data\./ }));
    expect(
      await screen.findByLabelText("Local supplement. 1 record not synced yet and 1 conflict awaiting review, each labeled so it isn't mistaken for a finished session. Nothing is uploaded."),
    ).toBeOnTheScreen();
  });

  it.each<[string, ServerExport, string]>([
    ['expired', { state: 'expired', requestedAt: 0 }, 'Your last archive expired after 24 hours. Prepare a new one.'],
    ['was canceled by a sign-out', { state: 'ended', requestedAt: 0, by: 'revocation' }, 'Your last archive was canceled because a device was signed out of your account. Prepare a new one.'],
    ['failed', { state: 'failed', requestedAt: 0 }, "Your last archive couldn't be prepared. Prepare it again."],
  ])('says when the last archive %s, and offers a new one', async (_, latest, detail) => {
    await openExport(() => {
      service().serverExportState = latest;
    });
    expect(archiveRow()).toHaveProp('accessibilityLabel', `Account archive. ${detail}`);
    expect(button('Prepare archive')).toBeOnTheScreen();
    expect(screen.getByText(OTHER_DEVICES_NOTE)).toBeOnTheScreen();
  });

  it('needs a connection for the archive, but still makes the local supplement offline', async () => {
    await openExport(() => {
      service().serverExportState = null;
    });
    expect(archiveRow()).toHaveProp('accessibilityLabel', 'Account archive. Needs a connection. Check it, then come back.');
    expect(screen.queryByRole('button', { name: 'Prepare archive' })).toBeNull();
    await fireEvent.press(button('Save local supplement'));
    expect(await screen.findByText('Local supplement made.')).toBeOnTheScreen();
    expect(screen.getByText(OTHER_DEVICES_NOTE)).toBeOnTheScreen();
  });

  it('scrolls at the largest text size, in landscape too, and logs nothing private', async () => {
    await setWindow(390, 844, 3);
    await openExport(() => {
      service().serverExportState = ready();
    });
    expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
    await fireEvent.press(button('Download archive'));
    await waitFor(() => expect(account().shared).toHaveLength(1));
    await setWindow(844, 390, 3);
    expect(button('Save local supplement')).toBeOnTheScreen();
    expect(screen.getByText(OTHER_DEVICES_NOTE)).toBeOnTheScreen();
    expect(JSON.stringify(logged)).not.toMatch(/player@example\.com|account-1|installation-1|activity-1/);
  });
});

describe('an account whose age isn’t established', () => {
  it('exports from the restricted path, with no tab bar', async () => {
    launch.stored = { state: 'age-unresolved', accountId: FAKE_ACCOUNT_ID, reason: 'not-established' };
    await renderRouter('./src/app', { initialUrl: '/export' });
    expect(await header('Export my data')).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    await waitFor(() => expect(button('Prepare archive')).toBeOnTheScreen());
    await fireEvent.press(button('Prepare archive'));
    await waitFor(() => expect(service().exportCalls).toContain('request'));
    expect(screen.getByText(OTHER_DEVICES_NOTE)).toBeOnTheScreen();
  });
});

// Seam 3: S2-20 Sync status, over an Account-service fake, driven only through
// the accessibility tree: waiting records, a flagged record and its retry,
// errors, the first download, and required updates with their notice.

import type { AccountSync, SyncStatus, UploadStatus } from '@tableside/account';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncStatusScreen } from '@/account/SyncStatusScreen';

/** Today, 14 Nov 2026 at 9:43 on the device's clock. */
const NOW = new Date(2026, 10, 14, 9, 43).getTime();
const at = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute).getTime();

const DEVICE = Platform.OS === 'ios' ? 'iPhone' : 'device';
const STORE = Platform.OS === 'ios' ? 'Update in the App Store' : 'Update in Google Play';

const session = (id: string, game: string, endedAt: number, state: UploadStatus['state'] = 'waiting'): UploadStatus => ({
  id: `completed/${id}`,
  recordType: 'completed-practice-session',
  payload: { recordVersion: 1, activityId: id, game, endedAt, startedAt: endedAt - 60_000, netResult: '-300', finalCashOut: '700' },
  state,
});

const SYNCED: SyncStatus = { live: true, error: null, lastSyncedAt: NOW - 2 * 60_000, uploads: [], update: null, history: { state: 'complete' } };

/** An Account service's sync, with a status the test sets and the actions it records. */
function fakeSync(status: Partial<SyncStatus>) {
  let current: SyncStatus = { ...SYNCED, ...status };
  const listeners = new Set<(status: SyncStatus) => void>();
  const sync: AccountSync & { set(next: Partial<SyncStatus>): void } = {
    get status() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reconcile: jest.fn(async () => undefined),
    retryRecord: jest.fn(async () => undefined),
    decideUnconfirmed: jest.fn(async () => undefined),
    idle: async () => undefined,
    countWaiting: async () => current.uploads.length,
    queue: async () => ({ status: 'refused', reason: 'no-account' }),
    set(next) {
      current = { ...current, ...next };
      listeners.forEach((listener) => listener(current));
    },
  };
  return sync;
}

async function show(sync: AccountSync) {
  const actions = { onBack: jest.fn(), onUpdate: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <SyncStatusScreen sync={sync} now={() => NOW} {...actions} />
    </SafeAreaProvider>,
  );
  return actions;
}

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

afterEach(() => setWindow(390, 844));

describe('S2-20 Sync status', () => {
  it('is headed Sync status under Account, with Back', async () => {
    const actions = await show(fakeSync({}));
    expect(screen.getByRole('header', { name: 'Sync status' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Account' }));
    expect(actions.onBack).toHaveBeenCalled();
  });

  it('counts the records waiting, lists each with its Local label, and flags the one that keeps failing with its own retry', async () => {
    const sync = fakeSync({
      lastSyncedAt: NOW - 2 * 3_600_000,
      uploads: [session('b1', 'blackjack', at(10, 14, 9, 41)), session('r1', 'roulette', at(10, 14, 8, 2)), session('c1', 'craps', at(9, 14), 'flagged')],
    });
    await show(sync);

    expect(screen.getByText('3 records waiting to sync')).toBeOnTheScreen();
    expect(screen.getByText('They\'ll upload automatically. Last sync 2 hours ago.')).toBeOnTheScreen();
    const failing = within(screen.getByTestId('flagged-banner'));
    expect(failing.getByRole('header', { name: '1 record keeps failing' })).toBeOnTheScreen();
    expect(failing.getByText(`Craps session, 14 Oct, couldn't upload after several tries. It's safe on this ${DEVICE}, and everything else keeps syncing.`)).toBeOnTheScreen();

    const rows = screen.getAllByTestId('waiting-row');
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      `Blackjack session. Today 9:41 · this ${DEVICE}. Local`,
      `Roulette session. Today 8:02 · this ${DEVICE}. Local`,
      'Craps session. 14 Oct · flagged. Failing',
    ]);

    await fireEvent.press(failing.getByRole('button', { name: 'Retry this record' }));
    expect(sync.retryRecord).toHaveBeenCalledWith('completed/c1');
    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(sync.reconcile).toHaveBeenCalled();
  });

  it('names a single waiting record in the singular, and says when several keep failing', async () => {
    await show(fakeSync({ uploads: [session('c1', 'craps', at(9, 14), 'flagged'), session('c2', 'craps', at(9, 15), 'flagged')] }));
    expect(screen.getByText('2 records waiting to sync')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: '2 records keep failing' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry these records' })).toBeOnTheScreen();
  });

  it('marks records paused behind a failing one, and records the server refused as needing review', async () => {
    await show(fakeSync({ uploads: [session('b1', 'blackjack', at(10, 13), 'paused'), session('r1', 'roulette', at(10, 12), 'review')] }));
    expect(screen.getByText('1 record waiting to sync')).toBeOnTheScreen();
    expect(screen.getAllByTestId('waiting-row').map((row) => row.props.accessibilityLabel)).toEqual([
      'Blackjack session. Yesterday · waits for a failing record. Paused',
      'Roulette session. 12 Nov · not accepted by your account. Needs review',
    ]);
  });

  it('marks a record whose outcome couldn’t be confirmed after time away as needing review, not as waiting (#98)', async () => {
    await show(fakeSync({ uploads: [session('w1', 'roulette', at(10, 12), 'unconfirmed')] }));
    expect(screen.getAllByTestId('waiting-row').map((row) => row.props.accessibilityLabel)).toEqual([
      'Roulette session. 12 Nov · not confirmed after time away. Needs review',
    ]);
    expect(screen.queryByText(/waiting to sync/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
  });

  it('says all synced, with the last sync, when nothing is waiting', async () => {
    await show(fakeSync({}));
    expect(screen.getByText('All synced')).toBeOnTheScreen();
    expect(screen.getByText('Last sync 2 minutes ago.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
  });

  it('says when it can’t reach Tableside, that records are safe and practice works, with Retry now', async () => {
    const sync = fakeSync({ error: 'offline', uploads: [session('b1', 'blackjack', at(10, 14, 9, 41))] });
    await show(sync);
    expect(screen.getByText('Can\'t sync right now')).toBeOnTheScreen();
    expect(screen.getByText(`We couldn't reach Tableside. Your records are safe on this ${DEVICE}.`)).toBeOnTheScreen();
    const banner = within(screen.getByTestId('error-banner'));
    expect(banner.getByRole('header', { name: 'Sync error' })).toBeOnTheScreen();
    expect(banner.getByText('No response from the server. We\'ll keep trying while the app is open, and when your connection comes back.')).toBeOnTheScreen();
    expect(screen.getByText('Practice works normally offline. Nothing is lost or counted twice when sync resumes.')).toBeOnTheScreen();
    await fireEvent.press(banner.getByRole('button', { name: 'Retry now' }));
    expect(sync.reconcile).toHaveBeenCalled();
  });

  it('asks to sign in again when the session wasn’t accepted, keeping the records', async () => {
    await show(fakeSync({ error: 'sign-in-required', uploads: [session('b1', 'blackjack', at(10, 14, 9, 41))] }));
    const banner = within(screen.getByTestId('error-banner'));
    expect(banner.getByRole('header', { name: 'Sign in again to sync' })).toBeOnTheScreen();
    expect(banner.getByText(`Your records are safe on this ${DEVICE} and sync once you sign in to this account again.`)).toBeOnTheScreen();
  });

  it('says when it couldn’t save what it synced, and asks to update for changes this version can’t show', async () => {
    const sync = fakeSync({ error: 'storage' });
    await show(sync);
    expect(screen.getByText('Can\'t sync right now')).toBeOnTheScreen();
    expect(within(screen.getByTestId('error-banner')).getByText(`Tableside couldn't save what it synced on this ${DEVICE}. Nothing was lost. Free up some space, then retry.`)).toBeOnTheScreen();
    expect(screen.queryByText('All synced')).toBeNull();

    await act(() => sync.set({ error: 'unreadable-change' }));
    expect(screen.getByRole('header', { name: 'Update to get everything' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: STORE })).toBeOnTheScreen();
  });

  it('shows the first download’s progress while it isn’t finished', async () => {
    await show(fakeSync({ history: { state: 'incomplete', summaries: 1, detail: 0.62 } }));
    expect(screen.getByText('Getting your history')).toBeOnTheScreen();
    expect(screen.getByText('Summaries and lifetime totals are here. Recent detail is still downloading.')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Summaries and totals' })).toHaveAccessibilityValue({ min: 0, max: 100, now: 100 });
    expect(screen.getByRole('progressbar', { name: 'Last 90 days of detail' })).toHaveAccessibilityValue({ min: 0, max: 100, now: 62 });
    expect(screen.getByRole('header', { name: 'First download isn\'t finished' })).toBeOnTheScreen();
  });

  it('gives a dated notice before a protocol retires, and what happens without the update', async () => {
    const actions = await show(fakeSync({ update: { state: 'retiring', retiresAt: at(10, 18, 0, 0), reason: null } }));
    const notice = within(screen.getByTestId('update-notice'));
    expect(notice.getByRole('header', { name: 'Update Tableside by 18 November' })).toBeOnTheScreen();
    expect(
      notice.getByText(`This version stops syncing on 18 Nov 2026. Practice keeps working, and records made before you update stay on this ${DEVICE} and sync afterwards.`),
    ).toBeOnTheScreen();
    expect(screen.getByText('All synced')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'After 17 November, without the update' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Sync stopped: update required' })).toBeOnTheScreen();

    await fireEvent.press(notice.getByRole('button', { name: STORE }));
    expect(actions.onUpdate).toHaveBeenCalled();
  });

  it('says sync stopped once an update is required, keeping the records, and explains an urgent restriction', async () => {
    const actions = await show(
      fakeSync({ error: 'incompatible', update: { state: 'required', reason: 'A security fix needs this update.' }, uploads: [session('b1', 'blackjack', at(10, 14, 9, 41))] }),
    );
    const banner = within(screen.getByTestId('update-required'));
    expect(banner.getByRole('header', { name: 'Sync stopped: update required' })).toBeOnTheScreen();
    expect(banner.getByText('Your local records are kept and nothing is deleted. Update to sync them.')).toBeOnTheScreen();
    expect(banner.getByText('A security fix needs this update.')).toBeOnTheScreen();
    expect(screen.getByText('1 record waiting to sync')).toBeOnTheScreen();
    // Retrying can't help until the update; only the update is offered.
    expect(screen.queryByRole('button', { name: /^(Retry now|Sync now)$/ })).toBeNull();
    await fireEvent.press(banner.getByRole('button', { name: 'Update' }));
    expect(actions.onUpdate).toHaveBeenCalled();
  });

  it('follows the status as it changes', async () => {
    const sync = fakeSync({ uploads: [session('b1', 'blackjack', at(10, 14, 9, 41))] });
    await show(sync);
    expect(screen.getByText('1 record waiting to sync')).toBeOnTheScreen();
    await act(() => sync.set({ uploads: [], lastSyncedAt: NOW }));
    expect(screen.getByText('All synced')).toBeOnTheScreen();
    expect(screen.getByText('Last sync just now.')).toBeOnTheScreen();
  });

  it('reflows inside a scroll view at the largest text size and in landscape', async () => {
    await setWindow(844, 390, 3);
    const sync = fakeSync({ uploads: [session('c1', 'craps', at(9, 14), 'flagged')] });
    await show(sync);
    expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry this record' }));
    expect(sync.retryRecord).toHaveBeenCalledWith('completed/c1');
  });
});

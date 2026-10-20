// Seam 3: suspending, resuming and the access-ended stop as the player sees
// them, through the real routes on the in-memory adapters and the
// accessibility tree. Spins come from the Random123 "pi digits" stream: 27 (red), 0.

import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import type { AccessDecision, AccessSupervisor, AdmissionDecision, TurnDecision } from '@/practice/adapters';
import { ENDING_STEP_MS } from '@/practice/controller';
import type { FakeClock, substituteAdapters } from '@/practice/testing/substitutes';

type Adapters = ReturnType<typeof substituteAdapters>;

/**
 * The app runs on the substitute adapters over one durable in-memory disk, so a
 * second render is the app relaunching. A test may script the supervisor or
 * hold the clock.
 */
const mockApp: {
  latest: Adapters | null;
  disk: unknown;
  manualClock: boolean;
  next: { admission?: AdmissionDecision; turn?: TurnDecision; resume?: AccessDecision };
} = { latest: null, disk: null, manualClock: false, next: {} };

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock: Clock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  const { MemoryActivityStore, MemoryDisk } = jest.requireActual('@/practice/memory-store');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  return {
    createAppAdapters: () => {
      mockApp.disk ??= new MemoryDisk();
      const access: AccessSupervisor = {
        ...alwaysAllowed,
        beforeActivity: async (context) => mockApp.next.admission ?? alwaysAllowed.beforeActivity(context),
        beforeTurn: async (context) => mockApp.next.turn ?? alwaysAllowed.beforeTurn(context),
        beforeResume: async (context) => mockApp.next.resume ?? alwaysAllowed.beforeResume(context),
      };
      const adapters = { ...create({ clock: new Clock(undefined, !mockApp.manualClock) }), access, store: new MemoryActivityStore(mockApp.disk) };
      mockApp.latest = adapters;
      return adapters;
    },
  };
});

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});

beforeEach(() => {
  mockApp.disk = null;
  mockApp.manualClock = false;
  mockApp.next = {};
});

async function startSession() {
  await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText('Session balance 1,000');
}

async function betRed25() {
  await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Red,/ }));
  await screen.findByLabelText('Session balance 975');
}

/** The app closes and opens again on the same durable data, landing on Home. */
async function relaunch() {
  await cleanup();
  await renderRouter('./src/app', { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Tableside' });
}

describe('suspension', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('suspends when the tab bar leaves the table, shows it paused on Home, and resumes on return without restarting', async () => {
    await startSession();
    await betRed25();

    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
    expect(await screen.findByRole('header', { name: 'Roulette session paused' })).toBeOnTheScreen();
    expect(mockApp.latest && (await mockApp.latest.store.findUnfinished())?.sequence).toBe(1);

    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));
    expect(await screen.findByLabelText('Session balance 975')).toBeOnTheScreen();
    expect(screen.getByLabelText('Status Betting')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Spin' })).toBeEnabled());

    await fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Resume session' }));
    expect(await screen.findByLabelText('Session balance 975')).toBeOnTheScreen();
  });

  it('after a relaunch, offers to pick up the session where it was, and resumes the same table', async () => {
    await startSession();
    await betRed25();

    await relaunch();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume session' }));

    expect(await screen.findByRole('header', { name: 'Pick up where you left off' })).toBeOnTheScreen();
    expect(screen.getByText(/Tableside closed during your roulette session/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Where you were: Betting')).toBeOnTheScreen();
    expect(screen.getByLabelText('Session balance: 975')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table: 25')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Resume session' }));
    expect(await screen.findByLabelText('Session balance 975')).toBeOnTheScreen();
    expect(screen.getByLabelText('On table 25')).toBeOnTheScreen();
  });

  it('a blocked resume explains why and changes nothing, and End session still settles the session', async () => {
    await startSession();
    await betRed25();
    await relaunch();
    mockApp.next.resume = { status: 'uncertain', provenance: 'test', disposition: 'suspend-at-turn-boundary' };
    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));

    await fireEvent.press(await screen.findByRole('button', { name: 'Resume session' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't resume · Reconnect to verify access");
    expect(screen.getByLabelText('On table: 25')).toBeOnTheScreen();
    expect((await mockApp.latest?.store.findUnfinished())?.sequence).toBe(1);

    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    await fireEvent.press((await screen.findAllByRole('button', { name: 'End session' })).at(-1)!);
    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Final cash-out 1,000')).toBeOnTheScreen();
  });

  it('blocks the start while access is uncertain, and nothing is created', async () => {
    mockApp.next.admission = { status: 'uncertain', provenance: 'test', disposition: 'suspend-at-turn-boundary' };
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Start free play' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reconnect to verify access. Nothing has started and nothing was used.');
    expect(await mockApp.latest?.store.findUnfinished()).toBeNull();
  });

  it('when access ends, says so while existing bets settle on their own, then shows the result', async () => {
    mockApp.manualClock = true;
    await startSession();
    await betRed25();
    mockApp.next.turn = { status: 'denied', provenance: 'test', disposition: 'stop' };

    await fireEvent.press(screen.getByRole('button', { name: 'Spin' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Training ended — settling existing bets; no further allowance used');
    expect(screen.getByRole('header', { name: 'Ending your session' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Spin' })).toBeNull();

    await act(async () => (mockApp.latest?.clock as FakeClock).advance(ENDING_STEP_MS));
    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Final cash-out 1,000')).toBeOnTheScreen();
  });
});

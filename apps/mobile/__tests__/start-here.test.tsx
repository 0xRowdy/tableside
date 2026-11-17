// Spec 3 Testing Decisions › Seam 3 (Start here dismissal and reopen); Lessons › Entry points, Amendment 1 C7; S1-01 olGG6, Learning NvGyZ; #146

import { HINT_IDS } from '@tableside/definitions';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { alwaysAllowed } from '@/practice/adapters';
import { FakeClock, entropyFromWords, PI_WORDS } from '@/practice/testing/substitutes';
import { plentyAllowance } from '@/training/allowance';
import { MemoryTrainingStore } from '@/training/memory-store';
import { TrainingService } from '@/training/service';

let mockStore: MemoryTrainingStore | null = null;

jest.mock('@/training/app-adapters', () => {
  const substitutes = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed: allowed } = jest.requireActual('@/practice/adapters');
  const { plentyAllowance: plenty } = jest.requireActual('@/training/allowance');
  const { MemoryTrainingStore: Store } = jest.requireActual('@/training/memory-store');
  let next = 0;
  return {
    createTrainingAdapters: () => {
      mockStore ??= new Store();
      return {
        store: mockStore,
        access: allowed,
        allowance: plenty(() => Date.now()),
        clock: new substitutes.FakeClock(undefined, true),
        entropy: substitutes.entropyFromWords(substitutes.PI_WORDS),
        newId: () => `event-${++next}`,
        device: 'test-device',
        owner: 'local',
      };
    },
  };
});

const onThisDevice = () =>
  new TrainingService({
    store: mockStore!.reopen(),
    access: alwaysAllowed,
    allowance: plentyAllowance(() => Date.now()),
    clock: new FakeClock(undefined, true),
    entropy: entropyFromWords(PI_WORDS),
    newId: () => 'unused',
    device: 'test-device',
    owner: 'local',
  });

const START_HERE_TEXT = '24 short lessons on the three games, counting and the app. Open any, in any order.';
const button = (name: string | RegExp) => screen.getByRole('button', { name });

let announcements: string[] = [];

beforeAll(async () => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((text) => void announcements.push(text));
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  mockStore = new MemoryTrainingStore();
  announcements = [];
});

async function openHome() {
  await renderRouter('./src/app', { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Tableside' });
}

describe('the Start here card (S1-01 olGG6)', () => {
  it('shows on Home with the three game cards and opens the lesson catalog', async () => {
    await openHome();
    expect(await screen.findByText('Start here')).toBeOnTheScreen();
    expect(screen.getByText(START_HERE_TEXT)).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^(Blackjack|Craps|Roulette)\b/ })).toHaveLength(3);
    expect(button('Dismiss Start here')).toBeEnabled();

    await fireEvent.press(screen.getByRole('link', { name: 'Open lesson catalog' }));
    expect(await screen.findByRole('header', { name: 'Lessons' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('dismisses on this device: it stays gone after a restart, and the games are still one tap away', async () => {
    await openHome();
    await fireEvent.press(await screen.findByRole('button', { name: 'Dismiss Start here' }));
    expect(screen.queryByText('Start here')).toBeNull();
    expect(announcements).toContain('Start here dismissed. Show it again from More, Settings, Learning.');
    expect(screen.getAllByRole('button', { name: /^(Blackjack|Craps|Roulette)\b/ })).toHaveLength(3);
    expect((await onThisDevice().learning()).startHere).toBe(false);

    await cleanup();
    await openHome();
    await act(() => onThisDevice().learning());
    expect(screen.queryByText('Start here')).toBeNull();
  });

  it('comes back from More → Settings → Learning, "Show Start here on Home" (NvGyZ)', async () => {
    await onThisDevice().setStartHere(false);
    await renderRouter('./src/app', { initialUrl: '/more/settings/learning' });
    const toggle = await screen.findByRole('switch', { name: 'Show Start here on Home' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveProp('accessibilityHint', 'Off because you dismissed it. Turn on to show the card again on this device.');

    await fireEvent.press(toggle);
    expect(await screen.findByRole('switch', { name: 'Show Start here on Home', checked: true })).toBeOnTheScreen();
    expect((await onThisDevice().learning()).startHere).toBe(true);

    await fireEvent.press(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'Home' }));
    expect(await screen.findByText('Start here')).toBeOnTheScreen();
  });
});

describe('Settings › Learning hints (NvGyZ)', () => {
  it('lists the hints row and the device-local note, and brings every hint back', async () => {
    const device = onThisDevice();
    for (const id of HINT_IDS) await device.hintSeen(id);
    await renderRouter('./src/app', { initialUrl: '/more/settings/learning' });
    expect(await screen.findByRole('header', { name: 'HINTS' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Lessons never score you, award anything or lock anything. They're available to every account, including when today's challenge attempts are used up. Start here and hint settings stay on this device.",
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(
      button('Show first-use hints again. Bet selector, count entry and the show-count toggle hints reappear the next time you meet them.'),
    );
    expect(
      await screen.findByRole('button', {
        name: 'Show first-use hints again. Done. Bet selector, count entry and the show-count toggle hints reappear the next time you meet them.',
      }),
    ).toBeOnTheScreen();
    expect((await onThisDevice().learning()).unseenHints).toEqual(HINT_IDS);
  });
});

describe('a running-count Check from the Counting tab', () => {
  it('offers its count-entry and show-count hints; Got it hides one for good and Help shows it again', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await screen.findByRole('header', { name: 'Counting' });
    await fireEvent.press(screen.getByRole('button', { name: 'Check: Running count' }));
    await screen.findByRole('header', { name: 'Running count' });
    await fireEvent.press(within(screen.getByLabelText('Variant')).getByRole('radio', { name: 'Check' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start Check attempt' }));
    await screen.findByText('Card 1 of 52 · checkpoint 1 of 4');

    expect(await screen.findByTestId('first-use-hint-show-count')).toBeOnTheScreen();
    await fireEvent.press(button('Got it, hide the Show running count hint'));
    expect(screen.queryByTestId('first-use-hint-show-count')).toBeNull();
    expect((await onThisDevice().learning()).unseenHints).toEqual(['bet-selector', 'count-entry']);

    await fireEvent.press(button('Help'));
    expect(screen.getByTestId('first-use-hint-show-count')).toBeOnTheScreen();
    expect(screen.getByText('Card 1 of 52 · checkpoint 1 of 4')).toBeOnTheScreen();
  });
});

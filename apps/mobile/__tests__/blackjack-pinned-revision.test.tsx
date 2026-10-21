// Seam 3: a guided blackjack practice session coaches from the strategy
// revision it pinned at its start, even when the app now ships another
// revision of that built-in. The session is created on the same in-memory
// store before the app opens, as an earlier build would have left it.

import { blackjackRules, blackjackStrategy } from '@tableside/definitions';
import type { BlackjackPlayPolicy, StrategyDefinition } from '@tableside/engine';
import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { PracticeController } from '@/practice/controller';
import type { substituteAdapters } from '@/practice/testing/substitutes';

const mockApp: { adapters: ReturnType<typeof substituteAdapters> | null } = { adapters: null };

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return {
    createAppAdapters: () => {
      mockApp.adapters ??= create({ clock: new FakeClock(undefined, true) });
      return mockApp.adapters;
    },
  };
});

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});

describe('a pinned blackjack strategy revision', () => {
  it('the supplied count names the pinned revision’s deviations, not the current built-in’s', async () => {
    const { createAppAdapters } = jest.requireMock('@/practice/app-adapters') as { createAppAdapters: () => ReturnType<typeof substituteAdapters> };
    const adapters = createAppAdapters();
    const current = blackjackStrategy('S17_LS', 'basic-with-deviations');
    const policy = current.play as BlackjackPlayPolicy;
    // An earlier revision that taught only the indices at or below 0: nothing comes "next" above this count.
    const pinned: StrategyDefinition = { ...current, revision: current.revision + 1, play: { ...policy, deviations: policy.deviations.filter((d) => d.threshold <= 0) } };
    expect(policy.deviations.some((d) => d.threshold > 0)).toBe(true);
    const earlier = new PracticeController(adapters);
    await earlier.load();
    await earlier.start({ game: 'blackjack', buyIn: '1000', rules: blackjackRules('S17_LS'), strategy: { definition: pinned, parameters: {} } });
    expect(earlier.snapshot().status).toBe('active');

    await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Resume session' }));
    const panel = within(await screen.findByTestId('count-panel'));
    expect(panel.getByText('True count 0')).toBeOnTheScreen();
    expect(panel.queryByText(/^Next: /)).toBeNull();
  }, 180_000);
});

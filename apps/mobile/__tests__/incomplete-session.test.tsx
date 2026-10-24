// Seam 3: an unfinished session an update can't resume, as the player sees it
// (#80; design frame S1-11 "Quarantined session — explained"), through the real
// routes and the accessibility tree. The app launches over a durable store that
// already holds a craps session an earlier build left, recorded by that build.

import type { QuarantineList } from '@tableside/engine';
import { RECORDED_BUILDS } from '@tableside/engine/recorded-checkpoints';
import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import type { StoredActivity } from '@/practice/store';
import { fromLaterBuild, leftBy as leftByBuild } from '@/practice/testing/substitutes';

const leftBy = (checkpoint: string) => leftByBuild(CRAPS, checkpoint);

const CRAPS = RECORDED_BUILDS[0]!.checkpoints.find((recorded) => recorded.game === 'craps')!;
const IDENTITIES = JSON.parse(CRAPS.checkpoint).identities;
const LIST: QuarantineList = {
  version: 2,
  entries: [{ id: 'q-craps-1', match: { engine: IDENTITIES.engine, rules: IDENTITIES.rules }, explanation: 'Field bets on 12 were paid double instead of triple.' }],
};

const mockApp: { stored: StoredActivity | null; quarantine: QuarantineList | null } = { stored: null, quarantine: null };

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock: Clock, storeHolding, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return {
    createAppAdapters: () => ({
      ...create({ clock: new Clock(undefined, true) }),
      store: storeHolding(...(mockApp.stored ? [mockApp.stored] : [])),
      ...(mockApp.quarantine ? { quarantine: mockApp.quarantine } : {}),
    }),
  };
});

beforeAll(async () => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await renderRouter('./src/app', { initialUrl: '/' });
  await cleanup();
}, 180_000);

beforeEach(() => {
  mockApp.stored = null;
  mockApp.quarantine = null;
});

describe('a quarantined unfinished session', () => {
  it('is explained on Play, with what was recorded and no result, and setup follows once it is dismissed', async () => {
    mockApp.stored = leftBy(CRAPS.checkpoint);
    mockApp.quarantine = LIST;
    await renderRouter('./src/app', { initialUrl: '/play' });

    expect(await screen.findByRole('header', { name: 'Craps session' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'This session is quarantined' })).toBeOnTheScreen();
    expect(screen.getByText(/We won't invent a result, so it's set aside and doesn't count toward your totals or adherence\./)).toBeOnTheScreen();
    expect(screen.getByLabelText('Buy-in: 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Game: Craps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rolls recorded: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Result: Not available')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Engine: ${IDENTITIES.engine} (affected)`)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Resume session' })).toBeNull();

    const what = screen.getByRole('button', { name: 'What happened?' });
    expect(what).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(what);
    expect(screen.getByText('Field bets on 12 were paid double instead of triple.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
    expect(await screen.findByRole('header', { name: 'Tableside' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Play' }));
    expect(await screen.findByRole('button', { name: 'Choose a game' })).toBeOnTheScreen();
  });

  it('a damaged checkpoint is explained the same way, without a defect to name', async () => {
    mockApp.stored = leftBy(CRAPS.checkpoint.replace('"balance":"', '"balance":"-'));
    await renderRouter('./src/app', { initialUrl: '/play' });

    expect(await screen.findByRole('header', { name: "This session can't be recovered" })).toBeOnTheScreen();
    expect(screen.getByLabelText('Result: Not available')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'What happened?' })).toBeNull();
  });

  it('a training-bankroll session names its allocation, never a buy-in (Amendment 4 B)', async () => {
    const stored = leftBy(CRAPS.checkpoint.replace('"balance":"', '"balance":"-'));
    mockApp.stored = { ...stored, specification: { ...stored.specification, fundingSource: 'training-bankroll' } };
    await renderRouter('./src/app', { initialUrl: '/play' });

    expect(await screen.findByLabelText('From training bankroll: 1,000')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Buy-in/)).toBeNull();
  });
});

describe('a session a later build saved', () => {
  it('is never reopened after a rollback: Play asks for the update', async () => {
    mockApp.stored = leftBy(fromLaterBuild(CRAPS));
    await renderRouter('./src/app', { initialUrl: '/play?game=roulette' });

    expect(await screen.findByRole('header', { name: 'Update to resume' })).toBeOnTheScreen();
    expect(screen.getByText(/Your craps session was saved by a newer version of Tableside\./)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start free play' })).toBeNull();
  });
});

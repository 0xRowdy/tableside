// Spec 3 Information hiding (end to end), Launch gates 2 and 8, Testing Decisions › Seam 3; #156

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { ResponsivenessSample } from '@/responsiveness/samples';
import type { SamplingMode } from '@/responsiveness/recorder';
import { expectIndistinguishable, expectNotPresented, presentedScreen, watchAccessibilityEvents, type AccessibilityEvents } from '@/training/testing/information-hiding';

const mockSamples: ResponsivenessSample[] = [];
const mockClock = { now: 0 };

jest.mock('@/responsiveness/probe', () => {
  const { createSampler } = jest.requireActual('@/responsiveness/sampler');
  const sampler = createSampler({
    device: { model: 'test', os: 'iOS', osVersion: '18', build: 'test', abi: 'arm64' },
    now: () => mockClock.now,
    afterCommit: (run: () => void) => void Promise.resolve().then(run),
    nextFrame: () => Promise.resolve((mockClock.now += 16)),
    processStart: () => null,
    record: (sample: ResponsivenessSample) => void mockSamples.push(sample),
  });
  return { sampling: { ...sampler, Badge: () => null } };
});

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  const { plentyAllowance } = jest.requireActual('@/training/allowance');
  return {
    createTrainingAdapters: () => {
      const clock = new FakeClock(undefined, true);
      return {
        store: new MemoryTrainingStore(),
        access: alwaysAllowed,
        allowance: plentyAllowance(() => clock.now()),
        clock,
        entropy: entropyFromWords(PI_WORDS),
        newId: () => 'attempt-7d3f9a21c6',
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
        speech: jest.requireActual('@/training/speech').NO_SCREEN_READER,
      };
    },
  };
});

const { sampling } = jest.requireMock('@/responsiveness/probe') as { sampling: SamplingMode };

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<string, string> = { Ace: 'minus 1', '2': 'plus 1', '3': 'plus 1', '4': 'plus 1', '5': 'plus 1', '6': 'plus 1', '7': '0', '8': '0', '9': '0', '10': 'minus 1', Jack: 'minus 1', Queen: 'minus 1', King: 'minus 1' };
const WRONG: Record<string, string> = { 'plus 1': 'minus 1', '0': 'plus 1', 'minus 1': '0' };
const shownCard = () => screen.getByTestId('challenge-card').props.accessibilityLabel as string;

let touchAt = 1_000;
// docs/development.md Responsiveness sampling (touch order)
async function tap(name: string) {
  const button = screen.getByRole('button', { name });
  mockClock.now = touchAt += 1_000;
  sampling.touchStart({ nativeEvent: { timestamp: touchAt } });
  const pressing = fireEvent.press(button);
  mockClock.now += 40;
  sampling.touchEnd({ nativeEvent: { timestamp: mockClock.now } });
  await pressing;
}

let events: AccessibilityEvents;
const CONSOLE = ['log', 'info', 'warn', 'error', 'debug'] as const;

async function checkRun(answer: (card: string) => string) {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
  await fireEvent.press(screen.getByRole('button', { name: 'Check: Card values' }));
  await screen.findByRole('header', { name: 'Card values' });
  await fireEvent.press(screen.getByRole('button', { name: 'Start Check attempt' }));
  await screen.findByText('Card 1 of 20');
  mockSamples.length = 0;
  events.clear();
  const logged = CONSOLE.map((method) => jest.spyOn(console, method));
  const cards: string[] = [];
  for (let card = 1; card <= 4; card++) {
    await screen.findByText(`Card ${card} of 20`);
    cards.push(shownCard());
    await tap(answer(shownCard()));
  }
  await screen.findByText('Card 5 of 20');
  await waitFor(() => expect(mockSamples).toHaveLength(8));
  const presented = presentedScreen(screen.toJSON() as never, events, { mask: ['challenge-card'] });
  const channels = {
    samples: mockSamples.map(({ measure, game, family }) => ({ measure, game, family })),
    sampleText: JSON.stringify(mockSamples),
    logs: logged.flatMap((spy) => spy.mock.calls),
  };
  logged.forEach((spy) => spy.mockRestore());
  await cleanup();
  return { presented, channels, cards };
}

describe('an unfinished Check attempt, beyond its screens', () => {
  beforeAll(async () => {
    events = watchAccessibilityEvents();
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('gives right and wrong answers the same responsiveness samples, logs and announcements, none carrying the attempt, a card or an answer', async () => {
    const right = await checkRun((card) => HI_LO[card.split(' of ')[0]!]!);
    const wrong = await checkRun((card) => WRONG[HI_LO[card.split(' of ')[0]!]!]!);
    expect(wrong.cards).toEqual(right.cards);

    expect(right.channels.samples).toEqual(
      Array.from({ length: 4 }, () => [
        { measure: 'acknowledgment', game: 'challenge', family: 'answer-submission' },
        { measure: 'completion', game: 'challenge', family: 'answer-submission' },
      ]).flat(),
    );
    expect(wrong.channels.samples).toEqual(right.channels.samples);
    expect([right.channels.logs, wrong.channels.logs]).toEqual([[], []]);
    expectIndistinguishable(wrong.presented, right.presented);

    for (const run of [right, wrong]) {
      for (const hidden of ['attempt-7d3f9a21c6', ...run.cards, 'plus 1', 'minus 1', 'Recorded']) expect(run.channels.sampleText).not.toContain(hidden);
      expectNotPresented({ ...run.presented, elements: [] }, ['attempt-7d3f9a21c6', ...run.cards, 'correct', 'Correct', 'incorrect', 'Wrong']);
    }
  }, 180_000);
});

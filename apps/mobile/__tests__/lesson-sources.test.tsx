// Spec 3 Seam 3; Lessons › Content requirements; Amendment 1 C11; S3-12 hGHha, pX6CV; #154

import type { Lesson, LessonContent } from '@tableside/definitions';
import { cleanup, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Linking } from 'react-native';

let mockStore: unknown = null;

jest.mock('@tableside/definitions', () => {
  const actual = jest.requireActual('@tableside/definitions');
  return { ...actual, LESSONS: [...actual.LESSONS] };
});

const actualLessons = () => (jest.requireActual('@tableside/definitions') as typeof import('@tableside/definitions')).LESSONS;
const servedLessons = () => (jest.requireMock('@tableside/definitions') as { LESSONS: Lesson[] }).LESSONS;

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { plentyAllowance } = jest.requireActual('@/training/allowance');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  let next = 0;
  return {
    createTrainingAdapters: () => {
      mockStore ??= new MemoryTrainingStore();
      return {
        store: mockStore,
        access: alwaysAllowed,
        allowance: plentyAllowance(() => Date.now()),
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `event-${++next}`,
        device: 'test-device',
        owner: 'local',
      };
    },
  };
});

const content = (sources: LessonContent['sources']): LessonContent => ({
  version: 1,
  materialVersion: 1,
  change: null,
  steps: [
    { heading: 'First idea', paragraphs: ['Something to learn.'] },
    { heading: 'Practice it', paragraphs: ['Open practice from here.'] },
  ],
  workedExample: null,
  handoffs: [{ kind: 'free-play', game: 'craps' }],
  sources,
});

const SOURCES: LessonContent['sources'] = [
  { citation: 'Example Gaming Guide, “Craps”, printed p. 13', url: 'https://example.com/guide.pdf' },
  { citation: 'A printed rulebook, section 2', url: null },
];

function author(sources: LessonContent['sources']) {
  servedLessons().splice(0, Infinity, ...actualLessons().map((lesson) => (lesson.id === 'pass-with-odds' ? { ...lesson, content: content(sources) } : lesson)));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function openLesson() {
  await renderRouter('./src/app', { initialUrl: '/counting/lessons/pass-with-odds' });
  await header('Pass with odds');
}

beforeEach(() => {
  mockStore = null;
});

describe('lesson sources (hGHha)', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('close the lesson with a Sources step of text-link credits, after the step that offers practice', async () => {
    author(SOURCES);
    await openLesson();
    expect(screen.getByText('Step 1 of 3')).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    await header('Practice it');
    expect(screen.getByText('Step 2 of 3')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Free play · Craps' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();

    await fireEvent.press(button('Next'));
    expect(await header('Sources')).toBeOnTheScreen();
    expect(screen.getByText('Step 3 of 3 · Sources')).toBeOnTheScreen();
    expect(screen.getByText("Tableside wrote this lesson. Where it draws on other work, the exact page, section or video time is linked below. Those authors didn't write or approve it.")).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Credits' })).toBeOnTheScreen();
    expect(screen.getByText('Links open in your browser; these credits are bundled for offline reading.')).toBeOnTheScreen();
    expect(screen.getAllByRole('link').map((link) => link.props.accessibilityLabel)).toEqual(['Example Gaming Guide, “Craps”, printed p. 13']);
    expect(screen.getByText('A printed rulebook, section 2')).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();

    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await fireEvent.press(screen.getByRole('link', { name: 'Example Gaming Guide, “Craps”, printed p. 13' }));
    expect(open).toHaveBeenCalledWith('https://example.com/guide.pdf');
    open.mockRestore();

    await fireEvent.press(button('Finish'));
    expect(await header('Practice what you learned')).toBeOnTheScreen();
  });

  it('keep the place at the Sources step for Resume', async () => {
    author(SOURCES);
    await openLesson();
    await fireEvent.press(button('Next'));
    await header('Practice it');
    await fireEvent.press(button('Next'));
    await header('Sources');
    await cleanup();

    await renderRouter('./src/app', { initialUrl: '/counting/lessons' });
    expect(await screen.findByRole('button', { name: /^Pass with odds\. In progress · Step 3 of 3/ })).toBeOnTheScreen();
    await fireEvent.press(button(/^Pass with odds\b/));
    expect(await screen.findByText('You stopped at step 3 of 3.')).toBeOnTheScreen();
    await fireEvent.press(button('Resume at step 3'));
    expect(await header('Sources')).toBeOnTheScreen();
  });

  it('add no Sources step to a lesson without sources', async () => {
    author([]);
    await openLesson();
    expect(screen.getByText('Step 1 of 2')).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    await header('Practice it');
    expect(screen.getByText('Step 2 of 2')).toBeOnTheScreen();
    expect(button('Finish')).toBeOnTheScreen();
  });
});

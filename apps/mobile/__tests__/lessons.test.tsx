// Spec 3 Testing Decisions › Seam 3; S3-11 sVqX1, S3-12 l8pMS and aJV2y, S3-13 JJl51 and Fvlgc, Settings › Learning NvGyZ; Amendment 1 B4, D; #143, #144, #151

import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Dimensions, Linking } from 'react-native';

import type { Lesson } from '@tableside/definitions';

import type { substituteFeedbackPorts } from '@/feedback/testing/substitutes';
import type { ChallengeAllowanceState } from '@/training/allowance';
import type { MemoryTrainingStore } from '@/training/memory-store';
import { MARTINGALE_STRATEGY_STEP, withWorkedExample } from '@/training/testing/worked-example';

let mockStore: unknown = null;
let mockAllowance: ChallengeAllowanceState | null = null;

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
        allowance: mockAllowance ?? plentyAllowance(() => Date.now()),
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => `event-${++next}`,
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
      };
    },
  };
});

const device = jest.requireMock('@/feedback/device-ports') as { latest: ReturnType<typeof substituteFeedbackPorts> | null };

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

const header = (name: string | RegExp) => screen.findByRole('header', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

async function openCatalog() {
  await renderRouter('./src/app', { initialUrl: '/more/settings/learning' });
  await fireEvent.press(await screen.findByRole('button', { name: /^Lesson catalog\b/ }));
  await header('Lessons');
}

async function openOrientation() {
  await openCatalog();
  await fireEvent.press(button(/^App orientation\b/));
  await header('App orientation');
}

beforeEach(() => {
  mockStore = null;
  mockAllowance = null;
  servedLessons().splice(0, Infinity, ...actualLessons());
});

afterEach(() => setWindow(390, 844));

describe('lessons', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('are reached from More → Settings → Learning, which summarizes the catalog, keeping the tab bar on More', async () => {
    await renderRouter('./src/app', { initialUrl: '/more' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Settings\b/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Learning. Lessons' }));
    expect(await header('Learning')).toBeOnTheScreen();
    expect(button('Back to Settings')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'LESSONS' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Lesson catalog. 24 lessons · 0 completed · 0 in progress' })).toBeOnTheScreen();
    expect(screen.getByText("Lessons never score you, award anything or lock anything. They're available to every account, including when today's challenge attempts are used up. Start here and hint settings stay on this device.")).toBeOnTheScreen();
    expect(within(screen.getByTestId('tab-bar')).getByRole('tab', { name: 'More', selected: true })).toBeOnTheScreen();
  });

  it('list all 24 in their five groups, in any order, with App orientation open to start', async () => {
    await openCatalog();
    expect(screen.getByText('Open any lesson, in any order. Finishing one just marks it completed: no scores, badges or locks.')).toBeOnTheScreen();
    expect(screen.getAllByRole('header').map((item) => item.props.children)).toEqual([
      'Lessons',
      'APP · 1',
      'BLACKJACK · 10',
      'STANDARD CRAPS · 6',
      'ROULETTE · 6',
      'STRATEGY BUILDER · 1',
    ]);
    expect(button('App orientation. Not started · Tabs, help, practice vs casino records')).toBeEnabled();
    expect(button('Card values. Not started')).toBeDisabled();
    expect(button('Card values. Not started')).toHaveProp('accessibilityHint', 'Not available in this version yet.');
    expect(button('Building a strategy. Not started · Conditions, amounts, conflicts, fallbacks, stopping')).toBeEnabled();
  });

  it('step through App orientation, keep the place for Resume or Restart, and finish without a score', async () => {
    await openOrientation();
    expect(screen.getByText('Lesson · App')).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 5')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Find your way around' })).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    expect(await header('Help when you need it')).toBeOnTheScreen();
    expect(screen.getByText('Step 2 of 5')).toBeOnTheScreen();

    await fireEvent.press(button('Back to Lessons'));
    expect(await screen.findByRole('button', { name: 'App orientation. In progress · Step 2 of 5 · Tabs, help, practice vs casino records' })).toBeOnTheScreen();

    await fireEvent.press(button(/^App orientation\b/));
    expect(await screen.findByText('You stopped at step 2 of 5.')).toBeOnTheScreen();
    await fireEvent.press(button('Resume at step 2'));
    expect(await header('Help when you need it')).toBeOnTheScreen();
    expect(screen.queryByText('You stopped at step 2 of 5.')).toBeNull();

    await fireEvent.press(button('Next'));
    await header('Practice, casino and challenge records');
    await fireEvent.press(button('Back'));
    await header('Help when you need it');
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    await header('Lessons at your own pace');
    await fireEvent.press(button('Next'));
    await header('Sources');
    expect(screen.getByText("Tableside's own app design; no outside source")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await fireEvent.press(button('Finish'));
    expect(await header('Practice what you learned')).toBeOnTheScreen();
    for (const game of ['Blackjack', 'Craps', 'Roulette']) expect(button(new RegExp(`^Free play · ${game}\\b`))).toBeOnTheScreen();
    await fireEvent.press(button('Back to lessons'));

    expect(await screen.findByRole('button', { name: 'App orientation. Completed · Tabs, help, practice vs casino records' })).toBeOnTheScreen();
    await fireEvent.press(button('Back to Learning'));
    expect(await screen.findByRole('button', { name: 'Lesson catalog. 24 lessons · 1 completed · 0 in progress' })).toBeOnTheScreen();
  });

  it('restart from step 1, from the resume sheet or the header, keeping the lesson', async () => {
    await openOrientation();
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    await header('Practice, casino and challenge records');
    await fireEvent.press(button('Back to Lessons'));
    await fireEvent.press(await screen.findByRole('button', { name: /^App orientation\. In progress · Step 3 of 5/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Restart from step 1' }));
    expect(await header('Find your way around')).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 5')).toBeOnTheScreen();

    await fireEvent.press(button('Next'));
    await header('Help when you need it');
    await fireEvent.press(button('Restart lesson'));
    expect(await header('Find your way around')).toBeOnTheScreen();
  });

  it('show "Completed (earlier version)" with the reason after a material change, until the learner restarts or moves on in the new version', async () => {
    await openOrientation();
    for (const heading of ['Help when you need it', 'Practice, casino and challenge records', 'Lessons at your own pace', 'Sources']) {
      await fireEvent.press(button('Next'));
      await header(heading);
    }
    await fireEvent.press(button('Finish'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to lessons' }));
    await screen.findByRole('button', { name: /^App orientation\. Completed/ });
    await cleanup();

    const orientation = actualLessons()[0]!;
    servedLessons()[0] = { ...orientation, content: { ...orientation.content!, version: 2, materialVersion: 2, change: 'the Saved tab was described' } };
    await openCatalog();
    await fireEvent.press(await screen.findByRole('button', { name: 'App orientation. Completed (earlier version) · restart · Tabs, help, practice vs casino records' }));
    await header('App orientation');
    expect(screen.getByRole('header', { name: 'Completed (earlier version)' })).toBeOnTheScreen();
    expect(
      screen.getByText('This lesson changed after you finished it: the Saved tab was described. Restart from step 1 to see the new version. Your earlier completion stays in your history.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Step 1 of 5')).toBeOnTheScreen();
    await fireEvent.press(button('Restart lesson'));
    await screen.findByText('Step 1 of 5');
    expect(screen.queryByRole('header', { name: 'Completed (earlier version)' })).toBeNull();
  });

  // Spec 3 Amendment 1 B2, C11; Amendment 2 §3 (lesson player); #152
  it('show a step’s note on our index against the published charts, with its source as a text link opened only on request', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const orientation = actualLessons()[0]!;
    const source = { citation: 'Wizard of Odds, “High-Low Card Counting”, Illustrious 18 table', url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/' };
    const [first, ...rest] = orientation.content!.steps;
    servedLessons()[0] = {
      ...orientation,
      content: { ...orientation.content!, steps: [{ ...first!, publishedNote: { paragraphs: ['Tableside teaches standing at +1; the published chart uses 0.'], source } }, { ...rest[0]!, source }, ...rest.slice(1)], sources: [source] },
    };
    await openOrientation();
    expect(screen.getByRole('header', { name: 'Our index vs published charts' })).toBeOnTheScreen();
    expect(screen.getByText('Tableside teaches standing at +1; the published chart uses 0.')).toBeOnTheScreen();
    const link = screen.getByRole('link', { name: 'Source: Wizard of Odds, “High-Low Card Counting”, Illustrious 18 table' });
    expect(open).not.toHaveBeenCalled();
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith('https://wizardofodds.com/games/blackjack/card-counting/high-low/');

    const headings = orientation.content!.steps.map((step) => step.heading);
    await fireEvent.press(button('Next'));
    await header(headings[1]!);
    expect(screen.queryByRole('header', { name: 'Our index vs published charts' })).toBeNull();
    expect(screen.getByRole('link', { name: /^Source: Wizard of Odds/ })).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    await header(headings[2]!);
    expect(screen.queryByRole('link')).toBeNull();
    open.mockRestore();
  });

  // Spec 3 Lessons › Content requirements (deviation lessons); #152
  it('open Basic with deviations at the step comparing our 16 vs 10 index with the published chart', async () => {
    await openCatalog();
    await fireEvent.press(button(/^Basic with deviations\. Not started/));
    await header('Basic with deviations');
    expect(screen.getByText('Lesson · Blackjack')).toBeOnTheScreen();
    await fireEvent.press(button('Next'));
    await header('The index plays');
    await fireEvent.press(button('Next'));
    expect(await header('When the count changes a decision')).toBeOnTheScreen();
    expect(screen.getByText(/^Step 3 of \d+$/)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Our index vs published charts' })).toBeOnTheScreen();
    expect(screen.getByText(/^For hard 16 against a 10, Tableside teaches: stand at \+1 or higher, otherwise hit\./)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: /^Source: / })).toBeOnTheScreen();
  });

  // Spec 3 Lessons › Structure (worked examples); Amendment 1 B4; #152
  it('replay a blackjack decision as a worked example: the hand, the count, the play and the engine’s explanation', async () => {
    await openCatalog();
    await fireEvent.press(button(/^Basic with deviations\. Not started/));
    await header('Basic with deviations');
    await fireEvent.press(button('Next'));
    await header('The index plays');
    await fireEvent.press(button('Next'));
    await header('When the count changes a decision');
    await fireEvent.press(button('Try the worked example (optional)'));
    await header('Worked example');
    expect(
      screen.getByText('Round 1: 10 on your hand. Already out of the shoe: 2, 3, 4, 5, 6, 2, 3, 4. You have 9 and 7; the dealer shows a 10. Running count +7, 6 decks left: true count +1.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('What’s the play here in basic with deviations?')).toBeOnTheScreen();

    await fireEvent.press(button('Hit'));
    expect(button('Hit')).toHaveProp('accessibilityValue', { text: 'Your pick' });
    expect(button('Stand')).toHaveProp('accessibilityValue', { text: 'Correct' });
    expect(within(screen.getByTestId('scripted-response')).getByText('Basic with deviations stands on 16 against a 10 at this count.')).toBeOnTheScreen();
    expect(screen.getByText('Hitting is the basic play. The supplied true count is +1, which reaches the index, so you stand.')).toBeOnTheScreen();
    const played = () => device.latest?.sound.played.map((play) => play.cue);
    expect(played()).toEqual(['correction-offered']);
    await fireEvent.press(button('Try it again'));
    await fireEvent.press(button('Stand'));
    expect(played()).toEqual(['correction-offered']);
    await fireEvent.press(button('Continue'));
    expect(await header('Plays that kick in when the count drops')).toBeOnTheScreen();
  });

  it('are silent: the Learning screen, catalog and lesson text play no cue or haptic', async () => {
    await openOrientation();
    await fireEvent.press(button('Next'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Restart lesson' }));
    await header('Find your way around');
    expect(device.latest?.sound.played).toEqual([]);
    expect(device.latest?.haptics.fired).toEqual([]);
  });

  // Spec 3 Lessons › Structure (worked examples); Amendment 1 B4, Amendment 4 §2; #144
  describe('worked examples', () => {
    // Spec 3 user story 12
    const usedUp: ChallengeAllowanceState = {
      challengeAllowance: async () => ({ kind: 'free', amount: 5, left: 0, resetsAt: Date.now() + 3_600_000, timeZone: 'America/Denver', allowanceDevice: { here: true } }),
    };
    const cues = () => device.latest?.sound.played.map((play) => play.cue);
    const store = () => mockStore as MemoryTrainingStore;

    beforeEach(() => {
      servedLessons().splice(0, Infinity, ...withWorkedExample(actualLessons()));
      mockAllowance = usedUp;
    });

    async function openExample() {
      await openOrientation();
      expect(screen.queryByRole('button', { name: 'Try the worked example (optional)' })).toBeNull();
      await fireEvent.press(button('Next'));
      await header('Help when you need it');
      await fireEvent.press(button('Try the worked example (optional)'));
      await header('Worked example');
    }

    it('play the scripted response to each choice with the play cues, replay freely, and record nothing but the lesson step', async () => {
      await openExample();
      expect(screen.getByText('App orientation')).toBeOnTheScreen();
      expect(screen.getByText("Practice here is scripted. It never uses an attempt and isn't recorded.")).toBeOnTheScreen();
      expect(screen.getByLabelText('5 of hearts')).toBeOnTheScreen();
      expect(screen.getByText("What's this card's Hi-Lo value?")).toBeOnTheScreen();
      expect(screen.getAllByRole('button').filter((item) => ['plus 1', '0', 'minus 1'].includes(item.props.accessibilityLabel))).toHaveLength(3);
      expect(cues()).toEqual(['card-dealt']);

      await fireEvent.press(button('0'));
      expect(button('0')).toHaveProp('accessibilityValue', { text: 'Your pick' });
      expect(button('plus 1')).toHaveProp('accessibilityValue', { text: 'Correct' });
      expect(button('minus 1')).toHaveProp('accessibilityValue', undefined);
      expect(button('plus 1')).toBeDisabled();
      expect(screen.getByText('5 counts +1 in Hi-Lo.')).toBeOnTheScreen();
      expect(screen.getByText('Only 7, 8 and 9 count 0.')).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt', 'incorrect']);
      expect(device.latest?.haptics.fired).toEqual(['error']);

      await fireEvent.press(button('Try it again'));
      expect(button('0')).toHaveProp('accessibilityValue', undefined);
      expect(screen.queryByText('5 counts +1 in Hi-Lo.')).toBeNull();
      await fireEvent.press(button('plus 1'));
      expect(button('plus 1')).toHaveProp('accessibilityValue', { text: 'Correct' });
      expect(screen.getByText('Low cards leaving the shoe help you, so they count up.')).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt', 'incorrect', 'correct']);

      await fireEvent.press(button('Continue'));
      expect(await header('Practice, casino and challenge records')).toBeOnTheScreen();
      expect(await store().findUnfinishedAttempt()).toBeNull();
      expect(await store().readAttemptRecords()).toEqual([]);
      expect((await store().readLessonEvents()).map((event) => event.event)).toEqual([
        { kind: 'bookmark', step: 2 },
        { kind: 'bookmark', step: 3 },
      ]);
    });

    // Spec 3 Lessons › Structure (worked examples); #155
    it('a strategy step shows the scripted spins, offers the next bets, and answers with the prescription and play cues', async () => {
      servedLessons().splice(0, Infinity, ...withWorkedExample(actualLessons(), MARTINGALE_STRATEGY_STEP));
      await openOrientation();
      await fireEvent.press(button('Next'));
      await header('Help when you need it');
      await fireEvent.press(button('Try the worked example (optional)'));
      await header('Worked example');
      expect(screen.getByText('Spin 1: 10 on Red. The ball lands on 2 black.')).toBeOnTheScreen();
      expect(screen.getByText('Spin 2: 20 on Red. The ball lands on 0 green.')).toBeOnTheScreen();
      expect(screen.getByText('What does Capped Martingale bet next?')).toBeOnTheScreen();
      expect(cues()).toEqual([]);

      await fireEvent.press(button('10 on Red'));
      expect(button('10 on Red')).toHaveProp('accessibilityValue', { text: 'Your pick' });
      expect(button('40 on Red')).toHaveProp('accessibilityValue', { text: 'Correct' });
      expect(screen.getByText('Capped Martingale bets 40 on Red.')).toBeOnTheScreen();
      expect(screen.getByText('Only a win starts the next cycle at 10.')).toBeOnTheScreen();
      expect(cues()).toEqual(['stake-set', 'correction-offered']);

      await fireEvent.press(button('Try it again'));
      await fireEvent.press(button('40 on Red'));
      expect(cues()).toEqual(['stake-set', 'correction-offered', 'stake-set']);
      await fireEvent.press(button('Continue'));
      expect(await header('Practice, casino and challenge records')).toBeOnTheScreen();
      expect(await store().readAttemptRecords()).toEqual([]);
    });

    it('can be skipped from the step that has one, and Back returns to that step without moving on', async () => {
      await openExample();
      await fireEvent.press(button('Back to App orientation'));
      expect(await header('Help when you need it')).toBeOnTheScreen();
      expect((await store().readLessonEvents()).map((event) => event.event)).toEqual([{ kind: 'bookmark', step: 2 }]);

      await fireEvent.press(button('Try the worked example (optional)'));
      await header('Worked example');
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
      await fireEvent.press(button('Skip example'));
      expect(await header('Practice, casino and challenge records')).toBeOnTheScreen();
      expect(cues()).toEqual(['card-dealt', 'card-dealt']);
    });
  });

  describe.each([
    ['portrait at the largest text size', 390, 844, 3],
    ['landscape at the largest text size', 844, 390, 3],
  ])('in %s', (_, width, height, fontScale) => {
    it('the catalog, player and resume sheet are operable by role and label, and rotation keeps the step', async () => {
      await setWindow(width, height, fontScale);
      await openCatalog();
      expect(screen.getByTestId('settings-scroll')).toBeOnTheScreen();
      await fireEvent.press(button(/^App orientation\b/));
      await header('App orientation');
      expect(screen.getByTestId('lesson-scroll')).toBeOnTheScreen();
      await fireEvent.press(button('Next'));
      await header('Help when you need it');

      await setWindow(height, width, fontScale);
      expect(screen.getByText('Step 2 of 5')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Help when you need it' })).toBeOnTheScreen();
      await fireEvent.press(button('Back to Lessons'));
      await fireEvent.press(await screen.findByRole('button', { name: /^App orientation\. In progress/ }));
      expect(await screen.findByTestId('lesson-resume-scroll')).toBeOnTheScreen();
      await fireEvent.press(button('Resume at step 2'));
      expect(await header('Help when you need it')).toBeOnTheScreen();
    });
  });
});

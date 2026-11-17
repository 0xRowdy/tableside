// Spec 3 Testing Decisions › Seam 3; S3-01 PDCaD, S3-02 buD2R, S3-03 P4WjR, drVnR, BFdJT, S3-04 qdnQm, S3-05 EDnGd, S3-06 C53yTW, zAatf, Qv1An, S3-08 liAfT, CEb6T, cX5Gc, S3-09 h0MsKr; #158, #132, #133, #134

import { cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { SubstituteFeedbackPorts } from '@/feedback/testing/substitutes';
import type { AdmissionDecision } from '@/practice/adapters';
import type { ChallengeAllowance } from '@/training/allowance';

let mockAdmission: AdmissionDecision | null = null;
let mockAllowance: ChallengeAllowance | null = null;
let mockStore: unknown = null;

jest.mock('@/training/app-adapters', () => {
  const { FakeClock, entropyFromWords, PI_WORDS } = jest.requireActual('@/practice/testing/substitutes');
  const { alwaysAllowed } = jest.requireActual('@/practice/adapters');
  const { MemoryTrainingStore } = jest.requireActual('@/training/memory-store');
  return {
    createTrainingAdapters: () => {
      mockStore = new MemoryTrainingStore();
      return {
        store: mockStore,
        access: { ...alwaysAllowed, beforeChallenge: async () => mockAdmission ?? alwaysAllowed.beforeChallenge() },
        allowance: { challengeAllowance: async () => mockAllowance },
        clock: new FakeClock(undefined, true),
        entropy: entropyFromWords(PI_WORDS),
        newId: () => 'attempt-1',
        device: 'test-device',
        owner: 'local',
        quarantine: { version: 0, entries: [] },
      };
    },
  };
});

const MIDNIGHT_IN_DENVER_MST = Date.UTC(2026, 10, 18, 7);
const MIDNIGHT_IN_LOS_ANGELES_PST = Date.UTC(2026, 10, 18, 8);
const MOUNTAIN_FREE: ChallengeAllowance = { kind: 'free', amount: 5, left: 4, resetsAt: MIDNIGHT_IN_DENVER_MST, timeZone: 'America/Denver', allowanceDevice: { here: true } };

// Spec 1 Game rules, Counting (Hi-Lo)
const HI_LO: Record<string, string> = { Ace: 'minus 1', '2': 'plus 1', '3': 'plus 1', '4': 'plus 1', '5': 'plus 1', '6': 'plus 1', '7': '0', '8': '0', '9': '0', '10': 'minus 1', Jack: 'minus 1', Queen: 'minus 1', King: 'minus 1' };

const shownCard = () => screen.getByTestId('challenge-card').props.accessibilityLabel as string;
const answerFor = (card: string) => HI_LO[card.split(' of ')[0]!]!;
const wrongFor = (card: string) => (answerFor(card) === 'plus 1' ? 'minus 1' : 'plus 1');
const cues = () => (jest.requireMock('@/feedback/device-ports') as { latest: SubstituteFeedbackPorts }).latest.sound.played.map((play) => play.cue);

async function openSetup() {
  await renderRouter('./src/app', { initialUrl: '/counting' });
  await screen.findByRole('header', { name: 'Counting' });
  await fireEvent.press(screen.getByRole('button', { name: 'Learn: Card values' }));
  await screen.findByRole('header', { name: 'Card values' });
}

beforeEach(() => {
  mockAdmission = null;
  mockAllowance = MOUNTAIN_FREE;
});

describe('the Counting tab', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('shows the four challenge categories in the suggested order, all available', async () => {
    await renderRouter('./src/app', { initialUrl: '/counting' });
    await screen.findByRole('header', { name: 'Counting' });
    expect(screen.getByText('SUGGESTED ORDER · ALL FOUR AVAILABLE NOW')).toBeOnTheScreen();
    expect(screen.getAllByRole('header').map((header) => header.props.children)).toEqual(['Counting', 'Card values', 'Running count', 'True-count conversion', 'Table counting']);
    expect(screen.getByText('20 cards covering every rank. Answer +1, 0 or −1 for each.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Learn: Card values' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check: Card values' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Learn: Running count' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check: Running count' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Learn: True-count conversion' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check: True-count conversion' })).toBeEnabled();
    expect(screen.getByText('Recommendations use your accuracy only, never speed or winnings. Nothing here is locked.')).toBeOnTheScreen();
  });

  describe('allowance wording (Spec 3 Amendment 4 §2–3)', () => {
    async function openTab(allowance: ChallengeAllowance) {
      mockAllowance = allowance;
      await renderRouter('./src/app', { initialUrl: '/counting' });
      await screen.findByRole('header', { name: 'Counting' });
    }

    it('shows attempts left and the actual reset instant in the allowance timezone', async () => {
      await openTab(MOUNTAIN_FREE);
      expect(await screen.findByText('4 of 5 challenge attempts left today · resets at 12:00 AM Mountain Time')).toBeOnTheScreen();
      expect(screen.getByText("Starting an attempt uses one. Resuming one, showing the count and lessons don't.")).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'See premium' })).toBeOnTheScreen();
      expect(screen.queryByText(/tomorrow/)).toBeNull();
    });

    it('takes the amounts and timezone from the policy, not a fixed 5', async () => {
      await openTab({ ...MOUNTAIN_FREE, amount: 10, left: 7, resetsAt: MIDNIGHT_IN_LOS_ANGELES_PST, timeZone: 'America/Los_Angeles' });
      expect(await screen.findByText('7 of 10 challenge attempts left today · resets at 12:00 AM Pacific Time')).toBeOnTheScreen();
    });

    it('shows the empty state with the reset time when today’s attempts are used (RqPCB)', async () => {
      await openTab({ ...MOUNTAIN_FREE, left: 0 });
      expect(await screen.findByText('No challenge attempts left today')).toBeOnTheScreen();
      expect(
        screen.getByText("You've used today's 5 challenge attempts. They reset at 12:00 AM Mountain Time. Lessons, worked examples and your records stay open."),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'See premium' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Plans arrive in a later update.');
      expect(screen.getByRole('button', { name: 'Learn: Card values' })).toBeEnabled();
    });

    it('setup shows the attempts left; nothing starts when none are left or they are on another device', async () => {
      mockAllowance = { ...MOUNTAIN_FREE, left: 1 };
      await openSetup();
      expect(await screen.findByText("Starting uses 1 of your 1 attempt left today. Resuming doesn't use another.")).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeEnabled();
      await cleanup();

      mockAllowance = { ...MOUNTAIN_FREE, left: 0 };
      await openSetup();
      expect(await screen.findByText("You've used today's 5 challenge attempts. They reset at 12:00 AM Mountain Time.")).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'See premium' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeDisabled();
      await cleanup();

      mockAllowance = { ...MOUNTAIN_FREE, allowanceDevice: { here: false, name: 'iPad' } };
      await openSetup();
      expect(await screen.findByText("Today's challenge attempts are on iPad. Move them here in More › Settings › Offline & allowance.")).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeDisabled();
      await cleanup();

      mockAllowance = { kind: 'premium' };
      await openSetup();
      expect(await screen.findByText('Unlimited challenges (premium)')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'See premium' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeEnabled();
    });

    it('shows unlimited challenges for premium, with no premium prompt', async () => {
      await openTab({ kind: 'premium' });
      expect(await screen.findByText('Unlimited challenges (premium)')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'See premium' })).toBeNull();
      expect(screen.queryByText(/attempts left/)).toBeNull();
    });

    it('names the allowance device when today’s attempts are on another device (S5-17 j3UhJ)', async () => {
      await openTab({ ...MOUNTAIN_FREE, allowanceDevice: { here: false, name: 'iPad' } });
      expect(await screen.findByText("Today's challenge attempts are on iPad.")).toBeOnTheScreen();
      expect(screen.getByText('Move them here in More › Settings › Offline & allowance.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Offline & allowance' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'See premium' })).toBeNull();
      const check = screen.getByRole('button', { name: 'Check: Card values' });
      expect(check).toBeDisabled();
      expect(within(check).getByText("Today's challenge attempts are on iPad. Move them here in More › Settings › Offline & allowance.")).toBeOnTheScreen();
      expect(within(screen.getByRole('button', { name: 'Learn: Card values' })).getByText('Learn')).toBeOnTheScreen();
      expect(screen.queryByText(/attempts left/)).toBeNull();
    });
  });

  it('sets up a card-values Learn attempt with the charge notice before anything starts', async () => {
    await openSetup();
    const variant = within(screen.getByLabelText('Variant'));
    expect(variant.getByRole('radio', { name: 'Learn', checked: true })).toBeOnTheScreen();
    expect(variant.getByRole('radio', { name: 'Check' })).toBeEnabled();
    expect(screen.getByText(/Learn tells you after each answer whether it's right/)).toBeOnTheScreen();
    expect(await screen.findByText("Starting uses 1 of your 4 attempts left today. Resuming doesn't use another.")).toBeOnTheScreen();
    expect(mockStore && (await (mockStore as { findUnfinishedAttempt(): Promise<unknown> }).findUnfinishedAttempt())).toBeNull();
    expect(screen.getByRole('button', { name: 'Start Learn attempt' })).toBeEnabled();
  });

  it('shows no content when admission is denied', async () => {
    mockAdmission = { status: 'denied', provenance: 'test', disposition: 'stop', reason: 'No attempts left today.' };
    await openSetup();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Learn attempt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/This attempt can’t start right now/);
    expect(screen.queryByTestId('challenge-card')).toBeNull();
  });

  it('runs a Learn attempt: a wrong first answer is explained and retried, and results show the exact score with N/A for untested skills', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Learn attempt' }));
    await screen.findByText('Card 1 of 20');
    expect(screen.getByText('Learn · self-paced')).toBeOnTheScreen();

    const first = shownCard();
    const wrong = answerFor(first) === 'plus 1' ? 'minus 1' : 'plus 1';
    await fireEvent.press(screen.getByRole('button', { name: wrong }));
    expect(screen.getByText('NOT QUITE · YOUR FIRST ANSWER IS SCORED')).toBeOnTheScreen();
    expect(screen.getByText(/Hi-Lo values: 2 to 6 are \+1\. 7, 8 and 9 are 0\. 10, J, Q, K and A are −1\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: wrong })).toHaveAccessibilityValue({ text: 'Your answer' });
    expect(screen.getByRole('button', { name: answerFor(first) })).toHaveAccessibilityValue({ text: 'Correct' });
    await fireEvent.press(screen.getByRole('button', { name: 'Try this card again' }));
    expect(screen.queryByText('NOT QUITE · YOUR FIRST ANSWER IS SCORED')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: answerFor(first) }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));

    for (let card = 2; card <= 20; card++) {
      await screen.findByText(`Card ${card} of 20`);
      await fireEvent.press(screen.getByRole('button', { name: answerFor(shownCard()) }));
      await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
    }

    await screen.findByRole('header', { name: 'Results' });
    expect(screen.getByText('Card values · Learn · self-paced')).toBeOnTheScreen();
    expect(screen.getByText('Completed · Learn')).toBeOnTheScreen();
    expect(screen.getByText('SKILL SCORES · FIRST ANSWERS')).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values, 20 cards: 19 of 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, Not tested: N/A')).toBeOnTheScreen();
    expect(screen.getByLabelText('True count, Not tested: N/A')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry with new cards' })).toBeEnabled();
    expect(await screen.findByText("When you're ready, try Check: it holds every answer until the end. 4 attempts left today. Retry starts a fresh attempt.")).toBeOnTheScreen();
  });

  it('runs a Check attempt: every entry is recorded alike with cue 10, nothing is marked until results, and the review lists every card', async () => {
    await openSetup();
    await fireEvent.press(within(screen.getByLabelText('Variant')).getByRole('radio', { name: 'Check' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start Check attempt' }));
    await screen.findByText('Card 1 of 20');
    expect(screen.getByText('Check · self-paced')).toBeOnTheScreen();

    const cards: string[] = [];
    for (let card = 1; card <= 20; card++) {
      await screen.findByText(`Card ${card} of 20`);
      const shown = shownCard();
      cards.push(shown);
      if (card === 3) await fireEvent.press(screen.getByRole('button', { name: 'Skip (counts as incorrect)' }));
      else await fireEvent.press(screen.getByRole('button', { name: card === 2 ? wrongFor(shown) : answerFor(shown) }));
      expect(screen.queryByTestId('coach-note')).toBeNull();
      expect(screen.queryByText(/Correct|Your answer|NOT QUITE/)).toBeNull();
    }

    await screen.findByRole('header', { name: 'Results' });
    expect(cues().filter((cue) => cue === 'answer-accepted')).toHaveLength(20);
    expect(cues().filter((cue) => cue === 'correct' || cue === 'incorrect')).toEqual([]);
    expect(screen.getByText('Card values · Check · self-paced')).toBeOnTheScreen();
    expect(screen.getByText('Completed · unassisted')).toBeOnTheScreen();
    expect(screen.getByLabelText('Card values, 20 cards: 18 of 20')).toBeOnTheScreen();
    expect(await screen.findByText('4 attempts left today. Retry starts a fresh attempt.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Review cards' }));
    await screen.findByRole('header', { name: 'Card review' });
    expect(screen.getByText('Card values · Check · 18 / 20')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Card 1, ${cards[0]}: you entered ${answerFor(cards[0]!)}, correct ${answerFor(cards[0]!)}, match`)).toBeOnTheScreen();
    const off = answerFor(cards[1]!) === '0' ? 1 : 2;
    expect(screen.getByLabelText(`Card 2, ${cards[1]}: you entered ${wrongFor(cards[1]!)}, correct ${answerFor(cards[1]!)}, off by ${off}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`Card 3, ${cards[2]}: skipped, correct ${answerFor(cards[2]!)}, counts as incorrect`)).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/^Card \d+, /)).toHaveLength(20);

    await fireEvent.press(screen.getByRole('button', { name: 'Back to Results' }));
    await screen.findByRole('header', { name: 'Results' });
  });

  it('finishes an already-charged attempt after the allowance moves to another device, with no premium prompt during it', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Learn attempt' }));
    await screen.findByText('Card 1 of 20');
    mockAllowance = { ...MOUNTAIN_FREE, allowanceDevice: { here: false, name: 'iPad' } };
    for (let card = 1; card <= 20; card++) {
      await screen.findByText(`Card ${card} of 20`);
      expect(screen.queryByText(/premium/)).toBeNull();
      expect(screen.queryByTestId('allowance-banner')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: answerFor(shownCard()) }));
      await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
    }
    await screen.findByRole('header', { name: 'Results' });
    expect(await screen.findByText("When you're ready, try Check: it holds every answer until the end. Today's challenge attempts are on iPad. Move them here in More › Settings › Offline & allowance.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry with new cards' })).toBeDisabled();
  });

  it('results say when no attempts are left, and Retry waits for the reset', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('button', { name: 'Start Learn attempt' }));
    mockAllowance = { ...MOUNTAIN_FREE, left: 0 };
    for (let card = 1; card <= 20; card++) {
      await screen.findByText(`Card ${card} of 20`);
      await fireEvent.press(screen.getByRole('button', { name: answerFor(shownCard()) }));
      await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
    }
    await screen.findByRole('header', { name: 'Results' });
    expect(await screen.findByText("When you're ready, try Check: it holds every answer until the end. You've used today's 5 challenge attempts. They reset at 12:00 AM Mountain Time.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry with new cards' })).toBeDisabled();
  });

  describe('running count', () => {
    const HI_LO_VALUE: Record<string, number> = { 'plus 1': 1, '0': 0, 'minus 1': -1 };
    const valueOf = (card: string) => HI_LO_VALUE[answerFor(card)]!;
    const typed = (count: number) => (count < 0 ? `−${-count}` : String(count));
    const signedText = (count: number) => (count > 0 ? `+${count}` : count < 0 ? `−${-count}` : '0');

    async function enterCount(count: number) {
      await fireEvent.changeText(screen.getByLabelText('Running count'), typed(count));
      await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    }

    async function start(variant: 'Learn' | 'Check') {
      await renderRouter('./src/app', { initialUrl: '/counting' });
      await screen.findByRole('header', { name: 'Counting' });
      await fireEvent.press(screen.getByRole('button', { name: `${variant}: Running count` }));
      await screen.findByRole('header', { name: 'Running count' });
      expect(screen.getByText(/Learn asks for the count after every card; Check asks after cards 13, 26, 39 and 52/)).toBeOnTheScreen();
      await fireEvent.press(within(screen.getByLabelText('Variant')).getByRole('radio', { name: variant }));
      await fireEvent.press(screen.getByRole('button', { name: `Start ${variant} attempt` }));
      await screen.findByText(variant === 'Check' ? 'Card 1 of 52 · checkpoint 1 of 4' : 'Card 1 of 52');
    }

    it('runs a Check attempt: checkpoints after 13, 26, 39 and 52, a malformed count rejected with cue 9, the count revealed at card 21, and a review that notes drift', async () => {
      await start('Check');
      let count = 0;
      for (let card = 1; card <= 52; card++) {
        const checkpoint = Math.ceil(card / 13);
        await screen.findByText(`Card ${card} of 52 · checkpoint ${checkpoint} of 4`);
        count += valueOf(shownCard());
        if (card === 21) {
          const before = cues();
          await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
          await fireEvent.press(screen.getByRole('button', { name: 'Show count and mark assisted' }));
          expect(await screen.findByTestId('count-aid')).toHaveTextContent(`Running count${signedText(count)}`);
          expect(cues()).toEqual(before);
          await fireEvent.press(screen.getByRole('switch', { name: 'Show running count' }));
          expect(screen.queryByTestId('count-aid')).toBeNull();
        }
        if (card % 13 !== 0) {
          expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
          await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
          continue;
        }
        expect(screen.getByText(`Enter the running count after ${card} cards`)).toBeOnTheScreen();
        if (card === 13) {
          const before = cues().length;
          await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
          expect(screen.getByRole('alert')).toHaveTextContent("Enter a count first. Nothing was submitted, and it doesn't count against you.");
          expect(cues().slice(before)).toEqual(['input-rejected']);
          expect(screen.getByText('Card 13 of 52 · checkpoint 1 of 4')).toBeOnTheScreen();
          await enterCount(count);
        } else if (card === 52) await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
        else await enterCount(count + 2);
        expect(screen.queryByText(/Correct|Off by|Match/)).toBeNull();
      }

      await screen.findByRole('header', { name: 'Results' });
      expect(cues().filter((cue) => cue === 'answer-accepted')).toHaveLength(4);
      expect(screen.getByText('Running count · Check · self-paced')).toBeOnTheScreen();
      expect(screen.getByText('Completed · assisted')).toBeOnTheScreen();
      expect(
        screen.getByText("You showed the running count at card 21, which marks the whole attempt assisted. It's compared only with other assisted attempts at these settings."),
      ).toBeOnTheScreen();
      expect(screen.getByText('No milestone or personal best for unassisted Check')).toBeOnTheScreen();
      expect(screen.getByLabelText('Running count, 4 checkpoints: 1 of 4')).toBeOnTheScreen();
      expect(screen.getByLabelText('Card values, Not tested: N/A')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Retry with a new shuffle' })).toBeEnabled();

      await fireEvent.press(screen.getByRole('button', { name: 'Review checkpoints' }));
      await screen.findByRole('header', { name: 'Checkpoint review' });
      expect(screen.getByText('Running count · Check · 1 / 4')).toBeOnTheScreen();
      expect(screen.getAllByLabelText(/^Checkpoint \d, after card \d+: /)).toHaveLength(4);
      expect(screen.getByLabelText(/^Checkpoint 1, after card 13: you entered .*, error 0, match$/)).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Checkpoint 2, after card 26: you entered .*, error plus 2, off by 2$/)).toBeOnTheScreen();
      expect(screen.getByLabelText(`Checkpoint 4, after card 52: skipped, correct ${count > 0 ? `plus ${count}` : count < 0 ? `minus ${-count}` : '0'}, counts as incorrect`)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Running count lesson. Suggested after this attempt' })).toBeDisabled();
      expect(screen.getByTestId('drift-note')).toHaveTextContent(
        'From checkpoint 2 on, your count ran 2 above the reference. One early miss likely carried through. Each checkpoint still counts as its own error.',
      );
    });

    it('runs a Learn attempt: the count is asked after every card and explained before the next card', async () => {
      await start('Learn');
      let count = 0;
      for (let card = 1; card <= 52; card++) {
        await screen.findByText(`Card ${card} of 52`);
        count += valueOf(shownCard());
        if (card === 1) {
          await enterCount(count + 1);
          expect(screen.getByText(`The count after card 1 is ${signedText(count)}.`)).toBeOnTheScreen();
          await fireEvent.press(screen.getByRole('button', { name: 'Try this card again' }));
        }
        await enterCount(count);
        await fireEvent.press(screen.getByRole('button', { name: 'Next card' }));
      }
      await screen.findByRole('header', { name: 'Results' });
      expect(screen.getByText('Completed · Learn')).toBeOnTheScreen();
      expect(screen.getByLabelText('Running count, 52 cards: 51 of 52')).toBeOnTheScreen();
      expect(cues().filter((cue) => cue === 'input-rejected')).toEqual([]);
    });
  });

  describe('true-count conversion', () => {
    const SPOKEN = /^Running count, (minus |plus )?(\d+)$/;
    const typed = (count: number) => (count < 0 ? `−${-count}` : String(count));
    const signedText = (count: number) => (count > 0 ? `+${count}` : count < 0 ? `−${-count}` : '0');

    function given() {
      const [, sign, digits] = SPOKEN.exec(screen.getByLabelText(SPOKEN).props.accessibilityLabel as string)!;
      const running = (sign === 'minus ' ? -1 : 1) * Number(digits);
      const decks = Number((screen.getByLabelText(/^Decks remaining, /).props.accessibilityLabel as string).split(', ')[1]);
      // Spec 3 Challenge content › Conversion: the quotient truncated toward zero
      return { running, decks, trueCount: Math.trunc(running / decks) || 0 };
    }

    async function enterTrueCount(count: number) {
      await fireEvent.changeText(screen.getByLabelText('True count'), typed(count));
      await fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    }

    async function start(variant: 'Learn' | 'Check') {
      await renderRouter('./src/app', { initialUrl: '/counting' });
      await screen.findByRole('header', { name: 'Counting' });
      await fireEvent.press(screen.getByRole('button', { name: `${variant}: True-count conversion` }));
      await screen.findByRole('header', { name: 'True-count conversion' });
      expect(screen.getByText('10 questions. Each gives a running count and the decks remaining; enter the true count. Only your first answer to each question is scored.')).toBeOnTheScreen();
      await fireEvent.press(within(screen.getByLabelText('Variant')).getByRole('radio', { name: variant }));
      await fireEvent.press(screen.getByRole('button', { name: `Start ${variant} attempt` }));
      await screen.findByText('Question 1 of 10');
    }

    it('runs a Check attempt: ten questions with no correctness shown, then results and a review of each question', async () => {
      await start('Check');
      const seen: number[] = [];
      for (let question = 1; question <= 10; question++) {
        await screen.findByText(`Question ${question} of 10`);
        const { running, trueCount } = given();
        seen.push(running);
        expect(screen.queryByRole('switch')).toBeNull();
        if (question === 1) {
          const before = cues().length;
          await enterTrueCount(41);
          expect(screen.getByRole('alert')).toHaveTextContent("Enter a count from −40 to +40. Nothing was submitted, and it doesn't count against you.");
          expect(cues().slice(before)).toEqual(['input-rejected']);
        }
        if (question === 2) await enterTrueCount(trueCount + 1);
        else if (question === 10) await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
        else await enterTrueCount(trueCount);
        expect(screen.queryByText(/Correct|Off by|Match|truncat/)).toBeNull();
      }
      expect([seen.some((running) => running === 0), seen.some((running) => running > 0), seen.some((running) => running < 0)]).toEqual([true, true, true]);

      await screen.findByRole('header', { name: 'Results' });
      expect(cues().filter((cue) => cue === 'answer-accepted')).toHaveLength(10);
      expect(screen.getByText('True-count conversion · Check · self-paced')).toBeOnTheScreen();
      expect(screen.getByLabelText('True count, 10 questions: 8 of 10')).toBeOnTheScreen();
      expect(screen.getByLabelText('Running count, Not tested: N/A')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Retry with new questions' })).toBeEnabled();

      await fireEvent.press(screen.getByRole('button', { name: 'Review questions' }));
      await screen.findByRole('header', { name: 'Question review' });
      expect(screen.getByText('True-count conversion · Check · 8 / 10')).toBeOnTheScreen();
      expect(screen.getAllByLabelText(/^Question \d+, .* divided by [\d.]+: /)).toHaveLength(10);
      expect(screen.getByLabelText(/^Question 2, .*: you entered .*, error plus 1, off by 1$/)).toBeOnTheScreen();
      expect(screen.getByLabelText(/^Question 10, .*: skipped, correct .*, counts as incorrect$/)).toBeOnTheScreen();
      expect(screen.queryByTestId('drift-note')).toBeNull();
    });

    it('runs a Learn attempt: each answer is explained with the arithmetic before the next question', async () => {
      await start('Learn');
      for (let question = 1; question <= 10; question++) {
        await screen.findByText(`Question ${question} of 10`);
        const { trueCount } = given();
        if (question === 1) {
          await enterTrueCount(trueCount + 1);
          expect(screen.getByText(`The true count is ${signedText(trueCount)}.`)).toBeOnTheScreen();
          expect(screen.getByTestId('coach-note')).toHaveTextContent(/÷/);
          await fireEvent.press(screen.getByRole('button', { name: 'Try this question again' }));
        }
        await enterTrueCount(trueCount);
        expect(screen.getByText(`${signedText(trueCount)} is right.`)).toBeOnTheScreen();
        expect(screen.getByLabelText('True count')).toHaveDisplayValue(typed(trueCount));
        expect(screen.getByRole('button', { name: 'Read the conversion lesson' })).toBeDisabled();
        await fireEvent.press(screen.getByRole('button', { name: 'Next question' }));
      }
      await screen.findByRole('header', { name: 'Results' });
      expect(screen.getByText('Completed · Learn')).toBeOnTheScreen();
      expect(screen.getByLabelText('True count, 10 questions: 9 of 10')).toBeOnTheScreen();
    });
  });
});

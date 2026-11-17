// Spec 3 Count checkpoints (table), Reshuffle, Information hiding, Seam 3; S3-07 v82z3, AcmMa, bh8oE, xjtSW, heGUV, j4tjKT, E3Gbeh, kLgWV, qRHlC, j4X6V; S3-09 VToCp; #137, #138

import { DEFAULT_TABLE_SETUP, tableSetup, TABLE_CONTENT, type TableOptions } from '@tableside/definitions';
import {
  advanceChallenge,
  createChallenge,
  RANDOM_PROTOCOL_VERSION,
  readChallengeView,
  type ChallengeCommand,
  type ChallengeState,
  type ChallengeVariant,
  type ChallengeView,
  type TableStep,
} from '@tableside/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CardReview } from '@/counting/CardReview';
import { ChallengeExercise } from '@/counting/ChallengeExercise';
import { attemptRecord, TABLE_PLAY_CHECK } from '@/training/testing/attempt-records';
import type { LearnerCommand } from '@/training/service';
import { expectIndistinguishable, expectNoFeedbackColors, presentedScreen, watchAccessibilityEvents, type AccessibilityEvents } from '@/training/testing/information-hiding';

const seed = (n: number) => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [n, 0x9e3779b9], session: [n * 7 + 1, 0] }) as const;

function attempt(variant: ChallengeVariant, n: number, options: Partial<TableOptions> = {}): ChallengeState {
  const table = tableSetup({ ...DEFAULT_TABLE_SETUP, ...options });
  return send(createChallenge({ attemptId: 'attempt-1', owner: 'local', device: 'test-device', variant, content: TABLE_CONTENT, table }, seed(n)), { kind: 'begin' });
}

function send(state: ChallengeState, command: ChallengeCommand): ChallengeState {
  const result = advanceChallenge(state, { sequence: state.sequence, commandId: `c-${state.sequence}`, command });
  if (result.status !== 'committed') throw new Error(`refused ${JSON.stringify(command)}`);
  return result.state;
}

const stepOf = (state: ChallengeState) => state.items[state.position] as TableStep;

function advanceUntil(start: ChallengeState, wanted: (state: ChallengeState) => boolean): ChallengeState {
  let state = start;
  for (let guard = 0; guard < 2000 && !wanted(state); guard++) {
    state = send(state, state.phase === 'question' ? { kind: 'skip' } : { kind: 'next-item' });
    if (state.phase === 'explanation' && !wanted(state)) state = send(state, { kind: 'next-item' });
  }
  if (!wanted(state)) throw new Error('never reached');
  return state;
}

let events: AccessibilityEvents;
let sent: LearnerCommand[];

beforeAll(() => {
  events = watchAccessibilityEvents();
});

async function present(view: ChallengeView) {
  await cleanup();
  events.clear();
  sent = [];
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ChallengeExercise
        view={view}
        busy={view.phase === 'recorded'}
        saveFailed={false}
        hold={null}
        timer={null}
        pacing="self-paced"
        performanceMs={() => null}
        onCommand={(command) => void sent.push(command)}
        onInputRejected={() => undefined}
        onRetrySave={() => undefined}
        onPause={() => undefined}
        onResume={() => undefined}
        onEnd={() => undefined}
        onLeave={() => undefined}
      />
    </SafeAreaProvider>,
  );
  return presentedScreen(screen.toJSON() as never, events, { mask: ['table-felt'] });
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

describe('the table counting exercise', () => {
  it('asks the running count before the first bet on an empty table, then the true count (S3-07 bh8oE, xjtSW)', async () => {
    const start = attempt('check', 1);
    await present(readChallengeView(start));
    expect(screen.getByText('Table counting')).toBeOnTheScreen();
    expect(screen.getByText('Check · Observe · S17 LS · 75% · N = 1')).toBeOnTheScreen();
    expect(screen.getByText('Edge with basic strategy: 0.33% (this preset)')).toBeOnTheScreen();
    expect(screen.getByText('1 of 10')).toBeOnTheScreen();
    expect(screen.getByText('Simulated')).toBeOnTheScreen();
    expect(screen.getByText('Count checkpoint')).toBeOnTheScreen();
    expect(screen.getByText('Checkpoint before round 1’s bet')).toBeOnTheScreen();
    expect(screen.getByLabelText('6 decks left')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Running count'), '0');
    await press('Next: true count');
    expect(sent).toEqual([{ kind: 'answer', value: 0 }]);

    await present(readChallengeView(send(send(start, { kind: 'answer', value: 0 }), { kind: 'next-item' })));
    expect(screen.getByLabelText('True count')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeOnTheScreen();
  });

  it('reveals the round one card at a time with the hole card face down, while the simulated seat plays (S3-07 v82z3)', async () => {
    const dealing = advanceUntil(attempt('check', 1), (state) => stepOf(state).step === 'deal' && stepOf(state).round === 1 && (stepOf(state) as { to: string }).to === 'dealer' && (stepOf(state) as { face: unknown }).face === null);
    await present(readChallengeView(dealing));
    expect(screen.getByText('Observing')).toBeOnTheScreen();
    expect(screen.getByText('OBSERVE · NO DECISIONS')).toBeOnTheScreen();
    expect(screen.getByText('Keep the count')).toBeOnTheScreen();
    expect(screen.getByText(/betting the table minimum of 10 and playing basic strategy/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Face-down card')).toBeOnTheScreen();
    expect(screen.getByLabelText('King of diamonds')).toBeOnTheScreen();
    expect(screen.queryByLabelText('3 of diamonds')).toBeNull();
    await press('Next card');
    expect(sent).toEqual([{ kind: 'next-item' }]);

    await present(readChallengeView(send(dealing, { kind: 'next-item' })));
    expect(screen.getByText('Seat: Stand')).toBeOnTheScreen();
    expect(screen.getByLabelText('3 of diamonds')).toBeOnTheScreen();
  });

  it('asks the running count after the dealer’s last card with the settled round on the felt (S3-07 bh8oE)', async () => {
    const after = advanceUntil(attempt('check', 1), (state) => stepOf(state).step === 'prompt' && (stepOf(state) as { timing: string }).timing === 'after-round');
    await present(readChallengeView(after));
    expect(screen.getByText('Checkpoint after round 1')).toBeOnTheScreen();
    expect(screen.getByText('Enter the running count, including the dealer’s last card. The next round waits until you submit or skip.')).toBeOnTheScreen();
    expect(screen.getByText('14 · won')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeOnTheScreen();
  });

  it('runs a block checkpoint after round N and says when the next one comes (S3-07 xjtSW)', async () => {
    const start = attempt('check', 1, { interval: 3 });
    await present(readChallengeView(start));
    expect(screen.getByText(/With N = 3 your next checkpoint is after round 3\./)).toBeOnTheScreen();
    await present(readChallengeView(advanceUntil(start, (state) => state.phase === 'question')));
    expect(screen.getByText('Block checkpoint after round 3')).toBeOnTheScreen();
    expect(screen.getByText('N = 3: enter the running and true count after rounds 3, 6, 9 and 10. Other count prompts are off. The next round waits until you submit or skip.')).toBeOnTheScreen();
  });

  it('announces a reshuffle with the count reset and decks remaining back to 6 (S3-07 heGUV)', async () => {
    let shuffled: ChallengeState | null = null;
    for (let n = 1; n < 200 && !shuffled; n++) {
      try {
        shuffled = advanceUntil(attempt('check', n, { extraPlayers: 4, penetration: 50 }), (state) => state.phase !== 'ended' && stepOf(state).step === 'shuffle');
      } catch {
        shuffled = null;
      }
    }
    const view = readChallengeView(shuffled as ChallengeState);
    const round = view.table?.round as number;
    await present(view);
    expect(screen.getByText('Shoe reshuffled')).toBeOnTheScreen();
    expect(screen.getByText('NEW SHOE')).toBeOnTheScreen();
    expect(screen.getByText('The shoe was reshuffled')).toBeOnTheScreen();
    expect(screen.getByText(`The cut card came out in round ${round - 1}. That round finished, then the shoe was shuffled. The running count starts again at 0 and decks remaining is back to 6. Checkpoints carry on as before.`)).toBeOnTheScreen();
    expect(screen.getByLabelText('Decks remaining: 6')).toBeOnTheScreen();
    await press(`Continue to round ${round}’s checkpoint`);
    expect(sent).toEqual([{ kind: 'next-item' }]);
  });

  it('corrects a Learn running count before the next card, explaining the round’s exposed cards (S3-07 AcmMa)', async () => {
    const after = advanceUntil(attempt('learn', 1), (state) => stepOf(state).step === 'prompt' && (stepOf(state) as { timing: string }).timing === 'after-round');
    await present(readChallengeView(send(after, { kind: 'answer', value: 4 })));
    expect(screen.getByText('YOU ENTERED +4 · RUNNING COUNT IS +3')).toBeOnTheScreen();
    expect(screen.getByText('The running count is +3.')).toBeOnTheScreen();
    expect(screen.getByText('Round 1’s exposed cards were K♦, 3♥, 4♣, 3♦, 3♣, 4♣ and Q♣: −1, +1, +1, +1, +1, +1, −1 adds up to +3. The count was 0 before the round, so it’s +3 now.')).toBeOnTheScreen();
    expect(screen.getByText('Only your first answer is scored. The next card waits until the count is right.')).toBeOnTheScreen();
    await press('Try again');
    await press('Show answer');
    expect(sent).toEqual([{ kind: 'retry-item' }, { kind: 'next-item' }]);
  });

  it('keeps a recorded Check checkpoint free of correctness: a right and a wrong count look the same apart from the cards (j4tjKT)', async () => {
    const at = (n: number) => advanceUntil(attempt('check', n), (state) => stepOf(state).step === 'prompt' && (stepOf(state) as { timing: string }).timing === 'after-round');
    const recorded = await present(readChallengeView(send(at(1), { kind: 'answer', value: 3 })));
    expect(screen.getByText('Running count +3 recorded. The table carries on in a moment.')).toBeOnTheScreen();
    expectNoFeedbackColors(recorded);
    const other = await present(readChallengeView(send(at(2), { kind: 'answer', value: 3 })));
    expectIndistinguishable(other, recorded);
  });
});

// Spec 3 User stories 37, 38; Learn, Check and assistance; Amendment 1 A3, B2, B4; #138
describe('the table counting exercise in Play', () => {
  const play = (variant: ChallengeVariant, n: number, countingMode: TableOptions['countingMode'] = 'basic') => attempt(variant, n, { seat: 'play', countingMode });
  const atDecision = (state: ChallengeState) => advanceUntil(state, (candidate) => candidate.phase === 'decision');

  it('offers every move at the learner\'s decision, without the practice balance (S3-07 E3Gbeh, Amendment 2 §3)', async () => {
    const decision = await present(readChallengeView(atDecision(play('check', 1))));
    expect(screen.getByText('Check · Play · S17 LS · 75% · N = 1')).toBeOnTheScreen();
    expect(screen.getByText('You')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Your move' })).toBeOnTheScreen();
    expect(screen.getByText('Check · your move')).toBeOnTheScreen();
    expect(screen.getByText('You have hard 14 against a 3. Choose a move; the next card waits for you.')).toBeOnTheScreen();
    expect(screen.queryByText(/balance/i)).toBeNull();
    for (const move of ['Hit', 'Stand', 'Double', 'Split', 'Surrender']) expect(screen.getByRole('button', { name: move })).toBeEnabled();
    expectNoFeedbackColors(decision);
    await press('Stand');
    expect(sent).toEqual([{ kind: 'play', action: 'stand' }]);
  });

  it('refuses an illegal move by legality alone, then lets the learner choose again (S3-07 kLgWV)', async () => {
    const refused = await present(readChallengeView(send(atDecision(play('check', 1)), { kind: 'play', action: 'split' })));
    expect(screen.getByText('THAT MOVE ISN’T AVAILABLE')).toBeOnTheScreen();
    expect(screen.getByText('You can only split two cards of the same value.')).toBeOnTheScreen();
    expect(
      screen.getByText('K♦ 4♣ isn’t a pair, so Split isn’t a legal move. During a Check attempt Tableside only tells you what’s allowed. It won’t say which move is right, before or after you choose.'),
    ).toBeOnTheScreen();
    expectNoFeedbackColors(refused);
    await press('Choose again');
    expect(screen.getByRole('button', { name: 'Stand' })).toBeOnTheScreen();
  });

  it('asks the true count before a count-dependent decision without showing the move, the index or the reference (S3-07 qRHlC)', async () => {
    let asking: ChallengeState | null = null;
    for (let n = 1; n < 100 && !asking; n++) {
      try {
        asking = advanceUntil(play('check', n, 'deviations'), (state) => state.phase === 'question' && (stepOf(state) as { timing?: string }).timing === 'decision');
      } catch {
        asking = null;
      }
    }
    const shown = await present(readChallengeView(asking as ChallengeState));
    expect(screen.getByText('Check · Play · with deviations · N = 1')).toBeOnTheScreen();
    expect(screen.getByText('Count before your move')).toBeOnTheScreen();
    expect(screen.getByText('Before your decision: true count')).toBeOnTheScreen();
    expect(screen.getByText('Enter the true count, then choose your move.')).toBeOnTheScreen();
    expect(screen.getByText('This prompt means the decision depends on the count. It never shows the right move, the index or the reference count.')).toBeOnTheScreen();
    expect(screen.getByLabelText('True count')).toBeOnTheScreen();
    expectNoFeedbackColors(shown);
  });

  it('pauses a departing Learn move before it plays, with retry or override (S3-07 j4X6V)', async () => {
    await present(readChallengeView(send(atDecision(play('learn', 1)), { kind: 'play', action: 'hit' })));
    expect(screen.getByText('Correction')).toBeOnTheScreen();
    expect(screen.getByText('Marcus · Learn, counting with basic')).toBeOnTheScreen();
    expect(screen.getByText('Before your hit')).toBeOnTheScreen();
    expect(screen.getByText('Stand on 14 against a 3.')).toBeOnTheScreen();
    expect(screen.getByText("Your hit hasn't been played yet.")).toBeOnTheScreen();
    expect(screen.getByText('“Keep my hit” is recorded once as an override and scored as a playing miss.')).toBeOnTheScreen();
    await press('Take it back & stand');
    await press('Keep my hit');
    expect(sent).toEqual([{ kind: 'retry-correction' }, { kind: 'override-correction' }]);
  });

  it('gives the taught index, the published one and why they differ when a Learn deviation correction departs (Amendment 1 B2)', async () => {
    let paused: ChallengeState | null = null;
    for (let n = 1; n < 300 && !paused; n++) {
      let state = play('learn', n, 'deviations');
      for (let guard = 0; guard < 400 && state.phase !== 'ended' && !paused; guard++) {
        if (state.phase === 'decision') {
          const decision = state.table?.seat?.decisions.at(-1);
          const deviation = decision?.explanation.deviation;
          const prescribed = decision?.explanation.prescribed.action;
          const other = readChallengeView(state).table?.decision?.actions.find((move) => move !== prescribed);
          if (deviation && (deviation.published.schlesinger.difference ?? 0) !== 0 && other) {
            paused = send(state, { kind: 'play', action: other });
            break;
          }
          state = send(state, { kind: 'play', action: prescribed ?? 'stand' });
        } else state = send(state, state.phase === 'question' ? { kind: 'skip' } : { kind: 'next-item' });
      }
    }
    await present(readChallengeView(paused as ChallengeState));
    expect(screen.getByText('Why Tableside\'s index can differ from published charts')).toBeOnTheScreen();
    expect(screen.getByText(/Tableside teaches [+−-]?\d+/)).toBeOnTheScreen();
    expect(screen.getByText(/You keep the count yourself; this uses the real count, not the one you entered\./)).toBeOnTheScreen();
  });
});

// Spec 3 S3-09 VToCp, aEdMd; Scoring and review › Attribution; #138
describe('the table Play decision review', () => {
  it('says match, miss or fallback in words and names the right policy on a wrong count without excusing it', async () => {
    const decision = {
      kind: 'table-decision',
      round: 6,
      decision: 'hand',
      hand: 0,
      hands: 1,
      cards: [
        { rank: 7, suit: 'clubs' },
        { rank: 4, suit: 'diamonds' },
        { rank: 5, suit: 'spades' },
      ],
      total: { value: 16, soft: false },
      pair: false,
      up: { rank: 10, suit: 'diamonds' },
      countDependent: true,
      refused: [],
      played: 'hit',
      resolution: 'departed',
    } as const;
    const record = {
      ...attemptRecord({ id: 'a', key: TABLE_PLAY_CHECK, scores: { 'running-count': [20, 20], 'true-count': [10, 11], 'playing-adherence': [1, 2] } }),
      review: [
        { kind: 'table', checkpoint: 12, round: 6, timing: 'decision', count: 'true', position: 80, entered: 0, reference: 2, error: -2 },
        { ...decision, position: 81, trueCount: 2, prescribed: 'stand', fallback: false, chosen: 'hit', entered: 0, atEntered: 'hit' },
        { ...decision, round: 8, position: 95, cards: [{ rank: 6, suit: 'clubs' }, { rank: 5, suit: 'hearts' }, { rank: 2, suit: 'clubs' }], total: { value: 13, soft: false }, up: { rank: 6, suit: 'spades' }, countDependent: false, trueCount: 0, prescribed: 'stand', fallback: true, chosen: 'stand', played: 'stand', resolution: 'followed', entered: null, atEntered: null },
      ],
    } as const;
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <CardReview record={record as never} lesson={undefined} onOpenLesson={() => undefined} onBack={() => undefined} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Decision review')).toBeOnTheScreen();
    expect(screen.getByText('Table counting · Check · Play')).toBeOnTheScreen();
    expect(screen.getByText('Round 6 · true count before the decision')).toBeOnTheScreen();
    expect(screen.getByText('Round 6 · hard 16 vs 10')).toBeOnTheScreen();
    expect(screen.getByText('Playing miss')).toBeOnTheScreen();
    expect(screen.getByText('TC +2')).toBeOnTheScreen();
    expect(screen.getByText('Round 8 · hard 13 vs 6 · fallback')).toBeOnTheScreen();
    expect(screen.getByText('Fallback applied')).toBeOnTheScreen();
    expect(
      screen.getByText('Right policy, wrong count: in round 6 you entered a true count of 0, and at 0 hitting 16 against 10 is the right play. The miss came from the count, not the strategy. Both still count as errors.'),
    ).toBeOnTheScreen();
  });
});

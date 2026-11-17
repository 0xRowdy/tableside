// Spec 3 Count checkpoints (table), Reshuffle, Information hiding, Seam 3; S3-07 v82z3, AcmMa, bh8oE, xjtSW, heGUV, j4tjKT; #137

import { DEFAULT_TABLE_SETUP, observeSetup, TABLE_CONTENT, type TableOptions } from '@tableside/definitions';
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

import { ChallengeExercise } from '@/counting/ChallengeExercise';
import type { LearnerCommand } from '@/training/service';
import { expectIndistinguishable, expectNoFeedbackColors, presentedScreen, watchAccessibilityEvents, type AccessibilityEvents } from '@/training/testing/information-hiding';

const seed = (n: number) => ({ protocol: RANDOM_PROTOCOL_VERSION, key: [n, 0x9e3779b9], session: [n * 7 + 1, 0] }) as const;

function attempt(variant: ChallengeVariant, n: number, options: Partial<TableOptions> = {}): ChallengeState {
  const table = observeSetup({ ...DEFAULT_TABLE_SETUP, ...options });
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
      <ChallengeExercise view={view} busy={view.phase === 'recorded'} saveFailed={false} onCommand={(command) => void sent.push(command)} onInputRejected={() => undefined} onRetrySave={() => undefined} />
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

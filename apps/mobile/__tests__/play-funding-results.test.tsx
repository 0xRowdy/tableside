// Spec 3 Play challenge funding (#20) › Insufficient funds ending, Results; S3-08 ValDZ, e5MASr, S3-09, S3-10 Yy2He; Amendment 2 §3; #139
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CardReview } from '@/counting/CardReview';
import { ChallengeResults } from '@/counting/ChallengeResults';
import { tableSettingsText } from '@/training/blackjack-table-text';
import { NOTHING_EARNED } from '@/training/progress';
import { attemptRecord, TABLE_PLAY_CHECK } from '@/training/testing/attempt-records';

const SCHEDULED = { ...TABLE_PLAY_CHECK, table: { ...(TABLE_PLAY_CHECK.table as NonNullable<typeof TABLE_PLAY_CHECK.table>), betSchedule: true, startingBalance: '300' } };

async function present(record: ReturnType<typeof attemptRecord>, position: number) {
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ChallengeResults
        record={record}
        position={position}
        explanation={null}
        earned={NOTHING_EARNED}
        allowance={undefined}
        onRetry={() => undefined}
        onReview={() => undefined}
        lesson={undefined}
        onOpenLesson={() => undefined}
        onPracticeLearn={() => undefined}
      />
    </SafeAreaProvider>,
  );
}

describe('Play results with challenge finances', () => {
  it('labels an insufficient-funds attempt ended early, keeps the partial scores, and shows challenge finances apart from them (ValDZ)', async () => {
    const record = {
      ...attemptRecord({ id: 'a', key: TABLE_PLAY_CHECK, ending: 'insufficient-funds', scores: { 'running-count': [13, 14], 'true-count': [6, 7], 'playing-adherence': [31, 34] } }),
      finances: { startingBalance: '300', finishingBalance: '4', net: '-296' },
    };
    await present(record, 7);
    expect(screen.getByText('Table counting · Check · Play')).toBeOnTheScreen();
    expect(screen.getByText('Ended early — insufficient funds')).toBeOnTheScreen();
    expect(screen.getByText('After round 7 of 10, no legal opening wager was affordable. Your partial results are kept.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Running count, 14 checkpoints: 13 of 14')).toBeOnTheScreen();
    expect(screen.getByLabelText('Playing adherence, 34 decisions: 31 of 34')).toBeOnTheScreen();
    expect(screen.getByLabelText('Betting adherence, No bet schedule selected: N/A')).toBeOnTheScreen();
    expect(screen.getByText('Challenge finances · not a skill score')).toBeOnTheScreen();
    expect(screen.getByLabelText('Starting: 300')).toBeOnTheScreen();
    expect(screen.getByLabelText('Finishing: 4')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net: −296')).toBeOnTheScreen();
    expect(screen.getByText('An ended-early attempt can’t set a personal best or earn a milestone. It also restarts progress toward the readiness milestone for these settings.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry with a new shoe' })).toBeOnTheScreen();
  });

  it('puts skill scores first on a completed Play attempt, with betting adherence by the bet schedule and finances beside (e5MASr)', async () => {
    const record = {
      ...attemptRecord({ id: 'b', key: { ...SCHEDULED, table: { ...SCHEDULED.table, startingBalance: '1000' } }, scores: { 'running-count': [19, 20], 'true-count': [10, 10], 'playing-adherence': [46, 48], 'betting-adherence': [9, 10] } }),
      finances: { startingBalance: '1000', finishingBalance: '1085', net: '85' },
    };
    await present(record, 10);
    expect(screen.getByText(/^Completed · 10 of 10 rounds · unassisted$/)).toBeOnTheScreen();
    expect(screen.getByText(/Your skill scores come first\. Challenge finances are shown beside them, never inside them\./)).toBeOnTheScreen();
    expect(screen.getByLabelText('Betting adherence, Hi-Lo bet schedule · 10 bets: 9 of 10')).toBeOnTheScreen();
    expect(screen.getByLabelText('Starting: 1,000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Finishing: 1,085')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net: +85')).toBeOnTheScreen();
  });

  it('counts rounds when a table attempt is abandoned (UXrpw)', async () => {
    await present(attemptRecord({ id: 'c', key: TABLE_PLAY_CHECK, ending: 'abandoned' }), 3);
    expect(screen.getByText('Abandoned after round 3 of 10')).toBeOnTheScreen();
  });

  it('reviews each opening wager, naming a legal betting override as a miss (Amendment 1 C4)', async () => {
    const record = {
      ...attemptRecord({ id: 'd', key: SCHEDULED, ending: 'insufficient-funds', scores: { 'betting-adherence': [1, 2] } }),
      review: [
        { kind: 'table-bet', round: 1, position: 3, trueCount: 0, prescribed: '10', chosen: '10', placed: '10', override: false, resolution: 'followed' },
        { kind: 'table-bet', round: 2, position: 40, trueCount: 2, prescribed: '40', chosen: '20', placed: '20', override: true, resolution: 'overridden' },
      ],
    } as const;
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <CardReview record={record as never} lesson={undefined} onOpenLesson={() => undefined} onBack={() => undefined} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Round 1 · opening wager')).toBeOnTheScreen();
    expect(screen.getByText('Match')).toBeOnTheScreen();
    expect(screen.getByText('Betting override · miss')).toBeOnTheScreen();
    expect(screen.getByLabelText('Round 2 · opening wager: you bet 20, reference 40, which the balance couldn’t cover, betting override · miss')).toBeOnTheScreen();
  });

  it('names the bet schedule, base wager and starting balance in the Records settings line', () => {
    expect(tableSettingsText(SCHEDULED.table)).toBe('with basic · S17 LS · 75% · 0 players · N = 1 · bet schedule · base 10 · balance 300');
  });
});

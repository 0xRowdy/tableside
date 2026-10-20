// Seam 3: the S1-10 session result, rendered from a completed record alone so
// spec 4 can reopen it from Saved, and driven through the accessibility tree.
// Records come from the store contract's fixture, varied per case.

import type { QuarantineList, StrategyDeparture } from '@tableside/engine';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionResult } from '@/play/SessionResult';
import type { CompletedPracticeSession } from '@/practice/store';
import { completedRecord } from '@/practice/testing/store-contract';

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
});

const FLAT = { id: 'flat-even-money', revision: 1, name: 'Flat even-money', parameters: { target: 'red' } };

function departure(turn: number, resolution: StrategyDeparture['resolution'], actual: string, subjects: Record<string, string> = {}): StrategyDeparture {
  return {
    id: `activity-1/departure/${turn * 3}`,
    turn,
    resolution,
    actual: [{ target: 'red', amount: actual }],
    explanation: {
      situation: { available: '1000', subjects },
      instructions: [{ id: 'flat', label: '1 unit on the target, every spin' }],
      prescription: { status: 'prescribed', bets: [{ target: 'red', amount: '10' }], held: [] },
      fallback: null,
      state: { counters: {}, lastResult: 'none' },
    },
  } as unknown as StrategyDeparture;
}

function guided(departures: StrategyDeparture[], decisions = 2, followed = 1): CompletedPracticeSession {
  return completedRecord('activity-1', {
    mode: 'guided',
    strategy: FLAT,
    identities: { engine: '0.0.0', rules: { id: 'roulette-single-zero', version: 1 }, strategy: { id: 'flat-even-money', version: 1 }, reference: null, randomProtocol: 1 },
    overrideAffected: departures.some((d) => d.resolution === 'overridden'),
    guidance: { adherence: { betting: { decisions, followed }, playing: null, counting: null }, departures },
  });
}

async function show(record: CompletedPracticeSession, props: { quarantine?: QuarantineList; actions?: React.ReactNode } = {}) {
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <SessionResult record={record} actions={props.actions ?? <Text>actions</Text>} {...(props.quarantine ? { quarantine: props.quarantine } : {})} />
    </SafeAreaProvider>,
  );
}

describe('the S1-10 session result', () => {
  it('shows a free-play session\'s rules line, money and funding, and says why there is no adherence', async () => {
    await show(completedRecord('activity-1', { rebuys: ['500'], cumulativeFunding: '1500', finalCashOut: '1620', netResult: '120', maxDrawdown: '85' }));
    expect(screen.getByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    expect(screen.getByText('Roulette · free play · single zero')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saved. This session is in Saved, Practice. Its result won\'t change.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net result plus 120, Win')).toBeOnTheScreen();
    expect(screen.getByLabelText('Max drawdown 85, includes final settlement')).toBeOnTheScreen();
    for (const label of ['Buy-in 1,000', 'Rebuys (1) 500', 'Total funding 1,500', 'Final cash-out 1,620']) expect(screen.getByLabelText(label)).toBeOnTheScreen();
    expect(screen.getByText('Free play has no strategy, so there\'s no adherence score or Departures.')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: /Departures/ })).toBeNull();
    expect(announcements).toEqual(['Session result. Win, net result plus 120. Final cash-out 1,620. Max drawdown 85.']);
  });

  it('shows a training-bankroll allocation instead of a buy-in, and the craps odds cap in the rules line', async () => {
    await show(
      completedRecord('activity-1', {
        game: 'craps',
        fundingSource: 'training-bankroll',
        rules: { id: 'standard-craps', version: 2, content: { odds: '5x', field: 'triple-12', limits: { flat: { min: '10', max: '1000' }, props: { min: '1', max: '100' } } } },
      }),
    );
    expect(screen.getByText('Craps · free play · standard craps · 5x odds')).toBeOnTheScreen();
    expect(screen.getByLabelText('From training bankroll 1,000')).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Buy-in/)).toBeNull();
    expect(screen.queryByLabelText(/^Rebuys/)).toBeNull();
  });

  it('in guided practice shows adherence apart from the money, and each departure with what the strategy prescribed, what you did and how it resolved, in words', async () => {
    await show(guided([departure(1, 'retried', '50', { 'last-pocket-color': 'none' }), departure(3, 'overridden', '25', { 'last-pocket-color': 'black' })]));
    expect(screen.getByText('Roulette · guided · Flat even-money · single zero')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'How closely you followed the strategy' })).toBeOnTheScreen();
    expect(screen.getByText('Scored apart from money, so a lucky session can\'t hide a missed play.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Betting decisions: 1 of 2 followed, 50%')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Departures, 2' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Spin 1. Strategy: 10 on Red. You: 50 on Red. Retried.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Spin 3 · after black. Strategy: 10 on Red. You: 25 on Red. Overridden.')).toBeOnTheScreen();
    // Resolution is a word, not only a colour.
    expect(screen.getByText('Retried')).toBeOnTheScreen();
    expect(screen.getByText('Overridden')).toBeOnTheScreen();
    expect(screen.getByText('This session includes an override.')).toBeOnTheScreen();
  });

  it('shows the first four departures, then all of them on request, in order', async () => {
    const log = [1, 2, 3, 4, 5, 6].map((turn) => departure(turn, 'retried', String(20 + turn)));
    await show(guided(log, 6, 0));
    expect(screen.getAllByLabelText(/^Spin \d+\./).map((node) => node.props.accessibilityLabel.split('.')[0])).toEqual(['Spin 1', 'Spin 2', 'Spin 3', 'Spin 4']);
    const showAll = screen.getByRole('button', { name: 'Show all 6 entries' });
    expect(showAll).toHaveStyle({ minHeight: 48 });
    await fireEvent.press(showAll);
    expect(screen.getAllByLabelText(/^Spin \d+\./)).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('says when no strategy decision was assessed, and that there were no departures', async () => {
    await show(guided([], 0, 0));
    expect(screen.getByLabelText('Betting decisions: none assessed')).toBeOnTheScreen();
    expect(screen.getByText('No departures: every assessed bet followed the strategy.')).toBeOnTheScreen();
  });

  it('derives quarantine from the shipped list and explains it, without changing the record', async () => {
    const record = completedRecord('activity-1');
    const list: QuarantineList = { version: 2, entries: [{ id: 'q-1', match: { engine: '0.0.0' }, explanation: 'Engine 0.0.0 settled some splits wrongly.' }] };
    await show(record, { quarantine: list });
    expect(screen.getByLabelText('Quarantined. Engine 0.0.0 settled some splits wrongly. This practice session is left out of your totals and adherence.')).toBeOnTheScreen();
    expect(record).toEqual(completedRecord('activity-1'));
  });

  it('takes its actions from the caller, so spec 4 can reopen it from Saved with its own', async () => {
    await show(completedRecord('activity-1'), { actions: <Text>Back to Saved</Text> });
    expect(screen.getByText('Back to Saved')).toBeOnTheScreen();
  });

  it('reflows at the largest text size, keeping every line', async () => {
    const window = Dimensions.get('window');
    await act(() => Dimensions.set({ window: { ...window, width: 320, height: 568, fontScale: 3 }, screen: { ...window, width: 320, height: 568, fontScale: 3 } }));
    await show(guided([departure(1, 'retried', '50')]));
    expect(screen.getByLabelText('Spin 1. Strategy: 10 on Red. You: 50 on Red. Retried.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Buy-in 1,000')).toBeOnTheScreen();
    await act(() => Dimensions.set({ window, screen: window }));
  });
});

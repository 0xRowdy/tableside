// Seam 3: the blackjack counting modes and the Hi-Lo bet schedule (#78),
// rendered through the real routes on the in-memory adapters and driven only
// through the accessibility tree. The shoe is the Random123 "pi digits"
// shuffle: round 1 deals you the 10 of spades and Jack of diamonds (20)
// against a dealer 10 of spades with the 6 of spades face down. A fresh shoe's
// true count is 0, where the schedule bets 1 unit (10).

import { blackjackStrategy } from '@tableside/definitions';
import { explainPlay, type Card, type PlayCorrection } from '@tableside/engine';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

import { playCorrectionCopy } from '@/play/blackjack-coaching';
import { CorrectionPanel } from '@/play/Guidance';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters: create } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => create({ clock: new FakeClock(undefined, true) }) };
});

let announcements: string[] = [];

beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation((message: string) => {
    announcements.push(message);
  });
});

beforeEach(() => {
  announcements = [];
});

const SCHEDULE = 'Practice the Hi-Lo bet schedule';

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

async function openSetup() {
  await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
  await screen.findByRole('header', { name: 'Blackjack' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
}

async function start(mode: string, schedule: boolean) {
  await openSetup();
  await fireEvent.press(screen.getByRole('radio', { name: mode }));
  if (schedule) await fireEvent.press(screen.getByRole('switch', { name: SCHEDULE }));
  await fireEvent.press(screen.getByRole('button', { name: 'Start guided practice' }));
  await screen.findByLabelText('Session balance 1,000');
}

async function bet25AndDeal() {
  await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Initial wager/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
}

/** Every label, hint, value and text in the rendered tree, plus every announcement. */
const everythingSpoken = () => JSON.stringify(screen.toJSON()) + announcements.join(' ');

describe('blackjack counting modes', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(async () => {
    await setWindow(390, 844, 1);
  });

  it('setup offers the four modes; the bet schedule only alongside a counting mode', async () => {
    await openSetup();
    const modes = ['Basic strategy', 'Basic with deviations', 'Counting with basic', 'Counting with deviations'].map((name) => screen.getByRole('radio', { name }));
    expect(screen.getByRole('radio', { name: 'Counting with basic' })).toHaveProp('accessibilityHint', 'You keep the Hi-Lo count. Play is checked against the real count.');
    for (const radio of modes) expect(StyleSheet.flatten(radio.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(screen.queryByRole('switch', { name: SCHEDULE })).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Counting with deviations' }));
    const schedule = screen.getByRole('switch', { name: SCHEDULE });
    expect(schedule).toHaveProp('accessibilityState', { checked: false, disabled: false });
    expect(schedule).toHaveProp('accessibilityHint', '1 / 2 / 4 / 6 / 8 units by true count. Scored separately from your play.');
    await fireEvent.press(schedule);
    expect(screen.getByRole('switch', { name: SCHEDULE })).toHaveProp('accessibilityState', { checked: true, disabled: false });
    expect(screen.getByText('Tableside checks each bet against the schedule before the deal.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Basic with deviations' }));
    expect(screen.queryByRole('switch', { name: SCHEDULE })).toBeNull();
    expect(screen.getByText('Your bets are your own; only your play is checked.')).toBeOnTheScreen();
  });

  it('a schedule that falls outside the edited limits is explained and blocks the start; its amounts are never changed', async () => {
    await openSetup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Counting with basic' }));
    await fireEvent.press(screen.getByRole('switch', { name: SCHEDULE }));
    await fireEvent.changeText(screen.getByLabelText('Initial wager minimum, in units'), '25');
    expect(await screen.findByRole('alert')).toHaveTextContent(/This table's minimum for that bet is 25, so a 10 bet isn't allowed\..*won't change the schedule's amounts/);
    expect(screen.getByRole('button', { name: 'Start guided practice' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('switch', { name: SCHEDULE }));
    expect(screen.getByRole('button', { name: 'Start guided practice' })).toBeEnabled();
  });

  it('counting with basic hides the count; play is assessed, and adherence shows only the play when the bets are your own', async () => {
    await start('Counting with basic', false);
    expect(screen.getByText('Guided · Counting with basic')).toBeOnTheScreen();
    expect(screen.queryByTestId('count-panel')).toBeNull();
    await bet25AndDeal();
    await screen.findByLabelText('Status Your turn');
    expect(screen.queryByTestId('count-panel')).toBeNull();
    expect(everythingSpoken()).not.toMatch(/[Tt]rue count|Running/);

    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await waitFor(() => expect(screen.getByLabelText('Status Settled automatically')).toBeOnTheScreen());
    expect(screen.getByLabelText('Strategy adherence: Followed 1 of 1 decision. Departures 0.')).toBeOnTheScreen();
    expect(everythingSpoken()).not.toMatch(/[Tt]rue count/);
  });

  it('with the schedule a bet off it pauses before the deal; retry sets the scheduled bet; betting and playing adherence stay apart', async () => {
    await start('Counting with deviations', true);
    expect(screen.getByText('Guided · Counting with deviations · bet schedule')).toBeOnTheScreen();
    expect(screen.getByLabelText('Strategy adherence: Playing: no strategy decisions yet · Betting: no strategy rounds yet. Departures 0.')).toBeOnTheScreen();
    // Before the player bets, nothing names the scheduled bet or the count.
    expect(everythingSpoken()).not.toMatch(/[Tt]rue count|bet schedule bets|Take it back/);

    await bet25AndDeal();
    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'Before your round' })).toBeOnTheScreen();
    expect(panel.getByText('Counting with deviations · bet schedule bets 10 on your hand.')).toBeOnTheScreen();
    // The count is the player's to keep: the correction names the band, never the count.
    expect(panel.getByText('Checked against the actual true count, which you keep in this mode.')).toBeOnTheScreen();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/[Tt]rue count (is|for)|Running/);
    expect(panel.getByText('Matching instruction: "True count below +1: 1 unit (10)".')).toBeOnTheScreen();
    expect(panel.getByText("You've set 25 on your hand. Nothing has been placed yet.")).toBeOnTheScreen();
    expect(announcements.join(' ')).toContain('Paused before the deal: nothing has been dealt yet.');
    // Nothing was dealt.
    expect(screen.queryByLabelText('Face-down card')).toBeNull();

    await act(() => fireEvent.press(panel.getByRole('button', { name: 'Take it back & bet 10 on your hand' })));
    await waitFor(() => expect(screen.queryByTestId('correction-panel')).toBeNull());
    expect(announcements.join(' ')).toContain('Wager 10 on the table.');
    await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
    await screen.findByLabelText('Status Your turn');
    expect(screen.queryByTestId('count-panel')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Stand' }));
    await waitFor(() => expect(screen.getByLabelText('Status Settled automatically')).toBeOnTheScreen());
    expect(
      screen.getByLabelText('Strategy adherence: Playing: followed 1 of 1 decision · Betting: followed 0 of 1 round. Departures 1.'),
    ).toBeOnTheScreen();
  });

  it('in landscape at the largest text the bet correction is a full-screen panel restating the table, with full-size targets', async () => {
    await start('Counting with basic', true);
    await setWindow(844, 390, 3.1);
    await bet25AndDeal();
    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'The table right now' })).toBeOnTheScreen();
    expect(panel.getByText('Balance: 975')).toBeOnTheScreen();
    expect(panel.getByText('On the table: 25 (one hand)')).toBeOnTheScreen();
    for (const name of ['Take it back & bet 10 on your hand', 'Keep my bets']) {
      expect(StyleSheet.flatten(panel.getByRole('button', { name }).props.style).minHeight).toBeGreaterThanOrEqual(48);
    }
  });

  it('a counting-with-deviations play correction states the index, never the count the player keeps', async () => {
    // 16 (10, 2, 4) against a 10 at an actual true count of +1: the index stands.
    const card = (rank: number): Card => ({ deck: 0, suit: 'clubs', rank: rank as Card['rank'] });
    const definition = blackjackStrategy('S17_LS', 'counting-with-deviations');
    const result = explainPlay(definition, {
      game: 'blackjack',
      rules: { dealer: 'S17', lateSurrender: true },
      decision: 'hand',
      cards: [card(10), card(2), card(4)],
      hands: 1,
      up: card(10),
      balance: '975',
      stake: '25',
      shoe: { running: 5, remaining: 260 },
    });
    if (!result.ok) throw new Error(result.error);
    const correction: PlayCorrection = { id: 'd1', turn: 1, decision: 0, explanation: result.explanation, actual: { action: 'hit', amount: null } };
    await render(
      <CorrectionPanel
        copy={playCorrectionCopy(definition.name, correction, { dealer: 'S17', lateSurrender: true }, false)}
        table={{ phase: 'Play', balance: '975', wagers: '25' }}
        fullScreen={false}
        busy={false}
        onRetry={() => undefined}
        onOverride={() => undefined}
      />,
    );
    expect(screen.getByText('Counting with deviations stands on 16 against a 10 at this count.')).toBeOnTheScreen();
    expect(screen.getByText("You keep the count in this mode; your play was checked against the actual count, which Tableside doesn't show.")).toBeOnTheScreen();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/true count is|Running/);
  });
});

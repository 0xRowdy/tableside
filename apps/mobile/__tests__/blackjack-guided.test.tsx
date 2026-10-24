// Seam 3: guided blackjack, basic strategy and basic with deviations, rendered
// through the real routes on the in-memory adapters and driven only through
// the accessibility tree. The shoe is the Random123 "pi digits" shuffle: round
// 1 deals you the 10 of spades and Jack of diamonds (20) against a dealer 10
// of spades up with the 6 of spades face down; the next card is the Ace of
// diamonds. Basic strategy stands on 20 against a 10, so a hit departs.

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

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

async function startGuided(mode: 'Basic strategy' | 'Basic with deviations') {
  await renderRouter('./src/app', { initialUrl: '/play?game=blackjack' });
  await screen.findByRole('header', { name: 'Blackjack' });
  await fireEvent.press(screen.getByRole('radio', { name: 'Guided practice' }));
  await fireEvent.press(screen.getByRole('radio', { name: mode }));
  await fireEvent.press(screen.getByRole('button', { name: 'Start guided practice' }));
  await screen.findByLabelText('Session balance 1,000');
}

async function betAndDeal() {
  await fireEvent.press(screen.getByRole('radio', { name: '25 chip' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Initial wager/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Deal' }));
  await screen.findByLabelText('Status Your turn');
}

/** Every label, hint, value and text in the rendered tree, plus every announcement. */
function everythingSpoken(): string {
  return JSON.stringify(screen.toJSON()) + announcements.join(' ');
}

describe('guided blackjack', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  afterEach(async () => {
    await setWindow(390, 844, 1);
  });

  it('starts basic strategy from setup; the strategy strip shows adherence apart from the balance, and no answer shows before you act', async () => {
    await startGuided('Basic strategy');
    expect(screen.getByText('Guided · Basic strategy')).toBeOnTheScreen();
    expect(screen.getByLabelText('Strategy adherence: No strategy decisions yet. Departures 0.')).toBeOnTheScreen();
    expect(screen.queryByTestId('count-panel')).toBeNull();

    await betAndDeal();
    // The prescription is the reference answer: nothing names it before the player acts.
    expect(everythingSpoken()).not.toMatch(/stands on|Take it back|6 of spades|6♠|Ace of diamonds/);
    for (const name of ['Hit', 'Stand', 'Double']) expect(screen.getByRole('button', { name })).toBeEnabled();
  });

  it('pauses a departing hit before it is played, explains it from the facts, and retry stands and settles once', async () => {
    await startGuided('Basic strategy');
    await betAndDeal();

    await fireEvent.press(screen.getByRole('button', { name: 'Hit' }));

    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'Before your hit' })).toBeOnTheScreen();
    expect(panel.getByText('Basic strategy stands on a pair of tens (20) against a 10.')).toBeOnTheScreen();
    expect(panel.getByText('You have 10♠ J♦ (20). The dealer shows 10♠.')).toBeOnTheScreen();
    expect(panel.getByText('Basic strategy (S17, LS) stands on a pair of tens (20) against 10.')).toBeOnTheScreen();
    expect(panel.getByText("Your hit hasn't been played yet.")).toBeOnTheScreen();
    expect(announcements.join(' ')).toContain('Paused before your hit: nothing has been played yet.');
    // Nothing was dealt: the hole card is still face down, and the hand still has two cards.
    expect(screen.getByLabelText('Face-down card')).toBeOnTheScreen();
    expect(everythingSpoken()).not.toMatch(/6 of spades|Ace of diamonds/);
    expect(screen.getByLabelText('Status Paused · your move')).toBeOnTheScreen();
    expect(within(screen.getByTestId('phase-stepper')).getByLabelText('Step 3 of 4, Play, current')).toBeOnTheScreen();
    // Touch targets: 48 at least.
    for (const name of ['Take it back & stand', 'Keep my hit']) {
      expect(StyleSheet.flatten(panel.getByRole('button', { name }).props.style).minHeight).toBeGreaterThanOrEqual(48);
    }

    await fireEvent.press(panel.getByRole('button', { name: 'Take it back & stand' }));

    await waitFor(() => expect(screen.getByLabelText('Status Settled automatically')).toBeOnTheScreen());
    expect(announcements.join(' ')).toContain('Recorded once in Departures as taken back.');
    expect(announcements).toContain('You win 25. Balance 1,025.');
    expect(screen.getByLabelText('Strategy adherence: Followed 0 of 1 decision. Departures 1.')).toBeOnTheScreen();
  });

  it('an override plays your move for that one decision; the strategy coaches the next round', async () => {
    await startGuided('Basic strategy');
    await betAndDeal();
    await fireEvent.press(screen.getByRole('button', { name: 'Hit' }));
    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByText('"Keep my hit" is recorded once in your Departures as an override. The strategy picks up again at your next decision.')).toBeOnTheScreen();

    await fireEvent.press(panel.getByRole('button', { name: 'Keep my hit' }));

    // The ace makes 21, and the round settles.
    await waitFor(() => expect(screen.getByLabelText('Status Settled automatically')).toBeOnTheScreen());
    expect(screen.getByText('Guided · Basic strategy')).toBeOnTheScreen();
    expect(screen.getByLabelText('Strategy adherence: Followed 0 of 1 decision. Departures 1.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Stop strategy' })).toBeEnabled();
  });

  it('at the largest text the correction is a full-screen panel restating the cards, balance, wagers and phase', async () => {
    await startGuided('Basic strategy');
    await betAndDeal();
    await setWindow(390, 844, 3.1);
    await fireEvent.press(screen.getByRole('button', { name: 'Hit' }));

    const panel = within(await screen.findByTestId('correction-panel'));
    expect(panel.getByRole('header', { name: 'The table right now' })).toBeOnTheScreen();
    for (const line of ['Phase: 3 Play · your decision', 'Your hand: 10♠ J♦, 20 (deciding)', 'Dealer: 10♠ showing, one card face down', 'Balance: 975', 'On the table: 25 (one hand)']) {
      expect(panel.getByText(line)).toBeOnTheScreen();
    }
    expect(panel.getByRole('button', { name: 'Take it back & stand' })).toBeOnTheScreen();
  });

  it('basic with deviations supplies the count from exposed cards before the deal and at each decision', async () => {
    await startGuided('Basic with deviations');
    const before = within(screen.getByTestId('count-panel'));
    expect(before.getByText('True count 0')).toBeOnTheScreen();
    expect(before.getByText('Running 0 · 6 decks left · 0 ÷ 6 = 0')).toBeOnTheScreen();
    // Between rounds it names the deviation at this count and the next index up.
    expect(before.getByText(/^Deviation at this count: /)).toBeOnTheScreen();
    expect(before.getByText(/^Next: /)).toBeOnTheScreen();

    await betAndDeal();
    // Exposed: 10♠, 10♠ and J♦ (−3); the face-down 6♠ (+1) is not counted.
    const during = within(screen.getByTestId('count-panel'));
    expect(during.getByText('Running −3 · 6 decks left · −3 ÷ 6 = 0')).toBeOnTheScreen();
    // During a decision no deviation is named: that would be the answer.
    expect(during.queryByText(/^Deviation at this count/)).toBeNull();
    expect(screen.getByTestId('count-panel')).toHaveProp('accessibilityLabel', 'Count supplied in this mode: true count 0. Running count −3, 6 decks left.');
  });

  it('a correction decided by an index states how the taught index differs from the published ones, and why', async () => {
    // 16 (10, 2, 4) against a 10 at a true count of +1: Tableside stands; Schlesinger publishes +0.
    const card = (rank: number): Card => ({ deck: 0, suit: 'clubs', rank: rank as Card['rank'] });
    const definition = blackjackStrategy('S17_LS', 'basic-with-deviations');
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
        copy={playCorrectionCopy(definition.name, correction, { dealer: 'S17', lateSurrender: true })}
        table={{ phase: 'Play', balance: '975', wagers: '25' }}
        fullScreen={false}
        busy={false}
        onRetry={() => undefined}
        onOverride={() => undefined}
      />,
    );
    expect(screen.getByText('Basic with deviations stands on 16 against a 10 at this count.')).toBeOnTheScreen();
    expect(screen.getByText(/^The true count is \+1, supplied by Tableside in this mode/)).toBeOnTheScreen();
    expect(screen.getByText('16 vs 10: at +1 or more, stand; below +1, hit.')).toBeOnTheScreen();
    const why = within(screen.getByTestId('index-difference'));
    expect(why.getByRole('header', { name: "Why Tableside's index can differ from published charts" })).toBeOnTheScreen();
    expect(why.getByText('Illustrious 18 / Fab 4 (Schlesinger) prints +0 for 16 vs 10; Tableside teaches +1, 1 count higher.')).toBeOnTheScreen();
    expect(why.getByText(/^Tableside's indices are certified for this game: six decks, dealer stands on soft 17/)).toBeOnTheScreen();
  });
});

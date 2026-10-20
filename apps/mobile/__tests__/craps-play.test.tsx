// Seam 3: the craps free-play screens, rendered through the real routes on
// the in-memory adapters and driven only through the accessibility tree.
// Rolls come from the Random123 "pi digits" stream (engine craps cases, checked
// against the Python reference): 5+3, 5+6, 4+2, 3+1, 6+6, 2+6, 1+5, 2+5,
// that is 8 (point), 11, 6, 4, 12, 8 (point made), 6, 7.

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, Dimensions, StyleSheet } from 'react-native';

jest.mock('@/practice/app-adapters', () => {
  const { FakeClock, substituteAdapters } = jest.requireActual('@/practice/testing/substitutes');
  return { createAppAdapters: () => substituteAdapters({ clock: new FakeClock(undefined, true) }) };
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

async function openCrapsSetup() {
  await renderRouter('./src/app', { initialUrl: '/play?game=craps' });
  await screen.findByRole('header', { name: 'Craps' });
}

async function startSession() {
  await openCrapsSetup();
  await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
  await screen.findByLabelText('Session balance 1,000');
}

const spot = (name: RegExp) => screen.getByRole('button', { name });
const announced = (text: string) => expect(announcements.some((message) => message.includes(text))).toBe(true);

async function roll() {
  const sequence = announcements.length;
  await fireEvent.press(screen.getByRole('button', { name: 'Roll' }));
  await waitFor(() => expect(announcements.slice(sequence).some((message) => /Rolled/.test(message))).toBe(true));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Roll' })).toBeEnabled());
}

/** Pass line 25 and the come-out roll of 8: the point is 8. */
async function pointOfEight() {
  await startSession();
  await fireEvent.press(spot(/^Pass line, pays 1 to 1$/));
  await roll();
}

async function setWindow(width: number, height: number, fontScale = 1) {
  const window = Dimensions.get('window');
  await act(() => Dimensions.set({ window: { ...window, width, height, fontScale }, screen: { ...window, width, height, fontScale } }));
}

describe('craps free play', () => {
  beforeAll(async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await cleanup();
  }, 180_000);

  it('opens setup from Home with 3-4-5x odds, the line limits and the house edge of these rules', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Craps\b/ }));
    await screen.findByRole('header', { name: 'Craps' });

    expect(screen.getByLabelText('Starting chips for this session, in units')).toHaveProp('value', '1,000');
    expect(screen.getByRole('radio', { name: '3-4-5x odds' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /odds$/ }).map((radio) => radio.props.accessibilityLabel)).toEqual([
      '1x odds', '2x odds', '3-4-5x odds', '5x odds', '10x odds',
    ]);
    expect(screen.getByText('Pass, come, place, buy, lay and field 10–1,000 units')).toBeOnTheScreen();
    expect(screen.getByText('Hardways and propositions 1–100 units')).toBeOnTheScreen();
    expect(screen.getByText(/Pass and come 1\.41% · Don't pass and don't come 1\.36% · Odds 0%/)).toBeOnTheScreen();
    expect(screen.getByText(/With full 3-4-5x odds: pass 0\.37%, don't pass 0\.27%/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: '10x odds' }));
    expect(screen.getByRole('radio', { name: '10x odds' })).toBeChecked();
    expect(screen.getByText(/With full 10x odds: pass 0\.18%, don't pass 0\.12%/)).toBeOnTheScreen();
  });

  it('offers the field payout as a rule, with the house edge of every wager under the selected rules', async () => {
    await openCrapsSetup();

    expect(screen.getAllByRole('radio', { name: /double/ }).map((radio) => radio.props.accessibilityLabel)).toEqual(['2 double, 12 triple', '2 and 12 double']);
    expect(screen.getByRole('radio', { name: '2 double, 12 triple' })).toBeChecked();
    expect(screen.getByText('Place 6 and 8 1.52% · 5 and 9 4.00% · 4 and 10 6.67%')).toBeOnTheScreen();
    expect(screen.getByText('Buy and lay 6 and 8 2.27% · 5 and 9 2.00% · 4 and 10 1.67%')).toBeOnTheScreen();
    expect(screen.getByText('Field 2.78% · Hard 6 and 8 9.09% · Hard 4 and 10 11.11%')).toBeOnTheScreen();
    expect(screen.getByText(/Two and twelve 13\.89% · Three and eleven 11\.11% · Any craps 11\.11% · Any seven 16\.67% · Horn 12\.50%/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: '2 and 12 double' }));
    expect(screen.getByRole('radio', { name: '2 and 12 double' })).toBeChecked();
    expect(screen.getByText(/^Field 5\.56%/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start free play' }));
    expect(await screen.findByText(/field 12 pays 2:1/)).toBeOnTheScreen();
  });

  it('starts on a come-out roll with the puck off, and offers only the pass line bets', async () => {
    await startSession();

    expect(screen.getByLabelText('Status Come-out roll')).toBeOnTheScreen();
    expect(screen.getByLabelText('Puck OFF · no point yet')).toBeOnTheScreen();
    expect(within(screen.getByTestId('phase-stepper')).getByLabelText('Step 1 of 3, Come-out, current')).toBeOnTheScreen();
    expect(spot(/^Pass line,/)).toBeEnabled();
    expect(spot(/^Don't pass,/)).toBeEnabled();
    expect(spot(/^Come,/)).toBeDisabled();
    expect(spot(/^Come,/)).toHaveProp('accessibilityHint', 'Come bets open once a point is set.');
    expect(screen.queryByRole('button', { name: /^Pass line odds/ })).toBeNull();
  });

  it('announces a new wager with its working status and the balance', async () => {
    await startSession();

    await fireEvent.press(spot(/^Pass line,/));

    expect(announcements).toContain('Pass line 25 on the table, ON. Balance 975.');
    expect(spot(/^Pass line,/)).toHaveAccessibilityValue({ text: '25 on it, ON' });
    expect(screen.getByLabelText('Pass line 25, ON, removable')).toBeOnTheScreen();
  });

  it('reveals nothing before the roll, then announces the dice, the point and the puck', async () => {
    await startSession();
    await fireEvent.press(spot(/^Pass line,/));
    expect(screen.queryByText(/Rolled/)).toBeNull();
    expect(announcements.join(' ')).not.toMatch(/Rolled|point is/);

    await roll();

    announced('Rolled 5 and 3: 8.');
    // Settling the roll moves the puck, with no tap.
    announced('The point is 8. Puck ON.');
    expect(screen.getByLabelText('Puck ON · point 8. Last roll: 5 and 3, total 8')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Box 8, puck ON, the point/)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByLabelText('Status Settled')).toBeOnTheScreen());
  });

  it('explains why a committed pass line cannot be removed, and lets odds go behind it', async () => {
    await pointOfEight();

    const row = within(screen.getByTestId('wager-pass'));
    expect(screen.getByLabelText('Pass line 25, ON, committed')).toBeOnTheScreen();
    expect(row.getByRole('button', { name: 'Remove Pass line' })).toBeDisabled();
    expect(row.getByRole('button', { name: 'Remove Pass line' })).toHaveProp('accessibilityHint', "Remove isn't available: committed bet.");
    expect(row.getByText(/stays on the table until it wins on 8 or loses on 7\. You can't lower it or take it down/)).toBeOnTheScreen();
    expect(spot(/^Pass line,/)).toBeDisabled();

    await fireEvent.press(row.getByRole('button', { name: 'Add 25 odds behind Pass line' }));

    expect(announcements).toContain('Pass line odds 25 on the table, ON. Balance 950.');
    const odds = within(screen.getByTestId('wager-pass-odds'));
    expect(odds.getByRole('button', { name: 'Remove Pass line odds' })).toBeEnabled();
  });

  it('offers the same wagers in the bet list, with odds in increments that pay whole units', async () => {
    await pointOfEight();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));

    expect(screen.getByRole('header', { name: 'Line bets · 10 to 1,000 · odds 3-4-5x' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Odds\b/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Pass line odds' }));
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '52');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
    expect(announcements).toContain('Pass line odds goes in multiples of 5, so it pays whole units. Nothing was placed.');
    expect(screen.getByLabelText('On table 25')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '125');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));

    expect(announcements).toContain('Pass line odds 125 on the table, ON. Balance 850.');
    // The contract is committed in the bet list too, by name, and says why.
    const yours = within(screen.getByTestId('your-wagers'));
    expect(yours.getByLabelText('Pass line, 25, committed, Working')).toBeOnTheScreen();
    await fireEvent.press(yours.getByRole('button', { name: "Why can't I change Pass line?" }));
    expect(yours.getByText(/^ON\. Pass line is a contract now: it stays on the table until it wins on 8 or loses on 7/)).toBeOnTheScreen();
  });

  it('explains odds that would not pay whole units and leaves the table unchanged', async () => {
    await pointOfEight();
    await fireEvent.press(screen.getByRole('radio', { name: '1 chip' }));

    await fireEvent.press(within(screen.getByTestId('wager-pass')).getByRole('button', { name: 'Add 1 odds behind Pass line' }));

    expect(announcements).toContain('Pass line odds goes in multiples of 5, so it pays whole units. Nothing was placed.');
    expect(screen.getByLabelText('On table 25')).toBeOnTheScreen();
  });

  it('moves a come bet to its number and turns its odds off for the come-out roll', async () => {
    await pointOfEight();
    await roll(); // 11
    await fireEvent.press(spot(/^Come,/));
    await roll(); // 6: the come bet travels
    announced('Come 25 moves to Come 6.');
    await fireEvent.press(within(screen.getByTestId('wager-come-6')).getByRole('button', { name: 'Add 25 odds behind Come 6' }));
    await roll(); // 4
    await roll(); // 12
    await roll(); // 8: the point is made

    announced('Pass line 25 wins 25.');
    announced('Puck OFF. The next roll is a come-out roll.');
    announced('Come odds are OFF for the come-out roll.');
    expect(screen.getByLabelText('Come 6 odds 25, OFF, removable')).toBeOnTheScreen();
    expect(screen.getByLabelText('Come 6 25, ON, committed')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Box 6, Come 6 25 ON, Come 6 odds 25 OFF$/)).toBeOnTheScreen();
  });

  it('announces come odds working again once the next point is set', async () => {
    await pointOfEight();
    await roll(); // 11
    await fireEvent.press(spot(/^Come,/));
    await roll(); // 6: to come 6
    await fireEvent.press(spot(/^Come,/));
    await roll(); // 4: to come 4
    await fireEvent.press(within(screen.getByTestId('wager-come-4')).getByRole('button', { name: 'Add 25 odds behind Come 4' }));
    await roll(); // 12
    await roll(); // 8: the point is made and come odds go off
    expect(screen.getByLabelText('Come 4 odds 25, OFF, removable')).toBeOnTheScreen();
    announcements = [];

    await roll(); // 6 on the come-out: come 6 wins and the puck goes on at 6

    announced('The point is 6. Puck ON. Come odds are ON again.');
    expect(screen.getByLabelText('Come 4 odds 25, ON, removable')).toBeOnTheScreen();
  });

  it("explains that an established don't pass can come down but can't change, without calling it a contract", async () => {
    await startSession();
    await fireEvent.press(spot(/^Don't pass,/));
    await roll(); // 8: the point

    expect(spot(/^Don't pass,/)).toBeDisabled();
    expect(spot(/^Don't pass,/)).toHaveProp('accessibilityHint', "Don't pass can't be raised now. You can remove it from your wagers.");
    expect(screen.getByLabelText("Don't pass 25, ON, removable")).toBeOnTheScreen();
    expect(within(screen.getByTestId('wager-dont-pass')).getByRole('button', { name: "Remove Don't pass" })).toBeEnabled();
  });

  it('ends the session by returning removable wagers and rolling on for the contracts with no tap', async () => {
    await pointOfEight();
    await fireEvent.press(within(screen.getByTestId('wager-pass')).getByRole('button', { name: 'Add 25 odds behind Pass line' }));

    await fireEvent.press(screen.getByRole('button', { name: 'End session' }));
    expect(await screen.findByLabelText('1. Removable wagers come back. Pass line odds 25')).toBeOnTheScreen();
    expect(screen.getByLabelText('2. Committed wagers settle automatically. Pass line 25')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'End session' }).at(-1)!);

    expect(await screen.findByRole('header', { name: 'Session result' })).toBeOnTheScreen();
    announced('Pass line odds 25 returned to your balance.');
    // 11, 6, 4 and 12 leave the pass line; 8 pays it.
    announced('Pass line 25 wins 25.');
    expect(announcements).toContain('Session result. Win, net result plus 25. Final cash-out 1,025. Max drawdown 0.');
    expect(screen.getByText('Craps · free play · standard craps · 3-4-5x odds')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net result plus 25, Win')).toBeOnTheScreen();
  });

  it('gives every table control a touch target of at least 48 points', async () => {
    await pointOfEight();
    // The stake editor's working switch; the field spot and the way to numbers and center bets are always there.
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Place,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Place 8' }));
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '12');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
    expect(screen.getByRole('switch', { name: 'Working on the come-out' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByRole('button', { name: 'Numbers and center bets' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));

    const table = within(screen.getByTestId('table-scroll'));
    const controls = [...table.getAllByRole('button'), ...table.getAllByRole('radio'), ...table.getAllByRole('switch')];
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) {
      const style = StyleSheet.flatten(typeof control.props.style === 'function' ? control.props.style({ pressed: false }) : control.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      if (style.alignSelf !== 'stretch' && style.flex === undefined) expect(style.minWidth ?? 48).toBeGreaterThanOrEqual(48);
    }
  });

  it('puts the felt beside the controls in a wide window and stacks them at large text sizes', async () => {
    await startSession();
    const { width, height, fontScale } = Dimensions.get('window');
    try {
      await setWindow(844, 390, 1);
      expect(StyleSheet.flatten(screen.getByTestId('table-columns').props.style).flexDirection).toBe('row');

      await setWindow(844, 390, 3.1);
      expect(StyleSheet.flatten(screen.getByTestId('table-columns').props.style).flexDirection).toBeUndefined();
      expect(screen.getByTestId('table-scroll')).toBeOnTheScreen();
    } finally {
      await setWindow(width, height, fontScale);
    }
  });

  it('covers every craps wager in the bet list, each with its payout and house edge', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));

    expect(screen.getByRole('header', { name: 'Numbers and field · 10 to 1,000' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Hardways and propositions · 1 to 100 per part' })).toBeOnTheScreen();
    for (const kind of [/^Pass line and don’t pass,/, /^Place, Pays 9:5, 7:5, 7:6/, /^Buy, True odds · 5% commission of the stake/, /^Lay, Wins on 7/, /^Field, One roll · 2 pays 2:1, 12 pays 3:1/, /^Hardways, Hard 4·10 pays 7:1, 6·8 pays 9:1/, /^Propositions, One roll/]) {
      expect(screen.getByRole('button', { name: kind })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: /^Place,/ })).toHaveProp('accessibilityLabel', expect.stringMatching(/edge 6·8 1\.52% · 5·9 4\.00% · 4·10 6\.67%$/));

    await fireEvent.press(screen.getByRole('button', { name: /^Propositions,/ }));
    expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(
      expect.arrayContaining(['Any seven', 'Any craps', 'Two (aces)', 'Three (ace-deuce)', 'Eleven (yo)', 'Twelve (boxcars)', 'Horn']),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'All wagers' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Hardways,/ }));
    expect(screen.getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(expect.arrayContaining(['Hard 4', 'Hard 6', 'Hard 8', 'Hard 10']));
  });

  it('sets a place bet off on the come-out, and turns it on from the stake editor', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Place,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Place 6' }));
    const working = screen.getByRole('switch', { name: 'Working on the come-out' });
    expect(working).not.toBeChecked();
    expect(working).toHaveProp('accessibilityHint', 'Off by default. Place bets act only while a point is on.');
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '25');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
    expect(announcements).toContain('Place 6 goes in multiples of 6. Nothing was placed.');

    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '24');
    await fireEvent.press(screen.getByRole('button', { name: 'Set Place 6 to 24' }));

    expect(announcements).toContain('Place 6 24 on the table, OFF. Balance 976.');
    expect(screen.getByLabelText('Place 6 24, OFF, removable')).toBeOnTheScreen();
    // The working option is part of the draft: nothing changes until it is set.
    await fireEvent.press(screen.getByRole('switch', { name: 'Working on the come-out' }));
    expect(screen.getByRole('switch', { name: 'Working on the come-out' })).toBeChecked();
    expect(screen.getByLabelText('Place 6 24, OFF, removable')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Set Place 6 to 24' }));

    await waitFor(() => expect(announcements).toContain('Place 6 24 now works on the come-out roll too.'));
    expect(screen.getByLabelText('Place 6 24, ON, removable')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Working on the come-out' })).toBeChecked();
    // Your wagers show working status but offer no switch of their own.
    expect(within(screen.getByTestId('wager-place-6')).queryByRole('button', { name: /^Turn / })).toBeNull();
  });

  it('places a new lay already told to be off, in one Set', async () => {
    await startSession();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Lay,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Lay 4' }));
    expect(screen.getByRole('switch', { name: 'Working' })).toBeChecked();
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '20');
    await fireEvent.press(screen.getByRole('switch', { name: 'Working' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set Lay 4 to 20' }));

    await waitFor(() => expect(announcements).toContain('Lay 4 20 is now OFF until you turn it on.'));
    expect(announcements).toContain('Lay 4 20 on the table, ON. Balance 980.');
    expect(screen.getByLabelText('Lay 4 20, OFF, removable')).toBeOnTheScreen();
    expect(within(screen.getByTestId('your-wagers')).getByLabelText('Lay 4, 20, removable, Off')).toBeOnTheScreen();
  });

  it('announces place bets going off for the come-out roll when the point is made', async () => {
    await pointOfEight();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Place,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Place 6' }));
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '12');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
    expect(screen.getByLabelText('Place 6 12, ON, removable')).toBeOnTheScreen();

    await roll(); // 11
    await roll(); // 6: place 6 wins 14 and stays up
    announced('Place 6 12 wins 14. It stays up.');
    await roll(); // 4
    await roll(); // 12
    await roll(); // 8: the point is made

    announced('Place and buy bets are OFF for the come-out roll.');
    expect(screen.getByLabelText('Place 6 12, OFF, removable')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByLabelText(/^Box 6, Place 6 12 OFF$/)).toBeOnTheScreen();
  });

  it('settles the field from the felt and the horn as four parts, announcing each', async () => {
    await startSession();
    await fireEvent.press(spot(/^Pass line,/));
    await fireEvent.press(spot(/^Field, pays 1 to 1, 2 pays double, 12 pays triple$/));
    expect(announcements).toContain('Field 25 on the table, ON. Balance 950.');
    await roll(); // 8: the field loses
    announced('Field 25 loses.');

    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Propositions,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Horn' }));
    expect(screen.getByText(/^Multiples of 4 · 4 to 400 · pays 30:1 on 2 or 12, 15:1 on 3 or 11, per part\./)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '4');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
    announcements = [];

    await roll(); // 11: the horn's 11 part pays 15:1, the other parts lose

    announced('Horn 2 part 1 loses. Horn 3 part 1 loses. Horn 11 part 1 wins 15. Horn 12 part 1 loses.');
  });

  it('announces a winning buy with the commission charged on the win', async () => {
    await pointOfEight();
    await fireEvent.press(screen.getByRole('tab', { name: 'Bet list' }));
    await fireEvent.press(screen.getByRole('button', { name: /^Buy,/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Buy 6' }));
    await fireEvent.changeText(screen.getByLabelText(/^Total stake for /), '10');
    await fireEvent.press(screen.getByRole('button', { name: /^Set / }));
    expect(announcements).toContain('Buy 6 10 on the table, ON. Balance 965.');

    await roll(); // 11
    await roll(); // 6: 12 at 6:5, less 5% of 10 rounded up to 1

    announced('Buy 6 10 wins 11, after commission 1. It stays up.');
    expect(screen.getByLabelText('Session balance 976')).toBeOnTheScreen();
  });
});

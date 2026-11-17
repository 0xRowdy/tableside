// Spec 3 Lessons › Inventory (Roulette), Content requirements; Amendment 1 C11; docs/research/roulette-lessons.md; #155
import type { RoulettePocket, Wager } from '@tableside/engine';

import type { Lesson, LessonHandoff, LessonSource, LessonStep } from '../lessons';
import { BOUNDED_LABOUCHERE, CAPPED_MARTINGALE, FIXED_TWO_DOZENS, FLAT_EVEN_MONEY, THREE_WIN_PARLAY } from '../roulette-strategies';
import type { StrategyStepExample, StrategyStepExplanation } from '../strategy-examples';
import type { ScriptedChoice } from '../worked-examples';

const FREE_PLAY: LessonHandoff = { kind: 'free-play', game: 'roulette' };
const guided = (strategy: string | null): LessonHandoff => ({ kind: 'guided-practice', game: 'roulette', strategy });

const practiceIt = (strategy: string) =>
  `Practice it: open guided practice with ${strategy} filled in, or free play. The setup screen shows whether starting uses your allowance. Nothing starts until you press Start.`;

const SOURCES = {
  njPayouts: { citation: 'New Jersey Division of Gaming Enforcement, N.J.A.C. 13:69F-5.2 “Roulette: payout odds”, (a)–(c), PDF pages 231–232', url: 'https://www.nj.gov/lps/ge/docs/Regulations/CHAPTER69F.pdf#page=231' },
  basics: { citation: 'Wizard of Odds, “Roulette basics”, sections “American Rules” and “European Rules”', url: 'https://wizardofodds.com/games/roulette/basics/' },
  basicsSystems: { citation: 'Wizard of Odds, “Roulette basics”, section “Betting Systems”', url: 'https://wizardofodds.com/games/roulette/basics/' },
  cqPayouts: { citation: 'Casino Quest, “Roulette Payouts!”, at 0:06–0:30 (inside-bet payouts)', url: 'https://www.youtube.com/watch?v=6A-KsmmgiAg&t=6s' },
  systems: { citation: 'Wizard of Odds, “Betting Systems”, section “Introduction”', url: 'https://wizardofodds.com/gambling/betting-systems/' },
  martingale: { citation: 'Wizard of Odds, “Martingale”, sections “Rules” and “Summary”', url: 'https://wizardofodds.com/gambling/martingale/' },
  cqMartingale: { citation: 'Casino Quest, “WEIRDEST MARTINGALE SYSTEM - Will It Make You Money?”, at 0:50–1:00 (a win goes back to the first unit)', url: 'https://www.youtube.com/watch?v=cNwTcAR6xHM&t=50s' },
  antiMartingale: { citation: 'Wizard of Odds, “Anti-Martingale”, section “Rules”', url: 'https://wizardofodds.com/gambling/anti-martingale/' },
  labouchere: { citation: 'Wizard of Odds, “Labouchere”, sections “Introduction” and “Rules”', url: 'https://wizardofodds.com/gambling/labouchere/' },
} as const satisfies Record<string, LessonSource>;

const content = (steps: readonly LessonStep[], workedExample: StrategyStepExample | null, handoffs: readonly LessonHandoff[], sources: readonly LessonSource[]) => ({
  version: 1,
  materialVersion: 1,
  change: null,
  steps,
  workedExample,
  handoffs,
  sources,
});

const bets = (...placed: readonly [string, string][]): Wager[] => placed.map(([target, amount]) => ({ target, amount }));
const turn = (wagers: Wager[], pocket: RoulettePocket) => ({ wagers, outcome: { pocket } });
const choice = (answer: Wager[], correct: boolean, explanation: StrategyStepExplanation, note: string | null): ScriptedChoice<StrategyStepExample['choices'][number]['answer'], StrategyStepExplanation> => ({
  answer: { kind: 'bets', bets: answer },
  response: { correct, explanation, note },
});
const example = (step: number, strategy: string, parameters: Record<string, string>, turns: StrategyStepExample['turns'], choices: StrategyStepExample['choices']): StrategyStepExample => ({
  kind: 'strategy-step',
  step,
  game: 'roulette',
  strategy,
  parameters,
  table: 'single-zero',
  practiceFunding: '1000',
  turns,
  choices,
});

const HOUSE_EDGE_HEADING = "Stakes change. The house edge doesn't.";
const houseEdge = (shape: string) =>
  `Every bet on the single-zero wheel keeps its 2.70% house edge, and 5.26% on double zero, whatever you stake. ${shape} Changing stakes doesn't remove the house advantage.`;

export const ROULETTE_BASICS: Lesson = {
  id: 'roulette-basics',
  title: 'Roulette basics',
  summary: 'Wheels, bets, spins, settlement and funding',
  section: 'roulette',
  game: 'roulette',
  content: content(
    [
      {
        heading: 'The wheel and the table',
        paragraphs: [
          'At setup you choose a wheel. Single zero (0) has 37 pockets: 0 and 1 to 36. Double zero (0, 00) has 38: 0, 00 and 1 to 36. The zeros are green; the other numbers are red or black.',
          'Table limits apply to each placement. By default inside bets take 1 to 100 and outside bets 10 to 1,000, and you can change them at setup.',
        ],
      },
      {
        heading: 'Placing bets',
        paragraphs: [
          'The table has two views of the same bets. In Table, pick a chip (1, 5, 25, 100, 500 or 1K) and tap a spot on the layout to add it.',
          'Bet list is the bet selector: every kind of bet with what it pays. Splits, streets, corners, six lines and the other inside bets are under “Find by number”. You enter the total for a wager, not an amount to add, and nothing is placed until you confirm with “Set … to …”.',
          "A bet outside the limits, or more than your balance can cover, is refused and nothing changes.",
        ],
      },
      {
        heading: 'What each bet pays',
        paragraphs: [
          'Inside bets: straight up (1 number) pays 35:1, split 17:1, street and trio 11:1, corner and first four (single zero only) 8:1, six line 5:1, and the five-number basket (0, 00, 1, 2, 3, double zero only) 6:1.',
          'Outside bets: a dozen or a column pays 2:1, and red or black, odd or even, and 1 to 18 or 19 to 36 pay 1:1.',
          "Outside bets lose in full when the ball lands on 0, or 00 on the double-zero wheel. Some casinos return half an even-money bet on zero; Tableside doesn't.",
        ],
      },
      {
        heading: 'A spin, step by step',
        paragraphs: [
          'Betting: place, change or remove wagers, or rebuy. Spin: your wagers are committed to this spin and can’t be changed until they settle. Settle: the ball’s pocket is shown and every wager settles on its own, with nothing to tap.',
          'A winning wager returns its stake plus the payout, so 10 straight up on 17 returns 360 when 17 lands. A losing wager returns nothing. Then the next betting phase begins.',
        ],
      },
      {
        heading: 'Funding your session',
        paragraphs: [
          'Each session starts fresh with the buy-in you choose at setup, 1,000 unless you change it. Rebuy adds chips during the session; it counts as funding, not as a win.',
          'End session returns wagers that are still removable and settles committed ones. The result shows your buy-in, rebuys, total funding, final cash-out, net result and max drawdown.',
        ],
      },
      {
        heading: 'The house edge, and practising',
        paragraphs: [
          'The single-zero wheel has a 2.70% house edge on every bet. Double zero has 5.26%, except the five-number basket at 7.89%. These are properties of the rules, not predictions of your results, and no choice or pattern of bets changes them.',
          'Free play lets you bet as you like. Guided practice follows one of five built-in strategies: you place each bet yourself, and before a spin that departs from the strategy, it pauses so you can take the bet back or keep it.',
          'Practice it: open free play or guided practice. The setup screen shows whether starting uses your allowance. Nothing starts until you press Start.',
        ],
      },
    ],
    null,
    [FREE_PLAY, guided(null)],
    [SOURCES.basics, SOURCES.njPayouts, SOURCES.cqPayouts],
  ),
};

const FLAT_AFTER_ZERO: StrategyStepExplanation = {
  situation: { available: '990', subjects: { 'last-pocket-color': 'green', 'last-result': 'loss' }, values: {} },
  instructions: [{ id: 'flat', label: '10 on your even-money target, every spin' }],
  prescription: { bets: [{ amount: '10', target: 'red' }], held: [], status: 'prescribed' },
  fallback: null,
  state: { counters: {}, cycleTurn: 1, lastResult: 'loss', lists: {} },
};

export const FLAT_EVEN_MONEY_LESSON: Lesson = {
  id: 'flat-even-money',
  title: 'Flat even-money',
  summary: 'The same 10 on one even-money bet, every spin',
  section: 'roulette',
  game: 'roulette',
  content: content(
    [
      {
        heading: 'One bet, the same every spin',
        paragraphs: [
          'At setup choose a target: Red, Black, Odd, Even, 1 to 18 or 19 to 36. Red is the default. Every spin, Flat even-money bets 10 on that target.',
          'There is nothing to keep track of: no counters, no list and no cycle.',
        ],
      },
      {
        heading: 'Each spin',
        paragraphs: [
          'In guided practice you place the bet yourself. At Spin, Tableside checks it against the strategy. If your bets differ, a strategy check pauses before the spin and offers to take them back and bet 10 on your target, or to keep your bets.',
          'A win pays 1:1, so the spin nets +10. A loss, including 0 or 00, costs the 10. Either way the next spin is 10 on the same target again.',
        ],
      },
      {
        heading: 'Limits and stopping',
        paragraphs: [
          "10 is the outside minimum at the default table, so guided-practice setup won't accept a table whose outside minimum is above 10. If your balance can't cover 10, play pauses with “Blocked: not enough chips” until you rebuy or stop. Tableside never places part of a bet.",
          'There is no stop rule. You play until you stop the strategy or end the session; ending returns a bet that is still removable and settles a committed one.',
        ],
      },
      {
        heading: 'A baseline for the other strategies',
        paragraphs: [
          'Every spin costs the same share of its stake on average: 2.70% on single zero, 5.26% on double zero. That steady baseline is what the progressions are compared against.',
          practiceIt('Flat even-money'),
          "Tableside's own policy: the 10 stake and the Red default are Tableside's choices, built from the standard even-money bet.",
        ],
      },
    ],
    example(2, FLAT_EVEN_MONEY.id, { target: 'red' }, [turn(bets(['red', '10']), 0)], [
      choice(bets(['red', '10']), true, FLAT_AFTER_ZERO, null),
      choice(bets(['red', '20']), false, FLAT_AFTER_ZERO, 'A loss changes nothing in flat betting, even on 0.'),
      choice(bets(['black', '10']), false, FLAT_AFTER_ZERO, 'The target is chosen at setup and stays the same whatever the last spin showed.'),
    ]),
    [guided(FLAT_EVEN_MONEY.id), FREE_PLAY],
    [SOURCES.basics, SOURCES.njPayouts],
  ),
};

const DOZENS_AFTER_THIRD: StrategyStepExplanation = {
  situation: { available: '980', subjects: { 'last-pocket-color': 'red', 'last-result': 'loss' }, values: {} },
  instructions: [{ id: 'cover', label: '10 on each of your two dozens, every spin' }],
  prescription: { bets: [{ amount: '10', target: 'dozen-1' }, { amount: '10', target: 'dozen-2' }], held: [], status: 'prescribed' },
  fallback: null,
  state: { counters: {}, cycleTurn: 1, lastResult: 'loss', lists: {} },
};

export const FIXED_TWO_DOZENS_LESSON: Lesson = {
  id: 'fixed-two-dozen-coverage',
  title: 'Fixed two-dozen coverage',
  summary: '10 on each of two dozens, every spin',
  section: 'roulette',
  game: 'roulette',
  content: content(
    [
      {
        heading: 'Two bets at once',
        paragraphs: [
          'At setup choose a first and a second dozen: 1st (1 to 12), 2nd (13 to 24) or 3rd (25 to 36). They must be different; the defaults are the 1st and 2nd. Every spin, the strategy bets 10 on each, 20 in total.',
        ],
      },
      {
        heading: 'How a spin settles',
        paragraphs: [
          'The two bets settle separately and the spin’s result is their sum. When a covered dozen comes up it pays 2:1, +20, while the other bet loses 10: the spin nets +10.',
          'When the third dozen, 0 or 00 comes up, both bets lose: −20. On single zero, 24 of the 37 pockets give +10 and 13 give −20. On double zero, 24 of 38 give +10 and 14 give −20.',
        ],
      },
      {
        heading: 'The next spin',
        paragraphs: [
          "Whatever happened, the next spin is 10 on each of the same two dozens. The dozens don't follow the last result: each spin is independent of the ones before it.",
          'In guided practice you place both bets yourself, and a strategy check pauses before any spin that departs from them.',
        ],
      },
      {
        heading: 'Limits and stopping',
        paragraphs: [
          'Each 10 is an outside bet, inside the default 10 to 1,000. The two opening bets need 20, so your buy-in must cover 20; if your balance falls below that, play pauses with “Blocked: not enough chips” until you rebuy or stop.',
          'There is no stop rule and no cycle: play continues until you stop the strategy or end the session.',
        ],
      },
      {
        heading: 'More winning spins, the same edge',
        paragraphs: [
          'Covering two dozens wins more spins than it loses, but each loss is twice the size of each win. The house edge is still 2.70% of everything you stake on single zero and 5.26% on double zero, the same as a single bet.',
          practiceIt('fixed two-dozen coverage'),
          "Tableside's own policy: two fixed dozens at 10 each is Tableside's practice strategy, built from the standard dozen bet.",
        ],
      },
    ],
    example(3, FIXED_TWO_DOZENS.id, { first: 'dozen-1', second: 'dozen-2' }, [turn(bets(['dozen-1', '10'], ['dozen-2', '10']), 30)], [
      choice(bets(['dozen-1', '10'], ['dozen-2', '10']), true, DOZENS_AFTER_THIRD, null),
      choice(bets(['dozen-2', '10'], ['dozen-3', '10']), false, DOZENS_AFTER_THIRD, "The dozens are chosen at setup. Moving to the one that just came up doesn't change what the next spin does."),
      choice(bets(['dozen-1', '20'], ['dozen-2', '20']), false, DOZENS_AFTER_THIRD, 'Fixed coverage keeps both stakes at 10 after a loss.'),
    ]),
    [guided(FIXED_TWO_DOZENS.id), FREE_PLAY],
    [SOURCES.basics, SOURCES.njPayouts],
  ),
};

const MARTINGALE_AFTER_TWO_LOSSES: StrategyStepExplanation = {
  situation: { available: '970', subjects: { 'last-pocket-color': 'green', 'last-result': 'loss' }, values: {} },
  instructions: [{ id: 'stake', label: 'The current stake on your even-money target' }],
  prescription: { bets: [{ amount: '40', target: 'red' }], held: [], status: 'prescribed' },
  fallback: null,
  state: { counters: { stake: '40' }, cycleTurn: 2, lastResult: 'loss', lists: {} },
};

export const CAPPED_MARTINGALE_LESSON: Lesson = {
  id: 'capped-martingale',
  title: 'Capped Martingale',
  summary: 'Double after each loss, with a cap of 320',
  section: 'roulette',
  game: 'roulette',
  content: content(
    [
      {
        heading: 'Double after a loss',
        paragraphs: [
          'Martingale bets on one even-money target and doubles the stake after every loss. A win completes the cycle. In Tableside the stakes run 10, 20, 40, 80, 160 and 320, and 320 is the cap.',
        ],
      },
      {
        heading: 'Starting a cycle',
        paragraphs: ['Choose a target at setup (Red by default). Each cycle starts with 10 on it. In guided practice you place each bet yourself, and a strategy check pauses before a spin that departs from the strategy.'],
      },
      {
        heading: 'After each spin',
        paragraphs: [
          'A loss, including 0 or 00, doubles the next stake. A win completes the cycle.',
          'Because each stake covers all the losses before it plus 10, a completed cycle always ends +10, whether the win comes on the first spin or the sixth.',
        ],
      },
      {
        heading: 'The cap and other limits',
        paragraphs: [
          'After a loss at 320 the next stake would be 640, past the cap. The cycle ends at the cap with no new bet, and that cycle has lost 630: 10 + 20 + 40 + 80 + 160 + 320.',
          "If the table's outside maximum is below the next stake, play pauses with “Blocked: outside the table limits”. If your balance can't cover it, play pauses with “Blocked: not enough chips”; a rebuy lets the held stake go ahead. Tableside never makes a stake smaller.",
        ],
      },
      {
        heading: 'Ending a cycle',
        paragraphs: [
          "When a cycle completes or reaches the cap, Tableside shows the cycle's result and waits. “Start another cycle” begins again at 10 with the balance you have now, or you can end the session. Nothing restarts on its own.",
        ],
      },
      {
        heading: HOUSE_EDGE_HEADING,
        paragraphs: [
          houseEdge('Martingale changes how wins and losses arrive: each cycle either completes at +10 or reaches the cap down 630.'),
          practiceIt('capped Martingale'),
          "Tableside's own variant: the 10 opening stake, the cap of 320, ending the cycle at the cap, and pausing rather than betting what's left are Tableside's rules, not the published system.",
        ],
      },
    ],
    example(3, CAPPED_MARTINGALE.id, { target: 'red' }, [turn(bets(['red', '10']), 2), turn(bets(['red', '20']), 0)], [
      choice(bets(['red', '10']), false, MARTINGALE_AFTER_TWO_LOSSES, 'Only a win completes the cycle and starts the next one at 10.'),
      choice(bets(['red', '20']), false, MARTINGALE_AFTER_TWO_LOSSES, '0 is a loss for red, so the 20 doubles.'),
      choice(bets(['red', '40']), true, MARTINGALE_AFTER_TWO_LOSSES, null),
    ]),
    [guided(CAPPED_MARTINGALE.id), FREE_PLAY],
    [SOURCES.martingale, SOURCES.cqMartingale, SOURCES.systems],
  ),
};

const PARLAY_AFTER_TWO_WINS: StrategyStepExplanation = {
  situation: { available: '1030', subjects: { 'last-pocket-color': 'red', 'last-result': 'win' }, values: {} },
  instructions: [{ id: 'stake', label: 'The current stake on your even-money target' }],
  prescription: { bets: [{ amount: '40', target: 'red' }], held: [], status: 'prescribed' },
  fallback: null,
  state: { counters: { stake: '40', wins: '2' }, cycleTurn: 2, lastResult: 'win', lists: {} },
};

export const THREE_WIN_PARLAY_LESSON: Lesson = {
  id: 'three-win-parlay',
  title: 'Three-win parlay',
  summary: 'Let a win ride, up to three wins',
  section: 'roulette',
  game: 'roulette',
  content: content(
    [
      {
        heading: 'Let a win ride',
        paragraphs: [
          'A parlay increases the stake after a win instead of after a loss. In Tableside the stakes run 10, 20 and 40 after consecutive wins on one even-money target. A loss, or the third win, completes the cycle.',
        ],
      },
      {
        heading: 'Starting a cycle',
        paragraphs: ['Choose a target at setup (Red by default). Each cycle starts with 10 on it and no wins counted. You place each bet yourself in guided practice.'],
      },
      {
        heading: 'After each spin',
        paragraphs: [
          'A win doubles the stake for the next spin and counts one more win. A loss, including 0 or 00, completes the cycle at once.',
          'Three wins in a row complete the cycle at +70 (10 + 20 + 40). A loss at any point leaves the cycle at −10, because the stake that loses includes the earlier winnings.',
        ],
      },
      {
        heading: 'Limits and the next cycle',
        paragraphs: [
          "The largest stake is 40, inside the default outside limits. If your balance can't cover the next stake, play pauses with “Blocked: not enough chips”.",
          'When a cycle completes, Tableside shows its result and waits. “Start another cycle” begins again at 10 with no wins counted. Nothing restarts on its own.',
        ],
      },
      {
        heading: HOUSE_EDGE_HEADING,
        paragraphs: [
          houseEdge('The parlay changes how wins and losses arrive: a cycle ends −10 if any of its spins loses, and +70 only after three wins in a row.'),
          practiceIt('three-win parlay'),
          "Tableside's own variant: the 10, 20, 40 stakes, ending the cycle at the third win, and starting the next cycle yourself are Tableside's rules. The published anti-Martingale it's related to doubles after wins until a winning goal.",
        ],
      },
    ],
    example(3, THREE_WIN_PARLAY.id, { target: 'red' }, [turn(bets(['red', '10']), 1), turn(bets(['red', '20']), 3)], [
      choice(bets(['red', '10']), false, PARLAY_AFTER_TWO_WINS, 'A win lets the stake ride; only a completed cycle goes back to 10.'),
      choice(bets(['red', '40']), true, PARLAY_AFTER_TWO_WINS, null),
      choice(bets(['red', '80']), false, PARLAY_AFTER_TWO_WINS, 'The stake doubles once per win: 20 won, so 40 rides next.'),
    ]),
    [guided(THREE_WIN_PARLAY.id), FREE_PLAY],
    [SOURCES.antiMartingale, SOURCES.systems],
  ),
};

const LABOUCHERE_AFTER_A_LOSS: StrategyStepExplanation = {
  situation: { available: '960', subjects: { 'last-pocket-color': 'black', 'last-result': 'loss' }, values: {} },
  instructions: [{ id: 'ends', label: 'The first and last numbers of your line, added, on your target' }],
  prescription: { bets: [{ amount: '50', target: 'red' }], held: [], status: 'prescribed' },
  fallback: null,
  state: { counters: {}, cycleTurn: 1, lastResult: 'loss', lists: { line: ['10', '20', '30', '40'] } },
};

export const BOUNDED_LABOUCHERE_LESSON: Lesson = {
  id: 'bounded-labouchere',
  title: 'Bounded Labouchere',
  summary: 'Bet from a line of numbers, with a cap of 320',
  section: 'roulette',
  game: 'roulette',
  content: content(
    [
      {
        heading: 'A line of numbers',
        paragraphs: [
          'Labouchere keeps a line of numbers and bets on one even-money target. In Tableside every cycle starts with the line 10, 20, 30, and Red is the default target.',
        ],
      },
      {
        heading: 'The next bet',
        paragraphs: [
          'Bet the first and last numbers of the line added together: 10 + 30 = 40 to start. When one number is left, bet that number. No stake may go above the cap of 320.',
          'You place each bet yourself in guided practice, and a strategy check pauses before a spin that departs from the strategy.',
        ],
      },
      {
        heading: 'After each spin',
        paragraphs: [
          'A win crosses off the first and last numbers. A loss, including 0 or 00, adds the amount just staked to the end of the line.',
          'When the line is empty, the cycle is complete. Every win removes as much from the line as it won and every loss adds what it lost, so an empty line means the cycle finished +60, the total of 10, 20 and 30.',
        ],
      },
      {
        heading: 'The cap and other limits',
        paragraphs: [
          'Each loss makes the line longer and the next bet larger. If the next bet would be above 320, the cycle ends at the cap with no new bet. From the opening line that takes 29 losses in a row, with stakes 40, 50, 60 and so on up to 320, and the cycle has lost 5,220.',
          "If your balance can't cover the next bet, play pauses with “Blocked: not enough chips”. Tableside never bets part of a stake.",
          'When a cycle completes or reaches the cap, Tableside shows its result and waits. “Start another cycle” resets the line to 10, 20, 30. Nothing restarts on its own.',
        ],
      },
      {
        heading: HOUSE_EDGE_HEADING,
        paragraphs: [
          houseEdge('Labouchere changes how wins and losses arrive: each cycle either completes at +60 or reaches the cap after a long losing run.'),
          practiceIt('bounded Labouchere'),
          "Tableside's own variant: the 10, 20, 30 line, the cap of 320, and pausing rather than betting what's left are Tableside's rules, not the published system.",
        ],
      },
    ],
    example(3, BOUNDED_LABOUCHERE.id, { target: 'red' }, [turn(bets(['red', '40']), 2)], [
      choice(bets(['red', '40']), false, LABOUCHERE_AFTER_A_LOSS, 'The lost 40 joined the end of the line: 10, 20, 30, 40.'),
      choice(bets(['red', '50']), true, LABOUCHERE_AFTER_A_LOSS, null),
      choice(bets(['red', '80']), false, LABOUCHERE_AFTER_A_LOSS, "Doubling is Martingale. Labouchere adds the line's first and last numbers: 10 + 40."),
    ]),
    [guided(BOUNDED_LABOUCHERE.id), FREE_PLAY],
    [SOURCES.labouchere, SOURCES.systems],
  ),
};

export const ROULETTE_LESSONS: readonly Lesson[] = [ROULETTE_BASICS, FLAT_EVEN_MONEY_LESSON, FIXED_TWO_DOZENS_LESSON, CAPPED_MARTINGALE_LESSON, THREE_WIN_PARLAY_LESSON, BOUNDED_LABOUCHERE_LESSON];

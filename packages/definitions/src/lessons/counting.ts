// Spec 3 Lessons and worked examples (#48), Amendment 1 B2, B3, C11, Amendment 2 §3; #153
// docs/research/counting-lessons.md
import type { ConversionExplanation, HiLoExplanation, RunningCountExplanation, TableRunningExplanation } from '@tableside/engine';

import { CARD_VALUES_CONTENT, CONVERSION_CONTENT, RUNNING_COUNT_CONTENT, TABLE_CONTENT } from '../challenges';
import type { ConversionExample, RunningCountExample, TableCountExample } from '../counting-examples';
import type { Lesson, LessonSource } from '../lessons';
import type { CardValueExample } from '../worked-examples';
import { indexRule, lesson, publishedGaps, publishedNote, step } from './blackjack';

// Spec 3 Amendment 1 C11; docs/research/counting-lessons.md Citable sources
const SOURCE = {
  hiLoValues: {
    citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, table “High-Low Point Values”',
    url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/',
  },
  bjaValues: { citation: 'Blackjack Apprenticeship, “How To Count Cards”, section “Step 1: Assign A Value To Every Card”', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  bjaRunning: { citation: 'Blackjack Apprenticeship, “How To Count Cards”, section “Step 2: The Running Count”', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  bjaTrue: {
    citation: 'Blackjack Apprenticeship, “How To Count Cards”, section “Step 3: Calculate A “True Count” Or Count Per Deck”',
    url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/',
  },
  schlesinger: {
    citation:
      'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, tables “Illustrious 18” and “Fab 4 Surrenders” (from Don Schlesinger, Blackjack Attack, 2004 ed., p. 62, republished with permission)',
    url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/',
  },
  certified: { citation: 'Tableside certified blackjack coaching reference, indices_S17_final.csv and indices_H17_final.csv (frozen 2026-09-14, manifest 9892826d)', url: null },
  wizardTrue: {
    citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, step 3',
    url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/',
  },
} as const satisfies Record<string, LessonSource>;


// Spec 3 Lessons and worked examples (conversion lesson); Amendment 1 B2
const THIRTEEN_V2 = publishedGaps('S17_LS').find((gap) => gap.deviation.situation === '13 vs 2');
if (!THIRTEEN_V2 || THIRTEEN_V2.deviation.threshold !== 0) throw new Error('the conversion lesson expects 13 vs 2 to have an index of 0');

const [FIRST_CHECKPOINT, SECOND_CHECKPOINT, THIRD_CHECKPOINT, LAST_CHECKPOINT] = RUNNING_COUNT_CONTENT.checkpoints;

const ACE: HiLoExplanation = { kind: 'hi-lo-value', rank: 1, value: -1 };
export const CARD_VALUES_EXAMPLE: CardValueExample = {
  kind: 'card-value',
  step: 2,
  card: { rank: 1, suit: 'spades' },
  choices: [
    { answer: 1, response: { correct: false, explanation: ACE, note: 'An ace counts with the tens and faces in Hi-Lo, even though it can be worth 1 in your hand.' } },
    { answer: 0, response: { correct: false, explanation: ACE, note: 'Only 7, 8 and 9 count 0.' } },
    { answer: -1, response: { correct: true, explanation: ACE, note: null } },
  ],
};

export const CARD_VALUES_LESSON = lesson('card-values', 'Card values', 'The Hi-Lo value of every card', {
  steps: [
    step('Every card has a count value', [
      'Tableside teaches one counting system, Hi-Lo. Each card that comes out of the shoe has a value: +1, 0 or −1. Adding those values as the cards appear is the running count, which the next lesson covers.',
    ]),
    step('The three groups', ['2, 3, 4, 5 and 6 count +1.', '7, 8 and 9 count 0.', '10, jack, queen, king and ace count −1.', 'Suits never matter: every 5 is +1, whatever its suit.'], { source: SOURCE.hiLoValues }),
    step('Aces and faces', [
      'Two cards catch people out. An ace counts −1, with the tens, even though it can be worth 1 or 11 in a hand. Jacks, queens and kings all count −1, the same as a 10.',
    ]),
    step('The card values challenge', [
      `The challenge shows ${CARD_VALUES_CONTENT.length} cards, one at a time, with every rank appearing at least once, and you answer +1, 0 or −1 for each. The length is Tableside’s own practice setting.`,
      'Learn tells you straight away whether you were right and lets you try the card again; Check keeps every answer hidden until the results. In both, only your first answer to a card is scored.',
    ]),
  ],
  workedExample: CARD_VALUES_EXAMPLE,
  handoffs: [{ kind: 'learn-challenge', category: 'card-values' }],
  sources: [SOURCE.hiLoValues, SOURCE.bjaValues],
});

const MINUS_TWO_THEN_THREE: RunningCountExplanation = { kind: 'running-count', rank: 3, value: 1, before: -2, count: -1 };
export const RUNNING_COUNT_EXAMPLE: RunningCountExample = {
  kind: 'running-count',
  step: 2,
  before: -2,
  card: { rank: 3, suit: 'diamonds' },
  choices: [
    { answer: -3, response: { correct: false, explanation: MINUS_TWO_THEN_THREE, note: 'A 3 counts +1, so the count moves up toward zero, not further below it.' } },
    { answer: -2, response: { correct: false, explanation: MINUS_TWO_THEN_THREE, note: 'Only 7, 8 and 9 leave the count where it was.' } },
    { answer: -1, response: { correct: true, explanation: MINUS_TWO_THEN_THREE, note: null } },
  ],
};

export const RUNNING_COUNT_LESSON = lesson('running-count', 'Running count', 'Add card values as the cards appear', {
  steps: [
    step('Start at zero, then keep adding', [
      'The running count starts at 0 when the shoe is shuffled. As each card appears, add its Hi-Lo value: +1 for 2 to 6, nothing for 7 to 9, −1 for tens, faces and aces.',
      'Count every card you can see, whoever it was dealt to.',
    ], { source: SOURCE.bjaRunning }),
    step('Negative counts are normal', [
      'The count can go below zero and back again. −2 followed by a 3 is −1; −1 followed by a king is −2. Keep the sign as carefully as the number.',
    ]),
    step('The running count challenge', [
      `The challenge deals ${RUNNING_COUNT_CONTENT.length} cards, one at a time, from a shuffled ${RUNNING_COUNT_CONTENT.decks}-deck shoe, starting from 0.`,
      `In Learn you enter the count after every card and see right away whether it’s right. In Check you enter it only at four checkpoints, after cards ${FIRST_CHECKPOINT}, ${SECOND_CHECKPOINT}, ${THIRD_CHECKPOINT} and ${LAST_CHECKPOINT}, and see how you did when the results come up. Each checkpoint is graded against every card shown so far, so a slip early on carries forward until you correct it.`,
      'You can go at your own pace, or have the next card appear automatically every 3, 2 or 1 seconds. The length, checkpoints and paces are Tableside’s own practice settings.',
    ]),
    step('Show count and assisted attempts', [
      'The Show running count switch shows the count of the cards shown so far. It starts hidden. In Learn you can use it freely; Learn notes whether you did.',
      'In Check, the switch tells you before you use it that showing the count marks the whole attempt assisted. That can’t be undone: hiding the count again changes nothing. An assisted attempt still gets full results, but it’s kept apart from unassisted records, and showing the count never uses another attempt. This assistance rule is Tableside’s own.',
    ]),
  ],
  workedExample: RUNNING_COUNT_EXAMPLE,
  handoffs: [{ kind: 'learn-challenge', category: 'running-count' }],
  sources: [SOURCE.bjaRunning],
});

const SEVEN_OVER_TWO: ConversionExplanation = { kind: 'conversion', running: 7, decks: 2, trueCount: 3, exact: false };
const NEGATIVE_TOO = 'Truncation goes toward zero for negatives too: −7 ÷ 2 = −3.5 becomes −3, not −4.';
export const CONVERSION_EXAMPLE: ConversionExample = {
  kind: 'conversion',
  step: 3,
  running: 7,
  decks: 2,
  choices: [
    { answer: 3, response: { correct: true, explanation: SEVEN_OVER_TWO, note: NEGATIVE_TOO } },
    { answer: 4, response: { correct: false, explanation: SEVEN_OVER_TWO, note: `Rounding 3.5 up gives +4, but Tableside drops the fraction. ${NEGATIVE_TOO}` } },
    { answer: 7, response: { correct: false, explanation: SEVEN_OVER_TWO, note: '+7 is the running count. Divide it by the decks remaining first.' } },
  ],
};

export const CONVERSION_LESSON = lesson('true-count-conversion', 'True-count conversion', 'Divide by decks remaining, then truncate toward zero', {
  steps: [
    step('Why convert', [
      'The true count is the running count per deck still to be dealt: the running count divided by the decks remaining. Tableside’s index plays and its bet schedule use the true count, never the running count on its own.',
    ], { source: SOURCE.bjaTrue }),
    step('Estimate the decks remaining', [
      'Judge the cards still in the shoe to the nearest half deck. When it’s exactly between two half decks, go up. Never use less than half a deck.',
      'So 130 cards left is 2½ decks, 117 cards (exactly between 2 and 2½) is 2½, and with only a few cards left you still divide by ½. At the table challenge Tableside shows you this number, worked out this way from the cards actually left; the conversion challenge gives it to you directly. This estimate is Tableside’s convention.',
    ]),
    step('Divide, then truncate toward zero', [
      'Divide the running count by the decks remaining and drop any fraction, toward zero. +7 with 2 decks left is +3.5, which becomes +3. −7 with 2 decks left is −3.5, which becomes −3, not −4.',
      'Truncating is Tableside’s convention, not rounding: −0.5 becomes 0, and +1.75 becomes +1.',
    ]),
    step('Other sources round differently', [
      'Introductory examples elsewhere follow other conventions, or don’t say what to do with a fraction. Blackjack Apprenticeship’s example divides −7 by 2 decks and gets −3, which matches Tableside, but the page doesn’t say how to round a fraction or how finely to estimate the decks. Wizard of Odds says a rough estimate will do, and its example rounds 7 ÷ 4 = 1.75 up to 2 to keep it simple; Tableside’s convention gives +1 there.',
      'Tableside uses one convention everywhere, so the count you practice is the count you’re graded on.',
    ], { source: SOURCE.wizardTrue }),
    step('Why it matters at zero', [
      `Some index plays have an index of 0. With the dealer standing on soft 17, Tableside teaches for hard 13 against a 2: ${indexRule(THIRTEEN_V2.deviation)}. With a running count of −1 and 2 decks left, −0.5 truncates to 0, so you stand. Rounding −0.5 to −1 would have you hit.`,
      'Tableside worked out its own index plays under this convention. Together with its tie rule and teaching-continuation rule, that is why some of its index numbers differ from published charts; the Basic with deviations lesson lists them.',
    ], { publishedNote: publishedNote(THIRTEEN_V2) }),
    step('The conversion challenge', [
      `The challenge asks ${CONVERSION_CONTENT.length} questions. Each gives a running count from −${CONVERSION_CONTENT.maxRunningCount} to +${CONVERSION_CONTENT.maxRunningCount} and the decks remaining, in half decks from ½ to ${CONVERSION_CONTENT.maxDecks}. Every set includes a zero count, both signs, a division that comes out exact, and fractions that need truncating each way.`,
      'Learn explains each answer and lets you try again; Check shows how you did at the end. Only your first answer to each question is scored. The number of questions and their ranges are Tableside’s own practice settings.',
    ]),
  ],
  workedExample: CONVERSION_EXAMPLE,
  handoffs: [{ kind: 'learn-challenge', category: 'conversion' }],
  sources: [SOURCE.bjaTrue, SOURCE.wizardTrue, SOURCE.schlesinger],
});

// Spec 3 Count checkpoints (table)
const ROUND_ONE: TableRunningExplanation = {
  kind: 'table-running',
  round: 1,
  cards: [
    { rank: 10, suit: 'spades' },
    { rank: 5, suit: 'clubs' },
    { rank: 6, suit: 'hearts' },
    { rank: 13, suit: 'diamonds' },
    { rank: 9, suit: 'spades' },
  ],
  values: [-1, 1, 1, -1, 0],
  before: 0,
  shuffled: false,
  count: 0,
};
export const TABLE_COUNTING_EXAMPLE: TableCountExample = {
  kind: 'table-count',
  step: 3,
  seat: [
    { rank: 10, suit: 'spades' },
    { rank: 6, suit: 'hearts' },
  ],
  dealer: [
    { rank: 5, suit: 'clubs' },
    { rank: 13, suit: 'diamonds' },
    { rank: 9, suit: 'spades' },
  ],
  choices: [
    { answer: 1, response: { correct: false, explanation: ROUND_ONE, note: 'That leaves out the dealer’s king. The hole card counts once it’s turned over.' } },
    { answer: 0, response: { correct: true, explanation: ROUND_ONE, note: null } },
    { answer: -1, response: { correct: false, explanation: ROUND_ONE, note: 'The 9 counts 0, and the 5 and 6 each count +1.' } },
  ],
};

const TABLE_COUNTING_FIRST = lesson('table-counting', 'Table counting', 'Count a live table: checkpoints, Observe and Play, assistance', {
  steps: [
    step('Counting at a table', [
      `The table challenge deals ${TABLE_CONTENT.rounds} rounds of six-deck blackjack from a fresh shoe, starting at 0. You choose the rules, how deep into the shoe to deal, and up to four other players; the ${TABLE_CONTENT.rounds} rounds and these choices are Tableside’s own practice settings. Every card you can see counts, including the other players’ cards.`,
      'The dealer’s face-down card counts only once it is turned over. When the dealer checks for blackjack and doesn’t have it, the card still stays out of the count.',
    ], { source: SOURCE.bjaRunning }),
    step('Observe and Play', [
      'In Observe, a simulated player plays your seat at the table minimum and you only keep the count. Tableside suggests starting table counting here.',
      'In Play, you also make every playing decision for your seat, betting the table minimum. Choose counting with basic, or counting with deviations, which at N = 1 also asks for the true count before each decision that depends on the count. Your playing is scored apart from your counts, against the strategy at the actual count, not the count you entered.',
      'In Learn, a move that departs from the strategy pauses before it’s played: take it back, or keep it, which still counts as a playing miss. In Check, a move that isn’t allowed is refused straight away, and nothing says whether an allowed move is right until the results.',
    ]),
    step('Checkpoints and N', [
      'N sets how often you’re asked, from every round up to every 10 rounds. At N = 1 you enter the running and true count before each bet, and the running count after each round. Above 1, you enter both after every N rounds, and after the last rounds if they don’t make a full block.',
      'For the true count, Tableside shows the decks remaining, estimated from the cards actually left in the shoe as in the conversion lesson. When the cut card is reached, the round finishes, the shoe is reshuffled and the count starts again at 0. This checkpoint schedule and the reset are Tableside’s own.',
    ]),
    step('Show count and assistance', [
      'As in the running count challenge, the Show running count switch shows the count of the cards exposed so far. It starts hidden.',
      'In Check, showing the count marks the whole attempt assisted, permanently, even if you hide it again. An assisted attempt still gets full results, but it’s kept apart from unassisted records. A Learn attempt is always assisted, because Learn shows you the answers.',
    ]),
    step('Learn and Check', [
      'Learn shows whether each count is right and explains it, and you try again or show the answer before moving on. Check records your counts and shows them only in the results. In both, only your first answer at each checkpoint is scored, and the running and true counts are scored separately.',
    ]),
  ],
  workedExample: TABLE_COUNTING_EXAMPLE,
  handoffs: [{ kind: 'learn-challenge', category: 'table' }],
  sources: [SOURCE.bjaRunning],
});

// Spec 3 Lessons › Progress (material change); #138
export const TABLE_COUNTING_LESSON: Lesson = {
  ...TABLE_COUNTING_FIRST,
  content: {
    ...TABLE_COUNTING_FIRST.content!,
    version: 2,
    materialVersion: 2,
    change: 'Play is here: you can now make the playing decisions for your seat, counting with basic strategy or with deviations, so the Observe and Play step is new.',
  },
};

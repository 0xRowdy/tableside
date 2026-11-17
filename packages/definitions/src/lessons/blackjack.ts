// Spec 3 Lessons and worked examples (#48), Amendment 1 B2, C11, Amendment 2 §3; #152
// docs/research/blackjack-lessons.md
import type { Lesson, LessonContent, LessonHandoff, LessonSource, LessonStep, PublishedNote } from '../lessons';
import { BET_SCHEDULE } from '../blackjack/strategies';
import {
  BASIC_STRATEGY_EXAMPLE,
  BASICS_EXAMPLE,
  BET_SCHEDULE_EXAMPLE,
  COUNTING_BASIC_EXAMPLE,
  COUNTING_DEVIATIONS_EXAMPLE,
  DEVIATIONS_EXAMPLE,
} from './blackjack-examples';
import { basicStrategy, blackjackHouseEdge, playingDeviations, type BlackjackPreset, type DeviationAction, type PlayingDeviation, type PublishedCost } from '../blackjack/reference';

// Spec 3 Amendment 1 C11; docs/research/blackjack-lessons.md Citable sources
const SOURCE = {
  schlesinger: {
    citation:
      'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, tables “Illustrious 18” and “Fab 4 Surrenders” (from Don Schlesinger, Blackjack Attack, 2004 ed., p. 62, republished with permission)',
    url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/',
  },
  hiLoValues: {
    citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, table “High-Low Point Values”',
    url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/',
  },
  wizardBasic: { citation: 'Michael Shackleford, Wizard of Odds, “4-Deck to 8-Deck Blackjack Strategy”, section “Basic Strategy in Text”', url: 'https://wizardofodds.com/games/blackjack/strategy/4-decks/' },
  bjaS17: {
    citation: 'Blackjack Apprenticeship, “S17 Deviation Chart” (PDF, © 2018), sections “Pair Splitting”, “Hard Totals”, “Late Surrender” and “Insurance or Even Money”',
    url: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_S17.pdf',
  },
  bjaH17: {
    citation: 'Blackjack Apprenticeship, “H17 Deviation Chart” (PDF, © 2018), sections “Pair Splitting”, “Hard Totals”, “Late Surrender” and “Insurance or Even Money”',
    url: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf',
  },
  bjaCounting: {
    citation: 'Blackjack Apprenticeship, “How To Count Cards”, sections “Step 1: Assign A Value To Every Card”, “Step 2: The Running Count” and “Step 3: Calculate A “True Count” Or Count Per Deck”',
    url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/',
  },
  bjaBetting: { citation: 'Blackjack Apprenticeship, “How To Count Cards”, section “Step 4: Change Your Bets As The True Count Rises And Falls”', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  bjaDeviations: {
    citation: 'Blackjack Apprenticeship, “What are Blackjack Deviations?”, sections “So what are blackjack deviations?” and “When do you perform deviations?”',
    url: 'https://www.blackjackapprenticeship.com/blackjack-deviations/',
  },
  bjaOrder: { citation: 'Blackjack Apprenticeship, “Learn Blackjack Strategy” (Blackjack Strategy Charts), section “Basic Strategy Has An Order Of Operations:”', url: 'https://www.blackjackapprenticeship.com/blackjack-strategy-charts/' },
  certified: { citation: 'Tableside certified blackjack coaching reference, indices_S17_final.csv and indices_H17_final.csv (frozen 2026-09-14, manifest 9892826d)', url: null },
} as const satisfies Record<string, LessonSource>;

// Spec 1 Game rules (Blackjack)
const DEFAULT: BlackjackPreset = 'S17_LS';

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');

export type Publisher = 'schlesinger' | 'bja';

// docs/research/blackjack-lessons.md Reading the numbers
export interface PublishedGap {
  readonly deviation: PlayingDeviation;
  readonly publisher: Publisher;
  readonly printed: string;
  readonly difference: number;
  readonly costs: readonly PublishedCost[];
  readonly tieOnly: boolean;
  readonly dealerRuleMoved: boolean;
}

// #15 Q21
const TIE_MARGIN = 0.001;
const withinTie = (cost: PublishedCost) => Math.abs(cost.perBet) <= Math.max(TIE_MARGIN, 2 * cost.standardError);
const printedValue = (deviation: PlayingDeviation, publisher: Publisher) =>
  publisher === 'schlesinger' ? signed(Number(deviation.published.schlesinger)) : (deviation.dealerRule === 'S17' ? deviation.published.bjaS17 : deviation.published.bjaH17).replaceAll('-', '−');

export function publishedGaps(preset: BlackjackPreset, publisher: Publisher = 'schlesinger'): readonly PublishedGap[] {
  const s17 = playingDeviations('S17_LS');
  return playingDeviations(preset).flatMap((deviation) => {
    const difference = deviation.difference[publisher];
    const costs = deviation.costPerBet[publisher];
    if (difference === null || difference === 0 || costs.length === 0) return [];
    const standing = s17.find((candidate) => candidate.situation === deviation.situation);
    return [
      {
        deviation,
        publisher,
        printed: printedValue(deviation, publisher),
        difference,
        costs,
        tieOnly: costs.every(withinTie),
        dealerRuleMoved: publisher === 'schlesinger' && deviation.dealerRule === 'H17' && standing !== undefined && standing.threshold !== deviation.threshold,
      },
    ];
  });
}

const upCardName = (up: number) => (up === 1 ? 'an ace' : up === 8 ? 'an 8' : `a ${up}`);
export function situationName(deviation: PlayingDeviation): string {
  if (deviation.handKind === 'insurance') return 'insurance';
  if (deviation.handKind === 'pair') return `a pair of tens against ${upCardName(deviation.up)}`;
  return `hard ${deviation.hand} against ${upCardName(deviation.up)}${deviation.set === 'fab4' ? ' (surrender)' : ''}`;
}

const VERB: Readonly<Record<DeviationAction, string>> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double',
  split: 'split',
  surrender: 'surrender',
  insure: 'take insurance',
  decline: 'decline insurance',
  basicWithoutSurrender: 'play the hand by basic strategy',
};

// Spec 1 Counting; docs/research/blackjack-lessons.md Reading the numbers
export function indexRule(deviation: PlayingDeviation): string {
  return deviation.direction === 'deviateAtOrAbove'
    ? `${VERB[deviation.atOrAbove]} at ${signed(deviation.threshold)} or higher, otherwise ${VERB[deviation.below]}`
    : `${VERB[deviation.atOrAbove]} at ${signed(deviation.threshold)} or higher, and ${VERB[deviation.below]} below that`;
}

const fraction = (value: number) => Math.abs(value).toFixed(4);
const costText = (cost: PublishedCost) => `${fraction(cost.perBet)} ± ${fraction(cost.standardError)}`;
const SET_NAME: Readonly<Record<PlayingDeviation['set'], string>> = { illustrious18: 'Illustrious 18', fab4: 'Fab 4', insurance: 'Illustrious 18' };
const publishedName = (gap: PublishedGap) => (gap.publisher === 'schlesinger' ? `Schlesinger’s published ${SET_NAME[gap.deviation.set]} value` : 'Blackjack Apprenticeship’s chart');

// Spec 3 Amendment 1 B2; #15 Q19, Q20
function reason(gap: PublishedGap): string {
  const where = gap.costs.map((cost) => `at ${signed(cost.trueCount)}`).join(' and ');
  if (gap.tieOnly) {
    return `${capitalized(where)} the two plays differ by ${gap.costs.map(costText).join(' and ')} of the original bet, inside the margin Tableside treats as a tie. Its tie rule then keeps the basic play, the one that adds no extra wager, so following the published value here costs nothing measurable.`;
  }
  const basis = gap.dealerRuleMoved
    ? 'Tableside works its values out separately for a dealer who hits soft 17, and this one moved from its S17 value.'
    : 'Tableside values each play assuming you finish the hand by the taught chart (its teaching-continuation rule), over the hands its own six-deck game deals.';
  return `${basis} On that basis, following the published value ${where} gives up ${gap.costs.map(costText).join(' and ')} of the original bet each time the hand comes up.`;
}

const countsAway = (difference: number) => `${words(Math.abs(difference))} ${Math.abs(difference) === 1 ? 'count' : 'counts'} ${difference > 0 ? 'lower' : 'higher'}`;

// Spec 3 Lessons › Content requirements (deviation lessons), Amendment 1 B2, Amendment 2 §3
export function publishedNote(gap: PublishedGap): PublishedNote {
  const lead = `For ${situationName(gap.deviation)}, Tableside teaches: ${indexRule(gap.deviation)}. ${publishedName(gap)} is ${gap.printed}, ${countsAway(gap.difference)}.`;
  return {
    paragraphs: [lead, reason(gap), 'The difference comes from how Tableside sets its own values, so it doesn’t make the published chart wrong.'],
    source: gap.publisher === 'schlesinger' ? SOURCE.schlesinger : gap.deviation.dealerRule === 'S17' ? SOURCE.bjaS17 : SOURCE.bjaH17,
  };
}

function find<T>(items: readonly T[], match: (item: T) => boolean, missing: string): T {
  const found = items.find(match);
  if (found === undefined) throw new Error(missing);
  return found;
}
const gapFor = (preset: BlackjackPreset, situation: string) => find(publishedGaps(preset), (gap) => gap.deviation.situation === situation, `no published difference for ${situation} under ${preset}`);
const deviationFor = (preset: BlackjackPreset, situation: string) => find(playingDeviations(preset), (deviation) => deviation.situation === situation, `no ${preset} deviation for ${situation}`);

const list = (items: readonly string[]) => {
  const separator = items.some((item) => item.includes(',')) ? '; ' : ', ';
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(separator)}${separator === '; ' ? '; and ' : ' and '}${items.at(-1)}`;
};
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const words = (count: number) => NUMBER_WORDS[count] ?? String(count);
const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// #15 Q19–Q21; docs/research/blackjack-lessons.md Reading the numbers
function gapLine(gap: PublishedGap): string {
  const values = `${situationName(gap.deviation)}: Tableside ${signed(gap.deviation.threshold)}, published ${gap.printed}`;
  if (gap.tieOnly) return `${values}, a tie at ${gap.costs.map((cost) => signed(cost.trueCount)).join(' and ')} that costs nothing measurable`;
  const costs = gap.costs.map((cost) => `${fraction(cost.perBet)} at ${signed(cost.trueCount)}`).join(' and ');
  return `${values}, following the published value costs ${costs} (${gap.dealerRuleMoved ? 'the dealer rule' : 'the teaching-continuation rule'})`;
}

// #15 resolution
function differenceSummary(): readonly string[] {
  const all = playingDeviations(DEFAULT);
  const matching = all.filter((deviation) => deviation.difference.schlesinger === 0);
  const gaps = publishedGaps(DEFAULT);
  const ties = gaps.filter((gap) => gap.tieOnly);
  const measured = gaps.filter((gap) => !gap.tieOnly).sort((a, b) => b.costs[0]!.perBet - a.costs[0]!.perBet);
  const cost = (gap: PublishedGap) => `${situationName(gap.deviation)}, ${fraction(gap.costs[0]!.perBet)} at ${signed(gap.costs[0]!.trueCount)}`;
  const [largest, second] = measured.map((gap) => situationName(gap.deviation));
  return [
    `With the dealer standing on soft 17, ${words(matching.length)} of Tableside’s ${all.length} index plays match Schlesinger’s published values and ${words(gaps.length)} sit one count higher.`,
    `${capitalized(words(ties.length))} of those ${words(gaps.length)} come only from the tie rule and cost nothing measurable: ${list(ties.map((gap) => situationName(gap.deviation)))}.`,
    `The other ${words(measured.length)} come from the teaching-continuation rule and are measurable at Tableside’s table. Per original bet, at the published count: ${list(measured.map(cost))}. Only the first two, ${largest} and ${second}, are large enough to matter much; the rest are a few thousandths of a bet.`,
  ];
}

function h17Summary(): readonly string[] {
  const s17 = playingDeviations('S17_LS');
  const moved = playingDeviations('H17_LS').filter((h17) => {
    const standing = s17.find((candidate) => candidate.situation === h17.situation);
    return standing !== undefined && (standing.threshold !== h17.threshold || standing.direction !== h17.direction);
  });
  const gaps = publishedGaps('H17_LS');
  return [
    `Tableside works its values out separately for each dealer rule. When the dealer hits soft 17, ${words(moved.length)} plays move: ${list(moved.map((deviation) => `${situationName(deviation)}, ${indexRule(deviation)}`))}.`,
    `At that table ${words(gaps.length)} of Tableside’s values differ from the published Illustrious 18 and Fab 4. Per original bet: ${list(gaps.map(gapLine))}.`,
  ];
}

function chartSummary(preset: BlackjackPreset): readonly string[] {
  const gaps = publishedGaps(preset, 'bja');
  const rule = preset.startsWith('S17') ? 'stands on' : 'hits';
  return [
    `Blackjack Apprenticeship’s chart for a dealer who ${rule} soft 17 differs from Tableside’s values in ${words(gaps.length)} plays. Per original bet: ${list(gaps.map(gapLine))}.`,
    'Its other entries match Tableside or can’t be compared as a number: a few depend on whether the running count is above or below zero, some cells carry no index, and the chart has more index plays than Tableside teaches. Tableside uses the true count only.',
  ];
}

const edge = (preset: BlackjackPreset) => `${blackjackHouseEdge(preset).percent}%`;

// Spec 1 Game rules, Counting (Hi-Lo), Amendment 9 §7; #3
const scheduleLine = ({ from, amount }: (typeof BET_SCHEDULE)[number], index: number) =>
  `${from === null ? 'Below +1' : index === BET_SCHEDULE.length - 1 ? `+${from} or higher` : `+${from}`}: bet ${amount}`;

const lesson = (id: string, title: string, summary: string, content: Omit<LessonContent, 'version' | 'materialVersion' | 'change'>): Lesson => ({
  id,
  title,
  summary,
  section: 'blackjack',
  game: 'blackjack',
  content: { version: 1, materialVersion: 1, change: null, ...content },
});

const guided = (strategy: string | null): LessonHandoff => ({ kind: 'guided-practice', game: 'blackjack', strategy });
const FREE_PLAY: LessonHandoff = { kind: 'free-play', game: 'blackjack' };

const step = (heading: string, paragraphs: readonly string[], extra: Pick<LessonStep, 'publishedNote' | 'source'> = {}): LessonStep => ({ heading, paragraphs, ...extra });

const SIXTEEN_V10 = basicStrategy(DEFAULT, 'hard', 16, 10);
const ELEVEN_V6 = basicStrategy(DEFAULT, 'hard', 11, 6);
const SOFT_EIGHTEEN_V3 = basicStrategy(DEFAULT, 'soft', 18, 3);

export const BLACKJACK_BASICS = lesson('blackjack-basics', 'Blackjack basics', 'Hands, the table, betting, turn order and settlement', {
  steps: [
    step('Beat the dealer without going over 21', [
      'Cards 2 to 10 count their number, jacks, queens and kings count 10, and an ace counts 1 or 11. A hand with an ace counted as 11 is soft; any other hand is hard. Going over 21 is a bust and loses at once.',
      'An ace and a ten-value card as your first two cards is a blackjack. It pays 3 to 2 unless the dealer has one too, which is a push.',
    ]),
    step('The table you choose', [
      'Every Tableside blackjack table uses six decks. Before you start, setup lets you choose whether the dealer hits or stands on soft 17 and whether late surrender is offered, how deep into the shoe to deal before shuffling, and up to four other players. The default is: dealer stands on soft 17, late surrender on, 75% of the shoe dealt.',
      `These rules change the house edge, even when every play is right. With perfect basic strategy it’s ${edge('S17_LS')} of each bet at the default table, ${edge('S17_noLS')} without surrender, ${edge('H17_LS')} when the dealer hits soft 17, and ${edge('H17_noLS')} with both. Setup shows the figure for the table you pick.`,
    ]),
    step('Placing a bet', [
      'Each round starts with your bet. Pick a chip and tap the betting spot, or open the bet list to type an amount. Rebet repeats your last bet and Clear takes it back; nothing is committed until you press Deal.',
      'The table minimum and maximum apply to that first bet (10 to 1,000 unless you change them in setup). Insurance, splits and doubles can take you past the maximum.',
    ]),
    step('A round, step by step', [
      'The bar above the table tracks the round: Bet, Deal, Play, Settle. You and the dealer get two cards each; one dealer card stays face down.',
      'If the dealer shows an ace, you are offered insurance first: a side bet of up to half your bet that pays 2 to 1 if the dealer has blackjack. With a blackjack of your own it is offered as even money. Then the dealer checks for blackjack. With an ace or a ten showing, a dealer blackjack ends the round here.',
      'Then you play each hand: hit, stand, double (one more card for a second bet), split a pair into two hands, or, where offered, surrender your first two cards for half your bet back. The dealer then draws to 17 or more.',
    ]),
    step('Settlement and your chips', [
      'Tableside settles every bet for you: a win pays 1 to 1, a blackjack 3 to 2, a push returns your bet, a surrender returns half, and insurance settles on its own.',
      'Practice play uses simulated chips, never real money. Each practice session starts fresh: you choose the buy-in in setup (1,000 unless you change it), and Rebuy adds more during the practice session. A practice session that runs on your daily training bankroll has no buy-in and no rebuys.',
    ]),
  ],
  workedExample: BASICS_EXAMPLE,
  handoffs: [FREE_PLAY, guided('basic')],
  sources: [SOURCE.wizardBasic, SOURCE.bjaOrder],
});

export const BASIC_STRATEGY = lesson('basic-strategy', 'Basic strategy', 'The best play for every hand, with no count', {
  steps: [
    step('One right play for every hand', [
      'Basic strategy is the play with the highest average return for your two cards against the dealer’s up card. Nobody keeps a count in this mode; the right play depends only on the cards and the table rules.',
      'Tableside’s charts are worked out for its own six-deck rules, with separate charts for each dealer rule and for surrender on or off. They agree with Wizard of Odds’ published six-deck instructions in every cell compared.',
    ], { source: SOURCE.wizardBasic }),
    step('The order of decisions', [
      `Insurance comes first, and basic strategy always declines it. Surrender comes next where offered: at the default table, hard 16 against a 10 is a ${SIXTEEN_V10.action}. Then split, double, hit or stand.`,
      'After a split or a hit, later decisions follow the chart for your new total.',
    ], { source: SOURCE.bjaOrder }),
    step('When the best play isn’t allowed', [
      `Sometimes the chart’s play isn’t available: you can’t double a three-card hand, or your chips can’t cover the extra bet. Each cell has a fallback for this. Hard 11 against a 6 is a ${ELEVEN_V6.action}, and the fallback is to ${ELEVEN_V6.fallbacks.double}; soft 18 against a 3 is a ${SOFT_EIGHTEEN_V3.action}, falling back to ${SOFT_EIGHTEEN_V3.fallbacks.double}.`,
      'Coaching always shows the fallback as the right play when the first choice isn’t possible, so you’re never marked wrong for a play you couldn’t make.',
    ]),
    step('What basic strategy can and can’t do', [
      `Playing every hand by the chart keeps the house edge as low as the rules allow, ${edge('S17_LS')} at the default table. It doesn’t remove it, and no chart predicts how a session will go.`,
    ]),
  ],
  workedExample: BASIC_STRATEGY_EXAMPLE,
  handoffs: [guided('basic'), FREE_PLAY],
  sources: [SOURCE.wizardBasic, SOURCE.bjaOrder],
});

const SIXTEEN_GAP = gapFor(DEFAULT, '16 vs 10');
const TWELVE_V5_GAP = gapFor(DEFAULT, '12 vs 5');
const TENS_GAP = gapFor(DEFAULT, 'T,T vs 6');
const INSURANCE = deviationFor(DEFAULT, 'Insurance');

export const BASIC_WITH_DEVIATIONS = lesson('basic-with-deviations', 'Basic with deviations', 'Index plays, with the count supplied', {
  steps: [
    step('Tableside keeps the count for you', [
      'In this mode you learn the index plays without keeping the count yourself. A panel beside the table shows the true count supplied in this mode, with the running count and the decks left, and corrections show the count they used.',
      'Once the plays feel natural, Counting with deviations asks you to keep the count as well.',
    ]),
    step('The index plays', [
      `Tableside’s list follows the situations of the Illustrious 18, plus the four Fab 4 surrender plays at tables that offer late surrender, ${playingDeviations(DEFAULT).length} plays in all at the default table. The thresholds are Tableside’s own, worked out for its six-deck rules.`,
      'Each index is a true count. For most plays you make the index play at or above it and play basic strategy below it. A few work the other way: you keep the basic play at or above the index and change it below.',
    ], { source: SOURCE.schlesinger }),
    step('When the count changes a decision', [
      `A deviation is a planned change to basic strategy that applies only at a certain true count. Hard 16 against a dealer 10 is the best-known one: basic strategy hits (with late surrender, a two-card 16 surrenders instead), but at a true count of ${signed(SIXTEEN_GAP.deviation.threshold)} or higher you stand.`,
    ], { publishedNote: publishedNote(SIXTEEN_GAP) }),
    step('Plays that kick in when the count drops', [
      `Some plays work the other way. Basic strategy stands on hard 12 against a 5, but when the count falls low you hit instead: ${indexRule(TWELVE_V5_GAP.deviation)}.`,
    ], { publishedNote: publishedNote(TWELVE_V5_GAP) }),
    step('Insurance', [
      `Basic strategy never insures. With the count, insurance has an index too: ${indexRule(INSURANCE)}. This matches the published value.`,
    ], { source: SOURCE.schlesinger }),
    step('Where our numbers differ', differenceSummary(), { publishedNote: publishedNote(TENS_GAP) }),
    step('When the dealer hits soft 17', h17Summary(), { source: SOURCE.schlesinger }),
    step('Blackjack Apprenticeship’s S17 chart', chartSummary('S17_LS'), { source: SOURCE.bjaS17 }),
    step('Blackjack Apprenticeship’s H17 chart', chartSummary('H17_LS'), { source: SOURCE.bjaH17 }),
  ],
  workedExample: DEVIATIONS_EXAMPLE,
  handoffs: [guided('basic-with-deviations')],
  sources: [SOURCE.schlesinger, SOURCE.bjaS17, SOURCE.bjaH17, SOURCE.certified],
});

export const COUNTING_WITH_BASIC = lesson('counting-with-basic', 'Counting with basic', 'Keep the Hi-Lo count while you play basic strategy', {
  steps: [
    step('Now you keep the count', [
      'In this mode you play basic strategy and keep the Hi-Lo count yourself. Tableside doesn’t show it; your plays are still checked against basic strategy, so the count never changes how a hand should be played here.',
    ]),
    step('The Hi-Lo values', [
      'Count 2 to 6 as +1, 7 to 9 as 0, and tens, faces and aces as −1. Add each card as it is shown, yours, the other players’ and the dealer’s. The dealer’s face-down card counts only once it is turned over.',
    ], { source: SOURCE.bjaCounting }),
    step('From running count to true count', [
      'Tableside’s conversion: divide the running count by the decks still in the shoe, estimated to the nearest half deck (round halves up, never below half a deck), and drop the fraction toward zero. +7 with 2 decks left is +3; −7 with 2 decks left is −3.',
      'The True-count conversion lesson covers this in detail.',
    ]),
    step('Why keep a count here', [
      'In either counting mode you can add the optional bet schedule, which sets each bet from the true count before the deal. Here the count still never changes a play.',
    ]),
  ],
  workedExample: COUNTING_BASIC_EXAMPLE,
  handoffs: [guided('counting-with-basic'), { kind: 'learn-challenge', category: 'running-count' }],
  sources: [SOURCE.bjaCounting, SOURCE.hiLoValues],
});

const THIRTEEN_V2 = deviationFor(DEFAULT, '13 vs 2');

export const COUNTING_WITH_DEVIATIONS = lesson('counting-with-deviations', 'Counting with deviations', 'Keep the count and use it for index plays', {
  steps: [
    step('Your count, your index plays', [
      'This mode puts it all together: you keep the Hi-Lo count and use your own true count for the index plays from Basic with deviations. Plays are checked against the actual true count, so a miss can come from the count or from the play.',
      'Corrections don’t show the count while you play; they name the play. When the practice session ends, its result lists the actual count beside each departure.',
    ]),
    step('Recount at the decision', [
      'Cards keep arriving after you bet, so work out the true count again when you reach a decision, including every card dealt so far. The count you bet with is often not the count you play with.',
    ], { source: SOURCE.bjaDeviations }),
    step('Zero and the truncated count', [
      `Tableside truncates the true count toward zero, so a running count of −1 with 2 decks left is a true count of 0, not −1. That matters for plays with an index of 0: for hard 13 against a 2, ${indexRule(THIRTEEN_V2)}, so here you stand.`,
    ]),
    step('The same index plays', [
      `The thresholds are the same as in Basic with deviations, including insurance at ${signed(INSURANCE.threshold)}. Where they differ from published charts, that lesson explains the difference and why; for example, a pair of tens against a 6 splits at ${signed(TENS_GAP.deviation.threshold)} or higher here.`,
    ], { publishedNote: publishedNote(TENS_GAP) }),
  ],
  workedExample: COUNTING_DEVIATIONS_EXAMPLE,
  handoffs: [guided('counting-with-deviations'), { kind: 'learn-challenge', category: 'table' }],
  sources: [SOURCE.bjaDeviations, SOURCE.schlesinger, SOURCE.certified],
});

export const BET_SCHEDULE_LESSON = lesson('bet-schedule', 'Bet schedule', 'Tableside’s practice schedule: 10 to 80 by true count', {
  steps: [
    step('A bet for every count', [
      'When you turn on the bet schedule in a counting mode, Tableside checks each bet before the deal against a fixed practice schedule, by true count:',
      ...BET_SCHEDULE.map(scheduleLine),
    ]),
    step('Which count to use', [
      'Use the same truncated true count you would use for a play, worked out before the deal from every card shown so far.',
    ]),
    step('Betting is scored on its own', [
      'Bets are checked on their own, apart from your plays and your count: a right bet with a wrong play, or the other way round, shows up as one of each. In a counting challenge, betting adherence is a separate score from playing adherence and counting accuracy, and a different legal bet is allowed but counts as a betting miss.',
    ]),
    step('A practice schedule, not a promise', [
      'This schedule is Tableside’s own, a simple ramp to practice following. Published counting guides say to raise your bet as the true count rises, but they don’t give this ramp. It isn’t a recommendation for real play.',
    ], { source: SOURCE.bjaBetting }),
  ],
  workedExample: BET_SCHEDULE_EXAMPLE,
  handoffs: [guided('counting-with-basic'), guided('counting-with-deviations')],
  sources: [SOURCE.bjaBetting],
});

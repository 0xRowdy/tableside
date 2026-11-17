// Spec 3 Lessons › Inventory, Content requirements; Amendment 1 C11; #154
// docs/research/craps-lessons.md
import type { StrategyDefinition } from '@tableside/engine';

import { DONT_PASS_WITH_LAY_ODDS, FLAT_PLACE_6_8, PASS_WITH_ODDS, PRESS_AND_COLLECT_6_8, THREE_POINT_MOLLY } from '../craps-strategies';
import type { Lesson, LessonContent, LessonHandoff, LessonSource, LessonStep } from '../lessons';

const FREE_PLAY: LessonHandoff = { kind: 'free-play', game: 'craps' };

// Spec 3 S3-12 pX6CV ("Practice it"); Lessons › Structure (Handoff); #145
interface Practice {
  readonly handoffs: readonly LessonHandoff[];
  readonly text: string;
}
const NOTHING_STARTS = 'The setup screen shows whether starting uses your allowance. Nothing starts until you press Start.';
const FREE_PLAY_ONLY: Practice = { handoffs: [FREE_PLAY], text: `Practice it: open craps free play. ${NOTHING_STARTS}` };
const guidedPractice = (strategy: StrategyDefinition): Practice => ({
  handoffs: [{ kind: 'guided-practice', game: 'craps', strategy: strategy.id }, FREE_PLAY],
  text: `Practice it: open guided practice with ${strategy.name.charAt(0).toLowerCase()}${strategy.name.slice(1)} prefilled, or free play. ${NOTHING_STARTS}`,
});

// Spec 3 S3-12 pX6CV
const crapsLesson = (id: string, title: string, summary: string, steps: readonly LessonStep[], practice: Practice, sources: readonly LessonSource[]): Lesson => {
  const last = steps[steps.length - 1]!;
  const content: LessonContent = {
    version: 1,
    materialVersion: 1,
    change: null,
    steps: [...steps.slice(0, -1), { ...last, paragraphs: [...last.paragraphs, practice.text] }],
    workedExample: null,
    handoffs: practice.handoffs,
    sources,
  };
  return { id, title, summary, section: 'craps', game: 'craps', content };
};

// Spec 3 Amendment 1 C11
const WOO_BASICS = 'https://wizardofodds.com/games/craps/basics/';
const WOO_DERIVED = 'https://wizardofodds.com/games/craps/appendix/1/';
const WOO_EDGES = 'https://wizardofodds.com/games/craps/appendix/2/';
const WOO_SYSTEMS = 'https://wizardofodds.com/gambling/betting-systems/';
const NJ_DGE = 'https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf';
const BELLAGIO = 'https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf';

const wizard = (title: string, sections: string, url: string): LessonSource => ({ citation: `Michael Shackleford, Wizard of Odds, “${title}”, ${sections}`, url });
const njDge = (sections: string): LessonSource => ({ citation: `New Jersey Division of Gaming Enforcement, craps rules, N.J.A.C. ${sections}`, url: NJ_DGE });
const bellagio = (pages: string): LessonSource => ({ citation: `Bellagio, Gaming Guide 2016, Craps, ${pages}`, url: BELLAGIO });
// Spec 3 S3-12 hGHha
const own = (what: string): LessonSource => ({ citation: `Tableside's own, not the sources': ${what}.`, url: null });
const EDGE_TABLE = wizard('Craps Odds: House Edge of Every Bet', 'table “Craps House Edge”', WOO_EDGES);
const NO_SYSTEM_BEATS_THE_EDGE = wizard('The Truth about Betting Systems', 'sections “Introduction” and “The Martingale”', WOO_SYSTEMS);

const HOUSE_EDGE_STAYS = "Changing stakes doesn't remove the house edge.";

export const CRAPS_LESSONS: readonly Lesson[] = [
  crapsLesson(
    'craps-basics',
    'Craps basics',
    'The puck, bets, rolls, settlement and funding',
    [
      {
        heading: 'Come-out roll and point',
        paragraphs: [
          'The puck tells you where play stands. With the puck OFF, the next roll is a come-out roll. A pass line bet wins on 7 or 11 and loses on 2, 3 or 12. Any other total (4, 5, 6, 8, 9 or 10) becomes the point, and the puck turns ON.',
          "With a point on, the pass line wins if the point is rolled again before a 7, and loses if a 7 comes first. That 7 is the seven-out, and the next roll is a new come-out. Don't pass is the other side: it wins on 2 or 3 and on a 7 before the point, loses on 7 or 11 and when the point repeats, and a 12 on the come-out is a tie that leaves the bet on the table (bar 12).",
          "Come and don't come work the same way, but you make them while a point is on, and each one moves to the next number rolled.",
        ],
      },
      {
        heading: 'Placing a bet',
        paragraphs: [
          "Tap a spot on the felt to add a chip to the pass line, don't pass, come, odds or the field. For place, buy, lay, hardways and propositions, open Numbers and center bets. That bet selector lists each wager with what it pays and its house edge: choose one, set the total stake with − and +, and place it. A draft isn't on the table until you place it.",
          "Some bets become contracts. Once a point is set, a pass line bet stays until it wins or loses, and you can't lower it or take it down, though you can add odds behind it. An established don't bet can only come down, with its odds. Place bets aren't contracts: you can change or remove them between rolls. “Why locked?” on a bet explains which kind it is.",
        ],
      },
      {
        heading: 'Table conditions',
        paragraphs: [
          'Setup chooses the table: the maximum odds (1x, 2x, 3-4-5x, 5x or 10x the line bet), whether the field pays 3:1 or 2:1 on 12, and the table limits. The table header repeats them during play.',
          "Place bets and come odds are off on the come-out roll unless you turn them on. A bet that is off stays on the table and takes no action, so a come-out 7 doesn't take an off place bet. Off come odds come back if their come bet is decided on that roll.",
        ],
      },
      {
        heading: 'Rolling and settlement',
        paragraphs: [
          'Each turn runs Come-out (or Betting, once a point is on), then Roll, then Settle. Press Roll when your bets are set. The roll settles every bet it decides, and the table lists what happened: the roll, any new point, what won and how much, what lost, what pushed and what was off and came back, then your balance. A place bet that wins is paid and stays up.',
          "Bets the roll doesn't decide stay for the next roll. When you end a practice session, bets that can come down come back, and contracts settle by automatic rolls.",
        ],
      },
      {
        heading: 'Funding',
        paragraphs: [
          "Each practice session starts with the chips you choose at setup, 1,000 unless you change it. Every bet comes out of that balance, and a bet you can't cover isn't placed. Rebuy adds chips during the session; it counts as funding, not as a win. A session funded from a training bankroll has no buy-in and no rebuys.",
          "Practice chips are for practice only. They never stand for money you'd win or lose at a casino.",
        ],
      },
      {
        heading: 'The house edge',
        paragraphs: [
          "Each bet carries a house edge, set by how it pays against the chance of the roll. On this table the pass line is 1.41%, don't pass 1.36%, place 6 and 8 1.52% per bet decided, and the field 2.78% when 12 pays 3:1. Odds pay true odds, so their edge is 0%. The setup screen shows the edge for the rules you choose.",
          "Practice helps you place bets correctly and follow what happens. It doesn't change those numbers.",
        ],
      },
    ],
    FREE_PLAY_ONLY,
    [
      wizard('How to Play Craps', 'sections “Pass”, “Don’t Pass”, “Come, Don’t Come”, “Place”, “Turning Bets On and Off” and “Field Bet”', WOO_BASICS),
      EDGE_TABLE,
      njDge('13:69F-1.2(a), 1.3(c)–(e) and 1.4(b)'),
      bellagio('printed pp. 13–14'),
      own('the default table conditions and practice funding'),
    ],
  ),

  crapsLesson(
    'pass-with-odds',
    'Pass with odds',
    'Pass 10, then 10 odds once a point is set',
    [
      {
        heading: 'Start on the pass line',
        paragraphs: ["Before every come-out roll, bet 10 on the pass line. That's the whole starting position: no other bets.", 'A come-out 7 or 11 wins 10. A 2, 3 or 12 loses the 10. Either way, the next roll is another come-out, so bet 10 again.'],
      },
      {
        heading: "Add odds once there's a point",
        paragraphs: [
          'When the come-out sets a point, put 10 odds behind your pass line. Odds pay true odds: 2:1 on 4 or 10, 3:2 on 5 or 9, and 6:5 on 6 or 8. So 10 in odds wins 20, 15 or 12.',
          'Now wait. Nothing changes until the point or a 7 is rolled.',
        ],
      },
      {
        heading: 'When the point is settled',
        paragraphs: [
          'Point made: the pass line wins 10 and the odds win at true odds. Seven-out: both lose, 20 in all.',
          'Then go back to the start: 10 on the pass line for the next come-out. Stakes never change after a win or a loss.',
        ],
      },
      {
        heading: 'Limits and stopping',
        paragraphs: [
          "The strategy always takes 10 in odds, equal to the line bet, whatever larger odds the table allows. Its 10-unit stakes and equal odds are Tableside's own defaults, not a published system.",
          "There's no stopping rule inside the strategy: you decide when to end. If you end with a point on, your pass line bet can't come down, so it settles by automatic rolls, with no new bets. If you start while a point is already on, the strategy waits for the next come-out.",
        ],
      },
      {
        heading: "What odds change, and what they don't",
        paragraphs: [
          'The pass line carries a 1.41% house edge. Odds carry none, so with 10 in odds the edge across everything you bet falls to 0.85%. The pass bet itself still has the same 1.41% edge; odds add more money in play at no edge.',
        ],
      },
    ],
    guidedPractice(PASS_WITH_ODDS),
    [
      wizard('How to Play Craps', 'sections “Pass”, “The Odds” and “Strategy”', WOO_BASICS),
      wizard('How the House Edge for Each Bet is Derived', 'section “Pass/Come”', WOO_DERIVED),
      njDge('13:69F-1.6(a)'),
      own('the 10-unit pass bet and 10 odds at every odds setting'),
    ],
  ),

  crapsLesson(
    'flat-place-6-8',
    'Flat place 6 and 8',
    '12 on each of 6 and 8 after the point; collect every win',
    [
      {
        heading: 'Place 6 and 8 once a point is on',
        paragraphs: [
          'This strategy makes no line bet. Once a point is set, place 12 on the 6 and 12 on the 8. Place 6 and 8 pay 7:6, so they go in multiples of 6, and 12 wins 14.',
          'Both numbers are placed even when one of them is the point.',
        ],
      },
      {
        heading: 'Collect every win',
        paragraphs: ['When a 6 or 8 is rolled, that bet wins 14. Collect it and leave the bet at 12. Stakes never grow or shrink.'],
      },
      {
        heading: 'Through the come-out',
        paragraphs: [
          "When the point is made, both bets stay up but are off for the come-out roll, as place bets are by default. A come-out 7 doesn't take them. Once a new point is set, they work again.",
        ],
      },
      {
        heading: 'Seven-out and limits',
        paragraphs: [
          'A seven-out loses both bets, 24 in all. Wait for the next point, then place 12 on each again.',
          "Placing 12 on each with no line bet, collecting every win, and keeping them up through the come-out are Tableside's own variant, not a published system. Both bets go on together or not at all. There's no stopping rule inside it: you decide when to end, and place bets come back when you stop.",
        ],
      },
      {
        heading: 'The house edge',
        paragraphs: ["Place 6 and 8 each carry a 1.52% house edge on every bet that's decided. Flat stakes keep the amount at risk steady; they don't change the edge."],
      },
    ],
    guidedPractice(FLAT_PLACE_6_8),
    [
      wizard('How to Play Craps', 'sections “Place” and “Turning Bets On and Off”', WOO_BASICS),
      EDGE_TABLE,
      njDge('13:69F-1.2(a)5 and 1.4(b)'),
      bellagio('printed p. 14, “Place Bets”'),
      own('12 on each of 6 and 8 with no line bet, kept up but off through the come-out'),
    ],
  ),

  crapsLesson(
    'dont-pass-with-lay-odds',
    "Don't pass with lay odds",
    "Don't pass 10, then lay odds to win 10",
    [
      {
        heading: "Start on don't pass",
        paragraphs: [
          "Before every come-out roll, bet 10 on don't pass. A come-out 2 or 3 wins 10. A 7 or 11 loses it. A 12 is a tie: the bet stays for the next roll.",
        ],
      },
      {
        heading: 'Lay odds to win 10',
        paragraphs: [
          "When a point is set, lay odds behind don't pass so that a win pays 10: lay 20 against 4 or 10, 15 against 5 or 9, and 12 against 6 or 8. Laid odds pay true odds the other way around, 1:2, 2:3 and 5:6.",
        ],
      },
      {
        heading: 'When the point is settled',
        paragraphs: [
          "A 7 before the point: don't pass wins 10 and the lay wins 10. The point first: both lose, 10 plus what you laid.",
          "Then start again with 10 on don't pass for the next come-out. Stakes don't change after a win or a loss.",
        ],
      },
      {
        heading: 'Limits and stopping',
        paragraphs: [
          "An established don't bet can come down with its lay, though it can't be changed. This strategy never takes it down: it keeps the bet and its lay until they settle. Its 10-unit bet and lay-to-win-10 sizing are Tableside's own variant, not a published system.",
          "There's no stopping rule inside it: you decide when to end. When you stop, your don't pass bet and its lay come back.",
        ],
      },
      {
        heading: 'The house edge',
        paragraphs: [
          "Don't pass carries a 1.36% house edge. Laid odds carry none, so laying to win 10 brings the edge across everything you bet to 0.68%. The lay puts more money at risk to win the same 10; it doesn't make the don't pass bet itself any better.",
        ],
      },
    ],
    guidedPractice(DONT_PASS_WITH_LAY_ODDS),
    [
      wizard('How to Play Craps', 'sections “Don’t Pass”, “Laying the Odds” and “Strategy”', WOO_BASICS),
      wizard('How the House Edge for Each Bet is Derived', 'section “Don’t Pass/Don’t Come”', WOO_DERIVED),
      njDge('13:69F-1.2(a)2, 1.3(d) and 1.6(b)'),
      bellagio('printed pp. 13–14, “Don’t Pass Line” and “Odds”'),
      own('the 10-unit bet and laying odds to win 10'),
    ],
  ),

  crapsLesson(
    'three-point-molly',
    'Three-point Molly (bounded)',
    'Pass plus up to two come bets, 10 odds on each',
    [
      {
        heading: 'Start with the pass line',
        paragraphs: ['Before the come-out roll, bet 10 on the pass line. When a point is set, put 10 odds behind it.'],
      },
      {
        heading: 'Add come bets, up to two',
        paragraphs: [
          'With the point on, make a 10 come bet. The next number it lands on becomes its own point, and you put 10 odds on it there. Keep adding one come bet at a time while fewer than two are working.',
          'That bounds you to three points at once: the pass line and two come bets, each with 10 odds.',
        ],
      },
      {
        heading: 'When numbers hit',
        paragraphs: [
          "When a come bet's number is rolled again with a point on, it and its odds win and come down. On a come-out roll its odds are off, so the come bet wins alone and its odds come back. With room again, make another come bet. When the point is made, the pass line and its odds win; bet 10 on the pass line for the next come-out.",
          'On the come-out roll, come bets already on numbers still work, but their odds are off: a come-out 7 loses those come bets and returns their odds. No new come bets are made until a point is set.',
        ],
      },
      {
        heading: 'Seven-out, limits and stopping',
        paragraphs: [
          'A seven-out loses the pass line, every come bet on a number and the odds on all of them. A come bet still waiting in the come area wins on that same 7.',
          "The published Three Point Molly takes the largest odds the table allows and ends at a seven-out. Tableside's own bounded version caps you at two come bets, fixes the odds at 10, and carries on with a new pass bet after a seven-out. At most 60 is on the table.",
          "There's no stopping rule inside it: you decide when to end, and contracts on the table settle by automatic rolls.",
        ],
      },
      {
        heading: "Stakes change. The house edge doesn't.",
        paragraphs: [
          "Each pass and come bet carries a 1.41% house edge, and 0.85% across the bet and its equal odds. Running three points at once puts more money on the table per roll; it doesn't lower the edge on any of it. " +
            HOUSE_EDGE_STAYS,
        ],
      },
    ],
    guidedPractice(THREE_POINT_MOLLY),
    [
      wizard('Three Point Molly', 'sections “Rules” and “Analysis”', 'https://wizardofodds.com/gambling/three-point-molly/'),
      NO_SYSTEM_BEATS_THE_EDGE,
      wizard('How to Play Craps', 'sections “Come, Don’t Come” and “Turning Bets On and Off”', WOO_BASICS),
      njDge('13:69F-1.2(a)3, 1.3(e) and 1.6(c)'),
      own('at most two come bets, 10 odds on each, and carrying on after a seven-out'),
    ],
  ),

  crapsLesson(
    'press-and-collect-6-8',
    'Press-and-collect 6 and 8 (capped)',
    'Collect the first hit, then alternate press and collect up to 48',
    [
      {
        heading: 'Start at 12 on each',
        paragraphs: ['Once a point is set, place 12 on the 6 and 12 on the 8. Each number keeps its own stake and its own turn to press or collect from here.'],
      },
      {
        heading: 'Collect, then press',
        paragraphs: [
          'The first hit on a number: collect the 14 it wins and leave the bet at 12. The next hit: press, adding 12 to that number from the win, so the bet goes to 24. Then collect, then press again.',
          'So each number climbs 12, 24, 36, 48, with a collected win between each step. 24 on 6 or 8 wins 28, 36 wins 42 and 48 wins 56.',
        ],
      },
      {
        heading: 'The cap and the reset',
        paragraphs: [
          'At 48, four times the starting bet, the number stops pressing and collects every hit. At most 96 is on the table. When the point is made, both stakes and their press-or-collect turn carry on, with the bets off for the come-out roll; a come-out 7 changes nothing.',
          "A seven-out loses both bets and resets both numbers to 12, collecting first again. The 48 cap and this reset are Tableside's own, not a published system.",
        ],
      },
      {
        heading: 'Limits and stopping',
        paragraphs: [
          "If a press can't be placed, because of your balance or the table maximum, the win stays paid, the bet stays where it was and the press waits for you. Collect instead ends the strategy's cycle and takes the place bets down. There's no stopping rule inside it: you decide when to end.",
        ],
      },
      {
        heading: "Stakes change. The house edge doesn't.",
        paragraphs: [
          'Place 6 and 8 carry a 1.52% house edge on every bet decided, at 12 or at 48. Pressing changes how much is at risk after a run of hits; a seven-out at 48 loses more than one at 12. ' + HOUSE_EDGE_STAYS,
        ],
      },
    ],
    guidedPractice(PRESS_AND_COLLECT_6_8),
    [EDGE_TABLE, NO_SYSTEM_BEATS_THE_EDGE, njDge('13:69F-1.2(a)5 and 1.4(b)'), own('the whole routine, from collecting first to the 48 cap and the reset on a seven-out')],
  ),
];

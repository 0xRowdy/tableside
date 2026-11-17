// Spec 3 Lessons › Inventory (standard craps), Content requirements; Amendment 1 C11; #48; #154
// Every fact here is recorded in docs/research/craps-lessons.md: rules and payouts from the engine,
// stakes, caps and resets from ../craps-strategies.ts, house edges from crapsHouseEdge (../craps.ts).
import { DONT_PASS_WITH_LAY_ODDS, FLAT_PLACE_6_8, PASS_WITH_ODDS, PRESS_AND_COLLECT_6_8, THREE_POINT_MOLLY } from '../craps-strategies';
import type { Lesson, LessonContent, LessonHandoff, LessonSource, LessonStep } from '../lessons';

type CrapsLesson = Pick<Lesson, 'summary' | 'content'>;

const FREE_PLAY: LessonHandoff = { kind: 'free-play', game: 'craps' };
const practise = (strategy: string): readonly LessonHandoff[] => [{ kind: 'guided-practice', game: 'craps', strategy }, FREE_PLAY];

const SOURCES: Record<string, LessonSource> = {};

const lesson = (summary: string, steps: readonly LessonStep[], handoffs: readonly LessonHandoff[], sources: readonly LessonSource[]): CrapsLesson => {
  const content: LessonContent = { version: 1, materialVersion: 1, change: null, steps, workedExample: null, handoffs, sources };
  return { summary, content };
};

const HOUSE_EDGE_STAYS = "Changing stakes doesn't remove the house edge.";

export const CRAPS_LESSONS: Readonly<Record<string, CrapsLesson>> = {
  'craps-basics': lesson(
    'The puck, bets, rolls, settlement and funding',
    [
      {
        heading: 'Come-out roll and point',
        paragraphs: [
          'The puck tells you where the round stands. With the puck OFF, the next roll is a come-out roll. A pass line bet wins on 7 or 11 and loses on 2, 3 or 12. Any other total (4, 5, 6, 8, 9 or 10) becomes the point, and the puck turns ON.',
          "With a point on, the pass line wins if the point is rolled again before a 7, and loses if a 7 comes first. That 7 is the seven-out, and the next roll is a new come-out. Don't pass is the other side: it wins on 2 or 3 and on a 7 before the point, loses on 7 or 11 and when the point repeats, and a 12 on the come-out is a tie (bar 12).",
        ],
      },
      {
        heading: 'Placing a bet',
        paragraphs: [
          "Tap a spot on the felt, or open the bet list to see every wager with what it pays and its house edge. Choose one, set the total stake with − and +, and place it. A draft isn't on the table until you place it.",
          "Some bets become contracts. Once a point is set, a pass line bet stays until it wins or loses, and you can't lower it or take it down, though you can add odds behind it. Place bets aren't contracts: you can change or remove them between rolls. “Why locked?” on a bet explains which kind it is.",
        ],
      },
      {
        heading: 'Table conditions',
        paragraphs: [
          'Setup chooses the table: the maximum odds (1x, 2x, 3-4-5x, 5x or 10x the line bet), whether the field pays 3:1 or 2:1 on 12, and the table limits. The table header repeats them during play.',
          'Place bets and come odds are off on the come-out roll unless you turn them on, so a come-out 7 returns them instead of taking them. A bet that is off stays on the table and takes no action.',
        ],
      },
      {
        heading: 'Rolling and settlement',
        paragraphs: [
          'Press Roll when your bets are set. Each roll settles every bet it decides, and the table lists what happened: what won and how much, what lost, and what was off and came back. A place bet that wins is paid and stays up.',
          "Bets the roll doesn't decide stay where they are for the next roll.",
        ],
      },
      {
        heading: 'Funding',
        paragraphs: [
          "Each practice session starts with the chips you choose at setup. Every bet comes out of that balance, and a bet you can't cover isn't placed. Rebuy adds chips during the session, up to the funding limit, and the setup and rebuy sheets show how much has been added so far.",
          "Practice chips are for practice only. They never stand for money you'd win or lose at a casino.",
        ],
      },
      {
        heading: 'The house edge',
        paragraphs: [
          "Every craps bet except odds carries a house edge, set by how it pays against the chance of the roll. On this table the pass line is 1.41%, don't pass 1.36%, place 6 and 8 1.52%, and the field 2.78% when 12 pays 3:1. Odds pay true odds, so their edge is 0.00%. The setup screen shows the edge for the rules you choose.",
          "Practising helps you place bets correctly and follow what happens. It doesn't change those numbers.",
        ],
      },
    ],
    [FREE_PLAY],
    [],
  ),

  'pass-with-odds': lesson(
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
          "There's no stopping rule inside the strategy: you decide when to end. If you end with a point on, the pass line and its odds roll on until they settle, with no new bets.",
        ],
      },
      {
        heading: "What odds change, and what they don't",
        paragraphs: [
          'The pass line carries a 1.41% house edge. Odds carry none, so with 10 in odds the edge across everything you bet falls to 0.85%. The pass bet itself still has the same 1.41% edge; odds add more money in play at no edge.',
        ],
      },
    ],
    practise(PASS_WITH_ODDS.id),
    [],
  ),

  'flat-place-6-8': lesson(
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
          "Placing 12 on each, collecting every win, and keeping them up through the come-out are Tableside's own variant, not a published system. There's no stopping rule inside it: you decide when to end.",
        ],
      },
      {
        heading: 'The house edge',
        paragraphs: ["Place 6 and 8 each carry a 1.52% house edge on every bet that's decided. Flat stakes keep the amount at risk steady; they don't change the edge."],
      },
    ],
    practise(FLAT_PLACE_6_8.id),
    [],
  ),

  'dont-pass-with-lay-odds': lesson(
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
          "When a point is set, lay odds behind don't pass so that a win pays 10: lay 20 against 4 or 10, 15 against 5 or 9, and 12 against 6 or 8. Laid odds pay true odds the other way round, 1:2, 2:3 and 5:6.",
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
          "The table lets don't bets come down, but this strategy keeps the bet and its lay until they settle. Its 10-unit bet and lay-to-win-10 sizing are Tableside's own variant, not a published system.",
          "There's no stopping rule inside it: you decide when to end. If you end with a point on, the bets on the table roll on until they settle, with no new bets.",
        ],
      },
      {
        heading: 'The house edge',
        paragraphs: [
          "Don't pass carries a 1.36% house edge. Laid odds carry none, so laying to win 10 brings the edge across everything you bet to 0.68%. The lay puts more money at risk to win the same 10; it doesn't make the don't pass bet itself any better.",
        ],
      },
    ],
    practise(DONT_PASS_WITH_LAY_ODDS.id),
    [],
  ),

  'three-point-molly': lesson(
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
          "When a come bet's number is rolled again, it and its odds win and come down. With room again, make another come bet. When the point is made, the pass line and its odds win; bet 10 on the pass line for the next come-out.",
          'On the come-out roll, come bets already on numbers still work, but their odds are off. No new come bets are made until a point is set.',
        ],
      },
      {
        heading: 'Seven-out, limits and stopping',
        paragraphs: [
          'A seven-out loses the pass line, every come bet on a number and the odds on all of them. A come bet still waiting in the come area wins on that same 7.',
          "The cap of two come bets and 10 odds on each are Tableside's own bounds, not a published system. There's no stopping rule inside it: you decide when to end, and contracts on the table roll on until they settle.",
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
    practise(THREE_POINT_MOLLY.id),
    [],
  ),

  'press-and-collect-6-8': lesson(
    'Collect the first hit, then alternate press and collect up to 48',
    [
      {
        heading: 'Start at 12 on each',
        paragraphs: ['Once a point is set, place 12 on the 6 and 12 on the 8. Each number keeps its own count of hits from here.'],
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
          'At 48, four times the starting bet, the number stops pressing and collects every hit. When the point is made, both stakes and their press-or-collect turn carry on, with the bets off for the come-out roll.',
          "A seven-out loses both bets and resets both numbers to 12, collecting first again. The 48 cap and this reset are Tableside's own, not a published system.",
        ],
      },
      {
        heading: 'Limits and stopping',
        paragraphs: [
          "If your balance can't cover a press, the strategy waits instead of borrowing or changing the plan. There's no stopping rule inside it: you decide when to end.",
        ],
      },
      {
        heading: "Stakes change. The house edge doesn't.",
        paragraphs: [
          'Place 6 and 8 carry a 1.52% house edge on every bet, at 12 or at 48. Pressing changes how much is at risk after a run of hits; a seven-out at 48 loses more than one at 12. ' + HOUSE_EDGE_STAYS,
        ],
      },
    ],
    practise(PRESS_AND_COLLECT_6_8.id),
    [],
  ),
};

void SOURCES;

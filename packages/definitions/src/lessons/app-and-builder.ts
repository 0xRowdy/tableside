// Spec 3 Lessons (#48), Amendment 1 C11; #151; docs/research/lessons-app-orientation-and-builder.md
import type { Lesson } from '../lessons';

export const APP_ORIENTATION: Lesson = {
  id: 'app-orientation',
  title: 'App orientation',
  summary: 'Tabs, help, practice vs casino records',
  section: 'app',
  game: null,
  content: {
    version: 1,
    materialVersion: 1,
    change: null,
    steps: [
      {
        heading: 'Find your way around',
        paragraphs: [
          'Six tabs sit along the bottom of the screen. Home has the three games: blackjack, standard craps and roulette. Play opens your current table, or game setup when nothing is running. Counting holds the four counting challenges. Community holds strategies other players publish. Saved keeps your practice and casino sessions. More holds your strategies, Settings and support.',
          'Leaving a table for another tab keeps your practice session exactly where it was, and coming back picks it up again. Only stopping, resetting or switching games ends it.',
          'There is no set order. Open the tabs, games and lessons in whatever order suits you.',
        ],
      },
      {
        heading: 'Help when you need it',
        paragraphs: [
          'The first time you meet an unfamiliar control, such as the bet selector or count entry, a short hint explains it. Dismiss it and it stays dismissed on this device.',
          "Each game's setup offers Learn this game, and the Counting tab has a lesson beside each challenge. Every lesson, this one included, is in More › Settings › Learning, where you can also bring back the hints and the Start here card. Lessons never use challenge attempts or allowance.",
          'During a Check attempt, help with entering answers, skipping, pausing and the show-count toggle stays open. The counting lessons, and for a Play Check the four blackjack mode lessons and the bet-schedule lesson, wait until the attempt ends.',
        ],
      },
      {
        heading: 'Practice, casino and challenge records',
        paragraphs: [
          'Tableside keeps three kinds of records apart. A practice session is simulated play. Saved › Practice lists each one you finish with its result, and shows how closely you followed your strategy separately from the money.',
          "A casino session is real play you record yourself: the game, when you played, your buy-ins and cash-out, and if you like the casino's name and the table conditions. It uses your real currency, works offline and is strictly private: never shared, published or compared.",
          "Counting challenge results score your accuracy, never winnings, and a Play challenge's balance stays out of your practice totals. All of these describe what happened. None of them predicts how you'll do next time.",
        ],
      },
      {
        heading: 'Lessons at your own pace',
        paragraphs: [
          'A lesson keeps your place. Leave at any step, and next time you can resume there or restart from step 1.',
          "Finishing a lesson just marks it completed. It never scores you, awards anything or unlocks anything, and there's no test at the end.",
        ],
      },
    ],
    workedExample: null,
    handoffs: [
      { kind: 'free-play', game: 'blackjack' },
      { kind: 'free-play', game: 'craps' },
      { kind: 'free-play', game: 'roulette' },
    ],
    sources: [],
  },
};

// Spec 4 (#54), Amendments 1–2; docs/research/lessons-app-orientation-and-builder.md
export const BUILDING_A_STRATEGY: Lesson = {
  id: 'building-a-strategy',
  title: 'Building a strategy',
  summary: 'Conditions, amounts, conflicts, fallbacks, stopping',
  section: 'builder',
  game: null,
  content: {
    version: 1,
    materialVersion: 1,
    change: null,
    steps: [
      {
        heading: 'Start from a strategy',
        paragraphs: [
          'More › Strategies lists the built-in strategies and your own. Customize a strategy copies a built-in or one of yours into a private strategy that only you see, and the original never changes. Start blank begins with no rules of your own, so the defaults apply until you add some. Building is free and works offline.',
          "Craps and roulette strategies are written as guided sentences in four groups: starting bets, conditions, adjustments and stopping rules. A blackjack strategy starts from the reference chart for a rule preset: you change single decisions, edit deviations and set a bet schedule, and every changed cell is marked with the reference play beside it. Each strategy states the table conditions it's written for.",
        ],
      },
      {
        heading: 'Conditions: when a rule acts',
        paragraphs: [
          'A condition says when a rule acts, as in "When the point is on, place 6 and 8 for 12 each." Conditions can read the game situation, the true count, the bets already on the table, recent outcomes, and how far this cycle is up or down. Combine them with "all of" or "any of".',
          "A count condition reads the shoe's actual true count, never a count you entered.",
        ],
      },
      {
        heading: 'Wagers and amounts',
        paragraphs: [
          'Each rule names a bet and an amount. Adjustments change amounts after an outcome: press, collect, regress, double after a loss or add a unit, each up to a cap you set. Every bet keeps its own counter, so a press on the 6 never advances the 8, and progression lists such as Labouchere are edited directly.',
          "Amounts are checked as you type against the bet's legal targets, increments, working rules and the table limits. An amount that doesn't fit is explained, never rounded, resized or swapped for another bet.",
          "Bets that must go up together form a group, placed completely or not at all. If the balance can't cover the whole group, none of it goes up: 12 each on the 6 and 8 needs 24, so a balance of 20 places neither. A win that's already paid stays paid: if the press that follows would break a table limit, the press waits until you stop or override it.",
          "Each rule shows its own wager's house edge under the table conditions. Changing bets or stakes doesn't remove the house edge.",
        ],
      },
      {
        heading: 'Explanations: check what it does',
        paragraphs: [
          'A plain-language description is written from your rules and changes whenever they do, so you can check it says what you meant.',
          'In the preview, pick an example situation to see which rule matches, what it prescribes, any fallback and the counters afterwards, or step through a short sequence. The preview is labeled "Illustration, not a result": it\'s free and records nothing.',
          "You can add a strategy note to a rule. It's your own note, shown after a correction apart from the coach's explanation and never during a Check attempt, and it never changes what the strategy does.",
        ],
      },
      {
        heading: 'Conflicts: you choose which rule wins',
        paragraphs: [
          'When two rules could prescribe different things for the same bet in the same situation, the builder flags a conflict. List order is for reading only: you settle a conflict by marking which rule wins or by adding an exception. Rules for different bets can act together and are never flagged.',
          'The builder flags rules unless it can prove they never apply at once, such as "point is 6" and "point is 8". A blackjack deviation is an exception to its chart cell, not a conflict. A strategy with conflicts or gaps is still kept, so you can finish it later.',
        ],
      },
      {
        heading: 'Defaults and fallbacks',
        paragraphs: [
          "Situations your rules don't cover follow a default you can see and edit. In craps and roulette it's no new bets, with existing bets kept where legal. In blackjack it's the reference play for your rule preset.",
          "When a blackjack action isn't available, the strategy uses its legal fallback, which starts as the reference's fallback and can be changed. Following a fallback or a prescribed deviation counts as following the strategy.",
          'A changed blackjack cell shows the reference play beside your choice. Tableside never calls a change better or worse.',
        ],
      },
      {
        heading: 'Stopping, saving and practicing',
        paragraphs: [
          'A cycle is one run of the strategy, from its starting bets until its stopping or completion rules are met. In Tableside, stopping rules belong to the current cycle: for example, stop new bets when this cycle is up 150 or down 200, whichever comes first, or end the cycle when the list runs out. Every list and progression needs a cap or a stop.',
          'When a cycle stops, removable bets come back and bets that must stay, such as a craps pass bet, settle with no new bets. A new cycle starts only when you restart it, and restarting never tops up the balance.',
          'Edits save to your working copy as you go. Save revision makes a fixed version once nothing is incomplete or in conflict. Test in practice opens guided-practice setup with your latest revision; nothing starts, and no allowance is used, until you press Start. A practice session keeps the revision it started with, even if you save a newer one.',
        ],
      },
    ],
    workedExample: null,
    handoffs: [
      { kind: 'guided-practice', game: 'blackjack', strategy: null },
      { kind: 'guided-practice', game: 'craps', strategy: null },
      { kind: 'guided-practice', game: 'roulette', strategy: null },
    ],
    sources: [],
  },
};

# App orientation and Builder lessons: research

Research date: 2026-11-17. Gathers the facts the **App orientation** and **Builder** lessons ([#151](https://github.com/0xRowdy/tableside/issues/151), spec [#53](https://github.com/0xRowdy/tableside/issues/53)) may state. Copy in `packages/definitions/src/lessons/app-and-builder.ts` states only what this note records.

## Scope and sources

Both lessons describe Tableside itself, so every fact comes from Tableside's own specs and decisions. No outside source is used:

- **No Blackjack Apprenticeship, Casino Quest, book or video source is used.** Neither lesson draws on outside work. There is no number to certify, so no certified blackjack artifact, engine replay, published rule or house-edge figure is needed. Neither lesson quotes a house-edge figure.
- The builder is spec 4's ([#54](https://github.com/0xRowdy/tableside/issues/54)), not yet built. The Builder lesson is written against spec 4's description and amendments, as #151 directs.
- Each lesson's `sources` list records this provenance for spec 7's register: Tableside's own copy and the decisions it was written from. Those entries carry no link, because they are internal records rather than credits a player needs.

Primary sources read:

| Ref | Source |
| --- | --- |
| S1 | Spec 1 [#51](https://github.com/0xRowdy/tableside/issues/51) body, *Presentation, navigation and screens*, and Amendment 1 row 3 |
| S3 | Spec 3 [#53](https://github.com/0xRowdy/tableside/issues/53) body (*Lessons and worked examples*, *First-run order*) and Amendments 1 (A2, C11), 2 and 4 §5 |
| S4 | Spec 4 [#54](https://github.com/0xRowdy/tableside/issues/54) body (*Solution*, user stories 9–41, 46–66, *Strategy model, builder and editor rules*, *Revisions, saving and pinning*, *Casino sessions*) and Amendments 1 (L–V), 2 (B, D), 3, 6 |
| D5 | Decision [#5, Intuitive executable strategy creation](https://github.com/0xRowdy/true-count/issues/5#issuecomment-5556790279) |
| D48 | Decision [#48, Onboarding and tutorial curriculum](https://github.com/0xRowdy/true-count/issues/48#issuecomment-5670773802) |
| CX | `CONTEXT.md` (glossary terms in **bold** below) |
| F | Spec 3 frames `NvGyZ` (Settings › Learning), `olGG6` (Home, Start here) and `hGHha` (Sources step) |

## App orientation

### Required coverage

"App orientation (1): navigation, help, practice vs casino records." (S3 *Inventory*; D48 *Accepted curriculum inventory*.) The lesson is optional and lives in the catalog; nothing before Home teaches (S3 *First-run order*). It is always available offline (S3 *Access*; Amendment 4 §5).

### Navigation

- A persistent bottom tab bar is the only global navigation, with six tabs: **Home**, **Play**, **Counting**, **Community**, **Saved** and **More**. It shows on every screen of an active account, including tables; modal sheets hide it while they are open. (S1 *Navigation*; S1 Amendment 1 row 3.)
- Home holds three game cards: blackjack, standard craps and roulette (S1; frame `olGG6`).
- Play opens the active session's table, or game setup when no session is running (S1).
- Counting holds the four Hi-Lo counting challenges: card values, running count, true-count conversion and table counting (S3 *Solution*).
- Community holds strategies other players publish (spec 6; CX **Community strategy**).
- Saved has **Practice** and **Casino** segments (S4 *Solution*).
- More holds Strategies (spec 4), Settings (Sound & haptics, Account, Learning; spec 5 adds Plan and Offline & allowance) and support (S1; S1 Amendment 4; S4 Amendment 1 V).
- Leaving a table through the tab bar suspends the session in place, and returning resumes it. Only an explicit stop, reset or game switch ends it (S1 *Active-session navigation*).
- Lessons have no required order, prerequisites or placement test (S3 story 6; D48).

### Help

- **First-use hints**: short and dismissible, shown the first time you meet an unfamiliar control; they never gate play or reveal answers. "Seen" is stored on this device (S3 *First-use hints*; CX). Frame `NvGyZ` names the bet selector, count entry and the show-count toggle hints.
- More › Settings › Learning holds the full lesson catalog, "Show Start here on Home" and "Show first-use hints again" (S3 story 4 and *Entry points*; frame `NvGyZ`). Start here and hint settings are device-local (S3 Amendment 1 C7).
- Lesson entry points: Home's dismissible Start here card; "Learn this game" on each game's setup; the counting lessons beside their categories on the Counting tab; builder help inside the editor; Settings › Learning (S3 *Entry points*).
- During a Check attempt, operational help (entering counts, skip, pause, the show-count toggle's consequence) stays available. While a Check attempt is unfinished, the counting lessons and their worked examples are withheld until it ends; a Play Check also withholds the four blackjack mode lessons and the bet-schedule lesson (S3 Amendment 1 A2). App orientation and Builder are never withheld.
- Lessons and worked examples never use challenge attempts or allowance (S3 *Access*; D48).

### Practice, casino and challenge records

- A **practice session** is simulated play at one game. Saved › Practice lists every completed session with its result, and adherence is shown separately from money (S4 *Solution*, stories 46–49; CX).
- Practice totals describe recorded sessions only and never predict results (S4 *Copy rule*; CX **Practice totals**).
- A **casino session** is real play you record yourself: game, start time, buy-ins and cash-out, optionally the casino's name, end time and table conditions. It uses the account's real currency, works offline, and is strictly private: never shared, published, compared or used in analytics or ads (S4 *Casino sessions*, stories 57–66; S4 Amendment 2 A2; CX **Casino session**).
- Casino sessions never show win/loss/push rates, drawdown, a departure log or a strategy link (S4 story 65).
- Counting challenge results score accuracy, and winnings never enter a skill score; Play challenge finances stay out of practice totals (S3 *Solution*; S4 story 54).

### Lesson progress

- A lesson keeps its place: Resume or Restart. Completion means finishing it, with no score, award or unlock (S3 *Progress*, story 19; D48).

## Builder

### Required coverage

"Builder (1): conditions, wagers/amounts, explanations, conflicts, fallbacks, stopping." (S3 *Inventory*; D48.) Help inside every editor screen opens this lesson, and it is always available offline (S4 *Builder lesson*, story 34; S3 Amendment 4 §5).

### Where and how you start

- More › Strategies holds the built-in strategies and your own **private strategies**. **Customize a strategy** (prominent) copies a built-in or saved strategy; **Start blank** is secondary (S4 *Solution*, stories 1–4; S4 Amendment 1 V).
- Customizing makes your own private copy and never changes the built-in. The copy records its source, and changes against the source are marked (S4 stories 4, 19; *Customize*).
- Creating and editing strategies is free and works offline (S4 story 8; S4 Amendment 3 §5).
- A strategy states its **declared table conditions** (blackjack rule preset; craps odds and field options and the limits its amounts assume; roulette wheel) (S4 *Strategy model*; CX).

### Conditions

- Craps and roulette rules are guided sentences, such as "When the point is on, place 6 and 8 for 12 each", grouped into **starting bets, conditions, adjustments and stopping rules** (S4 stories 9–10; D5).
- Conditions combine with **all of** or **any of** over the game situation, the count, active bets, outcomes and cycle profit or loss (S4 story 11; D5). The owner added "turns in this cycle" (S4 Amendment 2 B8).
- The count condition uses the actual Hi-Lo true count, never a count you entered (S4 *Conditions*; D5).
- Blackjack instead uses a decision chart, deviations and a bet schedule: start from the certified chart for a rule preset and edit decisions, with each changed cell marked and the reference action beside it (S4 *Solution*, stories 19–20).

### Wagers and amounts

- Amount adjustments: press, collect, regress, double after a loss, add a unit, each with an explicit cap (S4 story 14). Separate counters per bet, so a press on the 6 doesn't advance the 8 (S4 story 12). Editable progression lists, including Labouchere (S4 story 13).
- Bets that must go up together are marked as one group, placed completely or not at all (S4 story 15). If a group can't be fully funded, the whole action pauses: placing 12 each on 6 and 8 needs 24, and a balance of 20 never places just one (D5).
- Every amount is checked as you type against legal targets, increments, working/off rules and table limits. An invalid amount is explained and never rounded, resized or converted (S4 story 18; D5). Example: place 6/8 at 10 is refused, never rounded (S4 Seam 1 fixtures).
- A strategy without a cap or stop on a list or progression is reported as unbounded (S4 *Engine additions*).
- Each rule shows its own wager's house edge under the selected table rules; there is no strategy-level blended edge. "Changing bets or stakes doesn't remove the house edge" (S4 Amendment 1 P). Every progression template carries that statement (S4 Amendment 1 U).
- Templates: roulette has capped Martingale, three-win parlay and bounded Labouchere; craps has capped press-and-collect; each is copied with its caps (S4 Amendment 2 B10).

### Explanations

- A **generated description** in plain language is built from your rules and always kept in step with them. It is never edited or executed (S4 story 29; *Generated description*).
- **Situation preview**: pick an example situation and see the matching rule, what it prescribes, any fallback and the resulting counters. A short step-through sequence shows funding pauses, pending actions and final settlement, labelled "Illustration, not a result". The preview is free and records nothing (S4 stories 30–32; *Preview*; CX).
- The explanation records the situation, the matching instruction, the prescription, any fallback and the resulting strategy state; the executable instructions are authoritative (D5).
- **Strategy notes** are your own teaching notes on a rule, shown after a correction apart from the coach's explanation, never during a Check attempt, and they never change what the strategy does (S4 story 33, *Teaching notes*; S4 Amendment 1 T).

### Conflicts

- Two rules that prescribe different things for the same bet in the same situation are flagged. You resolve the conflict by marking which rule wins or by adding an exception; list order never decides (S4 story 25; D5). The design wording: "List order is for reading only. When two rules disagree about the same bet, you choose which one wins." (S4 Amendment 1 O.)
- Rules for separate bets may act together and are not flagged (S4 story 26).
- Conflict detection is conservative: rules are treated as overlapping unless the builder can prove their conditions never meet (for example "point is 6" and "point is 8", or "true count ≥ 2" and "≤ 1") (S4 *Engine additions*; S4 Amendment 2 B1).
- Blackjack deviations are built-in exceptions to the chart cell they modify, never conflicts (S4 Amendment 2 B1).
- Diagnostics show in place with a summary such as "2 conflicts, 1 incomplete rule" (S4 *Validation as you edit*). An unfinished draft is saved even with conflicts or gaps (S4 story 28).

### Defaults and fallbacks

- For situations your rules don't cover, craps and roulette default to **no new bets, existing bets kept** where legal; blackjack defaults to the selected preset's reference play. Defaults are visible and editable (S4 story 17, *Start blank*; D5).
- **Legal fallback**: for each blackjack action that might be unavailable, the strategy names an alternative, defaulting to the reference's validated fallback (S4 story 21; D5; CX).
- Following a prescribed deviation or a legal fallback counts as following the strategy (S4 Amendment 2 B7; CX **Strategy adherence**).
- A custom blackjack change is never presented as better play or higher profit; the editor shows the reference action labelled "Reference" and never "correct" (S4 story 22; S4 Amendment 1 N).

### Stopping

- Stopping rules are cycle-scoped: stop new bets when this cycle is up or down a set amount, or end the cycle when the list empties (S4 story 16; S4 Amendment 1 S). Example: "Stop new bets when this cycle is up 150 or down 200, whichever comes first" (S4 Amendment 1 S).
- Stopping new bets ends the **cycle**: outstanding wagers resolve, then a new cycle needs an explicit restart, and starting one never replenishes the balance (S4 Amendment 2 B8; CX **Strategy cycle**).
- No rule reads profit, loss or turns across cycles or since the session started (S4 Amendment 1 B2).
- **Strategy settlement**: when a cycle ends or you stop the strategy, legally removable wagers come back, then the contracts left on the table settle automatically; no new bets are placed (CX; S1 Amendment 10 §1).
- A settled win stays settled even when the next adjustment can't execute: the press waits as a **pending strategy action** (D5; CX).

### Saving and practising

- Edits autosave as a draft (the **working copy**). **Save revision** makes an immutable version, available only when the strategy is complete and conflict-free, with blocking problems listed (S4 stories 35–36; CX).
- **Test in practice** opens guided-practice setup with your latest saved revision; nothing starts or uses allowance until you press Start (S4 story 41; S4 Amendment 3 §2).
- An active session keeps the revision it started with; past sessions keep the revision they followed (S4 stories 37–38).
- During an unfinished Play Check attempt, blackjack strategy content in the builder is withheld; names stay visible (S4 Amendment 2 D; S4 Amendment 6 §5). The Builder lesson itself is not withheld (S3 Amendment 1 A2).

## Content rules applied (spec 3 gate 9, Amendment 1 C11)

- Original copy, with no profitability, readiness or predicted-result claims. The Builder lesson states that changing stakes doesn't remove the house edge, and that the preview is an illustration, not a result.
- Neither lesson cites Casino Quest or Blackjack Apprenticeship, so no implied endorsement arises.
- Tableside's own variants, caps and resets are labelled as Tableside's (for example, cycle-scoped stopping rules and capped templates).
- No external links, so there are no logos, thumbnails or players. The bundled `sources` list records provenance for spec 7's register.

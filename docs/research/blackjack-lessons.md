# Blackjack lessons: facts the copy may state

Research date: 2026-11-17. Evidence for [S3: Lessons — blackjack basics, the four modes and the bet schedule](https://github.com/0xRowdy/tableside/issues/152), under [spec 3 (#53)](https://github.com/0xRowdy/tableside/issues/53) and its amendments. It covers five lessons: blackjack basics, the four training modes and the optional bet schedule. **Lesson copy states only what this note records.** Anything under "Not confirmed" stays out of the copy.

## Summary

- **Rules, limits, modes, conversion and the bet schedule** come from the final Answer of [#3](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274). Funding comes from [#20](https://github.com/0xRowdy/tableside/issues/20#issuecomment-5564905959) and spec 1's amendments.
- **Every index number** comes from the certified files `indices_S17_final.csv` and `indices_H17_final.csv`, which the app ships byte for byte in [`reference-files.generated.ts`](../../packages/definitions/src/blackjack/reference-files.generated.ts). The [certified report at `ae3776d`](https://github.com/0xRowdy/tableside/blob/ae3776d151f5ebf35432abb4ce7ae1b0bd9b69c3/docs/research/blackjack-coaching-validation.md) explains them. No research-calculator output is used.
- **The spec's claims check out against Schlesinger.** Eleven S17 values are one true count above his published values, five of them only through the tie rule. They do **not** all hold against the BJA charts, which use running-count-sign rules and leave some cells blank. Under H17, one value (12 vs 6) is **two** counts from Schlesinger, as a rule difference. See [Deviations](#deviations).
- **Retrieval.** On 2026-11-17, Blackjack Apprenticeship's HTML pages returned HTTP 403 (a Cloudflare challenge) to both the fetch tool and curl. Their text below therefore comes from dated Internet Archive snapshots, labelled as such. The two BJA chart PDFs and both Wizard of Odds pages were fetched live on 2026-11-17.

## Basics

### Table rules (accepted, #3 Answer)

Quoted from [#3, "Answer" › "Blackjack rules and presets"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274):

> - Six decks, U.S. dealer hole-card/peek dealing, blackjack paying 3:2. Offer dealer H17/S17 and late-surrender on/off as four supported rule combinations. Default to S17 with late surrender enabled.
> - Double any initial two cards of an eligible hand, including after splitting; no double-for-less. Split equal values, including mixed ten-value ranks, up to four hands. Resplit non-aces. Split aces receive one card each, cannot be resplit or doubled, and finish as ordinary hands; split-hand 21 is not a natural blackjack.
> - Late surrender applies only to the original unsplit two-card hand, after any required peek excludes dealer blackjack. No surrender after a split, hit, or double.
> - Offer insurance against an ace before the peek, up to half the original initial wager, paying 2:1 on dealer blackjack. Settle it separately; subsequent surrender of the main hand is allowed if legal. Even money is the equivalent insurance choice for a natural.
> - Shoe penetration settings are 50/55/60/65/70/75/80%, default 75%; finish the round reaching the cut card before shuffling. Use no burn card. Reveal the dealer hole card at round end even if all player hands have finished.
> - Default to the learner alone against the dealer; allow zero through four additional simulated players. Additional players follow rule-specific basic strategy with fixed wagers.

The code matches these defaults: preset `S17_LS` and penetration 75 in [`rules.ts:8–9`](../../packages/definitions/src/blackjack/rules.ts). The dealer peeks when the up card is an ace or a ten-value card ([`blackjack.ts:406`](../../packages/engine/src/blackjack.ts), `peek()`: no peek unless the up card is an ace or rank ≥ 10). With an ace up, insurance is offered first and the peek follows it (same file, the deal step after `peek()`).

**Basic strategy is rule-specific.** Tableside's basic tables differ from Wizard of Odds' six-deck S17/H17 instructions in 0 of 330 cells. They differ from BJA's generic chart in 4 cells (S17 A,7 vs 2; H17 15 vs A, 8,8 vs A, A,8 vs 6), each explained by a rule-specific margin ([#15 resolution](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5675619578), "Basic strategy and fallbacks"). BJA itself says its basic chart is "based off of the more common 'H17 game'" and is "one basic strategy that is sufficiently effective against all numbers of decks" (BJA "Blackjack Strategy Charts", FAQ "Why are the strategy charts on this site different…", archive snapshot below).

### Turn phases

A turn runs in this order, per #3 (rules above) and [spec 1 (#51)](https://github.com/0xRowdy/tableside/issues/51), *Engine interface › Phases*:

1. **Bet.** The initial wager, within the table limits.
2. **Deal.** The learner and any other players get two cards each. The dealer gets one up card and one hole card.
3. **Insurance and peek.** With an ace up, insurance (or even money on a natural) is offered before the peek. With an ace or ten-value card up, the dealer peeks. A dealer blackjack ends the round. A negative peek reveals nothing about the hole card's rank (#3 Answer, "Blackjack modes, counts, and betting").
4. **Player actions.** Surrender (if late surrender is on and the hand is the original two cards, after the peek), split, double, hit, stand.
5. **Dealer.** The hole card is revealed, and the dealer hits or stands on soft 17 per the preset. The hole card is always revealed at round end.
6. **Settlement.** Automatic. The Phase Stepper shows **Settle** as a step that needs no tap ([spec 1 Amendment 1 §A row 12](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6256569082)).

The table's Phase Stepper labels are **Bet, Deal, Play, Settle** ([`BlackjackTable.tsx:77`](../../apps/mobile/src/play/BlackjackTable.tsx)).

Order of the player's own decision, as BJA teaches it: surrender first, then split, then double, then hit or stand. BJA "Blackjack Strategy Charts", section "Basic Strategy Has An Order Of Operations:" (subheadings "Can I/should I Surrender?", "Can I/Should I Split?", "Can I/Should I Double?", "Should I hit or should I stand?").

### Limits, base unit, bet selector and funding

- **Table limits:** blackjack initial wager 10 minimum, 1,000 maximum, per initial wager. Legal insurance, splits and doubles can raise total exposure above that ([#3 Answer](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274), limits table). The default base unit is 10: "Blackjack and roulette default strategy base units are 10 simulation currency units" (same comment). In code: [`rules.ts:18`](../../packages/definitions/src/blackjack/rules.ts).
- **Units:** amounts show as plain simulation currency units with no currency symbol ([spec 1 Amendment 1 §C](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6256569082)). Copy states stakes and caps as amounts, never as multiples of a base bet ([spec 1 Amendment 9 §7](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191)).
- **Bet selector:** "The bet selector ('bet list') is on every table. No action is long-press-only" ([spec 1 Amendment 1 §A row 7](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6256569082)). It controls the same session as the graphical table ([spec 1](https://github.com/0xRowdy/tableside/issues/51), stories 26–27). Insurance is a decision whose amount is chosen in its own panel, not a bet-list wager ([Amendment 9 §8](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191)). Component: [`BetSelector.tsx:51`](../../apps/mobile/src/play/bet-selector/BetSelector.tsx).
- **Practice funding:** each session gets a fresh, player-chosen buy-in. It starts at 1,000, can be edited to a positive whole amount, and the last amount is remembered per game. There is no shared wallet. The app checks that the buy-in covers the opening bets, and rebuys are explicit ([#20 Answer, "Funding by activity" and "Starting amounts and setup"](https://github.com/0xRowdy/tableside/issues/20#issuecomment-5564905959)). Default in code: `DEFAULT_BUY_IN = '1000'` in [`Funding.tsx:21`](../../apps/mobile/src/play/setup/Funding.tsx).
- **Other funding sources:** bankroll-limited guided practice uses the daily training bankroll (#20 Answer: "initially 500 under the accepted trial"). It has no buy-in field and no rebuys ([spec 1 Amendment 4 §B](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6259163413)). There is no player reset control at MVP; ending and starting again covers it ([spec 1 Amendment 11 §1](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6696026750)).
- **Results:** net result is final cash-out minus buy-in and all rebuys, and rebuys never erase drawdown (#20 Answer, "Financial results and drawdown").

### House edge per preset

| Preset | House edge (% of initial wager) |
| --- | --- |
| S17, late surrender (default) | 0.33 |
| S17, no surrender | 0.40 |
| H17, late surrender | 0.53 |
| H17, no surrender | 0.62 |

Source: `HOUSE_EDGE_PERCENT` in [`reference.ts:228`](../../packages/definitions/src/blackjack/reference.ts). Each value is the edge of the preset's certified basic strategy off the top of a fresh six-deck shoe. The test derives it from the certified `basic_<preset>.csv` values with exact six-deck card-removal probabilities ([`house-edge.test.ts`](../../packages/definitions/test/house-edge.test.ts); commit `1e350bc`, "Versioned house edge per preset, tested against a derivation from the certified basic tables and exact six-deck card removal"). The display rule: "shown as a property of the rules, never as a prediction of results" ([spec 1 Amendment 1 §B](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6256569082)). The method is [Amendment 9 §1](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191). No amendment comment states the four numbers.

**Published comparison** (Amendment 9 §1), retrieved 2026-11-18 from the [Wizard of Odds Blackjack House Edge Calculator](https://wizardofodds.com/games/blackjack/calculator/) with six decks, 3 to 2, player loses only the original bet to a dealer blackjack, double on any first two cards, double after split, resplit to four hands, no resplitting or hitting split aces:

| Preset | Basic strategy, continuous shuffler (fresh shoe) | Basic strategy, cut card | Tableside |
| --- | --- | --- | --- |
| S17, late surrender | 0.33361% | 0.35361% | 0.33 |
| S17, no surrender | 0.40622% | 0.42622% | 0.40 |
| H17, late surrender | 0.53051% | 0.55051% | 0.53 |
| H17, no surrender | 0.61873% | 0.63873% | 0.62 |

All four are within 0.01 points of the fresh-shoe column. `BLACKJACK_HOUSE_EDGE_SOURCE` in `reference.ts` cites it and `house-edge.test.ts` checks it. Other tables, same calculator and column: S17 with late surrender is 0.16624% in the player's favour with one deck, 0.14116% with two, 0.28622% with four, 0.31457% with five and 0.35704% with eight; with 6 to 5 blackjack at six decks it is 1.6933%. The Basics lesson states that fewer decks lower the edge and 6 to 5 raises the default table's to 1.69%.

### App behaviour the lessons describe

Recorded by the #152 implementer from the shipped code and the decisions above, 2026-11-17:

- **Placing a bet:** the table has chip buttons, a betting spot, **Clear**, **Rebet <amount>** (the last bet, once one exists) and **Deal** (`BettingActions` and `Felt` in [`BlackjackTable.tsx`](../../apps/mobile/src/play/BlackjackTable.tsx)). It also has the bet selector, labelled "bet list" (above).
- **Setup shows the house edge:** "House edge with basic strategy: N%" in setup ([`BlackjackSetup.tsx:190`](../../apps/mobile/src/play/BlackjackSetup.tsx)), and "Edge with basic strategy: N% (this preset)" on the table ([`BlackjackTable.tsx:141`](../../apps/mobile/src/play/BlackjackTable.tsx)).
- **Basic strategy against Wizard, all four presets:** "Total-dependent basic strategy for all four presets: 0 of 330 cells differ from Wizard's six-deck S17/H17 instructions" ([#15 progress, 2026-09-14](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5673250904)), accepted as validated in the [#15 resolution](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5675619578) ("0 of 330 cells differ from Wizard of Odds six-deck instructions").
- **Fallbacks are graded as the right play:** the accepted fallback policy "uses a strategy's explicit legal alternative, or the built-in reference's validated alternative when none is specified, and assesses adherence against the applicable fallback", including actions unavailable because of balance ([#15, quoting #5's resolution](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5556796074)). Spec 3 grades "including legal fallbacks for unaffordable or unavailable actions" (*Scoring and review*, Reference bullet). The certified cells used as examples: `basic_S17_LS.csv` hard 16 vs 10 is R; hard 11 vs 6 is D with `fallback_double` H; soft 18 vs 3 is D with `fallback_double` S.
- **Insurance under basic strategy:** declined ([coverage research](blackjack-coaching-coverage.md), "For basic mode, insurance/even money is declined under the published basic policy").
- **Bet schedule check timing:** "Tableside checks each bet against the schedule before the deal" (setup help, [`BlackjackSetup.tsx:137`](../../apps/mobile/src/play/BlackjackSetup.tsx)).

## Four modes

### Who supplies the count (#3)

| Mode | Playing policy | Count responsibility |
| --- | --- | --- |
| Basic | Rule-specific basic strategy | No maintained count required |
| Basic with deviations | Basic plus the selected deviation curriculum | App supplies the relevant count/condition |
| Counting with basic | Rule-specific basic strategy | Player maintains the count |
| Counting with deviations | Basic plus the selected deviation curriculum | Player maintains the count |

Quoted from [#3 Answer, "Blackjack modes, counts, and betting"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274). Hi-Lo is the counting system, accepted in [#3, "Launch catalog and blackjack modes accepted"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315457). The curriculum is the Illustrious 18 situations plus the Fab 4 surrender situations, the latter only with late surrender on (#3 Answer). The [#11 Answer](https://github.com/0xRowdy/tableside/issues/11#issuecomment-5556317572) records why the modes separate playing policy, count responsibility and optional betting.

In code, `BlackjackPlayPolicy.count` is `'none' | 'supplied' | 'player'` ([`blackjack-strategy.ts:57`](../../packages/engine/src/blackjack-strategy.ts)). It maps Basic → `none`, Basic with deviations → `supplied`, and both counting modes → `player` ([`strategies.ts:75`](../../packages/definitions/src/blackjack/strategies.ts)). The engine refuses a supplied count without deviations: "Tableside supplies the count only for deviations" ([`blackjack-strategy.ts:239`](../../packages/engine/src/blackjack-strategy.ts)).

**What Basic with deviations shows.** When the count is supplied, the engine's view carries the reference count and the deviation list; otherwise both are null or empty ([`blackjack.ts:827–828`](../../packages/engine/src/blackjack.ts)). The table's count panel ([`BlackjackTable.tsx:299`](../../apps/mobile/src/play/BlackjackTable.tsx)) shows:

- the label "COUNT SUPPLIED IN THIS MODE";
- "True count ±N";
- the working, "Running ±R · D decks left · ±R ÷ D = ±N" ([`blackjack-coaching.ts:89`](../../apps/mobile/src/play/blackjack-coaching.ts));
- between rounds only, "Deviation at this count: …" and "Next: <situation> at ±T".

The setup help text for the four modes is in [`blackjack-text.ts:20`](../../apps/mobile/src/play/blackjack-text.ts). For example, Basic with deviations reads "Adds index plays. Tableside shows you the count."

**Counting modes during play.** "Corrections never state the true count during play; they name the rule or band. After the practice session ends, the departure log on the result screen shows the actual count beside each blackjack entry" ([spec 1 Amendment 9 §3](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191); `strategyView` in [`blackjack.ts:931`](../../packages/engine/src/blackjack.ts) strips the count unless it is supplied). In guided practice a move that departs from the strategy pauses before it executes, explains the prescribed action, and offers retry or an explicit override ([spec 1](https://github.com/0xRowdy/tableside/issues/51), *Solution*). A deviation the strategy prescribes is adherent; a departure is the player leaving the strategy ([spec 1 Amendment 8](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6281729637)).

### Hi-Lo and the count conventions

- **Tags:** 2–6 = +1; 7–9 = 0; 10, J, Q, K, A = −1. Sources: BJA "How to Count Cards", "Step 1: Assign A Value To Every Card" ("2-6 = +1 / 7-9 = 0 / 10-Ace= -1"); Wizard "How it Works" › "High-Low Point Values"; engine `hiLoTag` ([`blackjack.ts:298`](../../packages/engine/src/blackjack.ts)).
- **Exposed cards only:** "Count cards only when exposed, recomputing at each decision. A concealed dealer card is excluded until revealed; a negative peek does not reveal its rank" ([#3 Answer](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274)). The engine removes the unrevealed hole card from the count ([`shoeCount`, `blackjack.ts:300`](../../packages/engine/src/blackjack.ts)). BJA, "Step 2: The Running Count": "Keep A Running Count By Adding Or Subtracting Every Card That You See In Each Shoe."
- **Recount at the decision:** BJA, "What are Blackjack Deviations?", section "'When do you perform deviations?'": "Even if you just calculated the true count for your betting decision, you will need to calculate it again when it's your playing decision because the running count has likely changed."
- **Conversion (#3 Answer):** decks remaining are estimated from the cards physically in the shoe, to the nearest half deck, ties upward, minimum 0.5. The true count is the running count divided by that, truncated toward zero: +7/2 → +3 and −7/2 → −3. "Use the same integer true count for betting guidance." In code: `halfDecksLeft` and `trueCount` ([`blackjack.ts:309–311`](../../packages/engine/src/blackjack.ts)).
- **How other sources' examples compare:** BJA "Step 3" gives "Running Count is -7 and we have 2 decks remaining, our True Count is -3. (-7 ÷ 2)", which agrees with truncation. Wizard "How it Works", Step 3, gives "7/4 = 1.75 … Round that up to 2, to keep it simple." Under Tableside's rule, +7 with 4 decks left is +1 (arithmetic from the #3 rule).

## Deviations

### The teaching rules in plain terms

Quoted from [#15, "Accepted generation methodology and teaching policy"](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5674497837):

- **Teaching continuation (Q19):** "candidate actions are valued assuming the learner continues with the taught total-dependent table for later decisions and split hands." Plain terms: Tableside measures each index play assuming you finish the hand the way the lesson teaches, by hand total, rather than with perfect card-by-card play.
- **Tie rule (Q20):** "ties within tolerance resolve toward the basic action that adds no wager; no running-count sign exceptions inside the zero bin." Plain terms: when the index play and the basic play are worth the same within the tolerance, Tableside keeps the basic play. A tie at a published threshold therefore moves Tableside's threshold up one count. The report says this "is a no-benefit argument, not a bankroll-risk argument" ([report, "3. Tie handling"](https://github.com/0xRowdy/tableside/blob/ae3776d151f5ebf35432abb4ce7ae1b0bd9b69c3/docs/research/blackjack-coaching-validation.md)).
- **Tolerance (Q21):** "0.001 of the original bet; an index bin is decisive only beyond max(0.001, 2 SE)." Plain terms: a difference smaller than a thousandth of the bet, or smaller than twice its measurement error, counts as a tie.
- **What is taught (Q22):** "True Count teaches its own generated thresholds under the accepted half-deck truncated true-count convention. Where a taught value differs from the published Illustrious 18 / Fab 4 or BJA chart value, lessons and correction explanations state the difference and why."
- **Objective:** the action with the highest expected net return per original bet, never a lower-return action chosen to reduce swings ([#15, 2026-09-09](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5594824363)).
- **Spec wording ([#53 Amendment 1 B2](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716)):** "The reasons are the teaching-continuation rule (Q19) and the tie rule (Q20). State that five of the eleven S17 one-count differences arise only from the tie rule and cost nothing measurable, so the copy never implies the published values are wrong." [Amendment 2 §3](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256569510) adds for the lesson player: "give the reasons for the taught-vs-published difference, and cite the source."
- **Report phrasing for the tie-only rows** ([report, "Reading the differences (teaching policy, Q22)"](https://github.com/0xRowdy/tableside/blob/ae3776d151f5ebf35432abb4ce7ae1b0bd9b69c3/docs/research/blackjack-coaching-validation.md)): "lessons should present these as 'the published value is equally good here; True Count keeps the basic action because the gain is inside the tolerance'". Read "True Count" as Tableside ([spec 1 Amendment 1 §A row 1](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6256569082)).

### Reading the numbers

- **Tableside's direction** (CSV `direction`, report "Final curriculum thresholds"):
  - `deviate_at_or_above`: play the deviation at TC ≥ threshold, and the basic action below it.
  - `basic_at_or_above`: keep the basic action at TC ≥ threshold, and depart below it. Example: S17 12 vs 5 is "stand (basic) at TC ≥ −1, hit below".
- **Cost:** "the expected loss per original bet, in each bin where the published value differs, from following the published value; a **negative** cost means the published action is better in that bin but inside the tie zone" (same section). Format: `bin: cost ± SE`, as a fraction of the original bet.
- **Schlesinger (Wizard of Odds):** "The player should stand/double/split if the True Count equals or exceeds the Index Number, otherwise hit." "The player should surrender if the True Count equals or exceeds the Index Number." "The player should take insurance if the True Count is +3 or greater." (Wizard, "How it Works", text under the "Illustrious 18" and "Fab 4 Surrenders" tables.)
- **BJA chart legend** (both PDFs, verbatim):
  - "Red Numbers indicate the index that the true count must meet to deviation from basic strategy"
  - "'+' after the index number indicates the deviation happens at that true count and above"
  - "'-' after the index number indicates the deviation happens at the true count and below"
  - "0- indicates the deviation happens at any negative running count"
  - "0+ indicates the deviation occurs at any positive running count"

  So BJA's "13 vs 2: -1-" (hit at −1 and below) means stand at 0 and above. Schlesinger's "13 vs 2: −1" means stand at −1 and above. The CSV column `bja_rule_specific_tc` records BJA's entry as Tableside-style integers. It is blank where BJA uses a running-count-sign rule (0+ / 0−) or prints no index.

### S17 (S17 presets; Fab 4 rows only with late surrender)

From `indices_S17_final.csv`, dumped from `REFERENCE_FILES` on 2026-11-17. Values match the report's S17 table and the [#15 resolution](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5675619578).

| Situation | Taught (Tableside rule) | Schlesinger | BJA S17 chart | Diff vs Schlesinger | Diff vs BJA | Cost per bet at published value | Kind of difference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16 vs T | stand at ≥ 1, else hit | +0 | 0+ | 1 | — (RC-sign rule) | +0: +0.0000 ± 0.0008 | Tie rule only |
| 15 vs T | stand at ≥ 4, else hit | +4 | 4+ | 0 | 0 | — | Same |
| T,T vs 5 | split at ≥ 5, else stand | +5 | 5+ | 0 | 0 | — | Same |
| T,T vs 6 | split at ≥ 5, else stand | +4 | 4+ | 1 | 1 | +4: +0.0188 ± 0.0026 | **Decisive, material** |
| 10 vs T | double at ≥ 4, else hit | +4 | 4+ | 0 | 0 | — | Same |
| 12 vs 3 | stand at ≥ 2, else hit | +2 | 2+ | 0 | 0 | — | Same |
| 12 vs 2 | stand at ≥ 4, else hit | +3 | 3+ | 1 | 1 | +3: +0.0013 ± 0.0012 | Tie rule only |
| 11 vs A | double at ≥ 1, else hit | +1 | 1+ | 0 | 0 | — | Same |
| 9 vs 2 | double at ≥ 1, else hit | +1 | 1+ | 0 | 0 | — | Same |
| 10 vs A | double at ≥ 4, else hit | +4 | 4+ | 0 | 0 | — | Same |
| 9 vs 7 | double at ≥ 4, else hit | +3 | 3+ | 1 | 1 | +3: +0.0011 ± 0.0010 | Tie rule only |
| 16 vs 9 | stand at ≥ 5, else hit | +5 | 4+ | 0 | 1 | BJA +4: +0.0032 ± 0.0018 | Same as Schlesinger; tie vs BJA |
| 13 vs 2 | stand (basic) at ≥ 0, hit below | −1 | −1− | 1 | 0 | −1: +0.0072 ± 0.0010 | Decisive |
| 12 vs 4 | stand (basic) at ≥ 1, hit below | 0 | 0− | 1 | — (RC-sign rule) | +0: +0.0011 ± 0.0005 | Decisive (most fragile) |
| 12 vs 5 | stand (basic) at ≥ −1, hit below | −2 | S (no index) | 1 | — | −2: +0.0126 ± 0.0007 | **Decisive, material** |
| 12 vs 6 | stand (basic) at ≥ 0, hit below | −1 | S (no index) | 1 | — | −1: +0.0044 ± 0.0009 | Decisive |
| 13 vs 3 | stand (basic) at ≥ −2, hit below | −2 | S (no index) | 0 | — | — | Same |
| 14 vs T surrender | surrender at ≥ 4, else basic | +3 | (none) | 1 | — | +3: −0.0014 ± 0.0009 | Tie rule only |
| 15 vs T surrender | surrender (basic) at ≥ 0, basic below | +0 | 0− | 0 | — (RC-sign rule) | — | Same |
| 15 vs 9 surrender | surrender at ≥ 3, else basic | +2 | 2+ | 1 | 1 | +2: −0.0007 ± 0.0007 | Tie rule only |
| 15 vs A surrender | surrender at ≥ 2, else basic | +1 | 2+ | 1 | 0 | +1: +0.0020 ± 0.0008 | Decisive |
| Insurance | insure at ≥ 3, else decline | +3 | 3+ | 0 | 0 | — | Same |

Counts, from the CSV and stated in the report:

- **Ten S17 situations plus insurance match Schlesinger.** These are 15 vs T, T,T vs 5, 10 vs T, 12 vs 3, 11 vs A, 9 vs 2, 10 vs A, 16 vs 9, 13 vs 3 and 15 vs T surrender.
- **Eleven are exactly one true count higher.**
- **Five of the eleven differ only through the tie rule:** 16 vs T, 12 vs 2, 9 vs 7, 14 vs T surrender and 15 vs 9 surrender. Each cost lies inside max(0.001, 2 SE); the two negative costs mean the published play is nominally better inside the tie zone.
- **Six are decisive:** T,T vs 6, 12 vs 5, 13 vs 2, 12 vs 6, 15 vs A surrender and 12 vs 4.
- **"Only T,T vs 6 and 12 vs 5 are material"** ([#15 resolution](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5675619578)). That comment rounds 0.0188 to 0.019.
- **12 vs 4 is the most fragile value.** It "clears the tolerance by 0.0001". The 50%, 80% and four-player stability runs gave 0; under the accepted default configuration it is 1 (report, "Reading the differences").
- **Against the BJA S17 chart,** the only numeric difference beyond those rows is 16 vs 9: "BJA 4+; the +4 bin is a tie". BJA's 0+ (16 vs T) and 0− (12 vs 4) "are not integer thresholds" (same paragraph).

Composition note authors may use: in the 16 vs T zero bin, multi-card and post-split 16s stand profitably (+0.0039 ± 0.0016) while two-card 16s hit (−0.0037). The all-occurrence bin is an exact tie, resolved toward hitting, so the taught value stays +1. Report, "Multi-card occurrences (final pass)": "lesson authors may state the composition effect."

### H17 (H17 presets; Fab 4 rows only with late surrender)

From `indices_H17_final.csv`. Its `schlesinger` column holds the same published values as the S17 file; the report heads that column "Schlesinger (S17 list)".

| Situation | Taught (Tableside rule) | Schlesinger | BJA H17 chart | Diff vs Schlesinger | Diff vs BJA | Cost per bet at published value | Kind of difference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16 vs T | stand at ≥ 1, else hit | +0 | 0+ | 1 | — | +0: +0.0000 ± 0.0008 | Tie rule only |
| 15 vs T | stand at ≥ 4, else hit | +4 | 4+ | 0 | 0 | — | Same |
| T,T vs 5 | split at ≥ 5, else stand | +5 | 5+ | 0 | 0 | — | Same |
| T,T vs 6 | split at ≥ 4, else stand | +4 | 4+ | 0 | 0 | — | Same (S17 is 5) |
| 10 vs T | double at ≥ 4, else hit | +4 | 4+ | 0 | 0 | — | Same |
| 12 vs 3 | stand at ≥ 2, else hit | +2 | 2+ | 0 | 0 | — | Same |
| 12 vs 2 | stand at ≥ 3, else hit | +3 | 3+ | 0 | 0 | — | Same (S17 is 4) |
| 11 vs A | double (basic) at ≥ 0, hit at ≤ −1 | +1 | D (no index) | −1 (rule) | — | +0: +0.0125 ± 0.0008; BJA never hits: −1: +0.0163 ± 0.0010 | Rule difference |
| 9 vs 2 | double at ≥ 1, else hit | +1 | 1+ | 0 | 0 | — | Same |
| 10 vs A | double at ≥ 3, else hit | +4 | 3+ | −1 (rule) | 0 | +3: +0.0196 ± 0.0008 | Rule difference |
| 9 vs 7 | double at ≥ 4, else hit | +3 | 3+ | 1 | 1 | +3: +0.0011 ± 0.0010 | Tie rule only |
| 16 vs 9 | stand at ≥ 5, else hit | +5 | 4+ | 0 | 1 | BJA +4: +0.0032 ± 0.0018 | Tie vs BJA |
| 13 vs 2 | stand (basic) at ≥ −1, hit below | −1 | −1− | 0 | −1 | BJA hits at −1: +0.0001 ± 0.0010 | Tie vs BJA |
| 12 vs 4 | stand (basic) at ≥ 0, hit below | 0 | 0− | 0 | — | — | Same (S17 is 1) |
| 12 vs 5 | stand (basic) at ≥ −1, hit below | −2 | S (no index) | 1 | — | −2: +0.0103 ± 0.0007 | Decisive |
| 12 vs 6 | stand (basic) at ≥ −3, hit below | −1 | S (no index) | **−2** (rule) | — | −3: +0.0032 ± 0.0009; −2: +0.0165 ± 0.0008 | Rule difference, two counts |
| 13 vs 3 | stand (basic) at ≥ −2, hit below | −2 | S (no index) | 0 | — | — | Same |
| 14 vs T surrender | surrender at ≥ 4, else basic | +3 | (none) | 1 | — | +3: −0.0014 ± 0.0009 | Tie rule only |
| 15 vs T surrender | surrender (basic) at ≥ 0, basic below | +0 | 0− | 0 | — | — | Same |
| 15 vs 9 surrender | surrender at ≥ 3, else basic | +2 | 2+ | 1 | 1 | +2: −0.0007 ± 0.0007 | Tie rule only |
| 15 vs A surrender | surrender (basic) at ≥ 0, hit at ≤ −1 | +1 | −1+ | −1 (rule) | 1 | Schlesinger +0: +0.0106 ± 0.0005; BJA −1: +0.0023 ± 0.0009 | Rule difference; decisive vs BJA |
| Insurance | insure at ≥ 3, else decline | +3 | 3+ | 0 | — | — | Same |

**How H17 differs from Tableside's S17 values** ([#15 resolution](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5675619578)): "H17 differs only in: T,T vs 6 split ≥ 4; 12 vs 2 stand ≥ 3; 11 vs A basic double, hit at ≤ −1; 10 vs A double ≥ 3; 13 vs 2 stand ≥ −1; 12 vs 4 stand ≥ 0; 12 vs 6 stand ≥ −3; 15 vs A basic surrender, hit at ≤ −1." The CSV agrees on all eight.

The report says: "Schlesinger's list is a six-deck S17 list, so its H17 differences (11 vs A, 10 vs A, 12 vs 6, 15 vs A) are rule differences, not disagreements." It also notes the BJA H17 differences: 11 vs A ("BJA doubles at every count; hitting at TC ≤ −1 gains 0.0163 ± 0.0010"), 15 vs A surrender ("BJA '−1+' surrenders one count earlier at a cost of 0.0023 ± 0.0009"), 13 vs 2 ("a +0.0001 tie"), 16 vs 9 and 9 vs 7 ("+0.0011 tie").

The other H17 differences from Schlesinger are the same tie-only rows as S17 (16 vs T, 9 vs 7, 14 vs T, 15 vs 9) plus 12 vs 5 (decisive, +0.0103 ± 0.0007). The report's prose sentence "Under H17 the differences from Schlesinger's S17 list are rule differences" covers only the four rows it labels "(rule)".

### Copy must not imply the published values are wrong

Sources for this rule: [#53 Amendment 1 B2](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716), and [#47](https://github.com/0xRowdy/tableside/issues/47#issuecomment-5669433821) ("If a source's teaching differs, record the difference and validate the applicable True Count behavior"). The supported reasons for a difference are:

- the tie rule;
- the teaching-continuation rule;
- Tableside's own count convention and game: half-deck truncation, shoe-only divisor, and the default six-deck 75% penetration state distribution (#15 Q18);
- for H17 rows, the dealer rule.

No source here says why Schlesinger or BJA chose their numbers, so copy must not guess.

### BJA chart indices Tableside does not teach

Transcribed from the live PDFs on 2026-11-17. These are outside the I18/F4 curriculum; copy may say only that BJA's charts carry more index plays than Tableside teaches.

- **S17 chart:**
  - T,T vs 4: 6+
  - A,8 vs 4: 3+; A,8 vs 5: 1+; A,8 vs 6: 1+
  - A,6 vs 2: 1+
  - 8 vs 6: 2+
  - surrender 16 vs 8: 4+; surrender 16 vs 9: −1−
- **H17 chart:**
  - T,T vs 4: 6+
  - A,8 vs 4: 3+; A,8 vs 5: 1+; A,8 vs 6: 0−
  - A,6 vs 2: 1+
  - 8 vs 6: 2+
  - 16 vs A: 3+; 15 vs A: 5+
  - surrender 16 vs 8: 4+; surrender 16 vs 9: −1−
  - 17 vs A is printed SUR
- **Both charts:** "INSURANCE OR EVEN MONEY: TAKE AT 3+".

## Bet schedule

**The schedule.** Quoted from [#3 Answer](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274), accepted earlier in ["Blackjack shoe and introductory bet schedule accepted"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315923):

| Integer true count | Bet in base units | Amount at the default base of 10 |
| --- | --- | --- |
| Below +1 | 1 | 10 |
| +1 | 2 | 20 |
| +2 | 4 | 40 |
| +3 | 6 | 60 |
| +4 or higher | 8 | 80 |

**Rules that come with it:**

- **The count it uses:** "Use the same integer true count for betting guidance" (#3 Answer). That is the half-deck, truncated-toward-zero count.
- **Not a bankroll claim:** "This is a practice schedule, not an optimal-bankroll claim" (#3 Answer).
- **When it is available:** "Fixed bets are the default. Optional betting practice is available alongside either counting mode, using the following schedule and separate adherence scoring." The code refuses the schedule with a non-counting mode ([`strategies.ts:129`](../../packages/definitions/src/blackjack/strategies.ts)). The amounts column is `BET_SCHEDULE` ([`strategies.ts:31`](../../packages/definitions/src/blackjack/strategies.ts)).
- **Amounts, not units:** Amendment 9 §7 requires player copy to state stakes as amounts ("cap of 320"), not multiples of a base bet. So the lesson shows 10/20/40/60/80 at base 10. See Not confirmed on the spec's "1/2/4/6/8 units" wording.

**Scored separately.** [Spec 3 (#53) body](https://github.com/0xRowdy/tableside/issues/53), *Scoring and review (engine; from #4 and #20)*, Metrics bullet:

> **Metrics:** card values, running count, true count, playing adherence (Play), betting adherence (Play with bet schedule). Each is exact first-answer correct/total. A metric with zero opportunities is **N/A**, never 100%. There is no partial credit and no blended skill-and-winnings score.

- **Spec 3, *Lessons and worked examples*:** "The bet-schedule lesson covers 1/2/4/6/8 units by true count and keeps betting adherence separate from playing adherence and counting accuracy."
- **Spec 1 practice records:** "adherence measures (playing / counting / betting kept separate)" ([#51](https://github.com/0xRowdy/tableside/issues/51), *Completed practice session record*).
- **Overrides:** a legal betting override "scores as a betting-adherence miss" ([#53 Amendment 1 C4](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716)).

**What the published sources say about betting:**

- **Wizard,** "How it Works", Step 4: "The greater the true count, the more you should bet." The page gives no count-to-bet ramp.
- **BJA,** "Step 4: Change Your Bets As The True Count Rises And Falls": "you have to raise your bets as the true count rises." It gives no ramp.
- **BJA deviations page:** your bet spread "should be mathematically calculated from a betting software or through Bankroll Coaching".

Neither source gives Tableside's 1/2/4/6/8 schedule, so it is Tableside's own variant and must be labelled that way (C11 below).

## Content rules

From [#47 resolution](https://github.com/0xRowdy/tableside/issues/47#issuecomment-5669433821) and [#53 Amendment 1 C11](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716) ("Gate 9 adds #47's content rules"):

- "never imply Casino Quest or BJA authored or approved the catalog";
- "clearly label True Count's own variants, caps and resets" (Tableside's own here: the generated thresholds, the 1/2/4/6/8 schedule, the conversion convention);
- "cite the exact page, section or video timestamp, never a whole channel";
- "external sources appear as text links only, with no logos, thumbnails or preloaded players";
- "credits are bundled for offline reading".

From #47 directly:

- BJA content is "Reference-only unless item-specific reuse rights are established", and its terms "restrict copying/commercial derivative use" ([BJA terms](https://www.blackjackapprenticeship.com/terms-of-use/)).
- "Wizard's permission to reprint Schlesinger's material does not establish a downstream license to True Count."
- Write original explanations and chart presentation. "Attribution is not a substitute for missing permission."

From the [spec 3 body](https://github.com/0xRowdy/tableside/issues/53), *Lessons and worked examples*: "No lesson claims profitability, readiness or predicted casino results." Gate 9 also requires "sources cited; provenance in spec 7's register".

Consequences for this copy:

- Do not restate BJA's "Bonus Tip" claim that each true count moves the house edge by half a percent, or other edge and winnings claims ("How to Count Cards", "Bonus Tip").
- Do not reproduce BJA's chart layout.
- Name individual published values only as comparisons, citing their source.

## Citable sources

Ready for `LessonSource { citation, url }` ([`lessons.ts`](../../packages/definitions/src/lessons.ts) requires an https URL or null). All retrieved 2026-11-17.

```ts
[
  { citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, tables “Illustrious 18” and “Fab 4 Surrenders” (from Don Schlesinger, Blackjack Attack, 2004 ed., p. 62, republished with permission)', url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/' },
  { citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, table “High-Low Point Values”', url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/' },
  { citation: 'Michael Shackleford, Wizard of Odds, “4-Deck to 8-Deck Blackjack Strategy”, section “Basic Strategy in Text”', url: 'https://wizardofodds.com/games/blackjack/strategy/4-decks/' },
  { citation: 'Blackjack Apprenticeship, “S17 Deviation Chart” (PDF, © 2018), sections “Pair Splitting”, “Hard Totals”, “Late Surrender” and “Insurance or Even Money”', url: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_S17.pdf' },
  { citation: 'Blackjack Apprenticeship, “H17 Deviation Chart” (PDF, © 2018), sections “Pair Splitting”, “Hard Totals”, “Late Surrender” and “Insurance or Even Money”', url: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf' },
  { citation: 'Blackjack Apprenticeship, “How To Count Cards”, sections “Step 1: Assign A Value To Every Card”, “Step 2: The Running Count” and “Step 3: Calculate A “True Count” Or Count Per Deck”', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  { citation: 'Blackjack Apprenticeship, “How To Count Cards”, section “Step 4: Change Your Bets As The True Count Rises And Falls”', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  { citation: 'Blackjack Apprenticeship, “What are Blackjack Deviations?”, sections “So what are blackjack deviations?” and “When do you perform deviations?”', url: 'https://www.blackjackapprenticeship.com/blackjack-deviations/' },
  { citation: 'Blackjack Apprenticeship, “Learn Blackjack Strategy” (Blackjack Strategy Charts), section “Basic Strategy Has An Order Of Operations:”', url: 'https://www.blackjackapprenticeship.com/blackjack-strategy-charts/' },
  { citation: 'Tableside certified blackjack coaching reference, indices_S17_final.csv and indices_H17_final.csv (frozen 2026-09-14, manifest 9892826d)', url: null },
]
```

Retrieval detail:

- **Wizard pages (live).**
  - Hi-Lo page: "Written by: Michael Shackleford", "Last updated: Aug 03, 2026". Footnote 2 reads "Blackjack Attack by Don Schlesinger, page 62, 2004 ed."; its "Acknowledgments" section thanks Schlesinger "for his permission to reprint the Illustrious 18 and Fab 4 tables from his book, Blackjack Attack".
  - 4–8 deck page: "Last updated: Nov 17, 2026".
- **BJA PDFs (live):** HTTP 200. The printed titles are "S17 DEVIATION CHART" and "H17 DEVIATION CHART", with "© Blackjack Apprenticeship 2018".
- **BJA HTML pages:** HTTP 403 live, so the text comes from these Internet Archive snapshots:
  - [How To Count Cards, 2026-10-14](https://web.archive.org/web/20261014105044/https://www.blackjackapprenticeship.com/how-to-count-cards/)
  - [What are Blackjack Deviations?, 2026-10-24](https://web.archive.org/web/20261024011408/https://www.blackjackapprenticeship.com/blackjack-deviations/)
  - [Blackjack Strategy Charts, 2026-11-10](https://web.archive.org/web/20261110145028/https://www.blackjackapprenticeship.com/blackjack-strategy-charts/)
  - [Blackjack Training Drills, 2026-10-12](https://web.archive.org/web/20261012063820/https://www.blackjackapprenticeship.com/blackjack-training-drills/)

  The charts page now links basic-strategy PDFs under `/wp-content/uploads/2024/09/` (`S17-Basic-Strategy.pdf`, `H17-Basic-Strategy.pdf`), not the 2019 deviation charts. Those were not read. The drills page ("Free Blackjack Trainer") lists a Basic Strategy Drill and a Card Counting Drill and has nothing the five lessons need.
- **Videos:** the deviations page embeds "What Are Blackjack Deviations?" (`youtube.com/watch?v=PkXzQCy5zgI`) and "How Important Are Card Counting Playing Deviations?" (`youtube.com/watch?v=tOEgqrwxVW0`). Neither was watched, so no claim or timestamp is recorded from them.

## Not confirmed

- **BJA pages were not fetched live.** Their HTML returned 403 (Cloudflare) on 2026-11-17, and the quotes come from the archive snapshots above, dated 2026-10-12 to 2026-11-10. Recheck in a browser before release.
- **No BJA video and no timestamp was verified,** including "who keeps the count" and bet-spread videos. Do not cite any.
- **The rules behind Schlesinger's numbers.** The Wizard page does not state the rules or decks for the Illustrious 18 / Fab 4 tables. Its "Six decks / Dealer stands on soft 17 / … resplit to four hands, including aces" list belongs to the page's simulation-statistics table. The report's statement that "Schlesinger's list is a six-deck S17 list" has no source in this note. Copy should not say what rules Schlesinger assumed, nor call the H17 differences "rule differences" as a fact about Schlesinger.
- **The edition behind Wizard's citation.** Wizard cites "2004 ed." and "page 62" with no publisher or edition number. This note records nothing beyond that.
- ~~**No published figure backs the house-edge numbers.**~~ Resolved 2026-11-18: see the published comparison under House edge per preset.
- **"1/2/4/6/8 units" against Amendment 9 §7.** Spec 3's bet-schedule wording uses units; spec 1 Amendment 9 §7 says copy never states stakes as multiples of a base bet. Which wording the lesson uses is an owner call. This note supplies both forms.
- **BJA deviations-page prose against its own chart.** The page says to stand 12 v 2 "anytime above true 3", while the chart prints "3+" (at 3 and above). Cite the chart, not the prose, for the number.
- **Why BJA uses running-count-sign rules,** and why some cells (12 vs 5, 12 vs 6, 13 vs 3, 14 vs T surrender) carry no index. No source here explains either.

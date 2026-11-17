# Counting lessons: facts the copy may state

Research date: 2026-11-17. Evidence for [S3: Lessons — card values, running count, conversion and table counting (#153)](https://github.com/0xRowdy/tableside/issues/153), under [spec 3 (#53)](https://github.com/0xRowdy/tableside/issues/53) and its Amendments 1–5. It covers four lessons: **card values**, **running count**, **true-count conversion** and **table counting**. **Lesson copy states only what this note records.** Anything under "Not confirmed" stays out of the copy.

This note extends [blackjack-lessons.md](blackjack-lessons.md) (#152) and does not repeat it. That note already records the Hi-Lo tags, the exposed-cards-only rule, the #3 conversion rule, the index tables, the content rules and the BJA retrieval situation. Quotes taken from it are linked, not re-derived.

## Summary

- **Decisions:** challenge content, checkpoints and assistance come from [#4 Answer](https://github.com/0xRowdy/tableside/issues/4#issuecomment-5556317024). The conversion convention and the exposed-cards rule come from [#3 Answer](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274). The lesson inventory and handoffs come from [#48](https://github.com/0xRowdy/tableside/issues/48#issuecomment-5670773802), and the content rules from [#47](https://github.com/0xRowdy/tableside/issues/47#issuecomment-5669433821) via [#53 Amendment 1 C11](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716).
- **Every number** below was checked against engine code in `packages/engine/src`: `truncatedTrueCount`, `countOf`, `conversionExplanation`, `tableCheckpointRounds`, and a full table challenge driven through `createChallenge`/`advanceChallenge` with the engine's own test fixtures. The zero-threshold rows come from the certified `indices_*_final.csv` files in `REFERENCE_FILES`. No research-calculator output is used.
- **Table Play is not built.** The app offers **Observe** only. The Play radio button is disabled with `TODO(#138)`. Play facts below are spec, not current app behaviour.
- **Retrieval:**
  - Wizard of Odds Hi-Lo page: fetched live, HTTP 200.
  - BJA "How To Count Cards": HTTP 403 live (Cloudflare). Its text comes from the [2026-10-14 Internet Archive snapshot](https://web.archive.org/web/20261014105044/https://www.blackjackapprenticeship.com/how-to-count-cards/), the same snapshot blackjack-lessons.md cites.
  - Casino Quest: no counting page or timestamp was verified.

## Spec and decisions

### What each lesson must teach (spec 3 body, *Lessons and worked examples (#48)*)

- Inventory: "card values; running count; true-count conversion; table counting (Learn/Check, Observe/Play, checkpoints and N, the show-count toggle and assistance)". Amendment 1 B1 corrects the blackjack count to 10 lessons; the total stays 24.
- Conversion: "The conversion lesson teaches half-deck estimation (nearest, ties up, minimum 0.5) and truncation toward zero (+7/2 → +3, −7/2 → −3). It explains that other sources' introductory rounding examples (BJA, Wizard of Odds) follow different or incomplete conventions, and that zero-threshold indices use the truncated true count."
- "No lesson claims profitability, readiness or predicted casino results."
- "Copy is original, cites specific Blackjack Apprenticeship / Casino Quest sources where used, and links external videos optionally (never embedded)."
- Handoff: "the final step offers … a Learn challenge (category prefilled). It opens the normal setup screen … Nothing starts or charges until the learner starts the activity at its normal boundary."
- [Amendment 2 §3](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256569510) (frame correction): "Worked example: 'truncate toward zero'."
- Check protection ([Amendment 1 A2](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716)): while an unfinished Check attempt exists on the device, the app withholds "the four counting lessons … and their worked examples, for any Check attempt". The lessons themselves can say nothing about this rule; it only affects where they appear.

### Challenge content (spec 3 body, *Challenge content (from #4)*)

| Category | Fixed MVP length | Content (quoted) |
| --- | --- | --- |
| Card values | 20 questions | "Drawn from all thirteen ranks and four suits. Every rank appears at least once (this spec's reading of 'mix all ranks'), so all three Hi-Lo values (+1 for 2–6, 0 for 7–9, −1 for 10–A) appear. Answer is one of three choices." |
| Running count | 52 exposed cards | "Shuffle a six-deck shoe … and expose 52 cards from index 0. Start at zero. No forced zero end. Learn asks after every card; Check asks after cards 13, 26, 39 and 52." |
| Conversion | 10 questions | "Running count is an integer in −20..+20. The divisor is a half-deck value in 0.5..6.0. The set includes at least one zero running count, at least one positive, at least one negative, at least one exact quotient, and at least one positive and one negative quotient requiring truncation. Answer = running count ÷ divisor, truncated toward zero." |
| Table | 10 completed rounds | "Fresh six-deck shoe, zero count. Split hands stay in their originating round. Defaults: S17 + late surrender, 75% penetration, no extra players, N=1. Exposes spec 1's four presets, penetration 50–80% in 5% steps, 0–4 extra players and N=1–10." |

- **Divisor:** "supply decks remaining from physical cards in the shoe, to the nearest half deck, ties up, minimum 0.5 (spec 1). It is part of the task, not an assistance flag."
- **Reshuffle (decided 2026-10-18):** "when the cut card is reached, the current round finishes. The shoe is then reshuffled and the reshuffle announced as a visible state change. The reference running count resets to zero, the supplied divisor follows the new shoe, and checkpoints continue on the round schedule."
- **Observe seats (decided 2026-10-18):** "in Observe a simulated player occupies the learner's seat, using rule-specific basic strategy with a fixed wager equal to the table minimum. … Observe has no learner bankroll or financial result."
- **Information:** "only exposed cards contribute to the reference count. A concealed hole card contributes nothing until revealed, and a negative peek reveals no rank."

The source decision, [#4 Answer › "Learning structure and challenge content"](https://github.com/0xRowdy/tableside/issues/4#issuecomment-5556317024), says: "Supply the correctly estimated half-deck divisor using the physical-shoe convention; this is part of the task, not an assistance flag. Concealed cards never contribute to the learner's reference running count until exposed." It also says: "Suggest card values → running count → true-count conversion → table counting, without prerequisite locks."

### Count checkpoints (table) (spec 3 body)

- "**N=1:** before each round's bet, running count and true count. After the round's final dealer-card reveal (including round 10), running count. In counting-with-deviations Play, also the true count at each count-dependent playing or insurance decision, requested before the action is chosen."
- "**N>1:** running count and true count after rounds N, 2N, …, plus the final partial block (N=3 → rounds 3, 6, 9, 10). All other count prompts, including deviation-decision prompts, are suppressed. Playing and betting decisions continue normally."
- "A checkpoint is an engine phase, and the next card or action is not legal until it is answered or skipped."

[#4 Answer › "Table formats and configurable count checkpoints"](https://github.com/0xRowdy/tableside/issues/4#issuecomment-5556317024) has the same rules. It adds: "**Observe:** simulated players handle playing and betting decisions while the learner counts. Suggest this as the entry point to table counting." and "**Play:** the learner uses counting with basic or counting with deviations, with the accepted optional bet schedule. Learn retains immediate strategy coaching and retry/override behavior. Check defers strategic correctness feedback until results while still enforcing legal actions immediately."

### Learn, Check and assistance (spec 3 body)

- "**Learn:** after each answer, permitted view includes correctness, the reference, an explanation and a retry. Before the next item, the correct value is established: the learner retries, or chooses 'show answer'. Only the first submission is scored. … Learn attempts are inherently assisted."
- "**Check:** permitted view contains the exercise, legal choices, the checkpoint prompt, legal affordability (Play) and the attempt's own entered answers. It contains no correctness, reference count, prescribed action or wager, fallback explanation, error magnitude or drift. Illegal actions are rejected immediately."
- "**Show/hide running count:** available in running-count and table challenges, hidden by default. It displays the reference count of exposed cards only. In Check, its label states the consequence before first use, and the first reveal … permanently sets the attempt's assisted flag (hiding again changes nothing) and records the step at which it happened. … Learn records whether the count was revealed, for comparison groups. Revealing never costs an attempt."
- "**Skip** is an explicit submission scored incorrect."

[#4 Answer › "Assistance and feedback"](https://github.com/0xRowdy/tableside/issues/4#issuecomment-5556317024): "Showing it during Check permanently marks the entire attempt assisted, even if hidden again. Retain the result, but exclude it from unassisted records and advancement evidence. … Learn is assisted by its immediate feedback." Under "Learning structure": "Corrections never erase the first submitted answer from accuracy."

**Readiness wording.** [#4 Answer › "Personal bests and progression"](https://github.com/0xRowdy/tableside/issues/4#issuecomment-5556317024): "This is readiness for the tested counting skill/settings, not a profitability claim or speed requirement." Lessons must not make readiness claims (above). If a lesson mentions milestones at all, use only this framing.

### Conversion convention ([#3 Answer › "Blackjack modes, counts, and betting"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274))

- "Count cards only when exposed, recomputing at each decision. A concealed dealer card is excluded until revealed; a negative peek does not reveal its rank."
- "Estimate decks remaining physically in the shoe to the nearest half deck, ties upward, with a minimum divisor of 0.5. A supplied positive half-deck divisor is authoritative in an isolated conversion drill. This uses the shoe-only denominator, not the alternative all-unobserved-card model explored in research."
- "Divide running count by that divisor and truncate toward zero: +7/2 -> +3 and -7/2 -> -3. Use the same integer true count for betting guidance."

[Amendment 1 B3](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716): "The conversion convention (half-deck estimation, ties up, minimum 0.5, truncation toward zero) and the 1/2/4/6/8 bet schedule come from #3."

[#15 Q20](https://github.com/0xRowdy/tableside/issues/15#issuecomment-5674497837) (quoted in blackjack-lessons.md): "no running-count sign exceptions inside the zero bin". Q22: "True Count teaches its own generated thresholds under the accepted half-deck truncated true-count convention."

## What the app does (code)

### Content constants ([`challenges.ts`](../../packages/definitions/src/challenges.ts))

- Card values: `length: 20, coverage: 'every-rank'` (line 9).
- Running count: `length: 52, decks: 6, checkpoints: [13, 26, 39, 52]` (lines 12–20).
- Conversion: `length: 10, maxRunningCount: 20, maxDecks: 6` (line 23).
- Table: `rounds: 10` (line 26).
- Default table setup: `seat: 'observe'`, default preset (S17_LS), penetration 75, `extraPlayers: 0`, `interval: 1` (line 44).

### Card values and running count ([`challenge.ts`](../../packages/engine/src/challenge.ts), [`blackjack.ts`](../../packages/engine/src/blackjack.ts))

- `hiLoTag`: ranks 2–6 → +1, 7–9 → 0, everything else (10, J, Q, K, A) → −1 ([`blackjack.ts:298`](../../packages/engine/src/blackjack.ts)).
- Card-value content is redrawn (rejection sampling) until all 13 ranks appear ([`challenge.ts:437–443`](../../packages/engine/src/challenge.ts)).
- Running-count content is the first 52 cards of a shuffled six-deck shoe ([`challenge.ts:433–435`](../../packages/engine/src/challenge.ts)). The reference is the sum of tags from card 1 to the current card (`countThrough`, line 449).
- `asks()` ([`challenge.ts:468–471`](../../packages/engine/src/challenge.ts)): card values and conversion ask on every item. Running count asks on every card in Learn, and only at the positions in `checkpoints` (13, 26, 39, 52) in Check. Table asks only at its prompt steps.
- Malformed-input bounds (`countRange`, [`challenge.ts:519–525`](../../packages/engine/src/challenge.ts)) cover the largest answer each challenge can produce:
  - running count: −52..+52;
  - conversion: −40..+40, because ±20 ÷ 0.5 = ±40;
  - table running count: −120..+120;
  - table true count: −240..+240 (`tableCountRange`, [`table-challenge.ts:77–81`](../../packages/engine/src/table-challenge.ts)).

  These are input checks, not content ranges.

- **Pacing** (running count only): self-paced, or automatic at 3, 2 or 1 seconds per card (`PACE_SECONDS`, [`controller.ts:40`](../../apps/mobile/src/training/controller.ts); `pacingApplies` refuses automatic pacing for other categories, [`challenge-record.ts:18`](../../packages/engine/src/challenge-record.ts)). From #136.

### Conversion ([`blackjack.ts:309–317`](../../packages/engine/src/blackjack.ts), [`challenge.ts:409–452`, `680–686`](../../packages/engine/src/challenge.ts))

- `truncatedTrueCount(running, halfDecks)` computes `floor(|2·running| / halfDecks)` and gives it the sign of `running`. This is division by the deck count, truncated toward zero.
- Conversion items: running count is uniform in −20..+20, and the divisor is uniform in {0.5, 1.0, …, 6.0} (lines 426–428). `coversConversion` (lines 412–419) redraws until the set has all of these:
  - a zero running count;
  - a nonzero exact quotient;
  - a positive non-exact quotient;
  - a negative non-exact quotient.

  Those four together give the spec's "at least one positive, at least one negative".
- `conversionExplanation` returns `{ running, decks, trueCount, exact }` (line 680).
- The app renders it in [`blackjack-conversion-text.ts:13–25`](../../apps/mobile/src/training/blackjack-conversion-text.ts):
  - exact: "… = +N exactly, so the true count is +N.";
  - otherwise: "… ≈ q. Tableside truncates toward zero, so +N.";
  - for negative running counts, or when the fraction is ≥ 0.5, it adds: "Rounding up/down to ±M is the common slip; some charts online round differently."

### Divisor from the physical shoe ([`blackjack.ts:309`, `325–329`](../../packages/engine/src/blackjack.ts))

- `halfDecksLeft(remaining) = max(1, floor((remaining + 13) / 26))`. A half deck is 26 cards; adding 13 rounds to the nearest half deck with ties going up; the minimum is 1 half deck (0.5 decks). `countOf` shows the divisor as `halfDecksLeft / 2`.
- In the table challenge, `tableCountAt` ([`table-challenge.ts:179–190`](../../packages/engine/src/table-challenge.ts)) works backwards to the last shuffle. **Every dealt card leaves the shoe**, including the face-down hole card, so the divisor drops as soon as the hole card is dealt. Only face-up cards and the hole-card reveal add to the running count. The hole card's tag is added when it is revealed.

### Table challenge ([`table-challenge.ts`](../../packages/engine/src/table-challenge.ts))

- **Setup ranges:** checkpoint interval 1–`MAX_CHECKPOINT_INTERVAL` = 10 (line 74, validated line 97); seat must be `'observe'` (line 94). Other ranges:
  - penetration: `PENETRATIONS = [50, 55, 60, 65, 70, 75, 80]` ([`blackjack.ts:11`](../../packages/engine/src/blackjack.ts));
  - extra players: `MAX_OTHER_PLAYERS = 4` ([`blackjack.ts:13`](../../packages/engine/src/blackjack.ts)).

  The setup screen steps through exactly these values ([`TableSetupOptions.tsx:58–88`](../../apps/mobile/src/counting/TableSetupOptions.tsx)). It labels N as "Every round" or "Every N rounds" (`intervalText`, [`blackjack-table-text.ts:127`](../../apps/mobile/src/training/blackjack-table-text.ts)).
- **Rounds:** 10 (definition). The validator allows 1–20 (`MAX_TABLE_ROUNDS`, line 73), but only 10 ships.
- **Prompt schedule** (`dealTableRound`, lines 142–170):
  - N=1: running count and true count before the bet (`before-bet`), then running count after the round (`after-round`);
  - N>1: running count and true count (`block`) after rounds where `round % N === 0`, and after the last round (`tableCheckpointRounds`, line 136).
- **Reshuffle** (lines 153–158): at the start of a round, if the cut card has been passed, a fresh shoe is shuffled and a `shuffle` step is recorded. `tableCountAt` stops at that step, so the count restarts at 0 and the divisor follows the new shoe. The `shuffle` step comes before that round's before-bet prompts. The cut card sits at `floor(312 × penetration / 100)` cards ([`blackjack.ts:241`](../../packages/engine/src/blackjack.ts)).
- Engine tests already state these behaviours by name ([`table.cases.ts`](../../packages/engine/test/table.cases.ts)):
  - "table: only exposed cards count; the face-down hole card adds nothing until it is revealed";
  - "table: a negative peek reveals no rank; the hole card stays out of the count and the view while players act";
  - "table reshuffle: four extra players at 50% penetration; the round finishes, the shoe is shuffled, the count resets and the divisor follows the new shoe".

### Scoring and assistance ([`challenge.ts`](../../packages/engine/src/challenge.ts))

- First answer is kept: each answer records `first` and `last`. Retries update only `last`, and only the first submission is marked `scored` (lines 600–605). Results grade `answers.first` (line 642).
- Check moves an answered item to `recorded` (no feedback). Learn moves it to `explanation`, where `retry-item` and `next-item` are legal (lines 494–510, 605).
- The app's Learn button for moving on with the correct value is labelled "Show answer" (`SHOW_ANSWER`, [`blackjack-table-text.ts:94`](../../apps/mobile/src/training/blackjack-table-text.ts)). The table Learn note reads: "Learn scores your first answer at each checkpoint, even when you corrected it afterwards. Learn attempts never count toward a readiness milestone." (same file, line 19).
- Reveal is legal only in running-count and table challenges, only before the first reveal, and only while content is showing (`canReveal`, line 505). It sets `revealedAt` to the current step (line 617).
- `assisted = variant === 'learn' || revealedAt !== null` (line 677). Results carry `assisted` and `assistanceStep` (line 663).
- Metrics:
  - table running and true counts are scored separately (lines 659–661);
  - running-count challenges score `running-count`;
  - conversion scores `true-count`;
  - card values scores `card-values` (`CATEGORY_METRIC`, line 188).

### Toggle text in the app ([`challenge-text.ts:249–263`, `492`](../../apps/mobile/src/training/challenge-text.ts))

- Toggle label: "Show running count".
- Check state, hidden before any reveal: "Hidden. Showing it marks this whole attempt assisted, permanently." Showing: "Showing. This attempt is marked assisted." Hidden after a reveal: "Hidden. This attempt is already marked assisted; showing it again changes nothing."
- Learn: "Hidden. Learn notes whether you showed it." / "Showing. Learn notes that you showed it."
- Check confirmation dialog:
  - title: "Show the running count?";
  - lead: "Showing it marks this whole attempt as assisted, permanently. Hiding it again won't undo that.";
  - detail: "Assisted attempts still get full results, but they're kept apart from unassisted records and can't count toward a readiness milestone. Showing the count doesn't use another attempt.";
  - buttons: "Keep it hidden" / "Show count and mark assisted".
- Check help sheet entry: "Marks the whole attempt assisted, permanently." (line 492).

### Observe today, Play by spec

- **App:** the "Who plays your seat" choice shows Observe and a disabled Play option with `// TODO(#138)` ([`TableSetupOptions.tsx:39–41`](../../apps/mobile/src/counting/TableSetupOptions.tsx)).
- Seat help: "Observe: a simulated player plays your seat at the table minimum and you keep the count. Play: you also make the playing decisions."
- Observe notice: "A simulated player sits in your seat with a fixed table-minimum wager and always has enough to play. You only keep the count." ([`blackjack-table-text.ts:118`, `130–132`](../../apps/mobile/src/training/blackjack-table-text.ts)).
- **Spec only (not built, #138):**
  - Play learners choose "counting with basic or counting with deviations, the optional bet schedule, my base wager and a starting balance (default 1,000)" (spec 3 user story 28).
  - Learn gets the correction pause with retry or override. Check enforces legality only.
  - At N=1 in counting-with-deviations Play, a true-count prompt comes before each count-dependent decision. [Amendment 1 A3](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716) says this "reveals that the decision depends on the count. It never reveals the prescribed action, the index or the reference count."
  - Challenge finances stay out of skill scores.
  - Copy that describes Play must say it is coming, or must not describe it as available.

## Worked numbers (engine-verified 2026-11-17)

Run with `pnpm exec tsx` against `packages/engine/src` (`truncatedTrueCount`, `countOf`, `trueCount`, `conversionExplanation`).

**Conversion (supplied divisor):**

| Running | Decks | Raw quotient | Tableside true count | `exact` |
| --- | --- | --- | --- | --- |
| +7 | 2 | 3.5 | **+3** | false |
| −7 | 2 | −3.5 | **−3** | false |
| +7 | 4 | 1.75 | **+1** | false |
| −7 | 4 | −1.75 | −1 | false |
| −1 | 2 | −0.5 | **0** | false |
| +1 | 2 | 0.5 | 0 | false |
| 0 | 3 | 0 | 0 | true |
| +10 | 5 | 2 | +2 | true (BJA's example #1) |
| +6 / −6 | 1.5 | ±4 | ±4 | true |
| +7 | 3.5 | 2 | +2 | true |
| +20 / −20 | 6 | ±3.33 | ±3 | false |
| +5 / −5 | 0.5 | ±10 | ±10 | true |
| +3 / −3 | 2.5 | ±1.2 | ±1 | false |

Wizard's Step 3 example (+7, about 4 decks) rounds 1.75 up to 2. Tableside gives **+1** for the same numbers.

**Half-deck estimation from cards left in the shoe** (`countOf(...).decks`):

| Cards left | Exact decks | Divisor | Note |
| --- | --- | --- | --- |
| 312 | 6.00 | 6 | fresh shoe |
| 234 | 4.50 | 4.5 | exact half |
| 156 | 3.00 | 3 | |
| 144 | 2.77 | 3 | nearest |
| **143** | **2.75** | **3** | exact tie between 2.5 and 3 → up |
| 142 | 2.73 | 2.5 | nearest |
| **130** | **2.50** | **2.5** | |
| **117** | **2.25** | **2.5** | exact tie between 2 and 2.5 → up |
| 104 | 2.00 | 2 | |
| 91 | 1.75 | 2 | tie → up |
| 78 | 1.50 | 1.5 | the 75% cut point leaves 78 |
| 39 | 0.75 | 1 | tie → up |
| 38 | 0.73 | 0.5 | |
| 26 | 0.50 | 0.5 | |
| **13** | **0.25** | **0.5** | tie between 0 and 0.5 → up, which is also the minimum |
| 12, 1, 0 | < 0.25 | 0.5 | minimum 0.5 |

A tie happens whenever the cards left are an odd multiple of 13. Ties round up to the next half deck.

**Table prompt schedule** (`tableCheckpointRounds` and a full Check attempt with every prompt skipped, `seed(1)`, Observe, S17_LS):

| N | Prompt rounds | Running prompts | True prompts |
| --- | --- | --- | --- |
| 1 | every round: before bet (running + true), after round (running) | 20 | 10 |
| 2 | 2, 4, 6, 8, 10 | 5 | 5 |
| 3 | 3, 6, 9, 10 | 4 | 4 |
| 4 | 4, 8, 10 | 3 | 3 |
| 5 | 5, 10 | 2 | 2 |
| 7 | 7, 10 | 2 | 2 |
| 10 | 10 | 1 | 1 |

In a fresh shoe, round 1's N=1 before-bet prompt is running 0, divisor 6, true 0.

**Wizard's running-count example checked:** 3, 5, K, 7, Q, A, 8, 5, 4, 2 → +1 +1 −1 0 −1 −1 0 +1 +1 +1 = **+2**, which matches `hiLoTag`.

**Scripted worked examples** (each replayed through the engine at build time by `countingExampleProblems` / `workedExampleProblems`; the build fails if any number below moves):

- Card values: A♠ → −1.
- Running count: −2, then 3♦ (+1) → −1.
- Conversion (frame aJV2y): running +7, 2 decks → 3.5, truncated to **+3**.
- Table counting: round 1 at the default Observe table (S17, late surrender, 75%, no other players, N = 1). Seat 10♠ 6♥ stands on 16 against a 5; dealer 5♣, hole K♦, draws 9♠ (24, bust). Exposed cards −1, +1, +1, −1, 0 → running count **0** after the round; leaving out the hole card gives +1.

### Zero-threshold indices use the truncated true count

These are the certified rows with `taught_threshold` 0, all `basic_at_or_above`, from `REFERENCE_FILES`:

- S17: 13 vs 2 (stand), 12 vs 6 (stand), 15 vs 10 surrender.
- H17: 11 vs A (double), 12 vs 4 (stand), 15 vs 10 surrender, 15 vs A surrender.

Example rows:

- `indices_S17_final.csv`: `S17,I18,13 vs 2,hard,13,2,stand,hit,S,0,basic_at_or_above,"stand (basic) at TC >= 0, hit below"`.
- H17 12 vs 4 reads "stand (basic) at TC >= 0, hit below".

Worked case: running −1 with 2 decks left gives −0.5, which truncates to **0**.

- S17 13 vs 2 → **stand** (TC ≥ 0). Rounding down to −1 would hit instead.
- H17 12 vs 4 → **stand** under Tableside. BJA's H17 chart prints "0−" for that cell ([blackjack-lessons.md, H17 table](blackjack-lessons.md#h17-h17-presets-fab-4-rows-only-with-late-surrender)). Its legend says "0- indicates the deviation happens at any negative running count". BJA would therefore hit at running −1 under its own convention. Tableside has no running-count-sign exception (#15 Q20).
- Copy states this difference without calling BJA wrong.

## Other sources' conversion conventions

### Blackjack Apprenticeship, "How To Count Cards" (archive snapshot 2026-10-14)

- Section "Step 3: Calculate A "True Count" Or Count Per Deck": "To use our running count in a multiple deck game, we simply have to translate our information into a "True Count" or count per deck."
- Examples: "EXAMPLE #1: If our Running Count is 10 and we have 5 decks remaining, our True Count is 2. (10 ÷ 5)" and "EXAMPLE #2: If our Running Count is -7 and we have 2 decks remaining, our True Count is -3. (-7 ÷ 2)"
- Also from Step 3 ("Bonus Tip" text): "To calculate our True Count, we simply divide our Running Count by the number of decks left to be dealt."
- **Compared with Tableside:** BJA's −7 ÷ 2 → −3 agrees with truncation toward zero, and 10 ÷ 5 is exact. The page **states no rounding rule** and **no deck-estimation granularity** (half deck, ties, minimum). The convention is therefore incomplete relative to #3, not contrary to it. BJA's deviation charts use running-count-sign rules (0+ / 0−) at zero; Tableside does not (see above).
- Step 1 tags: "2-6 = +1 / 7-9 = 0 / 10-Ace= -1".
- Step 2 heading: "Keep A Running Count By Adding Or Subtracting Every Card That You See In Each Shoe."
- Step 2 says the counter does this "card after card and round after round until the dealer shuffles the cards again".
- The Step 2 examples #1–#3 depend on card images not present in the archived text, so they are not usable.
- **Do not use:** the Step 3 / "Bonus Tip" claims that "each true count will move the house edge half a percent", "a true 1 would basically erase the house edge", and "That's how we card counters make our money!". These are edge and profit claims, banned by the content rules.

### Wizard of Odds, "Introduction to the High-Low Card Counting Strategy" (live, "Last updated: Aug 03, 2026", "Written by: Michael Shackleford")

- Section "How it Works", Step 2: "Start with a "Running Count" of zero at the start of the deck/shoe. As cards are revealed, keep adding or subtracting from the Running Count, according to the point system in step 1." The example follows: 3, 5, K, 7, Q, A, 8, 5, 4, 2 → +2.
- Section "How it Works", Step 3: "Divide the running count by the number of decks remaining, to get what is known as the "True Count." This is the part that beginning counters hate. You don't need to be exact. A rough estimate will do, in my opinion. … The running count is +7 and there are about 4 decks left. The true count would be 7/4 = 1.75. Round that up to 2, to keep it simple." The page source has a literal "?" for the apostrophe in "don't".
- Under the "High-Low Statistics" table: "The simulation rounded the remaining decks to the nearest half deck, otherwise playing perfectly." This concerns the page's simulation, not a rule it teaches.
- **Compared with Tableside:** Wizard rounds +1.75 **up** to +2, and endorses rough estimation. Tableside truncates the same case to **+1** and grades exactly. This is a **different** convention, presented by Wizard as a simplification.

## Casino Quest

**None verified.** No Casino Quest page or video covering card values, running count or true count was found or checked. A 2026-11-17 web search for a Casino Quest counting video returned none. #47 names Casino Quest as the owner's primary source for roulette and craps, and BJA for blackjack. Under C11 ("never a whole channel"), the counting lessons must not cite Casino Quest.

## Content rules

From [#47](https://github.com/0xRowdy/tableside/issues/47#issuecomment-5669433821), [#53 Amendment 1 C11](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716) and the spec 3 body. These are the same as [blackjack-lessons.md › Content rules](blackjack-lessons.md#content-rules):

- "No lesson claims profitability, readiness or predicted casino results." Readiness may be described only as "readiness for the tested counting skill/settings, not a profitability claim" (#4).
- "never imply Casino Quest or BJA authored or approved the catalog".
- "clearly label True Count's own variants, caps and resets". Read "True Count" as Tableside. In these lessons, Tableside's own variants are:
  - the conversion convention (half-deck estimate, ties up, minimum 0.5, truncate toward zero, no running-count-sign exceptions);
  - the challenge lengths (20 / 52 / 10 / 10 rounds);
  - the Check checkpoints 13/26/39/52;
  - the table checkpoint schedule and N;
  - the assistance rule (reveal marks the attempt assisted permanently; Learn is inherently assisted; first answer only).
- "cite the exact page, section or video timestamp, never a whole channel".
- "external sources appear as text links only, with no logos, thumbnails or preloaded players". Videos are never embedded (spec 3).
- "credits are bundled for offline reading".
- BJA is "Reference-only unless item-specific reuse rights are established" (#47). Write original explanations; quote at most a short example for comparison, with its source.
- If a source differs, "record the difference" (#47). The copy describes BJA's and Wizard's examples as different or incomplete conventions, never as errors.

## Citable sources

Ready for `LessonSource { citation, url }` ([`lessons.ts`](../../packages/definitions/src/lessons.ts) requires an https URL or null). All retrieved 2026-11-17.

```ts
[
  { citation: 'Blackjack Apprenticeship, “How To Count Cards”, sections “Step 1: Assign A Value To Every Card” and “Step 2: The Running Count”', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  { citation: 'Blackjack Apprenticeship, “How To Count Cards”, section “Step 3: Calculate A “True Count” Or Count Per Deck” (examples #1 and #2)', url: 'https://www.blackjackapprenticeship.com/how-to-count-cards/' },
  { citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, Step 1 table “High-Low Point Values” and Step 2', url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/' },
  { citation: 'Michael Shackleford, Wizard of Odds, “Introduction to the High-Low Card Counting Strategy”, section “How it Works”, Step 3', url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/' },
  { citation: 'Blackjack Apprenticeship, “H17 Deviation Chart” (PDF, © 2018), section “Hard Totals” (12 vs 4: 0−) and legend', url: 'https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf' },
  { citation: 'Tableside certified blackjack coaching reference, indices_S17_final.csv and indices_H17_final.csv (frozen 2026-09-14, manifest 9892826d)', url: null },
]
```

Tableside's own conventions are labelled in the copy as Tableside's; they need no external citation. The fifth entry applies only if the conversion lesson uses the 12 vs 4 contrast. Its PDF was read live for #152 (see blackjack-lessons.md), not again here.

## Not confirmed

- **BJA live HTML:** the page returned 403 again on 2026-11-17. Quotes come from the 2026-10-14 archive snapshot. Recheck in a browser before release.
- **BJA video `SHK2C-QQR-k`** ("how to count cards", Colin Jones): a web search snippet lists chapters such as "03:18 What is Running Count? (W/ Practice Hands)", "08:13 What is True Count? (W/ Examples)" and "10:30 How Do We Use True Count?". The video was not watched and the chapter list was not checked against it. The snippet also says an updated version exists. **Do not cite any timestamp from it.**
- **Casino Quest:** no counting page or timestamp verified. Do not cite.
- **BJA's rounding rule:** BJA's −7/2 → −3 is consistent with truncation, but the page states no rule. Copy must not say "BJA truncates". Say only that its example matches and that it does not say how to round or how finely to estimate decks.
- **Wizard's simulation granularity:** the "nearest half deck" note describes the page's statistics simulation. It does not say how ties or signs were handled. Do not present it as Wizard's teaching rule.
- **Play (#138):** every Play fact here is spec text. Nothing about Play setup, funding or deviation prompts has been checked in the app.
- **Amendment 2 §3's "S3-08: 14 checkpoints, not 15":** which setup produces 14 was not traced. The N=1 schedule gives 20 checkpoints (30 prompts) over 10 rounds. Do not quote a checkpoint total from the frame.

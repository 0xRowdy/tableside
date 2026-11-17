# Craps lesson facts: basics and the five built-in strategies

Research date: 2026-11-17. Research complete for ticket [#154](https://github.com/0xRowdy/tableside/issues/154). Scope: the six standard craps lessons in [#48](https://github.com/0xRowdy/tableside/issues/48#issuecomment-5670773802) (craps basics; Pass with odds; Flat place 6 and 8; Don't pass with lay odds; bounded Three-point Molly; capped press-and-collect 6 and 8). Lesson copy may state only what this note records. Repo paths refer to commit `502519d` on `ticket/154-craps-lessons`.

How this note is sourced:

- **Product rules** come from the decision comments that own them (§1).
- **Numbers** (house edges, payouts, stakes, caps) come from Tableside's own code, run through the engine (§2). Published figures sit beside them only to show they agree.
- **Behavior** of each built-in comes from `packages/definitions/src/craps-strategies.ts`, as the engine interprets it (§4).
- **External citations** are pages fetched and checked on 2026-11-17 (§6).
- [docs/research/craps-strategies.md](craps-strategies.md) (2026-09-05) was used only as a list of leads. Each fact kept from it was re-checked against its primary source. Where Tableside's code differs from that note's proposals, the code is recorded here.

## 1. Decisions that own the craps rules and strategies

The code comments `// #3` and `// Spec 1 Amendment 1 §B` (`packages/definitions/src/craps.ts:1-2`, `packages/definitions/src/craps-strategies.ts:5`) point to the decisions below. The `true-count` repository was renamed `tableside`, so `gh issue view <n> -R 0xRowdy/true-count` and `github.com/0xRowdy/true-count/issues/<n>` both open the `tableside` issue.

| Fact | Owning decision |
| --- | --- |
| Five built-in craps strategies accepted by name | [#3, "Launch catalog and blackjack modes accepted"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315457) |
| Standard craps, configurable limits, maximum odds and field payout, explicit working/off on the come-out | [#3, "Launch table coverage accepted"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315518) |
| 3-4-5x default odds; don't bets push on 12 (bar 12); field 2 double / 12 triple by default, with double-on-both as the alternative | [#3, "Craps defaults … accepted" (Q13)](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315867) |
| Place/buy bets and come odds off on the come-out by default; established come bases, don't bets, lays and hardways keep working; working status shown, with legal per-bet instructions | Same comment |
| Stakes for each strategy on a 10-minimum table: pass 10 + 10 odds; place 6/8 at 12 each; don't pass 10 + lay to win 10; Molly with pass 10, at most two come bets of 10, 10 odds each; press-and-collect 12 → +12 steps → 48 cap | [#3, "Craps strategy execution accepted" (Q15)](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316060), built on [the Q15 proposal](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315998) |
| Resets and keeping bets up: replace resolved come bets while the point is on; place bets off on the come-out; amounts and press counters kept through a made point and reset after a seven-out; established come bets work on the come-out with their odds off | Same comment (Q15) |
| Odds-cap menu 1x / 2x / 3-4-5x / 5x / 10x; don't odds capped by the amount to win, with the laid stake ≤ 6× base under 3-4-5x | [#3 Q16 proposal](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316114), accepted in ["Remaining defaults accepted"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316189) |
| Limits: 10/1,000 per wager or number for line/come, place/buy/lay and field; 1/100 per component for hardways and propositions; odds follow the odds cap, not the flat maximum; place 6/8 in multiples of 6, other place numbers in 5s | [#3 Q17](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316114), accepted in the same place |
| Consolidated answer (rules, payout table, the five strategies' executable behavior) | [#3 "Answer"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274), sections "Standard craps rules" and "Five built-in craps strategies" |
| Spec restatement; strategies are data, atomic groups, settlement kept separate from the next adjustment | [#51 spec 1 body](https://github.com/0xRowdy/tableside/issues/51), sections "Game rules", "Built-in strategies" and "Strategy execution semantics" |
| House-edge facts: versioned per wager under the selected rules, exact, shown "as a property of the rules, never as a prediction of results" | [#51 Amendment 1 §B](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6256569082) |
| An established don't pass / don't come may be taken down (with its odds) but not changed; a stop during a revealed roll settles that roll | [#51 Amendment 9 §4](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191) |
| Strategy settlement: after an override, Collect instead or Stop strategy, removable wagers come back, then the remaining pass/come contracts settle by automatic rolls | [#51 Amendment 10 item 1](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6664362161) |

What the lessons must cover:

- **The curriculum** ([#48 resolution](https://github.com/0xRowdy/tableside/issues/48#issuecomment-5670773802); [docs/decisions/onboarding-tutorial-curriculum.md](../decisions/onboarding-tutorial-curriculum.md)):
  - "Game basics introduce the bet/action controls, table conditions, turn phases, settlement and funding."
  - "Strategy lessons cover initial state, next actions, outcome adjustments, limits and stopping/final settlement."
  - "progression examples must explain that changing stakes does not remove the game's house advantage."
- **Spec 3** ([#53](https://github.com/0xRowdy/tableside/issues/53) "Lessons and worked examples (#48)", plus gate 9):
  - every progression lesson states that changing stakes doesn't remove the house advantage;
  - no lesson claims profitability, readiness or predicted results;
  - copy is original and cites specific sources.

Content and citation rules come from [#47 resolution](https://github.com/0xRowdy/tableside/issues/47#issuecomment-5669433821) and [docs/decisions/built-in-reference-content-rights.md](../decisions/built-in-reference-content-rights.md) §"Source use and original work", as carried into gate 9 by [#53 Amendment 1 C11](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716):

- Record the exact page, section or timestamp. Never attribute an instruction to a channel as a whole.
- Preserve each creator's own variant, and label Tableside's own caps and resets.
- Never imply Casino Quest or BJA authored or approved the catalog.
- External sources are text links only, and credits are bundled for offline reading.
- Rights approval is separate from correctness.

## 2. Engine numbers

Script: `/private/tmp/claude-501/-Users-rowdy--t3-worktrees-tableside-t3-74e9147c/668d3f4a-f0cb-49a5-b588-abfc27db0fbd/scratchpad/craps-lesson-facts.mts`. That is a session scratchpad, so it may be cleared; the house-edge part is reproduced below. Run it from the repo root:

```
pnpm exec tsx <scratchpad>/craps-lesson-facts.mts
```

It imports `crapsHouseEdge`, `standardCraps`, `CRAPS_EDGE_WAGERS`, `CRAPS_STRATEGIES` and `CRAPS_LIMITS` from `packages/definitions/src/index.ts`. From the engine it imports `explainPrescription`, `strategyTableCompatibility`, `initialProgress`, `createActivity` and `advanceActivity` (`packages/engine/src/index.ts`), plus `progressAfter` (`packages/engine/src/strategy.ts`).

Rule set for every figure, unless a row says otherwise:

- `standard-craps` version 2 (`STANDARD_CRAPS`, `packages/engine/src/craps.ts:23-37`), `CRAPS_HOUSE_EDGE_VERSION` 2.
- Limits `CRAPS_LIMITS`: flat 10–1,000, props 1–100 (`packages/definitions/src/craps.ts:22`).
- Field `triple-12`.

```ts
// house-edge reproduction (repo root, pnpm exec tsx x.mts)
const { crapsHouseEdge, standardCraps } = await import('./packages/definitions/src/index.ts');
for (const cap of ['1x', '2x', '3-4-5x', '5x', '10x'])
  for (const w of ['pass', 'come', 'dont-pass', 'dont-come', 'odds', 'place-4', 'place-5', 'place-6', 'place-8', 'place-9', 'place-10', 'field'])
    console.log(cap, w, crapsHouseEdge(w, standardCraps(cap, 'triple-12')));
```

### 2.1 House edge per wager (engine) and published figures

How the engine computes these (`packages/definitions/src/craps.ts`):

- Exact rational arithmetic, rounded half-up to two decimals (`percent`, line 118).
- **Line bets:** expected loss per bet made, with a come-out 12 push on the don't counted as a bet made (`lineEdge`, lines 70-77).
- **Place bets:** per bet decided (`decisionEdge(repeats(n), placePays(n))`, lines 90 and 133).
- **Field:** per one-roll bet (`fieldEdge`, lines 111-116).
- **Odds:** 0 (line 125).

The setup screen labels these figures "Per bet decided" and the full-odds figures "of all money bet. A property of these rules, not a prediction of your results." (`apps/mobile/src/play/CrapsSetup.tsx`, HOUSE EDGE section).

Every odds cap gives the same value for these wagers. The engine output was identical for 1x, 2x, 3-4-5x, 5x and 10x.

| Wager | Engine % | Published | Agrees? |
| --- | --- | --- | --- |
| Pass, come | 1.41 | 1.41% per bet made and resolved; derivation −7/495 ≈ −1.414% ([WoO appendix 2, "Craps House Edge"](https://wizardofodds.com/games/craps/appendix/2/); [WoO appendix 1, "Pass/Come"](https://wizardofodds.com/games/craps/appendix/1/)) | Yes |
| Don't pass, don't come (bar 12) | 1.36 | 1.36% per bet made (1.40% per bet resolved); −3/220 ≈ 1.364% ([WoO appendix 2](https://wizardofodds.com/games/craps/appendix/2/); [WoO appendix 1, "Don't Pass/Don't Come"](https://wizardofodds.com/games/craps/appendix/1/)) | Yes, per bet made |
| Odds (take or lay) | 0.00 | 0.00% ([WoO appendix 2](https://wizardofodds.com/games/craps/appendix/2/)) | Yes |
| Place 6, 8 | 1.52 | 1.52% per bet resolved; 0.46% per bet made / per roll ([WoO appendix 2](https://wizardofodds.com/games/craps/appendix/2/)) | Yes, per bet resolved |
| Place 5, 9 | 4.00 | 4.00% per bet resolved ([WoO appendix 2](https://wizardofodds.com/games/craps/appendix/2/)) | Yes |
| Place 4, 10 | 6.67 | 6.67% per bet resolved ([WoO appendix 2](https://wizardofodds.com/games/craps/appendix/2/)) | Yes |
| Field, 2 double / 12 triple (`triple-12`, default) | 2.78 | 2.78% ([WoO appendix 2](https://wizardofodds.com/games/craps/appendix/2/); [WoO "How to Play Craps", Field Bet](https://wizardofodds.com/games/craps/basics/)) | Yes |
| Field, 2 and 12 double (`double-12`) | 5.56 | 5.56% (same pages) | Yes |

Wizard of Odds publishes come and don't come as the same bets as pass and don't pass ([WoO basics, "Come, Don't Come"](https://wizardofodds.com/games/craps/basics/)). The engine computes them with the same function (`craps.ts:126-127`).

Caution for copy: a place figure must say "per bet decided". Wizard's per-roll figures for place bets are lower, and its "made" column treats place bets differently.

### 2.2 Line bet plus full odds ("of all money bet"), one row per launch odds cap

The engine divides the line edge by 1 + the expected full odds stake (`craps.ts:157`). For don't bets, the expected stake uses the laid amounts (`fullOdds`, lines 85-88). This is the `withFullOdds` field.

| Odds cap | Pass/come + full odds (engine) | Published, Wizard "made" | Don't pass/come + full lay odds (engine) | Published, Wizard "made" |
| --- | --- | --- | --- | --- |
| 1x | 0.85 | 0.848% | 0.68 | 0.682% |
| 2x | 0.61 | 0.606% | 0.45 | 0.455% |
| 3-4-5x (default) | 0.37 | 0.374% | 0.27 | 0.273% |
| 5x | 0.33 | 0.326% | 0.23 | 0.227% |
| 10x | 0.18 | 0.184% | 0.12 | 0.124% |

Published figures: [WoO "How to Play Craps", Strategy section](https://wizardofodds.com/games/craps/basics/), tables "Combined House Edge on Pass/Come & Taking Full Odds" and "Combined House edge on Don't Pass/Come & Taking Full Odds", column "Made".

Every engine figure rounds from Wizard's. For don't bets the engine matches Wizard's per-bet-made column; per bet resolved is higher (0.701% at 1x). [WoO appendix 1](https://wizardofodds.com/games/craps/appendix/1/) gives the general formulas, "Combined Pass and Buying Odds" and "Combined Don't Pass and Laying Odds". It states only the double-odds examples (0.572%, 0.455%), not these cap rows.

Figures that fit the built-ins:

- **Pass with odds and Three-point Molly** always take 10 odds behind a 10 base, which is exactly full 1x odds on every point. Their pass/come contracts therefore carry the engine's 1x figure, **0.85% of all money bet**, whatever the table's cap.
- **Don't pass with lay odds** always lays to win 10 on a 10 base, which is exactly full 1x lay odds. Its contract carries **0.68%**.
- The match to the 1x row follows from comparing the definition amounts (§4) with `oddsMultiple` for `1x` (`craps.ts:220-223`).

Adding odds lowers the percentage of all money bet. It does not lower the base bet's own edge. The engine still gives pass 1.41% and odds 0.00% separately (§2.1).

### 2.3 Payouts as the engine settles them

The script ran the guided built-ins over seeded streams (keys 0–79, up to 120 rolls), plus free-play field bets. It collected the `wager-settled` facts (net = profit, or −stake on a loss). The ratios come from `TRUE_ODDS` and `PLACE_PAYS` (`craps.ts:212-213`), `fieldPays` (`craps.ts:216`) and `settle` (`craps.ts:468-565`).

| Bet and stake | Engine net on a win | Ratio |
| --- | --- | --- |
| Pass, come, don't pass, don't come 10 | +10 | 1:1 |
| Odds 10 on 4 or 10 | +20 | 2:1 |
| Odds 10 on 5 or 9 | +15 | 3:2 |
| Odds 10 on 6 or 8 | +12 | 6:5 |
| Lay 20 against 4 or 10 | +10 | 1:2 |
| Lay 15 against 5 or 9 | +10 | 2:3 |
| Lay 12 against 6 or 8 | +10 | 5:6 |
| Place 6 or 8: 12 / 24 / 36 / 48 | +14 / +28 / +42 / +56 | 7:6 |
| Field 10 on 3, 4, 9, 10 or 11 | +10 | 1:1 |
| Field 10 on 2 | +20 | 2:1 |
| Field 10 on 12 | +30 (`triple-12`) or +20 (`double-12`) | 3:1 or 2:1 |
| Field 10 on 5, 6, 7 or 8 | −10 | loses |

Settlement details:

- A winning place bet **stays up**: only the profit is returned (`staysUp`, `craps.ts:535`).
- A winning line or odds bet returns stake plus profit (`craps.ts:484`).
- Place 4/10 pays 9:5 and 5/9 pays 7:5 (`craps.ts:213`). No built-in uses those numbers.
- Attached odds charge no commission (`craps.ts:524`; [#3 Answer](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274)).

Published agreement:

- [NJ DGE N.J.A.C. 13:69F-1.4(b)](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf) lists 1 to 1 for pass, don't pass, come and don't come, and 9 to 5, 7 to 5 and 7 to 6 for place bets. It also gives a field minimum of 2 to 1 on 2 and 12.
- [N.J.A.C. 13:69F-1.6(a)–(d)](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf) gives odds at 2 to 1, 3 to 2 and 6 to 5, and lay at 1 to 2, 2 to 3 and 5 to 6.
- [Bellagio Gaming Guide 2016, printed p. 14](https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf), "Odds", "Place Bets" and "Field Bets", matches. Its field pays 2-to-1 on 2 and 3-to-1 on 12.

### 2.4 Stakes, increments and caps (engine)

Line bets:

- Pass/don't pass are made only with the puck off, and come/don't come only with it on (`craps.ts:400-402`).
- Line stakes run 10–1,000 at the default limits (`craps.ts:403-407`).

Place bets:

- 6 and 8 go in multiples of 6, so the default range is 12–996. Other numbers go in multiples of 5, so 10–1,000 (`stakeIncrement`/`stakeLimits`, `craps.ts:272-306`; [#3 Q17](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316114)).
- The setup help repeats this: "Place 6 and 8 go in multiples of 6. Other place numbers go in multiples of 5. Odds follow the maximum odds instead." (`CrapsSetup.tsx` `GROUPS`)

Odds increments make every payout a whole unit (`craps.ts:414`, increment = the ratio's denominator):

- Taking: 4/10 any whole unit, 5/9 multiples of 2, 6/8 multiples of 5.
- Laying: 4/10 multiples of 2, 5/9 multiples of 3, 6/8 multiples of 6.

Odds caps (`oddsCap`, `craps.ts:229-232`):

- Taking odds max = base × multiple. Under 3-4-5x the multiple is 3 on 4/10, 4 on 5/9 and 5 on 6/8 (`oddsMultiple`, lines 220-223).
- Laying max = base × multiple × true odds. The laid odds win at most multiple × base, so under 3-4-5x the most you can lay is 6× base on every number.
- This matches [#3 Answer "Standard craps rules"](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316274).
- Published: NJ allows casinos to cap odds at 1× the base, or let a don't bet's odds win at most 1× the base, and permits up to 100× ([N.J.A.C. 13:69F-1.6(a), (b), (e)](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf)).

Commission: buy and lay commissions are not used by any built-in (`STANDARD_CRAPS.commission`, `craps.ts:36`).

### 2.5 Fit with the launch tables (engine)

- Every built-in declares all five odds caps (`LAUNCH_TABLE`, `craps-strategies.ts:6-9`). At default limits, `strategyTableCompatibility` reports each one compatible under 1x, 2x, 3-4-5x, 5x and 10x.
- At 1x, the Don't pass lay of 20 against 4 still fits, because the cap is "win 10".
- Raising the flat minimum to 15 rejects every built-in before guided play with `below-minimum`: pass/come 10 and place 12 are below 15.
- Setup words the rejection with `requirementText`/`limitRequirementText` (`CrapsSetup.tsx`). It never resizes the bets ([#3 Q17](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316114)).

## 3. Standard craps as the engine and app model it

### 3.1 Rules (engine `packages/engine/src/craps.ts`; tests `packages/engine/test/craps.cases.ts`, `craps-menu.cases.ts`)

Come-out and point (`resolveBase`, lines 438-449):

- On the come-out, 7 or 11 wins pass and loses don't pass.
- 2 or 3 loses pass and wins don't pass.
- 12 loses pass, and don't pass **pushes and stays on the table** (`'bar'`, which records a `wager-pushed` fact, lines 509-511). `STANDARD_CRAPS.dontBar` is 12.
- 4, 5, 6, 8, 9 or 10 sets the point (puck ON, lines 557-560).
- After that, pass wins if the point repeats before a 7, and don't pass wins if 7 comes first.

Published agreement:

- [N.J.A.C. 13:69F-1.2(a)1–2](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf) says the Don't Pass Bet "shall be void" on a come-out 12.
- [WoO basics, "Pass" and "Don't Pass"](https://wizardofodds.com/games/craps/basics/) says "A 12 is a push".
- [Bellagio printed p. 13](https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf) says "12 is a tie".
- Tableside keeps the pushed don't bet on the table for the next come-out (engine tests: "a come-out 12 loses pass while don't pass pushes and stays on the table").

Come and don't come:

- Made only while a point is on. They resolve on their own next roll like pass/don't pass (don't come also pushes on 12), or **move to the number rolled** as `come-N` / `dont-come-N` (lines 448, 512-516).
- Published: [N.J.A.C. 13:69F-1.2(a)3–4](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf); [Bellagio p. 13](https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf).

Contracts:

- Once its number is set, a pass/come base can't be lowered or taken down (`'committed-wager'`, lines 395-397). The app explains: "… is a contract now: it stays on the table until it wins on N or loses on 7. You can't lower it or take it down. You can add odds behind it." (`apps/mobile/src/play/craps-text.ts`, `commitmentText`)
- An established don't base can only be taken down, with its odds (lines 397-399; [#51 A9 §4](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191)).
- Published: [N.J.A.C. 13:69F-1.3(c)1](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf) forbids removing or reducing a pass/come bet after its point. [13:69F-1.3(d)](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf) lets don't bets be "removed or reduced" but not replaced or increased.
- **Tableside variance:** don't bets can be removed but not reduced.

Odds:

- Allowed only behind an established base (`'not-available-now'`, line 413).
- Pay true odds with no commission (line 524).

Working on the come-out (`worksByDefault`, lines 201-205; `isSwitchable`, 198-199; `setWorking`, 367-376):

| Bet | Default | Can the player switch it? |
| --- | --- | --- |
| Place and buy | Off on the come-out, working while a point is on | Yes |
| Come odds | Off on the come-out | Yes |
| Lay, hardways, don't come odds | Work on every roll | Yes |
| Line bases, pass/don't pass odds, field, propositions | Always work | No |

What an off bet does:

- An off place bet does nothing on that roll. A come-out 7 does not lose it; it simply stays (line 532).
- Off come odds whose base is decided on the come-out are **returned**. The script observed `come-N-odds … returned net 0`, from line 523.

Published agreement on working status:

- Place bets "inactive on any come out roll unless called 'on'" ([N.J.A.C. 13:69F-1.2(a)5](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf), [13:69F-1.3(e)](https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf)).
- [WoO basics, "Turning Bets On and Off"](https://wizardofodds.com/games/craps/basics/) lists place bets OFF, come odds OFF and don't come odds ON.
- **Tableside variance:** NJ 1.3(e) also makes hardways inactive on the come-out. Tableside's hardways work, per [#3 Q13](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315867).

Stopping (`requestStop`, lines 567-586):

- Every removable wager comes back.
- Pass/come bases with their number set stay, and settle by automatic rolls during final settlement.
- A stop during a revealed roll settles that roll first.

Other rules:

- Each roll is one turn of two dice from the random protocol (`roll`, lines 357-365).
- The field is a one-roll bet (lines 538-541).

### 3.2 What the craps screens offer (apps/mobile/src)

Setup (`apps/mobile/src/play/CrapsSetup.tsx`):

- **Mode:** "Free play" or "Guided practice". The guided help says "Guided practice pauses before a move that departs from your strategy, so you can retry or override it."
- **Strategy picker:** built-ins plus your own (`StrategyPicker`). It shows each definition's `note` and flags table conflicts.
- **TABLE RULES:**
  - Maximum odds: `1x`, `2x`, `3-4-5x`, `5x`, `10x`, default 3-4-5x. Help: "Odds behind a line bet pay true odds with no commission. Laid odds are capped by the amount they win."
  - Field payout: "2 double, 12 triple" (default) or "2 and 12 double". Help: "The field is one roll: 3, 4, 9, 10 and 11 pay even money and 5, 6, 7 and 8 lose."
- **TABLE LIMITS:** two groups, "Pass, come, place, buy, lay, field" and "Hardways and propositions", defaulting to `CRAPS_LIMITS`.
- **HOUSE EDGE:** the engine figures from §2, labelled as above.
- **"Learn this game"** entry (`LearnThisGame`).

Funding (`apps/mobile/src/play/setup/Funding.tsx`):

- **BUY-IN:** "Starting chips for this session", default `DEFAULT_BUY_IN` = 1000 units. Whole units from 1 to `FUNDING_CEILING` (1,000,000,000, `packages/engine/src/funding.ts:3`). Remembered per game: "Each session starts fresh."
- **Shortfall:** if the buy-in can't cover the table's smallest bet, or a guided strategy's opening bets, a shortfall banner explains it and offers "Set buy-in to …". Nothing is auto-added or resized ([#51 "Practice controller and session lifecycle"](https://github.com/0xRowdy/tableside/issues/51)).
- **Opening-bet check:** the opening is the strategy's come-out prescription (`strategyOpening`):
  - pass 10 for Pass with odds and Molly;
  - don't pass 10 for Don't pass with lay odds;
  - Flat place and Press-and-collect bet nothing on the first come-out, so there is no opening to check.
- **Training bankroll** (when access terms say so): "Your whole training bankroll funds this session, so there's no buy-in and no rebuys."
- **Rebuy** on the table: "Adds chips to this session. It counts as funding, not as a win." (`CrapsTable.tsx`; sheet in `RebuySheet.tsx`, which prefills the buy-in and caps it at the remaining headroom)

Table (`apps/mobile/src/play/CrapsTable.tsx`):

- **Top bar:** `"<odds> odds · field 12 pays 3:1|2:1 · <flat min>–<max> · props <min>–<max>"`.
- **House-edge line:** "House edge: pass and come 1.41% · don't pass and don't come 1.36% · odds 0% · every other wager shows its edge where you choose it".
- **Phase stepper:** "Come-out" (or "Betting" once the point is on) → "Roll" → "Settle".
- **Status words** (`craps-text.ts` `crapsStatus`): "Come-out roll", "Point N · betting", "Rolling", "Settled", "Strategy check", "Cycle ended", "Settling the strategy's contracts", "Final settlement", "Ended".
- **Presentation switch:** "Table" or "Bet list" (`bet-selector/Presentation.tsx`).
- **Felt:**
  - Puck ON/OFF and the last roll.
  - Number boxes 4–10, showing each bet's ON/OFF.
  - Tap spots for PASS LINE, PASS ODDS, DON'T PASS BAR 12, DON'T PASS ODDS, COME, DON'T COME · BAR 12 and FIELD.
  - A chip rack of 1, 5, 25, 100, 500 and 1K (`TableChrome.tsx` `CHIPS`), default 25.
  - A "Numbers and center bets" button that opens the bet selector.
- **Bet selector** (`bet-selector/BetSelector.tsx`, catalog `craps-catalog.ts`):
  - Each kind shows its payout, increments, come-out behavior and engine edge. For example, Place says "Pays 9:5, 7:5, 7:6 · 6 and 8 in multiples of 6, others in 5s · off on the come-out unless you turn it on".
  - Odds say "Behind an established bet · true odds, no commission · edge 0%".
  - −/+ steps by the bet's increment, "Set <bet> to N", and a working toggle where it is switchable.
  - "Your wagers" offers Edit, or Inspect for committed bets, with a "Why locked?" button on committed ones (`BetSelector.tsx`, `SmallButton label="Why locked?"`).
  - A drafted bet is labelled "Draft · not placed yet." until it is set (`CrapsTable.tsx`, `DRAFT_NOTE`).
- **Messages after a roll** (`describeCrapsFacts`):
  - "Rolled a and b: N."
  - "The point is N. Puck ON." / "Puck OFF. The next roll is a come-out roll."
  - "Come N moves to Come 8."
  - "… pushes on 12 and stays."
  - "Place 6 12 wins 14. It stays up."
  - "… was off and comes back."
  - "Place and buy bets are OFF for the come-out roll." / "… ON again."
  - "Come odds are OFF for the come-out roll."
  - A running "Balance N."
- **Ending:** "Contracts settle automatically … The dice roll on their own until every contract is settled." Strategy settlement says "They can't come down, and nothing new is bet: no odds or presses."
- **Guided controls:** the correction panel (Retry/Override), the pending panel (Rebuy / Override / "Collect instead" / Stop strategy) and the cycle result (Restart / Play on / End).

## 4. The five built-ins as the code defines them

All five definitions share these traits (`packages/definitions/src/craps-strategies.ts`):

- `format` 1, `revision` 1.
- Declared table: all five odds caps, limits 10–1,000 / 1–100 (lines 6-9).
- `parameters: []`, `stopWhen: null`, and no `completeWhen`.

Engine semantics that apply to every built-in:

- **Prescriptions** (`prescribe`, `packages/engine/src/strategy.ts:785-854`):
  - Every instruction whose `when` holds contributes its bets.
  - Each instruction's bets are an **atomic group**. If any bet in a group is over a cap, illegal at the table, or unaffordable, that whole group is held and nothing in it is resized.
  - No matching instruction means "uncovered": no new bets, and existing bets stay.
- **No stop condition:** with `stopWhen: null`, a craps built-in never stops itself. A cycle ends only when the player overrides a bet prescription, takes "Collect instead" on a pending action, or stops the strategy.
  - Every craps strategy ends its cycle on an override, because `CRAPS_VOCABULARY.overrideEndsCycle` is true (`craps-strategy.ts:99`; `overrideEndsCycle`, `activity.ts:933-934`; `override-correction`, `activity.ts:707-725`).
  - The player then restarts the cycle explicitly, or ends the session.
  - The cycle can also end through the envelope or a counter cap (`cycleEndAfter`, `activity.ts:864-870`), which the built-ins' `min(48, …)` keeps from triggering.
  - On a strategy stop or cycle end, removable wagers come back and pass/come contracts settle by automatic rolls ([#51 A10 item 1](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6664362161); engine test "an override ends the cycle; removable wagers come back and the pass line contract settles by automatic rolls before the cycle result").
- **Adjustments** (`progressAfter`, `strategy.ts:856-884`) run after each coached, settled roll while the strategy is active (`activity.ts:791-794`):
  - Each wager's result is win, loss or push by its net, or `none` if it was on the table but not decided (`wagerResults`, `activity.ts:824-832`).
  - Adjustments run **in declaration order**. Each `to` expression is evaluated against the counters **as they stood before the roll** (`const before`, line 865; evaluated at line 873).
  - Results are written in order, so a later write to the same counter wins.
  - `on: 'any'` matches every result, including `none` (line 868).

### 4.1 Pass with odds (`PASS_WITH_ODDS`, lines 18-39)

- **Initial state:** no counters.
- **Next action:**
  - Puck off (`point none`): "Pass line 10 on the come-out roll", giving `pass 10`.
  - Point N on with your pass base on: "10 odds behind your pass line once the point is set", giving `pass 10` + `pass-odds 10`. The pass 10 in that group restates the committed base; the engine accepts it only at its existing amount.
  - Point on without a pass base (for example, after joining mid-roll): uncovered, so no new bets until the next come-out (script: `PASS point 6, no pass base: uncovered`).
- **Outcome adjustments:** none. After any decision it repeats with pass 10.
- **Stakes and limits:** pass 10; odds 10 on every point, which is 1x and fits every cap. Most on the table: 20.
- **Stopping:** no stop condition. An established pass base can't be refunded; it settles automatically.
- **Engine trace** (test "pass with odds follows the pi stream — 8 sets the point, 8 makes it and pays 10 plus 12 odds", `craps-strategy.cases.ts`): balance 1000 → 990 after pass 10; → 980 with odds; point 8 made → **1022**, from pass +10 and odds +12 with stakes returned.
- **Tableside's own:** the exact sizing (10 + 10, 1x odds regardless of the table's maximum) was chosen in [#3 Q15](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316060). Pass with odds is a generic routine with no single published author.

### 4.2 Flat place 6 and 8 (`FLAT_PLACE_6_8`, lines 41-64)

- **Initial state:** counter `up` = 0.
- **Next action:**
  - Puck on: "Place 6 and 8, 12 each, once a point is on", giving `place-6 12` + `place-8 12` (one atomic group). This includes when 6 or 8 is the point; the engine test prescribes both at points 4, 6 and 8.
  - Puck off with `up` = 1: "Keep place 6 and 8 up, off, on the come-out" (`upOnComeOut`, line 16), giving the same two bets, which stay up and off.
  - Puck off with `up` = 0, which is the very first come-out or the come-out after a seven-out: uncovered, nothing bet. The guided roll proceeds with nothing at stake (engine test "a roll with nothing at stake is taken only while the strategy places nothing").
- **Outcome adjustments** (`UP_UNTIL_SEVEN_OUT`, lines 41-46), in order:
  1. `up-6` and `up-8`: on any result for place-6/place-8 (win, loss or not decided), `up` := 1.
  2. `seven-out-6` and `seven-out-8`: on a loss, `up` := 0.
  - On a seven-out both pairs match and the later `seven-out` write wins, so `up` = 0.
  - **Order matters here.** With the adjustments reversed, the script got `up` = 1 after a seven-out.
  - A win changes no stake. The 14 profit is paid and the bet stays up, which is "collect every win".
- **Stakes and limits:** 12 + 12 = 24. If only 20 is available, neither bet is placed (`unfunded-group`; engine test "an atomic group places completely or not at all — 20 places neither 12").
- **Stopping:** none built in. Place bets are removable, so a stop returns them.
- **Engine trace** (test "flat place 6 and 8 waits for a point, keeps its stakes up (off) through a made point and loses them on a seven-out"):
  - Settlements: place-6 +14, place-8 +14, then both −12 on the seven-out.
  - The script also observed a come-out 7 with the bets up and off: nothing settles and both stay up.
- **Tableside's own:** this is a spectator routine with no required line bet. Bets stay up and off through come-outs after a point is made, and are rebuilt only after a seven-out and a new point ([#3 Q15](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316060)).

### 4.3 Don't pass with lay odds (`DONT_PASS_WITH_LAY_ODDS`, lines 66-84)

- **Initial state:** no counters.
- **Next action:**
  - Puck off: "Don't pass 10 on the come-out roll", giving `dont-pass 10`.
  - Point 4/10 with your don't base on: "Lay 20 to win 10 against 4 or 10".
  - Point 5/9: "Lay 15 to win 10 against 5 or 9".
  - Point 6/8: "Lay 12 to win 10 against 6 or 8".
  - Each lay group is `dont-pass 10` + `dont-pass-odds` at that amount.
- **Outcome adjustments:** none.
- **Bar 12:** a come-out 12 pushes and the don't pass 10 stays. The next come-out prescribes `dont-pass 10` again, matching the bet already up (engine test "don't pass keeps its base through a bar-12 push and lays to win 10"; script trace key 2: `point off rolled 12 -> dont-pass push`).
- **Stakes and limits:** base 10. Lays of 20, 15 or 12 all win exactly 10, which is 1x on the amount to win, so they fit every cap. Lay increments: 20 is a multiple of 2, 15 of 3, 12 of 6. Most on the table: 30.
- **Settlement:** don't pass +10 when a 7 comes before the point; the lay odds win +10 whatever their size; both lose if the point repeats.
- **Stopping:** none built in. The established don't is a removable wager, taken down with its odds on a stop.
- **Tableside's own:** lay to win 10 is Tableside's sizing ([#3 Q15](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316060)). The routine never takes the established base down by itself.

### 4.4 Three-point Molly, bounded (`THREE_POINT_MOLLY`, lines 86-114)

- **Initial state:** no counters.
- **Next action.** Several instructions can match at once.
  - Puck off: `pass 10` (same come-out instruction as Pass with odds). No new come bet on a come-out.
  - Pass base on with a point: `pass 10` + `pass-odds 10`.
  - For each traveled come bet `come-N` that is on: "10 odds on your come bet on N", giving `come-N 10` + `come-N-odds 10`. This also matches on the come-out; the odds stay on the table but are off by default.
  - Puck on with 0 or 1 established come bases: "One more come bet of 10 while fewer than two come bets are working", giving `come 10`.
    - `come-bases` counts only traveled `come-N` bets (`craps-strategy.ts:92`).
    - There is only one `come` spot, so a come bet waiting in the come area is the second contract. At most two come bets are on at once, counting one in the come area.
  - Script prescriptions:
    - point 5, pass only → `come 10, pass 10, pass-odds 10`;
    - pass + come-6 → adds `come 10` and `come-6-odds 10`;
    - pass + come-6 + come-9 → no new come bet.
- **Outcome adjustments:** none. The roll settles completely before the next prescription is made, and replacement follows from the new situation.
- **Seen in the engine trace** (script key 0; engine test "three-point Molly keeps at most two come bases, odds on each, and settles the whole roll before replacing"):
  - The come bet moves to the point number in the same roll that pass wins on it.
  - On a seven-out, the come bet waiting in the come area **wins +10** while pass, pass odds, come-8 and come-8 odds lose. Its come-out rule pays a 7.
  - On a come-out 7, established come bases lose and their off odds are returned.
- **Stakes and limits:** 10 per base; 10 odds per established contract (1x). Most on the table: pass 10 + 10 odds + two come bets with 10 odds each = **60**, as observed.
- **Stopping:** none built in. It does **not** end at a seven-out; the next come-out starts a new pass bet. Pass/come contracts are never refunded by a stop.
- **Published system and Tableside's variant:** [Wizard of Odds "Three Point Molly" (Michael Shackleford), sections "Rules" and "Analysis"](https://wizardofodds.com/gambling/three-point-molly/) describes the system:
  - three numbers covered by pass and come bets;
  - odds "preferably the maximum multiple allowed";
  - come-bet odds turned off on a come-out;
  - a seven-out "marks the end of the session";
  - its analysis assumes full 3-4-5x odds.
  - Tableside's bounded variant differs: odds fixed at 10 (1x), not the maximum; at most two come bets of 10; play continues past a seven-out ([#3 Q15](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316060)).
  - The page's under-0.5% house advantage figure is for full 3-4-5x odds. It doesn't apply to Tableside's 1x variant, whose contracts carry 0.85% (§2.2).

### 4.5 Press-and-collect 6 and 8, capped (`PRESS_AND_COLLECT_6_8`, lines 116-153)

- **Initial state:** counters `stake-6` 12 (cap 48), `press-6` 0 (cap 1), `stake-8` 12 (cap 48), `press-8` 0 (cap 1), and `up` 0. Script `initialProgress` gives the same values.
- **Next action** (per number N, `pressed`, line 129: amount = the `stake-N` counter):
  - Puck on: "Place N at its current stake once a point is on".
  - Puck off with `up` = 1: "Keep place N up, off, on the come-out".
  - Puck off with `up` = 0: uncovered.
  - 6 and 8 are separate instructions, so one can be held while the other is placed. The engine test "a blocked press keeps the paid win …" shows place-8 prescribed while the place-6 press is held.
- **Outcome adjustments**, in order (line 150): `up-6`, `up-8`, `seven-out-6`, `seven-out-8`, then `press-6`, `alternate-6`, `reset-6`, `reset-press-6`, then the same for 8.
  - `press-N` (place-N win): `stake-N` := min(48, `stake-N` + 12 × `press-N`).
  - `alternate-N` (place-N win): `press-N` := 1 − `press-N`.
  - `reset-N` / `reset-press-N` (place-N loss, which is a seven-out): `stake-N` := 12, `press-N` := 0.
  - `up` behaves as in Flat place.
- **Why the order works:**
  - `press-N` runs before `alternate-N`, but both read the **before-roll** `press-N` (`strategy.ts:865`). So a hit adds 12 only when `press-N` was 1 *before* that hit, then flips the flag.
  - Reversing every adjustment gave the same win ladder (script).
  - Order does matter for `up`, as in Flat place.
  - A loss on place-N writes the two resets, and `seven-out-N` writes `up` := 0.
  - A come-out 7 with the bets off leaves every counter unchanged: the result is `none`, which matches only the `'any'` `up` adjustments (script: `come-out 7 with bets off` keeps `stake-6` 48, `press-6` 1).
- **Stake sequence per number**, from `progressAfter` in the script and engine test "press-and-collect collects the first hit, presses 12 on the second, per number, and a seven-out resets it" (`ladder` = `['12','12','24','24','36','36','48','48']`):

| Hit on that number | Stake that hit settles | Paid | Next stake (`stake-N`) | `press-N` after |
| --- | --- | --- | --- | --- |
| 1st | 12 | +14, all collected | 12 | 1 |
| 2nd | 12 | +14; stake raised by 12 | 24 | 0 |
| 3rd | 24 | +28, collected | 24 | 1 |
| 4th | 24 | +28; raised by 12 | 36 | 0 |
| 5th | 36 | +42, collected | 36 | 1 |
| 6th | 36 | +42; raised by 12 | 48 (cap) | 0 |
| 7th and later | 48 | +56 each, collected | 48 | alternates, no effect |
| Seven-out | Both stakes lose | | Both stakes 12, both flags 0 | |

- **How a press is paid:** the engine credits the full win to the balance (a place win stays up). On a pressing hit the strategy then raises the bet by 12 from the balance, so the player keeps 2 of the 14 on a 12 stake. The decision's phrase "add 12 from its second payout" gives the same result ([#3 Q15](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556316060); script trace key 0: balance 1004 → 1018 after a 6 hit at 12, then place-6 24).
- **What persists:** counters stay through a made point; bets stay up and off on the come-out (`up`); everything resets only at a seven-out.
- **Limits:**
  - Each number is at most 48; the definitions bound the table at 96 (48 + 48). The most observed in the script sample was 72.
  - 24, 36 and 48 are legal multiples of 6.
  - If a press can't be placed (table maximum or funds), the win stays paid, the stake and pre-press counters are kept, and a **pending action** waits ([#51 "Strategy execution semantics"](https://github.com/0xRowdy/tableside/issues/51); engine test "a blocked press keeps the paid win, the stake and the pre-press counters, and waits as a pending action").
  - "Collect instead" ends the cycle and takes the place bets down. It "pays nothing again" and waits for an explicit restart (engine test of that name).
- **Stopping:** none built in.
- **Tableside's own, entirely:** collect the first hit, press one 12 unit on alternate hits, per number, cap 48, reset on a seven-out ([#3 Q15](https://github.com/0xRowdy/tableside/issues/3#issuecomment-5556315998)). It is **not** a published or creator-branded system.
  - The 2026-09-05 note warns not to treat press/collect routines as Triple Lux or any Casino Quest system ([craps-strategies.md](craps-strategies.md) §"Casino Quest / CEG attribution").
  - No published source was found or used for this routine.

## 5. House-edge statement for the progression lessons

Required by [#48](https://github.com/0xRowdy/tableside/issues/48#issuecomment-5670773802) and [#53](https://github.com/0xRowdy/tableside/issues/53) "Lessons" and gate 9. Suggested statement, original wording: **"Changing your stakes doesn't remove the house edge. Every bet this strategy makes keeps its own edge, whatever its size."**

Engine figures behind it (§2):

- **Press-and-collect** uses only place 6 and 8: **1.52% per bet decided** at every stake, 12, 24, 36 or 48.
  - Pressing changes how much is exposed, not the edge.
  - The press amounts are Tableside's cap and reset (§4.5).
- **Three-point Molly** uses pass and come at **1.41%** each, with odds at **0.00%**. With its fixed 10 odds, each contract is **0.85% of all money bet** (1x row).
  - Adding come bets adds more 1.41% bets at once.
  - The odds lower the percentage of money bet, but not the base bet's own edge.

Published support:

- [Wizard of Odds, "The Truth about Betting Systems", section "The Martingale"](https://wizardofodds.com/gambling/betting-systems/): "No matter what system is used in the long run, this ratio will always approach the house edge." Also "all betting systems are equally worthless."
- [Wizard of Odds, "Three Point Molly", section "Analysis"](https://wizardofodds.com/gambling/three-point-molly/): Molly's low edge comes "not … via the betting system, but because the player is making very good bets to begin with."
- These pages support the general statement only. They say nothing about Tableside's variants.

## 6. External sources verified

Each page below was fetched on 2026-11-17 and checked to say what it is cited for.

| Suggested citation | URL | What it supports |
| --- | --- | --- |
| Michael Shackleford, Wizard of Odds, "How to Play Craps", sections "Pass", "Don't Pass", "Come, Don't Come", "Place", "Turning Bets On and Off", "Field Bet" and "Strategy" (combined-odds tables) | https://wizardofodds.com/games/craps/basics/ | Come-out and point rules; 12 push; come bet the same as pass; payouts; place OFF, come odds OFF and don't come odds ON on the come-out; field 2.78% / 5.56%; full-odds tables |
| Michael Shackleford, Wizard of Odds, "How the House Edge for Each Bet is Derived", sections "Pass/Come" and "Don't Pass/Don't Come" | https://wizardofodds.com/games/craps/appendix/1/ | −7/495 ≈ 1.414%; −3/220 ≈ 1.364% (1.403% excluding ties); combined-odds formulas |
| Michael Shackleford, Wizard of Odds, "Craps Odds: House Edge of Every Bet…", table "Craps House Edge" | https://wizardofodds.com/games/craps/appendix/2/ | Per bet made / resolved / per roll for pass, don't pass, odds and place; field variants |
| Michael Shackleford, Wizard of Odds, "Three Point Molly", sections "Rules", "Analysis" and "Improving on the Three Point Molly" (last updated Aug 03, 2026) | https://wizardofodds.com/gambling/three-point-molly/ | The published Molly rules Tableside's bounded variant departs from; "betting systems … don't even dent it" |
| Michael Shackleford, Wizard of Odds, "The Truth about Betting Systems", sections "Introduction" and "The Martingale" | https://wizardofodds.com/gambling/betting-systems/ | Changing stakes doesn't change the house edge |
| New Jersey Division of Gaming Enforcement, N.J.A.C. 13:69F-1.2(a)1–5 and 11; 1.3(c)–(e); 1.4(b); 1.6(a)–(e) (PDF pp. 2–6, 13–15 and 21–23; the DGE-posted PDF was created 2016-10-12, and the 1.3 heading is misprinted "13:6F-1.3") | https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf | Pass, don't pass, come and don't come rules; the void don't on 12; place bets inactive on the come-out; contract and don't removal rules; payouts; odds limits and payouts |
| Bellagio, "Gaming Guide 2016", Craps, printed pp. 13–14 ("Pass Line", "Don't Pass Line", "Come Bets", "Don't Come Bets", "Odds", "Place Bets", "Field Bets") | https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf | Plain-language rules; 12 is a tie; odds 2-to-1 / 3-to-2 / 6-to-5; place 9-to-5 / 7-to-5 / 7-to-6; place bets can be taken down before the next roll; field 2-to-1 on 2 and 3-to-1 on 12 |

Rights: these are reference-only factual sources. No manual text, illustration or branding may be reused ([content-rights decision, inventory table](../decisions/built-in-reference-content-rights.md)).

Casino Quest and Blackjack Apprenticeship: **none verified, none used.**

- **Blackjack Apprenticeship** covers blackjack only. No craps page exists to cite.
- **Casino Quest:**
  - [casinoquest.biz](https://casinoquest.biz/) shows only bookings and a shop.
  - Searching for a Casino Quest Three-Point Molly, place 6/8 press, pass odds or don't lay video found no video by that channel on these bets.
  - The one Casino Quest craps video tried ("Disciplined Way To Play Craps", https://www.youtube.com/watch?v=0e5SS1UCN0c) did not return its description, chapters or content.
  - Without a verifiable page or timestamp, nothing from Casino Quest can be cited.
- **CQ Nexus** (play.cqnexus.com) has a craps rules page. #48 names it as a **competitor**, and its ownership by Casino Quest is not confirmed, so it was not used.
- No copy may suggest that Casino Quest or BJA authored, endorsed or approved any Tableside strategy.

## 7. Lesson fact sheet

Each fact gives its source section in brackets. Percentages are engine figures under the default table (standard-craps v2, 10–1,000 flat, 1–100 props, field 2 double / 12 triple), shown as the app shows them. "Tableside variant" marks Tableside's own sizing, cap or reset.

### Craps basics

Facts the copy may use:
- On the come-out, 7 or 11 wins pass and 2, 3 or 12 loses it. Any of 4, 5, 6, 8, 9 or 10 becomes the point and the puck turns ON. Pass then wins if the point repeats before a 7 [§3.1].
- Don't pass is the reverse, except a come-out 12 is a push: the bet stays on the table ("bar 12") [§3.1].
- Come and don't come work like pass and don't pass but are made while a point is on. They move to the next number rolled [§3.1].
- Once its number is set, a pass or come bet is a contract: it can't be lowered or taken down. An established don't bet can only be taken down, with its odds [§3.1; Tableside variance from NJ noted].
- Odds go behind an established bet and pay true odds with no commission: 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8. Laying pays 1:2, 2:3 or 5:6. Odds have no house edge (0%) [§2.1, §2.3].
- Maximum odds are a table setting: 1x, 2x, 3-4-5x (default), 5x or 10x. Laid odds are capped by what they win; under 3-4-5x you can lay up to 6 times the base [§2.4, §3.2].
- Place 4/10 pays 9:5, 5/9 pays 7:5 and 6/8 pays 7:6. 6 and 8 go in multiples of 6, the others in 5s. A winning place bet stays up [§2.3, §2.4].
- Place and buy bets and come odds are off on the come-out unless you turn them on. Lays, hardways and don't come odds work on every roll. Line bets and one-roll bets always work. Off come odds come back if their bet is decided on the come-out [§3.1].
- The field is one roll. 3, 4, 9, 10 and 11 pay even money; 2 pays double; 12 pays triple by default or double by setting; 5, 6, 7 and 8 lose [§2.3].
- House edge, a property of the rules and not a prediction:
  - pass/come 1.41%; don't pass/don't come 1.36%; odds 0%;
  - place 6/8 1.52%, 5/9 4.00%, 4/10 6.67% per bet decided;
  - field 2.78% (5.56% if 12 pays double);
  - pass with full odds: 0.85% / 0.61% / 0.37% / 0.33% / 0.18% of all money bet at 1x / 2x / 3-4-5x / 5x / 10x;
  - don't pass with full odds: 0.68% / 0.45% / 0.27% / 0.23% / 0.12% [§2.1, §2.2].
- Default limits: 10–1,000 per bet or number for line, come, place, buy, lay and field; 1–100 per part for hardways and propositions. Odds follow the odds cap [§1, §2.4].
- Controls:
  - the felt spots and a chip rack of 1, 5, 25, 100, 500 and 1K;
  - "Numbers and center bets" opens the bet selector, which lists each bet's payout, increments, come-out behavior and edge, with −/+ steps and a working toggle;
  - "Table" / "Bet list" switch; "Roll" [§3.2].
  - a drafted bet isn't placed until it is set; committed bets offer "Why locked?" [§3.2].
- Turn phases: Come-out (or Betting) → Roll → Settle. Messages state each roll, point change, move, push and payout, then the balance [§3.2].
- Funding: a fresh buy-in per session (default 1,000 units, whole units). Rebuys add funding, not winnings. Training-bankroll sessions have no buy-in and no rebuys [§3.2].
- Ending: removable bets come back, and contract bets settle by automatic rolls [§3.1, §3.2].

Sources:
- Wizard of Odds, "How to Play Craps", sections Pass, Don't Pass, Come, Don't Come, Place, Turning Bets On and Off, Field Bet: https://wizardofodds.com/games/craps/basics/
- Wizard of Odds, "Craps Odds: House Edge of Every Bet…", table "Craps House Edge": https://wizardofodds.com/games/craps/appendix/2/
- NJ DGE, N.J.A.C. 13:69F-1.2(a), 1.3(c)–(e), 1.4(b): https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf
- Bellagio, Gaming Guide 2016, Craps, printed pp. 13–14: https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf

### Pass with odds

Facts the copy may use:
- Start: no state to track. On every come-out it bets pass 10 [§4.1].
- Once the point is set, it adds 10 odds behind the pass line. That is 1x odds, the same at every odds setting [§4.1, §2.4].
- If you join while a point is already on and have no pass bet, the strategy bets nothing until the next come-out [§4.1].
- Outcomes:
  - pass pays 10 on a win;
  - 10 odds pay 20 on 4/10, 15 on 5/9, 12 on 6/8;
  - both lose on a seven-out;
  - after any decision it starts again with pass 10 [§2.3, §4.1].
- Worked engine example: point 8 is set (balance 990 → 980 with odds), 8 repeats, and the balance is 1,022 [§4.1].
- Most on the table: 20. Fits every launch odds setting at default limits. A table with a minimum above 10 is rejected before guided play [§2.5, §4.1].
- Edge: pass 1.41% and odds 0%; together 0.85% of all money bet (the 1x row) [§2.1, §2.2].
- Stopping: the strategy has no stop condition. Your established pass bet can't be refunded and settles automatically [§4, §4.1].
- Tableside variant: the 10 + 10 sizing [§4.1].

Sources:
- Wizard of Odds, "How to Play Craps", sections Pass, The Odds and Strategy (table "Combined House Edge on Pass/Come & Taking Full Odds"): https://wizardofodds.com/games/craps/basics/
- Wizard of Odds, "How the House Edge for Each Bet is Derived", section Pass/Come: https://wizardofodds.com/games/craps/appendix/1/
- NJ DGE, N.J.A.C. 13:69F-1.6(a): https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf

### Flat place 6 and 8

Facts the copy may use:
- Start: nothing bet on the first come-out. The roll goes ahead with nothing at stake [§4.2].
- When a point is on, it places 6 and 8 at 12 each, including when 6 or 8 is the point. Both go on together or not at all: with 20 available, neither is placed [§4.2].
- Each hit pays 14 and the bet stays up at 12: every win is collected [§2.3, §4.2].
- After a point is made, both bets stay up but are off for the come-out. A come-out 7 doesn't lose them [§3.1, §4.2].
- A seven-out loses both (−12 each). The strategy then waits for a new point before placing again [§4.2].
- Most on the table: 24. Edge: 1.52% per bet decided on each [§2.1, §4.2].
- Stopping: no stop condition; place bets are removable and come back when you stop [§4, §3.1].
- Tableside variant: no line bet, and the bets are kept up (off) through come-outs [§4.2].

Sources:
- Wizard of Odds, "How to Play Craps", sections Place and Turning Bets On and Off: https://wizardofodds.com/games/craps/basics/
- Wizard of Odds, "Craps Odds: House Edge of Every Bet…", table "Craps House Edge" (Place 6 and 8): https://wizardofodds.com/games/craps/appendix/2/
- NJ DGE, N.J.A.C. 13:69F-1.2(a)5 and 1.4(b): https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf
- Bellagio, Gaming Guide 2016, printed p. 14, "Place Bets": https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf

### Don't pass with lay odds

Facts the copy may use:
- Start: no state to track. On every come-out it bets don't pass 10 [§4.3].
- A come-out 12 pushes, and the 10 stays for the next come-out (bar 12) [§3.1, §4.3].
- After the point is set it lays odds to win 10: 20 against 4 or 10, 15 against 5 or 9, 12 against 6 or 8 [§4.3].
- A 7 before the point: the base wins 10 and the lay wins 10. If the point repeats, both lose [§2.3, §4.3].
- Most on the table: 30. The lays fit every launch odds setting because each wins only 10 [§2.4, §4.3].
- Edge: don't pass 1.36% and odds 0%; together 0.68% of all money bet (1x row) [§2.1, §2.2].
- You can take an established don't bet down, with its odds, but not change it. The strategy never takes it down by itself [§3.1, §4.3].
- Tableside variant: lay to win 10 [§4.3].

Sources:
- Wizard of Odds, "How to Play Craps", sections Don't Pass, Laying the Odds and Strategy (table "Combined House edge on Don't Pass/Come…"): https://wizardofodds.com/games/craps/basics/
- Wizard of Odds, "How the House Edge for Each Bet is Derived", section Don't Pass/Don't Come: https://wizardofodds.com/games/craps/appendix/1/
- NJ DGE, N.J.A.C. 13:69F-1.2(a)2, 1.3(d), 1.6(b): https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf
- Bellagio, Gaming Guide 2016, printed pp. 13–14, "Don't Pass Line", "Odds": https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf

### Three-point Molly (bounded)

Facts the copy may use:
- Start: no state to track. On a come-out it bets pass 10, and no come bet [§4.4].
- With a point on, it adds 10 odds behind pass. It makes one come bet of 10 while fewer than two come bets are working; a come bet waiting in the come area counts as one [§4.4].
- Each come bet that moves to a number gets 10 odds. On a come-out, come odds stay on the table but are off: a come-out 7 returns them while their come bets lose [§3.1, §4.4].
- The whole roll settles before it adds a replacement come bet [§4.4].
- On a seven-out, a come bet still in the come area wins 10 while the pass bet, the moved come bets and their odds lose [§4.4].
- Most on the table: 60 (pass and two come bets, each with 10 odds) [§4.4].
- Stopping: no stop condition, and a seven-out doesn't end it; the next come-out starts again. Contracts settle automatically if you stop [§4, §4.4].
- Tableside variant: at most two come bets, odds fixed at 10 (1x) rather than the maximum, and play continues past a seven-out. The published Molly (Wizard of Odds) takes maximum odds and treats a seven-out as the end of the session [§4.4].
- **House-edge statement (required):** changing your stakes doesn't remove the house edge. Pass and come bets keep their 1.41% edge and odds have none. With 10 odds each contract is 0.85% of all money bet, and adding come bets just puts more of those bets out at once [§2.1, §2.2, §5].

Sources:
- Wizard of Odds, "Three Point Molly", sections Rules and Analysis: https://wizardofodds.com/gambling/three-point-molly/
- Wizard of Odds, "The Truth about Betting Systems", section The Martingale: https://wizardofodds.com/gambling/betting-systems/
- Wizard of Odds, "How to Play Craps", sections Come, Don't Come and Turning Bets On and Off: https://wizardofodds.com/games/craps/basics/
- NJ DGE, N.J.A.C. 13:69F-1.2(a)3, 1.3(e), 1.6(c): https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf

### Press-and-collect 6 and 8 (capped)

Facts the copy may use:
- Start: 12 on each of 6 and 8. Each number keeps its own stake and its own "press next" flag. Nothing is bet until a point is on [§4.5].
- Per number, independently:
  - the first hit is collected (+14, stake stays 12);
  - the next hit is pressed: the stake goes up by 12, to 24;
  - then it alternates collect and press, 24 → 36 → 48;
  - at 48 every hit is collected (+56) [§4.5 table].
- Stakes and the press flags carry through a made point. The bets stay up but are off on the come-out, and a come-out 7 changes nothing [§4.5].
- A seven-out loses both bets and resets both numbers to 12 with the next hit collected [§4.5].
- Most on the table: 96 (48 + 48) [§4.5].
- If a press can't be placed because of the table maximum or your balance:
  - the win stays paid, the stake stays where it was, and the press waits as a pending action;
  - "Collect instead" ends the cycle and takes the place bets down [§4.5].
- Stopping: no stop condition [§4].
- Tableside variant: this exact routine (collect first, press one unit on alternate hits, 48 cap, reset on a seven-out) is Tableside's own. It is not a published or creator-branded system, including Casino Quest's [§4.5, §6].
- **House-edge statement (required):** changing your stakes doesn't remove the house edge. Place 6 and 8 keep their 1.52% edge per bet decided at 12, 24, 36 or 48. Pressing changes how much is at risk, not the edge [§2.1, §5].

Sources:
- Wizard of Odds, "Craps Odds: House Edge of Every Bet…", table "Craps House Edge" (Place 6 and 8): https://wizardofodds.com/games/craps/appendix/2/
- Wizard of Odds, "The Truth about Betting Systems", sections Introduction and The Martingale: https://wizardofodds.com/gambling/betting-systems/
- NJ DGE, N.J.A.C. 13:69F-1.2(a)5 and 1.4(b): https://www.nj.gov/oag/ge/docs/Regulations/CHAPTER69F.pdf
- No source for the routine itself. It is Tableside's own, decided in #3 Q15, which is an internal decision and not a user-facing credit.

## Unverified or open

- **No Casino Quest or Blackjack Apprenticeship source.** None could be verified for any of these bets or strategies (§6). The lessons cite Wizard of Odds, NJ DGE and Bellagio only.
- **NJ DGE PDF date.** The posted PDF was created in 2016, and the current N.J.A.C. text was not checked. Cite it as a regulator rule example, not current legal advice.
- **Bellagio guide date.** The guide is the 2016 edition and describes one operator's tables, not every casino.
- **Wizard of Odds full-odds figures.** The per-cap figures come from the "How to Play Craps" Strategy tables. Appendix 1 gives only the formulas and the double-odds examples.
- **Built-in display names.** The definitions are named "Three-point Molly" and "Press-and-collect 6 and 8". "bounded" and "capped" appear only in the lesson slot titles (`packages/definitions/src/lessons.ts`).

## 8. Worked examples (engine replay)

Each strategy lesson's worked example (`packages/definitions/src/lessons/craps.ts`) is replayed at build time by `strategyStepProblems` (`packages/definitions/src/strategy-examples.ts`). The replay uses guided practice on standard craps at 3-4-5x with 1,000 practice funding and the scripted dice stacked into engine state. Each scripted explanation must equal the engine's, and each choice's correct/incorrect mark must match the engine's correction, or the build fails. The payouts quoted in the choice notes come from §2.3: a lay of 10 against 4 wins 5, and a lay of 40 wins 20.

| Lesson | Scripted rolls | Engine's next bet |
| --- | --- | --- |
| Pass with odds | pass 10, roll 2+4 (point 6) | pass 10 + pass odds 10 |
| Flat place 6 and 8 | nothing on the come-out, roll 1+3 (point 4); place 6 and 8 at 12, roll 2+4 (6 wins 14) | place 6 and 8 at 12 (available 1,014) |
| Don't pass with lay odds | don't pass 10, roll 1+3 (point 4) | don't pass 10 + lay 20 |
| Three-point Molly | pass 10, roll 2+3 (point 5); pass odds 10 and come 10, roll 3+3 (come moves to 6) | come 10, come 6 with 10 odds, pass with 10 odds |
| Press-and-collect 6 and 8 | nothing, roll 1+3 (point 4); 12 each, roll 3+3 (collect); 12 each, roll 2+4 (press) | place 6 at 24, place 8 at 12 |

Craps basics has no worked example, because it has no strategy decision to replay.

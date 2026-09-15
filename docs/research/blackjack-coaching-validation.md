# Blackjack coaching reference validation

Research dates: 2026-09-06 (partial evidence) and 2026-09-14 (continuation). Evidence for [Blackjack coaching reference validation](https://github.com/0xRowdy/true-count/issues/15), following [coverage research](blackjack-coaching-coverage.md). **Keep Blackjack coaching reference validation open: the launch basic-strategy and legal-fallback tables are generated and independently compared for all four presets, and Illustrious 18 / Fab 4 thresholds are generated under the accepted true-count convention with a second-source comparison, but four generation-methodology choices still need user acceptance and the index thresholds are not certified for multi-card hands or post-split play.**

Scripts, generated CSVs and exact commands are in [`experiments/blackjack-coaching-validation/`](../../experiments/blackjack-coaching-validation/README.md).

## Result

| Item | Status |
| --- | --- |
| Composition-dependent action values, fresh six-deck shoe, S17 and H17 | **Independently validated**: all 3,300 stand/hit/double values (550 two-card hands × 3 actions × 2 rules) agree with Wizard of Odds Appendix 9 to within one unit in the sixth decimal (max 0.00000062). |
| Split values | **Discrepancy resolved**: the calculator's split values are exact for the "resplit to four hands" convention (confirmed by an independent Monte Carlo to 0.000001 for T,T vs 10); the comparator's split values follow a different resplit model and differ by up to 0.0566 for ten pairs and by at most 0.0008 for other pairs. No pair decision differs between the two value sets in any preset. |
| Total-dependent basic strategy, four presets (hard, soft, pairs, surrender) | **Generated and independently compared**: 0 of 330 teaching cells per preset differ from Wizard's published 4–8-deck S17/H17 instructions; 4 cells differ from the BJA generic charts' base actions, each explained by a rule-specific margin. |
| Legal-fallback table (double, split by rule, split by balance, surrender unavailable) | **Generated from the validated values**; the balance-caused column has no published comparator, so it is validated by construction only. |
| Illustrious 18 and Fab 4 thresholds under the accepted true-count convention | See [Index thresholds](#index-thresholds): generated for S17 and H17 with a second-source comparison and configuration/continuation stability checks; not certified. |
| Methodology beyond the accepted objective | **Four proposals awaiting user acceptance** (state weighting, teaching continuation, tie handling, tolerance). |

## Fixed inputs

The final Answer of [Launch game rules and practice strategies](https://github.com/0xRowdy/true-count/issues/3) supersedes older proposals:

- Six decks, 3:2 naturals, US hole card/peek, S17/H17 × late surrender off/on. Default S17/LS.
- Double any initial two cards of eligible hands, DAS, no double-for-less. Split equal values including mixed tens, maximum four hands; no ace resplitting, one card to split aces, no double on split aces; split 21 is ordinary 21.
- Surrender only original two-card hands after a required negative peek. Insurance precedes peek and may coexist with subsequent legal surrender.
- No burn. Count only exposed cards; reveal the dealer hole card at round end. Negative peek is information, not an exposed rank.
- Physical shoe cards determine the nearest-half-deck denominator, ties upward, minimum 0.5. Truncate RC/divisor toward zero. Recompute at each decision.
- Penetration 50/55/60/65/70/75/80%, default 75%, finish the cut-card round; zero to four other players using rule-specific basic play.
- I18 situation list plus F4 in LS presets; numeric thresholds and sign exceptions are what this report validates.

[Intuitive executable strategy creation](https://github.com/0xRowdy/true-count/issues/5) requires a validated legal fallback when a strategy supplies none, including insufficient balance as a cause of an unavailable double or split. The accepted coaching objective ([issue #15 comment, 2026-09-09](https://github.com/0xRowdy/true-count/issues/15)) is the action with the highest expected net return per original bet; never a lower-return action solely to reduce bankroll risk.

## Executable reference obtained

[Eric Farmer's blackjack repository](https://github.com/possibly-wrong/blackjack/tree/a1f7dbb74266fb39296292bdff568b076120a61c), checked out at `a1f7dbb74266fb39296292bdff568b076120a61c`, identifies itself as version 7.6 and provides GPL-3.0-or-later source. Its `BJPlayer` engine computes exact composition-dependent expected values for every player hand against every up card for an arbitrary shoe composition, conditioned on no dealer blackjack, under the accepted doubling/split restrictions. Its readme states that split expected values "are now exact for both CDZ- and CDP for splitting up to a maximum of 4 hands" (revision 6.0 note) and its split routine follows the author's published algorithm. [Pinned readme](https://github.com/possibly-wrong/blackjack/blob/a1f7dbb74266fb39296292bdff568b076120a61c/readme.txt), [pinned engine](https://github.com/possibly-wrong/blackjack/blob/a1f7dbb74266fb39296292bdff568b076120a61c/src/blackjack.cpp)

Its index adapter is **not used**: `trueCount` in `indices.cpp` includes the concealed card in its remaining-card pool, returns a non-integer quotient, and approximates exposed-card removal after splits. [Pinned index implementation](https://github.com/possibly-wrong/blackjack/blob/a1f7dbb74266fb39296292bdff568b076120a61c/src/indices.cpp#L109) This report replaces it with its own sampler and conversion (below) and only calls the engine for action values. The checkout stays outside the repository; a small research driver (`farmer_driver.cpp`) is compiled against it. Toolchain: g++ 16.2.1, Python 3.14.7; one engine evaluation of a six-deck shoe takes about 0.22 s on the research machine.

## Generation methodology

**Accepted (not a proposal):** the objective is the highest expected net return per original bet; legal and funding restrictions apply through the validated legal fallback. Everything below is a **proposal for the user to accept or replace**, with the alternative that was rejected and why.

### Proposal 1: state and configuration weighting

Generate each index threshold from the distribution of shoe compositions that actually occur at round starts in the **default configuration** (six decks, 75% penetration finishing the cut-card round, learner alone, everyone playing the preset's total-dependent basic strategy). Each sampled composition is weighted by its frequency (sampling is stratified by pre-round true count and reweighted by stratum population) and by the probability that the situation's two cards and the up card are dealt from it and the dealer does not have blackjack. Thresholds are generated separately for S17 and H17 and shared by the LS and no-LS presets (surrender never changes the stand/hit/double/split comparison; Fab 4 exists only in LS presets). Stability is then checked at 50% and 80% penetration, with four other players, and with H17/no-LS play during sampling; any threshold that moves under those configurations is reported rather than averaged away.

Rejected alternatives: (a) a single fixed depth or uniform weighting over depths, as in hand-derived indices, because it over-weights deep, rare shoes and does not represent the learner's actual exposure; (b) separate thresholds for every one of the 7 penetrations × 5 player counts × 2 rule sets, because the stability check (below) is the evidence for whether that complexity buys anything, and a curriculum that changes with the seat count is not teachable.

### Proposal 2: teaching continuation policy

Evaluate every candidate action assuming the learner **continues with the preset's total-dependent basic table** for later decisions in the same hand and on split hands: hit/stand/double by hand total, resplit up to four hands whenever the table prescribes split, one card to split aces. This is the "tdb" continuation in the scripts. For the split value of a pair whose basic action is not split (T,T at its index), the convention is that the learner resplits to the cap, the same convention every published calculator uses.

Rejected alternative: composition-dependent optimal continuation (CDZ-, what the calculator and Wizard's tables use), because the learner is taught total-dependent play and the coaching should not credit decisions the curriculum never teaches. The measured effect is small: on a fresh shoe the two continuations change no basic cell and change hit values by at most 0.00083 (hard 9 as 4,5 vs 10); the index comparison below reports both continuations so the difference in thresholds is visible.

### Proposal 3: tie handling

Two compared actions are a **tie** when their expected-return difference is within the tolerance of Proposal 4. Ties are resolved toward the action that is **not** the deviation and does not add a wager: for basic cells, stand/hit over double/split/surrender; for an index bin, toward the basic action, so a tie at the candidate threshold moves the threshold up by one true count. Rejected alternative: resolve toward the deviation so learners practise more deviations; rejected because the accepted objective is expected return and a tie has none, so adding wager exposure or a curriculum entry with no expected gain is unjustified (this is a no-benefit argument, not a bankroll-risk argument).

### Proposal 4: numeric tolerance

**0.001 of the original bet** is the absolute tolerance for calling two actions different, and an index bin is decisive only if its mean advantage exceeds max(0.001, 2 × its standard error). Justification: the calculator's non-split values agree with an independent program to 6 × 10⁻⁷ and its split values agree with an independent simulation within simulation error (≈ 7 × 10⁻⁴), so 0.001 is above the numerical noise of the reference but below every basic-strategy margin in the four presets (smallest: hard 12 vs 4, stand by 0.00269 under S17). Rejected alternatives: 0.0001 (below the statistical error of sampled index bins, so bins would flip with the random seed) and 0.01 (would declare ties for several genuine basic cells such as A,7 vs 2 at 0.0030 and 15 vs 10 surrender at 0.0035).

## Fresh-shoe comparison against Appendix 9

Comparator: Wizard of Odds Appendix 9, six decks, [S17](https://wizardofodds.com/games/blackjack/appendix/9/6ds17r4/) and [H17](https://wizardofodds.com/games/blackjack/appendix/9/6dh17r4/), retrieved 2026-09-14 (both pages "last updated Aug 03, 2026"). Both state six decks, resplit to four hands except aces, no drawing to split aces, values "created using a recursive combinatorial program that considered the exact hand composition at every step", and: "For splitting values the program only considered how many hands the player had already split, but not the other cards drawn in those hands."

All 550 two-card hands (450 non-pair, 100 pair) × stand/hit/double under S17 and H17 were compared (`compare_appendix9.py`). Every one of the 3,300 values differs from the published six-decimal value by less than 0.00000062; 3,215 differ by at most 0.0000005 (the comparator's own rounding), and the remaining 85 differ by 0.00000050–0.00000062, i.e. one unit in the last printed digit. The two H17 T,T outliers reported on 2026-09-06 (0.000000592 and 0.000000555) belong to this population and are no longer exceptional. The H17 table prints `--0.453428` for T,T vs A split; the parser normalises the double sign and the value is otherwise consistent.

## Split-value discrepancy resolved

The eight split disagreements from the partial report are not eight cases: **all 100 pair cells differ** from the comparator in both rule sets, with a clear structure.

| Pair group | Absolute difference, calculator minus Wizard (DAS column) | Direction |
| --- | ---: | --- |
| 2,2 to 9,9 (90 cells, both rules) | 0.00001 to 0.00083 | mixed sign |
| T,T vs 5 and 6 | 0.0041 to 0.0058 | calculator higher |
| T,T vs 2, 3, 4, 7 | 0.0095 to 0.027 | calculator higher |
| T,T vs 8, 9, 10, A | 0.042 to 0.057 | calculator higher |

Evidence about the cause:

1. **Not the post-split strategy.** The calculator's three post-split conventions (CDZ-, CDP1, CDP) give the same 100 differences to within 0.0002 of each other, and the fixed total-dependent continuation (Proposal 2) moves 8,8 vs 10 by only 0.00016 toward the comparator. Wizard's DAS=No column shows the same pattern against a no-DAS engine run.
2. **The calculator is exact for the four-hand resplit convention.** An independent Monte Carlo simulator (`mc_check.py`, no shared code) that resplits whenever a pair card is drawn up to four hands and plays every hand by the S17 total-dependent table gives T,T vs 10 split = −0.363249 ± 0.000702 (8 million rounds, 7,378,702 kept after excluding dealer blackjacks); the calculator's value under the same continuation is −0.363250. Never resplitting gives +0.052636 ± 0.000531, so the published −0.419582 is below both the always-resplit-to-four value and the never-resplit value. (The remaining Monte Carlo cells and the resplit-cap diagnosis are reported in the [Monte Carlo table](#independent-monte-carlo-results).)
3. **The comparator documents an approximation.** Its own methodology sentence quoted above says split values ignore the other cards drawn in split hands and track only the number of hands already split. The calculator's algorithm accounts for pair and non-pair cards removed by the other split hands exactly, per its readme. The magnitude ordering (largest for ten pairs against 8–A, where every extra resplit of tens costs about half a bet) is consistent with the comparator's resplit weighting differing from the exact four-hand model; the exact rule inside the comparator cannot be identified from published material.

Consequences and recommendation:

- **No teaching decision changes.** Ranking every pair cell's actions with the comparator's values and with the calculator's gives the same best action in all 400 pair-cell/preset combinations (`check_pair_flips.py`). The closest pair decisions are 3,3 vs 2 (split by 0.0089 under S17) and 3,3 vs 8 (hit by 0.0114).
- **Convention for the True Count reference:** use the calculator's exact split value under Proposal 2 (total-dependent continuation, resplit to four hands whenever the taught table says split, one card to split aces, DAS except on aces). Do not use the comparator's split values as a numeric reference; use them only as a decision-level cross-check, which they pass.
- For the I18 ten-splitting situations the two value sets differ by 0.0058 (T,T vs 5) and 0.0041 (T,T vs 6) on a fresh shoe; the generated thresholds below use the calculator.

## Generated launch reference

### Total-dependent basic strategy

`generate_basic_tables.py` produces, for each preset (`S17_LS`, `S17_noLS`, `H17_LS`, `H17_noLS`), the action with the highest expected net return per original bet for every hard total 5–19, soft total 13–20 and pair against every up card, from the fresh-shoe composition-dependent values with the compositions of a total weighted by their dealing probability conditioned on no dealer blackjack (hard totals over non-pair two-card compositions; pairs on their own composition). Files: `basic_<preset>.csv` (values, margins, fallbacks), `tables_<preset>.md` (grids). Symbols: S stand, H hit, D double else hit, Ds double else stand, P split, Rh/Rs/Rp surrender else hit/stand/split.

The four presets differ in exactly these cells (`diff_presets.py`):

| Change | Cells |
| --- | --- |
| S17 → H17 | hard 11 vs A: H → D (0.0124); hard 15 vs A: H → Rh (0.0083); hard 17 vs A: S → Rs (0.0133); 8,8 vs A: P → Rp (0.0140); A,7 vs 2: S → Ds (0.0032); A,8 vs 6: S → Ds (0.0099) |
| LS → no LS | hard 16 vs 9/T/A and hard 15 vs T: Rh → H; under H17 also hard 15 vs A: Rh → H, hard 17 vs A: Rs → S, 8,8 vs A: Rp → P |

Margins in parentheses are the expected-return advantage of the chosen action over the runner-up.

**Independent comparison.** Against Wizard of Odds' published [4–8 deck instructions](https://wizardofodds.com/games/blackjack/strategy/4-decks/) (separate S17 and H17 lists, DAS), **0 of the 330 teaching cells differ in any of the four presets** (`compare_basic_sources.py`; hard 5–19, soft 13–20, ten pairs, ten up cards). Against the [BJA S17](https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_S17.pdf) and [BJA H17](https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf) 2018 charts read as base actions, four cells differ, all explained by rule-specific values:

| Preset | Cell | Generated | BJA base | Margin |
| --- | --- | --- | --- | ---: |
| S17_LS | A,7 vs 2 | S | Ds | 0.0030 |
| H17_LS | hard 15 vs A | Rh | H (BJA index "−1+") | 0.0083 |
| H17_LS | 8,8 vs A | Rp | P | 0.0140 |
| H17_LS | A,8 vs 6 | Ds | S (BJA index "0−") | 0.0099 |

The first confirms the S17 discrepancy already identified in the coverage report; the H17 cells are cases where BJA's generic chart carries an index instead of the rule-specific basic action. Wizard's H17 list agrees with the generated cells in all four.

Validation status: **generated by the calculator and independently compared** at the value level (Appendix 9) and at the decision level (Wizard's instructions, BJA). The eight surrender cells are decided against −0.5 after a negative peek; the closest are hard 15 vs T (surrender by 0.0035) and hard 16 vs 9 (0.0046) under S17.

### Legal-fallback table

Each `basic_<preset>.csv` row carries the validated next-best legal action for every way the prescribed action can be unavailable:

| Column | When it applies | Candidates |
| --- | --- | --- |
| `fallback_double` | double unavailable on a post-split hand, or balance-limited where surrender is not legal | S, H |
| `fallback_double_ls_original` | double unavailable (balance) on an original two-card hand in an LS preset | S, H, R |
| `fallback_split_rule` | split unavailable because four hands are reached or aces cannot be resplit: the hand is a post-split hand, no surrender, double allowed (DAS) except on split aces, which must stand | S, H, D (A,A: forced S) |
| `fallback_split_balance` | split unavailable because the balance cannot fund another wager: the double is then also unaffordable | S, H, R (original hand, LS) |
| `fallback_surrender` | surrender prescribed but unavailable (post-split hand, or after a hit) | S, H, D, P |

Cells where the cause of unavailability changes the answer:

- **8,8 vs 9, T, A (S17) and 8,8 vs 9, T (H17):** split unavailable by the four-hand cap → hit; unavailable by balance on the original hand → **surrender** (−0.5 beats hit at −0.5354 vs T and −0.5136 vs A under S17). Under H17, 8,8 vs A prescribes surrender outright; if surrender is unavailable on a post-split 8,8 → split again (if hands remain) else hit.
- **A,A:** split unavailable by rule (resplit) → forced stand on the one-card hand; unavailable by balance → hit soft 12 (against every up card).
- Every "Ds" cell (A,7 vs 3–6; H17 A,7 vs 2 and A,8 vs 6) falls back to stand; every other double cell falls back to hit. No double cell's balance-limited fallback on an original LS hand is surrender.
- 5,5 is never split; its fallback when the double is unavailable is hit against 2–9 and it is already hit against T and A.

Validation status: **generated from independently validated values**; the balance-caused and split-cap fallbacks have no published comparator (no source publishes them), so they are validated by construction only. Surrender precedence for the fallback is only applied to original two-card hands, per the accepted rules.

### Continuation tables

`continuation_S17.csv` and `continuation_H17.csv` give the total-dependent action (S/H/D with S/H fallback) for hard 4–21 and soft 12–21 used as the teaching continuation (Proposal 2) by the driver's `tdb` mode, the sampler and the Monte Carlo simulator. Regenerating the basic tables with the `tdb` values instead of CDZ- values changes no cell (fixed point).

### Multi-card totals

The teaching tables and the index situations are total-dependent, but a hand reached by hitting has a composition the two-card aggregation does not see. On a fresh shoe under the taught continuation (`multihands_fresh_S17.csv`, `multihands_fresh_H17.csv`; stand minus hit, per original bet):

| Total vs up | Three- and four-card compositions | Range of stand − hit | Two-card cell |
| --- | --- | ---: | --- |
| 16 vs T | 10-3-3, 10-4-2, 9-4-3, 9-5-2, 8-4-4, 8-5-3, 8-6-2, 7-5-4, 7-6-3, 6-5-5, 6-6-4, 5-5-3-3, 4-4-4-4 | −0.0044 to +0.0102; positive for 9 of 13, negative when the hand holds a 6 or is 10-3-3 | hit by 0.0063 (S17) |
| 16 vs 9 | six compositions | −0.031 to −0.026 | hit by 0.038 |
| 15 vs T | six compositions | −0.039 to −0.027 | hit by 0.036 |
| 12 vs 4 | six compositions | +0.0058 to +0.0115 (S17); +0.0111 to +0.0174 (H17) | stand by 0.0027 (S17) |
| 13 vs 2 | four compositions | +0.020 (S17); +0.027 (H17) | stand by 0.015 |
| 13 vs 3 | three compositions | +0.044 to +0.048 (S17) | stand by 0.031 |

So the basic hit/stand teaching for these totals also holds for multi-card hands, and for the zero-index situations (16 vs T, 12 vs 4) multi-card hands favour the deviation action slightly earlier than two-card hands. The generated thresholds below use two-card compositions only; multi-card occurrences are **not** weighted into them (see Remaining work).

## Index thresholds

### Method (implements Proposals 1–4 under the accepted objective and conventions)

1. **Sampling** (`sample_shoe_states.py`). 400,000 six-deck shoes per configuration, cut card after ⌊312 × penetration⌋ cards, the round that reaches it finished before the shuffle, no burn card, every spot playing the preset's generated basic table, no insurance. At every round start the composition of the physical shoe is recorded; because all earlier cards are exposed by then, the pre-round running count is the negative of the tags of the cards remaining. Sampling is stratified by pre-round integer true count (reservoir of 2,500 per stratum, later capped to 1,200 for the main run and 400 for stability runs) and every stratum's population is kept, so the reweighted sample is unbiased for the round-start distribution. Default configuration: 75% penetration, learner alone: 17,287,008 rounds; population of the +5 stratum 192,948, +8 stratum 44,088.
2. **Situations.** Each I18/F4 situation is evaluated for every two-card composition of its total (hard 16: T-6, 9-7; 15: T-5, 9-6, 8-7; 14: T-4, 9-5, 8-6, 7-7; 13: T-3, 9-4, 8-5, 7-6; 12: T-2, 9-3, 8-4, 7-5; 11: 9-2, 8-3, 7-4, 6-5; 10: 8-2, 7-3, 6-4, 5-5; 9: 7-2, 6-3, 5-4; T,T). Pairs whose basic action is split (8,8; 6,6 against 2–6; 7,7 against 2–7) are excluded from the hard total because the pair decision takes precedence; 7,7 vs T and 5,5 are included because they are played as hard totals.
3. **State at the decision.** From a sampled composition C (minus the other players' initial cards when present), the situation's two cards and the up card are removed; the concealed hole card stays in the unseen pool the engine draws from. Running count = tags of every exposed card (earlier rounds, other players' initial cards, the learner's two cards, the up card). Divisor = physical cards remaining (C minus everything dealt this round, including the hole card) to the nearest half deck, ties upward, minimum 0.5. True count = quotient truncated toward zero. Weight = stratum population/sample × P(situation dealt from C) × P(no dealer blackjack | up card), the last factor because the decision is reached only after a negative peek.
4. **Values.** Engine values conditioned on no dealer blackjack, under the composition-dependent continuation (`cdz`) and under the taught total-dependent continuation (`tdb`, Proposal 2). Surrender is −0.5. Insurance is 3p − 1 with p the share of tens in the unseen pool after the learner's two cards and the ace are removed, evaluated over all 55 two-card learner hands with their dealing weights.
5. **Threshold.** Per integer true-count bin, the weighted mean of (deviation value − alternative value) with a standard error computed across sampled states (compositions of one state are correlated). The raw threshold is the smallest bin at or above which the mean is non-negative in every supported bin; the tolerance threshold applies Proposal 4 (a bin counts for the deviation only if its mean exceeds max(0.001, 2 SE)) and Proposal 3 (ties resolve toward basic). Bins with fewer than 200 sampled states are reported but not used. Direction conventions are Schlesinger's: stand/double/split/surrender at or above the threshold.

### Results

Status of every threshold below: **generated** under the documented methodology and **compared** with two published sources; **none is certified** (Proposals 1–4 are unaccepted and multi-card occurrences are unweighted). Values are the tolerance thresholds ("deviate at TC ≥ value"; for the negative-index plays and the basic-surrender plays, "keep the basic action at TC ≥ value, deviate below"); a raw threshold is shown in parentheses where the tie rule moved it. Published values: Schlesinger's I18/F4 as republished by Wizard of Odds (six-deck S17 simulation context, rounded true count), and the BJA 2018 S17/H17 charts (`published_indices.csv`).

[INDEX TABLE PENDING]

**Comparison with Schlesinger (S17, CDZ- continuation, default configuration).** Nine of the twenty-one non-insurance situations reproduce the published integer (T,T vs 5 = 5; 10 vs T = 4; 12 vs 3 = 2; 11 vs A = 1; 9 vs 2 = 1; 10 vs A = 4; 16 vs 9 = 5; 13 vs 3 = −2; 15 vs T surrender = 0). Twelve come out exactly **one true count higher**: 16 vs T (1), 15 vs T (5; raw 4 with a +0.0010 ± 0.0007 tie at 4), T,T vs 6 (5), 12 vs 2 (4), 9 vs 7 (4), 13 vs 2 (0), 12 vs 4 (1), 12 vs 5 (−1), 12 vs 6 (0), 14 vs T surrender (4), 15 vs 9 surrender (3; raw 2 with a +0.0002 tie), 15 vs A surrender (2). The mean disadvantage of deviating at the published integer in those twelve bins is, per original bet: 0.0037, 0.0010 (tie), 0.018, 0.0011, 0.0027, 0.0069, 0.0016, 0.0133, 0.0051, 0.0008, 0.0002 (tie), 0.0020. Only T,T vs 6 (0.018 ± 0.003) and 12 vs 5 (0.013 ± 0.001) are material; the others are within a few thousandths.

The offset is not an artefact of truncation: re-aggregating the same states with the comparator's convention (round half away from zero, `--round`) still gives the published value plus one in ten of the twelve cases (13 vs 2 and 12 vs 6 then match) and moves three previously matching cases up by one (T,T vs 5 → 6, 9 vs 2 → 2, 16 vs 9 → 6), leaving seven matches under rounding against nine under truncation. The mean exact quotient inside truncated bin k is k ± 0.33, so with a decreasing count density the exact crossovers lie about 0.3–0.9 above the published integers for two-card hands under this state distribution. The pipeline is exact at the state level: sampled zero-depth states reproduce the fresh-shoe values to 0.00e+00, and a decision-time RC of 0 selects pre-round shoes at RC −1 or −2 (the hand's own tags), which is why the zero bin does not equal the fresh-shoe value.

**H17.** Situations against 7, 8, 9 and T are identical under both rules (a dealer showing 7–T can never hold a soft 17), as in Appendix 9. Against A–6 the H17 thresholds move: T,T vs 6 → 4 (matches Schlesinger and BJA), 12 vs 2 → 3 (matches), 12 vs 4 → 0 (matches), 13 vs 2 → −1 (matches Schlesinger; BJA's "−1−" hits at −1, where the bin is a +0.0005 ± 0.0011 tie), 10 vs A → 3 (matches BJA H17), 12 vs 6 → −3 (two below Schlesinger's S17 value; bin −3 = +0.0025 ± 0.0010, bin −4 = −0.0127), 12 vs 5 → −1, 13 vs 3 → −2, 11 vs A → basic double with hit at TC ≤ −1 (bin −1 = −0.0165 ± 0.0011; BJA teaches plain double), 15 vs A surrender → basic surrender kept at TC ≥ −1 and hit below (matches BJA H17 "−1+"), 17 vs A and 8,8 vs A surrender at every supported bin (matches Wizard's H17 list; BJA splits 8,8 vs A).

**Running-count sign inside the zero bin (S17).** Under the accepted integer convention TC 0 spans RC −D+1 … D−1. Splitting the zero bin by RC sign gives (deviation minus alternative, per original bet): 16 vs T: RC<0 −0.0066, RC=0 −0.0024, RC>0 −0.0001; 12 vs 4: −0.0101, −0.0034, +0.0051; 15 vs T surrender: −0.0006, +0.0066, +0.0124; 16 vs 9 surrender: −0.0001, +0.0053, +0.0086. BJA's "0+" for 16 vs T (stand at positive RC) is therefore a tie (−0.0001) and its "0−" rules for 12 vs 4 and 15 vs T are right at negative RC and within 0.0034 at RC = 0. **Proposal (with Proposal 3):** adopt no running-count sign exceptions; the integer thresholds above already absorb the zero-bin structure to within 0.005, and the accepted convention defines the count as an integer true count.

**Insurance.** Exact evaluation of 3p − 1 over all 55 two-card learner hands and the sampled states (`indices_p75_n0_insurance_bins.csv`) gives TC +1: −0.0388 ± 0.0010, +2: −0.0166 ± 0.0012, +3: +0.0055 ± 0.0012, +4: +0.0272 ± 0.0013. The independent play simulation (`insurance_sim.py`, 300,000 shoes, about 1,000,000 ace rounds, no calculator) gives +2: −0.0152 ± 0.0054, +3: +0.0096 ± 0.0079, +4: +0.0580 ± 0.0094 (empirical share of tens under the ace 0.3283, 0.3365, 0.3527). Both place the index at **+3**, matching Schlesinger and BJA. (Within TC +3 every state has RC > 0, so no sign question arises.)

**Supplementary situations (not in the accepted curriculum, reported for the BJA comparison; S17 unless stated).** T,T vs 4: 7 (BJA 6+). A,8 vs 4: 4 (raw 3; BJA 3+). A,8 vs 5: 1 (BJA 1+). A,8 vs 6: 1 (BJA 1+); H17: basic double kept at TC ≥ 0, stand below (BJA "0−"). A,6 vs 2: 2 (raw 1; BJA 1+). 8 vs 6: 2 (BJA 2+). 16 vs A stand: 9 (BJA: none); H17 4 (BJA 3+). 15 vs A stand (H17): 6 (BJA 5+). 16 vs 8 surrender: 6 (BJA 4+). 16 vs 9 surrender: keep surrendering at TC ≥ 0, hit at ≤ −1 (BJA "−1−"). 16 vs T surrender: keep at TC ≥ −2 (BJA always). 16 vs A surrender: keep at TC ≥ −1 (H17: ≥ −5; BJA always). 8,8 vs T: surrender beats splitting at TC ≥ 3 (bin 3 = +0.0047 ± 0.0013), which no compared source teaches.

## Independent Monte Carlo results

`mc_check.py` shares no code with the calculator: it deals a fresh shoe minus the situation cards, discards dealer blackjacks, executes the initial action, continues with the taught total-dependent table (resplitting to four hands whenever a pair card is drawn, one card to split aces, DAS except on aces), plays the dealer and settles. 8,000,000 rounds per cell, seed 1, eight workers, about two to three minutes per cell on the research machine. "Calculator" is the engine value under the same continuation (`tdb`); "Wizard" is the Appendix 9 DAS column.

| Rules | Cell | Action | Monte Carlo ± SE | Calculator | MC − calc (SE) | Wizard | MC − Wizard (SE) |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| S17 | T,T vs T | split | −0.363249 ± 0.000702 | −0.363250 | 0.0 | −0.419582 | +0.0563 (80) |
| S17 | T,T vs 9 | split | −0.215673 ± 0.000661 | −0.215964 | +0.4 | −0.272562 | +0.0569 (86) |
| S17 | T,T vs 5 | split | +0.373053 ± 0.000867 | +0.371714 | +1.5 | +0.365917 | +0.0071 (8.2) |
| S17 | T,T vs 6 | split | +0.449599 ± 0.000858 | +0.449060 | +0.6 | +0.444942 | +0.0047 (5.4) |
| S17 | 8,8 vs T | split | −0.475002 ± 0.000686 | −0.475054 | +0.1 | −0.475385 | +0.0004 (0.6) |
| S17 | 8,8 vs A | split | −0.364665 ± 0.000692 | −0.364252 | −0.6 | −0.364371 | −0.0003 (0.4) |
| S17 | 2,2 vs 6 | split | +0.240434 ± 0.000948 | +0.240164 | +0.3 | +0.240682 | −0.0002 (0.3) |
| S17 | 8,8 vs T | hit | −0.535531 ± 0.000298 | −0.535361 | −0.6 | −0.535361 | −0.6 |
| S17 | T,T vs 5 | stand | +0.671136 ± 0.000234 | +0.670892 | +1.0 | +0.670892 | +1.0 |
| H17 | T,T vs 5 | split | +0.373184 ± 0.000868 | +0.371878 | +1.5 | +0.366222 | +0.0070 (8.0) |
| H17 | T,T vs 6 | split | +0.451884 ± 0.000870 | +0.450852 | +1.2 | +0.448590 | +0.0033 (3.8) |
| H17 | 8,8 vs A | split | −0.514745 ± 0.000766 | −0.514035 | −0.9 | −0.514318 | −0.0004 (0.6) |

All thirteen cells agree with the calculator within 1.5 standard errors; the four ten-pair split cells against 5, 6, 9 and T reject the comparator's values by 3.8 to 86 standard errors, and the non-ten pair cells cannot distinguish the two sources (differences below one standard error), which is consistent with the ≤ 0.0008 differences observed there.

Resplit-cap diagnosis for T,T vs T under S17 (same simulator, `--max-hands`): cap 2 (never resplit) +0.052636 ± 0.000531; cap 3 −0.207370 ± 0.000638; cap 4 (launch rule) −0.363249 ± 0.000702; cap 8 −0.609705 ± 0.000826; unlimited −0.697493 ± 0.000904. The comparator's −0.419582 lies between the exact four-hand and eight-hand values and matches no single cap, so the comparator's split routine is not a different cap but the approximation its page describes. The launch rule is four hands; the calculator's four-hand value is the one the reference uses.

## Conversion and reveal calculations

For integer physical shoe count `n`, the accepted divisor has the exact expression `D(n) = max(1/2, floor((n+13)/26)/2)`. An independent arithmetic check compared exact rational and direct floating-point implementations for `n=0..312`, `RC=−120..120`: **75,433 comparisons, zero mismatches** (2026-09-06). Divisor transitions occur at 39, 65, 91, 117, 143, 169, 195, 221, 247, 273 and 299 cards; counts 0–38 use 0.5. At 117 cards, D=2.5 and RC ±7 gives TC ±2; at 116, D=2 and the same RC gives TC ±3. At 117, RC −1, 0, +1 all produce TC 0, which is why the index results above report the running-count sign inside the zero bin.

Drawing a concealed card across 117→116 changes the divisor and possibly TC without changing RC. A negative peek changes neither physical shoe count nor RC, but conditions action probabilities on no blackjack. Revealing the hole card at round end changes RC by its tag without removing another card from the shoe. Insurance uses the pre-peek pool; surrender's −0.5 comparison applies only after blackjack is excluded. The sampler and evaluator implement exactly these semantics (`sample_shoe_states.py`, `evaluate_indices.py`).

```python
from fractions import Fraction
from math import floor, trunc
checked = 0
for n in range(313):
    exact_d = max(Fraction(1, 2), Fraction((n + 13) // 26, 2))
    direct_d = max(.5, floor(2 * (n / 52) + .5) / 2)
    assert exact_d == direct_d
    for rc in range(-120, 121):
        assert trunc(Fraction(rc) / exact_d) == trunc(rc / direct_d)
        checked += 1
assert checked == 75433
```

Insurance pays +2 or −1 per unit insured, so its conditional expected return is `3p − 1` with `p` the probability that the concealed card is ten-valued; break-even is `p = 1/3`. The 2026-09-06 example of two 79-card pools with identical RC +6, denominator 1.5 and TC +4 but insurance returns −1/79 and +2/79 still stands: a count does not identify one composition-optimal action, which is why Proposal 1 averages over reachable states.

## Reproducing

Exact commands, versions and file roles are in the [experiments README](../../experiments/blackjack-coaching-validation/README.md). Intermediate engine outputs (hundreds of MB) stay outside the repository; the committed CSVs are the parsed comparator, the generated tables and the aggregated index results.

## Remaining work

Nothing in this report is certified. What each remaining step needs is listed so the parent session can size it.

1. **User acceptance of Proposals 1–4.** Until state weighting, teaching continuation, tie handling and tolerance are accepted, the generated thresholds are the output of one documented methodology, not the reference. If a proposal is replaced, `run_all_indices.sh` regenerates every threshold in about two hours on the research machine; the basic and fallback tables do not depend on Proposals 1 and 3 and change only if the tolerance is set above the smallest basic margin (0.00269).
2. **Multi-card occurrences.** Thresholds weight two-card compositions only. Recording actual learner decisions (including three- and four-card totals and post-split two-card hands) during the sampling simulation and evaluating them with the driver's `--multihands` mode is one more sampling pass plus one engine pass per rule set; the fresh-shoe evidence above says the direction is known (earlier standing for 16 vs T and 12 vs 4) but the exact bin effect is not measured.
3. **Post-split application of indices.** A post-split two-card hand cannot surrender and its exposure differs; the Fab 4 never apply to it and the I18 stand/hit/double situations apply with the fallback columns. This report does not separately weight post-split states.
4. **Configurations not sampled.** Penetrations 55/60/65/70% and one to three other players were not sampled; the 50%/80% and four-player checks bracket them. The learner always sat first; seats after other players expose more cards before the decision and were not sampled.
5. **Resplit modelling for T,T at the index.** The split value assumes resplitting to four hands; a learner who re-evaluates the count after the first split and stops resplitting is not modelled. The effect is bounded by the difference between the always- and never-resplit values at the threshold and was not computed for depleted shoes.
6. **Balance-limited allocation across existing split hands.** The fallback table covers a single unaffordable double or split. A coupled policy for which of several live split hands should receive the last affordable double was not produced; it is a bankroll-allocation rule, not an expected-return comparison of one hand.
7. **End-to-end engine test.** The sampler implements the accepted reveal/peek/surrender/insurance order, but no test harness exercises the product engine against these tables; that belongs to the implementation, with this report's CSVs as fixtures.
8. **Freezing the record.** Once Proposals 1–4 are settled, freeze `basic_*.csv`, the fallback columns, `continuation_*.csv` and the accepted `indices_*_thresholds.csv` with the calculator commit, script versions and seeds recorded here, and record the resolution in the map.

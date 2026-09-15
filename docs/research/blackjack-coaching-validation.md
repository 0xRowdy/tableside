# Blackjack coaching reference validation

Research dates: 2026-09-06 (partial evidence), 2026-09-14 (continuation) and 2026-09-14 (final pass). Evidence for [Blackjack coaching reference validation](https://github.com/0xRowdy/true-count/issues/15), following [coverage research](blackjack-coaching-coverage.md). **Blackjack coaching reference validation is complete. Certified under the accepted methodology (issue #15, Q18–Q24, 2026-09-14): the total-dependent basic-strategy tables and legal-fallback columns for the four presets, the continuation tables, the split-value convention, and the 21 Illustrious 18 / Fab 4 thresholds plus the insurance index for S17 and for H17, generated over every occurrence of each situation (original two-card, multi-card and post-split hands) with second-source comparison, stability checks and independent Monte Carlo checks, and frozen in `reference-manifest.json`. Weighting multi-card and post-split occurrences changed no curriculum threshold, and no post-split value differs from its all-occurrence value beyond the tolerance. Explicitly implementation checks, not research: intermediate penetrations and seat positions, a learner who stops resplitting T,T after re-counting, the split-hand dealing order, and the end-to-end product-engine test. Eleven S17 thresholds are one true count above Schlesinger's published values (five of them only through the accepted tie rule); the accepted teaching policy teaches the generated values and states the difference and its cost.**

Scripts, generated CSVs and exact commands are in [`experiments/blackjack-coaching-validation/`](../../experiments/blackjack-coaching-validation/README.md).

## Result

| Item | Status |
| --- | --- |
| Composition-dependent action values, fresh six-deck shoe, S17 and H17 | **Independently validated**: all 3,300 stand/hit/double values (550 two-card hands × 3 actions × 2 rules) agree with Wizard of Odds Appendix 9 to within one unit in the sixth decimal (max 0.00000062). |
| Split values | **Discrepancy resolved**: the calculator's split values are exact for the "resplit to four hands" convention (confirmed by an independent Monte Carlo to 0.000001 for T,T vs 10); the comparator's split values follow a different resplit model and differ by up to 0.0566 for ten pairs and by at most 0.0008 for other pairs. No pair decision differs between the two value sets in any preset. |
| Total-dependent basic strategy, four presets (hard, soft, pairs, surrender) | **Accepted as validated** (issue #15, 2026-09-14): generated and independently compared; 0 of 330 teaching cells per preset differ from Wizard's published 4–8-deck S17/H17 instructions; 4 cells differ from the BJA generic charts' base actions, each explained by a rule-specific margin. |
| Legal-fallback table (double, split by rule, split by balance, surrender unavailable) and the split-hand funding rule | **Accepted as validated** (issue #15, 2026-09-14): generated from the validated values; the balance-caused column has no published comparator, so it is validated by construction only. Funding across live split hands follows the accepted play-order rule (Q24). |
| Illustrious 18 and Fab 4 thresholds under the accepted true-count convention | **Certified under the accepted methodology**: all 21 thresholds plus insurance generated for S17 and H17 from 34,967 sampled shoe states (two-card compositions) and 36.1 million recorded decision occurrences (multi-card and post-split hands weighted by their measured frequency), compared with Schlesinger's published values and the BJA charts, stable across penetration, seat count, sampling rules, continuation policy and integerization to within the tie zone, and frozen in `indices_S17_final.csv` / `indices_H17_final.csv`. Under S17 with the accepted taught continuation, ten curriculum values plus insurance match Schlesinger and eleven are one true count higher (five only through the tie rule); the disagreement bins cost 0.0000–0.019 per bet, only T,T vs 6 and 12 vs 5 materially, and the offset persists under the comparator's own rounding convention. Insurance +3 is also confirmed by an independent play simulation. |
| Multi-card and post-split occurrences | **Weighted in (final pass)**: multi-card hands are 42–49% of the learner's hard-16 and hard-15 decisions and 8–24% of hard-12/13 decisions; post-split hands are 2–10% of the double and hard-12/13 decisions. No curriculum threshold changed; the 16 vs T zero bin became an exact tie (resolved toward hitting, as accepted) because multi-card 16s favour standing there; no post-split-only value differs from the all-occurrence value beyond the tolerance. The multi-card engine path is confirmed by six independent Monte Carlo cells within 1.6 SE. |
| Frozen reference | `reference-manifest.json`: SHA-256 of every frozen file and script, calculator commit `a1f7dbb`, sampling seeds, sample sizes and generation date, verified against the committed files. |
| Methodology beyond the accepted objective | **Accepted on 2026-09-14** (Q18–Q24: state weighting, teaching continuation, tie handling, tolerance, teaching policy, certification scope, split-hand funding rule). |

## Fixed inputs

The final Answer of [Launch game rules and practice strategies](https://github.com/0xRowdy/true-count/issues/3) supersedes older proposals:

- Six decks, 3:2 naturals, US hole card/peek, S17/H17 × late surrender off/on. Default S17/LS.
- Double any initial two cards of eligible hands, DAS, no double-for-less. Split equal values including mixed tens, maximum four hands; no ace resplitting, one card to split aces, no double on split aces; split 21 is ordinary 21.
- Surrender only original two-card hands after a required negative peek. Insurance precedes peek and may coexist with subsequent legal surrender.
- No burn. Count only exposed cards; reveal the dealer hole card at round end. Negative peek is information, not an exposed rank.
- Physical shoe cards determine the nearest-half-deck denominator, ties upward, minimum 0.5. Truncate RC/divisor toward zero. Recompute at each decision.
- Penetration 50/55/60/65/70/75/80%, default 75%, finish the cut-card round; zero to four other players using rule-specific basic play.
- I18 situation list plus F4 in LS presets; numeric thresholds and sign exceptions are what this report validates.

[Intuitive executable strategy creation](https://github.com/0xRowdy/true-count/issues/5) requires a validated legal fallback when a strategy supplies none, including insufficient balance as a cause of an unavailable double or split. The accepted coaching objective ([issue #15 comment, 2026-09-09](https://github.com/0xRowdy/true-count/issues/15)) is the action with the highest expected net return per original bet; never a lower-return action solely to reduce bankroll risk. The generation methodology, teaching policy, certification scope and split-hand funding rule were accepted on 2026-09-14 as Q18–Q24 ([issue #15 comment "Accepted generation methodology and teaching policy — final pass authorized"](https://github.com/0xRowdy/true-count/issues/15)); the "Generation methodology" section records them, and this report's final pass implements Q23.

## Executable reference obtained

[Eric Farmer's blackjack repository](https://github.com/possibly-wrong/blackjack/tree/a1f7dbb74266fb39296292bdff568b076120a61c), checked out at `a1f7dbb74266fb39296292bdff568b076120a61c`, identifies itself as version 7.6 and provides GPL-3.0-or-later source. Its `BJPlayer` engine computes exact composition-dependent expected values for every player hand against every up card for an arbitrary shoe composition, conditioned on no dealer blackjack, under the accepted doubling/split restrictions. Its readme states that split expected values "are now exact for both CDZ- and CDP for splitting up to a maximum of 4 hands" (revision 6.0 note) and its split routine follows the author's published algorithm. [Pinned readme](https://github.com/possibly-wrong/blackjack/blob/a1f7dbb74266fb39296292bdff568b076120a61c/readme.txt), [pinned engine](https://github.com/possibly-wrong/blackjack/blob/a1f7dbb74266fb39296292bdff568b076120a61c/src/blackjack.cpp)

Its index adapter is **not used**: `trueCount` in `indices.cpp` includes the concealed card in its remaining-card pool, returns a non-integer quotient, and approximates exposed-card removal after splits. [Pinned index implementation](https://github.com/possibly-wrong/blackjack/blob/a1f7dbb74266fb39296292bdff568b076120a61c/src/indices.cpp#L109) This report replaces it with its own sampler and conversion (below) and only calls the engine for action values. The checkout stays outside the repository; a small research driver (`farmer_driver.cpp`) is compiled against it. Toolchain: g++ 16.2.1, Python 3.14.7; one engine evaluation of a six-deck shoe takes about 0.22 s on the research machine.

## Generation methodology

**Accepted methodology.** The objective is the highest expected net return per original bet; legal and funding restrictions apply through the validated legal fallback ([issue #15 comment, 2026-09-09](https://github.com/0xRowdy/true-count/issues/15)). Items 1–4 below were proposed by the 2026-09-14 progress report and accepted by the user on 2026-09-14 as Q18–Q21 ([issue #15 comment "Accepted generation methodology and teaching policy — final pass authorized"](https://github.com/0xRowdy/true-count/issues/15)), together with the teaching policy (Q22: True Count teaches its own generated thresholds under the accepted half-deck truncated true-count convention; where a taught value differs from the published Illustrious 18 / Fab 4 or BJA chart value, lessons and correction explanations state the difference and why), the certification scope (Q23: this final pass weights multi-card occurrences and post-split application into the thresholds and freezes the reference CSVs; intermediate penetrations and seat positions, a learner who stops resplitting T,T after re-counting, and the end-to-end product-engine test are implementation checks that use the frozen CSVs as fixtures) and the split-hand funding rule (Q24, recorded under the legal-fallback table). Each item keeps the rejected alternative that was weighed when it was proposed; none is a proposal any more, and no convention or tolerance was adjusted afterwards to move a threshold toward a published value.

### 1. State and configuration weighting (accepted, Q18)

Generate each index threshold from the distribution of shoe compositions that actually occur at round starts in the **default configuration** (six decks, 75% penetration finishing the cut-card round, learner alone, everyone playing the preset's total-dependent basic strategy). Each sampled composition is weighted by its frequency (sampling is stratified by pre-round true count and reweighted by stratum population) and by the probability that the situation's two cards and the up card are dealt from it and the dealer does not have blackjack. Thresholds are generated separately for S17 and H17 and shared by the LS and no-LS presets (surrender never changes the stand/hit/double/split comparison; Fab 4 exists only in LS presets). Stability is then checked at 50% and 80% penetration, with four other players, and with H17/no-LS play during sampling; any threshold that moves under those configurations is reported rather than averaged away.

Rejected alternatives: (a) a single fixed depth or uniform weighting over depths, as in hand-derived indices, because it over-weights deep, rare shoes and does not represent the learner's actual exposure; (b) separate thresholds for every one of the 7 penetrations × 5 player counts × 2 rule sets, because the stability check (below) is the evidence for whether that complexity buys anything, and a curriculum that changes with the seat count is not teachable.

### 2. Teaching continuation policy (accepted, Q19)

Evaluate every candidate action assuming the learner **continues with the preset's total-dependent basic table** for later decisions in the same hand and on split hands: hit/stand/double by hand total, resplit up to four hands whenever the table prescribes split, one card to split aces. This is the "tdb" continuation in the scripts. For the split value of a pair whose basic action is not split (T,T at its index), the convention is that the learner resplits to the cap, the same convention every published calculator uses.

Rejected alternative: composition-dependent optimal continuation (CDZ-, what the calculator and Wizard's tables use), because the learner is taught total-dependent play and the coaching should not credit decisions the curriculum never teaches. The measured effect is small: on a fresh shoe the two continuations change no basic cell and change hit values by at most 0.00083 (hard 9 as 4,5 vs 10); the index comparison below reports both continuations so the difference in thresholds is visible.

### 3. Tie handling (accepted, Q20)

Two compared actions are a **tie** when their expected-return difference is within the tolerance of item 4. Ties are resolved toward the action that is **not** the deviation and does not add a wager: for basic cells, stand/hit over double/split/surrender; for an index bin, toward the basic action, so a tie at the candidate threshold moves the threshold up by one true count. Rejected alternative: resolve toward the deviation so learners practise more deviations; rejected because the accepted objective is expected return and a tie has none, so adding wager exposure or a curriculum entry with no expected gain is unjustified (this is a no-benefit argument, not a bankroll-risk argument).

### 4. Numeric tolerance (accepted, Q21)

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

1. **Not the post-split strategy.** The calculator's three post-split conventions (CDZ-, CDP1, CDP) give the same 100 differences to within 0.0002 of each other, and the fixed total-dependent continuation (item 2) moves 8,8 vs 10 by only 0.00016 toward the comparator. Wizard's DAS=No column shows the same pattern against a no-DAS engine run.
2. **The calculator is exact for the four-hand resplit convention.** An independent Monte Carlo simulator (`mc_check.py`, no shared code) that resplits whenever a pair card is drawn up to four hands and plays every hand by the S17 total-dependent table gives T,T vs 10 split = −0.363249 ± 0.000702 (8 million rounds, 7,378,702 kept after excluding dealer blackjacks); the calculator's value under the same continuation is −0.363250. Never resplitting gives +0.052636 ± 0.000531, so the published −0.419582 is below both the always-resplit-to-four value and the never-resplit value. (The remaining Monte Carlo cells and the resplit-cap diagnosis are reported in the [Monte Carlo table](#independent-monte-carlo-results).)
3. **The comparator documents an approximation.** Its own methodology sentence quoted above says split values ignore the other cards drawn in split hands and track only the number of hands already split. The calculator's algorithm accounts for pair and non-pair cards removed by the other split hands exactly, per its readme. The magnitude ordering (largest for ten pairs against 8–A, where every extra resplit of tens costs about half a bet) is consistent with the comparator's resplit weighting differing from the exact four-hand model; the exact rule inside the comparator cannot be identified from published material.

Consequences and recommendation:

- **No teaching decision changes.** Ranking every pair cell's actions with the comparator's values and with the calculator's gives the same best action in all 400 pair-cell/preset combinations (`check_pair_flips.py`). The closest pair decisions are 3,3 vs 2 (split by 0.0089 under S17) and 3,3 vs 8 (hit by 0.0114).
- **Convention for the True Count reference:** use the calculator's exact split value under item 2 (the taught total-dependent continuation, resplit to four hands whenever the taught table says split, one card to split aces, DAS except on aces). Do not use the comparator's split values as a numeric reference; use them only as a decision-level cross-check, which they pass.
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

**Funding across live split hands (accepted, Q24).** When several split hands are live and the balance can fund only one more wager, hands are funded in play order: the earliest live hand whose prescribed action is a double receives the last affordable wager, and every later hand uses its fallback column (`fallback_double` for a prescribed double on a post-split hand, `fallback_split_balance` for a prescribed further split). This is a bankroll-allocation rule, not an expected-return comparison between hands: the fallback columns supply the per-hand action once the rule has decided which hand is funded, and adherence is assessed against that fallback. A coupled optimisation across hands was not produced and is not part of the reference.

Validation status: **accepted as validated under the accepted methodology** (issue #15 acceptance comment, 2026-09-14): the values are generated from independently validated action values; the balance-caused and split-cap fallbacks have no published comparator (no source publishes them), so they are validated by construction only. Surrender precedence for the fallback is only applied to original two-card hands, per the accepted rules.

### Continuation tables

`continuation_S17.csv` and `continuation_H17.csv` give the total-dependent action (S/H/D with S/H fallback) for hard 4–21 and soft 12–21 used as the teaching continuation (item 2) by the driver's `tdb` mode, the sampler and the Monte Carlo simulator. Regenerating the basic tables with the `tdb` values instead of CDZ- values changes no cell (fixed point).

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

So the basic hit/stand teaching for these totals also holds for multi-card hands, and for the zero-index situations (16 vs T, 12 vs 4) multi-card hands favour the deviation action slightly earlier than two-card hands. The two-card thresholds below use two-card compositions only; the all-occurrence thresholds under "Multi-card occurrences" weight every occurrence of each situation, including these hands and post-split hands, using the learner's actual decision frequencies.

## Index thresholds

### Method (implements accepted items 1–4 under the accepted objective and conventions)

1. **Sampling** (`sample_shoe_states.py`). 400,000 six-deck shoes per configuration, cut card after ⌊312 × penetration⌋ cards, the round that reaches it finished before the shuffle, no burn card, every spot playing the preset's generated basic table, no insurance. At every round start the composition of the physical shoe is recorded; because all earlier cards are exposed by then, the pre-round running count is the negative of the tags of the cards remaining. Sampling is stratified by pre-round integer true count (reservoir of 2,500 per stratum, later capped to 1,200 for the main run and 400 for stability runs) and every stratum's population is kept, so the reweighted sample is unbiased for the round-start distribution. Default configuration: 75% penetration, learner alone: 17,287,008 rounds; population of the +5 stratum 192,948, +8 stratum 44,088.
2. **Situations.** Each I18/F4 situation is evaluated for every two-card composition of its total (hard 16: T-6, 9-7; 15: T-5, 9-6, 8-7; 14: T-4, 9-5, 8-6, 7-7; 13: T-3, 9-4, 8-5, 7-6; 12: T-2, 9-3, 8-4, 7-5; 11: 9-2, 8-3, 7-4, 6-5; 10: 8-2, 7-3, 6-4, 5-5; 9: 7-2, 6-3, 5-4; T,T). Pairs whose basic action is split (8,8; 6,6 against 2–6; 7,7 against 2–7) are excluded from the hard total because the pair decision takes precedence; 7,7 vs T and 5,5 are included because they are played as hard totals.
3. **State at the decision.** From a sampled composition C (minus the other players' initial cards when present), the situation's two cards and the up card are removed; the concealed hole card stays in the unseen pool the engine draws from. Running count = tags of every exposed card (earlier rounds, other players' initial cards, the learner's two cards, the up card). Divisor = physical cards remaining (C minus everything dealt this round, including the hole card) to the nearest half deck, ties upward, minimum 0.5. True count = quotient truncated toward zero. Weight = stratum population/sample × P(situation dealt from C) × P(no dealer blackjack | up card), the last factor because the decision is reached only after a negative peek.
4. **Values.** Engine values conditioned on no dealer blackjack, under the composition-dependent continuation (`cdz`) and under the taught total-dependent continuation (`tdb`, item 2; the accepted reference). Surrender is −0.5. Insurance is 3p − 1 with p the share of tens in the unseen pool after the learner's two cards and the ace are removed, evaluated over all 55 two-card learner hands with their dealing weights.
5. **Threshold.** Per integer true-count bin, the weighted mean of (deviation value − alternative value) with a standard error computed across sampled states (compositions of one state are correlated). The raw threshold is the smallest bin at or above which the mean is non-negative in every supported bin; the tolerance threshold applies item 4 (a bin counts for the deviation only if its mean exceeds max(0.001, 2 SE)) and item 3 (ties resolve toward basic). Bins with fewer than 200 sampled states are reported but not used. Direction conventions are Schlesinger's: stand/double/split/surrender at or above the threshold.

### Results

Status of every threshold below: **generated from two-card compositions** under the accepted methodology and **compared** with two published sources. The certified curriculum values are the all-occurrence `tdb` thresholds under "Final curriculum thresholds" below; they equal the two-card `tdb` values in every curriculum situation for both rule sets, so this table remains the full comparison record. Values are the tolerance thresholds ("deviate at TC ≥ value"; for the negative-index plays and the basic-surrender plays, "keep the basic action at TC ≥ value, deviate below"); a raw threshold is shown in parentheses where the tie rule moved it. Published values: Schlesinger's I18/F4 as republished by Wizard of Odds (six-deck S17 simulation context, rounded true count), and the BJA 2018 S17/H17 charts (`published_indices.csv`).

Columns: S17/H17 with composition-dependent (cdz) or taught (tdb) continuation at the default configuration; stability of the S17 cdz value at 50% and 80% penetration and with four other players; the H17 cdz value when the sampling itself used H17/no-LS play; and the S17/H17 cdz values re-aggregated under the comparator's rounding convention. "supp" rows are supplementary comparisons, not curriculum. ">8" means the deviation is never preferred within the searched range −8…+8; the far tails are in the bins files.

| Situation | Set | Schlesinger | BJA S17 | BJA H17 | S17 cdz | S17 tdb | H17 cdz | H17 tdb | S17 cdz at p50 / p80 / 4 others | H17 cdz, H17/noLS sampling | S17 / H17 cdz, rounded TC |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 16 vs 10 stand | I18 | +0 | 0+ | 0+ | 1 | 1 | 1 | 1 | 1 / 1 / 1 | 1 | 1 / 1 |
| 15 vs 10 stand | I18 | +4 | 4+ | 4+ | 5 (raw 4) | 4 | 5 (raw 4) | 4 | 5 / 4 / 4 | 5 | 5 / 5 |
| T,T vs 5 split | I18 | +5 | 5+ | 5+ | 5 | 5 | 5 | 5 | 5 / 5 / 5 | 5 | 6 / 6 |
| T,T vs 6 split | I18 | +4 | 4+ | 4+ | 5 | 5 | 4 | 4 | 5 / 5 / 5 | 5 | 5 / 5 |
| 10 vs 10 double | I18 | +4 | 4+ | 4+ | 4 | 4 (raw 3) | 4 | 4 (raw 3) | 4 / 4 / 4 | 4 | 4 / 4 |
| 12 vs 3 stand | I18 | +2 | 2+ | 2+ | 2 | 2 | 2 (raw 1) | 2 (raw 1) | 2 / 3 / 2 | 2 | 2 / 2 |
| 12 vs 2 stand | I18 | +3 | 3+ | 3+ | 4 | 4 | 3 | 3 | 4 / 4 / 4 | 4 | 4 / 4 |
| 11 vs A double | I18 | +1 | 1+ | D | 1 | 1 | 0 | 0 | 1 / 1 / 1 | 0 | 1 / 0 |
| 9 vs 2 double | I18 | +1 | 1+ | 1+ | 1 | 1 | 1 | 1 | 1 / 1 / 1 | 1 | 2 / 2 |
| 10 vs A double | I18 | +4 | 4+ | 3+ | 4 | 4 | 3 | 3 | 4 / 4 / 4 | 3 | 4 / 3 |
| 9 vs 7 double | I18 | +3 | 3+ | 3+ | 4 | 4 | 4 | 4 | 4 / 4 / 4 | 4 | 4 / 4 |
| 16 vs 9 stand | I18 | +5 | 4+ | 4+ | 5 | 5 | 5 | 5 | 6 / 6 / 6 | 6 | 6 / 6 |
| 13 vs 2 stand | I18 | −1 | −1− | −1− | 0 | 0 | −1 | −1 | 0 / 0 / 0 | −1 | −1 / −1 |
| 12 vs 4 stand | I18 | 0 | 0− | 0− | 1 | 1 | 0 | 0 | 0 / 0 / 0 | 0 | 1 / 0 |
| 12 vs 5 stand | I18 | −2 | S | — | −1 | −1 | −1 | −1 | −1 / −1 / −1 | −1 | −1 / −1 |
| 12 vs 6 stand | I18 | −1 | S | — | 0 | 0 | −3 | −3 | 0 / 0 / 0 | −3 | −1 / −3 |
| 13 vs 3 stand | I18 | −2 | S | — | −2 (raw −1) | −2 | −2 | −2 | −2 / −2 / −2 | −2 | −2 / −2 |
| 14 vs 10 surrender | F4 | +3 | (none) | — | 4 | 4 (raw 3) | 4 | 4 (raw 3) | 4 / 4 / 4 | 4 | 4 / 4 |
| 15 vs 10 surrender | F4 | +0 | 0− | 0− | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 0 | 0 / 0 |
| 15 vs 9 surrender | F4 | +2 | 2+ | 2+ | 3 (raw 2) | 3 (raw 2) | 3 (raw 2) | 3 (raw 2) | 3 / 3 / 3 | 3 | 3 / 3 |
| 15 vs A surrender | F4 | +1 | 2+ | −1+ | 2 | 2 | 0 | 0 | 2 / 2 / 2 | −1 | 2 / −1 |
| Insurance | I18 | +3 | 3+ | 3+ | 3 | 3 | 3 | 3 | 3 / 3 / 3 | 3 | — |
| T,T vs 4 split | supp | — | 6+ | 6+ | 7 | 7 | 7 | 7 | 7 / 7 / 7 | 7 | 8 / 8 |
| A,8 vs 4 double | supp | — | 3+ | 3+ | 4 (raw 3) | 4 (raw 3) | 3 | 3 | 4 / 3 / 3 | 4 | 4 / 4 |
| A,8 vs 5 double | supp | — | 1+ | 1+ | 1 | 1 | 1 | 1 | 1 / 2 / 2 | 2 | 2 / 2 |
| A,8 vs 6 double | supp | — | 1+ | 0− | 1 | 1 | 0 | 0 | 1 / 1 / 1 | 0 | 1 / 0 |
| A,6 vs 2 double | supp | — | 1+ | 1+ | 2 (raw 1) | 2 (raw 1) | 2 (raw 1) | 2 (raw 1) | 2 / 3 / 3 | 4 | 2 / 2 |
| 8 vs 6 double | supp | — | 2+ | 2+ | 2 | 2 | 2 | 2 | 2 / 2 / 2 | 2 | 3 / 3 |
| 16 vs A stand | supp | — | H | 3+ | >8 | >8 | 4 | 4 | >8 / >8 / >8 | 4 | >8 / 4 |
| 15 vs A stand | supp | — | H | 5+ | >8 | >8 | 6 | 6 (raw 5) | >8 / >8 / >8 | 6 | >8 / 6 |
| 16 vs 8 surrender | supp | — | 4+ | 4+ | 6 | 6 | 6 | 6 | 5 / 8 / 7 | 7 | 7 / 7 |
| 16 vs 9 surrender | supp | — | −1− | −1− | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 0 | 0 / 0 |
| 16 vs 10 surrender | supp | — | SUR | SUR | −2 | −2 | −2 | −2 | −3 / −2 / −2 | −2 | −3 / −3 |
| 16 vs A surrender | supp | — | SUR | SUR | −1 | −1 | −5 | −5 | −1 / −1 / −1 | −5 | −1 / −5 |
| 17 vs A surrender | supp | — | — | SUR | >8 | >8 | >8 (always) | >8 (always) | >8 / >8 / >8 | >8 (always) | >8 / >8 |
| 8,8 vs A surrender | supp | — | — | — | >8 | >8 | >8 (always) | >8 (always) | >8 / >8 / >8 | >8 (always) | >8 / >8 |
| 8,8 vs 10 surrender | supp | — | — | — | 3 | 3 | 3 | 3 | 3 / 3 / 4 | 4 | 4 / 4 |

For 17 vs A and 8,8 vs A under H17 the basic action is surrender and no bin in the searched range is decisive against it ("always"); under S17 the same rows mean surrender is never preferred. Full per-bin means, standard errors and state counts: `indices_<configuration>_<rules>_<mode>_bins.csv`.

**Comparison with Schlesinger (S17, CDZ- continuation, default configuration).** Nine of the twenty-one non-insurance situations reproduce the published integer (T,T vs 5 = 5; 10 vs T = 4; 12 vs 3 = 2; 11 vs A = 1; 9 vs 2 = 1; 10 vs A = 4; 16 vs 9 = 5; 13 vs 3 = −2; 15 vs T surrender = 0). Twelve come out exactly **one true count higher**: 16 vs T (1), 15 vs T (5; raw 4 with a +0.0010 ± 0.0007 tie at 4), T,T vs 6 (5), 12 vs 2 (4), 9 vs 7 (4), 13 vs 2 (0), 12 vs 4 (1), 12 vs 5 (−1), 12 vs 6 (0), 14 vs T surrender (4), 15 vs 9 surrender (3; raw 2 with a +0.0002 tie), 15 vs A surrender (2). The mean disadvantage of deviating at the published integer in those twelve bins is, per original bet: 0.0037, 0.0010 (tie), 0.018, 0.0011, 0.0027, 0.0069, 0.0016, 0.0133, 0.0051, 0.0008, 0.0002 (tie), 0.0020. Only T,T vs 6 (0.018 ± 0.003) and 12 vs 5 (0.013 ± 0.001) are material; the others are within a few thousandths. (Under the accepted taught continuation, `tdb`, 15 vs T is 4 and matches, so ten reproduce Schlesinger and eleven are one higher; the certified tables in "Final curriculum thresholds" use `tdb`.)

The offset is not an artefact of truncation: re-aggregating the same states with the comparator's convention (round half away from zero, `--round`) still gives the published value plus one in ten of the twelve cases (13 vs 2 and 12 vs 6 then match) and moves three previously matching cases up by one (T,T vs 5 → 6, 9 vs 2 → 2, 16 vs 9 → 6), leaving seven matches under rounding against nine under truncation. The mean exact quotient inside truncated bin k is k ± 0.33, so with a decreasing count density the exact crossovers lie about 0.3–0.9 above the published integers for two-card hands under this state distribution. The pipeline is exact at the state level: sampled zero-depth states reproduce the fresh-shoe values to 0.00e+00, and a decision-time RC of 0 selects pre-round shoes at RC −1 or −2 (the hand's own tags), which is why the zero bin does not equal the fresh-shoe value.

**H17.** Situations against 7, 8, 9 and T are identical under both rules (a dealer showing 7–T can never hold a soft 17), as in Appendix 9. Against A–6 the H17 thresholds move: T,T vs 6 → 4 (matches Schlesinger and BJA), 12 vs 2 → 3 (matches), 12 vs 4 → 0 (matches), 13 vs 2 → −1 (matches Schlesinger; BJA's "−1−" hits at −1, where the bin is a +0.0005 ± 0.0011 tie), 10 vs A → 3 (matches BJA H17), 12 vs 6 → −3 (two below Schlesinger's S17 value; bin −3 = +0.0025 ± 0.0010, bin −4 = −0.0127), 12 vs 5 → −1, 13 vs 3 → −2, 11 vs A → basic double with hit at TC ≤ −1 (bin −1 = −0.0165 ± 0.0011; BJA teaches plain double), 15 vs A surrender → basic surrender kept at TC ≥ 0 and hit at TC ≤ −1 (bin −1 = −0.0025 ± 0.0009; BJA H17's "−1+" surrenders one count earlier), 17 vs A and 8,8 vs A surrender at every supported bin (matches Wizard's H17 list; BJA splits 8,8 vs A).

**Configuration stability (item 1).** Across 50% penetration, 80% penetration and four other players (S17, cdz; about a third of the default sample each, so their 2-SE tie zones are wider), 17 of the 21 non-insurance curriculum thresholds and the insurance index are identical to the default configuration. The four that move do so by one true count and only through the tie rule: 15 vs T (5 → 4 at 80% and with four others; the +4 bin is +0.0010 to +0.0037 in every configuration), 12 vs 3 (2 → 3 at 80% only; +2 bin +0.0044 ± 0.0024, a tie there), 16 vs 9 (5 → 6 in all three; the +5 bin is +0.0018 to +0.0041 with standard errors 0.0015–0.0031, ties, while the raw thresholds stay 5, 5, 4), and 12 vs 4 (1 → 0; the zero bin is −0.0010 ± 0.0008, −0.0011 ± 0.0011 and +0.0008 ± 0.0010, ties resolved toward the basic stand). Sampling with H17/no-LS play instead of S17/LS moves the H17 thresholds the same way (16 vs 9 → 6, 15 vs T → 5, 15 vs A surrender → −1 with a −0.0011 ± 0.0016 tie at −1) and nothing else. So the thresholds are stable to within the tie zone across the accepted configuration range, which supports one shared curriculum per rule set; the cells listed here are the ones whose accepted value depends on the tolerance choice in Proposal 4.

**Continuation policy (item 2).** Re-evaluating the same states with the taught total-dependent continuation (`tdb`) instead of composition-dependent re-optimisation changes one tolerance threshold in each rule set, 15 vs T stand from 5 to 4 (the +4 bin moves from +0.0010 ± 0.0007 to +0.0041 ± 0.0007 because hitting 15 under the taught table is worth slightly less), and turns two bins into ties without changing their tolerance thresholds (10 vs T double at +3: −0.0029 → +0.0008; 14 vs T surrender at +3: −0.0008 → +0.0014). Every other threshold is identical under both continuations.

**Running-count sign inside the zero bin (S17).** Under the accepted integer convention TC 0 spans RC −D+1 … D−1. Splitting the zero bin by RC sign gives (deviation minus alternative, per original bet): 16 vs T: RC<0 −0.0066, RC=0 −0.0024, RC>0 −0.0001; 12 vs 4: −0.0101, −0.0034, +0.0051; 15 vs T surrender: −0.0006, +0.0066, +0.0124; 16 vs 9 surrender: −0.0001, +0.0053, +0.0086. BJA's "0+" for 16 vs T (stand at positive RC) is therefore a tie (−0.0001) and its "0−" rules for 12 vs 4 and 15 vs T are right at negative RC and within 0.0034 at RC = 0. **Accepted (Q20, with item 3):** no running-count sign exceptions; the integer thresholds above already absorb the zero-bin structure to within 0.005, and the accepted convention defines the count as an integer true count.

**Insurance.** Exact evaluation of 3p − 1 over all 55 two-card learner hands and the sampled states (`indices_p75_n0_insurance_bins.csv`) gives TC +1: −0.0388 ± 0.0010, +2: −0.0166 ± 0.0012, +3: +0.0055 ± 0.0012, +4: +0.0272 ± 0.0013. The independent play simulation (`insurance_sim.py`, 300,000 shoes, about 1,000,000 ace rounds, no calculator) gives +2: −0.0152 ± 0.0054, +3: +0.0096 ± 0.0079, +4: +0.0580 ± 0.0094 (empirical share of tens under the ace 0.3283, 0.3365, 0.3527). Both place the index at **+3**, matching Schlesinger and BJA. (Within TC +3 every state has RC > 0, so no sign question arises.)

**Supplementary situations (not in the accepted curriculum, reported for the BJA comparison; S17 unless stated).** T,T vs 4: 7 (BJA 6+). A,8 vs 4: 4 (raw 3; BJA 3+). A,8 vs 5: 1 (BJA 1+). A,8 vs 6: 1 (BJA 1+); H17: basic double kept at TC ≥ 0, stand below (BJA "0−"). A,6 vs 2: 2 (raw 1; BJA 1+). 8 vs 6: 2 (BJA 2+). 16 vs A stand: never within the searched range under S17 (BJA: none; the bins file shows the crossover near +9); H17 4 (BJA 3+). 15 vs A stand (H17): 6 (BJA 5+). 16 vs 8 surrender: 6 (BJA 4+). 16 vs 9 surrender: keep surrendering at TC ≥ 0, hit at ≤ −1 (BJA "−1−"). 16 vs T surrender: keep at TC ≥ −2 (BJA always). 16 vs A surrender: keep at TC ≥ −1 (H17: ≥ −5; BJA always). 8,8 vs T: surrender beats splitting at TC ≥ 3 (bin 3 = +0.0047 ± 0.0013), which no compared source teaches.

### Multi-card occurrences (final pass)

**Method** (`sample_decisions.py`, `aggregate_occurrences.py`, `run_decisions.sh`, `run_occurrences.sh`). The default configuration was replayed for 8 × 400,000 shoes (seeds 201–208: 138,301,682 rounds, 179.6 million learner decisions) and every learner decision that is an index situation was counted by (situation, integer true count at the decision, category): 36,133,337 occurrences in four categories, **original two-card**, **multi-card** (three or more cards, reached by hitting), **post-split two-card** and **post-split multi-card**, reservoir-sampled at 150 per stratum per replica. For each sampled occurrence the unseen pool at that moment (physical shoe plus the concealed hole card), the exposed-card running count and the physical cards remaining were recorded, and the true count follows the accepted convention. 60,147 occurrences were then valued by the calculator under the taught continuation for S17 and for H17, one calculator build per occurrence (`farmer_driver --perline`): 200 per non-original stratum and 50 original two-card ones in the bins adjacent to each two-card threshold, 6 per stratum elsewhere inside |TC| ≤ 8, 2 in the tails (subsample seed 21; weights scaled so the estimate stays unbiased). The **all-occurrence estimate** for a bin is (1 − f) × two-card state estimate + f × non-original occurrence estimate, where f is the share of non-original occurrences in that bin measured over the full simulation (not the sample), with SE = √(((1 − f) SE₂)² + (f SEₙ)²); the accepted tie and tolerance rules are applied to these bins exactly as to the two-card ones. Stand/hit situations take all four categories; double situations take original and post-split two-card hands (no double on three or more cards; DAS applies; split aces never reach a decision); the pair and surrender situations take original two-card hands only (Fab 4 never apply post-split; the basic table never splits T,T, so post-split tens never occur), so their all-occurrence thresholds equal the two-card ones by construction. The learner plays the basic table without indices during sampling, as accepted for the state weighting; in the bins that decide each threshold an index player and a basic player make the same earlier decisions, so the occurrence mix there is the same. Split hands are dealt sequentially in this sampler (Implementation checks, item 4).

**Cross-check of the sampler.** The rate of original two-card occurrences per bin from this sampler agrees with the state-based dealing-probability weights of the two-card method within sampling noise: ratios 0.97–1.04 across bins −3…+5 for the nine situations checked (16 vs T at TC 0: 7,129 against 7,060 occurrences per million rounds; 10 vs T at +3: 433 against 433), so both pipelines bin the same decisions under the same convention.

**Share of occurrences by category** (full population, all true counts; the categories a situation weights are marked):

| Situation | Original two-card | Multi-card | Post-split two-card | Post-split multi-card | Multi-card share | Post-split share | Categories weighted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 16 vs T (stand) | 2,319,643 | 2,201,339 | 964 | 18,052 | 48.9% | 0.4% | all |
| 16 vs 9 (stand) | 628,980 | 610,122 | 10,152 | 7,350 | 49.1% | 1.4% | all |
| 15 vs T (stand) | 2,790,027 | 2,061,169 | 40,303 | 13,961 | 42.3% | 1.1% | all |
| 13 vs 2 (stand) | 890,887 | 275,289 | 88,153 | 24,927 | 23.5% | 8.8% | all |
| 13 vs 3 (stand) | 870,016 | 234,258 | 84,021 | 20,981 | 21.1% | 8.7% | all |
| 12 vs 2 (stand) | 871,966 | 165,837 | 84,630 | 14,679 | 15.9% | 8.7% | all |
| 12 vs 3 (stand) | 886,822 | 125,773 | 87,072 | 10,772 | 12.3% | 8.8% | all |
| 12 vs 4 (stand) | 884,080 | 103,841 | 88,102 | 10,806 | 10.5% | 9.1% | all |
| 12 vs 5 (stand) | 885,634 | 73,544 | 99,128 | 11,096 | 7.9% | 10.3% | all |
| 12 vs 6 (stand) | 890,941 | 74,486 | 99,715 | 10,910 | 7.9% | 10.3% | all |
| 10 vs T (double) | 1,634,942 | — | 40,550 | — | 0 | 2.4% | original + post-split two-card |
| 10 vs A (double) | 305,649 | — | 7,634 | — | 0 | 2.4% | original + post-split two-card |
| 11 vs A (double) | 352,438 | — | 7,727 | — | 0 | 2.1% | original + post-split two-card |
| 9 vs 2 (double) | 376,389 | — | 42,543 | — | 0 | 10.2% | original + post-split two-card |
| 9 vs 7 (double) | 376,926 | — | 31,542 | — | 0 | 7.7% | original + post-split two-card |
| T,T vs 5, T,T vs 6 (split) | 1,004,958 / 1,004,740 | — | 0 | — | 0 | 0 | original only |
| 14 vs T (surrender) | 3,016,809 | 1,676,797 | 40,034 | 10,048 | (35.6%) | (1.1%) | original only: surrender needs an original two-card hand |
| 15 vs T, 15 vs 9, 15 vs A (surrender) | 2,790,027 / 756,649 / 526,792 | 2,061,169 / 513,684 / 413,299 | 40,303 / 20,922 / 7,638 | 13,961 / 5,222 / 3,305 | (42–44%) | (1–2%) | original only |

Multi-card hands are thus about half of every hard-16 and hard-15 decision the learner faces and a fifth to a quarter of hard-13 decisions; post-split hands are about a tenth of hard-12/13 and 9-vs-2 decisions and negligible for hard 16 (a post-split two-card 16 arises only from 8,8 at the four-hand cap).

**All-occurrence thresholds.** For every curriculum situation: the two-card tolerance threshold (`indices_p75_n0_<rules>_tdb_thresholds.csv`), the all-occurrence threshold that weights multi-card and post-split hands in (`occurrences_<rules>_tdb_thresholds.csv`), the non-original share in the S17 threshold bin, and the three bins around the S17 threshold before and after weighting (per original bet). Bins whose non-original share is at least 5% are usable for the threshold only with at least 50 sampled non-original occurrences (support rule, below); the bins one and two counts either side of every curriculum threshold were sampled at 200 non-original occurrences per category.

| Situation | Set | Two-card S17 / H17 | All occurrences S17 / H17 | Non-original share at the S17 threshold bin | S17 bins t−1, t, t+1: two-card → all-occurrence (mean ± SE) |
|---|---|---|---|---|---|
| 16 vs 10 stand | I18 | 1 / 1 | 1 / 1 | 0.5237 | +0: −0.0037±0.0006 → −0.0000±0.0008; +1: +0.0058±0.0007 → +0.0088±0.0010; +2: +0.0142±0.0009 → +0.0150±0.0013 |
| 15 vs 10 stand | I18 | 4 / 4 | 4 / 4 | 0.4560 | +3: −0.0031±0.0006 → −0.0039±0.0008; +4: +0.0041±0.0007 → +0.0051±0.0009; +5: +0.0132±0.0008 → +0.0146±0.0010 |
| T,T vs 5 split | I18 | 5 / 5 | 5 / 5 | 0 | unchanged by construction (+4: −0.0478±0.0022; +5: +0.0142±0.0023; +6: +0.0732±0.0024) |
| T,T vs 6 split | I18 | 5 / 4 | 5 / 4 | 0 | unchanged by construction (+4: −0.0188±0.0026; +5: +0.0346±0.0028; +6: +0.0902±0.0031) |
| 10 vs 10 double | I18 | 4 / 4 | 4 / 4 | 0.0239 | +3: +0.0008±0.0005 → +0.0009±0.0005; +4: +0.0085±0.0006 → +0.0085±0.0005; +5: +0.0178±0.0006 → +0.0179±0.0006 |
| 12 vs 3 stand | I18 | 2 / 2 | 2 / 2 | 0.2230 | +1: −0.0043±0.0011 → −0.0044±0.0009; +2: +0.0105±0.0011 → +0.0097±0.0009; +3: +0.0233±0.0013 → +0.0227±0.0011 |
| 12 vs 2 stand | I18 | 4 / 3 | 4 / 3 | 0.2598 | +3: −0.0007±0.0014 → −0.0013±0.0012; +4: +0.0099±0.0014 → +0.0097±0.0012; +5: +0.0210±0.0016 → +0.0222±0.0014 |
| 11 vs A double | I18 | 1 / 0 | 1 / 0 | 0.0212 | +0: −0.0217±0.0008 → −0.0217±0.0008; +1: +0.0110±0.0010 → +0.0110±0.0009; +2: +0.0324±0.0013 → +0.0323±0.0012 |
| 9 vs 2 double | I18 | 1 / 1 | 1 / 1 | 0.1089 | +0: −0.0121±0.0005 → −0.0120±0.0005; +1: +0.0054±0.0010 → +0.0055±0.0009; +2: +0.0213±0.0009 → +0.0217±0.0009 |
| 10 vs A double | I18 | 4 / 3 | 4 / 3 | 0.0233 | +3: −0.0006±0.0008 → −0.0005±0.0008; +4: +0.0201±0.0009 → +0.0203±0.0008; +5: +0.0465±0.0009 → +0.0467±0.0009 |
| 9 vs 7 double | I18 | 4 / 4 | 4 / 4 | 0.0760 | +3: −0.0014±0.0011 → −0.0011±0.0010; +4: +0.0186±0.0011 → +0.0185±0.0010; +5: +0.0381±0.0013 → +0.0381±0.0012 |
| 16 vs 9 stand | I18 | 5 / 5 | 5 / 5 | 0.5306 | +4: −0.0033±0.0013 → −0.0032±0.0018; +5: +0.0050±0.0014 → +0.0053±0.0017; +6: +0.0109±0.0014 → +0.0127±0.0019 |
| 13 vs 2 stand | I18 | 0 / −1 | 0 / −1 | 0.2963 | −1: −0.0067±0.0011 → −0.0072±0.0010; +0: +0.0117±0.0008 → +0.0119±0.0007; +1: +0.0311±0.0013 → +0.0313±0.0011 |
| 12 vs 4 stand | I18 | 1 / 0 | 1 / 0 | 0.2114 | +0: −0.0015±0.0006 → −0.0011±0.0005; +1: +0.0187±0.0010 → +0.0184±0.0009; +2: +0.0344±0.0010 → +0.0343±0.0008 |
| 12 vs 5 stand | I18 | −1 / −1 | −1 / −1 | 0.1492 | −2: −0.0131±0.0008 → −0.0126±0.0007; −1: +0.0024±0.0007 → +0.0026±0.0006; +0: +0.0230±0.0005 → +0.0235±0.0005 |
| 12 vs 6 stand | I18 | 0 / −3 | 0 / −3 | 0.1630 | −1: −0.0049±0.0010 → −0.0044±0.0009; +0: +0.0125±0.0007 → +0.0130±0.0006; +1: +0.0306±0.0013 → +0.0304±0.0011 |
| 13 vs 3 stand | I18 | −2 / −2 | −2 / −2 | 0.2763 | −3: −0.0178±0.0013 → −0.0173±0.0011; −2: +0.0001±0.0012 → −0.0012±0.0011; −1: +0.0145±0.0011 → +0.0145±0.0010 |
| 14 vs 10 surrender | F4 | 4 / 4 | 4 / 4 | 0 | unchanged by construction (+3: +0.0014±0.0009; +4: +0.0086±0.0009; +5: +0.0189±0.0010) |
| 15 vs 10 surrender | F4 | 0 / 0 | 0 / 0 | 0 | unchanged by construction (−1: −0.0133±0.0008; +0: +0.0058±0.0005; +1: +0.0221±0.0006) |
| 15 vs 9 surrender | F4 | 3 / 3 | 3 / 3 | 0 | unchanged by construction (+2: +0.0007±0.0007; +3: +0.0136±0.0007; +4: +0.0225±0.0008) |
| 15 vs A surrender | F4 | 2 / 0 | 2 / 0 | 0 | unchanged by construction (+1: −0.0020±0.0008; +2: +0.0091±0.0009; +3: +0.0209±0.0010) |

**No curriculum threshold changed in either rule set.** What moved:

- **16 vs T.** The zero bin moved from −0.0037 ± 0.0006 (two-card: hitting is decisive) to −0.0000 ± 0.0008, an exact tie. Multi-card and post-split 16s stand profitably at TC 0 (non-original component +0.0039 ± 0.0016 at TC 0, +0.0115 ± 0.0017 at +1) while two-card 16s hit (−0.0037), the composition effect the fresh-shoe multi-card table anticipated. Under the accepted tie rule the all-occurrence tie resolves toward the basic hit, so the taught threshold stays **+1** (Schlesinger 0, BJA "0+"): at TC 0 a hit-to-16 forgoes 0.0039 ± 0.0016 per bet by hitting and a two-card 16 would forgo 0.0037 by standing. The curriculum carries one threshold per situation, as accepted; lesson authors may state the composition effect.
- **15 vs T.** The +4 bin strengthened (+0.0041 → +0.0051 ± 0.0009) and +3 stayed decisive against standing (−0.0039 ± 0.0008): **+4**, as Schlesinger.
- **16 vs 9.** The +4 bin remains a tie (−0.0033 → −0.0032 ± 0.0018) and +5 decisive (+0.0050 → +0.0053 ± 0.0017): **+5**, as Schlesinger, with about half of all occurrences multi-card.
- **12 and 13 vs 2–6.** Every bin moved by at most 0.0013: multi-card and post-split 12s and 13s behave like two-card ones. 13 vs 3 at −2 went from +0.0001 to −0.0012 ± 0.0011, still a tie kept as the basic stand (**−2**). Under H17, 13 vs 2 at −1 went from +0.0007 to +0.0001 ± 0.0010 (tie kept as stand, **−1**) and 12 vs 6 at −3 from +0.0027 to +0.0032 ± 0.0009 (**−3**).
- **Double situations.** Post-split hands are 2–11% of occurrences and moved every bin by at most 0.0004.
- **Pair and surrender situations** are unchanged by construction.
- **Supplementary situations.** H17 15 vs A stand moved from 6 to 5 (the +5 bin, a +0.0022 ± 0.0012 tie on two cards, is +0.0035 ± 0.0013 over all occurrences); no other supplementary threshold changed. These rows are not curriculum.

**Support rule (why a thin bin never decides).** In the first engine pass only the bins adjacent to each two-card threshold were sampled at full cap; other bins held six non-original occurrences per category. For 16 vs 9 the +3 bin's 18 non-original samples averaged +0.028 ± 0.008, a fluctuation against the fresh-shoe evidence (multi-card 16 vs 9 hits by 0.026–0.031) and against both neighbours (+2: −0.015, +4: −0.003), and because +4 is a tie the tolerance rule would have accepted +3 as a spurious threshold. The rule now used, and recorded in `aggregate_occurrences.py`, is that a bin whose non-original share is at least 5% is usable only with at least 50 sampled non-original occurrences; thin bins are reported with their two-card value but never decide a threshold. A supplementary pass (`run_supplement.sh`, seed 22) then re-drew the non-original strata of the bins two counts either side of every curriculum threshold at 200 per category (16,407 more builds per rule set), so every bin that could decide a curriculum threshold is fully supported. At full support the 16 vs 9 bin +3 reads −0.0096 ± 0.0015 over all occurrences (non-original component −0.0082 ± 0.0026 from 600 samples, against −0.0111 ± 0.0013 for two-card hands), decisively against standing, and no threshold in either rule set changed between the first pass with the support rule and the supplemented pass. The direct estimator (sampled occurrences only, including 50 original two-card ones per bin, so three to five times the standard error of the mixed estimator) reproduces every curriculum threshold outside the tie zones and differs by one count in the tie-zone situations (S17: T,T vs 5, 12 vs 2, 9 vs 2, 16 vs 9, 13 vs 2, 12 vs 4, 12 vs 6, 15 vs A surrender; H17: T,T vs 5, T,T vs 6, 9 vs 2, 16 vs 9), where its deciding bin lies within 1.3 standard errors of the mixed value except 12 vs 2 at +3 (2.4 SE); it is a cross-check of the pipeline (`check_direct_estimator.py`), not the reference.

### Post-split application (final pass)

Post-split two-card and multi-card hands were weighted into the stand/hit and double situations as described above (Fab 4 never apply post-split, surrender is unavailable on those hands, the double follows DAS, split aces stand without a decision). The table compares the post-split-only threshold (post-split occurrences alone) with the all-occurrence threshold and tests, in the bins between them, whether the post-split mean differs from the all-occurrence mean beyond max(0.001, 2 SE of the difference).

| Situation | All occurrences S17 / H17 | Post-split only S17 / H17 | Post-split share | Post-split minus all-occurrence in the bins between (mean ± SE) | Differs beyond tolerance |
|---|---|---|---|---|---|
| 16 vs 10 stand | 1 / 1 | 1 / 1 | 0.4% | — | no |
| 15 vs 10 stand | 4 / 4 | 4 / 4 | 1.1% | — | no |
| 10 vs 10 double | 4 / 4 | 4 / 4 | 2.4% | — | no |
| 12 vs 3 stand | 2 / 2 | 2 / 2 | 8.8% | — | no |
| 12 vs 2 stand | 4 / 3 | 4 / 4 | 8.7% | H17 +3: −0.0016 ± 0.0027 | no |
| 11 vs A double | 1 / 0 | 1 / 0 | 2.1% | — | no |
| 9 vs 2 double | 1 / 1 | 1 / 1 | 10.2% | — | no |
| 10 vs A double | 4 / 3 | 4 / 3 | 2.4% | — | no |
| 9 vs 7 double | 4 / 4 | 4 / 4 | 7.7% | — | no |
| 16 vs 9 stand | 5 / 5 | 5 / 5 | 1.4% | — | no |
| 13 vs 2 stand | 0 / −1 | 0 / −1 | 8.8% | — | no |
| 12 vs 4 stand | 1 / 0 | 0 / 0 | 9.1% | S17 +0: +0.0023 ± 0.0017 | no |
| 12 vs 5 stand | −1 / −1 | −1 / −1 | 10.3% | — | no |
| 12 vs 6 stand | 0 / −3 | −1 / −3 | 10.3% | S17 −1: +0.0044 ± 0.0026 | no |
| 13 vs 3 stand | −2 / −2 | −2 / −2 | 8.7% | — | no |

Three post-split-only thresholds differ by one count, each through the tie rule: 12 vs 4 (S17: post-split hands stand at 0, +0.0012 ± 0.0016 against −0.0011 ± 0.0005 for all occurrences), 12 vs 6 (S17: −1, difference +0.0044 ± 0.0026) and 12 vs 2 (H17: 4, difference −0.0016 ± 0.0027). None is beyond the tolerance, so **no post-split value is recorded separately**: post-split hands use the situation's taught threshold, with `fallback_double` when a prescribed post-split double cannot be funded and `fallback_split_rule` / `fallback_split_balance` for a prescribed further split, funded across hands by the accepted play-order rule. The post-split double situations (9 vs 2 with 10% post-split occurrences, 9 vs 7 with 8%, 10 vs T, 10 vs A and 11 vs A with 2%) have the same threshold post-split as on the original hand.

### Final curriculum thresholds (certified under the accepted methodology)

`indices_S17_final.csv` and `indices_H17_final.csv` (`make_final_indices.py`) are the files lesson authors and the engine consume: one row per curriculum situation (Illustrious 18, Fab 4, insurance) with the taught threshold, its direction and rule text, the two-card threshold and raw thresholds, a post-split threshold only where it would differ beyond the tolerance (none does), the applicable post-split fallback column, the multi-card and post-split shares, Schlesinger's value, both BJA chart entries, the differences, the per-bet cost of following the published value, the all-occurrence bins around the threshold and the frozen status. Direction: `deviate_at_or_above` plays the deviation at TC ≥ threshold and the basic action below; `basic_at_or_above` keeps the basic action at TC ≥ threshold and departs below. **Cost** is the expected loss per original bet, in each bin where the published value differs, from following the published value; a **negative** cost means the published action is better in that bin but inside the tie zone (max(0.001, 2 SE)), i.e. the taught value differs only through the accepted tie rule. Schlesinger's list is a six-deck S17 list, so its H17 differences (11 vs A, 10 vs A, 12 vs 6, 15 vs A) are rule differences, not disagreements; the BJA column is the rule-specific chart. Supplementary situations are not in these files.

**S17 (LS and no-LS presets; the Fab 4 rows apply only with late surrender)**

| Situation | Set | Taught (S17) | Rule | Schlesinger | BJA S17 | Difference vs Schlesinger | Cost per bet of the published value (bin: cost ± SE) | Multi-card / post-split share | All-occurrence bins t−1, t, t+1 |
|---|---|---|---|---|---|---|---|---|---|
| 16 vs 10 | I18 | **1** | stand at TC ≥ 1, otherwise hit | +0 | 0+ | 1 | +0: +0.0000 ± 0.0008 | 49% / 0% | +0: −0.0000±0.0008 +1: +0.0088±0.0010 +2: +0.0150±0.0013 |
| 15 vs 10 | I18 | **4** | stand at TC ≥ 4, otherwise hit | +4 | 4+ | 0 | — | 42% / 1% | +3: −0.0039±0.0008 +4: +0.0051±0.0009 +5: +0.0146±0.0010 |
| T,T vs 5 | I18 | **5** | split at TC ≥ 5, otherwise stand | +5 | 5+ | 0 | — | 0% / 0% | +4: −0.0478±0.0022 +5: +0.0142±0.0023 +6: +0.0732±0.0024 |
| T,T vs 6 | I18 | **5** | split at TC ≥ 5, otherwise stand | +4 | 4+ | 1 | +4: +0.0188 ± 0.0026 | 0% / 0% | +4: −0.0188±0.0026 +5: +0.0346±0.0028 +6: +0.0902±0.0031 |
| 10 vs 10 | I18 | **4** | double at TC ≥ 4, otherwise hit | +4 | 4+ | 0 | — | 0% / 2% | +3: +0.0009±0.0005 +4: +0.0085±0.0005 +5: +0.0179±0.0006 |
| 12 vs 3 | I18 | **2** | stand at TC ≥ 2, otherwise hit | +2 | 2+ | 0 | — | 12% / 9% | +1: −0.0044±0.0009 +2: +0.0097±0.0009 +3: +0.0227±0.0011 |
| 12 vs 2 | I18 | **4** | stand at TC ≥ 4, otherwise hit | +3 | 3+ | 1 | +3: +0.0013 ± 0.0012 | 16% / 9% | +3: −0.0013±0.0012 +4: +0.0097±0.0012 +5: +0.0222±0.0014 |
| 11 vs A | I18 | **1** | double at TC ≥ 1, otherwise hit | +1 | 1+ | 0 | — | 0% / 2% | +0: −0.0217±0.0008 +1: +0.0110±0.0009 +2: +0.0323±0.0012 |
| 9 vs 2 | I18 | **1** | double at TC ≥ 1, otherwise hit | +1 | 1+ | 0 | — | 0% / 10% | +0: −0.0120±0.0005 +1: +0.0055±0.0009 +2: +0.0217±0.0009 |
| 10 vs A | I18 | **4** | double at TC ≥ 4, otherwise hit | +4 | 4+ | 0 | — | 0% / 2% | +3: −0.0005±0.0008 +4: +0.0203±0.0008 +5: +0.0467±0.0009 |
| 9 vs 7 | I18 | **4** | double at TC ≥ 4, otherwise hit | +3 | 3+ | 1 | +3: +0.0011 ± 0.0010 | 0% / 8% | +3: −0.0011±0.0010 +4: +0.0185±0.0010 +5: +0.0381±0.0012 |
| 16 vs 9 | I18 | **5** | stand at TC ≥ 5, otherwise hit | +5 | 4+ | 0 | BJA: +4: +0.0032 ± 0.0018 | 49% / 1% | +4: −0.0032±0.0018 +5: +0.0053±0.0017 +6: +0.0127±0.0019 |
| 13 vs 2 | I18 | **0** | stand (basic) at TC ≥ 0, hit below | −1 | −1− | 1 | −1: +0.0072 ± 0.0010 | 23% / 9% | −1: −0.0072±0.0010 +0: +0.0119±0.0007 +1: +0.0313±0.0011 |
| 12 vs 4 | I18 | **1** | stand (basic) at TC ≥ 1, hit below | 0 | 0− | 1 | +0: +0.0011 ± 0.0005 | 11% / 9% | +0: −0.0011±0.0005 +1: +0.0184±0.0009 +2: +0.0343±0.0008 |
| 12 vs 5 | I18 | **−1** | stand (basic) at TC ≥ −1, hit below | −2 | S | 1 | −2: +0.0126 ± 0.0007 | 8% / 10% | −2: −0.0126±0.0007 −1: +0.0026±0.0006 +0: +0.0235±0.0005 |
| 12 vs 6 | I18 | **0** | stand (basic) at TC ≥ 0, hit below | −1 | S | 1 | −1: +0.0044 ± 0.0009 | 8% / 10% | −1: −0.0044±0.0009 +0: +0.0130±0.0006 +1: +0.0304±0.0011 |
| 13 vs 3 | I18 | **−2** | stand (basic) at TC ≥ −2, hit below | −2 | S | 0 | — | 21% / 9% | −3: −0.0173±0.0011 −2: −0.0012±0.0011 −1: +0.0145±0.0010 |
| 14 vs 10 surrender | F4 | **4** | surrender at TC ≥ 4, otherwise the basic action | +3 | (none) | 1 | +3: −0.0014 ± 0.0009 (tie zone) | 0% / 0% | +3: +0.0014±0.0009 +4: +0.0086±0.0009 +5: +0.0189±0.0010 |
| 15 vs 10 surrender | F4 | **0** | surrender (basic) at TC ≥ 0, the basic action below | +0 | 0− | 0 | — | 0% / 0% | −1: −0.0133±0.0008 +0: +0.0058±0.0005 +1: +0.0221±0.0006 |
| 15 vs 9 surrender | F4 | **3** | surrender at TC ≥ 3, otherwise the basic action | +2 | 2+ | 1 | +2: −0.0007 ± 0.0007 (tie zone) | 0% / 0% | +2: +0.0007±0.0007 +3: +0.0136±0.0007 +4: +0.0225±0.0008 |
| 15 vs A surrender | F4 | **2** | surrender at TC ≥ 2, otherwise the basic action | +1 | 2+ | 1 | +1: +0.0020 ± 0.0008 | 0% / 0% | +1: −0.0020±0.0008 +2: +0.0091±0.0009 +3: +0.0209±0.0010 |
| Insurance | insurance | **3** | take insurance at TC ≥ 3, otherwise decline | +3 | 3+ | 0 | — | — | +2: −0.0166±0.0012 +3: +0.0055±0.0012 +4: +0.0272±0.0013 |

**H17 (LS and no-LS presets)**

| Situation | Set | Taught (H17) | Rule | Schlesinger (S17 list) | BJA H17 | Difference vs Schlesinger | Cost per bet of the published value (bin: cost ± SE) | Multi-card / post-split share | All-occurrence bins t−1, t, t+1 |
|---|---|---|---|---|---|---|---|---|---|
| 16 vs 10 | I18 | **1** | stand at TC ≥ 1, otherwise hit | +0 | 0+ | 1 | +0: +0.0000 ± 0.0008 | 49% / 0% | +0: −0.0000±0.0008 +1: +0.0088±0.0010 +2: +0.0150±0.0013 |
| 15 vs 10 | I18 | **4** | stand at TC ≥ 4, otherwise hit | +4 | 4+ | 0 | — | 42% / 1% | +3: −0.0039±0.0008 +4: +0.0051±0.0009 +5: +0.0146±0.0010 |
| T,T vs 5 | I18 | **5** | split at TC ≥ 5, otherwise stand | +5 | 5+ | 0 | — | 0% / 0% | +4: −0.0455±0.0021 +5: +0.0166±0.0023 +6: +0.0755±0.0024 |
| T,T vs 6 | I18 | **4** | split at TC ≥ 4, otherwise stand | +4 | 4+ | 0 | — | 0% / 0% | +3: −0.0425±0.0023 +4: +0.0086±0.0025 +5: +0.0618±0.0027 |
| 10 vs 10 | I18 | **4** | double at TC ≥ 4, otherwise hit | +4 | 4+ | 0 | — | 0% / 2% | +3: +0.0009±0.0005 +4: +0.0085±0.0005 +5: +0.0179±0.0006 |
| 12 vs 3 | I18 | **2** | stand at TC ≥ 2, otherwise hit | +2 | 2+ | 0 | — | 12% / 9% | +1: +0.0015±0.0009 +2: +0.0155±0.0009 +3: +0.0285±0.0011 |
| 12 vs 2 | I18 | **3** | stand at TC ≥ 3, otherwise hit | +3 | 3+ | 0 | — | 16% / 9% | +2: −0.0073±0.0010 +3: +0.0053±0.0012 +4: +0.0162±0.0012 |
| 11 vs A | I18 | **0** | double (basic) at TC ≥ 0, hit below | +1 | D | −1 (rule) | +0: +0.0125 ± 0.0008; BJA never hits: −1: +0.0163 ± 0.0010 | 0% / 2% | −1: −0.0163±0.0010 +0: +0.0125±0.0008 +1: +0.0439±0.0009 |
| 9 vs 2 | I18 | **1** | double at TC ≥ 1, otherwise hit | +1 | 1+ | 0 | — | 0% / 10% | +0: −0.0121±0.0005 +1: +0.0054±0.0009 +2: +0.0215±0.0008 |
| 10 vs A | I18 | **3** | double at TC ≥ 3, otherwise hit | +4 | 3+ | −1 (rule) | +3: +0.0196 ± 0.0008 | 0% / 2% | +2: −0.0051±0.0008 +3: +0.0196±0.0008 +4: +0.0391±0.0009 |
| 9 vs 7 | I18 | **4** | double at TC ≥ 4, otherwise hit | +3 | 3+ | 1 | +3: +0.0011 ± 0.0010 | 0% / 8% | +3: −0.0011±0.0010 +4: +0.0185±0.0010 +5: +0.0381±0.0012 |
| 16 vs 9 | I18 | **5** | stand at TC ≥ 5, otherwise hit | +5 | 4+ | 0 | BJA: +4: +0.0032 ± 0.0018 | 49% / 1% | +4: −0.0032±0.0018 +5: +0.0053±0.0017 +6: +0.0127±0.0019 |
| 13 vs 2 | I18 | **−1** | stand (basic) at TC ≥ −1, hit below | −1 | −1− | 0 | BJA hits at −1: +0.0001 ± 0.0010 (tie) | 23% / 9% | −2: −0.0142±0.0011 −1: +0.0001±0.0010 +0: +0.0191±0.0007 |
| 12 vs 4 | I18 | **0** | stand (basic) at TC ≥ 0, hit below | 0 | 0− | 0 | — | 11% / 9% | −1: −0.0151±0.0007 +0: +0.0045±0.0005 +1: +0.0240±0.0008 |
| 12 vs 5 | I18 | **−1** | stand (basic) at TC ≥ −1, hit below | −2 | — | 1 | −2: +0.0103 ± 0.0007 | 8% / 10% | −2: −0.0103±0.0007 −1: +0.0050±0.0006 +0: +0.0261±0.0005 |
| 12 vs 6 | I18 | **−3** | stand (basic) at TC ≥ −3, hit below | −1 | — | −2 (rule) | −3: +0.0032 ± 0.0009; −2: +0.0165 ± 0.0008 | 8% / 10% | −4: −0.0117±0.0009 −3: +0.0032±0.0009 −2: +0.0165±0.0008 |
| 13 vs 3 | I18 | **−2** | stand (basic) at TC ≥ −2, hit below | −2 | — | 0 | — | 21% / 9% | −3: −0.0109±0.0011 −2: +0.0051±0.0011 −1: +0.0208±0.0010 |
| 14 vs 10 surrender | F4 | **4** | surrender at TC ≥ 4, otherwise the basic action | +3 | — | 1 | +3: −0.0014 ± 0.0009 (tie zone) | 0% / 0% | +3: +0.0014±0.0009 +4: +0.0086±0.0009 +5: +0.0189±0.0010 |
| 15 vs 10 surrender | F4 | **0** | surrender (basic) at TC ≥ 0, the basic action below | +0 | 0− | 0 | — | 0% / 0% | −1: −0.0133±0.0008 +0: +0.0058±0.0005 +1: +0.0221±0.0006 |
| 15 vs 9 surrender | F4 | **3** | surrender at TC ≥ 3, otherwise the basic action | +2 | 2+ | 1 | +2: −0.0007 ± 0.0007 (tie zone) | 0% / 0% | +2: +0.0007±0.0007 +3: +0.0136±0.0007 +4: +0.0225±0.0008 |
| 15 vs A surrender | F4 | **0** | surrender (basic) at TC ≥ 0, the basic action below | +1 | −1+ | −1 (rule) | Schlesinger: +0: +0.0106 ± 0.0005; BJA: −1: +0.0023 ± 0.0009 | 0% / 0% | −1: −0.0023±0.0009 +0: +0.0106±0.0005 +1: +0.0218±0.0007 |
| Insurance | insurance | **3** | take insurance at TC ≥ 3, otherwise decline | +3 | (S17 chart: 3+) | 0 | — | — | +2: −0.0166±0.0012 +3: +0.0055±0.0012 +4: +0.0272±0.0013 |

**Reading the differences (teaching policy, Q22).** Under S17 with the accepted taught continuation, ten curriculum values plus insurance reproduce Schlesinger (15 vs T is +4 here; the composition-dependent continuation had put it at 5) and eleven are one true count higher. Five of the eleven differ only through the accepted tie rule, with the published value costing nothing measurable or even gaining inside the tie zone (16 vs T, 0.0000 ± 0.0008 at TC 0; 12 vs 2, +0.0013 ± 0.0012 at +3; 9 vs 7, +0.0011 ± 0.0010 at +3; 14 vs T surrender, −0.0014 ± 0.0009 at +3; 15 vs 9 surrender, −0.0007 ± 0.0007 at +2); lessons should present these as "the published value is equally good here; True Count keeps the basic action because the gain is inside the tolerance". The other six are decisive: T,T vs 6 (+0.0188 ± 0.0026 at +4), 12 vs 5 (+0.0126 ± 0.0007 at −2), 13 vs 2 (+0.0072 ± 0.0010 at −1), 12 vs 6 (+0.0044 ± 0.0009 at −1), 15 vs A surrender (+0.0020 ± 0.0008 at +1) and 12 vs 4 (+0.0011 ± 0.0005 at TC 0, the most fragile value in the curriculum: it clears the tolerance by 0.0001, multi-card and post-split 12s stand profitably at TC 0 (+0.0010 ± 0.0013), and the 50%/80%/four-player stability runs gave 0; under the accepted default configuration and tolerance it is 1). Against the BJA S17 chart the only numeric difference outside those is 16 vs 9 (BJA 4+; the +4 bin is a tie, −0.0032 ± 0.0018); BJA's running-count-sign rules for 16 vs T ("0+") and 12 vs 4 ("0−") are not integer thresholds; the zero-bin split above shows they are right or neutral within TC 0 for two-card hands, and the accepted policy carries no sign exceptions. Under H17 the differences from Schlesinger's S17 list are rule differences; against the BJA H17 chart the differences are 11 vs A (BJA doubles at every count; hitting at TC ≤ −1 gains 0.0163 ± 0.0010), 15 vs A surrender (BJA "−1+" surrenders one count earlier at a cost of 0.0023 ± 0.0009), 13 vs 2 (BJA hits at −1, a +0.0001 tie), 16 vs 9 (as S17) and 9 vs 7 (+0.0011 tie).

**Certified curriculum, S17:** 16 vs T stand ≥ 1; 15 vs T stand ≥ 4; T,T vs 5 split ≥ 5; T,T vs 6 split ≥ 5; 10 vs T double ≥ 4; 12 vs 3 stand ≥ 2; 12 vs 2 stand ≥ 4; 11 vs A double ≥ 1; 9 vs 2 double ≥ 1; 10 vs A double ≥ 4; 9 vs 7 double ≥ 4; 16 vs 9 stand ≥ 5; 13 vs 2 stand ≥ 0 (hit below); 12 vs 4 stand ≥ 1; 12 vs 5 stand ≥ −1; 12 vs 6 stand ≥ 0; 13 vs 3 stand ≥ −2; 14 vs T surrender ≥ 4; 15 vs T surrender ≥ 0; 15 vs 9 surrender ≥ 3; 15 vs A surrender ≥ 2; insurance ≥ 3.

**Certified curriculum, H17:** 16 vs T stand ≥ 1; 15 vs T stand ≥ 4; T,T vs 5 split ≥ 5; T,T vs 6 split ≥ 4; 10 vs T double ≥ 4; 12 vs 3 stand ≥ 2; 12 vs 2 stand ≥ 3; 11 vs A double ≥ 0 (basic double, hit at ≤ −1); 9 vs 2 double ≥ 1; 10 vs A double ≥ 3; 9 vs 7 double ≥ 4; 16 vs 9 stand ≥ 5; 13 vs 2 stand ≥ −1; 12 vs 4 stand ≥ 0; 12 vs 5 stand ≥ −1; 12 vs 6 stand ≥ −3; 13 vs 3 stand ≥ −2; 14 vs T surrender ≥ 4; 15 vs T surrender ≥ 0; 15 vs 9 surrender ≥ 3; 15 vs A surrender ≥ 0 (basic surrender, hit at ≤ −1); insurance ≥ 3.

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

**Multi-card hands (final pass).** The engine path that values three- and four-card hands, on which the all-occurrence thresholds rest, was checked with the same simulator (`run_multicard_checks.sh`; initial hand of three or four cards, 8,000,000 rounds per cell, seed 1, S17, taught continuation) against the driver's fresh-shoe values (`multihands_fresh_S17.csv`, also reproduced by the `--perline` mode used for the occurrence pass):

| Hand vs up | Action | Monte Carlo ± SE | Calculator | MC − calc (SE) |
| --- | --- | ---: | ---: | ---: |
| 10-3-3 vs T | stand | −0.540846 ± 0.000310 | −0.541177 | +1.1 |
| 10-3-3 vs T | hit | −0.540566 ± 0.000297 | −0.540572 | +0.0 |
| 4-4-4-4 vs T | stand | −0.543346 ± 0.000309 | −0.543119 | −0.7 |
| 4-4-4-4 vs T | hit | −0.553587 ± 0.000294 | −0.553359 | −0.8 |
| 5-4-3 vs 4 | stand | −0.199523 ± 0.000346 | −0.198974 | −1.6 |
| 5-4-3 vs 4 | hit | −0.208436 ± 0.000337 | −0.208270 | −0.5 |

All six agree within 1.6 standard errors, and the simulator reproduces the sign of the multi-card stand − hit differences that the two-card cells do not show (4-4-4-4 vs T stands by +0.0102, 10-3-3 vs T hits by −0.0006).

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

Insurance pays +2 or −1 per unit insured, so its conditional expected return is `3p − 1` with `p` the probability that the concealed card is ten-valued; break-even is `p = 1/3`. The 2026-09-06 example of two 79-card pools with identical RC +6, denominator 1.5 and TC +4 but insurance returns −1/79 and +2/79 still stands: a count does not identify one composition-optimal action, which is why item 1 averages over reachable states.

## Reproducing

Exact commands, versions and file roles are in the [experiments README](../../experiments/blackjack-coaching-validation/README.md). Intermediate engine outputs (hundreds of MB) stay outside the repository; the committed CSVs are the parsed comparator, the generated tables and the aggregated index results. `reference-manifest.json` lists every frozen file with its SHA-256, the calculator commit, the SHA-256 of every script, the sampling seeds and sample sizes and the generation date; `python3 freeze_reference.py verify .` checks the committed files against it.

## Implementation checks (not research)

Under the accepted certification scope (Q23) the items below are implementation checks that use the frozen CSVs (`reference-manifest.json`) as fixtures. None of them reopens the reference; each records the evidence that bounds it.

1. **Intermediate penetrations and seat positions.** Penetrations 55–70% and one to three other players were not sampled. The 50%/80% and four-player stability runs bracket them and moved only tie-zone thresholds (15 vs T, 12 vs 3, 16 vs 9, 12 vs 4) by one count, through the tie rule. The learner always sat first; a seat after other players exposes more cards before the decision. The engine test should confirm that the taught thresholds are applied from the integer true count computed under the accepted convention at each decision, whatever the seat and penetration.
2. **A learner who stops resplitting T,T after re-counting.** The split values assume resplitting to four hands whenever the pair recurs (the calculator's and every published table's convention). A learner who re-evaluates the count after the first split and stops is not modelled; the effect is bounded by the always/never-resplit difference, which was measured only for T,T vs T on a fresh shoe (−0.363 against +0.053 per original bet). The product may apply the T,T index to each resplit decision separately; the reference is unchanged by that choice.
3. **End-to-end engine test.** The samplers implement the accepted reveal/peek/surrender/insurance order and the funding rule of Q24, but no harness exercises the product engine against `basic_*.csv`, `continuation_*.csv` and `indices_*_final.csv`. The manifest hashes identify the fixtures.
4. **Split-hand dealing order.** `sample_decisions.py` deals the second card to a split hand only when that hand is played (the usual table procedure); `sample_shoe_states.py` deals both second cards at the split. The round-start distribution is unaffected; the cards exposed at a post-split decision differ by at most one, well inside the tie zone. The engine should count whatever is actually exposed under its own dealing order.
5. **Supplementary situations.** The `supp` rows of `occurrences_*_tdb_thresholds.csv` (BJA chart entries outside the accepted I18/F4 list, and surrender-precedence checks) are evidence for lesson authors, not curriculum, and are not in the final index files. Their two-card generation used the same pipeline; the 8 vs 6 supplementary row included the 4,4 composition that the basic table splits, which the occurrence sampler excludes.
6. **Balance-limited allocation across split hands** is settled by the accepted play-order rule (Q24), not by a coupled optimisation; the fallback columns supply the per-hand action.

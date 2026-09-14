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

## Index thresholds

[INDEX SECTION PENDING]

## Independent Monte Carlo results

[MC SECTION PENDING]

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

[REMAINING SECTION PENDING]

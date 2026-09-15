# Blackjack coaching reference validation — experiment scripts

Scripts and generated data behind
[docs/research/blackjack-coaching-validation.md](../../docs/research/blackjack-coaching-validation.md)
(GitHub issue #15). Everything here is research tooling, not product code.

## Third-party calculator (not vendored)

Eric Farmer's GPL-3.0 blackjack calculator, pinned commit
`a1f7dbb74266fb39296292bdff568b076120a61c`, is cloned **outside** the repository:

```sh
git clone https://github.com/possibly-wrong/blackjack /tmp/farmer-blackjack
git -C /tmp/farmer-blackjack checkout a1f7dbb74266fb39296292bdff568b076120a61c
```

Only `src/blackjack.cpp` / `src/blackjack.h` are used. Its `indices.cpp`
true-count adapter is **not** used (it includes the concealed hole card in the
divisor pool, returns a fractional quotient, and approximates post-split
removal). The accepted True Count conversion is implemented in
`sample_shoe_states.py` and `evaluate_indices.py` instead.

## Toolchain used

- g++ (GCC) 16.2.1, `-O2 -std=c++17`
- Python 3.14.7 (standard library only)
- Linux x86_64, 8 cores; wall-clock runtimes below are for this machine

## Files

| File | Purpose |
| --- | --- |
| `farmer_driver.cpp` | Driver over the calculator: reads shoe compositions, prints stand/hit/double/split values for every two-card hand (or a supplied hand list, or multi-card hands with `--multihands`, or one specific hand per composition line with `--perline`) under S17/H17, DAS or no DAS, and continuation modes `cdz` (CDZ-), `cdp1`, `cdp`, or `tdb` (fixed total-dependent continuation from a CSV). |
| `parse_wizard_appendix9.py` | Parses Wizard of Odds Appendix 9 (six decks, S17 and H17) HTML into `wizard_appendix9_6deck.csv`. |
| `compare_appendix9.py` | Compares driver output for a fresh shoe with Appendix 9, all 550 non-pair/pair hands, three actions plus split. |
| `run_fresh.sh` | Builds the driver and runs the fresh-shoe comparison for S17/H17 × CDZ-/CDP1/CDP × DAS/no-DAS (12 runs, ~0.25 s each). |
| `generate_basic_tables.py` | Total-dependent basic strategy, legal-fallback columns and continuation tables for the four presets from fresh-shoe values. Writes `basic_<preset>.csv`, `tables_<preset>.md`, `continuation_<rules>.csv`. |
| `compare_basic_sources.py` | Cell-by-cell comparison of the generated tables with Wizard's 4–8-deck instructions and the BJA 2018 charts' base actions. |
| `check_pair_flips.py` | Whether any pair decision differs between Wizard's and the calculator's split values. |
| `mc_check.py` | Independent Monte Carlo (no shared code with the calculator) for one initial situation (two or more cards) and action under the taught continuation. |
| `run_split_checks.sh` | Fresh-shoe `tdb` runs plus the Monte Carlo batch for the disputed split cells. |
| `sample_shoe_states.py` | Simulates shoes under the accepted rules and writes a stratified sample of round-start compositions (with stratum populations) for index generation. |
| `run_sampling.sh` | Runs the sampler for the default configuration and four stability configurations. |
| `evaluate_indices.py` | Prepares compositions/hand lists for the driver and aggregates action-value differences by integer true count under the accepted convention; also the insurance index. |
| `run_driver_parallel.py` | Runs the driver over a large composition file in parallel chunks. |
| `run_indices.sh` | Full index pipeline for one sampled configuration (modes and rule sets selectable). |
| `subsample_states.py` | Caps a sampled-states file per stratum while keeping population counts. |
| `run_all_indices.sh`, `chain_indices.sh`, `chain_mc2.sh` | Orchestration used for the long runs (main configuration at cap 1200, stability configurations at cap 400; second Monte Carlo batch after the first). |
| `run_split_checks2.sh` | Resplit-cap diagnosis with the Monte Carlo simulator (`--max-hands` 2, 3, 8, 1000). |
| `insurance_sim.py` | Independent empirical insurance check: hole-card outcomes by true count at the insurance decision, no calculator involved. |
| `compare_indices.py` | Consolidates generated thresholds across rules, continuations and configurations with the published values into one Markdown table. |
| `diff_presets.py` | Lists teaching cells that differ between presets. |
| `diagnose_bins.py` | Pipeline diagnostics: RC = 0 bin means by depth and mean exact quotient per integer bin. |
| `stability_detail.py` | Raw and tolerance thresholds with nearby bins across configurations for selected situations. |
| `reaggregate_all.sh` | Re-runs every aggregation from saved driver outputs (including the rounding-convention variants and insurance). |
| `multihands.txt`, `multihands_fresh_S17.csv`, `multihands_fresh_H17.csv` | Three- and four-card compositions of the index totals evaluated on a fresh shoe (driver `--multihands`). |
| `sample_decisions.py` | Replays the default configuration and records every learner decision that is an index situation (original two-card, multi-card, post-split two-card, post-split multi-card) with the unseen pool and the exposed-card running count at that moment; stratified by (situation, true count, category) with population counts; split hands dealt sequentially. |
| `run_decisions.sh` | Eight replicas of the decision sampler (400,000 shoes each, seeds 201–208) in parallel. |
| `aggregate_occurrences.py` | Merges the replicas, prepares the per-line driver input, and combines the accepted two-card bins with the multi-card/post-split occurrence bins into all-occurrence thresholds (plus direct and post-split-only thresholds as cross-checks). |
| `run_occurrences.sh` | Occurrence pipeline: prepare, S17 and H17 engine passes (`--perline`, `tdb`), aggregation. |
| `run_supplement.sh` | Supplementary pass: widens the focus to two counts either side of every curriculum threshold, re-draws those non-original strata at full cap, values only the new occurrences and re-aggregates with both driver outputs. |
| `run_multicard_checks.sh` | Independent Monte Carlo checks of the calculator's multi-card hand values. |
| `make_final_indices.py` | Writes `indices_S17_final.csv` and `indices_H17_final.csv` (curriculum thresholds with two-card, post-split, published and cost columns). |
| `format_occurrence_tables.py` | Renders the report's all-occurrence and post-split Markdown tables from the occurrence CSVs. |
| `check_direct_estimator.py` | Cross-check: where the direct (occurrence-only) estimator's threshold differs from the mixed estimator's, prints both bin means and their difference in standard errors. |
| `freeze_reference.py` | Writes and verifies `reference-manifest.json`. |
| `occurrences_<rules>_tdb_thresholds.csv`, `occurrences_<rules>_tdb_bins.csv` | All-occurrence index results (S17, H17): population shares, two-card, non-original, post-split and combined bins and thresholds. |
| `indices_S17_final.csv`, `indices_H17_final.csv` | **Frozen curriculum index files** consumed by lessons and the engine (I18, F4, insurance). |
| `reference-manifest.json` | Frozen-reference manifest: SHA-256 of every frozen file and script, calculator commit, seeds, sample sizes, generation date. |
| `published_indices.csv` | Published I18/F4 values (Wizard/Schlesinger) and BJA 2018 chart entries with their stated meanings, for comparison. |
| `wizard_appendix9_6deck.csv` | Parsed comparator values (source: Wizard of Odds, retrieved 2026-09-14). |
| `basic_*.csv`, `tables_*.md`, `continuation_*.csv` | Generated launch reference tables (see report for status). |
| `indices_*_thresholds.csv`, `indices_*_bins.csv`, `indices_*_insurance_bins.csv` | Generated index results per configuration, rules and continuation mode. |

## Fallback columns and the funding rule

Every `basic_<preset>.csv` row carries the validated next-best legal action
for each way the prescribed action can be unavailable: `fallback_double`
(double unavailable on a post-split hand, or balance-limited where surrender
is not legal), `fallback_double_ls_original` (double unaffordable on an
original two-card hand in an LS preset), `fallback_split_rule` (four hands
reached or aces cannot be resplit), `fallback_split_balance` (another wager
cannot be funded) and `fallback_surrender` (surrender prescribed but
unavailable).  The report's "Legal-fallback table" section documents the
cells where the cause changes the answer.

**Funding rule across live split hands (accepted, issue #15, Q24):** fund
hands in play order; the earliest live hand that prescribes a double receives
the last affordable wager, and every later hand uses its fallback column
(`fallback_double` for a prescribed double, `fallback_split_balance` for a
prescribed further split).  The fallback columns give the per-hand action;
the rule only decides which hand is funded.

## Exact commands

```sh
cd experiments/blackjack-coaching-validation
curl -sSL -o /tmp/sources/wiz_app9_6ds17r4.html https://wizardofodds.com/games/blackjack/appendix/9/6ds17r4/
curl -sSL -o /tmp/sources/wiz_app9_6dh17r4.html https://wizardofodds.com/games/blackjack/appendix/9/6dh17r4/
python3 parse_wizard_appendix9.py /tmp/sources/wiz_app9_6ds17r4.html /tmp/sources/wiz_app9_6dh17r4.html wizard_appendix9_6deck.csv
bash run_fresh.sh                       # ~5 s; comparison printed
python3 generate_basic_tables.py --s17 /tmp/bjwork/fresh_S17_cdz_das.csv --h17 /tmp/bjwork/fresh_H17_cdz_das.csv --outdir .
python3 compare_basic_sources.py basic_S17_LS.csv basic_H17_LS.csv basic_S17_noLS.csv basic_H17_noLS.csv
python3 check_pair_flips.py wizard_appendix9_6deck.csv /tmp/bjwork/fresh_S17_cdz_das.csv /tmp/bjwork/fresh_H17_cdz_das.csv
TRIALS=8000000 bash run_split_checks.sh # Monte Carlo batch, see report for runtime
SHOES=400000 CAP=2500 bash run_sampling.sh   # five configurations in parallel
bash run_indices.sh /tmp/bjwork/states_p75_n0.json p75_n0 "cdz tdb"
bash run_indices.sh /tmp/bjwork/states_p50_n0.json p50_n0 cdz
bash run_indices.sh /tmp/bjwork/states_p80_n0.json p80_n0 cdz
bash run_indices.sh /tmp/bjwork/states_p75_n4.json p75_n4 cdz
bash run_indices.sh /tmp/bjwork/states_h17nols_p75_n0.json h17nols_p75_n0 cdz
# or, as actually run: SHOES=400000 CAP=2500 bash run_sampling.sh; bash run_all_indices.sh
python3 compare_indices.py .
python3 insurance_sim.py --basic basic_S17_LS.csv --shoes 300000 --penetration 0.75 --players 0 --seed 5
/tmp/bjwork/farmer_driver --mode tdb --table continuation_S17.csv --multihands multihands.txt < /tmp/bjwork/fresh.txt
# final pass (all-occurrence thresholds, frozen reference)
g++ -O2 -std=c++17 -I/tmp/farmer-blackjack/src -o /tmp/bjwork/farmer_driver farmer_driver.cpp /tmp/farmer-blackjack/src/blackjack.cpp
bash run_decisions.sh                                  # eight replicas x 400,000 shoes in parallel
CAPS="200 50 6 2 21" WORKERS=4 bash run_occurrences.sh  # 60,147 builds per rule set, both rule sets in parallel
RADIUS=2 CAP=200 SEED=22 WORKERS=4 bash run_supplement.sh  # 16,407 more builds per rule set for the bins two counts from each curriculum threshold
bash run_multicard_checks.sh                           # six Monte Carlo cells (multi-card hands)
python3 make_final_indices.py .
python3 freeze_reference.py write . && python3 freeze_reference.py verify .
```

Intermediate driver outputs (hundreds of MB) stay in `/tmp/bjwork`; only the
aggregated CSVs are committed.

## Measured runtimes (8-core Linux workstation, 2026-09-14)

| Step | Runtime |
| --- | --- |
| One engine build (fresh or depleted six-deck shoe) | about 0.22 s per composition per core |
| `run_fresh.sh` (12 fresh-shoe runs + comparison) | about 5 s |
| `mc_check.py`, 8,000,000 rounds, 8 workers | 2–3 min per cell (longer when sharing the machine) |
| `run_sampling.sh`, 400,000 shoes per configuration, five configurations in parallel | about 10 min |
| Index driver pass, 34,967 compositions, 81 hand/up triples, 8 workers | 13–16 min per rule set and continuation (about 35 min while the Monte Carlo batch shared the machine) |
| Stability passes (7,356 + 14,077 + 11,622 + 12,593 compositions) | about 20 min total |
| `evaluate_indices.py aggregate` on one driver output | about 1 min |
| `insurance_sim.py`, 300,000 shoes | about 6 min |
| `run_decisions.sh`, eight replicas of 400,000 shoes in parallel (138.3 million rounds, 36.1 million index-situation occurrences counted) | about 4.5 min |
| `run_multicard_checks.sh`, six Monte Carlo cells of 8,000,000 rounds | about 2–3 min per cell alone (14 min for the batch while sharing the machine) |
| `run_occurrences.sh`, 60,147 per-line calculator builds per rule set, S17 and H17 in parallel with 4 workers each | 86 min (about 0.29 s CPU per build) |
| `run_supplement.sh`, 16,407 more builds per rule set, both in parallel | 23 min |
| `aggregate_occurrences.py aggregate`, one rule set | about 15 s |

Random seeds: sampler 101–105 (see `run_sampling.sh`), subsampling 11–15,
Monte Carlo seed 1 (worker seeds 1000–1007), insurance simulation seed 5,
decision-occurrence replicas 201–208 (each replica's reservoir uses seed +
1,000,000), occurrence subsample 21.

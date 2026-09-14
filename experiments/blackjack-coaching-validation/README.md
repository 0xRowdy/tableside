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
| `farmer_driver.cpp` | Driver over the calculator: reads shoe compositions, prints stand/hit/double/split values for every two-card hand (or a supplied hand list) under S17/H17, DAS or no DAS, and continuation modes `cdz` (CDZ-), `cdp1`, `cdp`, or `tdb` (fixed total-dependent continuation from a CSV). |
| `parse_wizard_appendix9.py` | Parses Wizard of Odds Appendix 9 (six decks, S17 and H17) HTML into `wizard_appendix9_6deck.csv`. |
| `compare_appendix9.py` | Compares driver output for a fresh shoe with Appendix 9, all 550 non-pair/pair hands, three actions plus split. |
| `run_fresh.sh` | Builds the driver and runs the fresh-shoe comparison for S17/H17 × CDZ-/CDP1/CDP × DAS/no-DAS (12 runs, ~0.25 s each). |
| `generate_basic_tables.py` | Total-dependent basic strategy, legal-fallback columns and continuation tables for the four presets from fresh-shoe values. Writes `basic_<preset>.csv`, `tables_<preset>.md`, `continuation_<rules>.csv`. |
| `compare_basic_sources.py` | Cell-by-cell comparison of the generated tables with Wizard's 4–8-deck instructions and the BJA 2018 charts' base actions. |
| `check_pair_flips.py` | Whether any pair decision differs between Wizard's and the calculator's split values. |
| `mc_check.py` | Independent Monte Carlo (no shared code with the calculator) for one initial situation and action under the taught continuation. |
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
| `multihands.txt`, `multihands_fresh_S17.csv`, `multihands_fresh_H17.csv` | Three- and four-card compositions of the index totals evaluated on a fresh shoe (driver `--multihands`). |
| `published_indices.csv` | Published I18/F4 values (Wizard/Schlesinger) and BJA 2018 chart entries with their stated meanings, for comparison. |
| `wizard_appendix9_6deck.csv` | Parsed comparator values (source: Wizard of Odds, retrieved 2026-09-14). |
| `basic_*.csv`, `tables_*.md`, `continuation_*.csv` | Generated launch reference tables (see report for status). |
| `indices_*_thresholds.csv`, `indices_*_bins.csv`, `indices_*_insurance_bins.csv` | Generated index results per configuration, rules and continuation mode. |

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
```

Intermediate driver outputs (hundreds of MB) stay in `/tmp/bjwork`; only the
aggregated CSVs are committed.

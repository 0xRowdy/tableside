#!/usr/bin/env bash
# Re-run every aggregation from the saved driver outputs with the current
# evaluate_indices.py (fast; no engine runs).  Also the rounding-convention
# variants used only for the comparator check, and the insurance bins.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
agg() { # tag rules mode states
  if [ -s "$WORK/idx_$1_$2_$3.csv" ]; then
    python3 "$HERE/evaluate_indices.py" aggregate "$4" "$WORK/idx_$1_$2_$3.csv" "$2" "$HERE/indices_$1_$2_$3" > "$WORK/agg_$1_$2_$3.txt"
    echo "aggregated $1 $2 $3"
  fi
}
agg p75_n0 S17 cdz "$WORK/states_p75_n0_main.json"
agg p75_n0 H17 cdz "$WORK/states_p75_n0_main.json"
agg p75_n0 S17 tdb "$WORK/states_p75_n0_main.json"
agg p75_n0 H17 tdb "$WORK/states_p75_n0_main.json"
agg p50_n0 S17 cdz "$WORK/states_p50_n0_stab.json"
agg p80_n0 S17 cdz "$WORK/states_p80_n0_stab.json"
agg p75_n4 S17 cdz "$WORK/states_p75_n4_stab.json"
agg h17nols_p75_n0 H17 cdz "$WORK/states_h17nols_p75_n0_stab.json"
for R in S17 H17; do
  if [ -s "$WORK/idx_p75_n0_${R}_cdz.csv" ]; then
    python3 "$HERE/evaluate_indices.py" --round aggregate "$WORK/states_p75_n0_main.json" "$WORK/idx_p75_n0_${R}_cdz.csv" "$R" "$HERE/indices_p75_n0_round_${R}_cdz" > "$WORK/agg_p75_n0_round_${R}_cdz.txt"
    echo "aggregated rounding $R"
  fi
done
python3 "$HERE/evaluate_indices.py" insurance "$WORK/states_p75_n0_main.json" ALL "$HERE/indices_p75_n0" > "$WORK/agg_p75_n0_insurance.txt"
echo "insurance aggregated"

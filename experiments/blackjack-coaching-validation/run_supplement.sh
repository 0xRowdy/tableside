#!/usr/bin/env bash
# Supplementary occurrence pass: widen the focus to two true counts either
# side of every curriculum two-card threshold, re-draw the non-original
# strata of the newly focused bins at full cap, value only the new
# occurrences (S17 and H17 in parallel) and re-aggregate with both driver
# outputs.  Run after run_occurrences.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
DRIVER=${DRIVER:-$WORK/farmer_driver}
WORKERS=${WORKERS:-4}
OUT=${OUT:-occurrences}
RADIUS=${RADIUS:-2}
CAP=${CAP:-200}
SEED=${SEED:-22}
python3 "$HERE/aggregate_occurrences.py" supplement "$WORK/decisions_*.json" "$WORK/occ_${OUT}.json" "$WORK/occ_${OUT}_supp.json" "$WORK/occ_${OUT}_supp_comps.txt" \
  "$HERE/indices_p75_n0_S17_tdb_thresholds.csv,$HERE/indices_p75_n0_H17_tdb_thresholds.csv" "$RADIUS" "$CAP" "$SEED"
date
python3 "$HERE/run_driver_parallel.py" "$DRIVER" "$WORK/occ_${OUT}_supp_comps.txt" "$WORK/occ_${OUT}_supp_S17_tdb.csv" "$WORKERS" \
  --perline --mode tdb --table "$HERE/continuation_S17.csv" &
python3 "$HERE/run_driver_parallel.py" "$DRIVER" "$WORK/occ_${OUT}_supp_comps.txt" "$WORK/occ_${OUT}_supp_H17_tdb.csv" "$WORKERS" \
  --perline --mode tdb --table "$HERE/continuation_H17.csv" --h17 &
wait
date
for R in S17 H17; do
  python3 "$HERE/aggregate_occurrences.py" aggregate "$WORK/occ_${OUT}_supp.json" "$WORK/occ_${OUT}_${R}_tdb.csv,$WORK/occ_${OUT}_supp_${R}_tdb.csv" "$R" \
    "$HERE/indices_p75_n0_${R}_tdb_bins.csv" "$HERE/${OUT}_${R}_tdb" > "$WORK/agg_${OUT}_${R}_tdb.txt"
done
echo "supplement done"

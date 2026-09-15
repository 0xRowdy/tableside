#!/usr/bin/env bash
# All-occurrence index pass: merge the decision-occurrence replicas
# (run_decisions.sh), value every sampled occurrence with the calculator
# under the taught continuation for S17 and H17 (one build per occurrence,
# both rule sets in parallel), and aggregate into the all-occurrence
# thresholds next to the accepted two-card ones.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
DRIVER=${DRIVER:-$WORK/farmer_driver}   # built from farmer_driver.cpp with --perline support (see README)
WORKERS=${WORKERS:-4}
CAPS=${CAPS:-"250 80 12 4 21"}
PREFIX=${PREFIX:-decisions}
OUT=${OUT:-occurrences}
python3 "$HERE/aggregate_occurrences.py" prepare "$WORK/${PREFIX}_*.json" "$WORK/occ_${OUT}.json" "$WORK/occ_${OUT}_comps.txt" \
  "$HERE/indices_p75_n0_S17_tdb_thresholds.csv,$HERE/indices_p75_n0_H17_tdb_thresholds.csv" $CAPS
date
python3 "$HERE/run_driver_parallel.py" "$DRIVER" "$WORK/occ_${OUT}_comps.txt" "$WORK/occ_${OUT}_S17_tdb.csv" "$WORKERS" \
  --perline --mode tdb --table "$HERE/continuation_S17.csv" &
python3 "$HERE/run_driver_parallel.py" "$DRIVER" "$WORK/occ_${OUT}_comps.txt" "$WORK/occ_${OUT}_H17_tdb.csv" "$WORKERS" \
  --perline --mode tdb --table "$HERE/continuation_H17.csv" --h17 &
wait
date
for R in S17 H17; do
  python3 "$HERE/aggregate_occurrences.py" aggregate "$WORK/occ_${OUT}.json" "$WORK/occ_${OUT}_${R}_tdb.csv" "$R" \
    "$HERE/indices_p75_n0_${R}_tdb_bins.csv" "$HERE/${OUT}_${R}_tdb" > "$WORK/agg_${OUT}_${R}_tdb.txt"
done
echo "occurrences done"

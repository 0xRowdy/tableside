#!/usr/bin/env bash
# Index generation: evaluate the sampled round-start states with the
# calculator (S17 and H17; composition-dependent continuation "cdz" and the
# taught total-dependent continuation "tdb"), then aggregate by integer true
# count under the accepted convention.
#
#   bash run_indices.sh <states.json> <tag> [modes] [rules]   e.g. p75_n0 "cdz tdb" "S17 H17"
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
WORKERS=${WORKERS:-8}
STATES="$1"; TAG="$2"; MODES="${3:-cdz tdb}"; RULES="${4:-S17 H17}"
python3 "$HERE/evaluate_indices.py" prepare "$STATES" "$WORK/comps_$TAG.txt" "$WORK/hands.txt"
for MODE in $MODES; do
  for R in $RULES; do
    if [ "$R" = H17 ]; then H17FLAG=--h17; else H17FLAG=; fi
    if [ "$MODE" = tdb ]; then
      python3 "$HERE/run_driver_parallel.py" "$WORK/farmer_driver" "$WORK/comps_$TAG.txt" "$WORK/idx_${TAG}_${R}_tdb.csv" "$WORKERS" --mode tdb --table "$HERE/continuation_$R.csv" $H17FLAG --hands "$WORK/hands.txt"
    else
      python3 "$HERE/run_driver_parallel.py" "$WORK/farmer_driver" "$WORK/comps_$TAG.txt" "$WORK/idx_${TAG}_${R}_$MODE.csv" "$WORKERS" --mode "$MODE" $H17FLAG --hands "$WORK/hands.txt"
    fi
    python3 "$HERE/evaluate_indices.py" aggregate "$STATES" "$WORK/idx_${TAG}_${R}_$MODE.csv" "$R" "$HERE/indices_${TAG}_${R}_$MODE" > "$WORK/agg_${TAG}_${R}_$MODE.txt"
  done
done
python3 "$HERE/evaluate_indices.py" insurance "$STATES" ALL "$HERE/indices_${TAG}" > "$WORK/agg_${TAG}_insurance.txt"
echo "indices done for $TAG"

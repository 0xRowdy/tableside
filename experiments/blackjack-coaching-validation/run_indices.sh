#!/usr/bin/env bash
# Index generation: evaluate the sampled round-start states with the
# calculator (S17 and H17; composition-dependent continuation "cdz" and the
# taught total-dependent continuation "tdb"), then aggregate by integer true
# count under the accepted convention.
#
#   bash run_indices.sh <states.json> <tag> [modes]      e.g. p75_n0 "cdz tdb"
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
WORKERS=${WORKERS:-8}
STATES="$1"; TAG="$2"; MODES="${3:-cdz tdb}"
python3 "$HERE/evaluate_indices.py" prepare "$STATES" "$WORK/comps_$TAG.txt" "$WORK/hands.txt"
for MODE in $MODES; do
  if [ "$MODE" = tdb ]; then
    python3 "$HERE/run_driver_parallel.py" "$WORK/farmer_driver" "$WORK/comps_$TAG.txt" "$WORK/idx_${TAG}_S17_tdb.csv" "$WORKERS" --mode tdb --table "$HERE/continuation_S17.csv" --hands "$WORK/hands.txt"
    python3 "$HERE/run_driver_parallel.py" "$WORK/farmer_driver" "$WORK/comps_$TAG.txt" "$WORK/idx_${TAG}_H17_tdb.csv" "$WORKERS" --mode tdb --table "$HERE/continuation_H17.csv" --h17 --hands "$WORK/hands.txt"
  else
    python3 "$HERE/run_driver_parallel.py" "$WORK/farmer_driver" "$WORK/comps_$TAG.txt" "$WORK/idx_${TAG}_S17_$MODE.csv" "$WORKERS" --mode "$MODE" --hands "$WORK/hands.txt"
    python3 "$HERE/run_driver_parallel.py" "$WORK/farmer_driver" "$WORK/comps_$TAG.txt" "$WORK/idx_${TAG}_H17_$MODE.csv" "$WORKERS" --mode "$MODE" --h17 --hands "$WORK/hands.txt"
  fi
  python3 "$HERE/evaluate_indices.py" aggregate "$STATES" "$WORK/idx_${TAG}_S17_$MODE.csv" S17 "$HERE/indices_${TAG}_S17_$MODE" > "$WORK/agg_${TAG}_S17_$MODE.txt"
  python3 "$HERE/evaluate_indices.py" aggregate "$STATES" "$WORK/idx_${TAG}_H17_$MODE.csv" H17 "$HERE/indices_${TAG}_H17_$MODE" > "$WORK/agg_${TAG}_H17_$MODE.txt"
done
python3 "$HERE/evaluate_indices.py" insurance "$STATES" ALL "$HERE/indices_${TAG}" > "$WORK/agg_${TAG}_insurance.txt"
echo "indices done for $TAG"

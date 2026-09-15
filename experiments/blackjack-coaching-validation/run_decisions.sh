#!/usr/bin/env bash
# Sample the learner's index-situation decision occurrences (all card
# counts, original and post-split) in the accepted default configuration:
# eight independent replicas of 400,000 shoes (seeds 201-208) run in
# parallel; every replica keeps its own stratum populations so the merged
# sample stays unbiased (see aggregate_occurrences.py).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
SHOES=${SHOES:-400000}
CAP=${CAP:-150}
BASIC=${BASIC:-basic_S17_LS.csv}
H17=${H17:-0}
LS=${LS:-1}
PREFIX=${PREFIX:-decisions}
for SEED in 201 202 203 204 205 206 207 208; do
  python3 "$HERE/sample_decisions.py" --basic "$HERE/$BASIC" --h17 "$H17" --ls "$LS" --penetration 0.75 --players 0 \
    --shoes "$SHOES" --seed "$SEED" --cap "$CAP" --out "$WORK/${PREFIX}_$SEED.json" 2> "$WORK/${PREFIX}_$SEED.log" &
done
wait
echo "decisions sampling done"

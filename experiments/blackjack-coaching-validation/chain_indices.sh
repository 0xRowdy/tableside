#!/usr/bin/env bash
# Waits for the sampling batch, then runs all index generation (long-running;
# launch with nohup).
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
until grep -q "sampling done" "$WORK/sampling.log" 2>/dev/null; do sleep 10; done
bash "$HERE/run_all_indices.sh" > "$WORK/all_indices.log" 2>&1
echo "INDEX RUNS FINISHED rc=$?" >> "$WORK/all_indices.log"

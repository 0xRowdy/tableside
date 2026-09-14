#!/usr/bin/env bash
# Waits for the first Monte Carlo batch, then runs the resplit-cap diagnosis
# (launch with nohup).
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
until grep -q "H17 8,8 vs 1 action P" "$WORK/split_checks.log" 2>/dev/null || grep -q "Traceback" "$WORK/split_checks.log"; do sleep 10; done
TRIALS=8000000 bash "$HERE/run_split_checks2.sh" > "$WORK/split_checks2.log" 2>&1
echo "MC BATCH 2 DONE rc=$?" >> "$WORK/split_checks2.log"

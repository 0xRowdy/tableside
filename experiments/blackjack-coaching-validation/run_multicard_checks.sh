#!/usr/bin/env bash
# Independent Monte Carlo check of the calculator's multi-card hand values
# (the path used for multi-card index occurrences).  mc_check.py shares no
# code with the calculator; the reference values are the fresh-shoe
# multihands_fresh_S17.csv rows produced by the driver (--multihands or
# --perline) under the taught continuation.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TRIALS=${TRIALS:-8000000}
MC="python3 $HERE/mc_check.py --basic $HERE/basic_S17_LS.csv --continuation $HERE/continuation_S17.csv --trials $TRIALS --h17 0"
$MC --hand 10,3,3 --up 10 --action S
$MC --hand 10,3,3 --up 10 --action H
$MC --hand 4,4,4,4 --up 10 --action S
$MC --hand 4,4,4,4 --up 10 --action H
$MC --hand 5,4,3 --up 4 --action S
$MC --hand 5,4,3 --up 4 --action H
echo MC_MULTI_DONE

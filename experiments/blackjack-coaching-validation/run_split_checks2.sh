#!/usr/bin/env bash
# Diagnosis of the comparator's ten-pair split values: does removing the
# four-hand cap reproduce them?  (Diagnostic only; launch rules cap at four.)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TRIALS=${TRIALS:-8000000}
MC="python3 $HERE/mc_check.py --basic $HERE/basic_S17_LS.csv --continuation $HERE/continuation_S17.csv --trials $TRIALS"
$MC --h17 0 --hand 10,10 --up 10 --action P --resplit always --max-hands 8
$MC --h17 0 --hand 10,10 --up 10 --action P --resplit always --max-hands 1000
$MC --h17 0 --hand 10,10 --up 10 --action P --resplit always --max-hands 3
$MC --h17 0 --hand 10,10 --up 10 --action P --resplit always --max-hands 2
$MC --h17 0 --hand 10,10 --up 5  --action P --resplit always --max-hands 1000
$MC --h17 0 --hand 10,10 --up 9  --action P --resplit always --max-hands 1000

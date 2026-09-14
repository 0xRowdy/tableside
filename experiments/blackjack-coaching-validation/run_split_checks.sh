#!/usr/bin/env bash
# Split-value investigation.
# 1. Fresh-shoe values with the fixed total-dependent continuation (tdb mode),
#    which is the continuation the app will teach.
# 2. Independent Monte Carlo (mc_check.py shares no code with the calculator)
#    for the ten-pair and eight-pair cells under the same continuation, with
#    resplit conventions "always" (calculator convention) and "never".
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
TRIALS=${TRIALS:-8000000}
"$WORK/farmer_driver" --mode tdb --table "$HERE/continuation_S17.csv"       < "$WORK/fresh.txt" > "$WORK/fresh_S17_tdb_das.csv"
"$WORK/farmer_driver" --mode tdb --table "$HERE/continuation_H17.csv" --h17 < "$WORK/fresh.txt" > "$WORK/fresh_H17_tdb_das.csv"
python3 "$HERE/compare_appendix9.py" "$HERE/wizard_appendix9_6deck.csv" S17-tdb="$WORK/fresh_S17_tdb_das.csv" H17-tdb="$WORK/fresh_H17_tdb_das.csv" > "$WORK/compare_appendix9_tdb.txt"
grep -E "^==|^   (stand|hit|double|split ) *:|split  (10,10|8,8) " "$WORK/compare_appendix9_tdb.txt"
echo "=== calculator tdb values for MC cells ==="
grep -E "^fresh,(10,10,(10|5|6|9|1)|8,8,(10|1)|2,2,6|9,9,7)," "$WORK/fresh_S17_tdb_das.csv" | sed 's/^/S17 tdb /'
grep -E "^fresh,(10,10,(5|6)|8,8,(10|1))," "$WORK/fresh_H17_tdb_das.csv" | sed 's/^/H17 tdb /'
echo "=== Monte Carlo ==="
MC="python3 $HERE/mc_check.py --basic $HERE/basic_S17_LS.csv --continuation $HERE/continuation_S17.csv --trials $TRIALS"
$MC --h17 0 --hand 10,10 --up 10 --action P --resplit always
$MC --h17 0 --hand 10,10 --up 10 --action P --resplit never
$MC --h17 0 --hand 10,10 --up 9  --action P --resplit always
$MC --h17 0 --hand 10,10 --up 5  --action P --resplit always
$MC --h17 0 --hand 10,10 --up 6  --action P --resplit always
$MC --h17 0 --hand 8,8   --up 10 --action P --resplit always
$MC --h17 0 --hand 8,8   --up 1  --action P --resplit always
$MC --h17 0 --hand 2,2   --up 6  --action P --resplit always
$MC --h17 0 --hand 8,8   --up 10 --action H --resplit always
$MC --h17 0 --hand 10,10 --up 5  --action S --resplit always
MCH="python3 $HERE/mc_check.py --basic $HERE/basic_H17_LS.csv --continuation $HERE/continuation_H17.csv --trials $TRIALS"
$MCH --h17 1 --hand 10,10 --up 5  --action P --resplit always
$MCH --h17 1 --hand 10,10 --up 6  --action P --resplit always
$MCH --h17 1 --hand 8,8   --up 1  --action P --resplit always

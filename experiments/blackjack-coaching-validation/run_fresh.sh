#!/usr/bin/env bash
# Fresh six-deck shoe: every two-card action value under S17/H17, three
# calculator continuation modes (CDZ-, CDP1, CDP), DAS and no-DAS, then the
# comparison against Wizard of Odds Appendix 9.
# Build directory and third-party source live outside the repository.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
FARMER=${FARMER:-/tmp/farmer-blackjack}
WORK=${WORK:-/tmp/bjwork}
mkdir -p "$WORK"
g++ -O2 -std=c++17 -I "$FARMER/src" "$HERE/farmer_driver.cpp" "$FARMER/src/blackjack.cpp" -o "$WORK/farmer_driver"
echo "fresh 24 24 24 24 24 24 24 24 24 96" > "$WORK/fresh.txt"
"$WORK/farmer_driver" --mode cdz            < "$WORK/fresh.txt" > "$WORK/fresh_S17_cdz_das.csv" &
"$WORK/farmer_driver" --mode cdp1           < "$WORK/fresh.txt" > "$WORK/fresh_S17_cdp1_das.csv" &
"$WORK/farmer_driver" --mode cdp            < "$WORK/fresh.txt" > "$WORK/fresh_S17_cdp_das.csv" &
"$WORK/farmer_driver" --mode cdz  --nodas   < "$WORK/fresh.txt" > "$WORK/fresh_S17_cdz_nodas.csv" &
"$WORK/farmer_driver" --mode cdp1 --nodas   < "$WORK/fresh.txt" > "$WORK/fresh_S17_cdp1_nodas.csv" &
"$WORK/farmer_driver" --mode cdp  --nodas   < "$WORK/fresh.txt" > "$WORK/fresh_S17_cdp_nodas.csv" &
"$WORK/farmer_driver" --mode cdz  --h17         < "$WORK/fresh.txt" > "$WORK/fresh_H17_cdz_das.csv" &
"$WORK/farmer_driver" --mode cdp1 --h17         < "$WORK/fresh.txt" > "$WORK/fresh_H17_cdp1_das.csv" &
"$WORK/farmer_driver" --mode cdp  --h17         < "$WORK/fresh.txt" > "$WORK/fresh_H17_cdp_das.csv" &
"$WORK/farmer_driver" --mode cdz  --h17 --nodas < "$WORK/fresh.txt" > "$WORK/fresh_H17_cdz_nodas.csv" &
"$WORK/farmer_driver" --mode cdp1 --h17 --nodas < "$WORK/fresh.txt" > "$WORK/fresh_H17_cdp1_nodas.csv" &
"$WORK/farmer_driver" --mode cdp  --h17 --nodas < "$WORK/fresh.txt" > "$WORK/fresh_H17_cdp_nodas.csv" &
wait
python3 "$HERE/compare_appendix9.py" "$HERE/wizard_appendix9_6deck.csv" \
  S17-cdz="$WORK/fresh_S17_cdz_das.csv" S17-cdp1="$WORK/fresh_S17_cdp1_das.csv" S17-cdp="$WORK/fresh_S17_cdp_das.csv" \
  S17-cdz-nodas="$WORK/fresh_S17_cdz_nodas.csv" S17-cdp1-nodas="$WORK/fresh_S17_cdp1_nodas.csv" S17-cdp-nodas="$WORK/fresh_S17_cdp_nodas.csv" \
  H17-cdz="$WORK/fresh_H17_cdz_das.csv" H17-cdp1="$WORK/fresh_H17_cdp1_das.csv" H17-cdp="$WORK/fresh_H17_cdp_das.csv" \
  H17-cdz-nodas="$WORK/fresh_H17_cdz_nodas.csv" H17-cdp1-nodas="$WORK/fresh_H17_cdp1_nodas.csv" H17-cdp-nodas="$WORK/fresh_H17_cdp_nodas.csv"

#!/usr/bin/env bash
# Sample round-start shoe states for index generation: default configuration
# (75% penetration, learner alone) plus stability configurations (50%, 80%,
# and four other players).  Runs the four samplers in parallel.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
SHOES=${SHOES:-40000}
CAP=${CAP:-2000}
python3 "$HERE/sample_shoe_states.py" --basic "$HERE/basic_S17_LS.csv" --h17 0 --ls 1 --penetration 0.75 --players 0 --shoes "$SHOES" --seed 101 --cap "$CAP" --out "$WORK/states_p75_n0.json" 2> "$WORK/states_p75_n0.log" &
python3 "$HERE/sample_shoe_states.py" --basic "$HERE/basic_S17_LS.csv" --h17 0 --ls 1 --penetration 0.50 --players 0 --shoes "$SHOES" --seed 102 --cap "$CAP" --out "$WORK/states_p50_n0.json" 2> "$WORK/states_p50_n0.log" &
python3 "$HERE/sample_shoe_states.py" --basic "$HERE/basic_S17_LS.csv" --h17 0 --ls 1 --penetration 0.80 --players 0 --shoes "$SHOES" --seed 103 --cap "$CAP" --out "$WORK/states_p80_n0.json" 2> "$WORK/states_p80_n0.log" &
python3 "$HERE/sample_shoe_states.py" --basic "$HERE/basic_S17_LS.csv" --h17 0 --ls 1 --penetration 0.75 --players 4 --shoes "$SHOES" --seed 104 --cap "$CAP" --out "$WORK/states_p75_n4.json" 2> "$WORK/states_p75_n4.log" &
python3 "$HERE/sample_shoe_states.py" --basic "$HERE/basic_H17_noLS.csv" --h17 1 --ls 0 --penetration 0.75 --players 0 --shoes "$SHOES" --seed 105 --cap "$CAP" --out "$WORK/states_h17nols_p75_n0.json" 2> "$WORK/states_h17nols_p75_n0.log" &
wait
echo sampling done

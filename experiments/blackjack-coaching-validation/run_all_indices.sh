#!/usr/bin/env bash
# Orchestrates index generation after sampling: main configuration (75%
# penetration, learner alone) with both continuation policies and both rule
# sets, then stability configurations with the composition-dependent
# continuation and one rule set each.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK=${WORK:-/tmp/bjwork}
MAIN_CAP=${MAIN_CAP:-1200}
STAB_CAP=${STAB_CAP:-400}
python3 "$HERE/subsample_states.py" "$WORK/states_p75_n0.json" "$WORK/states_p75_n0_main.json" "$MAIN_CAP" 11
python3 "$HERE/subsample_states.py" "$WORK/states_p50_n0.json" "$WORK/states_p50_n0_stab.json" "$STAB_CAP" 12
python3 "$HERE/subsample_states.py" "$WORK/states_p80_n0.json" "$WORK/states_p80_n0_stab.json" "$STAB_CAP" 13
python3 "$HERE/subsample_states.py" "$WORK/states_p75_n4.json" "$WORK/states_p75_n4_stab.json" "$STAB_CAP" 14
python3 "$HERE/subsample_states.py" "$WORK/states_h17nols_p75_n0.json" "$WORK/states_h17nols_p75_n0_stab.json" "$STAB_CAP" 15
date
bash "$HERE/run_indices.sh" "$WORK/states_p75_n0_main.json" p75_n0 "cdz tdb" "S17 H17"
date
bash "$HERE/run_indices.sh" "$WORK/states_p50_n0_stab.json" p50_n0 cdz S17
bash "$HERE/run_indices.sh" "$WORK/states_p80_n0_stab.json" p80_n0 cdz S17
bash "$HERE/run_indices.sh" "$WORK/states_p75_n4_stab.json" p75_n4 cdz S17
bash "$HERE/run_indices.sh" "$WORK/states_h17nols_p75_n0_stab.json" h17nols_p75_n0 cdz H17
date
echo "ALL INDICES DONE"

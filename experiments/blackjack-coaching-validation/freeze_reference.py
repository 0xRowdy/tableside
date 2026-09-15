#!/usr/bin/env python3
"""Write or verify reference-manifest.json: the frozen blackjack coaching
reference (basic tables with fallback columns for the four presets,
continuation tables, the two final index files, the comparator CSVs and the
generated evidence they rest on) with SHA-256 per file, the calculator
commit, script versions (SHA-256 of every script), sampling seeds, sample
sizes and the generation date.

Usage:
    python3 freeze_reference.py write  [directory]
    python3 freeze_reference.py verify [directory]   # exit 1 on any mismatch
"""
import hashlib
import json
import os
import sys

FROZEN = {
    "basic_tables": ["basic_S17_LS.csv", "basic_S17_noLS.csv", "basic_H17_LS.csv", "basic_H17_noLS.csv",
                     "tables_S17_LS.md", "tables_S17_noLS.md", "tables_H17_LS.md", "tables_H17_noLS.md"],
    "continuation_tables": ["continuation_S17.csv", "continuation_H17.csv"],
    "final_indices": ["indices_S17_final.csv", "indices_H17_final.csv"],
    "comparators": ["wizard_appendix9_6deck.csv", "published_indices.csv"],
    "index_evidence": [
        "indices_p75_n0_S17_tdb_thresholds.csv", "indices_p75_n0_S17_tdb_bins.csv",
        "indices_p75_n0_H17_tdb_thresholds.csv", "indices_p75_n0_H17_tdb_bins.csv",
        "indices_p75_n0_insurance_bins.csv",
        "occurrences_S17_tdb_thresholds.csv", "occurrences_S17_tdb_bins.csv",
        "occurrences_H17_tdb_thresholds.csv", "occurrences_H17_tdb_bins.csv",
    ],
}
SCRIPTS = [
    "farmer_driver.cpp", "parse_wizard_appendix9.py", "compare_appendix9.py", "generate_basic_tables.py",
    "compare_basic_sources.py", "check_pair_flips.py", "mc_check.py", "sample_shoe_states.py",
    "evaluate_indices.py", "run_driver_parallel.py", "subsample_states.py", "insurance_sim.py",
    "sample_decisions.py", "aggregate_occurrences.py", "make_final_indices.py", "freeze_reference.py",
    "format_occurrence_tables.py", "check_direct_estimator.py", "compare_indices.py",
    "run_fresh.sh", "run_split_checks.sh", "run_sampling.sh", "run_indices.sh", "run_all_indices.sh",
    "run_decisions.sh", "run_occurrences.sh", "run_supplement.sh", "run_multicard_checks.sh",
]
META = {
    "generated": "2026-09-14 (sampling, two-card and first occurrence pass) to 2026-09-15 00:09 MDT (supplementary pass, final files, freeze)",
    "issue": "https://github.com/0xRowdy/true-count/issues/15",
    "report": "docs/research/blackjack-coaching-validation.md",
    "calculator": {
        "name": "Eric Farmer, blackjack (GPL-3.0-or-later), not vendored",
        "repository": "https://github.com/possibly-wrong/blackjack",
        "commit": "a1f7dbb74266fb39296292bdff568b076120a61c",
        "files_used": ["src/blackjack.cpp", "src/blackjack.h"],
        "build": "g++ (GCC) 16.2.1, -O2 -std=c++17, farmer_driver.cpp compiled against the pinned source",
    },
    "toolchain": {"python": "3.14.7 (standard library only)", "platform": "Linux x86_64, 8 cores"},
    "methodology": {
        "objective": "highest expected net return per original bet; legal and funding restrictions through the validated fallback",
        "state_weighting": "default configuration (six decks, 75% penetration finishing the cut-card round, learner alone, every spot on the preset's total-dependent basic table, no insurance), frequency-weighted; one curriculum per rule set (S17, H17)",
        "continuation": "taught total-dependent table (tdb) for later decisions and split hands",
        "tie_handling": "ties within tolerance resolve toward the basic action that adds no wager; no running-count sign exceptions",
        "tolerance": "0.001 of the original bet; a bin is decisive only beyond max(0.001, 2 SE)",
        "true_count": "RC of exposed cards / physical cards remaining to the nearest half deck (ties upward, minimum 0.5), truncated toward zero",
        "occurrence_weighting": "all-occurrence threshold = (1 - f) * two-card state estimate + f * multi-card/post-split occurrence estimate per bin, f = measured population share",
        "funding_rule": "fund hands in play order; the earliest live hand that prescribes a double receives the last affordable wager; later hands use their fallback",
    },
    "sampling": {
        "round_start_states": {"script": "sample_shoe_states.py", "shoes_per_configuration": 400000,
                                "seeds": {"p75_n0": 101, "p50_n0": 102, "p80_n0": 103, "p75_n4": 104, "h17nols_p75_n0": 105},
                                "reservoir_cap": 2500, "subsample_caps": {"main": 1200, "stability": 400},
                                "subsample_seeds": {"p75_n0": 11, "p50_n0": 12, "p80_n0": 13, "p75_n4": 14, "h17nols_p75_n0": 15},
                                "main_states_evaluated": 34967, "main_rounds": 17287008},
        "decision_occurrences": {"script": "sample_decisions.py", "replicas": 8, "shoes_per_replica": 400000,
                                  "rounds": 138301682, "learner_decisions": 179621030, "occurrences_in_population": 36133337,
                                  "seeds": [201, 202, 203, 204, 205, 206, 207, 208], "reservoir_cap_per_stratum": 150,
                                  "subsample": {"script": "aggregate_occurrences.py prepare", "focus": "t-1..t+1 around every two-card tolerance threshold",
                                                "caps": "focus non-original 200 / focus original two-card 50 / other 6 / tail 2", "seed": 21,
                                                "occurrences_valued": 60147},
                                  "supplement": {"script": "aggregate_occurrences.py supplement", "focus": "t-2..t+2 around every curriculum two-card threshold",
                                                 "cap": 200, "seed": 22, "strata_redrawn": 120, "occurrences_added": 16407,
                                                 "thin_occurrences_dropped": 528, "occurrences_valued_total": 76026},
                                  "support_rule": "a bin with non-original share >= 5% is usable only with >= 50 sampled non-original occurrences"},
        "monte_carlo": {"script": "mc_check.py", "trials_per_cell": 8000000, "seed": 1, "worker_seeds": "1000-1007"},
        "insurance_simulation": {"script": "insurance_sim.py", "shoes": 300000, "seed": 5},
    },
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build(directory):
    m = dict(META)
    m["frozen_files"] = {group: {name: sha256(os.path.join(directory, name)) for name in names}
                         for group, names in FROZEN.items()}
    m["scripts"] = {name: sha256(os.path.join(directory, name)) for name in SCRIPTS}
    return m


def main():
    cmd = sys.argv[1]
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    path = os.path.join(directory, "reference-manifest.json")
    if cmd == "write":
        m = build(directory)
        if len(sys.argv) > 3:
            extra = json.load(open(sys.argv[3]))
            m["sampling"]["decision_occurrences"].update(extra)
        with open(path, "w") as f:
            json.dump(m, f, indent=2)
            f.write("\n")
        print(f"wrote {path}: {sum(len(v) for v in m['frozen_files'].values())} frozen files, {len(m['scripts'])} scripts")
    elif cmd == "verify":
        m = json.load(open(path))
        bad = []
        for group, files in m["frozen_files"].items():
            for name, digest in files.items():
                if sha256(os.path.join(directory, name)) != digest:
                    bad.append(name)
        for name, digest in m["scripts"].items():
            if sha256(os.path.join(directory, name)) != digest:
                bad.append(name)
        if bad:
            print("MISMATCH: " + ", ".join(bad))
            sys.exit(1)
        print(f"verified {sum(len(v) for v in m['frozen_files'].values())} frozen files and {len(m['scripts'])} scripts")
    else:
        sys.exit("usage: freeze_reference.py write|verify [directory]")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Cross-check of the all-occurrence estimator: where the direct estimator
(sampled occurrences only, including the 50-per-bin original two-card
sample) gives a different tolerance threshold from the mixed estimator
(two-card state estimate combined with the non-original occurrence
estimate), print the bins between the two thresholds with both means and the
difference in standard errors.

Usage: python3 check_direct_estimator.py [directory] [prefix]
"""
import csv
import os
import sys


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    prefix = sys.argv[2] if len(sys.argv) > 2 else "occurrences"
    for rules in ("S17", "H17"):
        thr = list(csv.DictReader(open(os.path.join(directory, f"{prefix}_{rules}_tdb_thresholds.csv"))))
        bins = {(r["situation"], int(r["tc"])): r
                for r in csv.DictReader(open(os.path.join(directory, f"{prefix}_{rules}_tdb_bins.csv")))}
        print("=====", rules)
        worst = 0.0
        for r in thr:
            if r["curriculum"] not in ("I18", "F4"):
                continue
            try:
                a, d = int(r["all_tolerance"]), int(r["direct_all_tolerance"])
            except ValueError:
                print(f"  {r['situation']:20s} all {r['all_tolerance']} direct {r['direct_all_tolerance']}")
                continue
            if a == d:
                continue
            out = []
            for tc in range(min(a, d), max(a, d)):
                b = bins[(r["situation"], tc)]
                am, ase = float(b["all_mean"]), float(b["all_se"])
                dm, dse = float(b["direct_all_mean"]), float(b["direct_all_se"])
                z = (dm - am) / (dse ** 2 + ase ** 2) ** 0.5
                worst = max(worst, abs(z))
                out.append(f"{tc:+d}: direct {dm:+.4f}±{dse:.4f} vs all {am:+.4f}±{ase:.4f} ({z:+.1f} SE, n={b['direct_all_n']})")
            print(f"  {r['situation']:20s} all {a:+d} direct {d:+d}: " + "; ".join(out))
        print(f"  largest difference between the two estimators in a deciding bin: {worst:.2f} SE")


if __name__ == "__main__":
    main()

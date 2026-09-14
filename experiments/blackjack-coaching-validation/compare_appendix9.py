#!/usr/bin/env python3
"""Compare fresh-shoe action values from farmer_driver against Wizard of Odds
Appendix 9 (six decks, resplit to four hands, no resplit/draw to split aces).

Usage:
    python3 compare_appendix9.py wizard_appendix9_6deck.csv <label>=<driver.csv> ...

Each driver CSV is the output of farmer_driver for the fresh six-deck shoe
(id "fresh").  Labels are free text such as S17-cdz, S17-cdz-nodas.  Stand,
hit and double are compared for every two-card hand; split is compared with
the DAS=Yes column, or the DAS=No column when the label contains "nodas".

Prints, per label, the number of comparisons, how many agree within
six-decimal rounding (|diff| <= 0.0000005), the maximum absolute difference,
and every row whose difference exceeds the rounding tolerance.
"""
import csv
import sys
from collections import defaultdict

ROUND_TOL = 0.0000005


def load_wizard(path):
    w = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            key = (r["rules"], int(r["up"]), int(r["c1"]), int(r["c2"]))
            vals = {}
            for col in ("stand", "hit", "double", "split_nodas", "split_das"):
                v = r[col].replace("--", "-")  # Wizard H17 T,T vs A prints "--0.453428"
                vals[col] = float(v) if v else None
            w[key] = vals
    return w


def load_driver(path):
    d = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            key = (int(r["up"]), int(r["c1"]), int(r["c2"]))
            d[key] = {
                "stand": float(r["stand"]),
                "hit": float(r["hit"]),
                "double": float(r["double"]),
                "split": float(r["split"]) if r["split"] else None,
            }
    return d


def main():
    wizard = load_wizard(sys.argv[1])
    for arg in sys.argv[2:]:
        label, path = arg.split("=", 1)
        rules = "H17" if "H17" in label.upper() else "S17"
        split_col = "split_nodas" if "nodas" in label.lower() else "split_das"
        driver = load_driver(path)
        stats = defaultdict(lambda: [0, 0, 0.0])  # n, within_tol, max
        outliers = []
        for (up, c1, c2), dv in sorted(driver.items()):
            wv = wizard.get((rules, up, c1, c2))
            if wv is None:
                continue
            for col in ("stand", "hit", "double"):
                diff = dv[col] - wv[col]
                s = stats[col]
                s[0] += 1
                s[1] += abs(diff) <= ROUND_TOL
                s[2] = max(s[2], abs(diff))
                if abs(diff) > ROUND_TOL:
                    outliers.append((col, up, c1, c2, wv[col], dv[col], diff))
            if dv["split"] is not None and wv[split_col] is not None:
                diff = dv["split"] - wv[split_col]
                s = stats["split"]
                s[0] += 1
                s[1] += abs(diff) <= ROUND_TOL
                s[2] = max(s[2], abs(diff))
                if abs(diff) > ROUND_TOL:
                    outliers.append(("split", up, c1, c2, wv[split_col], dv["split"], diff))
        print(f"== {label} ({path}) vs Wizard {rules}, split column {split_col}")
        for col in ("stand", "hit", "double", "split"):
            n, ok, mx = stats[col]
            print(f"   {col:6s}: {n:4d} compared, {ok:4d} within rounding, max |diff| {mx:.9f}")
        for col, up, c1, c2, wv, dv, diff in outliers:
            if col != "split" or True:
                print(f"   {col:6s} {c1},{c2} vs {up:2d}: wizard {wv:+.6f} driver {dv:+.9f} diff {diff:+.9f}")
        print()


if __name__ == "__main__":
    main()

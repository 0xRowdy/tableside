#!/usr/bin/env python3
"""Consolidate generated index thresholds with the published values.

Reads indices_<tag>_<rules>_<mode>_thresholds.csv files and
published_indices.csv, and prints a Markdown table:

  situation | Schlesinger | BJA S17 | BJA H17 | S17 cdz | S17 tdb | H17 cdz | H17 tdb | stability

Usage: python3 compare_indices.py [directory]
"""
import csv
import glob
import os
import re
import sys


def key_of(name):
    """Map a generated situation name to the published situation key."""
    n = name.replace(" stand", "").replace(" double", "").replace(" split", "")
    return n


def load_published(path):
    pub = {}
    for r in csv.DictReader(open(path)):
        src = "Schlesinger" if r["source"].startswith("Wizard") else f"BJA {r['rules']}"
        pub[(src, r["situation"])] = r["published"]
    return pub


def load_thresholds(directory):
    gen = {}
    for path in sorted(glob.glob(os.path.join(directory, "indices_*_thresholds.csv"))):
        m = re.match(r"indices_(.+)_(S17|H17)_(cdz|tdb)_thresholds\.csv", os.path.basename(path))
        if not m:
            continue
        tag, rules, mode = m.groups()
        for r in csv.DictReader(open(path)):
            gen[(tag, rules, mode, r["situation"])] = r
    return gen


def fmt(v):
    if v is None:
        return "—"
    return str(v)


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    pub = load_published(os.path.join(directory, "published_indices.csv"))
    gen = load_thresholds(directory)
    situations = []
    for (tag, rules, mode, name) in gen:
        if tag == "p75_n0" and rules == "S17" and mode == "cdz" and name not in situations:
            situations.append(name)
    order = {"I18": 0, "F4": 1, "supp": 2}
    situations.sort(key=lambda n: order.get(gen[("p75_n0", "S17", "cdz", n)]["curriculum"], 9))
    print("| Situation | Set | Schlesinger | BJA S17 | BJA H17 | S17 cdz | S17 tdb | H17 cdz | H17 tdb | S17 cdz at p50 / p80 / 4 others | H17 cdz, H17/noLS sampling |")
    print("|---|---|---|---|---|---|---|---|---|---|---|")
    for name in situations:
        k = key_of(name)
        r0 = gen[("p75_n0", "S17", "cdz", name)]
        cells = []
        for rules, mode in (("S17", "cdz"), ("S17", "tdb"), ("H17", "cdz"), ("H17", "tdb")):
            r = gen.get(("p75_n0", rules, mode, name))
            cells.append(fmt(r["threshold_tolerance"]) + (f" (raw {r['threshold_raw']})" if r and r["threshold_raw"] != r["threshold_tolerance"] else "") if r else "—")
        stab = " / ".join(fmt(gen.get((t, "S17", "cdz", name), {}).get("threshold_tolerance")) for t in ("p50_n0", "p80_n0", "p75_n4"))
        stab_h = fmt(gen.get(("h17nols_p75_n0", "H17", "cdz", name), {}).get("threshold_tolerance"))
        print(f"| {name} | {r0['curriculum']} | {fmt(pub.get(('Schlesinger', k)))} | {fmt(pub.get(('BJA S17', k)))} | "
              f"{fmt(pub.get(('BJA H17', k)))} | {' | '.join(cells)} | {stab} | {stab_h} |")
    print()
    print("Bins near the tolerance threshold (S17 cdz, default configuration): mean advantage of the deviation ± SE")
    print()
    for name in situations:
        r = gen[("p75_n0", "S17", "cdz", name)]
        print(f"- {name}: {r['bins_near_threshold']}  | zero-bin RC sign: {r['rc_sign_breakdown']}")


if __name__ == "__main__":
    main()

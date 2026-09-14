#!/usr/bin/env python3
"""List the cells whose teaching symbol differs between presets.

Usage: python3 diff_presets.py basic_S17_LS.csv basic_H17_LS.csv basic_S17_noLS.csv basic_H17_noLS.csv
"""
import csv
import sys

NAME = {1: "A", 10: "T"}


def load(path):
    rows = {}
    for r in csv.DictReader(open(path)):
        a = r["action"]
        if a == "D":
            a = "Ds" if r["fallback_double"] == "S" else "D"
        elif a == "R":
            a = "R" + r["fallback_surrender"].lower()
        rows[(r["kind"], int(r["hand"]), int(r["up"]))] = a
    return rows


def label(kind, hand, up):
    u = NAME.get(up, str(up))
    if kind == "pair":
        c = NAME.get(hand, str(hand))
        return f"{c},{c} vs {u}"
    if kind == "soft":
        return f"A,{NAME.get(hand - 11, str(hand - 11))} vs {u}"
    return f"hard {hand} vs {u}"


def main():
    tables = {p: load(p) for p in sys.argv[1:]}
    names = list(tables)
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = tables[names[i]], tables[names[j]]
            diffs = [(k, a[k], b[k]) for k in sorted(a) if a[k] != b[k]]
            print(f"== {names[i]} vs {names[j]}: {len(diffs)} cells differ")
            for k, x, y in diffs:
                print(f"   {label(*k)}: {x} -> {y}")


if __name__ == "__main__":
    main()

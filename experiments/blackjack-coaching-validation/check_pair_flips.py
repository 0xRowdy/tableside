#!/usr/bin/env python3
"""Does any pair decision differ between Wizard Appendix 9's split values and
the calculator's?  Compares the best action (stand/hit/double/split, plus
surrender at -0.5 in LS presets) for every pair cell under both value sets.

Usage: python3 check_pair_flips.py wizard_appendix9_6deck.csv fresh_S17.csv fresh_H17.csv
"""
import csv
import sys


def main():
    wiz = {}
    for r in csv.DictReader(open(sys.argv[1])):
        if r["c1"] == r["c2"]:
            wiz[(r["rules"], int(r["c1"]), int(r["up"]))] = {
                "S": float(r["stand"]), "H": float(r["hit"]), "D": float(r["double"]),
                "P": float(r["split_das"].replace("--", "-")),
            }
    flips = 0
    closest = []
    for rules, path in (("S17", sys.argv[2]), ("H17", sys.argv[3])):
        for r in csv.DictReader(open(path)):
            if r["c1"] != r["c2"]:
                continue
            c, u = int(r["c1"]), int(r["up"])
            mine = {"S": float(r["stand"]), "H": float(r["hit"]), "D": float(r["double"]), "P": float(r["split"])}
            for ls in (0, 1):
                m, w = dict(mine), dict(wiz[(rules, c, u)])
                if ls:
                    m["R"] = w["R"] = -0.5
                bm, bw = max(m, key=m.get), max(w, key=w.get)
                vals = sorted(m.values())
                margin = vals[-1] - vals[-2]
                if bm != bw:
                    flips += 1
                    print(f"FLIP {rules} {'LS' if ls else 'noLS'} {c},{c} vs {u}: calculator {bm} wizard {bw}")
                closest.append((margin, rules, "LS" if ls else "noLS", c, u, bm))
    print(f"pair decision flips between sources: {flips} (of 400 cell/preset combinations)")
    closest.sort()
    print("closest pair decisions by calculator margin:")
    for m, rules, ls, c, u, a in closest[:8]:
        print(f"   {rules} {ls} {c},{c} vs {u}: {a} by {m:.6f}")


if __name__ == "__main__":
    main()

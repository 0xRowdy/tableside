#!/usr/bin/env python3
"""Diagnostics for the index pipeline.

For one situation, prints the weighted mean action-value difference at
running count exactly zero, sliced by depth (cards dealt at round start), and
the weighted mean exact quotient RC/divisor inside each integer bin.  The
shallowest RC = 0 slice must approach the fresh-shoe two-card value.

Usage: python3 diagnose_bins.py states.json driver.csv "16 vs 10 stand"
"""
import csv
import json
import sys
from collections import defaultdict

from evaluate_indices import SITUATIONS, TAG, divisor, state_pool, value


def main():
    states = json.load(open(sys.argv[1]))
    driver = sys.argv[2]
    want = sys.argv[3]
    sit = [s for s in SITUATIONS if s[0] == want][0]
    name, comps, up, dev, alt, cur = sit
    keys = {(min(a, b), max(a, b), up) for a, b in comps}
    values = defaultdict(dict)
    with open(driver) as f:
        for r in csv.DictReader(f):
            k = (int(r["c1"]), int(r["c2"]), int(r["up"]))
            if k in keys:
                values[int(r["id"])][k] = {"S": float(r["stand"]), "H": float(r["hit"]),
                                          "D": float(r["double"]), "P": float(r["split"]) if r["split"] else None}
    strata = {int(k): v for k, v in states["strata"].items()}
    wst = {tc: v["population"] / v["sampled"] for tc, v in strata.items()}
    depth_slices = [(0, 40), (40, 80), (80, 120), (120, 160), (160, 200), (200, 240)]
    rc0_by_depth = defaultdict(lambda: [0.0, 0.0, 0])
    exact_by_bin = defaultdict(lambda: [0.0, 0.0, 0.0])
    for i, st in enumerate(states["states"]):
        cards, rc_others = state_pool(st)
        n = sum(cards)
        rc0 = -sum(TAG[c] * st["cards"][c - 1] for c in range(1, 11)) + rc_others
        for c1, c2 in comps:
            k = (min(c1, c2), max(c1, c2), up)
            row = values[i].get(k)
            if row is None:
                continue
            n1 = cards[c1 - 1]
            n2 = cards[c2 - 1] - (1 if c2 == c1 else 0)
            nu = cards[up - 1] - (1 if up == c1 else 0) - (1 if up == c2 else 0)
            if n1 <= 0 or n2 <= 0 or nu <= 0:
                continue
            p = n1 / n * n2 / (n - 1) * nu / (n - 2) * (2 if c1 != c2 else 1)
            if up == 1:
                p *= 1 - (cards[9] - (c1 == 10) - (c2 == 10)) / (n - 3)
            elif up == 10:
                p *= 1 - (cards[0] - (c1 == 1) - (c2 == 1)) / (n - 3)
            w = wst[st["tc"]] * p
            rc = rc0 + TAG[c1] + TAG[c2] + TAG[up]
            q = rc / divisor(n - 4)
            tc = int(q)
            d = value(row, dev) - value(row, alt)
            eb = exact_by_bin[tc]
            eb[0] += w
            eb[1] += w * q
            eb[2] += w * d
            if rc == 0:
                for lo, hi in depth_slices:
                    if lo <= st["dealt"] < hi:
                        s = rc0_by_depth[(lo, hi)]
                        s[0] += w
                        s[1] += w * d
                        s[2] += 1
    print(f"{name}: weighted mean of ({dev} - {alt}) at RC = 0, by cards dealt at round start")
    for (lo, hi), (w, wd, cnt) in sorted(rc0_by_depth.items()):
        print(f"   dealt {lo:3d}-{hi:3d}: mean {wd / w:+.5f}  states {cnt}")
    print("integer bin -> weighted mean exact quotient, mean difference")
    for tc in sorted(exact_by_bin):
        w, wq, wd = exact_by_bin[tc]
        if w > 0:
            print(f"   bin {tc:+d}: exact {wq / w:+.3f}  diff {wd / w:+.5f}")


if __name__ == "__main__":
    main()

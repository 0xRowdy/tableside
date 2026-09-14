#!/usr/bin/env python3
"""Reduce a sampled-states file to at most CAP states per true-count stratum,
keeping the stratum population counts so reweighting stays unbiased.

Usage: python3 subsample_states.py in.json out.json CAP [seed]
"""
import json
import random
import sys


def main():
    src, dest, cap = sys.argv[1], sys.argv[2], int(sys.argv[3])
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    rng = random.Random(seed)
    d = json.load(open(src))
    by_tc = {}
    for st in d["states"]:
        by_tc.setdefault(st["tc"], []).append(st)
    states = []
    for tc, lst in sorted(by_tc.items()):
        if len(lst) > cap:
            lst = rng.sample(lst, cap)
        d["strata"][str(tc)]["sampled"] = len(lst)
        states.extend(lst)
    d["states"] = states
    d["config"]["subsampled_cap"] = cap
    json.dump(d, open(dest, "w"))
    print(f"{src}: {len(states)} states after cap {cap}")


if __name__ == "__main__":
    main()

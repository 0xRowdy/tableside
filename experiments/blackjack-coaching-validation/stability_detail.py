#!/usr/bin/env python3
"""Print raw and tolerance thresholds with the bins near the threshold for
selected situations across the stability configurations.

Usage: python3 stability_detail.py "15 vs 10 stand" "12 vs 3 stand" ...
"""
import csv
import glob
import sys


def main():
    names = sys.argv[1:]
    for path in sorted(glob.glob("indices_*_cdz_thresholds.csv")):
        rows = {r["situation"]: r for r in csv.DictReader(open(path))}
        for n in names:
            r = rows.get(n)
            if r:
                print(f"{path[8:-15]:26s} {n:18s} raw {r['threshold_raw']:>4s} tol {r['threshold_tolerance']:>4s}  {r['bins_near_threshold']}")
        print()


if __name__ == "__main__":
    main()

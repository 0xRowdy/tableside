#!/usr/bin/env python3
"""Render the report's all-occurrence and post-split Markdown tables from
occurrences_<rules>_tdb_thresholds.csv and _bins.csv (curriculum situations).

Usage: python3 format_occurrence_tables.py [directory] [prefix]
"""
import csv
import os
import sys


def load(directory, prefix, rules):
    thr = list(csv.DictReader(open(os.path.join(directory, f"{prefix}_{rules}_tdb_thresholds.csv"))))
    bins = {}
    for r in csv.DictReader(open(os.path.join(directory, f"{prefix}_{rules}_tdb_bins.csv"))):
        bins[(r["situation"], int(r["tc"]))] = r
    return thr, bins


def cell(r, k):
    return r[k] if r[k] else "—"


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    prefix = sys.argv[2] if len(sys.argv) > 2 else "occurrences"
    data = {rules: load(directory, prefix, rules) for rules in ("S17", "H17")}
    s17, b17 = data["S17"]
    h17, bh = data["H17"]
    hrows = {r["situation"]: r for r in h17}
    print("| Situation | Set | Two-card S17 / H17 | All occurrences S17 / H17 | Non-original share at the S17 threshold bin | S17 bins t−1, t, t+1: two-card → all-occurrence (mean ± SE) |")
    print("|---|---|---|---|---|---|")
    for r in s17:
        if r["curriculum"] not in ("I18", "F4"):
            continue
        h = hrows[r["situation"]]
        moved = []
        try:
            t = int(r["all_tolerance"])
            for tc in (t - 1, t, t + 1):
                b = b17.get((r["situation"], tc))
                if b and b["all_mean"]:
                    moved.append(f"{tc:+d}: {float(b['state_mean']):+.4f}±{float(b['state_se']):.4f} → "
                                 f"{float(b['all_mean']):+.4f}±{float(b['all_se']):.4f}")
        except ValueError:
            pass
        print(f"| {r['situation']} | {r['curriculum']} | {r['two_card_tolerance']} / {h['two_card_tolerance']} | "
              f"{r['all_tolerance']} / {h['all_tolerance']}{' **changed**' if r['changed'] == 'yes' or h['changed'] == 'yes' else ''} | "
              f"{cell(r, 'nonorig_share_at_threshold')} | {'; '.join(moved) if moved else '—'} |")
    print()
    print("| Situation | All occurrences S17 / H17 | Post-split only S17 / H17 | Post-split share | Post-split minus all-occurrence in the bins between (mean ± SE) | Differs beyond tolerance |")
    print("|---|---|---|---|---|---|")
    for r in s17:
        if r["curriculum"] not in ("I18", "F4") or r["postsplit_tolerance"] == "":
            continue
        h = hrows[r["situation"]]
        gap = " ; ".join(x for x in (f"S17 {r['postsplit_minus_all_between_thresholds']}" if r["postsplit_minus_all_between_thresholds"] else "",
                                     f"H17 {h['postsplit_minus_all_between_thresholds']}" if h["postsplit_minus_all_between_thresholds"] else "") if x)
        print(f"| {r['situation']} | {r['all_tolerance']} / {h['all_tolerance']} | {r['postsplit_tolerance']} / {h['postsplit_tolerance']} | "
              f"{float(r['post_split_share']) * 100:.1f}% | {gap or '—'} | {'yes' if 'yes' in (r['postsplit_distinct'], h['postsplit_distinct']) else 'no'} |")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Write the frozen curriculum index files indices_S17_final.csv and
indices_H17_final.csv that lesson authors and the engine consume.

Sources: occurrences_<rules>_tdb_thresholds.csv and _bins.csv (all-occurrence
thresholds under the accepted methodology), indices_p75_n0_insurance_bins.csv
(insurance index) and published_indices.csv (Schlesinger's Illustrious 18 /
Fab 4 as republished by Wizard of Odds, and the BJA 2018 S17/H17 charts).

Columns
  rules, set, situation, hand_kind, hand, up, deviation_action,
  alternative_action, basic_action, taught_threshold, direction, rule,
  two_card_threshold, two_card_raw, all_occurrence_raw,
  post_split_threshold, post_split_fallback_column, post_split_note,
  multi_card_share, post_split_share, schlesinger, bja_S17, bja_H17,
  bja_rule_specific_tc, diff_vs_schlesinger, diff_vs_bja,
  cost_per_bet_at_schlesinger, cost_per_bet_at_bja, all_occurrence_bins,
  status

"direction" is "deviate_at_or_above" (the deviation is played at
TC >= taught_threshold, the basic action below) or "basic_at_or_above" (the
at-or-above action is itself basic and the departure happens below the
threshold).  "rule" spells the same thing out.  Costs are the expected loss
per original bet, with standard error, of following the published value in
each true-count bin where it differs from the taught value (all-occurrence
means): positive means the published action loses that much in the bin;
negative means the published action is better by that much but inside the
tie zone (max(0.001, 2 SE)), so the taught value differs only through the
accepted tie rule.  BJA running-count-sign entries ("0+", "0-") have no
integer true-count equivalent and are not compared numerically.

Usage: python3 make_final_indices.py [directory] [--markdown]
"""
import csv
import os
import re
import sys

from evaluate_indices import SITUATIONS, basic_of

ACTION = {"S": "stand", "H": "hit", "D": "double", "P": "split", "R": "surrender"}
DATE = "2026-09-14"


def published(directory):
    pub = {}
    for r in csv.DictReader(open(os.path.join(directory, "published_indices.csv"))):
        src = "Schlesinger" if r["source"].startswith("Wizard") else f"BJA {r['rules']}"
        pub[(src, r["situation"])] = r["published"]
    return pub


def key_of(name):
    return name.replace(" stand", "").replace(" double", "").replace(" split", "")


def bja_numeric(s, basic_side):
    """Integer true-count equivalent of a BJA chart entry in the at-or-above
    convention, or None when the entry is a running-count-sign rule or has no
    index."""
    if s is None:
        return None
    m = re.match(r"^([+-]?\d+)\+$", s)
    if m:
        v = int(m.group(1))
        return None if v == 0 and basic_side == "alt" and s == "0+" else v
    m = re.match(r"^([+-]?\d+)-$", s)
    if m:
        v = int(m.group(1))
        return None if v == 0 else v + 1  # "X-": depart at TC <= X, keep the at-or-above action from X+1
    return None


def to_int(s):
    try:
        return int(s)
    except (TypeError, ValueError):
        return None


def cost_text(bins, taught, pub):
    if pub is None or taught is None or pub == taught:
        return ""
    parts = []
    for b in range(min(pub, taught), max(pub, taught)):
        row = bins.get(b)
        if row is None:
            parts.append(f"{b:+d}:n/a")
            continue
        m, se = row
        c = m if b >= taught else -m
        parts.append(f"{b:+d}:{c:+.4f}±{se:.4f}")
    return "; ".join(parts)


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "."
    pub = published(directory)
    for rules in ("S17", "H17"):
        thr = {r["situation"]: r for r in csv.DictReader(open(os.path.join(directory, f"occurrences_{rules}_tdb_thresholds.csv")))}
        bins = {}
        for r in csv.DictReader(open(os.path.join(directory, f"occurrences_{rules}_tdb_bins.csv"))):
            if r["all_mean"]:
                bins.setdefault(r["situation"], {})[int(r["tc"])] = (float(r["all_mean"]), float(r["all_se"]))
        ins_bins = {}
        for r in csv.DictReader(open(os.path.join(directory, "indices_p75_n0_insurance_bins.csv"))):
            ins_bins[int(r["tc"])] = (float(r["mean_diff"]), float(r["se"]))
        rows = []
        for name, comps, up, dev, alt, cur in SITUATIONS:
            if cur not in ("I18", "F4"):
                continue
            t = thr[name]
            side = basic_of(name, rules)
            taught = to_int(t["all_tolerance"])
            k = key_of(name)
            sch, bs, bh = pub.get(("Schlesinger", k)), pub.get(("BJA S17", k)), pub.get(("BJA H17", k))
            bja_rule = bs if rules == "S17" else bh
            bja_tc = bja_numeric(bja_rule, side)
            sch_int = to_int(sch.replace("+", "")) if sch else None
            if comps == [(10, 10)]:
                kind, hand = "pair", "T,T"
            elif comps == [(8, 8)]:
                kind, hand = "pair", "8,8"
            else:
                kind, hand = "hard", str(sum(comps[0]))
            up_s = "A" if up == 1 else str(up)
            alt_txt = "basic action (stand/hit/double per table)" if alt.startswith("best:") else ACTION[alt]
            basic_action = (dev if side == "dev" else (alt if not alt.startswith("best:") else "basic"))
            if side == "alt":
                direction = "deviate_at_or_above"
                rule = f"{ACTION[dev]} at TC >= {taught}, otherwise {alt_txt}" if taught is not None else f"never {ACTION[dev]} within TC -8..+8 ({t['all_tolerance']})"
            else:
                direction = "basic_at_or_above"
                rule = f"{ACTION[dev]} (basic) at TC >= {taught}, {alt_txt} below" if taught is not None else f"{ACTION[dev]} (basic) at every TC ({t['all_tolerance']})"
            if dev == "D":
                fb_col, fb_note = "fallback_double", "post-split two-card hands may double (DAS); an unaffordable double uses fallback_double"
            elif dev == "R":
                fb_col, fb_note = "", "Fab 4 never apply post-split (surrender only on original two-card hands)"
            elif dev == "P":
                fb_col, fb_note = "fallback_split_rule / fallback_split_balance", "original pairs only; T,T is never split by the basic table so no post-split tens occur"
            else:
                fb_col, fb_note = "", "stand/hit always available post-split"
            post = t["postsplit_tolerance"] if t["postsplit_distinct"] == "yes" else ""
            rows.append([
                rules, cur, k, kind, hand, up_s, ACTION[dev], alt_txt, basic_action,
                taught if taught is not None else t["all_tolerance"], direction, rule,
                t["two_card_tolerance"], t["two_card_raw"], t["all_raw"],
                post, fb_col if post else "", (fb_note if post else fb_note),
                t["multi_card_share"], t["post_split_share"],
                sch or "", bs or "", bh or "",
                bja_tc if bja_tc is not None else "",
                (taught - sch_int) if (taught is not None and sch_int is not None) else "",
                (taught - bja_tc) if (taught is not None and bja_tc is not None) else "",
                cost_text(bins.get(name, {}), taught, sch_int),
                cost_text(bins.get(name, {}), taught, bja_tc),
                t["all_bins_near_threshold"],
                f"frozen {DATE}; certified under the accepted methodology (issue #15), all occurrences weighted",
            ])
        # insurance: decided on the original two-card hand before any hit, so
        # there are no multi-card or post-split occurrences
        ins_t = min(tc for tc in sorted(ins_bins) if all(ins_bins[u][0] > max(0.001, 2 * ins_bins[u][1]) for u in ins_bins if u >= tc and -8 <= u <= 8) and -8 <= tc <= 8)
        ins_sch = to_int((pub.get(("Schlesinger", "Insurance")) or "").replace("+", ""))
        ins_bja = bja_numeric(pub.get((f"BJA {rules}", "Insurance")), "alt")
        rows.append([
            rules, "insurance", "Insurance", "insurance", "any", "A", "insure", "decline", "decline",
            ins_t, "deviate_at_or_above", f"take insurance at TC >= {ins_t}, otherwise decline",
            ins_t, ins_t, ins_t, "", "", "insurance precedes the peek and any hit; no post-split case",
            "0.0000", "0.0000",
            pub.get(("Schlesinger", "Insurance"), ""), pub.get(("BJA S17", "Insurance"), ""), pub.get(("BJA H17", "Insurance"), ""),
            ins_bja if ins_bja is not None else "",
            (ins_t - ins_sch) if ins_sch is not None else "", (ins_t - ins_bja) if ins_bja is not None else "",
            cost_text(ins_bins, ins_t, ins_sch), cost_text(ins_bins, ins_t, ins_bja),
            " ".join(f"{u:+d}:{ins_bins[u][0]:+.4f}±{ins_bins[u][1]:.4f}" for u in sorted(ins_bins) if abs(u - ins_t) <= 1),
            f"frozen {DATE}; certified under the accepted methodology (issue #15); exact 3p-1 evaluation plus independent play simulation",
        ])
        out = os.path.join(directory, f"indices_{rules}_final.csv")
        with open(out, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["rules", "set", "situation", "hand_kind", "hand", "up", "deviation_action",
                        "alternative_action", "basic_action", "taught_threshold", "direction", "rule",
                        "two_card_threshold", "two_card_raw", "all_occurrence_raw",
                        "post_split_threshold", "post_split_fallback_column", "post_split_note",
                        "multi_card_share", "post_split_share", "schlesinger", "bja_S17", "bja_H17",
                        "bja_rule_specific_tc", "diff_vs_schlesinger", "diff_vs_bja",
                        "cost_per_bet_at_schlesinger", "cost_per_bet_at_bja", "all_occurrence_bins", "status"])
            w.writerows(rows)
        print(f"wrote {out} ({len(rows)} rows)")
        if "--markdown" in sys.argv:
            print(f"\n| Situation | Set | Taught ({rules}) | Rule | Schlesinger | BJA {rules} | Difference vs Schlesinger | Cost per bet of the published value (bin: cost ± SE) | Multi-card / post-split share | All-occurrence bins t−1, t, t+1 |")
            print("|---|---|---|---|---|---|---|---|---|---|")
            for r in rows:
                bja = r[21] if rules == "S17" else r[22]
                cost = r[26] or (f"BJA: {r[27]}" if r[27] else "")
                if r[26] and r[27] and r[26] != r[27]:
                    cost = f"Schlesinger: {r[26]}; BJA: {r[27]}"
                print(f"| {r[2]} | {r[1]} | **{r[9]}** | {r[11]} | {r[20] or '—'} | {bja or '—'} | {r[24] if r[24] != '' else '—'} | "
                      f"{cost or '—'} | {float(r[18]) * 100:.0f}% / {float(r[19]) * 100:.0f}% | {r[28]} |")
        else:
            for r in rows:
                print(f"  {r[1]:9s} {r[2]:20s} taught {str(r[9]):>3s}  two-card {str(r[12]):>3s}  Schlesinger {r[20]:>3s}  BJA {str(r[21] if rules == 'S17' else r[22]):>4s}  diff {str(r[24]):>2s}  post-split {str(r[15]):>3s}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate total-dependent basic strategy, legal-fallback and continuation
tables for the four launch presets from fresh-shoe composition-dependent
action values produced by farmer_driver.

Usage:
    python3 generate_basic_tables.py --s17 fresh_S17.csv --h17 fresh_H17.csv --outdir .

Objective (accepted, issue #15 comment 2026-09-09): choose the action with the
highest expected net return per original bet.

Total-dependent aggregation (proposal, see report): a hard or soft total row
is the dealing-probability-weighted average of the values of its two-card
non-pair compositions from a fresh six-deck shoe; a pair row uses the pair's
own composition.  Hard 4 and hard 20 exist only as pairs and use 2,2 and T,T.

Fallback semantics (accepted policy, issue #5): when the prescribed action is
unavailable use the validated next-best legal action:
  fallback_double            double unavailable on a post-split or
                             balance-limited hand where surrender is not
                             legal: best of stand/hit
  fallback_double_ls_original double unavailable (balance) on an original
                             two-card hand in a late-surrender preset: best of
                             stand/hit/surrender
  fallback_split_rule        split unavailable because of the four-hand cap or
                             the no-resplit-aces rule: hand is a post-split
                             hand, no surrender, double allowed (DAS) unless
                             the pair is aces (one card each, forced stand)
  fallback_split_balance     split unavailable because the balance cannot fund
                             another wager: double is then also unaffordable;
                             best of stand/hit/surrender(if LS and original)
  fallback_surrender         surrender unavailable (post-split hand, or
                             after a hit): best of stand/hit/double
Outputs:
  basic_<preset>.csv       full rows with values and fallbacks
  continuation_<rules>.csv total-dependent continuation for the driver's tdb
                           mode (hard 4-21, soft 12-21; action S/H/D, fallback S/H)
  tables_<preset>.md       human-readable grids
"""
import argparse
import csv
import os
from collections import defaultdict

FULL = {c: (96 if c == 10 else 24) for c in range(1, 11)}
UPS = list(range(2, 11)) + [1]
UPNAME = {1: "A", 10: "T"}
NAME = {1: "A", 10: "T"}


def cname(c):
    return NAME.get(c, str(c))


def load(path):
    d = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            d[(int(r["c1"]), int(r["c2"]), int(r["up"]))] = {
                "S": float(r["stand"]), "H": float(r["hit"]), "D": float(r["double"]),
                "P": float(r["split"]) if r["split"] else None,
            }
    return d


def deal_weight(c1, c2, u):
    """Probability weight of the two-card hand and up card from a fresh shoe,
    multiplied by the probability that the dealer does not have blackjack
    (the decision is made after the peek, so compositions are conditioned on
    no dealer blackjack; Wizard Appendix 9's probability column shows the
    same conditioning)."""
    n1 = FULL[c1]
    n2 = FULL[c2] - (1 if c2 == c1 else 0)
    nu = FULL[u] - (1 if u == c1 else 0) - (1 if u == c2 else 0)
    w = n1 * n2 * nu * (2 if c1 != c2 else 1)
    remaining = 312 - 3
    if u == 1:
        tens = FULL[10] - (c1 == 10) - (c2 == 10)
        w *= 1 - tens / remaining
    elif u == 10:
        aces = FULL[1] - (c1 == 1) - (c2 == 1)
        w *= 1 - aces / remaining
    return w


def compositions():
    """Yield (kind, total, [(c1,c2),...]) for hard 4-20 and soft 12-20."""
    hard = defaultdict(list)
    soft = defaultdict(list)
    for c1 in range(1, 11):
        for c2 in range(c1, 11):
            if c1 == 1 and c2 == 1:
                soft[12].append((1, 1))
            elif c1 == 1:
                if c2 == 10:
                    continue  # natural
                soft[11 + c2].append((1, c2))
            else:
                hard[c1 + c2].append((c1, c2))
    for t in sorted(hard):
        comps = [c for c in hard[t] if c[0] != c[1]] or hard[t]
        yield "hard", t, comps
    for t in sorted(soft):
        yield "soft", t, soft[t]


def best(values, actions):
    cand = [(values[a], a) for a in actions if values.get(a) is not None]
    cand.sort(key=lambda x: -x[0])
    return cand[0][1], (cand[0][0] - cand[1][0] if len(cand) > 1 else float("inf"))


def make_rows(vals, rules, ls):
    preset = f"{rules}_{'LS' if ls else 'noLS'}"
    rows = []
    for kind, total, comps in compositions():
        for u in UPS:
            acc = {"S": 0.0, "H": 0.0, "D": 0.0}
            wsum = 0.0
            for c1, c2 in comps:
                w = deal_weight(c1, c2, u)
                v = vals[(c1, c2, u)]
                for a in acc:
                    acc[a] += w * v[a]
                wsum += w
            ev = {a: acc[a] / wsum for a in acc}
            ev["P"] = None
            ev["R"] = -0.5 if ls else None
            rows.append(make_row(preset, kind, total, u, ev, comps, ls))
    for c in range(1, 11):
        for u in UPS:
            v = vals[(c, c, u)]
            ev = {"S": v["S"], "H": v["H"], "D": v["D"], "P": v["P"], "R": -0.5 if ls else None}
            rows.append(make_row(preset, "pair", c, u, ev, [(c, c)], ls))
    return preset, rows


def make_row(preset, kind, hand, u, ev, comps, ls):
    original = ["S", "H", "D"] + (["P"] if kind == "pair" else []) + (["R"] if ls else [])
    action, margin = best(ev, original)
    fb_double, _ = best(ev, ["S", "H"])
    fb_double_ls, _ = best(ev, ["S", "H"] + (["R"] if ls else []))
    if kind == "pair" and hand == 1:
        fb_split_rule = "S"  # split aces receive one card each: forced stand
    else:
        fb_split_rule, _ = best(ev, ["S", "H", "D"])
    fb_split_balance, _ = best(ev, ["S", "H"] + (["R"] if ls else []))
    fb_surrender, _ = best(ev, ["S", "H", "D"] + (["P"] if kind == "pair" else []))
    return {
        "preset": preset, "kind": kind, "hand": hand, "up": u, "action": action,
        "margin": f"{margin:.9f}",
        "fallback_double": fb_double,
        "fallback_double_ls_original": fb_double_ls,
        "fallback_split_rule": fb_split_rule if kind == "pair" else "",
        "fallback_split_balance": fb_split_balance if kind == "pair" else "",
        "fallback_surrender": fb_surrender,
        "ev_stand": f"{ev['S']:.9f}", "ev_hit": f"{ev['H']:.9f}", "ev_double": f"{ev['D']:.9f}",
        "ev_split": f"{ev['P']:.9f}" if ev["P"] is not None else "",
        "ev_surrender": "-0.5" if ls else "",
        "compositions": " ".join(f"{cname(a)}{cname(b)}" for a, b in comps),
    }


def continuation_rows(rows):
    """Hard 4-21 / soft 12-21 continuation (no surrender, double only if allowed)."""
    out = []
    byk = {(r["kind"], r["hand"], r["up"]): r for r in rows}
    for kind, lo, hi in (("hard", 4, 21), ("soft", 12, 21)):
        for t in range(lo, hi + 1):
            for u in UPS:
                if t == 21:
                    out.append({"kind": kind, "total": 21, "up": u, "action": "S", "fallback": "S"})
                    continue
                r = byk[(kind, t, u)]
                ev = {"S": float(r["ev_stand"]), "H": float(r["ev_hit"]), "D": float(r["ev_double"])}
                a, _ = best(ev, ["S", "H", "D"])
                fb, _ = best(ev, ["S", "H"])
                out.append({"kind": kind, "total": t, "up": u, "action": a, "fallback": fb})
    return out


def symbol(r):
    a = r["action"]
    if a == "D":
        return "Ds" if r["fallback_double"] == "S" else "D"
    if a == "R":
        return "R" + r["fallback_surrender"].lower()
    if a == "P":
        return "P"
    return a


def render(preset, rows):
    byk = {(r["kind"], r["hand"], r["up"]): r for r in rows}
    hdr = "| Hand | " + " | ".join(cname(u) for u in UPS) + " |\n|---|" + "---|" * len(UPS) + "\n"
    out = [f"## {preset}\n", "Symbols: S stand, H hit, D double else hit, Ds double else stand, P split, "
           "Rh surrender else hit, Rs surrender else stand, Rp surrender else split.\n"]
    out.append("### Hard totals\n" + hdr + "".join(
        f"| {t} | " + " | ".join(symbol(byk[('hard', t, u)]) for u in UPS) + " |\n" for t in range(5, 20)))
    out.append("### Soft totals\n" + hdr + "".join(
        f"| A,{cname(t - 11)} | " + " | ".join(symbol(byk[('soft', t, u)]) for u in UPS) + " |\n"
        for t in range(13, 21)))
    out.append("### Pairs\n" + hdr + "".join(
        f"| {cname(c)},{cname(c)} | " + " | ".join(symbol(byk[('pair', c, u)]) for u in UPS) + " |\n"
        for c in [1] + list(range(2, 11))))
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--s17", required=True)
    ap.add_argument("--h17", required=True)
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()
    for rules, path in (("S17", args.s17), ("H17", args.h17)):
        vals = load(path)
        for ls in (1, 0):
            preset, rows = make_rows(vals, rules, ls)
            with open(os.path.join(args.outdir, f"basic_{preset}.csv"), "w", newline="") as f:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                w.writerows(rows)
            with open(os.path.join(args.outdir, f"tables_{preset}.md"), "w") as f:
                f.write(render(preset, rows))
            if ls:
                cont = continuation_rows(rows)
                with open(os.path.join(args.outdir, f"continuation_{rules}.csv"), "w", newline="") as f:
                    w = csv.DictWriter(f, fieldnames=["kind", "total", "up", "action", "fallback"])
                    w.writeheader()
                    w.writerows(cont)
            print(f"wrote basic_{preset}.csv ({len(rows)} rows)")


if __name__ == "__main__":
    main()

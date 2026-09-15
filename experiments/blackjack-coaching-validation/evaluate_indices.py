#!/usr/bin/env python3
"""Generate Hi-Lo index thresholds under the accepted True Count convention.

Pipeline:
  1. `prepare` writes the composition file consumed by farmer_driver (one line
     per sampled round-start state, minus the other players' initial cards)
     and the list of two-card situations to evaluate.
  2. farmer_driver is run on that file (outside this script) for S17 and H17
     and for the chosen continuation mode.
  3. `aggregate` weights every (state, situation composition) by the
     stratum reweighting factor times the probability that the situation is
     dealt from that state, bins by the integer true count at the decision,
     and reports per-bin mean action-value differences, their standard
     errors, and the resulting threshold.

Accepted true-count convention at the decision: running count = Hi-Lo tags of
all exposed cards (other players' initial cards, the learner's two cards, the
dealer up card; not the hole card); divisor = physical cards remaining in the
shoe (state minus everything dealt this round including the hole card) to the
nearest half deck, ties upward, minimum 0.5; true count = trunc(RC / divisor).

Index definition used here (proposal): the threshold t* for "deviate at
TC >= t*" is the smallest integer t such that the weighted mean of
(EV_deviation - EV_basic) is >= 0 for every bin t' >= t with adequate support,
and < 0 for bin t-1.  For negative-direction plays (hit below the index) the
same rule is applied to (EV_stand - EV_hit).  Bins with fewer than --min-n
effective samples are reported but not used for the threshold.

Usage:
    python3 evaluate_indices.py prepare states.json comps.txt hands.txt
    python3 evaluate_indices.py aggregate states.json driver_S17.csv S17 out_prefix
"""
import csv
import json
import math
import sys
from collections import defaultdict

TAG = {1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1}
TOL = 0.001  # proposed absolute tolerance, expected net return per original bet
SIT_HARD = {
    16: [(10, 6), (9, 7)],
    15: [(10, 5), (9, 6), (8, 7)],
    14: [(10, 4), (9, 5), (8, 6), (7, 7)],
    13: [(10, 3), (9, 4), (8, 5), (7, 6)],
    12: [(10, 2), (9, 3), (8, 4), (7, 5)],
    11: [(9, 2), (8, 3), (7, 4), (6, 5)],
    10: [(8, 2), (7, 3), (6, 4), (5, 5)],
    9: [(7, 2), (6, 3), (5, 4)],
    8: [(6, 2), (5, 3), (4, 4)],
    17: [(10, 7), (9, 8)],
}
# name, compositions, up, deviation action, basic/alternative action, curriculum
# "dev" and "alt" are one of S,H,D,P,R or "best:<actions>" for the best of a set.
SITUATIONS = [
    ("16 vs 10 stand", SIT_HARD[16], 10, "S", "H", "I18"),
    ("15 vs 10 stand", SIT_HARD[15], 10, "S", "H", "I18"),
    ("T,T vs 5 split", [(10, 10)], 5, "P", "S", "I18"),
    ("T,T vs 6 split", [(10, 10)], 6, "P", "S", "I18"),
    ("10 vs 10 double", SIT_HARD[10], 10, "D", "H", "I18"),
    ("12 vs 3 stand", SIT_HARD[12], 3, "S", "H", "I18"),
    ("12 vs 2 stand", SIT_HARD[12], 2, "S", "H", "I18"),
    ("11 vs A double", SIT_HARD[11], 1, "D", "H", "I18"),
    ("9 vs 2 double", SIT_HARD[9], 2, "D", "H", "I18"),
    ("10 vs A double", SIT_HARD[10], 1, "D", "H", "I18"),
    ("9 vs 7 double", SIT_HARD[9], 7, "D", "H", "I18"),
    ("16 vs 9 stand", SIT_HARD[16], 9, "S", "H", "I18"),
    ("13 vs 2 stand", SIT_HARD[13], 2, "S", "H", "I18"),
    ("12 vs 4 stand", SIT_HARD[12], 4, "S", "H", "I18"),
    ("12 vs 5 stand", SIT_HARD[12], 5, "S", "H", "I18"),
    ("12 vs 6 stand", SIT_HARD[12], 6, "S", "H", "I18"),
    ("13 vs 3 stand", SIT_HARD[13], 3, "S", "H", "I18"),
    ("14 vs 10 surrender", SIT_HARD[14], 10, "R", "best:SHD", "F4"),
    ("15 vs 10 surrender", SIT_HARD[15], 10, "R", "best:SHD", "F4"),
    ("15 vs 9 surrender", SIT_HARD[15], 9, "R", "best:SHD", "F4"),
    ("15 vs A surrender", SIT_HARD[15], 1, "R", "best:SHD", "F4"),
    # Supplementary (not in the accepted curriculum; BJA chart entries or
    # surrender precedence checks).  Reported for comparison only.
    ("T,T vs 4 split", [(10, 10)], 4, "P", "S", "supp"),
    ("A,8 vs 4 double", [(1, 8)], 4, "D", "S", "supp"),
    ("A,8 vs 5 double", [(1, 8)], 5, "D", "S", "supp"),
    ("A,8 vs 6 double", [(1, 8)], 6, "D", "S", "supp"),
    ("A,6 vs 2 double", [(1, 6)], 2, "D", "H", "supp"),
    ("8 vs 6 double", SIT_HARD[8], 6, "D", "H", "supp"),
    ("16 vs A stand", SIT_HARD[16], 1, "S", "H", "supp"),
    ("15 vs A stand", SIT_HARD[15], 1, "S", "H", "supp"),
    ("16 vs 8 surrender", SIT_HARD[16], 8, "R", "best:SHD", "supp"),
    ("16 vs 9 surrender", SIT_HARD[16], 9, "R", "best:SHD", "supp"),
    ("16 vs 10 surrender", SIT_HARD[16], 10, "R", "best:SHD", "supp"),
    ("16 vs A surrender", SIT_HARD[16], 1, "R", "best:SHD", "supp"),
    ("17 vs A surrender", SIT_HARD[17], 1, "R", "best:SHD", "supp"),
    ("8,8 vs A surrender", [(8, 8)], 1, "R", "best:SHDP", "supp"),
    ("8,8 vs 10 surrender", [(8, 8)], 10, "R", "best:SHDP", "supp"),
]


# Basic (fresh-shoe) action per situation; "dev" means the deviation action
# listed in SITUATIONS is itself the basic action (the departure happens
# below the index), "alt" means the alternative is basic.  Rules-dependent
# entries are given per rule set.  Ties resolve toward the basic action.
BASIC = {
    "13 vs 2 stand": "dev", "12 vs 4 stand": "dev", "12 vs 5 stand": "dev",
    "12 vs 6 stand": "dev", "13 vs 3 stand": "dev",
    "15 vs 10 surrender": "dev", "16 vs 9 surrender": "dev",
    "16 vs 10 surrender": "dev", "16 vs A surrender": "dev",
    "11 vs A double": {"S17": "alt", "H17": "dev"},
    "A,8 vs 6 double": {"S17": "alt", "H17": "dev"},
    "15 vs A surrender": {"S17": "alt", "H17": "dev"},
    "8,8 vs A surrender": {"S17": "alt", "H17": "dev"},
    "17 vs A surrender": {"S17": "alt", "H17": "dev"},
}
CONVENTION = "trunc"  # or "round": half away from zero (comparator convention)


def divisor(physical):
    return max(0.5, ((physical + 13) // 26) / 2)


def tc_of(rc, physical):
    q = rc / divisor(physical)
    if CONVENTION == "round":
        return int(math.floor(abs(q) + 0.5)) * (1 if q >= 0 else -1)
    return int(q)


def basic_of(name, rules):
    b = BASIC.get(name, "alt")
    return b[rules] if isinstance(b, dict) else b


def state_pool(state):
    """Unseen pool at the learner's decision before the learner's cards and
    the up card are removed: round-start composition minus other players'
    initial cards.  Also returns the RC contributed by those cards."""
    cards = list(state["cards"])  # index 0 = ace ... 9 = ten
    rc_others = 0
    for c in state.get("others", []):
        cards[c - 1] -= 1
        rc_others += TAG[c]
    return cards, rc_others


def prepare(states_path, comps_path, hands_path):
    data = json.load(open(states_path))
    with open(comps_path, "w") as f:
        for i, st in enumerate(data["states"]):
            cards, _ = state_pool(st)
            f.write(f"{i} " + " ".join(str(c) for c in cards) + "\n")
    seen = set()
    with open(hands_path, "w") as f:
        for name, comps, up, dev, alt, cur in SITUATIONS:
            for c1, c2 in comps:
                key = (min(c1, c2), max(c1, c2), up)
                if key not in seen:
                    seen.add(key)
                    f.write(f"{key[0]} {key[1]} {key[2]}\n")
    print(f"wrote {len(data['states'])} compositions and {len(seen)} hand/up triples")


def classify_bin(m, se):
    """Accepted tolerance rule: a bin is decisive for the deviation (+1) only
    if its mean advantage exceeds max(TOL, 2*SE), decisive against it (-1)
    below -max(TOL, 2*SE), otherwise a tie (0), resolved toward the basic
    action by compute_thresholds."""
    lim = max(TOL, 2 * se) if se == se else TOL
    return 1 if m > lim else -1 if m < -lim else 0


def compute_thresholds(means, usable, basic):
    """Raw and tolerance thresholds for one situation.

    means: {tc: (mean_diff, se, n, weight)} with mean_diff = deviation minus
    alternative; usable: sorted bins with adequate support inside the
    searched range; basic: "alt" when the alternative is the basic action
    (deviate at/above the threshold) or "dev" when the at/above action is
    itself basic (depart below the threshold).  Returns (raw, tolerance),
    each an int or "<=lowest" / ">highest" when no crossover is inside the
    usable range.  (None, None) without usable bins.
    """
    threshold = threshold_tol = None
    if not usable:
        return threshold, threshold_tol
    # Raw rule: smallest t such that all usable bins >= t have mean >= 0.
    for t in usable:
        if all(means[u][0] >= 0 for u in usable if u >= t):
            threshold = t
            break

    def cls(u):
        return classify_bin(means[u][0], means[u][1])
    if basic == "alt":
        # deviation taken at/above t: bin t must be decisive for it,
        # ties at t push the threshold up, ties above are harmless
        for t in usable:
            if cls(t) == 1 and all(cls(u) != -1 for u in usable if u > t):
                threshold_tol = t
                break
    else:
        # the "at/above" action is basic: keep it wherever the bin is
        # not decisive against it (ties resolve toward basic)
        for t in usable:
            if all(cls(u) != -1 for u in usable if u >= t):
                threshold_tol = t
                break
    if threshold is not None and threshold == usable[0]:
        threshold = f"<={threshold}"  # deviation preferred at every supported bin
    elif threshold is None:
        threshold = f">{usable[-1]}"
    if threshold_tol is not None and threshold_tol == usable[0]:
        threshold_tol = f"<={threshold_tol}"
    elif threshold_tol is None:
        threshold_tol = f">{usable[-1]}"
    return threshold, threshold_tol


def value(row, spec):
    if spec == "R":
        return -0.5
    if spec.startswith("best:"):
        return max(row[a] for a in spec[5:] if row.get(a) is not None)
    return row[spec]


def aggregate(states_path, driver_path, rules, out_prefix, min_n=200):
    data = json.load(open(states_path))
    states = data["states"]
    strata = {int(k): v for k, v in data["strata"].items()}
    weight_of_stratum = {tc: v["population"] / v["sampled"] for tc, v in strata.items()}
    values = defaultdict(dict)  # state index -> (c1,c2,up) -> {S,H,D,P}
    with open(driver_path) as f:
        for r in csv.DictReader(f):
            values[int(r["id"])][(int(r["c1"]), int(r["c2"]), int(r["up"]))] = {
                "S": float(r["stand"]), "H": float(r["hit"]), "D": float(r["double"]),
                "P": float(r["split"]) if r["split"] else None,
            }
    results = []
    detail_rows = []
    for name, comps, up, dev, alt, cur in SITUATIONS:
        # bins[tc][state] = [w, w*d]; compositions of one state are correlated,
        # so the standard error is computed across states (ratio estimator).
        bins = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
        sign_bins = defaultdict(lambda: [0.0, 0.0, 0])  # (tc, sign) -> w, w*d, n
        for i, st in enumerate(states):
            cards, rc_others = state_pool(st)
            n = sum(cards)
            # Exposed-card RC before the learner's cards and the up card: the
            # round-start RC is -sum(tags of the whole remaining shoe) because
            # every earlier card is exposed; other players' initial cards are
            # exposed too, so add their tags.
            rc0 = -sum(TAG[c] * st["cards"][c - 1] for c in range(1, 11)) + rc_others
            wst = weight_of_stratum[st["tc"]]
            for c1, c2 in comps:
                key = (min(c1, c2), max(c1, c2), up)
                row = values[i].get(key)
                if row is None:
                    continue
                # probability the situation is dealt from this pool
                n1 = cards[c1 - 1]
                n2 = cards[c2 - 1] - (1 if c2 == c1 else 0)
                nu = cards[up - 1] - (1 if up == c1 else 0) - (1 if up == c2 else 0)
                if n1 <= 0 or n2 <= 0 or nu <= 0:
                    continue
                p = n1 / n * n2 / (n - 1) * nu / (n - 2) * (2 if c1 != c2 else 1)
                # the decision is reached only if the dealer has no blackjack
                if up == 1:
                    p *= 1 - (cards[9] - (c1 == 10) - (c2 == 10)) / (n - 3)
                elif up == 10:
                    p *= 1 - (cards[0] - (c1 == 1) - (c2 == 1)) / (n - 3)
                w = wst * p
                rc = rc0 + TAG[c1] + TAG[c2] + TAG[up]
                physical = n - 4  # learner's two cards, up card, hole card
                tc = tc_of(rc, physical)
                d = value(row, dev) - value(row, alt)
                b = bins[tc][i]
                b[0] += w
                b[1] += w * d
                sb = sign_bins[(tc, (rc > 0) - (rc < 0))]
                sb[0] += w
                sb[1] += w * d
                sb[2] += 1
        # threshold
        means = {}
        for tc in sorted(bins):
            per_state = bins[tc]
            w = sum(v[0] for v in per_state.values())
            wd = sum(v[1] for v in per_state.values())
            m = wd / w
            cnt = len(per_state)
            # ratio-estimator variance across independent sampled states
            var = sum((v[1] - m * v[0]) ** 2 for v in per_state.values()) / (w * w) if cnt > 1 else float("nan")
            se = math.sqrt(var) if cnt > 1 else float("nan")
            means[tc] = (m, se, cnt, w)
            detail_rows.append([rules, cur, name, tc, f"{m:+.6f}", f"{se:.6f}", cnt, f"{w:.1f}"])
        # Threshold search is confined to the curriculum range |TC| <= 8; the
        # far tails are reported in the bins file but a second crossover far
        # outside the taught range (e.g. standing on 15 vs A above +14) must
        # not break the one-sided threshold.
        usable = [tc for tc in sorted(means) if means[tc][2] >= min_n and -8 <= tc <= 8]
        threshold, threshold_tol = compute_thresholds(means, usable, basic_of(name, rules))
        # sign breakdown for bins -1..1
        signs = []
        for tc in (-1, 0, 1):
            for s in (-1, 0, 1):
                sb = sign_bins.get((tc, s))
                if sb and sb[2] >= 20:
                    signs.append(f"tc{tc:+d}/rc{'-0+'[s + 1]}:{sb[1] / sb[0]:+.4f}(n={sb[2]})")
        near = " ".join(f"{u:+d}:{means[u][0]:+.4f}±{means[u][1]:.4f}" for u in usable
                        if isinstance(threshold_tol, int) and abs(u - threshold_tol) <= 1)
        results.append([rules, cur, name, dev, alt, threshold, threshold_tol, near, " ".join(signs)])
    with open(out_prefix + "_bins.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rules", "curriculum", "situation", "tc", "mean_diff", "se", "n_states", "weight"])
        w.writerows(detail_rows)
    with open(out_prefix + "_thresholds.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rules", "curriculum", "situation", "deviation", "alternative", "threshold_raw",
                    "threshold_tolerance", "bins_near_threshold", "rc_sign_breakdown"])
        w.writerows(results)
    for r in results:
        print(f"{r[0]} {r[1]:4s} {r[2]:22s} raw {str(r[5]):>5s} tol {str(r[6]):>5s}  {r[7]}  {r[8]}")


def insurance(states_path, rules, out_prefix, min_n=200):
    """Insurance index: EV = 3p - 1 with p = tens among unseen cards after the
    learner's two cards and the ace are removed (hole card unseen)."""
    data = json.load(open(states_path))
    states = data["states"]
    strata = {int(k): v for k, v in data["strata"].items()}
    weight_of_stratum = {tc: v["population"] / v["sampled"] for tc, v in strata.items()}
    bins = defaultdict(lambda: defaultdict(lambda: [0.0, 0.0]))
    sign_bins = defaultdict(lambda: [0.0, 0.0, 0])
    for si, st in enumerate(states):
        cards, rc_others = state_pool(st)
        n = sum(cards)
        rc0 = -sum(TAG[c] * st["cards"][c - 1] for c in range(1, 11)) + rc_others
        wst = weight_of_stratum[st["tc"]]
        if cards[0] < 1:
            continue
        for c1 in range(1, 11):
            for c2 in range(c1, 11):
                n1 = cards[c1 - 1]
                n2 = cards[c2 - 1] - (1 if c2 == c1 else 0)
                na = cards[0] - (1 if c1 == 1 else 0) - (1 if c2 == 1 else 0)
                if n1 <= 0 or n2 <= 0 or na <= 0:
                    continue
                p = n1 / n * n2 / (n - 1) * na / (n - 2) * (2 if c1 != c2 else 1)
                w = wst * p
                tens = cards[9] - (1 if c1 == 10 else 0) - (1 if c2 == 10 else 0)
                pool = n - 3
                d = 3 * tens / pool - 1
                rc = rc0 + TAG[c1] + TAG[c2] + TAG[1]
                tc = tc_of(rc, n - 4)
                b = bins[tc][si]
                b[0] += w
                b[1] += w * d
                sb = sign_bins[(tc, (rc > 0) - (rc < 0))]
                sb[0] += w
                sb[1] += w * d
                sb[2] += 1
    rows = []
    for tc in sorted(bins):
        per_state = bins[tc]
        w = sum(v[0] for v in per_state.values())
        wd = sum(v[1] for v in per_state.values())
        m = wd / w
        cnt = len(per_state)
        var = sum((v[1] - m * v[0]) ** 2 for v in per_state.values()) / (w * w) if cnt > 1 else float("nan")
        rows.append([rules, "I18", "insurance", tc, f"{m:+.6f}", f"{math.sqrt(var):.6f}", cnt, f"{w:.1f}"])
    with open(out_prefix + "_insurance_bins.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rules", "curriculum", "situation", "tc", "mean_diff", "se", "n", "weight"])
        w.writerows(rows)
    for r in rows:
        print("insurance", r[3], r[4], r[5], r[6])
    for tc in (2, 3, 4):
        for s in (-1, 0, 1):
            sb = sign_bins.get((tc, s))
            if sb:
                print(f"  insurance tc{tc:+d} rc sign {s:+d}: mean {sb[1] / sb[0]:+.5f} n={sb[2]}")


if __name__ == "__main__":
    if "--round" in sys.argv:
        sys.argv.remove("--round")
        CONVENTION = "round"
    cmd = sys.argv[1]
    if cmd == "prepare":
        prepare(*sys.argv[2:5])
    elif cmd == "aggregate":
        aggregate(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    elif cmd == "insurance":
        insurance(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        sys.exit("unknown command")

#!/usr/bin/env python3
"""All-occurrence index thresholds from sampled decision occurrences.

Combines the accepted two-card thresholds (state-based, `evaluate_indices.py`)
with the learner's multi-card and post-split occurrences recorded by
`sample_decisions.py` and valued by `farmer_driver --perline`.

Commands
--------
prepare  <decisions glob> <sample.json> <comps.txt> <two-card thresholds csv,...>
         [cap_focus cap_focus_orig2 cap_other cap_tail seed]
    Merge the sampling replicas.  Every replica keeps its own stratum
    populations, so an occurrence sampled in replica r from stratum
    s = (situation key, true count, category) carries weight pop_rs / n_rs.
    Strata are then uniformly subsampled and the kept weights scaled by N/n
    (unbiased): the bins adjacent to every accepted two-card threshold of
    the key (both rule sets) keep cap_focus non-original occurrences and
    cap_focus_orig2 original two-card ones; other bins inside |TC| <= 8 keep
    cap_other and the tails cap_tail.  Writes the sample with weights and the
    driver input (one composition + hand per line).

aggregate <sample.json> <driver.csv> <rules> <state_bins.csv> <out_prefix>
    For every situation in evaluate_indices.SITUATIONS and every integer
    true-count bin:
      * state      the accepted two-card estimate (mean, SE, n_states) read
                   from the state-based bins file;
      * orig2      the same quantity estimated directly from sampled original
                   two-card occurrences (pipeline cross-check);
      * nonorig    the multi-card and post-split occurrences that the
                   two-card method never sees;
      * postsplit  post-split occurrences only (two-card and multi-card);
      * all        the all-occurrence estimate
                   (1 - f) * state + f * nonorig, with f the population
                   share of non-original-two-card occurrences in the bin
                   (measured over the full simulation, not the sample) and
                   SE = sqrt(((1-f) SE_state)^2 + (f SE_nonorig)^2);
      * direct_all the all-occurrence estimate from sampled occurrences
                   alone (second cross-check).
    Thresholds use evaluate_indices.compute_thresholds (accepted tie and
    tolerance rules) on each of these series.  The "all" tolerance threshold
    is the taught value.

Category relevance: stand/hit situations take every category; double
situations take original and post-split two-card hands (no double on three
or more cards; DAS applies, split aces never decide); pair and surrender
situations take original two-card hands only (Fab 4 never apply post-split,
T,T is never split by the basic table so post-split tens never occur).
"""
import csv
import glob
import json
import math
import random
import sys
from collections import defaultdict

from evaluate_indices import SITUATIONS, TOL, basic_of, compute_thresholds, value

CATS = ("orig2", "multi", "split2", "splitmulti")
NONORIG = ("multi", "split2", "splitmulti")
POSTSPLIT = ("split2", "splitmulti")
SE_UNKNOWN = 0.05  # conservative stand-in when a bin has fewer than two sampled non-original occurrences


def situation_key(comps, up, dev):
    """Occurrence key and relevant categories for a SITUATIONS entry."""
    if comps == [(10, 10)]:
        return f"pair10v{up}", ("orig2",)
    if comps == [(8, 8)]:
        return f"pair8v{up}", ("orig2",)
    if comps == [(1, 8)]:
        return f"soft19v{up}", ("orig2", "split2")
    if comps == [(1, 6)]:
        return f"soft17v{up}", ("orig2", "split2")
    total = sum(comps[0])
    key = f"hard{total}v{up}"
    if dev == "S":
        return key, CATS
    if dev == "D":
        return key, ("orig2", "split2")
    if dev == "R":
        return key, ("orig2",)
    raise ValueError(dev)


MIN_NONORIG = 50   # a bin with f >= F_MIN needs this many sampled non-original occurrences to be usable
F_MIN = 0.05


def focus_bins(threshold_files, radius=1, curricula=None):
    """Bins t-radius..t+radius around every accepted two-card tolerance
    threshold of every situation sharing an occurrence key (both rule
    sets), where the engine budget is concentrated.  Far bins only need a
    thin sample: their means are large and their thresholds cannot move, and
    the support rule (MIN_NONORIG) keeps a thin bin from deciding anything."""
    focus = defaultdict(set)
    for path in threshold_files:
        for r in csv.DictReader(open(path)):
            sit = next(s for s in SITUATIONS if s[0] == r["situation"])
            if curricula and sit[5] not in curricula:
                continue
            key, _ = situation_key(sit[1], sit[2], sit[3])
            try:
                t = int(r["threshold_tolerance"])
            except ValueError:
                continue
            focus[key].update(range(t - radius, t + radius + 1))
    return focus


def merge_replicas(pattern):
    files = sorted(glob.glob(pattern))
    if not files:
        sys.exit(f"no files match {pattern}")
    pop = defaultdict(int)
    merged = defaultdict(list)
    configs = []
    for path in files:
        d = json.load(open(path))
        configs.append(d["config"])
        sampled = defaultdict(int)
        for o in d["occurrences"]:
            sampled[(o["k"], o["tc"], o["cat"])] += 1
        rpop = {}
        for s, n in d["population"].items():
            k, tc, cat = s.split("|")
            rpop[(k, int(tc), cat)] = n
            pop[(k, int(tc), cat)] += n
        for o in d["occurrences"]:
            s = (o["k"], o["tc"], o["cat"])
            merged[s].append((rpop[s] / sampled[s], o))
    return files, configs, pop, merged


def subsample(lst, cap, rng):
    if len(lst) > cap:
        return rng.sample(lst, cap), len(lst) / cap
    return lst, 1.0


def write_comps(path, occurrences):
    with open(path, "w") as f:
        for o in occurrences:
            f.write(f"{o['id']} " + " ".join(str(c) for c in o["pool"]) + f" {o['up']} " +
                    " ".join(str(c) for c in o["cards"]) + "\n")


def prepare(pattern, sample_path, comps_path, threshold_files, cap_focus=250, cap_focus_orig2=80,
            cap_other=12, cap_tail=4, seed=21):
    files, configs, pop, merged = merge_replicas(pattern)
    focus = focus_bins(threshold_files)
    rng = random.Random(seed)
    sample = []
    for s in sorted(merged):
        key, tc, cat = s
        if tc in focus.get(key, ()):
            cap = cap_focus_orig2 if cat == "orig2" else cap_focus
        elif -8 <= tc <= 8:
            cap = cap_other
        else:
            cap = cap_tail
        keep, scale = subsample(merged[s], cap, rng)
        for w, o in keep:
            o = dict(o)
            o["w"] = w * scale
            o["id"] = len(sample)
            sample.append(o)
    out = {
        "replicas": configs,
        "rounds": sum(c["rounds"] for c in configs),
        "learner_decisions": sum(c["learner_decisions"] for c in configs),
        "caps": {"focus_nonorig": cap_focus, "focus_orig2": cap_focus_orig2, "other": cap_other, "tail": cap_tail},
        "focus_bins": {k: sorted(v) for k, v in focus.items()},
        "subsample_seed": seed,
        "population": {f"{k}|{tc}|{cat}": n for (k, tc, cat), n in sorted(pop.items())},
        "occurrences": sample,
    }
    json.dump(out, open(sample_path, "w"))
    write_comps(comps_path, sample)
    print(f"{len(files)} replicas, {out['rounds']} rounds, {len(pop)} strata, "
          f"{sum(pop.values())} occurrences in population, {len(sample)} sampled for the engine")


def supplement(pattern, old_sample_path, sample_path, comps_path, threshold_files, radius=2,
               cap_focus=200, seed=22, curricula=("I18", "F4")):
    """Widen the focus to t-radius..t+radius for the curriculum situations:
    the non-original strata of the newly focused bins are re-drawn from the
    merged reservoirs at cap_focus (replacing the thin sample of those
    strata), so no bin adjacent to a possible threshold is decided by a
    handful of occurrences.  Writes the combined sample and a driver input
    holding only the new occurrences (ids continue after the old sample)."""
    files, configs, pop, merged = merge_replicas(pattern)
    old = json.load(open(old_sample_path))
    old_focus = {k: set(v) for k, v in old["focus_bins"].items()}
    wide = focus_bins(threshold_files, radius, curricula)
    new_strata = set()
    for key, bins in wide.items():
        for tc in bins - old_focus.get(key, set()):
            for cat in NONORIG:
                new_strata.add((key, tc, cat))
    kept = [o for o in old["occurrences"] if (o["k"], o["tc"], o["cat"]) not in new_strata]
    rng = random.Random(seed)
    next_id = max(o["id"] for o in old["occurrences"]) + 1
    new = []
    for s in sorted(new_strata):
        if s not in merged:
            continue
        keep, scale = subsample(merged[s], cap_focus, rng)
        for w, o in keep:
            o = dict(o)
            o["w"] = w * scale
            o["id"] = next_id
            next_id += 1
            new.append(o)
    out = dict(old)
    out["supplement"] = {"radius": radius, "cap_focus": cap_focus, "seed": seed, "curricula": list(curricula),
                         "strata_replaced": len(new_strata), "occurrences_added": len(new),
                         "occurrences_dropped": len(old["occurrences"]) - len(kept)}
    out["focus_bins_supplement"] = {k: sorted(v) for k, v in wide.items()}
    out["occurrences"] = kept + new
    json.dump(out, open(sample_path, "w"))
    write_comps(comps_path, new)
    print(f"supplement: {len(new_strata)} strata re-drawn, {len(new)} new occurrences for the engine, "
          f"{len(old['occurrences']) - len(kept)} thin ones dropped, {len(out['occurrences'])} total")


def wstats(pairs):
    """Weighted mean, SE (independent occurrences), count and total weight."""
    if not pairs:
        return None
    w = sum(p[0] for p in pairs)
    m = sum(p[0] * p[1] for p in pairs) / w
    n = len(pairs)
    if n > 1:
        se = math.sqrt(sum((p[0] * (p[1] - m)) ** 2 for p in pairs)) / w
    else:
        se = float("nan")
    return m, se, n, w


def fmt(x, digits=6):
    return "" if x is None or x != x else f"{x:+.{digits}f}"


def aggregate(sample_path, driver_path, rules, state_bins_path, out_prefix,
              min_n_state=200, min_n_occ=50, state_rounds=17287008):
    d = json.load(open(sample_path))
    rounds = d["rounds"]
    pop = defaultdict(int)
    for s, n in d["population"].items():
        k, tc, cat = s.split("|")
        pop[(k, int(tc), cat)] = n
    vals = {}
    for path in driver_path.split(","):
        with open(path) as f:
            for r in csv.DictReader(f):
                vals[int(r["id"])] = {
                    "S": float(r["stand"]), "H": float(r["hit"]),
                    "D": float(r["double"]) if r["double"] else None,
                    "P": float(r["split"]) if r["split"] else None,
                }
    state = {}
    with open(state_bins_path) as f:
        for r in csv.DictReader(f):
            if r["rules"] == rules:
                state[(r["situation"], int(r["tc"]))] = (float(r["mean_diff"]), float(r["se"]),
                                                          int(r["n_states"]), float(r["weight"]))
    by_key = defaultdict(list)
    for o in d["occurrences"]:
        by_key[o["k"]].append(o)

    bins_rows, thr_rows = [], []
    for name, comps, up, dev, alt, cur in SITUATIONS:
        key, cats = situation_key(comps, up, dev)
        per = {cat: defaultdict(list) for cat in cats}
        for o in by_key.get(key, []):
            if o["cat"] not in cats:
                continue
            row = vals.get(o["id"])
            if row is None:
                continue
            if dev == "D" and row["D"] is None:
                continue
            per[o["cat"]][o["tc"]].append((o["w"], value(row, dev) - value(row, alt)))
        tcs = sorted(set(tc for cat in cats for tc in per[cat]) | set(tc for (s, tc) in state if s == name))
        series = {k: {} for k in ("state", "orig2", "nonorig", "postsplit", "all", "direct_all")}
        shares = {}
        for tc in tcs:
            p_cat = {cat: pop.get((key, tc, cat), 0) for cat in cats}
            p_all = sum(p_cat.values())
            f = (sum(p_cat[c] for c in cats if c != "orig2") / p_all) if p_all else 0.0
            shares[tc] = (p_cat, f)
            st = state.get((name, tc))
            o2 = wstats(per["orig2"].get(tc, []))
            no = wstats([p for c in cats if c in NONORIG for p in per[c].get(tc, [])])
            ps = wstats([p for c in cats if c in POSTSPLIT for p in per[c].get(tc, [])])
            da = wstats([p for c in cats for p in per[c].get(tc, [])])
            if st:
                series["state"][tc] = st
                if f == 0.0 or no is None:
                    series["all"][tc] = (st[0], st[1], st[2], st[3])
                else:
                    se_no = no[1] if no[2] > 1 else SE_UNKNOWN
                    m = (1 - f) * st[0] + f * no[0]
                    se = math.sqrt(((1 - f) * st[1]) ** 2 + (f * se_no) ** 2)
                    # support rule: a bin whose non-original share matters is
                    # usable only with MIN_NONORIG sampled non-original
                    # occurrences; a thin bin is reported (n = 0) but never
                    # decides the threshold
                    n_eff = st[2] if (f < F_MIN or no[2] >= MIN_NONORIG) else 0
                    series["all"][tc] = (m, se, n_eff, st[3])
            if o2:
                series["orig2"][tc] = o2
            if no:
                series["nonorig"][tc] = no
            if ps:
                series["postsplit"][tc] = ps
            if da:
                series["direct_all"][tc] = da
            bins_rows.append([
                rules, cur, name, tc,
                p_cat.get("orig2", 0), p_cat.get("multi", 0), p_cat.get("split2", 0), p_cat.get("splitmulti", 0),
                f"{f:.4f}",
                fmt(st[0]) if st else "", fmt(st[1]) if st else "", st[2] if st else "",
                f"{st[3] / state_rounds * 1e6:.2f}" if st else "",
                f"{p_cat.get('orig2', 0) / rounds * 1e6:.2f}",
                fmt(o2[0]) if o2 else "", fmt(o2[1]) if o2 else "", o2[2] if o2 else 0,
                fmt(no[0]) if no else "", fmt(no[1]) if no else "", no[2] if no else 0,
                fmt(ps[0]) if ps else "", fmt(ps[1]) if ps else "", ps[2] if ps else 0,
                fmt(series["all"][tc][0]) if tc in series["all"] else "",
                fmt(series["all"][tc][1]) if tc in series["all"] else "",
                fmt(da[0]) if da else "", fmt(da[1]) if da else "", da[2] if da else 0,
            ])
        basic = basic_of(name, rules)

        def thr(series_name, min_n):
            s = series[series_name]
            usable = [tc for tc in sorted(s) if s[tc][2] >= min_n and -8 <= tc <= 8]
            return compute_thresholds(s, usable, basic)
        t_state = thr("state", min_n_state)
        t_all = thr("all", min_n_state)
        t_orig2 = thr("orig2", min_n_occ)
        t_direct = thr("direct_all", min_n_occ)
        t_post = thr("postsplit", min_n_occ) if any(c in POSTSPLIT for c in cats) else (None, None)
        # occurrence shares over the whole distribution and at the taught bin
        tot = defaultdict(int)
        for tc, (p_cat, f) in shares.items():
            for c, n in p_cat.items():
                tot[c] += n
        tot_all = sum(tot.values()) or 1
        multi_share = (tot["multi"] + tot["splitmulti"]) / tot_all
        post_share = (tot["split2"] + tot["splitmulti"]) / tot_all
        f_at = shares[t_all[1]][1] if isinstance(t_all[1], int) and t_all[1] in shares else None

        def norm(t):
            # ">8" and ">5" both mean "no crossover inside the usable range"
            return t if isinstance(t, int) or t is None else str(t)[0]
        changed = norm(t_all[1]) != norm(t_state[1])
        lo_hi = []
        if isinstance(t_all[1], int) and isinstance(t_state[1], int):
            lo_hi = list(range(min(t_all[1], t_state[1]) - 1, max(t_all[1], t_state[1]) + 2))
        elif isinstance(t_all[1], int):
            lo_hi = [t_all[1] - 1, t_all[1], t_all[1] + 1]
        detail = []
        for tc in lo_hi:
            st = series["state"].get(tc)
            no = series["nonorig"].get(tc)
            al = series["all"].get(tc)
            if al:
                detail.append(f"{tc:+d}: two-card {fmt(st[0], 4)}±{st[1]:.4f}; non-original "
                              f"{fmt(no[0], 4) + '±' + f'{no[1]:.4f}' + f' (n={no[2]})' if no else 'none'}; "
                              f"f={shares[tc][1]:.3f}; all {fmt(al[0], 4)}±{al[1]:.4f}")
        near = " ".join(f"{u:+d}:{series['all'][u][0]:+.4f}±{series['all'][u][1]:.4f}" for u in sorted(series["all"])
                        if isinstance(t_all[1], int) and abs(u - t_all[1]) <= 1)
        post_near = " ".join(f"{u:+d}:{series['postsplit'][u][0]:+.4f}±{series['postsplit'][u][1]:.4f}(n={series['postsplit'][u][2]})"
                             for u in sorted(series["postsplit"])
                             if isinstance(t_post[1], int) and abs(u - t_post[1]) <= 1)
        # A post-split value is recorded separately only if it differs from
        # the all-occurrence value beyond the tolerance: in some bin between
        # the two thresholds the post-split mean must differ from the
        # all-occurrence mean by more than max(TOL, 2 SE of the difference).
        post_distinct = False
        post_gap = ""
        if isinstance(t_post[1], int) and isinstance(t_all[1], int) and t_post[1] != t_all[1]:
            gaps = []
            for tc in range(min(t_post[1], t_all[1]), max(t_post[1], t_all[1])):
                ps, al = series["postsplit"].get(tc), series["all"].get(tc)
                if ps and al:
                    diff = ps[0] - al[0]
                    se_d = math.sqrt(ps[1] ** 2 + al[1] ** 2)
                    gaps.append(f"{tc:+d}:{diff:+.4f}±{se_d:.4f}")
                    if abs(diff) > max(TOL, 2 * se_d):
                        post_distinct = True
            post_gap = " ".join(gaps)
        elif t_post[1] is not None and norm(t_post[1]) != norm(t_all[1]):
            post_distinct = True  # one side has a crossover inside the searched range, the other has none
        thr_rows.append([
            rules, cur, name, dev, alt, basic,
            t_state[0], t_state[1], t_all[0], t_all[1],
            t_orig2[1], t_direct[1],
            t_post[0] if t_post[0] is not None else "", t_post[1] if t_post[1] is not None else "",
            "yes" if post_distinct else ("no" if t_post[1] is not None else "n/a"),
            f"{multi_share:.4f}", f"{post_share:.4f}", f"{f_at:.4f}" if f_at is not None else "",
            "yes" if changed else "no", near, " | ".join(detail), post_near, post_gap,
        ])
        print(f"{rules} {cur:4s} {name:22s} two-card {str(t_state[1]):>4s}  all {str(t_all[1]):>4s}"
              f"{' CHANGED' if changed else '        '}  direct orig2 {str(t_orig2[1]):>4s} direct all {str(t_direct[1]):>4s}"
              f"  post-split {str(t_post[1]):>4s}  multi {multi_share:.3f} post {post_share:.3f}")
    with open(out_prefix + "_bins.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rules", "curriculum", "situation", "tc",
                    "pop_orig2", "pop_multi", "pop_split2", "pop_splitmulti", "f_nonorig",
                    "state_mean", "state_se", "state_n", "state_orig2_per_million_rounds",
                    "pop_orig2_per_million_rounds",
                    "orig2_mean", "orig2_se", "orig2_n", "nonorig_mean", "nonorig_se", "nonorig_n",
                    "postsplit_mean", "postsplit_se", "postsplit_n", "all_mean", "all_se",
                    "direct_all_mean", "direct_all_se", "direct_all_n"])
        w.writerows(bins_rows)
    with open(out_prefix + "_thresholds.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rules", "curriculum", "situation", "deviation", "alternative", "basic_side",
                    "two_card_raw", "two_card_tolerance", "all_raw", "all_tolerance",
                    "direct_orig2_tolerance", "direct_all_tolerance",
                    "postsplit_raw", "postsplit_tolerance", "postsplit_distinct",
                    "multi_card_share", "post_split_share", "nonorig_share_at_threshold",
                    "changed", "all_bins_near_threshold", "moved_bins_detail", "postsplit_bins_near_threshold",
                    "postsplit_minus_all_between_thresholds"])
        w.writerows(thr_rows)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "prepare":
        # prepare <glob> <sample.json> <comps.txt> <thresholds.csv,...> [cap_focus cap_focus_orig2 cap_other cap_tail seed]
        a = sys.argv[2:]
        prepare(a[0], a[1], a[2], a[3].split(","), *(int(x) for x in a[4:9]))
    elif cmd == "supplement":
        # supplement <glob> <old_sample.json> <sample.json> <comps.txt> <thresholds.csv,...> [radius cap_focus seed]
        a = sys.argv[2:]
        supplement(a[0], a[1], a[2], a[3], a[4].split(","), *(int(x) for x in a[5:8]))
    elif cmd == "aggregate":
        # aggregate <sample.json> <driver.csv[,driver2.csv]> <rules> <state_bins.csv> <out_prefix>
        a = sys.argv[2:]
        aggregate(a[0], a[1], a[2], a[3], a[4])
    else:
        sys.exit("unknown command")

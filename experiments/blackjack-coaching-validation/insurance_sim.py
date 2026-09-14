#!/usr/bin/env python3
"""Independent empirical check of the insurance index.

Simulates shoes under the accepted rules (reusing only the dealing/play code
of sample_shoe_states.py, not the calculator), and at every round where the
dealer shows an ace records the integer true count at the insurance decision
(exposed cards: other players' initial cards, the learner's two cards, the
ace; divisor from physical cards remaining after the hole card is dealt) and
whether the concealed hole card is ten-valued.  The insurance return per unit
insured is +2 if the hole card is a ten and -1 otherwise, so the empirical
mean return per bin is 3*P(ten | bin) - 1.

Usage:
    python3 insurance_sim.py --basic basic_S17_LS.csv --shoes 200000 --penetration 0.75 --players 0 --seed 5
"""
import argparse
import random
import sys
from collections import defaultdict

from sample_shoe_states import TAG, load_basic, play_round, true_count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--basic", required=True)
    ap.add_argument("--h17", type=int, default=0)
    ap.add_argument("--ls", type=int, default=1)
    ap.add_argument("--penetration", type=float, default=0.75)
    ap.add_argument("--players", type=int, default=0)
    ap.add_argument("--shoes", type=int, default=100000)
    ap.add_argument("--seed", type=int, default=5)
    args = ap.parse_args()
    table = load_basic(args.basic)
    rng = random.Random(args.seed)
    cut = int(312 * args.penetration)
    bins = defaultdict(lambda: [0, 0])  # tc -> [ace rounds, tens under]
    sign_bins = defaultdict(lambda: [0, 0])
    spots = 1 + args.players
    for _ in range(args.shoes):
        shoe = [c for c in range(1, 11) for _ in range(96 if c == 10 else 24)]
        rng.shuffle(shoe)
        dealt = 0
        while dealt < cut:
            # Peek at the cards the round will deal, in dealing order, without
            # altering the simulation: firsts, up, seconds, hole.
            n = len(shoe)
            firsts = shoe[n - 1:n - 1 - spots:-1]
            up = shoe[n - 1 - spots]
            seconds = shoe[n - 2 - spots:n - 2 - 2 * spots:-1]
            hole = shoe[n - 2 - 2 * spots]
            if up == 1:
                rc = -sum(TAG[c] for c in shoe)  # round-start RC (all dealt cards exposed)
                rc += sum(TAG[c] for c in firsts) + sum(TAG[c] for c in seconds) + TAG[up]
                physical = n - 2 * spots - 2
                tc = true_count(rc, physical)
                b = bins[tc]
                b[0] += 1
                b[1] += hole == 10
                sb = sign_bins[(tc, (rc > 0) - (rc < 0))]
                sb[0] += 1
                sb[1] += hole == 10
            play_round(shoe, table, bool(args.h17), bool(args.ls), spots, rng)
            dealt = 312 - len(shoe)
    print("tc,ace_rounds,tens_under,p_ten,insurance_ev,se")
    for tc in sorted(bins):
        n, k = bins[tc]
        p = k / n
        se = 3 * (p * (1 - p) / n) ** 0.5
        print(f"{tc},{n},{k},{p:.5f},{3 * p - 1:+.5f},{se:.5f}")
    for (tc, s) in sorted(sign_bins):
        if tc in (2, 3, 4):
            n, k = sign_bins[(tc, s)]
            print(f"# tc {tc:+d} rc sign {s:+d}: n={n} ev={3 * k / n - 1:+.5f}", file=sys.stderr)


if __name__ == "__main__":
    main()

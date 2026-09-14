#!/usr/bin/env python3
"""Independent Monte Carlo check of action values for one initial situation.

This simulator shares no code with the combinatorial calculator.  It deals a
fresh six-deck shoe minus the situation cards, draws the dealer hole card,
discards trials where the dealer has blackjack (values are conditioned on no
dealer blackjack, as in the calculator and in Wizard Appendix 9), executes the
requested initial action, continues with the supplied total-dependent table,
lets the dealer play S17/H17, and settles.

Rules: blackjack 3:2 (a split 21 is an ordinary 21); double any two cards;
double after split allowed except on split aces; split to at most four hands;
split aces receive one card each and cannot be resplit; no double for less.

Usage:
    python3 mc_check.py --continuation continuation_S17.csv --basic basic_S17_LS.csv \
        --h17 0 --hand 10,10 --up 5 --action P --resplit always --trials 10000000 --seed 1

--resplit always : resplit whenever a pair card is drawn (up to four hands);
                   this is the convention used by the combinatorial calculator
--resplit basic  : resplit only if the basic table prescribes P for that pair
--resplit never  : never resplit
Prints mean net return per original bet, standard error, and trials kept.
"""
import argparse
import csv
import random
import sys
from multiprocessing import Pool


def load_continuation(path):
    t = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            up = 1 if r["up"] == "A" else 10 if r["up"] == "T" else int(r["up"])
            t[(r["kind"], int(r["total"]), up)] = (r["action"], r["fallback"])
    return t


def load_pairs(path):
    t = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            if r["kind"] == "pair":
                t[(int(r["hand"]), int(r["up"]))] = r["action"]
    return t


def total_of(cards):
    t = sum(cards)
    if 1 in cards and t + 10 <= 21:
        return t + 10, True
    return t, False


def run(args_tuple):
    (cont, pairs, h17, c1, c2, up, action, resplit, trials, seed) = args_tuple
    rng = random.Random(seed)
    base = [c for c in range(1, 11) for _ in range(96 if c == 10 else 24)]
    for c in (c1, c2, up):
        base.remove(c)
    total = 0.0
    total_sq = 0.0
    kept = 0
    for _ in range(trials):
        shoe = base[:]
        rng.shuffle(shoe)
        hole = shoe.pop()
        if (up == 1 and hole == 10) or (up == 10 and hole == 1):
            continue
        kept += 1
        # hands: list of [cards, bet, from_split, split_aces, done]
        hands = [[[c1, c2], 1, False, False, False]]
        i = 0
        first = True
        while i < len(hands):
            h = hands[i]
            cards = h[0]
            while not h[4]:
                t, soft = total_of(cards)
                if t > 21:
                    h[4] = True
                    break
                if h[3]:  # split aces: one card only
                    h[4] = True
                    break
                two = len(cards) == 2
                if first:
                    act = action
                    first = False
                else:
                    is_pair = two and cards[0] == cards[1]
                    act = None
                    if is_pair and len(hands) < 4 and not (h[2] and cards[0] == 1):
                        if resplit == "always" or (resplit == "basic" and pairs[(cards[0], up)] == "P"):
                            act = "P"
                    if act is None:
                        a, fb = cont[("soft" if soft else "hard", t, up)]
                        if a == "D" and not two:
                            a = fb
                        act = a
                if act == "P":
                    c = cards[0]
                    aces = c == 1
                    hands[i] = [[c, shoe.pop()], 1, True, aces, False]
                    hands.insert(i + 1, [[c, shoe.pop()], 1, True, aces, False])
                    h = hands[i]
                    cards = h[0]
                    continue
                if act == "D":
                    cards.append(shoe.pop())
                    h[1] = 2
                    h[4] = True
                    break
                if act == "H":
                    cards.append(shoe.pop())
                    continue
                h[4] = True  # stand
            i += 1
        live = any(total_of(h[0])[0] <= 21 for h in hands)
        dcards = [up, hole]
        if live:
            while True:
                dt, dsoft = total_of(dcards)
                if dt < 17 or (h17 and dt == 17 and dsoft):
                    dcards.append(shoe.pop())
                else:
                    break
        dt, _ = total_of(dcards)
        net = 0.0
        for cards, bet, from_split, _, _ in hands:
            t, _ = total_of(cards)
            if t > 21:
                net -= bet
            elif dt > 21 or t > dt:
                net += bet
            elif t < dt:
                net -= bet
        total += net
        total_sq += net * net
    return total, total_sq, kept


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--continuation", required=True)
    ap.add_argument("--basic", required=True)
    ap.add_argument("--h17", type=int, default=0)
    ap.add_argument("--hand", required=True, help="c1,c2 with A=1, T=10")
    ap.add_argument("--up", type=int, required=True)
    ap.add_argument("--action", required=True, choices=["S", "H", "D", "P"])
    ap.add_argument("--resplit", default="always", choices=["always", "basic", "never"])
    ap.add_argument("--trials", type=int, default=1000000)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    cont = load_continuation(args.continuation)
    pairs = load_pairs(args.basic)
    c1, c2 = (int(x) for x in args.hand.split(","))
    per = args.trials // args.workers
    jobs = [(cont, pairs, bool(args.h17), c1, c2, args.up, args.action, args.resplit, per, args.seed * 1000 + k)
            for k in range(args.workers)]
    with Pool(args.workers) as pool:
        res = pool.map(run, jobs)
    total = sum(r[0] for r in res)
    total_sq = sum(r[1] for r in res)
    kept = sum(r[2] for r in res)
    mean = total / kept
    var = total_sq / kept - mean * mean
    se = (var / kept) ** 0.5
    print(f"{'H17' if args.h17 else 'S17'} {c1},{c2} vs {args.up} action {args.action} resplit {args.resplit}: "
          f"mean {mean:+.6f} se {se:.6f} kept {kept} of {per * args.workers}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Sample the learner's actual index-situation decisions (all occurrences).

Replays the accepted default configuration (six decks, cut card after
floor(312 * penetration) cards, the round reaching it finished, no burn,
learner in seat 1, every spot on the supplied total-dependent basic table,
no insurance, no index play) exactly as sample_shoe_states.py does, but
instead of recording round-start shoe compositions it records every decision
point at which the learner holds an index situation: hard total (or the two
pair situations, or the two supplementary soft hands) against the situation's
dealer up card.  Each occurrence is classified as

    orig2       original two-card hand,
    multi       original hand with three or more cards (reached by hitting),
    split2      post-split two-card hand (double allowed under DAS; no
                surrender; split aces never reach a decision),
    splitmulti  post-split hand with three or more cards.

For every occurrence the unseen pool (physical shoe plus the concealed hole
card, with the hand's cards and the up card still in it, which is the
composition farmer_driver --perline expects), the exposed-card running count,
the physical cards remaining and the accepted integer true count at that
moment are recorded.  Occurrences are counted per (situation, true count,
category) stratum and reservoir-sampled up to --cap per stratum, so the
sample can be reweighted to the full occurrence distribution.

Split hands are dealt sequentially: the hand being played receives its
second card, is played out, and only then does the next split hand receive
its second card, so the cards exposed at a post-split decision are the ones
a dealer would have turned up by then.  (sample_shoe_states.py deals both
second cards at once; the round-start distribution does not depend on the
order, only the post-split exposure does, by at most one card.)

Accepted true-count convention at the decision: RC = Hi-Lo tags of every
exposed card (everything dealt from the shoe except the concealed hole
card); divisor = physical cards remaining in the shoe to the nearest half
deck, ties upward, minimum 0.5; TC = trunc(RC / divisor).

Usage:
    python3 sample_decisions.py --basic basic_S17_LS.csv --h17 0 --ls 1 \
        --penetration 0.75 --players 0 --shoes 200000 --seed 201 \
        --cap 150 --out decisions_201.json
"""
import argparse
import json
import random
import sys

from sample_shoe_states import TAG, Hand, decide, divisor, load_basic, true_count

# Index situations, keyed by (kind, total-or-pair-rank, up card).  The
# "double" situations only have a decision on two-card hands; the "pair" and
# "soft" situations likewise.  Stand/hit situations occur with any number of
# cards.  Situation names follow evaluate_indices.SITUATIONS.
KEYS = {}
for total, ups in ((16, (8, 9, 10, 1)), (15, (9, 10, 1)), (14, (10,)), (13, (2, 3)),
                   (12, (2, 3, 4, 5, 6)), (17, (1,))):
    for up in ups:
        KEYS[("hard", total, up)] = "stand"
for total, ups in ((11, (1,)), (10, (10, 1)), (9, (2, 7)), (8, (6,))):
    for up in ups:
        KEYS[("hard", total, up)] = "double"
for up in (4, 5, 6):
    KEYS[("pair", 10, up)] = "pair"
    KEYS[("soft", 19, up)] = "double"  # A,8
KEYS[("soft", 17, 2)] = "double"  # A,6
KEYS[("pair", 8, 10)] = "pair"
KEYS[("pair", 8, 1)] = "pair"


def key_name(k):
    return f"{k[0]}{k[1]}v{k[2]}"


class Shoe:
    """Six-deck shoe dealt from the end of a shuffled list; keeps the counts
    of remaining cards and the Hi-Lo tags of everything dealt so far."""
    __slots__ = ("cards", "counts", "dealt_tags")

    def __init__(self, rng):
        self.cards = [c for c in range(1, 11) for _ in range(96 if c == 10 else 24)]
        rng.shuffle(self.cards)
        self.counts = [0] + [24] * 9 + [96]
        self.dealt_tags = 0

    def pop(self):
        c = self.cards.pop()
        self.counts[c] -= 1
        self.dealt_tags += TAG[c]
        return c

    def __len__(self):
        return len(self.cards)


class Recorder:
    def __init__(self, cap, rng):
        self.cap = cap
        self.rng = rng
        self.population = {}   # (key, tc, cat) -> count
        self.reservoir = {}    # (key, tc, cat) -> list of occurrences
        self.decisions = 0     # all learner decision points (any hand)

    def record(self, key, cat, shoe, hole, hand, up, num_hands):
        rc = shoe.dealt_tags - TAG[hole]  # the hole card is dealt but not exposed
        physical = len(shoe)
        tc = true_count(rc, physical)
        stratum = (key, tc, cat)
        n = self.population.get(stratum, 0) + 1
        self.population[stratum] = n
        bucket = self.reservoir.setdefault(stratum, [])
        if len(bucket) < self.cap:
            slot = len(bucket)
            bucket.append(None)
        else:
            j = self.rng.randrange(n)
            if j >= self.cap:
                return
            slot = j
        pool = list(shoe.counts)
        pool[hole] += 1
        pool[up] += 1
        for c in hand.cards:
            pool[c] += 1
        bucket[slot] = {"k": key_name(key), "tc": tc, "rc": rc, "phys": physical, "cat": cat,
                        "up": up, "cards": list(hand.cards), "pool": pool[1:], "nh": num_hands}


def classify(table, hand, up, num_hands):
    """Return the situation key for this decision point, or None."""
    two = len(hand.cards) == 2
    if two and hand.cards[0] == hand.cards[1]:
        c = hand.cards[0]
        can_split = num_hands < 4 and not (hand.from_split and c == 1)
        if can_split and ("pair", c, up) in KEYS:
            return ("pair", c, up)
        if can_split and table[("pair", c, up)]["action"] == "P":
            return None  # a split decision that is not an index situation
        # otherwise the pair is played as its total (7,7 vs T; 5,5; a pair at
        # the four-hand cap), exactly as the two-card compositions were
    if hand.soft:
        k = ("soft", hand.total, up)
    else:
        k = ("hard", hand.total, up)
    if k not in KEYS:
        return None
    if KEYS[k] == "double" and not two:
        return None  # no double on three or more cards: no decision to weigh
    return k


def play_round(shoe, table, h17, ls, players, rec):
    firsts = [shoe.pop() for _ in range(players)]
    up = shoe.pop()
    seconds = [shoe.pop() for _ in range(players)]
    hole = shoe.pop()
    hands = [[Hand([a, b])] for a, b in zip(firsts, seconds)]
    if (up == 1 and hole == 10) or (up == 10 and hole == 1):
        return
    for seat, spot in enumerate(hands):
        i = 0
        while i < len(spot):
            hand = spot[i]
            if len(hand.cards) == 1:  # second split hand waiting for its card
                hand.add(shoe.pop())
            if hand.total == 21 and len(hand.cards) == 2 and not hand.from_split:
                i += 1
                continue  # natural
            while True:
                if hand.total > 21 or hand.split_aces:
                    break
                if seat == 0 and hand.total < 21:
                    rec.decisions += 1
                    key = classify(table, hand, up, len(spot))
                    if key is not None:
                        cat = ("split" if hand.from_split else "orig") + ("2" if len(hand.cards) == 2 else "multi")
                        if cat == "origmulti":
                            cat = "multi"
                        rec.record(key, cat, shoe, hole, hand, up, len(spot))
                act = decide(table, hand, up, len(spot), ls, True)
                if act == "P":
                    c = hand.cards[0]
                    aces = c == 1
                    h1 = Hand([c, shoe.pop()], from_split=True, split_aces=aces)
                    h2 = Hand([c], from_split=True, split_aces=aces)
                    spot[i] = h1
                    spot.insert(i + 1, h2)
                    hand = h1
                    continue
                if act == "R":
                    hand.surrendered = True
                    break
                if act == "D":
                    hand.add(shoe.pop())
                    hand.doubled = True
                    break
                if act == "H":
                    hand.add(shoe.pop())
                    continue
                break  # stand
            i += 1
    live = any(h.total <= 21 and not h.surrendered for spot in hands for h in spot)
    if live:
        d = Hand([up, hole])
        while d.total < 17 or (h17 and d.total == 17 and d.soft):
            d.add(shoe.pop())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--basic", required=True)
    ap.add_argument("--h17", type=int, default=0)
    ap.add_argument("--ls", type=int, default=1)
    ap.add_argument("--penetration", type=float, default=0.75)
    ap.add_argument("--players", type=int, default=0, help="other players (0-4)")
    ap.add_argument("--shoes", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--cap", type=int, default=150, help="max sampled occurrences per (situation, TC, category)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    table = load_basic(args.basic)
    rng = random.Random(args.seed)
    rec = Recorder(args.cap, random.Random(args.seed + 1_000_000))
    cut = int(312 * args.penetration)
    rounds = 0
    for _ in range(args.shoes):
        shoe = Shoe(rng)
        while 312 - len(shoe) < cut:
            rounds += 1
            play_round(shoe, table, bool(args.h17), bool(args.ls), 1 + args.players, rec)
    occurrences = [o for s in sorted(rec.reservoir, key=lambda s: (s[0], s[1], s[2]))
                   for o in rec.reservoir[s] if o is not None]
    out = {
        "config": {
            "basic": args.basic, "h17": args.h17, "ls": args.ls, "penetration": args.penetration,
            "cut_card_after": cut, "other_players": args.players, "shoes": args.shoes,
            "rounds": rounds, "learner_decisions": rec.decisions, "seed": args.seed,
            "cap_per_stratum": args.cap,
            "note": "learner first to act, all spots on the supplied basic table, no insurance, "
                    "no index play; split hands dealt sequentially",
        },
        "population": {f"{key_name(k)}|{tc}|{cat}": n for (k, tc, cat), n in sorted(rec.population.items())},
        "occurrences": occurrences,
    }
    with open(args.out, "w") as f:
        json.dump(out, f)
    print(f"shoes {args.shoes} rounds {rounds} learner decisions {rec.decisions} "
          f"strata {len(rec.population)} sampled occurrences {len(occurrences)}", file=sys.stderr)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Sample round-start shoe compositions under the accepted True Count rules.

Simulates six-deck shoes with the learner (and optional other players) playing
the supplied total-dependent basic strategy, records the composition of the
physical shoe at the start of every round, and writes a stratified subsample
(by pre-round integer true count) together with the stratum population counts
needed to re-weight it.  The reweighted sample is an unbiased estimate of the
round-start composition distribution.

Accepted conventions implemented here (issue #3 final Answer):
  * six decks, no burn card, US hole card dealt face down before play,
    revealed at round end, so every card dealt in finished rounds is exposed;
  * running count = Hi-Lo tags of exposed cards (2-6:+1, 7-9:0, T/A:-1);
    at a round start all dealt cards are exposed, so RC = -sum(tags of cards
    remaining in the shoe);
  * divisor = physical cards remaining / 52 rounded to the nearest half deck,
    ties upward, minimum 0.5; true count = trunc(RC / divisor);
  * penetration P: the cut card sits after floor(312*P) cards; a round starts
    only while fewer cards than that have been dealt, and the round that
    reaches the cut card is finished before the shuffle;
  * dealer S17 or H17; late surrender on/off; double any two cards; DAS;
    split equal values including mixed tens to four hands; no resplit of
    aces; one card to split aces; no double on split aces; blackjack 3:2;
    insurance is never taken by basic-strategy players.

Usage:
    python3 sample_shoe_states.py --basic basic_S17_LS.csv --h17 0 --ls 1 \
        --penetration 0.75 --players 0 --shoes 100000 --seed 1 \
        --cap 1500 --out states_S17_LS_p75_n0.json

Output JSON: {"config": {...}, "strata": {tc: {"population": N, "sampled": n}},
"states": [{"tc": t, "cards": [A..T counts], "dealt": k}, ...]}.
"""
import argparse
import csv
import json
import random
import sys

TAG = {1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1}


def divisor(physical):
    return max(0.5, ((physical + 13) // 26) / 2)


def true_count(rc, physical):
    d = divisor(physical)
    q = rc / d
    return int(q)  # int() truncates toward zero


def load_basic(path):
    """Return dict keyed by (kind, hand, up) -> row dict.

    kind is hard/soft/pair; hand is the total for hard/soft and the pair rank
    for pairs; up 1..10.  Columns used: action (S/H/D/P/R),
    fallback_double (S/H), fallback_split_rule (S/H/D),
    fallback_split_balance (S/H/R), fallback_surrender (S/H/D/P).
    """
    table = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            table[(r["kind"], int(r["hand"]), int(r["up"]))] = r
    return table


class Hand:
    __slots__ = ("cards", "total", "soft", "from_split", "split_aces", "doubled", "surrendered", "bet")

    def __init__(self, cards, from_split=False, split_aces=False):
        self.cards = list(cards)
        self.from_split = from_split
        self.split_aces = split_aces
        self.doubled = False
        self.surrendered = False
        self.bet = 1
        self._recount()

    def _recount(self):
        t = sum(self.cards)
        soft = False
        if 1 in self.cards and t + 10 <= 21:
            t += 10
            soft = True
        self.total, self.soft = t, soft

    def add(self, c):
        self.cards.append(c)
        self._recount()


def decide(table, hand, up, num_hands, ls, allow_double):
    """Return one of S, H, D, P, R for the hand under the basic table."""
    two = len(hand.cards) == 2
    original = two and not hand.from_split
    can_surrender = ls and original
    can_double = two and allow_double and not hand.split_aces
    is_pair = two and (hand.cards[0] == hand.cards[1])
    can_split = is_pair and num_hands < 4 and not (hand.from_split and hand.cards[0] == 1)
    if hand.split_aces or hand.total >= 21:
        return "S"
    if is_pair:
        row = table[("pair", hand.cards[0], up)]
    elif hand.soft:
        row = table[("soft", hand.total, up)]
    else:
        row = table[("hard", hand.total, up)]
    a = row["action"]
    if a == "R":
        if can_surrender:
            return "R"
        a = row["fallback_surrender"]
    if a == "P":
        if can_split:
            return "P"
        a = row["fallback_split_rule"]
    if a == "D":
        if can_double:
            return "D"
        a = row["fallback_double"]
    return a


def play_round(shoe, table, h17, ls, players, rng):
    """Play one round; deal from the end of shoe (a list).

    players: number of player spots (learner in seat 1 + others), all on
    basic strategy.  Returns the initial two cards of every other spot (the
    cards exposed at the learner's decision besides the learner's own hand
    and the dealer's up card).
    """
    firsts = [shoe.pop() for _ in range(players)]
    up = shoe.pop()
    seconds = [shoe.pop() for _ in range(players)]
    hole = shoe.pop()
    hands = [[Hand([a, b])] for a, b in zip(firsts, seconds)]
    others = [c for spot in hands[1:] for c in spot[0].cards]
    dealer_bj = (up == 1 and hole == 10) or (up == 10 and hole == 1)
    if dealer_bj:
        return others  # all hands settle immediately; every card is exposed at round end
    for spot in hands:
        i = 0
        while i < len(spot):
            hand = spot[i]
            if hand.total == 21 and len(hand.cards) == 2 and not hand.from_split:
                i += 1
                continue  # natural
            while True:
                if hand.total > 21:
                    break
                if hand.split_aces:
                    break
                act = decide(table, hand, up, len(spot), ls, True)
                if act == "P":
                    c = hand.cards[0]
                    aces = c == 1
                    h1 = Hand([c, shoe.pop()], from_split=True, split_aces=aces)
                    h2 = Hand([c, shoe.pop()], from_split=True, split_aces=aces)
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
    # Dealer plays if any hand is live.
    live = any(h.total <= 21 and not h.surrendered for spot in hands for h in spot)
    if live:
        d = Hand([up, hole])
        while d.total < 17 or (h17 and d.total == 17 and d.soft):
            d.add(shoe.pop())
    return others


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--basic", required=True)
    ap.add_argument("--h17", type=int, default=0)
    ap.add_argument("--ls", type=int, default=1)
    ap.add_argument("--penetration", type=float, default=0.75)
    ap.add_argument("--players", type=int, default=0, help="other players (0-4)")
    ap.add_argument("--shoes", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--cap", type=int, default=1500, help="max sampled states per TC stratum")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    table = load_basic(args.basic)
    rng = random.Random(args.seed)
    cut = int(312 * args.penetration)
    population = {}
    reservoir = {}  # tc -> list of states (reservoir sampling per stratum)
    rounds = 0
    for s in range(args.shoes):
        shoe = [c for c in range(1, 11) for _ in range(96 if c == 10 else 24)]
        rng.shuffle(shoe)
        dealt = 0
        while dealt < cut:
            # record round-start state
            counts = [0] * 11
            for c in shoe:
                counts[c] += 1
            physical = len(shoe)
            rc = -sum(TAG[c] * counts[c] for c in range(1, 11))
            tc = true_count(rc, physical)
            population[tc] = population.get(tc, 0) + 1
            n = population[tc]
            state = {"tc": tc, "rc": rc, "dealt": dealt, "cards": counts[1:]}
            bucket = reservoir.setdefault(tc, [])
            if len(bucket) < args.cap:
                bucket.append(state)
                slot = len(bucket) - 1
            else:
                j = rng.randrange(n)
                slot = j if j < args.cap else None
                if slot is not None:
                    bucket[slot] = state
            rounds += 1
            others = play_round(shoe, table, bool(args.h17), bool(args.ls), 1 + args.players, rng)
            if slot is not None:
                state["others"] = others
            dealt = 312 - len(shoe)
    states = [st for tc in sorted(reservoir) for st in reservoir[tc]]
    out = {
        "config": {
            "basic": args.basic, "h17": args.h17, "ls": args.ls,
            "penetration": args.penetration, "cut_card_after": cut,
            "other_players": args.players, "shoes": args.shoes, "rounds": rounds,
            "seed": args.seed, "cap_per_stratum": args.cap,
            "note": "learner is first to act; all spots play the supplied basic table; no insurance",
        },
        "strata": {str(tc): {"population": population[tc], "sampled": len(reservoir[tc])}
                   for tc in sorted(population)},
        "states": states,
    }
    with open(args.out, "w") as f:
        json.dump(out, f)
    print(f"shoes {args.shoes} rounds {rounds} sampled states {len(states)}", file=sys.stderr)
    for tc in sorted(population):
        print(f"  tc {tc:+d}: population {population[tc]} sampled {len(reservoir[tc])}", file=sys.stderr)


if __name__ == "__main__":
    main()

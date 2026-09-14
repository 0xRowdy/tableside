#!/usr/bin/env python3
"""Compare the generated total-dependent basic tables with two published
teaching sources, cell by cell.

Source 1: Wizard of Odds, "4-8 deck" basic strategy text instructions
    https://wizardofodds.com/games/blackjack/strategy/4-decks/ (retrieved
    2026-09-14), separate S17 and H17 lists, DAS variant.
Source 2: Blackjack Apprenticeship S17/H17 deviation charts (2018 PDFs)
    https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_S17.pdf
    https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf
    Only the *basic* meaning of each cell is compared here (an index cell is
    read as its base action; index thresholds are compared separately).

Usage: python3 compare_basic_sources.py basic_S17_LS.csv basic_H17_LS.csv
"""
import csv
import sys

UPS = list(range(2, 11)) + [1]


def wizard(rules, kind, hand, up, ls=True):
    """Return (action, fallback_double) per Wizard's instructions."""
    h17 = rules == "H17"
    if kind == "pair":
        c = hand
        # surrender first
        if ls and h17 and c == 8 and up == 1:
            return "R", None
        if c == 1 or c == 8:
            return "P", None
        if c in (2, 3) and up in (2, 3, 4, 5, 6, 7):
            return "P", None
        if c == 4 and up in (5, 6):
            return "P", None
        if c == 6 and up in (2, 3, 4, 5, 6):
            return "P", None
        if c == 7 and up in (2, 3, 4, 5, 6, 7):
            return "P", None
        if c == 9 and up in (2, 3, 4, 5, 6, 8, 9):
            return "P", None
        if c == 10:
            return "S", None
        if c == 1:
            return "P", None
        # otherwise play as the hard/soft total
        return wizard(rules, "hard", 2 * c, up, ls)
    if kind == "hard":
        t = hand
        if ls:
            if t == 16 and up in (9, 10, 1):
                return "R", None
            if t == 15 and up == 10:
                return "R", None
            if h17 and t == 15 and up == 1:
                return "R", None
            if h17 and t == 17 and up == 1:
                return "R", None
        if t == 9 and up in (3, 4, 5, 6):
            return "D", "H"
        if t == 10 and up in range(2, 10):
            return "D", "H"
        if t == 11 and (up in range(2, 11) or (h17 and up == 1)):
            return "D", "H"
        if t >= 17:
            return "S", None
        if t == 12:
            return ("S" if up in (4, 5, 6) else "H"), None
        if 13 <= t <= 16:
            return ("S" if up in (2, 3, 4, 5, 6) else "H"), None
        return "H", None
    # soft
    t = hand
    if t in (13, 14) and up in (5, 6):
        return "D", "H"
    if t in (15, 16) and up in (4, 5, 6):
        return "D", "H"
    if t == 17 and up in (3, 4, 5, 6):
        return "D", "H"
    if t == 18 and (up in (3, 4, 5, 6) or (h17 and up == 2)):
        return "D", "S"
    if t == 19 and h17 and up == 6:
        return "D", "S"
    if t == 18:
        return ("H" if up in (9, 10, 1) else "S"), None
    if t >= 19:
        return "S", None
    return "H", None


# BJA 2018 charts, base actions (index cells read as their base action).
BJA_PAIRS = {  # rank -> up -> Y / N / YN (split only with DAS)
    1: dict.fromkeys(UPS, "Y"), 8: dict.fromkeys(UPS, "Y"),
    10: dict.fromkeys(UPS, "N"), 5: dict.fromkeys(UPS, "N"),
    9: {**dict.fromkeys(UPS, "N"), **dict.fromkeys([2, 3, 4, 5, 6, 8, 9], "Y")},
    7: {**dict.fromkeys(UPS, "N"), **dict.fromkeys([2, 3, 4, 5, 6, 7], "Y")},
    6: {**dict.fromkeys(UPS, "N"), 2: "YN", **dict.fromkeys([3, 4, 5, 6], "Y")},
    4: {**dict.fromkeys(UPS, "N"), 5: "YN", 6: "YN"},
    3: {**dict.fromkeys(UPS, "N"), 2: "YN", 3: "YN", **dict.fromkeys([4, 5, 6, 7], "Y")},
    2: {**dict.fromkeys(UPS, "N"), 2: "YN", 3: "YN", **dict.fromkeys([4, 5, 6, 7], "Y")},
}
BJA_SOFT = {  # total -> up -> symbol (base action; index cells noted)
    20: dict.fromkeys(UPS, "S"),
    19: {**dict.fromkeys(UPS, "S")},  # 4:3+, 5:1+, 6:1+ (S17) / 0- (H17) are index cells
    18: {**dict.fromkeys([2, 3, 4, 5, 6], "Ds"), 7: "S", 8: "S", 9: "H", 10: "H", 1: "H"},
    17: {2: "H", **dict.fromkeys([3, 4, 5, 6], "D"), **dict.fromkeys([7, 8, 9, 10, 1], "H")},  # 2 is 1+
    16: {**dict.fromkeys(UPS, "H"), **dict.fromkeys([4, 5, 6], "D")},
    15: {**dict.fromkeys(UPS, "H"), **dict.fromkeys([4, 5, 6], "D")},
    14: {**dict.fromkeys(UPS, "H"), **dict.fromkeys([5, 6], "D")},
    13: {**dict.fromkeys(UPS, "H"), **dict.fromkeys([5, 6], "D")},
}
BJA_HARD_COMMON = {
    17: dict.fromkeys(UPS, "S"),
    16: {**dict.fromkeys([2, 3, 4, 5, 6], "S"), **dict.fromkeys([7, 8, 9, 10, 1], "H")},  # 9:4+, T:0+, A:3+(H17)
    15: {**dict.fromkeys([2, 3, 4, 5, 6], "S"), **dict.fromkeys([7, 8, 9, 10, 1], "H")},  # T:4+, A:5+(H17)
    14: {**dict.fromkeys([2, 3, 4, 5, 6], "S"), **dict.fromkeys([7, 8, 9, 10, 1], "H")},
    13: {**dict.fromkeys([2, 3, 4, 5, 6], "S"), **dict.fromkeys([7, 8, 9, 10, 1], "H")},  # 2:-1-
    12: {2: "H", 3: "H", 4: "S", 5: "S", 6: "S", **dict.fromkeys([7, 8, 9, 10, 1], "H")},  # 2:3+ 3:2+ 4:0-
    11: dict.fromkeys(UPS, "D"),  # S17: A is 1+ (base H)
    10: {**dict.fromkeys(range(2, 10), "D"), 10: "H", 1: "H"},  # T:4+, A:4+/3+
    9: {2: "H", **dict.fromkeys([3, 4, 5, 6], "D"), **dict.fromkeys([7, 8, 9, 10, 1], "H")},  # 2:1+, 7:3+
    8: dict.fromkeys(UPS, "H"),  # 6:2+
}
BJA_SURRENDER = {  # (rules) -> set of (total, up) with base surrender
    "S17": {(16, 9), (16, 10), (16, 1), (15, 10)},
    "H17": {(16, 9), (16, 10), (16, 1), (15, 10), (17, 1)},  # 15 vs A is "-1+" (index), 8,8 vs A is Y (split)
}


def bja(rules, kind, hand, up):
    if kind == "pair":
        y = BJA_PAIRS[hand][up]
        if y in ("Y", "YN"):
            return "P"
        if hand == 10:
            return "S"
        return bja(rules, "hard", 2 * hand, up)
    if kind == "soft":
        s = BJA_SOFT[hand][up]
        return s
    if (hand, up) in BJA_SURRENDER[rules]:
        return "R"
    if hand >= 17:
        return "S"
    if hand < 8:
        return "H"
    s = BJA_HARD_COMMON[hand][up]
    if rules == "S17" and hand == 11 and up == 1:
        s = "H"
    return s


def load(path):
    rows = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            rows[(r["kind"], int(r["hand"]), int(r["up"]))] = r
    return rows


def sym(r):
    a = r["action"]
    if a == "D":
        return "Ds" if r["fallback_double"] == "S" else "D"
    return a


def main():
    for path in sys.argv[1:]:
        rows = load(path)
        rules = "H17" if "H17" in path else "S17"
        ls = "noLS" not in path
        print(f"== {path} ({rules}, LS={ls})")
        wd = bd = n = 0
        for (kind, hand, up), r in sorted(rows.items()):
            if kind == "hard" and (hand < 5 or hand > 19):
                continue
            if kind == "soft" and hand < 13:
                continue
            n += 1
            mine = sym(r)
            w_a, w_fb = wizard(rules, kind, hand, up, ls)
            w = ("Ds" if w_fb == "S" else w_a) if w_a == "D" else w_a
            if mine != w:
                wd += 1
                print(f"   WIZARD differs: {kind} {hand} vs {up}: generated {mine}, wizard {w}, margin {float(r['margin']):.6f}")
            if ls:
                b = bja(rules, kind, hand, up)
                if mine != b:
                    bd += 1
                    print(f"   BJA differs:    {kind} {hand} vs {up}: generated {mine}, BJA base {b}, margin {float(r['margin']):.6f}")
        print(f"   {n} cells: {wd} differ from Wizard, {bd if ls else 'n/a'} differ from BJA base")


if __name__ == "__main__":
    main()

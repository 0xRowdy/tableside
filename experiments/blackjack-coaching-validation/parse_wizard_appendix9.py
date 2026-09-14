#!/usr/bin/env python3
"""Parse Wizard of Odds Blackjack Appendix 9 (six decks, resplit to four)
into CSV so the values can be compared numerically.

Usage:
    python3 parse_wizard_appendix9.py <s17.html> <h17.html> <out.csv>

The HTML files are the pages
    https://wizardofodds.com/games/blackjack/appendix/9/6ds17r4/
    https://wizardofodds.com/games/blackjack/appendix/9/6dh17r4/
saved with curl.  Output columns:
    rules,up,c1,c2,stand,hit,double,split_nodas,split_das,probability
with up and cards as integers (ace = 1, ten-value = 10).
"""
import csv
import sys
from html.parser import HTMLParser


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.cur, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.cur = []
        elif tag == "tr" and self.cur is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_endtag(self, tag):
        if tag == "table" and self.cur is not None:
            self.tables.append(self.cur)
            self.cur = None
        elif tag == "tr" and self.row is not None:
            self.cur.append(self.row)
            self.row = None
        elif tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)


def card(s):
    return 1 if s == "A" else 10 if s in ("T", "10") else int(s)


def parse(path, rules, out):
    p = TableParser()
    p.feed(open(path, encoding="utf-8", errors="replace").read())
    assert len(p.tables) >= 2, path
    non_pair, pair = p.tables[0], p.tables[1]
    assert non_pair[0][:5] == ["Dealer", "Player", "Stand", "Hit", "Double"], non_pair[0]
    assert pair[0][:7] == ["Dealer", "Player", "Stand", "Hit", "Double",
                           "Split (DAS=No)", "Split (DAS=Yes)"], pair[0]
    for r in non_pair[1:]:
        up = card(r[0])
        a, b = (card(x) for x in r[1].split(","))
        c1, c2 = min(a, b), max(a, b)
        out.writerow([rules, up, c1, c2, r[2], r[3], r[4], "", "", r[5]])
    for r in pair[1:]:
        up = card(r[0])
        a, b = (card(x) for x in r[1].split(","))
        assert a == b
        out.writerow([rules, up, a, a, r[2], r[3], r[4], r[5], r[6], r[7]])


def main():
    s17, h17, dest = sys.argv[1:4]
    with open(dest, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rules", "up", "c1", "c2", "stand", "hit", "double",
                    "split_nodas", "split_das", "probability"])
        parse(s17, "S17", w)
        parse(h17, "H17", w)


if __name__ == "__main__":
    main()

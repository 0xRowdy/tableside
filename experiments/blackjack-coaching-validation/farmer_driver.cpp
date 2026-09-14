// farmer_driver.cpp -- research driver over Eric Farmer's GPL blackjack
// calculator (https://github.com/possibly-wrong/blackjack, commit
// a1f7dbb74266fb39296292bdff568b076120a61c).  The calculator source is NOT
// vendored into this repository; see README.md for the build command.
//
// Reads shoe compositions from stdin, one per line:
//     <id> <A> <2> <3> <4> <5> <6> <7> <8> <9> <T>
// where the ten integers are the counts of UNSEEN cards (physical shoe plus
// the concealed dealer hole card) before the player's hand and the dealer's
// up card are removed.  For every two-card player hand (c1 <= c2) and every
// dealer up card it prints, conditioned on no dealer blackjack:
//     id,c1,c2,up,stand,hit,double,split
// with split empty for non-pairs.  Values are expected net return per
// original wager.  Surrender is not printed because it is the constant -0.5
// under late surrender after a negative peek.
//
// Options:
//   --h17            dealer hits soft 17 (default: stands)
//   --mode M         post-split / post-hit continuation for the calculator's
//                    "maximize expected value" option:
//                      cdz  = CDZ- (pre-split composition-dependent optimal
//                             strategy re-applied to split hands; default)
//                      cdp1 = CDP1 (post-split strategy optimized with one
//                             pair card removed, then reused)
//                      cdp  = CDP  (post-split strategy re-optimized for each
//                             number of pair cards removed)
//                      tdb  = fixed total-dependent basic continuation read
//                             from --table (see below); post-hit and
//                             post-split hands follow that table instead of
//                             composition-dependent optimization
//   --table FILE     CSV of total-dependent basic actions used by mode tdb.
//                    Rows: kind,total,up,action,fallback_no_double where kind
//                    is hard|soft, action/fallback in {S,H,D}.
//   --hands FILE     optional list of "c1 c2 up" triples to print instead of
//                    every hand (still one full calculator build per shoe).
//   --nodas          disable doubling after splitting (used only to compare
//                    with the comparator's DAS=No column; launch rules use DAS)
//   --dealer         reserved; currently prints nothing extra.
#include "blackjack.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <map>
#include <fstream>
#include <sstream>

namespace {

struct TdbTable {
    // key: (soft?1:0)*1000 + total*10 + upCard  -> pair<action, fallback>
    std::map<int, std::pair<char, char> > cells;
    bool loaded = false;
    static int key(bool soft, int total, int up) {
        return (soft ? 1000 : 0) + total * 10 + up;
    }
    void load(const char *path) {
        std::ifstream in(path);
        std::string line;
        while (std::getline(in, line)) {
            if (line.empty() || line[0] == '#' || line.rfind("kind", 0) == 0) continue;
            std::stringstream ss(line);
            std::string kind, total, up, action, fallback;
            std::getline(ss, kind, ',');
            std::getline(ss, total, ',');
            std::getline(ss, up, ',');
            std::getline(ss, action, ',');
            std::getline(ss, fallback, ',');
            int u = (up == "A") ? 1 : (up == "T") ? 10 : atoi(up.c_str());
            if (u < 1 || u > 10) { std::fprintf(stderr, "bad up card in table: %s\n", up.c_str()); exit(2); }
            cells[key(kind == "soft", atoi(total.c_str()), u)] =
                std::make_pair(action.empty() ? 'H' : action[0],
                               fallback.empty() ? 'H' : fallback[0]);
        }
        loaded = true;
    }
};

// Fixed total-dependent continuation strategy.  BJPlayer consults this for
// hands reached after a hit or a split (never for the initial hand whose
// values are being reported), so the reported stand/hit/double/split values
// assume the learner continues with the taught total-dependent table.
class TdbStrategy : public BJStrategy {
public:
    TdbStrategy(const TdbTable &t) : BJStrategy(true, true), table(t) {}
    int getOption(const BJHand &hand, int upCard, bool doubleDown,
                  bool split, bool surrender) override {
        int total = hand.getCount();
        bool soft = hand.getSoft();
        if (total >= 21) return BJ_STAND;
        std::map<int, std::pair<char, char> >::const_iterator it =
            table.cells.find(TdbTable::key(soft, total, upCard));
        if (it == table.cells.end()) {
            // Totals outside the table (hard 4 as 2,2 post-split, hard 20 as
            // T,T post-split, hard 18/19/20 etc.) : stand on hard 17+ and
            // soft 19+, otherwise hit.  These cells are also emitted by the
            // generator, so this branch is only a defensive default.
            if (!soft && total >= 17) return BJ_STAND;
            if (soft && total >= 19) return BJ_STAND;
            return BJ_HIT;
        }
        char a = it->second.first;
        if (a == 'D') {
            if (doubleDown) return BJ_DOUBLE_DOWN;
            a = it->second.second;
        }
        return a == 'S' ? BJ_STAND : BJ_HIT;
    }
private:
    const TdbTable &table;
};

}  // namespace

int main(int argc, char **argv) {
    bool h17 = false, printDealer = false, das = true;
    std::string mode = "cdz", tablePath, handsPath;
    for (int i = 1; i < argc; ++i) {
        if (!strcmp(argv[i], "--h17")) h17 = true;
        else if (!strcmp(argv[i], "--nodas")) das = false;
        else if (!strcmp(argv[i], "--dealer")) printDealer = true;
        else if (!strcmp(argv[i], "--mode") && i + 1 < argc) mode = argv[++i];
        else if (!strcmp(argv[i], "--table") && i + 1 < argc) tablePath = argv[++i];
        else if (!strcmp(argv[i], "--hands") && i + 1 < argc) handsPath = argv[++i];
        else { std::fprintf(stderr, "unknown argument %s\n", argv[i]); return 2; }
    }
    TdbTable table;
    if (mode == "tdb") {
        if (tablePath.empty()) { std::fprintf(stderr, "--mode tdb needs --table\n"); return 2; }
        table.load(tablePath.c_str());
    }
    std::vector<std::vector<int> > hands;
    if (!handsPath.empty()) {
        std::ifstream in(handsPath);
        int a, b, u;
        while (in >> a >> b >> u) { std::vector<int> v; v.push_back(a); v.push_back(b); v.push_back(u); hands.push_back(v); }
    }

    // Accepted launch rules: double any two cards, DAS, resplit non-aces to
    // four hands, no resplit aces, no double for less.  Late surrender is
    // handled outside the calculator (constant -0.5 after a negative peek).
    BJRules rules(h17, /*doubleAnyTotal*/ true, /*double9*/ true,
                  /*doubleSoft*/ true, /*doubleAfterHit*/ false,
                  /*doubleAfterSplit*/ das, /*resplit*/ true,
                  /*resplitAces*/ false, /*lateSurrender*/ false, 1.5);
    BJStrategy *strategy;
    if (mode == "cdz") strategy = new BJStrategy(true, true);
    else if (mode == "cdp1") strategy = new BJStrategy(false, true);
    else if (mode == "cdp") strategy = new BJStrategy(false, false);
    else if (mode == "tdb") strategy = new TdbStrategy(table);
    else { std::fprintf(stderr, "unknown mode %s\n", mode.c_str()); return 2; }
    BJProgress progress;

    std::printf("id,c1,c2,up,stand,hit,double,split\n");
    char line[4096];
    BJPlayer *player = 0;
    while (std::fgets(line, sizeof line, stdin)) {
        std::string id;
        int cards[11];
        std::stringstream ss(line);
        if (!(ss >> id)) continue;
        if (id[0] == '#') continue;
        bool ok = true;
        for (int c = 1; c <= 10; ++c) if (!(ss >> cards[c])) ok = false;
        if (!ok) { std::fprintf(stderr, "bad line: %s", line); continue; }
        BJShoe shoe(cards);
        if (!player) player = new BJPlayer(shoe, rules, *strategy, progress);
        else player->reset(shoe, rules, *strategy, progress);
        if (printDealer) {
            // Not needed for the report; reserved for future checks.
        }
        if (!hands.empty()) {
            for (size_t k = 0; k < hands.size(); ++k) {
                int c1 = hands[k][0], c2 = hands[k][1], u = hands[k][2];
                if (cards[c1] < 1 || cards[c2] < (c1 == c2 ? 2 : 1) ||
                    cards[u] < 1 + (u == c1) + (u == c2)) continue;
                BJHand h; h.deal(c1); h.deal(c2);
                std::printf("%s,%d,%d,%d,%.9f,%.9f,%.9f,", id.c_str(), c1, c2, u,
                    player->getValueStand(h, u), player->getValueHit(h, u),
                    player->getValueDoubleDown(h, u));
                if (c1 == c2) std::printf("%.9f", player->getValueSplit(c1, u));
                std::printf("\n");
            }
            continue;
        }
        for (int c1 = 1; c1 <= 10; ++c1)
        for (int c2 = c1; c2 <= 10; ++c2)
        for (int u = 1; u <= 10; ++u) {
            int need1 = (c1 == c2 ? 2 : 1) + (u == c1 ? 1 : 0);
            if (cards[c1] < need1) continue;
            if (c1 != c2 && cards[c2] < 1 + (u == c2 ? 1 : 0)) continue;
            if (cards[u] < 1) continue;
            BJHand h; h.deal(c1); h.deal(c2);
            std::printf("%s,%d,%d,%d,%.9f,%.9f,%.9f,", id.c_str(), c1, c2, u,
                player->getValueStand(h, u), player->getValueHit(h, u),
                player->getValueDoubleDown(h, u));
            if (c1 == c2) std::printf("%.9f", player->getValueSplit(c1, u));
            std::printf("\n");
        }
        std::fflush(stdout);
    }
    delete player;
    delete strategy;
    return 0;
}

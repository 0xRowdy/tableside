# Table chrome: one summary row, details on tap, actions pinned

Accepted 2026-11-18. The owner approved the frames and asked for the same chrome at every table. The 2026-11-18 design critique (`.impeccable/critique/2026-11-18T20-48-40Z__apps-mobile-src.md`, a P1 table item downgraded to P2 after the frames were checked) found up to eight bars stacked above the blackjack felt in guided and counting modes. The frames came first, then the code.

## Frames

In `design/Tableside.pen`. The replaced frames are renamed `[Superseded] … replaced by <id>`.

| Screen | Frames |
| --- | --- |
| S1-04 blackjack | `jvB3q` table · `iIMaW` details sheet · `cLNnU` Larger · `S2tO2R` Larger with the largest system text · `BUM93` count supplied |
| S1-04 craps, roulette | `AA0wT`, `Md7NV` craps · `KZ583`, `dbUaa` roulette |
| S5-11 guided | `xIl3L` time · `fdvW8` turns · `QpbRF` training bankroll · `dDlp9` premium · `p44ug` details sheet |
| S3-07 table counting | `J1nPeT` checkpoint · `e2edPR` Observe · `dFfnT` details sheet |

## Rules

1. **Three things above the felt.** The top bar shows the game and mode (`Blackjack · Guided`, `Table counting · Check`) and one status line in Linen. Under it are the phase bars, which have no labels; screen readers still read "Step 3 of 4, Play". Then one summary row.
2. **At most three figures in the summary row.** The two money figures come first (Session balance and On table, or Attempt balance or Your seat, and Round). The third is the mode figure: the supplied true count, Decks left when counting, roulette's last spin with its color word, or the allowance figure (Left today, Turns left) when the policy sends one. A table figure takes precedence over the allowance figure.
3. **The whole row opens Table details.** Its button is a chevron, or a labelled "Table details" row when the row turns into key–value rows. The sheet holds the allowance sentence, the guided strategy with adherence, Departures and Stop strategy, Rebuy, the supplied count's working, the counting aid (Show running count), house edge and the rules.
4. **Actions are pinned above the tab bar.** The felt scrolls in the space between. When pinning would leave less than 120 pt for the felt, the actions unpin and the screen scrolls as one. Rotation and resizing keep the same component tree, so typed input survives. Landscape keeps the side-by-side columns.
5. **Key–value rows only when the row doesn't fit.** The summary row stays one row at Larger with the default system size. It turns into key–value rows once the system font scale passes 1.35. This replaces "the session strip becomes key–value rows" in rule 10 of `text-size-type-floor.md`.
6. **Explanations become hints.** The reasons an action isn't available, and the late surrender explanation, are accessibility hints on the buttons. They are visible text only above font scale 1.35.
7. **Interrupting banners stay** under the summary row: save failed, suspension and access ended.

## House edge

The owner asked for a ruling, and this is it. The house edge leaves the always-visible chrome and becomes the first section of Table details after any guided or count sections, worded as before. A table still shows it, one tap away, and setup still shows it before play. The rules move into the sheet with it, because neither changes during a session. Per-bet edges stay where the bet is chosen: the craps Bet list, and roulette's "Edge … on this bet". The 2026-10-18 ruling that tables show the house edge stands; only its placement changes.

## Spec amendments to post

| Spec | Amendment |
| --- | --- |
| [#51](https://github.com/0xRowdy/tableside/issues/51) spec 1 | S1-04: the table chrome follows the rules above. The house edge and the rules move to Table details. Rebuy moves to Table details; the contextual rebuy prompts (S1-08) are unchanged. |
| [#53](https://github.com/0xRowdy/tableside/issues/53) spec 3 | S3-07: Decks left moves from the felt into the summary row. Show running count moves from under the keypad to Table details, with the same copy and warning. |
| [#55](https://github.com/0xRowdy/tableside/issues/55) spec 5 | S5-11: the allowance line becomes the summary row's third figure. The full sentence goes in Table details. Time still counts only active phases. |

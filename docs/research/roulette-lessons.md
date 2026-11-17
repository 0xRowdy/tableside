# Roulette lesson facts

Research date: 2026-11-17. For ticket #155 (spec #53): the six roulette lessons (basics, Flat even-money, Fixed two-dozen coverage, Capped Martingale, Three-win parlay, Bounded Labouchere).

Lesson copy may state only what this note records. Tableside's behavior is cited to the repo (`file:line` at commit `a36be99`, branch `ticket/155-roulette-lessons`). Every amount and outcome comes from the definitions or from an engine run (see [Engine verification](#engine-verification)). External pages are cited by exact URL and section heading. Earlier strategy research, with the derivations reused here, is in [roulette-strategies.md](roulette-strategies.md).

Player copy states stakes and caps as amounts ("cap of 320"), never as multiples of a base bet ([spec 1 Amendment 9 §7](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191)). The spec 1 body gives the strategies in units with a base unit of 10 (#51 body, *Built-in strategies* and *Exact money and limits*). The definitions hold the resulting amounts.

## Sources used

| Source | Exact location | Supports |
| --- | --- | --- |
| Tableside repo | Files and lines cited inline | All Tableside behavior, labels, amounts and limits |
| Spec 1 (#51) | Body: *Game rules › Roulette*, *Built-in strategies* table, *Funding, ending and results* bullets (Session funding, Rebuys, Ending, Results), *Exact money and limits*, *Random protocol*. Amendment 6 §2 ([comment](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6275071941)). Amendment 9 §§2, 6, 7 ([comment](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191)) | Payouts, full loss on zero, the five strategies' accepted behavior, funding rules, explicit cycle restarts in practice, inside bets via "Find by number", play pausing at a table limit, amounts not units |
| Spec 3 (#53) | Body: *Lessons and worked examples › Content requirements*. Amendment 1 C11 ([comment](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716)) | What each lesson must cover; content rules |
| [Built-in reference content rights](../decisions/built-in-reference-content-rights.md) | Q1, Q5 and the *Implementation guidance* section | Casino Quest is the owner's chosen roulette research source; cite exact video and timestamp; no implied authorship |
| Wizard of Odds, roulette basics | [wizardofodds.com/games/roulette/basics/](https://wizardofodds.com/games/roulette/basics/), sections *Introduction*, *American Rules*, *European Rules*, *French Rules*, *Triple-Zero Roulette*, *Betting Systems* | Pocket counts, payouts (dozens, not columns), house edges, la partage/en prison as other rules, zeros losing even-money bets, systems not overcoming the edge |
| Wizard of Odds, Martingale | [wizardofodds.com/gambling/martingale/](https://wizardofodds.com/gambling/martingale/), sections *Rules*, *What to Expect*, *Summary* | Published Martingale core and its edge statement |
| Wizard of Odds, Anti-Martingale | [wizardofodds.com/gambling/anti-martingale/](https://wizardofodds.com/gambling/anti-martingale/), sections *Rules*, *Simulation Results* | Published positive-progression core used for the parlay comparison |
| Wizard of Odds, Labouchere | [wizardofodds.com/gambling/labouchere/](https://wizardofodds.com/gambling/labouchere/), sections *Introduction*, *Rules*, *Simulation Results* | Published Labouchere core |
| Wizard of Odds, betting systems | [wizardofodds.com/gambling/betting-systems/](https://wizardofodds.com/gambling/betting-systems/), sections *Introduction*, *The Martingale* | General statement that staking systems don't change the edge |
| NJ DGE, N.J.A.C. 13:69F-5.2 | [CHAPTER69F.pdf, PDF pages 231–232](https://www.nj.gov/lps/ge/docs/Regulations/CHAPTER69F.pdf#page=231), §13:69F-5.2 "Roulette: payout odds" (a)–(c) | Regulated payout odds; zero rules on even-money bets |
| Casino Quest (YouTube) | Three videos with timestamps, listed under [Casino Quest](#casino-quest) | Payout odds (corroboration); Martingale return-to-first-unit; a two-dozen coverage pattern |

Fetched pages: all five Wizard of Odds pages above (fetched 2026-11-17; pages show "Last updated" Nov 17, 2026 for basics and Aug 03, 2026 for the other four). `https://wizardofodds.com/gambling/paroli/` returned HTTP 404, so no Paroli page from that site is cited. The NJ DGE PDF was downloaded and its text extracted with `pdftotext -layout`; §13:69F-5.2 begins on PDF page 231 and (c) is on page 232.

Wizard of Odds pages carry casino advertising. They are cited for rules and mathematics only. Neither Wizard of Odds nor Casino Quest authored, reviewed or approved Tableside's strategy catalog, and copy must not imply that they did ([#53 Amendment 1 C11](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6256389716)).

### Casino Quest

The ticket asks for Casino Quest sources where used. A search on 2026-11-17 verified the three videos below. For each, YouTube's oEmbed endpoint returned `author_name: "Casino Quest"` and `author_url: https://www.youtube.com/@CasinoQuest`. The timestamp content comes from YouTube's **automatic English captions**, which are machine-generated and contain transcription errors; quotes are copied as captioned. None of these videos has creator-written chapters.

| Video (exact title) | URL | Timestamp and verified content | Use |
| --- | --- | --- | --- |
| "Roulette Payouts! #roulette #casino #vegas #lasvegas #tips #tricks" (Short) | https://www.youtube.com/watch?v=6A-KsmmgiAg | 0:06–0:08 straight up "pays 35 to one"; 0:12–0:14 split "17 to one"; 0:16–0:18 street "pays eleven to one"; 0:22–0:24 corner "eight to one"; 0:26–0:28 double street (six numbers) "pays five to one"; 0:28–0:30 top line, five numbers, "pay six to one" | Corroborates inside-bet payouts. It does not cover outside bets |
| "WEIRDEST MARTINGALE SYSTEM - Will It Make You Money? \| Roulette System Review" | https://www.youtube.com/watch?v=cNwTcAR6xHM | 0:50–1:00: "it's a martingale but it's not full martingale so you don't double every time it has his own predetermined numbers and like old martingale you win one you go back to your first unit". 4:43–4:55: "martingale high-risk high-reward … there's more chances you can run ten hand loss in a row" | Supports only "a win goes back to the first unit" as Martingale's reset. The video's system is a different, dozen-based variant with its own stake list, not Tableside's |
| "GET THE MOST OUT OF PLAYING ROULETTE - Best System for Comps" | https://www.youtube.com/watch?v=hnuIqvrrYHQ | 1:01–1:21: a quarter each on the first and second dozen, plus a quarter each on two columns | Shows two-dozen coverage as part of a larger pattern. Tableside's Fixed two-dozen coverage (dozens only) is its own policy, not this system |

No Casino Quest video on Paroli/parlay/reverse Martingale, Labouchere, or a full "how to play roulette" lesson was found or verified. A channel-wide search for "labouchere" returned nothing, and "paroli", "parlay" and "reverse martingale" returned no roulette video. A blackjack Martingale review on the channel ("HIGH PROFIT RATIO?? - Martingale System Review - Your Systems, Our Thoughts! Ep.4", https://www.youtube.com/watch?v=ney9UpILMYQ, 1:57–1:59 "casinos have limits just for that purpose") is about blackjack, so the roulette lessons should not cite it. Lessons without a verified Casino Quest source cite Wizard of Odds and the regulator instead; never cite the channel as a whole.

## Wheels, payouts, house edge

**Wheels.** Single zero has 37 pockets (0, 1–36); double zero has 38 (0, 00, 1–36), with 00 a distinct pocket (#51 body, *Random protocol*; `packages/engine/src/roulette.ts:164-165`). The Wizard of Odds *American Rules* section describes "38 numbered slots: numbers 1 to 36, a zero, and a double zero", and *European Rules* "a 37-number wheel, with one zero only" ([basics](https://wizardofodds.com/games/roulette/basics/)). Red numbers are 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36; 0 and 00 are green (`packages/engine/src/roulette.ts:59-62`).

**Payouts (net, "to 1").** `packages/engine/src/roulette.ts:40-57`; spec 1 body, *Game rules › Roulette*; [NJ DGE §13:69F-5.2(a)](https://www.nj.gov/lps/ge/docs/Regulations/CHAPTER69F.pdf#page=231).

| Bet (app name) | Covers | Pays | Limit group |
| --- | --- | --- | --- |
| Straight up | 1 number | 35:1 | inside |
| Split | 2 | 17:1 | inside |
| Street; Trio | 3 | 11:1 | inside |
| Corner; First four (single zero only) | 4 | 8:1 | inside |
| Six line | 6 | 5:1 | inside |
| Five-number basket (0, 00, 1, 2, 3; double zero only) | 5 | 6:1 | inside |
| Dozen; Column | 12 | 2:1 | outside |
| Red or black; Odd or even; 1–18 or 19–36 | 18 | 1:1 | outside |

Names come from `apps/mobile/src/play/roulette-catalog.ts:23-41`; zero-adjacent placements per wheel are at `packages/engine/src/roulette.ts:66-86`; inside/outside grouping at `roulette.ts:93`. NJ DGE lists "Column 2 to 1" and "Dozen 2 to 1", red/black/odd/even/1 to 18/19 to 36 "1 to 1", and "First Five Numbers 6 to 1". The Wizard of Odds payout table lists the dozens at 2 and does not mention columns.

**Settlement.** A winning wager returns its stake plus stake × payout; a losing wager returns nothing (`packages/engine/src/roulette.ts:161-162, 290-313`). Engine run: 10 straight up on 17 when 17 lands settles `net 350, returned 360`.

**Zero.** In Tableside every outside bet loses in full on 0, and on 00 on the double-zero wheel. There is no la partage, en prison or half-loss (`roulette.ts:161-162`: a bet wins only if its covered pockets include the result; outside bets cover only 1–36, `roulette.ts:107-117`). Spec 1 user story 23 and *Game rules › Roulette*: "even-money bets lose fully on zero". The setup help says "Even-money bets lose in full when the ball lands on zero." (single zero) and "Even-money bets lose in full on 0 or 00. Adds the five-number basket." (double zero) (`apps/mobile/src/play/RouletteSetup.tsx:132-136`). The bet list labels each even-money pair "Pays 1:1 · loses on 0" or "… loses on 0 and 00" (`roulette-catalog.ts:18`). Engine runs: red 10 on 0 (single zero) and on 00 (double zero), and dozen-1 10 on 0, all settle `result loss, net -10, returned 0`.

Published rules differ by venue. NJ DGE §13:69F-5.2(b) lets a double-zero table choose to take "either one-half of each wager on red, black, odd, even, 1 to 18, and 19 to 36 or the entire wager" on 0 or 00; (c) says that on a single-zero wheel those wagers "shall be lost" on 0. Wizard of Odds *French Rules* describes la partage ("the player gets half the bet back") and en prison for even-money bets only. These are other rule sets. Tableside uses full loss on both wheels, and a lesson that mentions half-back rules must say Tableside doesn't use them.

**House edge** (definitions, `packages/definitions/src/roulette.ts:33-48`; spec 1 Amendment 1 §B):

| Wheel | Every bet except the basket | Five-number basket |
| --- | --- | --- |
| Single zero | 1/37 = 2.70% | not on this wheel |
| Double zero | 1/19 = 5.26% | 3/38 = 7.89% |

Wizard of Odds, *Introduction*: "On a double-zero wheel the house edge is 5.26% on every bet except the first five (0-00-1-2-3), which is 7.89%." *European Rules*: "with one zero the house edge is cut to 1/37, or 2.70%, on all bets." Setup shows "House edge on every bet: 2.70%." or "House edge on every bet: 5.26%, except the five-number basket: 7.89%." followed by "A property of this wheel's rules, not a prediction of your results." (`RouletteSetup.tsx:137-142`).

The engine's one-spin outcome table reproduces these figures. Summing probability × net over its outcome groups gives an expected net per unit wagered of −1/37 for red, two dozens and a straight up on single zero; −1/19 for the same bets on double zero; and −3/38 for the basket (output below).

## How Tableside's roulette table works

### Setup

Setup lives in `apps/mobile/src/play/RouletteSetup.tsx`.

- **Header:** "Roulette", subtitle "New session · free play" or "New session · guided practice" (`:116`).
- **HOW DO YOU WANT TO PLAY?** "Free play" or "Guided practice" (`:119-126`). Guided help: "Guided practice pauses before a move that departs from your strategy, so you can retry or override it." (`:127`). Free play has no required strategy; guided practice adds a selected strategy and corrections ([CONTEXT.md](../../CONTEXT.md) *Free play*, *Guided practice*).
- **WHEEL:** "Single zero (0)" or "Double zero (0, 00)" (`:44-47, 130-131`). The default is single zero (`:73`).
- **Strategy** (guided only): the five built-ins, plus the player's own (`:145-157`). Parameters use the definition labels: "Target" (Red, Black, Odd, Even, 1 to 18, 19 to 36; default Red), or "First dozen" / "Second dozen" (default 1st dozen and 2nd dozen). A dozen already taken by the other choice is disabled with "Already chosen for the other target" (`:197-228`; `packages/definitions/src/roulette-strategies.ts:18, 40-43, 61`).
- **TABLE LIMITS:** "Inside bets" and "Outside bets", "Per placement." (`:39-42, 159-167`). The defaults are **inside 1–100 and outside 10–1,000 per placement** (`packages/definitions/src/roulette.ts:5-8`; spec 1 body, *Exact money and limits*). There is no aggregate table cap (spec 1 body, *Exact money and limits*). Limits can be edited. A limit that blocks a strategy's opening bet makes setup incompatible: for example, Flat even-money with outside minimum 25 reports `below-minimum, limit 25` (engine run). A strategy whose later stakes can exceed the table maximum is accepted, and play pauses there ([Amendment 9 §6](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191); engine run with outside max 200 below).
- **BUY-IN:** "Starting chips for this session", default 1,000, help text "Each session starts fresh." or "Your last roulette buy-in. Each session starts fresh." (`apps/mobile/src/play/setup/Funding.tsx:21, 103-113`). The buy-in must be whole units from 1 to 1,000,000,000 (`Funding.tsx:25`; `packages/engine/src/funding.ts:3, 45-48`). If it can't cover the opening bets, setup shows "Too low for your strategy's opening bets (…)" or "Too low for the table's smallest bet (…)", plus a "Set buy-in to …" button (`Funding.tsx:88, 122-135`).
- **Start:** "Start free play" or "Start guided practice" (`RouletteSetup.tsx:172-177`).

### Table controls

Table controls live in `apps/mobile/src/play/RouletteTable.tsx` unless noted.

- **Top bar:** "Roulette", with a subtitle like "Single zero · inside 1–100 · outside 10–1,000", plus " · guided practice, {strategy}" when guided (`:36-43, 85`). The end-session control is labelled "End session" with hint "Asks before ending. Ending returns removable wagers and settles the rest." (`TableChrome.tsx:44-45`).
- **Phase stepper:** "Betting", "Spin", "Settle" (`:28-34`). **Status** words: "Betting", "Spinning", "Settled", "Strategy check", "Cycle ended", "Final settlement", "Ended" (`roulette-text.ts:63-72`). The session strip shows the balance and "On table" (`:87`).
- **View switch:** "Table" or "Bet list" (`bet-selector/Presentation.tsx:9-12`), the same session and draft in either view.
  - **Table** (graphical felt): tap a spot to add the selected chip. Chip values are 1, 5, 25, 100, 500 and 1K (`TableChrome.tsx:187-194`), and the default chip is 5 (`:50`). The felt carries straight-up numbers, the even-money spots, the three dozens ("1st 12", "2nd 12", "3rd 12") and the columns (`RouletteFelt.tsx:76-106`).
  - **Bet list** (the **bet selector**): splits, streets, trios, corners, six lines, first four and the basket are placed here through **"Find by number"**, "Every inside bet that covers a number" (`roulette-catalog.ts:112-121`; [Amendment 9 §2](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6307750191)). Sections are titled "Inside bets · 1 to 100" and "Outside bets · 10 to 1,000" (`roulette-catalog.ts:75, 92`). Each kind shows its payout, e.g. "1 number · pays 35:1".
  - **Bet list editor:** you enter the **total** stake ("The total for this wager, not an amount to add."), use −/+ steppers, and confirm with "Set {bet} to {amount}" (`BetSelector.tsx:243-287`). Until confirmed it reads "Draft · not placed yet." (`:45`).
  - **"Your wagers · N":** each wager is "Removable" (with "Edit" and "Remove") or "Committed" (with "Inspect" and "Why locked?") (`:327-352`). Wagers are committed from Spin until they settle: "Committed to this spin until it settles. It can't be changed or taken down." (`roulette-catalog.ts:138`). With nothing placed it shows "No wagers yet. Choose one above, set its stake, then spin." (`apps/mobile/src/play/game-words.ts`, roulette `noWagers`).
- **Buttons:** "Spin" (`:197`) and "Rebuy", with hint "Adds chips to this session. It counts as funding, not as a win." (`:198-207`).
- **Refused bets:** a refused bet changes nothing. Messages are "{bet} needs at least {min}. Nothing was placed.", "{bet} allows at most {max}. Nothing was placed.", "Your balance can't cover that. Nothing was placed. You can rebuy to add chips.", "Stakes are whole units. Nothing was placed." and, for Spin with nothing placed, "Place a wager before you spin." (`roulette-text.ts:74-95`; engine checks at `packages/engine/src/roulette.ts:266-288`). Engine runs at the default table: red 9 `below-minimum`, red 1,001 `above-maximum`, straight 17 at 101 `above-maximum`, straight 17 at 1 placed, red 10 placed; red 10 on a 5 buy-in `insufficient-funds`.

### Turn phases and settlement

1. **Betting** (`open-decision`, or `settled-outcome` after a spin): place, change or remove wagers, or rebuy (`packages/engine/src/activity.ts:412-416`).
2. **Spin** (`begin-turn`): the engine needs at least one wager (`roulette.ts:241-243`). It draws the pocket and the phase becomes `revealing-outcome` (`roulette.ts:334-345`). In guided practice a correction may come first (see below).
3. **Settle:** the app settles automatically about 1.5 s after the reveal (`apps/mobile/src/practice/controller.ts:44, 600-603`). Each wager settles separately; messages read "The ball landed on {n} {color}.", "{bet} {stake} wins {net}." or "{bet} {stake} loses.", then "Balance {amount}." (`roulette-text.ts:109-119, 142`). "LAST SPIN" shows the pocket and its color (`RouletteTable.tsx:178-189`).

**Ending a practice session** ("End this session?", "End session"; `EndSessionDialog.tsx:46, 71`). Removable wagers come back, committed wagers settle automatically, and then the session result shows (`EndSessionDialog.tsx:55-64`; `roulette.ts:248-262`). The final-settlement screen says "Runs on its own. No more bets." and "Final settlement starts on its own. There's nothing to tap." (`RouletteTable.tsx:96-102`). No rebuys or play once final settlement starts (spec 1 body, *Funding, ending and results*, Ending bullet). Engine run: request-stop with red 10 removable returns it (balance 1000, phase `final-settlement`).

### Funding (practice funding)

- **Buy-in:** practice funding is a fresh, player-chosen buy-in per session, never a shared wallet. It defaults to 1,000 and is remembered per game as a setup preference ([CONTEXT.md](../../CONTEXT.md) *Practice funding*; spec 1 body, *Funding, ending and results*, Session funding bullet).
- **Rebuy:** offered only with practice funding (`funding.ts:43`), while the table waits for input (`activity.ts:413-417`). It must be whole units, and total funding (buy-in + rebuys) may not exceed 1,000,000,000 (`funding.ts:50-54`). The rebuy sheet shows "Total funding so far", "Funding limit per session", "Room left" and "Rebuys so far" (`RebuySheet.tsx:61-68`). A rebuy is funding, not a win. It doesn't auto-place a pending strategy bet (spec 1 body, *Funding, ending and results*, Rebuys bullet).
- **Session result:** "Buy-in", "Rebuys", "Total funding", "Final cash-out", "Net result" (= final cash-out − total funding) and "Max drawdown", which "Includes final settlement" (`SessionResult.tsx:74-85, 120-128`; `funding.ts:67-79`). Rebuys never reduce drawdown (spec 1 body, *Funding, ending and results*, Results bullet). Engine run: buy-in 300, four losses to 150, rebuy 1,000 → funding `buyIn 300, rebuys [1000]`, `maxDrawdown 150`.
- A training-bankroll source also exists, with no buy-in and no rebuys (`Funding.tsx:92-101`). That is spec 5 and outside these lessons.

### Guided practice vs free play

- **The player places the bets.** In guided practice the app doesn't place them; it checks them at Spin. If the wagers differ from the prescription, the engine holds the spin in a **correction** ("Strategy check") before anything is placed (`activity.ts:645-663`). The panel reads "Before your spin", gives the strategy's prescribed bets and reasons, and offers "Take it back & bet {bets}" (retry) or "Keep my bets" (override) (`coaching-text.ts:64-73, 99-111`). An override is recorded once.
  - For the three progressions (strategies with counters or lists), an override ends the cycle: "The spin goes ahead, the strategy cycle ends, and you restart the strategy yourself."
  - For the flat strategies, "the strategy coaches your next spin" (`coaching-text.ts:69-73`; `activity.ts:707-726, 933-934`).
- **GuidedStrip:** "Guided · {strategy} · {targets}", plus " · cycle N" for progressions. It also shows adherence ("Followed X of Y spins · Departures N") and a "Stop strategy" button (`Guidance.tsx:47-62`).
- **Pending strategy action (pause).** When the next prescribed bet can't be placed, the strategy places no new bet and play waits. Reasons and app text (`coaching-text.ts:121-132`):
  - `unfunded-group`: "Blocked: not enough chips ({available} of {needed})"
  - `limit`: "Blocked: outside the table limits"
  - `cap`: "Blocked: past the strategy's cap of {cap}"
  - `stop`: "Blocked: the strategy's stop rule applies". None of the five built-ins has a stop rule (`stopWhen: null`), so this never applies to them.

  The panel says "No new strategy bets until this is resolved. Tableside never makes a stake smaller or places part of a bet." and offers "Resolve: rebuy", "Place my own bets (override)" and "Stop strategy" (`Guidance.tsx:245-262`). The roulette table doesn't pass the "Collect instead" option (`RouletteTable.tsx:160-171`). Funding and limit pauses hold the next stake and don't end the cycle (`activity.ts:801-802, 834`). For progressions, a cap ends the cycle instead of pausing (`activity.ts:864-870`).
- **Cycle result** (progressions only). The panel shows a headline (`coaching-text.ts:142-149`): "Cycle complete", "This cycle ended at the strategy's cap" or "This cycle ended with your override". It also shows "Cycle result", "Balance now", "THIS CYCLE" (each spin) and the buttons "Start another cycle with {balance}" and "End session" (`Guidance.tsx:143-207`). The note reads: "Starting another cycle uses the balance you have now. It never adds chips, and the session keeps the strategy revision you started with." For a completed cycle: "{strategy} completed its cycle. Another cycle starts again from its first bet." (`coaching-text.ts:155`).
- **Restarts are explicit in practice.** The engine waits in `cycle-completion` and legal commands are `restart-cycle`, `stop-strategy`, `request-stop` and `rebuy` (`activity.ts:417`; engine runs). `restart-cycle` resets the strategy to its initial state and numbers the next cycle (`activity.ts:727-744`). Automatic restarts happen only in standardized simulation runs, never in practice ([Amendment 6 §2](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6275071941)).
- **Flat strategies have no cycle.** Flat even-money and Fixed two-dozen coverage have no counters, lists or completion rule, so they coach every spin and never reach a cycle result (`roulette-strategies.ts:11-59`; `activity.ts:933-936`).
- **Stop strategy:** "No new strategy bets", "Removable wagers come back", "Committed wagers settle automatically" (`Guidance.tsx:281-283`). The practice session stays open for free play ("Strategy stopped · playing on your own", `Guidance.tsx:47`).

## Flat even-money

Definition: `packages/definitions/src/roulette-strategies.ts:11-31`.

- **Initial state:** no counters or lists. Choose a "Target" from red, black, odd, even, low (1 to 18) and high (19 to 36); the default is red. The opening bet is 10, which matches the outside minimum.
- **Next action, every spin:** 10 on the target. The instruction label is "10 on your even-money target, every spin".
- **Outcome adjustments:** none. A win pays 1:1, so 10 more. A loss, including 0 or 00, loses the 10.
- **Limits:** 10 is an outside bet, within 10–1,000. Setup refuses a table whose outside minimum is above 10.
- **Stopping and final settlement:** no stop rule and no cycle. Play continues until the player stops the strategy or ends the session. Ending returns an uncommitted bet, and a committed bet settles in final settlement.
- **Tableside vs published:** this is a practice policy built from the published even-money bet, not a named historical system ([roulette-strategies.md](roulette-strategies.md), *Candidate range*). The 10 stake and red default are Tableside's.
- **Engine-verified:** single zero, buy-in 1,000. Red 10 on 1 (red): net +10, balance 1,010. On 2 (black): −10. On 0: −10. On double zero, 00: −10. One-spin table, single zero: +10 with 18/37, −10 with 19/37. Double zero: +10 with 9/19, −10 with 10/19. Expected net per unit −1/37 and −1/19.

## Fixed two-dozen coverage

Definition: `roulette-strategies.ts:33-59`.

- **Initial state:** choose "First dozen" and "Second dozen" from the 1st (1–12), 2nd (13–24) and 3rd (25–36). They must differ (`distinctFrom`). The defaults are 1st and 2nd.
- **Next action, every spin:** 10 on each chosen dozen, 20 in total. The label is "10 on each of your two dozens, every spin".
- **Outcome adjustments:** none. The two bets settle separately, and the result is their sum.
  - A covered dozen wins 2:1 (+20) and the other bet loses 10, so the spin nets **+10**.
  - The uncovered dozen, or 0 or 00, loses both bets: **−20**.
- **Limits:** each 10 is an outside bet within 10–1,000. Opening bets total 20, so the buy-in must cover 20.
- **Stopping and final settlement:** as for Flat even-money (no stop rule, no cycle).
- **Tableside vs published:** Tableside's own practice policy built from the dozen bet ([roulette-strategies.md](roulette-strategies.md)). Casino Quest's "Best System for Comps" (1:01–1:21) covers two dozens and two columns at once. That is a different pattern, and copy must not present Tableside's version as it.
- **Engine-verified:** single zero, defaults 1st + 2nd.

  | Pocket | Spin net | Balance |
  | --- | --- | --- |
  | 5 | +10 | 1,000 → 1,010 |
  | 20 | +10 | 1,010 → 1,020 |
  | 30 | −20 | 1,020 → 1,000 |
  | 0 | −20 | 1,000 → 980 |
  | 00 (double zero) | −20 | 1,000 → 980 |

  One-spin table, single zero: +10 on 24 pockets (24/37), −20 on 13 (13/37). Double zero: +10 on 24 (12/19), −20 on 14 (7/19). Expected net −20/37 and −20/19 per spin, which is −1/37 and −1/19 per unit wagered. A positive spin is more frequent than a negative one, but the expected loss per unit wagered is the same as on any other bet on that wheel.

## Capped Martingale

Definition: `roulette-strategies.ts:63-84`. Note: "10, 20, 40, 80, 160, 320 after each loss. A win completes the cycle; a loss at 320 ends it at the cap."

- **Initial state:** counter `stake` = 10, on one even-money "Target" (default red).
- **Next action:** bet the current stake on the target ("The current stake on your even-money target"). The bet has a cap of **320**.
- **Outcome adjustments:**
  - **Loss** (including 0 or 00): the stake doubles (`adjustments: double`).
  - **Win:** the cycle completes (`completeWhen: last-result is win`).
- **Stakes after 1–5 consecutive losses:** 20, 40, 80, 160, 320 (engine).
- **Limits and caps:**
  - **Cap.** After a loss at 320 the next stake would be 640, past the cap of 320. The cycle ends at the cap and no bet is placed. Headline: "This cycle ended at the strategy's cap". Text: "The next stake would be 640 on Red, past the strategy's cap of 320, so no new bet was placed." (`coaching-text.ts:144, 156-159`).
  - **Table limit.** At the default limits, 320 is within the outside maximum of 1,000. With a lower maximum (engine run: outside max 200), setup still accepts the strategy, and play pauses before the 320 bet with "Blocked: outside the table limits".
  - **Funding.** If the balance can't cover the next stake, play pauses with "Blocked: not enough chips". The stake is never reduced. A rebuy lets the held stake go ahead.
- **Completion and after:** a win completes the cycle. The app shows the cycle result and waits. "Start another cycle" restarts at 10 with the current balance; "End session" ends.
- **Tableside vs published core.** Wizard of Odds *Rules*: "If the result of your last bet is a loss, then double your next bet size, if you can." A win means "you have achieved your winning goal and may quit". The *What to Expect* simulation assumes the player keeps starting over after each session. The Casino Quest video above (0:58–1:00) describes going back to the first unit after a win. **Tableside's own choices:**
  - the 10 opening stake;
  - the 320 cap, ending the cycle instead of doubling to 640 or betting the table maximum;
  - pausing rather than betting what's left when funds are short;
  - an explicit restart.

  Wizard's betting-systems page simulated a Martingale with "a maximum bet … of $200", a different cap.
- **Engine-verified** (single zero, buy-in 1,000; "balance" is after the stake leaves the balance → after settlement):

  | Sequence | Bets | Result |
  | --- | --- | --- |
  | W | 10 | cycle complete, cycle net **+10** |
  | L(2), L(0), L(2), W(1) | 10, 20, 40, 80 | balance 850 → 1,010; cycle complete, net **+10** |
  | L×5, W | 10, 20, 40, 80, 160, 320 | 370 → 1,010; cycle complete, net **+10** |
  | L×6 | 10, 20, 40, 80, 160, 320 | balance 370; cycle ends `cap`, cycle net **−630**; next stake 640 held: `{"reason":"cap","unavailable":[{"target":"red","amount":"640"}],"cap":"320"}` |
  | Double zero: L(00), W | 10, 20 | cycle complete, net +10 |
  | Buy-in 300: L×4 | 10, 20, 40, 80 | balance 150; paused `unfunded-group` for 160. After rebuy 1,000: balance 1,150, pause cleared, 160 bet next |
  | Outside max 200: L×5 | 10, 20, 40, 80, 160 | paused `limit` for 320 |

  After every `restart-cycle` the stake is 10 and the cycle number increases.

## Three-win parlay

Definition: `roulette-strategies.ts:86-106`. Note: "10, 20, 40 after each win. A loss or the third win completes the cycle."

- **Initial state:** counters `stake` = 10 (declared cap 40) and `wins` = 0 (declared cap 3), on one even-money "Target" (default red).
- **Next action:** bet the current stake on the target.
- **Outcome adjustments:**
  - **Win:** the stake doubles ("let it ride") and wins goes up by one.
  - **Loss:** no adjustment, and the cycle completes.
- **Completion:** the cycle completes on any loss, or once wins reach 3 (`completeWhen`). The declared counter caps (stake 40, wins 3) bound the strategy for validation. Because the third win completes the cycle first, the engine runs never reached a `cap` end. Stakes are at most 40, under the 1,000 outside maximum. A funding shortfall pauses, as for the Martingale.
- **After completion:** the same cycle result and explicit restart, back to stake 10 and wins 0.
- **Tableside vs published core.** Wizard of Odds *Anti-Martingale › Rules*: "If the result of your last bet is a win and the winning goal has not been achieved, then double the previous bet". "If the result of your last bet is a loss, then quit a loser." The winning goal is a bankroll target that "should be some power of 2". **Tableside's own choices:**
  - the 10/20/40 schedule;
  - ending the cycle after the third win (a win count, not a bankroll goal);
  - restarting a new cycle instead of quitting.

  Don't call it Paroli. No Paroli page was available from Wizard of Odds (404), and no Casino Quest parlay/Paroli video was verified.
- **Engine-verified** (single zero, buy-in 1,000):

  | Sequence | Bets | Result |
  | --- | --- | --- |
  | W, W, W | 10, 20, 40 | balance 1,070; cycle complete, net **+70** |
  | W, W, L | 10, 20, 40 | balance 990; cycle complete, net **−10** |
  | L (0) | 10 | cycle complete, net **−10** |

## Bounded Labouchere

Definition: `roulette-strategies.ts:108-140`. Note: "Line 10, 20, 30: bet first plus last. A win crosses them off, a loss adds the stake. An empty line completes the cycle; a stake over 320 ends it at the cap."

- **Initial state:** the list ("line") is [10, 20, 30], on one even-money "Target" (default red).
- **Next action:**
  - With two or more numbers, bet first + last: "The first and last numbers of your line, added, on your target". The opening bet is 40.
  - With one number left, bet it: "The one number left in your line, on your target".
  - Either way the cap is **320**.
- **Outcome adjustments:**
  - **Win:** cross off the first and last numbers. With one number left, a win removes it (`progressAfter` slices both ends; `packages/engine/src/strategy.ts:856-884`).
  - **Loss** (including 0 or 00): add the amount just staked to the end.
- **Completion:** an empty line completes the cycle. **Independent derivation:** an even-money win nets its stake and crosses off line entries summing to that stake (first + last, or the sole entry); a loss nets −stake and appends that stake. So line total + cycle net stays equal to the starting total, and an empty line means the cycle net is +60 (10 + 20 + 30), matching every completed engine run below.
- **Limits and caps:**
  - **Cap.** A required stake above 320 ends the cycle at the cap, and no bet is placed.
  - **Table limit.** At the default limits, every stake up to 320 is within the outside maximum of 1,000.
  - **Funding.** A shortfall pauses ("Blocked: not enough chips"). Tableside never bets a partial amount.
- **After completion:** explicit restart with the line reset to [10, 20, 30].
- **Tableside vs published core.** Wizard of Odds *Labouchere › Rules*: the player divides a winning goal by 10 and writes "the quotient from step 2 ten times". The player bets "the sum of the left and right numbers", and "If there is only one element in the list, bet that." A win crosses off the left and right numbers; a loss adds "the amount just lost" to the right end. The session ends when every element is crossed off or "the player's bankroll is exhausted". The page also gives a rule for betting what's left when the bankroll is short. **Tableside's own choices:**
  - the [10, 20, 30] starting line;
  - the 320 cap;
  - pausing instead of betting a remainder;
  - explicit restarts.

  Wizard's *Introduction*: "Like most betting systems, it usually results in a session win, but at the expense of huge losses when it doesn't." No Casino Quest Labouchere video was found.
- **Engine-verified** (single zero):

  | Sequence (buy-in) | Bets | Line after each spin | Result |
  | --- | --- | --- | --- |
  | W, W (1,000) | 40, 20 | [20] → [] | cycle complete, net **+60** |
  | L, W, W (1,000) | 40, 50, 50 | [10,20,30,40] → [20,30] → [] | cycle complete, net **+60** |
  | W, L, W (1,000) | 40, 20, 40 | [20] → [20,20] → [] | net **+60** |
  | 29 losses (10,000) | 40, 50, 60, … 310, 320 (each 10 more) | grows by one entry per loss | after the loss at 320 the next stake is 330; cycle ends `cap`, cycle net **−5,220**; balance 4,780 |

## Handoffs

Each lesson's final step offers free play or guided practice with the strategy filled in. The setup screen it opens explains whether starting uses the guided-practice allowance, and nothing starts or is charged until the learner presses Start (#53 body, *Lessons and worked examples › Structure*, Handoff; frame pX6CV "Practice it" box; #145 handoff, ZBpF3 sheet text in `apps/mobile/src/training/lesson-text.ts`).

## The house-edge statement

Every progression lesson must state plainly that changing stakes doesn't remove the house edge (#53 body, *Content requirements*, and user story 7).

- **Per bet.** Every bet on the single-zero wheel has expected net −1/37 of its stake. On double zero it is −1/19, or −3/38 for the basket (definitions; engine one-spin tables above).
- **Per session.** If each new bet `B_t` has conditional expected net `−h × B_t`, a session with finitely many spins has expected net `−h × E[total amount wagered]`. This holds for any rule that picks stakes from past results: flat, doubling after losses, doubling after wins, or a list. Stop rules and caps change the spread of results and how much is wagered. They don't change the expected loss per unit wagered. This is an independent derivation ([roulette-strategies.md](roulette-strategies.md), *Rules that change the comparison*). It assumes no unlimited credit and doesn't claim every session loses.
- **Published support.** Wizard of Odds *Betting Systems › Introduction*: "Not only do betting systems fail to beat casino games with a house advantage, they can't even dent it." *The Martingale* section: "No matter what system is used in the long run, this ratio will always approach the house edge." *Martingale › Summary*: "not only won't the Martingale eliminate the house edge, it won't even dent it." The roulette basics *Betting Systems* section quotes Britannica: "regardless of what system is used, in the long run it cannot overcome the house's advantage of the 0, or 0 and 00." The anti-Martingale and Labouchere pages make no prose statement. Their simulation tables report a loss ratio at the house edge (about 2.70% single zero and 5.26% double zero), and the Labouchere page states "The theoretical house edge in single-zero roulette is 1/37 = 2.703%."
- **Illustration from the engine runs (not a prediction).** The capped Martingale completes most cycles at +10. The one run of six straight losses lost 630 before reaching the cap. Labouchere completions in the runs were +60, while the losing run to its cap lost 5,220. A long run of small cycle wins and occasional large cap losses is how the same expected loss shows up.

## Things not to claim

- That any strategy, progression, cap or stop is profitable, "beats" roulette, reduces the house edge, or is "safe" or "better". The two-dozen policy wins on more spins but has the same expected loss per unit wagered.
- That past spins predict future ones, that a color or number is "due", or that a cycle "usually" wins in real play. The engine model draws each spin independently and uniformly (#51 body, *Random protocol*).
- Readiness for real casinos, or predicted casino results. Tableside's full-loss zero, limits and the 10/320 amounts are Tableside choices. Other tables use half-back or la partage and other limits (NJ DGE §13:69F-5.2(b); Wizard *French Rules*).
- That Tableside's variants are the canonical Martingale, Paroli, parlay or Labouchere, or that Wizard of Odds or Casino Quest authored, reviewed or endorsed them. Cite a specific page section or video timestamp, never a whole channel. Show external sources as text links only.
- That a strategy places bets by itself in guided practice, auto-restarts in practice, shrinks a stake, or bets a partial amount. It does none of these.
- Stakes as multiples of a base unit ("32 units"). Use amounts ("cap of 320").

## Engine verification

The script `roulette-lessons-verify.ts` lives in the session scratchpad and is not committed. It drives the real engine through `createActivity` and `advanceActivity` with the built-in definitions, using `practice-funding` and the stream `{protocol: RANDOM_PROTOCOL_VERSION, key: [0,0], session: [0,0]}`. For each spin it places exactly what `explainPrescription` prescribes and sends `begin-turn`. It then replaces the drawn `outcome.pocket` with the chosen pocket (a stacked spin) and sends `settle-turn`. It also calls `oneSpinOutcomeTable`, `rouletteHouseEdge` and `strategyTableCompatibility`.

Command, run from the repo root. The scratch tsconfig only maps `@tableside/engine` and `@tableside/definitions` to `packages/*/src/index.ts`.

```
pnpm exec tsx --tsconfig <scratchpad>/tsconfig.json <scratchpad>/roulette-lessons-verify.ts
```

Output excerpts. In the spin lines, "balance a->b" is the balance after the stake leaves it → after settlement.

```
== House edges (definitions) ==
  single-zero straight: 1/37 = 2.70%     single-zero basket: not on this wheel
  double-zero straight: 1/19 = 5.26%     double-zero basket: 3/38 = 7.89%
  (red and dozen: same as straight on each wheel)

== One-spin outcome tables (oneSpinOutcomeTable) ==
  single-zero red 10: [{"net":"-10","probability":"19/37","zeros":[0]},{"net":"10","probability":"18/37","zeros":[]}]
  single-zero dozen-1 10 + dozen-2 10: [{"net":"-20","probability":"13/37","pockets":13,"zeros":[0]},{"net":"10","probability":"24/37","pockets":24,"zeros":[]}]
  double-zero red 10: [{"net":"-10","probability":"10/19","zeros":[0,"00"]},{"net":"10","probability":"9/19","zeros":[]}]
  double-zero dozen-1 10 + dozen-2 10: [{"net":"-20","probability":"7/19","pockets":14,"zeros":[0,"00"]},{"net":"10","probability":"12/19","pockets":24,"zeros":[]}]

== Expected net per unit wagered, summed over oneSpinOutcomeTable groups ==
  single-zero red 10: expected net -10/37; per unit wagered -1/37
  single-zero dozen-1 10 + dozen-2 10: expected net -20/37; per unit wagered -1/37
  single-zero straight-17 10: expected net -10/37; per unit wagered -1/37
  double-zero red 10: expected net -10/19; per unit wagered -1/19
  double-zero dozen-1 10 + dozen-2 10: expected net -20/19; per unit wagered -1/19
  double-zero straight-17 10: expected net -10/19; per unit wagered -1/19
  double-zero basket 10: expected net -15/19; per unit wagered -3/38

== Opening prescriptions at the default table ==
  Flat even-money: {"status":"prescribed","bets":[{"target":"red","amount":"10"}],"held":[]}
  Fixed two-dozen coverage: {"status":"prescribed","bets":[{"target":"dozen-1","amount":"10"},{"target":"dozen-2","amount":"10"}],"held":[]}
  Capped Martingale: {"status":"prescribed","bets":[{"target":"red","amount":"10"}],"held":[]}
  Three-win parlay: {"status":"prescribed","bets":[{"target":"red","amount":"10"}],"held":[]}
  Bounded Labouchere: {"status":"prescribed","bets":[{"target":"red","amount":"40"}],"held":[]}

== Flat even-money: red win, black loss, zero (single-zero, buy-in 1000) ==
  bet 10 on red | pocket 1 | balance 990->1010
  bet 10 on red | pocket 2 | balance 1000->1000
  bet 10 on red | pocket 0 | balance 990->990
== Flat even-money: 00 (double-zero) ==
  bet 10 on red | pocket 00 | balance 990->990

== Two dozens: 5, 20, 30, 0 (single-zero, buy-in 1000) ==
  bet 10 on dozen-1 + 10 on dozen-2 | pocket 5 | balance 980->1010
  bet 10 on dozen-1 + 10 on dozen-2 | pocket 20 | balance 990->1020
  bet 10 on dozen-1 + 10 on dozen-2 | pocket 30 | balance 1000->1000
  bet 10 on dozen-1 + 10 on dozen-2 | pocket 0 | balance 980->980
== Two dozens: 00 (double-zero) ==
  bet 10 on dozen-1 + 10 on dozen-2 | pocket 00 | balance 980->980

== Martingale: L L L W (single-zero, buy-in 1000) ==
  bet 10 on red | pocket 2 | ... progress {"stake":"20"}
  bet 20 on red | pocket 0 | ... progress {"stake":"40"}
  bet 40 on red | pocket 2 | ... progress {"stake":"80"}
  bet 80 on red | pocket 1 | balance 850->1010 | phase cycle-completion status cycle-ended cycleEnd completed
  end: legal ["restart-cycle","stop-strategy","request-stop","rebuy"]; cycle 1 net 10
  after restart-cycle: phase open-decision; cycle 2; progress {"counters":{"stake":"10"},...}
== Martingale: six losses (cap) ==
  bets 10, 20, 40, 80, 160, 320 on red, all pocket 2; balance 370 after the 320 loss
  bet 320 on red | pocket 2 | balance 370->370 | phase cycle-completion status cycle-ended cycleEnd cap | progress {"stake":"640"}
  end: cycle 1 net -630; exhaustion {"reason":"cap","unavailable":[{"target":"red","amount":"640"}],"cap":"320"}
== Martingale: five losses then a win at 320 ==
  bet 320 on red | pocket 1 | balance 370->1010 | cycleEnd completed ; cycle 1 net 10
== Martingale: losses with a 300 buy-in (unfunded) ==
  bet 80 on red | pocket 2 | balance 150->150 | ... pending={"reason":"unfunded-group","unavailable":[{"target":"red","amount":"160"}],"turn":4}
  after rebuy 1000: balance 1150; pending null; progress {"stake":"160"}; funding {"source":"practice-funding","buyIn":"300","rebuys":["1000"],"peak":"0","maxDrawdown":"150"}
== Martingale at a table whose outside maximum is 200 ==
  setup compatibility: {"compatible":true,"requirements":[]}
  bet 160 on red | pocket 2 | ... pending={"reason":"limit","unavailable":[{"target":"red","amount":"320"}],"turn":5}

== Parlay: W W W ==
  bet 10 | pocket 1 | progress {"stake":"20","wins":"1"}
  bet 20 | pocket 3 | progress {"stake":"40","wins":"2"}
  bet 40 | pocket 5 | balance 990->1070 | cycleEnd completed ; cycle 1 net 70
== Parlay: W W L ==   bets 10, 20, 40; last pocket 2; cycleEnd completed ; cycle 1 net -10
== Parlay: L first spin ==   bet 10 | pocket 0 | cycleEnd completed ; cycle 1 net -10
  (every restart-cycle: progress {"stake":"10","wins":"0"})

== Labouchere: W W ==         bet 40 -> line ["20"]; bet 20 -> line []; completed; cycle 1 net 60
== Labouchere: L W W W ==     bet 40 -> ["10","20","30","40"]; bet 50 -> ["20","30"]; bet 50 -> []; completed; net 60
== Labouchere: W L W ==       bet 40 -> ["20"]; bet 20 (loss) -> ["20","20"]; bet 40 -> []; completed; net 60
== Labouchere: 29 losses to the cap (buy-in 10000) ==
  bets 40, 50, 60, ..., 310, 320 (all pocket 2)
  bet 320 on red | pocket 2 | balance 4780->4780 | phase cycle-completion status cycle-ended cycleEnd cap
  end: cycle 1 net -5220; exhaustion {"reason":"cap","unavailable":[{"target":"red","amount":"330"}],"cap":"320"}
  after restart-cycle: progress {"lists":{"line":["10","20","30"]}}

== Free play, single spin, settlement facts ==
  single-zero red 10 on 0: {"result":"loss","net":"-10","returned":"0"} balance 990
  double-zero red 10 on 00: {"result":"loss","net":"-10","returned":"0"} balance 990
  single-zero dozen-1 10 on 0: {"result":"loss","net":"-10","returned":"0"} balance 990
  single-zero straight-17 10 on 17: {"result":"win","net":"350","returned":"360"} balance 1350

== Limits and funding (free play) ==
  red 9: "below-minimum"; red 1001: "above-maximum"; straight-17 101: "above-maximum"; straight-17 1: placed; red 10: placed
  buy-in 5, red 10: reason "insufficient-funds"
  buy-in 5, rebuy 1000: {"kind":"funding-added","amount":"1000","cumulative":"1005","balance":"1005"}
  stop with red 10 removable: phase final-settlement balance 1000
== Setup compatibility: Flat even-money at an outside minimum of 25 ==
  {"compatible":false,"requirements":[{"target":"red","amount":"10","requirement":"below-minimum","limit":"25"}]}
```

The engine rules behind these results are in `packages/engine/src/strategy.ts` and `packages/engine/src/activity.ts`.

- **Pause reasons and their order:** `strategy.ts:184, 798-800, 832-838`. A stop rule is checked first, then counter caps; per bet, a bet cap comes first (`cap`), then the table limit (`limit`), then funds (`unfunded-group`).
- **Cycle completion and a cap ending the cycle:** `activity.ts:791-805, 864-870`.
- **Funding and limit pauses hold the stake without ending the cycle:** `activity.ts:801-802, 834`.
- **Restart resets the initial state:** `activity.ts:727-744`.

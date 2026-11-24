# Challenge vocabulary: plain words at decision points

Accepted 2026-11-23. The 2026-11-18 design critique (`.impeccable/critique/2026-11-18T20-48-40Z__apps-mobile-src.md`) found a heavy vocabulary load at the counting decision points (P2): Variant, attempt, checkpoint, assisted, allowance and readiness milestone, plus a dense records note. Its minor observations added three more: Skip and Submit had equal weight, links led to "arrives in a later update" placeholders, and the streak reset came first on Results. The owner ruled on four questions (below). The frames came first, then the code.

## Frames

In `design/Tableside.pen`. The replaced frames are renamed `[Superseded] … replaced by <id>`. The NOTES board `egBbr` has the section "Clarify · 22 Nov".

| Screen | Frames | Replaces |
| --- | --- | --- |
| S3-01 Counting hub | `GV4tz` no lesson started · `h9v8xG` lesson in progress · `j0xoWQ` Larger | `u8a0o`, `rwwOU`, `cplrc` |
| S3-02 Challenge setup | `Ufuiu` running count · `w890v` Larger · `FWQoO` table, Play · `NonMz` table, Observe | `buD2R`, `FkMDw`, `ZreSb` |
| S3-04 Running count exercise | `Y8m0IQ` · `T3mpLF` Larger | `qdnQm`, `u67F1C` |
| S3-05 Show the running count? | `y6lY1o` | `EDnGd` |
| S3-05 Skip this count? | `UKfJA` · `YLGVK` Larger | — |
| S3-08 Results, Check below 95% | `cfKTT` · `I6Rm0` Larger | `nXGFk` |
| S3-10 Records | `Yy2He` | `OVKkc` |

Two components changed, so every instance follows: the Challenge Card `TNONR` (Learn and Check buttons with a detail line) and the Count Keypad `IklpE` (compact Skip, Submit fills the row).

## Rules

1. **Each choice says what it means on its control.** Learn reads "Feedback as you go" and Check reads "Feedback at the end", under the name on each hub button. The detail is Linen `secondary` and is the button's visible text. The screen-reader name stays "Learn: Card values", and the detail is its hint. Side by side, the detail breaks after "Feedback", as in the frame, so no word is left alone on a line. At Larger, or above font scale 1.3, the two buttons stack full width and the detail stays on one line.
2. **"Feedback" replaces "Variant"** as the setup label. "Mode" would clash with the blackjack playing modes, and "Learn or Check" repeats the segments. The glossary term stays *variant* (`CONTEXT.md`).
3. **Help follows the selected choice.** Learn: "Learn shows after each answer whether it's right, explains it and lets you retry." Check: "Check holds all feedback until the end; two Checks in a row at 95% or better earn a readiness milestone." A Play Check keeps its own line: "…a move that isn't allowed is still refused straight away." The running-count "What you'll do" says what the chosen variant asks for: four checkpoints after cards 13, 26, 39 and 52 in Check, or every card in Learn.
4. **One sentence per note, in plain words.** The terms stay, but each note explains them where they appear:
   - Allowance banner: "Starting a challenge uses one attempt; resuming it, showing the count and opening lessons don't."
   - Timing: "Only a perfect Check with no pauses and the count kept hidden sets a fastest time."
   - Show count: "Hidden. Showing it records this attempt as assisted for good." The sheet's lead is "This attempt will be recorded as assisted, even if you hide the count again." Its detail is "Assisted attempts keep their full results in their own records but can't earn a readiness milestone, and showing the count doesn't use another attempt."
   - Records: "Records compare only attempts with the same settings; a fastest time needs a perfect, timed Check with no pauses and the count kept hidden."
5. **Submit leads; Skip is compact and asks first.** On the count keypad, Submit fills the row and Skip is a compact outline button beside it. Every Skip opens "Skip this <count | card | question>?": "A skipped <item> is scored as incorrect, and you can't go back to it." Keypad items add "Going back keeps what you've typed." The actions are Keep counting (primary) and Skip and score as incorrect (outline). This covers card values, running count, conversion and table checkpoints. The sheet hides while the attempt can't take an answer, for example while it is paused.

   *Why a confirm, not an undo:* the engine records and scores a skip the moment it is sent, and Check withholds feedback. An undo would have to take back a committed answer. A confirm touches only the UI and stops the stray tap before anything is recorded.
6. **No link leads to a placeholder.** See premium (Counting banner, challenge setup and practice setup), the Offline & allowance link and Customize a copy for this table are hidden until their screens exist. Owner ruling: they stay tracked in their specs, with no separate tickets. Plan and Offline & allowance are in spec 5 ([#55](https://github.com/0xRowdy/tableside/issues/55)), and Customize a copy is in spec 4 ([#54](https://github.com/0xRowdy/tableside/issues/54)). The frames keep the links because they show the finished screens. When the allowance is on another device, the line reads "Today's challenge attempts are on <device>. Start challenges there; lessons and your records stay open here." The S5-17 wording returns with the Offline & allowance screen. `SetupTerms.seePremium` still carries the policy's answer, ready for spec 5.
7. **Results lead with what went right.** When a Check falls below 95%, the first box reads "You got 3 of 4 checkpoints right." (the category's own metric and unit). The streak note follows the scores: "Below 95% this time, so your run of Checks at 95% or better starts over."

## App orientation lesson (#167)

The lesson now names five tabs, says Counting holds every lesson as well as the challenges and records, and puts Community under More. Step 2 lists where lessons open: the Counting tab, Help at the top of every table, Learn this game in setup, the Start here card and beside each challenge. It also says what Settings › Learning still holds. The Check-attempt paragraph is unchanged (spec 3 Amendment 1 A2).

Owner ruling under spec 3 Amendment 1 C10: this is a **material change**. Anyone who finished version 1 was told lessons live in More › Settings › Learning. The lesson is version 2, material version 2, with the change "Lessons moved to the Counting tab and open from Help on every table, so the tabs and help steps are new." Earlier completions show "Completed (earlier version)".

## Not changed

- Type sizes, layout and structure, except the hub buttons stacking at Larger and the keypad's action row.
- The table frames `FkMDw`/`ZreSb` had two lines the build never showed: "Optional. Speed never counts toward a milestone." and "Play never uses guided-practice time, turns or training bankroll." The new frames reword the second as "A Play challenge uses only this attempt, never your daily guided practice." The build still shows neither. That gap predates this change and is left as it was.

## Spec amendments

Posted 2026-11-23: [spec 3 A9](https://github.com/0xRowdy/tableside/issues/53#issuecomment-7122667829), [spec 5 A10](https://github.com/0xRowdy/tableside/issues/55#issuecomment-7122668167), [spec 1 A15](https://github.com/0xRowdy/tableside/issues/51#issuecomment-7122668557).

| Spec | Amendment |
| --- | --- |
| [#53](https://github.com/0xRowdy/tableside/issues/53) spec 3 A9 | S3-01: Learn and Check buttons carry "Feedback as you go" / "Feedback at the end" and stack at Larger (rule 1). S3-02: the label is "Feedback"; the help follows the selected choice; the running-count "What you'll do" follows it too (rules 2–3). S3-04/S3-05: Submit fills the keypad row and Skip is compact; every Skip asks first through "Skip this <item>?", with no undo (rule 5). The show-count switch and warning use the rule 4 wording. S3-08: a Check below 95% leads with what went right, and the streak note follows the scores (rule 7). S3-10: the one-sentence records note. Amendment 4 §2–3: See premium and the Offline & allowance link wait for spec 5's screens (rule 6). Lessons: App orientation version 2 is material (C10), with the change above. |
| [#55](https://github.com/0xRowdy/tableside/issues/55) spec 5 A10 | When Plan and Offline & allowance ship, restore See premium on the Counting banner, the challenge setup and the practice setup allowance card. Restore the banner's Offline & allowance link and the S5-17 line "Move them here in More › Settings › Offline & allowance." Until then the elsewhere line reads as in rule 6. |
| [#51](https://github.com/0xRowdy/tableside/issues/51) spec 1 A15 | S1-02: until spec 4 adds Customize a copy for this table, the incompatibility message offers "Choose a compatible table (…) or another strategy." with no third action. |

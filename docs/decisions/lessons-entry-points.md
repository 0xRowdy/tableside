# Lessons entry points: the Counting hub and table Help

Accepted 2026-11-19. The 2026-11-18 design critique (`.impeccable/critique/2026-11-18T20-48-40Z__apps-mobile-src.md`) found the lesson catalog three levels deep, at More › Settings › Learning › Lessons (P1). The owner decided that the full catalog moves to the top of the Counting tab, the tab stays "Counting", and the five-tab bar is unchanged. The frames came first, then the code.

## Frames

In `design/Tableside.pen`. The replaced frames are renamed `[Superseded] … replaced by <id>`. The NOTES board `egBbr` has the section "Lessons entry points · 19 Nov".

| Screen | Frames | Replaces |
| --- | --- | --- |
| S3-01 Counting hub | `u8a0o` no lesson started · `rwwOU` lesson in progress · `cplrc` Larger | `PDCaD`, `o1b5Py` |
| Settings › Learning | `OEkKV` | `NvGyZ` |
| S1-04 table Help sheet | `qylNY` blackjack (craps and roulette in annotation `NVWuf`) | — |
| S3-07 Help in a Check attempt | `zxRJD` | — |
| S3-11 catalog | `klT0u` on the Counting tab · `f6mxz` filtered, opened from a table | `sVqX1` |

Annotations: `XMYAW` hub, `NVWuf` table Help, `c9I918` Check attempt, `KD0BU` back labels, `jMdNG` code mapping, `ZrAt6` Settings.

## Rules

1. **Counting is a training hub in three parts:** Lessons, then Challenges, then Records. Lessons come first because they are never metered, so they sit above the allowance banner. The banner moves inside Challenges, above the four cards.
2. **The Lessons card offers one lesson** (`training/lesson-offer.ts`), first match wins:
   1. Continue the in-progress lesson with the latest progress event, in any section. Recency is the lesson's last event in acceptance order, so it follows the merged history across devices.
   2. Otherwise, start the first counting lesson not yet completed, in path order: Card values, Running count, True-count conversion, Table counting. A completion of an earlier version counts as done. The kicker is "First lesson · counting" while none of the four has been started, and "Next lesson · counting" after that.
   3. When all four are completed, the card shows only "All 24 lessons", with the number completed.

   A lesson the learner can't open is skipped: one withheld by Check protection, one that needs a connection, or one not written yet. If every remaining counting lesson is withheld by an unfinished Check attempt, the card reads "Counting lessons open after your Check attempt" with Return to attempt.
3. **Settings › Learning holds the switches only:** a row that opens the Counting tab, "Show Start here on Home", and "Show first-use hints again". The Settings row's detail reads "Start here card, first-use hints".
4. **Help is always in a table's top bar** and opens a Help sheet:
   - The first row continues the game's in-progress lesson, or starts its first lesson not yet completed, skipping withheld ones. It is hidden when none is left.
   - "All <game> lessons" opens the catalog filtered to that game's section, with Show all.
   - A line says a lesson suspends the session (rule 6).
   - When the screen has hints, "Show this screen's hints again" is listed under This screen.

   Help no longer reopens hints by itself.
5. **Help inside a counting attempt** keeps operational help (spec 3 S3-05) and adds the hints row. It never links to a lesson. During a Check attempt its notice reads "Lessons open after this attempt", followed by what spec 3 Amendment 1 A2 withholds.
6. **Suspension wording.** Leaving Play suspends the practice session immediately, in its committed phase. Navigation is a resume-on-return cause, so returning to Play resumes it. The S1-11 suspended screen shows only when resuming is blocked, for example by Check protection. The sheet's line, "Opening a lesson suspends this session. It's saved exactly as it is and picks up where you left off when you come back to Play.", is true in both cases.
7. **Lesson screens live on the Counting tab**, so the tab bar selects Counting wherever they open from. Back returns to where they were opened. The back label names the destination: Counting, Home (Start here), "<Game> table" (table Help), "<Game> setup" (Learn this game), or Lessons (from the catalog into a lesson). Leaving lessons empties the Counting stack, so the tab opens on the hub next time. The handoff and gate screens say "Back to <destination>".

## Routes

- `app/(tabs)/counting/` is a stack: `index.tsx` (the hub and attempts), `lessons/index.tsx` and `lessons/[lesson].tsx`. More no longer hosts lessons.
- `lessons/routes.ts`: `lessonsHref` and `lessonHref` take a section, a `from` origin (`counting`, `home`, `table`, `setup`), `all` (Show all) and `catalog` (opened from the catalog). `lessonsBack` resolves the label and target.
- Old links (`/more/settings/learning/lessons…`) are rewritten by `app/+native-intent.tsx` before routing. A redirect route under More would stay on the More stack and send the More tab back to the lesson every time.
- Handoffs, Return to attempt and Check protection are unchanged. The gate still offers Return to attempt and End attempt.

## Also fixed

- **Full-screen sheets respect the safe area.** Above font scale 1.5 a sheet turns full screen (`text-size-type-floor.md` rule 10). It now pads by the top and bottom safe-area insets, so its title and Close button no longer sit under the status bar.

## Spec amendments

Posted 2026-11-19: [spec 3 A8](https://github.com/0xRowdy/tableside/issues/53#issuecomment-7028520148), [spec 1 A14](https://github.com/0xRowdy/tableside/issues/51#issuecomment-7028520461).

| Spec | Amendment |
| --- | --- |
| [#53](https://github.com/0xRowdy/tableside/issues/53) spec 3 A8 | Lessons › Entry points: the full catalog is on the Counting tab, which leads with a Lessons card (rule 2). The Counting tab entry replaces More → Settings → Learning as the catalog's home. Each table's Help sheet opens that game's lessons (rule 4). S3-01: hub layout (rule 1). S3-11: back labels and the filtered catalog (rule 7). Settings › Learning: switches only (rule 3). User story 4 reads "reopen the full lesson catalog from the Counting tab". Check protection is unchanged. |
| [#51](https://github.com/0xRowdy/tableside/issues/51) spec 1 A14 | S1-04: Help is always in the table top bar, left of End session, and opens the Help sheet (rules 4 and 6). |

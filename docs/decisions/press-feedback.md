# Press feedback and the readiness milestone seal

Accepted 2026-11-24. Two narrow refinements inside DESIGN.md's mood rule: calm, exact and warm, with warmth that comes from material rather than effects. Every pressable used to drop to 80% opacity on press. Up close that looked like a step toward the 40% "not available" state, and it dimmed the label under the finger. The readiness milestone on Results used the same box as a personal best. The owner approved the frames first; the code followed.

## Frames

In `design/Tableside.pen`. The NOTES board `egBbr` has the section "Delight · 24 Nov", in the spec 6 column.

| What | Standard | Larger | Replaces |
| --- | --- | --- | --- |
| Chrome controls: rest, pressed, keyboard focus, focus then pressed, unavailable | `TlHUq` | `y0vT7` | — |
| Table pieces: bet spot, craps spot, roulette pockets, chip | `RsrEO` | `u6KqZy` | — |
| S3-08 Results, readiness milestone earned | `ipoWU` | `Dylpr` | `CEb6T` |

## Rules

1. **A press seats the control; it never fades it.** The fill goes one step darker for its material (`pressStyle` in `apps/mobile/src/theme/press.ts`):
   - `brass`: Rail Brass goes to Seated Brass (`primaryPressed` `#B08B45`), fill and edge. The label stays at 5.8:1 and the button at 5.9:1 on the ground.
   - `feltShadow`: controls filled Felt Shadow with their own Control Edge (outline buttons, keypad keys, Learn and Check, answer choices, bet selector stake buttons) go to Deep Baize.
   - `edgeless`: pill buttons with no edge (secondary, ghost, Home's Community button, quiet lesson and first-run buttons) go to Deep Baize and show their Control Edge, which keeps them at 3:1 against the ground while held.
   - `row`: rows, options, links and icon buttons on a card or the ground take Felt Shadow, as Settings rows already did.
   - `paper` and `ink`: Marcus's outline action takes pressed paper (`coachPressed` `#E8E0CC`); his ink action softens to `inkPressed` `#3A332A`.
2. **Table pieces darken under Press Shade.** `PressShade` (`apps/mobile/src/play/TableChrome.tsx`) lays `pressShade`, black at 35%, over the piece's own color, under its label. Bet spots, craps spots and roulette spots shade their whole face. A chip shades its slot on the rail, not its face: the 1K chip's ink value would drop to 3.3:1 under the shade, so the frames `RsrEO` and `u6KqZy` were brought in line. Chalk edges, wager markers and "IN PLAY" are unchanged, so the wagered, selected and in-play cues keep their meaning. A black roulette pocket barely darkens; its number and edge are unchanged.
3. **Focus keeps its own channel.** Keyboard focus stays the reserved 2px border in Linen, Rail Brass or Coach Blue, and wins over a press's edge. Focus and press never look alike.
4. **Opacity means one thing: 40% is unavailable.** An unavailable control gets no press response. Bet spots and craps spots keep today's unavailable look: no press response and no dimming.
5. **Nothing moves.** Press states are instant color changes, with no scale, bounce or animation, so there is nothing for Reduce Motion or Remove animations to remove, and nothing in the app reads those settings yet. A change that animates later must respect both, with its own test.
6. **The milestone is a brass seal on Lamplit Panel.** When a Check earns a readiness milestone, its box moves up to `popover` with a 1px brass edge, and the flag becomes a 44pt brass seal: a Rail Brass disc with a Brass Shadow rim and flag. The personal-best pill inside it takes a Control Edge border and a Linen trophy, so brass marks only the milestone. The pill's text now wraps inside the box at Larger, where it ran past the edge before, and its corners are 16 so a wrapped pill stays a rounded rectangle. On one line it looks the same as before. The personal-best box (`liAfT`) shares the pill, so its pill wraps the same way at Larger; otherwise it and the kept-milestone box (`cfKTT`) are unchanged, so earning a milestone no longer looks like a personal best. Copy, layout, cue 16 `milestone` and its success haptic are unchanged, and no sound is added.

## Enforcement

- `apps/mobile/eslint.config.js` refuses a `pressed: { … }` style object anywhere in `src`. Press styles come from `pressStyle` or `PressShade`. `src/components/GameCard.tsx` keeps its 85% press for now and is on the `PRESS_FEEDBACK_TO_MOVE` allowlist.
- Every new pairing is in `essentialPairs`. Pairs marked `underPressShade` are checked with `pressShade` composited over their background.
- `apps/mobile/__tests__/press-feedback.test.tsx` holds controls down and checks the pressed, focused and unavailable styles; `readiness-screens.test.tsx` checks the seal.

## Not changed

- The haptic catalog, net-win and net-loss moments, copy and layout.
- The Home game cards' 85% press, the lesson catalog's 60% "held" rows, and controls with no press feedback (tab bar, segmented control, switch rows, sheet close). These are listed for the owner.

## Spec amendments

Posted 2026-11-25: [spec 1 A16](https://github.com/0xRowdy/tableside/issues/51#issuecomment-7172807013), [spec 3 A15](https://github.com/0xRowdy/tableside/issues/53#issuecomment-7172808050).

| Spec | Amendment |
| --- | --- |
| [#51](https://github.com/0xRowdy/tableside/issues/51) spec 1 A16 | Visual system › component states: a press seats a control by darkening its fill for its material (rules 1–2), never by opacity or motion. Keyboard focus keeps its own border (rule 3). 40% opacity marks an unavailable control only (rule 4). Table pieces darken under Press Shade, and a chip shades its slot. Frames `TlHUq`, `y0vT7`, `RsrEO`, `u6KqZy`. |
| [#53](https://github.com/0xRowdy/tableside/issues/53) spec 3 A15 | S3-08: `ipoWU` (Larger `Dylpr`) replaces `CEb6T`. The earned milestone sits on Lamplit Panel with a brass seal, and its personal-best pill takes a Control Edge and a Linen trophy (rule 6). Cue 16 and its haptic are unchanged. Count keypad keys, Learn and Check, answer choices and Marcus's actions follow spec 1 A16's press states. |

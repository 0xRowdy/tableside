# Onboarding and tutorial curriculum — accepted decision

Planning for [Onboarding and tutorial curriculum](https://github.com/0xRowdy/true-count/issues/48). Accepted through live discussion and explicit prototype approval.

## Accepted direction

Accepted in the live planning conversation on 2026-09-14:

- After required account and eligibility steps, land on the three-game Home screen with a dismissible “Start here” card. Introduce app controls when first encountered and make explanations available again later.
- Combine short explanations with optional interactive worked examples, followed by an explicit handoff to free play, guided practice, or a Learn counting challenge. The accepted allowance boundary is recorded below.
- Ship a bounded learning catalog covering basics for each launch game, every built-in strategy and blackjack training mode, all four counting skills, and strategy-builder basics. Lessons are individually accessible without mandatory sequencing or a placement test.

## Competitor reference

The user identified [CQ Nexus](https://play.cqnexus.com/) as a direct competitor. Its public site, inspected on 2026-09-14, advertises immediate hints with reasons, configurable tables, strategy and counting tools, and achievements/analytics. This is a public-site observation, not a hands-on verification of its teaching flows. It provides competitive context; it does not amend True Count's accepted launch scope, pricing, or progression contracts.

## Accepted examples, progress, and help

- Fixed demonstrations with a few scripted interactions are unlimited and freely replayable. This is an explicit allowance exemption for bounded demonstrations. Actual guided practice and counting challenges retain their existing accounting, starting at their existing activity boundaries.
- Remember the last lesson step and completed lessons across devices. Offer Resume and Restart. Completion means finishing the explanation/example, without a score or unlock.
- Offer game-specific lessons from each game's entry screen, builder help inside the editor, and the full catalog through Start here and Settings.
- During Check challenges, operational help remains available; instructional examples wait until afterward to protect assessment.

## Existing constraints

- Required account/eligibility setup and offline fallback-game selection precede ordinary use.
- Existing practice and challenge allowance accounting applies unless explicitly amended. Explanations are excluded from active guided-practice time; a counting attempt is charged at first exercise content.
- Existing free/premium offline access applies; counting belongs to blackjack content.
- Tutorial progress must not imply new readiness awards, challenge scores, prerequisite locks, or financial-performance claims.
- Preserve the reviewed visual system and persistent bottom navigation. Use illustrative prototype examples without certifying blackjack numeric references.

## Accepted curriculum inventory

Twenty-four short lessons, with optional examples and no prerequisite locks:

- App orientation: one lesson on navigation, help, and practice versus casino records.
- Blackjack: basics; four lessons for Basic, Basic with deviations, Counting with basic, and Counting with deviations; four lessons for card values, running count, true-count conversion, and table counting; one optional bet-schedule lesson. Table counting covers Learn/Check and Observe/Play without creating extra challenge categories.
- Standard craps: basics plus one lesson each for Pass with odds, Flat place 6 and 8, Don't pass with lay odds, bounded Three-point Molly, and capped press-and-collect 6 and 8.
- Roulette: basics plus one lesson each for Flat even-money, Fixed two-dozen coverage, capped Martingale, Three-win parlay, and bounded Labouchere.
- Builder: one lesson covering conditions, wagers/amounts, explanations, conflicts, fallbacks, and stopping.

Game basics introduce the bet/action controls, table conditions, turn phases, settlement and funding. Strategy lessons cover initial state, next actions, outcome adjustments, limits and stopping/final settlement; progression examples must explain that changing stakes does not remove the game's house advantage. Final lesson copy and qualified numerical examples remain authoring work.

## Accepted prototype review

The user explicitly approved the [prototype](https://github.com/0xRowdy/true-count/blob/cfa1e3f/docs/prototypes/onboarding-tutorial.prototype.html), retained on the throwaway branch `prototype/onboarding-tutorial`. All state is in memory; device switching simulates synchronization rather than implementing it. Existing production gameplay/editor behavior is represented only by handoff boundaries.

Walkthroughs cover skipping into free play, cross-device Resume/Restart, offline interruption, depleted allowance with unlimited examples, and Check operational help followed by instruction after ending. Muted operation and a large-text toggle are available. All five walkthroughs executed successfully using a minimal DOM harness; the user subsequently approved the prototype. Production physical-device/accessibility verification remains an implementation release check.

Accepted in Q8: keep completion when restarting; merge completion across devices while the most recently synced bookmark wins; retain offline progress until synchronization; explain a restart when a lesson materially changes, preserving prior completion history.

The prototype applies existing offline game access to game lessons and offers generic app/builder help offline. These presentation choices were accepted through prototype approval.

## Implementation acceptance checks

- Required setup precedes Home; dismissing teaching never bypasses eligibility or access checks. Lessons remain reachable after dismissal.
- All 24 lessons are individually accessible within game access, with optional examples and explicit training handoffs. Fixed examples never consume allowance or create scored practice results; actual activities retain existing charge boundaries.
- Resume, Restart, completion retention, offline synchronization and materially changed lessons follow the accepted progress rules without moving an active training attempt between devices.
- Check help reveals no instructional answers during the attempt; finishing or explicitly ending it restores instructional access without awarding unearned completion/readiness credit.
- Muted operation, large text, accessible controls and supported device layouts preserve complete instructional information.
- Final lesson copy, qualified numeric coaching, art/audio production and production implementation remain separate work. Audio scope is the next map decision.

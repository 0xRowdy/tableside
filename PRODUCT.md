# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One Expo / React Native codebase ships to iOS/iPadOS and Android with one Tableside look. Each OS keeps its native conventions: back behavior, sheets, Sign in with Apple and Google sign-in, store purchase and subscription sheets, VoiceOver and TalkBack, and 44pt or 48dp minimum touch targets. The mobile app (`apps/mobile`) is the product.

`apps/web` is a narrow companion: a signed-in account page for account management only (no play, no records). It inherits this file. Its CSP forbids third-party scripts, fonts, analytics and trackers.

## Users

Primary users are recreational table-game players. They practice between casino trips: at home or on the go they sharpen strategy and counting, then log real casino sessions to compare against their practice. Beginners learning the games are a secondary audience.

The audience is likely older (owner, 2026-11-18). Many players keep their phone at its default text size and read with glasses, so screens must be comfortable at default settings, not only once the system text size is raised.

Eligibility starts at 13. The app is not marketed to teens and has no under-13 flow. It launches for US storefronts, in US English only.

## Product Purpose

Tableside is for practicing and tracking table games. The launch games are blackjack, standard craps and roulette, each with free play and guided practice against a chosen strategy. Blackjack adds strategy coaching and card-counting challenges: card values, running count, true-count conversion, and counting during simulated play. Players build their own strategies, practice community ones, and keep separate histories for simulated practice and for casino sessions they enter by hand.

Success: a player's adherence to their chosen strategy improves, and they can see it honestly. Practice results, simulation results and real casino results never blur into one number.

## Positioning

- **Coaching before the mistake.** Guided practice pauses before a move departs from the selected strategy, explains the prescribed action, and lets the player retry or explicitly override.
- **Adherence and winnings are measured separately.** Following the strategy is scored on its own, never inferred from the balance.
- **Evidence kinds stay apart.** Standardized simulation results, the player's own practice results and self-reported casino results are distinguished everywhere. Popularity and performance are also kept separate.
- **No real money, ever.** Bankrolls are tracking ledgers. The app holds no funds, takes no real wagers and offers no prizes.

## Operating Context

- Sessions are short and replayable. Challenges reward accuracy before speed, with personal bests and optional timing.
- Players log casino sessions after or during a casino trip. Session logging works offline and syncs on reconnection.
- Play works offline after the first online sign-in. Free accounts choose one offline game. Tableside Premium unlocks all three offline games.
- Supported: phones and tablets on iOS/iPadOS 16.4+ and Android 10+, in portrait and landscape. Rotation and resizing never lose in-progress input, wagers or answers.
- Community browsing, publishing and rating need a connection.

## Capabilities and Constraints

- Domain language is canonical in `CONTEXT.md`. Use its terms (Turn, Practice session, Casino session, Strategy revision, Working copy, Suspension vs Pause, Tableside Premium, etc.) and their _Avoid_ lists in UI copy.
- Every table has a graphical layout and an equivalent named **bet selector**. Both operate the same session and are available to everyone.
- Tables show the house edge. It is a property of the rules, never of a strategy or a player.
- **Tableside Premium** gives unlimited training, all three games offline, no ads, and the ability to publish and rate community strategies. Free accounts get a daily training allowance and may see contextual ads at natural breaks (adults only). Ads never interrupt a hand, roll, spin or counting challenge. Pricing is provisional ($5.99/month, $39.99/year) and is always shown as the price the store returns. There is no trial and no lifetime plan.
- Teens and accounts with unresolved age get no ads and no optional analytics. Optional adult analytics is opt-in only, with no session replay.
- Accounts sign in with an Apple ID, a Google account, or an email code. Account deletion has a 30-day undo window. Export, device revocation and rights requests are first-class flows.
- Accepted planning decisions live in `docs/decisions/`. The MVP specs (#51–#57) and their amendments supersede `docs/brief.md` where they differ.
- **Undecided:** achievements and practice streaks are deferred to later and must never change what a readiness milestone means. A dashboard-style Home is a later A/B variant, not MVP.

## Brand Commitments

- Product name: **Tableside**. Premium tier: **Tableside Premium**, never "Plus" or "premium account". "True Count" was a working name only; true count remains the blackjack term.
- Coach persona **Marcus** is kept. All explanation text comes from the engine's generated explanation facts, never freehand claims. The persona's assets need provenance records.
- Owner ruling (2026-10-18): the dark/gold Tableside design is the MVP's only theme. Light mode is out of MVP scope, and colors are named tokens so it can be added later.
- Teaching content is original: independently implemented strategies, validated calculations, and original explanations and chart designs. Third-party material is reference-only unless item-specific rights are recorded. A Sources & credits page links the sources actually used.

## Evidence on Hand

- Design frames: `design/Tableside.pen` and `design/Tableside-assets/`. Read frames through the CLI (see `docs/agents/design-frames.md`); Pencil editing access ended 2026-11-17.
- Research: `docs/research/` holds strategy, lessons, pricing, privacy and age-eligibility research. Game-rule and strategy sources include Blackjack Apprenticeship, Casino Quest, Wizard of Odds and QFIT, all for reference and research attribution only.
- **Absent:** no users, testimonials, reviews, ratings, download counts, press or endorsements exist. Do not invent any of them. Example data in frames (scenario personas like Dana, fixed counts and balances) is illustrative only.

## Product Principles

1. **Honest records over flattering ones.** Never merge evidence kinds, invent a result for an unusable session, or let winnings stand in for skill.
2. **Teach at the moment of decision.** Correct before the move, explain why, and leave the choice with the player through explicit override.
3. **Never interrupt the turn.** Ads, prompts, upsells and suspensions wait for natural breaks. A suspended activity resumes exactly where it was.
4. **Offline is a promise.** Once signed in, play and logging must not depend on connectivity, ads loading or verification round-trips beyond the stated rules.
5. **Practice, not gambling.** No real wagers, no prizes, no hype that implies winning money. Information about the odds (house edge, drawdown, sample sizes) is shown plainly.

## Accessibility & Inclusion

Launch requires complete accessible operation across all three games, counting challenges, strategy building and saved records:

- VoiceOver and TalkBack, keyboard and switch control, with visible focus and no focus traps.
- Every flow works at the largest system text and display sizes, reflowing instead of shrinking.
- Default sizes are tuned for older eyes. The text a player must read is comfortable at the phone's default text size, and the card being counted is never the smallest thing on screen.
- Contrast is at least 4.5:1 for essential text and at least 3:1 for essential graphics and control boundaries.
- Suits, selections, working/off states, errors and results have explicit non-color cues.
- Reduced motion is respected. No information depends on motion, audio or haptics alone.
- Every drag, long press or complex gesture has a simple alternative.
- Spoken cards are self-paced by default.
- Accessibility never reveals hidden information: concealed ranks, vanished cards, reference counts, or Check-mode answers.

Performance targets on older supported devices: 95% of input is acknowledged within 100 ms, and 95% of offline cold starts are usable within 5 s. Full contract: `docs/decisions/mobile-device-support-accessibility.md`.

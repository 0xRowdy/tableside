# Mobile visual direction and core navigation — accepted decision

Accepted through live review of the [three-variant throwaway prototype](https://github.com/0xRowdy/true-count/blob/b7a82eee9f231bbe5be9498e5df6aa909ebdce3e/docs/prototypes/mobile-visual-direction.prototype.html) for [Mobile visual direction and core navigation](https://github.com/0xRowdy/true-count/issues/30). This is a planning decision; it does not implement the production app.

## Accepted visual system and navigation: Variant A ("Tab Bar Hub")

Adopt variant A's light theme, green accent palette, card-based components, rounded corners, and typographic hierarchy as the launch visual system, and its persistent bottom tab bar as the sole global primary navigation, across every screen: table & bet selector, counting challenge, strategy editor, community detail, and saved records.

If an additional menu is ever needed beyond the five tab-bar destinations, it extends the tab-bar pattern (e.g. a "More" tab), not a separate hamburger/avatar-menu affordance. Variant C's menu-only global navigation (no persistent nav bar, cross-game features reached only through a hamburger icon) is rejected as the app's primary navigation model.

## Home screen: Variant C's card layout inside Variant A's chrome

The home screen departs from variant A's card-grid: use variant C's full-bleed, stacked game-card layout (Blackjack, standard craps, roulette as three large tappable cards) as the entry content. This content sits inside variant A's persistent bottom tab bar, not variant C's chrome-less presentation — the tab bar remains visible on the home screen exactly as on every other screen.

## Table & bet selector, strategy editor, community detail, saved records

Use variant A as prototyped: variant A's colors/visual system for the table and bet-selector toggle; variant A's block-based rule list for the strategy editor; variant A's card layout for community detail (rating, evidence, remix/report/save actions); variant A's segmented practice/casino list for saved records.

## Counting challenge

Variants A and C were judged equivalent for this screen. Use variant A's presentation as prototyped (Learn/Check/Observe/Play chip toggle, concealed running-count card, dealt-card progress, personal-best card) — it is not materially different from C's for this screen, so no reconciliation is needed.

## Rejected

- Variant B's icon-rail chrome (sidebar/top-strip) and carousel-based home hub, and its dark visual theme, were not selected for any screen.
- Variant C's chrome-less, menu-driven global navigation was not selected as the app's primary navigation; only its home-screen card layout was carried forward.

## Remaining boundaries

Exact color tokens, spacing scale, component states (pressed/disabled/error), onboarding, audio catalog, and tutorial curriculum remain for implementation-time design. The prototype's fixed example data ("Session active — Shoe 3 · Hand 12", "Best streak: 14", etc.) is illustrative only and establishes no real session, count, or ledger values.

# Planning decisions

Accepted decision records from the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1). Each file preserves one resolved decision ticket in full; the ticket's resolution comment links back here.

These are historical records. The MVP specs ([#51](https://github.com/0xRowdy/true-count/issues/51)–[#57](https://github.com/0xRowdy/true-count/issues/57)) and their amendment comments collapse the decisions into buildable plans and **supersede these records where they differ**. Known differences:

- **Product name:** the records say "True Count"; the product is **Tableside** (owner decision, 2026-10-18). "True count" remains the blackjack term.
- **Visual direction** (`mobile-visual-direction-core-navigation.md`): the light theme was replaced by the dark Tableside theme, and navigation is six tabs (Home, Play, Counting, Community, Saved, More). See spec 1 Amendment 1.
- **First-run order and age** (`prelaunch-age-eligibility.md`, `authentication-account-lifecycle.md`): age is asked on Create only; Sign in never asks it. See spec 2 Amendment 3.
- **Backend:** Supabase was re-checked against Convex and retained on 2026-10-19 (see [#21](https://github.com/0xRowdy/true-count/issues/21)).

Vocabulary lives in [`CONTEXT.md`](../../CONTEXT.md).

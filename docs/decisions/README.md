# Planning decisions

Accepted decision records from the [MVP decision map](https://github.com/0xRowdy/tableside/issues/1). Each file preserves one resolved decision ticket in full; the ticket's resolution comment links back here.

These are historical records. The MVP specs ([#51](https://github.com/0xRowdy/tableside/issues/51)–[#57](https://github.com/0xRowdy/tableside/issues/57)) and their amendment comments collapse the decisions into buildable plans and **supersede these records where they differ**. Known differences:

- **Product name:** the records say "True Count"; the product is **Tableside** (owner decision, 2026-10-18). "True count" remains the blackjack term.
- **Visual direction** (`mobile-visual-direction-core-navigation.md`): the light theme was replaced by the dark Tableside theme, and navigation is five tabs (Home, Play, Counting, Saved, More), with Community first in More. See spec 1 Amendment 1 and [`text-size-type-floor.md`](text-size-type-floor.md).
- **Type and text size** (`mobile-device-support-accessibility.md`): defaults are tuned for older eyes. There's a 12pt floor, a role ramp, and a per-installation Text size setting (Standard, Large, Larger) that multiplies with the system size. See [`text-size-type-floor.md`](text-size-type-floor.md).
- **First-run order and age** (`prelaunch-age-eligibility.md`, `authentication-account-lifecycle.md`): age is asked on Create only; Sign in never asks it. See spec 2 Amendment 3.
- **Backend:** Supabase was re-checked against Convex and retained on 2026-10-19 (see [#21](https://github.com/0xRowdy/tableside/issues/21)).

Vocabulary lives in [`CONTEXT.md`](../../CONTEXT.md).

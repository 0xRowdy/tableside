# Coding standards

Judgement calls a reviewer checks; lint, types and tests enforce the rest.

- **UI matches its final frame.** A departure from the frame is a finding unless a spec amendment allows it; read frames per `docs/agents/design-frames.md`. Why: the frames are the reviewed design.
- **Per-game player wording comes from `apps/mobile/src/play/game-words.ts`.** Why: one place says "spin", "roll" or "round", so a shared screen reads right for every game.
- **Game-specific rules live behind the engine's `GameModule`** (`packages/engine/src/activity.ts`), not in per-game branches in shared code. Why: adding or changing a game touches one module.
- **Money goes through the engine's Money helpers** (`packages/engine/src/money.ts`), **and in the app through `apps/mobile/src/play/units.ts`.** Why: amounts stay exact fractions with one canonical text form.
- **Table UI shared across games lives in `apps/mobile/src/play/TableChrome.tsx`.** Why: the chrome frames are shared, so a fix lands at every table.
- **Test expectations come from independent sources:** rules tables, published vectors, hand-worked examples (`docs/cross-runtime-harness.md`). Why: an expectation computed the way the code computes it only repeats the code.
- **Names and copy use `CONTEXT.md` vocabulary, in US English.** Why: one word per concept, in code and on screen.

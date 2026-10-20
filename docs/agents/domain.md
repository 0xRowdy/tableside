# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One `CONTEXT.md` at the repo root, with ADRs under `docs/adr/`.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the glossary of Tableside's domain language (table conditions, rule presets, strategies, counting systems, training allowances, and so on). The product was planned as "True Count", which is still the repository's name.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved. `docs/adr/` does not exist yet, and that's fine.

## File structure

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/                ← created lazily, when a decision is actually recorded
│   │   ├── 0001-....md
│   │   └── 0002-....md
│   └── agents/             ← this configuration
└── src/
```

If this repo ever splits into genuinely separate contexts, the multi-context layout is a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context, with context-scoped decisions in `src/<context>/docs/adr/` alongside system-wide ones in `docs/adr/`. Don't adopt that shape pre-emptively.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids — for example, `running count` and `true count` are distinct defined terms, as are the `Learn` and `Check` challenge variants.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

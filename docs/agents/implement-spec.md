# Implementing a spec

A spec is a GitHub issue; its tickets are sub-issues. Tickets merge into the spec's integration branch `spec/<n>-<slug>`, and that branch merges to `main` as one PR. The orchestrator hands each ticket to an implementer, then to a merger.

## Contract

- The ticket's acceptance criteria (`gh issue view <ticket> --comments`) are the contract.
- The spec (`gh issue view <n> --comments`) carries the body and its amendments in comments; later amendments win. Read the sections the ticket cites and every amendment.
- Screens: [design-frames.md](design-frames.md). Vocabulary: `CONTEXT.md`. Review rules: `CODING_STANDARDS.md`.
- Background: `docs/decisions/` (specs supersede them), `docs/development.md`, `docs/cross-runtime-harness.md`.
- Work a later spec owns stays a stub behind its port (for example an in-memory store, an always-allow access supervisor) until that spec replaces it.

## Implementer

You build one ticket in your own worktree.

1. `git fetch origin`, base the worktree on the integration branch tip (`git reset --hard origin/spec/<n>-<slug>`), create `ticket/<t>-<slug>`, `pnpm install`.
2. Build the ticket with Skill `tdd`. Engine cases go in `packages/engine/test/*.cases.ts` and `suite.ts`.
3. Commit with conventional commits, `#<t>` in the body.
4. Run Skill `code-review` on your branch since its merge-base with the integration branch. Fix each finding or record why it is invalid; commit the fixes.
5. Merge the integration branch's current tip into your branch, resolve conflicts, and get `pnpm typecheck && pnpm lint && pnpm test` green.
6. Report: branch, worktree path and head sha; each acceptance criterion met or not (with the reason); each review finding fixed or invalid (with the reason); anything deferred, such as device-only criteria or gaps in the frames.

The merger owns the integration branch: leave pushing, PRs and issue state to it. Run the Node harness leg only (`pnpm --filter @tableside/engine test`); the orchestrator runs the iOS and Android legs one at a time, since they share the devices.

## Merger

Run from the checkout that has the integration branch.

1. Confirm the branch and a clean tree, then `git pull --ff-only`.
2. `git merge --no-ff <ticket-branch> -m "Merge <ticket-branch>: <ticket title> (#<t>)" -m "Closes #<t>"`. Resolve conflicts keeping both sides' intent (Skill `resolving-merge-conflicts`).
3. `pnpm install`, then `pnpm typecheck && pnpm lint && pnpm test`. Fix a red check in a separate commit referencing `#<t>`; if the fix isn't quick, reset to the pre-merge sha and report.
4. `git push origin spec/<n>-<slug>`.
5. Report the merge sha, check results and any fixes. Issues close when the spec PR merges.

## Recorded checkpoints

A change to `STATE_SCHEMA_VERSION` or to engine behaviour fails `tests/recorded-checkpoints.test.ts` until the build's recording is redone; the failure prints the steps, and `docs/development.md` (*Releases*) explains the rule. Commit the new recording referencing the ticket.

# Implementing a spec

A spec is a GitHub issue; its tickets are sub-issues. Tickets merge into the spec's integration branch `spec/<n>-<slug>`, and that branch merges to `main` as one PR. The orchestrator hands each ticket to an implementer, then to a merger.

Handoffs travel in merge commit bodies: the implementer's report names what later tickets must know, the merger records it in the merge commit, and implementers read it from `git log`. When the integration tip moves, the orchestrator tells running implementers only the new sha.

## Contract

- The ticket's acceptance criteria (`gh issue view <ticket> --comments`) are the contract.
- The spec (`gh issue view <n> --comments`) carries the body and its amendments in comments; later amendments win. Read the sections the ticket cites and every amendment.
- Screens: [design-frames.md](design-frames.md). Vocabulary: `CONTEXT.md`. Coding standards: `CODING_STANDARDS.md`.
- Background: `docs/decisions/` (specs supersede them), `docs/development.md`, `docs/cross-runtime-harness.md`.
- Work a later spec owns stays a stub behind its port (for example an in-memory store, an always-allow access supervisor) until that spec replaces it.

## Checks

The checks are `pnpm typecheck && pnpm lint && pnpm test`, plus seam 2 when the branch touches `supabase/` or `packages/account`. Seam 2 runs on your stack slot: the orchestrator assigns each implementer its own (1–9); the merger uses slot 0 in the main checkout. Prefix every `pnpm stack` and `pnpm test:accounts` with `TABLESIDE_STACK_SLOT=<slot>` (a worktree refuses to run without it):

```sh
pnpm stack start --exclude studio,imgproxy,vector,logflare   # after a config.toml or edge-function change: pnpm stack stop first
pnpm stack db reset
pnpm test:accounts
pnpm stack stop                                              # implementers only, when done
```

A Docker command that hangs for over two minutes: stop and report it; the orchestrator recovers Docker.

A check is done when it has exited and you have its result. Run checks in the foreground with a timeout long enough for them to finish, or wait on a background one until it exits.

## Implementer

You build one ticket in your own worktree.

1. `git fetch origin`, base the worktree on the integration branch tip (`git reset --hard origin/spec/<n>-<slug>`), create `ticket/<t>-<slug>`, `pnpm install`.
2. Build the ticket with Skill `tdd`. Engine cases go in `packages/engine/test/*.cases.ts` and `suite.ts`. Create each migration with `supabase migration new <name>` when you write it, so its version is the current time.
3. Commit with conventional commits, `#<t>` in the body.
4. Run Skill `code-review` on your branch since its merge-base with the integration branch. Fix each finding or record why it is invalid; commit the fixes.
5. Bring in the integration tip:
   1. Read the handoffs merged since your base: `git log --first-parent --format='%h %s%n%b' HEAD..origin/spec/<n>-<slug>`.
   2. `pnpm check:migrations --ticket HEAD --into origin/spec/<n>-<slug>`. Fix each problem it reports (a stale version gets `git mv` to a fresh one). For each definition it lists, start your migration's definition from the integration branch's and keep both changes.
   3. Merge `origin/spec/<n>-<slug>`, resolve conflicts, and get the checks green.
6. Report, as your last message, once every check you started has exited: branch, worktree path and head sha; each acceptance criterion met or not (with the reason); each review finding fixed or invalid (with the reason); check results; for each screen the ticket changes, a simulator screenshot (a recording for motion or a flow) beside the frame id it matches; anything deferred, such as device-only criteria or gaps in the frames; and the **handoff**: what later tickets must know (new seams and ports, SQL functions redefined, store schema or recordings changed, work left to another ticket).

The merger owns the integration branch: leave pushing, PRs and issue state to it. Run the Node harness leg only (`pnpm --filter @tableside/engine test`); the orchestrator runs the iOS and Android legs one at a time, since they share the devices.

## Merger

Run from the main checkout, which has the integration branch and stack slot 0.

1. Confirm the branch and a clean tree, then `git pull --ff-only`.
2. `pnpm check:migrations --ticket <ticket-branch>`, and keep its output for step 4.
3. `git merge --no-ff <ticket-branch> -m "Merge <ticket-branch>: <ticket title> (#<t>)" -m "Closes #<t>" -m "Handoff: <the implementer's handoff>"`. Resolve conflicts keeping both sides' intent (Skill `resolving-merge-conflicts`).
4. Fix each problem from step 2 and reconcile each definition it listed, in a separate commit referencing `#<t>`.
5. `pnpm install`, then the checks (seam 2 on slot 0). Fix a red check in a separate commit referencing `#<t>`; if the fix isn't quick, reset to the pre-merge sha and report.
6. `git push origin spec/<n>-<slug>`.
7. Report, as your last message, once every check you started has exited: the merge sha, check results and any fixes. Issues close when the spec PR merges.

## Recorded checkpoints

A bump to `STATE_SCHEMA_VERSION` or `ENGINE_VERSION` fails `tests/recorded-checkpoints.test.ts` until this build has a recording; the failure prints the steps. A behaviour change without a bump never fails that test, and fails the engine suite only when a recorded outcome moves, so after any engine behaviour change run `pnpm --filter @tableside/engine record-checkpoints --replace` yourself. `docs/development.md` (*Releases*) explains the rule. Commit the new recording referencing the ticket.

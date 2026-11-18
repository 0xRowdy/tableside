# Development

## Layout

| Path | What it is |
| --- | --- |
| `apps/mobile` | The Tableside app: React Native, Expo development builds, bundled Hermes. Routes live in `src/app`. |
| `apps/web` | The web account page (spec 2, #106; S2-24): a static page, reachable without the app, to sign in with an email code, schedule or cancel deletion, delete permanently now and see deletion status. Plain TypeScript and DOM built with Vite; its client is `@tableside/account/web`. See *The web account page* below. |
| `packages/engine` | The shared game engine: portable TypeScript that runs unchanged on Hermes and Node. |
| `packages/definitions` | Versioned game content: rule presets, built-in strategies, the blackjack reference. |
| `packages/runner` | The headless runner: standardized sessions of any built-in strategy on a benchmark profile, on Node (`pnpm --filter @tableside/runner start --strategy <id> --profile <id> --key <16 hex>`). Spec 6 adds the coordinator and analysis. |
| `packages/harness` | The cross-runtime test harness. See [cross-runtime-harness.md](cross-runtime-harness.md). |
| `packages/account` | The Account service (spec 2): the app's one interface for anything account-shaped, with its observable account gate. `src/testing` is seam 2's multi-device scenario harness. The Supabase, Auth, provider and device behavior it depends on is in [account-service.md](account-service.md). |
| `supabase` | The backend: local stack configuration, migrations (the account authority schema, RLS, storage policies, jobs) and edge functions (`request-code`, the only way to get a code by email; `bind-provider-assertion`, which binds Create's age assertion to an Apple or Google identity; `provider-callback`, Apple's web-flow redirect on Android; `fresh-auth`, Confirm it's you; `link-method`, adding a sign-in method; `revoke-devices`, signing other devices out; `schedule-deletion`, scheduling account deletion with its 30-day undo; `record-gpc`, the web account page's Global Privacy Control opt-out; `provider-notifications`, Apple's and Google's security events (provider revocation); `send-email`, Auth's send-email hook, which sends only Secure Email Change's codes; `reviewer-sign-in` and `provision-reviewer`, app reviewers' access to reviewer accounts; `export-job`, which the database wakes to build server exports into the private `account-exports` bucket and remove ended ones; `deletion-job`, which the database wakes after permanent deletion's irreversible boundary to run the cleanup steps that need services outside it, behind the ports in `functions/_shared/deletion-ports.ts`; `provider-grant`, which keeps an Apple or Google grant, sealed, for deletion to revoke). The functions share `_shared/service.ts` (service-role calls, `rpcJson`, `readJsonPost`, `StepError`) and `_shared/codes.ts` (code-request limits, codes and the send log). Beta and production are separate projects: see [environments.md](environments.md). |

## Toolchain

Pinned at scaffolding (2026-10-19) and rechecked on every upgrade:

| Tool | Version | Notes |
| --- | --- | --- |
| Node | 24 LTS (`.nvmrc`) | Runner, harness and tooling. |
| pnpm | 12.9.1 (`packageManager`) | The only package manager. Isolated installs. Install scripts are allow-listed in `pnpm-workspace.yaml`. |
| Expo SDK | 58 | Current stable. Supports iOS 16.4+ and Android 7+ (compile SDK 37, target 36), so it meets the product floors. The accessibility decision recorded SDK 57 as the then-current release. |
| React Native | 0.88 | Hermes is bundled and enabled by default. |
| React | 19.3 | |
| TypeScript | 6.0 | |
| ESLint | 9 | `eslint-plugin-react` (via `eslint-config-expo`) does not support ESLint 10 yet. |

pnpm 12 refuses packages published less than a day ago, so a fresh SDK patch can lag a day behind `pnpm exec expo install --check`.

**pnpm only.** Run repo tools with `pnpm exec` and one-off packages with `pnpm dlx`. `corepack enable` provides the pinned pnpm. Other clients are refused at install: npm by `engines.npm` with `engine-strict` (root and `apps/mobile`), Yarn by the `packageManager` field, and anything else by the root `preinstall` guard (`scripts/require-pnpm.mjs`). Bun gets as far as installing before the guard fails it, so delete its `node_modules` and `bun.lock` afterwards.

**Product floors:** iOS/iPadOS 16.4+ and Android 10 (API 29)+, set through `expo-build-properties` in `apps/mobile/app.config.ts`. These sit above the framework minimums on purpose.

## Commands

From the repository root:

```sh
pnpm install
pnpm typecheck   # every package and the app
pnpm lint        # shared packages (including the engine portability rule), then the app
pnpm test        # unit tests, the engine suite on Node, and the app tests on iOS and Android behavior
pnpm harness     # the engine suite on Node, iOS Hermes and Android Hermes, compared
```

Seam 2 (Account-service scenarios) runs against the local Supabase stack, so it needs Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and is not part of `pnpm test`:

```sh
pnpm stack start      # the stack, with this checkout's migrations and config
pnpm test:accounts    # seam 2 scenarios (CI runs them in the accounts job)
pnpm stack db reset   # reapply the migrations after changing one
pnpm stack stop
```

New migrations go in `supabase/migrations` (`supabase migration new <name>`, which stamps the current time as the version); never edit one that has merged. `pnpm lint` runs `pnpm check:migrations`, which checks every file is named `<version>_<name>.sql`, every version is unique and no migration on `main` has changed. Before a branch merges into another (`docs/agents/implement-spec.md`), `pnpm check:migrations --ticket <branch> [--into <ref>]` (`--into` defaults to `HEAD`) compares both from their merge-base: the branch edits no migration the base already has, each migration it adds sorts after every migration on `--into`, and it lists each function or view both sides redefined. Migrations run in version order, so the branch's definition replaces the other one and must carry its changes. Email sent locally lands in the stack's mail catcher (`supabase status` prints its URL): the `request-code` function delivers codes and "No account for this address" emails there, `link-method` its codes and "method added" security emails, `revoke-devices` and `provider-notifications` the "devices signed out" security emails, `export-job` the "export ready" email, `schedule-deletion` the "deletion scheduled" email, `deletion-job` the "permanent deletion accepted" email, and Auth only Secure Email Change's two codes, through the `send-email` hook. Each scenario starts with fresh code-request limits (`packages/account/test/setup.ts`), since every scenario comes from the same address. `pnpm stack <command>` runs a Supabase CLI command against this checkout's stack. To run stacks in several worktrees at once, give each worktree its own `TABLESIDE_STACK_SLOT` (1–9) for both `pnpm stack` and `pnpm test:accounts`; in a linked worktree both refuse to run without one: slot N gets its own project id and every port moved up by N × 100, generated under `.stacks/<N>` from this checkout's config with symlinked migrations. A slot's edge functions are symlinked and don't reload on save: after changing one, restart that slot's stack. Slot 0 (the default) is the plain `supabase/` project on the default ports, which is what CI and `supabase` itself use.

The app:

```sh
cd apps/mobile
pnpm exec expo run:ios       # development build on a simulator
pnpm exec expo run:android   # development build on an emulator or device
pnpm exec expo install <package>   # add dependencies at SDK-compatible versions (installs with pnpm)
```

`ios/` and `android/` are generated by `expo prebuild` and are not committed. Configure native behavior in `app.config.ts` and config plugins. Expo loads `app.config.ts` without transpiling its TypeScript imports, so its background color is a literal (`BACKGROUND`) kept equal to `BACKGROUND` in `src/theme/tokens.ts` by hand.

## Operational metrics and the privacy boundary

Analytics, routine logs and crash reports never carry a record body, token, email code, raw age data, clock anchor, account email or casino session (spec 2, *Observability and privacy boundaries*). Every metric is in the catalog in `packages/account/src/metrics.ts`: a name, a number and enumerated properties, with no identity. The device sends one only through the Account service's sender, which applies the account gate (nothing but eligibility, security and recovery before eligibility is established) and, on a teen's device, `TEEN_METRICS`, each with its qualified purpose. Add a metric there, never a free-text property. The backend's aggregates (refused receipts, rolled-back transactions, staging age, storage, and email failures, bounces and complaints for every email type in `private.email_types()`, which `EMAIL_TYPES` mirrors) come from `public.operational_metrics(since)` (service role only); `serverMetricEvents` maps them onto the catalog. The provider is spec 7's, behind `MetricsSink`, and so is the crash reporter, which sends only `crashReport(error)`. A budget alert is `private.budget_alert` (spec 7's cost alerting raises and clears it): while it is active, `sync_details_v1` asks Download all history to wait, and serves recent and opened detail as usual; it never deletes history. `tests/privacy-boundary.test.ts` checks every `console` call in shipped code (the app, the account, engine and definitions packages, the edge functions) logs only fixed text, step names and statuses, and every migration raises only fixed messages; seam 2's `privacy-boundary.test.ts` checks real devices' events and the backend's snapshot. The app holds the first-run email address in memory only, never in a route param or a log.

## Engine portability

The engine and definitions packages must run unchanged on Hermes and Node, so `eslint.config.mjs` restricts them to:

- relative imports only, and only within the package (definitions may also import the engine by name), so no React, Expo, Node, network, account, advertising or subscription packages;
- no clocks (`Date`, `performance`), timers, network, storage, platform globals, `Math.random`, `Intl` or `console`.

The engine has no package dependencies, and its TypeScript config includes only the standard ES library. `tests/engine-portability.test.ts` checks that the rule rejects each category. Only `src/` ships: the definitions package's `scripts/` and `test/` run on Node and may use it.

What the rule can't catch:

- **Exact integer arithmetic.** Philox's `mulhi` (`src/philox.ts`) splits each 32×32-bit multiply into 16-bit halves so every intermediate stays an exact double (below 2^53). A plain `a * b` loses bits, and a BigInt shortcut diverges across runtimes. Philox's constants and round structure follow Random123's `philox.h`.
- **No `crypto` or `TextEncoder`.** SHA-256 (FIPS 180-4, `src/sha256.ts`) and its UTF-8 encoder are written with plain 32-bit integer arithmetic. The encoder writes a lone surrogate as U+FFFD, as `TextEncoder` does, and `utf8Bytes` in `src/strategy.ts` counts bytes the same way for the 1 MiB strategy envelope.
- **Stack depth.** Hermes' stack is far smaller than Node's. The validator's recursion limit, `MAX_WALK_DEPTH` (64), stays well under it; raising it risks a stack overflow on device that Node tests won't show.
- **Canonical JSON** (`src/canonical.ts`) sorts object keys by UTF-16 code units (plain `sort()`), writes no whitespace, maps -0 to 0, and refuses anything but strings, finite numbers, booleans, null, arrays and plain objects. Checkpoint hashes, fingerprints and the sync encoding depend on this exact form.

## Game rules spec 1 leaves open

Each of these is fixed by the code; changing one changes every dealt outcome or legal wager for a stream.

- **Blackjack dealing order** (`packages/engine/src/blackjack.ts`): first cards go round the seats from first base, then the dealer's up card, a second round, then the hole card face down. A split hand takes its second card at once; each hand split off waits until play reaches it. Hands play in seat order and, within a seat, left to right, with a split-off hand just right of its origin.
- **The shoe never runs out mid-round** only because five seats with splits need far fewer cards than the 63 left behind an 80% cut. Raising the penetration ceiling or the seat count needs this rechecked; the engine throws if it happens.
- **Craps commission funding** counts every buy and lay on the table: a new wager must leave enough for its own commission and for every other buy's or lay's.
- **Exposure bounds.** Each game's `turnExposure` is a hand-derived worst case for one turn. Blackjack: every hand split to the cap and doubled, plus full insurance, paying at most 2 per unit. Craps: every flat target at the flat maximum (4 line bets, 5 per box number, the field), the largest odds every base allows, and every hardway, proposition and horn part at the component maximum, paying at most 30:1. Roulette: every placement at its own maximum, with no aggregate cap. A benchmark profile's bound times a run's sessions must stay within 2^53 − 1 so aggregates stay exact. A new bet or rule option must update the derivation.
- **Turns in the practice controller.** `TURN_PHASES` (`apps/mobile/src/practice/controller.ts`) lists the phases in which a turn is under way: a turn-boundary suspend waits for them, and a session suspended in one can't end. A game that adds a mid-turn phase must add it there, or suspension and End session misjudge the turn.

## Blackjack reference

`packages/definitions/reference/blackjack` holds the certified research files byte for byte (research/blackjack-coaching-validation@ae3776d) and their `reference-manifest.json`. The app can't read files, so `src/blackjack/reference-files.generated.ts` embeds the same bytes. The package's `build` script (also the first step of its `typecheck`) fails if the manifest, any file's SHA-256, or the embedded copy differs. Never edit the files; after a new certified freeze, copy it in and run `pnpm --filter @tableside/definitions reference:write`. No research script or calculator code is copied: `test/reference-integrity.test.ts` checks for them.

The research branch holds more than ships (read it with `git show ae3776d:experiments/blackjack-coaching-validation/<file>`; its report is `docs/research/blackjack-coaching-validation.md` there):

- **Ships:** the basic tables per preset, the continuation tables and the final indices: the files above.
- **Test oracles only:** the hashed comparators, `wizard_appendix9_6deck.csv` (Wizard of Odds fresh-shoe EVs) and `published_indices.csv` (Schlesinger and BJA indices). Copy one into a test fixture, with its manifest hash, when a test needs an independent expectation.
- **Never ships:** the calculator driver (it links Eric Farmer's GPL-3.0 calculator), every Python and shell script, the evidence and stability intermediates.

Reading the files (`src/blackjack/reference.ts`):

- The reference's objective is the highest expected net return per original bet; ties go to the action that adds no extra wager.
- The basic tables' `ev_*` columns are fresh-shoe expected net returns per original bet given no dealer blackjack, null where the action doesn't apply.
- Fallback columns give the next-best legal action when the prescribed one is unavailable: `fallback_double`, a double unavailable on a post-split hand (or for balance where surrender isn't legal); `fallback_double_ls_original`, an unaffordable double on an original two-card hand in a late-surrender preset; `fallback_split_rule`, a split unavailable by rule (four hands, or aces: A,A stands); `fallback_split_balance`, an unaffordable split (so the double is too); `fallback_surrender`, surrender unavailable (post-split or after a hit).
- The index files' published values are as Schlesinger and the BJA 2018 S17 and H17 charts print them. The difference is taught minus published; the cost has one bin per count of difference, empty where they agree or aren't comparable.
- Simulated players (`src/blackjack/seats.ts`, `rules.ts`) bet the table minimum and sit before the learner, so their cards are out before each of the learner's decisions. Their rows pack the preset's basic table with its surrender and split-by-rule fallbacks for first decisions, and the dealer rule's continuation table with its double fallback for later ones. They have unlimited funds, so the balance fallbacks never apply.

Test oracles in `packages/definitions/test`, each independent of the code under test:

- `frozen-files.ts`'s `frozenRows` is a second CSV reader, written apart from `src/blackjack/csv.ts`, so the tests read the frozen files without trusting the shipped parser.
- The spot checks in `blackjack-reference.test.ts` come from the research's S17_LS grid (`tables_S17_LS.md`), not from the CSVs; the T,T v 6 figures (Schlesinger +4, generated +5, teaching +4 costs 0.0188 ± 0.0026 per bet in the +4 bin) from the #15 research report.

## House-edge sources

Craps and roulette house edges (`packages/definitions/src/craps.ts`, `roulette.ts`) are exact, derived from the 36 dice combinations and the wheel's pockets. Craps edges are per bet resolved: a place or hardway bet that sees no decision isn't counted. A buy or lay edge with a stake rounds the 5% commission up to a whole unit (minimum 1), as the table charges it; without a stake it uses exactly 5%, which is also the edge at any stake where 5% is whole. The tests check them against published figures:

- **Craps** (`test/craps-house-edge.test.ts`): Wizard of Odds (Shackleford), "Craps — house edge" and "Odds in craps". `PUBLISHED_COMBINED` holds the line bets with full odds per total amount bet; `PUBLISHED` the rest of the menu per bet resolved.
- **Roulette** (`test/roulette-house-edge.test.ts`): the payouts in #3 and the Wizard of Odds roulette payout table. First four is single zero only, the five-number basket double zero only.
- **Blackjack** (`test/house-edge.test.ts`): derived from the certified basic tables with exact six-deck card-removal probabilities.

## Releases: recorded checkpoints and the quarantine list

Each release must keep resuming every unfinished practice session an earlier release can leave (spec 1, *Durability › Updates*). `pnpm --filter @tableside/engine record-checkpoints` writes `packages/engine/test/recorded/engine-<version>-schema-<schema>.ts` with this build's checkpoints in each game and unfinished phase, and the outcomes it reached from them; add a new module to `test/recorded/index.ts`. The build under development must have a recording (`tests/recorded-checkpoints.test.ts` fails after a schema or engine version bump until it does); while it is unreleased, re-record it with `--replace` when its behaviour changes, and delete an older unreleased one. When you cut a release, add its recording's SHA-256 to `test/recorded/released.json`. Released recordings are never regenerated, edited or removed, so an unfinished session is never aged out: the engine suite decodes every recording directly with the current build (skipped versions included) and checks the recorded outcomes. A change that breaks one needs a migration in `decodeCheckpoint`, or the old behaviour kept for that pinned engine identity. A checkpoint the build can't run (a rollback) is `unsupported`: the controller leaves it untouched and asks for the update. `RecordedCheckpoint`'s specification, random and continuation are typed `unknown` on purpose: they are what an older build wrote, so never tighten them to this build's types.

Versioned identities are bumped by hand:

| Identity | Bump on |
| --- | --- |
| `STANDARD_CRAPS.version` (`packages/engine/src/craps.ts`) | a new wager family or rule option; strategies and presets are checked against it |
| `RECORD_VERSION` (`src/record.ts`) | any change to a completed record's fields |
| `CHALLENGE_RECORD_VERSION` (`src/challenge-record.ts`) | any change to a challenge-attempt record's fields |
| a challenge content definition's `version` (`CHALLENGE_CONTENT`, definitions) | any change to its length or coverage, or to how the engine generates its content; a new version starts fresh comparison groups |
| `CANONICAL_ENCODING` (`src/fingerprint.ts`) | any change to the instruction schema or its normalization, which changes every fingerprint |
| `CRAPS_HOUSE_EDGE_VERSION`, `ROULETTE_HOUSE_EDGE_VERSION` (definitions) | any change to a value or its derivation |
| a benchmark profile's `version` (`benchmark-profiles.ts`) | any change to that profile |

Account databases follow the same rule for the store schema (spec 2, *Migrations*). The schema and its append-only migrations live in `apps/mobile/src/account/store-schema.ts`; never edit a released migration, add one instead. Every build keeps every migration from the base schema. The store schema version is its own identity, never the engine version or a checkpoint's state schema, and no migration rewrites a stored checkpoint, specification or receipt. `pnpm --filter @tableside/mobile record-databases` writes `apps/mobile/src/account/testing/recorded/store-schema-<version>.ts`, with this build's databases holding an unfinished practice session in each recorded phase and some finished practice. Add a new module to `recorded/index.ts`. `__tests__/recorded-databases.test.ts` fails after a schema bump until the recording exists. While the schema is unreleased, re-record it with `--replace`. When you cut a release, add its recording's SHA-256 to `recorded/released.json`. Every later build upgrades every recording directly and resumes its unfinished practice sessions. On a device the vault migrates a database only under a verified encrypted backup and a manifest (`apps/mobile/src/account/migration-runner.ts`). A database from a later schema (a rollback) is left untouched, and the vault answers `needs-update`.

The sync protocol is versioned too (spec 2, *Protocol versions*). Protocol N is the envelope's `protocol: N`, its encoding (canonical JSON, SHA-256 over the UTF-8 bytes) and the operations named `*_vN`; `sync_protocol` is unversioned and its answer never changes shape. Changing an operation's arguments or answer, or the encoding, needs a new protocol version with new operations: never edit a released version's. Receipts match a retry only by request hash, so encoding the same operation differently makes every upload queued by an older build fail as "operation reused"; a new encoding also needs its own fixture in `protocol.test.ts`. Retire an old version by setting `retires_at` in `private.sync_protocols` at least 30 days ahead (the server refuses less, unless `urgent_reason` explains why); the app shows the date in sync status, and from then the pre-request hook refuses the version's operations with 426. The release check is `packages/account/src/sync/protocol.test.ts` (the encoding, in `pnpm test`) and `packages/account/test/compatibility.test.ts` (seam 2: this build's protocol is served, its operations exist, and the server hashes its requests as it does), run in CI's accounts job against the migrations in source control.

### Compaction and stale devices

Every upload is a command in its installation's command scope (`sync_scope_v1`): a generation the server issues per account and installation, and a position, fixed when the entry is prepared. After a clean run the device reports the positions it has settled, and the daily `compact-sync` job (`private.compact_sync`, one transaction per account) drops their receipts, retires scopes unseen for the policy's scope retention, and prunes feed entries older than its feed retention behind the account's reset boundary (`private.compaction_policy`; spec 7 sets the final values). A device behind the boundary takes a new snapshot; one whose scope retired refreshes, reconciles and takes a new generation (`packages/account/src/sync/engine.ts` explains how each kind reconciles). A record type that plugs into this:

- registers a snapshot function if a reset device needs its current state (privacy choices need theirs, for example), reading the type's own rows, never the feed, which is pruned;
- stores the account sequence of each accepted row itself, for the same reason, rather than looking it up in the feed;
- adds a row to `private.retention_rules` for each of its account-keyed tables, naming its endpoint, and for an exception the unresolved dependency and owner (seam 2's `compaction.test.ts` fails without one);
- appends each acknowledged sensitive outcome (a withdrawal, an opt-out) to the control journal with `private.record_control` in its acceptance transaction ([ADR 0001](adr/0001-protected-recovery-controls.md)).

A pending operation is never compacted: it sits in the device's queue, and its receipt stays above the settled marker until the device acknowledges it. Seam 2 scenarios that call the operation API directly get a command scope from `directCommands` (`packages/account/src/testing`).

A proven engine defect goes in `packages/definitions/src/quarantine.ts`: add an entry naming the affected identities and bump the list's version; never edit or remove an entry. Completed records are judged against it on every read (never stored), and an unfinished session it names is marked incomplete and explained instead of resuming.

### The age-eligibility decision

The registry's "Age-eligibility decision | Account-state operation" row is met by the eligibility record's own operation, not a registered sync type: a device reports a decision with `record_eligibility_v1` (and the required check it owes with `record_age_check_v1`), which replaces the account's one record under the account's row lock, online. It can't be a queued upload because sync runs only while ordinary access is open, and an account whose eligibility isn't established has none; a decision is never queued offline either, since restrictions apply locally at once and only a sufficient online report may establish a band. No report raises an established band (support review does), and while any installation owes a required check no declaration, and no other session's range, establishes one.

### Recovery needed

When an account's key or database is lost or unreadable, the vault opens nothing and keeps the original bytes. Restore synced history (`AccountService.recover`) gives the account a fresh, empty database under a new installation of its own (recorded in the keychain as `tableside.<environment>.recovered.<account>.key`), so its per-device positions and command scope never collide with the original's; other accounts keep the device's installation. A session is bound to one installation, so recovery signs out, and the next sign-in registers the new installation and bootstraps the synced history into it. The original is never overwritten, moved or deleted; erasing the account removes it with the rest.

### Permanent deletion

Delete permanently now (`delete_permanently_v1`), the end of a scheduled deletion's window (the `deletion-upkeep` cron, `private.finalize_deletion`) and an operator's verified rights request (`begin_rights_request_deletion`, service role) cross the irreversible boundary in one transaction (`private.cross_deletion_boundary`): the account is deleted for good, its Auth user banned and sessions revoked, its exports ended, and a deletion-control record written to `private.deletions`. Devices erase the account when the lifecycle status answers `deleted` (the vault's `erase`, the app's `eraseAppData`); a revoked installation keeps its status credential and asks at its next launch. The `deletion-job` function then runs the cleanup steps in order through `advance_deletion`: the "permanent deletion accepted" email, waiting for the export job to remove every archive, analytics erasure, spec 5's purchase cleanup, spec 6's public-content removal, the record purge (`private.purge_account_records`), Apple and Google grant revocation, and last the Auth user. The account's objects in the `account-private` bucket go through the Storage API after the exports. Each step is idempotent; a failure is retried with backoff and shows as a delay, and the account never reopens. A record type that plugs into this:

- registers an `erase` function in `private.record_types` (account uuid → void) that removes its own tables' rows, unless the platform's tables already hold them;
- leaves nothing behind for the account: seam 2's `permanent-deletion.test.ts` checks that only the account row, its deletion record, its status credentials' hashes and the deletion's journal entry survive across every account-keyed table, the Auth tables and storage.

The ports for later specs are stubs until they land: spec 5's `private.purchase_cleanup` and RevenueCat customer removal, spec 6's `private.remove_public_content` and `private.cancel_owned_publications`, and spec 7's analytics provider, which records erasure as requested and reports completion only through `analytics_erasure_completed`. Apple and Google grants are revoked for real: when a provider gives the app an authorization code (Sign in with Apple natively and through the browser, and the web account page's Apple and Google sign-in), the `provider-grant` function exchanges it for the provider's refresh token and keeps it sealed with a key only the functions hold (`private.provider_grants`); the providers step unseals and revokes each with the provider before the Auth identity goes. An identity with no grant (Google's native ID-token sign-in gives no code) is reported as a provider exception, `not-held`, never as revoked. Locally the test identity provider serves the token and revocation endpoints; real provider settings are launch gate 3's ([environments.md](environments.md)).

## The web account page

`apps/web` is the lifecycle-only page stores link to for account deletion (spec 2 *Deletion*; Google Play requires one reachable without the app). It signs in with an email code, or with Apple or Google, and runs the app's own operations under the same rules: `request-code`, Auth's code check, `fresh-auth` (Confirm it's you, by code or by provider), `schedule-deletion`, `cancel_deletion_v1`, `delete_permanently_v1` and `deletion_status_v1`. Apple and Google go through the provider's web page and `provider-callback`, as Apple does on Android: the state ends `~web`, the function sends the browser back to the environment's page URL (`TABLESIDE_WEB_ACCOUNT_URL`) with the state alone, and the page redeems the ID token with its verifier and signs in to Auth with it. That never creates an account, and never cancels a scheduled deletion. The browser registers its session as a `web` installation (`register_device_v1`, label "Web browser"), keeping the status credential in `localStorage`, so after Delete permanently now, or a scheduled deletion's deadline, the page still shows the deletion's progress (`deletion_progress_v1`) until the player chooses Done. Only a browser that signed in to the account holds that credential: once an account is deleted its Auth user is gone, so a deletion made in the app shows its progress there, not on the page. The Auth session lives in `sessionStorage` and ends with the tab. It never syncs or holds records. Its client (`packages/account/src/web-account.ts`, `web.ts`) uses plain `fetch` and Web Storage and imports neither the Supabase client nor sync, so the page's bundle stays small. The page remembers the last-focused control (`lastFocus` in `apps/web/src/page.ts`) instead of reading `document.activeElement`, because a busy render disables that control and a disabled element drops focus.

When a signed-in visitor's browser sends Global Privacy Control, the page calls `record-gpc`, which checks the browser's own `Sec-GPC: 1` header (no page script can set it, so a signal only a script claims records nothing) and records the ad-data opt-out with source GPC (`record_gpc_opt_out`), unless ad data is already limited. Its Content Security Policy lets only the page's own files load and only its one backend be contacted; it uses the system font. `apps/web/src/no-third-parties.test.ts` checks this. The functions it calls answer CORS preflights (`supabase/functions/_shared/cors.ts`) and allow any origin: no request relies on cookies or browser credentials, only on the bearer token or publishable key it carries, so a page elsewhere gains nothing a plain HTTP client couldn't do. A credentialed request would break that; don't add one.

Run it against this checkout's stack (with `TABLESIDE_STACK_SLOT` for a slot):

```sh
pnpm stack start
pnpm --filter @tableside/web dev   # http://localhost:5173, using the running stack's URL and publishable key
```

Codes land in the stack's mail catcher. A deployable build names its backend, as the app does: `TABLESIDE_WEB_ENVIRONMENT`, `TABLESIDE_WEB_SUPABASE_URL` (HTTPS outside local) and `TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY`, then `pnpm --filter @tableside/web build` writes static files to `apps/web/dist`. Hosting, the domain and the store consoles' deletion URL are spec 7's (D13, D14): the page is one document served at the root of its site, with no routes or query, so that root URL is the stable deletion URL. The host must also send `Content-Security-Policy: frame-ancestors 'none'` (a meta tag can't), so the page can't be framed. Apple and Google sign-in on the page need the page's URL on that domain as each environment's `TABLESIDE_WEB_ACCOUNT_URL`, and the build's client IDs (`TABLESIDE_WEB_APPLE_CLIENT_ID`, `TABLESIDE_WEB_GOOGLE_CLIENT_ID`); a build without a provider's shows no button for it. Locally the return URL is the dev server's (`supabase/config.toml`).

## Accessibility notes for the shell

- The tab bar (`src/navigation/TabBar.tsx`) is a `tablist` of six `tab`s, each at least 48 pt. Labels don't scale with system text, so the bar stays one row.
- **iOS:** at accessibility text sizes, touch and hold shows the tab in the system Large Content Viewer, and lifting selects it (`modules/large-content-viewer`, a local Expo module).
- **Android** has no system Large Content Viewer. At font scale 1.3 and above (the largest setting on Android 10), holding a tab shows an enlarged preview while the tab is selected. Android stores the font scale as a 32-bit float, so both sides of the comparison go through `Math.fround`; a plain `>= 1.3` misses the device's 1.3 setting.
- Keyboard focus draws a ring in `ring` color. Color pairs with their contrast minimums are in `src/theme/tokens.ts` and checked by `__tests__/contrast.test.ts`. The test covers only `essentialPairs`: add a pair whenever a component starts relying on a foreground and background for essential information.
- A problem is never marked by color alone (WCAG 1.4.1): `InlineMessage` pairs its text with an icon.
- The volume slider refuses responder termination, so a horizontal drag stays on the track instead of being taken by the enclosing `ScrollView`.

## Accessibility notes for the tables

- Each table announces every committed transition from the practice controller's snapshot stream as it is published, not from render diffs, so transitions that pass before the next render (an automatic settle right after a reveal) and save failures are still spoken. A snapshot adopted from the store carries no facts, so the table restates status and balance instead.
- Screen readers may read a payout like "17:1" as a time of day, so every spoken payout says "17 to 1" (`spokenPayout`, the bet selector).
- Screen-reader focus moves to a wager editor's heading only when the player opens it (`focusRequested` in `BetSelector.tsx`), never when the editor remounts after a switch between table and bet-list presentation, or focus jumps on every rotation.

## Platform notes for the app

- On Android, expo-device's `osName` can be a build fingerprint rather than a readable name, so a device's label always says "Android".
- On Android, expo-haptics' `impactAsync` and `notificationAsync` drive the vibrator, which ignores the system touch-feedback setting. The app uses `performAndroidHapticsAsync` with the nearest `View.performHapticFeedback` constant for each pattern (`src/feedback/device-ports.ts`), so haptics follow that setting; iOS feedback generators already follow it.
- The bundled cue sounds are generated by `apps/mobile/scripts/generate-cue-sounds.mjs`, with provenance records in `assets/sounds/provenance.json`. Regenerate them rather than hand-editing.

## Responsiveness sampling

Spec 1 launch gate 5 is judged from samples taken on physical devices (#82) by a **sampling build**: a Release build made with `EXPO_PUBLIC_RESPONSIVENESS_SAMPLING=1`. It runs the same Hermes bytecode as a store build, plus a recorder. Samples stay on the device in one file; nothing goes over the network or to analytics.

### What is measured

Every time comes from one clock: React Native's steady clock. A touch's `nativeEvent.timestamp` and `performance.now()` read it, and the local module `modules/responsiveness-sampling` reads the same one natively: mach absolute time on iOS (`CACurrentMediaTime`), `CLOCK_MONOTONIC` on Android. At startup the recorder checks that the native clock agrees with `performance.now()` within 5 ms. If it doesn't, the badge says so and nothing is recorded.

- **Acknowledgment** runs from the touch-down timestamp to the first frame drawn after the press's visible response (the pressed state) commits.
- **Durable completion** runs from the touch-up that fired the action to the first frame drawn after the action's store commit resolves and the published outcome renders.
- **Offline cold launch** runs from native process start to the first frame of a usable Home: rendered, with the practice session loaded. The app always opens on Home, which shows a practice session in progress as suspended. Home exists only behind an open account, so a cold launch to it is a previously signed-in launch, as the gate requires. A launch that needed a touch before Home (signing in, choosing the offline game, recovery) isn't sampled. Process start is `Process.getStartUptimeMillis()` on Android and the kernel's process start time (`sysctl`) on iOS. iOS launches that the system prewarmed are skipped, because their process started before the tap.

"The first frame drawn after" is read natively once React has committed. On iOS it is the next `CADisplayLink` tick's `targetTimestamp`, queued on the main thread behind Fabric's mount. On Android it is the vsync after the next `Choreographer` frame, which is when the frame drawn at that tick reaches the screen.

The root view's `onTouchStart`, `onTouchEnd` and `onTouchCancel` (`src/app/_layout.tsx`) give the touch. The practice store gives the action: `sampling.practiceStore` (`src/practice/PracticeProvider.tsx`) wraps it and pairs each player command it commits with the latest touch that hasn't been used. The touch must still be down (for at most 10 s, `HOLD_MS`) or have ended at most 1 s before (`CLAIM_MS`). A command with no such touch, such as one sent from a keyboard, isn't sampled.

**Touch order.** Fabric runs the responder's `onPress`, and with it the action's store commit, before the root's bubbling `onTouchEnd`. So the sampler claims a touch that is still down, and reads its end once the commit resolves.

**Action families** are named after the controller's commands (`practiceFamily` in `src/responsiveness/sampler.ts`), reported per game:

| Family | Action |
| --- | --- |
| `place-wager`, `remove-wager` | set a stake, or remove one (amount 0) |
| `begin-turn` | deal (blackjack), roll (craps), spin (roulette) |
| `play:hit`, `play:stand`, `play:double`, `play:split`, `play:surrender`, `play:decline-insurance`, `insurance` | each blackjack decision, and taking insurance |
| `set-working` | turn a craps bet on or off |
| `rebuy` | a rebuy |
| `retry-correction`, `override-correction`, `restart-cycle`, `collect-instead`, `stop-strategy` | guided practice's choices |

An action the engine refuses (an `illegal-action` fact, such as a stake under the minimum) isn't sampled either. Settling a turn, stopping and final or strategy settlement aren't sampled: the gate tests long work separately.

**Challenge families** (spec 3 launch gate 8) are reported under `challenge` instead of a game. `sampling.trainingStore` (`src/training/TrainingProvider.tsx`) wraps the training store the same way, and `challengeFamily` names each committed command:

| Family | Action |
| --- | --- |
| `answer-submission` | an answer or Skip in card values or true-count conversion; a Play decision or opening wager in a table challenge |
| `checkpoint-entry` | a count entered, or skipped, at a running-count or table checkpoint |
| `card-advance` | the learner's Next, which shows the next card or table step (self-paced only) |

A Play decision the rules refuse (a `move-refused` fact), a command that ends the attempt (the last Next included: recording and results are long work), starting, Show count, retries and corrections aren't sampled. Neither is a card that automatic pacing advanced, or the Next that follows Check's "Answer recorded" pause: no learner touch caused them. A sample holds only the family and its times, so a right and a wrong answer give the same sample, and nothing about the attempt, its cards or answers leaves the attempt through the export. Lesson and worked-example steps don't commit to a store, so they aren't sampled.

### Building it

```sh
cd apps/mobile
export EXPO_PUBLIC_RESPONSIVENESS_SAMPLING=1
# plus the EXPO_PUBLIC_TABLESIDE_* variables of the environment it signs in to (environments.md)
pnpm exec expo prebuild --clean --platform ios        # or android
pnpm exec expo run:ios --configuration Release --device
pnpm exec expo run:android --variant release --device
```

The prebuild must be `--clean`: without the flag, `plugins/with-responsiveness-sampling.js` leaves the native module out of autolinking (`exclude` in the Podfile and `settings.gradle`), and a clean prebuild also drops a JS bundle Gradle cached from an earlier build. Against a `local` backend over `http:`, the plugin also allows cleartext traffic on Android. When you're done, run `pnpm exec expo prebuild --clean --platform <ios|android>` without the flag before any other build.

For an iOS simulator, prebuild with `ENGINE_HARNESS=1` as well, which leaves out Sign in with Apple as the harness legs do: a simulator app can't carry that entitlement without a signing certificate. Then build with `xcodebuild -configuration Release -sdk iphonesimulator CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO` and install with `xcrun simctl install booted <app>`. Don't turn signing off (`CODE_SIGNING_ALLOWED=NO`): an unsigned simulator app has no keychain, so the account never opens and the app stays on the splash screen.

A store build carries none of the recorder (**store builds**): `src/responsiveness/probe.ts` folds to `sampling = null` without the flag, so Metro never bundles `recorder.tsx`, and the native module isn't linked. `__tests__/responsiveness-build-flag.test.ts` checks both.

### Collecting

Sign in once, set the offline game, then turn on airplane mode. A badge at the top right counts samples ("Samples 240 · Share").

- **Cold launches:** force-quit the app and open it again, at least 30 times per device.
- **Actions:** play each game, and tap through self-paced counting challenges (card values, running count, conversion and a table Play challenge), until the report shows at least 100 samples in every family on every older device. Tap; don't use a keyboard or switch control.

The file is `responsiveness-samples.jsonl`, one JSON sample per line, with the device's model, OS version, build, ABI, the game, the family, and the start, end and duration in milliseconds. It keeps growing across launches until the app is deleted. To get it off the device:

- **Share** on the badge opens the share sheet (AirDrop, Files, email to yourself).
- **Android:** `adb pull /sdcard/Android/data/com.tableside.app/files/responsiveness-samples.jsonl`
- **iOS simulator:** `"$(xcrun simctl get_app_container booted com.tableside.app data)/Documents/responsiveness-samples.jsonl"`

### The report

```sh
pnpm --filter @tableside/mobile responsiveness-report iphone-8.jsonl moto-g7-play.jsonl
```

For each device and build it lists every family of every game and of challenges (`GATE_FAMILIES` in `src/responsiveness/samples.ts`; guided practice's families appear when sampled) and cold launch. Builds are reported separately, because each build must meet the gate on its own. For each family it prints the sample count, the nearest-rank p95 (all samples, outliers kept: the value at rank ⌈0.95 n⌉), the maximum, the target (100 ms, 250 ms or 5 s) and pass or fail. A p95 within the target means at least 95% of samples are within it. Families with fewer than 100 samples (30 for cold launch) are flagged, including families with none, which also fail. It exits 1 when any family fails or is flagged. The export can't show the device was offline: airplane mode is the collector's job.

## App tests

- `jest.setup.ts` replaces native modules with recording fakes: the Large Content Viewer with plain views keeping their props; `@/feedback/device-ports`, `@/play/setup/device-storage` and `@/account/app-account` through `jest.requireMock(...)`. A fake's `latest` is what the app created most recently, and `stored` (and the account's `offlineGame`) what the next launch finds. By default the app reopens signed in on Home.
- The first render of the app's route tree transforms the whole tree, which takes most of a minute on a cold Jest cache, as in CI. Route-level tests pay it once in `beforeAll`, with its own longer timeout, never inside a test. `jest.config.js` raises `testTimeout` to 30 s for RNTL's async renders.

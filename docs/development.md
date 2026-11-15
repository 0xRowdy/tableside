# Development

## Layout

| Path | What it is |
| --- | --- |
| `apps/mobile` | The Tableside app: React Native, Expo development builds, bundled Hermes. Routes live in `src/app`. |
| `packages/engine` | The shared game engine: portable TypeScript that runs unchanged on Hermes and Node. |
| `packages/definitions` | Versioned game content: rule presets, built-in strategies, the blackjack reference. |
| `packages/runner` | The headless runner: standardized sessions of any built-in strategy on a benchmark profile, on Node (`pnpm --filter @tableside/runner start --strategy <id> --profile <id> --key <16 hex>`). Spec 6 adds the coordinator and analysis. |
| `packages/harness` | The cross-runtime test harness. See [cross-runtime-harness.md](cross-runtime-harness.md). |
| `packages/account` | The Account service (spec 2): the app's one interface for anything account-shaped, with its observable account gate. `src/testing` is seam 2's multi-device scenario harness. |
| `supabase` | The backend: local stack configuration, migrations (the account authority schema, RLS, storage policies, jobs) and edge functions (`request-code`, the only way to get a code by email; `bind-provider-assertion`, which binds Create's age assertion to an Apple or Google identity; `provider-callback`, Apple's web-flow redirect on Android; `fresh-auth`, Confirm it's you; `link-method`, adding a sign-in method; `send-email`, Auth's send-email hook, which sends only Secure Email Change's codes; `reviewer-sign-in` and `provision-reviewer`, app reviewers' access to reviewer accounts). Beta and production are separate projects: see [environments.md](environments.md). |

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

New migrations go in `supabase/migrations` (`supabase migration new <name>`); never edit one that has merged. Email sent locally lands in the stack's mail catcher (`supabase status` prints its URL): the `request-code` function delivers codes and "No account for this address" emails there, `link-method` its codes and "method added" security emails, and Auth only Secure Email Change's two codes, through the `send-email` hook. Each scenario starts with fresh code-request limits (`packages/account/test/setup.ts`), since every scenario comes from the same address. `pnpm stack <command>` runs a Supabase CLI command against this checkout's stack. To run stacks in several worktrees at once, give each worktree its own `TABLESIDE_STACK_SLOT` (1–9) for both `pnpm stack` and `pnpm test:accounts`: slot N gets its own project id and every port moved up by N × 100, generated under `.stacks/<N>` from this checkout's config with symlinked migrations. A slot's edge functions are symlinked and don't reload on save: after changing one, restart that slot's stack. Slot 0 (the default) is the plain `supabase/` project on the default ports, which is what CI and `supabase` itself use.

The app:

```sh
cd apps/mobile
pnpm exec expo run:ios       # development build on a simulator
pnpm exec expo run:android   # development build on an emulator or device
pnpm exec expo install <package>   # add dependencies at SDK-compatible versions (installs with pnpm)
```

`ios/` and `android/` are generated by `expo prebuild` and are not committed. Configure native behavior in `app.config.ts` and config plugins.

## Operational metrics and the privacy boundary

Analytics, routine logs and crash reports never carry a record body, token, email code, raw age data, clock anchor, account email or casino session (spec 2, *Observability and privacy boundaries*). Every metric is in the catalog in `packages/account/src/metrics.ts`: a name, a number and enumerated properties, with no identity. The device sends one only through the Account service's sender, which applies the account gate (nothing but eligibility, security and recovery before eligibility is established) and, on a teen's device, `TEEN_METRICS`, each with its qualified purpose. Add a metric there, never a free-text property. The backend's aggregates (refused receipts, rolled-back transactions, staging age, storage, email failures, bounces and complaints) come from `public.operational_metrics(since)` (service role only); `serverMetricEvents` maps them onto the catalog. The provider is spec 7's, behind `MetricsSink`, and so is the crash reporter, which sends only `crashReport(error)`. `tests/privacy-boundary.test.ts` checks every `console` call in shipped code (the app, the account, engine and definitions packages, the edge functions) logs only fixed text, step names and statuses, and every migration raises only fixed messages; seam 2's `privacy-boundary.test.ts` checks real devices' events and the backend's snapshot.

## Engine portability

The engine and definitions packages must run unchanged on Hermes and Node, so `eslint.config.mjs` restricts them to:

- relative imports only, and only within the package (definitions may also import the engine by name), so no React, Expo, Node, network, account, advertising or subscription packages;
- no clocks (`Date`, `performance`), timers, network, storage, platform globals, `Math.random`, `Intl` or `console`.

The engine has no package dependencies, and its TypeScript config includes only the standard ES library. `tests/engine-portability.test.ts` checks that the rule rejects each category. Only `src/` ships: the definitions package's `scripts/` and `test/` run on Node and may use it.

## Blackjack reference

`packages/definitions/reference/blackjack` holds the certified research files byte for byte (research/blackjack-coaching-validation@ae3776d) and their `reference-manifest.json`. The app can't read files, so `src/blackjack/reference-files.generated.ts` embeds the same bytes. The package's `build` script (also the first step of its `typecheck`) fails if the manifest, any file's SHA-256, or the embedded copy differs. Never edit the files; after a new certified freeze, copy it in and run `pnpm --filter @tableside/definitions reference:write`. No research script or calculator code is copied: `test/reference-integrity.test.ts` checks for them.

The research branch holds more than ships (read it with `git show ae3776d:experiments/blackjack-coaching-validation/<file>`; its report is `docs/research/blackjack-coaching-validation.md` there):

- **Ships:** the basic tables per preset, the continuation tables and the final indices: the files above.
- **Test oracles only:** the hashed comparators, `wizard_appendix9_6deck.csv` (Wizard of Odds fresh-shoe EVs) and `published_indices.csv` (Schlesinger and BJA indices). Copy one into a test fixture, with its manifest hash, when a test needs an independent expectation.
- **Never ships:** the calculator driver (it links Eric Farmer's GPL-3.0 calculator), every Python and shell script, the evidence and stability intermediates.

## Releases: recorded checkpoints and the quarantine list

Each release must keep resuming every unfinished practice session an earlier release can leave (spec 1, *Durability › Updates*). `pnpm --filter @tableside/engine record-checkpoints` writes `packages/engine/test/recorded/engine-<version>-schema-<schema>.ts` with this build's checkpoints in each game and unfinished phase, and the outcomes it reached from them; add a new module to `test/recorded/index.ts`. The build under development must have a recording (`tests/recorded-checkpoints.test.ts` fails after a schema or engine version bump until it does); while it is unreleased, re-record it with `--replace` when its behaviour changes, and delete an older unreleased one. When you cut a release, add its recording's SHA-256 to `test/recorded/released.json`. Released recordings are never regenerated, edited or removed, so an unfinished session is never aged out: the engine suite decodes every recording directly with the current build (skipped versions included) and checks the recorded outcomes. A change that breaks one needs a migration in `decodeCheckpoint`, or the old behaviour kept for that pinned engine identity. A checkpoint the build can't run (a rollback) is `unsupported`: the controller leaves it untouched and asks for the update.

Account databases follow the same rule for the store schema (spec 2, *Migrations*). The schema and its append-only migrations live in `apps/mobile/src/account/store-schema.ts`; never edit a released migration, add one instead. `pnpm --filter @tableside/mobile record-databases` writes `apps/mobile/src/account/testing/recorded/store-schema-<version>.ts`, with this build's databases holding an unfinished practice session in each recorded phase and some finished practice. Add a new module to `recorded/index.ts`. `__tests__/recorded-databases.test.ts` fails after a schema bump until the recording exists. While the schema is unreleased, re-record it with `--replace`. When you cut a release, add its recording's SHA-256 to `recorded/released.json`. Every later build upgrades every recording directly and resumes its unfinished practice sessions. On a device the vault migrates a database only under a verified encrypted backup and a manifest (`apps/mobile/src/account/migration-runner.ts`). A database from a later schema (a rollback) is left untouched, and the vault answers `needs-update`.

The sync protocol is versioned too (spec 2, *Protocol versions*). Protocol N is the envelope's `protocol: N`, its encoding (canonical JSON, SHA-256 over the UTF-8 bytes) and the operations named `*_vN`; `sync_protocol` is unversioned and its answer never changes shape. Changing an operation's arguments or answer, or the encoding, needs a new protocol version with new operations: never edit a released version's. Retire an old version by setting `retires_at` in `private.sync_protocols` at least 30 days ahead (the server refuses less, unless `urgent_reason` explains why); the app shows the date in sync status, and from then the pre-request hook refuses the version's operations with 426. The release check is `packages/account/src/sync/protocol.test.ts` (the encoding, in `pnpm test`) and `packages/account/test/compatibility.test.ts` (seam 2: this build's protocol is served, its operations exist, and the server hashes its requests as it does), run in CI's accounts job against the migrations in source control.

A proven engine defect goes in `packages/definitions/src/quarantine.ts`: add an entry naming the affected identities and bump the list's version; never edit or remove an entry. Completed records are judged against it on every read (never stored), and an unfinished session it names is marked incomplete and explained instead of resuming.

## Accessibility notes for the shell

- The tab bar (`src/navigation/TabBar.tsx`) is a `tablist` of six `tab`s, each at least 48 pt. Labels don't scale with system text, so the bar stays one row.
- **iOS:** at accessibility text sizes, touch and hold shows the tab in the system Large Content Viewer, and lifting selects it (`modules/large-content-viewer`, a local Expo module).
- **Android** has no system Large Content Viewer. At font scale 1.3 and above (the largest setting on Android 10), holding a tab shows an enlarged preview while the tab is selected.
- Keyboard focus draws a ring in `ring` color. Color pairs with their contrast minimums are in `src/theme/tokens.ts` and checked by `__tests__/contrast.test.ts`.

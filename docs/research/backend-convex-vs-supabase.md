# Tableside backend: Convex versus Supabase on free and low-cost plans

Research date: 2026-10-19. Context: the user is considering replacing the accepted Supabase backend with Convex, mainly to keep costs near zero while building and testing. Supabase was a recorded decision: [Local persistence and account synchronization architecture, Q5](https://github.com/0xRowdy/true-count/issues/21) accepted Supabase "after comparing Neon, Cloudflare D1, Firebase, and Convex", and specs [#52](https://github.com/0xRowdy/true-count/issues/52), [#55](https://github.com/0xRowdy/true-count/issues/55) and [#56](https://github.com/0xRowdy/true-count/issues/56) are written against it. An earlier comparison (2026-09-06) exists only on the unmerged branch `research/backend-workload-feasibility` as `docs/research/backend-provider-costs.md`; its Convex figures agree with today's.

## Recommendation for discussion

Do not switch for free-tier reasons. Both providers cost $0 to build on, and their free databases are the same size (0.5 GB). Several of the Convex figures the user was given are **Professional** ($25 per developer per month) allowances, not Free ones: Convex Free includes 1 million function calls, 0.5 GB of database and 1 GB of file storage, and it stops writes at those caps. On free usage, Supabase is equal or ahead on database size, egress (5 GB against 1 GB), Auth (50,000 MAU, with Apple, Google and email codes production-ready) and serverless functions.

Convex's real cost advantages are narrower:

1. Its pricing and limits pages document no inactivity pausing for Free. Supabase Free pauses a project after one week without activity.
2. Its Starter option has no monthly fee and bills only for usage, where Supabase's first paid step is Pro at $25/month.

Neither is worth re-opening specs 2, 5 and 6, which depend on Postgres transactions, row-level security, Supabase Auth identity linking, Realtime hints and Edge Function dispatch. Keep build-time cost at $0 instead by doing most development against the free local stacks (Supabase CLI), keeping one hosted Free project for device testing, and accepting the one-click restore after a week of inactivity. Reconsider Convex only if its reactive TypeScript model is wanted on its own merits. That would be a new architecture decision, not a pricing correction.

## Verified free and entry-paid allowances

US prices. "Free" means $0 with hard limits. Convex Starter is the same tier as Free with pay-as-you-go overage allowed.

| Item | Supabase Free | Supabase Pro | Convex Free | Convex Starter | Convex Professional |
| --- | --- | --- | --- | --- | --- |
| Fixed price | $0 ([pricing](https://supabase.com/pricing)) | From $25/month; $10 compute credit covers one Micro project, each further project adds compute ([pricing](https://supabase.com/pricing)) | $0 ([pricing](https://www.convex.dev/pricing)) | $0, "pay as you go" ([pricing](https://www.convex.dev/pricing)) | $25 per developer/month ([pricing](https://www.convex.dev/pricing)) |
| Projects / deployments | 2 active projects; paused projects don't count; the limit spans all orgs you own or administer ([billing](https://supabase.com/docs/guides/platform/billing-on-supabase)) | No project cap stated; per-project compute ([pricing](https://supabase.com/pricing)) | 40 deployments per team ([limits](https://docs.convex.dev/production/state/limits)) | 40 | 300 |
| Developers | Not limited on pricing page | Not limited on pricing page | 1–6 ([limits](https://docs.convex.dev/production/state/limits)) | 1–6 | 1–20 |
| Database | 500 MB database size; read-only above it ([database size](https://supabase.com/docs/guides/platform/database-size)) | 8 GB disk per project, then $0.125/GB | 0.5 GB total ([limits](https://docs.convex.dev/production/state/limits)) | 0.5 GB, then $0.22/GB-month | 50 GB, then $0.20/GB-month |
| Tables | Postgres (no plan limit stated) | Same | 10,000 per deployment, all plans ([limits](https://docs.convex.dev/production/state/limits)) | 10,000 | 10,000 |
| Database I/O | Not metered | Not metered | 1 GB/month total ([limits](https://docs.convex.dev/production/state/limits)) | 1 GB, then $0.22/GB | 50 GB, then $0.20/GB |
| Functions | Unlimited API requests ([pricing summary](https://supabase.com/llms-full.txt)); 500,000 Edge Function invocations ([pricing](https://supabase.com/pricing)) | 2 million Edge invocations, then $2/million | 1,000,000 calls/month total ([limits](https://docs.convex.dev/production/state/limits)) | 1M, then $2.20/million | 25M, then $2/million |
| What counts as a call | Edge Function invocations only; PostgREST/RPC calls are not metered | Same | "Explicit client calls, scheduled executions, subscription updates, and file accesses" ([limits](https://docs.convex.dev/production/state/limits)) | Same | Same |
| Action compute | Edge Functions: 2 s CPU per request, 256 MB, 150 s wall clock on Free, 400 s paid ([Edge limits](https://supabase.com/docs/guides/functions/limits)) | Same, 400 s | 20 GB-hours/month total; query/mutation compute free ([limits](https://docs.convex.dev/production/state/limits)) | 20 GB-hours, then $0.33/GB-hour | 250 GB-hours, then $0.30/GB-hour |
| File storage | 1 GB ([pricing](https://supabase.com/pricing)) | 100 GB, then $0.0213/GB | 1 GB total, includes backups ([limits](https://docs.convex.dev/production/state/limits)) | 1 GB, then $0.033/GB-month | 100 GB, then $0.03/GB-month |
| Egress / bandwidth | 5 GB uncached + 5 GB cached ([pricing](https://supabase.com/pricing)) | 250 GB + 250 GB, then $0.09 / $0.03 per GB | 1 GB/month total. Covers file serving, file reads in functions, backup generation and restore ([limits](https://docs.convex.dev/production/state/limits)), plus outgoing fetches and log-stream egress ([usage limits](https://docs.convex.dev/production/usage-limits)) | 1 GB, then $0.132/GB | 50 GB, then $0.12/GB |
| Auth | 50,000 MAU; 50,000 third-party MAU ([pricing](https://supabase.com/pricing)) | 100,000 MAU, then $0.00325/MAU | No MAU meter. Convex Auth runs in the deployment and is **beta** ([Convex Auth](https://docs.convex.dev/auth/convex-auth)); third-party providers (Clerk, WorkOS, Auth0) bill separately ([auth overview](https://docs.convex.dev/auth/overview)) | Same | Same |
| Realtime / concurrency | 200 concurrent Realtime connections, 2 million messages ([pricing](https://supabase.com/pricing)) | 500 connections, then $10/1,000; 5M messages, then $2.50/million | S16 class: 16 concurrent queries, 16 mutations, 64 actions, 1,000 concurrent sessions ([limits](https://docs.convex.dev/production/state/limits)) | S16 | S256: 256 / 256 / 512, 10,000 sessions |
| Backups | None; Free backups can't be downloaded; export with the CLI yourself ([backups](https://supabase.com/docs/guides/platform/backups)) | Daily, kept 7 days | Manual only; up to two per deployment, kept 7 days, downloadable; periodic backups need Pro ([backup/restore](https://docs.convex.dev/database/backup-restore)) | Same as Free | Daily (7 days) or weekly (14 days) |
| Logs | 1 day API and DB log retention ([pricing](https://supabase.com/pricing)); 1 GB log ingest, not billed on Free ([logs ingest](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest)) | 7 days; 20 GB ingest, then $0.50/GB (billing deferred to start of 2027) | Dashboard shows "a short history"; streaming needed for longer ([dashboard logs](https://docs.convex.dev/dashboard/deployments/logs)); log streaming not on Free ([pricing](https://www.convex.dev/pricing)) | Same as Free | Log streaming included |
| Preview / branch environments | Branching not included ([pricing](https://supabase.com/pricing)) | $0.01344 per branch-hour | Preview deployments included, **beta**, deleted 5 days after creation ([multiple deployments](https://docs.convex.dev/production/multiple-deployments)) | Same | Deleted after 14 days |
| Dev / prod layout | Separate projects. Free's two projects can be one dev and one prod ([pricing FAQ](https://supabase.com/llms-full.txt)) | Projects or branches | Per project: one prod deployment, one cloud dev deployment per developer, plus previews ([local deployments](https://docs.convex.dev/cli/local-deployments)) | Same | Same |
| Free local development | Supabase CLI local stack (Docker) | Same | Local deployments (beta) don't count against plan quotas ([local deployments](https://docs.convex.dev/cli/local-deployments)) | Same | Same |

## What happens at the limit

| | Supabase | Convex |
| --- | --- | --- |
| Free plan over quota | You're notified and given a grace period, then the Fair Use Policy applies to all of the org's projects. Restrictions can include pausing projects, read-only databases, blocked project launches, or HTTP 402 on every API request ([billing FAQ](https://supabase.com/docs/guides/platform/billing-faq)). Over 500 MB, the database goes read-only ([database size](https://supabase.com/docs/guides/platform/database-size)). Free is never charged ([cost control](https://supabase.com/docs/guides/platform/cost-control)). | "Free has hard resource caps". Once hit, "new mutations that attempt to commit more insertions or updates may fail" ([limits](https://docs.convex.dev/production/state/limits)). No overage billing on Free. Starter and above bill usage. |
| Inactivity | Free projects pause after one week of inactivity. Paid projects never pause ([pricing](https://supabase.com/pricing)). One-click restore from Studio within a one-year window ([upgrading](https://supabase.com/docs/guides/platform/upgrading)). | **No inactivity pausing found** on the pricing, limits, teams or pause-deployment pages. The only idle concept is a 30-day idle fee waiver for Business/Enterprise deployments ([limits](https://docs.convex.dev/production/state/limits)). Absence of documentation is not proof; unverified. |
| Cost guardrails | Pro has spend caps, on by default; with the cap on, usage stops at quota instead of billing ([cost control](https://supabase.com/docs/guides/platform/cost-control)). | Team spending limits with a warning threshold and a disable threshold that disables all projects. Available "when you have an active Convex subscription"; seat fees excluded ([teams](https://docs.convex.dev/dashboard/teams/teams)). Per-deployment usage limits disable a deployment for the rest of a daily or monthly UTC window ([usage limits](https://docs.convex.dev/production/usage-limits)). |

## Corrections to the supplied figures

| Supplied claim | Finding |
| --- | --- |
| Supabase Free: up to 2 active projects | **Correct.** Paused projects don't count, and the limit spans every org you own or administer. |
| Supabase Free: 500 MB database per project | **Correct.** The project goes read-only above it (1 GB disk, 500 MB database quota). |
| Supabase Free: pauses after 7 days of inactivity | **Correct** ("1 week"). Restore is one click in Studio. |
| Supabase Free: $0/month, no credit card | **$0 is correct.** The no-credit-card part was not found in the Supabase pages checked: **unverified**. |
| Convex Free: up to 40 deployments | **Correct**, per team, for Free/Starter. |
| Convex Free: up to 10,000 tables per deployment | **Correct.** This is the same on every plan. |
| Convex Free: up to 6 developers | **Correct** (1–6 on Free/Starter). |
| Convex Free: 50 GB database included, $0.20 per extra GB | **Wrong plan: Professional.** Free is 0.5 GB with a hard cap. Starter is 0.5 GB, then $0.22/GB-month. |
| Convex Free: 100 GB file storage, $0.03 per extra GB | **Wrong plan: Professional.** Free is 1 GB, which also holds backups. Starter charges $0.033/GB-month beyond that. |
| Convex Free: 25M function calls, $2 per extra 1M | **Wrong plan: Professional.** Free is 1M per month, and subscription updates count as calls. Starter charges $2.20 per extra million. |
| (Implied) Free allows overage billing | **No.** Free is hard-capped and writes may fail at the caps. Overage billing needs Starter, which is a separate pay-as-you-go option. |

## Fit with the accepted Tableside design

Verified facts first, then engineering assessment.

**Offline-first.** The accepted design (#21, spec #52) puts an encrypted Expo SQLite/SQLCipher database, an upload queue and receipt-backed operations on the device. Neither provider supplies that.

- Convex React (which React Native uses, per [Convex React Native](https://docs.convex.dev/client/react-native)) "automatically retries mutations until they are confirmed", and the backend runs each mutation exactly once ([Convex React](https://docs.convex.dev/client/react)). The docs don't say that pending mutations survive an app restart, so treat it as no durable offline queue.
- No offline-sync product was found in the Supabase docs. Both providers leave the accepted SQLite outbox in place, so offline support doesn't separate them.

**React Native / Expo.** Both are supported first-party: [Convex React Native quickstart](https://docs.convex.dev/quickstart/react-native) and [Supabase with Expo React Native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native).

**Authentication.** The accepted design (#22) uses Supabase Auth with Apple, Google and email codes, verified same-email linking, current-session sign-out and Secure Email Change.

- Convex Auth offers OTP and magic links, OAuth including Apple and Google, and passwords, but it is beta and "may change in backward-incompatible ways" ([auth overview](https://docs.convex.dev/auth/overview)). Its linking, email-change and session-revocation behaviour was not checked: **unverified**.
- The alternative on Convex is a paid third-party identity provider (pricing not checked).

**Subscription entitlement webhooks.** Both can receive RevenueCat or store notifications and verify them server-side:

- Convex [HTTP actions](https://docs.convex.dev/functions/http-actions) at `https://<deployment>.convex.site`, included on Free ([pricing](https://www.convex.dev/pricing)).
- Supabase Edge Functions (500,000 invocations on Free).

Convex actions are not retried automatically and run at most once, so webhook handling must schedule its own idempotent mutation.

**Data model.** The accepted design leans on Postgres: one transaction per logical acceptance, RLS, and narrowly granted database functions (#21, #52).

- A Convex mutation is a single atomic transaction ([OCC and atomicity](https://docs.convex.dev/database/advanced/occ)), so the transaction boundary maps across.
- Authorization moves from RLS into code at the top of each function ([auth overview](https://docs.convex.dev/auth/overview)).
- Each query or mutation is limited to 16 MiB read, 16 MiB written, 32,000 documents scanned and 1 s of user code ([limits](https://docs.convex.dev/production/state/limits)).
- Convex is a document database with no SQL.

**Lock-in and self-hosting.**

- Convex's backend is open source under FSL Apache 2.0. It allows almost anything Apache 2.0 does except building a competing hosted service, and becomes Apache 2.0 after two years ([self-hosting](https://docs.convex.dev/self-hosting)).
- Supabase components are Apache 2.0 or MIT and self-host with Docker. Branching, managed backups, PITR and the Management API aren't available self-hosted ([self-hosting](https://supabase.com/docs/guides/self-hosting)).
- Leaving Supabase moves standard Postgres. Leaving Convex means rewriting functions and data access.

## Interpretation (not verified fact)

- **Build and test phase.** A solo developer with a handful of test devices should fit either free tier. On Convex Free, the binding meters are likely database I/O (1 GB/month) and function calls (1M, with each subscription push counted), not storage. Spec #52's 60-second foreground reconciliation is about 60 calls per device-hour, so 10 testers using the app 1 hour a day is roughly 18,000 calls/month before other traffic.
- **Development pattern.** On both providers, keep most development on local stacks so it uses no hosted quota.
- **Supabase's pause.** After a quiet week the hosted dev project must be restored. That costs time, not money.
- **At launch.** The repository's accepted model plans for Supabase Pro at $25/month inside the $50 target, both for no-pause production and for daily backups. Convex Starter could undercut $25 at low usage, but periodic backups need Professional ($25 per developer), which removes most of that saving once backups are required (#28).
- **Switching cost dominates.** Specs 2, 5 and 6 encode Supabase Auth behaviour, Postgres transaction and RLS boundaries, Realtime-hint rules, Edge Function dispatch for simulations and storage layout. Replacing them is a re-architecture with beta dependencies (Convex Auth, preview and local deployments). The free-tier figures that motivated the switch were mostly Professional numbers.
- **Not verified.** Supabase Free connection and compute limits beyond "Shared CPU, 500 MB RAM". Convex log retention period. Convex Free inactivity behaviour. Whether either provider asks for a card on Free or Starter sign-up. Third-party auth pricing.

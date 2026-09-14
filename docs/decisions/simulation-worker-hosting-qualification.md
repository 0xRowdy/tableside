# Standardized simulation worker hosting and qualification design — accepted decision

Decision ticket: [Standardized simulation worker hosting and qualification design](https://github.com/0xRowdy/true-count/issues/41), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1).

Accepted through live discussion and final integrated review. The [resolution comment](https://github.com/0xRowdy/true-count/issues/41#issuecomment-5595191439) on the decision ticket is canonical; this file preserves the accepted contract for repository readers. This is a planning decision and does not authorize infrastructure provisioning or paid experiments.

## Accepted hosting selection

Use standard on-demand **AWS Lambda in Northern Virginia (`us-east-1`)** for simulation batches, with the accepted shared TypeScript engine in a pinned supported Node LTS runtime. AWS is already selected for the independent Oregon connectivity probe; the simulation function is a separate function with separate permissions and concurrency. Preserve that probe's Oregon location and the global Cloudflare probe.

This reuses an existing provider and supplies a regional Node runtime without changing the engine contract. It is a hosting choice for later qualification, not evidence that the workload fits.

| Existing candidate | Relevant documented facts | Decision implication |
| --- | --- | --- |
| Cloudflare Workers Paid | 128 MB per isolate; normally 30 seconds CPU, configurable to five minutes; partial Node API compatibility. Region placement guides HTTP fetch execution near a cloud region and does not apply to queue handlers. | A portable engine adapter might work, but it adds a runtime to qualify and does not select a Virginia regional queue worker. Do not choose it for simulation merely because the connectivity probe uses it. |
| AWS Lambda on demand | Normal Node runtime, explicitly selected region, configurable memory up to 10,240 MB, and at most 900 seconds per invocation. Synchronous invocation lets the caller control explicit retries. | Select for short checkpointed batches and qualify only this provider initially. |
| Existing Supabase Edge Functions | 256 MB memory and two seconds CPU per request; paid worker lifetime up to 400 seconds, with a 150-second request idle timeout. | Use for lightweight coordination, not CPU-heavy simulation. |

Sources checked September 8, 2026: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [placement](https://developers.cloudflare.com/workers/configuration/placement/), [Lambda limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html), [synchronous invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-sync.html), [Supabase limits](https://supabase.com/docs/guides/functions/limits).

Workers also permits occasional CPU bursts beyond its configured limit without documenting a numerical burst ceiling. Its `cpu_ms` setting alone therefore does not establish a strict maximum charge. This is a reason to prefer the narrower Lambda configuration for qualification, not proof that a Cloudflare implementation is impossible.

For the initial price model, Lambda x86 first-tier usage is $0.0000166667 per GB-second plus $0.20 per million requests. Workers Paid is $5/month including 10 million requests and 30 million CPU-ms; excess is $0.30/million requests and $0.02/million CPU-ms. These units are not equivalent throughput measurements. Count shared base subscriptions once; do not assume free allowances, credits, reuse, or local/cloud speed parity when authorizing spending. Revalidate selected-region rates before qualification. [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Coordination, execution and recovery

Keep the authoritative queue, evaluation allocations, spending ledger and completion receipts in the existing Virginia Supabase Postgres project. Use bounded scheduled Supabase Edge Function dispatches in the selected region, with database transactions controlling admission and launch ownership. Keep bulk checkpoints/results in private Supabase storage with committed database references; upload before atomically advancing the checkpoint pointer, and account for abandoned uploads. Durable progress never depends on Lambda memory or `/tmp`.

Dispatch through the private IAM-authorized Lambda Invoke API using `RequestResponse`. Only the dispatcher may invoke the simulation function. Disable automatic SDK/HTTP retries; each deliberate retry requires another spending authorization. Do not attach asynchronous triggers or expose a public function URL. Workers cannot launch more workers. Use standard on-demand execution without provisioned concurrency, SnapStart, managed instances, external/internal extensions or provider durable-function orchestration. This keeps the initial charging paths finite and inspectable.

Each physical attempt has an immutable identifier, a budget authorization, expiry, pinned configuration and exclusive session ownership. Claim the dispatch once in Postgres before sending. A crash between claiming and sending may waste a reservation; it must not permit a second dispatcher to resend that attempt. An uncertain network response remains potentially charged. Reconciliation may authorize a new physical attempt while preserving the old cost exposure and fencing its writes.

The engine receives no infrastructure clocks or billing logic. The runner cooperatively yields and checkpoints before its deadline, including mid-session or during final settlement. A failed checkpoint resumes the previous committed state, with the same run key, session indices and random consumption. Finalized session receipts prevent duplicate evidence. A fence prevents stale writes, but does not prove the old process stopped costing money.

Preserve the authoritative identity, shared cancellation, correction, deletion and retention contracts in [Evaluation identity and safe result reuse](https://github.com/0xRowdy/true-count/issues/32#issuecomment-5580084537). Do not introduce another random allocation, retry slot exemption or admission clock through hosting.

## Spending controls

Preserve the accepted **$50 normal target, $90 admission boundary including reservations, and $100 monthly simulation ceiling**. Use USD usage costs with no assumed discounts. Attribute simulation dispatch, invocation, initialization, retries, analysis, checkpoint operations, transfer and incremental storage/logging costs to this allocation; shared fixed backend costs stay attributed once under the accepted backend budget. Price existing retained simulation data and mandatory housekeeping before authorizing new work.

Maintain separate amounts for incurred cost (including unreported usage), authorized attempts that can still charge, and anticipated remaining run cost. Move amounts between those categories transactionally without double counting. New admissions must fit $90; attempts for already admitted work must fit $100 while respecting the outstanding commitments of other runs. The $10 reserve is not additional admission capacity.

For each allowed deployment configuration, qualification must establish a conservative attempt envelope:

`request charge + memory × maximum billable duration × regional rate + bounded dispatch/checkpoint/analysis/transfer/logging charges`.

Reserve that envelope before every physical launch, including failures and retries. Maximum billable duration must cover initialization, initialization failure/retry, invocation and shutdown behavior, not just the handler timeout or a measured percentile. Bound request counts and bytes, checkpoint volume, telemetry volume and retry multiplicity as well as compute. Resource, runtime, price or orchestration changes invalidate the envelope until rechecked. [Lambda lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html), [pricing](https://aws.amazon.com/lambda/pricing/).

A serialized Postgres authorization transaction enforces the global ledger and dispatch slots. Lambda reserved concurrency provides a second concurrency limit; it is not a monthly spending cap. The configured function version/resource limits must match the authorized manifest. Missing authority, stale cost configuration or unavailable ledger means no new launch. No logging, storage or polling path may remain unbounded merely because its compute function has a timeout.

Restoring a database backup must not restore an older, larger available budget. Fence dispatch until outstanding attempt authorizations and incurred charges have been reconstructed conservatively. Include stopped, rejected and duplicate attempts in the cost account even when they produce no result. A runtime benchmark can validate a documented charge bound, but cannot prove an undocumented provider maximum; obtain authoritative clarification or fail the gate if the aggregate bound cannot be established.

Keep an ambiguous attempt's full envelope until authoritative evidence establishes actual charges and the attempt cannot still execute. If that evidence cannot be obtained, conservatively spend the envelope rather than refund it on a lease timeout. Late provider reports reconcile the originating usage period, not the invoice arrival month. An observed charge beyond the qualified bound stops dispatch and fails qualification; historical average costs are not proof of an enforceable ceiling.

UTC months have no rollover credit. Near midnight, stop launches early enough for their qualified execution/dispatch envelope to expire. If a physical attempt could cross the boundary, protect its maximum exposure in both months until attribution is known. Reconcile old attempts, recurring retained-data costs and remaining admitted work before admitting new work in the next month. A new month supplies no new randomness and resets no admission clock. Budget exhaustion pauses the same evaluation; required retention is never silently shortened to fit the budget.

## Finite qualification setup

The implementing agent produces the evidence; Rowdy accepts it before enabling public evaluations. Every paid run needs separately scoped access and spending authorization. Keep one baseline and at most two semantics-preserving optimization passes. No second provider benchmark is included by default.

Freeze a versioned experiment manifest before running: source/artifact hashes, Node/runtime version, engine/reference/analysis/random-protocol versions, resource settings, fixture definitions, original session allocations, arrival schedules, price sheet, checkpoint configuration and failure scripts. Keep raw usage records and a reproducible report. Use synthetic accounts and strategies; do not use private player histories.

| Stage | Accepted qualification matrix |
| --- | --- |
| Resource screening | Lambda x86, 512 MB ephemeral storage, 1,024 or 2,048 MB memory × 30- or 60-second function timeout: four configurations, concurrency one. Run three cold and three warm diagnostic batches per configuration and fixture class. Diagnostic probes establish neither completed evidence nor full-run latency. |
| Workload coverage | All three games, the accepted built-in catalog and every compatible benchmark profile. Add one ordinary, one near-envelope and one wide-numeric fixture per game; include simultaneous wagers, branching/list progression, blackjack splits/doubles and prolonged settlement diagnostics. Deduplicate overlapping fixtures explicitly in the frozen manifest. |
| Candidate selection | Choose the least-cost configuration that passes correctness, recovery and resource checks. On that configuration test total concurrency 1, 2 and 4. Determine checkpoint cadence, sessions per batch, cost classes and safe launch limits from these measurements; these test settings are not accepted production capacity. |
| Full evaluations | For every representative revision/profile case, complete the original 100,000 independent sessions with 200 scheduled opportunities and complete final settlement. Include all catalog/profile compatibility coverage in the manifest. Incomplete work remains incomplete and cannot pass through selective omission or replacement. |
| Monthly workloads | Freeze a 30-day, 200-revision schedule: 67 blackjack, 67 craps and 66 roulette revisions, split per game into approximately 70% ordinary, 20% near-envelope and 10% wide-numeric fixtures, rounded deterministically in the manifest. Burst case adds 40 revisions (14/13/13 by game) arriving within one hour on day 15, for 240 total. Expand each revision into its actual compatible profiles. Model no reuse savings in this baseline. |
| Failure scenarios | Concurrent dispatch/admission, ambiguous invocation, failed checkpoint, timeout, duplicate/stale worker, lost ledger access, delayed usage, budget exhaustion, month rollover, final-dependent cancellation versus new join, orphan replay, analysis correction and allocation-registry recovery. |

Use local deterministic schedule replay plus measured cloud batch/full-evaluation traces for the monthly model; report modeled monthly results separately from physically observed cloud results. Direct cloud concurrency and burst tests must validate the queueing/throughput assumptions. If they cannot substantiate the normal/burst latency claim, the model alone cannot pass. Paid experiment limits bound spending, not evidence requirements: running out of experimental funds produces an incomplete qualification report.

For every configuration, record exact execution/recovery equivalence, memory, cold/warm timing, billable duration, overhead, failed attempts, session completion and settlement work. Test dispatcher CPU and connection timeouts against the actual Supabase limits. Include runtime compatibility with the existing Node reference and mobile Hermes contract. Do not alter supported game/strategy semantics to fit the worker.

Report unrestricted workload cost versus $50 and $100, and the measured constrained admission configuration if necessary. Report admitted, held, over-capacity, paused, failed and completed fractions by game and cost class, original-admission latency percentiles/worst case, admission delays, oldest waiting request and outstanding liabilities. At least 95% of admitted work must complete within one hour and all within 24 hours in normal and burst qualification; zero admissions cannot pass. Fault-injected budget pauses must preserve evidence and truthfully record target misses.

## Closure and handoff

This decision selects the provider, region, accounting protocol and finite experiment design. It does not claim measured affordability, hard-cost enforcement or production readiness. Unqualified charge bounds, correctness failures or unsupported latency claims keep public evaluation disabled. A failed configuration returns a concrete measured limitation for Rowdy's decision; it does not trigger indefinite optimization or automatic provider switching.

Batch sizing, concurrency calibration, deployment configuration and the experiment execution are implementation work under this contract. No additional planning tickets are proposed merely for those tasks. The separate blackjack-reference, statistical and release acceptance gates remain required.

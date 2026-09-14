# Standardized simulation feasibility and expensive-strategy policy — accepted decision

Decision ticket: [Standardized simulation feasibility and expensive-strategy policy](https://github.com/0xRowdy/true-count/issues/31), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1).

Q1–Q9 and the integrated decision draft were accepted in live discussion. The [resolution comment](https://github.com/0xRowdy/true-count/issues/31#issuecomment-5579089385) is canonical. This is a planning contract; it does not establish measured production capacity or authorize cloud spending.

## Evidence and preserved contracts

The [Simulation workload feasibility benchmark](https://github.com/0xRowdy/true-count/issues/26) measured cheap local flat roulette/craps loops, but its expensive arithmetic cases were synthetic probes rather than complete runnable strategies. They establish a possible cost gap, not the affordability or unaffordability of an optimized production engine. Blackjack, interpreter execution, analysis/checkpoint overhead, representative cloud batching, and total launch capacity remain unqualified.

Preserve the three-game launch, supported numeric/expression capabilities, exact execution, and portable TypeScript/Node engine from [Mobile platform and shared game-engine architecture](https://github.com/0xRowdy/true-count/issues/16). Preserve [Community publication, rankings, and results](https://github.com/0xRowdy/true-count/issues/6): 100,000 independent completed sessions per compatible revision/profile, 200 scheduled table opportunities plus complete final settlement, and existing statistical/display gates. Waiting, losing, no-bet, and long-settlement sessions cannot be selectively omitted. No partial evaluation supplies a completed performance result.

If semantics-preserving optimization does not close the cost gap, reduce access to standardized evaluations first. Cost alone does not invalidate an otherwise valid strategy or prevent publication and practice. Budget increases, narrower strategy semantics, smaller samples, and a different execution model require separate product acceptance.

## Budget and admission

- The monthly standardized-simulation compute ceiling is **$100**; **$50** is the normal spending target. This is the simulation allocation, not the whole backend budget.
- Retain the approximately 90% new-admission pause from [Community simulation capacity and operating budget](https://github.com/0xRowdy/true-count/issues/19), but include committed and reserved costs rather than waiting for a delayed bill. Admit new work only if accounted spending plus outstanding commitments and conservative remaining reservations, including the candidate, fits **$90**. The remaining **$10** protects already admitted work and operational uncertainty; it is not extra admission capacity.
- Reserve anticipated remaining evaluation cost, including measured retry, analysis, checkpoint, dispatch, and other attributable overhead. Count each cost once as it moves from reserved to committed to incurred. Include charges incurred but not yet reported by the provider. Do not count speculative deduplication savings, promotional credits, or an assumed cloud/local speed ratio as established capacity.
- Admission must fit both money and measured completion capacity. Admission starts the latency clock; a candidate waiting for funds or a capacity slot is not admitted yet.
- Keep arrival order among candidates that fit the available budget, capacity, and per-author limit. Affordable work may pass a held expensive candidate. Keep held candidates' original arrival positions when reconsidering them; this is not a guarantee of eventual admission.
- Retain at most **two in-flight evaluations per author**. Admitted queued, running, and paused unfinished evaluations remain in-flight; requests held before admission do not occupy those slots. One evaluation remains a revision/profile evaluation; submitting a revision does not imply it has only one compatible profile.
- Distinguish **waiting for budget/capacity** from **exceeds current evaluation capacity**. The latter has no automatic next-month evaluation promise. Reconsider it when execution cost, service capacity, or its executable revision changes. Both conditions leave publication and practice available, subject to the existing content/access rules.

## Bounded spending and interruption

Reservations are estimates, not proof of a finite completion cost for every settlement path. Authorize spending in bounded batches with a provider-calibrated charge envelope, including shutdown/checkpoint overhead and all concurrently authorized work. Do not dispatch a batch whose possible authorized charges would breach the $100 ceiling. Exact batch sizes, safety margins, and concurrency must be measured and documented during qualification; an analytics alert is not the enforcement mechanism.

If an evaluation needs a larger reservation, top it up only when the remaining budget permits. Otherwise checkpoint and pause, including during final settlement. Preserve completed sessions, unfinished session state, pinned versions, and the original random allocation. Resume that same evaluation when funding becomes available; never replace an expensive session with a fresh draw or silently restart its sample. The ordinary interpreter validity rules remain distinct from a cost pause.

This explicitly replaces the earlier unconditional **finish already running evaluations** policy. Delayed billing, concurrent dispatch, duplicate workers, failed checkpoints, retry charges, and month rollover must be included in enforcement qualification. Release a reservation only after the associated work can no longer incur unaccounted charges. At a monthly reset reconcile prior commitments and remaining work before granting new spending authority; changing months does not complete, discard, or reroll a session.

## Latency and player explanations

For funded, admitted evaluations, qualify **at least 95% completed within one hour and all within 24 hours** in the stated normal and burst scenarios. Measure from original admission through completion, including queueing, retries, and pauses. This sharpens “usually under one hour” and preserves 24 hours as an operational target, not a mathematical guarantee for every random settlement path or outage.

A budget hold before admission is outside that completion target and must be shown explicitly. A budget pause after admission retains the original clock and counts as a target miss if it overruns; do not reclassify it as never admitted. Budget-exhaustion fault scenarios test safe stopping and truthful missed-target reporting separately from the normal/burst completion gate.

Show why evidence is waiting, paused, unavailable under current capacity, incomplete/failed, or complete under the existing precision rules. Explain that the strategy remains available for practice. Preserve completed superseded evidence and existing supersession behavior; shared-run cancellation and cross-author reuse are owned by [Evaluation identity and safe result reuse](https://github.com/0xRowdy/true-count/issues/32). Do not use budget pauses to erase failed execution or to claim partial financial results.

Continue the accepted PostHog-only observability approach. Measure admission delay separately from admitted completion time, and report held/over-capacity fractions, pause reasons, remaining reservations, costs, and target misses alongside queue depth and evaluation outcomes. Do not hide inadequate access behind good admitted-only latency.

## Finite qualification plan

**Owner and stage:** Rowdy accepts the evidence; the implementing agent produces it. Qualification must pass before public standardized evaluations are enabled. This work belongs to the implementation/release effort, not production implementation during this planning session. Every paid cloud experiment requires separately specified scope and spending authorization.

Bound optimization to **one baseline and at most two measured optimization passes**. Candidate optimizations include constant-expression precomputation and faster exact arithmetic. Verify identical prescribed actions, outcomes, payouts, random consumption, and recovered results against the reference implementation; do not claim success from timing alone. Record rejected optimizations and remaining cost drivers. Further optimization requires a separately scoped effort.

Before measurements, freeze a finite fixture manifest and workload schedule covering:

1. Runnable ordinary, near-envelope, and wide-numeric strategies across blackjack, standard craps, and roulette; cover the accepted built-in catalog and applicable benchmark profiles. Include the actual instruction/expression/list limits rather than substituting synthetic counter updates for interpreter work.
2. Multiple simultaneous wagers, list/progression changes, branching, blackjack splits/doubles, and ordinary natural final settlements. Include deliberately prolonged settlement paths as diagnostic fixtures; do not substitute selected diagnostic paths for independent public evaluation samples.
3. Full interpretation, bounded arithmetic, random generation, game execution, analysis, serialization, checkpoint writes, recovery, and session-level retries. Record component and end-to-end costs, memory, numerical complexity, completed sessions, and settlement work.
4. Representative cloud batch shapes, startup behavior, deployed Node/runtime configuration, region, resource allocation, and concurrency. Use measured billable duration and current primary-source charge rules, including attributable overhead. State uncertainty and safety margins; local timings and proposed concurrency are not cloud throughput evidence.
5. Complete 100,000-session runs for the representative qualification revision/profile cases, retaining unfinished work until it completes or reporting qualification failure. Short diagnostic probes cannot establish full-evaluation latency or valid public evidence.

Exercise **200 published revisions in a normal month** with a predeclared mix across all three games, actual compatible profile counts, and ordinary plus expensive strategies. The burst stress case adds **40 revisions on top of that steady workload** (240 total for the stress month), using a clustered arrival schedule. Do not assume two profiles per revision or replace published-revision counts with evaluation counts. Report costs and admission/completion fractions by game and workload class, as well as overall.

The report must state:

- Full-workload cost without access restrictions, normal spending versus the $50 target, and the calibrated limits needed to respect the $100 ceiling and $90 new-admission threshold.
- Fractions admitted, held, over capacity, paused, failed, and completed; admitted latency percentiles and worst case; oldest waiting request; ordinary and burst results separately.
- Exact arithmetic/execution equivalence results and preservation of all complete-session and statistical qualification requirements.
- Failure-injection evidence that spending authorization remains bounded, recovery resumes the same sessions, and no partial result is represented as completed evidence.

**Pass/fail:** Public evaluation access requires passing correctness/evidence checks, demonstrated budget enforcement, and the 95%-within-one-hour/all-within-24-hours targets for admitted work in the ordinary and burst qualification scenarios. Report whether the full assumed publication workload fits or only a constrained portion does. No positive universal admission percentage is asserted in advance: constrained access must be explicitly reported with its measured limits for Rowdy's acceptance, not presented as proof that the full workload is affordable. A configuration admitting zero evaluations cannot pass. Missing cloud calibration, unmeasured cost bounds, or unresolved execution failures do not pass.

If qualification fails, keep public evaluation disabled or present a narrower, measured admission configuration for acceptance and qualification. Never conceal failure by weakening strategy semantics, reducing samples, dropping final settlements, selecting favorable results, or hiding held submissions from the report.

## Planning and execution handoffs

- **[Worker hosting and qualification design](https://github.com/0xRowdy/true-count/issues/41):** the planning follow-up must choose the worker service/region, billing-month convention, enforceable batch charge controls, and reproducible cloud experiment configuration consistent with this budget and the accepted residency approach. Final numeric batch/concurrency and cost-class thresholds require qualification evidence. The Oregon Lambda connectivity-probe choice is not a simulation-worker deployment decision.
- **Evaluation identity and safe result reuse:** keep authoritative identity, cross-author deduplication, shared-run cancellation, and provenance with its existing ticket. Model no reuse savings until that contract and its implementation are qualified.
- **Implementation/release qualification:** the implementing agent executes the finite plan above; Rowdy owns the public-enablement gate. Cloud execution, production engine construction, provisioning, and activation remain outside this planning map. Broader blackjack-reference and statistical acceptance checks remain required even when cost/latency gates pass.

These choices explicitly supersede strict global FCFS, the vague $50–100 ceiling, spend-to-date-only admission checks, unconditional finish-running behavior, and a publication-to-completion 24-hour interpretation in the earlier capacity decision. They preserve the evidence contract and make limited evaluation access the first response to insufficient capacity.

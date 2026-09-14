# Backend workload and cost feasibility

Research for [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37), part of the [True Count — MVP decision map](https://github.com/0xRowdy/true-count/issues/1). Framed 2026-09-08; measurements and pricing completed 2026-09-14. This is a bounded planning investigation, not a production backend or authorization to provision services. It proposes limits and budget changes for decision; it accepts none.

## Evidence and reproduction

- [Local database measurements](backend-workload-measurements.md) define the synthetic operations, PostgreSQL environment, commands, raw results, assertions and measured limits.
- [Provider pricing and workload arithmetic](backend-workload-provider-pricing.md) give current primary sources, complete-stack sensitivities, provider-call boundaries and separate post-MVP costs.
- The accompanying harness and calculator are experimental assets on the research branch: [`experiments/backend-workload-feasibility/`](../../experiments/backend-workload-feasibility/) (README, `run.sh`, `schema.sql`, `harness.py`, `results.json`) and [`experiments/backend-workload-pricing/calculate.py`](../../experiments/backend-workload-pricing/calculate.py) (`results.json`, `--markdown`). They do not replace the accepted implementation contracts.

The workload is fixed by [Backend operating envelope and disaster recovery](https://github.com/0xRowdy/true-count/issues/28#issuecomment-5573796177): 1,000/5,000 MAU, 20,000/100,000 sessions and 400,000/2,000,000 foreground minutes per month, with 100/500 simultaneously connected players. Two devices per player is an additional stress case. The 10% subscriber fraction, two emails per MAU, ten analytics events per session and 20% routine retries are illustrative inputs, not product restrictions or forecasts.

## Verdict

| Scenario | Modelled monthly subtotal (month 12 of history) | Against $50 | Basis |
| --- | ---: | --- | --- |
| Launch: 1,000 MAU, one device, 10 KB or 100 KB results | $30.00 | **Pass** ($20.00 headroom; $40 alert not reached) | $25 Supabase Pro (Micro on credit) + $5 Workers Paid; every metered item inside its included allowance |
| Launch: 1,000 MAU, two devices, 10 KB or 100 KB | $30.00 | **Pass** | 200 peak Realtime connections < 500; 82,368 messages ≪ 5 M |
| Launch: 1,000 MAU, 1 MB results | $36.77 | **Pass** at month 12, but disk grows about $0.65/month for ever ($67.83 by month 60) | 4.3 GB/month on disk after measured compression; provisioned disk exceeds 8 GB at month 2 |
| Growth: 5,000 MAU, one device, 10 KB, anonymous analytics | $90.13 | **Gap $40.13** | the cheapest growth combination modelled |
| Growth: 5,000 MAU, two devices, 100 KB, identified analytics | $133.45 | **Gap $83.45** | the accepted two-device stress case with account-scoped telemetry |
| Growth: 5,000 MAU, two devices, 1 MB | $168.10 | **Gap $118.10** | disk alone is $37.83/month by month 12 and $193.13/month by month 60 (subtotal $323.39) |

Launch passes, and not because MAU fits a free quota: Auth MAU is never the binding meter. It passes because at 1,000 MAU each metered service (Realtime connections and messages, Data API calls, egress, PostHog events, Resend volume, RevenueCat MTR, disk) sits inside its included allowance on the modelled inputs, and the measurements show the database path costs milliseconds per operation with no effect duplication under retry or contention. The month-12 disk lines assume the measured pglz TOAST ratio on synthetic JSON (about 0.22–0.30 on-disk bytes per serialized byte); without compression the 100 KB growth case adds $17.09/month instead of $3.19.

Growth does not fit $50 on any modelled combination, and the gap is not the database. At 5,000 MAU the illustrative inputs push four volume-priced services past their free allowances at once: RevenueCat charges 1% of all monthly tracked revenue once MTR reaches $2,500 (illustrative $2,995 → $29.95), PostHog identified events beyond 1 million cost $40.31 (anonymous $10.18), Resend beyond 3,000 emails needs Pro ($20), and two devices per player make 1,000 peak Realtime connections ($10 and, on capped Pro, a hard 500-connection limit that the price does not lift). Supabase compute, disk, egress and API calls contribute $0–3.19 at 10–100 KB. Modelled crossings: the $40 alert and the $50 target are both first exceeded at about 1,500 MAU on the 100 KB, identified-events path (subtotal $50.26), because Resend Pro becomes necessary at 3,000 emails and the $40–$50 band is crossed in one step; RevenueCat's $2,500 threshold and PostHog's 1 million events are both crossed at about 4,200 MAU (at the 4,250 step the subtotal jumps from $52.35 to $82.69).

## Measurements that drive the verdict

1. **On-disk bytes per accepted result** (measured): 3,379 bytes for a 10 KB session, 23,282 for 100 KB, 215,777 for 1 MB, including receipt, feed and indexes; WAL about the same again. History for 5,000 MAU accumulates 0.34 / 2.33 / 21.6 GB per month at the three sizes, so payload representation, not MAU, decides when provisioned disk leaves the included 8 GB (10 KB: launch stays inside for five years, growth exceeds at month 20 and costs about $2.03/month by month 60; 100 KB: growth exceeds at month 3, $19.95/month by month 60; 1 MB: growth exceeds in the first month, $193/month by month 60).
2. **Concurrency contract holds without extra cost** (measured): 16-way grant races produce one allowance; 200 two-device transfer races produce exactly one accepted transfer each; withdrawal races leave zero public contributions in every interleaving; 1,600 storm retries create nothing and cost 96 bytes of WAL each. There is no correctness-versus-cost trade to make on the database side.
3. **Snapshot lock time scales with account size** (measured): 6.5 ms for a 1-year account, 34 ms for 5 years, 1.0–3.9 s for 100,000 summaries, held only against that account's own writers; a 15-connection pool absorbed 1,000 reconnecting clients in 0.59 s locally and 50 concurrent bootstraps in 0.17 s. Connection count on Micro (60 direct, 200 pooled) is the limiting resource to qualify, not database time.

## Assertion record

Committed run: 39 passed, 0 failed. One real defect was caught and fixed during the session: the first staging function trusted the client-supplied chunk hash and accepted tampered bytes; the server now hashes the bytes itself. Two assertion-arithmetic mistakes in the harness and a payload generator that under-shot its targets were corrected before the committed run. Details in the measurements note.

## Proposed limits and budget changes (for decision, not accepted here)

None of these deletes history, weakens atomicity or privacy ordering, or reduces the three-game scope.

1. **Keep $50 for launch; set the growth expectation now.** The evidence supports $50 at 1,000 MAU with about $20 headroom. For the 5,000 MAU scenario the modelled bill is $90–$170. Either accept a growth target in that range when the $40 alert fires, or decide the policy items below that remove volume-priced services from the fixed target. The $40 alert should be expected around 1,500 MAU on current inputs, not 5,000.
2. **Decide whether RevenueCat's 1% of MTR belongs inside the fixed backend target.** It is revenue-linked (1% of gross tracked revenue) and reaches $29.95 at the illustrative growth mix; excluding it from the fixed target, while still tracking it, removes the largest single growth line. This is a budget-policy decision.
3. **Send anonymous, aggregate operational events to PostHog by default.** Account-scoped operational events are identified events at roughly four times the anonymous rate; at growth this is the difference between $40.31 and $10.18. Keeping private record bodies and account identities out of telemetry is already accepted; making the aggregate/anonymous form the default keeps the meter inside 1 million events longer.
4. **Fix a representative result-artifact budget of about 10–20 KB serialized per completed session for ordinary practice detail, with chunked staging for larger artifacts.** The measured JSON hand log is about 90 bytes per hand, so a 20-minute session is 10–20 KB, which keeps five years of launch history inside the included 8 GB and holds the growth scenario's disk charge to about $2/month at month 60. This is an encoding target, not a cap on what a player may keep: a 10 MB and a 100 MB chunked result were accepted atomically in the harness, and Download all history is preserved.
5. **One Realtime connection per player at a time.** Let a backgrounded second device drop its Realtime socket and rely on the accepted 60-second reconciliation and reconnect fetch; this keeps 500 players inside the capped-Pro 500-connection limit. If two live connections per player are required, the spend cap must be disabled (raising the limit to 10,000) before the $10 overage can even be incurred.
6. **Email volume policy.** Resend's free tier is 3,000/month and 100/day. The accepted decision expects far fewer than two emails per MAU; if real volume approaches 80/day, move to Pro ($20) before a burst is refused, and never rely on the free daily cap for beta shutdown notices to more than 100 testers in one day.
7. **Operational logs beyond seven days must be app-managed.** Supabase Pro retains platform logs for 7 days; the accepted 30-day routine and 90-day incident periods therefore apply to app-managed records (PostHog aggregates or a self-managed store), not to Supabase's log explorer. Log Drains at $60/month are not affordable inside $50.
8. **Beta/production overlap** costs about $11.93 for a 30-day overlap plus 7 cleanup days (a second Micro project at $0.01344/hour with no second compute credit), $0.32 per additional day, with its own 8 GB disk included; export bursts and notices stay inside allowances. This is a temporary charge to schedule inside the launch headroom, not a target increase.

## Remaining implementation checks

- Qualify Micro itself: `shared_buffers`, behaviour at 60 direct/200 pooled connections, Supavisor pool size, and PostgREST RPC overhead per accepted operation, with the harness operations behind RLS and authenticated calls. Local PSS stayed under 250 MB with 69 backends and 128 MB shared buffers; Micro's 1 GB was not exercised.
- Qualify Realtime: connection accounting per device, reconnect storms, Postgres Changes per-subscriber authorization cost versus Broadcast, and message counts against the modelled 41,184–411,840 per month.
- Implement server-side chunk hashing and manifest verification exactly as the harness does after the fix; consider moving durable chunks before taking the head lock to cut lock time on large completions.
- Bound heavy-account snapshot lock time (incremental or pre-materialized summaries) without breaking the single-transaction watermark; measure on Micro.
- Replace the synthetic artifact with the real engine's serialized session detail and re-measure serialized bytes, gzip ratio and TOAST ratio; the model's disk lines depend on them.
- Exercise the provider boundaries this harness only counted: RevenueCat webhooks, Apple/Google current-store checks at the accepted cadence, Resend sends and daily cap, PostHog event identification.
- Verify the accepted retention and compaction protocol for receipts and feeds against the measured 477 bytes per summary and 96-byte retries; this note does not establish a purge policy.
- Confirm `VACUUM`/autovacuum settings and disk auto-expansion behaviour on Supabase so cleanup does not silently provision more disk.
- Set the projected-spend alert to trigger on the modelled meters (events, emails, MTR, peak connections, provisioned disk), not on MAU.

## What the evidence can establish

Local SQL operations can exercise atomic account state, receipts and change-feed acceptance; conflicting allowance ownership; sharing withdrawal ordering; materialized summary snapshots; chunk completion; and cleanup. They can measure the cost of a representative implementation and expose failures. They cannot establish Supabase capacity, authenticated API isolation, Realtime delivery, mobile synchronization, nationwide latency, webhook delivery or store verification.

The managed implementation must preserve the [accepted synchronization contract](https://github.com/0xRowdy/true-count/issues/21#issuecomment-5565344184). In particular, snapshot creation must pair summaries, totals and a watermark under the account synchronization-head lock. Network pages may then read that immutable snapshot; independent live pages cannot be treated as a consistent snapshot. Private results, account changes, receipts and feed updates must commit together. Subscription and email calls remain external to these transactions.

## Interpretation rules

1. **Connected devices are not SQL backends.** Supabase Micro has 1 GB RAM and a documented default of 60 database connections and 200 pooler clients. API clients need bounded pooling and scheduling; a local burst through a finite connection pool is not a claim that Micro supports 500 direct database sessions. Its shared compute and sustained I/O also differ from this workstation. [Compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk).
2. **Quota headroom does not prove burst capacity.** The documented capped Pro Realtime limits are 500 concurrent connections, 500 messages/second and 500 joins/second. Uncapped Pro has different limits. A priced connection overage does not by itself configure the project to accept it; reconnects, notification fan-out and authorization must be qualified together. [Realtime limits](https://supabase.com/docs/guides/realtime/limits).
3. **Stored bytes and transferred bytes are different measurements.** PostgreSQL may compress or move large values into TOAST tables; a gzip ratio is not automatically a database-disk ratio. The report must include table/index/TOAST growth and distinguish serialization from transport compression. [PostgreSQL TOAST](https://www.postgresql.org/docs/current/storage-toast.html).
4. **Live relation size is not the disk bill.** Supabase bills provisioned disk in GB-hours. WAL, system files, temporary work and free-space margin must be added to relation measurements; cleanup does not immediately shrink provisioned capacity or its charge. [Disk-size billing](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size).
5. **History accumulates.** A one-month insertion model cannot establish durable-service cost. Keep the one-year/five-year sensitivities, heavy-account snapshots, initial 90-day detail download and optional all-history downloads visible. These are cost inputs, never permission to erase or truncate accepted histories.
6. **Retry traffic and new effects differ.** Repeated requests consume bandwidth, function time and reads, but an identical accepted retry must not create another result, receipt, feed event, public contribution or allowance grant. Provider billing follows actual accepted sends/transactions; request retries are not automatically additional delivered email or tracked revenue.

## Boundaries retained

The $50 initial backend target and $40 projected-spend alert remain the accepted policy. Any proposed increase, payload/scheduling policy or service-tier change requires a subsequent decision. The three-game launch scope, saved histories, atomicity and privacy barriers are preserved.

Independent B2 backups, restore exercises and automated AI operations remain after MVP functionality. Their incremental executor, transfer, storage, model and notification costs belong in a separate subtotal; they are neither free nor a new MVP gate. On the measured compression, three retained daily copies of the launch database stay inside B2's free 10 GB and daily dump transfer stays inside Supabase's egress allowance; by year five of the growth scenario, dumps are about 22 GB each and daily source transfer about 665 GB/month, which would exceed the 250 GB uncached allowance by itself, so the eventual executor design must use incremental or less frequent full exports. The restore-exercise target and the AI responder's model and hosting costs remain unpriced. The existing [Disposable beta and durable-service transition](https://github.com/0xRowdy/true-count/issues/39) owns when durable service and its recovery promises begin.

Finite billing/control retention remains [Billing and recovery-control retention evidence](https://github.com/0xRowdy/true-count/issues/38), with policy acceptance in [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36). A benchmark deletion or receipt-size measurement does not establish a safe age-only purge policy.

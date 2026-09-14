# Backend workload and cost feasibility

Research for [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37), part of the [True Count — MVP decision map](https://github.com/0xRowdy/true-count/issues/1). Investigated 2026-09-08. This is a bounded planning investigation, not a production backend or authorization to provision services.

## Evidence and reproduction

- [Local database measurements](backend-workload-measurements.md) define the synthetic operations, PostgreSQL environment, commands, raw results, assertions and measured limits.
- [Provider pricing and workload arithmetic](backend-workload-provider-pricing.md) give current primary sources, complete-stack sensitivities, provider-call boundaries and separate post-MVP costs.
- The accompanying harness and calculator are experimental assets on the research branch. They do not replace the accepted implementation contracts.

The workload is fixed by [Backend operating envelope and disaster recovery](https://github.com/0xRowdy/true-count/issues/28#issuecomment-5573796177): 1,000/5,000 MAU, 20,000/100,000 sessions and 400,000/2,000,000 foreground minutes per month, with 100/500 simultaneously connected players. Two devices per player is an additional stress case. The 10% subscriber fraction, two emails per MAU, ten analytics events per session and 20% routine retries are illustrative inputs, not product restrictions or forecasts.

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

Independent B2 backups, restore exercises and automated AI operations remain after MVP functionality. Their incremental executor, transfer, storage, model and notification costs belong in a separate subtotal; they are neither free nor a new MVP gate. The existing [Disposable beta and durable-service transition](https://github.com/0xRowdy/true-count/issues/39) owns when durable service and its recovery promises begin.

Finite billing/control retention remains [Billing and recovery-control retention evidence](https://github.com/0xRowdy/true-count/issues/38), with policy acceptance in [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36). A benchmark deletion or receipt-size measurement does not establish a safe age-only purge policy.

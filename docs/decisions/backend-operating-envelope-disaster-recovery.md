# Backend operating envelope and disaster recovery — accepted decision

Accepted through the live Q1–Q18 review and final integrated confirmation. The resolution on [Backend operating envelope and disaster recovery](https://github.com/0xRowdy/true-count/issues/28#issuecomment-5573796177), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1), is canonical; this file preserves the reviewed decision for repository readers. This is an accepted planning contract, not provisioned infrastructure, measured capacity or verified recovery. Explicitly identified follow-ups remain separate decisions and investigations.

## Accepted scope and sequence

- Preserve Supabase in Virginia, global Cloudflare probe, direct Lambda probe in Oregon, PostHog US Cloud, existing account/synchronization/entitlement contracts and the three-game scope.
- Initial backend target: $50/month, separate from standardized-simulation compute. Keep initial costs low; reconsider spending as users grow. Alert at $40 projected monthly spend. The team decides the response; no automatic throttling, deletion, service shutdown or spending increase follows from an alert.
- Functionality first. App-managed independent backups, recovery exercises and the automated operations responder follow MVP functionality. Their eventual targets are not MVP release gates or demonstrated guarantees.
- Subsequently accepted in [Disposable beta and durable-service transition](https://github.com/0xRowdy/true-count/issues/39#issuecomment-5591787900): invitation-only disposable beta with sandbox subscriptions, at least seven days' announced shutdown/export notice, isolated cleanup, and fresh production accounts. Durable retention starts with the first production account; recovery work remains after MVP functionality. This is a planning decision, not authorization to perform a reset.
- Eventual recovery targets: at most 24 hours of ordinary server-acknowledged history lost, and restoration within 24 hours of outage start. Protect deletion/withdrawal/ownership correctness; data loss cannot authorize resurrection or duplicate allowances.
- Supabase's included provider backups retain seven days. Planned independent copies use Backblaze B2 in a US region and retain three days.
- Human response coverage: the user with another person as backup. Planned automated first response precedes escalation to the user after ten minutes unresolved, through Email and Slack.
- The automated agent may inspect available tools/logs, including PostHog, report findings, and attempt predefined fixes such as an idempotent job retry or stateless-worker restart. Database restores, data deletion, permission changes and spending increases require human decision; escalate immediately when that decision is needed. No deployed tool integration or remediation is claimed.

## Accepted workload scenarios

| Input | Initial scenario | Growth scenario |
| --- | ---: | ---: |
| Monthly active players | 1,000 | 5,000 |
| Active days/player/month | 10 | 10 |
| Sessions/active day | 2 | 2 |
| Session duration | 20 minutes | 20 minutes |
| Sessions/month | 20,000 | 100,000 |
| Foreground session-minutes/month | 400,000 | 2,000,000 |
| Peak simultaneously connected players | 100 | 500 |

These are planning and test assumptions, not demand forecasts, player caps or proven throughput. Non-session foreground time, multiple devices and background/provider traffic add to this baseline.

## Workload accounting and authorized bounded qualification

Use the accepted 60-second foreground reconciliation and 30-second eligible-activity probe cadence. Base reconciliation counts are roughly 400,000 / 2,000,000 monthly, plus opening/reconnection, changes, retries and non-session use. If every session-minute needed probing, primary probes would be 800,000 / 4,000,000, plus entry checks. Normal fallback Lambda traffic depends on primary failures; also test all-primary-failed conditions so fallback is not assumed free. Count provider checks separately: six-hour-stale foreground refresh, at least daily active/grace/retrying/held subscription reconciliation, boundary checks and event/restore/purchase traffic. Never poll stores per gameplay turn or every account reconciliation.

Model two connected devices per active account as an additional stress case. Count connections rather than equating players with connections. Realtime notifications carry change hints, not private record bodies. Account for fan-out, notification-triggered fetches, repeated downloads and bootstrap restart costs.

Use result-payload sensitivity cases of 10 KB, 100 KB and 1 MB per completed session, then replace these assumptions with representative serialized artifacts. They imply about 0.2 / 2 / 20 GB of raw new payload per initial month, or 1 / 10 / 100 GB at growth volume, before indexes, receipts, feed entries, database overhead, backup copies and deletion. This is cost sensitivity, not permission to retain only small records or to cap player histories. Preserve existing on-demand old detail and Download all history.

For qualification, use 1-year and 5-year histories, plus a heavy account with 100,000 summaries. Exercise a 10 MB chunked result and the eventual maximum supported result, partial uploads, late retries, interrupted downloads, concurrent summary-snapshot creation, deletion and account changes. Measure snapshot lock duration separately from total creation/download time; the accepted consistent-watermark contract cannot be traded away for speed. Add bootstrap/export bursts affecting 10% of active accounts, and outage reconnection bursts at the accepted peaks.

Provisional supporting traffic assumptions: 10% subscribing accounts; two transactional emails per MAU/month; ten analytics events per completed session plus bounded aggregate operational events; a 20% request/retry allowance, with explicit failure-storm tests beyond that allowance. These are cost inputs only, not product limits, a subscriber forecast or a provider selection. Include sign-in, recovery/linking, deletion completion, delivery retries and incident emails, then reconcile the email service decision before production use.

The authorized [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37) investigation must implement representative operations against a synthetic dataset and report database size, query/transaction timings, snapshot lock duration, CPU/memory, API/function/message counts, compressed upload/download/backup bytes, nationwide latency and extrapolated monthly costs at both scenarios. Include authentication, grants/transfers, privacy withdrawal, staged chunks, snapshots, exports and deletion, current-store verification mocks plus documented provider qualification, and simultaneous reconnects. It must not claim production validation from quota arithmetic. Prefer local/offline measurement first; paid cloud runs require separately authorized access/spending. Return a priced gap if $50 is infeasible; never silently cut histories, games or correctness.

## Current cost inputs — evidence, not an accepted bill

Verified official sources on 2026-09-07. USD list prices before taxes; credits/free allowances may be shared with other workloads.

| Component | Cost input and accounting boundary |
| --- | --- |
| Supabase Pro | $25/month baseline; includes one Micro via compute credit, 100,000 Auth MAU, 8 GB database disk, 100 GB file storage, 2 million Edge Function calls, 500 peak Realtime connections and 5 million Realtime messages. More compute may be needed regardless of quota headroom. |
| Supabase usage | Uncached egress includes 250 GB, then $0.09/GB; cached egress has a separate allowance/rate and cannot be substituted for private uncached traffic. Realtime excess connections round up in 1,000-connection packages at $10; message excess rounds in 1-million packages at $2.50. Multiple devices can exceed included connection capacity at the 500-player scenario. |
| Cloudflare Workers | Paid $5/month: 10 million requests and 30 million CPU-ms included; excess $0.30/million requests and $0.02/million CPU-ms. No selection of a native database-dump executor is implied. |
| Lambda probe | Oregon x86 requests $0.20/million and first-tier compute $0.0000166667/GB-second. Deduct only remaining shared 1-million-request / 400,000-GB-second free allowance. Function URL adds no endpoint charge. Add logging and transfer; AWS free internet transfer is shared across services/regions. |
| PostHog | Analytics first 1 million events/month free, then starting $0.00005/event; error tracking first 100,000 exceptions free, then starting $0.00037/exception. Avoid per-turn/minute success events when aggregates answer the question. Private records and secrets stay out of telemetry. |
| RevenueCat | Free below $2,500 monthly tracked revenue; at the threshold, 1% of all tracked revenue. Include in the backend/service model, separate from app-store commissions. This can materially consume headroom as subscriptions grow. |
| Email / Slack delivery | Production email provider remains its existing decision. The user accepted a provisional $10/month reserve for email/delivery in the initial scenario, not a quoted provider price or sufficient-volume claim. Qualify Slack access, plan needs and delivery failure behavior. |
| Independent backups — post-MVP | B2 storage $6.95/TB/30-day with first 10 GB free. Include export executor, compression, database source transfer, object operations, retained versions, restore traffic and monitoring. A zero storage bill does not make backup operation free. |
| Automated responder — post-MVP | Model/agent hosting, execution, tool access and independent escalation are unpriced pending implementation choice. Do not hide these costs inside a free analytics quota. |

The initial fixed platform subtotal is $30 (Supabase + Workers), leaving $20 for all other charges. The accepted provisional $10 email reserve leaves $10 of planning headroom, not a verified all-in $50 bill. Track each component and projected month-end total. Simulation compute is accounted separately; shared infrastructure costs must be attributed once.

Illustrative dump sensitivity: one compressed 1 GB full export daily is roughly 30 GB/month of source transfer and roughly 3 GB for three independent daily copies. Actual retained versions and lifecycle timing may increase bytes. Full hourly exports would instead approach 730 GB/month, exceeding Supabase's uncached allowance by 480 GB before other traffic and adding $43.20. The daily-history objective avoids assuming hourly full dumps are affordable, but daily scheduling alone does not prove a hard 24-hour recovery point.

Sources: [Supabase pricing](https://supabase.com/pricing), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Realtime connections](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections), [messages](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [Oregon rates](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-west-2/index.json), [Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/apig-http-invoke-decision.html), [AWS transfer allowance](https://aws.amazon.com/about-aws/global-infrastructure/global-network/faqs/), [PostHog analytics](https://posthog.com/product-analytics), [error tracking](https://posthog.com/error-tracking), [RevenueCat](https://www.revenuecat.com/pricing), [B2 pricing](https://www.backblaze.com/cloud-storage/pricing).

## Retention: accepted periods and remaining control schedule

Existing saved-history behavior is preserved: three-day backup retention does not erase three-day-old sessions. Active-system account deletion remains immediate access/public suppression with cleanup targeted within seven days; generated exports and temporary bootstrap snapshots expire after 24 hours.

Accepted additional periods (Q17), subject to provider/privacy qualification:

- Abandoned private upload chunks expire after 24 hours without progress; a returning client restarts staging from its retained local source. An incomplete upload never counts as an accepted result. Apply account-deletion cleanup sooner when required.
- Routine app-managed operational logs: 30 days. Security/incident evidence: 90 days, restricted to the minimum relevant metadata and operational access. Provider-managed retention is separately inventoried and qualified; do not claim these settings configure every provider. Actual legal holds need an explicit scope, owner, review and expiry, not indefinite blanket retention.

Accepted control-retention handoff:

- Independently protected deletion/revocation/withdrawal controls: do not select an arbitrary period before qualifying all recoverable backups and credential/replay paths. [Billing and recovery-control retention evidence](https://github.com/0xRowdy/true-count/issues/38) supplies the finite schedule to the privacy release decision. If a path prevents finite compaction, fix that path or explicitly revisit retention instead of silently keeping private history. Missing/deleted account IDs remain denied, and IDs are never reused.
- Receipts/feed compaction: use a protocol watermark and snapshot reset, not an age-only delete. A stale operation must become a safe retry/reconciliation or be rejected; it must never be treated as a fresh allowance, payout, privacy or ownership operation. Purge payloads once the accepted operation is durably represented and safe compaction is established. Finite age and maximum retained bytes need qualification with the workload investigation.
- Billing ownership/control retention and any legally necessary records use the same [focused evidence follow-up](https://github.com/0xRowdy/true-count/issues/38), with final policy choices owned by [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36). Do not invent a statutory retention period or discard evidence while a source can still confer benefits. This is a precise remaining decision, separate from retention of unrelated private history.

The operations owner maintains a table of category, purpose, storage/provider location, access, expiry trigger, cleanup job and failure alert. Include staged uploads, snapshots, exports, Auth/storage/provider copies and raw tokens; maintain the existing deletion ordering and provider revocation requirements. Provider backup/log geography and exact purge behavior remain qualification tasks under the accepted US-primary/disclosed-wider-processing contract.

## Accepted post-MVP recovery procedure

Choose B2 US West for independently controlled, encrypted backups, with separate restricted writer/restore credentials and separately recoverable encryption keys. The exact executor, schedule margin and immutability/lifecycle settings require the bounded recovery design and exercise; provider daily snapshots plus a cron schedule are not evidence of a maximum 24-hour loss. Protect database contents, Storage object bytes and versions needed for recovery, schema/migrations/pinned execution definitions, essential provider configuration and credential/key recovery references. Never dump secrets into source control or operational model context.

A human authorizes a restore. Fence affected writes, public reads and caches; preserve evidence and select the latest complete verified recovery set. Restore into an isolated environment, then reconcile independently protected control state and uncertain operations before reopening service. A database backup alone cannot preserve post-backup deletion, sharing withdrawals, device revocations, grant/transfer outcomes or accepted purchase ownership.

The control-recovery design must establish how sensitive acceptance is durably protected before it can be reported successful, and how partial cross-provider outcomes are resolved. It must fail closed on uncertain grants/transfers, sharing, deletion and purchase ownership; no distributed atomicity is assumed. Recover current store evidence without advancing verification time merely because a backup was loaded. Rebuild affected public aggregates only after withdrawal/deletion filtering. Invalidate stale server sessions or credentials where needed without extending device offline deadlines.

On delayed-device return, reconcile the server generation, local pending receipts and original allocation/expiry. No stale upload creates an account; no retry reapplies a payout; a frozen source transfer stays frozen until authoritative resolution. Client copies may recover ordinary histories only through accepted revision/conflict rules, never overriding protected deletions or fabricating lost results.

Before declaring recovery operational, exercise backup age, complete recovery duration, corrupted/missing copies, unavailable keys/provider, expired chunks/snapshots, a backup predating deletion/withdrawal/transfer/benefits-only restoration, delayed devices, competing restores and late webhooks. Verify no privacy resurrection, duplicated benefits/allowance/payouts or stale verified-at timestamp. The accepted repeat cadence is quarterly and after material changes, beginning after MVP functionality. If safety cannot be established, keep affected service fenced and escalate rather than reopening to meet the time target.

[Supabase backups](https://supabase.com/docs/guides/platform/backups) exclude Storage object bytes and custom-role passwords; deleting a project removes provider backups. [CLI export/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) is a starting point, not a complete runbook. [B2 regions](https://www.backblaze.com/docs/cloud-storage-data-regions) and [Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock) support the provider investigation; immutability duration must agree with finite retention and deletion disclosures.

## Accepted monitoring and responder design

Monitor availability, sync/transaction failures and queue age, snapshot lock/latency, storage/transfer growth, exports/deletion completion, subscription reconciliation and verification failures, security/access failures and projected spend. Preserve accepted webhook start-within-one-minute / alert-after-five-minute targets and Google acknowledgement alert at one hour. Later add backup age/validation failures and the automated responder's own health and spend.

Keep PostHog as the operational dashboard/telemetry tool. The agent can query other existing authorized provider tools when PostHog lacks needed evidence. Redact logs and treat their contents as untrusted data; a log line cannot authorize tool actions. Use a predefined action allowlist, per-incident attempt limits, identity-bound audit results and least-privilege access. Do not grant broad infrastructure access simply because a connector exists.

Start the ten-minute escalation deadline at initial alert dispatch, not when the agent begins working; retries do not reset it. Immediate human escalation covers missing authority, dangerous/ambiguous state, unavailable tools or a suspected privacy/security incident. Independent deterministic timeout/heartbeat delivery must alert through Email and Slack if the agent fails, stalls or cannot prove recovery. Preserve an incident ID to deduplicate while recording channel failures. Recovery means a fresh health check and relevant state checks pass, not merely that a restart command succeeded.

Before the automated responder is implemented: essential actionable alerts go directly to the human team; budget responses stay human-decided. Exact inbox, Slack channel, account credentials and named backup responder are implementation configuration, not secrets to place in this document. The production email decision must include operational escalation traffic. Agent implementation and periodic exercises follow MVP functionality; implementation is not claimed by this planning decision.

## Remaining decisions and handoffs

- [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37) owns the bounded measurements; they are not claimed to have happened.
- [Billing and recovery-control retention evidence](https://github.com/0xRowdy/true-count/issues/38) owns finite billing/ownership/receipt retention evidence and provider purge qualification; the privacy release decision consumes the answer and accepts the final schedule.
- [Disposable beta and durable-service transition](https://github.com/0xRowdy/true-count/issues/39) owns reset disclosure, server/device/provider cleanup, sandbox-to-production isolation and activation of durable service. The choice remains TBD, rather than automatically blocking MVP on independent backups or restores.
- Keep implementation of independent backups and the AI responder after MVP functionality. Their engineering tasks belong to delivery planning, not an implicit production implementation during this map session.

## Account-deletion timing amendment

Apply the accepted [30-day undo window](authentication-account-lifecycle.md#accepted-amendment--30-day-deletion-undo-window). Scheduling deletion immediately deactivates access and hides public content but preserves account data for undo. Irreversible deletion acceptance, device wiping and the seven-day active cleanup target begin at the scheduled deadline or accepted Delete permanently now action. Protect the current scheduled/canceled/permanent state during replay and recovery; old jobs cannot finalize a canceled schedule or undo permanent deletion. This does not extend temporary-file TTLs or establish purchase-lineage retention.

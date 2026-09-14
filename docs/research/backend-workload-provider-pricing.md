# Backend workload provider pricing and arithmetic

Evidence for [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37), companion to the [feasibility report](backend-workload-feasibility.md) and the [local database measurements](backend-workload-measurements.md). Prices checked against first-party pages on 2026-09-14; USD list prices before tax. Every number in the tables below is produced by [`experiments/backend-workload-pricing/calculate.py`](../../experiments/backend-workload-pricing/calculate.py) (`python3 calculate.py --markdown`), which reads the measured inputs from the harness `results.json`. This is planning arithmetic, not a bill, a capacity claim or authorization to provision anything.

Labels used throughout: **measured** (from the local harness), **modelled** (arithmetic from accepted inputs), **assumed** (a rate or behaviour taken from a provider page), **illustrative** (sensitivity inputs that are explicitly not product limits: 10% subscribers, two emails per MAU per month, ten analytics events per session, 20% retry traffic).

## Rate checks (first-party, 2026-09-14)

### Supabase

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Pro plan | "from $25/month"; includes "$10/month in compute credits, which covers one Micro instance"; credits are per organization and "do not accumulate" | [Pricing](https://supabase.com/pricing), [Compute usage](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| Micro compute | "$0.01344" per hour ("~$10"/month); "2-core (shared)"; "1 GB" memory; "Database Max Connections 60"; "Connection Pooler Max Clients 200"; max DB size "10 GB" | [Compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk) |
| Small compute | "$0.0206" per hour ("~$15"/month); "2 GB" memory; 90 direct / 400 pooler | Same |
| Additional projects | "Additional projects each add their own compute cost"; charged by the hour, partial hours billed as full hours; no second compute credit | [Pricing](https://supabase.com/pricing), [Compute usage](https://supabase.com/docs/guides/platform/manage-your-usage/compute) |
| Pooler limits | "The Supavisor connection limits are hard-coded and cannot be changed without upgrading the compute size"; guidance not to raise the pool past 40% of max connections when the Data API is heavily used | [Connection limits](https://supabase.com/docs/guides/troubleshooting/how-to-change-max-database-connections-_BQ8P5), [Connection management](https://supabase.com/docs/guides/database/connection-management) |
| Disk | "8 GB disk size per project included, then $0.125 per GB"; billed in GB-hours on provisioned size ("$0.000171 per GB-Hr"); gp3 3,000 IOPS and 125 MB/s included; "You can increase disk size but cannot decrease it"; auto-expansion at 90% to 1.5x; right-sizing to "1.2x the size of the database with a minimum of 8 GB" only during a project upgrade | [Disk size](https://supabase.com/docs/guides/platform/manage-your-usage/disk-size), [Compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk), [Database size](https://supabase.com/docs/guides/platform/database-size) |
| Auth | "100,000 monthly active users (then $0.00325 per MAU)" | [Pricing](https://supabase.com/pricing), [MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users) |
| File storage | "100 GB included, then $0.0213 per GB" | [Pricing](https://supabase.com/pricing) |
| Egress | uncached "250 GB included, then $0.09 per GB"; cached "250 GB included, then $0.03 per GB"; "Cached and uncached egress have independent quotas and independent pricing" | [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress) |
| Data API | "Unlimited API requests" on Pro; API requests are not among the 21 billable items | [Pricing](https://supabase.com/pricing), [Billable items](https://supabase.com/docs/guides/platform/manage-your-usage) |
| Edge Functions | "2 Million included, then $2 per 1 Million"; billed regardless of status code, in whole 1-million packages | [Invocations](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations) |
| Realtime peak connections | "500 included, then $10 per 1000"; measured as the highest concurrent count in the cycle, summed across projects | [Peak connections](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-peak-connections) |
| Realtime messages | "5 Million included, then $2.50 per Million"; "Each database change counts as one message per client that listens to the event"; a broadcast counts one send plus one per subscribed client | [Messages](https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages) |
| Realtime limits | Concurrent connections "Free 200 / Pro 500 / Pro (no spend cap) 10,000 / Team 10,000"; messages per second "100 / 500 / 2,500 / 2,500"; channel joins per second the same; "When you exceed a limit, errors will appear in the backend logs and client-side messages in the WebSocket connection" | [Realtime limits](https://supabase.com/docs/guides/realtime/limits) |
| Postgres Changes scaling | "Realtime performs 100 authorization checks — one per user — so throughput scales with the number of subscribers, not the write rate"; "processed on a single thread"; use Broadcast above "~3,000 concurrent subscribers on the same changes" | [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) |
| Spend cap | On by default on Pro; when enabled, "further usage of that item is disallowed until the next billing cycle"; compute, PITR and log drains are outside the cap | [Cost control](https://supabase.com/docs/guides/platform/cost-control) |
| Backups and PITR | Pro daily backups retained "7 days"; PITR 7-day "~$100"/month and "must also use at least a Small compute add-on" | [Backups](https://supabase.com/docs/guides/platform/backups), [PITR](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery) |
| Logs | Pro log retention "7 days"; Log Drains "$60 per drain per month, + $0.20 per million events, + $0.09 per GB egress", not covered by the spend cap | [Pricing](https://supabase.com/pricing), [Log drains](https://supabase.com/docs/guides/platform/manage-your-usage/log-drains) |
| Branching | "$0.01344 per branch, per hour"; compute credits do not apply | [Branching](https://supabase.com/docs/guides/platform/manage-your-usage/branching) |

Not stated on any checked Supabase page: the numeric default pooler pool size for Micro.

### Cloudflare Workers

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Paid plan | "$5 USD per month for an account"; "10 million included per month" requests, "$0.30 per additional million"; "30 million CPU milliseconds included per month", "$0.02 per additional million CPU milliseconds"; "There are no additional charges for data transfer (egress)" | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Free plan | "100,000 per day" requests; "10 milliseconds of CPU time per invocation" | Same |
| Workers Logs | Paid "20 million included per month", "$0.60 per additional million", "7 Days" retention | [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) |

### AWS Lambda (Oregon, us-west-2), CloudWatch Logs, data transfer

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Lambda requests and duration | x86 "0.0000002000 USD per Request" ($0.20/million); tier-1 duration "0.0000166667 USD per Lambda-GB-Second" | [AWS Price List CSV, us-west-2](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/us-west-2/index.csv) (publication 2026-09-11), [Lambda pricing](https://aws.amazon.com/lambda/pricing/) |
| Free tier | "one million requests and 400,000 GB-seconds per month"; "This always free service is on the Free and Paid plan"; "Your usage is calculated each month across all regions" (shared across the account, not per function) | [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [Lambda](https://aws.amazon.com/pm/lambda/), [Free tier FAQ](https://aws.amazon.com/free/free-tier-faqs/) |
| Function URLs | "There are no additional charges for the URL endpoint itself"; default 1,000 concurrent executions per region | [Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/furls-http-invoke-decision.html) |
| CloudWatch Logs (Oregon) | "$0.50 per GB custom log data ingested in Standard log class"; "$0.03 per GB-mo of log storage"; "$0.005 per GB log data scanned"; free tier "5 GB Data (ingestion, archive storage, and data scanned)" | [CloudWatch Price List CSV](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonCloudWatch/current/us-west-2/index.csv), [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/) |
| Data transfer out | "100 GB of free data transfer out to the internet free each month, aggregated across all AWS Services and Regions"; then "$0.090 per GB - first 10 TB / month" | [EC2 on-demand](https://aws.amazon.com/ec2/pricing/on-demand/), [Data Transfer Price List CSV](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/current/us-west-2/index.csv) |

### PostHog (US Cloud)

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Free allowance | "1M events" product analytics and "100K exceptions" error tracking per month; "$0/mo base price" | [Pricing](https://posthog.com/pricing), [pricing.md](https://posthog.com/pricing.md) |
| Anonymous events | 1,000,001–2,000,000 "$0.00005"; 2,000,001–15,000,000 "$0.0000343" | [pricing.md](https://posthog.com/pricing.md), [Product analytics pricing](https://posthog.com/product-analytics/pricing) |
| Identified events | 1,000,001–2,000,000 "$0.000198"; 2,000,001–15,000,000 "$0.0000697" | [pricing.md](https://posthog.com/pricing.md) |
| Which rate applies | "anonymous events can be up to 4x cheaper than identified ones"; "Your first one million events each month are free, regardless if they are anonymous or identified"; "We're not charging you for both"; an event is identified when the SDK calls "identify(), alias(), group(), setPersonProperties()" or person profiles are processed | [Anonymous vs identified](https://posthog.com/docs/data/anonymous-vs-identified-events) |
| Error tracking | "100,000 exceptions free every month, then starting at $0.000370/exception" | [Error tracking pricing](https://posthog.com/error-tracking/pricing) |

Account-scoped operational events (failed receipts, queue age, verification failures) are identified events unless the pipeline deliberately avoids person profiles; the model therefore prices the identified rate as the base and the anonymous rate as a sensitivity.

### RevenueCat

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Threshold and rate | "Pay nothing for up to $2,500 in monthly tracked revenue. Then pay 1% of what you track once you hit $2,500 in MTR." | [Pricing](https://www.revenuecat.com/pricing) |
| Whole-MTR rule | "RevenueCat will remain free until you reach $2.5k in MTR, and beyond that limit for everyone on the Pro Plan, we will bill for 1% of MTR"; "if you earned $2,600 in MTR in the previous billing cycle, you would incur a charge of $26" | [Account management](https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management) |
| MTR basis | "MTR is measured before store commission and taxes" | Same |

The subscription prices used for MTR ($5.99/month, $39.99/year) are the provisional launch prices from [launch pricing research](launch-pricing.md), not approved prices.

### Resend (accepted email provider; provisional $10 reserve)

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Free | "$0/mo"; "3,000" emails/month; "100 emails per day"; "30-day data retention" | [Pricing](https://resend.com/pricing), [Quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) |
| Pro | "$20/mo" for "50,000" emails; "No daily email limit"; overage "$0.90" per 1,000 | [pricing.md](https://resend.com/pricing.md) |
| Rate limit | "10 requests per second" per team | [Quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) |

The 100/day free cap matters more than the 3,000/month cap: the illustrative launch volume averages 80/day, so a sign-in burst, a security-alert wave or a beta shutdown notice to more than 100 testers in one day exceeds it. The [accepted email decision](https://github.com/0xRowdy/true-count/issues/33#issuecomment-5580311915) starts on the free tier and expects most sign-ins through Apple/Google; this note prices Pro ($20) wherever the illustrative volume exceeds 3,000/month.

### Backblaze B2 (post-MVP independent backups)

| Item | Figure as quoted | Source |
| --- | --- | --- |
| Storage | "$6.95/TB/30-day"; "First 10GB storage is always free"; "No minimum storage duration fees" | [B2 pricing](https://www.backblaze.com/cloud-storage/pricing) |
| Egress | "free egress up to 3x their average monthly storage. Egress beyond 3x is just $0.01/GB" | Same |
| Transactions | "Class A, B, and C API calls are free for pay-as-you-go customers" | [Transaction pricing](https://www.backblaze.com/cloud-storage/transaction-pricing) |
| Versions | "You are charged for duplicate files and old versions of updated files" | [Files](https://www.backblaze.com/b2/docs/files.html), [Lifecycle rules](https://www.backblaze.com/docs/cloud-storage-lifecycle-rules) |
| US West | "store data in both the Sacramento and Phoenix data centers" | [Data regions](https://www.backblaze.com/docs/cloud-storage-data-regions) |

### Slack, Apple and Google (no listed charge)

- Slack free plan: "90 days of message history", "Up to 10 apps"; incoming webhooks documented without a plan restriction. [Slack pricing](https://slack.com/pricing), [Usage limits](https://slack.com/help/articles/115002422943-Usage-limits-on-the-free-version-of-Slack), [Incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).
- Apple App Store Server API, Get All Subscription Statuses: no price listed; production limit 50 requests per second per app, sandbox 10% of that. [Endpoint](https://developer.apple.com/documentation/appstoreserverapi/get-all-subscription-statuses), [Rate limits](https://developer.apple.com/documentation/appstoreserverapi/identifying-rate-limits).
- Google Play Developer API `purchases.subscriptionsv2.get`: no price listed; "The default quota is 3000 queries per minute for each bucket". [Endpoint](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get), [Quotas](https://developers.google.com/android-publisher/quotas).

## Model inputs

Fixed by the [accepted operating envelope](../decisions/backend-operating-envelope-disaster-recovery.md): 1,000 / 5,000 MAU, 10 active days, two 20-minute sessions per active day (20,000 / 100,000 sessions; 400,000 / 2,000,000 foreground minutes), 100 / 500 peak simultaneous players, 60-second reconciliation, 30-second probe cadence, two devices per player as a stress case. Store checks are counted as 30 daily reconciliations, 10 boundary/lifecycle checks and 2 six-hour foreground refreshes per subscriber per month without coalescing, per the [accepted verification cadence](https://github.com/0xRowdy/true-count/issues/23#issuecomment-5565993635). Probe attempts assume every foreground minute needs two probes plus one at session open, times the retry factor, which is the accepted upper bound rather than a measurement.

Illustrative sensitivity inputs (not limits or forecasts): 10% subscribers on monthly plans; two transactional emails per MAU; ten analytics events per session plus 3,000 aggregate operational events; a 20% retry factor applied to every call and message count; 10% of MAU bootstrap a new device in the month; 1% download all history; 600-byte reconcile responses; 200-byte change hints.

## Generated tables

<!-- generated by experiments/backend-workload-pricing/calculate.py -->

### Measured inputs used by the model

| Input | 10 KB | 100 KB | 1 MB | Source |
| --- | ---: | ---: | ---: | --- |
| Serialized result bytes | 10,022 | 100,002 | 1,000,356 | measured |
| On-disk bytes per accepted result (payload + receipt + feed + indexes) / serialized | 0.34 | 0.23 | 0.22 | measured (pglz TOAST) |
| WAL bytes per accepted result / serialized | 0.36 | 0.24 | 0.22 | measured |
| gzip -6 ratio of the serialized artifact | 5.42 | 6.31 | 6.61 | measured (synthetic JSON) |
| Summary + receipt + feed bytes per result without payload | 477 | | | measured (100,000-summary account) |
| Snapshot row serialized bytes | 142 | | | measured |

### Modelled monthly counts

| Scenario | Backend calls | Probe attempts | Peak Realtime connections | Realtime messages (Postgres Changes) | Emails | Analytics events | Uncached egress GB | New on-disk GB/month | DB GB after 12 / 60 months |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 MAU, 1 device, 10 KB | 600,084 | 984,000 | 100 | 41,184 | 2,400 | 243,600 | 0.68 | 0.067 | 0.8 / 4.0 |
| 1,000 MAU, 1 device, 100 KB | 600,084 | 984,000 | 100 | 41,184 | 2,400 | 243,600 | 3.27 | 0.466 | 5.6 / 27.9 |
| 1,000 MAU, 1 device, 1 MB | 600,084 | 984,000 | 100 | 41,184 | 2,400 | 243,600 | 29.19 | 4.314 | 51.8 / 258.8 |
| 1,000 MAU, 2 devices, 10 KB | 1,157,268 | 1,968,000 | 200 | 82,368 | 2,400 | 243,600 | 1.07 | 0.067 | 0.8 / 4.0 |
| 1,000 MAU, 2 devices, 100 KB | 1,157,268 | 1,968,000 | 200 | 82,368 | 2,400 | 243,600 | 3.66 | 0.466 | 5.6 / 27.9 |
| 1,000 MAU, 2 devices, 1 MB | 1,157,268 | 1,968,000 | 200 | 82,368 | 2,400 | 243,600 | 29.58 | 4.314 | 51.8 / 258.8 |
| 5,000 MAU, 1 device, 10 KB | 2,996,964 | 4,920,000 | 500 | 205,920 | 12,000 | 1,203,600 | 3.41 | 0.337 | 4.0 / 20.2 |
| 5,000 MAU, 1 device, 100 KB | 2,996,964 | 4,920,000 | 500 | 205,920 | 12,000 | 1,203,600 | 16.37 | 2.328 | 27.9 / 139.7 |
| 5,000 MAU, 1 device, 1 MB | 2,996,964 | 4,920,000 | 500 | 205,920 | 12,000 | 1,203,600 | 145.97 | 21.570 | 258.8 / 1294.2 |
| 5,000 MAU, 2 devices, 10 KB | 5,782,884 | 9,840,000 | 1,000 | 411,840 | 12,000 | 1,203,600 | 5.33 | 0.337 | 4.0 / 20.2 |
| 5,000 MAU, 2 devices, 100 KB | 5,782,884 | 9,840,000 | 1,000 | 411,840 | 12,000 | 1,203,600 | 18.29 | 2.328 | 27.9 / 139.7 |
| 5,000 MAU, 2 devices, 1 MB | 5,782,884 | 9,840,000 | 1,000 | 411,840 | 12,000 | 1,203,600 | 147.89 | 21.570 | 258.8 / 1294.2 |

### Priced line items (USD/month, month 12 of accumulation, identified analytics events)

| Line item | 1k MAU 1dev 10KB | 1k MAU 1dev 100KB | 1k MAU 1dev 1MB | 1k MAU 2dev 10KB | 1k MAU 2dev 100KB | 1k MAU 2dev 1MB | 5k MAU 1dev 10KB | 5k MAU 1dev 100KB | 5k MAU 1dev 1MB | 5k MAU 2dev 10KB | 5k MAU 2dev 100KB | 5k MAU 2dev 1MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| supabase_pro_with_micro | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 | 25.00 |
| supabase_disk_month12_at_growth_rate | 0.00 | 0.00 | 6.77 | 0.00 | 0.00 | 6.77 | 0.00 | 3.19 | 37.83 | 0.00 | 3.19 | 37.83 |
| supabase_egress | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| supabase_realtime_peak_connections | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 10.00 | 10.00 | 10.00 |
| supabase_realtime_messages | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| workers_paid_probes_1ms | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| workers_logs_one_per_probe | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| lambda_1pct_fallback | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| resend | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 20.00 | 20.00 | 20.00 | 20.00 | 20.00 | 20.00 |
| posthog_events_identified | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 40.31 | 40.31 | 40.31 | 40.31 | 40.31 | 40.31 |
| posthog_errors_under_100k | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| revenuecat_all_monthly_plans | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 29.95 | 29.95 | 29.95 | 29.95 | 29.95 | 29.95 |
| **Subtotal** | **30.00** | **30.00** | **36.77** | **30.00** | **30.00** | **36.77** | **120.26** | **123.45** | **158.09** | **130.26** | **133.45** | **168.09** |
| Gap versus $50 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 70.26 | 73.45 | 108.09 | 80.26 | 83.45 | 118.09 |
| Subtotal with anonymous analytics events instead | 30.00 | 30.00 | 36.77 | 30.00 | 30.00 | 36.77 | 90.13 | 93.32 | 127.96 | 100.13 | 103.32 | 137.96 |
| Subtotal at month 60 disk instead of month 12 | 30.00 | 33.19 | 67.83 | 30.00 | 33.19 | 67.83 | 122.29 | 140.21 | 313.39 | 132.29 | 150.21 | 323.39 |

### Sensitivities (USD/month)

| Sensitivity | 1k MAU 1dev 10KB | 1k MAU 2dev 100KB | 5k MAU 1dev 100KB | 5k MAU 2dev 100KB | 5k MAU 2dev 1MB |
| --- | ---: | ---: | ---: | ---: | ---: |
| supabase_edge_if_all_calls_use_edge_functions | 0.00 | 0.00 | 2.00 | 8.00 | 8.00 |
| posthog_events_other_rate | 0.00 | 0.00 | 10.18 | 10.18 | 10.18 |
| revenuecat_annual_cohort | 39.99 (MTR 3,999) | 39.99 (MTR 3,999) | 199.95 (MTR 19,995) | 199.95 (MTR 19,995) | 199.95 (MTR 19,995) |
| lambda_all_primary_failed | 0.00 | 0.19 | 0.78 | 4.11 | 4.11 |
| lambda_all_primary_failed_no_free_tier | 0.99 | 1.98 | 4.94 | 9.88 | 9.88 |
| lambda_1s_all_primary_failed | 0.00 | 0.19 | 4.37 | 17.95 | 17.95 |
| workers_10ms_cpu_increment | 0.00 | 0.00 | 0.38 | 1.37 | 1.37 |
| realtime_messages_if_broadcast | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| disk_cost_month12_no_toast_compression | 0.00 | 2.62 | 17.09 | 17.09 | 179.09 |

### Growth fit ladder (each step is a proposal requiring a decision, not an accepted change)

| Running subtotal | After |
| ---: | --- |
| 133.45 | growth base: 5,000 MAU, two devices, 100 KB results, identified analytics events |
| 103.32 | send only anonymous analytics events (no person profiles) |
| 93.32 | one Realtime connection per player (background device disconnects) keeps peak within 500 |
| 73.32 | transactional email stays within Resend free tier (needs <= 3,000/month and <= 100/day; illustrative 2/MAU exceeds it) |
| 43.37 | treat RevenueCat's 1% of MTR as revenue-linked cost outside the fixed backend target (policy decision required) |
| 40.18 | month-1 rather than month-12 disk (history accumulates; this is timing, not a saving) |

### Modelled crossing of the $40 alert and $50 target (100 KB results, identified events)

| Devices | First MAU step above $40 | First MAU step above $50 | Points |
| --- | ---: | ---: | --- |
| 1 | 1500 | 1500 | 1000: 30.00, 1250: 30.05, 1500: 50.26, 1750: 50.47, 2000: 50.68, 2250: 50.89, 2500: 51.10, 2750: 51.30, 3000: 51.51, 3250: 51.72, 3500: 51.93, 3750: 52.14, 4000: 52.35, 4250: 82.69, 4500: 96.28, 4750: 109.86, 5000: 123.45 |
| 2 | 1500 | 1500 | 1000: 30.00, 1250: 30.05, 1500: 50.26, 1750: 50.47, 2000: 50.68, 2250: 50.89, 2500: 51.10, 2750: 61.30, 3000: 61.51, 3250: 61.72, 3500: 61.93, 3750: 62.14, 4000: 62.35, 4250: 92.69, 4500: 106.28, 4750: 119.86, 5000: 133.45 |

### Beta/production overlap (temporary)

| Item | Value |
| --- | --- |
| Second Micro project for 30 overlap days + 7 cleanup days at $0.01344/h (no second compute credit) | $11.93 |
| Each additional overlap day | $0.323 |
| Second project disk included | 8 GB |
| Beta notices for 50 testers (entry + shutdown) | 100 emails; 1 day(s) at the 100/day free cap |
| Export burst (each tester exports twice, 12 MB five-year history) | 1.20 GB; $0.00 within the 250 GB allowance |
| Shutdown fencing, job cancellation, cleanup retries | compute only; within the second project's Micro hours above |
| Total priced overlap | $11.93 for the modelled window |

### Post-MVP subtotal (separate; not an MVP gate)

| Case | DB GB | Dump GB (gzip ratio as measured) | Source transfer GB/month (daily full dump) | B2 stored GB (3 copies) | B2 storage $ | Supabase egress $ if beyond allowance | Executor (illustrative Lambda) $ | Priced subtotal $ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| launch_10KB_year1 | 0.81 | 0.128 | 3.9 | 0.39 | 0.00 | 0.36 | 0.00 | 0.00 |
| launch_100KB_year1 | 5.59 | 0.886 | 26.6 | 2.66 | 0.00 | 2.43 | 0.00 | 0.00 |
| growth_100KB_year1 | 27.94 | 4.428 | 132.8 | 13.28 | 0.02 | 11.97 | 0.00 | 0.02 |
| growth_100KB_year5 | 139.69 | 22.138 | 664.1 | 66.41 | 0.39 | 59.85 | 0.00 | 0.39 |

PITR alternative if ever adopted (7-day add-on plus Small compute beyond the credit): $105.04/month. AI operations and restore-exercise compute: unpriced.


## Reading the tables

- **Launch (1,000 MAU) passes the $50 target on the modelled inputs** at 10 KB and 100 KB results, one or two devices: $30 fixed (Supabase Pro with the Micro credit plus Workers Paid) and every usage meter inside its included allowance. The 1 MB case adds disk from month 2 onward and reaches about $37 by month 12 ($68 by month 60). This is not "MAU fits a free quota": Auth MAU is not the binding meter anywhere in the model; the binding meters are Realtime peak connections, PostHog events, Resend volume, RevenueCat MTR and disk growth, each checked separately above.
- **Growth (5,000 MAU) does not fit $50 on any modelled combination**: the smallest growth subtotal is about $90 (10 KB results, one device, anonymous events) and the two-device, 100 KB, identified-events case is about $133. The gap is dominated by volume-priced services outside the database: RevenueCat's 1% of whole MTR once illustrative MTR reaches $2,995, PostHog identified events beyond 1 million, Resend beyond 3,000 emails, and the second-device Realtime connections beyond 500. Database compute, disk, egress and API calls are a minor part of the gap at 10 KB and 100 KB.
- **Disk accumulates and never shrinks on its own.** The month-12 disk lines assume the measured pglz TOAST ratio on synthetic JSON; the "no TOAST compression" sensitivity is the pessimistic bound. Provisioned disk is charged even after deletion; only a project upgrade right-sizes it.
- **Two devices per player crosses the capped Pro Realtime limit at 500 players.** 1,000 peak connections is both a $10 overage and a hard limit unless the spend cap is disabled ("Pro (no spend cap)" 10,000); the limit applies before the price.
- **Retries are priced as traffic, not as effects.** The 20% factor inflates calls, messages, emails and events; the measurements confirm that accepted retries create no rows, so provider charges for accepted sends and transactions are not inflated.

## Provider-call boundaries stubbed, not qualified

The harness records call counts for store verification, webhook ingress, email sends and analytics events at their documented cadence; it does not exercise RevenueCat, Apple, Google, Resend or PostHog. Nothing in this note qualifies those integrations, their rate limits, delivery or webhook ordering. Apple's 50 requests/second and Google's 3,000 queries/minute quotas are far above the modelled 5,040 / 25,200 checks per month, but the accepted retry/coalescing rules still need implementation and tests.

## Not double counted

Standardized-simulation compute is excluded entirely. The Lambda free tier is deducted once for the fallback probe and is treated as shared with any other AWS use; the Workers Paid plan is counted once; the Supabase compute credit is applied to one project only; Realtime peak connections are summed across projects as the provider does. The provisional $10 email reserve is replaced by the Resend figures above and is not added on top of them.

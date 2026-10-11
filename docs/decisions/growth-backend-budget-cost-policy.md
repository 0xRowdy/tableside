# Growth backend budget and cost-policy limits — accepted decision

Planning for [Growth backend budget and cost-policy limits](https://github.com/0xRowdy/true-count/issues/50), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1). Accepted through Q1–Q9 in the live discussion on 2026-10-11. The evidence is [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37) and its [feasibility verdict](../research/backend-workload-feasibility.md). This is a planning decision: no provisioning, tier purchase or spend is authorized by it.

## Accepted policy

- **Budget stages (Q9).** Launch stage: $50/month target, $40 projected-spend alert, as already accepted. Growth stage: $70/month target, $56 alert (80%). Both exclude RevenueCat. Moving to the growth stage is a team decision, expected when the planned Resend Pro upgrade trips the $40 alert or MAU passes about 1,500; nothing moves automatically. Spending above the growth stage needs a new decision.
- **RevenueCat (Q1).** Its 1% of whole monthly tracked revenue is a revenue-linked cost outside both budget stages. Report it monthly beside the backend total, with an early warning at $2,000 tracked revenue (before the $2,500 threshold).
- **Analytics events (Q2).** Every event is sent anonymously: no person profiles and no `identify()`, `alias()`, `group()` or person-property calls. Operational and diagnostic events are aggregate. Optional adult product analytics, already opt-in under [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36), uses the purpose-specific identifier only as the event distinct ID for consent withdrawal and erasure. If deletion of an opted-in user's events by that ID within the 30-day retention limit cannot be verified, product analytics stays off.
- **Result-artifact encoding target (Q3).** A representative completed practice session serializes to 10–20 KB, checked by a representative fixture. Larger artifacts upload through chunked staging. It is an encoding target, never a cap: long sessions save in full and no history is truncated.
- **Realtime connection policy (Q4).** A device holds its live Realtime subscription only while foregrounded and closes it on backgrounding. When another device of the same player is foregrounded, the newest device takes the live connection; the other relies on the accepted 60-second reconciliation. A connection refused at the capacity limit falls back silently to the same reconciliation. The Supabase spend cap stays on. Multi-device support is unchanged; only update latency differs.
- **Email tier timing (Q5).** Start on the Resend free tier. Upgrade to Pro ($20/month) when trailing monthly volume passes 2,400 or any day passes 80, whichever comes first. Until then, bulk notices (such as beta entry and shutdown notices) are spread across days below 80/day; security and sign-in email is never delayed for them.
- **Operational log retention (Q6).** The accepted 30-day routine and 90-day incident records live in app-managed Postgres tables holding minimal redacted metadata, with a scheduled cleanup job and an alert on cleanup failure. No log drain; Supabase's seven-day platform logs are relied on only where seven days suffices.
- **Beta/production overlap (Q7).** The modelled ~$12 overlap (30 overlap days plus 7 cleanup days; ~$0.32 per extra day) is scheduled inside launch headroom. $30 fixed plus the overlap crosses the $40 alert; the alert is neither raised nor muted, and the runbook names the overlap as its expected cause.
- **Alert meters (Q8).** Project monthly spend from the billed meters (fixed platform charges, provisioned disk, Realtime peak connections, PostHog events, Resend volume and overage), not from MAU. Each meter also warns at 80% of its free allowance or hard limit: 400 peak connections, 800,000 events, the Q5 email thresholds, 6.4 GB disk and the Q1 revenue warning. Every response stays human-decided.

## Re-costed growth scenario

At 5,000 MAU under this policy (month 12, illustrative inputs): $30 fixed, $0–10 PostHog (anonymous, opt-in volume likely inside the free million), $0 Realtime overage, $20 Resend Pro, $0 disk in year one and roughly $1–4 by year five at 10–20 KB results. About $50–65 against the growth stage's $70, versus $90–170 in the research. RevenueCat (~$30–200 at growth) is reported separately.

## Amendments

- [Backend operating envelope and disaster recovery](backend-operating-envelope-disaster-recovery.md#growth-budget-amendment): budget stages, meter-based alerts and app-managed log retention.
- [Local persistence and account synchronization](local-persistence-account-synchronization.md#realtime-connection-policy-amendment): foreground-only, newest-device Realtime connection with reconciliation fallback.
- [Transactional email provider and delivery operations](https://github.com/0xRowdy/true-count/issues/33): Resend Pro upgrade triggers and bulk-notice pacing.

## Implementation checks

- Verify PostHog event deletion by distinct ID within 30 days before enabling optional product analytics.
- Test the Realtime fallback: backgrounding, newest-device handoff and a refused connection all converge through 60-second reconciliation.
- Add a representative result-artifact fixture asserting the 10–20 KB target and chunked staging above it.
- Implement the log-retention cleanup job and its failure alert.
- Implement the meter-based spend projection and per-meter 80% warnings.
- Supabase Micro capacity, Realtime delivery and provider webhooks remain the qualification checks listed in the feasibility research.

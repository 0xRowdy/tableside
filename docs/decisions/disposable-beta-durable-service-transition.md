# Disposable beta and durable-service transition — accepted decision

Decision ticket: [Disposable beta and durable-service transition](https://github.com/0xRowdy/true-count/issues/39), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1).

Accepted through the live Q1–Q8 discussion, including final review of the integrated contract and acceptance scenarios. This is planning only: it authorizes no deployment, actual reset, tester messaging, or production billing changes. The [resolution comment](https://github.com/0xRowdy/true-count/issues/39#issuecomment-5591787900) is canonical; this file preserves the reviewed decision for repository readers.

## Accepted choices

- **Q1 — Disposable beta:** Run an invitation-only disposable beta before durable service. Use sandbox subscriptions only, disclose the reset before participation, erase beta accounts and practice history at transition, and begin durable service with fresh accounts.
- **Q2 — Distribution:** Use email invitations through Apple TestFlight and Google Play closed testing, with no public invitation links. Android purchasing accounts must also be configured as license testers and use test payment methods; joining a test track alone does not prevent real charges.
- **Q3 — Audience eligibility:** Resolve [Prelaunch age eligibility and competitor-informed audience policy](https://github.com/0xRowdy/true-count/issues/42) before inviting external beta testers. Preserve the accepted US distribution scope. This does not select an adult-only or all-ages audience.
- **Q4 — End/reset trigger:** The owner chooses the reset date after reviewing feedback; there is no fixed beta duration today. Explain the disposable nature at entry, then announce the specific shutdown date at least seven days ahead and allow testers to export their records. Exports are personal archives, not a migration into durable service.
- **Q5 — Offline devices:** When a device learns the beta has ended, stop beta access and erase its beta records, including records never uploaded. Disconnected devices cannot be erased remotely. Production rejects beta accounts, uploads, and sandbox purchases regardless of when a device reconnects.
- **Q6 — Retained findings:** Retain deidentified feedback summaries, bug reports, and aggregate testing findings after removing identifying details and private gameplay records. Erase beta accounts and content. Necessary operational/security records follow their separately agreed finite retention periods.
- **Q7 — Durable service and recovery:** Durable service may begin after MVP functionality and applicable release checks pass, while independent backups and recovery automation are still pending. Planned beta-style resets end from the first durable account onward. Recovery work starts after MVP functionality; the owner activates recovery after successful restore testing. Until then, disclose the protection actually available without promising eventual 24-hour recovery objectives, and send essential alerts directly to the human team.
- **Q8 — Integrated review:** Accepted the complete contract below, its implementation acceptance scenarios, and the privacy, audience, cost, and store-distribution handoffs.

## Existing boundaries

- [Backend operating envelope and disaster recovery](https://github.com/0xRowdy/true-count/issues/28) places independent B2 backups, restore exercises, and the automated responder after MVP functionality. Eventual objectives are at most 24 hours of ordinary acknowledged-history loss and restoration within 24 hours, with three-day independent copies and included seven-day Supabase backups. These are not tested guarantees or MVP release gates.
- Existing account deletion, privacy withdrawal, sandbox-versus-production billing checks, never-reused account identities, and rejection of stale uploads remain applicable. Disposable testing does not waive privacy obligations.
- No beta accounts, private records, community contributions, allowance balances, or sandbox subscription benefits migrate into production.

## Accepted integrated contract

### Participation and separation

Use a visibly identified beta build and invitation-only beta membership. An app installation or possession of a shared store URL alone does not authorize a new beta account. Complete the applicable audience, privacy, moderation, and platform requirements before external participation. The age-policy decision remains its existing ticket; this decision does not select an age threshold. Use the accepted US distribution configuration without inventing a residence or physical-location gate. Qualify the actual platform controls for the selected beta channels; email invitations alone do not prove store-country eligibility.

Use separate beta and production backend projects, service credentials, account namespaces, and device-local databases/keys. Route provider customer identities, queues, cached data, object storage, exports, analytics, and billing evidence through explicitly separated environments. Qualify provider isolation in the selected configuration; a client-side environment flag alone is insufficient. Account for temporary overlap in backend costs before provisioning; this decision authorizes no additional spending and does not change the accepted backend target.

The same person may sign up for durable service with the same Apple, Google, or email sign-in method, but receives a new production account identity. Do not copy beta Auth records, private histories, strategies, profiles, community results, ratings, allowance grants, purchase ownership, or device registrations. Existing sign-in/linking rules apply within each environment. Deleting beta Auth records or provider customers must not delete the person's upstream Apple/Google identity or any production record.

Every request, queued operation, provider callback, and purchase acceptance must match its intended environment and current account/session generation. Production never accepts sandbox evidence for premium. A deleted or closed beta account cannot be recreated by an upload, restored client backup, receipt, or late webhook. Retire the beta environment permanently at transition; do not reuse its account or operation identities for durable service or later tests.

Store-track changes can update an installed application without erasing its data. Before a production build opens an account database, restores credentials, configures a billing customer, or sends pending work, it must recognize any beta-local namespace and remove its beta database, keys, credentials, cached content, and pending uploads. Production sign-up then starts fresh. A retired beta build cannot switch itself to production endpoints.

### Notice, exports, and shutdown

At entry, explain that this is disposable testing, purchases are sandbox tests without production benefits, beta records will be erased, and durable service requires a fresh account. Do not invite reliance on beta casino-session records as the tester's only personal record. The app retains the accepted local and server export behavior while the beta is open.

After reviewing feedback, the owner chooses a shutdown timestamp and announces it by email to invited testers and in the beta app at least seven days in advance. Show the timestamp with its time zone, the export deadline, and the fact that unsynced records on offline devices will also be lost when those devices learn of closure. This is a dispatch/display commitment, not a promise that an offline tester will read the notice. A delivery failure is surfaced to the owner; do not describe undelivered mail as received.

During that notice period, preserve server export and the separately identified current-device supplement for unsynced records, conflicts, and unfinished activities. Records on other offline devices remain absent unless exported there or synced before closure. Generated server archives keep the existing 24-hour lifetime and may be regenerated while the beta remains open; none remains accessible past shutdown. Downloaded copies held by testers are outside the application's remote-erasure control and cannot be imported into durable service.

At the announced timestamp, fence beta account creation, sign-in access, gameplay synchronization, public reads, new purchases/evaluations, and export access. Revoke remaining generated-export access, stop accepting queued uploads, and cancel beta work without affecting production jobs. Cleanup proceeds after access is denied; waiting for physical deletion must not reopen the beta. Do not offer a silent late-sync or migration grace period.

Once a device has authoritative knowledge that the beta has closed, stop beta access and erase its beta-local records, including unsynced records, cached/remixed community content, and unfinished activities. A known deadline may be applied using the accepted trusted-time rules; a connection failure or ambiguous response is not proof of account deletion. A generic retired-environment status can inform returning devices without restoring beta sign-in or retaining a per-tester lookup service. Offline devices that have not learned closure may retain data and use only their previously allowed offline access until they learn it; instant remote erasure is not promised. Production isolation holds throughout.

The planned seven-day notice does not require unsafe service to stay available during an incident, and it does not delay an individual tester's accepted account-deletion request. Handle incidents under the existing response and privacy obligations, without using an emergency exception as the normal reset process.

### Cleanup and retained evidence

The owner runs and verifies an environment-scoped cleanup inventory. Reuse the accepted immediate access/public suppression and seven-day active-system cleanup target, with existing narrower expiries and disclosed provider exceptions. The target is not a claim of measured provider purge or a new statutory deadline.

Inventory and remove beta application records, Auth users/sessions, local-sync staging, Storage objects, private upload chunks, bootstrap snapshots, generated exports, caches, profiles, community publications/remixes/results, evaluation dependencies, invitation lists, provider customers, queued messages, and beta-only secrets or credentials. Preserve production objects and independently needed support channels. Do not leave a running evaluator or delayed provider callback able to reintroduce deleted beta content. Scope the cleanup to beta application records; upstream tester identities remain theirs.

Retain only deidentified feedback summaries, bug reports, and aggregate findings as development evidence. Remove names, contact details, account/device IDs, private gameplay histories, identifying screenshots, and copied diagnostic payloads from these retained findings. Merely replacing a name with an opaque ID does not establish deidentification. Raw feedback and its attachments remain in the beta cleanup inventory unless a specific existing retention purpose applies.

Keep the already accepted 30-day routine operational-log and 90-day security/incident-evidence periods for necessary restricted records, plus separately agreed provider exceptions such as Resend's 30-day retention. Do not convert this into permission to preserve gameplay payloads as logs. Qualify provider customer, message, telemetry, backup, and platform-log cleanup against [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36); reset is not a promise of instantaneous deletion from every provider.

Retained backups and control records must expire under the accepted and qualified schedules, remain inaccessible for normal use, and never be restored into active beta or production service in a way that resurrects accounts/content. The general finite control protocol remains [Delayed-command compaction and recovery-control protocol](https://github.com/0xRowdy/true-count/issues/43), and purchase-specific schedules remain [Subscription lineage retention and late restoration](https://github.com/0xRowdy/true-count/issues/44). The research report's illustrative control horizons are not adopted here. Permanent rejection of a retired environment does not require indefinitely retaining every tester's identity or purchase history.

Test subscriptions confer no production benefits or compensation automatically. Stop beta purchase entry and clear beta-side entitlement/customer state under the cleanup inventory; qualify store/provider-specific test-subscription cleanup. Deleting a provider customer must not be represented as canceling a store subscription. A beta receipt encountered in production is rejected as test evidence; never convert it to a paid entitlement or offer an automatic real purchase as part of migration.

### Durable-service activation and recovery

The owner explicitly authorizes opening the production environment after MVP functionality, beta shutdown/isolation checks, and applicable release requirements pass. Durable service starts when the first non-test account is admitted, including a free account; payment is not the boundary. Beta provider cleanup may continue within its declared finite periods in isolation, without allowing beta access or contamination of production. Starting durable service does not require waiting for every correctly retained backup to age out.

From that point, preserve accepted saved-history and account-lifecycle behavior. There is no routine disposable reset. Ordinary deletion requests and incident recovery continue under their respective contracts. New production subscriptions require the accepted production billing qualifications and current-store verification. Beta participation supplies no carried balance, free premium promise, or automatic enrollment in paid billing.

After MVP functionality is complete, the owner schedules and drives the already accepted independent-backup and recovery work. No calendar activation date is invented. The owner, with the existing human backup responder, declares recovery operational only after the configured recovery set, independent controls, keys, and runbook pass the accepted restore scenarios and demonstrate the proposed recovery objectives. Begin the agreed quarterly/material-change exercise cadence at that activation. A failed exercise leaves the recovery capability unqualified and prompts remediation; it does not authorize relaxing privacy or ownership correctness to meet a time target.

The automated responder has its own qualification and activation, after its allowlisted actions, audit, escalation timeout, and failure delivery are tested. It need not delay human-operated recovery. Essential alerts go directly to the human team until qualified automation is active; the existing immediate-escalation and ten-minute-unresolved escalation rules then apply.

Before qualified recovery is active, describe actual provider backups and recovery limitations, including that available database backups are not a demonstrated complete application recovery system. Do not promise a maximum loss window, a restoration time, or that every record can be recovered. The eventual 24-hour history-loss/restoration objectives remain objectives, not a contractual guarantee. Independent copies and the AI responder remain post-MVP work rather than newly introduced release gates.

If the team later wants beta-to-production migration, reopen this decision before changing the notice or preservation behavior. A new proposal must establish exactly what moves, identity/consent and deletion handling, and its acceptance checks. This decision supplies no fallback migration and does not authorize retaining beta data indefinitely in case that proposal appears.

## Acceptance scenarios for implementation

These are required checks to implement and run, not tests already executed by this planning session.

| Scenario | Required outcome |
| --- | --- |
| Invited Android tester uses the wrong purchasing Google account | Qualification detects the non-test billing path before the tester is directed through purchase; no real charge is treated as an acceptable beta test. |
| Tester signs up with the same Apple/Google/email method in production | Fresh production account; no beta history, profile, allowance, or entitlement is imported. |
| A store update preserves beta app storage | Before account/billing initialization or upload, discard beta credentials, records, keys, and pending work; require production sign-up/sign-in. |
| Offline device returns months after closure, including from an OS backup | Recognize the retired environment, reject stale activity and credentials, erase beta-local data when closure is learned; never create or modify a production identity. |
| A known shutdown arrives during an unfinished beta activity | End beta access and remove beta-local activity; no late settlement, score, allowance, or partial upload enters production. |
| Export is generated near shutdown or its URL is reused after closure | Existing 24-hour expiry or shutdown, whichever is earlier, ends server access; tester-held downloads remain personal archives. |
| Beta snapshot, provider event, or queued job predates deletion/reset | No restored account, republished contribution, resumed evaluation, accepted sandbox production benefit, or recreated provider customer through a retired beta path. |
| Cleanup partially fails or a provider retains a permitted backup/log copy | Active beta remains denied; owner tracks and retries cleanup under qualified finite schedules and accurate disclosures. |
| Bug report contains a name, private casino record, or identifying screenshot | Remove identifying/private material before retaining the development finding; raw attachments remain subject to cleanup. |
| First durable account is free and recovery work is still pending | Durable retention starts immediately, routine resets cease, current limitations are disclosed, and alerts go to humans. |
| Restore exercise fails or automated responder is not qualified | Do not claim the failed capability operational; keep human alerts and existing privacy/ownership protections. |

## Map and delivery handoffs

- [Prelaunch age eligibility and competitor-informed audience policy](https://github.com/0xRowdy/true-count/issues/42): its policy must be resolved before external beta invitations as well as production launch; this decision selects no age threshold.
- [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36): incorporate beta notices, the seven-day announced export window, local erasure limits, feedback deidentification, provider cleanup/retention exceptions, and staged recovery disclosures. Apply requirements to the actual beta SDKs/data flows before participation.
- [Backend workload and cost feasibility](https://github.com/0xRowdy/true-count/issues/37): include temporary isolated beta/production overlap and shutdown/export/cleanup work, without silently raising the backend target.
- [Beta and production store distribution readiness](https://github.com/0xRowdy/true-count/issues/45): owns invitation/testing setup, sandbox billing checks, channel geography, beta-to-production installation behavior, store submission requirements, and release verification ownership. It consumes this decision and the existing audience/privacy decisions through native dependencies. Built-in/reference content rights and broader delivery sequencing remain separate map scope.

## Distribution evidence

Verified against first-party documentation during this discussion. These capabilities do not establish that True Count has configured or tested them.

- Apple supports email-invited external TestFlight testers and requires TestFlight App Review for the first submitted build. [External testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers).
- TestFlight purchases use the sandbox without charges; test purchases do not carry into the App Store version. [Testing environments](https://developer.apple.com/documentation/StoreKit/testing-at-all-stages-of-development-with-xcode-and-the-sandbox), [tester instructions](https://testflight.apple.com/).
- Google closed testing supports email lists and individual opt-in. Ending a track leaves existing installations on devices, and a higher-version production release can reach closed testers. Distribution changes cannot substitute for application data isolation or cleanup. [Testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en).
- Google non-license testers can incur real purchase charges even on testing tracks. Validate the purchasing account and test payment methods before beta billing tests. [Billing testing](https://developer.android.com/google/play/billing/test).
- Google closed tracks support country targeting by Play country; internal testing does not enforce that targeting. [Country targeting](https://support.google.com/googleplay/android-developer/answer/7550024).

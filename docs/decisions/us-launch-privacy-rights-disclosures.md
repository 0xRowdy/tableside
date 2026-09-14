# US launch privacy rights and disclosures — accepted planning decision

For [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36#issuecomment-5639605743). Research checked 2026-09-11. The user accepted one nationwide privacy policy, the limited adult analytics opt-in approach, and no teen ads at launch in the live review. This is a planning contract, not a published privacy policy or completed compliance certification.

## Product choices

1. **Accepted:** offer one nationwide access/correction/export/deletion/opt-out/appeal policy rather than state-specific app flows.
2. **Accepted:** optional adult product analytics requires opt-in, with no session replay; omit optional teen analytics at launch. Essential security and service diagnostics remain separate and minimized.
3. **Accepted:** leave teen ads off for MVP. Adult contextual AdMob remains the accepted advertising design; enabling teen ads is outside this launch contract.

## Scope and applicability

Preserve Colorado publisher, US storefronts, English, the accepted 13+ eligibility policy and three launch games. US distribution is not proof of residence or physical location. Do not add location collection merely to choose a privacy screen.

Record actual publisher/entity, revenue/affiliates, annual unique consumers, data uses and processor relationships before publication; monthly-active-user forecasts alone do not establish statutory coverage. CalOPPA notice, Colorado security/disposal and specified teen protections, New York teen processing, California minor-content removal, COPPA upon relevant actual knowledge, and other applicable duties must be assessed independently of general CPA/CCPA thresholds. A voluntary nationwide baseline does not imply every law applies or replace stricter applicable duties.

Evidence: [US rights research](../research/us-launch-privacy-rights.md). Recheck coverage when markets, audience, monetization or material data uses change. Do not promise a universal exemption or worldwide certification.

## Rights and service commitments

Provide a plain-language Privacy and data area plus public web/help access. Reuse existing export, account deletion, support and content-reporting mechanisms. Accept access/export, correction, selected-data deletion, full erasure, optional-processing withdrawal, applicable sale/targeted-ad/sensitive-use opt-outs and appeals without requiring proof of state residence.

Use proportionate verification before disclosure or destructive changes, normally existing sign-in; support a request path when sign-in is unavailable without releasing private data based only on a receipt or claimed identity. No default collection of government ID. Do not require sign-in for browser opt-out signals or an ordinary ad-data opt-out. Authorized-agent/guardian requests require authority appropriate to the requested action; the existing 13+ policy does not become under-13 enrollment.

Operational commitments: acknowledge requests within ten business days, provide a substantive response within 30 calendar days, and decide appeals within 30 calendar days. Prefer immediate self-service outcomes. Explain refusals, the specific retained categories and relevant regulator complaint route; any applicable shorter deadline takes precedence. An extension needs a permitted basis and timely notice, not a silent reset of the clock.

Preserve the **optional 30-day undo window** and equally accessible **Delete all my data now**. Scheduling deletion immediately hides/locks while preserving data for undo. Permanent deletion begins at the scheduled deadline or immediate request; active cleanup targets seven days from that boundary. Do not impose the undo period on an immediate rights request or restart statutory timing at day 30. Show the chosen deadline, irreversible state, active cleanup and remaining backup/provider exceptions separately.

Correct private ledger/account inaccuracies through existing editing/support controls. Do not fabricate improved challenge evidence or silently rewrite immutable simulation history to fulfill a correction request; annotate, invalidate or delete affected personal data as appropriate. Minor requests to remove their own public content use the existing required-removal exception, without requiring whole-account deletion. Ordinary delisting is not necessarily privacy erasure. Do not promise automatic deletion of every independent third-party copy/remix.

## Processing and consent boundaries

Collect only data needed for the requested feature, security or separately chosen optional use. Private casino-session records, record bodies, strategies, credentials and support prose never enter advertising or routine analytics. Do not build advertising profiles or reuse community-sharing permission as analytics/ad consent.

Keep optional SDK processing off before eligibility and the relevant privacy choice are established. Store only the current allowed eligibility decision, permitted age band/source/check time/policy version; discard raw age responses and avoid exact birth dates or age history. Apply actual restrictions through the accepted manual-support process; do not invent proactive investigations or automatic underage-account deletion.

For the accepted optional adult analytics approach, use a fixed event allowlist, default-off consent, no replay/autocapture or ad linkage, no emails/private values/free text, and only a purpose-specific identifier needed for consent and erasure. Disable IP storage and unnecessary location enrichment where supported, without claiming that provider transport never sees IP. Refusal preserves ordinary app access, allowances and premium rights. Optional teen analytics remains off at launch; necessary teen service/security processing still needs minimization and a qualified purpose.

Apply consent withdrawal on the device immediately, stop queued optional uploads, and synchronize the restriction before further optional processing. A stale device cannot re-enable a withdrawn choice. Use a new consent generation for a later opt-in; do not backfill the opted-out interval. Clearly distinguish stopping future optional processing from deleting previously collected data, and provide both controls through existing privacy handling.

Advertising remains off for teens and unresolved ages: no ad SDK startup, prefetch or requests for those users. Adult ads remain contextual only, with no additional mediation SDKs or ATT opt-in flow. Honor relevant opt-outs/GPC and browser signals according to their meaning; a signal is not an account-erasure request. Where a qualified limited/nontracking mode satisfies the choice, it may serve; otherwise make no ad request and preserve free continuation. No consent refusal is a reason to demand premium or send default personalized requests. Verify actual SDK behavior before claiming no sale/sharing/tracking: contextual selection does not settle these definitions.

## Data-flow and retention contract

The table consolidates the existing schedules and the supporting privacy controls for this launch contract. Every provider path needs an implementation owner and evidence that the configured behavior matches it. The publisher owns policy, request handling and incident escalation; the implementing service owner owns deletion/configuration checks.

| Category and purpose | Data/recipients and location | Control and retention endpoint |
| --- | --- | --- |
| Account, authentication and eligibility | Minimum identity/contact/authentication and permitted current eligibility fields; Supabase primary Virginia plus Apple/Google sign-in | User access/correction/erasure; retain while account exists including undo. At permanent deletion, seven-day active cleanup target and specific provider revocation processing. No raw age history. |
| Private casino/practice records, strategies and results | Requested histories, summaries and execution evidence; encrypted local account database and authorized Supabase Virginia processing | Private by default; export/correction/deletion. Retain active history until user removal/account erasure; no inactivity purge. No ad or telemetry payloads. Unsynced/offline limits disclosed. |
| Community and standardized evaluation | Chosen publication/profile/ratings and consented contributions; Supabase and accepted Virginia simulation workers; public recipients as disclosed | Preserve publication and sharing-period controls. Hide on scheduled deletion; remove/sanitize on permanent erasure. Validated required-removal exceptions apply. Nonpersonal surviving execution dependencies are not blanket permission to keep author data. |
| Evaluation recovery/matching records | Minimal fingerprint/specification/allocation controls, no private history or author prose; protected backend/worker storage | Bulky orphan data: 30 days after last legitimate dependency unless earlier removal applies. Minimal matching/allocation state ends with safe version retirement; fingerprinting is not assumed anonymous. Preserve unavailable evidence instead of rerolling where removal prevents reuse. |
| Subscriptions | Minimal account/purchase association, current status and necessary verification tokens; backend, RevenueCat US-hosted persistent data and independent Apple/Google stores | Keep through account life/undo; permanent cleanup follows the latest subscription decision. Explicit, purpose-limited processing/legal exceptions only. No permanent hidden forfeiture ledger or claim to delete stores' independent transaction records. |
| Exports, snapshots and incomplete uploads | Private Supabase/local temporary artifacts; authorized recipients only | Generated exports/bootstrap snapshots: 24 hours. Abandoned chunks: 24 hours without progress. Immediate access invalidation on applicable account restriction; earlier required deletion wins. User-downloaded archives remain outside app control. |
| Adult contextual advertising | Provider-collected IP, device/app identifiers, ad interactions and diagnostics under the verified configuration; Google AdMob and disclosed recipients, with global processing | No app-authored account/private-record/audience payloads. Adult eligibility and privacy choices gate all requests; no teen ads, personalization or ATT opt-in flow. Qualify provider identifier/deletion and opt-out mechanisms; no blanket 7/30-day provider purge claim. No request where the required privacy configuration cannot be established. |
| Transactional email | Necessary recipient/content/delivery data; Resend US storage and recipient email systems | Preserve accepted 30-day Resend email/log retention exception and no independent message-body copy. Do not imply recipient mailbox control excuses processor duties; suppression and other provider records need separate qualification. Honor a required earlier processor action or surface the conflict. |
| Routine service diagnostics | Redacted service/error/timing data; PostHog US Virginia, relevant hosting diagnostics | Existing app-managed routine log limit: 30 days. Do not equate provider defaults with that setting. Qualify an actual retention/deletion mechanism before making the promise; no tokens/private bodies. |
| Optional adult product analytics | Named minimized product events; PostHog US | Maximum 30-day raw-event retention and erasure through the same request path. PostHog plan retention is not a configurable 30-day TTL; enable only after a verified deletion design or an explicitly revised policy. No replay or optional teen events at launch. |
| Support, rights requests and security | Minimal authorized case content/status; restricted backend/support channel; incident escalation Email/Slack as already selected | Routine support content until resolution plus 30 days, shortened on account erasure unless needed for a specific request. Minimal rights-handling receipt and security/incident evidence: up to 90 days after case closure/event as appropriate. No raw identity documents by default; a legal hold needs named purpose/owner/review/expiry. |
| Connectivity probes | Nonce/protocol only from app; global Cloudflare and Oregon Lambda receive network metadata | No account/token/private payload and no app-authored IP/body logging. Configure necessary app logs to the existing finite limits; inventory provider security metadata separately. Never label the entire network interaction anonymous. |
| Backups and recovery controls | Supabase seven-day rolling database backups; later encrypted B2 US West three-day copies; current protected safety controls | Distinguish live deletion from older-copy aging. Verify actual recoverable sources/versions and purge; copies inherit original age. Reconcile current deletion/withdrawal controls before serving restored data. No unconditional day-15/day-22 erasure promise. Independent backup/recovery implementation remains after MVP functionality. |

US-primary hosting does not mean all processing stays in the US. Inventory CDN, edge execution, support, subprocessors, advertising buyers and diagnostic processing. No retention duration in this table silently applies to independent provider controller records; identify purpose, role and available control. An unverified provider tail is a qualification to finish, not permission for undisclosed indefinite retention.

## Disclosure and release evidence

Publish an accessible, dated notice identifying the actual publisher/contact, collected categories, purposes and optionality, provider/recipient categories and wider processing, public-content consequences, retention/deletion distinctions, rights and appeals, tracking-signal response, minors and material-change notification. Store declarations must describe the same behavior; policy acceptance is not bundled consent for unrelated collection.

Before external beta collection, and again for the production configuration, verify:

| Check | Owner and passing evidence |
| --- | --- |
| Eligibility, consent, refusal and account changes | Mobile/backend owner: no disallowed SDK startup or queued replay; verify adult/teen/unresolved states, withdrawal, sign-out and deletion. |
| Data minimization and recipients | Mobile/backend owner: inspect configured SDK payloads/network destinations and server logs; private records/tokens absent; provider disclosures and purpose match actual use. |
| Rights and erasure | Lifecycle owner: verified export/correction/removal, immediate erasure versus chosen undo, deadline tracking, provider completion/status, offline-device and backup limits. No false completed-erasure message on merely queued work. |
| Retention | Service owners: configured expiry and observed cleanup for each category, including PostHog events/logs, Resend exception/suppression, provider queues and recovery sources. Failures alert the publisher and block affected optional collection. |
| Public removal | Community owner: privacy/minor removal works through existing required-removal handling, with caches/provenance filtered and third-party-copy limits stated accurately. |
| Platform disclosures | Release owner: Apple App Privacy, SDK manifests/signatures/required-reason APIs and Play Data safety/deletion answers match the built version. A manifest or contextual flag alone does not prove nontracking. |
| Operations and applicability | Publisher: processor terms/inventory, finite disposal policy, restricted access and actionable incident response; assess actual state-law coverage and teen processing. Existing operations work is reused. |

If observed behavior contradicts the contract, fix the configuration or return a concrete proposed policy change before enabling the affected processing. Optional ads/analytics may remain off. Do not silently weaken private-account erasure or claim a provider qualification has passed from documentation alone.

The existing store-distribution decision retains nonprivacy submission work and the unresolved paid-time forfeiture/continued-renewal qualification. This ticket neither approves forfeiture nor reintroduces custom post-erasure purchase transfers. No new planning tickets or live provider actions are created by this decision.

## Evidence

- [US rights and applicability](../research/us-launch-privacy-rights.md).
- [Provider disclosure matrix](../research/launch-provider-privacy-disclosures.md).
- [Existing retention evidence](../research/billing-recovery-control-retention.md), with newer account/ownership decisions taking precedence.
- [Latest subscription ownership policy](subscription-lineage-retention.md) and [account lifecycle including 30-day undo](authentication-account-lifecycle.md).

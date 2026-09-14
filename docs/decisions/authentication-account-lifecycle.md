# Authentication and account lifecycle — accepted decision

Accepted through the live Q1–Q13 discussion, including final review of the integrated design and processing targets. The [original resolution comment](https://github.com/0xRowdy/true-count/issues/22#issuecomment-5565609337), as amended by the accepted 30-day deletion undo window below, is canonical; this file preserves the reviewed decision for repository readers.

Decision ticket: [Authentication and account lifecycle](https://github.com/0xRowdy/true-count/issues/22), part of the [MVP decision map](https://github.com/0xRowdy/true-count/issues/1).

This is planning for the iOS/Android MVP, not production implementation. Preserve the accepted offline lifecycle and local persistence/account synchronization decisions, including Supabase, stable account ownership, retained encrypted account-local records on ordinary sign-out, and online sign-in after explicit sign-out. Identity, subscription entitlement, and content readiness remain separate.

## Accepted amendment — purchase ownership after erasure

The later [subscription ownership decision](subscription-lineage-retention.md) retains the 30-day deletion deadline but supersedes Q12's benefits-only transfer after permanent erasure. Preserve minimal ownership while the account exists; erase it during permanent cleanup, subject to narrowly disclosed necessary exceptions. No custom post-erasure restoration is promised. The intended forfeiture of remaining paid time needs focused store/terms qualification before production billing; account erasure does not itself cancel or revoke a store subscription.

## Accepted amendment — 30-day deletion undo window

Accepted in the live discussion while working [Subscription lineage retention and late restoration](https://github.com/0xRowdy/true-count/issues/44). This supersedes Q7's no-recovery-period rule and the earlier assumption that every deletion request immediately enters irreversible cleanup.

- Offer a clearly described 30-day undo window before permanent deletion, plus **Delete permanently now** in the app and web deletion paths. Both require fresh authentication, explicit choice and online acceptance.
- Scheduling deletion immediately deactivates ordinary account access and hides owned public content/contributions. Preserve account data and linked sign-in methods during the window; do not run destructive account/provider cleanup or wipe device databases merely because deletion is scheduled. Devices lock ordinary access when they learn of the scheduled state.
- Show the server-established permanent-deletion date. Before that deadline, signing in to the same account lets the user explicitly cancel deletion and reactivate it. Background refresh or sign-in alone does not cancel the request. Preserve the same account identity and data; normal authorization, moderation, sharing and synchronization rules still apply.
- At the 30-day deadline, or when **Delete permanently now** is accepted, deletion becomes irreversible and the existing cleanup/wipe contract applies. The existing seven-day active-system cleanup target starts at that irreversible boundary; disclose the undo deadline separately from physical cleanup completion. No undo is available merely because a cleanup worker is delayed. Any shorter applicable obligation takes precedence.
- Resolve cancellation versus permanent deletion against authoritative server state so a stale request cannot undo finalized deletion. Existing temporary-file expiry still applies; preserving account data is not a promise to retain export links or abandoned upload chunks for 30 days.
- Store subscriptions keep their own billing and expiry dates. Explain that the undo window neither pauses nor cancels billing, and provide subscription-management access. Restoring account access grants only currently valid premium and never replenishes an allowance.
- Canceling scheduled deletion recovers the same account. A pending-deletion account is still the purchase owner. The later subscription ownership decision removes the custom post-erasure transfer promise and sets ownership cleanup at permanent erasure; it does not use 30 days as a general purchase-token expiry.

[Apple account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app) supports a separate immediate-deletion option and clear billing guidance. Final privacy/store qualification remains with the existing release decisions. Planning only; no deletion service is implemented here.

## Accepted choices

The user accepted Q1–Q3 in the live discussion:

- **Q1 — Sign-in methods:** Apple, Google, and emailed one-time codes, without an app-specific password.
- **Q2 — Public profile:** require a public display name when first publishing or rating a community strategy, not for private practice or casino-session tracking. Login email stays private.
- **Q3 — Recovery:** require access to a linked sign-in method. Support helps navigate recovery but cannot transfer private accounts based on purchase receipts or claimed identity.

The user accepted Q4–Q7 in the live discussion:

- **Q4 — Linking:** allow adding Google or a personal email to an existing Apple-created account, and equivalent supported sign-in linking, from account settings after fresh authentication. If the method belongs to another True Count account, explain the conflict without merging histories or purchases. Supabase manual linking's beta status remains an implementation qualification requirement.
- **Q5 — Device sessions:** show signed-in devices and allow revoking one or all other devices. Ordinary sign-out affects only the current device. Revocation blocks server access immediately; an offline device locks account access when it learns of revocation. Immediate offline remote locking is not promised.
- **Q6 — Export:** provide a free self-service downloadable archive with readable CSV session summaries and structured JSON for strategies, detailed history, and challenge results. Include server-synced records and clearly identify device-only records that still need uploading. Q9 specifies records that cannot be uploaded.
- **Q7 — Deletion initiation (amended):** after fresh sign-in and clear confirmation, offer scheduled permanent deletion with a 30-day undo window or immediate permanent deletion. Deactivate access and hide public content on scheduling; retain data until the irreversible boundary. Offer export beforehand and subscription-cancellation guidance. Provide in-app and web deletion paths. The amendment above controls recovery timing; Q8–Q13 and the integrated design apply to permanent deletion.

The user accepted Q8–Q11 in the live discussion:

- **Q8 — Revocation versus deletion:** confirmed device revocation locks access while retaining private local records until fresh sign-in. Temporary sign-in renewal failure preserves remembered offline access under existing access limits. Confirmed account deletion discards pending uploads and erases that account's local database and encryption key when the device learns of deletion; an offline device cannot be remotely erased immediately.
- **Q9 — Unsynced export:** allow export of current-device records even when upload is failing. Provide a separately identified local supplement covering unsynced records, conflicts, and unfinished activities; identify the absence of records on other offline devices. Export is for keeping data; importing archives back into the app remains a later feature.
- **Q10 — Public deletion effects:** remove the profile, published listings, ratings, and practice contributions. Preserve other players' saved executable copies and remixes under the accepted community contract. Remove personal attribution and author prose from source references; show “Deleted author” while retaining source relationships and execution history. Content-rights requirements remain subject to their release review.
- **Q11 — Online deletion only:** require a successful online deletion request. Offline, explain the connectivity requirement and preserve records until reconnection and confirmation. After server acceptance, queued uploads and stale devices cannot restore the account. The user emphasized MVP scope: do not add an offline deletion queue or an elaborate edge-case user flow.

The user accepted Q12 in the live discussion:

- **Q12 — Subscription after deliberate deletion (superseded):** the later [subscription ownership decision](subscription-lineage-retention.md) removes the custom benefits-only reassignment promise after permanent erasure. Existing accounts, including those in the undo period, recover through the same owner. Intended paid-time forfeiture is subject to focused release qualification.

The user accepted Q13, the integrated design below, including 24-hour server-export expiry, the seven-day active-system deletion target, verified matching-email automatic linking, and the named retention/provider handoffs. Operational targets require implementation verification; they are not measured guarantees or statutory deadlines.

## Evidence

Checked 2026-09-06 against primary documentation. The integrated design distinguishes these facts from accepted product choices and implementation verification requirements.

- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking): matching-email identities may link automatically; authenticated manual linking handles different emails and is currently labeled beta. Apple relay and personal Google addresses cannot be assumed to identify one account. Linking credentials does not define an application-data merge between existing accounts.
- [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless): use a token email template for codes; signInWithOtp creates users by default unless configured otherwise. Recovery must not accidentally create a new account.
- [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple) and [Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google): configure native and browser audiences for cross-platform use. Apple OAuth secrets require rotation; Supabase does not supply Apple's server-to-server notification endpoint. [Apple relay configuration](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/) requires registered, authenticated mail sources for relay delivery; relay email is not an independent recovery method from the Apple identity.
- [Supabase sign-out](https://supabase.com/docs/reference/javascript/auth-signout), [sessions](https://supabase.com/docs/guides/auth/sessions), and [user deletion](https://supabase.com/docs/guides/auth/managing-user-data): issued access JWTs can survive sign-out or Auth-user deletion until expiry. Immediate revocation needs authoritative account/session enforcement in server access paths. Default sign-out scope is global; ordinary device sign-out must select its intended scope explicitly.
- [Supabase email-change behavior](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) confirms both old and new addresses under Secure Email Change. [Identity unlinking implementation](https://github.com/supabase/auth/blob/master/internal/api/identity.go) checks remaining identity count, not proof that the player can use it. [Reauthentication API](https://supabase.com/docs/reference/javascript/auth-reauthenticate) alone is not a general server authorization gate for passwordless sensitive actions.
- [Apple account changes](https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts) and [Google OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies) inform provider-specific handling. Google OAuth-token revocation and [ID-token consent revocation](https://developers.google.com/identity/gsi/web/guides/revoke) are distinct; implement the grant revocation appropriate to the chosen flow rather than assume one API handles every credential.
- [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/): provide in-app deletion initiation, delete associated personal data except permitted legal retention, revoke Sign in with Apple tokens, and explain subscription cancellation. Delayed processing may be disclosed; subscription expiry cannot be the only deletion date offered.
- [Google Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): provide both an in-app path and a discoverable web request resource, including associated data and service-provider handling. Disclose legitimate retention. Store policies alone do not establish a universal retention duration; launch jurisdictions remain a dependency.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), sections 4.8 and 5.1.1: social login requires an equivalent privacy-preserving option subject to exceptions, and apps lacking significant account-based features should allow use without login. The accepted Apple option fits the proposed social-login design; the existing account requirement still needs a supported review rationale based on synchronization, allowances, purchases, and community features.

## Integrated design — accepted in Q13

This section makes Q1–Q12 concrete and was accepted in Q13, including its processing targets and named handoffs. It does not certify that provider integrations or native acceptance checks have passed.

### Sign-in, linking, and recovery

Use Supabase Auth with Apple, Google, and email one-time codes on both mobile platforms. Use native provider flows where supported and a secure system-browser flow where needed, including Apple access from Android. Bind browser callbacks to the initiating request and app; validate provider issuer, audience, nonce and state through the supported integration. Store refresh credentials in native secure storage, never in account exports, analytics, URLs logged by the app, or ordinary logs. The encrypted account database/key lifecycle remains the accepted persistence design.

A stable account ID owns private records, allowances, community permissions and the app's entitlement. Email, display name and provider identity are credentials/profile attributes, not data ownership keys. Supabase's documented verified same-email identity linking may return the existing account; application code must not search arbitrary email strings to merge accounts. Apple relay and a different Google email do not prove shared ownership.

Provide clear sign-in versus account-creation intent. Email sign-in/recovery must not silently create a new account. OAuth may create an Auth identity as part of provider sign-in; do not manufacture previous history or imply an empty account recovered a different one. Make adding a sign-in method available inside the existing account, with fresh authentication to that account plus proof of the new method. A method belonging to another account produces an actionable conflict, not a data or purchase merge. Prove these cases against the chosen Supabase version before relying on beta manual linking.

Require fresh authentication for adding/removing sign-in methods, changing sign-in email, revoking other devices, initiating a server export, or deleting the account. A background token refresh is not fresh authentication. Authorize the intended operation against the same stable account and session so a callback cannot switch the target account. When removing a method, require at least one remaining verified usable sign-in method and confirmation through a remaining method. Changing email verifies the new address and preserves the old usable method until the change succeeds. Failure must not strand the account.

Preserve Supabase Secure Email Change's old-and-new-address confirmation; do not disable it globally as a shortcut for an inaccessible mailbox. A player may still sign in through another linked method, but changing an inaccessible old email requires a separately supported, securely qualified provider path or remains unavailable; support cannot override identity ownership. Validate sensitive-operation enforcement against direct provider endpoints as well as the app UI: a custom confirmation screen or proxy wrapper alone does not prevent calls to an exposed Supabase Auth endpoint. Supabase's reauthenticate API and identity-count check are not proof that this contract is enforced. Any missing enforcement needs an implementation design/qualification before release, not a claim that Supabase supplies it automatically.

Explain the benefit of adding another method, without requiring multiple methods to use the app. An Apple relay mailbox is not independent recovery from Apple. Support may explain provider recovery and subscription cancellation, but cannot disclose or reassign private records based on a receipt or a claimed identity. No account-merge, recovery-code, or manual identity-adjudication product is added to MVP.

Only community publication/rating requires a community profile; browsing and private activities retain existing access rules. Public display names do not replace stable ownership or expose login email. Apply the accepted public-content moderation rules. No new avatar, biography, or unique-handle feature is introduced by this decision.

### Sessions and device revocation

Keep remembered local sign-in separate from a currently usable server token and from premium/content readiness. Expired credentials, transport failure and generic authorization errors alone are not proof of deletion and never authorize erasing data. Attempt normal renewal; if fresh sign-in is needed, preserve local records and the accepted cached offline rights unless authoritative revocation is confirmed.

Ordinary sign-out saves/pauses activity, closes the account database, clears usable sign-in credentials and requires fresh online sign-in to reopen that account. Retain its encrypted records and key. Explicitly use current-session scope rather than Supabase's default global sign-out. Offline sign-out takes local effect immediately; do not claim that a server session has been revoked while unreachable. The device list can revoke any still-live server session after connectivity is available. Installation identity for allowance accounting remains distinct from a login session; signing in again never replenishes a grant.

Show recognizable device/platform information and last server activity, identifying the current device. This is a list of server sessions, not proof of a device's current physical location or online presence. A device may hold more than one session; revoking that listed device revokes its associated sessions. Revoking all other devices keeps only the explicitly retained current session. Do not infer physical ownership from client-supplied device labels.

For every private or mutating server path, check active account state and nonrevoked session state, including database RLS, storage, export delivery, synchronization, grant issuance and publication. A JWT signature and unexpired timestamp alone are insufficient. Authorize concurrent work at a defined transaction/commit boundary: work accepted before revocation may complete, while operations accepted afterward are denied. Bytes already delivered cannot be recalled. Revoke refresh sessions as well as application authorization; do not rely on waiting for JWT expiry.

Reconcile lifecycle state on foreground/reconnection and the existing connected reconciliation cadence. Notify connected clients where possible; notifications are hints, not authorization. Upon confirmed revocation, commit a local lock, pause/save activity and close access without erasing its private records. Fresh authentication to that same active account can reopen them; it does not revive an old allowance grant or transfer one. On confirmed deletion, stop account work and wipe it as below. Ignore delayed callbacks from prior account-session generations.

The lifecycle protocol must provide a narrowly scoped, authenticated way to distinguish confirmed deletion/revocation from failed renewal, without restoring general access to a revoked session. A missing response, stale token, or generic 401 is never deletion proof. Old local data cannot be opened by a newly created account that happens to use the same email.

Authenticated provider revocation makes that sign-in method unavailable and revokes affected app sessions; it is not an instruction to delete the True Count account or its private history. Other linked methods remain available for fresh sign-in. Disabling Apple relay forwarding likewise does not delete the app account. Verify provider event authenticity and reconcile credential state where supported; provider events may be delayed, so do not promise instantaneous discovery. Immediate denial applies when our server accepts revocation, independently of provider token-revocation propagation.

### Export

Offer a free export while the account remains accessible. A server export requires fresh online authentication and includes a consistent snapshot of the account's synced private records and its own profile/contributions, settings and relevant account data. Include CSV session summaries and versioned JSON for strategies, detailed histories, challenge results and available progress records. Include a manifest describing snapshot time, scope, formats and omissions. Exclude credentials, encryption keys, other players' private data, and security secrets.

The current unlocked account may also produce a local supplement without successful synchronization, containing unsynced records, competing edits and unfinished activity state. It identifies originating device, revision and sync status so it cannot be mistaken for additional finalized sessions. Do not demand successful upload before permitting this safeguard. A server export cannot discover records never uploaded from another device; always explain that limitation rather than claim account-wide completeness. Do not automatically reconcile conflicts or change casino totals while exporting.

Keep server archives private and authorize downloads against live account/session state; avoid long-lived bearer links that bypass revocation. Accepted default: generated server archives expire after 24 hours, with regeneration available. Delete temporary generation files on failure and invalidate downloads immediately on account deletion. Account deletion does not wait for an export unless the player chooses to finish exporting before confirmation. Files already downloaded by the player remain under their control. Importing archives remains out of MVP.

### Deletion acceptance and completion

Apply the 30-day undo-window amendment above first. The irreversible acceptance, revocation, wipe and purge steps below describe **permanent deletion**, reached at the scheduled deadline or through Delete permanently now; they do not run when a reversible deletion is merely scheduled.

Provide Settings → Delete account and a minimal web deletion path reachable without reinstalling the app. The web path serves account lifecycle only, preserving the no-browser-game-UI launch boundary. Require fresh authentication and explicit confirmation of irreversible deletion, unsynced-record loss, public-content effects and subscription billing consequences. Offer export and a store subscription-management link first without requiring cancellation or subscription expiry before deletion.

Permanent deletion requires authoritative online acceptance, either of the immediate action or of the previously scheduled deadline. There is no offline deletion queue and no recovery after this permanent boundary. The acceptance transaction marks the account deleting, permanently blocks new account operations, revokes account sessions/grants and public contribution permissions, and creates a durable deletion job/receipt. Serialize it with uploads, linking and purchase operations. A timeout is an unknown outcome, not proof of failure or success: status/retry of the same request returns the same acceptance, without offering an undo. A restricted deletion-status facility can show accepted/processing/completed without granting access to account records.

Hide owned public listings, profile, ratings, practice/popularity contributions and related cached aggregates as part of acceptance enforcement. Cancel owned queued/running simulation publication; delayed jobs cannot republish results. Physical removal may run asynchronously, but public queries must honor deletion state immediately. Public removal must not depend on the cleanup worker having traversed every row.

On the initiating device, after acceptance, close its account work and erase its encrypted database, key, credentials, pending uploads, staged files and app-owned export copies. Other installations do the same when they receive authoritative deletion status. Never erase a different account's data or demand that unreachable devices reconnect before processing the server deletion. Do not promise remote erasure of permanently offline devices or files the player exported outside the app.

Purge private histories, casino records, strategies, challenges, profile, ratings, contributions, device/session metadata and nonrequired account identifiers, including staged upload chunks, temporary bootstrap snapshots, export files and service-provider copies. Revoke provider authorizations as required, then remove the Auth identity in an order that does not strand owned storage objects or lose the credentials needed for provider revocation. Jobs retry safely; a failure cannot reopen the account. Keep a minimal processing receipt/status and any delivery contact only as long as required to complete/notify or satisfy the expressly defined retention policy.

Accepted service target: complete active-system deletion within seven days of acceptance, with access/public visibility already blocked at acceptance. Show the expected timeframe, report delays, and provide completion status. This is a product target, not a statutory deadline or a tested operational guarantee. A shorter applicable legal deadline takes precedence. Backup expiry is disclosed separately and is not represented as completed active-system cleanup.

Preserve other players' saved executable revisions and remixes under the accepted community contract, with source relationships and historical execution intact. Replace deleted-author identity with “Deleted author” and remove author prose/personal attribution from source references controlled by the app. Reconnecting clients apply those removals. Do not claim to scrub independently copied personal text from every remix automatically; the content-rights/privacy release review must settle any further removal duties. No retained source stub may expose the deleted profile or sign-in identity.

### Retention and preventing restoration of deleted accounts

Re-created accounts receive fresh, never-reused account IDs. Missing, deleting or deleted account IDs are denied by default; stale uploads cannot auto-create an account or move records to a new identity. Once payload deletion is complete, ordinary command receipts and item tombstones do not need indefinite retention merely to reject writes for a nonexistent account.

Keep only the minimum deletion-control information needed to prevent a recoverable backup or still-usable credential from reopening the old account. It must not contain private histories or public prose. Before restoring service from backup, reapply independently protected deletion/revocation and sharing-withdrawal control state. If that state cannot be reconciled, do not reopen affected access or public serving. Compact/delete control records once no retained restoration source or credential can resurrect the relevant state; an indefinitely offline device alone is not a reason to retain personal payloads indefinitely.

Separate necessary billing/control records from private gameplay data. The later [subscription ownership decision](subscription-lineage-retention.md) removes the post-erasure restoration purpose: erase the account association during permanent cleanup except for specifically justified processing/recovery or legal records. Every exception needs purpose, restricted access and an expiry; no permanent undisclosed forfeiture blacklist or retained private history is authorized.

Exact backup lifetimes, control-record durability/compaction, mandatory financial/security retention and provider deletion timelines remain explicit prelaunch decisions with the operations and launch-markets tickets. This contract sets their required behavior without inventing jurisdiction-specific duties or accepting indefinite retention. They must validate the seven-day active-deletion target and 24-hour export expiry against provider behavior and the accepted budget, or return an explicit proposed change.

### Purchases and providers

An existing account's purchase cannot be attached to another account. Show the conflict and offer sign-in/recovery without exposing the owner's identity. A scheduled-deletion account remains an existing owner until permanent erasure. The later [subscription ownership decision](subscription-lineage-retention.md) removes the deliberate-deletion transfer exception: no custom recovery of an erased ownership mapping is promised. Delayed webhooks and old-account tokens cannot recreate the account or attach its historical purchase to a new owner. New verified purchases require their own authenticated live-account intent.

Deleting the app account is not a claim that the store subscription was cancelled or refunded. Explain billing and provide store management access before deletion; do not block immediate deletion until the paid period ends. Subscription verification owns provider selection, entitlement timelines, proof requirements and transaction-retention details, consuming this ownership contract. Restoration is never manual recovery of an old private account.

Qualify Apple/Google native and browser flows on iOS and Android, verified linking/unlinking and email changes, relay delivery, deep links, revocation and deletion. Configure production email delivery and abuse limits; Supabase's development mail service is not an assumed launch service. Do not log email codes or provider tokens. Provider secret rotation, Apple notification handling and deletion token revocation require explicit operational ownership and monitoring. Missing provider capabilities are implementation gates, not permission to silently remove an accepted sign-in method.

### Required implementation scenarios

These are acceptance requirements, not tests run during this planning session.

| Scenario | Required outcome |
| --- | --- |
| Apple relay sign-in, then Google with a different email | Explicit linking into the signed-in account preserves one owner; an already-owned identity gives a conflict without merging. |
| Same verified email through supported providers | Provider-verified identity behavior returns the intended account; no application email-string merge. |
| Email sign-in for an unknown address; failed email change or unlink | No accidental recovery claim; no silent new account on email sign-in; at least one usable method survives changes. |
| Offline sign-out, then another account signs in | Original records/key remain isolated and need fresh online sign-in; no data or allowance inheritance. |
| Expired token or provider outage versus confirmed revocation | Outage preserves permitted cached access; confirmed revocation locks; neither erases private data. |
| Revoked JWT used against API, storage, exports or direct database access | Live account/session authorization denies new access despite unexpired JWT. |
| Export with failed uploads and records on another offline device | Server snapshot and labelled local supplement remain distinct; unknown remote-local records are explicitly excluded. |
| Scheduled deletion; same-account sign-in before deadline | Account data remains; explicit cancellation reactivates the same account without extending paid time or refilling allowances. |
| Undo races with deadline or immediate permanent deletion | Server state selects one outcome; finalized deletion cannot be undone, even if physical cleanup is pending. |
| Permanent deletion accepted but response lost; uploads/jobs arrive concurrently | One irreversible acceptance; status retry is safe; no restored account or renewed public contribution. |
| Deletion worker fails after public removal | Account stays inaccessible, cleanup retries and completion remains pending. |
| Old device reconnects; old email creates a new account | Confirmed deletion wipes only the old local account; new ID cannot inherit old records or receipts. |
| Restore a backup from before deletion or sharing withdrawal | Control state is reconciled before service/public access resumes; no resurrection. |
| Deleted author has saved copies and remixes elsewhere | Executable/history references survive under accepted rights; controlled attribution/prose disappears. |
| Restore purchase for retained versus permanently erased account | Retained owner requires sign-in; erasure has no custom transfer path. Qualify old-purchase rejection and genuinely new purchases without duplicate benefits. |

### Named handoffs

- [Subscription verification and entitlement implementation](https://github.com/0xRowdy/true-count/issues/23): implement existing-owner conflicts, the amended no-custom-post-erasure-transfer policy, store proof and serialized ownership, billing cancellation guidance, provider reconciliation and limited transaction retention.
- [Launch markets and data residency](https://github.com/0xRowdy/true-count/issues/27): resolve applicable export/deletion duties, required retention, mail/auth/provider processing regions, and any shorter legal deletion periods. Store documentation alone does not settle these legal requirements.
- [Backend operating envelope and disaster recovery](https://github.com/0xRowdy/true-count/issues/28): select finite backup/processing/control-record retention, independent deletion-control protection, restoration reconciliation, email/provider operating costs and monitoring; verify the accepted processing targets within budget or propose an explicit change.
- [Community content rights and author deletion](https://github.com/0xRowdy/true-count/issues/29): resolve publication/copy/remix permissions, attribution and author-erasure obligations, including independently copied text and required exceptions to retained executable copies; wait for launch-market inputs. This graduated from release-readiness fog and does not reopen the accepted baseline without an explicit decision.
- Broader release readiness: account-required app-review rationale, final privacy/deletion disclosures, built-in/reference content licensing, and age/content requirements remain on the map. These are not certified by this decision.

No production authentication, export service, deletion job, store integration or restore procedure is implemented here. Preserve the three-game launch scope and the user's direction to avoid elaborate offline account-lifecycle flows.

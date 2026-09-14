# Offline access and subscription lifecycle — accepted decision

Accepted from Q1–Q28, the user's review clarifications, and explicit acceptance of the service-outage boundary. Optional scope cuts have not been adopted. The resolution comment on [Offline access and subscription lifecycle](https://github.com/0xRowdy/true-count/issues/8#issuecomment-5564273168) is canonical; this file preserves the reviewed decision for repository readers.

## Scope and existing contracts

Specify offline access, account separation, allowance ownership, recovery, and reconnection for the iOS/Android MVP with blackjack, standard craps, and roulette. This is planning, not implementation or certification of a particular platform API.

Preserve the accepted [access and premium benefits](https://github.com/0xRowdy/true-count/issues/2), [challenge semantics](https://github.com/0xRowdy/true-count/issues/4), [strategy execution model](https://github.com/0xRowdy/true-count/issues/5), [community lifecycle](https://github.com/0xRowdy/true-count/issues/6), [session ledgers](https://github.com/0xRowdy/true-count/issues/7), and [allowance accounting](https://github.com/0xRowdy/true-count/issues/10). In particular, the later ledger decision makes casino sessions strictly private; older community discussion does not authorize sharing them.

Ordinary free play remains unlimited within game-access rights. Free accounts have all three games online and one selected game offline. Premium includes all three offline, unlimited training, and no advertising. Session logging and complete saved-history/basic-results access remain free and available offline for locally held records. Reinstallation can restore synced records after online sign-in; it cannot guarantee recovery of device-only data. Ads never block saving or offline play and retain their accepted natural-break limits.

## Offline readiness and game selection — Q1, Q2, Q15

Bundle all three games and their built-in strategies with installation. Show explicit offline readiness. Saved community strategy revisions become available offline after downloading; browsing the community still requires connectivity. Identity, access rights, and content readiness remain separate.

Every account selects its free offline game during initial setup, including premium accounts. Keep this fallback visible in Settings. Changes require connectivity and follow the account on connected devices. A device still offline retains its last confirmed selection until reconnection, allowing temporary differences. The ready content must support the selected game; merely having other games installed does not grant offline access to them. Counting challenges remain blackjack content under the same game-access boundaries, apart from the already-started attempt completion exception below.

## Connectivity and service availability — accepted review clarification

A Wi-Fi/mobile connection indicator or captive portal is not evidence of usable online access. Actions that change authoritative account state require a successful response from the responsible service: initial sign-in and sign-in after explicit sign-out, daily allowance grants, allowance transfer/replacement, offline-game or timezone changes, purchase linking/restoration/verification, enabling sharing, publication, ratings, and conflict resolution. A request that times out is pending or failed, not confirmed; retries cannot duplicate it. Public withdrawal can be queued locally, but removal is confirmed only after server acknowledgement. Community browsing/downloads require their content service; previously downloaded revisions remain usable under cached access rights.

Cached account state suffices for remembered sign-in, the selected offline game, spending a still-valid allowance on its designated device, premium within its existing offline deadline, local strategy editing, session logging/history, saving, and permitted recovery/final settlement. Failure of an unrelated service, such as community browsing or private-record upload, does not revoke those rights.

**Accepted outage policy:** starting or resuming free play outside the selected offline game requires a successful account-access response. That response authorizes the current foreground activity; routine backend errors do not interrupt it while usable internet connectivity remains established. No per-turn server request is required. A pause, background/restart, or loss of usable internet ends that online authorization: apply the accepted stopping rules on loss, and require a new response before further play outside the selected game. An already-started challenge retains its completion exception. A captive portal does not qualify as usable internet. Architecture must define and test the connectivity validation mechanism without treating account-service failure alone as proof that internet access was lost.

Thus, during a True Count account-service outage, an already-authorized foreground activity can continue, but a new/resumed activity may be restricted to cached offline rights. Display “True Count is unavailable. Your selected offline game and saved records remain available.” This policy makes the outage boundary explicit; it does not grant an unlimited cached all-games entitlement.

## Offline promise and player-facing status — review clarification

Onboarding and purchase copy must state that free offline training requires an unexpired daily allowance obtained online, and that premium requires periodic successful verification, at most seven days apart and sometimes sooner. If reliable elapsed time becomes unavailable, reconnection may be required before the displayed deadline. Do not advertise unconditional or permanent offline training.

Show separate content, access, allowance, verification, and sync statuses. Example: “Blackjack content ready offline”; “Selected free offline game: Blackjack”; “Training allowance expires at midnight — connect to obtain tomorrow's allowance”; “Reconnect by September 14 at 10:00 AM Mountain Time for premium access”; and “2 records waiting to sync.” Use the account's actual allowance expiry during timezone transitions rather than always saying midnight. When time is uncertain, replace the deadline assurance with “Reconnect to verify access.” Content readiness alone does not promise playable access.

## Identity and account separation — Q8, Q22

Initial sign-in requires connectivity. A previously signed-in account can reopen offline without repeating sign-in, subject to the separate access and content rules.

Explicit sign-out saves and pauses unfinished activities. Retain unsynced records privately under their original account, explain that uploading requires signing back into that account, and require online sign-in before resumption after explicit sign-out. Another account cannot see, upload as its own, or inherit the prior account's records, activities, or allowances.

Premium is one True Count account-level entitlement across iOS and Android. Linking or restoring a purchase requires online verification. Do not silently attach the same purchase to a different True Count account. Store-specific verification, purchase-conflict handling, and account lifecycle implementation belong to the follow-up decisions; this policy does not assert that either store supplies cross-platform entitlement automatically.

## Offline premium verification — Q3, Q7, Q12, Q18, Q23

First establish whether the store currently recognizes the subscription as entitled. Applicable store billing grace preserves access even after the last paid period ends; billing retry alone must not be mistaken for entitled grace. Apple describes continued access during enabled Billing Grace Period, and Google requires subscription benefits during grace and dynamically extends the entitlement expiry. Use the verified entitlement state and its applicable end, including store billing grace, rather than the last payment date. Sources: [Apple billing grace](https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions), [Google subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions).

Store billing grace and True Count's offline grace are separate. A successful current verification of an entitled state grants premium access. For subsequent offline use, let V be the successful verification time and E the verified end of the currently recognized entitlement, including applicable store billing grace. The offline deadline is min(V + seven days, E + 72 hours). The additional 72 hours tolerate inability to reverify; they do not change the store's billing state or override a later confirmed loss of entitlement.

For example, verification on September 6 confirming store billing grace through September 10 gives an offline deadline of September 13, even if the paid period ended September 1. A successful entitled response must never be rejected by calculating against that stale paid-period end. If a response confirms current entitlement but supplies no usable future entitlement end, preserve current verified access; do not manufacture E or a new offline extension. Retain any still-valid prior offline deadline and otherwise require successful verification for access. Provider-specific handling of that exceptional response is an explicit subscription-architecture acceptance case.

Explain the reconnect deadline to the player. Successful verification reporting expiration or revocation overrides remaining offline grace. Failure to verify leaves the existing deadline unchanged: it cannot extend it or prematurely end still-valid offline access. Cancellation of renewal alone preserves access through the verified entitlement end. Store-specific billing/verification states must be mapped to this contract in subscription implementation planning.

If the app cannot reliably determine whether an allowance or premium deadline has passed, require reconnection before starting further training or using premium-only access. Displayed-clock changes never extend access or grant allowance. Reboot and reinstall are not sources of fresh grants or verification periods. Architecture must establish how trustworthy elapsed time survives, or becomes unavailable, across device events; uncertainty uses this reconnect rule.

When access becomes unavailable, finish only an already-started blackjack round, craps roll, or roulette spin, then perform final settlement, save, and end the session. An already-started counting challenge may finish on its original device without another charge. Recheck access before starting another turn, including after pause/recovery, a daily reset, premium expiration, or loss of connectivity to a game outside the offline selection. Pausing never extends access to new turns.

Afterward, free access includes the selected offline game, any valid available free allowance, and complete locally saved history/basic results. This access boundary must not interrupt settlement or reinterpret already-resolved outcomes. A proven execution defect that prevents valid continuation follows the incomplete-record rule rather than invented settlement.

### Craps stopping and final settlement — review clarification

“Finish the current roll” ends interactive training, not all game execution. Follow the accepted **Overrides, stopping, and blackjack fallbacks** rule in [Intuitive executable strategy creation](https://github.com/0xRowdy/true-count/issues/5#issuecomment-5556790279): stop new bets, return every wager the table rules permit removing, and automatically resolve the remaining committed wagers. In particular, established pass/come contracts cannot be refunded simply because access ended. Return removable place bets and removable odds according to the selected table conditions; the game engine determines removability for each wager and current state.

Final settlement may generate additional rolls solely to resolve those existing contracts. It permits no new wagers, presses, replacement bets, progression restart, or discretionary strategy adjustments. The player may view settlement or pause/close and later resume that same settlement; this never reopens interactive play. No additional training turns, time, or challenge attempts are charged for automatic settlement. Legitimate wins/losses still affect the original session and its original training bankroll where applicable; they never refill a new day's allowance. Show “Training ended — settling existing bets; no further allowance used,” then the final results. A restart preserves the settlement position, outcomes, and already-applied payouts.

## Free allowance ownership, replenishment, and recovery — Q4, Q6, Q9, Q11, Q14

One designated allowance device holds the account's free guided-practice and challenge allowance. Other devices retain ordinary free play within their game-access rights; they do not receive duplicate free training budgets. Premium training is not limited to the allowance device.

Obtaining each new day's allowance requires connectivity. The allowance device can spend the remaining valid daily budget offline. Reconnection, restarting an activity, changing the clock, rebooting, reinstalling, or moving between devices never independently replenishes it. Preserve the accepted account-timezone midnight reset and no-rollover policy. An expired grant cannot fund further new turns merely because the next grant has not been obtained.

Timezone changes require connectivity and preserve the current allowance's scheduled expiry. The first reset in the newly selected timezone occurs at its next midnight strictly after that expiry. Show the resulting reset time before confirmation; changing timezones must never produce an extra grant.

Transferring unused allowance requires the original device to reconnect and reconcile usage. Finish guided practice and final settlement before transfer; outstanding training-bankroll wagers cannot travel as spendable allowance. An already-charged challenge can remain paused and later finish on the original device; unused attempts transfer separately. The transferred budget is the remaining budget, not a new daily amount.

If the original device is lost or broken, permit an online replacement immediately, but the replacement can obtain training allowance only from the next daily reset. Today's unused amount remains unavailable unless the original device reconnects and transfers it. The replaced device cannot obtain future grants. A disconnected old device cannot receive the replacement notification, but its existing grant still expires at its original boundary; it cannot overlap a replacement's new-day grant. Missing or unreconciled device data cannot justify duplicating a grant.

Allowance accounting retains the accepted contract: active-time inclusions/exclusions; charge turns at deal/roll/spin start; charge challenges once at first exercise content; no additional challenge charge for resumption; no guided-practice charge for Play challenges; and settlement without new allowance charges. At reset, finish the current turn and final settlement, then end the guided session. An already-started challenge can finish. Old training-bankroll settlement remains with its finished session and never augments a new day's grant.

## Policy versions and subscription transitions — Q13, Q19, Q24

Keep policy versions attached to usage and historical results. Changes receive advance notice and take effect at a daily reset. If a returning offline player missed notice, show it on reconnection, retain their previous assigned policy for the current allowance day, and apply the change at the next reset. Do not grant both old and new budgets or refill an existing allowance. Stable account assignment, configurable trial amounts, and experiment reporting remain governed by the allowance decision.

A verified upgrade unlocks premium immediately and stops further free-allowance consumption without refunding earlier usage. For a session using the free training bankroll, finish its current turn and final settlement and end that allowance-funded session. Its remaining valid daily bankroll stays separate. Premium practice starts a new session using ordinary practice funding; premium winnings cannot replenish free training allowance. Outstanding already-funded wagers retain their legitimate settlements.

After premium ends, use any remaining valid free allowance on the allowance device. Obtaining a missing daily grant requires connectivity and obeys ownership/replacement rules. Upgrading and downgrading are not independent sources of allowance. Ordinary practice funding defaults remain with [Practice funding and table-challenge balances](https://github.com/0xRowdy/true-count/issues/20); this decision does not invent those amounts.

## Durable activity recovery and progress — Q5, Q17, Q21

Unfinished sessions and challenge attempts stay on their originating device in the MVP. Cross-device continuation is a later enhancement. Closing the app, restarting it, or updating it must preserve recoverable activity state, not create a fresh randomized activity.

Preserve generated cards/outcomes and sequence, outstanding bets, settled payouts, pinned strategy/rule/teaching references, pending strategy actions, answers and first-answer accuracy, assistance and interruption flags, deviation events, and allowance consumption. Resume without rerolling, double charging, duplicate payouts, or rewriting resolved outcomes. Final settlement resumes the same record and creates one final result. This is an execution and durability contract for architecture to implement and verify.

Recovered challenges are interrupted for fastest-record eligibility. Preserve completed accuracy eligibility, Learn/Check and assisted/unassisted distinctions, and other accepted challenge semantics. If recovery data is unusable, retain recoverable history and mark the activity incomplete rather than inventing a result. Incomplete attempts earn no personal bests or readiness credit. Reinstallation restores synced records, but device-only unfinished activities may be lost; that loss does not authorize a fresh allowance grant.

Sync completed results, saved strategies, histories, eligible personal bests, and earned readiness milestones across the account. Maintain consecutive-attempt readiness streaks per device for MVP. Do not stitch offline attempts from different devices into a new streak or infer their order from displayed clocks. Keep the accepted matching-configuration/reference groups and streak-breaking rules; earned milestones remain earned.

## Automatic synchronization and conflicts — Q10, Q16, Q25, Q27

Synchronize automatically for the signed-in account. Reconcile access, allowance ownership, and privacy withdrawals before accepting new grants or public contributions. Upload private records automatically, retry failures without duplicating records, charges, payouts, or results, and show pending/error status. A synchronization failure alone does not block saving or locally permitted play. It does not bypass an independent access deadline or trusted-time requirement.

Independent new sessions merge normally. When devices concurrently edit the same private strategy or casino-session record, preserve both proposed versions and ask which to keep when the player next edits that item. Never silently overwrite conflicting changes or count two versions of one casino session.

For each item, the server identifies one accepted revision. An edit identifies the accepted revision it was based on. Once competing edits are detected, freeze the currently server-accepted revision as the conflict's totals baseline; preserve the competing proposals separately. For example, if A's edit of R1 was accepted as R2 before B's edit of R1 arrives, R2 remains the baseline while B's conflicting proposal is reviewed. A third device does not redefine that baseline by acknowledging a different revision. This replaces the ambiguous phrase “last mutually synced version.”

While a casino-session conflict remains unresolved, canonical account totals include exactly that baseline revision once and mark the session for review. Devices still offline show totals based on their last received server revision, label pending local edits/sync status separately, and converge on reconnection; they cannot promise current account-wide totals. An unsynced new session remains visibly local until accepted, with retries deduplicated. Resolution establishes one new accepted revision and replaces the session's contribution exactly once. Private strategy conflicts retain the server-accepted revision as the default while proposals await resolution; active practice remains pinned. A server-accepted deletion contributes nothing and follows the recovery rule below.

If deletion conflicts with an offline edit, do not automatically restore the item. Preserve the conflicting edit for review and offer explicit recovery. A deleted casino session stays out of totals unless restored. Ordinary nonconflicting casino corrections still overwrite without an edit history under the ledger decision; temporary conflict copies serve reconciliation, not an added audit-history product.

## Privacy, public queues, and saved community revisions — Q20, Q26, Q28

Permit offline practice-sharing disablement and requests to remove public contributions. Stop local sharing immediately, durably queue withdrawal, and clearly state that public removal awaits connectivity. Reconcile withdrawals before queued contributions. Withdrawal removes prior public practice aggregates and popularity contributions while preserving private histories; explicit ratings remain separate contributions unless separately removed.

Offline withdrawal cannot immediately reach other devices. If device A disables sharing offline while device B stays online, B may continue contributing under the old sharing period before A's withdrawal reaches the server. Once received, the withdrawal removes all prior practice aggregates and popularity contributions covered by the withdrawal, including B's contributions accepted during that interval; preserve their private results. Show withdrawal as pending on A until acknowledgement. Do not use client timestamps to pretend enforcement occurred before receipt or to exclude B's intervening contributions from removal.

Withdrawal invalidates the previous sharing period account-wide. Results queued under that period on another offline device remain private, even if sharing is later re-enabled. The stale device must reconnect and receive the new sharing state before future sessions can contribute again. Retries and late uploads never restore withdrawn contributions.

Enabling sharing, publishing, and submitting ratings require connectivity. Re-enabling sharing includes future sessions only, never historical backfill. Preserve premium requirements for public publication/updates/ratings, free withdrawal rights after downgrade, and the accepted authentication/profile and community checks. Casino-session records remain strictly private.

New executable community revisions are adopted only by player choice; active sessions and historical results retain their pinned revision. On reconnection, apply known public-text removals and mark unavailable sources while preserving saved executable copies under the accepted community rules. An offline device can only apply a removal when it learns of it.

If an execution defect makes a revision unusable, explain the block and preserve affected records. Do not silently substitute a different strategy, rewrite historical execution, reroll outcomes, or invent settlement results. Valid recovery/final settlement can proceed where supported; an activity that cannot be validly recovered remains incomplete. Account deletion and legal content-rights obligations remain release-readiness work.

## Lifecycle scenario checks

These scenarios restate the accepted lifecycle contract. “Charge” below means free training allowance consumption, separate from legitimate wager settlement.

| Scenario | What continues | What stops | What gets charged | What the player sees |
| --- | --- | --- | --- | --- |
| Premium/allowance expires during a craps roll with an established pass wager | Current roll, return of removable bets, then automatic rolls until committed wagers settle | New interactive rolls, bets, presses, and cycle restarts | Existing turn charge is retained; settlement uses no extra allowance; payouts belong to original session | Access ended; settling existing bets; saved results afterward |
| Restart during settlement | Same settlement state and remaining contracts; already-generated outcomes remain fixed | Fresh outcomes for already-generated rolls, duplicate payouts, new bets | No replayed or extra settlement charges | Resuming settlement; incomplete record if valid recovery is impossible |
| Midnight without connectivity | Current turn then settlement; started challenge may finish; ordinary free play in selected game | New free training until an online daily grant | Existing charges stay; no offline grant or rollover; old bankroll cannot fund the new day | Today's allowance expired; connect for the new allowance; selected game available |
| Lost allowance device replaced online | Ordinary free play on replacement; old charged challenge may finish on original device if recovered | Replacement spending today's unreconciled allowance; future grants to old device | No replacement grant until next daily reset; no duplicate budget | Replacement registered; training available after the displayed reset and online grant |
| Premium verification fails | Cached premium until unchanged offline deadline if time remains trustworthy; safe completion afterward | New premium-only activity after deadline/uncertain time; no inferred renewal | No free allowance while premium remains valid; later free activity follows valid remaining grant | Verification unavailable; existing reconnect deadline or reconnect-required message |
| Store billing grace verified after paid period ended | Premium under confirmed entitled state; offline deadline uses recognized entitlement end | Denial based solely on past payment expiry | No free training allowance while premium applies | Premium active; store billing issue and actual reconnect deadline shown separately |
| A withdraws sharing offline while B contributes online; stale uploads later arrive | Private results and histories | Server removes covered contributions including B's intervening uploads once withdrawal arrives; old-period uploads cannot republish | No allowance refund or recharge from privacy changes | Removal pending, then confirmed; re-enabling includes future sessions only |
| Account service outage / captive portal | Cached offline rights; already-authorized foreground activity during backend outage with usable internet | New/resumed nonselected free game without successful access response; actual internet loss triggers safe stopping | No charge for a blocked start; normal accounting for permitted activity | Service unavailable or sign into network; selected offline game remains available |

## Launch scope and optional reductions — review note

The accepted baseline still includes durable recovery/account isolation, allowance transfer and replacement, chosen allowance timezone and controlled timezone changes, configurable policy versions/experiments, concurrent-edit reconciliation, and account-wide withdrawal. The initial live policy is already fixed to the accepted timed allowance for everyone; supporting later experiments is additional launch capability, not a requirement to run experiments on day one.

If implementation estimates require cuts, consider deferring self-service allowance transfer, user-selectable allowance timezones, and experiment-driven policy changes together before weakening recovery or account separation. Preserve lost-device replacement and a fixed launch policy. These are options, not accepted revisions: a timezone cut still needs a defined launch reset timezone, and a fixed-policy launch would revise the accepted allowance-experiment scope. Do not silently remove these requirements or reopen their closed decisions without agreement. Carry estimation and any proposed scope revision into architecture/delivery planning.

## Architecture handoffs and map maintenance

This product decision unblocks [Mobile platform and shared game-engine architecture](https://github.com/0xRowdy/true-count/issues/16). Its implementation contracts must cover durable exact recovery, separation of access enforcement from game execution, unchanged randomness/reference versions, safe stopping and settlement, and prevention of duplicated accounting. It must investigate technical feasibility rather than treating these product choices as already-verified capabilities.

The implementation-choice fog has graduated into these focused map children, each waiting for the mobile architecture choice:

- [Local persistence and account synchronization architecture](https://github.com/0xRowdy/true-count/issues/21)
- [Authentication and account lifecycle](https://github.com/0xRowdy/true-count/issues/22)
- [Subscription verification and entitlement implementation](https://github.com/0xRowdy/true-count/issues/23)

Subscription verification and entitlement implementation also waits for Authentication and account lifecycle. The tickets own provider choice, operational contracts, and scenario validation; this decision does not certify technical feasibility. Broader release readiness, visual direction/onboarding/audio/tutorials, and delivery staging remain on the map. Authentication and account lifecycle owns the focused account-lifecycle decision; release readiness retains the broader privacy/release review.

Optional launch reductions remain unaccepted. This resolves one non-research decision only; no production app, subscription service, or synchronization implementation has been built. Numerical blackjack-reference validation and ordinary practice funding remain with their existing tickets.

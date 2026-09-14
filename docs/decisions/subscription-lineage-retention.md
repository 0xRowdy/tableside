# Subscription ownership and account erasure — accepted planning decision

For [Subscription lineage retention and late restoration](https://github.com/0xRowdy/true-count/issues/44#issuecomment-5637393026). The user accepted minimum purchase/ownership information, requested no elaborate recovery after permanent erasure, and explicitly retained the previously accepted **30-day automatic permanent-deletion deadline**. This is a product and implementation contract, not confirmation that paid-access forfeiture is permitted by store terms or applicable law.

## Account lifecycle and scope

- Ordinary active accounts retain their data; no inactivity-based account purge or database-capacity cleanup project is planned for MVP.
- Account deletion uses the existing 30-day reversible period: immediately deactivate ordinary access and hide public content, preserve data and the same account identity for explicit undo, then enter permanent deletion at the server deadline. **Delete all my data now** bypasses the undo period. This is not indefinite retention of a closure request.
- Reactivation during the undo period requires authentication to the same account. Its existing purchase ownership remains intact; only current verified premium returns, with no new allowance or extension of paid time.
- Permanent deletion removes account data under the existing seven-day active cleanup target and separately disclosed backup/provider handling. It restores no private history and offers no custom benefits-only reassignment to a new account.
- The user intends permanent erasure to forfeit the remaining paid period. This supersedes the earlier discretionary benefits-only restoration promise in the account-lifecycle and subscription-verification decisions. **Forfeiture is an intended policy subject to focused store/terms qualification**, not a claimed store entitlement revocation or approved waiver of refund rights.

## Minimum records and retention endpoints

| Record | Retention rule |
| --- | --- |
| Current purchase association | Keep store/app/environment, verified purchase or subscription-lineage identifier, minimum linked references, opaque True Count owner, ownership generation and current entitlement/verification status while the account exists, including its 30-day undo period. There is no inactivity expiry for an otherwise retained account. |
| Verification credentials | Keep encrypted tokens/lookup references only while needed for current verification or identified unresolved processing. Do not retain entire historical receipts as an ownership database. |
| Detailed ingestion/retry evidence | Remove raw payloads after extracting the minimum durable verification/outcome information, subject to existing processing and temporary-data schedules. Never use missing detail as permission to grant benefits again. |
| Permanently erased account and purchase association | Remove during permanent account cleanup, targeting seven days from the irreversible boundary. Initiate applicable RevenueCat/processor cleanup too. Do not keep an undisclosed permanent purchase blacklist or private history to implement forfeiture. |
| Necessary residual processing/recovery or legally required records | Only the expressly identified minimum exception, with purpose, access and expiry owned by the existing privacy/recovery decisions. This decision creates no new indefinite exception; it does not promise erasure of independent Apple/Google transaction records. |

Minimal identifiers remain personal/control data where linkable; hashing is not proof of anonymity. A future inactivity policy requires its own communicated decision. It is not an implicit deadline today.

## Purchases and late returns

Existing-owner restoration continues to require sign-in to that existing account. A store receipt is purchase evidence, not authentication to private True Count data. During the undo period, the account is still an existing owner and cannot be bypassed by a new account.

After permanent erasure, a stale receipt, webhook, RevenueCat customer or recovered store identifier must not recreate the old account, recover its private data, or automatically attach its old entitlement to a new account. RevenueCat may reconstruct purchase data after customer deletion; neither deletion nor its keep-original-owner setting proves permanent forfeiture.

The implementation must distinguish an explicitly initiated new verified purchase for a live account from an unmatched historical purchase. Reject unsupported historical reassignment; do not guess an owner or ask the user to pay again to resolve an uncertain existing charge. This deliberately drops custom recovery of an erased ownership mapping. A store or integration conflict is a billing-support/qualification issue, not permission to silently reinstate the discarded restoration feature.

Keep the selected backend ownership authority, authenticated purchase intent, stable operation identity, current store verification and single-owner serialization. Inspect actual Apple/Google account-attribution and linked-purchase fields; they may be absent or insufficient. Capture indispensable Google out-of-app association before acknowledgement through a qualified SDK/backend flow, without missing the accepted acknowledgement deadline. Provider defaults and documented APIs are not proof that the chosen RevenueCat integration satisfies this ordering.

## Billing and release qualifications

Erasure does not itself cancel renewal, revoke the store entitlement or refund a purchase. Preserve visible store management and supported refund-request paths before erasure and in restricted billing help. Explain remaining value and continued billing; do not claim cancellation/refund until confirmed. Do not block immediate account erasure merely because the paid period has not ended.

Before production billing, the existing distribution/privacy decisions must resolve whether the intended forfeiture policy is acceptable and how to handle a renewal after erasure. A warning alone does not establish permission. If the policy cannot be supported, return the precise product conflict for a choice such as an applicable cancellation/refund path or revised restoration behavior; none is silently selected here. No absolute no-refunds policy is accepted.

Sandbox/native qualification must cover:

- Restore to the same active owner and reactivation before the 30-day deadline.
- Permanent deletion of both the True Count account and RevenueCat customer, followed by explicit restore and delayed notifications.
- A renewal after erasure, an expired subscription returning, and a genuinely new purchase on the same store account.
- Missing/changed store attribution, several purchases in one Apple receipt, competing accounts, provider/primary partial failures and acknowledgement timing.
- No old account recreation, duplicate benefits, arbitrary reassignment or repeated charge during uncertainty.

The common protected-outcome and restore-fencing contract remains the accepted delayed-command/recovery decision. Independent recovery work remains after MVP functionality. No new provider, account setup, live purchase, SDK integration or production deletion is performed by this decision.

## Evidence and handoffs

- [Purchase ownership after erasure](../research/purchase-ownership-after-erasure.md): store purchase proof can return after RevenueCat deletion, but cannot reconstruct erased app ownership or forfeiture intent.
- [Explicit erasure and subscription value](../research/subscription-erasure-forfeiture.md): the checked public rules do not directly settle deliberate-erasure forfeiture; paid-service fulfillment remains a material qualification.
- [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36): final data-retention/erasure disclosures and narrowly identified exceptions, with no indefinite hidden ownership ledger.
- [Beta and production store distribution readiness](https://github.com/0xRowdy/true-count/issues/45): paid-value/forfeiture qualification, continued-renewal handling, actual restore behavior and purchase/re-ingestion matrix before production billing.

The product decision is resolved with those explicit release qualifications. Their completion is not claimed, and any conflict that changes this policy requires a new product choice.

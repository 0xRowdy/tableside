# Purchase ownership after account erasure

Research date: 2026-09-11. Bounded follow-up to billing/recovery retention research. These are primary-source facts and proposed implementation consequences, not accepted product policy or tested recovery behavior.

## Finding

**A store can still prove a purchase after both the True Count account and RevenueCat customer are deleted. That does not reconstruct the deleted True Count account or its deletion/forfeiture decision.** Recovering a currently valid purchase into a new account and permanently preventing that purchase from granting access again are different requirements.

RevenueCat customer deletion removes purchase history and customer data; it does not cancel Apple or Google subscriptions. RevenueCat staff explicitly explains that a new account using the same store account can restore and recreate purchase data. The staff explanation is older (2023), but consistent with current restore documentation. [Customer deletion](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile), [staff explanation](https://community.revenuecat.com/general-questions-7/what-happens-to-historical-purchase-data-when-deleting-a-customer-2853), [restore documentation](https://www.revenuecat.com/docs/getting-started/restoring-purchases).

## What each identifier establishes

| Evidence | What it establishes | What it does not establish after erasure |
| --- | --- | --- |
| Verified store transaction / current store restore | A purchase and its current store status, within that API's scope | The new True Count login's ownership of an erased True Count account, or whether the purchase was deliberately forfeited |
| Apple `appAccountToken` | An app-supplied UUID returned in transaction data | A provider-maintained True Count login identity or deletion status |
| Google `obfuscatedExternalAccountId` | App-supplied account attribution, when present | A reversible identity mapping or deletion status |
| Apple `appTransactionID` | A stable identifier for the Apple Account's download of this app, including across reinstall/refund/repurchase | Identity of a particular True Count account where multiple app accounts use that store account |

Apple returns the app-supplied account token; Google's identifier is present only in documented linking/purchase cases. Google's guidance recommends keeping purchase metadata on the developer's secure backend. Apple's stable download identifier is available even without an in-app purchase. [Apple account token](https://developer.apple.com/documentation/appstoreservernotifications/appaccounttoken), [Google external identifiers](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2#ExternalAccountIdentifiers), [Google attribution guidance](https://developer.android.com/google/play/billing/developer-payload), [Apple app transaction identity](https://developer.apple.com/documentation/storekit/apptransaction/apptransactionid).

Consequently, discovering an old opaque account ID from a store response can identify an absent account. It does not recover erased credentials, profile contents, or whether absence means erasure, a data-loss incident, or an account never provisioned locally. This is an inference from the documented fields, not a claimed provider guarantee.

## RevenueCat does not provide a permanent forfeiture switch through deletion

RevenueCat's default restore behavior transfers an existing purchase to the restoring identified user. Its “Keep with original App User ID” behavior applies to purchases **currently associated** with an identified user. Anonymous owners can instead be aliased. Therefore do not assume that this setting preserves a deleted association forever; doing so contradicts the documented deletion/recreation model. It can also prevent a genuinely new subscription from granting access on iOS when the receipt remains associated with another app account. [Restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior).

Re-ingestion can involve server notifications as well as an explicit restore. Apple's RevenueCat integration normally ignores unknown purchases; enabling new-purchase tracking can create an anonymous customer when the account token has no matching customer. Google's corresponding option can create an anonymous customer or a customer from the external identifier. With the RevenueCat SDK, Google attribution is a hash of the App User ID; RevenueCat recommends anonymous-ID detection rather than assuming that hash equals the App User ID. These ingestion settings must be tested with deletion. [Apple notifications](https://www.revenuecat.com/docs/platform-resources/server-notifications/apple-server-notifications), [Google notifications](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications).

RevenueCat also exposes a Google Play order-ID restore API that assigns the purchase to a specified customer. That is a recovery mechanism, not evidence that RevenueCat independently knows which newly created True Count account should receive it. A support workflow must authenticate the claimant and apply the chosen ownership policy before invoking it. [Customer API](https://www.revenuecat.com/docs/api-v2/customer).

## Recoverability has limits

Apple's transaction-history endpoint needs a transaction/download identifier for the customer's app history. Google subscription tokens remain queryable only until 60 days after subscription expiration. This is not a universal purchase-data retention deadline, and it does not erase store history or establish that all later restore paths are impossible. [Apple transaction history](https://developer.apple.com/documentation/appstoreserverapi/get-transaction-history), [Google subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions).

RevenueCat documents that finished consumables and non-renewing subscriptions require retained custom-account history for restoration because they disappear from underlying store receipts. Thus “the provider still has the order” is not a universal rebuild guarantee across product types. [Restore limitations](https://www.revenuecat.com/docs/getting-started/restoring-purchases).

## Practical MVP choices

1. **Erase the account; permit a valid purchase to be restored into a fresh account.** Store verification can recreate the entitlement association without restoring private app records. This avoids needing a permanent *forfeiture* marker. It still requires current ownership checks to prevent one purchase granting access to multiple live accounts, and an explicit decision that account erasure does not permanently extinguish the store entitlement.
2. **Erase private data; permanently prevent the forfeited purchase from restoring.** The system needs durable evidence of the forfeiture, a verified terminal store change that achieves the same result, or a restrictive rule that rejects unmatched historical purchases. A minimal marker could contain a keyed digest of the relevant store purchase lineage and an erasure/forfeiture disposition; it need not retain email, profile, session records, or raw receipts. The marker is still retained control data and needs a justified purpose, notice, and retention decision. No universal expiry was established by this research.
3. **Erase every association and reject anything whose attribution cannot be linked to a live account.** This can fail closed without a per-erasure marker when attribution is reliably present and immutable enough for the chosen rule. It also rejects legitimate recovery after lost mappings and some purchases with absent/changed attribution. Therefore it is not equivalent to “erase everything, recover normal purchases from providers, and always distinguish forfeiture.” Provider docs do not establish that all required attribution is present on every path.

These are engineering alternatives, not a claim that a forfeiture marker is legally required or that permanent forfeiture is permitted. Provider purchase metadata alone records neither an app-specific forfeiture decision nor the justification for retaining one.

Apple separately requires clear billing/cancellation information during account deletion, offers subscription-management and refund flows, and requires an immediate deletion option even if scheduled deletion at subscription expiry is offered. Deleting the account is not cancellation. Permanent forfeiture of paid access needs separate product/store-policy assessment; it should not be inferred from permission to delete account data. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

## Bounded qualification before implementation

Test an active and expired subscription through account deletion plus RevenueCat deletion, then restore into a new account on the same store account. Repeat with server-notification new-purchase tracking on/off; inspect actual attribution fields and anonymous aliasing. Include store renewal after deletion, a genuinely new subscription after deletion, and a mismatched logged-in app account. Confirm backend authorization cannot be recreated merely by an incoming RevenueCat customer or webhook. No provider contact, account setup, SDK integration, GitHub writes, or live deletion/restore tests were performed here.

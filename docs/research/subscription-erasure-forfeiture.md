# Explicit account erasure and remaining subscription value

Checked: 2026-09-11. Scope: current public Apple and Google primary documentation; no provider contact or legal opinion.

## Finding

The reviewed sources do **not directly resolve** whether a user may deliberately erase an app account and permanently surrender the remaining paid subscription without a refund or future transfer. They neither explicitly authorize that exact policy nor explicitly require transferring a purchase to a new app account after deliberate erasure. Generic purchase restoration rules must not be represented as an express cross-account-transfer mandate.

Forfeiture can be recorded as the user's intended product behavior, **subject to focused distribution and applicable-law review**. It is not established as compliant merely because the user confirms a warning. Conversely, ordinary cancellation rules alone do not prove that voluntary immediate erasure must preserve a recoverable app account.

## Apple

Apple requires actual account deletion, not only deactivation. An optional reversible closure can coexist with erasure, but cannot substitute for it. Identity verification and confirmation are acceptable without unnecessary friction. Account deletion removes associated data except information legally required to remain. Apple explicitly permits immediate deletion while a subscription exists; if offering deletion at subscription expiry, an immediate option must remain. This supports separating account erasure from subscription cancellation, but does not settle later purchase restoration. [Account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

The same guidance says Apple billing continues after app-account deletion. Notify the user and request cancellation; expose Apple's subscription management sheet or link. A refund request can be offered through StoreKit or Apple Support. These are user cancellation/refund flows, not evidence of automatic developer cancellation or guaranteed refunds. Erasure must not claim that Apple billing has ended without verification. [Account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

App Review Guideline 3.1.1 requires a restore mechanism for restorable purchases. Section 3.1.2 requires subscription value and access across the user's devices. Neither provision specifically says a deliberately erased True Count account must be recreated or its purchase reassigned. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Schedule 2, section 3.8(c), requires fulfillment throughout the marketed subscription period and authorizes Apple refunds for breach. This is a concrete constraint to examine before implementing forfeiture, rather than proof that a deletion-specific waiver is valid or invalid. Store refund powers and applicable consumer rights cannot be waived by True Count's own absolute “no refunds” statement. [Apple Developer Program License Agreement and Schedule 2](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/).

## Google Play

Account deletion must delete associated user data; disclosed retention may be justified for security, fraud prevention or regulatory compliance. Google requires in-app and external deletion paths and permits clearly explained prerequisite steps such as subscription cancellation, with a support route. The guidance does not specify paid-entitlement forfeiture after erasure. [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

Ordinary subscription cancellation generally leaves current-period content available without a refund. Immediate cancellation with a prorated refund may apply in some countries. Developers must disclose cancellation/refund policies and comply with applicable law. This directly contradicts treating **ordinary cancellation** as immediate paid forfeiture; it does not expressly adjudicate separate deliberate account erasure. [Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533).

Google supports developer-initiated cancellation: stopping future payments does not ordinarily remove the current paid period. The developer-stop-payments mode also prevents restoration/resubscription from the Play subscription center, although in-app repurchase remains possible. Google separately documents full or prorated refund plus immediate revocation. Those controls provide a way to stop billing or terminate paid entitlement with a refund; they do not establish permission for immediate no-refund forfeiture. [Purchase management](https://developer.android.com/google/play/billing/manage-purchases).

## Implications for the proposed product distinction

- **Reversible closure:** retain the account for return as the user proposes; clearly label it as closure/deactivation. Subscription renewal and expiry still need explicit handling. Indefinite account retention itself has not been assessed here.
- **Erase account and data:** irreversible removal of app history and account, with accurately disclosed narrow retention exceptions. Do not promise destruction of Apple/Google's independent transaction records.
- **Remaining paid access:** the user's desired forfeiture is a separate policy requiring final validation against the paid offer, applicable rights and store review. Do not quietly substitute indefinite reassignment or promise that disclosure alone approves forfeiture.
- **Billing:** erasure is not evidence that renewals stopped. iOS needs the actual Apple cancellation flow; Android can use its server cancellation control. A refund request or refund/revocation is distinct from cancellation and erasure.

The shortest unresolved review question is: may this launch product terminate remaining paid access, without later transfer, when the user explicitly chooses irreversible account erasure after disclosure, and what refund handling is required? This note does not answer that question by inference.

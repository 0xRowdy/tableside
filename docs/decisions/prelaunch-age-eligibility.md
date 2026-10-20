# Prelaunch age eligibility — accepted decision

For [Prelaunch age eligibility and competitor-informed audience policy](https://github.com/0xRowdy/true-count/issues/42). Q1–Q8 and Q10–Q11 were accepted in the live discussion. The original Q9 proposal was rejected and replaced by case-triggered restrictions and manual support review. The user confirmed this consolidation in the live discussion. Planning only; the canonical resolution is recorded on the issue.

## Audience and feature access

- Product eligibility starts at 13 where platform restrictions permit. Under-13 users are outside the launch audience; MVP has no parental-consent enrollment flow for them.
- Eligible teens may use private practice and tracking, publish community strategies, and rate strategies under the accepted community safeguards. Private casino-session records remain private.
- Do not market specifically to teens. The product remains for recreational players first and beginners second. Declared audiences and store submissions must accurately reflect the intended teen/adult experience and actual content.
- Preserve blackjack, standard craps, and roulette, with no real-money wagering or prizes. Preserve US storefront distribution without an added residence declaration, physical-location gate, or precise-location collection.
- Product eligibility is distinct from store content ratings and permission to download. Do not promise teen availability on every platform or select a lower content rating to obtain it. Required parental/platform approvals still apply to eligible teens; they do not override the under-13 product exclusion.

## Establishing eligibility

- Use platform age signals where available and required. Where permitted, use a neutral age-range question as fallback: under 13, 13–15, 16–17, or 18+. Do not routinely collect exact birth dates or identity documents.
- A self-declaration cannot override a mandatory platform check or credible younger-age information. Refusing optional platform sharing may use the permitted fallback; refusing all sufficient evidence leaves eligibility unresolved. A missing optional signal is not itself confirmed ineligibility or adulthood.
- When eligibility cannot be established, pause ordinary product access. Keep restricted support, deletion and billing-help paths available. Private export remains available through appropriately authenticated/authorized recovery paths; age restriction does not authorize releasing records to an unverified requester.
- Preserve supported older devices through a permitted fallback. If a mandatory check cannot be satisfied on a supported device, restrict the affected access and surface the specific compatibility conflict; do not silently change the device floor or claim that a declaration satisfies the requirement.

## Advertising, analytics and subscriptions

- Keep advertising and optional analytics inactive until eligibility is established. Before then, permit only processing needed for eligibility, security and recovery.
- The later [privacy decision](us-launch-privacy-rights-disclosures.md) excludes teen ads at launch, superseding consideration of qualified teen contextual ads for MVP. Keep advertising inactive for teens and unresolved ages; no initialization or prefetch under a contextual label. Eligible adult ads remain contextual only.
- Eligible teens receive no optional product analytics, session replay or advertising profiles at launch. The later privacy decision permits adult optional analytics only by opt-in, with no replay; necessary service/security processing remains separate and minimized.
- Preserve premium's ad-free status and previously accepted free-ad placement/frequency limits.
- Eligible teens may purchase and restore premium through the stores, subject to required parental approvals. Restoration verifies entitlement but never overrides eligibility restrictions. Preserve subscription-management and refund-help instructions when access is restricted; do not claim that restriction or account deletion cancels billing or grants a refund.

## Later information and correction: revised Q9

- Defer proactive age investigations, a dedicated correction system, and automatic account deletion. Do not implement the rejected original Q9 workflow by implication.
- An explicit platform signal or credible support report counts as an actual issue. Apply required access restrictions and handle the case through manual support review using existing account tools.
- Known teen status applies the accepted teen protections. Established under-13 status is incompatible with ordinary product access. Required platform restrictions and data-handling obligations are not deferred until a broader pattern develops.
- Conflicting evidence does not automatically erase an account. Resolve actual cases through restricted support, including correction of erroneous information. A fresh self-declaration is not a bypass of credible conflicting information.
- Any necessary deletion or other data remediation is handled through existing tools after manual review and applicable requirements. The user did not approve automatic deletion on an age signal. Do not introduce under-13 enrollment through parental consent as a case-resolution alternative.

## Offline access

- Preserve previously established eligibility offline unless a required check expires or the device learns of a restriction. Add no blanket age-related reconnect deadline.
- Refresh signals when available online and enforce required checks before affected operations. This does not extend subscription verification, replenish allowances, or override other existing access deadlines.
- Newly learned ineligibility pauses interactive play immediately, including mid-round or mid-challenge, with durable state preserved for permitted recovery. For age-related denial this explicitly overrides the usual permission to finish the current round/challenge. It authorizes no reroll, duplicate charge, or fabricated completed result.
- A permanently offline device cannot receive an immediate remote restriction. Apply authoritative restrictions on receipt, before affected access or queued public contributions resume. Preserve account separation and existing privacy/deletion synchronization rules.

## Minimal retained evidence

- Retain only the current eligibility decision and the minimum supporting information permitted for that purpose: applicable age band, source type, check time, and policy version where allowed.
- Discard raw platform responses after processing. Do not log them or reuse age information in advertising, public profiles or community payloads.
- Replace superseded eligibility records rather than keeping an age-history log. The current record is retained for account eligibility and removed during account deletion, subject to separately defined, purpose-limited recovery controls. Restrictions on retaining source-derived fields take precedence over this candidate field list.
- Do not promote a user to adult status merely because time passed. An updated sufficient signal or permitted declaration must establish the changed status, subject to the conflict rules above.
- Use existing support-data retention for manual cases, qualified by the privacy decision; this is not authorization to retain raw signals or identity evidence in support tickets indefinitely.

## Evidence and bounded handoffs

The competitor comparison and legal investigation are evidence, not an accepted competitor-derived legal threshold: [competitor comparison](../research/competitor-age-eligibility.md), [bounded legal evidence](../research/launch-age-eligibility-law.md).

Apple's global OS 26+ definitions place infrequent simulated gambling at 13+ and frequent simulated gambling at 18+, including wagering without real money or redeemable currency. The actual app's content determines its rating. Crapsee's Teen Play rating coexists with adult contractual eligibility; Blue Wind's 13+ Apple rating does not establish contractual teen permission. [Apple definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/), [Crapsee terms](https://v3.crapsee.com/legal/terms), [Blue Wind listing](https://apps.apple.com/us/app/blackjack-trainer-all-in-one/id1470754366), [Blue Wind privacy](https://bluewindservice.com/privacy-policy).

Apple's age-range API begins with OS 26, with further regional features in later versions. Required checks are separate from content ratings. Google likewise distinguishes audience declarations, content ratings and applicable store age-signal duties. [Apple age assurance](https://developer.apple.com/support/age-assurance/), [Google audience guidance](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en), [Google age-signal guidance](https://support.google.com/googleplay/android-developer/answer/16569691?hl=en).

Actual knowledge of an under-13 user's personal-data collection can trigger COPPA obligations despite an earlier acceptable declaration. Colorado's minor-data provisions also require assessment beyond simply excluding under-13 users. These support the case-triggered handling and privacy handoff, not a blanket 18+ product rule. [FTC guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [Colorado SB24-041](https://www.leg.colorado.gov/bills/SB24-041).

Existing tickets own the remaining focused qualifications; do not create duplicate audience decisions:

- [Launch advertising provider and privacy controls](https://github.com/0xRowdy/true-count/issues/35): provider support for eligible teens, contextual-ad data collection and SDK startup, identifiers, consent, no-ad fallback, adult behavior and retention.
- [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36): exact allowed derived eligibility fields and support retention, teen-data protections and limited analytics, case-triggered child-data handling and authorized export/deletion, current federal/state applicability, consent and disclosures. Resolve any required handling that existing account tools cannot support explicitly.
- [Beta and production store distribution readiness](https://github.com/0xRowdy/true-count/issues/45): truthful rating/audience inputs, actual teen platform availability, age-signal and required approval/revocation/significant-update paths, older-device fallback and restricted-access scenarios. Verify current effective dates and litigation before relying on regional duties.
- [Disposable beta and durable-service transition](https://github.com/0xRowdy/true-count/issues/39): apply this audience policy to external beta invitations as well as production, preserving sandbox-only purchasing and isolated beta accounts.

Before external beta invitations or launch, qualify applicable age/approval requirements on the supported platforms and resolve material conflicts with this policy. This planning decision does not certify store approval, SDK behavior, legal compliance, or authorize distribution. Automated correction and proactive age investigation remain deferred unless actual cases justify revisiting them.

# Launch advertising provider — accepted decision

For [Launch advertising provider and privacy controls](https://github.com/0xRowdy/true-count/issues/35). The user accepted contextual-only advertising and the gambling-ad block, then confirmed the minimum launch package in the live discussion. Planning only; the canonical resolution is recorded on the issue.

## Accepted

- Contextual ads only for eligible adults; no personalized-ad option and no teen ads at launch, as finalized in the [privacy decision](us-launch-privacy-rights-disclosures.md).
- Block ads promoting real-money gambling at launch. Google Play independently requires this for the app's simulated gambling content.
- Keep this decision proportional to an MVP: select a provider and minimum behavior, with concrete SDK qualification left to implementation/release checks.

## Minimum launch package

- Use Google AdMob, with no additional mediation SDKs. This selection is supported by the initial comparison; actual publisher approval and SDK configuration remain release checks.
- Use ordinary dismissible interstitial ads only after practice-session or challenge results, preserving the accepted ten-minute cap, no ads before the first activity, no play banners, premium ad-free behavior, and saving/offline continuation without ads. No rewarded-ad feature.
- Keep advertising inactive until eligibility and applicable privacy requirements are satisfied. Do not initialize, prefetch or request ads for teens or unresolved ages. Do not fall back to personalized ads or default SDK settings.
- Send no app-authored account identifiers, private records, casino-session details, strategy results, or audience profiles to advertising. Provider-collected delivery/measurement data still needs disclosure: contextual does not mean anonymous.
- Skip unavailable ads without delaying continuation. Provide a remote ads-off control and a way to report inappropriate ads. Block real-money gambling and apply age-appropriate content controls.
- Do not add an adult personalization/ATT opt-in flow. Qualify a configuration that does not require cross-app tracking; if unavailable, return the conflict for a product decision.
- Treat ad revenue as unproven upside, with no minimum revenue or fill-rate dependency for launch and no mediation optimization project.

## Bounded verification before enabling ads

Verify actual app eligibility, supported native SDK/wrapper controls, consent and privacy choices before requests, remaining identifiers, provider recipients/processing locations and retention/deletion disclosures, gambling/category filters, dismiss/report behavior, and no-ad behavior for premium, teen, unresolved-age, ineligible, offline, and failed-configuration cases. Carry privacy disclosures through the existing privacy ticket and store checks through the existing distribution ticket. Do not claim provider data is erased by deleting a True Count account.

These are implementation/release checks against the chosen behavior, not authorization to integrate SDKs, provision accounts, or serve live ads during planning. Any provider conflict that would change accepted behavior must return for a decision.

Evidence: [initial provider comparison](../research/launch-advertising-provider.md).

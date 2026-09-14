# Launch-market privacy and distribution baseline

Research date: 2026-09-07. Supports [Launch markets and data residency](https://github.com/0xRowdy/true-count/issues/27). The user subsequently accepted the launch, publisher and exact hosting choices in the [canonical resolution](https://github.com/0xRowdy/true-count/issues/27#issuecomment-5573339375). This note preserves research and proposal wording preceding the decision; it does not certify compliance. Provider evidence is in [Provider processing locations](provider-processing-locations.md).

## Distribution is distinct from user location

Apple lets the publisher select specific countries/regions and separately choose automatic availability in future regions. The customer's Apple Account country determines their storefront. Removing a market does not revoke existing installations, updates or purchase-history downloads. A proposal for US-only distribution therefore means selecting that storefront and disabling automatic expansion; it does not establish US residence or prevent travel. [Apple availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store/).

Google provides country targeting for releases. The production and testing distribution settings need deliberate review when the market is accepted. [Google country distribution](https://support.google.com/googleplay/android-developer/answer/7550024).

English was subsequently accepted as the launch language. Apply that baseline across app content, store metadata, transactional email, support and policy documents; additional markets and localizations remain later-release choices.

## US privacy baseline and applicability

California's CalOPPA requires a commercial online service collecting covered information about California consumers to make its privacy policy available. Required content includes collected information and recipient categories, any review/change process, policy-change notification, effective date and tracking disclosures. Its text does not use the CCPA revenue threshold. [BPC 22575](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22575.).

CCPA applicability is a separate assessment. The regulator lists revenue, buying/selling/sharing volume and revenue-share tests, plus related-entity and other coverage rules. The revenue threshold was adjusted to $26,625,000 effective January 2025; the older California Attorney General FAQ still displays $25 million, so use the agency's current threshold publication. No conclusion about True Count's coverage follows from its being a small launch. [CPPA applicability FAQ](https://cppa.ca.gov/faq), [current monetary thresholds](https://cppa.ca.gov/regulations/cpi_adjustment.html).

For covered CCPA deletion requests, the Attorney General describes a 45-calendar-day response period, with a notified extension. This does not replace True Count's accepted seven-day active-system cleanup target, or imply every record must be erased under the same rule. [CCPA deletion FAQ](https://oag.ca.gov/privacy/ccpa).

State rules differ: Texas generally exempts SBA-defined small businesses from its broad privacy law, but separately requires prior consent for their sale of sensitive personal data. This is an example of why a CCPA-only review is insufficient, not a finding that True Count sells such data. [Texas Business and Commerce Code 541.002 and 541.107](https://tcss.legis.texas.gov/resources/BC/htm/BC.541.htm).

The FTC recommends collecting and retaining only needed data, securing devices and servers, and checking third-party libraries; platform protections do not remove the developer's responsibility. [FTC app security guidance](https://www.ftc.gov/business-guidance/resources/app-developers-start-security).

These sources do not establish a need for a particular US database region. That is a limited finding from this investigation, not proof that every applicable jurisdiction or contractual obligation permits every transfer. Publisher location, actual audience, advertising/data uses and provider terms remain inputs to the final assessment.

## Colorado publisher follow-up

The user confirmed United States, Colorado as the publisher's legal location. That is an input to the assessment, not a claim about incorporation, business size or statutory coverage.

The Colorado Attorney General describes general CPA coverage at 100,000 Colorado consumers per calendar year, or 25,000 with revenue or discounts from personal-data sales. Covered rights requests generally require a response within 45 days, with an explained, necessary extension of another 45 days. Preserve True Count's shorter seven-day active cleanup target. Applicability must also account for amendments and special rules, including the separate age/access investigation, rather than treating volume thresholds as a universal exemption. [Colorado CPA guidance](https://coag.gov/resources/colorado-privacy-act/).

Colorado separately describes written disposal policies, reasonable security and service-provider safeguards for covered information. Its breach rules call for prompt investigation and, where notification is required, notice without unreasonable delay and generally within 30 days after determining a breach occurred, subject to the stated exceptions. These requirements depend on the statutory information categories; do not classify every practice balance as a financial account. Carry record classification, disposal and incident response into operations. [Colorado data protection guidance](https://coag.gov/resources/data-protection-laws/).

No Colorado-specific hosting mandate was identified in these sources. The proposed US-region choices remain engineering recommendations, not legal conclusions or proof of nationwide compliance.

## Existing product promises and release handoffs

- Preserve private casino-session records and histories in the accepted account storage boundary. Do not infer that backend-readable records may be sent to analytics, advertisements or public comparisons.
- Apple privacy disclosures cover integrated partners, including analytics and ad networks. Identifiers are not automatically anonymous. The actual SDK configuration and observed traffic must inform the disclosures. [Apple app privacy details](https://developer.apple.com/app-store/app-privacy-details/).
- Google requires account-deletion paths and explanation of legitimate retained data. Its retention exception does not authorize keeping all customer data indefinitely. Preserve the accepted in-app/web deletion paths and seven-day active cleanup target, and document finite exceptions. [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).
- Tax record retention depends on the record and its purpose. Do not translate business bookkeeping requirements into blanket retention of casino logs, practice histories, authentication tokens or raw billing-provider payloads. Operations must distinguish needed transaction evidence from disposable personal data. [IRS recordkeeping](https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping).
- Age/access remains a separate planning question. COPPA covers child-directed services collecting personal information from under-13s and general-audience services with relevant actual knowledge. Simulated casino content and store age ratings alone do not settle that assessment. [FTC COPPA FAQ](https://search.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).

## Decision outcome and remaining handoffs

1. The [canonical resolution](https://github.com/0xRowdy/true-count/issues/27#issuecomment-5573339375) records all accepted launch, publisher and hosting choices. Exact provider backup/support/log geography still needs qualification; do not equate primary hosting with universal processing restrictions.
2. [Backend operating envelope and disaster recovery](https://github.com/0xRowdy/true-count/issues/28): finite retention by record category, deletion/revocation recovery controls, provider cleanup timing and exact backup design. Reconcile legal retention exceptions against product deadlines.
3. [Transactional email provider and delivery operations](https://github.com/0xRowdy/true-count/issues/33), [Launch age eligibility and geographic access](https://github.com/0xRowdy/true-count/issues/34), and [Launch advertising provider and privacy controls](https://github.com/0xRowdy/true-count/issues/35) own the newly precise provider/audience decisions.
4. [US launch privacy rights and release disclosures](https://github.com/0xRowdy/true-count/issues/36): applicability, rights/appeals, consent and disclosures using the resolved provider, audience, retention and community-content inputs.
5. Broader nonprivacy store submission and built-in/reference content rights remain map scope. Community rights retain their existing decision. This investigation does not resolve those decisions.

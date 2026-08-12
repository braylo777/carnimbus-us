# Regulatory & Compliance Requirements for an Automotive Consumer-Lead Generation Company (Selling Leads to Used-Car Dealers) — U.S., with California/LA County Depth

> **Filed 2026-07-18 · source: founder deep research · status: reference document**
> Operational summary + deadlines: `.claude/brain/compliance-posture.md`
> Not legal advice — engage TCPA and California DMV/privacy counsel before launch.

## TL;DR
- A U.S. automotive lead-gen business selling consumer leads to used-car dealers is governed primarily by the FTC Act §5 (UDAP), the TCPA (phone/text consent), CAN-SPAM (email), the FCRA/GLBA (if any credit or financial data is involved), and a fast-growing patchwork of state privacy/data-broker laws — with California by far the most demanding, requiring data-broker registration under the Delete Act/DROP and CCPA "sale" opt-out compliance.
- The single biggest 2025-2026 shift is favorable: the FCC's TCPA "one-to-one consent" rule that would have crippled multi-seller lead selling was vacated in *Insurance Marketing Coalition Ltd. v. FCC*, No. 24-10277 (11th Cir. Jan. 24, 2025) and formally repealed by the FCC in 2025; the FTC's CARS Rule was also vacated (5th Cir., Jan. 27, 2025) — but California re-enacted a state CARS Act (SB 766, operative Oct. 1, 2026) and enforcement risk under existing UDAP law is rising.
- Pure lead generation (selling contact + car-interest data to dealers) generally does NOT require a California DMV dealer license or autobroker endorsement — but if the company negotiates prices, guarantees deals, or arranges specific transactions for consumers, it crosses into "brokering" and must be a licensed dealer with an autobroker endorsement.

## Key Findings

1. **TCPA is the dominant litigation risk.** Even after the one-to-one rule's demise, prior express written consent (PEWC) is still required for autodialed/prerecorded marketing calls and texts to cell phones. Damages are $500-$1,500 per call/text with a 4-year statute of limitations and an active plaintiffs' bar. State "mini-TCPAs" (Florida, Oklahoma, Washington) are stricter than federal law and consent obtained for one seller is often unusable for another.
2. **California is the compliance center of gravity.** The Delete Act/DROP data-broker regime, CCPA/CPRA "sale" opt-out obligations, strict auto-advertising rules (13 CCR §260 et seq.; Vehicle Code §11713.1), and the new California CARS Act all converge on this business. In Q1 2026 alone, California privacy regulators issued more than $4.22 million in CCPA penalties.
3. **Consent documentation (TrustedForm/Jornaya) is effectively mandatory**, not optional — the caller/seller bears the burden of proving consent, and it is not transferable.
4. **Contracts must allocate TCPA/UDAP liability** via representations, warranties, indemnification, insurance, audit rights, and non-agency clauses — courts have enforced lead-generator indemnity obligations (*Moore v. Torchlight/Call Centrix*).

## Details

### 1. FTC Act §5 (UDAP), Lead-Gen Rules, Endorsements, and the CARS Rule

**Section 5 UDAP.** The FTC Act §5 (15 U.S.C. §45) prohibits "unfair or deceptive acts or practices." This is the baseline for all lead-gen marketing. The FTC has repeatedly held **advertisers/lead buyers liable for the deceptive practices of their lead generators**, and vice versa. Key principles from FTC lead-gen enforcement and its 2015 "Follow the Lead" workshop/2016 staff report:
- Do not misrepresent the nature of the offer or who will contact the consumer; no bait-and-switch, no fake "job/benefit assistance" fronts, no false affiliation claims.
- Disclosures must be clear and conspicuous; the FTC disfavors disclosures buried in hyperlinks or requiring affirmative action to view.
- "Remnant" leads sold to buyers with no legitimate need for the data can violate §5.
- Conduct due diligence on publishers/sub-affiliates; the "complexity of the lead generation ecosystem isn't a shield against liability."
- The FTC's Telemarketing Sales Rule (TSR) runs parallel and governs telemarketing conduct/recordkeeping.

**Endorsements & Testimonials (16 CFR Part 255, revised eff. July 26, 2023).** If the company uses reviews, testimonials, influencers, or ratings on its lead-capture sites:
- Endorsements must reflect honest opinions and not be deceptive.
- "Material connections" (payment, employment, free products, family ties) must be disclosed clearly and conspicuously — "difficult to miss and easily understandable."
- Fake reviews, suppressing negative reviews, and undisclosed incentivized reviews are prohibited. The FTC's separate Rule on the Use of Consumer Reviews and Testimonials (16 CFR Part 465) now makes many of these practices independently unlawful with civil penalties.
- **Intermediaries** (ad agencies, marketing/PR firms — potentially a lead-gen company) can be liable for disseminating deceptive endorsements or hiring endorsers who fail to disclose.

**CARS Rule status.** The FTC's Combating Auto Retail Scams Rule (Vehicle Shopping Rule) was **vacated by the 5th Circuit on Jan. 27, 2025** (NADA v. FTC, 2-1) on procedural grounds (failure to issue an ANPRM), and the FTC formally withdrew it from the CFR in a February 2026 Federal Register action. It never took effect. **Implication for lead-gen:** the federal rule's disclosure/recordkeeping mandates do not apply, but the underlying UDAP conduct it targeted (deceptive pricing, hidden add-ons, bait-and-switch) remains illegal under §5 and state law, and FTC + state AG enforcement of auto advertising is intensifying. A lead-gen partner should not advertise misleading "total prices," non-universal rebates, or unavailable vehicles on behalf of dealer clients.

### 2. TCPA (Telephone Consumer Protection Act) — the core operational risk

**One-to-one consent — vacated and repealed.** The FCC's 2023 rule (would have required separate consent per seller + "logically and topically associated" content) was **vacated by the 11th Circuit on Jan. 24, 2025** in *Insurance Marketing Coalition Ltd. v. FCC*, No. 24-10277, where a unanimous panel held the FCC's rule "impermissibly conflict[s] with the ordinary statutory meaning of 'prior express consent.'" The FCC postponed and then deleted the vacated 47 C.F.R. §64.1200(f)(9) language, reinstating the prior rule, and declined to appeal (April 2025). **Consequence:** a consumer can once again consent to contact by multiple sellers/marketing partners through a single disclosure — the multi-seller lead-gen model is legally viable again. But this is a reprieve, not a safe harbor.

**What TCPA still requires:**
- **Prior express written consent (PEWC)** for telemarketing calls/texts to cell phones using an ATDS or artificial/prerecorded voice. PEWC must: (a) be a signed written agreement (checkbox/e-signature OK); (b) clearly authorize the specific seller(s) to call/text; (c) disclose that consent is not a condition of purchase; (d) identify the number.
- **Clear and conspicuous disclosure** near the submit button, with action language ("I agree," "I consent").
- **National DNC Registry** compliance — the FCC codified (2024) that DNC protections apply to text messages; scrub against the federal registry and state registries.
- **Internal do-not-call list** and honoring opt-outs.
- **Revocation rule (eff. April 11, 2025):** consumers may revoke consent by any reasonable means; honor within 10 business days; a one-time confirmation text is allowed within 5 minutes (no marketing). If a consumer revokes in response to an informational message, all further calls/texts must stop.
- **Calling hours:** 8 a.m.-9 p.m. recipient's local time (federal); stricter under state law.
- **Reassigned Numbers Database** checks to avoid calling reassigned numbers.

**Burden of proof.** The FCC has stated the caller/seller bears the burden of proving consent; "they may not rely on comparison websites or other types of lead generators to retain proof," and consent "is not transferable or subject to sale to another caller." This is why independent consent proof is critical.

**State mini-TCPAs.** For national lead sales:
- **Florida (FTSA):** broad autodialer definition (rejects Facebook v. Duguid), applies by recipient Florida area code, $500/$1,500 per violation, 8 a.m.-8 p.m., 3-contact cap per 24 hours, 15-day text opt-out cure; PEWC must name the specific caller — lead-shared consent is largely unusable in Florida. A 2025 split among Florida federal courts on whether DNC rules cover texts (Davis v. CVS; Bosley; El Sayed) is ongoing.
- **Oklahoma (OTSA), Washington, and ~15 states** have their own telemarketing statutes with private rights of action.

### 3. CAN-SPAM (email marketing)

For commercial email promoting the company or dealer offers (15 U.S.C. §7701; 16 CFR Part 316):
- Accurate header/"From"/"Reply-To" information; no deceptive routing.
- Non-deceptive subject lines matching content.
- Clear identification as an advertisement.
- Valid physical postal address.
- Clear, functioning opt-out mechanism; honor opt-outs within 10 business days; no charging/info requirement to opt out.
- Monitor affiliates/third-party senders — liability cannot be outsourced.
- Penalties are **$53,088 per non-compliant email** (FTC inflation-adjusted maximum effective January 17, 2025, up from $51,744). The FTC's largest CAN-SPAM penalty to date is Verkada Inc.'s $2.95M settlement (Aug. 2024).

### 4. State Privacy Laws — CCPA/CPRA, the Delete Act/DROP, and multistate

**CCPA/CPRA (California).** Applies to for-profit businesses doing business in California meeting a threshold (>$26.625M gross revenue; OR buying/selling/sharing PI of 100,000+ consumers/households; OR ≥50% revenue from selling/sharing PI). Selling leads to dealers is almost certainly a **"sale"** of personal information ("making available … personal information … for monetary or other valuable consideration"). Obligations:
- **Notice at collection** (categories, purposes, retention) at or before the point of collection.
- **"Do Not Sell or Share My Personal Information"** link + a second opt-out method; honor **Global Privacy Control (GPC)** browser signals (mandatory in California and ~11-12 states as of Jan. 1, 2026; California now expects a visible confirmation that the opt-out was honored).
- **No verification for opt-out** requests. CalPrivacy fined **Ford Motor Company $375,703** (decision announced March 5, 2026) precisely because Ford "required consumers to complete an email verification step before their opt-out requests would be processed," causing valid requests to go unprocessed.
- Honor **access, deletion, correction** and limit-use-of-sensitive-PI rights (45-day response window).
- **Do not sell PI of minors 13-16 without opt-in; under 13 requires parental consent.**
- **Service-provider/contractor agreements** with required CCPA terms for any vendors.
- **Enforcement is aggressive and opt-out is the top priority.** In Q1 2026, California regulators issued more than **$4.22 million** in CCPA penalties: AG Bonta's **$2.75M Disney/ABC settlement** (announced Feb. 11, 2026, then the largest CCPA settlement), CalPrivacy's **$1.1M PlayOn Sports** fine (its first student-data action, early March 2026), and the **$375,703 Ford** fine. Current CCPA civil penalties are **$2,663 per violation and $7,988 per intentional violation** (2026 inflation-adjusted), assessed per consumer with no aggregate cap.

**California Delete Act / DROP (the sharpest risk for a lead-gen "data broker").** A "data broker" is a business that "knowingly collects and sells to third parties the personal information of a consumer with whom the business does not have a direct relationship." A regulation effective Jan. 1, 2026 clarifies that a "direct relationship" requires the consumer to intend to interact with the business; **selling data collected outside a first-party interaction makes you a data broker even if you collected it directly.** A lead-gen company that sources or enriches data and sells it downstream is squarely at risk of this classification. Requirements:
- **Register annually** with the California Privacy Protection Agency (CalPrivacy) between Jan. 1-31; **2026 fee is $6,000** (plus a third-party processing fee) — some sources cite $6,600. Late registration: **$200/day** plus investigation costs.
- **DROP (Delete Request and Opt-out Platform):** live for consumers Jan. 1, 2026; data brokers must **begin processing deletion requests Aug. 1, 2026**, accessing DROP at least **every 45 days**, deleting matched data (including inferences) and directing service providers/contractors to delete, reporting status within 45 days. Failure to process: **$200 per request per day** — exposure compounds catastrophically (50,000 unprocessed requests = ~$10M/day).
- **Maintain suppression lists** to ensure deleted data is not re-collected.
- **SB 361 (2025)** expanded disclosures (whether they sell to foreign actors, governments, or generative-AI developers; sensitive data types).
- **Independent third-party audits every 3 years beginning Jan. 1, 2028;** first audit disclosure 2029.
- CalPrivacy launched a **Data Broker Enforcement Strike Force** and, on Jan. 8, 2026, announced two decisions against unregistered brokers: **Rickenbacher Data LLC (d/b/a Datamasters) fined $45,000** and **S&P Global Inc. fined $62,600** (calculated at $200/day for 313 days), for failing to register by the Jan. 31, 2025 deadline.

**Other state privacy laws (for national lead sales).** As of 2026, ~20 comprehensive state privacy laws are in effect (California, Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, Iowa, Indiana, Tennessee, Florida, Delaware, New Hampshire, New Jersey, Kentucky, Nebraska, Minnesota, Maryland, Rhode Island). Common obligations: privacy notice, opt-out of sale/targeted advertising/profiling, opt-in for sensitive data, honor universal opt-out signals (GPC required in ~11-12 states), data-processing agreements with vendors, 45-day response. Notable specifics:
- **Texas (TDPSA):** no data-volume threshold (applies to all but SBA small businesses); $25,000 per-violation penalty; aggressive AG enforcement on data brokers.
- **Colorado (CPA):** GPC mandatory; up to $20,000/violation.
- **Oregon:** consumers can request the specific list of third parties who received their data; applies to nonprofits.
- **Vermont and Oregon** have separate data-broker registration requirements; **Texas and Oregon** also maintain data-broker registries.
- Location of the consumer, not the company, governs — selling a Virginia resident's lead subjects you to Virginia law.

### 5. FCRA (if credit prequalification/financing involved) and GLBA (financial data)

**FCRA.** If leads involve credit prescreening, prequalification, or "trigger leads," the FCRA (15 U.S.C. §1681) applies:
- A **prescreened list is a "consumer report"**; the end user (lender/dealer) needs a **permissible purpose**, and prescreening is permissible only if it results in a **firm offer of credit** to every consumer on the list (FCRA §604(c)).
- The **firm offer must be genuine** (not a sham for marketing) and include the **prescreen opt-out notice** (short + long notice; toll-free 888-5-OPT-OUT / OptOutPrescreen.com) per Regulation V/§615(d).
- Only the CRA may apply the credit criteria; the recipient may not self-select on credit data.
- **Prequalification** is consumer-initiated and requires the consumer's knowledge/consent (electronic checkbox usually suffices in digital retailing).
- A lead-gen company should generally **avoid touching credit-report data** unless it and its clients have clear permissible purpose, firm-offer, and opt-out mechanics in place. Marketing "invitations to apply" based on non-credit data are outside FCRA.

**GLBA.** If the company handles consumers' **nonpublic personal information (NPI)** in connection with financial products (auto financing applications, income, SSN, account data), it may be "significantly engaged in financial activities" and subject to:
- **Privacy Rule (16 CFR Part 313 / Reg P):** clear-and-conspicuous privacy notices, opt-out before disclosing NPI to nonaffiliated third parties (subject to exceptions), and **limits on reuse/redisclosure of NPI received from a financial institution.**
- **Safeguards Rule (16 CFR Part 314):** written information security program with administrative, technical, physical safeguards, a qualified individual, risk assessments, encryption, MFA, vendor oversight, and incident response — the FTC has published auto-dealer-specific Safeguards FAQs.
- If the company merely receives NPI from a dealer/lender, it may be restricted in how it can reuse/redisclose that NPI.

### 6. Auto Dealer/Broker Licensing — Does a Lead-Gen Company Need a California DMV License?

**Bottom line: pure lead generation does not require a license; brokering does.** In California, the **autobroker's endorsement is not a standalone license — it is an add-on to a full DMV dealer license** (Vehicle Code §§166, 11700.2, 11735). An "autobroker" is a licensed dealer (§285) engaged in "brokering" (§232.5).

- **§232.5 "Brokering"** = "an arrangement under which a dealer, for a fee or other consideration, regardless of the form or time of payment, provides or offers to provide the service of arranging, negotiating, assisting, or effectuating the purchase of a … motor vehicle, not owned by the dealer, for another …."
- **§285 "Dealer"** reaches anyone who, for consideration, "induces or attempts to induce any person to buy … an interest in a vehicle" and receives value "from either the seller or purchaser."

**Where the line falls:**
- **SAFE (no license):** Selling raw leads (name/contact/vehicle interest) and generic vehicle/pricing information to dealers to pursue — the Edmunds/KBB model, and TrueCar's post-2017 "lead-generation platform" posture. Generating "simple contact leads for dealers to pursue" is treated as advertising/lead-gen, not brokering.
- **CROSSES THE LINE (requires dealer license + autobroker endorsement):** obtaining or guaranteeing a **negotiated price** for the consumer, issuing binding price/deal certificates, representing/acting on the buyer's behalf in a specific transaction, or inducing purchase of a specific vehicle while taking value from buyer or seller.
- **Caution on fee structure:** a flat per-lead fee paid by the dealer is generally advertising; **per-sale success fees tied to specific transactions** push toward "dealer/broker" characterization — this was the crux of *CNCDA v. TrueCar*.

**TrueCar precedent.** The California New Car Dealers Association sued TrueCar in May 2015 alleging it operated as an **unlicensed dealer and autobroker**. The court allowed dealer-licensing/brokering claims to proceed (March 2016), but the parties signed a binding settlement Dec. 14, 2017 and the case was **dismissed with prejudice Dec. 21, 2017 with no merits ruling**. TrueCar agreed to transition California dealers "from a pay-per-sale model with a cap to a flat-fee subscription billing model by January 1, 2019" (its disputed per-sale fees had been $299/new and $399/used vehicle) and to **double dealer indemnity to $50,000, up from $25,000**. No California DMV or AG enforcement action has held a TrueCar-style lead-gen platform to require licensing. **Practical guidance:** structure the business as pure advertising/lead-gen, use flat/per-lead fees (not per-sale commissions), and avoid negotiating or guaranteeing transaction terms for consumers. If licensing is triggered, a used-dealer license requires a physical bonded location ($50,000 surety bond), zoning approval, dealer education + exam, Live Scan, and a ~$175 application plus a $100 autobroker endorsement.

**Auto advertising rules (apply if the company advertises specific vehicles/prices on behalf of dealers).** California Vehicle Code §11713.1 and 13 CCR §260.00-260.05: advertised vehicles must be available and sold at/below the advertised price; disclose conditional rebate criteria; no bait-and-switch (13 CCR incorporates the FTC bait-advertising guides); disclose demonstrator/prior-registration status; include dealer identification. The company should not publish dealer ads that violate these.

### 7. California CARS Act (SB 766) — 2025-2026 development

California enacted **SB 766, the California Combating Auto Retail Scams (CARS) Act** (Chapter 354, Statutes of 2025; signed Oct. 6, 2025; **operative Oct. 1, 2026**), modeled on the vacated FTC rule. It applies to **"dealers"** (Vehicle Code §285 dealers), not to genuine non-dealer advertisers/lead services. It requires dealers to disclose a legally-defined **"total price,"** bans misrepresentations and no-benefit add-ons, creates a **3-day right to cancel used vehicles priced ≤$50,000**, imposes new point-of-sale signage (new §11709.2), and requires **2-year recordkeeping of advertisements/price communications**. **Implication for lead-gen:** if the company is a pure non-dealer advertiser, SB 766 does not directly regulate it — but dealer clients will demand that any advertising/lead pages the company runs on their behalf comply with total-price and misrepresentation rules, so contracts should push those obligations down.

### 8. Consent Management, Recordkeeping & Documentation Best Practices

- **Deploy TrustedForm (ActiveProspect) and/or Jornaya (Verisk) LeadiD** on every lead-capture page. TrustedForm records a session replay/certificate showing the exact disclosure and consumer actions; Jornaya issues a cryptographic LeadiD token timestamping the event and flagging lead-fatigue/fraud. ActiveProspect acquired Verisk Marketing Solutions/Jornaya in 2024.
- **Claim certificates immediately** (TrustedForm certificates expire if not claimed within 90 days); **retain proof for at least 5 years** (TrustedForm Retain; TCPA has a 4-year SOL — industry best practice 5-6 years).
- Capture: **timestamp, IP address, the exact form URL and disclosure language shown, the specific seller(s) authorized,** and the submission event.
- **Match the consent proof to the actual lead** — a certificate that doesn't correspond to the lead, or that documents deficient disclosure language, will not save you.
- A certificate **documents what happened; it does not validate that your disclosure language meets the PEWC standard** — get the disclosure language reviewed by counsel.
- Maintain DNC scrub logs, opt-out/revocation records (retain ≥4 years), suppression lists, and an auditable chain of custody.
- Pull each buyer's **lead-spec document** — some buyers require Jornaya, some TrustedForm Certified.

### 9. Contracts & Liability Allocation Between Lead Generator and Dealer Clients

Written agreements are essential to manage vicarious/UDAP/TCPA liability (courts hold every party in the lead-flow chain potentially liable). Include:
- **Representations & warranties** of TCPA/DNC/CAN-SPAM/state-law compliance and that valid PEWC was obtained for each lead, with the specific caller identified.
- **Indemnification & defense** provisions covering TCPA/UDAP/privacy claims — enforced in *Moore v. Torchlight/Call Centrix* (Illinois federal court compelled a lead generator to indemnify its buyer based on consent warranties).
- **Insurance** requirements (TCPA/media liability coverage; name buyer as additional insured).
- **Non-agency clause** (to limit vicarious-liability arguments) and **audit rights** to inspect consent capture and sub-affiliate practices.
- **Data ownership, permitted use, data-privacy/DPA terms** (CCPA service-provider or third-party terms; state DPAs), consent-language ownership, and copies of consent proof (TrustedForm/Jornaya) delivered with each lead.
- **Recordkeeping obligations** consistent with TSR and privacy laws.
- Provisions requiring downstream dealer advertising to comply with CARS/UDAP/auto-ad rules; reciprocal indemnity for dealer-caused violations.
- Right to **terminate/disqualify** non-compliant sub-sources on audit failure.

## Recommendations

**Stage 1 — Before launch (foundational):**
1. Stand up TrustedForm + Jornaya on all lead forms; have counsel draft PEWC disclosure language (clear/conspicuous, near submit, names the seller(s) or lists marketing partners, states consent not a condition of purchase). Claim and retain certificates 5+ years.
2. Register a California entity and build a privacy program: notice at collection, "Do Not Sell or Share" link + GPC honoring with visible confirmation, opt-out with no verification, deletion/access workflows.
3. Structure the business as **pure lead-gen/advertising** — flat/per-lead fees, no price negotiation or deal guarantees — to stay outside California dealer/autobroker licensing. Get a written legal opinion confirming non-dealer status.
4. Build DNC scrubbing (federal + state), internal DNC list, revocation tracking (10-business-day / any-reasonable-means), and reassigned-number checks.
5. Draft template dealer contracts with the representations, indemnity, insurance, non-agency, audit, and DPA terms above.

**Stage 2 — California data-broker compliance (calendar-critical):**
6. Assess data-broker status now. If you sell any leads sourced/enriched outside a direct consumer relationship, **assume you are a data broker.** Register with CalPrivacy in the Jan. 1-31 window and pay the fee. Build DROP integration (API or manual) to process deletion requests every 45 days starting **Aug. 1, 2026**; implement suppression lists. Missing this is the highest-magnitude financial risk ($200/request/day, as the Datamasters/S&P Global fines confirm).

**Stage 3 — National scale-up:**
7. Map each destination state's privacy law and mini-TCPA before selling leads there; treat Florida as high-risk (name-the-caller consent, area-code jurisdiction). Honor GPC in all ~12 mandatory states.
8. If credit/financing enters the funnel, implement FCRA firm-offer/opt-out mechanics and GLBA privacy + Safeguards programs, or contractually confine credit-data handling to licensed lenders/dealers.

**Thresholds that change the plan:**
- If you ever **negotiate prices or guarantee deals for consumers** → obtain a California dealer license + autobroker endorsement (and equivalents in other states).
- If revenue/volume crosses **$26.625M or 100,000 consumers** → full CCPA business obligations attach regardless of data-broker status.
- If a **new federal privacy law or a revived FCC one-to-one rule** emerges → revisit multi-seller consent architecture immediately.
- If dealer clients demand **per-sale compensation** → re-evaluate licensing exposure before agreeing.

## Caveats
- This is a synthesis of primary sources (statutes, FTC/FCC/CalPrivacy/DMV materials) and reputable law-firm analysis, not legal advice; engage TCPA and California DMV/privacy counsel before launch.
- The regulatory landscape is unusually fluid in 2025-2026: the vacated federal one-to-one and CARS rules could be revived through new rulemaking; the FCC's cross-channel revocation rule was delayed to Jan. 31, 2027; and courts are split on whether DNC text protections survive post-*McLaughlin v. McKesson* deference changes.
- Data-broker registration fee figures vary by source ($6,000 vs. $6,600); confirm the current CalPrivacy fee at registration.
- The TrueCar licensing question was never decided on the merits; the "pure lead-gen is unlicensed" position is well-supported but fact-specific — a written legal opinion is warranted before relying on it.
- State privacy-law counts and GPC-mandatory state lists differ slightly across trackers; verify against the IAPP tracker at implementation.

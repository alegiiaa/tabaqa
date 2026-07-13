# طبقة · Tabaqa — The Market-Gap Evidence Dossier

> **Purpose:** the "Norges-Bank move" — prove the market and the mechanism with the world's most
> conservative institutions, so the pitch borrows their credibility instead of asking for belief.
> **Every item below was verified against a fetched primary source (2026-07-04; extended and
> re-verified 2026-07-13).** Several famous numbers were CORRECTED in verification — the landmine
> list at the bottom is as important as the dossier itself. Use ONLY the numbers on this page.
> Companions: [`JUDGE_SCRIPT.md`](./JUDGE_SCRIPT.md) · [`PROOF.md`](./PROOF.md) · [`DATA_DEFENSE.md`](./DATA_DEFENSE.md)

> **2026-07-13 fold-in.** The Jul 8 research run (`app/RESEARCH-2026-07-08.md`) and the scale brief
> (`SCALE_STORY.md`) are now merged here: the **funding comparables** (Tier 2B), the **SAMA legal
> chain** for reading banks *and* wallets (Tier 5), and the **open-source licence map** (Tier 7).
> New this pass: **Tier 6 — behavior-priced finance is already live**, which is our answer to AMAD's
> 5th criterion, *قابلية التنفيذ الفعلي في القطاع المالي* ("can this really ship in a bank?").

## HOW TO READ THIS DOC — the honesty labels

Every claim carries its source **and** its verification status. No exceptions. If it has no label, it does not get said.

| Label | Meaning | How you may speak it |
|---|---|---|
| **[P]** | **PRIMARY-VERIFIED** — fetched from the body that owns the fact (regulator, registry, the paper itself, the company's own press release about itself) | State it as fact. |
| **[S]** | **SECONDARY** — reputable trade press, analyst house, or law firm | *"Industry research puts it at…"* — never as gospel, never as regulator data. |
| **[SR]** | **SELF-REPORTED** — a company's own marketing / impact number, unaudited | *"They report…"* — or don't say it at all. |
| **[X]** | **DO NOT SAY** — refuted, unverifiable, or licence-locked | Silence. |

**The rule that governs this file:** *every number is primary-verified, or it does not get said out loud.*
Its corollary — **refuse, don't guess** — applies to us on stage exactly as it applies to our adapters.

---

## THE LINE (Norges-Bank-style, for the pitch)

> **"أكثر المؤسسات تحفّظًا في التمويل عبرت هذا الجسر قبلنا: فاني ماي تعتمد ١٢ شهرًا من التدفق النقدي البنكي
> لتمويل من لا سجل لهم، والجهات الرقابية الأمريكية الخمس باركت بيانات التدفق النقدي في بيان مشترك،
> وبنك التسويات الدولية قاسها: 0.76 مقابل 0.64. لا نطلب من السعودية قفزة — نجلب كتاب لعبٍ مُثبتًا
> إلى السوق الوحيد الذي بنى للتوّ سكّته."**

> "The most conservative institutions in finance already crossed this bridge: Fannie Mae approves
> no-score borrowers on 12 months of bank-statement cash flow, all five US banking regulators
> jointly blessed cash-flow data, and the BIS measured transaction data beating bureau scores
> 0.76 to 0.64. We're not asking Saudi Arabia to take a leap — we're bringing a proven playbook
> to the one market that just built the rail for it."

## TOP 3 FOR THE 3-MINUTE PITCH

1. **Fannie Mae (Dec 2022)** — approves borrowers with **no credit score** using **12 months of bank-account cash flow**; its research: bank-statement cash flow is *"more predictive… especially for consumers with no or limited credit history."*
2. **BIS 0.76 vs 0.64** — the central bank of central banks measured transaction-data models vs bureau scores; bureau-only lending would have excluded **30% of good borrowers**. (Pairs with our own +0.203 ablation — we replicated a BIS-class result.)
3. **The Saudi wedge + the rail** — **78.8%** of Saudi adults banked (Findex 2024) vs **56.7%** with a credit file (World Bank) — a ~22-point wedge of banked-but-unscorable people — and **SAMA built the open-banking rail (2022) and issued its first licences (March 2026)**. Vision 2030's SME KPI (9.4% → 20%) demands the missing scoring layer.

**If the panel leans "can you actually build this in a bank?"** → the 4th weapon is **Tier 6**: Discovery Bank has priced credit on behaviour since 2019, 1.2M customers. *Category proven; Kingdom empty.*

---

## TIER 1 — Regulators · GSEs · Central Banks

| # | Source | The verified finding | Use for |
|---|--------|----------------------|---------|
| 1 | **FinRegLab — "The Use of Cash-Flow Data in Underwriting Credit: Empirical Research Findings"** (Jul 25, 2019). The canonical independent study: **6 non-bank lenders — Accion, Brigit, Kabbage, LendUp, Oportun, and _Petal_** — analysis conducted by **Charles River Associates**. | **[P]** — fact sheet read verbatim 2026-07-13. Four findings, in the source's own words: **① Predictiveness** — *"The predictiveness of the cash-flow scores and attributes was generally **at least as strong as** the traditional credit scores and credit bureau attributes studied."* **② Combined models** — cash-flow data *"separate[s] risk in somewhat different ways"* and *"frequently improved the ability to predict credit risk among borrowers that are scored by traditional systems as presenting similar risk of default"* — **across all traditional score bands.** **③ Inclusiveness** — among these lenders, **45–50%** of borrowers score below ~650. **④ Fair lending** — *"the cash-flow data appeared to provide **independent predictive value across all groups rather than acting as proxies for demographic group**."* Backdrop: **45–60M** Americans lack sufficient credit history, while *"**more than 96 percent** of American households have bank or prepaid accounts."* [Report](https://finreglab.org/research/the-use-of-cash-flow-data-in-underwriting-credit-empirical-research-findings/) · [Fact sheet (PDF)](https://finreglab.org/wp-content/uploads/2023/12/FinRegLab_2019-07-25_Fact-Sheet_The-Use-of-Cash-Flow-Data-in-Underwriting-Credit_Empirical-Research-Findings.pdf) | **THE data-layer anchor — the strongest citation in this file.** Cash flow predicts *at least as well* as a bureau score, adds *independent* signal, and is *not* a demographic proxy. **And read ③+backdrop together: >96% of US households are banked while 45–60M are unscorable — that is the US mirror of our Saudi wedge (#20).** The gap we're attacking isn't a Saudi quirk; it's structural, and America proved it first. |
| 23 | **FinRegLab — "Advancing the Credit Ecosystem: Machine Learning & Cash Flow Data in Consumer Underwriting"** (press release **Jul 1, 2025**) | **[P]** *"Overall, the machine learning model that combined cash flow and credit bureau data performed the strongest."* At risk cutoffs used by mainstream lenders, the two strongest ML models **increased approvals by ~4%** over simpler analytics. ⚠️ **Disclose the caveat — it is in the source:** *"data limitations made it difficult to evaluate impacts on consumers who are most likely to benefit because they have little or no traditional credit history."* [Press release](https://finreglab.org/press-releases/finreglab-study-finds-improvements-in-consumer-underwriting-and-credit-access-from-models-using-machine-learning-and-cash-flow-data/) | "**Cash flow + bureau together beats either alone** — FinRegLab, 2025." This is the citation for **fusion**, which is exactly what Tabaqa does (bank + wallet). ⚠️ Never claim FinRegLab *proved* the thin-file gain in the ML study — it says it **couldn't measure** it. Our own +0.203 / +0.117 ablations are where that evidence lives. |
| 2 | **Fannie Mae DU** (Aug 2021 + Dec 2022) | **[P]** 2021: rent from bank statements — **17%** of declined applicants would have been approved; <5% of renters have rent on file. 2022: **no-score borrowers underwritten on 12-month bank cash flow**. [2021](https://www.fanniemae.com/newsroom/fannie-mae-news/fannie-mae-introduces-new-underwriting-innovation-help-more-renters-become-homeowners) · [2022](https://www.fanniemae.com/newsroom/fannie-mae-news/enhancements-help-expand-homeownership-opportunities-underserved-borrowers) | THE conservative-institution anchor. |
| 3 | **Freddie Mac** (May+Jun 2022) | **[P]** Underwrites from bank-account data incl. **rent paid via Zelle/Venmo/PayPal**. [AIM](https://www.globenewswire.com/news-release/2022/05/26/2451493/0/en/Freddie-Mac-Announces-Automation-of-Key-Underwriting-Criteria.html) · [Rent](https://www.globenewswire.com/news-release/2022/06/29/2471417/0/en/Freddie-Mac-Takes-Further-Action-to-Help-Renters-Achieve-Homeownership.html) | "Both US mortgage giants read **wallet payments** as credit evidence." — the closest thing to a foreign precedent for our wallet layer. |
| 4 | **Five US regulators, joint statement** (Dec 2019) — Fed+CFPB+FDIC+NCUA+OCC | **[P]** Cash-flow data *"may present no greater risks than data traditionally used"*; cash-flow evaluation *"particularly beneficial"* for varied-income consumers. [Statement](https://www.federalreserve.gov/newsevents/pressreleases/bcreg20191203b.htm) | Underused gem: "all five US banking regulators jointly blessed exactly our data." |
| 5 | **Bank of England** (2019) | **[P]** Committed to an *"open platform for SME finance"* + **portable credit file** as national infrastructure. [BoE](https://www.bankofengland.co.uk/research/future-finance/champion-a-platform) | UK central-bank endorsement of the concept. |
| 6 | **CFPB §1033** (Oct 2024) ⚠️ | **[P]** US open-banking rule finalized — but **enjoined Oct 2025, being rewritten**. Statutory right (2010) stands. [Rule](https://www.consumerfinance.gov/about-us/newsroom/cfpb-finalizes-personal-financial-data-rights-rule-to-boost-competition-protect-privacy-and-give-families-more-choice-in-financial-services/) | Say: "finalized 2024, now being rewritten — direction settled, details not." NEVER "in effect." |
| 7 | **UK adoption (OBL/FCA)** | **[P]** **16.5M users · ~2B API calls/mo · 145 providers** (2025); FCA: payments +53% YoY. [OBL](https://www.openbanking.org.uk/news/open-banking-limited-marks-8-years-of-transforming-the-uks-financial-landscape/) · [FCA](https://www.fca.org.uk/news/news-stories/open-banking-2025-progress) | "Not a pilot — plumbing." |
| 8 | **Cambridge CCAF** (Nov 2024) | **[P]** **95 jurisdictions** with open banking/finance; 54 regulation-led. [Report](https://www.jbs.cam.ac.uk/faculty-research/centres/alternative-finance/publications/the-global-state-of-open-banking-and-open-finance-report/) | Global inevitability in one number. |

## TIER 2 — Big-Tech / Market Validation

| # | Source | The verified finding | Use for |
|---|--------|----------------------|---------|
| 9 | **Apple → Credit Kudos** (Mar 2022) | **[P]** UK open-banking credit scorer; Companies House shows the company is now literally **"Apple Payments Services Limited."** (Price ~$150M is press-only — don't state as fact.) [Registry](https://find-and-update.company-information.service.gov.uk/company/09873335) | "Apple didn't debate the thesis — it bought the company." |
| 10 | **Visa–Plaid $5.3B · Mastercard–Finicity $825M** (2020) | **[P]** Primary releases verified (Visa deal later terminated after DOJ suit — say "bid," not "bought"). Plaid today: 12,000 institutions, 1-in-2 US banked adults. [Visa](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.17586.html) · [Mastercard](https://investor.mastercard.com/investor-news/investor-news-details/2020/Mastercard-to-Acquire-Finicity-to-Advance-Open-Banking-Strategy/default.aspx) | "The giants priced this thesis years ago." |
| 11 | **Experian Boost** (US 2019 · UK **Nov 2020**) — ⚠️ **HANDLE WITH CARE, see the trap below** | **[P/SR]** Experian's own study of its own product (Feb 5, 2021): **60%** of people who completed Boost saw their **FICO Score rise, avg +12 pts**; starting **below 580 → 87% rose, avg +22 pts**; **thin-file → 85% rose, avg +19 pts**; **47% of previously *unscoreable* users built enough file to become scoreable.** By Jul 2021: 7M+ users, ~50M points added, **$1.7B** in credit accessed. [Study](https://www.experian.com/blogs/ask-experian/experian-boost-study/) · [Scale](https://www.experian.com/blogs/news/2021/07/06/financial-inclusion/) | **ONE legitimate use:** proof that **consumers will consent to share bank data when doing so can only help them.** It is **NOT** a product comparison. |
| 12 | **UltraFICO / FICO Score XD** | **[P]** FICO itself builds cash-flow scores (UltraFICO alive 2026, Plaid-connected; XD: **+15M newly scorable**). Limited distribution — use as concept proof, not scale. [UltraFICO](https://www.fico.com/ultrafico/) | "Even FICO hedged its own bureau moat with cash flow." |

> ### ⚠️ THE EXPERIAN BOOST TRAP — read this before you cite #11
> Boost is **consented bank data raising a _bureau_ score.** That is precisely the *"scoring company"* identity Tabaqa **pivoted away from on Jul 12.** Cite it as a **product analogy** and you walk straight into:
> > *"So you're Experian Boost for Saudi Arabia?"*
>
> — and you have just re-litigated our own pivot, on stage, for free, against ourselves.
>
> **The only sanctioned use — consent-willingness, nothing more:**
> > *"When sharing data can only help them, people share it: **47% of Experian's unscoreable users became scoreable.** Consent isn't the barrier. The barrier is that nobody in the Kingdom turns that consent into a **price**."*
>
> Then move **immediately** to the difference: Boost hands you a **better number and sends it to the bureau.** Tabaqa hands you **priced offers from competing lenders — and never touches a bureau.** Boost *feeds* the incumbent; Tabaqa *routes around* it.
>
> **Correction logged 2026-07-13:** this dossier previously said *"~90% of thin-file users gain instantly (avg 19 pts)."* The primary study says **85%** (avg +19). The 90% was never in the source. **Use 85%.**

### TIER 2B — The money: who funded *exactly* this thesis

**The one-breath line — never a precise category total:**
> **"Venture investors have put $200M+ into exactly this thesis — conservatively; ≈$285M across three companies alone."**

Then pivot instantly to Tabaqa. **We never pitch Nova, Lean, or anyone else** — comparables validate the category in one breath, and every other sentence is about us. No more names unless a judge asks.

| # | Source | The verified finding | Use for |
|---|--------|----------------------|---------|
| 24 | **Nova Credit — $45M Series C** (Oct 17, 2023) | **[P]** Canapi Ventures-led. The press release's own headline, verbatim: *"…to **Scale Cash Flow Underwriting**"* (the Cash Atlas product). Existing investors: General Catalyst, Index, Kleiner Perkins, Y Combinator. **Alive** — later raised a $35M Series D. Nuance: use of funds also covered geographic/product expansion, and the C was smaller than the $50M B (CEO framed it as dilution avoidance). [PR](https://www.novacredit.com/corporate-blog/nova-credit-raises-usd45m-series-c-financing-to-scale-cash-flow-underwriting) | The cleanest "a VC wrote a cheque for **this exact sentence**." |
| 25 | **Lean Technologies (Riyadh) — >$100M total** | **[P]** $3.5M seed (Jul 2020) + **$33M Series A** (Jan 2022 — **Sequoia India's Gulf debut**) + **$67.5M Series B** (Nov 11, 2024 — **General Catalyst's first-ever KSA investment**) = **$104M**. [PR](https://www.leantech.me/blog/lean-technologies-secures-67-5m-in-series-b-funding-led-by-general-catalyst-solidifying-its-position-as-the-leading-fintech-infrastructure-platform-in-the-middle-east) · [CNBC](https://www.cnbc.com/2022/01/20/sequoia-makes-middle-east-debut-with-33-million-investment-in-saudi-fintech.html) | "$100M+ of global capital is already building **the rail — in Riyadh**." ⚠️ **Framing discipline:** Lean is open-banking **infrastructure** (A2A payments + data APIs), **not a scoring company**. Say *"infrastructure enabling cash-flow underwriting."* **Lean is our supplier, not our competitor** — and saying so out loud is how we show we know the market. |
| 26 | **Petal — the mechanism scaled; the card business failed** | **[P]** **~400,000 consumers approved since 2018, the majority thin- or no-file at approval**, via cash-flow underwriting on customer-permissioned open-banking data (acquirer's PR, verbatim — ⚠️ the 400k is **[SR]**). $140M Series D Jan 2022 (~$800M valuation) → **distressed acquisition by Empower, announced Apr 9, 2024**, at a small fraction of that; card retired; acquirer rebranded to Tilt (2025). **Prism Data** (the 2021 scoring spinoff) survives, independent. Plaid case study: **30% lower roll rates vs bureau-only.** [PR](https://www.prnewswire.com/news-releases/empower-signs-definitive-agreement-to-acquire-petal-and-completes-acquisition-of-cashalo-to-accelerate-access-to-fair-credit-for-underserved-consumers-302111296.html) | **DISCLOSE PROACTIVELY — see the lesson below.** |

> ### 🎯 THE PETAL LESSON — say it before a judge finds it
> **Petal is one of the six lenders inside the FinRegLab study (#1).** The single best-funded US player proved the **mechanism** — 30% lower roll rates than bureau-only, ~400k thin-file approvals — and still **died as a card issuer**: it lent from **its own balance sheet**, with **no wallet fusion** and **no applicant-facing score.**
>
> **The line, volunteered — never extracted:**
> > *"The mechanism survived; the balance sheet didn't. So: **Tabaqa never lends** — we price, and lenders fund. **We fuse the wallet.** And **the number belongs to the applicant.** Three lessons, three design decisions."*
>
> This is the strongest available answer to *"what if you're wrong?"* — and it is **only** strong if **we** raise it first.

## TIER 3 — Academic / Central-Bank Research

| # | Source | The verified finding |
|---|--------|----------------------|
| 13 | **BIS WP 779** (2019) | **[P]** Mercado Libre: transaction-data ML **AUROC 0.76 vs 0.64** bureau-only; bureau-only lending would exclude **30%** of served borrowers. ⚠️ The famous "0.81 vs 0.71" is NOT in the paper. [BIS](https://www.bis.org/publ/work779.htm) |
| 14 | **BIS WP 881** — "Data vs collateral" (2020) | **[P]** 2M+ Chinese firms: big-tech credit reacts to transaction volumes, not collateral — *data replaces collateral*. [BIS](https://www.bis.org/publ/work881.htm) |
| 15 | **Berg et al., RFS 2020** | **[P]** Digital footprint **AUC 69.6% vs bureau 68.3%**; combined 73.6%. [Paper](https://www.fdic.gov/analysis/cfr/working-papers/2018/cfr-wp2018-04.pdf) |
| 16 | **IMF WP 2020/193** | **[P]** 1.8M MYbank loans: fintech model **AUC 0.84 vs 0.74** bank scorecard; **0.83 with ZERO credit history** — transaction data *replaces* the missing file. [IMF](https://www.elibrary.imf.org/view/journals/001/2020/193/article-A001-en.xml) |
| 17 | **Philadelphia Fed WP 17-17** (2017) | **[P]** LendingClub grade↔FICO correlation fell 80%→35% as alternative data took over; same-risk subprime borrowers got cheaper credit. [Fed](https://www.philadelphiafed.org/-/media/frbp/assets/working-papers/2017/wp17-17.pdf) |
| 18 | **Norges Bank transaction-data credit study** | **[X] DOES NOT EXIST** (5 searches, EN+NO). Never cite it — the viral Norges/NBIM story is about AI productivity, not credit. Use BIS/IMF for the central-bank slot. |

## TIER 4 — The Saudi Gap, Quantified

| # | Source | The verified finding |
|---|--------|----------------------|
| 19 | **SAMA Open Banking** | **[P]** Framework **Nov 2, 2022** (AIS v1, PIS v2); Lab launched **Jan 4, 2023**; sandbox TSP approvals (Lean, Feb 2025); **first open-banking licences issued March 26, 2026**. [Framework](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-794.aspx) · [Licensing](https://www.sama.gov.sa/en-US/MediaCenter/News/pages/news-1135.aspx) |
| 20 | **The wedge** | **[P]** Account ownership **78.84%** (Findex 2024) vs credit-bureau coverage **56.7%** (Doing Business 2020, last official figure; registry 0.0%). ≈ **22 points of banked-but-unscorable Saudis** ≈ **11 million people**. Q&A caveat: different vintages; DB discontinued 2021. [Findex](https://data.worldbank.org/indicator/FX.OWN.TOTL.ZS?locations=SA) · [DB2020](https://www.doingbusiness.org/content/dam/doingBusiness/country/s/saudi-arabia/SAU.pdf) |
| 21 | **FSDP SME KPI** | **[P]** 5.7% (2019) → target **20% by 2030**, interim 11% by 2025; **actual 9.4%** (Q4 2024, FSDP Annual Report on sama.gov.sa). IFC global MSME gap $5.2T (2025 update: $5.7T). [Charter](https://www.vision2030.gov.sa/media/ud5micju/fsdp_eng.pdf) |
| 22 | **CFPB credit invisibles** | **[P]** As published (2015): 26M invisible + 19M unscorable ≈ **45M Americans**. ⚠️ 2025 technical revision: 13.5M + 29.7M ≈ 43M combined — cite the ~45M combined figure, know the revision. [2015](https://www.consumerfinance.gov/about-us/newsroom/cfpb-report-finds-26-million-consumers-are-credit-invisible/) · [2025](https://files.consumerfinance.gov/f/documents/cfpb_update-credit-invisibles-estimate_2025-06.pdf) |

> **⚠️ Market sizing — what we do NOT have.** There is **no primary-verified figure** in this dossier for the
> size of the Saudi retail/personal-finance market. The **"SAR 1.4 trillion"** number circulating in our own
> notes is **[S] secondary at best** — see landmine **#14**. Do not reach for a market size. **The wedge (#20)
> and the FSDP KPI (#21) are primary, they are ours, and they are the stronger argument anyway**: we size the
> problem in *people who cannot be priced today*, not in riyals we cannot source.

---

## TIER 5 — The legal chain: reading banks **AND** wallets, in Saudi, legally

> The single question a banking judge is most likely to ask. We answer it with **article numbers**.
> Source unless noted: **Implementing Regulations of the Payments and Payment Services Law** (issued 13/6/2023, in force) — all articles read verbatim on the [SAMA rulebook](https://rulebook.sama.gov.sa/en/implementing-regulations-payments-and-payment-services-law).

| # | Article / fact | The verified finding |
|---|--------|----------------------|
| 27 | **Art. 6, item 10** | **[P]** *"Payment Account Information Services"* (AIS) is a **standalone licensable activity** — alongside payment initiation and e-money issuance. |
| 28 | **"Payment Account" is provider-agnostic** | **[P] + definitional inference.** Any account used to execute payment transactions; *"Payment Account Service Provider"* expressly ***includes but is not limited to*** licensed banks → **EMI wallets (urpay, Barq) and digital banks (stc bank, D360) fall inside AIS-readable scope by definitional chain** (mirrors the settled PSD2 reading). ⚠️ **Label it honestly if pressed:** the regs never *literally* say *"e-wallet = Payment Account."* **No source says bank-only** — but this leg is an **inference**, not a quote. Say so. That admission is cheaper than being caught. |
| 29 | **Art. 96(1)** | **[P]** Account providers **MUST** grant licensed AIS providers access on customer consent, on an *"objective, non-discriminatory and proportionate basis."* — i.e. **the bank cannot refuse us if the customer says yes.** |
| 30 | **Art. 23 / Art. 14 — our own on-ramp, priced** | **[P]** The PAIS licence carries a **SAR 20,000 issuance fee** (Art. 23) and — unlike major PI / major EMI / micro EMI — **no joint-stock-company requirement** (Art. 14). ⚠️ The regs are **silent on minimum capital**: never say *"no capital requirement."* |
| 31 | **First AIS licences issued** | **[P]** **March 26, 2026 — Neotek** ("New Technology for Software Solutions") **+ Lean Technologies Saudi Arabia**, per the **Saudi Press Agency**. Preceded by the SAMA regulatory sandbox, where Lean's AIS products served lending, insurance and marketplace clients (**~1M bank accounts verified — [SR]**, Lean's own figure). [SPA](https://www.spa.gov.sa/en/N2546774) |
| 32 | **Consent layer — SAMA policy + PDPL** | **[P]** SAMA's Open Banking Policy, verbatim: analysis of customers' financial-transaction data *"with customer consent — and offer tailored products"*; open banking *"will expand access to credit"*; the standard is *"explicit and informed consent."* Aligned with **PDPL Art. 24** (explicit consent for credit data; effective 14 Sep 2023, grace ended 14 Sep 2024). ⚠️ **REQUIRED SOFTENING:** this is **aspirational policy language.** Say **"explicit SAMA _policy endorsement_"** — **NEVER "regulatory blessing."** [Policy PDF](https://sama.gov.sa/en-US/Documents/Open_Banking_Policy-EN.pdf) |
| 33 | **Tarabut — the sandbox-to-certification datapoint** | **[P/S]** Sandbox test permit Nov 2022 (single-sourced to Tarabut's own PR) → **KSA Open Banking certification, May 30, 2023** (multi-sourced), launching AIS **inside the sandbox**. ⚠️ **Precision traps:** this was a framework-compliance **certification + sandbox operation — NOT a full licence** (those came Mar 2026); and *"among the first"* holds only as *first open-banking fintechs* — the SAMA sandbox has run since 2018 (45 permits by Q1 2023). [Tarabut](https://www.tarabut.com/blogs/post/tarabut-open-bankin-certified-sama) |

### The scale ladder — priced, dated, quotable

Every rung below is a row in the table above. This is the answer to *"how do you scale?"* — and to *"is this actually legal?"* — at the same time.

| Phase | Channel | Legal basis | Status |
|---|---|---|---|
| **Today** | Customer-uploaded statements (bank + wallet exports) | **PDPL explicit consent — no licence needed** | **In production** (`tabaqa.vercel.app`) |
| **Growth** | Plug into a licensed AIS aggregator as a client | **Art. 96** — providers *must* grant licensed access on consent | Rails licensed **Mar 2026**; our ingestion is **source-agnostic** → a new rail is an **adapter profile, not a rebuild** |
| **Scale** | Our own AIS (PAIS) licence | **Art. 23** — SAR 20,000, no joint-stock requirement | Priced, dated, quotable |

### 🎤 The judge-proof spoken answer (every beat maps to a verified row above)

> "Three consented channels connect banks and wallets. **First**, a SAMA-licensed AIS aggregator — the exact activity SAMA licensed for the first time on **March 26, 2026** (Neotek and Lean, after Lean verified ~1M accounts in the sandbox, including for lenders). **Second**, customer-permissioned statement upload, which our adapters parse today — legal under PDPL because the customer hands us **their own data** with explicit consent. **Third** is screen-scraping, which **we refuse** and the licensing regime is killing. Is it legal for **wallets** too? **Yes, by statute:** the Payments Law defines a Payment Account **provider-agnostically** — any account executing payment transactions, expressly *including but not limited to* banks — so **urpay and Barq** (EMIs) and **stc bank and D360** (digital banks) are in AIS scope, and **Article 96** obliges providers to grant licensed AIS access on customer consent. **Our own path:** the dedicated AIS licence costs **SAR 20,000**, with no joint-stock requirement — or we ride a licensed aggregator until then."

**Volunteer if pressed on wallet APIs:** the mandatory OB Framework APIs reached **banks** first — a live **wallet-API pull is a _rollout_ question**, which is exactly why the statement-upload channel we already shipped matters today.

---

## TIER 6 — "Can this actually ship in a bank?" — behavior-priced finance is **already live**

> **Why this tier exists.** AMAD's 5th criterion is **قابلية التنفيذ الفعلي في القطاع المالي** — *can this really run in the financial sector?* Our answer is not a promise or a roadmap. It is **products already in production, in regulated markets, with regulators watching and customers on the books.**
> **The category is proven. The Kingdom is the empty part.**

| # | Source | The verified finding | Use for |
|---|--------|----------------------|---------|
| 34 | **Discovery Bank (South Africa) — "Vitality Money"** | **[P]** **Behavior-priced banking, live since March 2019** (a licensed, digital-only retail bank), **~1.2M customers** (as of May 2025). Interest rates **flex monthly with financial behaviour**, measured across six behaviours (planning, savings, short-term debt, insurance, retirement, property). From discovery.co.za, verbatim: *"Up to **7% less** on your optional single credit facility,"* up to 5.25% on demand savings, up to 3.5% on everyday balances. **Your borrowing rate is a function of how you handle money.** EY's case study calls it *"the world's first behavio[u]ral bank"*; the UN's **UNSGSA (Queen Máxima)** profiled it (Jun 4, 2025). [Discovery](https://www.discovery.co.za/bank/vitality-money) · [EY](https://www.ey.com/en_za/insights/banking-capital-markets/how-the-worlds-first-behavioral-bank-is-focusing-on-customer-needs) · [UNSGSA](https://www.unsgsa.org/stories/making-healthy-choices-habit-discovery-banks-vitality-money-program-encourages-behavior-change-better-financial-health) | **THE feasibility anchor.** *"A licensed retail bank has priced credit on behaviour for **seven years**, for **1.2 million customers**. This isn't a hypothesis — it's a product with a P&L, a regulator, and a UN case study."* ⚠️ **Two hard rules before you open your mouth — see the box below.** |
| 35 | **Usage-based / telematics insurance** | **[S] — industry & market-research sources, NOT regulator data. Label them as such.** Consented behavioural data → a personalized price, **at scale, in a regulated industry**: **21M+ US policyholders shared telematics data with their insurer in 2024** (IoT Insurance Observatory, via insurance trade press; ~28% CAGR since 2018). **14.4% of personal-lines motor policies are telematics — _globally_** (Research & Markets / GlobeNewswire, Jun 13, 2025, from a 2024 consumer survey). ⚠️ **On discounts, tell the truth:** carriers advertise **10–30%+**, but the **Maryland Insurance Administration** (a state insurance *regulator*) found only **31% of enrolled drivers actually saw their premium go down in 2023**; the Consumer Federation of America calls the advertised savings *"a mirage for many drivers, or… highly exaggerated."* [GlobeNewswire](https://www.globenewswire.com/news-release/2025/06/13/3099019/0/en/Usage-Based-and-Telematics-Motor-Insurance-Report-2025-Telematics-Becomes-a-Consumer-Favorite-as-14-4-of-Policies-Now-Include-It.html) · [CFA](https://consumerfed.org/news/blogs/insurance-companies-claim-telematics-will-save-you-money-on-auto-insurance-the-truth-is-more-complicated/) | **The adoption is the point — not the discount.** *"Consented behavioural pricing is already normal: **21 million Americans hand their insurer their driving data** for a better price. We're doing the same for credit — except the applicant holds the consent, and the price comes back as an **offer**."* ⚠️ **If a judge pushes on the discount, concede it immediately** — *"advertised, not realized; a US state regulator found only 31% of drivers actually saved."* **The concession wins more than the number would have.** It also sets up our own rule: **we show a real price, not a teaser rate.** |
| (11) | **Experian Boost** — cross-reference only | **[P/SR]** **47% of previously unscoreable users became scoreable** once they consented to share bank data. | **Consent-willingness evidence ONLY.** Never a product analogy — see **the Experian Boost trap** at Tier 2. |

> ### ⚠️ NEVER SAY "FIRST IN THE WORLD"
> **Discovery Bank exists.** Behavioral pricing of credit is a **proven category** with a seven-year-old licensed bank and 1.2M customers sitting in it. Claim *"world-first"* and any judge who knows Discovery — or who has read the EY case study, or the UN's — has caught us **inflating**. And once we're caught inflating one number, **every other number we said gets re-examined.** That is how a winning deck loses a room.
>
> **The correct framing — and it is the stronger one anyway:**
> > **"The category is proven — Discovery Bank has priced credit on behaviour since 2019. What does not exist is a Saudi version: on Saudi rails, reading a Saudi **wallet**, in Arabic, handing the applicant **competing offers**. Category proven; Kingdom empty."**
>
> **AR:** «الفئة مُثبتة — بنك Discovery يُسعّر الائتمان على السلوك منذ ٢٠١٩. غير الموجود هو نسخة سعودية: على قنوات سعودية، تقرأ محفظة سعودية، بالعربية، وتُعطي المتقدّم **عروضًا متنافسة**. الفئة مُثبتة، والسوق السعودي فارغ.»
>
> **Why this reframe actively *raises* our feasibility score:** *"nobody has ever done this"* reads to a banking judge as **RISK**. *"This works in three markets; nobody has built it here"* reads as **EXECUTION**. We want to be the second sentence.

---

## TIER 7 — Open source: what we may cite, what we may build on, what we must **never** publish

| # | Repo / dataset | Verified status | Verdict |
|---|--------|----------------------|---------|
| 36 | **OBP-API** (OpenBankProject) | **[P]** THE citable open-source open-banking / AIS server (Open Banking / XS2A / PSD2 / Open Finance; ships sandbox data import; real bank sandboxes built on it — Danske, BNP Paribas, OP). Active (~1.7k stars, Scala). **Dual-licensed AGPL v3 / commercial (TESOBE GmbH)** — hosting a *modified* instance triggers **AGPL network copyleft**. [Repo](https://github.com/OpenBankProject/OBP-API) | **CITE as prior art. NEVER embed.** |
| 37 | **toad** (amphibian-dev) | **[P]** **MIT** — licence verified via three independent primary artifacts (GitHub API SPDX field, LICENSE file, setup.py). Python credit-scorecard toolkit, actively maintained. [Repo](https://github.com/amphibian-dev/toad) | **Safe to build on.** Complements our scorecardpy / OptBinning stack. |
| 38 | **bankstatementparser** | **[P]** Apache-2.0. Parses CAMT.053 / ISO 20022, PAIN.001, CSV, OFX/QFX, MT940 + digital and scanned PDFs into a unified Transaction model — **the closest open-source comparable to our adapter layer.** **README grep for `arabic\|rtl\|عرب` returned ZERO hits.** [Repo](https://github.com/sebastienrousseau/bankstatementparser) | **The Arabic/RTL/Hijri gap is UNCONTESTED — and now _verified_, not assumed.** We may say *"we checked."* ⚠️ Don't oversell it as a mature rival (33 stars, v0.0.x), and be honest that its LLM/vision PDF path *could* incidentally read an Arabic PDF — but **nothing in it targets Arabic headers, Hijri dates, or RTL.** |
| 39 | **Kaggle — Home Credit Default Risk** | **[P]** Rules read verbatim: a competition-specific override supersedes General Rule 7.A (*"only for the purposes of the Competition"* — stripping the usual academic carve-out), and **Rule 7.B separately bans transmitting / duplicating / publishing / redistributing** the data. Third-party GitHub and paper usage reflects **non-compliance, not permission.** [Rules](https://www.kaggle.com/competitions/home-credit-default-risk/rules) | **🚫 DOUBLY LOCKED — NEVER in the deck, the demo, the repo, or a sentence.** Our external validity comes from Berka + UCI + AlfaBattle instead. |

---

## ⚠️ THE LANDMINE LIST — corrections that save you in Q&A

### A · Numbers that circulate widely and are WRONG (we verified the primary sources)

1. **BIS is 0.76 vs 0.64** — not "0.81 vs 0.71."
2. **Saudi account ownership is 78.8%** (Findex 2024) — not "90%+."
3. **CFPB 1033 is NOT in effect** — finalized Oct 2024, enjoined Oct 2025, being rewritten.
4. **No Norges Bank credit study exists** — the viral story is NBIM + AI productivity.
5. **Experian Boost UK launched Nov 2020** — not 2022.
6. **Lean's SAMA licence is March 2026** — not Jan 2024.
7. **Apple/Credit Kudos price is press-reported** — the registry rename to "Apple Payments Services Limited" is the bulletproof fact.
8. **Visa "bid" $5.3B for Plaid** — deal terminated after DOJ suit; never say "bought."
9. **Experian Boost thin-file gain is 85%** (avg +19 pts) — **not "~90%."** *(Our own error, caught and corrected 2026-07-13. The 90% was never in Experian's study.)*
10. **Telematics: "~20% of US auto policies" is NOT VERIFIED — do not say it.** ⚫ The **14.4%** figure is **global** personal-lines motor policies, and the separate **20.9%** is *global* customers with a *pay-as-you-go* policy — **a different metric, and not US.** Conflating them is how the "~20% of US policies" line was born. **What IS supportable [S]:** *"21M+ US policyholders shared telematics data with their insurer in 2024."* Use that, and label it industry research.
11. **Telematics discounts are ADVERTISED, not realized.** "10–30% off" is a *maximum*, not a typical outcome — the **Maryland Insurance Administration** found only **31% of enrolled drivers saw any decrease (2023)**. Say *"advertised up to 30%; a state regulator found most drivers didn't actually save"* — and let the honesty do the work.

### B · 🔴 Numbers that are REAL but NOT OURS TO QUOTE (self-reported / unaudited)

12. **🚫 Discovery Bank's *"Diamond-status customers are 97% less likely to be in arrears"* — DO NOT QUOTE.**
    It is **Discovery's own marketing number, unaudited.** It appears in the UN/UNSGSA feature — but the UN is *repeating Discovery*, not verifying it: every statistic there is attributed to Discovery Bank itself, with no independent source. **Repeating it unverified breaks our own evidence rule** — the one rule this entire document exists to enforce. **DO NOT QUOTE unless primary-verified.**
    **Bonus reason to leave it alone:** it is almost certainly a **selection effect**, not a treatment effect. Customers who *reach* Diamond status are different people from those who don't — the number tells you who they already were, not what the product did to them. A sharp banking judge will say exactly that, and if we're the ones who put the number on the slide, **we lose the whole Data axis in one sentence.** Cite Discovery for **the mechanism being live** (#34), never for its size.
13. **Petal's ~400k approvals** and **Lean's ~1M verified accounts** are **company PR figures** — consistent across independent coverage, but **unaudited**. Say *"they report…"*.
14. **⚫ "KSA retail + personal finance ≈ SAR 1.4 trillion" — DEMOTED. Do not present this as a fact.**
    Its trail is **Ken Research → a WordPress blog** — i.e. **secondary at best, and the chain of custody is a blog.** It has **no place in a dossier whose entire claim to authority is primary verification.** It currently survives, correctly labelled as an estimate, in `app/PRICING_ENGINE.md` — **it does not survive here, and it never goes on a slide or into a sentence spoken to a judge.**
    **If you are asked to size the market, don't guess — refuse and redirect:** *"I won't quote a market size I can't source. What I can source: **78.8% of Saudi adults are banked, 56.7% have a credit file** — about **11 million people who cannot be priced today** — and Vision 2030's own KPI moves fintech's share from **9.4% to 20%**."* **That is a better answer than the trillion.** (This *is* "refuse, don't guess," applied to us.)

### C · 🗣️ Words that get us caught

15. **NEVER "first in the world"** / "world's first" about behavioral pricing — **Discovery Bank exists** (see Tier 6). Say **"category proven, Kingdom empty."**
16. **NEVER "regulatory blessing"** for data analysis — SAMA's policy language is aspirational. Say **"explicit SAMA _policy endorsement_."**
17. **NEVER "no capital requirement"** for the PAIS licence — the regs are **silent** on capital. Say **"SAR 20,000 issuance fee, no joint-stock requirement."**
18. **NEVER call stc bank / D360 "wallets" or "EMIs"** — they are **licensed digital banks**. The EMI wallet examples are **urpay** and **Barq**.
19. **NEVER cite the Jan-2021 SAMA OB Policy** for dates or scope — go-live slipped and it contains **zero** AIS/wallet/EMI content (full-PDF grep). Cite the **Nov 2022 Framework + the 2023 Implementing Regulations**.
20. **NEVER say Tarabut was "licensed"** or name its certification category ("AIS Retail Provider" is **unconfirmed**). Say **"KSA Open Banking certification (May 2023), operating AIS in the sandbox."**
21. **NEVER state a precise category funding total.** Say **"$200M+ into exactly this thesis — conservatively."**
22. **NEVER cite TomoCredit as a success comparable** — the bureaus **cut off its reporting access in Oct 2024**; unpaid-bill lawsuits; a Feb 2026 Forbes exposé of its credit-boosting service. Omit it, or use it only as a cautionary tale.
23. **NEVER claim FinRegLab's 2025 ML study proved the thin-file gain** — the report says the opposite: *"data limitations made it difficult to evaluate impacts on consumers who are most likely to benefit."* Our **own** ablations are where that evidence lives.
24. **NEVER claim bankstatementparser "uses Plaid's 13-category schema"** — REFUTED. Don't use that repo to argue the Plaid taxonomy is a de-facto standard.
25. **NEVER cross-quote our own lift numbers.** **Berka +0.203** = statement-like features; **AlfaBattle +0.117** = the mechanism at scale on a card stream. They are **different experiments** — quote each in its own context, never merged into one number.

### D · 🚫 Data we must never publish

26. **Kaggle Home Credit Default Risk** — doubly licence-locked (see #39). Never in the deck, the demo, the repo, or a sentence.

---

## ⚠️ STANDING CAVEATS — the things only time can fix (disclose them; don't be caught by them)

- **Wallet-in-scope is a definitional-chain inference.** The Payments Law defines "Payment Account" provider-agnostically and Art. 96 imposes the access duty — but **no source literally says "e-wallet = Payment Account."** No source says bank-only either. **If pressed: say it's an inference, and say why it's the settled PSD2 reading.**
- **Live wallet-API pull is a rollout question.** The mandatory OB Framework APIs reached **banks** first. This is precisely why our **statement-upload channel** exists and is in production today.
- **Self-reported figures** (Petal ~400k, Lean ~1M, every Discovery statistic) are unaudited. Prefix with *"they report."*
- **Cold-start honesty line — rehearse it, and volunteer it:**
  > *"Our score is **mechanism-validated on a million foreign outcomes** and **not yet Saudi-calibrated**. We know that. The pilot's retro-validation closes it in 60 days."*

*Created 2026-07-04 from a 5-agent adversarially-verified research pass.*
*Extended 2026-07-13: folded in `app/RESEARCH-2026-07-08.md` (109-agent run, 23 primary-verified claims) + `SCALE_STORY.md`; added Tier 6 (behavior-priced finance, live) and Tier 7 (open-source licence map); corrected the Experian thin-file figure; demoted the SAR 1.4T market size. Primary URLs inline.*

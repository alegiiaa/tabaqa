# طبقة · Tabaqa — Team Brief

> **The whole project in one short read (~10 min).** Glossary at the end — any confusing
> word is explained there. Insider version: `NORTHSTAR.md`. Full pitch script: `JUDGE_SCRIPT.md`.

---

## 1 · The idea in 60 seconds

**Fahd, 26, delivery driver in Riyadh.** Bank salary: SAR 4,000/month. No credit card, no
loan ever → **no SIMAH file** → every financing application: instant decline. Not because
he's risky — because he's *invisible*.

But Fahd actually earns ~**SAR 10,000**. The other 6,000 flows through his digital wallet —
delivery earnings, transfers. Real, weekly, verifiable money that **no bank looks at**.

**~11 million Saudi adults are in Fahd's position**: banked (79% of adults) but with no
credit file (barely 57% have one). Their financial lives exist as data — the system just
doesn't read it.

**Tabaqa (طبقة = "layer") is a financing marketplace powered by its own scoring engine.**
With consent (Nafath + per-source approval), we read bank statements *and* wallet activity
(stc pay, urpay, D360…), fuse them into one verified money picture, and run every lender's
**published product policy** against it. What the customer gets:

1. **A marketplace where the offers change when his income becomes visible** — search car
   financing on bank-only income: **0 full offers**. Add the wallet: **4 offers**, ranked,
   best one framed green. Same engine, same SAMA rules; the only difference is what the
   system can see. He picks — for the first time, *he* chooses the bank.
2. **A locked offer that names its price** — not "declined" but *"you're 11 points away,
   and here are your steps."* The score faces the applicant: why, what changes it, whether
   his data is enough. Nobody in the Gulf does this; almost nobody on earth.
3. **An application package the lender can file** — SAMA affordability computed live + a
   printable, QR-verifiable compliance receipt attached to every application. The lender
   pre-qualifies faster — and the licensed lender always makes the final call.

**Tagline: "The marketplace that sees your real income."** Live now, no signup →
**https://tabaqa.vercel.app/demo** → التمويل — watch Fahd's income climb 4,000 → 10,000 and
his offers go **0 → 4** in 40 seconds.

---

## 2 · The market gap & why *now* (4 forces, 4 numbers)

| Force | Number | What it means for us |
|---|---|---|
| **Gap** — who's locked out | 79% banked vs ~57% with a credit file → **~11M people** | The data already exists; we only read it. The product can exist *today*. |
| **Demand** — someone pays | **Tamara: +32% approvals** after bank-linking | A competitor proved the mechanism makes money in KSA. We never argue "would it work?" — only show what they didn't build. |
| **Rail** — regulation arrived | SAMA open-banking licences: **March 2026** | Three months ago this was undeployable at scale. First-mover window, measured in months. |
| **Pull** — the state needs it | FSDP SME-lending KPI: **9.4% today vs 20% by 2030** | A missed Vision-2030 target our host bank is measured against. We align with it. |

**One breath:** *11M invisible people + proven +32% commercial lift + a rail switched on in
March + a national KPI missing its target = one empty lane: nobody fuses wallet + bank, and
nobody faces the applicant.*

---

## 3 · The numbers arsenal — what each buys us + how much دليل

Grades: 🟢 primary source verified by us · 🔵 **our own measurement on real data (we can *show* it live)** · 🟡 company-published (say "they report…").

| Number | What it buys us | Where it strikes | دليل |
|---|---|---|---|
| **4,000→10,000 · 82 · 40 sec** | The whole product in 3 numbers a judge retells at dinner | The live reveal | 🔵 |
| **11M unscorable Saudis** | Market size in one breath | Pitch opening | 🟢 Findex '24 + bureau coverage |
| **Tamara +32%** | Turns our biggest competitor into our market proof | Innovation Q&A (most likely question) | 🟡 Lean case study |
| **+0.20 AUC on real defaults** | Our science: wallet layer takes prediction from near-coin-flip to strong | Trust minute — **the ONE stat we speak** | 🔵 real Czech bank defaults |
| **Zero lift (negative control)** | The honesty weapon: we published a test *against* ourselves — it returned zero, as it should | When anyone doubts the numbers | 🔵 published in-product |
| **963,811 real applications** | The effect survives industrial scale | Model card / hard Q&A | 🔵 |
| **7.6% → 2.9% defaults (−61%)** | The banker's ROI — same approvals, less than half the losses. Why a bank *pays* | Feasibility | 🔵 |
| **BIS 0.76 vs 0.64 · Fannie Mae no-score lending** | Independent + conservative-institution blessing: not a startup fantasy | Q&A armor (never the opener) | 🟢 [BIS WP779](https://www.bis.org/publ/work779.htm) · [Fannie Mae](https://www.fanniemae.com/newsroom/fannie-mae-news/enhancements-help-expand-homeownership-opportunities-underserved-borrowers) |
| **5 lines of API** | Integration is an afternoon, not a project | The artifact moment | 🔵 live sandbox |

**Total دليل:** 22 external references, each verified against the *primary* source + **3
replications on real borrower data run by ourselves** + a landmine list of famous-but-wrong
numbers nobody on this team ever cites. Stronger evidence than most funded fintechs show
investors. **Team rule: a number not in this table doesn't get spoken.**

---

## 4 · The five judging criteria — what we serve each one

| Criterion — the judge's real question | What we show | The key move |
|---|---|---|
| **① Innovation** — "new, or the 10th clone today?" | The live 0→4 offers reveal — the only marketplace where the *number of offers changes* when your wallet becomes visible — plus locked offers that tell you how to unlock them. After scanning ~40 products: aggregators serve salary+SIMAH customers; every scoring implementation is a black box inside one lender; none fuses wallet+bank. | ⚠️ Never say "nobody does cash-flow in KSA" (Tamara does) or "no aggregators exist" (licensed ones do). Say: *"Incumbents distribute offers to the visible; we make the invisible fundable — then distribute."* |
| **② Technical** — "does it actually run?" | Judges drive it themselves: live app ([/demo](https://tabaqa.vercel.app/demo)) · real API + sandbox keys ([tabaqa-api.vercel.app](https://tabaqa-api.vercel.app), [/developers](https://tabaqa.vercel.app/developers)) · **ALLaM** (Saudi national AI) writing credit narratives in production · Arabic/English/Hijri ingestion · zero-dependency offline pipeline (wifi insurance). | Most teams show tape-and-glue prototypes; we hand judges working keys. |
| **③ Data** — "real analysis or 'we used AI'?" | The in-app model card: **3 real-default datasets, 3 countries** — Czech (+0.20 AUC), Taiwan (our zero-result honesty test, self-published), Russia (963k apps, holds at scale) + independent literature ([FinRegLab](https://finreglab.org/research/the-use-of-cash-flow-data-in-underwriting-credit-empirical-research-findings/), BIS, [IMF](https://www.elibrary.imf.org/view/journals/001/2020/193/article-A001-en.xml)). | Speak **at most one** stat aloud; rigor lives on screen and in Q&A. Demos win judges, numbers lose them. |
| **④ UX** — "does it feel like a real product?" | Arabic-first RTL, Hijri-native ledger, animated reveal, tap-any-number tooltips, never flickers "broken", works on a phone, printed Arabic report + QR verify. | Saudi judges *feel* Arabic quality instantly. This is our current sprint until Jul 15. |
| **⑤ Feasibility** — "could Alinma deploy Monday?" | The printed **compliance receipt** in the judge's hand (QR → live verify page on *their* phone) · SAMA DBR caps enforced in-engine · **no new licence needed** (data-processor inside the bank, read-only, on consent — [SAMA framework](https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-794.aspx)) · ROI −61% bad rate · per-decision API pricing · moves the [FSDP KPI](https://www.vision2030.gov.sa/media/ud5micju/fsdp_eng.pdf). | The judge physically holds feasibility; their phone becomes part of the demo. |

---

## 5 · The 3-minute pitch = a magic trick in 3 acts

**Act 1 — the trap (30s).** "Welcome to the credit committee. One file: Fahd, 4,000 salary,
no history. Who approves him?" *Silence.* Nobody. **The judges just declined him themselves** —
now they're inside the story. "So does every bank — and 11 million Saudis are Fahd."

**Act 2 — the flip (60s).** Live app, no slides: Fahd searches car financing → on bank-only
income **0 full offers** → connect the wallet → income climbs to 10,000 with verification
stamps → **4 offers appear, ranked, best framed green** → SAMA caps green on every card.
Their own decision, reversed in front of them in 40 seconds — and now *Fahd* chooses the
bank. One tap: every number has a reason.

**Act 3 — proof in their hands (60s).** Three trust points, three breaths (real-default
validation +0.20 · Fannie Mae already lends this way · calibrated to official Saudi
statistics). Fahd taps Apply — the application package appears with its compliance receipt.
Hand the head judge the printed receipt: *"Scan the code"* → live verify page opens **on the
judge's phone**. Close: *"Fahd didn't change today — the market finally saw him. We ask one
thing: a partner lender for the first pilot."*

No statistics lecture, no architecture slides. Judges *experience* the product.

---

## 6 · Mini-glossary

| Term | Meaning |
|---|---|
| **SIMAH / thin-file** | Saudi credit bureau / a person with no usable credit history — our whole market |
| **Open banking · AIS** | Consent-based bank-data sharing via SAMA-licensed APIs; AIS = read-only (we never move money) |
| **Cash-flow underwriting** | Scoring from how money actually moves (income regularity, balances, discipline) instead of past loans |
| **AUC** | Model accuracy: 0.5 = coin flip, 1.0 = perfect. "+0.20 lift" ≈ from ~66% to ~86% correct risk-ranking |
| **Negative control** | A test built to return zero if your method is honest. Ours did — and we published it |
| **DBR** | SAMA's cap on debt payments as a share of income; enforced inside our engine |
| **ALLaM** | The Saudi national Arabic LLM — writes our credit narratives, live on our server |
| **The reveal** | Our signature moment: bank-only DECLINE → add wallet → APPROVE, animated |

---

## 7 · The four forbidden sentences (they destroy credibility — corrected versions only)

| ❌ Never say | ✅ Say instead |
|---|---|
| "He just enters his ID and we pull all his data" | "He authenticates via **Nafath** and gives **explicit consent per data source**" |
| "Health data from Sehhaty / security data from Absher" | Sources are three, full stop: **banks, wallets, GOSI** |
| "Each bank gives us its private formula" | "Lenders **publish product criteria** (rates, tenors, caps) — or answer with a **pre-approval API**" |
| "Rejections are near zero; the bank's approval is a formality" | "**Pre-qualified** offers with high conversion — the **licensed lender always makes the final decision**" |

---

## 8 · How you can help this week

1. **Break the demo** — open [/demo](https://tabaqa.vercel.app/demo) on your phone, in Arabic; every confusion you find before Jul 10 is a point saved.
2. **Play the mean judge** — read §5, make someone pitch you, ask the hardest question you can.
3. **Stopwatch it** — new applicant → score must be under 60 seconds; report anything slow.

*2026-07-06 · Rewritten 2026-07-12 (marketplace pivot, commit `bca75e7`) · AMAD ed.2: July 16–18 (Alinma × Tuwaiq), SAR 500K prizes.*

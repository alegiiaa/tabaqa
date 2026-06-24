# طبقة · Tabaqa — "We are not Lean." (Pitch & Q&A battle-card)

> Use this on stage and in judge Q&A. Jobs: end *"this is just Lean for wallets,"* *"Lean / SiFi already solved this,"* and *"you're just an AI data-processing layer"* — the last two are killed in **§2½**.
> **Lean is the pipe. Tabaqa is the answer.** · لين هي الأنبوب. طبقة هي الإجابة.

---

## 0. The 12-second kill

> **EN —** "Lean answers *'what's in your bank account?'* Tabaqa answers *'what is this person's real, verified monthly income — across bank **and** wallet — cleaned, attributed, and proof-tagged?'* Lean reads the 23 banks. It does **not** open the wallet. We do. And we don't compete with Lean — we sit **on top** of it."
>
> **AR —** «لين تجاوب على *وش في حسابك البنكي؟* — طبقة تجاوب على *وش الدخل الحقيقي المتحقَّق لهذا الشخص، من البنك **والمحفظة**، بعد تنظيفه ونسبته لصاحبه وإثبات مصدره؟* لين تقرأ الـ ٢٣ بنكًا، وما تفتح المحفظة. إحنا نفتحها. وما ننافس لين — نجلس **فوقها**.»

---

## 1. The one diagram (draw this if asked)

```
            consumer apps / lenders / BNPL / banks
                            ▲
        ┌───────────────────┴───────────────────┐
        │      طبقة · TABAQA  — INTELLIGENCE      │  ← reconcile · attribute · verify (Masdr) · clean (Arabic)
        │   "one verified income picture"         │
        └───────────────────┬───────────────────┘
              ▲                              ▲
   ┌──────────┴──────────┐       ┌───────────┴───────────┐
   │  Lean / Tarabut     │       │   Wallet layer (EMIs)  │
   │  THE PIPE (AIS)     │       │   Barq · urpay · …     │
   │  reads the 23 banks │       │   NOT an OB pipe yet    │
   └─────────────────────┘       └────────────────────────┘
```

Lean fills the **left pipe**. The **right pipe doesn't exist in open banking yet** (see §4). Tabaqa is the **box on top** — and it's the box that turns raw bytes into *underwritable income*, no matter which pipe feeds it.

---

## 2. What Lean actually is (so we're accurate, not dismissive)

- First **SAMA open-banking licensee** (Mar 2026). Its open-banking **data** product is **AIS** — it reads the **23 licensed banks'** account + transaction data on consent. (Markets pay-by-bank too; irrelevant to us — we do **no payments**.)
- Lean lists **"Digital Wallets"** as an industry it serves. ⚠️ Read this precisely: wallet companies are Lean's **customers** — they use Lean so a user can **top up / verify a bank account**. **Lean does not expose a wallet's internal per-user ledger as a data product.** *(Verified: neither Lean nor Tarabut touch wallet data — `docs/research/15`, `docs/research/04`.)*
- Tarabut is the same shape: AIS aggregator with **Categorization + Income/Account Verification** — **on bank data, generic, no wallet, no Masdr provenance.**

**So the honest summary:** Lean/Tarabut are excellent **bank-data infrastructure**. The wallet ledger and the verified-income *answer* are simply **not what they sell.**

---

## 2½ · "Lean / SiFi already solved this" — the pipe-vs-decision kill

> **The real objection (paraphrased from a judge):** *"Lean, SiFi, and many companies already solve this. Today you're just an **AI layer for data processing** — what proves there's a need for it?"*
> **The 1-line kill:** *"Those companies sell **data, pipes, spend-control, or a bureau score**. We sell a **decision**. Having the pipe is not having the score — everywhere in the world that's a separate, separately-paid product."*

**First — refuse the frame.** We are **not** "an AI layer that processes data." Enrichment (Drahim / Tarabut Categorization) already processes data. **Tabaqa outputs a *decision*:** a verified income figure **+** a 1–99 cash-flow PD score **+** an APPROVE / REVIEW / DECLINE financing line. Processing is the *means*; the **decision** is the *product*.

**Second — the named players don't ship that decision.** What each actually outputs:

| Player | What it actually outputs | Category |
|---|---|---|
| **Lean** | Open-banking APIs — data access, balances, transactions, categorization, account/income verification, payments. Calls itself "financial infrastructure"; partners (Tabby, Tamara) run their **own** underwriting on top. | **pipe / data** |
| **SiFi** | **B2B corporate spend-management** — corporate cards, expense workflows, e-wallet for businesses. **EMI-licensed**, 5,000+ *business* customers, $34M+ raised. **No consumer credit, scoring, or income-verification product at all.** | **spend-mgmt** |
| **Tarabut** | Open-banking connectivity + data (categorization, income verification). "Intelligent decisioning" is **roadmap** — it acquired Servable.dev (31 Jan 2026) to *start* building it. | **pipe / data** (decision = future) |
| **Drahim** | Consumer PFM — budgeting, categorization, auto-investing. 65% bought by Al Rajhi (Sep 2024). No PD / credit decision. | **data / PFM** |
| **SIMAH** | National bureau — a **history-based** score (MOLIM, 300–850) on loans/cards/repayment. Structurally **blind** to thin-file / credit-invisible / wallet-income earners. | **bureau** |

**None ships a productized consumer cash-flow PD decision — least of all one that includes wallet income.** That is the unbuilt lane Tabaqa occupies.

**Third — the SiFi judo (use it).** SiFi is itself an **EMI** — the very category that *holds* wallet ledgers — and it *still* outputs **zero** credit decisions. That's the whole thesis in miniature: **holding the data, even *being* the wallet, is not the same as turning it into an underwriting answer.**

**Fourth — pipe-vs-decision is the global market structure, not our invention:**
- **Pipes:** Plaid, Tink, TrueLayer — connectivity, not the decision.
- **Decision layers on top:** **Prism Data CashScore®** ("predicts probability of default from deposit-account data, not credit history") ships *through* Plaid / Equifax; **FICO cash-flow UltraFICO** (Nov 2025) pairs FICO's model with Plaid's data; **Experian's Cashflow Score** (2025) — Experian itself calls the data and the decisioning *"complementary but distinct."*
- Different products, different buyers: the **pipe** is bought by a data/engineering team; the **PD score** by a credit/risk officer.

> **So "we have open banking, therefore cash-flow scoring is solved" is a false equivalence.** Open banking *moves the data*. Someone still has to build **attribution → model → decision** on top — which is exactly why FICO, Experian and Prism are *separate companies riding on Plaid*, not absorbed by it. In KSA that decision layer — **with wallet income** — is unbuilt. **That's us.**

*Sources: [sifi.app](https://www.sifi.app/en) · [TechCrunch — SiFi $10M seed (2024-06-03)](https://techcrunch.com/2024/06/03/sifi-raises-10m-seed/) · [leantech.me](https://www.leantech.me/) · [Tarabut × Servable (2026-01-31)](https://www.tarabut.com/blogs/post/tarabut-acquires-bahrain-founded-ai-platform-servable) · [Al Rajhi × Drahim (2024-09)](https://www.alrajhibank.com.sa/en/About-alrajhi-bank/Media-Center/2024/Drahim) · [SIMAH Scoring](https://www.simah.com/en/products/services/pages/simah-scoring.aspx) · [Prism Data CashScore](https://www.prismdata.com/cashscore/) · [FICO + Plaid (American Banker, 2025-11)](https://www.americanbanker.com/news/fico-upgrades-its-cashflow-powered-score-with-real-time-data) · [Experian Cashflow Score (2025)](https://www.experianplc.com/newsroom/press-releases/2025/launch-of-experian-s-cashflow-score-signals-new-era-of-open-bank).*

---

## 3. The four things we do that the pipe structurally does not

| # | Tabaqa USP | Why Lean/Tarabut don't do it |
|---|---|---|
| **1** | **Wallet-layer attribution** — turn one opaque, safeguarded e-money pool into *per-human* income | They read **banks**; the wallet's internal ledger isn't their product |
| **2** | **Bank ↔ wallet reconciliation** — a bank→Barq transfer = money **moved**, not **spent** → never double-counted | They return one stream (bank); there's no second (wallet) stream to merge |
| **3** | **Masdr/Mofeed verification + 3-tier provenance** — `✓ amount-verified` (salary↔Payslip) / `✓ source-verified` (payer↔Establishment) / `~ inferred` | They return data, not **verified income with proof-strength** |
| **4** | **Saudi-Arabic transaction cleaning** — `تحويل برق ٨٨٤٢ / JAHEZ-RYD` → `{Jahez, gig_income}` | Their categorization is generic, not Saudi-Arabic-merchant grade |

**Moat = the compound:** Arabic cleaning **×** wallet attribution **×** Masdr ground-truth **×** an entity-graph that improves with volume. No incumbent has all four.

---

## 4. The regulatory truth that *makes* the gap real (don't dodge this)

- Under SAMA's live open-banking regime: **32 licensed payment companies, 0 EMIs.** Wallets (EMIs) are **not open-banking data providers today.** *(Verified — `docs/research/15:170-171`.)*
- That's **why Lean can't just add wallets**: it's not a feature they forgot — the **rail to wallet data doesn't exist in OB scope yet.**
- ⚠️ **Be precise on the mechanism** (a sharp judge will test you):
  - ❌ Don't say *"wallets give no IBAN."* They do now (Barq/urpay issue virtual IBANs; **STC Pay even graduated into STC *Bank***).
  - ✅ Do say: *"A wallet is an **EMI** — it safeguards customer e-money at a sponsor bank, and the **per-user attribution lives only in the wallet's own ledger**. A virtual IBAN doesn't make the EMI an open-banking data provider. So even a user with a Barq IBAN can't have their wallet income pulled via AIS."*
- **Tailwind, not threat:** SAMA's open-finance roadmap explicitly extends the ecosystem **to e-money issuers**. Wallet data **will** flow. **Tabaqa is the intelligence layer that's needed the moment it does — and we prove it now on consented data.** We're *ahead of go-live*, not against it.

---

## 5. "Lean is a channel, not a rival" (the move that flips the room)

We don't displace the pipe — we **consume** it and **resell intelligence on top** (B2B2B):

> "We take Lean's bank feed, add the wallet layer + Masdr verification + Arabic cleaning, and hand lenders a **verified income answer**. Lean is our **supplier and our distribution** — every Lean customer who needs *real income, not raw lines* is our customer."

This converts the scariest competitor into the largest channel.

---

## 6. The proof Lean cannot produce (the demo = the argument)

> Bank-only view (what Lean returns): **Fahd = SAR 4,000 salary**, money "vanishing into Barq" → **DECLINE.**
> Tabaqa view: **SAR 10,000** real income — `4,000` salary `✓ amount-verified` + `5,200` gig (Jahez/HungerStation) `✓ source-verified` + `800` P2P `~ inferred`; the "Barq" outflow **reconciled** as internal movement, **not** double-counted → **APPROVE.**

Lean's pipe literally cannot output that line. The reveal **is** the differentiation.

---

## 7. Judge Q&A — hard questions, crisp answers

**Q: "Isn't this just Lean / Tarabut?"**
> No. They read **banks**; we add the **wallet layer + verification + Arabic** and output a **verified-income answer**, not raw lines. We sit **on top** of Lean — it's a channel, not a competitor.

**Q: "Lean / SiFi / many companies already solved this — why do we need you?"**
> Different categories. Lean is a **pipe** (data access). **SiFi is B2B spend-management** — corporate cards and expense control, *no consumer credit product at all* (it's even an EMI and still issues no score). Neither outputs a **score or a financing decision**. We're the **decision layer** on top: verified income + 1–99 PD + approve/decline. (Full breakdown: §2½.)

**Q: "You're just an AI layer that processes data — what's the need?"**
> We're not a *processing* layer — enrichment vendors already process data. We output a **decision**, and the need for it is proven three ways: (1) it **predicts default** (FinRegLab — cash-flow data scores as well as a bureau and adds signal); (2) it's **legally required** to lend (SAMA DBR caps need a *verified-income* figure); (3) **no one in KSA ships it** with wallet income. Processing is the means; the decision is the product. (Evidence: [`PROOF.md`](./PROOF.md) §2/§4/§5.)

**Q: "Can't Lean just add wallets?"**
> Not easily — wallet data **isn't in open-banking scope** (0 EMIs licensed as OB providers). And even with the feed, the hard part is **attribution + Masdr verification + Arabic** — that's a product, not an endpoint. That's us.

**Q: "Wallets give IBANs now — so why can't open banking read them?"**
> A virtual IBAN ≠ an open-banking data provider. Wallets are **EMIs**, not ASPSPs in the live framework. The per-user history lives in the wallet's **private ledger**, reachable only by **consent/partnership** — which is exactly our model.

**Q: "How do *you* get wallet data then?"**
> The **data-processing route on consent** — as a processor inside a licensee (Alinma) or under an aggregator, never as a standalone TPP. MVP demos on **consented/simulated** wallet data; partnership API at scale. (Insider steer: *avoid the regulation route; take the data-processing route* — Alinma's Open Banking Manager.)

**Q: "Tarabut already does income & categorization — what's new?"**
> On **bank** data, **generic**, **no wallet**, **no Masdr proof-tier**. Our income figure is **cross-source (bank+wallet), attributed, and provenance-graded.** Different altitude.

**Q: "What if SAMA brings wallets into open banking?"**
> Best case for us — the **pipe gets built and we own the intelligence on top.** The four USPs (§3) don't change based on who carries the bytes.

---

### Verified-facts footer (for our own confidence)
- Lean = first SAMA OB licensee, AIS over the 23 banks; neither Lean nor Tarabut expose wallet ledgers. `docs/research/15`, `docs/research/04`
- SiFi = B2B **spend-management**, EMI-licensed, 5,000+ business customers, $34M+ raised — **no consumer credit / scoring product.** Listing it as a competitor is a category error. [sifi.app](https://www.sifi.app/en); [TechCrunch 2024-06](https://techcrunch.com/2024/06/03/sifi-raises-10m-seed/)
- Pipe ≠ decision is the global structure: Plaid/Tink/TrueLayer (pipes) vs FICO cash-flow / Experian Cashflow / Prism CashScore (decisions on top). [Prism CashScore](https://www.prismdata.com/cashscore/); [Experian Cashflow Score](https://www.experianplc.com/newsroom/press-releases/2025/launch-of-experian-s-cashflow-score-signals-new-era-of-open-bank)
- 0 EMIs in the OB regime; wallets outside OB scope today. `docs/research/15:170-171`
- EMI ≠ bank: e-money at par, no interest on balances, no overdraft unless bank-partnered (Payments Law Art. 69). `docs/research/sources/…Payments_Law…`
- Masdr 3-tier model + "Mofeed is Masdr's product." `PRD.md:62-71`, `UI.md:113`
- ⚠️ Corrections vs old framing: STC Pay → **STC Bank** (now in OB scope; don't use as a wallet example); Barq/urpay **do** issue virtual IBANs (soften "no IBAN" → "EMI ledger / not an OB provider").

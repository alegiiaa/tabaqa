# طبقة · Tabaqa — "We are not Lean." (Pitch & Q&A battle-card)

> Use this on stage and in judge Q&A. One job: end the objection *"this is just Lean for wallets."*
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
- 0 EMIs in the OB regime; wallets outside OB scope today. `docs/research/15:170-171`
- EMI ≠ bank: e-money at par, no interest on balances, no overdraft unless bank-partnered (Payments Law Art. 69). `docs/research/sources/…Payments_Law…`
- Masdr 3-tier model + "Mofeed is Masdr's product." `PRD.md:62-71`, `UI.md:113`
- ⚠️ Corrections vs old framing: STC Pay → **STC Bank** (now in OB scope; don't use as a wallet example); Barq/urpay **do** issue virtual IBANs (soften "no IBAN" → "EMI ledger / not an OB provider").

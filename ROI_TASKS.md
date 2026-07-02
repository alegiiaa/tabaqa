# طبقة · Tabaqa — The 5 High-ROI Tasks (plain-language)

> The five tasks that each score **3+ judging criteria at once** — so we get the most points for the least work.
> Companion to [`WIN_PLAN.md`](./WIN_PLAN.md) (full criteria → task breakdown).

**The shortcut:**
- **A** = show the proof
- **B** = the wow moment
- **C** = make it a real decision
- **D** = let judges test it
- **E** = don't lose points on bad facts

**Order to do them:** E (fast, safe) → A + B (the visible win) → C → D.

| Task | One-liner | Criteria it scores | Effort |
|---|---|---|---|
| **A** | Show the model's real performance in-app | Data Analysis + Technical + Feasibility | Medium |
| **B** | Make the 4,000→10,000 reveal run live | Innovation + UX + Technical | Medium |
| **C** | Affordability decision w/ correct SAMA DBR | Feasibility + Data + Technical | Low–Med |
| **D** | Let judges score any applicant, not just Fahd | Technical + UX + Feasibility | Medium |
| **E** | Fix wrong facts before a judge catches them | Feasibility + Data | Low (~1h) |

---

## A — Validation / "Model Card" panel in the app
**What it is:** A screen inside Tabaqa that shows your real model performance — the **AUC 0.890**, the chart where default rate drops as the score rises (38.7% → 0%), and which features matter most.

**Why it scores:** Right now this proof lives in a markdown file *no judge will open*. Putting it on screen turns "trust us, the model works" into "look, here's the evidence." Most teams just say "we used AI" — you'd be showing measured results on real data.

**Hits:** Data Analysis (hard) · Technical · Feasibility
**Effort:** Medium — a new dashboard page + a chart.

## B — Live, animated reveal (4,000 → 10,000, DECLINE → APPROVE)
**What it is:** Make the Fahd story *run* instead of being a static picture. The judge sees: bank says SAR 4,000 → **DECLINE**. Click *"Reveal wallet layer"* → wallet income animates in → SAR 10,000 verified → **APPROVE**.

**Why it scores:** This is your emotional kill-shot — the single most-watched 15 seconds of the demo. It's the same clip in your video, your live pitch, *and* your prototype.

**Hits:** Innovation · User Experience · Technical
**Effort:** Medium — wire the dashboard reveal screen to real data + animate it.

## C — Affordability calculator with correct SAMA DBR
**What it is:** The "how much can this person actually borrow" decision — using SAMA's real Debt-Burden-Ratio caps (e.g. 33.33% of salary), configurable to the lender's policy.

**Why it scores:** It proves Tabaqa is a *deployable lending decision*, not a toy score. A bank judge sees their own compliance rules respected → "we could actually ship this."

**Hits:** Feasibility · Data Analysis · Technical
**Effort:** Low–Medium — the math function already exists; just expose + wire it.

## D — "Score anyone" (not just Fahd)
**What it is:** Let a judge enter a *new* applicant (or paste a statement) and get a fresh score — instead of the one hardcoded Fahd demo.

**Why it scores:** The gate includes "judges drive the prototype themselves." If it only ever shows Fahd, it looks like a canned trick. If they can test their own person, it looks like a real product.

**Hits:** Technical · User Experience · Feasibility
**Effort:** Medium — the generator `synthesize.py` is already built; expose it in the API + add an input form.

## E — Regulator-accuracy fixes
**What it is:** Correct a few wrong facts before a SAMA-literate judge catches them:
- the **DBR bands** (the README has them inverted) → base **33.33% salaried / 25% pensioner**, **up to 45% excluding real-estate**, **55–65% including real-estate**
- **Nova Credit** funding → **$45M Series C** (not $35M Series D)
- remove **2 claims that failed fact-checking** ("26M credit-invisible", "Experian +25% lift")

**Why it scores:** In an Alinma room, *one* wrong regulatory number quietly kills your credibility on Feasibility and Data. This is the cheapest possible points — fixing mistakes before they cost you.

**Hits:** Feasibility · Data Analysis
**Effort:** Low — about an hour of clean factual edits.

---

*Created 2026-06-29.*

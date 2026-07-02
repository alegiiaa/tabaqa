# طبقة · Tabaqa — Judging Criteria → Win Plan

> **The AMAD 2026 rubric, decoded, with a task list per criterion engineered to max the score.**
> Source: hackathon FAQ #03 — *"ما هي معايير التقييم؟"*
> Goal of this doc: pass the in-person qualification gate (recorded video + clickable prototype + live pitch & Q&A) by scoring high on **all five** axes.

---

## 0. The rubric (verbatim + decoded)

> «تُقيَّم المشاريع وفق عدة معايير: **الابتكار والإبداع، التطبيق التقني، تحليل البيانات، تجربة المستخدم، وقابلية التنفيذ الفعلي في القطاع المالي**.»

| # | Criterion (AR) | EN | What the judge is really scoring | Where Tabaqa stands today |
|---|---|---|---|---|
| 1 | الابتكار والإبداع | **Innovation & Creativity** | Is this genuinely new, or a clone? Does it reframe the problem? | 🟢 **Strong** — cash-flow PD *with wallet income* is unbuilt in KSA; the reveal is a fresh angle |
| 2 | التطبيق التقني | **Technical Implementation** | Does it actually work? Is the engineering real and sound? | 🟡 **Good but partial** — engine + API + deploy real; full flow not yet wired end-to-end in the UI |
| 3 | تحليل البيانات | **Data Analysis** | Rigor of the modeling/analytics. Real data? Real metrics? | 🟢 **Rare asset, but invisible** — AUC 0.890 / KS 0.683 on Berka real data lives only in a markdown file |
| 4 | تجربة المستخدم | **User Experience** | Is it usable, polished, intuitive? Would a real user enjoy it? | 🟠 **Weakest axis** — landing page polished; dashboard ~70% specced, reveal still a static mockup |
| 5 | قابلية التنفيذ الفعلي | **Real-world feasibility (financial sector)** | Could a Saudi bank/lender actually deploy this? Regulation, GTM, compliance. | 🟢 **Very strong, needs accuracy pass** — PROOF.md + SAMA/DBR + Alinma GTM; 2 regulator-accuracy bugs to fix |

**Read of the board:** we can win **#1, #3, #5 outright** (most teams can't touch the data-validation or the regulatory rigor). **#2 and #4 are the exposure** — both fixed by the *same* work: wiring the reveal flow live and finishing the dashboard. So the build plan and the rubric point at the same targets.

---

## 1. Highest-ROI tasks (each scores 3+ criteria at once — do these first)

| Task | Hits criteria | Why it's leverage |
|---|---|---|
| **A. Validation / Model Card panel in-app** | **#3 Data** + #2 Tech + #5 Feasibility | Converts a hidden markdown report (AUC 0.890, monotonic default chart, feature IVs) into an on-screen credibility weapon. Answers "does transaction data predict default?" before it's asked. |
| **B. Live reveal flow (4,000→10,000, DECLINE→APPROVE)** | **#1 Innovation** + #4 UX + #2 Tech | The emotional kill-shot, *running* instead of mocked. Money shot for video, prototype, and pitch at once. |
| **C. Affordability calculator live w/ correct SAMA DBR** | **#5 Feasibility** + #3 Data + #2 Tech | Proves it's a deployable lending decision, not a toy. DBR compliance = "a bank could ship this." |
| **D. Score-anyone (expose `synthesize.py` form-to-fixture)** | **#2 Tech** + #4 UX + #5 Feasibility | Lets judges drive the prototype themselves with a non-Fahd applicant — what "working prototype review" demands. |
| **E. Regulator-accuracy fixes (DBR bands, Nova Credit, refuted claims)** | **#5 Feasibility** + #3 Data | Cheap, fast, pre-authorized. One wrong number in front of a SAMA-literate judge quietly tanks credibility. |

> **Sequence:** E (warm-up, hours) → A + B (the visible win) → C → D.

---

## 2. Criterion-by-criterion task lists

Legend for deliverable each task feeds: **[V]** recorded video · **[P]** clickable prototype · **[L]** live pitch & Q&A

### 1️⃣ الابتكار والإبداع — Innovation & Creativity
**Judge lens:** "Is this new, or have I seen it 10 times today?"
**Our edge:** No one in KSA ships a cash-flow PD *decision* that includes **wallet income**. Pipe-vs-decision framing (VS_LEAN.md). The 3-tier verification model is a novel honesty mechanism.
**Gap:** The novelty is buried in docs, not dramatized in the demo.

- [ ] **[V][L]** Open the pitch on the reveal, not the architecture: *"Fahd earns 10,000 — the bank sees 4,000 — watch why."* (task B makes it live)
- [ ] **[L]** One slide: *"The unbuilt lane"* — the 5-player table (Lean/SiFi/Tarabut/Drahim/SIMAH) showing none ships a wallet-aware PD decision (from VS_LEAN.md §2½)
- [ ] **[L]** Name the moat in one line: *Arabic cleaning × wallet attribution × Masdr ground-truth × an entity graph that compounds with volume*
- [ ] **[V][L]** Re-spine the tagline: hook **"Score the unscorable"** + sub **"reveal the wallet income banks can't see, turned into a verified score they can lend against"**
- [ ] **[L]** 1-line scale story: *we move a national KPI — FSDP's 20%-SME-credit-by-2030 target, currently missed (9.4% vs 11%)*

### 2️⃣ التطبيق التقني — Technical Implementation
**Judge lens:** "Does it actually run, and is the engineering sound?"
**Our edge:** Pure-stdlib reproducible pipeline (runs anywhere, zero deps), FastAPI + Supabase, deployed live, transparent additive scorecard, graceful Claude degradation.
**Gap:** `/v1/score` only accepts a hardcoded `connection_id`; dashboard not wired to backend; trained model not in the live path.

- [ ] **[P]** Wire the full pipeline end-to-end behind the dashboard (ingest → clean → reconcile → verify → score → affordability) on live data, not mocks
- [ ] **[P][L]** Expose `synthesize.py` in the API so `/v1/score` accepts a `form`/`fixture` (task D)
- [ ] **[P]** Wire `/v1/affordability` endpoint (the pure-math function exists; surface it) (task C)
- [ ] **[L]** One clean architecture diagram slide (the 6-stage pipeline + where Claude assists vs. where rules decide)
- [ ] **[P][L]** Make the live API browsable — confirm `/developers` API-docs page + `API_REFERENCE.md` are current and demo-able
- [ ] **[P]** Wire the trained Berka scorecard (or show the demo score's lineage to it — same 6 features) so the score *is* the validated model, not just expert weights
- [ ] **[V]** Show the offline reproducibility flex: `smoke_test.py` runs Fahd end-to-end with zero dependencies (judges can verify claims themselves)

### 3️⃣ تحليل البيانات — Data Analysis  ⭐ *(your differentiator — win this outright)*
**Judge lens:** "Is the analytics real, or 'we used AI'? Show me metrics on real data."
**Our edge:** Out-of-sample **AUC 0.890 / KS 0.683** (5-fold CV 0.858 / 0.562) on **Berka real data** (682 accounts, 11.1% bad rate). Monotonic score→default (38.7%→0.0%). WOE binning + Information Values per feature. Most teams have *nothing* like this.
**Gap:** It lives in `eval/DATA_REPORT.md` — invisible to judges.

- [ ] **[P][V]** **Build the Validation / Model Card panel in the app** (task A): AUC 0.890, KS 0.683, the monotonic score-band→default-rate bar chart, the 6 feature Information Values, "transparent additive scorecard — no black box"
- [ ] **[L]** Slide: *"This isn't our theory"* — Berka real-data metrics + FinRegLab independent proof that cash-flow data predicts default as well as a bureau
- [ ] **[L]** Explain the 6 cash-flow features and which carry signal (`balance_volatility` IV 1.295 strongest; `income_regularity` 0.442; honest note that `nsf_count` had no signal on Czech data but does on Saudi wallet data)
- [ ] **[V][L]** Show the PD math is principled: `PD = clamp(1.39·(1−score/99)², …)`, every point attributed to a reason code
- [ ] **[P]** Add a "Reason codes" view per applicant (why this score) — explainability *is* data analysis to a credit officer
- [ ] **[L]** State the methodology honestly: trained on public Berka, production swaps in `optbinning.Scorecard` on the lender's own AIS history (same I/O contract)

### 4️⃣ تجربة المستخدم — User Experience  ⚠️ *(your weakest axis — invest here)*
**Judge lens:** "Is it polished and intuitive? Does it feel like a real product?"
**Our edge:** Bilingual EN/AR (RTL), designed bank-style cards + merchant logos, Tabaqa branding, print-ready credit report + QR verify page.
**Gap:** Dashboard ~70% specced; reveal is a static mockup; multi-applicant flow not wired.

- [ ] **[P][V]** **Finish + wire the 4-screen dashboard** (Reveal / Score / Ledger / Affordability) to live data
- [ ] **[P][V]** **Animate the reveal** (task B): bank-only DECLINE → "Reveal wallet layer" → reconciliation animates → APPROVE. This is the single most-watched moment.
- [ ] **[P]** Smooth the applicant-entry path so a judge can go from "new applicant" → score in under a minute (task D)
- [ ] **[P]** RTL/Arabic polish pass — make the Arabic experience first-class, not a translation afterthought (Saudi judges feel this)
- [ ] **[P]** Loading/empty/error states so the live prototype never looks broken during review
- [ ] **[V]** 2-min screen-recorded walkthrough with clean narration, built around the reveal
- [ ] **[P]** Mobile/responsive sanity check (judges may open it on a phone)

### 5️⃣ قابلية التنفيذ الفعلي — Real-world feasibility in finance  ⭐ *(your second differentiator)*
**Judge lens:** "Could Alinma actually deploy this? Regulation, compliance, business model."
**Our edge:** PROOF.md (adversarially fact-checked), SAMA DBR compliance, 3-tier verification honesty, data-processor-on-consent route (no license needed), Alinma-as-customer-#1 GTM, per-decision pricing mirroring Masdr/SIMAH.
**Gap:** 2 regulator-accuracy bugs (DBR bands, Nova Credit) + 2 refuted claims that a SAMA-literate judge will catch.

- [ ] **[L][P]** **Fix regulator accuracy (task E):** DBR bands → base **33.33% salaried / 25% pensioner**, **up to 45% excluding real-estate**, **55–65% including real-estate**; Nova Credit → **$45M Series C** (not $35M Series D); scrub refuted claims ("26M credit-invisible", "Experian +25% lift")
- [ ] **[P]** Make the affordability calculator enforce a **configurable DBR band** ("set to the lender's policy") (task C)
- [ ] **[L]** Slide: *"How this deploys at Alinma tomorrow"* — read-only AIS + consent, data-processor inside the bank, **no new license required**, no payment initiation (no PIS)
- [ ] **[L]** The institutional-buyer framing: FSDP 20%-by-2030 SME-credit KPI, currently missed → Tabaqa is the assessment layer that moves it
- [ ] **[L]** Monetization slide: per-decision / per-API-call, tiered (mirror Masdr Bronze→Platinum), outcome-based per approved loan
- [ ] **[L]** Be honest about wallet access: *gated on partnership/consent* (data-processor route), demoed on consented/simulated data — this honesty reads as sophistication
- [ ] **[L]** Have the 3-tier verification answer ready: never tag a P2P/retail row as Masdr-verified

---

## 3. Execution sequence (≈2.5 weeks to the gate)

> Adjust to the real submission deadline.

**Sprint 1 — Credibility + the reveal (the visible win)**
- [ ] E · Regulator-accuracy fixes (DBR bands, Nova Credit, refuted claims)
- [ ] A · Validation / Model Card panel (surfaces AUC 0.890 in-app)
- [ ] B · Live reveal flow wired + animated

**Sprint 2 — Make it real & drivable**
- [ ] C · Affordability calculator live with configurable DBR
- [ ] D · Score-anyone (expose `synthesize.py`; new-applicant entry)
- [ ] Dashboard polish + RTL pass + loading/error states

**Sprint 3 — Package for judges**
- [ ] 2-min recorded demo video (built around the reveal)
- [ ] Pitch deck + 3-min script (spine → reveal → data proof → feasibility → scale)
- [ ] Q&A drill using VS_LEAN.md battle-card
- [ ] (Optional wow) Wire Claude on the live deploy → real-time lender "credit memo" in the insights panel

---

## 4. Deliverable readiness matrix

| | Innovation | Tech | Data | UX | Feasibility |
|---|---|---|---|---|---|
| **Recorded video** | reveal cold-open | smoke-test flex | model-card on screen | animated walkthrough | "deploys at Alinma" line |
| **Clickable prototype** | the reveal screen | full flow wired | validation panel | finished dashboard | live DBR affordability |
| **Live pitch & Q&A** | unbuilt-lane slide | architecture slide | FinRegLab + Berka slide | demo it live | regulatory + GTM + pricing |

---

## 5. The one-sentence answer per criterion (memorize for Q&A)

1. **Innovation:** *"We ship the one thing no one in KSA ships — a cash-flow credit decision that includes the wallet income banks are blind to."*
2. **Technical:** *"A reproducible, transparent engine — runs anywhere with zero dependencies, deployed live, every score explainable to a reason code."*
3. **Data:** *"Validated on real data — AUC 0.890, monotonic risk bands — applying a mechanism FinRegLab independently proved predicts default."*
4. **UX:** *"A bilingual, bank-grade dashboard where a lender sees the reveal and a decision in one screen."*
5. **Feasibility:** *"Deployable inside Alinma tomorrow — read-only AIS on consent, SAMA-DBR-compliant, no new license, no payments."*

---

*Created 2026-06-29. Companion docs: [`PRD.md`](./PRD.md) · [`PROOF.md`](./PROOF.md) · [`VS_LEAN.md`](./VS_LEAN.md) · [`eval/DATA_REPORT.md`](./app/eval/DATA_REPORT.md).*

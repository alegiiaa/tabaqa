# Tabaqa — Scale Story & Presentation Brief

> ## ⚠️ PIVOT 2026-07-12 — read this first
> **The story changed: Tabaqa is now a FINANCING MARKETPLACE powered by its own scoring
> engine** (user decision, Jul 12; built + live in the app under «التمويل», commit `bca75e7`).
> The hero beat is no longer DECLINE→APPROVE — it is **«0 عروض ← 4 عروض»**: same search,
> same SAMA rules; the wallet becomes visible and the offers appear. The engine (score,
> reveal, copilot, receipt) is the trust layer underneath.
> **The current story lives in `JUDGE_SCRIPT.md` (rewritten) + `TEAM_BRIEF.md` §1/§5/§7** —
> including the FOUR FORBIDDEN SENTENCES (ID-only onboarding · Sehhaty/Absher data ·
> "banks give us formulas" · "approval is a formality") and their corrected versions.
> Everything below remains valid as evidence/Q&A ammunition; read the beats through the
> marketplace lens.

> **For:** the presentation team · **Date:** 2026-07-10 · **Owner:** Ilyas
> **Status:** working doc, **UNTRACKED — do not commit** (docs freeze until Jul 14; this content folds into `JUDGE_SCRIPT.md` + the deck at the Jul 14 re-check)
> **Deep-dive source:** `app/RESEARCH-2026-07-08.md` (109-agent research run, 23 primary-source-verified claims) — this brief is the *usable* distillation; go there only if you need the citations.

---

## 0 · The one rule of this pitch

**Comparables validate the category in one breath — every other sentence is about Tabaqa.**
We never pitch Lean, Nova, or anyone else. We use them for exactly one line:

> "Venture investors have put **$200M+ into exactly this thesis** — cash-flow underwriting on consented open-banking data."

Then we pivot immediately: *"Here's why Tabaqa is the version of that thesis built for Saudi."* Done. No more names unless a judge asks.

---

## 1 · What the research bought us (5 weapons)

1. **Market validation in one line** — the $200M+ line above (conservatively ≈$285M across three companies; never claim a precise category total).
2. **The legality answer** — the exact SAMA rulebook chain proving banks **and** wallets are legally readable with customer consent. Full spoken version in §3 below. This is the question most likely to be asked by a banking judge, and we now answer it with article numbers.
3. **The failure lesson (disclose proactively)** — the best-funded US player proved the *mechanism* (30% lower default roll rates vs bureau-only; 400k thin-file approvals) but died as a standalone card issuer. Lesson we state on stage: **Tabaqa sells the score and never lends.** The scoring layer survives; the lender-of-its-own-balance-sheet doesn't.
4. **The Arabic gap is uncontested — verified.** The closest open-source statement-parsing project on GitHub has *zero* Arabic/RTL/Hijri content (grep-verified). Our adapter layer is provably unique, not "we think we're first."
5. **A priced regulatory on-ramp** — SAMA issued its **first two AIS licences on Mar 26, 2026**. Our own licence path: **SAR 20,000 issuance fee, no joint-stock-company requirement** (Implementing Regulations, Art. 23 / Art. 14). Most teams hand-wave compliance; we quote the fee and the article.

---

## 2 · The Tabaqa scale story (4 beats — this is the "how do you scale?" slide)

**Beat 1 — The market opened 4 months ago; we are the missing layer.**
The consented-data *rails* (AIS licences) went live in Saudi in March 2026. What doesn't exist on top of them is the **decision layer** — turning raw consented bank+wallet transactions into a score a lender can act on and an applicant can understand. The rails are our **suppliers**, not our competitors. The window is open *now*.

**Beat 2 — Distribution is a regulatory ladder with dates and prices.**
| Phase | Channel | Legal basis | Status |
|---|---|---|---|
| Today | Customer-uploaded statements (bank + wallet exports) | PDPL explicit consent — **no licence needed** | **In production** (`tabaqa.vercel.app`) |
| Growth | Plug into a licensed AIS aggregator as a client | Art. 96 — providers *must* grant licensed access | Rails licensed Mar 2026; our ingestion is source-agnostic → new rail = adapter profile, not a rebuild |
| Scale | Our own AIS (PAIS) licence | Art. 23: **SAR 20,000**, no joint-stock requirement | Priced, dated, quotable |

**Beat 3 — The business model is already running in the demo.**
Lenders pay **per score** through the metered API — keys, metering, and a **5-line integration** are live today (`tabaqa-api.vercel.app`, `/developers` page). The lender's case is on screen: wallet-layer underwriting cuts thin-file **bad rate −61%** (ROI panel, ×30 return on the API fee). Not a slide — a `curl` the judge can run.

**Beat 4 — The moat compounds with scale.**
Two things nobody else has: the **Arabic/RTL/Hijri adapter layer** (verified uncontested) and the **applicant-facing inversion** — the score, the report, and the path-to-approval belong to the person, not only the bank. Onboarding institution N+1 is a config profile, not a project. Every wallet that exposes the standard API makes our ingestion *cheaper* while the hard part (Arabic normalization + bank↔wallet fusion) stays ours. Demand is state-sponsored: **37% thin-file** population, FSDP fintech-share target **9.4%→20%**, and SAMA's own policy says open banking *"will expand access to credit"* — say **"explicit SAMA policy endorsement"** (never "regulatory blessing").

---

## 3 · Spoken answers — rehearse these cold

### س: "كيف تتوسعون؟ / How does this scale?" (~45 sec)

**EN:**
> "Three steps, all priced. Today we underwrite from customer-uploaded statements — production code, legal under PDPL consent, no licence required — revenue can start now. As we grow, we plug into the licensed AIS rails that went live this March — our ingestion is source-agnostic, so a rail is an adapter, not a rebuild. At scale we take our own AIS licence: twenty thousand riyals, no joint-stock requirement — Article 23 of the implementing regulations. Who pays? Lenders, per score, through the metered API you just saw — five lines to integrate. Why? Because the wallet layer cuts their thin-file bad rate by 61%, and 37% of Saudis are exactly the customers they can't score today. And we never lend ourselves — we sell the decision, they keep the balance sheet. That's why this scales as infrastructure instead of dying as a lender."

**AR:**
> "ثلاث خطوات، وكلها بأسعار معروفة. اليوم نُقيّم من كشوف حساب يرفعها العميل بنفسه — كود في الإنتاج، وقانوني بموافقة صريحة بموجب نظام حماية البيانات الشخصية، وبدون أي ترخيص — والإيراد يبدأ الآن. مع النمو نتصل بقنوات خدمة معلومات الحساب المرخّصة التي انطلقت في مارس الماضي — طبقة الاستيعاب عندنا لا تعتمد على المصدر، فالقناة الجديدة مجرد محوّل وليست إعادة بناء. وعند التوسع نأخذ ترخيصنا الخاص: عشرون ألف ريال، وبدون شرط شركة مساهمة — المادة ٢٣ من اللوائح التنفيذية. من يدفع؟ جهات التمويل، عن كل تقييم، عبر الـAPI الذي رأيتموه — خمسة أسطر للتكامل. ولماذا؟ لأن طبقة المحفظة تخفض نسبة التعثر ٦١٪ في الملفات الرقيقة، و٣٧٪ من السعوديين هم بالضبط العملاء الذين لا يمكن تقييمهم اليوم. ونحن لا نُقرض أبداً — نبيع القرار وهم يحتفظون بالميزانية. لهذا نتوسع كبنية تحتية بدل أن نموت كمُقرض."

### س: "هل قراءة البنك والمحفظة معاً قانونية أصلاً؟" (the banking-judge kill shot)

> "Three consented channels connect banks and wallets. **First**, a SAMA-licensed AIS aggregator — the exact activity SAMA licensed for the first time on March 26, 2026. **Second**, customer-permissioned statement upload, which our adapters parse today — legal under PDPL because the customer hands us their own data with explicit consent. **Third** is screen-scraping, which we refuse and the licensing regime is killing. Is it legal for wallets too? **Yes, by statute:** the Payments Law defines a Payment Account provider-agnostically — expressly *including but not limited to* banks — so EMI wallets like urpay and Barq are in AIS scope, and **Article 96 obliges providers to grant licensed access on customer consent**. Our own path: the AIS licence costs SAR 20,000 with no joint-stock requirement — or we ride a licensed aggregator until then."

*If pressed on wallet APIs:* "The mandatory framework APIs reached banks first — live wallet-API pull is a rollout question, which is exactly why the statement-upload channel we shipped matters today."

### س: "وين الذكاء الاصطناعي؟ / Where's the AI?"

**EN:**
> "ALLaM never touches the score. The score is an auditable statistical scorecard — validated on 963,000 real credit applications — and ALLaM, the Saudi sovereign LLM, explains it and coaches the applicant in Arabic. That split is deliberate: it's why this product can pass a SAMA model-risk review. Black-box LLM scoring is how credit fintechs die."

**AR:**
> "علّام لا يلمس الدرجة أبداً. الدرجة نموذج إحصائي قابل للتدقيق — تم التحقق منه على ٩٦٣ ألف طلب ائتماني حقيقي — وعلّام، النموذج السعودي، يشرحها ويوجّه العميل بالعربية. هذا الفصل مقصود: هو ما يجعل المنتج قابلاً لاجتياز مراجعة مخاطر النماذج في ساما."

### س: "ما الذي تعلمتموه ممن فشلوا؟"

> "The best-funded US player proved the mechanism — 30% lower roll rates than bureau-only — but died as a card issuer, because it lent from its own balance sheet with no wallet fusion and no applicant-facing score. We took all three lessons: we sell the score, we fuse the wallet, and the applicant owns their number."

---

## 4 · Landmines — NEVER say these (a judge who knows will catch it)

| ❌ Never | ✅ Instead |
|---|---|
| TomoCredit as a success comparable | Omit, or cite as the cautionary tale (bureaus cut off its access, Oct 2024) |
| "Regulatory blessing" for data analysis | "**Explicit SAMA policy endorsement**" |
| stc bank / D360 are "wallets/EMIs" | They are **licensed digital banks**; the EMI wallet examples are **urpay / Barq** |
| "No capital requirement" for the AIS licence | "SAR 20,000 issuance fee, **no joint-stock requirement**" (regs are silent on capital) |
| Citing the Jan-2021 SAMA OB Policy for dates/scope | Cite the **Nov 2022 Framework + 2023 implementing regulations** |
| A precise "$XXXm total market funding" figure | "**$200M+ into exactly this thesis** — conservatively" |
| Publishing / showing Kaggle Home Credit data anywhere | Doubly licence-locked — never appears in the deck or demo |

---

## 5 · THE SHOW — «لجنة الائتمان الحيّة» (3:00, supersedes the old choreography · Jul 10)

> The rule that produced this script: **the judges must DO something, not hear something.**
> All numbers below are live pipeline outputs, verified Jul 10 — nothing staged.
> Every beat runs in the Applicants section of the live app (`/demo` → المتقدمون → متقدم جديد → نموذج جاهز).
> The gallery opens on the cast in stage order: **Omar · Mansour · Yousef**.

### ① The Trap — أنتم اللجنة (0:00–0:30)
*Screen: persona gallery, first two cards.*
> «أهلاً بكم في لجنة الائتمان. أمامكم طلبان.
> **عمر**: موظف، راتب ٩٬٥٠٠، سجل ١٢ شهرًا. **منصور**: سائق توصيل — دخله البنكي: **صفر تقريبًا**.
> ارفعوا أيديكم: من يوافق لعمر؟ … ومن يوافق لمنصور؟»
*(Pause. Nobody raises a hand for Mansour.)*
> «رفضتوه. وهذا بالضبط قرار السوق اليوم — منصور غير مرئي.»

**EN gloss:** make them decline the gig driver themselves — the market's blindness becomes *their* decision.

### ② The Flip — قراركم انعكس (0:30–1:05)
*ONE CLICK on Mansour's card → the real pipeline scores him live.*
> «الآن نضيف الشيء الوحيد الذي ما نظرتم إليه: **محفظته**.
> دخله: صفر… إلى **٦٬٢٠٠ ريال — موثّق من المصدر**: جاهز وكريم، مباشرة.
> درجته **٨٢**. وعلى الشاشة: البنك وحده **رفض ✗** — طبقة **موافقة ✓**.
> نفس الرجل. نفس اللحظة. **قراركم أنتم انعكس — ليس برأينا، ببياناته.»**

### ③ The Honest No + the score talks — طبقة ليست آلة موافقات (1:05–1:50)
*ONE CLICK on Yousef's card.*
> «وحتى لا تظنون أنها آلة موافقات — هذا **يوسف**، دخل حر متقطع:
> درجته **٥١**. القرار: **رفض — حتى مع محفظته.** النموذج يقول لا عندما يجب أن يقول لا.
> لكن الفرق عندنا: **الرفض ليس نهاية — الدرجة تتكلم.»**
*Tap the Ask-Tabaqa bar → hero chip: «ليش درجتي ٥١؟ ووش أسوي عشان أوصل ٦٧؟» → ALLaM answers live, in Arabic, grounded:*
> *(the product says it, not the presenter: balance buffer +14 · avoid overdrafts +9 → indicative ≈ 74, REVIEW band)*
> «هذا **علّام** — النموذج السعودي — يشرح ولا **يلمس** الدرجة أبدًا: الدرجة نموذج إحصائي مدقَّق على ٩٦٣ ألف طلب حقيقي. إذا اخترع علّام رقمًا واحدًا، لا يصل للشاشة.»

### ④ The Tamper Test — جرّبوا تغشّون (1:50–2:25)
*Hand the nearest judge the laptop. A genuine CSV is open in Excel.*
> «هذا كشف حساب حقيقي الصيغة. **عدّلوا أي رقم فيه.** أي رقم.»
*(Judge edits → drag the file in → the chip flips:)* **«✗ سلسلة الرصيد غير مُطابقة — احتمال تعديل يدوي»**
> «الرصيد المتحرك يُعاد احتسابه من الكشف نفسه — تعديل خانة واحدة يكسر السلسلة. وهذا الفحص يُطبع في **إيصال الامتثال** — امسحوا الرمز.»
*(Judge scans QR → /verify opens.)*
**Recovery (rehearsed, 15s):** if the judge hesitates > 5s: «خلوني أغش أنا عنكم» — presenter edits one cell, same beat.

### ⑤ The Nation — من ثلاثة أشخاص إلى ١١ مليون (2:25–3:00)
*Screen: inclusion meter.*
> «عمر ومنصور ويوسف ليسوا حالات — هم السوق:
> **٧٨٪ من السعوديين عندهم حساب بنكي؛ ٥٧٪ فقط عندهم ملف ائتماني.** ٢٢ نقطة مئوية عالقة بينهما — **١١ مليون منصور.**
> ورؤية ٢٠٣٠ تطلب رفع حصة التمويل التقني من ٩٫٤٪ إلى ٢٠٪ — هذه الفجوة هي وظيفة طبقة.
> نطلب شيئًا واحدًا: **بنك شريك لأول تجربة.** والقرار — كما شفتم — ينعكس في ثوانٍ.»

### Fallbacks (rehearse each once)
- **LLM dies / rate-limits** → the copilot silently serves the same answer from the deterministic engine — the beat proceeds identically (this is by design; it happened in testing and no one can tell).
- **Wifi dies** → phone screen-recording of beats ②–③ + printed receipt carries ④.
- **Judge won't participate** → recovery lines above; the show works fully presenter-driven.

### Why this show wins the room (the theory, for the team)
- The judges **act** twice (the decline vote, the tamper attempt) — actions are retold at dinner; narration isn't.
- Yousef's honest DECLINE kills the "it approves everyone" suspicion that two 82s would plant.
- The big number closes instead of opens: ed.1's stat-opener took **third**; the live-AI show took **first**. We do the show and *earn* the statistic.

---

## 6 · MVP build plan — Jul 10 → 15 (code-only window; docs stay frozen)

| Pri | Item | Detail | Est. |
|---|---|---|---|
| **P0** | **Ask-Tabaqa copilot (the AI hero moment)** | Resurrect the parked command-bar rails (`app/COPILOT_FEATURE.md`); ground answers in the deterministic recourse/path-to-approval features so ALLaM narrates real numbers and cannot hallucinate the score; Arabic-first | ~1 day |
| **P0** | **Groq Dev Tier before Jul 16** | Free tier = 6k tokens/**min** counting *requested* max_tokens — a live on-stage demo on the shared free tier will 429 mid-answer. Also: copilot must degrade **silently** to the deterministic recourse answer on 429 (no error state, ever, on stage) | admin task |
| P1 | Lean sandbox "Connect via API" spike | Proves the production channel live next to upload. **Decide by Jul 12** — only if the copilot lands early | ~1 day |
| P1 | Demo smoke script + judge one-pager | Already queued | — |
| P2 | Deck: one "Scale" slide from §2 (ladder + unit economics + demand) | Slots into the deck-flags review; **commits only at the Jul 14 fold-in** | small |

**Freeze rules:** repo docs (`JUDGE_SCRIPT.md`, `COMPETITION.md`, `EVIDENCE.md`, deck) frozen until **Jul 14**, when this brief + `app/RESEARCH-2026-07-08.md` fold in. Code and checkboxes are allowed until **Jul 15**.

## 7 · Devil review (Jul 10) — fix / prove / disclose

Rule: **fix what a judge can trigger live; prove what we can already prove; disclose what only time can fix, with dates.**

**FIX by Jul 15 (code):**
1. **Grounding firewall** in the Ask-Tabaqa copilot — recourse engine computes all numbers; ALLaM only narrates; post-generation digit-check against the fact set, invented number → deterministic fallback. Judge line: "if the model invents a number, you never see it."
2. **Running-balance integrity check** in adapters + "integrity: passed" chip (UI + compliance receipt) — answers "what stops me editing my CSV?" with "try it; the receipt will refuse." Full answer = API channel (data never passes through the applicant's hands).
3. **Refuse, don't guess** — low fingerprint confidence or failed debit/credit sanity check → "needs review" column-confirm state, never a silent wrong score.
4. **Real-export sprint (whole team, starts now):** everyone exports their own real bank/wallet statements; run all through the adapters; fix every parse failure. Target 10+ real files before Jul 16 → "our adapters have parsed N real exports" becomes true.
5. Lean sandbox spike — unchanged Jul 12 go/no-go, only after 1–4 land.

**PROVE with what exists (no code):** architecture backup slide gains a production-topology panel (in-Kingdom cloud, self-hosted ALLaM via SDAIA channel, fail-closed auth, audit log) — "the demo runs on Vercel because it's a demo"; lift claims stay layered (Berka +0.203 = statement-like features; AlfaBattle +0.117 = mechanism at scale — never cross-quote); retro-validation harness = the existing eval pipeline pointed at a lender's book ("a data delivery away, not a build").

**DISCLOSE + 90-day roadmap (the "we know the direction" slide):**
- **0–30:** ~100 real exports w/ PDPL consent → adapter hardening · Lean integration complete · in-Kingdom architecture spec.
- **30–60:** one pilot lender (BNPL/micro-lender — worst thin-file pain) → **retro-validation on their historical book** = first Saudi-calibrated score + swap-set report · SAMA regulatory-sandbox application (the Tarabut/Lean path).
- **60–90:** shadow-mode scoring beside their underwriting · re-platform in-Kingdom · self-host ALLaM.

Cold-start honesty line (rehearse): "Our score is mechanism-validated on a million foreign outcomes and not yet Saudi-calibrated — we know that, and the pilot's retro-validation closes it in 60 days."

## 8 · Calendar

- **Jul 10** — book mock judge; start Ask-Tabaqa copilot
- **Jul 12** — go/no-go on the Lean sandbox spike
- **Jul 14** — docs unfreeze: fold research + this brief into judge script and deck; re-check competitors & licensing freshness
- **Jul 15** — code freeze; full timed run-through of §5 with fallbacks tested (kill the network, kill the LLM — the show must still finish)
- **Jul 16–19** — AMAD, in person 🏆

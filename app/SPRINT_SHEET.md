# 🏁 Final-Week Sprint Sheet — Jul 10 → 16

> **The rule:** a task is ✅ only when its **Proof** cell holds a real artifact — a commit hash, a file path, a screenshot, a URL, a name+date. No proof, no checkmark. (History lives in `GRIND.md`; this sheet is only what remains.)
> Statuses: ☐ open · ⏳ in progress · ✅ done (proof attached) · ✂️ cut (say why)

---

## How this sheet works (the convention)

Each task answers three questions **before** we work on it:
1. **What** — the task, small enough to finish in one sitting.
2. **Why** — the judging criterion or risk it buys down. If we can't name the why, we cut the task.
3. **Proof** — decided *in advance*: what artifact will show it's done. When finished, paste the artifact into the cell and flip the status.

Example of the convention on already-shipped work:

| ✓ | Task | Why | Proof |
|---|---|---|---|
| ✅ | Statement integrity + refuse-don't-guess | the trust beat; kills "what if the CSV is fake" | commit `b955236` + `/v1/score` returns `statement_integrity` |
| ✅ | API prod deploy | full stack must run today's code | both probes green (SESSION-2026-07-10 §top) |

---

## 🔴 P0 — blocks the demo (do first)

| ✓ | Task | Why | Owner | When | Proof (fill when done) |
|---|---|---|---|---|---|
| ☐ | **Venue format from qualification email** — build-on-site or pitch+demo? | every plan below assumes pitch+demo; if wrong, we re-plan NOW, not Jul 15 | You | tonight | quote the email line here |
| ☐ | **Groq Dev Tier upgrade** | free tier = 6k tokens/min shared → `/v1/insights` (ALLaM narration) 429s mid-demo (devil finding) | You | tonight | dashboard screenshot showing tier + new TPM limit |
| ☐ | **Book mock judge for dry run #1** | 34/50 devil baseline says rehearsal, not code, is where the points are; findings drive Jul 12–13 fixes | You | tonight | name + confirmed time |
| ☐ | **Real-export sprint** — team WhatsApp, 10+ own bank/wallet exports through the app | the #1 lever from the 34/50 review: "works on OUR real data" beats any slide; also stress-tests adapters | You + team | Jul 11–12 | list: institution → parsed ✓/✗ → score |
| ☐ | **Dry run #1** — real person, live site, stopwatch, `JUDGE_SCRIPT.md` | first contact with a real human; every stumble becomes a fix ticket below | Both | Jul 12 | stumble list (append as tasks) |
| ☐ | **Pre-demo API smoke script** — `/health` keyed, one live score, key issuance, `/v1/insights` probe — 5 min on venue wifi | venue wifi is the single biggest demo risk; scripted = no thinking under pressure | Claude | Jul 11 | script path + one green local run pasted |
| ☐ | **Kill-the-LLM + kill-the-network drill** — demo with Groq 429'd; demo fully offline (`smoke_test.py` path) | the fallback must be *rehearsed*, not just built — fumbling the fallback reads worse than having none | Both | Jul 15 | 2-line drill log: what we did when each died |
| ☐ | **Dry run #2 → FULL FREEZE** | after this, only rehearsal — the 92%-done-product/unrehearsed-3-minutes failure mode | Both | Jul 15 | stopwatch time + freeze declared here |

## 🟡 P1 — buys points

| ✓ | Task | Why | Owner | When | Proof |
|---|---|---|---|---|---|
| ☐ | **Deck review** (tabaqa.vercel.app/deck.html) — wording flags → fixes | deck v1 has been live awaiting your eyes since Jul 6; it's the only artifact judges may see twice | You | Jul 11 | your flag list + fix commit |
| ☐ | **Rehearse the 4 hero beats** until automatic: inversion · live tamper refusal · caged narrator · negative control (MVP_FLOW.md §4 beats 2/5/4/7) | devil verdict: the demo's uniqueness lives in these 4 — a judge must *experience* ≥2 live | You | daily | timed run: which 2 beats the mock judge did themselves |
| ☐ | **Reorder the pitch: bank-pain first** — open with the lender's loss (good customers declined = lost revenue, F5 ROI −61% bad rate), THEN the inversion as differentiator | ed.1 calibration (Sentry 3rd + QuantumAgents 1st): both podium ideas were one-breath BANK pains; jury = Alinma bankers | Both | Jul 11 | revised opening line in JUDGE_SCRIPT + deck slide 1 |
| ☐ | **One lender conversation** — 15 min, any BNPL/micro-lender risk person | the second 34/50 lever: one real quote beats "lenders would want this" | You | by Jul 14 | name + one-line quote |
| ☐ | **Judge one-pager (ورقة في يد المحكّم)** — print-ready, final numbers | the artifact that stays on the table after our 3 minutes end | Claude | Jul 11 | file path + printed ✓ |
| ☐ | **Q&A drill س١–س١٢** — spoken, timed, one number per breath (س٩–س١٢ from RESEARCH-2026-07-08) | Q&A is where the rigor pays; landmine list = numbers we must NOT cite | Both | Jul 14 | timed session log; hesitations listed |
| ☐ | **Docs unfreeze & merge** — fold `RESEARCH-2026-07-08.md` + `SCALE_STORY.md` §2/§7 into JUDGE_SCRIPT / COMPETITION / EVIDENCE + deck | the Jul 8 research (funding comparables, SAMA legality chain, upgraded س٩) is verified but not yet in the docs we rehearse from | Both | Jul 14 | merge commit hash |
| ☐ | **Competitor re-check** — Tamara/Tamam/Lean/D360 news since Jul 5 | "nobody does X" must be true *on demo day*, not last week | Claude | Jul 14 | updated `COMPETITION.md` + س٧ |
| ☐ | **Venue kit** — printed receipt + report + one-pager + QR cards + phone recording of the reveal + offline `smoke_test.py` | assume wifi fails; the kit is the demo that can't crash | You | Jul 15 | photo of the physical kit |
| ☐ | **Architecture slide** — 6-stage pipeline, where rules decide vs where LLM assists | the ② backup slide; drawn once, reused in deck + Q&A (MVP_FLOW.md §1 is the source) | Claude | Jul 13 | slide in deck |

## 🟢 P2 — only if ahead of schedule

| ✓ | Task | Why | Owner | When | Proof |
|---|---|---|---|---|---|
| ☐ | Lean sandbox spike — go/no-go in 2 hours | "schema-compatible with KSA Open Banking" beat, if cheap | Claude | Jul 12 | go/no-go verdict + evidence |
| ☐ | U7 reveal micro-polish (✓-stamp animation, count-up tick) | pure polish on the hero moment | Claude | if dry | commit |
| ☐ | Story tune-up: your voice pass on MVP_FLOW.md §4 | the beats must sound like *you*, not like me | You | Jul 13 | edited §4 |
| ✂️ | ~~Sakk crypto layer (Merkle/Ed25519/SD-JWT)~~ | devil verdict: résumé engineering 4 days before freeze; now one roadmap line + Q&A answer (MVP_FLOW.md §5) | — | — | cut Jul 10 |

---

## Day-by-day (matches the queue in SESSION-2026-07-10)

| Day | The point of the day |
|---|---|
| **Tonight Jul 10** | The three unblockers: venue format · Groq Dev Tier · mock judge booked. All three are messages you can send in 20 minutes. |
| **Fri Jul 11** | Claude: smoke script + one-pager. You: deck review + team WhatsApp for exports + first 4-beat rehearsal. |
| **Sat Jul 12** | **Dry run #1** (the day's centerpiece) + real-export results in. Claude: Lean spike verdict. |
| **Sun Jul 13** | Fix every dry-run stumble. Architecture slide. Nothing new after today. |
| **Mon Jul 14** | Docs unfreeze + merge · competitor re-check · **Q&A drill س١–س١٢** spoken + timed. |
| **Tue Jul 15** | Dry run #2 · kill-the-LLM/network drill · venue kit · pre-demo smoke · **FULL FREEZE**. |
| **Wed Jul 16 →** | 🏆 AMAD. Only rehearsal. |

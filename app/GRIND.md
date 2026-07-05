# طبقة · Tabaqa — The Grind Board

> **AMAD ed.2 = July 16–18, 2026.** Today = July 5. **11 working days.**
> One file, one rule: check the box when it's done, never before. `[x]` = shipped & verified.
> Priorities: **P0** = blocks judging · **P1** = buys points · **P2** = only if ahead of schedule.
> Sources of truth this board compresses: `WIN_PLAN.md`, `SCALE_PLAN.md`, `JUDGE_SCRIPT.md`, `COMPETITION.md`, `EVIDENCE.md`, `DATA_DEFENSE.md`.

---

## Read of the board (2026-07-05)

| # | Criterion | State | Verdict |
|---|-----------|-------|---------|
| ① | Innovation | COMPETITION.md verified; inversion + fusion + sufficiency band = white space | **CLOSED — defend, don't build** |
| ② | Technical | Live web + API + keys/metering; offline repro; direction-locked scorecard | **Strong — tie off loose ends only** |
| ③ | Data | 3 real populations, negative control, layered claim — pushed `1fda1d4`, live | **CLOSED after today's freeze patches** |
| ④ | UX | Reveal + bilingual RTL + Hijri live; loading/tooltips/tour/cockpit missing | **WEAKEST — this is the grind** |
| ⑤ | Feasibility | F1 receipt + F2 keys + F5 ROI + F6 inclusion all live | **Strong — pitch assets remain** |

**The standing rule:** after the ③ freeze patches below, *no new Data or Innovation work*. Every remaining hour goes to ④ UX and 📦 Packaging. The failure mode is winning Data 5/5 and losing the hackathon on UX.

---

## ③ Data — freeze patches (P0, today, ~30 min total) then FROZEN

- [x] **P9a · Scoping sentence on the three-population series** — ReplicationTab currently lets +0.203→+0.131→+0.117 read as one effect. Add one sentence (EN+AR): Berka = the mechanism (two independent sources), UCI = the falsification test (zero on single-source — the negative control), AlfaBattle = scoreability at scale. Closes the devil's last door *in the artifact*. ✅ 2026-07-05, build green
- [ ] **P9b · Eyeball the Replication tab in a real browser** — EN and AR — the negative-control block shipped verified by `curl`, not by eyes. (CSS base styles confirmed OK statically 2026-07-05; this is the 2-min visual confirmation.)
- [x] **P9c · س٨ one-breath spoken version** — the full three-layer answer has 5 numbers; delivery rule is one number per breath. Add a compressed spoken lead (keep 0.76 vs 0.64 as the only spoken figure); the card carries the rest. ✅ 2026-07-05, AR+EN in JUDGE_SCRIPT.md
- [ ] **FREEZE ③** — after the three boxes above, Data work is banned until after the event. (D9 wallet-stunt stays parked. F7 fraud overlay stays parked.)

Already done (for orientation, don't reopen): Berka ablation +0.203 · 1M corpus + TSTR 96% · UCI D6 replication + **D6b negative control (zero, published)** · AlfaBattle 963,811 at scale · harden pass P1–P8 · Saudi anchor ×0.819 · layered claim + honest baselines live · س١–س٨ written.

---

## ④ UX — the grind (Jul 5–8 sprint)

Done, don't reopen: animated reveal · bilingual EN/AR RTL + Hijri ledger dates · designed cards + merchant logos · 30-sec judging bridge + evidence teaser · `/demo` no-signup entry · error layer · print report + QR verify.

- [x] **U5 · Uniform loading/empty/skeleton states** (P0, S) — extend the `LoadingScreen` pattern to every screen; branded navy shimmer. A prototype that never flickers "broken" reads as shipped. *Do first.* ✅ 2026-07-05 `f18113d` — full audit, 5 judge-path gaps + FileReader.onerror fixed; all error copy bilingual + actionable
- [x] **U3 · Tap-to-explain tooltips** (P0, S) — every dense number (PD, IV, DBR, verified share, AUC, PSI) gets a plain-AR/EN tooltip from a static copy map. A judge is never confused in live review. ✅ 2026-07-05 `834b5c1` — InfoTip primitive + 15-term glossary, 14 wire points
- [ ] **U4 · Judge guided tour** (P1, S) — skippable 3-step overlay: ① reveal → ② score → ③ lend against it. Kills "what do I click" in a timed review.
- [ ] **U2 · Decision Cockpit** (P1, M) — one screen a credit officer could paste into a memo: reveal delta → gauge → decision → affordability → top reasons. Recompose existing components.
- [ ] **New-applicant path under 60 seconds** (P1) — time the real flow (upload/form → score); fix the slowest step. Judges will drive it themselves.
- [x] **Mobile/responsive sanity pass** (P1, S) — judges may open the link on a phone. ✅ 2026-07-05 `4015c3e` — Opus audit: no A-class break; applied the B-class fixes (grid step-downs, drift-matrix scroll, header wrap, 44px touch targets, inline upload warnings); leftovers are C-polish only (report-page type scale ≤560px)
- [ ] U7 · Reveal micro-polish: ✓-Masdr stamp animation + count-up tick (P2, S)
- [ ] U6 · A11y + dual-theme pass: focus rings, ARIA, AA contrast (P2, M)

---

## ② Technical — tie-offs only (Jul 11–13, half-day budget)

Done, don't reopen: live web + API on Vercel · Supabase keys + metering verified live · smoke_test zero-dep repro · direction-locked scorecard lineage · universal ingestion (Arabic/EN headers, Hijri, D360 fingerprints) · `/developers` + `API_REFERENCE.md` hosted.

- [ ] **DECIDE: ALLaM on the deploy** (P1, 15 min) — set `GROQ_API_KEY` in Vercel env → the Saudi-national-model story becomes live, or consciously park it and demo locally. Don't leave it half-true.
- [ ] **DECIDE: AI insights layer on the deploy** (P2) — needs `ANTHROPIC_API_KEY` + `anthropic` in slim reqs; ship it or park it — a broken panel is worse than no panel.
- [ ] **Architecture slide** (P1) — one diagram: 6-stage pipeline, where rules decide vs where the LLM assists. (Feeds the deck; make once, reuse.)
- [ ] **Pre-demo API smoke** (P0, Jul 15) — `/health` keyed:true, one live scored request, playground key issuance — scripted so it takes 5 minutes on venue wifi.

---

## ⑤ Feasibility — pitch assets only

Done, don't reopen: F1 Compliance Receipt (A4 + QR verify) · F2 live sandbox keys · F5 ROI block · F6 FSDP inclusion meter · SAMA tiered DBR in `sama.py` · data-processor-on-consent route · 3-tier verification honesty.

- [ ] **"Deploys at Alinma tomorrow" slide** (P1) — read-only AIS on consent, processor inside the licensee, no new license, no PIS.
- [ ] **Monetization slide** (P1) — per-decision / per-API-call, tiered (mirror Masdr Bronze→Platinum), outcome-based option.
- [ ] F3 · Consent & data-processor flow visualized in-app (P2, M) — only if UX sprint finishes early.
- [ ] F4 · Lender policy engine (cutoff/tenor/appetite) (P2, M) — DBR already configurable; extend only if time allows.

---

## ① Innovation — defend only

- [ ] **Competitor re-check, Jul 14–15** (P0) — Tamara/Tamam/Lean/D360 announcements since Jul 5; update `COMPETITION.md` + س٧ if anything moved.
- [ ] Rehearse the one-sentence answer + س٧ until automatic.

---

## 📦 Packaging & delivery (Jul 9–15 — where the remaining points live)

- [ ] **Pitch deck, ≤6 slides** (P0, Jul 9) — spine: shock → reveal → data proof ("this isn't our theory": FinRegLab/BIS + our three populations) → deploys-at-Alinma → monetization → close. Reuse ② and ⑤ slides.
- [ ] **2-min recorded video** (P0, Jul 9–10) — built around the reveal cold-open; model card on screen; smoke-test flex; clean narration. Record AFTER U5/U3 land so nothing flickers.
- [ ] **Mock-judge dry run #1** (P0, Jul 10) — a real person + the live site + `JUDGE_SCRIPT.md` + a stopwatch. Capture every stumble; they become Jul 11–13 fixes.
- [ ] **Q&A drill س١–س٨** (P0, Jul 14) — spoken, timed, one number per breath; landmine list from `EVIDENCE.md` (numbers we must NOT cite).
- [ ] **Mock-judge dry run #2 + full freeze** (P0, Jul 15) — after this, only rehearsal, no code.
- [ ] **Venue/tech fallback kit** (P1, Jul 15) — offline `smoke_test.py` demo path, screenshots of every screen, the A4 receipt + report printed, QR cards. Assume the wifi fails.
- [ ] **ورقة في يد المحكّم** (P1) — the printed one-pager from JUDGE_SCRIPT ⑤, final numbers.

---

## Day-by-day

| Date | Focus |
|------|-------|
| **Sat Jul 5** | ③ freeze patches (P9a–c) → start U5 |
| **Sun–Tue Jul 6–8** | ④ UX sprint: U5 → U3 → U4 → U2 → 60-sec path → mobile pass |
| **Wed Jul 9** | 📦 deck + start video |
| **Thu Jul 10** | 📦 finish video → **dry run #1** |
| **Fri–Sun Jul 11–13** | fix dry-run findings · ② tie-offs · ⑤ slides · (P2 items only if clear) |
| **Mon Jul 14** | ① competitor re-check · Q&A drill |
| **Tue Jul 15** | dry run #2 · venue kit · pre-demo API smoke · **FULL FREEZE** |
| **Jul 16–18** | 🏆 AMAD |

---

## The five spoken one-liners (rehearse until automatic)

1. **Innovation:** "We ship the one thing no one in KSA ships — the score turned toward the applicant, fusing the wallet income banks are blind to."
2. **Technical:** "A reproducible, transparent engine — runs anywhere with zero dependencies, deployed live, every point traceable to a reason code."
3. **Data:** "Three real populations, one negative control we published ourselves — the mechanism is proven, the magnitudes are re-fit on the bank's own book."
4. **UX:** "Bilingual, bank-grade, Hijri-native — a lender sees the reveal and a decision in one screen."
5. **Feasibility:** "Deployable inside Alinma tomorrow — read-only AIS on consent, SAMA-DBR-compliant, no new license, and the compliance officer gets a filable receipt."

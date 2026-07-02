# طبقة · Tabaqa — Living Task Tracker

> The single "what's done / what's next" file. Strategy lives in [`../WIN_PLAN.md`](../WIN_PLAN.md) and [`../ROI_TASKS.md`](../ROI_TASKS.md).
> Status: ☐ todo · ◐ in progress · ☑ done

---

## ☑ E — Regulator-accuracy fixes  *(Feasibility + Data · DONE 2026-06-29)*
- [x] E1 · Located DBR text — `README.md:420` + web app already CORRECT
- [x] E2 · DBR bands already correct (33.33% salaried / 25% pensioner; ≤45% excl. RE; 55–65% incl. RE)
- [x] E3 · Nova Credit already correct ("$45M Series C") at `README.md:606`
- [x] E4 · Refuted claims ("26M credit-invisible", "Experian +25%") — not present anywhere in repo
- [x] E5 · Full-repo sweep clean; vendor figures already labeled "vendor self-reported" (`README.md:610`)
> **Finding:** E was already done — the repo is regulator-accurate. Updated `PROOF.md §7` to mark resolved.

## ◐ A — Validation / Model Card panel  *(Data + Tech + Feasibility)*
- [x] A1 · Metrics → `web/src/lib/validation.ts` (single source of truth, mirrors `eval/DATA_REPORT.md`)
- [x] A2 · Built `dashboard/ValidationPanel.tsx` (AUC/KS metric cards + default-rate-by-band chart + feature-IV bars + trust footnotes)
- [x] A3 · Wired as new "Model validation" dashboard section (nav item + shield-check icon + route). Typecheck + build green ✓
- [ ] A4 · Review on screen — numbers clear & convincing  ← **your turn**

## ☐ B — Live, animated reveal  *(Innovation + UX + Tech)*
- [ ] B1 · Read `Dashboard.tsx` / `Result.tsx` + `/v1/profile` + `/v1/score` shapes
- [ ] B2 · Build bank-only state (SAR 4,000 → DECLINE)
- [ ] B3 · "Reveal wallet layer" button → animate income 4,000→10,000, decision → APPROVE
- [ ] B4 · Drive from real API data, not a hardcoded animation
- [ ] B5 · Tune timing/feel together

## ☐ C — Affordability with correct DBR  *(Feasibility + Data + Tech)*
- [ ] C1 · Wire `affordability.py` → `/v1/affordability` endpoint
- [ ] C2 · Affordability screen (max loan + DBR % + APPROVE/REVIEW/DECLINE)
- [ ] C3 · Configurable DBR band using the corrected numbers from E

## ☐ D — Score anyone  *(Tech + UX + Feasibility)*
- [ ] D1 · Expose `synthesize.py` so `/v1/score` accepts a `form`
- [ ] D2 · Wire `NewApplicant.tsx` form to it
- [ ] D3 · Judge enters a person → live score

## ◐ F — Official "Watheeq-style" credit report  *(UX + Feasibility · added on request)*
- [x] F1 · Redesigned `CreditReport.tsx` → document-grade layout (centered trilingual masthead, green official title + fleuron, geometric layered watermark, verification seal + QR, left security stripe, bottom document bar)
- [x] F2 · Rewrote report CSS (official green palette, security stripe, masthead, footer, print rules). Build green ✓
- [x] F3 · Honesty guardrail kept — Tabaqa-branded, NOT a government record (no KSA identity); disclaimer strengthened
- [ ] F4 · Review on screen at `/report` + Print → PDF check  ← **your turn**

---

## Log
- 2026-06-29 — tracker created. E verified already-complete (repo regulator-accurate); `PROOF.md §7` marked resolved.
- 2026-06-29 — A built: `lib/validation.ts` + `ValidationPanel.tsx` + dashboard wiring. Build green. Awaiting on-screen review (A4).
- 2026-06-29 — F: credit report restyled into an official Watheeq-inspired document (honest, Tabaqa-branded). Build green. Review at `/report`.

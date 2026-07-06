# طبقة · Tabaqa — NORTHSTAR

> **The one file to re-read when you feel lost.** Everything else (`WIN_PLAN`, `JUDGE_SCRIPT`,
> `GRIND`, `EVIDENCE`, `COMPETITION`) is ammunition; this is the map.
> If a new idea doesn't serve a row on this page, it doesn't get built.

---

## 1 · What is Tabaqa? (say it like a human)

**Saudi Arabia has ~11 million adults a bank cannot score.** They have income — salaries,
delivery-app earnings, wallet transfers — but no SIMAH credit file, so every loan application
dies at "no history." 79% of Saudi adults are banked; barely 57% have a credit file. That gap
is the market.

**Tabaqa is the scoring layer for the invisible.** With the applicant's consent, we read what
already exists — bank statements *and* digital-wallet activity (urpay, stc pay, D360) — fuse
them into one verified financial picture, and produce three things no one in KSA produces
together:

1. **A score with reasons.** A transparent additive scorecard (no black box): score 82,
   and every point traceable to a readable reason code.
2. **A decision a bank can file.** SAMA-DBR affordability check + a printable, QR-verifiable
   compliance receipt.
3. **A score turned *toward the applicant*.** Not just "declined" — *why*, *what changes it*,
   and *how much data is enough*. Nobody in the market does this; every existing
   implementation is a black box inside one lender's book.

**One sentence:** *"Tabaqa reveals the wallet income banks are blind to and turns it into a
verified, explainable credit decision — score the unscorable."*

**The demo that carries it:** Fahd, 26, delivery driver. Bank view: SAR 4,000/month, no file
→ DECLINE. Connect his wallet → verified income rises to **SAR 10,000**, score **82**,
SAMA DBR check passes → **APPROVE**. Same person, 40 seconds, decision inverted on screen.

---

## 2 · The five criteria — exactly what we serve each one

The rubric: **الابتكار · التطبيق التقني · تحليل البيانات · تجربة المستخدم · قابلية التنفيذ.**
For each: what the judge is really asking, the *artifact* we put in front of them, the one
number, and the one spoken sentence.

### ① Innovation — "is this new, or the 10th clone today?"
| | |
|---|---|
| **We serve** | The **live reveal** (4,000→10,000, DECLINE→APPROVE) — the score *inverted toward the applicant*, fusing wallet + bank. Backed by the "unbuilt lane" argument: Tamara/Tamam/Lean prove cash-flow works, but all are black boxes inside one lender; none fuses wallet+bank; none tells the declined person why. |
| **The number** | 11 million unscorable Saudis. |
| **The sentence** | "We ship the one thing no one in KSA ships — the score turned toward the applicant, fusing the wallet income banks are blind to." |
| **Status** | ✅ CLOSED — defend only (competitor re-check Jul 14–15). |

### ② Technical — "does it actually run?"
| | |
|---|---|
| **We serve** | Everything **live, judges drive it themselves**: `/demo` (no signup) on tabaqa.vercel.app · real API on tabaqa-api.vercel.app with **sandbox keys + metering** (`/developers` docs, 5-line integration) · **ALLaM** (`allam-2-7b` — the Saudi national model) generating the credit narrative in production · universal ingestion (Arabic/EN headers, Hijri dates, real bank export fingerprints) · offline `smoke_test.py` runs the whole pipeline with **zero dependencies**. |
| **The number** | 5 lines of API to integrate. |
| **The sentence** | "A reproducible, transparent engine — deployed live, keys in your hand, every point traceable to a reason code — narrated by ALLaM, the Saudi national model." |
| **Status** | ✅ Strong — tie-offs only (architecture slide, pre-demo smoke script — the stopwatch/verify rig already covers most of it). Groq Dev Tier decision open (~4 ALLaM narratives/min on free tier). |

### ③ Data — "real analysis or 'we used AI'?"
| | |
|---|---|
| **We serve** | The in-app **Model Card + Replication tab** — three real populations, one self-published negative control: **Berka** (real defaults, two independent sources): wallet layer lifts AUC **+0.203**, approved-pool default 7.6%→2.9% · **UCI Taiwan**: the falsification test — zero lift on single-source data (proof we don't manufacture numbers) · **AlfaBattle**: **963,811 real applications**, lift +0.117 at full scale · 1M-account synthetic corpus, TSTR 96% retained. Independent literature as armor: BIS 0.76 vs 0.64, FinRegLab, Fannie Mae. |
| **The number** | Speak **+0.20** only; the card carries the rest. |
| **The sentence** | "Three real populations, one negative control we published ourselves — the mechanism is proven, the magnitudes are re-fit on the bank's own book." |
| **Status** | ✅ FORMALLY FROZEN Jul 6 (P9a–c done; Replication tab eyeballed EN+AR in a real browser) — never open with statistics; this is Q&A armor (س١–س٨). |

### ④ UX — "does it feel like a real product?"  ⚠️ current sprint
| | |
|---|---|
| **We serve** | A **bank-grade bilingual app**: Arabic-first RTL + Hijri-native ledger · animated reveal · designed cards + merchant logos · tap-to-explain on every dense number · uniform loading/error states (never flickers "broken") · mobile-safe · **judge guided tour** (3-step coach card: reveal → score → lend) · **⑤ Decision-memo cockpit** (the credit-officer one-screen) · every new-applicant path stopwatched ≪60s (API cold start absorbed by a Connect-mount prefetch) · printed Arabic attestation report + QR `/verify`. |
| **The number** | 40 seconds from wallet-connect to decision. |
| **The sentence** | "Bilingual, bank-grade, Hijri-native — a lender sees the reveal and a decision in one screen." |
| **Status** | ✅ P0+P1 COMPLETE (Jul 6, two days early — U5 · U3 · U4 · U2 · mobile · 60-sec all shipped & browser-verified EN/AR/mobile). P2 polish (a11y, reveal micro-polish) only if slack after packaging. |

### ⑤ Feasibility — "could Alinma deploy this tomorrow?"
| | |
|---|---|
| **We serve** | The **compliance receipt** in the judge's hand (A4, 5 computed checks, QR → live `/verify`) · the **Decision-memo screen** — reveal delta → gauge → verdict → SAMA numbers with the circular citation → signed reasons, the one screen a credit officer files · SAMA tiered DBR enforced in-engine · the no-new-license route: read-only AIS on consent, data-processor *inside* the licensee, no PIS · ROI block (−61% bad rate → ×30 return) · FSDP inclusion meter (37% thin-file; 9.4%→20% SME-credit KPI) · monetization: per-decision API pricing, tiered like Masdr. |
| **The number** | Default rate −61% at equal approval volume. |
| **The sentence** | "Deployable inside Alinma tomorrow — read-only AIS on consent, SAMA-DBR-compliant, no new license, and the compliance officer gets a filable receipt." |
| **Status** | ✅ Strong — two slides remain (deploys-tomorrow, monetization). |

---

## 3 · The 3-minute pitch — how they get hooked

**The psychology (from the ed.1 winner, verified):** QuantumBoard won SAR 250k with a live
demo on real data + an AI story + a 60-second show — with *admittedly untested accuracy*.
The jury buys **show + live + AI**, not statistics. So: the demo leads; rigor is armor for
Q&A only. Our first 60 seconds must carry everything.

**The six beats** (full script + Arabic in `JUDGE_SCRIPT.md` — memorize openers, one number per beat):

| Beat | Time | What happens | The hook mechanism |
|---|---|---|---|
| ① **The shock** | 0:00–0:25 | "Welcome to the credit committee. One file today: Fahd, 26, delivery driver, SAR 4,000, no history. **Who approves him?**" → *2 full seconds of silence* → "You just declined him. So does every bank — and 11 million Saudis are Fahd." | The judges *commit the mistake themselves* before we speak. They're now characters in the story, not spectators. |
| ② **The thesis** | 0:25–0:45 | "The problem isn't that Fahd has no history. **His history lives where you don't look — his wallet.**" | One reframe sentence. This *is* the innovation criterion, spoken. |
| ③ **The reveal** | 0:45–1:40 | Live app, Arabic, `/demo`: connect wallet → income climbs 4,000→**10,000** with ✓-Masdr stamps → score **82** → APPROVE, SAMA check green. "Same Fahd. Same committee. Decision inverted in **40 seconds**." Tap the waterfall: "every point has a reason — glass box, no black box." | Live product on screen ≥ any slide. This single beat scores Innovation + Tech + UX simultaneously. |
| ④ **The trust minute** | 1:40–2:15 | Three breaths: proven on **real defaults, +0.20 AUC**, replicated in a second country · **Fannie Mae already lends this way** · calibrated to official Saudi numbers (GASTAT, GOSI, SAMA). | Just enough rigor to be un-dismissible — three numbers max, then stop. |
| ⑤ **The artifact** | 2:15–2:45 | Hand the head judge the **printed report**: "Scan the code." QR opens live `/verify` on *their* phone. "Full SAMA-compliant decision, filable. Integration: **5 lines of API**, no new license." | The judge *physically holds* feasibility. Their phone becomes part of the demo. |
| ⑥ **The close** | 2:45–3:00 | "Fahd didn't change today — **the system's view of him did.** 11 million Fahds get the record they deserve; banks get customers who were in front of them all along. We ask one thing: **a partner bank for the first pilot.** The decision, as you saw, takes 40 seconds." | Back to the human + one concrete ask. "Invest in these kids" = they can picture the pilot. |

**Why this sells:** it's a *story with them inside it* (they declined Fahd), a *live product*
(not a deck), a *physical object* (the receipt), an *AI-forward angle* (ALLaM narrative —
national-model optics for an Alinma/Tuwaiq jury), and a *derisked ask* (pilot, not funding
fantasy). Every criterion gets hit inside the drama, never as a checklist.

**Delivery rules:** one number per breath · the 0:20 silence is non-negotiable · phone
screen-recording of the reveal + printed report in the bag = wifi insurance · never open
with statistics.

---

## 4 · If a judge asks X → grab Y

| Attack | Weapon |
|---|---|
| "Why 1999 Czech data?" | س١ — no public Saudi defaults exist *for anyone*; mechanism proven in 2 countries; bank recalibrates at go-live (the FICO playbook). |
| "Tamara already does cash-flow" | س٧ — correct, that's our market proof (+32% approvals via Lean); but all are black boxes in one lender's book; none fuses wallet+bank; none faces the applicant. |
| "What beats SIMAH?" | س٨ one-breath — our applicant *has no file*; baseline = application form, measured on 963k apps; vs real bureaus: BIS 0.76 v 0.64; we published our own negative control. |
| "Will it keep working?" | س٥ — PSI drift monitor + direction-lock + annual recalibration, all live in-product. |
| Numbers we must NOT cite | `EVIDENCE.md` landmine list (e.g. "26M credit-invisible", "Experian +25%"). |

---

## 5 · The runway — Jul 6 → 15 (how you stay coding)

**The rule that locks this file in:** *NORTHSTAR and the strategy docs are now FROZEN.
From this commit until Jul 15, the only files that change are code — and GRIND.md checkboxes.*
If an idea isn't a checkbox on `GRIND.md`, it doesn't get built. If it feels like it deserves
a new document, it's a distraction wearing a strategy costume.

### The remaining coding queue (in order — just execute)

| When | Ship | Why it scores |
|---|---|---|
| ~~Jul 6–8~~ | ✅ **DONE Jul 6, two days early** — U4 judge tour · U2 Decision Cockpit · 60-sec path stopwatched local+prod (cold-start prefetch fix) · P9b browser eyeball | The whole ④ UX P1 sprint (④+⑤) |
| **Jul 7 →** | **Pitch deck ≤6 slides** (shock → reveal → data proof → deploys-at-Alinma → monetization → close) — pulled forward; building it also produces the ② architecture + ⑤ monetization slides | The gate deliverable (📦) |
| ~~Jul 7–8~~ | ~~2-min video~~ — DROPPED (user decision Jul 6); the live demo + deck carry the show; phone screen-recording of the reveal stays as wifi insurance | — |
| **Jul 8–9** | **Mock-judge dry run #1** — real person, live site, stopwatch (pulled forward from Jul 10) | Every stumble gets FIVE fix days instead of three |
| **Jul 10–13** | Fix dry-run findings · ② tie-offs (pre-demo smoke script — the stopwatch rig is 80% of it) · Groq Dev Tier decision · P2 polish (U6 a11y, U7) only if dry | Convert findings into points |
| **Jul 14** | ① competitor re-check · **Q&A drill س١–س٨**, spoken, timed | Q&A armor goes muscle-memory |
| **Jul 15** | **Dry run #2 · venue fallback kit · pre-demo API smoke → FULL FREEZE** | After this: rehearsal only, zero code |

### The three anti-drift rules

1. **Start every session by opening `GRIND.md`, not by asking "what should we do."** The answer is always the topmost unchecked P0/P1 box.
2. **No new evidence, no new data work, no new docs.** ③ and ① are closed; more proof has negative returns (one number per breath — there is no empty slot in the pitch).
3. **When lost, re-read §2 of this file (2 minutes), then go code.** Feeling lost is a signal to *narrow* scope, never to widen it.

---

## 6 · Doc map (where everything lives)

- `GRIND.md` (app/) — **the daily checklist**; what to do next, always.
- `JUDGE_SCRIPT.md` — the full 3-min script AR/EN + س١–س٨ spoken answers.
- `WIN_PLAN.md` — the rubric decoded + per-criterion task lists (mostly done).
- `EVIDENCE.md` — 22 verified references + landmine list.
- `COMPETITION.md` — verified competitor landscape.
- `DATA_DEFENSE.md` — the devil's-advocate hardening of the Data axis.
- `app/ALGORITHM.md` — how scoring works, judge-Q&A depth.

*Created 2026-07-06 · status refreshed 2026-07-06 evening — ④ UX sprint COMPLETE two days early · 10 days to AMAD (Jul 16–18) · Current focus: push to prod, then 📦 deck + video (pulled forward to Jul 7).*

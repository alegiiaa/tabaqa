# Kashf vs Tabaqa — the "should we switch back?" decision (2026-07-11, 5 days out)

> Written because the user asked: *validate Kashf against the 5 AMAD criteria the way we did
> Tabaqa, and tell me honestly — is Kashf actually better? (worry: Tabaqa feels "like Sentry,"
> a 2025 winner.)* This file is the answer. **Verdict: do NOT switch. Stay on Tabaqa.**

---

## The one-paragraph answer

Kashf is a good idea that was already killed for three structural reasons that are *more* true
today, not less. It is **not built** (M0 skeleton) with 5 days left, while Tabaqa is **live and
demo-ready**. And the "resembles a past winner" fear is pointed at the wrong product: **Tabaqa
does not really resemble Sentry — but Kashf strongly resembles QuantumBoard (2025 1st place)**,
which is exactly why the team retired the agent-debate framing back in May. Switching to Kashf to
escape a resemblance would run *into* a stronger one.

---

## The 5 official criteria (AMAD 2026, no published weights)

الابتكار · التطبيق التقني · تحليل البيانات · تجربة المستخدم · قابلية التنفيذ الفعلي

Scored 1–10, judged the way the rubric is judged. Kashf scored **as it stands today** (skeleton),
with its ceiling-if-fully-built in brackets.

| # | Criterion | Kashf (today [ceiling]) | Tabaqa | Why |
|---|---|---|---|---|
| ① | **Innovation & Creativity** | **5** [6] | **7.5** | Kashf's "7 agents debate a loan live" is (a) the **QuantumBoard 2025-winner recipe**, (b) already shipped in substance by **Abwab.ai** (Saudi AI SME underwriter, Arabic, SAR 100bn target), (c) a **published 2025 mechanism** (arXiv PMADS/CreditXAI). Novelty is theater, not substance. Tabaqa's applicant-facing transparency + bank/wallet fusion survived ~15 refutation passes — "almost nobody on earth." |
| ② | **Technical Implementation** | **4** [7] | **8.5** | Kashf = M0 skeleton; a half-working multi-agent demo in front of an **Apple-trained UX judge** is a real risk. Tabaqa = live app + live API w/ sandbox keys + **ALLaM in production** + offline smoke test; judges drive it themselves. |
| ③ | **Data Analysis** *(underrated axis)* | **5** [6] | **9** | Kashf's "analysis" is LLM debate narration — soft on hard metrics. Tabaqa ships an in-app **Model Card**: Berka +0.203 AUC lift, UCI negative control, AlfaBattle 963k real apps, TSTR 96%. Likely the strongest data story in the room. |
| ④ | **User Experience** | **4** [7] | **8.5** | Kashf's debate view is visually cool but B2B credit-officer-facing and **not built**. Tabaqa = bank-grade bilingual RTL, 40-sec live reveal (4,000→10,000, DECLINE→APPROVE), mobile-safe, decision-memo cockpit, printed Arabic attestation + QR. Apple-judge bait. |
| ⑤ | **Practical Feasibility** *(Alinma-judge axis)* | **4.5** [6] | **7.5** | Kashf dies on **WRONG-BOTTLENECK**: the binding KSA SME constraint is collateral / risk-appetite, not scoring capability — a better score yields a more confident *"no,"* not a new loan. Plus "why not just call Lean+Synapse / Abwab?" Tabaqa: no-new-license route, SAMA-DBR in-engine, compliance receipt in hand, real inclusion KPI (11M unscorable). |
| | **TOTAL /50** | **22.5** [32] | **41** | Decisive gap even at Kashf's built-out ceiling. |

---

## The three kill-shots on Kashf — now *worse* than when we dropped it (2026-06-10)

1. **Wrong-bottleneck (structural, unchanged).** Scoring isn't the Saudi SME-lending constraint;
   collateral and risk-appetite are — that's *why* the SAR 123bn Kafalah guarantee book exists.
   SIMAH already ships SME scoring. A sharper committee produces a more articulate rejection.
2. **Already solved / no moat (now much worse).** In June this was "Lean+Synapse shipped the pipe."
   Today it's also **Abwab.ai** — a *Saudi-built* AI SME credit engine, Arabic-native, integrates
   Lean+Tarabut, ~$400M processed, **eyeing SAR 100bn in 2026**, just partnered with Tuum for
   end-to-end GCC SME lending. Kashf's entire "Saudi + Arabic + multi-source + AI underwriting"
   moat is *occupied by a funded incumbent.* Kashf's only unshipped bit is the debate theater.
3. **Not built, 5 days out.** kashf-api is an "M0 skeleton" commit. Tabaqa is live on Vercel with a
   metered API, ALLaM narration, frozen model card, and a rehearsed judge script. You cannot
   rebuild that surface area for a different product in 5 days without torching your best asset.

---

## The Sentry worry — the premise is backwards

**What Sentry was (2025, likely 3rd):** Yousef Al-Mutairi's project — a *monitoring / sentinel*
agent, fraud/compliance-flavored (RegTech shape). A watchdog.

**What Tabaqa is:** a *credit-inclusion score* for the 11M Saudis a bank can't rate — Open Banking
track, a completely different user, problem, and output. The only thing that even rhymes with
Sentry is Tabaqa's **secondary** "درع طبقة" fraud-flag. That's a minor feature, not the headline.
**If it's causing confusion, de-emphasize or drop it** — the score-turned-toward-the-applicant is
the whole pitch.

Three things follow:

- **Tabaqa ≠ Sentry** in any load-bearing way. Different track (Open Banking didn't exist in 2025),
  different problem, different product shape.
- **Resembling a past winner isn't disqualifying anyway.** 2 of 3 2025 podium teams were agentic;
  judges *rewarded* the recipe. Different year, different (likely new) judges, new track.
- **The irony:** the product that actually resembles a 2025 winner is **Kashf**, not Tabaqa.
  Kashf's hero moment — "watch the agents debate live on real data" — *is* QuantumBoard (2025 1st).
  The team already spotted this in May and retired the investor-agent version for exactly this
  reason ("QuantumBoard but Arabic"). Switching to Kashf to dodge a resemblance walks into a bigger
  one.

**So "it looks like a past winner" is an argument to keep Tabaqa, not to leave it.**

---

## If what you actually miss is the *agentic wow*

Kashf's real temptation is the theatrical demo. You don't need to switch products to get it:
graft a lightweight **"committee narration"** on top of Tabaqa's existing reveal. ALLaM already
narrates the decision — frame the reason-codes as 2–3 named voices (cash-flow, affordability,
risk) converging on the score. You get the QuantumBoard-style spectacle *without* the wrong-
bottleneck, the Abwab collision, or a 5-day rebuild.

---

## Recommendation

1. **Stay on Tabaqa.** It wins 4 of 5 criteria outright and ties on none that matter.
2. **Do not re-open the Kashf question again** — it's now been killed twice on the same structural
   grounds, and the market moved against it (Abwab at SAR 100bn).
3. If you want more demo drama, add the **committee-narration layer** on Tabaqa's reveal.
4. Keep the planned **Jul 14–15 competitor re-check** (Abwab / Tamam×FICO / Qarar / Tarabut-Servable).
5. Consider dropping or hiding **درع طبقة** if it's what triggered the "this is Sentry" read.

*Sources: Abwab.ai (thefintechtimes.com, sharikatmubasher.com, abwab.ai); Lean×Synapse
(openbankingexpo.com, wamda.com); AMAD official criteria (docs/research/01); Kashf validation
(project_kashf_validation, 2026-06-02); Tabaqa NORTHSTAR + COMPETITION.*

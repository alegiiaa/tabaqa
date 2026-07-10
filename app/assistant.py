"""The in-app Tabaqa assistant — a conversational guide for new users.

Claude-powered when ``ANTHROPIC_API_KEY`` is set (a real assistant that answers
"how do I connect my bank?" and walks the user through the app); degrades to a
bilingual keyword-FAQ so the widget is still helpful offline. The Anthropic key
never leaves the server — the browser talks only to ``/v1/assistant``.
"""
from __future__ import annotations

import json
import re

from pipeline import llm

_SECTION_HINT = {
    "home": "the Dashboard (their money overview + the Financial Intelligence panel)",
    "income": "the Income & Score screen (the bank-vs-true-income reveal and why the score is what it is)",
    "ledger": "the Ledger (unified bank + wallet activity, each labelled with a standard category)",
    "financing": "the Financing screen (how much they can borrow, with SAMA debt-burden caps)",
    "connect": "the Connect screen (linking a bank + wallet, or uploading their own statement)",
    "applicants": "the Applicants screen (lender tools to score other people)",
}

_SYSTEM = """You are **Tabaqa Guide**, the friendly in-app assistant for Tabaqa — \
"the credit-intelligence layer for Saudi open banking."

WHAT TABAQA DOES (so you can explain it):
- A bank statement only shows part of someone's income. Gig pay (Jahez, HungerStation, \
Mrsool), P2P, and side income often land in a digital WALLET (Barq, urpay) the bank can't see.
- Tabaqa pulls BOTH bank + wallet (with consent), cleans & verifies the data, and reveals \
the person's TRUE income — then gives a 1-99 score, a risk flag, and how much they can safely borrow.
- The demo user "Fahd" looks like SAR 4,000 to a bank but truly earns SAR 10,000 (score 82).

HOW TO USE THE APP (guide the user to the right click):
- CONNECT: On the Connect screen, keep "Demo data" to try it instantly — pick a bank (e.g. \
Al Rajhi) and a wallet (Barq), then press Reveal to watch income count up 4,000 -> 10,000. \
To use THEIR OWN data, toggle "My data", pick a bank + wallet for branding, then upload a CSV \
of their statement (columns: date, description, amount [+ for money in, - for out], source [bank or wallet]).
- DASHBOARD: shows the reveal, key numbers, account cards, and the Financial Intelligence panel \
(a plain-language read of their money: income trend, savings, runway, risks).
- INCOME & SCORE: the bank-only vs true-income reveal + the 3-tier verification (Masdr-verified \
salary, source-verified gig, inferred P2P) and the reason codes behind the score.
- LEDGER: every bank + wallet transaction, labelled with an industry-standard Plaid category.
- FINANCING: enter a loan amount/tenor/rate -> see the installment, debt-burden ratio, and an \
APPROVE/REVIEW/DECLINE decision under the real SAMA responsible-lending caps (33.33% for \
employees, 25% for retirees). It contrasts what bank-only income vs verified income would unlock.

STYLE:
- Warm, concise, encouraging. 2-4 short sentences. Point to the exact button/screen to click next.
- If the user writes in Arabic, reply in Arabic. Otherwise reply in English.
- You are a GUIDE, not a financial advisor. Don't invent numbers beyond the demo facts above. \
For anything outside the app, gently steer back to helping them use Tabaqa.
- If they seem new, proactively offer the next step (e.g. "Want to try it? Head to Connect and \
press Reveal.").
- You can OPEN screens for the user: if they ask to see financing/borrowing, their score, their \
income, their transactions, or the developer docs, the app will navigate there automatically — so \
confirm briefly and naturally (e.g. "Opening your Financing screen — here's what you can borrow…"). \
You never control their computer; you only move around inside Tabaqa."""


def _system(context: dict | None) -> str:
    ctx = context or {}
    extra = []
    section = ctx.get("section")
    if section in _SECTION_HINT:
        extra.append(f"The user is currently on {_SECTION_HINT[section]}.")
    if ctx.get("connected") is False:
        extra.append("The user has NOT connected accounts yet — nudge them to Connect.")
    elif ctx.get("connected") is True:
        extra.append("The user is already connected; help them explore their results.")
    out = _SYSTEM + ("\n\nCONTEXT: " + " ".join(extra) if extra else "")
    facts = ctx.get("facts")
    if isinstance(facts, dict) and facts:
        out += _facts_prompt(facts)
    return out


# ── grounded facts: the Ask-Tabaqa hero moment ───────────────────────────────
# The frontend sends the applicant's ACTUAL scoring output (score, income reveal,
# recourse steps) as `context.facts`. Those become the assistant's only source of
# numbers, enforced by a post-generation firewall: any number in the reply that
# doesn't trace back to the fact set discards the reply for a deterministic
# answer built from the same facts. If the model invents a number, nobody sees it.

def _facts_prompt(facts: dict) -> str:
    facts = json.loads(json.dumps(facts, ensure_ascii=False, default=str))  # deep copy
    # Pre-translate recourse features into human actions so the model narrates
    # instead of improvising ("action_ar"/"action_en" become its wording).
    for s in ((facts.get("recourse") or {}).get("steps") or []):
        en, ar = _RECOURSE_ACTION.get(s.get("feature", ""), (s.get("feature", ""), s.get("feature", "")))
        s["action_en"], s["action_ar"] = en, ar
    return (
        "\n\nGROUNDED FACTS — this user's REAL results, computed by the scoring engine "
        "(authoritative):\n" + json.dumps(facts, ensure_ascii=False, default=str)
        + "\n\nHARD RULES for these facts:\n"
        "- They are the ONLY numbers you may use. NEVER invent, estimate, or extrapolate a number.\n"
        "- The demo 'Fahd' example numbers above may NOT match this user — when GROUNDED FACTS "
        "are present, use them and only them.\n"
        "- 'Why is my score X?' → answer from the income reveal + top_reasons (points are additive).\n"
        "- 'How do I improve / reach Y?' → list EXACTLY the recourse.steps given — never add, drop, "
        "or invent an extra step or advice item. Each step = its action_ar (Arabic) or action_en "
        "(English) + its `gain` in points. Then the projected score.\n"
        "- Write the ENTIRE reply in one language only. An Arabic question gets a PURE Arabic reply "
        "with ZERO English words or sentences.\n"
        "- Never mention internal field or screen names (recourse, verified_income_share, JSON keys) "
        "— only the human actions.\n"
        "- Say 'indicative, not a promise' (استرشادي وليس وعدًا) AT MOST ONCE, at the end.\n"
        "- Maximum 4 short sentences plus the step list. No repetition, no closing pep talk.\n\n"
        "REFERENCE ANSWERS for the score/improve question — every number verified by the engine. "
        "Anchor on the one matching the user's language; rephrase it naturally and answer the "
        "user's actual question (never copy anything with braces):\n"
        "Arabic:\n" + (_grounded_answer(facts, True) or "") + "\n"
        "English:\n" + (_grounded_answer(facts, False) or "")
    )


# Arabic-Indic + Eastern digits → Western; Arabic decimal/thousands marks normalised.
_DIGIT_TRANS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹٫٬", "01234567890123456789.,")


def _numbers_in(text: str) -> list[float]:
    t = (text or "").translate(_DIGIT_TRANS)
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)  # strip thousands separators
    return [float(m) for m in re.findall(r"\d+(?:\.\d+)?", t)]


def _allowed_numbers(facts: dict) -> set[float]:
    """Every number derivable from the fact set (plus harmless small counts)."""
    allowed: set[float] = set(float(x) for x in range(0, 13))  # step counts, months
    allowed.update({99.0, 100.0})  # the score scale + percent base

    def add(v: float) -> None:
        v = float(v)
        allowed.add(abs(v))
        allowed.add(float(round(abs(v))))
        if 0 < abs(v) <= 1:  # shares → percent form ("0.55" may be spoken as "55%")
            allowed.add(round(abs(v) * 100, 2))
            allowed.add(float(round(abs(v) * 100)))

    def walk(o) -> None:
        if isinstance(o, bool):
            return
        if isinstance(o, (int, float)):
            add(o)
        elif isinstance(o, str):
            for n in _numbers_in(o):
                add(n)
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, (list, tuple)):
            for v in o:
                walk(v)

    walk(facts)
    return allowed


def _reply_grounded(reply: str, facts: dict) -> bool:
    allowed = _allowed_numbers(facts)
    for n in _numbers_in(reply):
        ok = any(abs(n - a) <= 0.011 or (a and abs(n - a) / abs(a) <= 0.005) for a in allowed)
        if not ok:
            return False
    return True


# Brand/technical terms that are fine inside an Arabic reply.
_LATIN_OK = {"tabaqa", "sama", "nsf", "sar", "api", "urpay", "stc", "barq", "masdr", "allam"}


def _reply_clean(user_text: str, reply: str) -> bool:
    """Stage-quality gate: no leaked template braces, and the reply stays in the
    user's language — a 7B model sometimes drifts mid-answer, which reads broken."""
    if "{" in reply or "}" in reply:
        return False
    if _is_arabic(user_text):
        latin = [w for w in re.findall(r"[A-Za-z]{3,}", reply) if w.lower() not in _LATIN_OK]
        return len(latin) <= 2
    letters = re.findall(r"[A-Za-z؀-ۿ]", reply)
    arabic = re.findall(r"[؀-ۿ]", reply)
    return not letters or len(arabic) / len(letters) < 0.3


# Recourse action labels (mirror web RecoursePanel.ACTION) for the deterministic answer.
_RECOURSE_ACTION = {
    "verified_income_share": ("Verify more income — connect another account",
                              "وثّق المزيد من الدخل — اربط حسابًا آخر"),
    "nsf_count": ("Avoid overdrafts", "تجنّب السحب على المكشوف"),
    "min_balance": ("Keep a positive balance buffer", "احتفظ برصيد احتياطي موجب"),
    "balance_volatility": ("Steady your account balance", "ثبّت رصيد حسابك"),
    "income_expense_ratio": ("Spend under your income", "أنفق أقل من دخلك"),
    "recurring_obligation_load": ("Reduce recurring debt", "قلّل الديون المتكررة"),
    "income_regularity": ("Receive income on a regular schedule", "استلم الدخل بجدول منتظم"),
}

_SCORE_INTENT = ("score", "improve", "reach", "why", "explain", "raise", "better",
                 "درج", "ليش", "لماذا", "أوصل", "اوصل", "حسّن", "حسن", "ارفع", "اشرح", "تتحسن")


def _grounded_answer(facts: dict, ar: bool) -> str | None:
    """Deterministic hero answer from the fact set — the firewall/offline fallback."""
    score = facts.get("score")
    if score is None:
        return None
    inc = facts
    hidden = inc.get("hidden_income_revealed_sar")
    parts: list[str] = []
    if ar:
        parts.append(f"درجتك **{score}** من 99.")
        if hidden:
            parts.append(f"وثّقنا دخلًا إضافيًا قدره {round(hidden):,} ر.س لا يظهر في كشف البنك وحده — "
                         "هذا أهم ما رفع درجتك.")
    else:
        parts.append(f"Your score is **{score}** of 99.")
        if hidden:
            parts.append(f"We verified SAR {round(hidden):,} of income your bank statement alone "
                         "can't see — the biggest lift behind your score.")
    rec = facts.get("recourse") or {}
    if rec.get("already_prime"):
        parts.append("هذا الملف مؤهّل للموافقة بالفعل — لا يلزم أي إجراء." if ar
                     else "This profile already qualifies for approval — no action needed.")
    elif rec.get("steps"):
        target, proj = rec.get("target_score"), rec.get("projected_score")
        head = (f"أقصر طريق إلى **{target}**:" if ar else f"The shortest path to **{target}**:")
        steps = []
        for s in rec["steps"][:3]:
            en, arr = _RECOURSE_ACTION.get(s.get("feature", ""), (s.get("feature", ""), s.get("feature", "")))
            steps.append(f"{arr if ar else en} (+{s.get('gain')})")
        parts.append(head + " " + " · ".join(steps) + ".")
        if proj is not None:
            parts.append(f"بتطبيقها تصل درجتك الاسترشادية إلى ≈ {proj} — استرشادي وليس وعدًا."
                         if ar else
                         f"Do these and your indicative score is ≈ {proj} — indicative, not a promise.")
    return "\n".join(parts)


# ── bilingual keyword fallback (used when no API key is set) ──────────────────
def _is_arabic(text: str) -> bool:
    return bool(re.search(r"[؀-ۿ]", text or ""))


_FALLBACK = [
    (("connect", "link", "bank", "wallet", "ربط", "حساب", "بنك", "محفظ"),
     ("To connect, go to the **Connect** screen. Keep **Demo data** and pick a bank (e.g. Al Rajhi) "
      "+ a wallet (Barq), then press **Reveal**. To use your own statement, toggle **My data** and "
      "upload a CSV (date, description, amount, source).",
      "للربط، افتح شاشة **الربط**. أبقِ **البيانات التجريبية** واختر بنكًا (مثل الراجحي) ومحفظة (برق) ثم اضغط "
      "**اكشف**. ولاستخدام بياناتك، فعّل **بياناتي** وارفع ملف CSV (التاريخ، الوصف، المبلغ، المصدر).")),
    (("score", "rating", "82", "1-99", "درجة", "تقييم"),
     ("Your Tabaqa Score is 1-99 (higher = lower risk). It's built from your verified cash-flow — "
      "income regularity, balance buffer, obligations. Open **Income & Score** to see every reason behind it.",
      "درجة Tabaqa من ١ إلى ٩٩ (الأعلى = مخاطر أقل)، وتُبنى من تدفقك النقدي الموثّق — انتظام الدخل والرصيد "
      "والالتزامات. افتح **الدخل والدرجة** لرؤية أسباب الدرجة.")),
    (("income", "reveal", "verify", "true", "دخل", "كشف", "توثيق", "حقيقي"),
     ("Tabaqa reveals income your bank can't see — wallet + gig pay. It verifies each source in 3 tiers "
      "(Masdr-verified salary, source-verified gig, inferred P2P). See it on the **Income & Score** screen.",
      "تكشف Tabaqa دخلًا لا يراه بنكك — المحفظة ودخل التوصيل. وتوثّق كل مصدر على ٣ مستويات. شاهد ذلك في "
      "شاشة **الدخل والدرجة**.")),
    (("upload", "csv", "file", "own data", "my data", "statement", "رفع", "ملف", "بياناتي", "كشف حساب"),
     ("Use **My data**: on Connect, toggle **My data**, pick a bank + wallet, then upload a CSV with "
      "columns date, description, amount (+ in / - out), and source (bank or wallet). Tabaqa scores YOUR statement.",
      "استخدم **بياناتي**: في شاشة الربط فعّل **بياناتي**، اختر بنكًا ومحفظة، ثم ارفع ملف CSV بأعمدة: التاريخ، "
      "الوصف، المبلغ (+ داخل / - خارج)، المصدر (بنك أو محفظة).")),
    (("afford", "loan", "borrow", "financ", "dbr", "sama", "تمويل", "قرض", "اقتراض", "ساما"),
     ("Open **Financing**, enter an amount/tenor/rate, and press **Calculate**. You'll see the installment, "
      "debt-burden ratio, and an APPROVE/REVIEW/DECLINE under the real SAMA caps (33.33% employees / 25% retirees).",
      "افتح **التمويل**، أدخل المبلغ والمدة والنسبة واضغط **احسب**. سترى القسط ونسبة الدين وقرار "
      "موافقة/مراجعة/رفض وفق سقوف ساما (٣٣٫٣٣٪ للموظفين / ٢٥٪ للمتقاعدين).")),
    (("api", "developer", "endpoint", "integrate", "docs", "واجهة", "مطور", "برمجي"),
     ("Tabaqa is API-first. See the **Developers** page for the endpoints (/v1/score, /v1/insights, "
      "/v1/affordability) with copy-paste examples, or the live API docs at /docs.",
      "Tabaqa مبنية على واجهة برمجية. اطلع على صفحة **المطورين** للنقاط البرمجية مع أمثلة جاهزة، أو وثائق "
      "الواجهة المباشرة على /docs.")),
]

_GREETING = (
    "Hi! I'm your Tabaqa guide 👋 I can help you connect accounts, understand your score, explore "
    "financing, or use your own data. What would you like to do?",
    "أهلًا! أنا مرشد Tabaqa 👋 أستطيع مساعدتك في ربط الحسابات، فهم درجتك، استكشاف التمويل، أو استخدام بياناتك. "
    "ماذا تودّ أن تفعل؟",
)


def _fallback_reply(user_text: str) -> str:
    ar = _is_arabic(user_text)
    low = (user_text or "").lower()
    for keys, (en, arr) in _FALLBACK:
        if any(k in low or k in (user_text or "") for k in keys):
            return arr if ar else en
    return _GREETING[1] if ar else _GREETING[0]


# ── in-app actions the command bar can execute (deterministic = demo-safe) ────
# Each (keywords, action). The bar navigates within the app — never the OS.
_ACTIONS = [
    (("financ", "borrow", "loan", "afford", "dbr", "installment", "قرض", "تمويل", "أقترض", "اقترض", "قسط"),
     {"type": "navigate", "section": "financing", "target": None}),
    (("ledger", "transaction", "activity", "spending", "عمليات", "سجل", "معامل", "مصروف"),
     {"type": "navigate", "section": "ledger", "target": None}),
    (("score", "rating", "reason", "why 82", "درجة", "تقييم"),
     {"type": "navigate", "section": "income", "target": None}),
    (("income", "reveal", "verify", "salary", "دخل", "كشف", "توثيق", "راتب"),
     {"type": "navigate", "section": "income", "target": None}),
    (("developer", "api", "endpoint", "integrate", "docs", "مطور", "واجهة", "برمجي", "وثائق"),
     {"type": "open", "section": None, "target": "developers"}),
    (("dashboard", "home", "overview", "my money", "رئيسية", "الرئيسية", "أموالي"),
     {"type": "navigate", "section": "home", "target": None}),
]

_NO_ACTION = {"type": "none", "section": None, "target": None}


def derive_action(user_text: str) -> dict:
    """Map a request to an in-app action (navigate/open). Deterministic → reliable on stage."""
    low = (user_text or "").lower()
    for keys, act in _ACTIONS:
        if any(k in low or k in (user_text or "") for k in keys):
            return dict(act)
    return dict(_NO_ACTION)


def _suggestions(context: dict | None, ar: bool = False) -> list[str]:
    connected = (context or {}).get("connected")
    if connected is False or connected is None:
        return (["كيف أربط حسابي؟", "وش هو كشف الدخل الحقيقي؟", "أقدر أرفع كشف حسابي؟"] if ar else
                ["How do I connect my bank?", "What is the income reveal?", "Can I upload my own statement?"])
    return (["وش تعني درجتي؟", "كم أقدر أقترض؟", "كيف يتم توثيق دخلي؟"] if ar else
            ["What does my score mean?", "How much can I borrow?", "How is my income verified?"])


def respond(messages: list[dict], context: dict | None = None) -> dict:
    """Return {reply, suggestions, source}. Claude when available, else FAQ fallback."""
    history = [{"role": m["role"], "content": m["content"]} for m in messages
               if m.get("role") in ("user", "assistant") and m.get("content")]
    # Anthropic requires the first message to be from the user — drop any leading
    # assistant turns (e.g. the widget's seeded greeting) so the live call doesn't 400.
    while history and history[0]["role"] != "user":
        history.pop(0)
    if not history or history[-1]["role"] != "user":
        return {"reply": _GREETING[0], "suggestions": _suggestions(context),
                "source": "rules", "action": dict(_NO_ACTION)}

    last_user = history[-1]["content"]
    action = derive_action(last_user)  # deterministic, works with or without a key
    facts = (context or {}).get("facts")
    facts = facts if isinstance(facts, dict) and facts else None
    ar = _is_arabic(last_user)

    reply = llm.chat(model=llm.ASSISTANT_MODEL, system=_system(context),
                     messages=history, max_tokens=600, temperature=0.35)
    if reply and facts and not (_reply_grounded(reply, facts) and _reply_clean(last_user, reply)):
        # The grounding firewall: the model used a number that isn't in the fact
        # set (or drifted languages) → the reply is never shown; serve the
        # deterministic answer instead. Silent by design — no error state on stage.
        grounded = _grounded_answer(facts, ar)
        if grounded:
            return {"reply": grounded, "suggestions": _suggestions(context, ar),
                    "source": "rules:firewall", "action": action}
        reply = None
    if reply:
        return {"reply": reply, "suggestions": _suggestions(context, ar),
                "source": f"{llm.PROVIDER_TAG}:{llm.ASSISTANT_MODEL}", "action": action}
    # LLM unavailable (no key / 429 / network): score-and-recourse questions still
    # get a real grounded answer — the show never breaks on stage.
    if facts and any(k in last_user.lower() or k in last_user for k in _SCORE_INTENT):
        grounded = _grounded_answer(facts, ar)
        if grounded:
            return {"reply": grounded, "suggestions": _suggestions(context, ar),
                    "source": "rules", "action": action}
    return {"reply": _fallback_reply(last_user), "suggestions": _suggestions(context, ar),
            "source": "rules", "action": action}

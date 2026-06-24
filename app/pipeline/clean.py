"""[1] Clean / normalize Arabic transaction strings.

Design principle (the team's playbook): *engines decide, the LLM cleans.*
Deterministic normalization + a small rule set handle the known ~80%. The messy
Arabic long-tail is where CAMeL Tools and Claude Opus 4.8 plug in — see
`clean_with_llm` for the integration point.
"""
from __future__ import annotations

import re

# Arabic diacritics (tashkeel) + tatweel — strip for matching.
_DIACRITICS = re.compile(r"[ؗ-ًؚ-ْـ]")
# Arabic-Indic digits → Western, so "برق ٨٨٤٢" matches "برق 8842".
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def normalize(text: str) -> str:
    """Lowercase Latin, fold Arabic digits, strip diacritics, collapse spaces.

    Deterministic and dependency-free. In production, CAMeL Tools'
    `normalize_unicode` / dediac handle the harder orthographic variants.
    """
    if not text:
        return ""
    t = text.translate(_AR_DIGITS)
    t = _DIACRITICS.sub("", t)
    # unify common Arabic letter variants
    t = (
        t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
        .replace("ى", "ي").replace("ة", "ه")
    )
    t = re.sub(r"\s+", " ", t).strip()
    return t.lower()


def clean_with_llm(raw_desc: str) -> str:  # pragma: no cover - integration stub
    """Resolve a long-tail Arabic string the rules can't.

    Production: route to Claude Opus 4.8 with a cached prompt that returns
    {merchant, category, type}. Stubbed here so the pipeline runs offline.
    """
    return normalize(raw_desc)


def clean(raw_desc: str) -> str:
    """Public entry — returns the normalized form used by the enricher."""
    return normalize(raw_desc)

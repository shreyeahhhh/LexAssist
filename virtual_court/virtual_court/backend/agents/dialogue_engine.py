"""
Dialogue engine for the Virtual Courtroom.

This module wraps a Groq client with carefully-crafted Indian-court prompts so
the judge, opposing counsel, and analyzer feel like real participants rather
than templated bots. Each public function falls back to ``None`` on any error,
allowing the legacy template responses in ``judge_agent`` /
``opposing_lawyer_agent`` to take over without crashing the session.

Educational use only. NOT legal advice.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from .indian_court_kb import (
    build_legal_context,
    format_few_shots_for_prompt,
    format_provisions_for_prompt,
    format_cases_for_prompt,
    random_phrase,
)


# ---------------------------------------------------------------------------
# COMMON HELPERS
# ---------------------------------------------------------------------------

_INDIAN_COURT_STYLE_GUIDE = """
You are participating in an Indian District/High Court hearing simulation.
Hard rules for ALL responses:
- BE BRIEF. Real Indian-court exchanges are short and crisp. Never deliver lectures.
- Speak in formal Indian-court English (or Malayalam if asked).
- Address the bench as "My Lord", "Your Lordship", or "the court".
- Refer to the other side as "my learned friend" / "the learned counsel for the plaintiff".
- Cite the Bharatiya Nyaya Sanhita (BNS, 2023), Bharatiya Nagarik Suraksha Sanhita
  (BNSS, 2023), and Bharatiya Sakshya Adhiniyam (BSA, 2023) — not IPC/CrPC/IEA — only when
  it sharpens the point. Do NOT invent section numbers.
- Where a precedent is on point, cite by short name (e.g. Anvar P.V., Arjun Panditrao).
- Never give legal advice; you are an in-court participant addressing the bench.
- Vary your openings. Do NOT preface every turn with the same phrase.
- Hard length cap unless told otherwise: ONE sentence is best, two is the maximum.
""".strip()


def _safe_json_load(content: str) -> Optional[Dict[str, Any]]:
    """Tolerantly parse JSON from an LLM response that may contain prose around it."""
    if not content:
        return None
    try:
        return json.loads(content)
    except Exception:
        pass
    # try to recover the first balanced JSON object
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except Exception:
        return None


def _truncate(text: str, limit: int = 1200) -> str:
    if not text:
        return ""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    return text[:limit] + " …"


def _is_timeout_error(error: BaseException) -> bool:
    """Detect Groq/httpx timeouts without importing httpx directly."""
    name = type(error).__name__.lower()
    msg = str(error).lower()
    if "timeout" in name or "timeout" in msg or "timed out" in msg:
        return True
    # groq.APITimeoutError subclasses APIError; treat any matching class name as a timeout.
    return name in ("apitimeouterror", "readtimeout", "connecttimeout", "writetimeout")


def _chat(groq_client: Any, model: str, system: str, user: str,
          temperature: float = 0.45, max_tokens: int = 500,
          timeout: float = 25.0, retries: int = 1) -> Optional[str]:
    """
    One Groq chat-completion call with explicit per-request timeout and a single
    retry on a timeout error. Returns None on hard failure so the caller can
    fall back to a template response.
    """
    if not groq_client:
        return None
    attempts = 0
    last_error: Optional[BaseException] = None
    while attempts <= retries:
        try:
            response = groq_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
            )
            content = (response.choices[0].message.content or "").strip()
            return content or None
        except Exception as error:  # pragma: no cover
            last_error = error
            if _is_timeout_error(error) and attempts < retries:
                print(
                    f"Groq dialogue timeout (attempt {attempts + 1}/"
                    f"{retries + 1}); retrying once."
                )
                attempts += 1
                continue
            break
    if last_error is not None:
        kind = "timeout" if _is_timeout_error(last_error) else type(last_error).__name__
        print(f"Groq dialogue {kind}:", str(last_error)[:240])
    return None


# ---------------------------------------------------------------------------
# 1) ARGUMENT ANALYZER  (the "inner-meaning understanding" layer)
# ---------------------------------------------------------------------------

_ANALYZER_SYSTEM = (
    "You are a senior legal analyst sitting in an Indian courtroom. "
    "Read the plaintiff counsel's submission and extract the inner meaning, "
    "the legal grounds being implied, and the weak points. "
    "Output STRICT JSON only — no prose, no markdown."
)

_ANALYZER_SCHEMA_HINT = """
Return JSON with exactly these keys:
{
  "factual_claims":      [string, ...],   // 1-5 concrete facts the counsel asserts
  "legal_grounds":       [string, ...],   // legal theories implied (e.g. "negligence", "breach of contract", "theft under BNS s.303", "violation of natural justice")
  "evidence_referenced": [string, ...],   // each piece of evidence mentioned (CCTV, contract, witness, etc.)
  "cited_provisions":    [string, ...],   // any BNS/BNSS/BSA/IPC/CrPC sections explicitly mentioned
  "implicit_intent":      string,         // ONE sentence: what the counsel is really asking the court to find
  "weaknesses":          [string, ...],   // gaps an opposing counsel could exploit (hearsay, no s.63 BSA cert, no causation, vague dates, etc.)
  "tone":                 string          // "confident" | "cautious" | "emotional" | "procedural" | "vague"
}
"""


def analyze_argument(
    groq_client: Any,
    model: str,
    transcript: str,
    *,
    stage: str,
    case_data: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Use Groq to extract structured insight from the plaintiff counsel's words."""
    if not transcript or not transcript.strip():
        return None

    user_prompt = (
        f"Stage: {stage}\n"
        f"Case title: {case_data.get('title','(user case)')}\n"
        f"Plaintiff: {case_data.get('plaintiff','-')}\n"
        f"Defendant: {case_data.get('defendant','-')}\n"
        f"Claim: {case_data.get('claim','-')}\n"
        f"Defense position: {case_data.get('defense','-')}\n\n"
        f"Plaintiff counsel just said:\n\"\"\"{_truncate(transcript, 1400)}\"\"\"\n\n"
        f"{_ANALYZER_SCHEMA_HINT}"
    )

    raw = _chat(
        groq_client, model,
        system=_ANALYZER_SYSTEM,
        user=user_prompt,
        temperature=0.1,
        max_tokens=550,
    )
    parsed = _safe_json_load(raw or "")
    if not parsed:
        return None

    # Normalise: ensure every expected key exists and is the right type
    def _as_list(v: Any) -> List[str]:
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str) and v.strip():
            return [v.strip()]
        return []

    return {
        "factual_claims":      _as_list(parsed.get("factual_claims")),
        "legal_grounds":       _as_list(parsed.get("legal_grounds")),
        "evidence_referenced": _as_list(parsed.get("evidence_referenced")),
        "cited_provisions":    _as_list(parsed.get("cited_provisions")),
        "implicit_intent":     str(parsed.get("implicit_intent", "")).strip(),
        "weaknesses":          _as_list(parsed.get("weaknesses")),
        "tone":                str(parsed.get("tone", "")).strip(),
    }


def summarise_analysis(analysis: Optional[Dict[str, Any]]) -> str:
    """Compact textual summary of an analysis, suitable for downstream prompts."""
    if not analysis:
        return "(no structured analysis available)"
    parts: List[str] = []
    if analysis.get("implicit_intent"):
        parts.append(f"Implicit ask: {analysis['implicit_intent']}")
    if analysis.get("factual_claims"):
        parts.append("Facts asserted: " + "; ".join(analysis["factual_claims"][:5]))
    if analysis.get("legal_grounds"):
        parts.append("Legal grounds implied: " + "; ".join(analysis["legal_grounds"][:5]))
    if analysis.get("evidence_referenced"):
        parts.append("Evidence referenced: " + "; ".join(analysis["evidence_referenced"][:5]))
    if analysis.get("cited_provisions"):
        parts.append("Sections cited by counsel: " + "; ".join(analysis["cited_provisions"][:5]))
    if analysis.get("weaknesses"):
        parts.append("Weaknesses (for the bench/opposing): " + "; ".join(analysis["weaknesses"][:5]))
    if analysis.get("tone"):
        parts.append(f"Tone: {analysis['tone']}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 2) JUDGE — context-aware acknowledgement / ruling
# ---------------------------------------------------------------------------

def judge_speak(
    groq_client: Any,
    model: str,
    *,
    stage: str,
    transcript: str,
    analysis: Optional[Dict[str, Any]],
    case_data: Dict[str, Any],
    history: List[Dict[str, str]],
    language: str = "en-IN",
) -> Optional[str]:
    """Generate the bench's response after a plaintiff submission."""
    legal_ctx = build_legal_context(transcript)
    is_ml = str(language).lower().startswith("ml")

    history_lines = []
    for entry in history[-6:]:
        role = entry.get("role", "?")
        text = _truncate(entry.get("text", ""), 220)
        history_lines.append(f"{role}: {text}")
    history_block = "\n".join(history_lines) or "(no prior turns)"

    system = (
        _INDIAN_COURT_STYLE_GUIDE
        + "\n\nYou are the presiding judge. Reply in ONE short sentence (two only if "
          "you must direct counsel to do something specific). Do NOT explain the law. "
          "Do NOT pronounce a verdict. Just acknowledge OR ask for a clarification OR give a "
          "narrow direction (e.g. 'produce the s.63 BSA certificate', 'confine to relevant facts')."
        + ("\nRespond in Malayalam, but keep section numbers and case names intact." if is_ml else "")
    )

    user = (
        f"FEW-SHOT TONE (note the brevity):\n{format_few_shots_for_prompt(limit=1)}\n\n"
        f"STAGE: {stage} | CASE: {case_data.get('title','(user case)')}\n"
        f"PLAINTIFF JUST SAID: \"\"\"{_truncate(transcript, 700)}\"\"\"\n"
        f"WEAKNESSES SPOTTED: {('; '.join((analysis or {}).get('weaknesses', [])[:3])) or '(none)'}\n"
        f"PROVISIONS THAT COULD APPLY: {legal_ctx['provisions_text']}\n"
        "Output one sentence (max two). No preamble. No bullet points."
    )

    return _chat(groq_client, model, system=system, user=user, temperature=0.55, max_tokens=120)


# ---------------------------------------------------------------------------
# 3) OPPOSING COUNSEL — semantic, mirrored rebuttal
# ---------------------------------------------------------------------------

def counsel_speak(
    groq_client: Any,
    model: str,
    *,
    stage: str,
    transcript: str,
    analysis: Optional[Dict[str, Any]],
    case_data: Dict[str, Any],
    history: List[Dict[str, str]],
    language: str = "en-IN",
    strategy: str = "balanced",
) -> Optional[str]:
    """Generate a single live remark from opposing counsel, tightly tied to what was just said."""
    legal_ctx = build_legal_context(transcript)
    is_ml = str(language).lower().startswith("ml")

    history_lines = []
    for entry in history[-6:]:
        role = entry.get("role", "?")
        text = _truncate(entry.get("text", ""), 220)
        history_lines.append(f"{role}: {text}")
    history_block = "\n".join(history_lines) or "(no prior turns)"

    system = (
        _INDIAN_COURT_STYLE_GUIDE
        + "\n\nYou are opposing counsel. Reply in ONE crisp sentence (two only if absolutely "
          "necessary). React to what was actually said — quote 3–6 of the plaintiff counsel's "
          "own words in inline quotes, then expose the gap. Cite at most ONE section or precedent, "
          "and only if directly on point. Strategy posture: " + (strategy or 'balanced') + "."
        + ("\nRespond in Malayalam, but keep section numbers and Latin phrases intact." if is_ml else "")
    )

    user = (
        f"FEW-SHOT TONE (note the brevity):\n{format_few_shots_for_prompt(limit=1)}\n\n"
        f"STAGE: {stage} | CASE: {case_data.get('title','(user case)')}\n"
        f"DEFENSE POSITION: {case_data.get('defense','-')}\n"
        f"PLAINTIFF JUST SAID: \"\"\"{_truncate(transcript, 900)}\"\"\"\n"
        f"WEAKNESSES SPOTTED: {('; '.join((analysis or {}).get('weaknesses', [])[:3])) or '(none)'}\n"
        f"PROVISIONS THAT COULD APPLY: {legal_ctx['provisions_text']}\n"
        f"PRECEDENTS THAT COULD APPLY: {legal_ctx['cases_text']}\n"
        "Output one sentence (max two). No preamble. No headings. Mirror the plaintiff's words."
    )

    return _chat(groq_client, model, system=system, user=user, temperature=0.6, max_tokens=140)


# ---------------------------------------------------------------------------
# 4) LIVE MICRO-OBJECTION (mid-stage)
# ---------------------------------------------------------------------------

_OBJECTION_TRIGGERS = (
    "hearsay",
    "no s.63 bsa certificate",
    "no certificate",
    "no foundation",
    "no causation",
    "speculation",
    "no chain of custody",
    "vague dates",
    "no authentication",
    "irrelevant",
)


def should_live_object(analysis: Optional[Dict[str, Any]]) -> bool:
    """Return True if the analyzer found a defect worthy of a live objection."""
    if not analysis:
        return False
    weaknesses = " ".join(analysis.get("weaknesses", [])).lower()
    if not weaknesses:
        return False
    return any(trigger in weaknesses for trigger in _OBJECTION_TRIGGERS)


def live_objection(
    groq_client: Any,
    model: str,
    *,
    transcript: str,
    analysis: Optional[Dict[str, Any]],
    case_data: Dict[str, Any],
    language: str = "en-IN",
) -> Optional[str]:
    """Produce a SHORT live objection from opposing counsel."""
    if not should_live_object(analysis):
        return None

    is_ml = str(language).lower().startswith("ml")
    legal_ctx = build_legal_context(transcript)

    system = (
        _INDIAN_COURT_STYLE_GUIDE
        + "\n\nYou are opposing counsel raising a SHORT, LIVE objection mid-argument. "
          "ONE crisp sentence (max two). Begin with 'Objection, My Lord — ' or 'My Lord, with respect — '. "
          "Name the defect (hearsay / no s.63 BSA certificate / no foundation / etc.) and stop. "
          "Do not deliver a counter-argument here."
        + ("\nRespond fully in Malayalam, but keep technical labels (hearsay, prima facie, s.63 BSA) intact." if is_ml else "")
    )

    weaknesses = "; ".join((analysis or {}).get("weaknesses", [])[:3])
    user = (
        f"PLAINTIFF COUNSEL JUST SAID:\n\"\"\"{_truncate(transcript, 800)}\"\"\"\n\n"
        f"DEFECTS DETECTED: {weaknesses}\n"
        f"RELEVANT PROVISIONS:\n{legal_ctx['provisions_text']}\n\n"
        "Output only the one-sentence (max two) objection."
    )

    return _chat(groq_client, model, system=system, user=user, temperature=0.55, max_tokens=120)


# ---------------------------------------------------------------------------
# 4b) CONTINUATION AFTER A USER OBJECTION (defense resumes its argument)
# ---------------------------------------------------------------------------

def continue_after_ruling(
    groq_client: Any,
    model: str,
    *,
    last_opposing_remark: str,
    objection_type: str,
    sustained: bool,
    case_data: Dict[str, Any],
    user_arguments: Optional[Dict[str, str]] = None,
    language: str = "en-IN",
    strategy: str = "balanced",
) -> Optional[str]:
    """
    Generate the SUBSTANTIVE one-line continuation that opposing counsel speaks
    AFTER the bench rules on a user objection. This is what makes the defense
    feel like a real lawyer — they don't just say "as I was saying" and stop;
    they actually pick the thread back up.
    """
    is_ml = str(language).lower().startswith("ml")
    legal_ctx = build_legal_context(last_opposing_remark or "")

    if sustained:
        posture = (
            "The objection was SUSTAINED. Acknowledge it implicitly, withdraw or "
            "rephrase the offending point, and pivot to a different but equally "
            "damaging angle for the defense."
        )
    else:
        posture = (
            "The objection was OVERRULED. Pick up the prior thread with renewed "
            "force; sharpen the same point, do NOT repeat it verbatim."
        )

    user_summary_bits = []
    if user_arguments:
        if user_arguments.get("opening"):
            user_summary_bits.append(f"Plaintiff opening: {_truncate(user_arguments['opening'], 250)}")
        if user_arguments.get("evidence"):
            user_summary_bits.append(f"Plaintiff evidence: {_truncate(user_arguments['evidence'], 250)}")
    user_summary = "\n".join(user_summary_bits) or "(no prior plaintiff submissions on file)"

    system = (
        _INDIAN_COURT_STYLE_GUIDE
        + "\n\nYou are opposing counsel resuming AFTER the bench has ruled on a user "
          "objection. " + posture + " "
          "Reply in ONE crisp sentence (two only if absolutely needed). "
          "Do NOT begin with 'As I was saying' (that has already been said). "
          "Do NOT thank the court again. Do NOT repeat the brief acknowledgement. "
          "Just deliver the next substantive line of argument. "
          "Strategy posture: " + (strategy or 'balanced') + "."
        + ("\nRespond in Malayalam, but keep section numbers and case names intact." if is_ml else "")
    )

    user = (
        f"CASE: {case_data.get('title','(user case)')} | DEFENSE POSITION: {case_data.get('defense','-')}\n"
        f"OBJECTION RAISED: {objection_type} | RULING: {'SUSTAINED' if sustained else 'OVERRULED'}\n"
        f"YOUR PRIOR REMARK (continue from this thread):\n\"\"\"{_truncate(last_opposing_remark, 600)}\"\"\"\n"
        f"PLAINTIFF SUBMISSIONS SO FAR:\n{user_summary}\n"
        f"PROVISIONS THAT COULD APPLY:\n{legal_ctx['provisions_text']}\n"
        "Output ONE substantive continuation. No preamble. No bullets."
    )

    return _chat(groq_client, model, system=system, user=user, temperature=0.55, max_tokens=160)


# ---------------------------------------------------------------------------
# 5) FULL COUNTER-ARGUMENT BLOCK (Counter Argument stage)
# ---------------------------------------------------------------------------

def counter_argument_block(
    groq_client: Any,
    model: str,
    *,
    user_arguments: Dict[str, str],
    analyses: List[Dict[str, Any]],
    case_data: Dict[str, Any],
    language: str = "en-IN",
    strategy: str = "balanced",
) -> Optional[List[str]]:
    """Return a list of 4-5 short opposing-counsel statements to be spoken in sequence."""
    is_ml = str(language).lower().startswith("ml")

    combined_user_text = " \n ".join(
        v for v in (user_arguments or {}).values() if v
    )
    legal_ctx = build_legal_context(combined_user_text)

    analysis_block = "\n\n".join(
        f"Turn {i+1}: {summarise_analysis(a)}" for i, a in enumerate(analyses[-5:]) if a
    ) or "(no analyzer notes)"

    system = (
        _INDIAN_COURT_STYLE_GUIDE
        + "\n\nYou are opposing counsel delivering the COUNTER-ARGUMENT block. "
          "Return STRICT JSON: {\"statements\": [str, str, str]}. "
          "EXACTLY THREE short statements (each ONE sentence, two at the most), in this order: "
          "(1) frame the rebuttal and quote 3-6 of the plaintiff counsel's own words to attack the central claim; "
          "(2) expose the evidentiary gap citing ONE BSA/BNS/BNSS section by number, OR ONE landmark precedent (Anvar P.V., Arjun Panditrao, Lalita Kumari, etc.) — pick whichever fits; "
          "(3) crisp prayer ('the suit be dismissed', 'the petition be rejected', etc.). "
          "Strategy posture: " + (strategy or 'balanced') + "."
        + ("\nWrite the statements in Malayalam, keeping section numbers and case names intact." if is_ml else "")
    )

    user = (
        f"FEW-SHOT TONE (note the brevity):\n{format_few_shots_for_prompt(limit=1)}\n\n"
        f"CASE: {case_data.get('title','(user case)')} | DEFENSE POSITION: {case_data.get('defense','-')}\n"
        f"PLAINTIFF OPENING: \"\"\"{_truncate(user_arguments.get('opening',''), 700)}\"\"\"\n"
        f"PLAINTIFF EVIDENCE: \"\"\"{_truncate(user_arguments.get('evidence',''), 700)}\"\"\"\n"
        f"ANALYZER NOTES:\n{analysis_block}\n"
        f"PROVISIONS:\n{legal_ctx['provisions_text']}\n"
        f"PRECEDENTS:\n{legal_ctx['cases_text']}\n"
        "Output ONLY the JSON object with exactly 3 statements."
    )

    raw = _chat(
        groq_client, model, system=system, user=user,
        temperature=0.5, max_tokens=420, timeout=35.0,
    )
    parsed = _safe_json_load(raw or "")
    if not parsed:
        return None
    statements = parsed.get("statements")
    if not isinstance(statements, list):
        return None
    cleaned = [str(s).strip() for s in statements if str(s).strip()]
    if not cleaned:
        return None
    return cleaned[:3]


# ---------------------------------------------------------------------------
# 6) FINAL EDUCATIONAL JUDGMENT
# ---------------------------------------------------------------------------

def final_judgment(
    groq_client: Any,
    model: str,
    *,
    case_data: Dict[str, Any],
    user_arguments: Dict[str, str],
    analyses: List[Dict[str, Any]],
    performance: Dict[str, Any],
    language: str = "en-IN",
) -> Optional[List[str]]:
    """Return 4-6 paragraphs forming the bench's reasoned, educational judgment."""
    is_ml = str(language).lower().startswith("ml")

    combined_user_text = " \n ".join(v for v in (user_arguments or {}).values() if v)
    legal_ctx = build_legal_context(combined_user_text)

    analysis_block = "\n\n".join(
        f"Turn {i+1}: {summarise_analysis(a)}" for i, a in enumerate(analyses[-6:]) if a
    ) or "(no analyzer notes)"

    score_text = (
        f"Opening strength: {performance.get('openingStrength', 0):.2f}; "
        f"Evidence quality: {performance.get('evidenceQuality', 0):.2f}; "
        f"Closing strength: {performance.get('closingStrength', 0):.2f}; "
        f"Objections handled: {performance.get('objectionsHandled', 0)}."
    )

    system = (
        _INDIAN_COURT_STYLE_GUIDE
        + "\n\nYou are the presiding judge delivering an EDUCATIONAL judgment. "
          "Return STRICT JSON: {\"paragraphs\": [str, str, str]}. "
          "EXACTLY THREE short paragraphs (each 1–2 sentences), in this order: "
          "(1) findings on the claim and the evidence — cite ONE BSA section by number, "
          "(2) findings on procedure / closing, "
          "(3) educational feedback to the student-counsel — name ONE strength, ONE gap, and ONE drill "
          "(e.g. 'practise laying foundation under s.61 BSA'). "
          "Do NOT pronounce a binding verdict. End paragraph 3 with: "
          "\"This pronouncement is for educational purposes only.\""
        + ("\nWrite the judgment in Malayalam, keeping section numbers and case names intact." if is_ml else "")
    )

    user = (
        f"CASE: {case_data.get('title','(user case)')} | DEFENSE: {case_data.get('defense','-')}\n"
        f"PLAINTIFF OPENING: \"\"\"{_truncate(user_arguments.get('opening',''), 600)}\"\"\"\n"
        f"PLAINTIFF EVIDENCE: \"\"\"{_truncate(user_arguments.get('evidence',''), 600)}\"\"\"\n"
        f"PLAINTIFF CLOSING: \"\"\"{_truncate(user_arguments.get('closing',''), 600)}\"\"\"\n"
        f"ANALYZER NOTES:\n{analysis_block}\n"
        f"METRICS: {score_text}\n"
        f"PROVISIONS:\n{legal_ctx['provisions_text']}\n"
        f"PRECEDENTS:\n{legal_ctx['cases_text']}\n"
        "Output ONLY the JSON object with exactly 3 paragraphs."
    )

    raw = _chat(
        groq_client, model, system=system, user=user,
        temperature=0.45, max_tokens=550, timeout=40.0,
    )
    parsed = _safe_json_load(raw or "")
    if not parsed:
        return None
    paragraphs = parsed.get("paragraphs")
    if not isinstance(paragraphs, list):
        return None
    cleaned = [str(p).strip() for p in paragraphs if str(p).strip()]
    if not cleaned:
        return None
    return cleaned[:3]


# ---------------------------------------------------------------------------
# 7) NATURAL VARIATION HELPERS
# ---------------------------------------------------------------------------

def vary_opener(group: str, language: str = "en-IN") -> str:
    """Convenience: pick a phrase from the KB so even template paths sound varied."""
    lang = "ml" if str(language).lower().startswith("ml") else "en"
    return random_phrase(group, language=lang)

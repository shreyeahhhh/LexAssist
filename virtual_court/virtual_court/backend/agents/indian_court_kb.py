"""
Indian Court Knowledge Base for Virtual Courtroom

Curated, lightweight knowledge used to ground the simulation in authentic
Indian-court diction and post-2024 statutes (Bharatiya Nyaya Sanhita,
Bharatiya Nagarik Suraksha Sanhita, Bharatiya Sakshya Adhiniyam) along with
landmark Supreme Court precedents.

The retrieval layer is intentionally keyword-based and dependency-free so the
courtroom backend stays small. It is enough to surface the most relevant
provisions for a given argument, which the LLM then weaves into a natural
courtroom exchange.

Educational use only. NOT legal advice.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


# ---------------------------------------------------------------------------
# COURT DICTION
# ---------------------------------------------------------------------------

INDIAN_COURT_PHRASES: Dict[str, Dict[str, List[str]]] = {
    "user_lawyer_openings": {
        "en": [
            "May it please Your Lordship,",
            "If Your Lordship pleases,",
            "With utmost humility, Your Lordship,",
            "I beg to submit, Your Lordship,",
            "Most respectfully, Your Lordship,",
        ],
        "ml": [
            "ബഹുമാനപ്പെട്ട കോടതിക്ക് സമർപ്പിക്കാൻ അനുവദിക്കണമേ,",
            "Your Lordship-ന്റെ അനുവാദത്തോടെ ഞാൻ വാദമുന്നയിക്കട്ടെ,",
            "ഏറ്റവും വിനയത്തോടെ, Your Lordship,",
        ],
    },
    "opposing_counsel_to_judge": {
        "en": [
            "My Lord,",
            "Your Lordship,",
            "If Your Lordship would permit,",
            "With deepest respect, Your Lordship,",
        ],
        "ml": [
            "Your Lordship,",
            "ബഹുമാനപ്പെട്ട കോടതിയോട് അനുവാദത്തോടെ,",
        ],
    },
    "opposing_counsel_referring_to_user": {
        "en": [
            "my learned friend on the other side",
            "the learned counsel for the plaintiff",
            "my learned friend",
            "the learned counsel appearing for the petitioner",
        ],
        "ml": [
            "എതിർവശത്തെ ബഹുമാനപ്പെട്ട സഹോദര അഭിഭാഷകൻ",
            "ഹർജിക്കാർക്കു വേണ്ടി ഹാജരാകുന്ന ബഹുമാനപ്പെട്ട അഭിഭാഷകൻ",
        ],
    },
    "judge_acknowledgements": {
        "en": [
            "Heard, learned counsel.",
            "Yes, learned counsel, the court is following.",
            "The court takes note.",
            "Let the record reflect the submission.",
            "The court is alive to the submission.",
        ],
        "ml": [
            "കേട്ടിരിക്കുന്നു, ബഹുമാനപ്പെട്ട അഭിഭാഷകേ.",
            "കോടതി ശ്രദ്ധിച്ചുകേൾക്കുകയാണ്.",
            "സമർപ്പിച്ച വാദം രേഖപ്പെടുത്തുന്നു.",
        ],
    },
    "judge_rulings": {
        "sustained_en": [
            "Sustained.",
            "Objection is sustained — let the submission be reframed.",
            "The objection has merit and is upheld.",
        ],
        "overruled_en": [
            "Overruled.",
            "The objection is misconceived. Counsel may proceed.",
            "Objection rejected; the line of argument is permissible.",
        ],
        "sustained_ml": [
            "ആക്ഷേപം അംഗീകരിച്ചു.",
            "ആക്ഷേപം ന്യായമാണ്; വാദം പുനഃസമർപ്പിക്കുക.",
        ],
        "overruled_ml": [
            "ആക്ഷേപം തള്ളിക്കളഞ്ഞു.",
            "ആക്ഷേപം ദുരുപദിഷ്ടമാണ്; അഭിഭാഷകന് തുടരാം.",
        ],
    },
    "judgment_lead_ins": {
        "en": [
            "Having heard the rival submissions and on a perusal of the record,",
            "On a careful conspectus of the pleadings, evidence and authorities cited,",
            "The court has anxiously considered the submissions advanced at the bar,",
            "In the light of the material on record and the law as it stands,",
        ],
        "ml": [
            "ഇരുപക്ഷങ്ങളുടെയും വാദങ്ങൾ കേട്ടും, രേഖകൾ പരിശോധിച്ചും,",
            "ലഭ്യമായ വസ്തുതകളും ഉദ്ധരിച്ച നിയമങ്ങളും വിശദമായി പരിശോധിച്ച്,",
        ],
    },
}


# ---------------------------------------------------------------------------
# STATUTES (post-2023 reformed criminal codes)
# ---------------------------------------------------------------------------
# Each entry: short summary suitable for in-court reference. Educational use.
# Numbering follows the BNS/BNSS/BSA, 2023.


BNS_SECTIONS: Dict[str, Dict[str, str]] = {
    "63": {
        "name": "Rape",
        "summary": "Defines rape and lays down the seven circumstances in which sexual intercourse amounts to rape; replaces s.375 IPC.",
    },
    "103": {
        "name": "Punishment for murder",
        "summary": "Punishment for murder is death or imprisonment for life, and fine; analogue of s.302 IPC.",
    },
    "115": {
        "name": "Voluntarily causing hurt",
        "summary": "Punishment for voluntarily causing hurt; analogue of s.323 IPC.",
    },
    "117": {
        "name": "Voluntarily causing grievous hurt by dangerous weapons or means",
        "summary": "Aggravated hurt offence; analogue of s.326 IPC.",
    },
    "303": {
        "name": "Theft",
        "summary": "Whoever, intending to take dishonestly any movable property out of the possession of any person without that person's consent commits theft; analogue of s.378 IPC.",
    },
    "316": {
        "name": "Criminal breach of trust",
        "summary": "Dishonest misappropriation or conversion of property entrusted; analogue of s.405 IPC.",
    },
    "318": {
        "name": "Cheating",
        "summary": "Dishonest inducement of any person to deliver property or to do/omit any act; analogue of s.415 IPC.",
    },
    "324": {
        "name": "Mischief",
        "summary": "Causing wrongful loss or damage to property; analogue of s.425 IPC.",
    },
    "351": {
        "name": "Criminal intimidation",
        "summary": "Threatening another with injury to person, reputation, or property; analogue of s.503 IPC.",
    },
    "356": {
        "name": "Defamation",
        "summary": "Imputation made or published with intent to harm reputation; analogue of s.499 IPC.",
    },
}


BNSS_SECTIONS: Dict[str, Dict[str, str]] = {
    "173": {
        "name": "Information in cognizable cases",
        "summary": "Procedure for FIR registration; the BNSS counterpart of s.154 CrPC, with provision for zero-FIR and e-FIR.",
    },
    "176": {
        "name": "Investigation by police officer",
        "summary": "Procedure governing investigation; analogue of s.156–157 CrPC, with audio-video recording for specified offences.",
    },
    "183": {
        "name": "Recording of confessions and statements",
        "summary": "Magistrate-recorded statements/confessions under s.183 BNSS; replaces s.164 CrPC, with mandatory audio-video for sexual offences.",
    },
    "193": {
        "name": "Police report on completion of investigation",
        "summary": "Final report (charge-sheet) submitted on completion of investigation; analogue of s.173 CrPC.",
    },
    "223": {
        "name": "Examination of complainant on cognizance",
        "summary": "Magistrate examines the complainant before issuing process; analogue of s.200 CrPC.",
    },
    "346": {
        "name": "Power to postpone or adjourn proceedings",
        "summary": "Limits adjournments; analogue of s.309 CrPC and emphasises day-to-day trial.",
    },
    "356": {
        "name": "Inquiry/trial in absence of proclaimed offender",
        "summary": "Trial in absentia for proclaimed offenders, an important new feature of the BNSS.",
    },
}


BSA_SECTIONS: Dict[str, Dict[str, str]] = {
    "2(1)(d)": {
        "name": "'Document' includes electronic and digital records",
        "summary": "Definition of document; expressly includes electronic/digital records under the BSA.",
    },
    "39": {
        "name": "Relevance of facts forming part of the same transaction (res gestae)",
        "summary": "Facts so connected as to form part of the same transaction are relevant; res gestae; analogue of s.6 IEA.",
    },
    "57": {
        "name": "Documentary evidence — primary evidence",
        "summary": "Primary evidence means the document itself produced for inspection of the court.",
    },
    "59": {
        "name": "Oral evidence must be direct (no hearsay)",
        "summary": "Oral evidence must, in all cases whatever, be direct; codifies the bar on hearsay; analogue of s.60 IEA.",
    },
    "61": {
        "name": "Proof of contents of documents",
        "summary": "Contents of documents may be proved either by primary or secondary evidence.",
    },
    "63": {
        "name": "Admissibility of electronic/digital records (s.65B successor)",
        "summary": "Electronic records admissible only on production of a certificate identifying the record and the device; mandatory unless the original is produced — successor of s.65B IEA.",
    },
    "65": {
        "name": "Cases in which secondary evidence is admissible",
        "summary": "Lists the limited situations where secondary evidence of a document is permitted.",
    },
    "85": {
        "name": "Presumption as to electronic agreements",
        "summary": "Court shall presume electronic agreements affixed with electronic signatures.",
    },
}


# ---------------------------------------------------------------------------
# LANDMARK PRECEDENTS
# ---------------------------------------------------------------------------

LANDMARK_CASES: List[Dict[str, str]] = [
    {
        "title": "Anvar P.V. v. P.K. Basheer (2014) 10 SCC 473",
        "topic": "electronic evidence, certificate under s.65B IEA (now s.63 BSA)",
        "principle": (
            "Electronic records are inadmissible without the certificate prescribed by s.65B(4) IEA "
            "(now mirrored in s.63 BSA); oral evidence cannot supplant the certificate."
        ),
    },
    {
        "title": "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020) 7 SCC 1",
        "topic": "mandatory s.65B certificate",
        "principle": (
            "The certificate under s.65B(4) is a mandatory pre-condition to admissibility of "
            "electronic records, save where the original device itself is produced."
        ),
    },
    {
        "title": "Maneka Gandhi v. Union of India (1978) 1 SCC 248",
        "topic": "Article 21, fair procedure",
        "principle": (
            "Procedure depriving a person of life or personal liberty must be fair, just and reasonable, "
            "not arbitrary or oppressive."
        ),
    },
    {
        "title": "Kesavananda Bharati v. State of Kerala (1973) 4 SCC 225",
        "topic": "basic structure doctrine",
        "principle": "Parliament's amending power does not extend to altering the basic structure of the Constitution.",
    },
    {
        "title": "Selvi v. State of Karnataka (2010) 7 SCC 263",
        "topic": "Article 20(3), narco-analysis",
        "principle": (
            "Compulsory narco-analysis, polygraph and BEAP tests violate the right against "
            "self-incrimination and the right to privacy under Article 21."
        ),
    },
    {
        "title": "State of Maharashtra v. Praful Desai (2003) 4 SCC 601",
        "topic": "video-conferencing evidence",
        "principle": (
            "Recording of evidence by video-conferencing is permissible; 'presence' under the "
            "Code does not mean only physical presence."
        ),
    },
    {
        "title": "Tukaram v. State of Maharashtra (1979) 2 SCC 143 (Mathura)",
        "topic": "consent and proof in sexual offences",
        "principle": (
            "Catalysed reform of evidentiary standards in sexual-offence prosecutions; basis for "
            "later statutory presumptions of absence of consent."
        ),
    },
    {
        "title": "Lalita Kumari v. Govt. of U.P. (2014) 2 SCC 1",
        "topic": "FIR registration",
        "principle": (
            "Registration of FIR is mandatory under s.154 CrPC (now s.173 BNSS) if the information "
            "discloses commission of a cognizable offence; preliminary inquiry is the exception."
        ),
    },
    {
        "title": "Sharda Birdhichand Sarda v. State of Maharashtra (1984) 4 SCC 116",
        "topic": "circumstantial evidence",
        "principle": (
            "Five-point 'panchsheel' for conviction on circumstantial evidence: circumstances must be "
            "fully established, consistent only with guilt, conclusive in nature, exclude every other "
            "hypothesis, and form a complete chain."
        ),
    },
]


# ---------------------------------------------------------------------------
# RETRIEVAL
# ---------------------------------------------------------------------------
# Keywords mapped to provision IDs / case titles. Lightweight and explainable.

_KEYWORD_TO_SECTIONS: List[Tuple[List[str], List[Tuple[str, str]]]] = [
    # ---- electronic / digital evidence ----
    (
        ["cctv", "video", "audio", "whatsapp", "email", "screenshot", "digital",
         "electronic", "mobile", "phone record", "call record", "sms", "metadata"],
        [
            ("BSA", "63"),
            ("BSA", "2(1)(d)"),
            ("BSA", "85"),
        ],
    ),
    # ---- documents ----
    (
        ["agreement", "contract", "deed", "invoice", "receipt", "letter", "document",
         "writing", "signature", "executed"],
        [
            ("BSA", "57"),
            ("BSA", "61"),
            ("BSA", "65"),
        ],
    ),
    # ---- hearsay / direct evidence ----
    (
        ["i heard", "someone told", "rumour", "rumor", "informed me", "people say",
         "is said", "common knowledge", "third party said"],
        [("BSA", "59")],
    ),
    # ---- res gestae ----
    (
        ["spontaneous", "at the same time", "immediately after", "on the spot",
         "in the heat of the moment", "as it was happening"],
        [("BSA", "39")],
    ),
    # ---- theft / burglary ----
    (
        ["theft", "stolen", "stole", "robbed", "robbery", "burglary", "took my",
         "missing money", "cash gone"],
        [("BNS", "303"), ("BNS", "316")],
    ),
    # ---- cheating / fraud ----
    (
        ["cheat", "fraud", "fraudulent", "deceiv", "misrepresent", "duped",
         "false promise", "induced me"],
        [("BNS", "318")],
    ),
    # ---- assault / hurt ----
    (
        ["assault", "beat", "hit", "punch", "injur", "hurt", "wound", "weapon",
         "knife", "stick", "rod"],
        [("BNS", "115"), ("BNS", "117")],
    ),
    # ---- intimidation / threats ----
    (
        ["threat", "threaten", "intimidat", "kill you", "harm you", "burn", "blackmail"],
        [("BNS", "351")],
    ),
    # ---- murder ----
    (
        ["murder", "killed", "killing", "homicide", "death of", "stabbed to death"],
        [("BNS", "103")],
    ),
    # ---- defamation ----
    (
        ["defam", "reputation", "slander", "libel", "false accusation", "publicly accused"],
        [("BNS", "356")],
    ),
    # ---- sexual offences ----
    (
        ["rape", "sexual assault", "molest"],
        [("BNS", "63")],
    ),
    # ---- FIR / investigation ----
    (
        ["fir", "first information", "police report", "investigation", "police did not",
         "refused to register", "zero fir"],
        [("BNSS", "173"), ("BNSS", "176"), ("BNSS", "193")],
    ),
    # ---- magistrate-recorded statements ----
    (
        ["magistrate", "164 statement", "recorded statement", "judicial confession"],
        [("BNSS", "183")],
    ),
    # ---- complainant examination ----
    (
        ["complaint case", "private complaint", "complainant examined"],
        [("BNSS", "223")],
    ),
    # ---- adjournment / day-to-day trial ----
    (
        ["adjourn", "postpone", "delay", "next date"],
        [("BNSS", "346")],
    ),
    # ---- absconding accused ----
    (
        ["absconding", "proclaimed offender", "trial in absentia", "fled the country"],
        [("BNSS", "356")],
    ),
]


_KEYWORD_TO_CASES: List[Tuple[List[str], List[str]]] = [
    (
        ["cctv", "whatsapp", "email", "video clip", "electronic", "digital",
         "65b", "section 63 bsa"],
        [
            "Anvar P.V. v. P.K. Basheer (2014) 10 SCC 473",
            "Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020) 7 SCC 1",
        ],
    ),
    (
        ["fir", "refused to register", "police did not register", "delay in fir"],
        ["Lalita Kumari v. Govt. of U.P. (2014) 2 SCC 1"],
    ),
    (
        ["circumstantial", "no eyewitness", "chain of circumstances"],
        ["Sharda Birdhichand Sarda v. State of Maharashtra (1984) 4 SCC 116"],
    ),
    (
        ["narco", "polygraph", "lie detector", "self-incrimination", "article 20"],
        ["Selvi v. State of Karnataka (2010) 7 SCC 263"],
    ),
    (
        ["video conferencing", "remote testimony", "online evidence"],
        ["State of Maharashtra v. Praful Desai (2003) 4 SCC 601"],
    ),
    (
        ["fundamental rights", "article 21", "fair procedure", "due process"],
        ["Maneka Gandhi v. Union of India (1978) 1 SCC 248"],
    ),
]


def _lookup_section(code: str, num: str) -> Dict[str, str]:
    table = {"BNS": BNS_SECTIONS, "BNSS": BNSS_SECTIONS, "BSA": BSA_SECTIONS}.get(code, {})
    info = table.get(num)
    if not info:
        return {"code": code, "section": num, "name": "", "summary": ""}
    return {"code": code, "section": num, **info}


def retrieve_relevant_provisions(text: str, max_items: int = 6) -> List[Dict[str, str]]:
    """Return a small list of provisions relevant to the supplied text."""
    if not text:
        return []
    lower = text.lower()
    seen: set = set()
    out: List[Dict[str, str]] = []
    for keywords, refs in _KEYWORD_TO_SECTIONS:
        if any(k in lower for k in keywords):
            for code, num in refs:
                key = (code, num)
                if key in seen:
                    continue
                seen.add(key)
                out.append(_lookup_section(code, num))
                if len(out) >= max_items:
                    return out
    return out


def retrieve_relevant_cases(text: str, max_items: int = 3) -> List[Dict[str, str]]:
    """Return a small list of landmark precedents relevant to the supplied text."""
    if not text:
        return []
    lower = text.lower()
    titles_seen: set = set()
    selected: List[Dict[str, str]] = []
    for keywords, titles in _KEYWORD_TO_CASES:
        if any(k in lower for k in keywords):
            for title in titles:
                if title in titles_seen:
                    continue
                for case in LANDMARK_CASES:
                    if case["title"] == title:
                        selected.append(case)
                        titles_seen.add(title)
                        break
                if len(selected) >= max_items:
                    return selected
    return selected


def format_provisions_for_prompt(items: List[Dict[str, str]]) -> str:
    if not items:
        return "(No specific provisions surfaced for this submission.)"
    lines = []
    for it in items:
        lines.append(f"- {it['code']} s.{it['section']} ({it['name']}): {it['summary']}")
    return "\n".join(lines)


def format_cases_for_prompt(items: List[Dict[str, str]]) -> str:
    if not items:
        return "(No specific precedents surfaced for this submission.)"
    lines = []
    for it in items:
        lines.append(f"- {it['title']} — {it['topic']}: {it['principle']}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# FEW-SHOT EXEMPLARS (Indian-court tone)
# ---------------------------------------------------------------------------
# These are short, illustrative dialogues used to anchor the LLM's tone.

FEW_SHOT_EXCHANGES: List[Dict[str, str]] = [
    {
        "user": (
            "Your Honor, my client never received the construction services that were promised. "
            "There is a signed agreement and bank statements showing the advance payment."
        ),
        "judge": (
            "Heard, learned counsel. The submission proceeds on a written agreement and "
            "consideration paid; the court will weigh the same on the touchstone of proof under "
            "ss.57 and 61 of the Bharatiya Sakshya Adhiniyam."
        ),
        "opposing": (
            "May it please Your Lordship — my learned friend places reliance on a bare agreement and "
            "ledger entries, but conspicuously omits any written notice calling upon my client to "
            "perform. There is, with respect, no record of breach having been intimated, and the "
            "ledger by itself does not establish causation. The plaintiff's burden under the "
            "instant suit remains undischarged."
        ),
    },
    {
        "user": (
            "Your Honor, I have CCTV footage from the shop showing the accused taking the cash."
        ),
        "judge": (
            "The court is alive to the submission. However, learned counsel will appreciate that "
            "electronic records require the certificate prescribed by s.63 of the Bharatiya Sakshya "
            "Adhiniyam, as reaffirmed in Anvar P.V. and Arjun Panditrao Khotkar."
        ),
        "opposing": (
            "Your Lordship, my learned friend produces what is described as CCTV footage but no "
            "s.63 BSA certificate accompanies it. Nor has the device of origin been produced. In "
            "Arjun Panditrao Khotkar, this requirement was held to be mandatory — the footage, "
            "without the certificate, cannot be looked at, and ought to be kept out of "
            "consideration at the threshold."
        ),
    },
    {
        "user": (
            "Your Honor, I heard from someone in the neighbourhood that the defendant was planning this for weeks."
        ),
        "judge": (
            "Counsel, that is hearsay. Oral evidence must be direct, as s.59 of the BSA requires; "
            "kindly confine your submission to facts within direct knowledge or duly proved "
            "documentary record."
        ),
        "opposing": (
            "Objection, My Lord — pure hearsay, hit by s.59 BSA. My learned friend cannot improve "
            "his case by relying on neighbourhood gossip; the source has not been put up as a "
            "witness, and the statement is not part of the same transaction so as to attract s.39."
        ),
    },
]


def format_few_shots_for_prompt(language: str = "en", limit: int = 3) -> str:
    items = FEW_SHOT_EXCHANGES[:limit]
    out = []
    for i, ex in enumerate(items, 1):
        out.append(
            f"Example {i}:\n"
            f"  USER (plaintiff counsel): {ex['user']}\n"
            f"  JUDGE: {ex['judge']}\n"
            f"  OPPOSING COUNSEL: {ex['opposing']}"
        )
    return "\n\n".join(out)


def random_phrase(group: str, language: str = "en") -> str:
    """Return one phrase from a phrase group; safe fallback to empty string."""
    import random as _r
    section = INDIAN_COURT_PHRASES.get(group, {})
    options = section.get("ml" if str(language).lower().startswith("ml") else "en", [])
    if not options:
        return ""
    return _r.choice(options)


# ---------------------------------------------------------------------------
# PUBLIC API
# ---------------------------------------------------------------------------

def build_legal_context(text: str) -> Dict[str, Any]:
    """Bundle relevant provisions + cases for a single submission."""
    provisions = retrieve_relevant_provisions(text)
    cases = retrieve_relevant_cases(text)
    return {
        "provisions": provisions,
        "cases": cases,
        "provisions_text": format_provisions_for_prompt(provisions),
        "cases_text": format_cases_for_prompt(cases),
    }

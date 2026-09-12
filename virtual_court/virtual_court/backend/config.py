"""
Virtual Courtroom Simulation - Configuration
Educational Purpose Only - NOT Legal Advice
"""

# Voice Settings
VOICE_CONFIG = {
    "UNCLEAR_THRESHOLD": 0.6,
    "FALLBACK_TIMEOUT": 5000,
}

# Timing
TIMING = {
    "STAGE_TRANSITION_DELAY": 2000,
    "MAX_SPEAKING_TIME": 240000,  # 4 minutes per turn
    "OBJECTION_WINDOW": 3000,
    "JUDGE_RESPONSE_DELAY": 800,
}

# Roles
ROLES = {
    "JUDGE": "[JUDGE]",
    "USER_LAWYER": "[USER_LAWYER]",
    "OPPOSING_LAWYER": "[OPPOSING_LAWYER]",
    "SYSTEM": "[SYSTEM]",
}

# Stages
STAGES = {
    "COURT_OPENING": "[STAGE:COURT_OPENING]",
    "OPENING_ARGUMENT": "[STAGE:OPENING_ARGUMENT]",
    "EVIDENCE_SUBMISSION": "[STAGE:EVIDENCE_SUBMISSION]",
    "OBJECTION": "[STAGE:OBJECTION]",
    "COUNTER_ARGUMENT": "[STAGE:COUNTER_ARGUMENT]",
    "CLOSING_ARGUMENT": "[STAGE:CLOSING_ARGUMENT]",
    "EDUCATIONAL_JUDGMENT": "[STAGE:EDUCATIONAL_JUDGMENT]",
}

# Stage Flow Order
STAGE_ORDER = [
    "COURT_OPENING",
    "OPENING_ARGUMENT",
    "EVIDENCE_SUBMISSION",
    "COUNTER_ARGUMENT",
    "CLOSING_ARGUMENT",
    "EDUCATIONAL_JUDGMENT",
]

# Objection Types
OBJECTION_TYPES = {
    "HEARSAY": "hearsay",
    "RELEVANCE": "relevance",
    "LEADING": "leading question",
    "SPECULATION": "speculation",
    "ARGUMENTATIVE": "argumentative",
    "ASKED_AND_ANSWERED": "asked and answered",
    "COMPOUND": "compound question",
}

# Objection Keywords
OBJECTION_KEYWORDS = [
    "objection",
    "i object",
    "object",
    "your honor i object",
    "objection your honor",
]

# Educational Disclaimers
DISCLAIMERS = {
    "MAIN": "⚖️ EDUCATIONAL SIMULATION ONLY - NOT LEGAL ADVICE",
    "DETAILED": (
        "This is a virtual courtroom simulation designed for educational and practice purposes only. "
        "It does not constitute legal advice, legal representation, or create an attorney-client relationship. "
        "For actual legal matters, consult a licensed attorney in your jurisdiction."
    ),
    "SESSION_START": (
        "This simulation is for learning purposes. The AI judge and opposing lawyer are educational tools "
        "designed to help you practice courtroom procedures and argumentation skills."
    ),
}

# Sample Cases
SAMPLE_CASES = {
    "CONTRACT_DISPUTE": {
        "title": "Smith v. Johnson - Contract Dispute",
        "description": "A dispute over a breach of contract for construction services.",
        "plaintiff": "Smith Construction LLC",
        "defendant": "Johnson Property Development",
        "claim": "Breach of contract and failure to pay $50,000 for completed work",
        "defense": "Work was not completed to specifications and timeline was exceeded",
    },
    "PERSONAL_INJURY": {
        "title": "Davis v. Metro Transit - Personal Injury",
        "description": "Slip and fall accident on public transportation.",
        "plaintiff": "Maria Davis",
        "defendant": "Metro Transit Authority",
        "claim": "Negligence causing injury due to unsafe conditions",
        "defense": "Plaintiff failed to exercise reasonable care",
    },
}


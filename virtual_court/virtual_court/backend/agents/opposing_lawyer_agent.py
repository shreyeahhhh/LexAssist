"""
Opposing Lawyer Agent - AI-controlled opposing counsel
Educational Purpose Only - NOT Legal Advice
"""
import random
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import OBJECTION_TYPES

try:
    from .indian_court_kb import random_phrase  # type: ignore
except Exception:  # pragma: no cover
    def random_phrase(group: str, language: str = "en") -> str:  # type: ignore
        return ""


class OpposingLawyerAgent:
    def __init__(self):
        self.strategy = "balanced"  # aggressive, balanced, defensive
        self.case_data: Optional[Dict[str, Any]] = None
        self.language = "en-IN"
        self.base_tone = (
            "Respond as defense counsel in an Indian courtroom. "
            "Be concise, respectful, and grounded in Bharatiya Nyaya Sanhita (BNS), "
            "Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA) where applicable. "
            "Do not give legal advice to the user; argue for the defendant."
        )

    def set_language(self, language: str):
        self.language = language or "en-IN"

    def _is_malayalam(self) -> bool:
        return str(self.language).lower().startswith("ml")

    # ============================================
    # INITIALIZATION
    # ============================================

    def set_case_data(self, case_data: Dict[str, Any]):
        """Set case information"""
        self.case_data = case_data

    def set_strategy(self, strategy: str):
        """Set strategy: aggressive, balanced, or defensive"""
        self.strategy = strategy

    # ============================================
    # COUNTER ARGUMENT
    # ============================================

    def present_counter_argument(self, user_arguments: Dict[str, Any]) -> List[str]:
        """Generate counter-argument statements"""
        opening = self.get_counter_opening()
        claim = self.build_claim_challenge(user_arguments)
        defense = self.present_defense_position()
        evidence = self.challenge_evidence_specific(user_arguments)
        close = self.conclude_counter()
        return [opening, claim, defense, evidence, close]

    def get_counter_opening(self) -> str:
        salute_en = random_phrase("opposing_counsel_to_judge", "en") or "My Lord,"
        salute_ml = random_phrase("opposing_counsel_to_judge", "ml") or "Your Lordship,"
        learned = random_phrase("opposing_counsel_referring_to_user", "en") or "my learned friend"
        learned_ml = random_phrase("opposing_counsel_referring_to_user", "ml") or "എതിർവശത്തെ ബഹുമാനപ്പെട്ട സഹോദര അഭിഭാഷകൻ"
        if self._is_malayalam():
            openings = [
                f"{salute_ml} {learned_ml} അവതരിപ്പിച്ച വസ്തുതാവിവരണം പ്രതിരോധം അംഗീകരിക്കുന്നില്ല.",
                f"{salute_ml} {learned_ml}-ന്റെ വാദം നിർണായക ഘടകങ്ങൾ പരിഗണിക്കുന്നില്ല.",
                f"{salute_ml} {learned_ml}-ന്റെ അവകാശവാദങ്ങൾക്ക് ആവശ്യമായ ശക്തിയില്ലെന്ന് പ്രതിരോധം തെളിയിക്കും.",
            ]
            return self.select_by_strategy(openings)
        openings = [
            f"{salute_ml if False else salute_en} the defense respectfully disagrees with the characterisation advanced by {learned}.",
            f"{salute_en} the submission of {learned} fails to account for several material aspects, with respect.",
            f"{salute_en} on a perusal of the record, {learned}'s claims are, with respect, lacking in foundation.",
        ]
        return self.select_by_strategy(openings)

    def challenge_main_claim(self) -> str:
        if not self.case_data:
            if self._is_malayalam():
                return "ഈ വിഷയത്തിൽ വാദിപക്ഷം ആവശ്യമായ തെളിവ് ഭാരമേറ്റിട്ടില്ല."
            return "The plaintiff has not met their burden of proof in this matter."

        if self._is_malayalam():
            challenges = {
                "aggressive": f"വാദിപക്ഷ അവകാശവാദങ്ങൾ പിന്തുണയില്ലാത്തതും അനുമാനാധിഷ്ഠിതവുമാണ്. {self.case_data['defense']}",
                "balanced": f"രേഖകളിലുള്ള തെളിവുകൾ പ്രകാരം {self.case_data['defense']}. വാദിപക്ഷം തെളിവ് ഭാരമേറ്റിട്ടില്ല.",
                "defensive": f"പ്രതിരോധത്തിന്റെ നിലപാട്: {self.case_data['defense']}; ഇതിന് വിരുദ്ധമായ ഉറച്ച രേഖകൾ വാദിപക്ഷം തെളിയിച്ചിട്ടില്ല.",
            }
            return challenges.get(self.strategy, challenges["balanced"])

        challenges = {
            "aggressive": f"The plaintiff's assertions are unsupported and speculative. {self.case_data['defense']}",
            "balanced": f"The evidence on record indicates that {self.case_data['defense']}. The plaintiff has not met their burden.",
            "defensive": f"The defense maintains that {self.case_data['defense']}, and the plaintiff has not established a contrary record.",
        }
        return challenges.get(self.strategy, challenges["balanced"])

    def build_claim_challenge(self, user_arguments: Dict[str, Any]) -> str:
        opening = (user_arguments or {}).get("opening") or ""
        claim_text = self._extract_key_detail(opening) if opening else ""
        if claim_text:
            if self._is_malayalam():
                return (
                    f"വാദിപക്ഷം തന്നെ പ്രാരംഭ വാദത്തിൽ പറഞ്ഞത്: {claim_text}. "
                    "എന്നാൽ duty, breach, തെളിയിച്ച നഷ്ടം എന്നിവ തമ്മിലുള്ള വ്യക്തമായ ബന്ധം ഇപ്പോഴും ഇല്ല."
                )
            return (
                f"The plaintiff's own opening focuses on: {claim_text}. "
                "That statement still lacks a clear linkage between duty, breach, and proven loss."
            )
        return self.challenge_main_claim()

    def present_defense_position(self) -> str:
        if self._is_malayalam():
            positions = [
                "പ്രതിരോധം നിയമബാധ്യതകൾക്കനുസരിച്ച് സത്ഭാവനയോടെ പ്രവർത്തിച്ചു.",
                "കരാറിലെയും ബാധകമായ മാനദണ്ഡങ്ങളിലെയും ബാധ്യതകൾ പ്രതിഭാഗം പാലിച്ചതായി തെളിവുകൾ കാണിക്കും.",
                "സാഹചര്യാനുസൃതമായി പ്രതിഭാഗം യുക്തിസഹമായ ജാഗ്രത പുലർത്തിയതായി വസ്തുതകൾ കാണിക്കുന്നു.",
            ]
            return self.select_by_strategy(positions)
        positions = [
            "The defense has acted in good faith and in accordance with applicable duties.",
            "The evidence will show the defendant fulfilled obligations under the agreement and applicable standards.",
            "The facts demonstrate the defendant exercised reasonable care consistent with the circumstances.",
        ]
        return self.select_by_strategy(positions)

    def challenge_evidence_general(self) -> str:
        if self._is_malayalam():
            challenges = {
                "aggressive": "വാദിപക്ഷത്തിന്റെ തെളിവുകൾ പരോക്ഷമാണ്; causation അല്ലെങ്കിൽ breach സ്വീകര്യമായ തെളിവോടെ സ്ഥാപിക്കുന്നില്ല.",
                "balanced": "തെളിവുകൾ അവതരിപ്പിച്ചിട്ടുണ്ടെങ്കിലും അവ വാദിപക്ഷ അവകാശവാദം നിർണായകമായി തെളിയിക്കുന്നില്ല, സ്വീകര്യതയും സംശയകരമാണ്.",
                "defensive": "ഈ തെളിവുകൾക്ക് മതിയായ തെളിവ് മൂല്യമില്ല; വാദിപക്ഷ വ്യാഖ്യാനത്തെ പിന്തുണയ്ക്കുന്നില്ല.",
            }
            return challenges.get(self.strategy, challenges["balanced"])
        challenges = {
            "aggressive": "The plaintiff's evidence is circumstantial and fails to establish causation or breach with admissible proof.",
            "balanced": "The plaintiff's evidence, while presented, does not conclusively support their claims or meet admissibility thresholds.",
            "defensive": "We submit that the evidence does not support the plaintiff's interpretation and lacks probative value.",
        }
        return challenges.get(self.strategy, challenges["balanced"])

    def challenge_evidence_specific(self, user_arguments: Dict[str, Any]) -> str:
        evidence_text = (user_arguments or {}).get("evidence") or ""
        if not evidence_text:
            if self._is_malayalam():
                return (
                    "നിർദിഷ്ട Exhibitകൾ കാണിച്ചിട്ടില്ല. രേഖകൾ, സാക്ഷികൾ, അല്ലെങ്കിൽ യാഥാർത്ഥ്യം തെളിയിച്ച രേഖകൾ ഇല്ലാതെ "
                    "വാദിപക്ഷം തെളിവ് ഭാരം നിറവേറ്റാനാകില്ല."
                )
            return (
                "No specific exhibits were identified. Without documents, witnesses, or authenticated records, "
                "the plaintiff cannot meet the evidentiary burden."
            )

        detail = self._extract_key_detail(evidence_text)
        missing_points = []
        lower = evidence_text.lower()
        if not any(token in lower for token in ["agreement", "contract", "signed", "invoice", "receipt", "bank", "transfer"]):
            missing_points.append("no documentary trail or contract record")
        if not any(token in lower for token in ["witness", "testimony", "affidavit"]):
            missing_points.append("no supporting witness testimony")
        if not any(token in lower for token in ["date", "dated", "on ", "202", "2024", "2025", "2026"]):
            missing_points.append("no clear dates tying the evidence to the alleged event")

        gap_note = ""
        if missing_points:
            gap_note = " The defense notes " + "; ".join(missing_points) + "."

        if self._is_malayalam():
            return (
                f"വാദിപക്ഷം തെളിവ് ഇങ്ങനെ വിവരിക്കുന്നു: {detail}. "
                "മുഖ്യമായി സ്വീകരിച്ചാലും, സ്വീകര്യതയും causationഉം ഉറപ്പോടെ സ്ഥാപിക്കുന്നില്ല."
                f"{gap_note}"
            )
        return (
            f"The plaintiff describes evidence as: {detail}. "
            "Even taken at face value, it does not establish admissibility and causation with certainty."
            f"{gap_note}"
        )

    def conclude_counter(self) -> str:
        if self._is_malayalam():
            conclusions = [
                "ഇവയെ അടിസ്ഥാനമാക്കി, വാദിപക്ഷം തെളിവ് ഭാരം നിറവേറ്റിയിട്ടില്ല; പ്രതിഭാഗത്തിന് അനുകൂലമായി വിധിക്കാൻ കോടതി അഭ്യർത്ഥിക്കുന്നു.",
                "ആവശ്യമായ ഘടകങ്ങൾ വാദിപക്ഷം തെളിയിച്ചിട്ടില്ല; കേസ് തള്ളിക്കളയണമെന്ന് പ്രതിരോധം അഭ്യർത്ഥിക്കുന്നു.",
                "സ്വീകര്യമായ തെളിവുകളുടെ അടിസ്ഥാനത്തിൽ പ്രതിഭാഗത്തിന് അനുകൂലമായി വിധി വരിക്കണമെന്ന് അപേക്ഷിക്കുന്നു.",
            ]
            return self.select_by_strategy(conclusions)
        conclusions = [
            "For these reasons, the plaintiff has not met the burden of proof; we request the court find for the defendant.",
            "The record shows the plaintiff has not satisfied the required elements; the defense requests dismissal.",
            "We ask the court to weigh the admissible evidence and find for the defendant.",
        ]
        return self.select_by_strategy(conclusions)

    # ============================================
    # OBJECTIONS
    # ============================================

    def consider_objection(self, user_statement: str, context: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Determine if opposing lawyer should object"""
        should_object_result = self.should_object_to_statement(user_statement, context)

        if not should_object_result.get("object"):
            return None

        return {
            "type": should_object_result["type"],
            "statement": self.formulate_objection(should_object_result["type"]),
        }

    def should_object_to_statement(self, statement: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Determine if statement should be objected to"""
        lower_statement = statement.lower()

        # Check for hearsay indicators
        if "i heard" in lower_statement or "someone told me" in lower_statement:
            return {"object": True, "type": OBJECTION_TYPES["HEARSAY"]}

        # Check for speculation
        if any(term in lower_statement for term in ["i think", "probably", "maybe"]):
            return {"object": True, "type": OBJECTION_TYPES["SPECULATION"]}

        # Check for relevance (very basic)
        if "unrelated" in lower_statement or len(statement) > 500:
            return {"object": True, "type": OBJECTION_TYPES["RELEVANCE"]}

        # Random objection for educational variety (low probability)
        if random.random() < 0.15 and self.strategy == "aggressive":
            types = list(OBJECTION_TYPES.values())
            return {"object": True, "type": random.choice(types)}

        return {"object": False}

    def formulate_objection(self, objection_type: str) -> str:
        """Formulate objection statement"""
        if self._is_malayalam():
            objections = {
                OBJECTION_TYPES["HEARSAY"]: "ആക്ഷേപം, Your Honor. കേട്ടറിവ് (hearsay).",
                OBJECTION_TYPES["RELEVANCE"]: "ആക്ഷേപം. പ്രസക്തിയില്ല, Your Honor.",
                OBJECTION_TYPES["LEADING"]: "ആക്ഷേപം. സൂചനാ ചോദ്യം (leading question).",
                OBJECTION_TYPES["SPECULATION"]: "ആക്ഷേപം, Your Honor. അനുമാനാധിഷ്ഠിതമാണ്.",
                OBJECTION_TYPES["ARGUMENTATIVE"]: "ആക്ഷേപം. വാദപ്രധാനമായ ശൈലി.",
                OBJECTION_TYPES["ASKED_AND_ANSWERED"]: "ആക്ഷേപം. ചോദിച്ചു, മറുപടി നൽകി കഴിഞ്ഞു.",
                OBJECTION_TYPES["COMPOUND"]: "ആക്ഷേപം. സംയുക്ത ചോദ്യം.",
            }
            return objections.get(objection_type, "ആക്ഷേപം, Your Honor.")
        objections = {
            OBJECTION_TYPES["HEARSAY"]: "Objection, Your Honor. Hearsay.",
            OBJECTION_TYPES["RELEVANCE"]: "Objection. Relevance, Your Honor.",
            OBJECTION_TYPES["LEADING"]: "Objection. Leading question.",
            OBJECTION_TYPES["SPECULATION"]: "Objection, Your Honor. Calls for speculation.",
            OBJECTION_TYPES["ARGUMENTATIVE"]: "Objection. Argumentative.",
            OBJECTION_TYPES["ASKED_AND_ANSWERED"]: "Objection. Asked and answered.",
            OBJECTION_TYPES["COMPOUND"]: "Objection. Compound question.",
        }
        return objections.get(objection_type, "Objection, Your Honor.")

    # ============================================
    # EVIDENCE CHALLENGES
    # ============================================

    def challenge_evidence(self, evidence_description: str) -> str:
        """Generate evidence challenge"""
        if self._is_malayalam():
            challenges = [
                "Your Honor, ഈ തെളിവിന്റെ യാഥാർത്ഥ്യം പ്രതിരോധം ചോദ്യം ചെയ്യുന്നു.",
                "Your Honor, ഈ തെളിവിന് വേണ്ട അടിസ്ഥാനമില്ല.",
                "Your Honor, ഈ തെളിവ് യഥാവിധി authentication ചെയ്യപ്പെട്ടിട്ടില്ല; സ്വീകരിക്കരുതെന്ന് പ്രതിരോധം അഭ്യർത്ഥിക്കുന്നു.",
                "Your Honor, ഇതിന്റെ prejudicial effect, probative valueനെ മറികടക്കുന്നു.",
            ]
            return random.choice(challenges)
        challenges = [
            "Your Honor, the defense questions the authenticity of this evidence.",
            "Your Honor, this evidence lacks proper foundation.",
            "Your Honor, the defense objects to the admission of this evidence as it is not properly authenticated.",
            "Your Honor, the probative value of this evidence is outweighed by its prejudicial effect.",
        ]
        return random.choice(challenges)

    # ============================================
    # RESPONSES
    # ============================================

    def respond_to_objection_ruling(self, sustained: bool) -> str:
        """Respond to objection ruling"""
        if sustained:
            if self._is_malayalam():
                responses = ["നന്ദി, Your Honor.", "രേഖപ്പെടുത്തി, Your Honor."]
                return random.choice(responses)
            responses = ["Thank you, Your Honor.", "Noted, Your Honor."]
            return random.choice(responses)
        return ""

    def respond_to_user_objection(self, sustained: bool) -> str:
        """Respond when user objects"""
        if sustained:
            if self._is_malayalam():
                responses = [
                    "മനസ്സിലായി, Your Honor. ഞാൻ പുനഃക്രമീകരിക്കാം.",
                    "ക്ഷമിക്കണം, Your Honor. വേറൊരു രീതിയിൽ അവതരിപ്പിക്കാം.",
                ]
                return random.choice(responses)
            responses = [
                "Understood, Your Honor. I will rephrase.",
                "My apologies, Your Honor. Let me approach this differently.",
            ]
            return random.choice(responses)
        else:
            if self._is_malayalam():
                responses = ["നന്ദി, Your Honor.", "ഞാൻ പറഞ്ഞതുപോലെ തുടരാം, Your Honor..."]
                return random.choice(responses)
            responses = ["Thank you, Your Honor.", "As I was saying, Your Honor..."]
            return random.choice(responses)

    # ============================================
    # STRATEGY HELPERS
    # ============================================

    def select_by_strategy(self, options: List[str]) -> str:
        """Select response based on strategy"""
        if self.strategy == "aggressive":
            return options[0]
        elif self.strategy == "defensive":
            return options[-1]
        else:  # balanced
            return options[len(options) // 2]

    def _extract_key_detail(self, text: str) -> str:
        if not text:
            return ""
        cleaned = " ".join(text.strip().split())
        if not cleaned:
            return ""
        sentence = cleaned.split(".")[0]
        words = sentence.split()
        snippet = " ".join(words[:18])
        if len(words) > 18:
            snippet += "..."
        return snippet

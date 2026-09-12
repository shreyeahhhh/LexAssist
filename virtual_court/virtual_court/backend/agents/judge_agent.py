"""
Judge Agent - AI-controlled judge with formal courtroom language
Educational Purpose Only - NOT Legal Advice
"""
import random
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import DISCLAIMERS

try:
    from .indian_court_kb import random_phrase  # type: ignore
except Exception:  # pragma: no cover
    def random_phrase(group: str, language: str = "en") -> str:  # type: ignore
        return ""


class JudgeAgent:
    def __init__(self):
        self.personality = "formal"  # formal, stern, encouraging
        self.language = "en-IN"
        self.base_tone = (
            "Respond concisely, neutral, and authoritative. "
            "Use Indian court decorum and reasoning grounded in Bharatiya Nyaya Sanhita (BNS), "
            "Bharatiya Nagarik Suraksha Sanhita (BNSS), and Bharatiya Sakshya Adhiniyam (BSA) where applicable. "
            "Do not give legal advice; speak as a presiding judge."
        )

    def set_language(self, language: str):
        self.language = language or "en-IN"

    def _is_malayalam(self) -> bool:
        return str(self.language).lower().startswith("ml")

    # ============================================
    # STAGE-SPECIFIC DIALOGUE
    # ============================================

    def open_court(self, case_data: Dict[str, Any]) -> List[str]:
        """Generate court opening statements"""
        if self._is_malayalam():
            return [
                "എല്ലാവരും എഴുന്നേൽക്കുക. കോടതി ഇപ്പോൾ സമ്മേളനത്തിലാണ്. മാന്യനായ ജഡ്ജി അധ്യക്ഷനാണ്.",
                "ദയവായി ഇരിക്കാം.",
                f"ഇന്ന് പരിഗണനയ്ക്ക് ഉള്ള കേസ്: {case_data['plaintiff']} versus {case_data['defendant']}.",
                "വാദിപക്ഷം അഭിഭാഷകേ, തയ്യാറായാൽ നിങ്ങളുടെ പ്രാരംഭ വാദം അവതരിപ്പിക്കാം.",
            ]
        return [
            "All rise. This court is now in session. The Honorable Judge presiding.",
            "Please be seated.",
            f"We are here today for the matter of {case_data['plaintiff']} versus {case_data['defendant']}.",
            "Counselor for the plaintiff, you may proceed with your opening argument when ready.",
        ]

    def introduce_opening_argument(self) -> str:
        if self._is_malayalam():
            return (
                "അഭിഭാഷകേ, ഇപ്പോൾ നിങ്ങളുടെ പ്രാരംഭ വാദം അവതരിപ്പിക്കാം. "
                "വസ്തുതകൾ വ്യക്തമായി അവതരിപ്പിച്ച് ഇന്ത്യൻ നിയമപ്രവധികളുമായി ബന്ധിപ്പിക്കുക."
            )
        return (
          "Counselor, you may now present your opening argument. "
          "State your case clearly, linking facts to applicable provisions under Indian law."
        )

    def acknowledge_opening(self, user_text: str) -> str:
        detail = self._extract_key_detail(user_text)
        ack_en = random_phrase("judge_acknowledgements", "en") or "Heard, learned counsel."
        ack_ml = random_phrase("judge_acknowledgements", "ml") or "കേട്ടിരിക്കുന്നു, ബഹുമാനപ്പെട്ട അഭിഭാഷകേ."
        if self._is_malayalam():
            if detail:
                return (
                    f"{ack_ml} കോടതി രേഖപ്പെടുത്തുന്നു: {detail} "
                    "സ്വീകര്യതയും തെളിവ് മൂല്യവും കണക്കിലെടുത്ത് തെളിവ് ഘട്ടത്തിലേക്ക് നീങ്ങുക."
                )
            return f"{ack_ml} പ്രാരംഭ വാദം രേഖപ്പെടുത്തി; ഇനി തെളിവ് സമർപ്പണത്തിലേക്ക് കടക്കാം."
        if detail:
            return (
                f"{ack_en} The court takes note: {detail} "
                "Counsel may now proceed to evidence with admissibility in mind."
            )
        return f"{ack_en} The opening is on record; counsel may proceed to the evidence stage."

    def introduce_evidence_submission(self) -> str:
        if self._is_malayalam():
            return (
                "ഇപ്പോൾ തെളിവ് സമർപ്പണ ഘട്ടത്തിലേക്ക് കടക്കാം. ഓരോ തെളിവിനും അടിസ്ഥാനം, യാഥാർത്ഥ്യം, പ്രസക്തി എന്നിവ "
                "ഭാരതീയ സാക്ഷ്യ അധിനിയമം പ്രകാരം വ്യക്തമാക്കണം."
            )
        return (
          "We will now proceed to evidence submission. Present each item with foundation, authenticity, and relevance "
          "as required under the Bharatiya Sakshya Adhiniyam."
        )

    def acknowledge_evidence(self, user_text: str) -> str:
        detail = self._extract_key_detail(user_text)
        ack_en = random_phrase("judge_acknowledgements", "en") or "The court is alive to the submission."
        ack_ml = random_phrase("judge_acknowledgements", "ml") or "സമർപ്പിച്ച വാദം രേഖപ്പെടുത്തുന്നു."
        if self._is_malayalam():
            if detail:
                return (
                    f"{ack_ml} രേഖപ്പെടുത്തുന്ന തെളിവ്: {detail} "
                    "ഭാരതീയ സാക്ഷ്യ അധിനിയമത്തിലെ വ്യവസ്ഥകൾ പ്രകാരം പ്രസക്തിയും തെളിവ് മൂല്യവും കോടതി പരിശോധിക്കും."
                )
            return f"{ack_ml} തെളിവ് സമർപ്പണം രേഖപ്പെടുത്തി; സ്വീകര്യതയും തെളിവ് മൂല്യവും കോടതി പരിശോധിക്കും."
        if detail:
            return (
                f"{ack_en} The submission tendered: {detail} "
                "The court will weigh its relevance and probative value on the touchstone of the BSA."
            )
        return (
            f"{ack_en} The evidence is on record; admissibility and probative value will be tested under the BSA."
        )

    def introduce_counter_argument(self) -> str:
        if self._is_malayalam():
            return (
                "ഇപ്പോൾ എതിർവാദം കേൾക്കും. എതിർ അഭിഭാഷകൻ തെളിവുകൾ, നടപടിക്രമങ്ങൾ, "
                "വാദിപക്ഷത്തിന്റെ കേസിലുള്ള പോരായ്മകൾ എന്നിവ അവതരിപ്പിക്കാം."
            )
        return (
          "The court will now hear from the opposing counsel. Defense may address the evidence, procedural aspects, "
          "and any gaps in the plaintiff’s case."
        )

    def introduce_closing_argument(self) -> str:
        if self._is_malayalam():
            return (
                "ഇപ്പോൾ സമാപന വാദം കേൾക്കും. പ്രധാന വസ്തുതകൾ, സ്വീകര്യമായ തെളിവുകൾ, "
                "നിയമപ്രവധികൾ പ്രകാരമുള്ള ആവശ്യപ്പെടുന്ന പരിഹാരം എന്നിവ ചുരുക്കി അവതരിപ്പിക്കുക."
            )
        return (
          "We will now hear closing arguments. Summarize key facts, admissible evidence, and the relief sought under applicable provisions."
        )

    def acknowledge_closing(self, user_text: str) -> str:
        detail = self._extract_key_detail(user_text)
        if self._is_malayalam():
            if detail:
                return f"നിങ്ങളുടെ സമാപന വാദം രേഖപ്പെടുത്തി. കോടതി രേഖപ്പെടുത്തുന്നത്: {detail}"
            return "നിങ്ങളുടെ സമാപന വാദം രേഖപ്പെടുത്തി. സമർപ്പിച്ച കാര്യങ്ങൾ കോടതി പരിഗണിക്കും."
        if detail:
            return f"Your closing argument is on record. The court notes: {detail}"
        return "Your closing argument is on record. The court will consider the submissions made."

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

    def deliver_judgment(self, case_data: Dict[str, Any], user_performance: Dict[str, Any]) -> List[str]:
        """Generate judgment statements"""
        if self._is_malayalam():
            return [
                "സമർപ്പിച്ച എല്ലാ വാദങ്ങളും തെളിവുകളും കോടതി ശ്രദ്ധാപൂർവ്വം പരിഗണിച്ചു.",
                self.predict_outcome(case_data, user_performance),
                self.generate_judgment_analysis(user_performance),
                "കോടതി പിരിഞ്ഞു.",
            ]
        return [
            "The court has carefully considered all arguments and evidence presented.",
            self.predict_outcome(case_data, user_performance),
            self.generate_judgment_analysis(user_performance),
            "Court is adjourned.",
        ]

    def predict_outcome(self, case_data: Dict[str, Any], performance: Dict[str, Any]) -> str:
        """Provide an educational, non-binding outcome prediction."""
        opening = performance.get("openingStrength", 0.0)
        evidence = performance.get("evidenceQuality", 0.0)
        closing = performance.get("closingStrength", 0.0)
        score = (opening + evidence + closing) / 3
        plaintiff = case_data.get("plaintiff", "the plaintiff")
        defendant = case_data.get("defendant", "the defendant")

        if self._is_malayalam():
            if score >= 0.75:
                return (
                    f"പരിശീലന പ്രവചനം: നിലവിലെ രേഖകളുടെ അടിസ്ഥാനത്തിൽ {plaintiff} ക്ക് അനുകൂലമായ സാധ്യത കൂടുതലാണ്, "
                    "എന്നാൽ അന്തിമഫലം സ്വീകര്യമായ തെളിവിന്റെയും തെളിയിപ്പിന്റെയും അടിസ്ഥാനത്തിലായിരിക്കും."
                )
            if score <= 0.5:
                return (
                    f"പരിശീലന പ്രവചനം: നിലവിലെ രേഖകളിൽ {defendant} ന്റെ പ്രതിരോധം കൂടുതൽ ശക്തമാണ്, "
                    "എന്നാൽ അന്തിമഫലം സ്വീകര്യമായ തെളിവിനെ ആശ്രയിച്ചിരിക്കും."
                )
            return (
                "പരിശീലന പ്രവചനം: കേസ് സമതുലിത നിലയിലാണ്. രേഖാമൂല തെളിവ്, വിശ്വാസ്യത, "
                "നടപടിക്രമ അനുസരണം എന്നിവയാണ് ഫലം നിർണയിക്കുക."
            )

        if score >= 0.75:
            return (
                f"Educational prediction: based on the submissions, the balance of probabilities favors {plaintiff}, "
                "subject to admissibility and proof."
            )
        if score <= 0.5:
            return (
                f"Educational prediction: on the present record, the defense for {defendant} appears stronger, "
                "though the outcome depends on admissible evidence."
            )
        return (
            "Educational prediction: the matter is closely balanced. The outcome would depend on documentary proof, "
            "credibility, and procedural compliance."
        )

    # ============================================
    # OBJECTION HANDLING
    # ============================================

    def rule_on_objection(self, objection_type: str, should_sustain: Optional[bool] = None) -> tuple[bool, str]:
        """Rule on an objection and return (sustained, ruling_text)"""
        sustained = should_sustain if should_sustain is not None else self.evaluate_objection(objection_type)

        if sustained:
            ruling = self.get_sustained_ruling(objection_type)
        else:
            ruling = self.get_overruled_ruling(objection_type)

        return sustained, ruling

    def evaluate_objection(self, objection_type: str) -> bool:
        """Determine if objection should be sustained (educational logic)"""
        from config import OBJECTION_TYPES

        sustain_probability = {
            OBJECTION_TYPES["HEARSAY"]: 0.6,
            OBJECTION_TYPES["RELEVANCE"]: 0.5,
            OBJECTION_TYPES["LEADING"]: 0.7,
            OBJECTION_TYPES["SPECULATION"]: 0.6,
            OBJECTION_TYPES["ARGUMENTATIVE"]: 0.5,
            OBJECTION_TYPES["ASKED_AND_ANSWERED"]: 0.7,
            OBJECTION_TYPES["COMPOUND"]: 0.6,
            "general": 0.4,
        }

        probability = sustain_probability.get(objection_type, 0.5)
        return random.random() < probability

    def get_sustained_ruling(self, objection_type: str) -> str:
        """Get ruling text when objection is sustained"""
        if self._is_malayalam():
            rulings = {
                "hearsay": "ആക്ഷേപം അംഗീകരിച്ചു. അഭിഭാഷകേ, നേരിട്ട് കണ്ടതോ രേഖാമൂല തെളിവുള്ളതോ ആയ കാര്യങ്ങളിൽ മാത്രം നിൽക്കുക.",
                "relevance": "ആക്ഷേപം അംഗീകരിച്ചു. കേസുമായി നേരിട്ട് ബന്ധപ്പെട്ട കാര്യങ്ങളിൽ മാത്രം തുടരുക.",
                "leading question": "ആക്ഷേപം അംഗീകരിച്ചു. നിർദ്ദേശാത്മകമല്ലാത്ത രീതിയിൽ ചോദ്യം പുനഃക്രമീകരിക്കുക.",
                "speculation": "ആക്ഷേപം അംഗീകരിച്ചു. അനുമാനങ്ങൾക്കു പകരം തെളിവ് അടിസ്ഥാനത്തിലുള്ള വാദം മാത്രം.",
                "argumentative": "ആക്ഷേപം അംഗീകരിച്ചു. പ്രൊഫഷണൽ രീതിയിൽ തുടരുക.",
                "asked and answered": "ആക്ഷേപം അംഗീകരിച്ചു. ചോദ്യം ഇതിനകം പരിഗണിച്ചു. അടുത്ത വിഷയത്തിലേക്ക് നീങ്ങുക.",
                "compound question": "ആക്ഷേപം അംഗീകരിച്ചു. ഒരേസമയം ഒരു ചോദ്യം മാത്രം ചോദിക്കുക.",
                "authentication": "ആക്ഷേപം അംഗീകരിച്ചു. രേഖയുടെ യാഥാർത്ഥ്യം തെളിയിക്കുന്ന അടിസ്ഥാനമില്ല; ആവശ്യമായ തെളിവോടെ വീണ്ടും സമർപ്പിക്കുക.",
                "general": "ആക്ഷേപം അംഗീകരിച്ചു. ദയവായി പ്രസ്താവന പുനഃക്രമീകരിക്കുക.",
            }
            return rulings.get(objection_type, rulings["general"])
        rulings = {
            "hearsay": "Objection sustained. Counselor, please limit your testimony to what you directly observed or have documented evidence for.",
            "relevance": "Objection sustained. Counselor, please keep your arguments relevant to the matter at hand.",
            "leading question": "Objection sustained. Please rephrase your question without leading the witness.",
            "speculation": "Objection sustained. We will deal with facts, not speculation.",
            "argumentative": "Objection sustained. Counselor, please maintain a professional tone.",
            "asked and answered": "Objection sustained. The question has already been addressed. Please move on.",
            "compound question": "Objection sustained. Please ask one question at a time.",
            "general": "Objection sustained. Please rephrase your statement, counselor.",
        }
        return rulings.get(objection_type, rulings["general"])

    def get_overruled_ruling(self, objection_type: str) -> str:
        """Get ruling text when objection is overruled"""
        if self._is_malayalam():
            rulings = {
                "hearsay": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. hearsay നിയമത്തിലെ ഒഴിവാക്കൽ സാഹചര്യത്തിനുള്ളിൽ പ്രസ്താവന വരുന്നു. തുടരാം.",
                "relevance": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. ഈ വാദരീതി പ്രസക്തമാണെന്ന് കോടതി കാണുന്നു. തുടരുക.",
                "leading question": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. ഈ സാഹചര്യത്തിൽ ചോദ്യം അംഗീകരിക്കാം. തുടരുക.",
                "speculation": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. ന്യായമായ നിഗമനം മാത്രമാണിത്. തുടരുക.",
                "argumentative": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. ശൈലി അംഗീകരിക്കാവുന്നതാണ്. തുടരുക.",
                "asked and answered": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. അഭിഭാഷകൻ ഈ വിഷയത്തിൽ കൂടുതൽ വിശദീകരിക്കാം.",
                "compound question": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. ചോദ്യം വ്യക്തമാണ്. മറുപടി നൽകുക.",
                "authentication": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. രേഖയുടെ അടിസ്ഥാന യാഥാർത്ഥ്യം പ്രാഥമികമായി തെളിഞ്ഞതായി കോടതി കാണുന്നു. തുടരുക.",
                "general": "ആക്ഷേപം തള്ളിക്കളഞ്ഞു. തുടരാം, അഭിഭാഷകേ.",
            }
            return rulings.get(objection_type, rulings["general"])
        rulings = {
            "hearsay": "Objection overruled. The statement falls within an exception to the hearsay rule. Please continue.",
            "relevance": "Objection overruled. The court finds this line of argument relevant. Proceed, counselor.",
            "leading question": "Objection overruled. The question is acceptable in this context. Continue.",
            "speculation": "Objection overruled. The counselor is presenting a reasonable inference. Proceed.",
            "argumentative": "Objection overruled. The tone is within acceptable bounds. Continue.",
            "asked and answered": "Objection overruled. The counselor may elaborate on this point.",
            "compound question": "Objection overruled. The question is sufficiently clear. Please answer, counselor.",
            "general": "Objection overruled. Please continue, counselor.",
        }
        return rulings.get(objection_type, rulings["general"])

    # ============================================
    # INTERVENTIONS
    # ============================================

    def warn_out_of_turn(self) -> str:
        if self._is_malayalam():
            warnings = [
                "കോടതിയിൽ ക്രമം പാലിക്കുക. അഭിഭാഷകേ, നിങ്ങളുടെ വാരം വരുമ്പോൾ മാത്രം സംസാരിക്കുക.",
                "അഭിഭാഷകേ, കോടതി അനുമതി കിട്ടുമ്പോൾ മാത്രം സംസാരിക്കുക.",
                "കോടതി ശിഷ്ടാചാരം പാലിച്ച് നിങ്ങളുടെ വാരം കാത്തിരിക്കുക.",
            ]
            return random.choice(warnings)
        warnings = [
            "Order in the court. Please wait for your turn to speak, counselor.",
            "Counselor, you must wait to be recognized before speaking.",
            "Please maintain courtroom decorum and wait for your turn.",
        ]
        return random.choice(warnings)

    def warn_time_exceeded(self) -> str:
        if self._is_malayalam():
            return "അഭിഭാഷകേ, അനുവദിച്ച സമയം കഴിഞ്ഞു. ദയവായി വാദം ചുരുക്കി അവസാനിപ്പിക്കുക."
        return "Counselor, you have exceeded your allotted time. Please conclude your statement."

    def request_clarification(self) -> str:
        if self._is_malayalam():
            requests = [
                "ക്ഷമിക്കണം അഭിഭാഷകേ, ദയവായി വീണ്ടും പറയാമോ?",
                "കോടതിക്ക് വ്യക്തമായി കേൾക്കാനായില്ല. ദയവായി വീണ്ടും പറയുക.",
                "ദയവായി കൂടുതൽ വ്യക്തമായി സംസാരിക്കുക.",
            ]
            return random.choice(requests)
        requests = [
            "I apologize, counselor. Could you please repeat that?",
            "The court did not catch that. Please repeat your statement.",
            "Please speak more clearly, counselor.",
        ]
        return random.choice(requests)

    # ============================================
    # EDUCATIONAL FEEDBACK
    # ============================================

    def generate_judgment_analysis(self, performance: Dict[str, Any]) -> str:
        """Generate analysis of user performance"""
        strengths = []
        improvements = []

        if performance.get("openingStrength", 0) > 0.7:
            strengths.append("strong opening argument")
        else:
            improvements.append("more compelling opening statement")

        if performance.get("evidenceQuality", 0) > 0.7:
            strengths.append("well-supported evidence")
        else:
            improvements.append("stronger evidentiary support")

        if performance.get("closingStrength", 0) > 0.7:
            strengths.append("persuasive closing argument")
        else:
            improvements.append("more impactful closing statement")

        if self._is_malayalam():
            analysis = "ഈ പരിശീലന സിമുലേഷനിൽ, "
            if strengths:
                analysis += f"വാദിപക്ഷ അഭിഭാഷകൻ {', '.join(strengths)} പ്രകടിപ്പിച്ചു. "
            if improvements:
                analysis += f"മെച്ചപ്പെടുത്തേണ്ട മേഖലകൾ: {', '.join(improvements)}. "
            return analysis

        analysis = "In this educational simulation, "

        if strengths:
            analysis += f"the plaintiff's counsel demonstrated {', '.join(strengths)}. "

        if improvements:
            analysis += f"Areas for improvement include {', '.join(improvements)}. "

        return analysis

    def generate_educational_feedback(self, performance: Dict[str, Any]) -> str:
        """Generate educational feedback"""
        feedback_parts = ["Educational feedback for your practice session:"]

        objections_handled = performance.get("objectionsHandled", 0)
        if objections_handled > 0:
            feedback_parts.append(f"You handled {objections_handled} objection(s) during this session.")

        speaking_time = performance.get("speakingTime", 0)
        if speaking_time:
            minutes = int(speaking_time // 60)
            feedback_parts.append(f"Your total speaking time was approximately {minutes} minutes.")

        feedback_parts.append("Continue practicing to refine your courtroom presentation skills.")

        return " ".join(feedback_parts)

    def set_personality(self, personality: str):
        """Set judge personality"""
        self.personality = personality


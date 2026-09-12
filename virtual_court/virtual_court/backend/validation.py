"""
Input Validation and Turn Management
"""
from typing import Dict, Any, Optional
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from config import STAGES, ROLES, OBJECTION_KEYWORDS, OBJECTION_TYPES


class VoiceRules:
    """Handles turn-taking rules and objection detection"""

    def __init__(self):
        self.current_speaker = None
        self.turn_start_time: Optional[float] = None

    def get_turn_rules(self, stage: str) -> Dict[str, Any]:
        """Get rules for current stage"""
        rules = {
            STAGES["COURT_OPENING"]: {
                "speaker": ROLES["JUDGE"],
                "userCanSpeak": False,
                "reason": "Judge is opening the court session",
                "canBeInterrupted": False,
            },
            STAGES["OPENING_ARGUMENT"]: {
                "speaker": ROLES["USER_LAWYER"],
                "userCanSpeak": True,
                "reason": "Your turn to present opening argument",
                "canBeInterrupted": True,
                "maxDuration": 120000,  # 2 minutes
            },
            STAGES["EVIDENCE_SUBMISSION"]: {
                "speaker": ROLES["USER_LAWYER"],
                "userCanSpeak": True,
                "reason": "Your turn to submit evidence",
                "canBeInterrupted": True,
                "maxDuration": 180000,  # 3 minutes
            },
            STAGES["OBJECTION"]: {
                "speaker": ROLES["JUDGE"],
                "userCanSpeak": False,
                "reason": "Judge is ruling on objection",
                "allowResponse": True,
            },
            STAGES["COUNTER_ARGUMENT"]: {
                "speaker": ROLES["OPPOSING_LAWYER"],
                "userCanSpeak": False,
                "reason": "Opposing counsel is presenting counter-argument",
                "canObject": True,
                "maxDuration": 120000,
            },
            STAGES["CLOSING_ARGUMENT"]: {
                "speaker": ROLES["USER_LAWYER"],
                "userCanSpeak": True,
                "reason": "Your turn to present closing argument",
                "canBeInterrupted": False,
                "maxDuration": 120000,
            },
            STAGES["EDUCATIONAL_JUDGMENT"]: {
                "speaker": ROLES["JUDGE"],
                "userCanSpeak": False,
                "reason": "Judge is delivering educational judgment",
            },
        }
        return rules.get(stage, {"userCanSpeak": False, "reason": "Invalid stage"})

    def detect_objection(self, spoken_text: str) -> Dict[str, Any]:
        """Detect if input contains objection"""
        lower_text = spoken_text.lower().strip()

        # Check for objection keywords
        has_objection_keyword = any(keyword in lower_text for keyword in OBJECTION_KEYWORDS)

        if not has_objection_keyword:
            return {"isObjection": False, "type": None, "confidence": 0}

        # Detect objection type
        objection_types_map = {
            "hearsay": ["hearsay", "hear say"],
            "relevance": ["relevance", "relevant", "irrelevant"],
            "leading": ["leading", "leading question"],
            "speculation": ["speculation", "speculative"],
            "argumentative": ["argumentative", "arguing"],
            "asked and answered": ["asked and answered", "already asked"],
            "compound question": ["compound", "multiple questions"],
        }

        detected_type = "general"
        confidence = 0.7

        for obj_type, keywords in objection_types_map.items():
            if any(keyword in lower_text for keyword in keywords):
                detected_type = obj_type
                confidence = 0.9
                break

        return {"isObjection": True, "type": detected_type, "confidence": confidence}

    def can_object_at_stage(self, stage: str) -> bool:
        """Check if objection allowed at current stage"""
        rules = self.get_turn_rules(stage)
        return rules.get("canBeInterrupted", False) or rules.get("canObject", False)

    def process_objection(self, stage: str, objection_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process objection and determine next action"""
        if not self.can_object_at_stage(stage):
            return {
                "allowed": False,
                "reason": "Objections are not permitted at this stage",
                "action": "IGNORE",
            }

        return {
            "allowed": True,
            "type": objection_data["type"],
            "action": "PAUSE_AND_RULE",
            "nextStage": STAGES["OBJECTION"],
        }

    def handle_interruption(self, stage: str, spoken_text: str) -> Dict[str, Any]:
        """Handle when user tries to speak out of turn"""
        objection = self.detect_objection(spoken_text)

        if objection["isObjection"]:
            return self.process_objection(stage, objection)

        return {
            "allowed": False,
            "reason": "Please wait for your turn to speak",
            "action": "JUDGE_WARNING",
            "judgeResponse": "Order in the court. Please wait for your turn to speak, counselor.",
        }

    def check_time_limit(self, stage: str) -> Dict[str, Any]:
        """Check if speaking time limit exceeded"""
        import time

        if not self.turn_start_time:
            return {"exceeded": False}

        rules = self.get_turn_rules(stage)
        max_duration = rules.get("maxDuration", float("inf"))
        elapsed = (time.time() * 1000) - self.turn_start_time

        if elapsed > max_duration:
            return {
                "exceeded": True,
                "elapsed": elapsed,
                "maxDuration": max_duration,
                "action": "JUDGE_INTERRUPT",
                "judgeResponse": "Counselor, please wrap up your statement. You have exceeded your allotted time.",
            }

        return {"exceeded": False, "elapsed": elapsed}

    def start_turn(self, speaker: str):
        """Start tracking speaking time"""
        import time

        self.current_speaker = speaker
        self.turn_start_time = time.time() * 1000

    def end_turn(self):
        """End current turn"""
        self.current_speaker = None
        self.turn_start_time = None


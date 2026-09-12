"""
Courtroom State Machine - Manages stage progression and flow control
"""
from typing import Dict, Any, Optional, Callable
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from config import STAGES, STAGE_ORDER, ROLES
from validation import VoiceRules


class CourtroomStateMachine:
    def __init__(self):
        self.voice_rules = VoiceRules()
        self.current_stage: Optional[str] = None
        self.current_stage_index = -1
        self.is_session_active = False
        self.current_case: Optional[Dict[str, Any]] = None
        self.transcript_log: list = []

        # Callbacks
        self.on_stage_change_callback: Optional[Callable] = None
        self.on_session_complete_callback: Optional[Callable] = None

    # ============================================
    # SESSION MANAGEMENT
    # ============================================

    def start_session(self, case_data: Dict[str, Any]):
        """Start a new courtroom session"""
        self.current_case = case_data
        self.current_stage_index = -1
        self.is_session_active = True
        self.transcript_log = []

        self.log_system(f"Case: {case_data['title']}")
        self.log_system(f"Plaintiff: {case_data['plaintiff']}")
        self.log_system(f"Defendant: {case_data['defendant']}")

        # Start with first stage
        self.next_stage()

    def end_session(self) -> Dict[str, Any]:
        """End the session and return transcript"""
        self.is_session_active = False
        transcript = {
            "entries": self.transcript_log,
            "totalEntries": len(self.transcript_log),
        }

        if self.on_session_complete_callback:
            self.on_session_complete_callback(transcript)

        return transcript

    # ============================================
    # STAGE MANAGEMENT
    # ============================================

    def next_stage(self) -> bool:
        """Advance to next stage"""
        if not self.is_session_active:
            return False

        self.current_stage_index += 1

        if self.current_stage_index >= len(STAGE_ORDER):
            self.end_session()
            return False

        stage_name = STAGE_ORDER[self.current_stage_index]
        self.current_stage = STAGES[stage_name]

        self.log_system(f"Stage: {stage_name}")

        # Notify listeners
        if self.on_stage_change_callback:
            self.on_stage_change_callback(self.current_stage, stage_name)

        return True

    def get_current_stage(self) -> Optional[str]:
        """Get current stage tag"""
        return self.current_stage

    def get_current_stage_name(self) -> Optional[str]:
        """Get current stage name"""
        if 0 <= self.current_stage_index < len(STAGE_ORDER):
            return STAGE_ORDER[self.current_stage_index]
        return None

    # ============================================
    # INPUT PROCESSING
    # ============================================

    def process_user_input(self, transcript: str, confidence: float) -> Dict[str, Any]:
        """Process user input and validate"""
        if not self.is_session_active:
            return {"accepted": False, "reason": "Session not active"}

        rules = self.voice_rules.get_turn_rules(self.current_stage)

        if not rules.get("userCanSpeak", False) and not rules.get("canObject", False):
            # User speaking out of turn
            interruption = self.voice_rules.handle_interruption(self.current_stage, transcript)
            if not interruption.get("allowed"):
                self.log_system(interruption.get("reason", "Invalid interruption"))
                return {
                    "accepted": False,
                    "reason": interruption.get("reason"),
                    "judgeResponse": interruption.get("judgeResponse"),
                }

        # Check for objection
        objection = self.voice_rules.detect_objection(transcript)
        if objection["isObjection"]:
            return self.handle_objection(transcript, objection)

        # Check time limit
        time_check = self.voice_rules.check_time_limit(self.current_stage)
        if time_check.get("exceeded"):
            self.log_system("Time limit exceeded")
            return {
                "accepted": False,
                "reason": "Time limit exceeded",
                "judgeResponse": time_check.get("judgeResponse"),
                "shouldAdvance": True,
            }

        # Accept input
        self.log_user_input(transcript, confidence)
        return {"accepted": True, "transcript": transcript, "confidence": confidence}

    def handle_objection(self, transcript: str, objection_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle objection from user"""
        result = self.voice_rules.process_objection(self.current_stage, objection_data)

        if not result.get("allowed"):
            self.log_system(result.get("reason", "Objection not allowed"))
            return {"accepted": False, "reason": result.get("reason"), "isObjection": True}

        # Log objection
        self.log_objection(ROLES["USER_LAWYER"], objection_data["type"], transcript)

        return {
            "accepted": True,
            "isObjection": True,
            "objectionType": objection_data["type"],
            "requiresJudgeRuling": True,
        }

    # ============================================
    # TRANSCRIPT LOGGING
    # ============================================

    def log_user_input(self, text: str, confidence: float):
        """Log user input to transcript"""
        from datetime import datetime

        self.transcript_log.append(
            {
                "role": ROLES["USER_LAWYER"],
                "text": text,
                "timestamp": datetime.now().isoformat(),
                "confidence": confidence,
            }
        )

    def log_system(self, text: str):
        """Log system message"""
        from datetime import datetime

        self.transcript_log.append(
            {"role": ROLES["SYSTEM"], "text": text, "timestamp": datetime.now().isoformat()}
        )

    def log_ai_speech(self, role: str, text: str):
        """Log AI agent speech"""
        from datetime import datetime

        self.transcript_log.append(
            {"role": role, "text": text, "timestamp": datetime.now().isoformat()}
        )

    def log_objection(self, role: str, objection_type: str, text: str):
        """Log objection"""
        from datetime import datetime

        self.transcript_log.append(
            {
                "role": role,
                "text": text,
                "timestamp": datetime.now().isoformat(),
                "objectionType": objection_type,
            }
        )

    # ============================================
    # STATE QUERIES
    # ============================================

    def get_state(self) -> Dict[str, Any]:
        """Get current state"""
        rules = self.voice_rules.get_turn_rules(self.current_stage)
        return {
            "isActive": self.is_session_active,
            "currentStage": self.current_stage,
            "currentStageName": self.get_current_stage_name(),
            "stageIndex": self.current_stage_index,
            "totalStages": len(STAGE_ORDER),
            "currentCase": self.current_case,
            "canUserSpeak": rules.get("userCanSpeak", False),
        }

    def get_progress(self) -> Dict[str, Any]:
        """Get progress information"""
        return {
            "current": self.current_stage_index + 1,
            "total": len(STAGE_ORDER),
            "percentage": ((self.current_stage_index + 1) / len(STAGE_ORDER)) * 100,
        }

    # ============================================
    # CALLBACKS
    # ============================================

    def on_stage_change(self, callback: Callable):
        """Register stage change callback"""
        self.on_stage_change_callback = callback

    def on_session_complete(self, callback: Callable):
        """Register session complete callback"""
        self.on_session_complete_callback = callback


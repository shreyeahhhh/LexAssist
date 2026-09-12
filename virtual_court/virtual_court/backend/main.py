"""
FastAPI Backend for Virtual Courtroom Simulation
Educational Purpose Only - NOT Legal Advice
"""
import asyncio
import base64
import json
import os
import sys
from dotenv import load_dotenv
from pathlib import Path
import time
from io import BytesIO
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from groq import Groq
from fastapi.middleware.cors import CORSMiddleware

# Optional document/image processing dependencies. The upload endpoint degrades
# gracefully if any of these are missing; the only mandatory bits are FastAPI
# multipart support (python-multipart) and the Groq client.
try:
    import fitz  # PyMuPDF, for PDF text extraction
except Exception:  # pragma: no cover
    fitz = None

try:
    from PIL import Image, ImageOps
except Exception:  # pragma: no cover
    Image = None
    ImageOps = None

try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None

try:
    import docx as docx_module  # python-docx
except Exception:  # pragma: no cover
    docx_module = None

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from config import SAMPLE_CASES, STAGES, DISCLAIMERS
from state_machine import CourtroomStateMachine
from agents.judge_agent import JudgeAgent
from agents.opposing_lawyer_agent import OpposingLawyerAgent
from agents import dialogue_engine
from models.schemas import ServerMessage

app = FastAPI(title="Virtual Courtroom API")

# Load env vars from backend/.env, repo root/.env, or Server/.env
load_dotenv()
repo_root = Path(__file__).resolve().parents[3]
load_dotenv(repo_root / ".env", override=False)
load_dotenv(repo_root / "Server" / ".env", override=False)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "https://law-pal.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SessionManager:
    """Manages active courtroom sessions"""

    def __init__(self):
        self.sessions: Dict[str, "CourtroomSession"] = {}

    def create_session(self, session_id: str) -> "CourtroomSession":
        """Create a new session"""
        session = CourtroomSession(session_id)
        self.sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional["CourtroomSession"]:
        """Get existing session"""
        return self.sessions.get(session_id)

    def remove_session(self, session_id: str):
        """Remove session"""
        if session_id in self.sessions:
            del self.sessions[session_id]


session_manager = SessionManager()

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION_MODEL = os.getenv(
    "GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"
)
# Be generous at the client level — individual calls in dialogue_engine pass a
# tighter per-call timeout. This caps how long any single Groq HTTP request can
# stall before httpx raises a timeout instead of hanging the whole websocket.
GROQ_HTTP_TIMEOUT = float(os.getenv("GROQ_HTTP_TIMEOUT", "60"))
groq_client = (
    Groq(api_key=GROQ_API_KEY, timeout=GROQ_HTTP_TIMEOUT, max_retries=1)
    if GROQ_API_KEY
    else None
)

print(
    f"Virtual courtroom Groq: {'ENABLED' if groq_client else 'DISABLED'} "
    f"(timeout={GROQ_HTTP_TIMEOUT}s)"
)


class CourtroomSession:
    """Represents a single courtroom session"""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.websocket: Optional[WebSocket] = None
        self.language = "en-IN"
        self.state_machine = CourtroomStateMachine()
        self.judge = JudgeAgent()
        self.opposing_lawyer = OpposingLawyerAgent()

        self.user_performance = {
            "openingStrength": 0.0,
            "evidenceQuality": 0.0,
            "closingStrength": 0.0,
            "objectionsHandled": 0,
            "speakingTime": 0.0,
            "startTime": None,
        }

        self.user_arguments: Dict[str, str] = {}
        # Per-turn structured analyses produced by dialogue_engine.analyze_argument
        self.analyses: list = []
        # Bookkeeping so opposing counsel does not pile micro-objections back-to-back
        self._last_live_objection_turn: int = -10
        self._turn_counter: int = 0
        # Most recent opposing-counsel statement — used by continue_after_ruling
        # so the defense actually picks the thread back up.
        self.last_opposing_remark: str = ""
        # Counter-argument streaming state (so a mid-flow user objection can
        # pause + resume the rebuttal cleanly).
        self.pending_counter_statements: list = []
        self._counter_resume_event: Optional[asyncio.Event] = None

        # Setup state machine callbacks - use wrapper for async callback
        self.state_machine.on_stage_change(self._stage_change_wrapper)
        self.state_machine.on_session_complete(self.handle_session_complete)

    def set_language(self, language: str):
        self.language = language or "en-IN"
        if hasattr(self.judge, "set_language"):
            self.judge.set_language(self.language)
        if hasattr(self.opposing_lawyer, "set_language"):
            self.opposing_lawyer.set_language(self.language)

    def _is_malayalam(self) -> bool:
        return str(self.language).lower().startswith("ml")

    def _localize_system_message(self, message: str) -> str:
        if not self._is_malayalam():
            return message
        translations = {
            "Judge is opening the court session": "ജഡ്ജി കോടതി സമ്മേളനം ആരംഭിക്കുന്നു.",
            "Your turn to present opening argument": "പ്രാരംഭ വാദം അവതരിപ്പിക്കാൻ നിങ്ങളുടെ വാരം.",
            "Your turn to submit evidence": "തെളിവ് സമർപ്പിക്കാൻ നിങ്ങളുടെ വാരം.",
            "Judge is ruling on objection": "ജഡ്ജി ആക്ഷേപത്തിൽ വിധി പറയും.",
            "Opposing counsel is presenting counter-argument": "എതിർ അഭിഭാഷകൻ എതിർവാദം അവതരിപ്പിക്കുന്നു.",
            "Your turn to present closing argument": "സമാപന വാദം അവതരിപ്പിക്കാൻ നിങ്ങളുടെ വാരം.",
            "Judge is delivering educational judgment": "ജഡ്ജി പരിശീലന വിധി പ്രസ്താവിക്കുന്നു.",
            "Invalid stage": "അസാധുവായ ഘട്ടം.",
            "Continue your opening or click 'Complete current stage' to proceed.":
                "നിങ്ങളുടെ പ്രാരംഭ വാദം തുടരുക അല്ലെങ്കിൽ 'നിലവിലെ ഘട്ടം പൂർത്തിയാക്കുക' അമർത്തി മുന്നോട്ട് പോകുക.",
            "Submit more evidence or click 'Complete current stage' to proceed.":
                "കൂടുതൽ തെളിവ് സമർപ്പിക്കുക അല്ലെങ്കിൽ 'നിലവിലെ ഘട്ടം പൂർത്തിയാക്കുക' അമർത്തി മുന്നോട്ട് പോകുക.",
            "Continue your closing or click 'Complete current stage' to proceed.":
                "നിങ്ങളുടെ സമാപന വാദം തുടരുക അല്ലെങ്കിൽ 'നിലവിലെ ഘട്ടം പൂർത്തിയാക്കുക' അമർത്തി മുന്നോട്ട് പോകുക.",
            "Objection ruled. You may continue.":
                "ആക്ഷേപത്തിൽ വിധി പ്രസ്താവിച്ചു. നിങ്ങൾക്ക് തുടരാം.",
            "You may continue or click 'Complete current stage' when ready.":
                "തുടരാം, അല്ലെങ്കിൽ തയ്യാറായാൽ 'നിലവിലെ ഘട്ടം പൂർത്തിയാക്കുക' അമർത്താം.",
            "Session not active": "സെഷൻ സജീവമല്ല.",
            "Objections are not permitted at this stage": "ഈ ഘട്ടത്തിൽ ആക്ഷേപങ്ങൾ അനുവദനീയമല്ല.",
            "Please wait for your turn to speak": "സംസാരിക്കാൻ നിങ്ങളുടെ വാരം കാത്തിരിക്കുക.",
            "Time limit exceeded": "സമയപരിധി കഴിഞ്ഞു.",
        }
        return translations.get(message, message)

    def _stage_change_wrapper(self, stage: str, stage_name: str):
        """Wrapper to run async callback from sync context"""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.handle_stage_change(stage, stage_name))
        except RuntimeError:
            # Create new event loop if needed
            asyncio.run(self.handle_stage_change(stage, stage_name))

    async def set_websocket(self, websocket: WebSocket):
        """Set WebSocket connection"""
        self.websocket = websocket

    async def send_message(self, message_type: str, data: Dict[str, Any], role: Optional[str] = None):
        """Send message to client"""
        if not self.websocket:
            return

        if self._is_malayalam():
            mutable_data = dict(data or {})
            if "message" in mutable_data and isinstance(mutable_data["message"], str):
                mutable_data["message"] = self._localize_system_message(mutable_data["message"])
            if "instructions" in mutable_data and isinstance(mutable_data["instructions"], str):
                mutable_data["instructions"] = self._localize_system_message(mutable_data["instructions"])
            data = mutable_data

        message = ServerMessage(
            type=message_type, data=data, role=role, timestamp=datetime.now().isoformat()
        )
        await self.websocket.send_json(message.model_dump())

    async def handle_stage_change(self, stage: str, stage_name: str):
        """Handle stage change"""
        rules = self.state_machine.voice_rules.get_turn_rules(stage)

        # Send stage change message
        await self.send_message(
            "stage_change",
            {
                "stage": stage,
                "stageName": stage_name,
                "canUserSpeak": rules.get("userCanSpeak", False),
                "instructions": rules.get("reason", ""),
            },
        )

        # Handle stage-specific logic
        if stage_name == "COURT_OPENING":
            await self.handle_court_opening()
        elif stage_name == "OPENING_ARGUMENT":
            await self.handle_opening_argument()
        elif stage_name == "EVIDENCE_SUBMISSION":
            await self.handle_evidence_submission()
        elif stage_name == "COUNTER_ARGUMENT":
            await self.handle_counter_argument()
        elif stage_name == "CLOSING_ARGUMENT":
            await self.handle_closing_argument()
        elif stage_name == "EDUCATIONAL_JUDGMENT":
            await self.handle_educational_judgment()

    async def handle_court_opening(self):
        """Handle court opening stage"""
        case_data = self.state_machine.current_case
        statements = self.judge.open_court(case_data)

        for statement in statements:
            await self.send_message("ai_speech", {"text": statement, "requiresResponse": False}, "JUDGE")
            self.state_machine.log_ai_speech("JUDGE", statement)
            await asyncio.sleep(2)  # Delay between statements

        # Auto-advance after opening
        await asyncio.sleep(1)
        self.state_machine.next_stage()

    async def handle_opening_argument(self):
        """Handle opening argument stage"""
        statement = self.judge.introduce_opening_argument()
        await self.send_message("ai_speech", {"text": statement, "requiresResponse": False}, "JUDGE")
        self.state_machine.log_ai_speech("JUDGE", statement)
        self.state_machine.voice_rules.start_turn("USER_LAWYER")

    async def handle_evidence_submission(self):
        """Handle evidence submission stage"""
        statement = self.judge.introduce_evidence_submission()
        await self.send_message("ai_speech", {"text": statement, "requiresResponse": False}, "JUDGE")
        self.state_machine.log_ai_speech("JUDGE", statement)
        self.state_machine.voice_rules.start_turn("USER_LAWYER")

    async def handle_counter_argument(self):
        """Handle counter argument stage with interruptible streaming."""
        statement = self.judge.introduce_counter_argument()
        await self.send_message("ai_speech", {"text": statement, "requiresResponse": False}, "JUDGE")
        self.state_machine.log_ai_speech("JUDGE", statement)

        await asyncio.sleep(2)

        case_data = self.state_machine.current_case or {}
        counter_statements = None
        if groq_client:
            counter_statements = dialogue_engine.counter_argument_block(
                groq_client,
                GROQ_MODEL,
                user_arguments=self.user_arguments,
                analyses=self.analyses,
                case_data=case_data,
                language=self.language,
                strategy=self.opposing_lawyer.strategy,
            )

        if not counter_statements:
            counter_statements = self.opposing_lawyer.present_counter_argument(self.user_arguments)

        # Queue and stream the statements one at a time. handle_objection can
        # pause this loop via _counter_resume_event so the user can interrupt.
        self.pending_counter_statements = list(counter_statements)
        self._counter_resume_event = asyncio.Event()
        self._counter_resume_event.set()

        try:
            while self.pending_counter_statements:
                # Block here while an objection is being processed.
                await self._counter_resume_event.wait()
                stmt = self.pending_counter_statements.pop(0)
                await self._emit_opposing_speech(stmt)
                await asyncio.sleep(2)
        finally:
            self._counter_resume_event = None

        await asyncio.sleep(1)
        self.state_machine.next_stage()

    async def handle_closing_argument(self):
        """Handle closing argument stage"""
        statement = self.judge.introduce_closing_argument()
        await self.send_message("ai_speech", {"text": statement, "requiresResponse": False}, "JUDGE")
        self.state_machine.log_ai_speech("JUDGE", statement)
        self.state_machine.voice_rules.start_turn("USER_LAWYER")

    async def handle_educational_judgment(self):
        """Handle educational judgment stage"""
        self.calculate_performance()
        case_data = self.state_machine.current_case or {}

        statements = None
        if groq_client:
            statements = dialogue_engine.final_judgment(
                groq_client,
                GROQ_MODEL,
                case_data=case_data,
                user_arguments=self.user_arguments,
                analyses=self.analyses,
                performance=self.user_performance,
                language=self.language,
            )

        if not statements:
            statements = self.judge.deliver_judgment(case_data, self.user_performance)

        for stmt in statements:
            await self.send_message("ai_speech", {"text": stmt, "requiresResponse": False}, "JUDGE")
            self.state_machine.log_ai_speech("JUDGE", stmt)
            await asyncio.sleep(2)

    async def handle_user_input(self, transcript: str, confidence: float):
        """Handle user input"""
        result = self.state_machine.process_user_input(transcript, confidence)
        stage_name = self.state_machine.get_current_stage_name()

        if not result.get("accepted"):
            # Input rejected
            judge_response = result.get("judgeResponse")
            if judge_response:
                await self.send_message("ai_speech", {"text": judge_response, "requiresResponse": False}, "JUDGE")
                self.state_machine.log_ai_speech("JUDGE", judge_response)

            if result.get("shouldAdvance"):
                if stage_name in ["OPENING_ARGUMENT", "EVIDENCE_SUBMISSION", "CLOSING_ARGUMENT"]:
                    await self.send_message(
                        "system",
                        {"message": "You may continue or click 'Complete current stage' when ready.", "level": "info"},
                    )
                else:
                    await asyncio.sleep(2)
                    self.state_machine.next_stage()

            await self.send_message("system", {"message": result.get("reason", "Input rejected"), "level": "warning"})
            return

        # Input accepted
        if result.get("isObjection") and result.get("requiresJudgeRuling"):
            await self.handle_objection(result.get("objectionType"))
        else:
            self.track_user_performance(transcript, self.state_machine.get_current_stage())

        # Send confirmation
        await self.send_message("user_input_accepted", {"transcript": transcript})

        # Reactive flow: analyse → optional live objection → judge speaks → opposing counsel speaks
        if stage_name in ["OPENING_ARGUMENT", "EVIDENCE_SUBMISSION", "CLOSING_ARGUMENT"]:
            self._turn_counter += 1
            case_data = self.state_machine.current_case or {}

            # 1) Run the analyzer so downstream prompts can hit the inner meaning.
            analysis = None
            if groq_client:
                analysis = dialogue_engine.analyze_argument(
                    groq_client,
                    GROQ_MODEL,
                    transcript,
                    stage=stage_name,
                    case_data=case_data,
                )
            if analysis:
                self.analyses.append({
                    "stage": stage_name,
                    "transcript": transcript,
                    **analysis,
                })

            recent_history = self.state_machine.transcript_log[-8:]

            # 2) Live opposing-counsel micro-objection if a clear defect is detected
            #    and we haven't fired one in the last two turns.
            live_remark = None
            if (
                groq_client
                and stage_name in ("OPENING_ARGUMENT", "EVIDENCE_SUBMISSION")
                and dialogue_engine.should_live_object(analysis)
                and self._turn_counter - self._last_live_objection_turn >= 2
            ):
                live_remark = dialogue_engine.live_objection(
                    groq_client,
                    GROQ_MODEL,
                    transcript=transcript,
                    analysis=analysis,
                    case_data=case_data,
                    language=self.language,
                )
                if live_remark:
                    self._last_live_objection_turn = self._turn_counter
                    await asyncio.sleep(0.4)
                    await self._emit_opposing_speech(live_remark)

            # 3) Judge response — engine first, then template fallback.
            judge_resp = None
            if groq_client:
                judge_resp = dialogue_engine.judge_speak(
                    groq_client,
                    GROQ_MODEL,
                    stage=stage_name,
                    transcript=transcript,
                    analysis=analysis,
                    case_data=case_data,
                    history=recent_history,
                    language=self.language,
                )
            if not judge_resp:
                judge_resp = (
                    self.judge.acknowledge_opening(transcript)
                    if stage_name == "OPENING_ARGUMENT"
                    else self.judge.acknowledge_evidence(transcript)
                    if stage_name == "EVIDENCE_SUBMISSION"
                    else self.judge.acknowledge_closing(transcript)
                )

            if judge_resp:
                await asyncio.sleep(0.5)
                await self.send_message("ai_speech", {"text": judge_resp, "requiresResponse": False}, "JUDGE")
                self.state_machine.log_ai_speech("JUDGE", judge_resp)

            # 4) Opposing counsel reaction. Selective — keep the courtroom natural:
            #    - Skip if a live objection already fired (don't double-speak).
            #    - Skip on closing argument (user owns the last word) unless a real defect.
            #    - Otherwise speak only if the analyzer surfaced concrete weaknesses.
            has_weakness = bool(analysis and analysis.get("weaknesses"))
            already_spoke = bool(live_remark)
            should_speak_defense = (
                groq_client
                and not already_spoke
                and has_weakness
                and stage_name != "CLOSING_ARGUMENT"
            )
            defense_resp = None
            if should_speak_defense:
                defense_resp = dialogue_engine.counsel_speak(
                    groq_client,
                    GROQ_MODEL,
                    stage=stage_name,
                    transcript=transcript,
                    analysis=analysis,
                    case_data=case_data,
                    history=recent_history,
                    language=self.language,
                    strategy=self.opposing_lawyer.strategy,
                )

            if defense_resp:
                await asyncio.sleep(0.7)
                await self._emit_opposing_speech(defense_resp)

            info_message = {
                "OPENING_ARGUMENT": "Continue your opening or click 'Complete current stage' to proceed.",
                "EVIDENCE_SUBMISSION": "Submit more evidence or click 'Complete current stage' to proceed.",
                "CLOSING_ARGUMENT": "Continue your closing or click 'Complete current stage' to proceed.",
            }
            await self.send_message(
                "system",
                {"message": info_message.get(stage_name, "You may continue or complete the stage."), "level": "info"},
            )

    async def handle_objection(self, objection_type: str):
        """
        Handle a user objection in three beats:
            1) Judge rules.
            2) Opposing counsel briefly acknowledges the ruling.
            3) Opposing counsel delivers a SUBSTANTIVE continuation that picks up
               their argument from the prior thread (the missing piece that
               previously made the defense look like it just stopped).

        During COUNTER_ARGUMENT the running counter-statement stream is paused
        for the duration of this handler and then resumed — so the rebuttal
        keeps flowing once the bench has dealt with the objection.
        """
        self.user_performance["objectionsHandled"] += 1
        stage_name = self.state_machine.get_current_stage_name()

        # Pause counter-argument streaming, if any.
        was_streaming_counter = (
            self._counter_resume_event is not None
            and self._counter_resume_event.is_set()
        )
        if self._counter_resume_event is not None:
            self._counter_resume_event.clear()

        try:
            # 1) Judge rules.
            await asyncio.sleep(1.0)
            sustained, ruling = self.judge.rule_on_objection(objection_type)
            await self.send_message(
                "objection_ruling",
                {
                    "objectionType": objection_type,
                    "ruledBy": "JUDGE",
                    "sustained": sustained,
                    "ruling": ruling,
                },
                "JUDGE",
            )
            self.state_machine.log_ai_speech("JUDGE", ruling)

            # 2) Brief acknowledgement from opposing counsel (one short line).
            ack = self.opposing_lawyer.respond_to_user_objection(sustained) or "Noted, Your Honor."
            await asyncio.sleep(0.7)
            await self._emit_opposing_speech(ack)

            # 3) Substantive continuation. THIS is what makes the defense feel
            #    like a real lawyer instead of trailing off after "as I was
            #    saying". We feed in their last remark so the LLM picks the
            #    thread back up; on a sustained ruling it pivots, on an
            #    overruled ruling it sharpens the same point.
            continuation = None
            if groq_client and self.last_opposing_remark:
                case_data = self.state_machine.current_case or {}
                continuation = dialogue_engine.continue_after_ruling(
                    groq_client,
                    GROQ_MODEL,
                    last_opposing_remark=self.last_opposing_remark,
                    objection_type=objection_type,
                    sustained=sustained,
                    case_data=case_data,
                    user_arguments=self.user_arguments,
                    language=self.language,
                    strategy=self.opposing_lawyer.strategy,
                )

            if continuation:
                await asyncio.sleep(0.8)
                await self._emit_opposing_speech(continuation)
        finally:
            # 4) Resume streaming if we paused a counter-argument run.
            if self._counter_resume_event is not None and was_streaming_counter:
                self._counter_resume_event.set()

        # 5) Re-open the floor for the user (only when we are NOT in the middle
        #    of a streamed counter-argument — that keeps flowing on its own).
        if stage_name in ("OPENING_ARGUMENT", "EVIDENCE_SUBMISSION", "CLOSING_ARGUMENT"):
            self.state_machine.voice_rules.start_turn("USER_LAWYER")
            await self.send_message(
                "system",
                {"message": "Objection ruled. You may continue.", "level": "info"},
            )
        elif stage_name == "COUNTER_ARGUMENT" and not self.pending_counter_statements:
            # No more counter statements queued (or streaming never started) →
            # nudge the flow forward like before.
            await asyncio.sleep(1)
            self.state_machine.next_stage()

    def track_user_performance(self, transcript: str, stage: str):
        """Track user performance metrics"""
        word_count = len(transcript.split())
        has_legal_terms = self.contains_legal_terminology(transcript)
        is_structured = self.is_well_structured(transcript)

        score = self.calculate_statement_score(word_count, has_legal_terms, is_structured)

        stage_name = self.state_machine.get_current_stage_name()
        if stage_name == "OPENING_ARGUMENT":
            self.user_performance["openingStrength"] = max(self.user_performance["openingStrength"], score)
            self.user_arguments["opening"] = transcript
        elif stage_name == "EVIDENCE_SUBMISSION":
            self.user_performance["evidenceQuality"] = max(self.user_performance["evidenceQuality"], score)
            if self.user_arguments.get("evidence"):
                self.user_arguments["evidence"] = f"{self.user_arguments['evidence']} | {transcript}"
            else:
                self.user_arguments["evidence"] = transcript
        elif stage_name == "CLOSING_ARGUMENT":
            self.user_performance["closingStrength"] = max(self.user_performance["closingStrength"], score)
            self.user_arguments["closing"] = transcript

    def generate_contextual_responses(self, stage_name: str, user_input: str) -> Optional[Dict[str, str]]:
        """Generate judge and defense responses using Groq, if configured."""
        if not groq_client:
            return None

        case_data = self.state_machine.current_case or {}
        opening = self.user_arguments.get("opening", "")
        evidence = self.user_arguments.get("evidence", "")
        closing = self.user_arguments.get("closing", "")

        system_prompt = (
            "You are an Indian courtroom simulation engine. "
            "Return a JSON object with keys: judge, defense. "
            "Use formal Indian court tone. Reference BNS/BNSS/BSA where relevant. "
            "Do not give legal advice; focus on courtroom-style feedback and counter-argument. "
            "Keep each response concise (2-4 sentences)."
        )
        if self._is_malayalam():
            system_prompt += " Respond fully in Malayalam language."

        user_prompt = (
            "Context:\n"
            f"Stage: {stage_name}\n"
            f"Case title: {case_data.get('title')}\n"
            f"Case summary: {case_data.get('description')}\n"
            f"Plaintiff: {case_data.get('plaintiff')}\n"
            f"Defendant: {case_data.get('defendant')}\n"
            f"Claim: {case_data.get('claim')}\n"
            f"Defense position: {case_data.get('defense')}\n"
            f"Opening so far: {opening}\n"
            f"Evidence so far: {evidence}\n"
            f"Closing so far: {closing}\n"
            f"Latest user input: {user_input}\n\n"
            "Return only JSON."
        )

        try:
            print("Groq prompt stage:", stage_name)
            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
                max_tokens=350,
            )
            content = response.choices[0].message.content.strip()
            print("Groq raw response:", content[:400])
            try:
                parsed = json.loads(content)
            except json.JSONDecodeError:
                # Attempt to recover JSON block
                start = content.find("{")
                end = content.rfind("}")
                if start >= 0 and end > start:
                    parsed = json.loads(content[start : end + 1])
                else:
                    return None

            judge = parsed.get("judge")
            defense = parsed.get("defense")
            if not judge and not defense:
                return None
            return {"judge": judge, "defense": defense}
        except Exception as error:
            print("Groq error:", str(error))
            return None

    def calculate_statement_score(self, word_count: int, has_legal_terms: bool, is_structured: bool) -> float:
        """Calculate score for a statement"""
        score = 0.5  # Base score

        if 50 <= word_count <= 200:
            score += 0.2
        elif word_count > 20:
            score += 0.1

        if has_legal_terms:
            score += 0.2

        if is_structured:
            score += 0.1

        return min(score, 1.0)

    def contains_legal_terminology(self, text: str) -> bool:
        """Check if text contains legal terminology"""
        legal_terms = [
            "your honor",
            "evidence",
            "testimony",
            "witness",
            "contract",
            "breach",
            "negligence",
            "damages",
            "plaintiff",
            "defendant",
            "burden of proof",
            "reasonable",
            "material",
            "substantial",
        ]
        lower_text = text.lower()
        return any(term in lower_text for term in legal_terms)

    def is_well_structured(self, text: str) -> bool:
        """Check if text is well structured"""
        transitions = ["first", "second", "third", "furthermore", "additionally", "in conclusion", "therefore", "however", "moreover"]
        lower_text = text.lower()
        return any(transition in lower_text for transition in transitions)

    def calculate_performance(self):
        """Calculate final performance metrics"""
        if self.user_performance["startTime"]:
            self.user_performance["speakingTime"] = time.time() - self.user_performance["startTime"]

        # Ensure minimum scores
        if self.user_performance["openingStrength"] == 0:
            self.user_performance["openingStrength"] = 0.5
        if self.user_performance["evidenceQuality"] == 0:
            self.user_performance["evidenceQuality"] = 0.5
        if self.user_performance["closingStrength"] == 0:
            self.user_performance["closingStrength"] = 0.5

    async def handle_session_complete(self, transcript: Dict[str, Any]):
        """Handle session completion"""
        await self.send_message("session_complete", {"transcript": transcript})

    async def _emit_opposing_speech(self, text: str):
        """Send + log an opposing-counsel utterance and remember it as the latest remark."""
        if not text:
            return
        await self.send_message(
            "ai_speech",
            {"text": text, "requiresResponse": False},
            "OPPOSING_LAWYER",
        )
        self.state_machine.log_ai_speech("OPPOSING_LAWYER", text)
        self.last_opposing_remark = text


# ---------------------------------------------------------------------------
# DOCUMENT / IMAGE EVIDENCE UPLOAD
# ---------------------------------------------------------------------------
# Single endpoint used by the virtual-courtroom frontend to attach exhibits.
# Handles PDFs, DOCX, plain text and images. For images we additionally call a
# Groq vision model so the LLM "sees" the photograph and produces a natural
# description that gets folded into the chat as evidence text.

_IMAGE_DESCRIBE_PROMPT = (
    "You are an evidence-intake clerk in an Indian court. Look at the photograph "
    "and describe, in 2-4 plain sentences, exactly what is happening — people, "
    "objects, environment, any visible text, signs, time-of-day, and anything "
    "that could matter forensically. Be factual and neutral; do not speculate "
    "about guilt or motive. If the image contains readable text (a document, "
    "screenshot, sign, etc.), transcribe the salient text within quotes. "
    "Do NOT add disclaimers."
)


def _ext_from_filename(name: str) -> str:
    name = (name or "").lower()
    for ext in (".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"):
        if name.endswith(ext):
            return ext
    return ""


def _is_image(filename: str, mimetype: str) -> bool:
    if (mimetype or "").lower().startswith("image/"):
        return True
    ext = _ext_from_filename(filename)
    return ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def _image_mime(filename: str, mimetype: str) -> str:
    mt = (mimetype or "").lower()
    if mt.startswith("image/"):
        return mt
    ext = _ext_from_filename(filename)
    return {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp",
    }.get(ext, "image/jpeg")


def _extract_pdf_text(data: bytes) -> Tuple[str, str]:
    if not fitz:
        return "", "PDF extraction is not configured on the server (PyMuPDF missing)."
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        parts = []
        for page in doc:
            t = page.get_text("text")
            if t and t.strip():
                parts.append(t)
        return "\n".join(parts), ""
    except Exception as e:
        return "", f"Failed to read PDF: {e}"


def _extract_docx_text(data: bytes) -> Tuple[str, str]:
    if not docx_module:
        return "", "DOCX parsing is not configured on the server (python-docx missing)."
    try:
        document = docx_module.Document(BytesIO(data))
        parts = [p.text for p in document.paragraphs if p.text and p.text.strip()]
        return "\n".join(parts), ""
    except Exception as e:
        return "", f"Failed to read DOCX: {e}"


def _ocr_image(data: bytes, ocr_lang: str) -> str:
    """Best-effort OCR. Returns empty string on failure (vision still runs)."""
    if not (Image and pytesseract):
        return ""
    try:
        img = Image.open(BytesIO(data)).convert("RGB")
        gray = ImageOps.grayscale(img)
        enhanced = ImageOps.autocontrast(gray)
        return pytesseract.image_to_string(
            enhanced, lang=(ocr_lang or "eng"), config="--oem 1 --psm 6"
        ) or ""
    except Exception as e:  # pragma: no cover
        print("OCR failed:", str(e)[:200])
        return ""


def _describe_image_with_groq(data: bytes, mime: str) -> Tuple[str, str]:
    """Use a Groq vision model to describe the image. Returns (description, error)."""
    if not groq_client:
        return "", "Groq is not configured on this server (set GROQ_API_KEY)."
    try:
        b64 = base64.b64encode(data).decode("ascii")
        data_url = f"data:{mime};base64,{b64}"
        response = groq_client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _IMAGE_DESCRIBE_PROMPT},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            temperature=0.2,
            max_tokens=320,
        )
        content = (response.choices[0].message.content or "").strip()
        return content, ""
    except Exception as e:  # pragma: no cover
        print("Groq vision error:", str(e)[:240])
        return "", f"Vision model call failed: {e}"


@app.post("/document-analyser/upload")
async def document_analyser_upload(
    file: UploadFile = File(...),
    ocr_lang: str = Form("eng"),
):
    """
    Accepts PDF / DOCX / TXT / Image evidence and returns a single ``text``
    field that is folded straight into the chat as exhibit content.

    Image flow:
        - run Tesseract OCR (best effort) for any literal text
        - call a Groq vision model to describe the scene
        - combine both into a clean exhibit summary
    """
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    filename = file.filename or "exhibit"
    mimetype = file.content_type or ""
    ext = _ext_from_filename(filename)

    # ---- PDF ----
    if ext == ".pdf" or mimetype.lower() == "application/pdf" or raw[:4] == b"%PDF":
        text, err = _extract_pdf_text(raw)
        if err:
            raise HTTPException(status_code=400, detail=err)
        text = (text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF.")
        if len(text) > 8000:
            text = text[:8000] + "\n…[truncated]"
        return {"text": text, "kind": "pdf", "filename": filename}

    # ---- DOCX ----
    if ext == ".docx" or "wordprocessingml.document" in mimetype.lower():
        text, err = _extract_docx_text(raw)
        if err:
            raise HTTPException(status_code=400, detail=err)
        text = (text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="No text could be extracted from the DOCX.")
        if len(text) > 8000:
            text = text[:8000] + "\n…[truncated]"
        return {"text": text, "kind": "docx", "filename": filename}

    # ---- Plain text ----
    if ext == ".txt" or mimetype.lower() == "text/plain":
        try:
            text = raw.decode("utf-8", errors="ignore").strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read text file: {e}")
        if not text:
            raise HTTPException(status_code=400, detail="The text file is empty.")
        if len(text) > 8000:
            text = text[:8000] + "\n…[truncated]"
        return {"text": text, "kind": "txt", "filename": filename}

    # ---- Image (OCR + Groq vision) ----
    if _is_image(filename, mimetype):
        ocr_text = _ocr_image(raw, ocr_lang).strip()
        mime = _image_mime(filename, mimetype)
        description, vision_err = _describe_image_with_groq(raw, mime)
        description = (description or "").strip()

        if not description and not ocr_text:
            detail = vision_err or (
                "Could not analyse the image. Tesseract OCR is not configured "
                "and the Groq vision model is unavailable."
            )
            raise HTTPException(status_code=503, detail=detail)

        # Compose a clean exhibit summary that reads naturally in the chat.
        parts = []
        if description:
            parts.append(f"Scene description (AI vision):\n{description}")
        if ocr_text:
            parts.append(f"Text recognised on image:\n{ocr_text}")
        combined = "\n\n".join(parts)
        if len(combined) > 6000:
            combined = combined[:6000] + "\n…[truncated]"
        return {
            "text": combined,
            "kind": "image",
            "filename": filename,
            "image_description": description,
            "ocr_text": ocr_text,
        }

    raise HTTPException(
        status_code=415,
        detail=f"Unsupported file type for evidence upload: {filename or mimetype or 'unknown'}",
    )


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for courtroom session"""
    await websocket.accept()

    # Get or create session
    session = session_manager.get_session(session_id)
    if not session:
        session = session_manager.create_session(session_id)

    await session.set_websocket(websocket)

    try:
        # Send initial connection message
        await session.send_message("connected", {"message": "Connected to courtroom session"})

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            message_type = message.get("type")
            message_data = message.get("data", {})

            if message_type == "start_session":
                # Start new session
                case_type = message_data.get("caseType", "CONTRACT_DISPUTE")
                user_summary = (message_data.get("userCaseSummary") or "").strip()
                session.set_language(message_data.get("language", "en-IN"))

                if case_type in SAMPLE_CASES:
                    case_data = SAMPLE_CASES[case_type]
                else:
                    # Fallback for user-provided cases
                    summary_text = user_summary or "User seeks relief."
                    defense_text = (
                        "The defendant denies liability, disputes key facts, and asserts that the plaintiff "
                        "has not established admissibility or causation."
                    )
                    case_data = {
                        "title": "User Provided Case",
                        "description": summary_text,
                        "plaintiff": "User",
                        "defendant": "Opposing Party",
                        "claim": summary_text,
                        "defense": defense_text,
                    }

                session.user_performance["startTime"] = time.time()
                session.opposing_lawyer.set_case_data(case_data)
                session.opposing_lawyer.set_strategy("balanced")
                # Start session - this will trigger stage_change callback
                session.state_machine.start_session(case_data)
                # Note: handle_stage_change is automatically called via the on_stage_change callback configured in SessionManager
                # Do NOT manually call it here or messages will send twice

            elif message_type == "user_input":
                # Handle user input
                transcript = message_data.get("transcript", "")
                confidence = message_data.get("confidence", 1.0)
                await session.handle_user_input(transcript, confidence)

            elif message_type == "stage_complete":
                # User indicates stage is complete
                await asyncio.sleep(1)
                session.state_machine.next_stage()

            elif message_type == "raise_objection":
                # User raises an objection explicitly
                await session.handle_objection(message_data.get("objectionType", "general"))

            elif message_type == "session_complete":
                # End session on user request
                transcript = session.state_machine.end_session()
                await session.send_message("session_complete", {"transcript": transcript})
                session_manager.remove_session(session_id)

            elif message_type == "get_state":
                # Get current state
                state = session.state_machine.get_state()
                progress = session.state_machine.get_progress()
                await session.send_message("state", {**state, "progress": progress})

    except WebSocketDisconnect:
        session_manager.remove_session(session_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        await session.send_message("system", {"message": f"Error: {str(e)}", "level": "error"})


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Virtual Courtroom API",
        "version": "1.0.0",
        "disclaimer": DISCLAIMERS["MAIN"],
    }


@app.get("/health")
async def health():
    """Health check"""
    return {"status": "healthy"}


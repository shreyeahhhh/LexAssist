"""
WebSocket Message Schemas
"""
from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel
from datetime import datetime


# Client -> Server Messages
class ClientMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    timestamp: Optional[str] = None


# Server -> Client Messages
class ServerMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    role: Optional[str] = None
    timestamp: Optional[str] = None


# Specific Message Types
class UserInputMessage(BaseModel):
    transcript: str
    confidence: float
    isFinal: bool


class StageChangeMessage(BaseModel):
    stage: str
    stageName: str
    canUserSpeak: bool
    instructions: str


class AISpeechMessage(BaseModel):
    text: str
    role: Literal["JUDGE", "OPPOSING_LAWYER"]
    requiresResponse: bool = False


class ObjectionMessage(BaseModel):
    objectionType: str
    ruledBy: Optional[str] = None
    sustained: Optional[bool] = None
    ruling: Optional[str] = None


class SystemMessage(BaseModel):
    message: str
    level: Literal["info", "warning", "error"] = "info"


class SessionStateMessage(BaseModel):
    isActive: bool
    currentStage: str
    microphoneEnabled: bool
    progress: float


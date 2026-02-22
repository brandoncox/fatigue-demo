"""
Pydantic models for Transcription and Shift collections
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class Segment(BaseModel):
    """Individual transcript segment"""
    id: int
    start: float
    end: float
    speaker: str  # 'pilot' or 'controller'
    text: str


class TranscriptionModel(BaseModel):
    """Transcription collection schema"""
    shift_id: str
    controller_id: str
    facility: str
    status: str = "queued"  # queued, processing, completed, error
    start_time: datetime
    end_time: datetime
    position: str
    schedule_type: str
    traffic_count_avg: int
    original_file: str
    transcription: str
    language: str = "en"
    segments: List[Segment] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Indicator(BaseModel):
    """Fatigue/Safety indicator"""
    type: str
    evidence: str
    severity: str


class Metrics(BaseModel):
    """Performance metrics"""
    avg_response_time: Optional[float] = None
    hesitation_count: Optional[int] = None
    hours_on_duty: Optional[int] = None


class FatigueAnalysis(BaseModel):
    """Fatigue analysis results"""
    score: Optional[int] = None
    severity: Optional[str] = None
    trend: Optional[str] = None
    indicators: List[Indicator] = []
    metrics: Optional[Metrics] = None


class Issue(BaseModel):
    """Safety issue"""
    type: str
    description: Optional[str] = None
    severity: Optional[str] = None


class SafetyAnalysis(BaseModel):
    """Safety analysis results"""
    score: Optional[int] = None
    severity: Optional[str] = None
    issues_found: List[Issue] = []
    requires_immediate_review: bool = False
    summary: Optional[str] = None


class Recommendation(BaseModel):
    """Supervisor recommendation"""
    priority: int
    action: str
    rationale: str


class ShiftModel(BaseModel):
    """Shift collection schema"""
    shift_id: str
    controller_id: str
    date: str
    shift_time: str
    position: str
    status: str = "queued"  # queued processing, completed, error
    executive_summary: Optional[str] = None
    fatigue_analysis: Optional[FatigueAnalysis] = None
    safety_analysis: Optional[SafetyAnalysis] = None
    recommendations: List[Recommendation] = []
    requires_attention: bool = False
    priority_level: Optional[str] = None
    transcript: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

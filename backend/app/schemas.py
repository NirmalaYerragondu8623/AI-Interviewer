from typing import Literal

from pydantic import BaseModel, Field


class Topic(BaseModel):
    topic: str


class SessionCreateRequest(BaseModel):
    topic: str
    max_questions: int = Field(gt=0)


class SkipQuestionRequest(BaseModel):
    question_id: str


class QuestionOut(BaseModel):
    question_id: str
    question_text: str
    category: str | None = None
    question_number: int
    total_questions: int
    audio_base64: str
    audio_mime: str = "audio/mpeg"


class SessionOut(BaseModel):
    id: str
    topic: str
    max_questions_requested: int
    questions_actually_used: list[str]
    current_index: int
    status: Literal["in_progress", "finished"]
    started_at: str
    ended_at: str | None = None


class AnswerFeedback(BaseModel):
    """Per-answer feedback schema — Section 5 of the spec, matched exactly."""

    question_id: str
    question_text: str
    candidate_answer_transcript: str
    score: int
    feedback: str
    reference_answer_used: str


class OverallFeedback(BaseModel):
    """Overall feedback schema — Section 6 of the spec, matched exactly."""

    session_id: str
    topic: str
    questions_asked: int
    questions_answered: int
    overall_score: float
    overall_summary: str
    strengths: list[str]
    areas_for_improvement: list[str]


class SessionStateOut(BaseModel):
    session: SessionOut
    answers: list[AnswerFeedback]
    overall_feedback: OverallFeedback | None = None

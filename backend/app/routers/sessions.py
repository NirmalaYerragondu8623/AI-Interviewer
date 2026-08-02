import base64
import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.auth import require_user
from app.schemas import (
    AnswerFeedback,
    OverallFeedback,
    QuestionOut,
    SessionCreateRequest,
    SessionOut,
    SessionStateOut,
    SkipQuestionRequest,
)
from app.services.deepgram_service import transcribe
from app.services.openai_service import generate_overall_feedback, score_answer, synthesize_speech
from app.services.storage_service import upload_answer_audio
from app.supabase_client import get_supabase

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_session_row(session_id: str) -> dict:
    result = get_supabase().table("sessions").select("*").eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    return result.data[0]


def _get_question_row(question_id: str) -> dict:
    result = get_supabase().table("question_bank").select("*").eq("id", question_id).execute()
    if not result.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    return result.data[0]


def _to_session_out(row: dict) -> SessionOut:
    return SessionOut(
        id=row["id"],
        topic=row["topic"],
        max_questions_requested=row["max_questions_requested"],
        questions_actually_used=row["questions_actually_used"],
        current_index=row["current_index"],
        status=row["status"],
        started_at=row["started_at"],
        ended_at=row.get("ended_at"),
    )


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreateRequest, user: dict = Depends(require_user)):
    candidates = (
        get_supabase().table("question_bank").select("id").eq("topic", body.topic).execute().data
    )
    if not candidates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"No questions found for topic '{body.topic}'")

    question_ids = [row["id"] for row in candidates]
    random.shuffle(question_ids)
    selected = question_ids[: body.max_questions]

    result = (
        get_supabase()
        .table("sessions")
        .insert(
            {
                "candidate_id": user["id"],
                "topic": body.topic,
                "max_questions_requested": body.max_questions,
                "questions_actually_used": selected,
                "current_index": 0,
                "status": "in_progress",
            }
        )
        .execute()
    )
    return _to_session_out(result.data[0])


@router.get("", response_model=list[SessionOut])
def list_sessions(user: dict = Depends(require_user)):
    """All sessions (in_progress and finished) belonging to the current candidate,
    most recently started first.
    """
    result = (
        get_supabase()
        .table("sessions")
        .select("*")
        .eq("candidate_id", user["id"])
        .order("started_at", desc=True)
        .execute()
    )
    return [_to_session_out(row) for row in result.data]


@router.get("/{session_id}/next-question", response_model=QuestionOut | None)
def next_question(session_id: str, _user: dict = Depends(require_user)):
    session = _get_session_row(session_id)
    question_ids = session["questions_actually_used"]
    index = session["current_index"]

    if session["status"] != "in_progress" or index >= len(question_ids):
        return None

    question = _get_question_row(question_ids[index])
    audio_bytes = synthesize_speech(question["question_text"])

    return QuestionOut(
        question_id=question["id"],
        question_text=question["question_text"],
        category=question.get("category"),
        question_number=index + 1,
        total_questions=len(question_ids),
        audio_base64=base64.b64encode(audio_bytes).decode("ascii"),
        audio_mime="audio/mpeg",
    )


@router.post("/{session_id}/answer", response_model=AnswerFeedback)
async def submit_answer(
    session_id: str,
    question_id: str = Form(...),
    file: UploadFile = File(...),
    _user: dict = Depends(require_user),
):
    session = _get_session_row(session_id)
    if session["status"] != "in_progress":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session is not in progress")

    question_ids = session["questions_actually_used"]
    index = session["current_index"]
    if index >= len(question_ids) or question_ids[index] != question_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is not the current question for this session")

    question = _get_question_row(question_id)
    audio_bytes = await file.read()
    content_type = file.content_type or "audio/webm"

    audio_path = upload_answer_audio(session_id, question_id, audio_bytes, content_type)
    transcript = transcribe(audio_bytes, content_type)
    scored = score_answer(question["question_text"], question.get("reference_answer") or "", transcript)
    scored["score"] = max(1, min(5, int(scored["score"])))

    get_supabase().table("session_answers").insert(
        {
            "session_id": session_id,
            "question_id": question_id,
            "audio_storage_path": audio_path,
            "transcript": transcript,
            "score": scored["score"],
            "feedback": scored["feedback"],
        }
    ).execute()

    get_supabase().table("sessions").update({"current_index": index + 1}).eq("id", session_id).execute()

    return AnswerFeedback(
        question_id=question_id,
        question_text=question["question_text"],
        candidate_answer_transcript=transcript,
        score=scored["score"],
        feedback=scored["feedback"],
        reference_answer_used=question.get("reference_answer") or "",
    )


@router.post("/{session_id}/skip", response_model=SessionOut)
def skip_question(session_id: str, body: SkipQuestionRequest, _user: dict = Depends(require_user)):
    """Advances past the current question without recording an answer for it —
    it's simply omitted from session_answers, so it won't be scored or counted
    in questions_answered / the overall feedback.
    """
    session = _get_session_row(session_id)
    if session["status"] != "in_progress":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Session is not in progress")

    question_ids = session["questions_actually_used"]
    index = session["current_index"]
    if index >= len(question_ids) or question_ids[index] != body.question_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This is not the current question for this session")

    result = (
        get_supabase()
        .table("sessions")
        .update({"current_index": index + 1})
        .eq("id", session_id)
        .execute()
    )
    return _to_session_out(result.data[0])


@router.post("/{session_id}/finish", response_model=OverallFeedback)
def finish_session(session_id: str, _user: dict = Depends(require_user)):
    session = _get_session_row(session_id)

    answers = (
        get_supabase()
        .table("session_answers")
        .select("*, question_bank(question_text)")
        .eq("session_id", session_id)
        .order("answered_at")
        .execute()
        .data
    )

    per_answer_results = [
        {
            "question_text": a["question_bank"]["question_text"] if a.get("question_bank") else "",
            "candidate_answer_transcript": a["transcript"],
            "score": a["score"],
            "feedback": a["feedback"],
        }
        for a in answers
    ]

    generated = generate_overall_feedback(session["topic"], per_answer_results)

    now = datetime.now(timezone.utc).isoformat()
    get_supabase().table("sessions").update({"status": "finished", "ended_at": now}).eq(
        "id", session_id
    ).execute()

    get_supabase().table("session_overall_feedback").upsert(
        {
            "session_id": session_id,
            "overall_score": generated["overall_score"],
            "overall_summary": generated["overall_summary"],
            "strengths": generated["strengths"],
            "areas_for_improvement": generated["areas_for_improvement"],
        }
    ).execute()

    return OverallFeedback(
        session_id=session_id,
        topic=session["topic"],
        questions_asked=len(session["questions_actually_used"]),
        questions_answered=len(answers),
        overall_score=generated["overall_score"],
        overall_summary=generated["overall_summary"],
        strengths=generated["strengths"],
        areas_for_improvement=generated["areas_for_improvement"],
    )


@router.get("/{session_id}", response_model=SessionStateOut)
def get_session(session_id: str, _user: dict = Depends(require_user)):
    session = _get_session_row(session_id)

    answers_rows = (
        get_supabase()
        .table("session_answers")
        .select("*, question_bank(question_text, reference_answer)")
        .eq("session_id", session_id)
        .order("answered_at")
        .execute()
        .data
    )
    answers = [
        AnswerFeedback(
            question_id=a["question_id"],
            question_text=a["question_bank"]["question_text"] if a.get("question_bank") else "",
            candidate_answer_transcript=a["transcript"],
            score=a["score"],
            feedback=a["feedback"],
            reference_answer_used=(a["question_bank"]["reference_answer"] if a.get("question_bank") else "") or "",
        )
        for a in answers_rows
    ]

    overall_row = (
        get_supabase()
        .table("session_overall_feedback")
        .select("*")
        .eq("session_id", session_id)
        .execute()
        .data
    )
    overall = None
    if overall_row:
        o = overall_row[0]
        overall = OverallFeedback(
            session_id=session_id,
            topic=session["topic"],
            questions_asked=len(session["questions_actually_used"]),
            questions_answered=len(answers),
            overall_score=o["overall_score"],
            overall_summary=o["overall_summary"],
            strengths=o["strengths"],
            areas_for_improvement=o["areas_for_improvement"],
        )

    return SessionStateOut(session=_to_session_out(session), answers=answers, overall_feedback=overall)

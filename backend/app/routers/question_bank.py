from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.auth import require_user
from app.parsers.question_bank_parser import parse_question_bank_document
from app.supabase_client import get_supabase

router = APIRouter(prefix="/question-bank", tags=["question-bank"])


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_question_bank(file: UploadFile, _user: dict = Depends(require_user)):
    content = await file.read()
    try:
        rows = parse_question_bank_document(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    result = get_supabase().table("question_bank").insert(rows).execute()
    return {"inserted": len(result.data)}


@router.get("/topics", response_model=list[str])
def list_topics(_user: dict = Depends(require_user)):
    result = get_supabase().table("question_bank").select("topic").execute()
    topics = sorted({row["topic"] for row in result.data if row.get("topic")})
    return topics

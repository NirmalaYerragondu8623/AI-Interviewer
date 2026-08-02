import uuid

from app.config import get_settings
from app.supabase_client import get_supabase


def upload_answer_audio(session_id: str, question_id: str, audio_bytes: bytes, content_type: str) -> str:
    """Uploads a candidate's answer clip to Supabase Storage and returns its storage path."""
    settings = get_settings()
    extension = "webm" if "webm" in content_type else "wav" if "wav" in content_type else "mp3" if "mp3" in content_type else "bin"
    path = f"{session_id}/{question_id}-{uuid.uuid4().hex[:8]}.{extension}"

    get_supabase().storage.from_(settings.supabase_storage_bucket).upload(
        path, audio_bytes, {"content-type": content_type}
    )
    return path

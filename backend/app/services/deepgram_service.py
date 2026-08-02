import httpx

from app.config import get_settings

_DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


def transcribe(audio_bytes: bytes, content_type: str) -> str:
    """Transcribes a single-speaker candidate answer clip via Deepgram Nova-3.

    No diarization needed — each recording is one speaker (the candidate).
    """
    settings = get_settings()
    params = {"model": "nova-3", "smart_format": "true", "punctuate": "true"}
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": content_type,
    }

    with httpx.Client(timeout=60.0) as client:
        response = client.post(_DEEPGRAM_URL, params=params, headers=headers, content=audio_bytes)
        response.raise_for_status()

    data = response.json()
    channels = data.get("results", {}).get("channels", [])
    if not channels or not channels[0].get("alternatives"):
        return ""
    return channels[0]["alternatives"][0].get("transcript", "")

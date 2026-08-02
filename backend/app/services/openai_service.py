import json

from openai import OpenAI

from app.config import get_settings

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=get_settings().openai_api_key)
    return _client


def synthesize_speech(text: str) -> bytes:
    """Generates TTS audio for a question. Returns MP3 bytes."""
    response = _get_client().audio.speech.create(
        model="gpt-4o-mini-tts",
        voice="alloy",
        input=text,
        response_format="mp3",
    )
    return response.read()


_SCORE_ANSWER_TOOL = {
    "type": "function",
    "function": {
        "name": "score_answer",
        "description": "Score a candidate's interview answer against the reference answer and give feedback.",
        "parameters": {
            "type": "object",
            "properties": {
                "score": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5,
                    "description": "1 (poor) to 5 (excellent) relative to the reference answer and question intent.",
                },
                "feedback": {
                    "type": "string",
                    "description": "Concise, specific, constructive feedback for the candidate on this answer.",
                },
            },
            "required": ["score", "feedback"],
            "additionalProperties": False,
        },
    },
}


def score_answer(question_text: str, reference_answer: str, transcript: str) -> dict:
    """Scores a single transcribed answer 1-5 with feedback via OpenAI function calling."""
    reference_text = reference_answer or "(no reference answer provided for this question)"
    transcript_text = transcript.strip() or "(candidate gave no audible answer)"

    completion = _get_client().chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer grading a candidate's spoken answer, "
                    "transcribed to text. Grade fairly against the reference answer's key points, not "
                    "word-for-word similarity. Call score_answer with your result."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Question: {question_text}\n\n"
                    f"Reference answer: {reference_text}\n\n"
                    f"Candidate's transcribed answer: {transcript_text}"
                ),
            },
        ],
        tools=[_SCORE_ANSWER_TOOL],
        tool_choice={"type": "function", "function": {"name": "score_answer"}},
    )
    args = completion.choices[0].message.tool_calls[0].function.arguments
    return json.loads(args)


_OVERALL_FEEDBACK_TOOL = {
    "type": "function",
    "function": {
        "name": "generate_overall_feedback",
        "description": "Summarize a candidate's full interview performance on a topic.",
        "parameters": {
            "type": "object",
            "properties": {
                "overall_score": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 5,
                    "description": "Overall score 1-5 across all answered questions.",
                },
                "overall_summary": {
                    "type": "string",
                    "description": "2-4 sentence summary of the candidate's overall performance on this topic.",
                },
                "strengths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific strengths demonstrated across the answers.",
                },
                "areas_for_improvement": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific, actionable areas the candidate should improve on.",
                },
            },
            "required": ["overall_score", "overall_summary", "strengths", "areas_for_improvement"],
            "additionalProperties": False,
        },
    },
}


def generate_overall_feedback(topic: str, per_answer_results: list[dict]) -> dict:
    """Generates the end-of-interview overall feedback via OpenAI function calling.

    per_answer_results: list of dicts with question_text, candidate_answer_transcript, score, feedback.
    """
    transcript_summary = "\n\n".join(
        f"Q: {a['question_text']}\n"
        f"Answer: {a['candidate_answer_transcript']}\n"
        f"Score: {a['score']}/5 — {a['feedback']}"
        for a in per_answer_results
    )

    completion = _get_client().chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert technical interviewer producing a final performance summary for a "
                    f"candidate interviewed on the topic '{topic}'. Base your summary only on the per-question "
                    "results provided. Call generate_overall_feedback with your result."
                ),
            },
            {"role": "user", "content": transcript_summary or "(no questions were answered)"},
        ],
        tools=[_OVERALL_FEEDBACK_TOOL],
        tool_choice={"type": "function", "function": {"name": "generate_overall_feedback"}},
    )
    args = completion.choices[0].message.tool_calls[0].function.arguments
    return json.loads(args)

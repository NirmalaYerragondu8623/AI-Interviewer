const PHASE_LABEL = {
  "loading-question": "Loading next question…",
  "playing-question": "Playing question audio…",
  recording: "Recording your answer…",
  submitting: "Transcribing and scoring your answer…",
  skipping: "Skipping question…",
  finishing: "Generating your overall feedback…",
};

export default function InterviewWorkspace({
  session,
  currentQuestion,
  phase,
  error,
  audioRef,
  onAudioEnded,
  onNext,
  onSkip,
  onFinish,
  latestAnswerFeedback,
}) {
  if (!session) {
    return (
      <div className="panel-card">
        <h2>Interview</h2>
        <p className="muted">Set up a session on the left to begin.</p>
      </div>
    );
  }

  const canAdvance = phase === "recording" || phase === "playing-question";

  return (
    <div className="panel-card">
      <h2>Interview</h2>

      {currentQuestion && (
        <p className="progress-status">
          Question {currentQuestion.question_number} of {currentQuestion.total_questions}
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}

      {currentQuestion ? (
        <>
          <div className="question-box">{currentQuestion.question_text}</div>
          <audio ref={audioRef} onEnded={onAudioEnded} />
          {PHASE_LABEL[phase] && <p className="phase-status">{PHASE_LABEL[phase]}</p>}
          {phase === "recording" && <div className="recording-indicator">● Recording</div>}
        </>
      ) : (
        <p className="phase-status">{PHASE_LABEL[phase] || "Preparing…"}</p>
      )}

      {latestAnswerFeedback && (
        <div className="last-answer-feedback">
          <span className="score-badge">{latestAnswerFeedback.score}/5</span>
          <span>{latestAnswerFeedback.feedback}</span>
        </div>
      )}

      <div className="button-row">
        <button type="button" onClick={onNext} disabled={!canAdvance}>
          Next Question
        </button>
        <button type="button" className="secondary" onClick={onSkip} disabled={!canAdvance}>
          Skip Question
        </button>
        <button type="button" className="secondary" onClick={onFinish} disabled={phase === "finishing"}>
          Finish Interview
        </button>
      </div>
    </div>
  );
}

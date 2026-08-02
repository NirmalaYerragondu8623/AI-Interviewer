export default function TranscriptPanel({ answers }) {
  return (
    <div className="panel-card transcript-panel">
      <h2>Transcript</h2>
      {answers.length === 0 ? (
        <p className="muted">No answers were recorded during this session.</p>
      ) : (
        <ol className="transcript-list">
          {answers.map((a, i) => (
            <li key={a.question_id} className="transcript-entry">
              <div className="transcript-question">
                Q{i + 1}. {a.question_text}
              </div>
              <div className="transcript-answer">
                <span className="label">Candidate answer:</span> {a.candidate_answer_transcript || "(no answer)"}
              </div>
              <div className="transcript-feedback">
                <span className="score-badge">{a.score}/5</span>
                <span>{a.feedback}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

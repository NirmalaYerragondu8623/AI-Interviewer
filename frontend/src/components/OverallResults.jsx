export default function OverallResults({ overallFeedback }) {
  return (
    <div className="panel-card overall-results">
      <h2>Overall Feedback</h2>
      <div className="overall-score">
        Score: <strong>{overallFeedback.overall_score}/5</strong>
        <span className="muted">
          {" "}
          ({overallFeedback.questions_answered}/{overallFeedback.questions_asked} answered)
        </span>
      </div>
      <p>{overallFeedback.overall_summary}</p>

      {overallFeedback.strengths.length > 0 && (
        <div className="feedback-list">
          <h3>Strengths</h3>
          <ul>
            {overallFeedback.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {overallFeedback.areas_for_improvement.length > 0 && (
        <div className="feedback-list">
          <h3>Areas for Improvement</h3>
          <ul>
            {overallFeedback.areas_for_improvement.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

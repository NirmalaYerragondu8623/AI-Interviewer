import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getSessionState } from "../api";
import AppHeader from "../components/AppHeader";
import TranscriptPanel from "../components/TranscriptPanel";
import OverallResults from "../components/OverallResults";

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getSessionState(id)
      .then(setState)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="app-shell">
      <AppHeader>
        <Link to="/sessions" className="secondary nav-link">
          Back to Sessions
        </Link>
      </AppHeader>

      <main className="single-panel">
        {loading && <p className="muted">Loading session…</p>}
        {error && <p className="auth-error">{error}</p>}

        {state && state.session.status === "in_progress" && (
          <div className="panel-card">
            <h2>{state.session.topic}</h2>
            <p className="muted">
              This session is still in progress ({state.session.current_index}/
              {state.session.questions_actually_used.length} questions answered so far).
            </p>
            <div className="button-row">
              <button type="button" onClick={() => navigate(`/?resume=${state.session.id}`)}>
                Resume Interview
              </button>
            </div>
          </div>
        )}

        {state && state.session.status === "finished" && (
          <>
            <div className="panel-card">
              <h2>{state.session.topic}</h2>
              <p className="muted">
                Completed {new Date(state.session.ended_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            {state.overall_feedback && <OverallResults overallFeedback={state.overall_feedback} />}
            <TranscriptPanel answers={state.answers} />
          </>
        )}
      </main>
    </div>
  );
}

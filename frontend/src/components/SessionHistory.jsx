import { useNavigate } from "react-router-dom";

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SessionHistory({ sessions, loading }) {
  const navigate = useNavigate();

  function openSession(s) {
    if (s.status === "finished") {
      navigate(`/sessions/${s.id}`);
    } else {
      navigate(`/?resume=${s.id}`);
    }
  }

  return (
    <div className="panel-card">
      <h2>Your Sessions</h2>

      {loading ? (
        <p className="muted">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="muted">No sessions yet — start one above.</p>
      ) : (
        <ul className="session-stack">
          {sessions.map((s) => (
            <li key={s.id}>
              <button type="button" className="session-card" onClick={() => openSession(s)}>
                <div className="session-card-top">
                  <span className="session-topic">{s.topic}</span>
                  <span className={`status-badge status-${s.status}`}>
                    {s.status === "finished" ? "Completed" : "In Progress"}
                  </span>
                </div>
                <div className="session-card-meta muted">
                  {s.current_index}/{s.questions_actually_used.length} questions
                  {" · "}
                  Started {formatDate(s.started_at)}
                  {s.ended_at ? ` · Ended ${formatDate(s.ended_at)}` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

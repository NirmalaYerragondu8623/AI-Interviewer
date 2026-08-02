import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSessions } from "../api";
import AppHeader from "../components/AppHeader";
import SessionHistory from "../components/SessionHistory";

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <AppHeader>
        <Link to="/" className="secondary nav-link">
          Back to Interview
        </Link>
      </AppHeader>

      <main className="single-panel">
        {error && <p className="auth-error">{error}</p>}
        <SessionHistory sessions={sessions} loading={loading} />
      </main>
    </div>
  );
}

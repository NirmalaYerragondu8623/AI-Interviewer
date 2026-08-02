import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";

export default function AppHeader({ children }) {
  const { session } = useAuth();

  return (
    <header className="app-header">
      <span>AI Interview App</span>
      <div className="header-right">
        <span className="muted">{session?.user?.email}</span>
        {children}
        <button type="button" className="secondary" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </button>
      </div>
    </header>
  );
}

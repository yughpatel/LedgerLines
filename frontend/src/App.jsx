import { useEffect, useState } from "react";
import Auth from "./components/Auth";
import Shell from "./components/Shell";
import TransactionList from "./components/TransactionList";
import { getMe, logout as apiLogout, setOnAuthChange } from "./api";
import { useHashPage, useTheme } from "./hooks";

// The signed-in app: navigation, theme and the page. Its own component so its hooks
// don't depend on the auth checks above them
function Workspace({ token, userEmail, onLogout }) {
  const [page, go] = useHashPage();
  const [theme, toggleTheme] = useTheme();
  const [addSignal, setAddSignal] = useState(0);

  return (
    <Shell
      page={page}
      onNavigate={go}
      onAdd={() => setAddSignal((n) => n + 1)}
      account={{ email: userEmail, theme, onToggleTheme: toggleTheme, onLogout }}
    >
      <TransactionList token={token} userEmail={userEmail} onLogout={onLogout} embedded addSignal={addSignal} />
    </Shell>
  );
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ll_token"));
  const [validating, setValidating] = useState(() => !!localStorage.getItem("ll_token"));
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    setOnAuthChange((newToken) => {
      if (newToken) {
        setToken(newToken);
      } else {
        localStorage.removeItem("ll_token");
        setToken(null);
      }
    });
    return () => setOnAuthChange(null);
  }, []);

  useEffect(() => {
    const current = localStorage.getItem("ll_token");
    if (!current) {
      setValidating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe(current);
        if (!cancelled) setUserEmail(me?.email || "");
      } catch {
        // Interceptor already cleared auth on refresh failure.
        // On any other error we defensively clear too so the user sees the login screen.
        if (!cancelled && localStorage.getItem("ll_token") === current) {
          localStorage.removeItem("ll_token");
          setToken(null);
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => { cancelled = true; };
    // Run only on mount — subsequent token changes come through login/logout/interceptor.
  }, []);

  async function handleLogin(newToken) {
    setToken(newToken);
    try {
      const me = await getMe(newToken);
      setUserEmail(me?.email || "");
    } catch {
      // The header email is cosmetic — never block getting into the app over it
    }
  }

  async function handleLogout() {
    try {
      await apiLogout();
    } catch (err) {
      // Backend logout is best-effort — surface for debugging but never block the client-side signout.
      console.warn("[auth] server-side logout failed:", err?.message || err);
    } finally {
      localStorage.removeItem("ll_token");
      setToken(null);
      setUserEmail("");
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted" role="status">
        Loading…
      </div>
    );
  }
  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }
  return <Workspace token={token} userEmail={userEmail} onLogout={handleLogout} />;
}

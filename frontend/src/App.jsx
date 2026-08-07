import { useEffect, useState } from "react";
import Auth from "./components/Auth";
import TransactionList from "./components/TransactionList";
import { getMe, logout as apiLogout, setOnAuthChange } from "./api";
import "./App.css";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ll_token"));
  const [validating, setValidating] = useState(() => !!localStorage.getItem("ll_token"));

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
        await getMe(current);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogin(newToken) {
    setToken(newToken);
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
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading…
      </div>
    );
  }
  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }
  return <TransactionList token={token} onLogout={handleLogout} />;
}

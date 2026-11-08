import { useCallback, useEffect, useState } from "react";
import Auth from "./components/Auth";
import OverviewPage from "./components/OverviewPage";
import Shell from "./components/Shell";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";
import { getMe, getTransactions, logout as apiLogout, setOnAuthChange } from "./api";
import { currentPeriod } from "./format";
import { useHashPage, useTheme } from "./hooks";

// The signed-in app: navigation, theme, the chosen month, the transaction list and
// the add/edit form. Its own component so its hooks don't depend on the auth checks
function Workspace({ token, userEmail, onLogout }) {
  const [page, go] = useHashPage();
  const [theme, toggleTheme] = useTheme();
  const [period, setPeriod] = useState(currentPeriod);
  const [refreshKey, setRefreshKey] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(null); // null, { transaction: null } to add, or { transaction } to edit

  useEffect(() => {
    let cancelled = false;
    getTransactions(token)
      .then((data) => { if (!cancelled) setTransactions(Array.isArray(data) ? data : []); })
      .catch(() => { /* the pages show their own errors */ });
    return () => { cancelled = true; };
  }, [token, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const openAdd = () => setForm({ transaction: null });
  const openEdit = (transaction) => setForm({ transaction });

  return (
    <Shell
      page={page}
      onNavigate={go}
      onAdd={openAdd}
      account={{ email: userEmail, theme, onToggleTheme: toggleTheme, onLogout }}
    >
      {page === "overview" ? (
        <OverviewPage
          token={token} period={period} onPeriodChange={setPeriod} refreshKey={refreshKey}
          transactions={transactions} onEdit={openEdit} onAdd={openAdd}
          onSeeAll={() => go("transactions")} theme={theme}
        />
      ) : (
        <TransactionList key={refreshKey} token={token} userEmail={userEmail} onLogout={onLogout} embedded />
      )}
      {form && (
        <TransactionForm
          token={token} transaction={form.transaction}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); refresh(); }}
        />
      )}
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

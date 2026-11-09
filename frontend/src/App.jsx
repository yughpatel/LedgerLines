import { useCallback, useEffect, useState } from "react";
import Auth from "./components/Auth";
import ConfirmDialog from "./components/ConfirmDialog";
import OverviewPage from "./components/OverviewPage";
import Shell from "./components/Shell";
import Toast from "./components/Toast";
import TransactionForm from "./components/TransactionForm";
import TransactionsPage from "./components/TransactionsPage";
import { deleteTransaction, getMe, getTransactions, logout as apiLogout, setOnAuthChange } from "./api";
import { currentPeriod, formatINR, shortDate } from "./format";
import { prefersReducedMotion, useHashPage, useTheme } from "./hooks";

// The signed-in app: navigation, theme, the chosen month (shared by both pages), the
// transaction list, the add/edit form, delete and the toast. Its own component so its
// hooks don't depend on the auth checks in App
function Workspace({ token, userEmail, onLogout }) {
  const [page, go] = useHashPage();
  const [theme, toggleTheme] = useTheme();
  const [period, setPeriod] = useState(currentPeriod);
  const [refreshKey, setRefreshKey] = useState(0);
  const [list, setList] = useState({ items: [], loading: true, error: "" });
  const [form, setForm] = useState(null); // null, { transaction: null } to add, or { transaction } to edit
  const [confirm, setConfirm] = useState(null); // { tx, busy, error }
  const [leavingId, setLeavingId] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const [toast, setToast] = useState(null); // { message, id }

  useEffect(() => {
    let cancelled = false;
    setList((l) => ({ ...l, loading: true, error: "" }));
    getTransactions(token)
      .then((data) => { if (!cancelled) setList({ items: Array.isArray(data) ? data : [], loading: false, error: "" }); })
      .catch((err) => { if (!cancelled) setList((l) => ({ ...l, loading: false, error: err.message || "Couldn't load transactions." })); });
    return () => { cancelled = true; };
  }, [token, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const say = (message) => setToast({ message, id: Date.now() });
  const clearToast = useCallback(() => setToast(null), []);
  const openAdd = () => setForm({ transaction: null });
  const openEdit = (transaction) => setForm({ transaction });

  function onSaved(saved, wasEdit) {
    setForm(null);
    // Show the month the entry landed in, and flash it once in the list
    if (saved?.transaction_date) setPeriod(currentPeriodOf(saved.transaction_date));
    if (saved?.id) {
      setFlashId(saved.id);
      setTimeout(() => setFlashId(null), 2100);
    }
    refresh();
    say(wasEdit ? "Saved" : "Added");
  }

  async function confirmDelete() {
    const { tx } = confirm;
    setConfirm((c) => ({ ...c, busy: true, error: "" }));
    try {
      await deleteTransaction(token, tx.id);
    } catch (err) {
      setConfirm((c) => ({ ...c, busy: false, error: err.message || "Couldn't delete it. Try again." }));
      return;
    }
    setConfirm(null);
    setForm(null);
    // Fold the row away, then drop it and refresh the totals
    setLeavingId(tx.id);
    setTimeout(() => {
      setList((l) => ({ ...l, items: l.items.filter((t) => t.id !== tx.id) }));
      setLeavingId(null);
      refresh();
      say("Deleted");
    }, prefersReducedMotion() ? 0 : 270);
  }

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
          transactions={list.items} onEdit={openEdit} onAdd={openAdd}
          onSeeAll={() => go("transactions")} theme={theme}
        />
      ) : (
        <TransactionsPage
          transactions={list.items} loading={list.loading} error={list.error}
          period={period} onPeriodChange={setPeriod}
          onEdit={openEdit} onDelete={(tx) => setConfirm({ tx, busy: false, error: "" })} onAdd={openAdd}
          flashId={flashId} leavingId={leavingId}
        />
      )}
      {form && (
        <TransactionForm
          token={token} transaction={form.transaction}
          onClose={() => setForm(null)}
          onSaved={(saved) => onSaved(saved, Boolean(form.transaction))}
          onDelete={(tx) => setConfirm({ tx, busy: false, error: "" })}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title="Delete this transaction?"
          body={`${confirm.tx.description || confirm.tx.category.name}, ${formatINR(confirm.tx.amount)} on ${shortDate(confirm.tx.transaction_date)}. You can't undo this.`}
          confirmLabel="Delete" busy={confirm.busy} error={confirm.error}
          onConfirm={confirmDelete} onCancel={() => setConfirm(null)}
        />
      )}
      {toast && <Toast message={toast.message} id={toast.id} onDone={clearToast} />}
    </Shell>
  );
}

// The IST month an instant falls in
function currentPeriodOf(value) {
  return currentPeriod(new Date(value));
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

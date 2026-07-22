import { useEffect, useState } from "react";
import { deleteTransaction, getTransactions } from "../api";
import MonthlySummary from "./MonthlySummary";
import TransactionForm from "./TransactionForm";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function TransactionList({ token, onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [summaryVersion, setSummaryVersion] = useState(0);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await getTransactions(token);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(tx) {
    setEditing(tx);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function handleSaved() {
    closeForm();
    load();
    setSummaryVersion((v) => v + 1);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteTransaction(token, confirmDelete.id);
      setConfirmDelete(null);
      load();
      setSummaryVersion((v) => v + 1);
    } catch (err) {
      setError(err.message || "Failed to delete transaction.");
    } finally {
      setDeleting(false);
    }
  }

  const sorted = [...transactions].sort((a, b) => {
    const ad = new Date(a.transaction_date).getTime() || 0;
    const bd = new Date(b.transaction_date).getTime() || 0;
    return bd - ad;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">LedgerLines</h1>
            <p className="text-xs text-slate-500">Your personal ledger</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <MonthlySummary token={token} refreshKey={summaryVersion} />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-slate-800">Transactions</h2>
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            + Add transaction
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-slate-500">Loading transactions…</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-700 font-medium">No transactions yet</p>
              <p className="text-sm text-slate-500 mt-1">
                Click "Add transaction" to record your first entry.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((tx) => {
                    const isCredit = tx.type === "CREDIT";
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">#{tx.id}</td>
                        <td className="px-4 py-3 text-slate-700">{formatDate(tx.transaction_date)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {tx.category?.name ?? <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " +
                              (isCredit
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700")
                            }
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td
                          className={
                            "px-4 py-3 text-right font-medium tabular-nums " +
                            (isCredit ? "text-green-600" : "text-red-600")
                          }
                        >
                          {isCredit ? "+" : "−"}
                          {formatAmount(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {tx.description || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEdit(tx)}
                            className="text-blue-600 hover:underline text-sm mr-3"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(tx)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {formOpen && (
        <TransactionForm
          token={token}
          transaction={editing}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 flex items-center justify-center px-4"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800">Delete transaction?</h3>
            <p className="text-sm text-slate-600 mt-2">
              This will permanently delete transaction #{confirmDelete.id}
              {confirmDelete.category?.name ? ` — ${confirmDelete.category.name}` : ""}. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

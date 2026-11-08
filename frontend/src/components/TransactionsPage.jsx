import { useMemo, useRef, useState } from "react";
import { dayKey, dayLabel, formatINR, formatSigned, inPeriod, monthLabel } from "../format";
import { useActiveRect } from "../hooks";
import MonthPicker from "./MonthPicker";
import TxRow from "./TxRow";
import { CheckIcon, PlusIcon, SearchIcon } from "./icons";

const PAGE_SIZE = 20;
const TYPES = [["all", "All"], ["DEBIT", "Expenses"], ["CREDIT", "Income"], ["REFUND", "Refunds"]];
const spentBy = (t) => (t.type === "DEBIT" ? Number(t.amount) : t.type === "REFUND" ? -Number(t.amount) : 0);

// The month's transactions, grouped by IST day. Search, type and category filter
// in the browser (the list endpoint has no filters yet), 20 rows at a time
export default function TransactionsPage({
  transactions, loading, error, period, onPeriodChange, onEdit, onDelete, onAdd, flashId, leavingId,
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const filterKey = `${period.year}-${period.month}-${type}-${categoryId}`;
  const [paging, setPaging] = useState({ key: filterKey, shown: PAGE_SIZE });
  const shown = paging.key === filterKey ? paging.shown : PAGE_SIZE;
  const chipsRef = useRef(null);
  const chipRect = useActiveRect(chipsRef, type);

  const monthRows = useMemo(
    () => transactions.filter((t) => inPeriod(t.transaction_date, period)),
    [transactions, period],
  );
  const categories = useMemo(() => {
    const byId = new Map(monthRows.map((t) => [t.category.id, t.category.name]));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [monthRows]);

  const q = query.trim().toLowerCase();
  const matches = monthRows.filter((t) =>
    (type === "all" || t.type === type) &&
    (categoryId === "all" || String(t.category.id) === categoryId) &&
    (!q || (t.description || "").toLowerCase().includes(q) || t.category.name.toLowerCase().includes(q)));
  const visible = matches.slice(0, shown);
  const spent = matches.reduce((a, t) => a + spentBy(t), 0);
  const earned = matches.reduce((a, t) => a + (t.type === "CREDIT" ? Number(t.amount) : 0), 0);

  // Each row keeps its position in the list, for the staggered fade-in
  const groups = [];
  visible.forEach((tx, position) => {
    const key = dayKey(tx.transaction_date);
    if (groups.at(-1)?.key !== key) groups.push({ key, at: tx.transaction_date, items: [] });
    groups.at(-1).items.push({ tx, position });
  });
  const filtered = q || type !== "all" || categoryId !== "all";
  const stagger = (position) => ({ animationDelay: `${Math.min(position, 14) * 22}ms` });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page md:text-page-lg">Transactions</h1>
        <MonthPicker period={period} onChange={onPeriodChange} />
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-0 flex-[1_1_240px]">
            <span className="sr-only">Search notes or categories</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off"
              placeholder="Search notes or categories"
              className="h-11 w-full rounded-control border border-field bg-surface pl-10 pr-3 placeholder:text-muted focus-visible:border-focus"
            />
          </label>
          <label>
            <span className="sr-only">Category</span>
            <select
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 min-w-40 rounded-control border border-field bg-surface px-3"
            >
              <option value="all">All categories</option>
              {categories.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
            </select>
          </label>
        </div>
        <div ref={chipsRef} role="group" aria-label="Type" className="relative isolate flex flex-wrap gap-2">
          {chipRect && (
            <span
              aria-hidden="true"
              style={{ transform: `translate(${chipRect.left}px, ${chipRect.top}px)`, width: chipRect.width, height: chipRect.height }}
              className="absolute left-0 top-0 -z-10 rounded-chip border border-brand bg-brand-soft transition-[transform,width] duration-300 ease-soft"
            />
          )}
          {TYPES.map(([value, label]) => (
            <button
              key={value} data-key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}
              className={`flex h-11 items-center gap-1.5 rounded-chip border px-3.5 text-sm font-semibold transition-colors active:scale-[0.97] ${
                type === value ? "border-transparent text-brand-ink" : "border-field hover:bg-surface-2"
              }`}
            >
              {type === value && <CheckIcon size={16} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-control bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger-text">{error}</p>}

      {matches.length > 0 && (
        <p aria-live="polite" className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
          <strong className="font-semibold text-ink">{matches.length} {matches.length === 1 ? "transaction" : "transactions"}</strong>
          <span>In <span className="font-mono">{formatINR(earned)}</span></span>
          <span>Out <span className="font-mono">{formatSigned(spent)}</span></span>
        </p>
      )}

      {loading && !transactions.length ? (
        <div aria-hidden="true" className="grid animate-pulse gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-card bg-surface" />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-card border border-line bg-surface px-4 py-10 text-center">
          {filtered ? (
            <>
              <h2 className="text-lg">No matches</h2>
              <p className="max-w-[36ch] text-muted">Nothing in {monthLabel(period.year, period.month)} matches these filters.</p>
              <button
                type="button" onClick={() => { setQuery(""); setType("all"); setCategoryId("all"); }}
                className="mt-2 h-11 rounded-control border border-field px-4 font-semibold hover:bg-surface-2"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg">Nothing in {monthLabel(period.year, period.month)}</h2>
              <p className="max-w-[36ch] text-muted">Add a transaction or pick another month.</p>
              <button
                type="button" onClick={onAdd}
                className="mt-2 flex h-11 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-on-brand hover:bg-brand-hover"
              >
                <PlusIcon /> Add transaction
              </button>
            </>
          )}
        </div>
      ) : (
        // Re-keyed when the month or a filter changes, so the rows fade in again then,
        // but not on every keystroke in search
        <div key={filterKey} className="grid gap-4">
          {groups.map((g) => {
            const out = g.items.reduce((a, { tx }) => a + spentBy(tx), 0);
            return (
              <section key={g.key} aria-label={dayLabel(g.at)}>
                <h2 className="flex animate-fade-up items-baseline justify-between gap-3 px-1 pb-1.5 text-base" style={stagger(g.items[0].position)}>
                  <span>{dayLabel(g.at)}</span>
                  {out !== 0 && (
                    <span className="font-mono text-[13px] font-medium text-muted">
                      <span className="sr-only">Day total </span>
                      {out > 0 ? formatSigned(-out) : `+${formatINR(-out)}`}
                    </span>
                  )}
                </h2>
                <ul className="overflow-hidden rounded-card border border-l-[3px] border-line border-l-margin [border-left-style:double] bg-surface">
                  {g.items.map(({ tx, position }) => (
                    <TxRow
                      key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete}
                      flash={tx.id === flashId} leaving={tx.id === leavingId} style={stagger(position)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {matches.length > shown && (
        <div className="mt-4 flex justify-center">
          <button
            type="button" onClick={() => setPaging({ key: filterKey, shown: shown + PAGE_SIZE })}
            className="h-11 rounded-control border border-field px-5 font-semibold transition-colors hover:bg-surface-2 active:scale-[0.98]"
          >
            Show {Math.min(PAGE_SIZE, matches.length - shown)} more
          </button>
        </div>
      )}
    </div>
  );
}

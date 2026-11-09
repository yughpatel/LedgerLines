import { useEffect, useRef, useState } from "react";
import { createCategory, createTransaction, getCategories, updateTransaction } from "../api";
import { fromIstInputs, toIstInputs } from "../format";
import { prefersReducedMotion } from "../hooks";
import { AlertIcon, CheckIcon, CloseIcon, InIcon, OutIcon, PlusIcon, RefundIcon, TrashIcon } from "./icons";

// Mirrors the backend rules (app/schemas/transaction.py and category.py). The backend
// stays authoritative; these just answer instantly
const MAX_AMOUNT = 500000;
const MIN_DATE = "2020-01-01";
const FUTURE_SKEW_MS = 60 * 1000; // the backend allows a minute of clock skew
const CATEGORY_NAME_MAX_LENGTH = 50;

const TYPES = [
  { value: "DEBIT", label: "Expense", Icon: OutIcon, hint: "Money you paid out." },
  { value: "CREDIT", label: "Income", Icon: InIcon, hint: "Money you received, like salary." },
  { value: "REFUND", label: "Refund", Icon: RefundIcon, hint: "Money back for something you bought. Lowers spending, not counted as income." },
];

function istToday(offsetDays = 0) {
  return toIstInputs(Date.now() - offsetDays * 864e5).date;
}

// Add or edit one transaction. A bottom sheet on phones (swipe the handle down to
// close) and a dialog on wider screens. Focus moves to Amount once it has risen,
// Tab stays inside, Escape closes, and closing plays the exit before unmounting
export default function TransactionForm({ token, transaction, onClose, onSaved, onDelete }) {
  const editing = Boolean(transaction);
  // Captured once when the form opens, so the defaults and the date limit don't drift
  const [opened] = useState(() => ({
    initial: toIstInputs(transaction ? transaction.transaction_date : Date.now()),
    today: istToday(),
    yesterday: istToday(1),
  }));
  const { initial, today, yesterday } = opened;

  const [type, setType] = useState(transaction?.type || "DEBIT");
  const [amount, setAmount] = useState(transaction ? String(Number(transaction.amount)) : "");
  const [categoryId, setCategoryId] = useState(transaction ? String(transaction.category.id) : "");
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState("");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState(transaction?.description || "");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [errors, setErrors] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);

  const sheetRef = useRef(null);
  const amountRef = useRef(null);
  const dragStart = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getCategories(token)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
        // Default to the first category (system defaults come first alphabetically
        // mixed with yours), so Add needs as few taps as possible
        setCategoryId((current) => current || (list[0] ? String(list[0].id) : ""));
      })
      .catch((err) => { if (!cancelled) setCategoriesError(err.message || "Couldn't load categories."); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const previous = document.activeElement;
    // After the sheet has risen, so the phone keyboard doesn't fight the animation
    const t = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), prefersReducedMotion() ? 0 : 280);
    const lock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = lock;
      previous?.focus?.();
    };
  }, []);

  function close() {
    if (busy) return;
    if (prefersReducedMotion()) return onClose();
    setClosing(true);
    setTimeout(onClose, 210);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Tab") {
      const items = [...sheetRef.current.querySelectorAll("button:not([disabled]), input:not([disabled]), select, textarea")]
        .filter((el) => el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  // Swipe the handle area down to close (phones). A short flick or 120px is enough
  function onPointerDown(e) {
    if (window.innerWidth >= 768 || e.target.closest("button")) return;
    dragStart.current = { y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (dragStart.current) setDrag(Math.max(0, e.clientY - dragStart.current.y));
  }
  function onPointerUp() {
    if (!dragStart.current) return;
    const fast = drag / (performance.now() - dragStart.current.t) > 0.6;
    dragStart.current = null;
    if (drag > 120 || (fast && drag > 30)) close();
    setDrag(0);
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) { setNewError("Type a name first."); return; }
    setSavingCategory(true);
    setNewError("");
    try {
      const created = await createCategory(token, { name });
      setCategories((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(String(created.id));
      setCreating(false);
      setNewName("");
    } catch (err) {
      setNewError(err.message || "Couldn't add that category.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const next = {};
    const raw = amount.replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) next.amount = "Enter an amount, like 450 or 450.50";
    else if (Number(raw) > MAX_AMOUNT) next.amount = "The most you can add is ₹5,00,000.00";
    if (!categoryId) next.category = "Pick a category";
    if (!date || !time) next.date = "Pick a date and time";
    else if (date < MIN_DATE) next.date = "The earliest date is 1 Jan 2020";
    else if (new Date(fromIstInputs(date, time)).getTime() > Date.now() + FUTURE_SKEW_MS) next.date = "That's in the future";
    setErrors(next);
    if (Object.keys(next).length) {
      setShakeKey((k) => k + 1);
      if (next.amount) amountRef.current?.focus();
      return;
    }

    const payload = {
      type,
      amount: raw,
      category_id: Number(categoryId),
      description: note.trim() || null,
      transaction_date: fromIstInputs(date, time),
    };
    setBusy(true);
    try {
      const saved = editing
        ? await updateTransaction(token, transaction.id, payload)
        : await createTransaction(token, payload);
      onSaved(saved);
    } catch (err) {
      setErrors({ form: err.message || "Couldn't save it. Try again." });
      setShakeKey((k) => k + 1);
      setBusy(false);
    }
  }

  const typeIndex = TYPES.findIndex((t) => t.value === type);
  const chip = (selected) =>
    `flex h-11 items-center gap-1.5 rounded-chip border px-3.5 text-sm font-semibold transition-colors active:scale-[0.97] ${
      selected ? "border-brand bg-brand-soft text-brand-ink" : "border-field hover:bg-surface-2"
    }`;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-scrim md:items-center md:p-6 ${closing ? "animate-fade-out" : "animate-fade-in"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="tx-form-title"
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
        className={`flex max-h-[calc(100%-16px)] w-full flex-col rounded-t-sheet bg-surface shadow-pop transition-transform duration-300 ease-soft md:max-h-[calc(100vh-48px)] md:w-[520px] md:rounded-sheet ${
          closing ? "animate-sheet-down md:animate-pop-out" : "animate-sheet-up md:animate-pop-in"
        }`}
      >
        <div
          className="relative flex touch-none items-center justify-between gap-3 border-b border-line py-3 pl-5 pr-2 pt-6 md:touch-auto md:pt-3"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-[5px] w-9 -translate-x-1/2 rounded-full bg-field opacity-60 md:hidden" />
          <h2 id="tx-form-title" className="text-[19px]">{editing ? "Edit transaction" : "New transaction"}</h2>
          <button
            type="button" onClick={close} aria-label="Close"
            className="grid size-11 place-items-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid gap-5 overflow-y-auto px-5 py-4">
            {errors.form && (
              <p key={shakeKey} role="alert" className="flex animate-shake items-start gap-2 rounded-control bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger-text">
                <AlertIcon size={18} />{errors.form}
              </p>
            )}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Type</legend>
              <div className="relative isolate grid grid-cols-3 gap-1.5 rounded-control border border-line bg-surface-2 p-1">
                <span
                  aria-hidden="true"
                  style={{ transform: `translateX(calc(${typeIndex * 100}% + ${typeIndex * 6}px))` }}
                  className="absolute inset-y-1 left-1 -z-10 w-[calc((100%-20px)/3)] rounded-[6px] bg-surface shadow-chip transition-transform duration-300 ease-soft"
                />
                {TYPES.map(({ value, label, Icon }) => (
                  <label key={value} className="relative">
                    <input
                      type="radio" name="type" value={value} checked={type === value}
                      onChange={() => setType(value)} className="peer absolute inset-0 opacity-0"
                    />
                    <span className="flex h-11 items-center justify-center gap-1.5 rounded-[6px] text-sm font-semibold text-muted transition-colors peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-focus">
                      <Icon size={18} className={type === value ? (value === "DEBIT" ? "text-expense" : value === "CREDIT" ? "text-income" : "text-refund") : ""} />
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-[13px] text-muted">{TYPES[typeIndex].hint}</p>
            </fieldset>

            <div className="grid gap-1.5">
              <label htmlFor="tx-amount" className="text-sm font-semibold">Amount</label>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted">₹</span>
                <input
                  ref={amountRef} id="tx-amount" inputMode="decimal" autoComplete="off" placeholder="0.00"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={Boolean(errors.amount)} aria-describedby="tx-amount-msg"
                  className="h-15 w-full rounded-control border border-field bg-surface pl-10 pr-3 font-mono text-[28px] font-medium tabular-nums placeholder:text-muted aria-invalid:border-danger-text"
                />
              </div>
              {errors.amount ? (
                <p key={shakeKey} id="tx-amount-msg" className="flex animate-shake items-center gap-1.5 text-[13px] font-semibold text-danger-text">
                  <AlertIcon size={16} />{errors.amount}
                </p>
              ) : (
                <p id="tx-amount-msg" className="text-[13px] text-muted">Up to ₹5,00,000.00</p>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Category</legend>
              {categoriesError && <p role="alert" className="mb-2 text-[13px] font-semibold text-danger-text">{categoriesError}</p>}
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <label key={c.id} className="relative">
                    <input
                      type="radio" name="category" value={c.id} checked={categoryId === String(c.id)}
                      onChange={() => setCategoryId(String(c.id))} className="peer absolute inset-0 opacity-0"
                    />
                    <span className={`${chip(categoryId === String(c.id))} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus`}>
                      {categoryId === String(c.id) && <CheckIcon size={16} />}
                      {c.name}
                    </span>
                  </label>
                ))}
                <button
                  type="button" aria-expanded={creating}
                  onClick={() => { setCreating((v) => !v); setNewError(""); }}
                  className={chip(false)}
                >
                  <PlusIcon size={16} /> New
                </button>
              </div>
              {creating && (
                <div className="mt-2 grid animate-fade-up gap-1.5">
                  <div className="flex gap-2">
                    <label htmlFor="tx-new-category" className="sr-only">New category name</label>
                    <input
                      id="tx-new-category" autoFocus value={newName} maxLength={CATEGORY_NAME_MAX_LENGTH}
                      onChange={(e) => setNewName(e.target.value)} placeholder="Category name"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                      className="h-11 min-w-0 flex-1 rounded-control border border-field bg-surface px-3 placeholder:text-muted"
                    />
                    <button
                      type="button" onClick={addCategory} disabled={savingCategory}
                      className="h-11 rounded-control border border-field px-4 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
                    >
                      {savingCategory ? "Adding…" : "Add"}
                    </button>
                  </div>
                  {newError && <p role="alert" className="text-[13px] font-semibold text-danger-text">{newError}</p>}
                </div>
              )}
              {errors.category && <p className="mt-1.5 text-[13px] font-semibold text-danger-text">{errors.category}</p>}
            </fieldset>

            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label htmlFor="tx-date" className="text-sm font-semibold">Date</label>
                  <input
                    id="tx-date" type="date" min={MIN_DATE} max={today} value={date} onChange={(e) => setDate(e.target.value)}
                    aria-invalid={Boolean(errors.date)}
                    className="h-11 w-full min-w-0 rounded-control border border-field bg-surface px-3 aria-invalid:border-danger-text"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="tx-time" className="text-sm font-semibold">Time</label>
                  <input
                    id="tx-time" type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="h-11 w-full min-w-0 rounded-control border border-field bg-surface px-3"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" aria-pressed={date === today} onClick={() => setDate(today)} className={chip(date === today)}>Today</button>
                <button type="button" aria-pressed={date === yesterday} onClick={() => setDate(yesterday)} className={chip(date === yesterday)}>Yesterday</button>
              </div>
              {errors.date && <p className="text-[13px] font-semibold text-danger-text">{errors.date}</p>}
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="tx-note" className="text-sm font-semibold">Note <span className="font-normal text-muted">(optional)</span></label>
              <input
                id="tx-note" value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="What was it for?"
                className="h-11 rounded-control border border-field bg-surface px-3 placeholder:text-muted"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-t border-line px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
            {editing && onDelete && (
              <button
                type="button" onClick={() => onDelete(transaction)}
                className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-danger-text hover:bg-danger-soft"
              >
                <TrashIcon size={18} /> Delete
              </button>
            )}
            <span className="flex-1" />
            <button
              type="button" onClick={close}
              className="h-11 rounded-control border border-field px-4 text-sm font-semibold transition-colors hover:bg-surface-2 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={busy}
              className="h-11 min-w-28 flex-1 rounded-control bg-brand px-4 text-sm font-semibold text-on-brand transition-[background-color,transform] hover:bg-brand-hover active:scale-[0.98] disabled:opacity-60 md:flex-none"
            >
              {busy ? "Saving…" : editing ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

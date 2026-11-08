import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks";

// A small modal question. Focus starts on Cancel (the safe choice), Tab stays inside,
// Escape or a click on the backdrop cancels, and it fades out before it unmounts
export default function ConfirmDialog({ title, body, confirmLabel, busy = false, error = "", onConfirm, onCancel }) {
  const [closing, setClosing] = useState(false);
  const boxRef = useRef(null);
  const cancelRef = useRef(null);

  function cancel() {
    if (busy) return;
    if (prefersReducedMotion()) return onCancel();
    setClosing(true);
    setTimeout(onCancel, 170);
  }

  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(e) {
    if (e.key === "Escape") { e.stopPropagation(); cancel(); }
    if (e.key === "Tab") {
      const items = [...boxRef.current.querySelectorAll("button:not([disabled])")];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4 ${closing ? "animate-fade-out" : "animate-fade-in"}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body"
        className={`w-full max-w-sm rounded-sheet bg-surface shadow-pop ${closing ? "animate-pop-out" : "animate-pop-in"}`}
      >
        <div className="grid gap-2 p-5">
          <h2 id="confirm-title" className="text-[19px]">{title}</h2>
          <p id="confirm-body" className="text-sm text-muted">{body}</p>
          {error && <p role="alert" className="text-sm font-semibold text-danger-text">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-line px-5 py-3">
          <button
            ref={cancelRef} type="button" onClick={cancel} disabled={busy}
            className="h-11 rounded-control border border-field px-4 text-sm font-semibold transition-colors hover:bg-surface-2 active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="button" onClick={onConfirm} disabled={busy}
            className="h-11 rounded-control bg-danger px-4 text-sm font-semibold text-on-danger transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

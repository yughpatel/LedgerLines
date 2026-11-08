import { useCallback, useRef, useState } from "react";
import { useDismiss } from "../hooks";
import { LogoutIcon, MoonIcon } from "./icons";

// Avatar button with the signed-in email, the dark mode switch and Log out.
// `up` opens it above the button (the sidebar keeps it at the bottom of the screen)
export default function AccountMenu({ email, theme, onToggleTheme, onLogout, up = false, showEmail = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(ref, open, close);
  const dark = theme === "dark";

  return (
    <div ref={ref} className="relative flex min-w-0 items-center gap-1">
      <button
        type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Account"
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">
          {(email || "?").charAt(0).toUpperCase()}
        </span>
      </button>
      {showEmail && <span className="truncate text-[13px] text-muted">{email}</span>}

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-60 animate-menu-in rounded-card border border-line bg-surface p-1.5 shadow-pop ${
            up ? "bottom-full left-0 mb-1.5 origin-bottom-left" : "right-0 top-full mt-1.5 origin-top-right"
          }`}
        >
          <div className="mb-1 border-b border-line px-3 py-2.5 text-[13px] text-muted">
            Signed in as
            <strong className="block break-all text-sm font-semibold text-ink">{email || "…"}</strong>
          </div>
          <button
            type="button" role="menuitemcheckbox" aria-checked={dark} onClick={onToggleTheme}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-3 text-left font-medium hover:bg-surface-2"
          >
            <MoonIcon size={18} />
            Dark mode
            <span aria-hidden="true" className={`relative ml-auto h-5 w-9 rounded-full transition-colors ${dark ? "bg-brand" : "bg-field"}`}>
              <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-surface transition-transform duration-200 ease-soft ${dark ? "translate-x-4" : ""}`} />
            </span>
          </button>
          <button
            type="button" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-3 text-left font-medium hover:bg-surface-2"
          >
            <LogoutIcon size={18} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

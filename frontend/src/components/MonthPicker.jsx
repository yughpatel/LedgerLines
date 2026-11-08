import { useCallback, useRef, useState } from "react";
import { comparePeriods, currentPeriod, monthLabel, monthShort, shiftPeriod } from "../format";
import { useDismiss } from "../hooks";
import { ChevronDown, ChevronLeft, ChevronRight } from "./icons";

// Transactions are dated 2020-01-01 onward (backend rule)
const FIRST = { year: 2020, month: 1 };

// Previous / month / next, plus "This month" when looking back. The label opens a
// year-and-month grid. The month name slides in from the side you moved toward
export default function MonthPicker({ period, onChange }) {
  const now = currentPeriod();
  const [open, setOpen] = useState(false);
  const [gridYear, setGridYear] = useState(period.year);
  const [direction, setDirection] = useState(0);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(ref, open, close);

  const atStart = comparePeriods(period, FIRST) <= 0;
  const atNow = comparePeriods(period, now) >= 0;

  function change(next) {
    setDirection(Math.sign(comparePeriods(next, period)));
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1" role="group" aria-label="Month">
      <button
        type="button" onClick={() => change(shiftPeriod(period, -1))} disabled={atStart}
        aria-label="Previous month"
        className="grid size-11 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronLeft />
      </button>
      <button
        type="button" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setGridYear(period.year); setOpen((v) => !v); }}
        className="flex h-11 min-w-40 items-center justify-center gap-2 overflow-hidden rounded-control border border-field bg-surface px-3.5 font-serif text-[17px] font-semibold transition-colors hover:bg-surface-2 active:scale-[0.98]"
      >
        <span
          key={`${period.year}-${period.month}`}
          className={direction > 0 ? "animate-slide-from-right" : direction < 0 ? "animate-slide-from-left" : ""}
        >
          {monthLabel(period.year, period.month)}
        </span>
        <ChevronDown size={16} className="text-muted" />
      </button>
      <button
        type="button" onClick={() => change(shiftPeriod(period, 1))} disabled={atNow}
        aria-label="Next month"
        className="grid size-11 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronRight />
      </button>
      {!atNow && (
        <button
          type="button" onClick={() => change(now)}
          className="h-11 px-2 text-[13px] font-semibold text-brand-ink underline underline-offset-4"
        >
          This month
        </button>
      )}

      {open && (
        <div
          role="dialog" aria-label="Choose month"
          className="absolute left-1/2 top-full z-40 mt-1.5 -ml-36 w-72 origin-top animate-menu-in rounded-card border border-line bg-surface p-3 shadow-pop"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button" aria-label="Previous year" disabled={gridYear <= FIRST.year}
              onClick={() => setGridYear((y) => y - 1)}
              className="grid size-11 place-items-center rounded-control text-muted hover:bg-surface-2 disabled:opacity-35"
            >
              <ChevronLeft />
            </button>
            <span className="font-mono font-medium">{gridYear}</span>
            <button
              type="button" aria-label="Next year" disabled={gridYear >= now.year}
              onClick={() => setGridYear((y) => y + 1)}
              className="grid size-11 place-items-center rounded-control text-muted hover:bg-surface-2 disabled:opacity-35"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => {
              const option = { year: gridYear, month: i + 1 };
              const selected = comparePeriods(option, period) === 0;
              const outOfRange = comparePeriods(option, now) > 0 || comparePeriods(option, FIRST) < 0;
              return (
                <button
                  key={i} type="button" disabled={outOfRange} aria-current={selected || undefined}
                  onClick={() => change(option)}
                  className={`h-11 rounded-control text-sm font-semibold transition-colors disabled:opacity-35 ${
                    selected ? "bg-brand text-on-brand" : "bg-surface-2 hover:bg-line"
                  }`}
                >
                  {monthShort(i + 1)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

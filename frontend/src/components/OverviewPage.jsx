import { useEffect, useState } from "react";
import { getIncomeByCategory, getSpendingByCategory, getSummary, getTrend } from "../api";
import { currentPeriod, formatINR, formatSigned, inPeriod, monthLabel, monthName } from "../format";
import { useCountUp } from "../hooks";
import MonthPicker from "./MonthPicker";
import TrendCard from "./TrendCard";
import TxRow from "./TxRow";
import { PlusIcon } from "./icons";

// Paise at a smaller size, so ₹1,12,500.00 fits a half-width phone tile
function Money({ value, signed = false, prefix = "" }) {
  const text = signed ? formatSigned(value) : formatINR(value);
  const [whole, paise] = text.split(".");
  return <>{prefix}{whole}<small className="text-[0.62em]">.{paise}</small></>;
}

// Running total of a month's daily buckets, cut at today for the month in progress
function Sparkline({ daily, pick, color, period }) {
  if (!daily?.length) return null;
  const points = daily.reduce((acc, b) => [...acc, (acc.at(-1) ?? 0) + pick(b)], []);
  const now = currentPeriod();
  const isNow = now.year === period.year && now.month === period.month;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const upto = isNow ? daily.filter((b) => b.start <= today).length : daily.length;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const W = 120, H = 28;
  const path = points.slice(0, upto).map((v, i) =>
    `${((i / Math.max(1, daily.length - 1)) * W).toFixed(1)},${(H - ((v - min) / (max - min || 1)) * H).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} width={W} height={H} aria-hidden="true" className="mt-2 block max-w-full">
      <polyline
        key={`${period.year}-${period.month}`} points={path} pathLength="1" fill="none"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" className="animate-draw [stroke-dasharray:1]"
      />
    </svg>
  );
}

function Stat({ label, value, sub, className = "", valueClass = "", signed, prefix, spark }) {
  const shown = useCountUp(value);
  return (
    <div className={`min-w-0 p-4 md:px-5 md:py-[18px] ${className}`}>
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="mt-1 block whitespace-nowrap font-serif text-total font-semibold tabular-nums leading-tight md:text-total-lg">
        <span className={valueClass}><Money value={shown} signed={signed} prefix={prefix} /></span>
      </span>
      {spark}
      <p className="mt-1 text-[13px] text-muted">{sub}</p>
    </div>
  );
}

function SummaryStrip({ summary, daily, period, colors }) {
  const earned = Number(summary.total_earned);
  const spent = Number(summary.total_spent);
  const net = Number(summary.net);
  const saved = earned > 0 ? Math.round((net / earned) * 100) : null;
  const netSub = earned === 0 && spent === 0 ? "Nothing recorded yet"
    : saved === null ? "No income this month"
      : net >= 0 ? `Saved ${saved}% of income` : `${formatINR(-net)} more went out than came in`;
  const spark = (pick, color) => <Sparkline daily={daily} pick={pick} color={color} period={period} />;

  return (
    <section aria-label={`${monthLabel(period.year, period.month)} summary`} className="grid grid-cols-2 rounded-card border border-line bg-surface md:grid-cols-3">
      <Stat
        label="Left over" value={net} prefix={net > 0 ? "+" : ""} signed sub={netSub}
        className="col-span-2 md:order-last md:col-span-1 md:border-l md:border-line"
        valueClass={`inline-block border-b-4 border-double pb-0.5 ${net < 0 ? "text-danger-text" : "text-brand-ink"}`}
        spark={spark((b) => Number(b.income) - Number(b.spending), colors.net)}
      />
      <Stat
        label="Earned" value={earned} sub={`Income in ${monthName(period.month)}`}
        className="border-t border-line md:border-t-0" valueClass="text-income"
        spark={spark((b) => Number(b.income), colors.income)}
      />
      <Stat
        label="Spent" value={spent} signed sub="After refunds"
        className="border-l border-t border-line md:border-t-0"
        spark={spark((b) => Number(b.spending), colors.spend)}
      />
    </section>
  );
}

// Plain HTML bars: the amount and share are always visible (no hover needed), and
// the widths glide when the month changes
function CategoryBars({ title, rows, period, kind }) {
  const positive = rows.filter((r) => Number(r.total) > 0);
  const sum = positive.reduce((a, r) => a + Number(r.total), 0);
  const max = Math.max(...positive.map((r) => Number(r.total)), 1);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section aria-labelledby={`cat-${kind}`} className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 id={`cat-${kind}`} className="text-card">{title}</h2>
        <span className="font-mono text-xs text-muted">{monthName(period.month)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{kind === "income" ? "No income" : "No spending"} in {monthName(period.month)}.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const total = Number(r.total);
            const width = total > 0 ? Math.max(2, (total / max) * 100) : 0;
            return (
              <li key={r.category_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
                <span className="truncate text-sm font-semibold">{r.category_name}</span>
                <span className="text-right font-mono text-sm font-medium">
                  {formatSigned(total)}
                  {total > 0 && <span className="ml-1.5 text-[13px] font-normal text-muted">{Math.round((total / sum) * 100)}%</span>}
                </span>
                <span aria-hidden="true" className="col-span-2 h-1.5 overflow-hidden bg-surface-2">
                  <span
                    style={{ width: grown ? `${width}%` : 0 }}
                    className={`block h-full transition-[width] duration-700 ease-soft ${
                      kind === "income"
                        ? "bg-[repeating-linear-gradient(135deg,var(--color-chart-income)_0_3px,var(--color-chart-income-2)_3px_6px)]"
                        : "bg-chart-spend"
                    }`}
                  />
                </span>
                {total <= 0 && (
                  <span className="col-span-2 text-xs text-muted">
                    Refunds {total < 0 ? "were more than" : "cancelled out"} spending
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function useOverviewData(token, period, refreshKey) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    Promise.all([
      getSummary(token, period),
      getSpendingByCategory(token, period),
      getIncomeByCategory(token, period),
      getTrend(token, { ...period, bucket: "day" }),
      getTrend(token, { ...period, bucket: "week" }),
    ])
      .then(([summary, spending, income, daily, weekly]) => {
        if (!cancelled) setState({ data: { summary, spending, income, daily, weekly }, error: "", loading: false });
      })
      .catch((err) => {
        // Keep the last figures on screen and say what failed
        if (!cancelled) setState((s) => ({ ...s, error: err.message || "Couldn't load this month.", loading: false }));
      });
    return () => { cancelled = true; };
  }, [token, period, refreshKey]);
  return state;
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="grid animate-pulse gap-4">
      <div className="h-36 rounded-card bg-surface" />
      <div className="h-80 rounded-card bg-surface" />
    </div>
  );
}

// Everything on this page follows the month picker
export default function OverviewPage({ token, period, onPeriodChange, refreshKey, transactions, onEdit, onAdd, onSeeAll, theme }) {
  const { data, error, loading } = useOverviewData(token, period, refreshKey);
  const recent = transactions.filter((t) => inPeriod(t.transaction_date, period)).slice(0, 5);
  const css = getComputedStyle(document.documentElement);
  const colors = {
    income: css.getPropertyValue("--color-chart-income").trim(),
    spend: css.getPropertyValue("--color-chart-spend").trim(),
    net: css.getPropertyValue("--color-chart-net").trim(),
  };
  const empty = data && Number(data.summary.total_earned) === 0 && Number(data.summary.total_spent) === 0 && recent.length === 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page md:text-page-lg">Overview</h1>
        <MonthPicker period={period} onChange={onPeriodChange} />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-control bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger-text">{error}</p>
      )}

      {!data ? (
        loading ? <Skeleton /> : null
      ) : empty ? (
        <div className="grid justify-items-center gap-2 rounded-card border border-line bg-surface px-4 py-10 text-center">
          <h2 className="text-lg">Nothing in {monthLabel(period.year, period.month)}</h2>
          <p className="max-w-[36ch] text-muted">Add a transaction or pick another month.</p>
          <button
            type="button" onClick={onAdd}
            className="mt-2 flex h-11 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-on-brand hover:bg-brand-hover active:scale-[0.98]"
          >
            <PlusIcon /> Add transaction
          </button>
        </div>
      ) : (
        <div className={`grid gap-3.5 transition-opacity md:grid-cols-2 xl:grid-cols-6 ${loading ? "opacity-70" : ""}`}>
          <div className="md:col-span-2 xl:col-span-6">
            <SummaryStrip summary={data.summary} daily={data.daily} period={period} colors={colors} />
          </div>
          <div className="min-w-0 md:col-span-2 xl:col-span-4">
            <TrendCard period={period} daily={data.daily} weekly={data.weekly} theme={theme} />
          </div>
          <section aria-labelledby="recent-h" className="rounded-card border border-line bg-surface p-4 sm:p-5 md:order-last md:col-span-2 xl:order-none xl:col-span-2">
            <h2 id="recent-h" className="mb-2 text-card">Recent</h2>
            {recent.length ? (
              <>
                <ul>{recent.map((tx) => <TxRow key={tx.id} tx={tx} onEdit={onEdit} compact />)}</ul>
                <button
                  type="button" onClick={onSeeAll}
                  className="mt-2.5 h-11 w-full rounded-control border border-field font-semibold transition-colors hover:bg-surface-2 active:scale-[0.99]"
                >
                  See all transactions
                </button>
              </>
            ) : (
              <p className="text-sm text-muted">No transactions in {monthName(period.month)}.</p>
            )}
          </section>
          <div className="xl:col-span-3"><CategoryBars title="Spending by category" rows={data.spending} period={period} kind="spending" /></div>
          <div className="xl:col-span-3"><CategoryBars title="Income by category" rows={data.income} period={period} kind="income" /></div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTrend } from "../api";
import { formatINR, parseDate } from "../format";

// Teal/orange instead of green/red: green/red fails colorblind separation,
// these pass and still read as "money in" / "money out"
export const INCOME_COLOR = "#0d9488";
export const SPENDING_COLOR = "#ea580c";

const compactINR = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const shortDate = { month: "short", day: "numeric" };

function bucketTitle(bucket) {
  const start = parseDate(bucket.start);
  // end is exclusive, so the last day in the bucket is the day before it
  const last = parseDate(bucket.end);
  last.setDate(last.getDate() - 1);
  const first = start.toLocaleDateString(undefined, shortDate);
  if (last.getTime() === start.getTime()) return first;
  return `${first} - ${last.toLocaleDateString(undefined, shortDate)}`;
}

function axisLabel(bucket, mode) {
  const start = parseDate(bucket.start);
  if (mode === "day") return String(start.getDate());
  const last = parseDate(bucket.end);
  last.setDate(last.getDate() - 1);
  return start.getDate() === last.getDate() ? String(start.getDate()) : `${start.getDate()}-${last.getDate()}`;
}

function Swatch({ color }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />;
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-sm">
      <p className="text-slate-800 font-semibold mb-1">{bucketTitle(bucket)}</p>
      <p className="flex items-center gap-2 text-slate-700 tabular-nums">
        <Swatch color={INCOME_COLOR} /> Income <span className="ml-auto pl-4 font-medium">{formatINR(bucket.income)}</span>
      </p>
      <p className="flex items-center gap-2 text-slate-700 tabular-nums">
        <Swatch color={SPENDING_COLOR} /> Spending <span className="ml-auto pl-4 font-medium">{formatINR(bucket.spending)}</span>
      </p>
      {bucket.spendingValue < 0 && (
        <p className="text-xs text-slate-500 mt-1">Refunds were more than spending</p>
      )}
    </div>
  );
}

/**
 * Income and spending per day or week for one IST month. `period` comes from the
 * summary response, so this chart and the summary card always show the same month.
 */
export default function TrendChart({ token, period, refreshKey = 0 }) {
  const [mode, setMode] = useState("day");
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const year = period?.year;
  const month = period?.month;

  useEffect(() => {
    if (!year || !month) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    getTrend(token, { year, month, bucket: mode })
      .then((data) => { if (!cancelled) setBuckets(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load trend."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, year, month, mode, refreshKey]);

  const monthLabel = year && month
    ? new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  const toggle = (
    <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm" role="group" aria-label="Group by">
      {["day", "week"].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={
            "px-3 py-1 rounded-md capitalize " +
            (mode === m ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100")
          }
        >
          {m === "day" ? "Daily" : "Weekly"}
        </button>
      ))}
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <h2 className="text-lg font-medium text-slate-800">
        Income and spending{" "}
        {monthLabel && <span className="text-sm font-normal text-slate-500">· {monthLabel}</span>}
      </h2>
      {toggle}
    </div>
  );

  let body;
  if (loading || !year) {
    body = <div className="h-64 rounded-lg bg-slate-100 animate-pulse" />;
  } else if (error) {
    body = (
      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
    );
  } else if (buckets.every((b) => Number(b.income) === 0 && Number(b.spending) === 0)) {
    body = (
      <div className="h-40 flex flex-col items-center justify-center text-center">
        <p className="text-slate-700 font-medium">Nothing recorded in {monthLabel}</p>
        <p className="text-sm text-slate-500 mt-1">Transactions you add this month will show up here.</p>
      </div>
    );
  } else {
    const data = buckets.map((b) => ({
      ...b,
      label: axisLabel(b, mode),
      incomeValue: Number(b.income),
      spendingValue: Number(b.spending),
    }));
    const hasNegative = data.some((d) => d.spendingValue < 0);
    body = (
      <>
        <div className="flex items-center gap-4 text-sm text-slate-600 mb-2" aria-hidden="true">
          <span className="flex items-center gap-1.5"><Swatch color={INCOME_COLOR} /> Income</span>
          <span className="flex items-center gap-1.5"><Swatch color={SPENDING_COLOR} /> Spending</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap={mode === "day" ? "20%" : "30%"}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={false}
              interval={mode === "day" ? "preserveStartEnd" : 0}
              minTickGap={8}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => compactINR.format(v)}
            />
            {hasNegative && <ReferenceLine y={0} stroke="#94a3b8" />}
            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar dataKey="incomeValue" name="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
            <Bar dataKey="spendingValue" name="Spending" fill={SPENDING_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </>
    );
  }

  return (
    <section className="mb-6">
      {header}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">{body}</div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "../format";

// Recharts merges `total` and `noun` from the JSX into the props it injects on hover
function CategoryTooltip({ active, payload, total, noun }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  const percentOfTotal = total > 0 ? (row.value / total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-sm">
      <p className="text-slate-800 font-semibold">{row.category_name}</p>
      <p className="text-slate-800 font-medium tabular-nums">{formatINR(row.total)}</p>
      <p className="text-slate-500 text-xs">{percentOfTotal.toFixed(1)}% of total {noun}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-1.5">
        <div className="h-3 w-20 bg-slate-200 rounded" />
        <div className="h-3 w-16 bg-slate-200 rounded" />
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full" />
    </div>
  );
}

/**
 * All-time totals per category as horizontal bars, biggest first (the API's order).
 * Used for both spending and income; `fetchRows` picks which.
 */
export default function CategoryBreakdown({ token, refreshKey = 0, title, fetchRows, color, noun, emptyText }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchRows(token)
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setError(err.message || `Failed to load ${noun} breakdown.`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, refreshKey, fetchRows, noun]);

  const heading = (
    <h2 className="text-lg font-medium text-slate-800 mb-3">
      {title}{" "}
      <span className="text-sm font-normal text-slate-500">· all-time</span>
    </h2>
  );

  if (loading) {
    return (
      <section>
        {heading}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        {heading}
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section>
        {heading}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-slate-700 font-medium">No {noun} yet</p>
          <p className="text-sm text-slate-500 mt-1">{emptyText}</p>
        </div>
      </section>
    );
  }

  // Numbers only for bar length and the percentage; the tooltip shows the API's string
  const chartData = rows.map((r) => ({ ...r, value: Number(r.total) }));
  const total = chartData.reduce((sum, r) => sum + r.value, 0);
  const chartHeight = Math.max(chartData.length * 44, 160);

  return (
    <section>
      {heading}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category_name"
              tick={{ fill: "#334155", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip content={<CategoryTooltip total={total} noun={noun} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSpendingByCategory } from "../api";

function formatINR(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? "");
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Recharts injects { active, payload, label } when it renders this on hover.
// We also pass `total` in via the JSX prop, and Recharts merges it in — so the
// component gets everything as one flat props object.
function SpendingTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;

  // payload[0].payload is the original row we handed to <BarChart data={...}>,
  // shape: { category_id, category_name, total }.
  const row = payload[0].payload;
  const percentOfTotal = total > 0 ? (Number(row.total) / total) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-sm">
      <p className="text-slate-800 font-semibold">{row.category_name}</p>
      <p className="text-red-600 font-medium tabular-nums">₹{formatINR(row.total)}</p>
      <p className="text-slate-500 text-xs">{percentOfTotal.toFixed(1)}% of total spending</p>
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

export default function SpendingByCategory({ token, refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getSpendingByCategory(token)
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load spending breakdown."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, refreshKey]);

  const heading = (
    <h2 className="text-lg font-medium text-slate-800 mb-3">
      Spending by category{" "}
      <span className="text-sm font-normal text-slate-500">· all-time</span>
    </h2>
  );

  if (loading) {
    return (
      <section className="mb-6">
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
      <section className="mb-6">
        {heading}
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="mb-6">
        {heading}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
          <p className="text-slate-700 font-medium">No spending yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Add a DEBIT transaction to see how your spending breaks down.
          </p>
        </div>
      </section>
    );
  }

  // Backend serialises Decimal as a string ("324.93"); Recharts needs numbers.
  const chartData = rows.map((r) => ({ ...r, total: Number(r.total) || 0 }));
  const total = chartData.reduce((sum, r) => sum + r.total, 0);

  // Height scales with row count so tall/short lists both breathe.
  const chartHeight = Math.max(chartData.length * 44, 160);

  return (
    <section className="mb-6">
      {heading}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="category_name"
              tick={{ fill: "#334155", fontSize: 13 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              content={<SpendingTooltip total={total} />}
              cursor={{ fill: "rgba(0,0,0,0.02)" }}
            />
            <Bar dataKey="total" fill="#f87171" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { getSummary } from "../api";


function formatINR(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? "");
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Card({ label, value, tone }) {
  const tones = {
    green: "text-green-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        {label}
      </p>
      <p className={"mt-2 text-2xl font-semibold tabular-nums " + (tones[tone] || "text-slate-800")}>
        ₹{formatINR(value)}
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 animate-pulse">
      <div className="h-3 w-20 bg-slate-200 rounded" />
      <div className="mt-3 h-7 w-28 bg-slate-200 rounded" />
    </div>
  );
}

export default function MonthlySummary({ token }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getSummary(token)
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load summary."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <section className="mb-6">
        <h2 className="text-lg font-medium text-slate-800 mb-3">Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6">
        <h2 className="text-lg font-medium text-slate-800 mb-3">Summary</h2>
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      </section>
    );
  }

  const netNumber = Number(summary?.net);
  const netTone = Number.isNaN(netNumber) || netNumber === 0
    ? "blue"
    : netNumber > 0
      ? "green"
      : "red";

  return (
    <section className="mb-6">
      <h2 className="text-lg font-medium text-slate-800 mb-3">Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card label="Total Earned" value={summary?.total_earned ?? 0} tone="green" />
        <Card label="Total Spent" value={summary?.total_spent ?? 0} tone="red" />
        <Card label="Net" value={summary?.net ?? 0} tone={netTone} />
      </div>
    </section>
  );
}

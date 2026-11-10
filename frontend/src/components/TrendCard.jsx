import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currentPeriod, dayLabel, formatINR, formatShort, formatSigned, monthName, monthShort } from "../format";
import { prefersReducedMotion } from "../hooks";

// SVG attributes can't reliably read CSS variables (Firefox), so the chart reads the
// resolved token values, again whenever the theme changes
function useChartColors(theme) {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const get = (name) => css.getPropertyValue(name).trim();
    return {
      income: get("--color-chart-income"), income2: get("--color-chart-income-2"),
      spend: get("--color-chart-spend"), grid: get("--color-line"),
      muted: get("--color-muted"), band: get("--color-surface-2"),
    };
    // theme is the trigger: the variables change when it does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

// "16" for a day, "5–11" for a week (weeks start on Monday, clipped to the month)
function shortLabel(b) {
  const first = Number(b.start.slice(8));
  // end is exclusive, so the bucket's last day is the day before it (which may be
  // the last day of the month when end is the 1st of the next)
  const [y, m, d] = b.end.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1, d - 1)).getUTCDate();
  return first === last ? String(first) : `${first}–${last}`;
}

function longLabel(b, isWeek, month) {
  if (!isWeek) return dayLabel(`${b.start}T12:00:00+05:30`);
  const label = shortLabel(b);
  return `${label} ${monthShort(month)}`;
}

// Round steps (1, 2, 2.5, 5 × 10ⁿ) with about four gridlines, from 0 up, and below 0
// only as far as a negative bucket needs
function niceScale(data) {
  const max = Math.max(0, ...data.map((d) => Math.max(d.income, d.spending)));
  const min = Math.min(0, ...data.map((d) => d.spending));
  const raw = (max - min) / 4 || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  const top = Math.ceil(max / step) * step;
  const bottom = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
  return { domain: [bottom, top], ticks };
}

function defaultIndex(buckets, period) {
  const now = currentPeriod();
  if (now.year === period.year && now.month === period.month) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const i = buckets.findIndex((b) => b.start <= today && today < b.end);
    if (i >= 0) return i;
  }
  let best = 0;
  buckets.forEach((b, i) => { if (Number(b.spending) > Number(buckets[best].spending)) best = i; });
  return best;
}

// Income and spending per day or week of the chosen month. Income is hatched and
// spending solid, so they differ by more than colour. Tap or click a bar (or use the
// arrow keys) to read that day below the chart; hover isn't needed
export default function TrendCard({ period, daily, weekly, theme }) {
  const [mode, setMode] = useState("day");
  const buckets = (mode === "day" ? daily : weekly) || [];
  const colors = useChartColors(theme);
  const reduced = prefersReducedMotion();

  const key = `${period.year}-${period.month}-${mode}`;
  const [selection, setSelection] = useState({ key: null, i: 0 });
  const selected = selection.key === key ? selection.i : defaultIndex(buckets, period);
  const select = (i) => setSelection({ key, i: Math.max(0, Math.min(buckets.length - 1, i)) });

  const data = buckets.map((b) => ({ label: shortLabel(b), income: Number(b.income), spending: Number(b.spending) }));
  const empty = data.every((d) => d.income === 0 && d.spending === 0);
  const ticks = mode === "day"
    ? data.filter((_, i) => i === 0 || (i + 1) % 5 === 0).map((d) => d.label)
    : data.map((d) => d.label);
  const scale = niceScale(data);
  const current = buckets[selected];
  const isWeek = mode === "week";

  return (
    <section aria-labelledby="trend-h" className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="trend-h" className="text-card">Money in and out</h2>
        <div role="group" aria-label="Group by" className="relative isolate flex rounded-control border border-line bg-surface-2 p-[3px]">
          <span
            aria-hidden="true"
            className={`absolute inset-y-[3px] left-[3px] -z-10 w-[calc(50%-3px)] rounded-[5px] bg-surface shadow-chip transition-transform duration-300 ease-soft ${isWeek ? "translate-x-full" : ""}`}
          />
          {[["day", "Daily"], ["week", "Weekly"]].map(([value, label]) => (
            <button
              key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
              className={`h-[38px] w-[84px] rounded-[5px] text-sm font-semibold transition-colors ${mode === value ? "text-ink" : "text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="flex gap-4 text-[13px] font-semibold text-muted">
        <span className="flex items-center gap-1.5">
          <i className="inline-block size-3.5 rounded-sm border-[1.5px] border-chart-income bg-[repeating-linear-gradient(135deg,var(--color-chart-income)_0_2px,transparent_2px_5px)]" />
          Income
        </span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-3.5 rounded-sm bg-chart-spend" />Spending</span>
      </div>

      {empty ? (
        <div className="mt-3 grid h-48 place-items-center rounded-control border border-dashed border-line text-sm text-muted">
          Nothing recorded in {monthName(period.month)}
        </div>
      ) : (
        <div
          tabIndex={0} role="group"
          aria-label={`Chart of income and spending. Use the left and right arrow keys to read each ${isWeek ? "week" : "day"}.`}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              select(selected + (e.key === "ArrowRight" ? 1 : -1));
            }
          }}
          className="mt-3 h-52 rounded-control sm:h-60"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}
              barCategoryGap={isWeek ? "28%" : "18%"}
              onClick={(state) => {
                if (state?.activeTooltipIndex != null) select(Number(state.activeTooltipIndex));
              }}
              accessibilityLayer={false}
            >
              <defs>
                <pattern id="ll-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="5" height="5" fill={colors.income2} />
                  <rect width="2" height="5" fill={colors.income} />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="label" ticks={ticks} interval={0} tickLine={false} axisLine={false}
                tick={{ fill: colors.muted, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
              />
              {/* Starts at 0, and only goes below it when a bucket really is negative */}
              <YAxis
                width={48} tickLine={false} axisLine={false} allowDecimals={false}
                domain={scale.domain} ticks={scale.ticks}
                tickFormatter={formatShort}
                tick={{ fill: colors.muted, fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }}
              />
              <ReferenceLine y={0} stroke={colors.muted} />
              <Tooltip content={() => null} cursor={{ fill: colors.band }} />
              <Bar
                dataKey="income" fill="url(#ll-hatch)" stroke={colors.income} strokeWidth={1} radius={[2, 2, 0, 0]}
                isAnimationActive={!reduced} animationDuration={600} animationEasing="ease-out"
              />
              <Bar
                dataKey="spending" fill={colors.spend} radius={2}
                isAnimationActive={!reduced} animationDuration={600} animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!empty && current && (
        <p aria-live="polite" className="mt-3 flex min-h-6 flex-wrap items-baseline gap-x-3.5 gap-y-1 text-sm">
          <strong className="font-semibold">{longLabel(current, isWeek, period.month)}</strong>
          <span>In <span className="font-mono">{formatINR(current.income)}</span></span>
          <span>Out <span className="font-mono">{formatSigned(current.spending)}</span></span>
          {Number(current.spending) < 0 && <span className="text-[13px] text-muted">Refunds were more than spending</span>}
        </p>
      )}

      <table className="sr-only">
        <caption>Income and spending per {isWeek ? "week" : "day"}, {monthName(period.month)} {period.year}</caption>
        <thead><tr><th>{isWeek ? "Week" : "Day"}</th><th>Income</th><th>Spending</th></tr></thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.start}><td>{longLabel(b, isWeek, period.month)}</td><td>{formatINR(b.income)}</td><td>{formatSigned(b.spending)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

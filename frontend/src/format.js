// Money arrives from the API as Decimal strings ("1049.10"). Intl formats a numeric
// string exactly, so display values never pass through a float.
const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

// The backend buckets days and months in IST, so everything shown here does too,
// whatever timezone the browser is in
export const IST = "Asia/Kolkata";
const MINUS = "−"; // a real minus sign, the same width as +

export function formatINR(value) {
  return `₹${inr.format(value)}`;
}

// ₹1,780.00 or −₹1,780.00
export function formatSigned(value) {
  const n = Number(value);
  return (n < 0 ? MINUS : "") + formatINR(Math.abs(n));
}

// Sign by transaction type: money out is −, money in (income or refund) is +
export function formatTxAmount(tx) {
  return (tx.type === "DEBIT" ? MINUS : "+") + formatINR(tx.amount);
}

// Chart axis labels in Indian units: ₹1L, ₹25K, −₹3K
export function formatShort(value) {
  const n = Number(value);
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : "";
  if (a >= 100000) return `${sign}₹${inrWhole.format(a / 100000)}L`;
  if (a >= 1000) return `${sign}₹${inrWhole.format(a / 1000)}K`;
  return `${sign}₹${inrWhole.format(a)}`;
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// An instant's IST wall-clock parts: { y, m, d, hh, mm }
export function istParts(value) {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour, mm: +parts.minute };
}

const pad = (n) => String(n).padStart(2, "0");

// "2026-10-31": the IST calendar day, for grouping
export function dayKey(value) {
  const { y, m, d } = istParts(value);
  return `${y}-${pad(m)}-${pad(d)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Today, Yesterday, then "Sat, 31 Oct" (with the year when it isn't this year)
export function dayLabel(value, now = new Date()) {
  const a = istParts(value);
  const b = istParts(now);
  const daysApart = (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 864e5;
  if (daysApart === 0) return "Today";
  if (daysApart === 1) return "Yesterday";
  const weekday = WEEKDAYS[new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay()];
  return `${weekday}, ${a.d} ${MONTHS[a.m - 1]}` + (a.y !== b.y ? ` ${a.y}` : "");
}

// "31 Oct"
export function shortDate(value) {
  const { d, m } = istParts(value);
  return `${d} ${MONTHS[m - 1]}`;
}

// "9:00 pm"
export function timeLabel(value) {
  const { hh, mm } = istParts(value);
  return `${((hh + 11) % 12) + 1}:${pad(mm)} ${hh < 12 ? "am" : "pm"}`;
}

export function monthLabel(year, month) {
  return `${MONTHS_LONG[month - 1]} ${year}`;
}
export const monthName = (month) => MONTHS_LONG[month - 1];
export const monthShort = (month) => MONTHS[month - 1];

// The IST month in progress
export function currentPeriod(now = new Date()) {
  const { y, m } = istParts(now);
  return { year: y, month: m };
}

export function shiftPeriod({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const comparePeriods = (a, b) => (a.year - b.year) * 12 + (a.month - b.month);

export function inPeriod(value, { year, month }) {
  const { y, m } = istParts(value);
  return y === year && m === month;
}

// Form inputs <-> the API. The form edits IST wall-clock date and time, and sends them
// with an explicit +05:30, so a browser in another timezone can't file an entry under
// the wrong IST day
export function toIstInputs(value) {
  const { y, m, d, hh, mm } = istParts(value);
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(hh)}:${pad(mm)}` };
}

export function fromIstInputs(date, time) {
  return `${date}T${time}:00+05:30`;
}

// "2026-10-06" as a local calendar date. new Date("2026-10-06") would parse it as
// UTC midnight and show the previous day in timezones west of UTC.
export function parseDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

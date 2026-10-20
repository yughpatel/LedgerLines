// Money arrives from the API as Decimal strings ("1049.10"). Intl formats a numeric
// string exactly, so display values never pass through a float.
const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatINR(value) {
  return `₹${inr.format(value)}`;
}

// "2026-10-06" as a local calendar date. new Date("2026-10-06") would parse it as
// UTC midnight and show the previous day in timezones west of UTC.
export function parseDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

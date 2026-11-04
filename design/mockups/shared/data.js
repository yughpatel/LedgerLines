// Sample data and the same maths the backend does, so the mockups behave like the
// real app: IST calendar days, refunds lower spending, weeks start on Monday and
// are clipped to the month. Dates are stored as IST wall-clock parts, so the
// mockup shows the same thing in any viewer timezone.
(function () {
  const NOW = { y: 2026, m: 11, d: 3, hh: 18, mm: 40 };

  const CATEGORIES = [
    { id: 1, name: "Food", system: true },
    { id: 2, name: "Rent", system: true },
    { id: 3, name: "Travel", system: true },
    { id: 4, name: "Utilities", system: true },
    { id: 5, name: "Other", system: true },
    { id: 6, name: "Salary", system: false },
    { id: 7, name: "Freelance", system: false },
    { id: 8, name: "Shopping", system: false },
  ];
  const catByName = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));

  // [day, type, category, amount, description, "hh:mm"]
  const BASE = [
    [1, "CREDIT", "Salary", 85000, "Salary", "09:05"],
    [2, "DEBIT", "Food", 1860, "Weekly groceries", "19:20"],
    [3, "DEBIT", "Rent", 22000, "Flat rent", "10:00"],
    [4, "DEBIT", "Travel", 500, "Metro card top-up", "08:40"],
    [5, "DEBIT", "Utilities", 1840, "Electricity bill", "21:10"],
    [6, "DEBIT", "Food", 420, "Lunch with team", "13:30"],
    [8, "DEBIT", "Food", 1240, "Dinner out", "21:45"],
    [9, "DEBIT", "Food", 2140, "Weekly groceries", "18:10"],
    [10, "DEBIT", "Travel", 380, "Cab home", "23:05"],
    [12, "DEBIT", "Utilities", 799, "Broadband", "11:00"],
    [13, "DEBIT", "Other", 1500, "Birthday gift", "17:25"],
    [14, "DEBIT", "Food", 260, "", "16:40"],
    [16, "DEBIT", "Food", 1990, "Weekly groceries", "19:00"],
    [18, "DEBIT", "Travel", 640, "Cab to airport", "05:50"],
    [19, "DEBIT", "Food", 880, "Pizza night", "20:30"],
    [20, "DEBIT", "Utilities", 299, "Mobile recharge", "09:15"],
    [22, "DEBIT", "Food", 540, "Breakfast cafe", "10:20"],
    [23, "DEBIT", "Food", 2310, "Weekly groceries", "18:45"],
    [25, "DEBIT", "Other", 650, "", "12:00"],
    [26, "DEBIT", "Travel", 500, "Metro card top-up", "08:35"],
    [27, "DEBIT", "Food", 1120, "Dinner out", "21:20"],
    [29, "DEBIT", "Food", 360, "Lunch", "13:15"],
    [30, "DEBIT", "Food", 1780, "Weekly groceries", "18:30"],
    [31, "DEBIT", "Food", 1450, "Dinner out", "21:00"],
  ];
  const EXTRA = {
    9: [[15, "CREDIT", "Freelance", 18000, "Logo project", "12:15"],
        [21, "DEBIT", "Shopping", 3199, "Kurta for Navratri", "17:40"]],
    10: [[9, "DEBIT", "Shopping", 4999, "Wireless headphones", "14:20"],
         [11, "DEBIT", "Travel", 1465, "Train to Mysuru", "07:30"],
         [13, "REFUND", "Travel", 1465, "Train ticket cancelled", "09:10"],
         [15, "CREDIT", "Freelance", 24000, "App icons, Studio Kite", "12:15"],
         [16, "REFUND", "Shopping", 4999, "Headphones returned", "11:05"],
         [21, "DEBIT", "Shopping", 2350, "Running shoes", "18:05"],
         [24, "CREDIT", "Other", 3500, "Sold old cycle", "16:30"],
         [31, "DEBIT", "Other", 1800, "Diwali sweets and diyas", "19:40"]],
  };

  // Small seeded jitter so months don't look copy-pasted
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const TX = [];
  let nextId = 1;
  for (const [y, m] of [[2026, 8], [2026, 9], [2026, 10], [2026, 11]]) {
    const rows = BASE.concat(EXTRA[m] || []);
    for (const [d, type, cat, amt, desc, t] of rows) {
      if (d > daysIn(y, m)) continue;
      const [hh, mm] = t.split(":").map(Number);
      if (y === NOW.y && m === NOW.m && (d > NOW.d || (d === NOW.d && hh * 60 + mm > NOW.hh * 60 + NOW.mm))) continue;
      let amount = amt;
      if (cat === "Food" && m !== 10) amount = Math.round(amt * (0.8 + rnd() * 0.4) / 10) * 10;
      TX.push({ id: nextId++, type, amount: amount.toFixed(2), category: catByName[cat], description: desc, at: { y, m, d, hh, mm } });
    }
  }
  // A couple of entries for "today" so the Today group is real
  TX.push({ id: nextId++, type: "DEBIT", amount: "185.00", category: catByName.Food, description: "Chai and samosa", at: { ...NOW, hh: 16, mm: 10 } });
  TX.push({ id: nextId++, type: "DEBIT", amount: "1249.00", category: catByName.Utilities, description: "Gas cylinder", at: { ...NOW, hh: 11, mm: 25 } });

  const key = (a) => a.y * 1e8 + a.m * 1e6 + a.d * 1e4 + a.hh * 100 + a.mm;
  TX.sort((a, b) => key(b.at) - key(a.at));

  // Formatting, same rules as frontend/src/format.js
  const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const fmt = {
    inr: (v) => `₹${inr.format(Math.abs(v))}`,
    signed: (v) => (v < 0 ? "−" : "") + `₹${inr.format(Math.abs(v))}`,
    short: (v) => {
      const a = Math.abs(v), s = v < 0 ? "−" : "";
      if (a >= 100000) return `${s}₹${(a / 100000).toFixed(a % 100000 ? 1 : 0)}L`;
      if (a >= 1000) return `${s}₹${(a / 1000).toFixed(a % 1000 ? 1 : 0)}K`;
      return `${s}₹${inr0.format(a)}`;
    },
    time: ({ hh, mm }) => `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`,
    month: (y, m) => `${MONTHS[m - 1]} ${y}`,
    monthLong: (y, m) => `${MONTHS_LONG[m - 1]} ${y}`,
    monthName: (m) => MONTHS_LONG[m - 1],
    monthShort: (m) => MONTHS[m - 1],
    dayLabel: ({ y, m, d }) => {
      const diff = (Date.UTC(NOW.y, NOW.m - 1, NOW.d) - Date.UTC(y, m - 1, d)) / 864e5;
      if (diff === 0) return "Today";
      if (diff === 1) return "Yesterday";
      const wd = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      return `${wd}, ${d} ${MONTHS[m - 1]}` + (y !== NOW.y ? ` ${y}` : "");
    },
    dateShort: ({ y, m, d }) => `${d} ${MONTHS[m - 1]}`,
  };

  const inMonth = (y, m) => TX.filter((t) => t.at.y === y && t.at.m === m);
  const signedSpend = (t) => (t.type === "DEBIT" ? +t.amount : t.type === "REFUND" ? -t.amount : 0);

  function summary(y, m) {
    let earned = 0, spent = 0;
    for (const t of inMonth(y, m)) {
      if (t.type === "CREDIT") earned += +t.amount;
      spent += signedSpend(t);
    }
    return { earned, spent, net: earned - spent };
  }

  function trend(y, m, bucket) {
    const n = daysIn(y, m), out = [];
    if (bucket === "day") {
      for (let d = 1; d <= n; d++) out.push({ start: d, end: d + 1, income: 0, spending: 0 });
    } else {
      const wd = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
      let cursor = 1 - wd;
      while (cursor <= n) {
        out.push({ start: Math.max(cursor, 1), end: Math.min(cursor + 7, n + 1), income: 0, spending: 0 });
        cursor += 7;
      }
    }
    for (const t of inMonth(y, m)) {
      const b = out.find((b) => t.at.d >= b.start && t.at.d < b.end);
      if (t.type === "CREDIT") b.income += +t.amount;
      b.spending += signedSpend(t);
    }
    return out;
  }

  function byCategory(y, m, kind) {
    const map = new Map();
    for (const t of inMonth(y, m)) {
      const v = kind === "income" ? (t.type === "CREDIT" ? +t.amount : 0) : signedSpend(t);
      if (kind === "income" && t.type !== "CREDIT") continue;
      if (kind === "spending" && t.type === "CREDIT") continue;
      map.set(t.category.name, (map.get(t.category.name) || 0) + v);
    }
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }

  window.LL = { NOW, CATEGORIES, TX, fmt, inMonth, summary, trend, byCategory, daysIn, nextId: () => nextId++ };
})();

// Clickable mockup. Static: no backend, edits live in memory until reload.
// Routes: #overview #transactions #add #login #signup, optional -dark / -light suffix.
//
// Motion model: the page is re-rendered from state, so nothing can transition on
// its own. Instead each render can carry one-off effects (S.fx), moving parts
// are animated FLIP-style from where they were (data-flip), numbers count from
// their last value, and the chart morphs from its last shape. Everything is off
// under prefers-reduced-motion.
(function () {
  const { NOW, CATEGORIES, TX, fmt } = window.LL;
  const DIR = window.LL_DIR || {};
  const root = document.getElementById("app");
  const EMAIL = "you@example.com";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EASE = "cubic-bezier(.2,.8,.2,1)";

  const svg = (d, w = 2) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    in: svg('<path d="M17 7 7 17"/><path d="M15 17H7V9"/>'),
    out: svg('<path d="M7 17 17 7"/><path d="M9 7h8v8"/>'),
    refund: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    overview: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    list: svg('<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 2.2),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    left: svg('<path d="m15 18-6-6 6-6"/>'),
    right: svg('<path d="m9 18 6-6-6-6"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    x: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>', 2.4).replace('class="icon"', 'class="icon tick"'),
    ok: svg('<path d="M20 6 9 17l-5-5"/>', 2.4),
    dot: svg('<circle cx="12" cy="12" r="4"/>'),
    alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'),
  };
  // Category icons: rows read like a bank statement, not a list of identical arrows
  const CAT_ICON = {
    Food: svg('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7.5c0-1 1-1.4 1-2.5M14 7.5c0-1 1-1.4 1-2.5"/>', 1.8),
    Rent: svg('<path d="m4 11 8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>', 1.8),
    Travel: svg('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8.5 21l1.5-4M15.5 21 14 17M9 14h.01M15 14h.01"/>', 1.8),
    Utilities: svg('<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>', 1.8),
    Other: svg('<path d="M3 12V4h8l10 10-8 8Z"/><path d="M7.5 7.5h.01"/>', 1.8),
    Salary: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>', 1.8),
    Freelance: svg('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>', 1.8),
    Shopping: svg('<path d="M5 8h14l-1 12H6Z"/><path d="M9 8a3 3 0 0 1 6 0"/>', 1.8),
  };
  const catIcon = (c) => CAT_ICON[c.name] || `<span class="initial">${esc(c.name.slice(0, 1).toUpperCase())}</span>`;
  const TYPE = {
    DEBIT: { word: "Expense", icon: I.out, sign: "−" },
    CREDIT: { word: "Income", icon: I.in, sign: "+" },
    REFUND: { word: "Refund", icon: I.refund, sign: "+" },
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const big = (s) => s.replace(/\.(\d\d)$/, '<small class="paise">.$1</small>');
  const NUMFMT = {
    inr: (v) => big(fmt.inr(v)),
    signed: (v) => big(fmt.signed(v)),
    net: (v) => (v < 0 ? "−" : v > 0 ? "+" : "") + big(fmt.inr(v)),
  };

  const S = {
    page: "overview", y: 2026, m: 10, // opens on a full month; the real app opens on the current one
    bucket: "day", sel: null,
    q: "", type: "all", cat: "all", shown: 20,
    sheet: null, confirm: null, menu: false, picker: null, toast: "",
    auth: "signin", authError: false, pw: "",
    fx: new Set(["page"]), monthDir: 0, flashId: null,
    nums: {}, cats: {}, chart: null,
  };
  let FX = new Set();

  // ---------- Routing and theme ----------
  function readHash() {
    const h = location.hash.slice(1);
    const [page, theme] = h.split("-");
    S.sheet = null; S.confirm = null; S.menu = false; S.picker = null;
    if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
    const accent = h.split("-")[2];
    if (accent === "neem" || accent === "madder") document.documentElement.dataset.accent = accent;
    else if (accent === "brass") delete document.documentElement.dataset.accent;
    if (page === "login" || page === "signup") { S.page = "login"; S.auth = page === "signup" ? "signup" : "signin"; }
    else if (page === "transactions") S.page = "transactions";
    else if (page === "add") { S.page = S.page === "login" ? "overview" : S.page; S.sheet = newSheet(); S.fx.add("sheet"); }
    else S.page = "overview";
    S.fx.add("page");
  }
  const themeSuffix = () => {
    const d = document.documentElement.dataset;
    return (d.theme ? "-" + d.theme : "") + (d.accent ? (d.theme ? "" : "-") + "-" + d.accent : "");
  };
  function go(page) {
    if (page === S.page && page !== "login") return;
    S.page = page; S.menu = false; S.picker = null; S.fx.add("page");
    history.replaceState(null, "", "#" + page + themeSuffix());
    render(); window.scrollTo(0, 0);
  }
  function currentDark() {
    const el = document.documentElement;
    if (el.dataset.theme) return el.dataset.theme === "dark";
    return DIR.darkFirst ? !matchMedia("(prefers-color-scheme: light)").matches : matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    const run = () => {
      document.documentElement.dataset.theme = currentDark() ? "light" : "dark";
      history.replaceState(null, "", "#" + S.page + themeSuffix());
      render();
    };
    // A soft cross-fade where the browser supports it, an instant swap elsewhere
    if (document.startViewTransition && !reduced()) document.startViewTransition(run); else run();
  }

  // ---------- Pieces ----------
  const isCurrent = () => S.y === NOW.y && S.m === NOW.m;
  const thumb = (key) => `<i class="thumb" data-flip="${key}" aria-hidden="true"></i>`;
  function monthBar() {
    const atStart = S.y === 2020 && S.m === 1;
    const slide = FX.has("month") && S.monthDir ? (S.monthDir > 0 ? "from-right" : "from-left") : "";
    return `<div class="monthbar" role="group" aria-label="Month">
      <button class="icon-btn" data-act="prev" aria-label="Previous month" ${atStart ? "disabled" : ""}>${I.left}</button>
      <button class="month-label" data-act="picker" aria-haspopup="dialog" aria-expanded="${!!S.picker}"><span class="ml-text ${slide}">${fmt.monthLong(S.y, S.m)}</span>${I.down}</button>
      <button class="icon-btn" data-act="next" aria-label="Next month" ${isCurrent() ? "disabled" : ""}>${I.right}</button>
      ${isCurrent() ? "" : `<button class="back-now" data-act="now">This month</button>`}
      ${S.picker ? monthPop() : ""}
    </div>`;
  }
  function monthPop() {
    const y = S.picker.y;
    let cells = "";
    for (let m = 1; m <= 12; m++) {
      const future = y > NOW.y || (y === NOW.y && m > NOW.m);
      cells += `<button data-act="pick" data-y="${y}" data-m="${m}" ${future ? "disabled" : ""} aria-current="${y === S.y && m === S.m}">${fmt.monthShort(m)}</button>`;
    }
    return `<div class="month-pop ${FX.has("picker") ? "fx-in" : ""}" role="dialog" aria-label="Choose month">
      <div class="yr"><button class="icon-btn" data-act="pyr" aria-label="Previous year" ${y <= 2020 ? "disabled" : ""}>${I.left}</button><span class="num">${y}</span><button class="icon-btn" data-act="nyr" aria-label="Next year" ${y >= NOW.y ? "disabled" : ""}>${I.right}</button></div>
      <div class="month-grid">${cells}</div></div>`;
  }

  function amountHtml(t) {
    const T = TYPE[t.type];
    return `<span class="amount ${t.type}"><span class="sr-only">${T.word} </span><span aria-hidden="true">${T.sign}</span>${fmt.inr(+t.amount)}</span>`;
  }
  function txRow(t, i, actions = true) {
    const T = TYPE[t.type];
    const title = t.description || t.category.name;
    const tag = t.type === "REFUND" ? `<span class="tag REFUND">Refund</span>` : "";
    const meta = tag + (t.description ? `${esc(t.category.name)} · ${fmt.time(t.at)}` : fmt.time(t.at));
    return `<li class="tx ${S.flashId === t.id ? "flash" : ""}" data-id="${t.id}" style="--i:${Math.min(i, 14)}">
      <button class="tx-main" data-act="edit" data-id="${t.id}" aria-label="${esc(title)}, ${T.word} ${fmt.inr(+t.amount)}, ${esc(t.category.name)}, ${fmt.dayLabel(t.at)} ${fmt.time(t.at)}. Edit">
        <span class="glyph" aria-hidden="true">${catIcon(t.category)}</span>
        <span class="tx-text"><span class="tx-title">${esc(title)}</span><span class="tx-meta">${meta}</span></span>
        <span class="tx-cat" aria-hidden="true">${tag}${esc(t.category.name)}</span>
        <span class="tx-time num" aria-hidden="true">${fmt.time(t.at)}</span>
        ${amountHtml(t)}
      </button>
      ${actions ? `<div class="tx-actions"><button class="icon-btn" data-act="edit" data-id="${t.id}" aria-label="Edit ${esc(title)}">${I.edit}</button><button class="icon-btn" data-act="del" data-id="${t.id}" aria-label="Delete ${esc(title)}">${I.trash}</button></div>` : ""}
    </li>`;
  }

  // ---------- Overview ----------
  function sparkline(kind) {
    const b = window.LL.trend(S.y, S.m, "day");
    let acc = 0;
    const pts = b.map((x) => (acc += kind === "in" ? x.income : kind === "out" ? x.spending : x.income - x.spending));
    const max = Math.max(...pts, 1), min = Math.min(...pts, 0);
    const last = isCurrent() ? NOW.d : b.length;
    const W = 120, H = 28;
    const p = pts.slice(0, last).map((v, i) => `${((i / (b.length - 1)) * W).toFixed(1)},${(H - ((v - min) / (max - min || 1)) * H).toFixed(1)}`).join(" ");
    const col = kind === "in" ? "income" : kind === "out" ? "spend" : "net";
    return `<svg class="spark" viewBox="-2 -2 ${W + 4} ${H + 4}" width="${W}" height="${H}" aria-hidden="true"><polyline pathLength="1" points="${p}" fill="none" stroke="var(--color-chart-${col})" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  const numSpan = (key, v, f) => `<span class="stat-value" data-key="${key}" data-num="${v}" data-fmt="${f}">${NUMFMT[f](v)}</span>`;
  function summaryHtml() {
    const s = window.LL.summary(S.y, S.m);
    const kept = s.earned > 0 ? Math.round((s.net / s.earned) * 100) : null;
    const netSub = s.earned === 0 && s.spent === 0 ? "Nothing recorded yet"
      : kept === null ? "No income this month"
      : s.net >= 0 ? `Saved ${kept}% of income` : `${fmt.inr(-s.net)} more went out than came in`;
    const sp = (k) => (DIR.sparklines ? sparkline(k) : "");
    return `<section class="card span-all summary-card ${FX.has("page") || FX.has("month") ? "fx-draw" : ""}" aria-labelledby="sum-h">
      <h2 id="sum-h" class="sr-only">${fmt.monthLong(S.y, S.m)} summary</h2>
      <div class="summary">
        <div class="stat stat-in"><span class="stat-label">Earned</span>${numSpan("earned", s.earned, "inr")}${sp("in")}<p class="stat-sub">Income in ${fmt.monthName(S.m)}</p></div>
        <div class="stat stat-out"><span class="stat-label">Spent</span>${numSpan("spent", s.spent, "signed")}${sp("out")}<p class="stat-sub">After refunds</p></div>
        <div class="stat stat-net"><span class="stat-label">Left over</span>${numSpan("net", s.net, "net").replace('class="stat-value"', `class="stat-value ${s.net < 0 ? "neg" : ""}"`)}${sp("net")}<p class="stat-sub">${netSub}</p></div>
      </div></section>`;
  }
  function trendHtml() {
    return `<section class="card span-2 trend-card" aria-labelledby="tr-h">
      <div class="card-head"><h2 id="tr-h">Money in and out</h2>
        <div class="seg" role="group" aria-label="Group by">
          <button data-act="bucket" data-b="day" aria-pressed="${S.bucket === "day"}">${S.bucket === "day" ? thumb("seg-bucket") : ""}<span>Daily</span></button>
          <button data-act="bucket" data-b="week" aria-pressed="${S.bucket === "week"}">${S.bucket === "week" ? thumb("seg-bucket") : ""}<span>Weekly</span></button>
        </div></div>
      <div class="legend" aria-hidden="true"><span><i class="swatch in"></i>Income</span><span><i class="swatch out"></i>Spending</span></div>
      <div class="chart" id="chart" tabindex="0" aria-label="Chart of income and spending. Use left and right arrow keys to read each ${S.bucket}."></div>
      <p class="chart-detail" id="chart-detail" aria-live="polite"></p>
      <table class="sr-only" id="chart-table"></table>
    </section>`;
  }
  function catHtml(kind) {
    const rows = window.LL.byCategory(S.y, S.m, kind);
    const title = kind === "income" ? "Income by category" : "Spending by category";
    const pos = rows.filter((r) => r.total > 0);
    const sum = pos.reduce((a, r) => a + r.total, 0);
    const max = Math.max(...pos.map((r) => r.total), 1);
    const body = rows.length === 0
      ? `<p class="hint">${kind === "income" ? "No income" : "No spending"} in ${fmt.monthName(S.m)}.</p>`
      : `<ul class="cats ${kind}">${rows.map((r) => {
          const w = r.total > 0 ? Math.max(2, (r.total / max) * 100) : 0;
          const from = S.cats[kind + r.name] ?? 0;
          return `<li class="cat-row">
          <span class="cat-name">${esc(r.name)}</span>
          <span class="cat-value">${fmt.signed(r.total)}${r.total > 0 ? `<span class="pct">${Math.round((r.total / sum) * 100)}%</span>` : ""}</span>
          <span class="cat-track" aria-hidden="true"><span class="cat-fill" data-k="${kind + esc(r.name)}" data-w="${w}" style="width:${reduced() ? w : from}%"></span></span>
          ${r.total <= 0 ? `<span class="cat-note">Refunds ${r.total < 0 ? "were more than" : "cancelled out"} spending</span>` : ""}
        </li>`;
        }).join("")}</ul>`;
    return `<section class="card cat-card" aria-labelledby="c-${kind}">
      <div class="card-head"><h2 id="c-${kind}">${title}</h2><span class="scope">${fmt.monthName(S.m)}</span></div>${body}</section>`;
  }
  function recentHtml() {
    const rows = window.LL.inMonth(S.y, S.m).slice(0, 5);
    return `<section class="card recent" aria-labelledby="rc-h">
      <div class="card-head"><h2 id="rc-h">Recent</h2></div>
      ${rows.length ? `<ul class="tx-list">${rows.map((t, i) => txRow(t, i, false)).join("")}</ul>
      <button class="btn see-all" data-act="go" data-p="transactions">See all transactions</button>`
      : `<p class="hint">No transactions in ${fmt.monthName(S.m)}.</p>`}
    </section>`;
  }
  function overview() {
    const empty = window.LL.inMonth(S.y, S.m).length === 0;
    return `<div class="page-head"><h1>Overview</h1>${monthBar()}</div>
      <div class="page-body ${FX.has("month") ? "fx-list" : ""}">${empty ? emptyMonth() : `<div class="ov-grid">${summaryHtml()}${trendHtml()}${recentHtml()}${catHtml("spending")}${catHtml("income")}</div>`}</div>`;
  }
  function emptyMonth() {
    return `<div class="card empty"><h2>Nothing in ${fmt.monthLong(S.y, S.m)}</h2><p>Add a transaction or pick another month.</p><button class="btn btn-primary" data-act="add">${I.plus}Add transaction</button></div>`;
  }

  // ---------- Trend chart: SVG drawn to the container, morphing between states ----------
  let chartRaf = 0;
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  const bucketLabel = (x) => S.bucket === "day" ? fmt.dayLabel({ y: S.y, m: S.m, d: x.start })
    : x.end - x.start === 1 ? `${x.start} ${fmt.monthShort(S.m)}` : `${x.start}–${x.end - 1} ${fmt.monthShort(S.m)}`;
  function drawChart(opts = {}) {
    const el = document.getElementById("chart");
    if (!el) return;
    cancelAnimationFrame(chartRaf);
    const b = window.LL.trend(S.y, S.m, S.bucket);
    document.getElementById("chart-table").innerHTML = `<caption>Income and spending per ${S.bucket}, ${fmt.monthLong(S.y, S.m)}</caption><tr><th>${S.bucket === "day" ? "Day" : "Week"}</th><th>Income</th><th>Spending</th></tr>` +
      b.map((x) => `<tr><td>${bucketLabel(x)}</td><td>${fmt.inr(x.income)}</td><td>${fmt.signed(x.spending)}</td></tr>`).join("");
    const maxV = Math.max(0, ...b.map((x) => Math.max(x.income, x.spending)));
    const minV = Math.min(0, ...b.map((x) => x.spending));
    if (maxV === 0 && minV === 0) { el.innerHTML = `<div class="empty-chart">Nothing recorded in ${fmt.monthName(S.m)}</div>`; document.getElementById("chart-detail").textContent = ""; S.chart = null; return; }
    const step = niceStep((maxV - minV) / 4);
    const dom = { top: Math.ceil(maxV / step) * step, bot: Math.floor(minV / step) * step };
    const vals = b.map((x) => ({ i: x.income, s: x.spending }));
    if (S.sel == null || S.sel >= b.length) {
      if (isCurrent()) S.sel = b.findIndex((x) => NOW.d >= x.start && NOW.d < x.end);
      else { let mi = 0; b.forEach((x, i) => { if (x.spending > b[mi].spending) mi = i; }); S.sel = mi; }
    }
    const key = `${S.y}-${S.m}-${S.bucket}-${b.map((x) => x.income + ":" + x.spending).join(",")}`;
    const P = S.chart;
    const sameMode = P && P.mode === S.bucket && !opts.fromZero;
    const from = vals.map((_, k) => (sameMode && P.vals[k]) || { i: 0, s: 0 });
    const fromDom = sameMode ? P.dom : dom;
    const animate = !reduced() && !opts.static && (!P || P.key !== key || opts.fromZero);
    S.chart = { key, mode: S.bucket, vals, dom };
    const frame = (e) => {
      const v = vals.map((x, k) => ({ i: from[k].i + (x.i - from[k].i) * e, s: from[k].s + (x.s - from[k].s) * e }));
      const d = { top: fromDom.top + (dom.top - fromDom.top) * e, bot: fromDom.bot + (dom.bot - fromDom.bot) * e };
      paint(el, b, v, d, step);
    };
    if (!animate) frame(1);
    else {
      const t0 = performance.now(), dur = 620;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        frame(e);
        if (p < 1) chartRaf = requestAnimationFrame(tick);
      };
      frame(0); chartRaf = requestAnimationFrame(tick);
    }
    showDetail(b);
  }
  function paint(el, b, v, d, step) {
    const W = Math.max(280, el.clientWidth), H = W < 500 ? 190 : 230;
    const padL = 48, padR = 6, padT = 10, padB = 24;
    const yS = (x) => padT + ((d.top - x) / (d.top - d.bot || 1)) * (H - padT - padB);
    const band = (W - padL - padR) / b.length;
    const bw = Math.max(2, Math.min(18, band * 0.34));
    let g = `<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--color-chart-income-2)"/><rect width="2" height="5" fill="var(--color-chart-income)"/></pattern></defs>`;
    g += `<rect class="hl" x="${padL}" y="${padT}" width="${band}" height="${H - padT - padB}" rx="4" style="transform:translateX(${band * S.sel}px)"/>`;
    for (let t = Math.ceil(d.bot / step - 1e-6) * step; t <= d.top + 1e-6; t += step) {
      const y = yS(t).toFixed(1);
      g += `<line class="${Math.abs(t) < 1e-6 ? "zero" : "grid"}" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
      g += `<text x="${padL - 8}" y="${+y + 4}" text-anchor="end">${fmt.short(t)}</text>`;
    }
    const every = S.bucket === "week" ? 1 : band < 14 ? 5 : band < 24 ? 3 : 1;
    const y0 = yS(0);
    b.forEach((x, k) => {
      const cx = padL + band * k + band / 2;
      g += `<rect class="band" data-i="${k}" x="${padL + band * k}" y="${padT}" width="${band}" height="${H - padT - padB}"/>`;
      const iv = v[k].i, sv = v[k].s;
      if (iv > 0.5) g += `<rect x="${(cx - bw - 1).toFixed(1)}" y="${yS(iv).toFixed(1)}" width="${bw}" height="${(y0 - yS(iv)).toFixed(1)}" fill="url(#hatch)" stroke="var(--color-chart-income)" stroke-width="1" pointer-events="none" rx="1.5"/>`;
      if (Math.abs(sv) > 0.5) {
        const yy = Math.min(yS(sv), y0), hh = Math.abs(y0 - yS(sv));
        g += `<rect x="${(cx + 1).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw}" height="${hh.toFixed(1)}" fill="var(--color-chart-spend)" pointer-events="none" rx="1.5"/>`;
      }
      const lab = S.bucket === "day" ? (x.start === 1 || x.start % every === 0 ? String(x.start) : "") : (x.end - x.start === 1 ? `${x.start}` : `${x.start}–${x.end - 1}`);
      if (lab) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${lab}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Bar chart, ${fmt.monthLong(S.y, S.m)}" data-band="${band}">${g}</svg>`;
  }
  function showDetail(b) {
    const x = b[S.sel];
    const neg = x.spending < 0 ? `<span class="note">Refunds were more than spending</span>` : "";
    document.getElementById("chart-detail").innerHTML = `<strong>${bucketLabel(x)}</strong><span>In <span class="num">${fmt.inr(x.income)}</span></span><span>Out <span class="num">${fmt.signed(x.spending)}</span></span>${neg}`;
  }
  // Selecting a day slides the highlight instead of redrawing the chart
  function selectBucket(i) {
    const s = document.querySelector("#chart svg");
    if (!s) return;
    S.sel = i;
    s.querySelector(".hl").style.transform = `translateX(${+s.dataset.band * i}px)`;
    showDetail(window.LL.trend(S.y, S.m, S.bucket));
  }

  // ---------- Transactions ----------
  function filtered() {
    const q = S.q.trim().toLowerCase();
    return window.LL.inMonth(S.y, S.m).filter((t) =>
      (S.type === "all" || t.type === S.type) &&
      (S.cat === "all" || String(t.category.id) === S.cat) &&
      (!q || t.description.toLowerCase().includes(q) || t.category.name.toLowerCase().includes(q)));
  }
  function transactions() {
    const all = filtered();
    const rows = all.slice(0, S.shown);
    const spent = all.reduce((a, t) => a + (t.type === "DEBIT" ? +t.amount : t.type === "REFUND" ? -t.amount : 0), 0);
    const earned = all.reduce((a, t) => a + (t.type === "CREDIT" ? +t.amount : 0), 0);
    const groups = [];
    for (const t of rows) {
      const k = `${t.at.y}-${t.at.m}-${t.at.d}`;
      if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, at: t.at, items: [] });
      groups[groups.length - 1].items.push(t);
    }
    const chip = (v, l) => `<button class="chip" data-act="type" data-v="${v}" aria-pressed="${S.type === v}">${S.type === v ? thumb("chip-type") : ""}<span>${l}</span></button>`;
    const anyFilter = S.q || S.type !== "all" || S.cat !== "all";
    let n = 0;
    const list = groups.length === 0
      ? `<div class="card empty">${anyFilter ? `<h2>No matches</h2><p>Nothing in ${fmt.monthLong(S.y, S.m)} matches these filters.</p><button class="btn" data-act="clear">Clear filters</button>` : `<h2>Nothing in ${fmt.monthLong(S.y, S.m)}</h2><p>Add a transaction or pick another month.</p><button class="btn btn-primary" data-act="add">${I.plus}Add transaction</button>`}</div>`
      : groups.map((g) => {
          const dayOut = g.items.reduce((a, t) => a + (t.type === "DEBIT" ? +t.amount : t.type === "REFUND" ? -t.amount : 0), 0);
          const head = `<h2 class="day-head" style="--i:${Math.min(n, 14)}"><span>${fmt.dayLabel(g.at)}</span>${dayOut ? `<span class="num"><span class="sr-only">Day total </span>${fmt.signed(-dayOut).replace(/^₹/, "+₹")}</span>` : ""}</h2>`;
          const items = g.items.map((t) => txRow(t, n++)).join("");
          return `<section class="day" aria-label="${fmt.dayLabel(g.at)}">${head}<ul class="tx-list">${items}</ul></section>`;
        }).join("");
    const listFx = FX.has("page") || FX.has("month") || FX.has("list");
    return `<div class="page-head"><h1>Transactions</h1>${monthBar()}</div>
      <div class="toolbar">
        <div class="toolbar-row">
          <div class="input-wrap search"><label for="q" class="sr-only">Search</label>${I.search}<input id="q" class="input has-icon" type="search" placeholder="Search notes or categories" value="${esc(S.q)}" autocomplete="off"></div>
          <label for="cat" class="sr-only">Category</label>
          <select id="cat" class="select"><option value="all">All categories</option>${CATEGORIES.map((c) => `<option value="${c.id}" ${S.cat === String(c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </div>
        <div class="chips type-chips" role="group" aria-label="Type">${chip("all", "All")}${chip("DEBIT", "Expenses")}${chip("CREDIT", "Income")}${chip("REFUND", "Refunds")}</div>
      </div>
      ${all.length ? `<p class="result-line" aria-live="polite"><strong>${all.length} ${all.length === 1 ? "transaction" : "transactions"}</strong><span>In <span class="num">${fmt.inr(earned)}</span></span><span>Out <span class="num">${fmt.signed(spent)}</span></span></p>` : ""}
      <div class="page-body ${listFx ? "fx-list" : ""}">${list}</div>
      ${all.length > S.shown ? `<div class="more"><button class="btn" data-act="more">Show ${Math.min(20, all.length - S.shown)} more</button></div>` : ""}`;
  }

  // ---------- Add / edit sheet ----------
  const pad = (n) => String(n).padStart(2, "0");
  function newSheet(tx) {
    if (tx) return { mode: "edit", id: tx.id, type: tx.type, amount: tx.amount, cat: tx.category.id, date: `${tx.at.y}-${pad(tx.at.m)}-${pad(tx.at.d)}`, time: `${pad(tx.at.hh)}:${pad(tx.at.mm)}`, note: tx.description, err: {}, newCat: false };
    return { mode: "add", type: "DEBIT", amount: "", cat: 1, date: `${NOW.y}-${pad(NOW.m)}-${pad(NOW.d)}`, time: `${pad(NOW.hh)}:${pad(NOW.mm)}`, note: "", err: {}, newCat: false };
  }
  const TYPE_HINT = { DEBIT: "Money you paid out.", CREDIT: "Money you received, like salary.", REFUND: "Money back for something you bought. Lowers spending, not counted as income." };
  function sheetHtml() {
    const f = S.sheet;
    const today = `${NOW.y}-${pad(NOW.m)}-${pad(NOW.d)}`;
    const yd = new Date(Date.UTC(NOW.y, NOW.m - 1, NOW.d - 1));
    const yesterday = `${yd.getUTCFullYear()}-${pad(yd.getUTCMonth() + 1)}-${pad(yd.getUTCDate())}`;
    const seg = (v) => `<label><input type="radio" name="type" value="${v}" ${f.type === v ? "checked" : ""}><span class="${v}">${f.type === v ? thumb("seg-type") : ""}${TYPE[v].icon}${TYPE[v].word}</span></label>`;
    const cats = CATEGORIES.map((c) => `<span class="chip-radio"><input type="radio" name="cat" id="cat-${c.id}" value="${c.id}" ${f.cat === c.id ? "checked" : ""}><label class="chip" for="cat-${c.id}">${I.check}${esc(c.name)}</label></span>`).join("");
    return `<div class="overlay ${FX.has("sheet") ? "fx-in" : ""}" id="sheet-ov" data-act="close-bg">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-h">
        <div class="sheet-head" id="sheet-grab"><span class="grabber" aria-hidden="true"></span><h2 id="sh-h">${f.mode === "add" ? "New transaction" : "Edit transaction"}</h2><button class="icon-btn" data-act="close" aria-label="Close">${I.x}</button></div>
        <form id="txform" novalidate style="display:contents">
        <div class="sheet-body">
          <fieldset><legend class="legend">Type</legend><div class="typeseg">${seg("DEBIT")}${seg("CREDIT")}${seg("REFUND")}</div><p class="hint" style="margin-top:6px">${TYPE_HINT[f.type]}</p></fieldset>
          <div class="field"><label for="f-amount">Amount</label>
            <div class="input-wrap amount-wrap"><span class="prefix" aria-hidden="true">₹</span><input id="f-amount" class="input amount-input" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(f.amount)}" aria-describedby="f-amount-msg" ${f.err.amount ? 'aria-invalid="true"' : ""}></div>
            ${f.err.amount ? `<p class="error shake" id="f-amount-msg">${I.alert}${f.err.amount}</p>` : `<p class="hint" id="f-amount-msg">Up to ₹5,00,000.00</p>`}</div>
          <fieldset><legend class="legend">Category</legend><div class="chips">${cats}<button type="button" class="chip" data-act="newcat" aria-expanded="${f.newCat}">${I.plus}New</button></div>
            ${f.newCat ? `<div class="newcat fx-reveal"><label for="f-newcat" class="sr-only">New category name</label><input id="f-newcat" class="input" placeholder="Category name" maxlength="40"><button type="button" class="btn" data-act="addcat">Add</button></div>` : ""}</fieldset>
          <div class="two">
            <div class="field"><label for="f-date">Date</label><input id="f-date" class="input" type="date" min="2020-01-01" max="${today}" value="${f.date}"></div>
            <div class="field"><label for="f-time">Time</label><input id="f-time" class="input" type="time" value="${f.time}"></div>
          </div>
          <div class="chips" style="margin-top:-10px"><button type="button" class="chip" data-act="setdate" data-v="${today}" aria-pressed="${f.date === today}">Today</button><button type="button" class="chip" data-act="setdate" data-v="${yesterday}" aria-pressed="${f.date === yesterday}">Yesterday</button></div>
          <div class="field"><label for="f-note">Note <span class="hint">(optional)</span></label><input id="f-note" class="input" maxlength="255" placeholder="What was it for?" value="${esc(f.note)}"></div>
        </div>
        <div class="sheet-foot">
          ${f.mode === "edit" ? `<button type="button" class="btn btn-ghost" data-act="del" data-id="${f.id}" style="color:var(--color-danger-text)">${I.trash}Delete</button>` : ""}
          <span class="grow"></span>
          <button type="button" class="btn" data-act="close">Cancel</button>
          <button type="submit" class="btn btn-primary">${f.mode === "add" ? "Add" : "Save"}</button>
        </div></form>
      </div></div>`;
  }
  function confirmHtml() {
    const t = TX.find((x) => x.id === S.confirm);
    return `<div class="overlay ${FX.has("dialog") ? "fx-in" : ""}" id="confirm-ov" data-act="cancel-del-bg"><div class="sheet dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-d">
      <div class="sheet-body"><h2 id="cf-h" style="font-size:19px">Delete this transaction?</h2>
      <p id="cf-d" class="hint" style="font-size:14px">${esc(t.description || t.category.name)}, ${fmt.inr(+t.amount)} on ${fmt.dateShort(t.at)}. You can't undo this.</p></div>
      <div class="sheet-foot"><span class="grow"></span><button class="btn" data-act="cancel-del">Cancel</button><button class="btn btn-danger" data-act="do-del">Delete</button></div></div></div>`;
  }
  function saveSheet() {
    const f = S.sheet;
    const raw = document.getElementById("f-amount").value.replace(/,/g, "").trim();
    f.amount = raw; f.note = document.getElementById("f-note").value; f.date = document.getElementById("f-date").value; f.time = document.getElementById("f-time").value;
    f.err = {};
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || +raw <= 0) f.err.amount = "Enter an amount, like 450 or 450.50";
    else if (+raw > 500000) f.err.amount = "The most you can add is ₹5,00,000.00";
    if (f.err.amount) { render(); document.getElementById("f-amount").focus(); return; }
    const [y, m, d] = f.date.split("-").map(Number), [hh, mm] = f.time.split(":").map(Number);
    const cat = CATEGORIES.find((c) => c.id === +f.cat);
    const data = { type: f.type, amount: (+raw).toFixed(2), category: cat, description: f.note.trim(), at: { y, m, d, hh, mm } };
    let id = f.id;
    if (f.mode === "add") { id = window.LL.nextId(); TX.unshift({ id, ...data }); }
    else Object.assign(TX.find((t) => t.id === f.id), data);
    const k = (a) => a.y * 1e8 + a.m * 1e6 + a.d * 1e4 + a.hh * 100 + a.mm;
    TX.sort((a, b) => k(b.at) - k(a.at));
    closeOverlay("sheet-ov", () => {
      S.sheet = null;
      if (y !== S.y || m !== S.m) { S.monthDir = y * 12 + m > S.y * 12 + S.m ? 1 : -1; S.fx.add("month"); }
      S.y = y; S.m = m; S.sel = null; S.flashId = id;
      toast(f.mode === "add" ? "Added" : "Saved");
      setTimeout(() => { S.flashId = null; }, 1800);
    });
  }

  // ---------- Leaving animations: play the exit, then change state ----------
  function closeOverlay(id, after) {
    const el = document.getElementById(id);
    if (!el || reduced()) return after();
    el.classList.remove("fx-in");
    el.classList.add("fx-out");
    setTimeout(after, 200);
  }
  function closeSheet() { closeOverlay("sheet-ov", () => { S.sheet = null; render(); lastFocus?.isConnected && lastFocus.focus(); }); }
  function closePopovers() {
    const el = document.querySelector(".menu, .month-pop");
    if (!el || reduced()) { S.menu = false; S.picker = null; render(); return; }
    el.classList.add("fx-out");
    setTimeout(() => { S.menu = false; S.picker = null; render(); }, 120);
  }
  let toastTimer;
  function toast(msg) {
    S.toast = msg; S.fx.add("toast"); render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      const el = document.querySelector(".toast");
      const done = () => { S.toast = ""; render(); };
      if (el && !reduced()) { el.classList.add("fx-out"); setTimeout(done, 200); } else done();
    }, 2200);
  }
  function deleteTx(id) {
    const rows = [...document.querySelectorAll(`.tx[data-id="${id}"]`)];
    const finish = () => {
      const i = TX.findIndex((x) => x.id === id);
      if (i >= 0) TX.splice(i, 1);
      S.confirm = null; S.sheet = null; S.chart && (S.chart.key = "");
      toast("Deleted");
    };
    if (reduced()) return finish();
    closeOverlay("confirm-ov", () => {});
    if (S.sheet) closeOverlay("sheet-ov", () => {});
    // Fold the row away so the list closes the gap instead of jumping
    rows.forEach((r) => {
      const h = r.offsetHeight;
      r.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 260, easing: EASE, fill: "forwards" });
    });
    setTimeout(finish, 270);
  }

  // ---------- Login ----------
  function login() {
    const up = S.auth === "signup";
    const pw = S.pw;
    const rule = (ok, txt) => `<li class="${ok ? "ok" : ""}">${ok ? I.ok : I.dot}${txt}<span class="sr-only">${ok ? ", done" : ", not yet"}</span></li>`;
    return `<div class="auth ${FX.has("page") ? "fx-page" : ""}">
      <aside class="auth-side" aria-hidden="true">${DIR.loginArt ? DIR.loginArt() : ""}</aside>
      <main class="auth-main"><div class="auth-card page-anim">
        <span class="brand">${DIR.mark}LedgerLines</span>
        <div><h1>${up ? "Create your account" : "Welcome back"}</h1><p class="lede">${up ? "Track what comes in and what goes out." : "Sign in to see your month."}</p></div>
        ${S.authError ? `<div class="alert shake" role="alert">${I.alert}<span>Email or password is wrong. Check both and try again.</span></div>` : ""}
        <form id="authform" class="auth-card" style="gap:16px" novalidate>
          <div class="field"><label for="a-email">Email</label><input id="a-email" class="input" type="email" autocomplete="email" value="${EMAIL}"></div>
          <div class="field"><label for="a-pw">Password</label>
            <div class="input-wrap"><input id="a-pw" class="input" type="password" autocomplete="${up ? "new-password" : "current-password"}" value="${esc(pw)}" style="padding-right:72px" ${up ? 'aria-describedby="a-rules"' : ""}><span class="suffix"><button type="button" class="btn btn-ghost" data-act="showpw" style="min-height:36px;padding:0 10px" aria-pressed="false">Show</button></span></div>
            ${up ? `<ul class="rules" id="a-rules">${rule(pw.length >= 8 && pw.length <= 20, "8 to 20 characters")}${rule(/[A-Z]/.test(pw), "One capital letter")}${rule(/\d/.test(pw), "One number")}${rule(/[^A-Za-z0-9]/.test(pw), "One symbol, like ! or @")}</ul>` : ""}
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">${up ? "Create account" : "Sign in"}</button>
        </form>
        <p class="auth-switch">${up ? "Have an account?" : "New here?"} <button class="linkbtn" data-act="authmode">${up ? "Sign in" : "Create an account"}</button></p>
        ${up ? "" : `<p class="auth-switch"><button class="linkbtn" data-act="autherr" style="font-weight:500">Preview the error state</button></p>`}
      </div></main></div>`;
  }

  // ---------- Shell ----------
  function shell(content) {
    const ind = (k) => `<i class="ind" data-flip="${k}" aria-hidden="true"></i>`;
    const tab = (p, l, ic) => `<a class="tab" href="#${p}" data-act="go" data-p="${p}" ${S.page === p ? 'aria-current="page"' : ""}>${S.page === p ? ind("tab") : ""}${ic}<span>${l}</span></a>`;
    const nav = (p, l, ic, k) => { const cur = S.page === p; return `<li><a class="navitem" href="#${p}" data-act="go" data-p="${p}" ${cur ? 'aria-current="page"' : ""}>${cur && k === "side" ? ind(k) : ""}<span class="nav-icon">${cur && k === "bn" ? ind(k) : ""}${ic}</span><span>${l}</span></a></li>`; };
    const menu = S.menu ? `<div class="menu ${FX.has("menu") ? "fx-in" : ""}" role="menu"><div class="who">Signed in as<strong>${EMAIL}</strong></div>
      <button role="menuitemcheckbox" aria-checked="${currentDark()}" data-act="theme">${I.moon}Dark mode<span class="switch" aria-hidden="true"><i></i></span></button>
      <button role="menuitem" data-act="logout">${I.logout}Log out</button></div>` : "";
    const account = `<div class="account"><button class="icon-btn" data-act="menu" aria-haspopup="menu" aria-expanded="${S.menu}" aria-label="Account"><span class="avatar" aria-hidden="true">Y</span></button>${menu}</div>`;
    const side = DIR.nav === "sidebar" ? `<aside class="sidebar"><a class="brand" href="#overview" data-act="go" data-p="overview">${DIR.mark}LedgerLines</a>
      <button class="btn btn-primary side-add" data-act="add">${I.plus}Add transaction</button>
      <nav aria-label="Main"><ul class="side-nav">${nav("overview", "Overview", I.overview, "side")}${nav("transactions", "Transactions", I.list, "side")}</ul></nav>
      <div class="side-foot">${account}<span class="side-email">${EMAIL}</span></div></aside>` : "";
    return `<div class="app">${side}<div class="app-col">
      <header class="topbar"><div class="wrap">
        <a class="brand" href="#overview" data-act="go" data-p="overview">${DIR.mark}<span>LedgerLines</span></a>
        <nav class="tabs" aria-label="Main">${tab("overview", "Overview", I.overview)}${tab("transactions", "Transactions", I.list)}</nav>
        <span class="spacer"></span>
        <button class="btn btn-primary add-top" data-act="add">${I.plus}Add</button>
        ${account}
      </div></header>
      <main id="main" class="${FX.has("page") ? "fx-page" : ""}"><div class="wrap page-anim">${content}</div></main>
      <nav class="bottomnav" aria-label="Main"><ul>${nav("overview", "Overview", I.overview, "bn")}<li><button class="fab" data-act="add" aria-label="Add transaction">${I.plus}</button></li>${nav("transactions", "Transactions", I.list, "bn")}</ul></nav>
      </div></div>
      ${S.sheet ? sheetHtml() : ""}${S.confirm ? confirmHtml() : ""}
      ${S.toast ? `<div class="toast ${FX.has("toast") ? "fx-in" : ""}" role="status">${I.ok}${S.toast}</div>` : ""}`;
  }

  // ---------- Render with motion ----------
  function snapFlip() {
    const m = {};
    document.querySelectorAll("[data-flip]").forEach((el) => { m[el.dataset.flip] = el.getBoundingClientRect(); });
    return m;
  }
  function playFlip(prev) {
    document.querySelectorAll("[data-flip]").forEach((el) => {
      const a = prev[el.dataset.flip];
      if (!a) return;
      const b = el.getBoundingClientRect();
      if (!b.width) return;
      const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(a.width - b.width) < 0.5) return;
      el.animate([
        { transform: `translate(${dx}px, ${dy}px)`, width: a.width + "px", height: a.height + "px" },
        { transform: "translate(0, 0)", width: b.width + "px", height: b.height + "px" },
      ], { duration: 340, easing: EASE });
    });
  }
  function countNumbers() {
    document.querySelectorAll("[data-num]").forEach((el) => {
      const k = el.dataset.key, to = +el.dataset.num, from = S.nums[k];
      S.nums[k] = to;
      if (reduced() || from == null || Math.abs(from - to) < 0.005) return;
      const f = NUMFMT[el.dataset.fmt], t0 = performance.now(), dur = 650;
      const step = (t) => {
        if (!el.isConnected) return;
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.innerHTML = p < 1 ? f(Math.round(from + (to - from) * e)) : f(to);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function growCats() {
    const fills = [...document.querySelectorAll(".cat-fill")];
    const set = () => fills.forEach((el) => { el.style.width = el.dataset.w + "%"; S.cats[el.dataset.k] = +el.dataset.w; });
    if (reduced()) set(); else requestAnimationFrame(() => requestAnimationFrame(set));
  }

  let lastFocus = null;
  function render() {
    const prev = reduced() ? null : snapFlip();
    FX = S.fx; S.fx = new Set();
    const active = document.activeElement && document.activeElement.id;
    const caret = active === "q" ? document.activeElement.selectionStart : null;
    root.innerHTML = S.page === "login" ? login() : shell(S.page === "transactions" ? transactions() : overview());
    document.body.style.overflow = S.sheet || S.confirm ? "hidden" : "";
    drawChart({ fromZero: FX.has("page") });
    countNumbers();
    growCats();
    if (prev) playFlip(prev);
    if (active) {
      const el = document.getElementById(active);
      if (el) { el.focus({ preventScroll: true }); if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret); }
    }
  }

  // ---------- Events ----------
  function setMonth(y, m) {
    S.monthDir = Math.sign(y * 12 + m - (S.y * 12 + S.m));
    S.y = y; S.m = m; S.sel = null; S.shown = 20; S.picker = null; S.fx.add("month");
    render();
  }
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) { if (S.menu || S.picker) closePopovers(); return; }
    const a = t.dataset.act;
    if ((a === "close-bg" || a === "cancel-del-bg") && e.target !== t) return;
    if (t.tagName === "A") e.preventDefault();
    switch (a) {
      case "go": go(t.dataset.p); break;
      case "prev": { const d = new Date(Date.UTC(S.y, S.m - 2, 1)); setMonth(d.getUTCFullYear(), d.getUTCMonth() + 1); break; }
      case "next": { const d = new Date(Date.UTC(S.y, S.m, 1)); setMonth(d.getUTCFullYear(), d.getUTCMonth() + 1); break; }
      case "now": setMonth(NOW.y, NOW.m); break;
      case "picker": if (S.picker) closePopovers(); else { S.picker = { y: S.y }; S.menu = false; S.fx.add("picker"); render(); } break;
      case "pyr": S.picker.y--; render(); break;
      case "nyr": S.picker.y++; render(); break;
      case "pick": setMonth(+t.dataset.y, +t.dataset.m); document.querySelector(".month-label")?.focus(); break;
      case "bucket": if (S.bucket !== t.dataset.b) { S.bucket = t.dataset.b; S.sel = null; render(); } break;
      case "type": if (S.type !== t.dataset.v) { S.type = t.dataset.v; S.shown = 20; S.fx.add("list"); render(); } break;
      case "clear": S.q = ""; S.type = "all"; S.cat = "all"; S.fx.add("list"); render(); break;
      case "more": S.shown += 20; render(); break;
      case "menu": if (S.menu) closePopovers(); else { S.menu = true; S.picker = null; S.fx.add("menu"); render(); } break;
      case "theme": toggleTheme(); break;
      case "logout": S.menu = false; S.pw = ""; S.authError = false; go("login"); break;
      case "add": lastFocus = t; S.sheet = newSheet(); S.fx.add("sheet"); render(); focusSheet(); break;
      case "edit": lastFocus = t; S.sheet = newSheet(TX.find((x) => x.id === +t.dataset.id)); S.fx.add("sheet"); render(); focusSheet(); break;
      case "close": case "close-bg": closeSheet(); break;
      case "del": syncSheet(); S.confirm = +t.dataset.id; S.fx.add("dialog"); render(); document.querySelector('[data-act="cancel-del"]')?.focus(); break;
      case "cancel-del": case "cancel-del-bg": closeOverlay("confirm-ov", () => { S.confirm = null; render(); }); break;
      case "do-del": deleteTx(S.confirm); break;
      case "newcat": syncSheet(); S.sheet.newCat = !S.sheet.newCat; render(); document.getElementById("f-newcat")?.focus(); break;
      case "addcat": { const v = document.getElementById("f-newcat").value.trim(); if (!v) break; syncSheet(); const c = { id: 100 + CATEGORIES.length, name: v, system: false }; CATEGORIES.push(c); S.sheet.cat = c.id; S.sheet.newCat = false; render(); break; }
      case "setdate": syncSheet(); S.sheet.date = t.dataset.v; render(); break;
      case "authmode": S.auth = S.auth === "signup" ? "signin" : "signup"; S.authError = false; S.fx.add("page"); history.replaceState(null, "", "#" + (S.auth === "signup" ? "signup" : "login") + themeSuffix()); render(); break;
      case "autherr": S.authError = true; render(); break;
      case "showpw": { const i = document.getElementById("a-pw"); const show = i.type === "password"; i.type = show ? "text" : "password"; t.textContent = show ? "Hide" : "Show"; t.setAttribute("aria-pressed", show); break; }
    }
  });
  function focusSheet() {
    // Focus after the sheet has started rising, so the phone keyboard doesn't fight the animation
    setTimeout(() => document.getElementById("f-amount")?.focus({ preventScroll: true }), reduced() ? 0 : 260);
  }
  function syncSheet() {
    const f = S.sheet; if (!f) return;
    const v = (id) => document.getElementById(id)?.value;
    f.amount = v("f-amount") ?? f.amount; f.note = v("f-note") ?? f.note; f.date = v("f-date") ?? f.date; f.time = v("f-time") ?? f.time;
  }
  root.addEventListener("change", (e) => {
    if (e.target.name === "type") { syncSheet(); S.sheet.type = e.target.value; render(); }
    else if (e.target.name === "cat") { S.sheet.cat = +e.target.value; }
    else if (e.target.id === "cat") { S.cat = e.target.value; S.shown = 20; S.fx.add("list"); render(); }
  });
  root.addEventListener("input", (e) => {
    if (e.target.id === "q") { S.q = e.target.value; S.shown = 20; render(); }
    if (e.target.id === "a-pw" && S.auth === "signup") { S.pw = e.target.value; const c = e.target.selectionStart; render(); const el = document.getElementById("a-pw"); el.focus(); el.setSelectionRange(c, c); }
  });
  root.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "txform") saveSheet();
    if (e.target.id === "authform") { S.authError = false; go("overview"); }
  });
  root.addEventListener("click", (e) => {
    const r = e.target.closest(".chart .band");
    if (r) selectBucket(+r.dataset.i);
  });

  // Swipe the phone sheet down to close it
  let drag = null;
  root.addEventListener("pointerdown", (e) => {
    const head = e.target.closest("#sheet-grab");
    if (!head || e.target.closest("button") || innerWidth >= 768) return;
    const sheet = head.closest(".sheet");
    drag = { y: e.clientY, sheet, dy: 0, t: performance.now() };
    sheet.style.transition = "none";
    head.setPointerCapture(e.pointerId);
  });
  root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    drag.sheet.style.transform = `translateY(${drag.dy}px)`;
  });
  const endDrag = () => {
    if (!drag) return;
    const { sheet, dy, t } = drag; drag = null;
    const fast = dy / (performance.now() - t) > 0.6;
    sheet.style.transition = `transform .28s ${EASE}`;
    if (dy > 120 || (fast && dy > 30)) { sheet.style.transform = "translateY(100%)"; setTimeout(() => { S.sheet = null; render(); }, 260); }
    else sheet.style.transform = "";
  };
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (S.confirm) closeOverlay("confirm-ov", () => { S.confirm = null; render(); });
      else if (S.sheet) closeSheet();
      else if (S.menu || S.picker) closePopovers();
    }
    if (document.activeElement?.id === "chart" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const n = window.LL.trend(S.y, S.m, S.bucket).length;
      selectBucket(Math.max(0, Math.min(n - 1, (S.sel ?? 0) + (e.key === "ArrowRight" ? 1 : -1))));
    }
    if (e.key === "Tab" && (S.sheet || S.confirm)) {
      const box = document.querySelector(S.confirm ? ".dialog" : ".sheet");
      const f = [...box.querySelectorAll("button, input, select, [tabindex]")].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => drawChart({ static: true }), 80); });
  addEventListener("hashchange", () => { readHash(); render(); });

  readHash();
  render();
})();

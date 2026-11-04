# LedgerLines frontend build plan

Direction: **Roznamcha with the neem green accent**. Dark first, light mode is ruled paper.
Reference: `design/mockups/roznamcha.html#overview-dark-neem` (open `design/mockups/index.html` for every screen and width).
Tokens: `frontend/src/index.css` (`@theme static`). Use the token utilities (`bg-surface`, `text-muted`, `border-field`, `font-serif`, `rounded-card`, `animate-sheet-up`) instead of Tailwind's slate and blue, and instead of `dark:` variants. The tokens already switch with the theme.

Each step below is one pull request. The app keeps working after every step.

## Before step 1: decisions and backend changes

**Backend changes the design needs:**

| Change | Why | Status |
|---|---|---|
| `GET /transactions/summary?year=&month=` | It only returned the current IST month, so the month picker couldn't show past months | Done |
| `GET /analytics/spending-by-category?year=&month=` and `/income-by-category?year=&month=` | They were all-time, so the category bars would disagree with every other number on the page. No parameters still means all-time. For one month, spending keeps negative categories, so the bars add up to the summary's Spent | Done |
| Later: `GET /transactions?year=&month=&limit=&offset=` | The list loads every row. Fine for one person for now; filters and paging run in the browser | Not needed yet |

All three endpoints share the month rules in `backend/app/services/period.py`: pass both `year` and `month` or neither, 2020 onward, and no future months (422 otherwise).

**Fonts:** Newsreader (serif), IBM Plex Sans and IBM Plex Mono. Two ways to load them:
- **Recommended:** `@fontsource-variable/newsreader`, `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` from npm. They're self-hosted, so there are no third-party requests and nothing to change in the CSP later. Import only the weights used: serif 600, sans 400/500/600/700, mono 400/500.
- Or a Google Fonts `<link>` in `frontend/index.html`. No new npm packages, but it adds a request to Google on every page load.

## Step 1: Foundations (no visible change)

- Load the fonts, using the option you choose above.
- `frontend/index.html`: add a tiny inline script in `<head>` that reads `localStorage.ll_theme` (`"light"`, `"dark"`, or nothing for system) and sets `data-theme` on `<html>` before React renders, so the page doesn't flash the wrong theme. Use `lang="en-IN"`. Set `<meta name="theme-color">` for both schemes.
- Replace `public/favicon.svg` with the daybook mark (the book with a red margin rule).
- Delete Vite leftovers: `src/assets/react.svg`, `src/assets/vite.svg`, `src/assets/hero.png`, `public/icons.svg` (none are referenced) and `src/App.css` (it only holds a comment; remove its import from `App.jsx`).
- `src/format.js`: add helpers, all in IST (`timeZone: "Asia/Kolkata"`):
  - `formatSigned(value)` returns `−₹1,780.00` (with a true minus sign).
  - `formatShort(value)` returns `₹1L`, `₹25K` for chart axes.
  - `dayLabel(iso)` returns `Today`, `Yesterday`, then `Sun, 1 Nov`, plus the year when it isn't the current year.
  - `timeLabel(iso)` returns `9:00 pm`.
  - `monthLabel(year, month)` returns `October 2026`.
  - `istParts(iso)` returns `{ y, m, d }` for grouping by IST day.

## Step 2: App shell, navigation and month picker

- `App.jsx`: hold `page` (`"overview"` or `"transactions"`) and `period` (`{ year, month }`, starting at the current IST month). Use a hash (`#overview`, `#transactions`) so refresh and the back button work. Still no router.
- `index.css` body rule: switch to `background: var(--color-canvas); color: var(--color-ink); font-family: var(--font-sans)`. This is the point where the app turns dark, so do it in this step.
- New `components/Shell.jsx`:
  - **Phone (under 768px):** top bar with the brand and the account button. Fixed bottom bar with Overview, a raised **+** button for Add, and Transactions. Leave room for Splits as a fourth item later.
  - **Tablet (768 to 1023px):** top bar with tabs, an Add button and the account button.
  - **Desktop (1024px and up):** sidebar with the brand, an "Add transaction" button, the nav and the account at the bottom. It has a 3px brand-coloured binding edge.
  - **Indicators:** the tab underline, sidebar highlight and bottom-bar pill are one element each that moves with a `transform` transition. Unlike the mockup, React keeps these elements between renders, so plain CSS transitions are enough. No animation library needed.
- New `components/AccountMenu.jsx`: shows the signed-in email, a Dark mode switch (writes `ll_theme` and sets `data-theme`), and Log out (the existing `onLogout`). It closes on Esc and on a click outside. On desktop it opens upward from the sidebar.
- New `components/MonthPicker.jsx`: previous button, the month label, next button (disabled on the current month), and a "This month" link when you're on a past month. Clicking the label opens a year and month grid. Months before Jan 2020 and after the current month are disabled. Every control is at least 44px.
- Make the Add button work from anywhere. The form itself is restyled in step 5.

## Step 3: Overview

Replaces `MonthlySummary.jsx`, `CategoryBreakdown.jsx` and today's dashboard part of `TransactionList.jsx`. Everything on this page follows `period`.

- **`SummaryStrip.jsx`:**
  - Shows Earned, Spent ("After refunds") and Left over, with a + or − sign.
  - Left over comes first on phones. It's in serif in the brand colour, with the double rule under it (`border-bottom: 4px double`). It turns `danger-text` when negative.
  - The line under it reads "Saved 56% of income", or "₹X more went out than came in" when negative.
  - Each total has a sparkline: the month's running total from the daily trend, drawn with `animate-draw` on `pathLength="1"`.
  - Totals count from the old value to the new one when the month changes (`useCountUp`, about 20 lines of `requestAnimationFrame`; skipped under reduced motion). Paise are shown at 0.62em.
- **`TrendChart.jsx`** (keep Recharts, restyle it):
  - Daily and Weekly is a segmented control with a sliding thumb.
  - Income bars are hatched with an SVG `<pattern>` in `chart-income` / `chart-income-2`. Spending bars are solid `chart-spend`.
  - **Fix for the −30K line:** `YAxis domain={[(min) => Math.min(0, min), "auto"]}`, with nice ticks and `formatShort` labels. The axis only goes below zero when a bucket really is negative.
  - Tapping or clicking a bucket selects it, and a line under the chart reads "Fri, 16 Oct · In ₹0.00 · Out −₹3,009.00". This replaces the hover-only tooltip, so it works on phones. Arrow keys move the selection.
  - Add a visually hidden `<table>` with the same numbers for screen readers.
- **`RecentList.jsx`:** the last 5 rows of the month (reusing `TxRow` from step 4) and a "See all transactions" button.
- **`CategoryBars.jsx`:** plain HTML bars instead of the Recharts bar chart. Amount and percentage are always visible, not on hover. Bar widths animate. A category whose refunds equal or beat its spending reads "Refunds cancelled out spending" or "Refunds were more than spending". There's one block for spending and one for income, each labelled with the month.
- **Layout:** 1 column on phone, 2 at 768px, and a 6-column grid at 1100px (summary across the top, trend 4 columns plus recent 2, then the two category blocks at 3 each).
- **Empty month:** "Nothing in July 2026" and an Add button.

## Step 4: Transactions

Replaces the table in `TransactionList.jsx`.

- **`TransactionsPage.jsx`:**
  - Month picker at the top.
  - Toolbar: search (notes and categories), a category select, and type chips (All, Expenses, Income, Refunds) with a sliding selected pill.
  - Result line: "32 transactions · In ₹… · Out ₹…".
  - Filtering is in the browser over the month's rows. Show 20 rows at a time, then "Show 20 more".
- **Day groups:** a serif heading ("Today", "Yesterday", "Sat, 31 Oct") and the day's total. Each day's list has the red double margin rule (`border-left: 3px double var(--color-margin)`).
- **`TxRow.jsx`** (shared with Recent):
  - Shows the category icon (Food, Rent, Travel, Utilities, Other, plus Salary, Freelance and Shopping if those exist; other user categories get their first letter).
  - Title is the note, or the category name when there is no note. The line under it shows the category and time.
  - The amount is in mono with a + or − sign. Refunds get a "Refund" tag.
  - No ids anywhere. Screen readers get the type word ("Expense ₹1,450.00").
  - The whole row opens Edit. On desktop the extra columns are category and time, with Edit and Delete icon buttons. On phone, Delete lives inside the edit sheet.
- **Delete:** a confirm dialog ("Delete this transaction? Dinner out, ₹1,450.00 on 31 Oct. You can't undo this."). Then the row folds away (height to 0, 260ms) and a "Deleted" toast shows.
- **After saving:** the list moves to the saved row's month if it's different, the row flashes once (`animate-flash`) and an "Added" or "Saved" toast shows.
- **Motion:** rows fade in, staggered (22ms each, capped at 14 rows), when the page, month or filter changes. Never on typing in search.
- **Empty states:** "No matches" with a Clear filters button, and "Nothing in October 2026" with an Add button.

## Step 5: Add and edit form

Restyles `TransactionForm.jsx`. Same API calls.

- **Container:**
  - Phone: a bottom sheet that rises with `animate-sheet-up`, has a grab handle and closes on a swipe down (over 120px, or a quick flick).
  - Desktop: a centred dialog with `animate-pop-in`.
  - Both have a dimmed backdrop, and closing plays the exit animation first.
  - Focus moves to Amount after the sheet rises, stays trapped inside while it's open, and returns to the button that opened it. Esc closes it.
- **Fields:**
  - **Type:** a three-option radio group (Expense, Income, Refund) with icons and a sliding thumb. A hint under it changes with the type, for example "Money back for something you bought. Lowers spending, not counted as income."
  - **Amount:** large mono input with a ₹ prefix and `inputmode="decimal"`. The hint reads "Up to ₹5,00,000.00". Errors are inline with `aria-invalid` and a small shake, for example "Enter an amount, like 450 or 450.50" or "The most you can add is ₹5,00,000.00".
  - **Category:** chips as a radio group, plus a "New" chip that reveals a name input (the existing `createCategory`).
  - **Date and time:** separate inputs, with Today and Yesterday chips. The date range is 2020-01-01 to today.
  - **Note:** optional.
- **Footer:** Delete (edit only), Cancel, and Add or Save. On phones it sticks to the bottom.
- **Open point, IST dates:** the form currently converts the browser's local time with `toISOString()`. That's correct for a browser set to IST, but a browser in another timezone would file entries under the wrong IST day. Sending the time with `+05:30` fixes it. It's a one-line change, so say if you want it here.

## Step 6: Login and sign up

Restyles `Auth.jsx`. The auth flow and `api.js` stay as they are.

- At 900px and up, the left half shows the daybook page (Date, Particulars, ₹, with "Left over" double-ruled). On phone it's just the card.
- Fields: email, and password with a Show/Hide button.
- Sign up shows a live checklist of the backend's password rules (8 to 20 characters, one capital letter, one number, one symbol), each ticking as it's met. Checklist items are announced to screen readers.
- Errors show in a `danger-soft` alert. The 429 message from `api.js` shows as is.

## Step 7: Checks before calling it done

- 390px: no horizontal scroll on any screen, and every tap target is 44px or more.
- Keyboard: every control can be reached, the focus ring is visible, dialogs trap focus and Esc closes them.
- Turn on reduced motion and check that nothing moves.
- Both themes: spot-check the contrast pairs listed at the top of `index.css`.
- `npm run lint` and `npm run build` pass.

## Later

- **Splits (Phase 3):** a third nav item in the sidebar and the bottom bar. The bottom bar becomes Overview, Transactions, +, Splits.
- **Settings:** categories, including the 409 when deleting one in use ("This category still has transactions. Move or delete them first.").

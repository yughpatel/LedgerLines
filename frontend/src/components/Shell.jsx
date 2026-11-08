import { useRef } from "react";
import { useActiveRect } from "../hooks";
import AccountMenu from "./AccountMenu";
import { BrandMark, ListIcon, OverviewIcon, PlusIcon } from "./icons";

const NAV = [
  { key: "overview", label: "Overview", Icon: OverviewIcon },
  { key: "transactions", label: "Transactions", Icon: ListIcon },
];

function Brand({ onClick }) {
  return (
    <a
      href="#overview" onClick={(e) => { e.preventDefault(); onClick(); }}
      className="flex items-center gap-2.5 font-serif text-[19px] font-semibold text-ink"
    >
      <BrandMark />
      LedgerLines
    </a>
  );
}

// One sliding highlight behind the active nav item. It's a single element that moves,
// so changing page glides it across instead of blinking it from one item to another
function Indicator({ rect, className, vertical = false }) {
  if (!rect) return null;
  const style = vertical
    ? { transform: `translateY(${rect.top}px)`, height: rect.height, width: rect.width }
    : { transform: `translateX(${rect.left}px)`, width: rect.width };
  return <span aria-hidden="true" style={style} className={`absolute left-0 transition-[transform,width,height] duration-300 ease-soft ${className}`} />;
}

// Phone: top bar + bottom bar with a raised Add button. 768px+: top bar with tabs.
// 1024px+: sidebar with a binding edge in the brand colour. Splits joins NAV later
export default function Shell({ page, onNavigate, onAdd, account, children }) {
  const tabsRef = useRef(null);
  const sideRef = useRef(null);
  const bottomRef = useRef(null);
  const tabRect = useActiveRect(tabsRef, page);
  const sideRect = useActiveRect(sideRef, page);
  const bottomRect = useActiveRect(bottomRef, page);

  const navLink = (item, className, iconWrap) => (
    <a
      key={item.key} data-key={item.key} href={`#${item.key}`}
      aria-current={page === item.key ? "page" : undefined}
      onClick={(e) => { e.preventDefault(); onNavigate(item.key); }}
      className={className}
    >
      {iconWrap ? iconWrap(<item.Icon />) : <item.Icon />}
      <span>{item.label}</span>
    </a>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 border-l-[3px] border-r border-l-brand border-r-line bg-surface px-3.5 py-5 lg:flex">
        <div className="px-1.5"><Brand onClick={() => onNavigate("overview")} /></div>
        <button
          type="button" onClick={onAdd}
          className="flex h-11 items-center justify-center gap-2 rounded-control bg-brand font-semibold text-on-brand transition-[background-color,transform] hover:bg-brand-hover active:scale-[0.98]"
        >
          <PlusIcon /> Add transaction
        </button>
        <nav aria-label="Main">
          <div ref={sideRef} className="relative isolate grid gap-0.5">
            <Indicator rect={sideRect} vertical className="-z-10 rounded-control bg-surface-2 shadow-[inset_3px_0_0_var(--color-brand)]" />
            {NAV.map((item) => navLink(
              item,
              `flex h-11 items-center gap-2.5 rounded-control px-3 font-semibold transition-colors ${
                page === item.key ? "text-ink" : "text-muted hover:text-ink"
              }`,
            ))}
          </div>
        </nav>
        <div className="mt-auto border-t border-line pt-3">
          <AccountMenu {...account} up showEmail />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-t-[3px] border-b-line border-t-brand bg-topbar lg:hidden">
          <div className="mx-auto flex min-h-15 max-w-6xl items-center gap-4 px-4 sm:px-6">
            <Brand onClick={() => onNavigate("overview")} />
            <nav aria-label="Main" className="hidden md:block">
              <div ref={tabsRef} className="relative flex">
                {NAV.map((item) => navLink(
                  item,
                  `flex h-[57px] items-center gap-2 px-3.5 font-semibold transition-colors ${
                    page === item.key ? "text-ink" : "text-muted hover:text-ink"
                  }`,
                ))}
                <Indicator rect={tabRect} className="bottom-0 h-0.5 bg-brand" />
              </div>
            </nav>
            <span className="flex-1" />
            <button
              type="button" onClick={onAdd}
              className="hidden h-11 items-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-on-brand transition-[background-color,transform] hover:bg-brand-hover active:scale-[0.98] md:flex"
            >
              <PlusIcon /> Add
            </button>
            <AccountMenu {...account} />
          </div>
        </header>

        <main className="flex-1 pb-28 pt-5 md:pb-12 md:pt-7">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
        </main>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-topbar pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center">
            <div ref={bottomRef} className="relative isolate col-span-3 grid grid-cols-[1fr_auto_1fr] items-center">
              {navLink(
                NAV[0],
                `flex min-h-15 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${page === "overview" ? "text-brand-ink" : "text-muted"}`,
                (icon) => <span className="grid h-7.5 w-14 place-items-center">{icon}</span>,
              )}
              <button
                type="button" onClick={onAdd} aria-label="Add transaction"
                className="mx-4 grid size-14 place-items-center rounded-fab bg-brand text-on-brand shadow-fab transition-transform active:scale-90"
              >
                <PlusIcon size={26} />
              </button>
              {navLink(
                NAV[1],
                `flex min-h-15 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${page === "transactions" ? "text-brand-ink" : "text-muted"}`,
                (icon) => <span className="grid h-7.5 w-14 place-items-center">{icon}</span>,
              )}
              {bottomRect && (
                <span
                  aria-hidden="true"
                  style={{ transform: `translateX(${bottomRect.left + bottomRect.width / 2 - 28}px)` }}
                  className="pointer-events-none absolute left-0 top-[7px] -z-10 h-7.5 w-14 rounded-full bg-brand-soft transition-transform duration-300 ease-soft"
                />
              )}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

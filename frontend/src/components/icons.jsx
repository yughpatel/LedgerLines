// Small stroke icons. Decorative unless a label is passed: every interactive use
// already has visible text or an aria-label on its button.
function Icon({ children, size = 20, strokeWidth = 2, className = "", label }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = (p) => <Icon {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>;
export const ListIcon = (p) => <Icon {...p}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></Icon>;
export const PlusIcon = (p) => <Icon strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const SearchIcon = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
export const ChevronLeft = (p) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>;
export const ChevronRight = (p) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
export const ChevronDown = (p) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const CloseIcon = (p) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const EditIcon = (p) => <Icon {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>;
export const TrashIcon = (p) => <Icon {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Icon>;
export const MoonIcon = (p) => <Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Icon>;
export const LogoutIcon = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Icon>;
export const CheckIcon = (p) => <Icon strokeWidth={2.4} {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
export const DotIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /></Icon>;
export const AlertIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Icon>;
export const InIcon = (p) => <Icon {...p}><path d="M17 7 7 17" /><path d="M15 17H7V9" /></Icon>;
export const OutIcon = (p) => <Icon {...p}><path d="M7 17 17 7" /><path d="M9 7h8v8" /></Icon>;
export const RefundIcon = (p) => <Icon {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>;

// Category icons, so rows read like a bank statement. Unknown (user-made) categories
// fall back to their first letter
const CATEGORY_PATHS = {
  food: <><path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M9 7.5c0-1 1-1.4 1-2.5M14 7.5c0-1 1-1.4 1-2.5" /></>,
  rent: <><path d="m4 11 8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  travel: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8.5 21l1.5-4M15.5 21 14 17M9 14h.01M15 14h.01" /></>,
  utilities: <path d="M13 2 5 14h6l-1 8 8-12h-6z" />,
  other: <><path d="M3 12V4h8l10 10-8 8Z" /><path d="M7.5 7.5h.01" /></>,
  salary: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 13h18" /></>,
  freelance: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>,
  shopping: <><path d="M5 8h14l-1 12H6Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
};

export function CategoryIcon({ name, size = 16 }) {
  const path = CATEGORY_PATHS[name?.trim().toLowerCase()];
  if (path) return <Icon size={size} strokeWidth={1.8}>{path}</Icon>;
  return <span aria-hidden="true" className="text-[13px] font-semibold">{(name || "?").trim().charAt(0).toUpperCase()}</span>;
}

// The daybook mark: a ledger page with ruled lines and a red margin
export function BrandMark({ size = 30 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="shrink-0">
      <rect x="3" y="3" width="26" height="26" rx="4" fill="var(--color-brand)" />
      <rect x="9" y="6" width="17" height="20" rx="1" fill="var(--color-surface)" />
      <path d="M13 11h10M13 15h10M13 19h10M13 23h6" stroke="var(--color-field)" strokeWidth="1.4" />
      <path d="M11.5 6v20" stroke="var(--color-margin)" strokeWidth="1.4" />
    </svg>
  );
}

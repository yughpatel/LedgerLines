import { dayLabel, formatTxAmount, timeLabel } from "../format";
import { CategoryIcon, EditIcon, TrashIcon } from "./icons";

const TYPE_WORD = { DEBIT: "Expense", CREDIT: "Income", REFUND: "Refund" };
const AMOUNT_COLOR = { DEBIT: "text-expense", CREDIT: "text-income", REFUND: "text-refund" };

function RefundTag() {
  return (
    <span className="mr-1.5 inline-block rounded bg-refund-soft px-1.5 font-mono text-[10.5px] font-semibold uppercase leading-[18px] tracking-wide text-refund">
      Refund
    </span>
  );
}

// One transaction. The whole row opens Edit; on wider screens it also shows the
// category and time columns and Edit / Delete buttons. Never shown by colour alone:
// a + or − sign on every amount, a Refund tag, and the type word for screen readers
export default function TxRow({ tx, onEdit, onDelete, compact = false, flash = false, style }) {
  const title = tx.description || tx.category.name;
  const word = TYPE_WORD[tx.type];
  const time = timeLabel(tx.transaction_date);

  return (
    <li className={`flex items-center border-t border-line first:border-t-0 ${flash ? "animate-flash" : ""}`} style={style}>
      <button
        type="button" onClick={() => onEdit(tx)}
        aria-label={`${title}, ${word} ${formatTxAmount(tx)}, ${tx.category.name}, ${dayLabel(tx.transaction_date)} ${time}. Edit`}
        className={`grid min-h-14 min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:bg-surface-2 focus-visible:-outline-offset-2 ${
          compact
            ? "grid-cols-[auto_minmax(0,1fr)_auto] py-2"
            : "grid-cols-[auto_minmax(0,1fr)_auto] px-3.5 py-2 md:min-h-[50px] md:grid-cols-[auto_minmax(0,1fr)_150px_80px_150px] md:gap-4 md:px-4"
        }`}
      >
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-glyph bg-surface-2 text-ink">
          <CategoryIcon name={tx.category.name} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          <span className={`block truncate text-[13px] text-muted ${compact ? "" : "md:hidden"}`}>
            {tx.type === "REFUND" && <RefundTag />}
            {tx.description ? `${tx.category.name} · ${time}` : time}
          </span>
        </span>
        {!compact && (
          <>
            <span aria-hidden="true" className="hidden truncate text-sm text-muted md:block">
              {tx.type === "REFUND" && <RefundTag />}
              {tx.category.name}
            </span>
            <span aria-hidden="true" className="hidden font-mono text-sm text-muted md:block">{time}</span>
          </>
        )}
        <span className={`whitespace-nowrap text-right font-mono font-medium ${AMOUNT_COLOR[tx.type]}`}>
          <span className="sr-only">{word} </span>
          {formatTxAmount(tx)}
        </span>
      </button>
      {!compact && onDelete && (
        <div className="hidden gap-0.5 pr-2 md:flex">
          <button
            type="button" onClick={() => onEdit(tx)} aria-label={`Edit ${title}`}
            className="grid size-11 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <EditIcon size={18} />
          </button>
          <button
            type="button" onClick={() => onDelete(tx)} aria-label={`Delete ${title}`}
            className="grid size-11 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-danger-text active:scale-95"
          >
            <TrashIcon size={18} />
          </button>
        </div>
      )}
    </li>
  );
}

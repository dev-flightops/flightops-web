import type { CurrencyItemRef, PilotCurrencyCell } from "@/lib/api/types";

import {
  STATUS_TOKENS,
  daysUntil,
} from "../../crew-currency/status-tokens";
import { LogCompletionButton } from "./log-completion-button";

/**
 * One card per tracked currency item — Spec 5 §"Currency profile
 * page / Currency items".
 *
 * Shows item name + regulation, status badge, last completed date,
 * next base month due, grace end date, days until grace ends, +
 * a Log Completion button that opens the modal pre-filled with
 * this pilot + this item.
 *
 * Rolling-window display ("4 of 6 IFR approaches in 180 days") and
 * View History deferred — both need separate API surfaces.
 */
export function CurrencyItemCard({
  item,
  cell,
  pilotId,
  pilotName,
}: {
  item: CurrencyItemRef;
  cell: PilotCurrencyCell;
  pilotId: string;
  pilotName: string;
}) {
  const token = STATUS_TOKENS[cell.status];
  const isRolling = item.interval_type === "rolling_days";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight">{item.name}</h3>
          <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
            {item.regulation}
          </p>
        </div>
        <span className={token.badge}>
          {cell.status === "grace_month"
            ? `Grace${graceDaysSuffix(cell)}`
            : token.label}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[0.7rem]">
        <Field
          label="Last Completed"
          value={cell.last_completed_date ?? "—"}
        />
        {isRolling ? (
          <Field
            label="Window"
            value={
              item.rolling_days && item.rolling_threshold
                ? `${item.rolling_threshold} per ${item.rolling_days}d`
                : "—"
            }
          />
        ) : (
          <Field
            label="Next Base Month"
            value={formatMonth(cell.base_month_due)}
          />
        )}
        {!isRolling && (
          <Field
            label="Grace Ends"
            value={cell.grace_month_end ?? "—"}
          />
        )}
        {cell.status === "grace_month" && (
          <Field
            label="Days Until Non-Current"
            value={daysUntilLabel(cell)}
            accent="text-status-yellow"
          />
        )}
      </dl>

      {!isRolling && (
        <div className="mt-3 flex justify-end">
          <LogCompletionButton
            pilotId={pilotId}
            pilotName={pilotName}
            item={item}
          />
        </div>
      )}
      {isRolling && (
        <p className="mt-3 rounded-md border border-dashed border-border bg-card/40 px-3 py-2 text-[0.65rem] text-muted-foreground">
          Rolling items recompute automatically from submitted flight
          logs — no manual completion entry.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`text-right font-mono ${accent ?? ""}`}>{value}</dd>
    </>
  );
}

function graceDaysSuffix(cell: PilotCurrencyCell): string {
  const days = daysUntil(cell.grace_month_end);
  if (days === null || days < 0) return "";
  return ` — ${days}d`;
}

function daysUntilLabel(cell: PilotCurrencyCell): string {
  const days = daysUntil(cell.grace_month_end);
  if (days === null) return "—";
  if (days < 0) return "Past grace";
  return `${days}d`;
}

function formatMonth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

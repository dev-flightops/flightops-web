import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getPilotComplianceProfile } from "@/lib/api/ops";
import type {
  CurrencyItemRef,
  CurrencyStatus,
  PilotCurrencyCell,
} from "@/lib/api/types";

import { STATUS_TOKENS } from "../compliance/crew-currency/status-tokens";

/**
 * Training currency summary card on /flight-crew (Spec 4 §"Page
 * layout / Training currency summary").
 *
 * Reads the Spec 5 pilot profile for the logged-in user and renders
 * a row per tracked item with the same color tokens the compliance
 * grid uses. If any item is non_current, surfaces the spec-mandated
 * red banner ("You are non-current on [item]. Contact your Chief
 * Pilot before your next flight.").
 *
 * Rolling-window items (IFR approaches, day/night landings) display
 * "N/M" against their threshold rather than a calendar status.
 *
 * Renders a friendly empty / error state when the profile endpoint
 * is unavailable so a flaky compliance service doesn't break the
 * flight-crew home.
 */

const STATUS_PRIORITY: Record<CurrencyStatus, number> = {
  non_current: 0,
  grace_month: 1,
  due_this_month: 2,
  early_month: 3,
  upcoming: 4,
  not_started: 5,
};

export async function TrainingCurrencySummary({
  pilotUserId,
}: {
  pilotUserId: string;
}) {
  let cells: PilotCurrencyCell[] = [];
  let items: CurrencyItemRef[] = [];
  let loadError: string | null = null;
  try {
    const profile = await getPilotComplianceProfile(pilotUserId);
    cells = profile.cells;
    items = profile.items;
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Sign in to see your currency."
        : "Currency unavailable. Refresh in a moment.";
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-6 text-sm text-muted-foreground"
      >
        {loadError}
      </div>
    );
  }

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const rows = cells
    .map((c) => ({ cell: c, item: itemsById.get(c.currency_item_id) }))
    .filter((r): r is { cell: PilotCurrencyCell; item: CurrencyItemRef } => r.item !== undefined)
    .sort((a, b) => {
      const d = STATUS_PRIORITY[a.cell.status] - STATUS_PRIORITY[b.cell.status];
      if (d !== 0) return d;
      return a.item.sort_order - b.item.sort_order;
    });

  const nonCurrent = rows.filter((r) => r.cell.status === "non_current");

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-6 text-sm text-muted-foreground">
        No currency items tracked yet. Once a Chief Pilot logs your first
        completion, your status badges show up here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {nonCurrent.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          <span className="font-semibold">
            You are non-current on{" "}
            {nonCurrent.map((r) => r.item.name).join(", ")}.
          </span>{" "}
          Contact your Chief Pilot before your next flight.
        </div>
      )}
      <div className="rounded-xl border border-border bg-card/50">
        <ul className="divide-y divide-border/40">
          {rows.map(({ cell, item }) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground">
                  {item.name}
                </div>
                <div className="font-mono text-[0.65rem] text-muted-foreground">
                  {item.regulation}
                </div>
              </div>
              <CurrencyBadge cell={cell} item={item} />
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[0.65rem] text-muted-foreground">
        Have a question about your currency? Contact your Chief Pilot, or
        open your{" "}
        <Link
          href={`/compliance/pilots/${pilotUserId}`}
          className="font-semibold text-status-blue hover:underline"
        >
          full profile
        </Link>{" "}
        for completion history.
      </p>
    </div>
  );
}

function CurrencyBadge({
  cell,
  item,
}: {
  cell: PilotCurrencyCell;
  item: CurrencyItemRef;
}) {
  // Rolling-window items show "N/M" against their threshold rather
  // than a calendar-month status badge — that's the Spec 5 way for
  // FAR 61.57 currencies.
  if (
    item.interval_type === "rolling_days" &&
    item.rolling_threshold !== null
  ) {
    const count = cell.rolling_count ?? 0;
    const met = count >= item.rolling_threshold;
    const cls = met
      ? "rounded bg-status-green/15 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-status-green"
      : "rounded bg-status-yellow/15 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-status-yellow";
    return (
      <span className={cls}>
        {count}/{item.rolling_threshold}
      </span>
    );
  }
  const token = STATUS_TOKENS[cell.status];
  return <span className={token.badge}>{token.label}</span>;
}

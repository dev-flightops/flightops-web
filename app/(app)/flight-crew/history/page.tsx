import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listDutyHistory, listFlightLogs } from "@/lib/api/ops";

import { DutyHistoryTable } from "./duty-history-table";
import { FlightHistoryTable } from "./flight-history-table";
import { HistoryRangeForm } from "./history-range-form";
import {
  defaultRange,
  HISTORY_TAB_KEYS,
  HISTORY_TAB_LABELS,
  isHistoryTab,
  type HistoryTab,
} from "./tabs";

/**
 * /flight-crew/history — the pilot's personal Flight + Duty history
 * (Spec 4 step 5 / legacy `templates/crew/{flight,duty}_history.html`).
 *
 * Tab state lives in the URL `?tab=flight|duty`; date range lives in
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD`. Both are server-rendered so the
 * back/forward buttons restore the exact view a pilot was on.
 *
 * MVP scope (lighter-depth per the M2 plan):
 *   - Flight tab: own logs only (the backend's `mine=true` shortcut),
 *     filtered by date range, with a totals row
 *   - Duty tab: latest 100 own duty periods (no date filter on the
 *     duty endpoint yet — added in a follow-up if pilots ask)
 *   - No edit modals + no CSV export — those are admin features that
 *     legacy ships on the same surface; we'll add them once the
 *     viewer is solid
 */

const DUTY_LIMIT = 100;

export default async function FlightCrewHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const { tab: tabParam, from, to } = await searchParams;
  const activeTab: HistoryTab = isHistoryTab(tabParam) ? tabParam : "flight";
  const { fromDate, toDate } = resolveRange(from, to);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          My History
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Your flight and duty records. Per-tab; defaults to the last 30 days.
        </p>
      </header>

      <TabNav activeTab={activeTab} fromDate={fromDate} toDate={toDate} />

      <div className="mt-4 space-y-4">
        {activeTab === "flight" ? (
          <>
            <HistoryRangeForm
              fromDate={fromDate}
              toDate={toDate}
              tab="flight"
            />
            {await renderFlightTab(fromDate, toDate)}
          </>
        ) : (
          await renderDutyTab()
        )}
      </div>
    </div>
  );
}

async function renderFlightTab(fromDate: string, toDate: string) {
  try {
    const result = await listFlightLogs({
      mine: true,
      fromDate,
      toDate,
      limit: 200,
    });
    return (
      <FlightHistoryTable
        logs={result.items}
        fromDate={fromDate}
        toDate={toDate}
      />
    );
  } catch (err) {
    return <LoadError err={err} />;
  }
}

async function renderDutyTab() {
  try {
    const result = await listDutyHistory({ limit: DUTY_LIMIT });
    return <DutyHistoryTable periods={result.items} />;
  } catch (err) {
    return <LoadError err={err} />;
  }
}

function TabNav({
  activeTab,
  fromDate,
  toDate,
}: {
  activeTab: HistoryTab;
  fromDate: string;
  toDate: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="History sections"
      className="flex gap-1 border-b border-border pb-1"
    >
      {HISTORY_TAB_KEYS.map((key) => {
        const isActive = key === activeTab;
        // Preserve the date range when toggling tabs so a pilot
        // doesn't lose their "last 90 days" selection.
        const params = new URLSearchParams();
        if (key !== "flight") params.set("tab", key);
        params.set("from", fromDate);
        params.set("to", toDate);
        const href = `?${params.toString()}`;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={isActive}
            replace
            className={
              isActive
                ? "rounded-t-md border-b-2 border-status-blue px-3 py-1.5 text-xs font-semibold text-status-blue"
                : "rounded-t-md border-b-2 border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            }
          >
            {HISTORY_TAB_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );
}

function LoadError({ err }: { err: unknown }) {
  const status = err instanceof ApiError ? err.status : 0;
  const message =
    status === 401
      ? "Your session expired — please sign in again."
      : "History unavailable. Try refreshing in a moment.";
  return (
    <div
      role="alert"
      className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {message}
    </div>
  );
}

function resolveRange(
  fromParam: string | undefined,
  toParam: string | undefined,
): { fromDate: string; toDate: string } {
  const { from, to } = defaultRange();
  return {
    fromDate: isValidDate(fromParam) ? fromParam : from,
    toDate: isValidDate(toParam) ? toParam : to,
  };
}

function isValidDate(value: string | undefined): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

import { ApiError } from "@/lib/api/client";
import { getComplianceBoard } from "@/lib/api/ops";

import { AddCurrencyItemDialog } from "./add-currency-item-dialog";
import { ComplianceCalendar } from "./compliance-calendar";
import { ComplianceGrid } from "./compliance-grid";
import { ComplianceList } from "./compliance-list";
import { NonCurrentBanner } from "./non-current-banner";
import { SummaryChips } from "./summary-chips";
import { isCurrencyStatus, type CurrencyStatus } from "./types";
import { isComplianceView, ViewSwitcher, type ComplianceView } from "./view-switcher";

/**
 * /compliance/crew-currency — Fleet Compliance Board (Spec 5).
 *
 * Three views over the same data (M2-G-3):
 *   Grid     — default; matrix of pilots × items with color cells
 *   List     — flat sortable rows; status-urgency-first
 *   Calendar — 6-month plot of base / grace anchors
 *
 * View state lives in the URL `?view=grid|list|calendar` so the CP
 * can share a deep link (e.g. `?view=calendar&status=grace_month`).
 * Status filter shares the same surface — chips link to the active
 * view + chosen status.
 */
export default async function ComplianceCrewCurrencyPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    view?: string | string[];
    /** M2-G-3 tail — calendar drill-in on a single YYYY-MM. */
    month?: string | string[];
  }>;
}) {
  const {
    status: statusParam,
    view: viewParam,
    month: monthParam,
  } = await searchParams;
  const statusFilter = parseStatusFilter(statusParam);
  const view = parseView(viewParam);
  const focusedMonth = parseMonth(monthParam);

  let board;
  let loadError: string | null = null;
  try {
    board = await getComplianceBoard({
      // Only the Grid view consumes the server-side status filter via
      // the API (so the matrix stays sparse). List + Calendar filter
      // client-side because they aggregate findings differently and
      // need the full dataset to render counters / overflow correctly.
      status:
        view === "grid" && statusFilter ? [statusFilter] : undefined,
    });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Compliance board unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Fleet Compliance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Every pilot, every currency item — Spec 5 single source of truth.
          </p>
        </div>
        <AddCurrencyItemDialog />
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : board ? (
        <>
          {board.chips.non_current > 0 && (
            <NonCurrentBanner count={board.chips.non_current} />
          )}
          <SummaryChips
            chips={board.chips}
            active={statusFilter}
            view={view}
          />
          <ViewSwitcher active={view} statusFilter={statusFilter} />
          {view === "grid" && (
            <ComplianceGrid
              items={board.items}
              rows={board.rows}
              activeFilter={statusFilter}
            />
          )}
          {view === "list" && (
            <ComplianceList
              items={board.items}
              rows={board.rows}
              statusFilter={statusFilter}
            />
          )}
          {view === "calendar" && (
            <ComplianceCalendar
              items={board.items}
              rows={board.rows}
              statusFilter={statusFilter}
              focusedMonth={focusedMonth}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

function parseStatusFilter(
  param: string | string[] | undefined,
): CurrencyStatus | null {
  if (!param) return null;
  const first = Array.isArray(param) ? param[0] : param;
  return isCurrencyStatus(first) ? first : null;
}

function parseView(
  param: string | string[] | undefined,
): ComplianceView {
  if (!param) return "grid";
  const first = Array.isArray(param) ? param[0] : param;
  return isComplianceView(first) ? first : "grid";
}

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonth(param: string | string[] | undefined): string | null {
  if (!param) return null;
  const first = Array.isArray(param) ? param[0] : param;
  return MONTH_KEY_RE.test(first) ? first : null;
}

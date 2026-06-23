import { ApiError } from "@/lib/api/client";
import { getComplianceBoard } from "@/lib/api/ops";

import { ComplianceGrid } from "./compliance-grid";
import { NonCurrentBanner } from "./non-current-banner";
import { SummaryChips } from "./summary-chips";
import { isCurrencyStatus, type CurrencyStatus } from "./types";

/**
 * /compliance/crew-currency — Fleet Compliance Board (Spec 5).
 *
 * The Chief Pilot's primary workspace. Layout from Spec 5 §"Page
 * layout":
 *   1. Non-current alert banner (only if any pilot is non-current —
 *      undismissable per spec)
 *   2. Summary chips: Fully Current / Early / Grace / Non-Current.
 *      Clicking any chip filters the grid to that status.
 *   3. Grid: frozen pilot rows × frozen item columns, color-coded
 *      cells, click-to-log-completion (lands in PR 4 with the modal).
 *
 * Status filter lives in the URL `?status=…` so a CP can share a
 * filtered link with a peer. The chips render the filter state by
 * highlighting the active bucket.
 *
 * Deferred (PR 4 + later):
 *   - List view + Calendar view tabs
 *   - Log Completion modal (cell click → modal)
 *   - PDF / CSV export
 *   - Filter bar (base, aircraft type, name search)
 *   - Hover tooltip on cells (last completed, days until grace)
 */
export default async function ComplianceCrewCurrencyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status: statusParam } = await searchParams;
  const statusFilter = parseStatusFilter(statusParam);

  let board;
  let loadError: string | null = null;
  try {
    board = await getComplianceBoard({
      status: statusFilter ? [statusFilter] : undefined,
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
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Fleet Compliance
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every pilot, every currency item — Spec 5 single source of truth.
        </p>
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
          <SummaryChips chips={board.chips} active={statusFilter} />
          <ComplianceGrid
            items={board.items}
            rows={board.rows}
            activeFilter={statusFilter}
          />
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

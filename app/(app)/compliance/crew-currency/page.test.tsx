import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getComplianceBoard, TestApiError } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { getComplianceBoard: vi.fn(), TestApiError };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getComplianceBoard }));

import ComplianceCrewCurrencyPage from "./page";
import type {
  ComplianceBoardResponse,
  ComplianceChips,
  CurrencyItemRef,
  PilotComplianceRow,
} from "@/lib/api/types";

function makeItem(over: Partial<CurrencyItemRef> & { id: string }): CurrencyItemRef {
  return {
    code: "competency_check",
    name: "Initial Competency Check",
    regulation: "14 CFR 135.293(a)",
    interval_type: "annual",
    requires_examiner: true,
    is_check_event: true,
    is_initial_only: false,
    rolling_days: null,
    rolling_threshold: null,
    sort_order: 10,
    ...over,
  };
}

function makeRow(
  over: Partial<PilotComplianceRow> & { pilot: PilotComplianceRow["pilot"] },
): PilotComplianceRow {
  return {
    overall_status: "due_this_month",
    cells: [],
    ...over,
  };
}

function makeBoard(
  over: Partial<ComplianceBoardResponse> = {},
): ComplianceBoardResponse {
  const chips: ComplianceChips = {
    fully_current: 0,
    early_month: 0,
    grace_month: 0,
    non_current: 0,
    ...(over.chips ?? {}),
  };
  return {
    items: over.items ?? [],
    rows: over.rows ?? [],
    chips,
  };
}

async function renderPage(
  searchParams: Record<string, string | string[]> = {},
) {
  const ui = await ComplianceCrewCurrencyPage({
    searchParams: Promise.resolve(searchParams),
  });
  return render(ui);
}

beforeEach(() => {
  getComplianceBoard.mockReset();
});

describe("ComplianceCrewCurrencyPage", () => {
  it("renders the header + summary chips with the bucket counts", async () => {
    getComplianceBoard.mockResolvedValueOnce(
      makeBoard({
        chips: {
          fully_current: 12,
          early_month: 4,
          grace_month: 2,
          non_current: 0,
        },
      }),
    );

    await renderPage();

    expect(screen.getByRole("heading", { name: /fleet compliance/i }))
      .toBeInTheDocument();
    // Chips render counts.
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the non-current banner only when count > 0", async () => {
    getComplianceBoard.mockResolvedValueOnce(
      makeBoard({
        chips: { fully_current: 8, early_month: 0, grace_month: 0, non_current: 3 },
      }),
    );

    await renderPage();

    expect(
      screen.getByText(/3 pilots are non-current/i),
    ).toBeInTheDocument();
  });

  it("hides the non-current banner when zero", async () => {
    getComplianceBoard.mockResolvedValueOnce(
      makeBoard({
        chips: { fully_current: 8, early_month: 0, grace_month: 0, non_current: 0 },
      }),
    );

    await renderPage();

    expect(
      screen.queryByText(/non-current and cannot fly/i),
    ).not.toBeInTheDocument();
  });

  it("passes a status filter from the URL through to the API call", async () => {
    getComplianceBoard.mockResolvedValueOnce(makeBoard());

    await renderPage({ status: "grace_month" });

    expect(getComplianceBoard).toHaveBeenCalledWith({
      status: ["grace_month"],
    });
  });

  it("ignores malformed status params", async () => {
    getComplianceBoard.mockResolvedValueOnce(makeBoard());

    await renderPage({ status: "not-a-real-status" });

    expect(getComplianceBoard).toHaveBeenCalledWith({ status: undefined });
  });

  it("renders the grid with pilot rows + item columns", async () => {
    const competency = makeItem({ id: "item-1" });
    const ipc = makeItem({
      id: "item-2",
      code: "ipc",
      name: "Instrument Proficiency Check",
      regulation: "14 CFR 135.297",
      interval_type: "semi_annual",
    });
    getComplianceBoard.mockResolvedValueOnce(
      makeBoard({
        items: [competency, ipc],
        rows: [
          makeRow({
            pilot: {
              id: "p-1",
              full_name: "Alice Pilot",
              email: "alice@x.test",
            },
            overall_status: "grace_month",
            cells: [
              {
                currency_item_id: "item-1",
                status: "grace_month",
                last_completed_date: "2025-06-15",
                base_month_due: "2026-06-01",
                grace_month_end: "2026-07-31",
                rolling_count: null,
              },
              {
                currency_item_id: "item-2",
                status: "due_this_month",
                last_completed_date: null,
                base_month_due: null,
                grace_month_end: null,
                rolling_count: null,
              },
            ],
          }),
        ],
        chips: {
          fully_current: 0,
          early_month: 0,
          grace_month: 1,
          non_current: 0,
        },
      }),
    );

    await renderPage();

    // Column headers — abbreviated names.
    expect(screen.getByText(/compt\./i)).toBeInTheDocument();
    expect(screen.getByText(/ipc/i)).toBeInTheDocument();
    // Pilot row.
    expect(screen.getByText("Alice Pilot")).toBeInTheDocument();
    // Status badges visible in row + cell.
    const dueBadges = screen.getAllByText(/due this month/i);
    expect(dueBadges.length).toBeGreaterThan(0);
  });

  it("renders an empty state when filter matches no pilots", async () => {
    getComplianceBoard.mockResolvedValueOnce(
      makeBoard({
        items: [makeItem({ id: "i-1" })],
        rows: [],
      }),
    );

    await renderPage({ status: "non_current" });

    expect(
      screen.getByText(/no pilots match the non-current filter/i),
    ).toBeInTheDocument();
  });

  it("shows the session-expired message on 401", async () => {
    getComplianceBoard.mockRejectedValueOnce(
      new TestApiError(401, "/ops/compliance/board", "Unauthorized"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/session expired/i);
  });

  it("shows the generic unavailable message on 5xx", async () => {
    getComplianceBoard.mockRejectedValueOnce(
      new TestApiError(502, "/ops/compliance/board", "Bad Gateway"),
    );

    await renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });

  it("active chip toggles off when re-clicked (Link to clean URL)", async () => {
    getComplianceBoard.mockResolvedValueOnce(
      makeBoard({
        chips: {
          fully_current: 0,
          early_month: 0,
          grace_month: 5,
          non_current: 0,
        },
      }),
    );

    await renderPage({ status: "grace_month" });

    // The grace chip should link back to the clean URL when active
    // (toggle-off behavior).
    const graceChip = screen.getByRole("link", { name: /grace month/i });
    expect(graceChip.getAttribute("href")).toBe(
      "/compliance/crew-currency",
    );
    // The other chips should still link to set their own filter.
    const nonCurrentChip = screen.getByRole("link", {
      name: /non-current/i,
    });
    expect(nonCurrentChip.getAttribute("href")).toBe(
      "/compliance/crew-currency?status=non_current",
    );
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountingExportResponse } from "@/lib/api/types";

const { TestApiError, getAccountingExport } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getAccountingExport: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getAccountingExport }));

import AccountingExportPage from "./page";

function emptyResponse(): AccountingExportResponse {
  return {
    start: "2026-06-24",
    end: "2026-07-24",
    rows: [],
    totals: { flights: 0, revenue_pax: 0, cargo_lbs: 0, mail_lbs: 0 },
  };
}

beforeEach(() => {
  getAccountingExport.mockReset();
});

async function renderPage(params: Record<string, string> = {}) {
  const page = await AccountingExportPage({
    searchParams: Promise.resolve(params),
  });
  render(page);
}

describe("/reservations/accounting-export", () => {
  it("renders legacy header + subtitle; Export CSV is hidden with 0 rows", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Accounting Export" }),
    ).toBeDefined();
    expect(screen.getByText(/Review completed flight activity/)).toBeDefined();
    // Legacy /acct-export hides the Export CSV button entirely when
    // there are no rows to export. Ours does the same.
    expect(screen.queryByText(/Export CSV/)).toBeNull();
  });

  it("renders 4 summary tiles + empty-state panel with 0 rows", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());

    await renderPage();

    for (const label of ["Completed Flights", "Revenue Passengers", "Cargo", "Mail (USPS)"]) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(
      screen.getByText(/No completed flights in this date range/),
    ).toBeDefined();
    expect(
      screen.getByText(/Adjust the date range or check that flights/),
    ).toBeDefined();
    // Table (and its headers) is hidden on empty — matches legacy.
    expect(screen.queryByRole("columnheader")).toBeNull();
  });

  it("renders backend rows with real per-flight columns + 11-column table", async () => {
    getAccountingExport.mockResolvedValue({
      start: "2026-06-24",
      end: "2026-07-24",
      rows: [
        {
          id: "f-1",
          date: "2026-07-15",
          flight_number: "GRT201",
          flight_type: "scheduled",
          origin: "PANC",
          destination: "PABE",
          aircraft_tail: "N207GE",
          pic_name: "Alice Chen",
          customer: null,
          revenue_pax: 5,
          cargo_lbs: 250,
          mail_lbs: null,
          notes: "smooth ride",
        },
      ],
      totals: { flights: 1, revenue_pax: 5, cargo_lbs: 250, mail_lbs: 0 },
    });

    await renderPage();

    expect(screen.getByText("GRT201")).toBeDefined();
    expect(screen.getByText(/PANC → PABE/)).toBeDefined();
    expect(screen.getByText("N207GE")).toBeDefined();
    expect(screen.getByText("Alice Chen")).toBeDefined();
    expect(screen.getByText("scheduled")).toBeDefined();
    expect(screen.getByText("smooth ride")).toBeDefined();
    // With rows > 0, all 11 legacy column headers render.
    for (const col of [
      "Date",
      "Flight #",
      "Type",
      "Route",
      "Aircraft",
      "PIC",
      "Customer",
      "Rev Pax",
      "Cargo lbs",
      "Mail lbs",
      "Notes",
    ]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeDefined();
    }
    // With rows > 0 the Export CSV link surfaces w/ the total count.
    const link = screen
      .getAllByText(/Export CSV/)
      .map((el) => el.closest("a"))
      .find(Boolean);
    expect(link?.textContent).toMatch(/\(1 rows\)/);
  });

  it("renders the 'About this export' info panel from legacy", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());
    await renderPage();
    expect(
      screen.getByText(/QuickBooks, Xero, Sage, or any system that accepts CSV/),
    ).toBeDefined();
  });

  it("filter bar renders From / To / Customer / Filter / Reset controls", async () => {
    getAccountingExport.mockResolvedValue(emptyResponse());
    await renderPage();
    expect(screen.getByRole("search")).toBeDefined();
    expect(screen.getByRole("button", { name: "Filter" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("shows a friendly error banner on 401", async () => {
    getAccountingExport.mockRejectedValue(
      new TestApiError(401, "/ops/accounting-export", "Unauthorized"),
    );
    await renderPage();
    expect(screen.getByText(/session expired/i)).toBeDefined();
  });
});
